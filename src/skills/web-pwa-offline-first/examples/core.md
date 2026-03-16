# Offline-First Core Examples

> Core code examples for offline-first applications. See [SKILL.md](../SKILL.md) for concepts.

**Extended patterns:** See [indexeddb.md](indexeddb.md) for database setup and [sync.md](sync.md) for conflict resolution and synchronization.

---

## Pattern 1: Syncable Entity Structure

Every entity that needs synchronization must include metadata for tracking sync state.

```typescript
// ✅ Good Example - Syncable entity with full metadata
interface SyncableEntity {
  id: string;

  // Sync tracking fields
  _syncStatus: "synced" | "pending" | "conflicted";
  _lastModified: number; // Client timestamp
  _serverTimestamp?: number; // Server timestamp for conflict resolution
  _localVersion: string; // Local revision ID (UUID)
  _serverVersion?: string; // Server revision ID
  _deletedAt?: number; // Soft delete timestamp (tombstone)
}

// Named constants for sync status
const SYNC_STATUS = {
  SYNCED: "synced",
  PENDING: "pending",
  CONFLICTED: "conflicted",
} as const;

// Example: Todo entity with sync metadata
interface Todo extends SyncableEntity {
  title: string;
  completed: boolean;
  userId: string;
}

// Factory function for creating syncable entities
function createTodo(title: string, userId: string): Todo {
  return {
    id: crypto.randomUUID(),
    title,
    completed: false,
    userId,
    _syncStatus: SYNC_STATUS.PENDING,
    _lastModified: Date.now(),
    _localVersion: crypto.randomUUID(),
  };
}
```

**Why good:** Clear separation of business data and sync metadata, named constants prevent typos, factory function ensures consistent creation, all fields have explicit types

```typescript
// ❌ Bad Example - No sync metadata
interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

// No way to track:
// - Whether this todo has been synced
// - When it was last modified
// - If there's a conflict
// - If it's been soft-deleted
```

**Why bad:** No sync tracking means data can be lost during sync, no conflict detection possible, hard deletes prevent proper multi-device sync

---

## Pattern 2: Repository Pattern for Data Access

Use a repository as the single access point for all data operations, encapsulating local storage and sync queue logic.

```typescript
// ✅ Good Example - Repository pattern
import type { Table } from "dexie";

interface DataRepository<T extends SyncableEntity> {
  // Reads always from local
  get(id: string): Promise<T | null>;
  getAll(): Promise<T[]>;
  query(filter: (item: T) => boolean): Promise<T[]>;

  // Writes go local first, then queue sync
  save(item: T): Promise<void>;
  delete(id: string): Promise<void>;

  // Sync status
  getSyncStatus(id: string): Promise<SyncStatus>;
  getPendingCount(): Promise<number>;
}

type SyncStatus = "synced" | "pending" | "conflicted" | "error";

class TodoRepository implements DataRepository<Todo> {
  constructor(
    private readonly localDb: Table<Todo, string>,
    private readonly syncQueue: SyncQueue,
  ) {}

  async get(id: string): Promise<Todo | null> {
    const todo = await this.localDb.get(id);
    // Filter out soft-deleted items
    if (todo?._deletedAt) return null;
    return todo ?? null;
  }

  async getAll(): Promise<Todo[]> {
    return this.localDb.filter((todo) => !todo._deletedAt).toArray();
  }

  async save(todo: Todo): Promise<void> {
    const now = Date.now();

    // Update sync metadata
    const updatedTodo: Todo = {
      ...todo,
      _syncStatus: SYNC_STATUS.PENDING,
      _lastModified: now,
      _localVersion: crypto.randomUUID(),
    };

    // 1. Save to local database immediately
    await this.localDb.put(updatedTodo);

    // 2. Queue for background sync
    await this.syncQueue.enqueue({
      type: "UPSERT",
      collection: "todos",
      data: updatedTodo,
      timestamp: now,
    });
  }

  async delete(id: string): Promise<void> {
    const now = Date.now();

    // Soft delete - update with tombstone
    await this.localDb.update(id, {
      _syncStatus: SYNC_STATUS.PENDING,
      _lastModified: now,
      _deletedAt: now,
    });

    // Queue deletion for sync
    await this.syncQueue.enqueue({
      type: "DELETE",
      collection: "todos",
      data: { id },
      timestamp: now,
    });
  }

  async getSyncStatus(id: string): Promise<SyncStatus> {
    const todo = await this.localDb.get(id);
    return todo?._syncStatus ?? "error";
  }

  async getPendingCount(): Promise<number> {
    return this.localDb
      .where("_syncStatus")
      .equals(SYNC_STATUS.PENDING)
      .count();
  }
}

export { TodoRepository };
export type { DataRepository, SyncStatus };
```

