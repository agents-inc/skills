# Offline-First Core Examples

> Core code examples for offline-first applications. See [SKILL.md](../SKILL.md) for concepts.

**Extended patterns:** See [indexeddb.md](indexeddb.md) and [sync.md](sync.md) for database and synchronization patterns.

---

## Pattern 7: React Hook for Network Status

A hook for reactive network status in components.

### Implementation

```typescript
// hooks/use-network-status.ts
import { useSyncExternalStore, useCallback } from 'react';

type NetworkStatus = 'online' | 'offline' | 'slow';

interface NetworkStatusStore {
  getStatus(): NetworkStatus;
  subscribe(listener: () => void): () => void;
}

// Create a singleton store
function createNetworkStatusStore(): NetworkStatusStore {
  let status: NetworkStatus = navigator.onLine ? 'online' : 'offline';
  const listeners = new Set<() => void>();

  function updateStatus(newStatus: NetworkStatus): void {
    if (status !== newStatus) {
      status = newStatus;
      listeners.forEach(listener => listener());
    }
  }

  // Setup event listeners
  window.addEventListener('online', () => updateStatus('online'));
  window.addEventListener('offline', () => updateStatus('offline'));

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
  const getServerSnapshot = useCallback(() => 'online' as NetworkStatus, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export { useNetworkStatus };
export type { NetworkStatus };
```

### Usage

```tsx
// components/sync-indicator.tsx
import { useNetworkStatus } from '../hooks/use-network-status';

function SyncIndicator() {
  const status = useNetworkStatus();

  return (
    <div
      role="status"
      aria-live="polite"
      data-status={status}
    >
      {status === 'offline' && (
        <span>You are offline. Changes will sync when connected.</span>
      )}
      {status === 'slow' && (
        <span>Slow connection detected. Some features may be delayed.</span>
      )}
      {status === 'online' && (
        <span>Connected</span>
      )}
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
import { useState, useEffect } from 'react';

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
import { usePendingSyncCount } from '../hooks/use-pending-sync-count';
import { useSyncQueue } from '../context/sync-context';

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
import { useState, useCallback } from 'react';

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
  options: MutationOptions<TInput, TOutput>
) {
  const [state, setState] = useState<MutationState<TOutput>>({
    data: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null,
    isPending: false,
  });

  const mutate = useCallback(async (input: TInput) => {
    setState(prev => ({ ...prev, isLoading: true, isError: false, error: null }));

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
      const err = error instanceof Error ? error : new Error('Unknown error');

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
  }, [options]);

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
import { useState } from 'react';
import { useOfflineMutation } from '../hooks/use-offline-mutation';
import { useTodoRepository } from '../context/repository-context';
import { useSyncQueue } from '../context/sync-context';
import { createTodo } from '../models/todo';
import type { Todo } from '../models/todo';

function TodoForm() {
  const [title, setTitle] = useState('');
  const todoRepository = useTodoRepository();
  const syncQueue = useSyncQueue();

  const { mutate, isLoading, isPending, isError, error, reset } = useOfflineMutation<
    { title: string },
    Todo
  >({
    localMutation: async ({ title }) => {
      const todo = createTodo(title, 'current-user');
      await todoRepository.save(todo);
      return todo;
    },
    queueSync: async ({ title }) => {
      const todo = createTodo(title, 'current-user');
      await syncQueue.enqueue({
        type: 'CREATE',
        collection: 'todos',
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
      setTitle('');
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
        aria-describedby={isError ? 'error-message' : undefined}
      />

      <button type="submit" disabled={isLoading || !title.trim()}>
        {isLoading ? 'Saving...' : 'Add'}
      </button>

      {isPending && (
        <span role="status">Saved locally. Will sync when online.</span>
      )}

      {isError && (
        <span id="error-message" role="alert">
          {error?.message}
          <button type="button" onClick={reset}>Dismiss</button>
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
        // Database initialization happens in the database module
        setIsInitialized(true);

        // Get initial pending count
        const count = await syncQueue.getQueueLength();
        setPendingCount(count);

        // Process queue if online
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
      // Trigger sync when back online
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
import { OfflineDataProvider } from './context/offline-data-provider';
import { initDatabase } from './db/database';
import { createSyncQueue } from './sync/sync-queue';

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
import { useState, useEffect, useCallback } from 'react';

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
      setError(err instanceof Error ? err : new Error('Query failed'));
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
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';

function useTodos(userId: string) {
  const todos = useLiveQuery(
    () => db.todos
      .where('userId')
      .equals(userId)
      .and(todo => !todo._deletedAt)
      .sortBy('_lastModified'),
    [userId]
  );

  return {
    data: todos ?? [],
    isLoading: todos === undefined,
  };
}

export { useTodos };
```

**Why good:** Automatically updates when database changes, supports any query function, handles loading and error states