**Why good:** Single access point for all data operations, encapsulates sync logic, soft deletes enable proper sync, sync status queryable, repository is testable in isolation

---

## Pattern 3: Sync Queue Management

Queue operations when offline and process them reliably when connectivity returns.

```typescript
// ✅ Good Example - Robust sync queue
interface QueuedOperation {
  id: string;
  type: "CREATE" | "UPDATE" | "DELETE" | "UPSERT";
  collection: string;
  data: unknown;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

// Named constants
const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const BACKOFF_MULTIPLIER = 2;
const JITTER_FACTOR = 0.5;

function calculateBackoff(attempt: number): number {
  const exponentialDelay = Math.min(
    INITIAL_BACKOFF_MS * Math.pow(BACKOFF_MULTIPLIER, attempt),
    MAX_BACKOFF_MS,
  );

  // Add jitter to prevent thundering herd
  const jitter = exponentialDelay * JITTER_FACTOR * (Math.random() * 2 - 1);

  return Math.floor(exponentialDelay + jitter);
}

class SyncQueue {
  private readonly db: LocalDatabase;
  private readonly STORE_NAME = "syncQueue";
  private processing = false;

  constructor(db: LocalDatabase) {
    this.db = db;

    // Listen for online events
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.processQueue());
    }
  }

  async enqueue(
    operation: Omit<QueuedOperation, "id" | "retryCount">,
  ): Promise<void> {
    await this.db.add(this.STORE_NAME, {
      ...operation,
      id: crypto.randomUUID(),
      retryCount: 0,
    });

    // Try to process immediately if online
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  async processQueue(): Promise<void> {
    if (this.processing || !navigator.onLine) return;
    this.processing = true;

    try {
      const operations = await this.db.getAll(this.STORE_NAME);

      // Sort by timestamp to maintain order
      operations.sort((a, b) => a.timestamp - b.timestamp);

      for (const op of operations) {
        try {
          await this.executeOperation(op);
          // Success - remove from queue
          await this.db.delete(this.STORE_NAME, op.id);
        } catch (error) {
          await this.handleOperationError(op, error);
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async executeOperation(op: QueuedOperation): Promise<void> {
    const endpoint = `/api/${op.collection}`;

    const response = await fetch(endpoint, {
      method: this.getHttpMethod(op.type),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(op.data),
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`);
    }
  }

  private getHttpMethod(type: QueuedOperation["type"]): string {
    const methods: Record<QueuedOperation["type"], string> = {
      CREATE: "POST",
      UPDATE: "PUT",
      DELETE: "DELETE",
      UPSERT: "PUT",
    };
    return methods[type];
  }

  private async handleOperationError(
    op: QueuedOperation,
    error: unknown,
  ): Promise<void> {
    if (op.retryCount >= MAX_RETRY_ATTEMPTS) {
      // Move to dead letter queue or notify user
      console.error(
        `Operation ${op.id} failed after ${MAX_RETRY_ATTEMPTS} retries`,
        error,
      );
      await this.db.delete(this.STORE_NAME, op.id);
      // Emit event for UI to handle
      this.emitSyncFailure(op);
      return;
    }

    // Increment retry count and schedule retry
    const delay = calculateBackoff(op.retryCount);

    await this.db.put(this.STORE_NAME, {
      ...op,
      retryCount: op.retryCount + 1,
      lastError: error instanceof Error ? error.message : "Unknown error",
    });

    // Schedule retry
    setTimeout(() => this.processQueue(), delay);
  }

  private emitSyncFailure(op: QueuedOperation): void {
    window.dispatchEvent(new CustomEvent("sync-failure", { detail: op }));
  }

  async getQueueLength(): Promise<number> {
    const operations = await this.db.getAll(this.STORE_NAME);
    return operations.length;
  }
}

export { SyncQueue };
export type { QueuedOperation };
```

**Why good:** Exponential backoff with jitter prevents server overload, retry limits prevent infinite loops, operations sorted by timestamp maintain consistency, dead letter handling for failed operations, event emission for UI feedback

---

## Pattern 4: Network Status Detection

Reliably detect network status and adjust behavior accordingly.

```typescript
// ✅ Good Example - Robust network status detection
type NetworkStatus = "online" | "offline" | "slow";
type NetworkListener = (status: NetworkStatus) => void;

const SLOW_THRESHOLD_MS = 2000;
const HEALTH_CHECK_INTERVAL_MS = 30000;

class NetworkStatusManager {
  private status: NetworkStatus = navigator.onLine ? "online" : "offline";
  private listeners = new Set<NetworkListener>();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.setupEventListeners();

    // Initial health check if online
    if (navigator.onLine) {
      this.checkConnectionQuality();
    }
  }

  private setupEventListeners(): void {
    window.addEventListener("online", () => {
      this.updateStatus("online");
      this.checkConnectionQuality();
    });

    window.addEventListener("offline", () => {
      this.updateStatus("offline");
      this.stopHealthCheck();
    });
  }

  private updateStatus(newStatus: NetworkStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.listeners.forEach((listener) => listener(newStatus));
    }
  }

  getStatus(): NetworkStatus {
    return this.status;
  }

  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async checkConnectionQuality(): Promise<NetworkStatus> {
    if (!navigator.onLine) {
      this.updateStatus("offline");
      return "offline";
    }

    try {
      const start = performance.now();

      // Use a small health endpoint
      const response = await fetch("/api/health", {
        method: "HEAD",
        cache: "no-store",
      });

      const latency = performance.now() - start;

      if (!response.ok) {
        this.updateStatus("offline");
        return "offline";
      }

      const status = latency > SLOW_THRESHOLD_MS ? "slow" : "online";
      this.updateStatus(status);
      return status;
    } catch {
      this.updateStatus("offline");
      return "offline";
    }
  }

  startHealthCheck(): void {
    this.stopHealthCheck();
    this.healthCheckInterval = setInterval(
      () => this.checkConnectionQuality(),
      HEALTH_CHECK_INTERVAL_MS,
    );
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  destroy(): void {
    this.stopHealthCheck();
    this.listeners.clear();
  }
}

// Singleton instance
const networkStatus = new NetworkStatusManager();

export { networkStatus, NetworkStatusManager };
export type { NetworkStatus, NetworkListener };
```

**Why good:** Doesn't rely solely on navigator.onLine (which can be unreliable), actual health check for real connectivity, slow connection detection, proper cleanup methods, event-based updates

---

## Pattern 5: Optimistic UI with Rollback

Update UI immediately and roll back if sync fails.

```typescript
// ✅ Good Example - Optimistic updates with rollback support
interface PendingChange<T> {
  id: string;
  previousValue: T | null;
  newValue: T;
  timestamp: number;
}

class OptimisticUpdateManager<T extends SyncableEntity> {
  private pendingChanges = new Map<string, PendingChange<T>>();

  async applyOptimistically(
    id: string,
    newValue: T,
    localDb: {
      get: (id: string) => Promise<T | undefined>;
      put: (value: T) => Promise<void>;
      delete: (id: string) => Promise<void>;
    },
    onUpdate: (items: T[]) => void,
    getAllItems: () => Promise<T[]>,
  ): Promise<() => Promise<void>> {
    // Get current value for potential rollback
    const previousValue = (await localDb.get(id)) ?? null;

    // Store pending change
    this.pendingChanges.set(id, {
      id,
      previousValue,
      newValue,
      timestamp: Date.now(),
    });

    // Apply optimistic update
    await localDb.put(newValue);

    // Notify UI
    const allItems = await getAllItems();
    onUpdate(allItems);

    // Return rollback function
    return async () => {
      const pending = this.pendingChanges.get(id);
      if (!pending) return;

      if (pending.previousValue) {
        await localDb.put(pending.previousValue);
      } else {
        await localDb.delete(id);
      }

      this.pendingChanges.delete(id);

      const updatedItems = await getAllItems();
      onUpdate(updatedItems);
    };
  }

  async confirmChange(id: string): Promise<void> {
    this.pendingChanges.delete(id);
  }

  hasPendingChanges(): boolean {
    return this.pendingChanges.size > 0;
  }

  getPendingChangeIds(): string[] {
    return Array.from(this.pendingChanges.keys());
  }
}

export { OptimisticUpdateManager };
export type { PendingChange };
```

**Why good:** Stores previous value for rollback, returns rollback function for error handling, tracks all pending changes, supports both update and create scenarios

---

## Pattern 6: Connection-Aware Data Fetching

Fetch from network when online, gracefully fall back to cache when offline.

```typescript
// ✅ Good Example - Connection-aware fetcher
const FETCH_TIMEOUT_MS = 10000;

interface FetchResult<T> {
  data: T;
  source: "network" | "cache";
  timestamp: number;
}

interface LocalCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, timestamp?: number): Promise<void>;
}

async function fetchWithOfflineSupport<T>(
  url: string,
  localCache: LocalCache,
  options: RequestInit = {},
): Promise<FetchResult<T>> {
  const cacheKey = `fetch:${url}`;

  // Check if online
  if (!navigator.onLine) {
    const cached = await localCache.get<{ data: T; timestamp: number }>(
      cacheKey,
    );
    if (cached) {
      return {
        data: cached.data,
        source: "cache",
        timestamp: cached.timestamp,
      };
    }
    throw new Error("Offline and no cached data available");
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as T;
    const timestamp = Date.now();

    // Cache successful response
    await localCache.set(cacheKey, { data, timestamp });

    return { data, source: "network", timestamp };
  } catch (error) {
    // Try cache on network failure
    const cached = await localCache.get<{ data: T; timestamp: number }>(
      cacheKey,
    );
    if (cached) {
      console.warn("Network failed, using cached data:", error);
      return {
        data: cached.data,
        source: "cache",
        timestamp: cached.timestamp,
      };
    }
    throw error;
  }
}

export { fetchWithOfflineSupport };
export type { FetchResult, LocalCache };
```

**Why good:** Returns source metadata for UI indication, caches successful responses, falls back to cache on failure, timeout prevents hanging requests, typed cache interface

---

## Pattern 7: React Hook for Network Status

A hook for reactive network status in components.

### Implementation

```typescript
// hooks/use-network-status.ts
import { useSyncExternalStore, useCallback } from "react";

type NetworkStatus = "online" | "offline" | "slow";

interface NetworkStatusStore {
  getStatus(): NetworkStatus;
  subscribe(listener: () => void): () => void;
}

// Create a singleton store
function createNetworkStatusStore(): NetworkStatusStore {
  let status: NetworkStatus = navigator.onLine ? "online" : "offline";
  const listeners = new Set<() => void>();

  function updateStatus(newStatus: NetworkStatus): void {
    if (status !== newStatus) {
      status = newStatus;
      listeners.forEach((listener) => listener());
    }
  }

  // Setup event listeners
  window.addEventListener("online", () => updateStatus("online"));
  window.addEventListener("offline", () => updateStatus("offline"));

  return {
    getStatus: () => status,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const networkStore = createNetworkStatusStore();

function useNetworkStatus(): NetworkStatus {
  const getSnapshot = useCallback(() => networkStore.getStatus(), []);

  const subscribe = useCallback((callback: () => void) => {
    return networkStore.subscribe(callback);
  }, []);

  // Server snapshot always returns 'online' for SSR
  const getServerSnapshot = useCallback(() => "online" as NetworkStatus, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export { useNetworkStatus };
export type { NetworkStatus };
```

### Usage

```tsx
// components/sync-indicator.tsx
import { useNetworkStatus } from "../hooks/use-network-status";

function SyncIndicator() {
  const status = useNetworkStatus();

  return (
    <div role="status" aria-live="polite" data-status={status}>
      {status === "offline" && (
        <span>You are offline. Changes will sync when connected.</span>
      )}
      {status === "slow" && (
        <span>Slow connection detected. Some features may be delayed.</span>
      )}
      {status === "online" && <span>Connected</span>}
    </div>
  );
}

export { SyncIndicator };
```

**Why good:** Uses useSyncExternalStore for proper React 18 integration, SSR-safe with server snapshot, semantic data attributes for styling, accessible with role and aria-live

---

## Pattern 8: Pending Sync Counter Hook

Track the number of pending sync operations for UI feedback.

```typescript
// hooks/use-pending-sync-count.ts
import { useState, useEffect } from "react";

interface SyncQueue {
  getQueueLength(): Promise<number>;
  subscribe(listener: () => void): () => void;
}

function usePendingSyncCount(syncQueue: SyncQueue): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Initial fetch
    syncQueue.getQueueLength().then(setCount);

    // Subscribe to changes
    const unsubscribe = syncQueue.subscribe(() => {
      syncQueue.getQueueLength().then(setCount);
    });

    return unsubscribe;
  }, [syncQueue]);

  return count;
}

export { usePendingSyncCount };
```

### Usage with Badge

```tsx
// components/sync-badge.tsx
import { usePendingSyncCount } from "../hooks/use-pending-sync-count";
import { useSyncQueue } from "../context/sync-context";

function SyncBadge() {
  const syncQueue = useSyncQueue();
  const pendingCount = usePendingSyncCount(syncQueue);

  if (pendingCount === 0) {
    return null;
  }

  return (
    <span
      role="status"
      aria-label={`${pendingCount} changes pending sync`}
      data-testid="pending-sync"
    >
      {pendingCount}
    </span>
  );
}

export { SyncBadge };
```

**Why good:** Reactive updates when queue changes, accessible labels, conditional rendering when empty

---

## Pattern 9: Offline-Aware Form Submission

Handle form submissions that work seamlessly online and offline.

```typescript
// hooks/use-offline-mutation.ts
import { useState, useCallback } from "react";

interface MutationState<T> {
  data: T | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  isPending: boolean; // Queued but not synced
}

interface MutationOptions<TInput, TOutput> {
  // Save to local database
  localMutation: (input: TInput) => Promise<TOutput>;
  // Queue for server sync
  queueSync: (input: TInput) => Promise<void>;
  // Optional: optimistic update for UI
  onOptimisticUpdate?: (input: TInput) => void;
  // Optional: rollback on local failure
  onRollback?: (input: TInput, error: Error) => void;
}

function useOfflineMutation<TInput, TOutput>(
  options: MutationOptions<TInput, TOutput>,
) {
  const [state, setState] = useState<MutationState<TOutput>>({
    data: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null,
    isPending: false,
  });

  const mutate = useCallback(
    async (input: TInput) => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        isError: false,
        error: null,
      }));

      // Optimistic update
      options.onOptimisticUpdate?.(input);

      try {
        // 1. Save to local database (always succeeds unless DB error)
        const result = await options.localMutation(input);

        // 2. Queue for sync (will process when online)
        await options.queueSync(input);

        setState({
          data: result,
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
          isPending: !navigator.onLine,
        });

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");

        // Rollback optimistic update
        options.onRollback?.(input, err);

        setState({
          data: null,
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: err,
          isPending: false,
        });

        throw error;
      }
    },
    [options],
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      isLoading: false,
      isSuccess: false,
      isError: false,
      error: null,
      isPending: false,
    });
  }, []);

  return {
    ...state,
    mutate,
    reset,
  };
}

export { useOfflineMutation };
export type { MutationState, MutationOptions };
```

### Usage in Form Component

```tsx
// components/todo-form.tsx
import { useState } from "react";
import { useOfflineMutation } from "../hooks/use-offline-mutation";
import { useTodoRepository } from "../context/repository-context";
import { useSyncQueue } from "../context/sync-context";
import { createTodo } from "../models/todo";
import type { Todo } from "../models/todo";

function TodoForm() {
  const [title, setTitle] = useState("");
  const todoRepository = useTodoRepository();
  const syncQueue = useSyncQueue();

  const { mutate, isLoading, isPending, isError, error, reset } =
    useOfflineMutation<{ title: string }, Todo>({
      localMutation: async ({ title }) => {
        const todo = createTodo(title, "current-user");
        await todoRepository.save(todo);
        return todo;
      },
      queueSync: async ({ title }) => {
        const todo = createTodo(title, "current-user");
        await syncQueue.enqueue({
          type: "CREATE",
          collection: "todos",
          data: todo,
          timestamp: Date.now(),
        });
      },
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    try {
      await mutate({ title });
      setTitle("");
    } catch {
      // Error handled in mutation state
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a todo..."
        disabled={isLoading}
        aria-describedby={isError ? "error-message" : undefined}
      />

      <button type="submit" disabled={isLoading || !title.trim()}>
        {isLoading ? "Saving..." : "Add"}
      </button>

      {isPending && (
        <span role="status">Saved locally. Will sync when online.</span>
      )}

      {isError && (
        <span id="error-message" role="alert">
          {error?.message}
          <button type="button" onClick={reset}>
            Dismiss
          </button>
        </span>
      )}
    </form>
  );
}

export { TodoForm };
```

**Why good:** Separates local mutation from sync queue, tracks pending state for UI feedback, handles errors gracefully, form remains functional offline

---

## Pattern 10: Offline-First Data Provider

Context provider that manages offline-first data layer.

```typescript
// context/offline-data-provider.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { LocalDatabase } from '../db/database';
import type { SyncQueue } from '../sync/sync-queue';
import type { NetworkStatus } from '../hooks/use-network-status';

interface OfflineDataContextValue {
  database: LocalDatabase;
  syncQueue: SyncQueue;
  networkStatus: NetworkStatus;
  isInitialized: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  forceSync: () => Promise<void>;
}

const OfflineDataContext = createContext<OfflineDataContextValue | null>(null);

interface OfflineDataProviderProps {
  children: ReactNode;
  database: LocalDatabase;
  syncQueue: SyncQueue;
}

function OfflineDataProvider({
  children,
  database,
  syncQueue,
}: OfflineDataProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(
    navigator.onLine ? 'online' : 'offline'
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  // Initialize database and sync queue
  useEffect(() => {
    async function initialize() {
      try {
        setIsInitialized(true);

        const count = await syncQueue.getQueueLength();
        setPendingCount(count);

        if (navigator.onLine) {
          await syncQueue.processQueue();
          setLastSyncTime(Date.now());
        }
      } catch (error) {
        console.error('Failed to initialize offline data layer:', error);
      }
    }

    initialize();
  }, [database, syncQueue]);

  // Listen for network status changes
  useEffect(() => {
    function handleOnline() {
      setNetworkStatus('online');
      syncQueue.processQueue().then(() => {
        setLastSyncTime(Date.now());
      });
    }

    function handleOffline() {
      setNetworkStatus('offline');
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue]);

  // Subscribe to queue changes
  useEffect(() => {
    const unsubscribe = syncQueue.subscribe(() => {
      syncQueue.getQueueLength().then(setPendingCount);
    });

    return unsubscribe;
  }, [syncQueue]);

  const forceSync = async () => {
    if (!navigator.onLine) {
      throw new Error('Cannot sync while offline');
    }

    await syncQueue.processQueue();
    setLastSyncTime(Date.now());
  };

  const value: OfflineDataContextValue = {
    database,
    syncQueue,
    networkStatus,
    isInitialized,
    pendingCount,
    lastSyncTime,
    forceSync,
  };

  return (
    <OfflineDataContext.Provider value={value}>
      {children}
    </OfflineDataContext.Provider>
  );
}

function useOfflineData(): OfflineDataContextValue {
  const context = useContext(OfflineDataContext);
  if (!context) {
    throw new Error('useOfflineData must be used within OfflineDataProvider');
  }
  return context;
}

export { OfflineDataProvider, useOfflineData };
export type { OfflineDataContextValue };
```

### App Setup

```tsx
// app.tsx
import { OfflineDataProvider } from "./context/offline-data-provider";
import { initDatabase } from "./db/database";
import { createSyncQueue } from "./sync/sync-queue";

const database = await initDatabase();
const syncQueue = createSyncQueue(database);

function App() {
  return (
    <OfflineDataProvider database={database} syncQueue={syncQueue}>
      <AppContent />
    </OfflineDataProvider>
  );
}

function AppContent() {
  const { isInitialized, networkStatus, pendingCount } = useOfflineData();

  if (!isInitialized) {
    return <LoadingScreen />;
  }

  return (
    <main>
      <header>
        <SyncIndicator status={networkStatus} pendingCount={pendingCount} />
      </header>
      <TodoList />
    </main>
  );
}

export { App };
```

**Why good:** Centralizes offline data management, provides sync state to entire app, handles initialization gracefully, supports force sync for user-triggered sync

---

## Pattern 11: Reactive Local Queries

Subscribe to local database changes for real-time UI updates.

```typescript
// hooks/use-local-query.ts
import { useState, useEffect, useCallback } from "react";

interface QueryResult<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface QueryOptions<T> {
  queryFn: () => Promise<T[]>;
  // Subscribe to database changes
  subscribe?: (onUpdate: () => void) => () => void;
}

function useLocalQuery<T>(options: QueryOptions<T>): QueryResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await options.queryFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Query failed"));
    } finally {
      setIsLoading(false);
    }
  }, [options.queryFn]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to updates
  useEffect(() => {
    if (!options.subscribe) return;

    const unsubscribe = options.subscribe(() => {
      fetchData();
    });

    return unsubscribe;
  }, [options.subscribe, fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

export { useLocalQuery };
export type { QueryResult, QueryOptions };
```

### Usage with Dexie Live Query

```typescript
// hooks/use-todos.ts
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";

function useTodos(userId: string) {
  const todos = useLiveQuery(
    () =>
      db.todos
        .where("userId")
        .equals(userId)
        .and((todo) => !todo._deletedAt)
        .sortBy("_lastModified"),
    [userId],
  );

  return {
    data: todos ?? [],
    isLoading: todos === undefined,
  };
}

export { useTodos };
```

**Why good:** Automatically updates when database changes, supports any query function, handles loading and error states
