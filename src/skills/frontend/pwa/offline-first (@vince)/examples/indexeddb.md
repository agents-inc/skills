# IndexedDB Patterns

> IndexedDB setup and usage patterns for offline-first applications. See [SKILL.md](../SKILL.md) for concepts.

---

## Pattern 12: Dexie.js Database Setup (v4.x)

Initialize IndexedDB with Dexie.js 4.x for type-safe database operations. Dexie 4.0+ includes improved TypeScript support with `Entity<T>` generics and class mappings.

### Database Schema Definition

```typescript
// db/database.ts
import Dexie, { type Table } from 'dexie';

// Sync metadata interface for all syncable tables
interface SyncMetadata {
  _syncStatus: 'synced' | 'pending' | 'conflicted';
  _lastModified: number;
  _localVersion: string;
  _serverVersion?: string;
  _deletedAt?: number;
}

// Entity interfaces
interface Todo extends SyncMetadata {
  id: string;
  title: string;
  completed: boolean;
  userId: string;
  createdAt: number;
}

interface User extends SyncMetadata {
  id: string;
  email: string;
  name: string;
  preferences: UserPreferences;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
}

// Sync queue operation
interface QueuedOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'UPSERT';
  collection: string;
  data: unknown;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

// Version constants
const CURRENT_DB_VERSION = 3;

class AppDatabase extends Dexie {
  // Declare tables with types
  todos!: Table<Todo, string>;
  users!: Table<User, string>;
  syncQueue!: Table<QueuedOperation, string>;

  constructor() {
    super('myapp-db');

    // Version 1: Initial schema
    this.version(1).stores({
      todos: 'id, userId, _syncStatus, _lastModified',
      users: 'id, email, _syncStatus',
      syncQueue: 'id, collection, timestamp',
    });

    // Version 2: Add compound indexes
    this.version(2).stores({
      todos: 'id, userId, _syncStatus, _lastModified, [userId+completed]',
      users: 'id, email, _syncStatus',
      syncQueue: 'id, collection, timestamp, retryCount',
    });

    // Version 3: Add deleted index for cleanup
    this.version(CURRENT_DB_VERSION).stores({
      todos: 'id, userId, _syncStatus, _lastModified, _deletedAt, [userId+completed]',
      users: 'id, email, _syncStatus, _deletedAt',
      syncQueue: 'id, collection, timestamp, retryCount',
    });
  }

  // Helper method to clear all sync-related data
  async clearSyncState(): Promise<void> {
    await this.transaction('rw', [this.todos, this.users], async () => {
      await this.todos.toCollection().modify({
        _syncStatus: 'pending',
        _serverVersion: undefined,
      });
      await this.users.toCollection().modify({
        _syncStatus: 'pending',
        _serverVersion: undefined,
      });
    });
  }

  // Cleanup soft-deleted items older than retention period
  async cleanupTombstones(retentionMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const threshold = Date.now() - retentionMs;
    let deletedCount = 0;

    await this.transaction('rw', [this.todos, this.users], async () => {
      // Only cleanup synced tombstones
      deletedCount += await this.todos
        .where('_deletedAt')
        .below(threshold)
        .and(item => item._syncStatus === 'synced')
        .delete();

      deletedCount += await this.users
        .where('_deletedAt')
        .below(threshold)
        .and(item => item._syncStatus === 'synced')
        .delete();
    });

    return deletedCount;
  }
}

// Singleton database instance
const db = new AppDatabase();

// Database initialization check
async function initDatabase(): Promise<AppDatabase> {
  try {
    await db.open();
    console.log('Database initialized, version:', db.verno);
    return db;
  } catch (error) {
    console.error('Failed to open database:', error);
    throw error;
  }
}

export { db, initDatabase, AppDatabase };
export type { Todo, User, UserPreferences, QueuedOperation, SyncMetadata };
```

**Why good:** Type-safe table declarations, versioned migrations, indexed sync metadata fields, compound indexes for complex queries, tombstone cleanup method

---

## Pattern 13: Dexie Hooks for CRUD Operations

Hooks that integrate Dexie with component state.

```typescript
// hooks/use-dexie-crud.ts
import { useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { Todo, SyncMetadata } from '../db/database';

// Sync status constants
const SYNC_STATUS = {
  SYNCED: 'synced',
  PENDING: 'pending',
  CONFLICTED: 'conflicted',
} as const;

// Generic CRUD hook factory
function createCrudHooks<T extends SyncMetadata & { id: string }>(
  tableName: 'todos' | 'users'
) {
  function useGetAll(filter?: (item: T) => boolean) {
    return useLiveQuery(async () => {
      let collection = db[tableName].toCollection();

      // Exclude soft-deleted
      const items = await collection.toArray();
      let filtered = items.filter(item => !item._deletedAt) as T[];

      if (filter) {
        filtered = filtered.filter(filter);
      }

      // Sort by last modified, newest first
      return filtered.sort((a, b) => b._lastModified - a._lastModified);
    }, [filter]);
  }

  function useGetById(id: string | undefined) {
    return useLiveQuery(async () => {
      if (!id) return null;
      const item = await db[tableName].get(id);
      if (item?._deletedAt) return null;
      return item as T | null;
    }, [id]);
  }

  return { useGetAll, useGetById };
}

// Create Todo-specific hooks
const todoHooks = createCrudHooks<Todo>('todos');

function useTodos(userId?: string) {
  return todoHooks.useGetAll(
    userId ? (todo) => todo.userId === userId : undefined
  );
}

function useTodo(id: string | undefined) {
  return todoHooks.useGetById(id);
}

// Mutation functions (not hooks, just async functions)
async function createTodo(
  title: string,
  userId: string
): Promise<Todo> {
  const todo: Todo = {
    id: crypto.randomUUID(),
    title,
    completed: false,
    userId,
    createdAt: Date.now(),
    _syncStatus: SYNC_STATUS.PENDING,
    _lastModified: Date.now(),
    _localVersion: crypto.randomUUID(),
  };

  await db.todos.add(todo);
  return todo;
}

async function updateTodo(
  id: string,
  updates: Partial<Pick<Todo, 'title' | 'completed'>>
): Promise<void> {
  await db.todos.update(id, {
    ...updates,
    _syncStatus: SYNC_STATUS.PENDING,
    _lastModified: Date.now(),
    _localVersion: crypto.randomUUID(),
  });
}

async function deleteTodo(id: string): Promise<void> {
  // Soft delete
  await db.todos.update(id, {
    _deletedAt: Date.now(),
    _syncStatus: SYNC_STATUS.PENDING,
    _lastModified: Date.now(),
    _localVersion: crypto.randomUUID(),
  });
}

// Batch operations
async function markTodosComplete(ids: string[]): Promise<void> {
  await db.transaction('rw', db.todos, async () => {
    for (const id of ids) {
      await updateTodo(id, { completed: true });
    }
  });
}

async function clearCompletedTodos(userId: string): Promise<void> {
  const completedTodos = await db.todos
    .where('[userId+completed]')
    .equals([userId, 1]) // 1 = true in IndexedDB
    .toArray();

  await db.transaction('rw', db.todos, async () => {
    for (const todo of completedTodos) {
      await deleteTodo(todo.id);
    }
  });
}

export {
  useTodos,
  useTodo,
  createTodo,
  updateTodo,
  deleteTodo,
  markTodosComplete,
  clearCompletedTodos,
};
```

**Why good:** useLiveQuery provides reactive updates, soft deletes maintain sync integrity, batch operations use transactions, type-safe throughout

---

## Pattern 14: idb Library Alternative (v8.x)

Using the lighter-weight idb library (~1.2KB brotli) instead of Dexie. Version 8.x is current as of 2024.

**CRITICAL:** Do not await non-IndexedDB operations (like `fetch()`) mid-transaction. Transactions auto-close when control returns to the event loop without pending requests.

```typescript
// db/idb-database.ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// Schema definition
interface AppDBSchema extends DBSchema {
  todos: {
    key: string;
    value: {
      id: string;
      title: string;
      completed: boolean;
      userId: string;
      createdAt: number;
      _syncStatus: 'synced' | 'pending' | 'conflicted';
      _lastModified: number;
      _localVersion: string;
      _serverVersion?: string;
      _deletedAt?: number;
    };
    indexes: {
      'by-user': string;
      'by-sync-status': string;
      'by-deleted': number;
    };
  };
  syncQueue: {
    key: string;
    value: {
      id: string;
      type: 'CREATE' | 'UPDATE' | 'DELETE';
      collection: string;
      data: unknown;
      timestamp: number;
      retryCount: number;
    };
    indexes: {
      'by-timestamp': number;
    };
  };
}

// Database version
const DB_VERSION = 1;
const DB_NAME = 'myapp-idb';

async function initIdbDatabase(): Promise<IDBPDatabase<AppDBSchema>> {
  return openDB<AppDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Version 1: Initial schema
      if (oldVersion < 1) {
        // Todos store
        const todosStore = db.createObjectStore('todos', { keyPath: 'id' });
        todosStore.createIndex('by-user', 'userId');
        todosStore.createIndex('by-sync-status', '_syncStatus');
        todosStore.createIndex('by-deleted', '_deletedAt');

        // Sync queue store
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncStore.createIndex('by-timestamp', 'timestamp');
      }

      // Future versions would add more conditions:
      // if (oldVersion < 2) { ... }
    },
    blocked() {
      console.warn('Database upgrade blocked by other tabs');
    },
    blocking() {
      // Close connection in other tabs
      console.warn('Blocking other tabs from upgrade');
    },
  });
}

// Repository wrapper for idb
class IdbTodoRepository {
  constructor(private db: IDBPDatabase<AppDBSchema>) {}

  async getAll(userId: string): Promise<AppDBSchema['todos']['value'][]> {
    const todos = await this.db.getAllFromIndex('todos', 'by-user', userId);
    return todos.filter(todo => !todo._deletedAt);
  }

  async get(id: string): Promise<AppDBSchema['todos']['value'] | null> {
    const todo = await this.db.get('todos', id);
    if (todo?._deletedAt) return null;
    return todo ?? null;
  }

  async save(todo: AppDBSchema['todos']['value']): Promise<void> {
    await this.db.put('todos', {
      ...todo,
      _syncStatus: 'pending',
      _lastModified: Date.now(),
      _localVersion: crypto.randomUUID(),
    });
  }

  async delete(id: string): Promise<void> {
    const existing = await this.db.get('todos', id);
    if (!existing) return;

    await this.db.put('todos', {
      ...existing,
      _deletedAt: Date.now(),
      _syncStatus: 'pending',
      _lastModified: Date.now(),
      _localVersion: crypto.randomUUID(),
    });
  }

  async getPending(): Promise<AppDBSchema['todos']['value'][]> {
    return this.db.getAllFromIndex('todos', 'by-sync-status', 'pending');
  }

  async markSynced(id: string, serverVersion: string): Promise<void> {
    const todo = await this.db.get('todos', id);
    if (!todo) return;

    await this.db.put('todos', {
      ...todo,
      _syncStatus: 'synced',
      _serverVersion: serverVersion,
    });
  }
}

export { initIdbDatabase, IdbTodoRepository };
export type { AppDBSchema };
```

**Why good:** Lighter weight than Dexie (~1.2KB vs ~22KB), strongly typed with DBSchema, proper index usage, migration support via upgrade function, promises instead of event listeners

**Version Notes:**
- idb 8.x: Current version (2024), CDN available at `https://cdn.jsdelivr.net/npm/idb@8/+esm`
- For simple key-value storage: Use `idb-keyval` (~295 bytes) instead

---

## Pattern 15: Database Migration with Data Transform

Handle complex schema migrations that require data transformation.

```typescript
// db/migrations.ts
import Dexie from 'dexie';
import { db } from './database';

// Migration version constants
const MIGRATION_VERSIONS = {
  INITIAL: 1,
  ADD_SYNC_METADATA: 2,
  NORMALIZE_TIMESTAMPS: 3,
} as const;

// Configure migrations with data transforms
db.version(MIGRATION_VERSIONS.INITIAL).stores({
  todos: 'id, userId',
});

db.version(MIGRATION_VERSIONS.ADD_SYNC_METADATA)
  .stores({
    todos: 'id, userId, _syncStatus, _lastModified',
  })
  .upgrade(async (tx) => {
    // Add sync metadata to existing todos
    const todos = tx.table('todos');
    await todos.toCollection().modify((todo) => {
      if (!todo._syncStatus) {
        todo._syncStatus = 'synced'; // Existing data is assumed synced
        todo._lastModified = Date.now();
        todo._localVersion = crypto.randomUUID();
      }
    });
  });

db.version(MIGRATION_VERSIONS.NORMALIZE_TIMESTAMPS)
  .stores({
    todos: 'id, userId, _syncStatus, _lastModified, createdAt',
  })
  .upgrade(async (tx) => {
    // Normalize timestamps from ISO strings to numbers
    const todos = tx.table('todos');
    await todos.toCollection().modify((todo) => {
      if (typeof todo.createdAt === 'string') {
        todo.createdAt = new Date(todo.createdAt).getTime();
      }
      if (typeof todo._lastModified === 'string') {
        todo._lastModified = new Date(todo._lastModified).getTime();
      }
    });
  });

// Export migration status check
async function checkMigrationStatus(): Promise<{
  currentVersion: number;
  latestVersion: number;
  needsMigration: boolean;
}> {
  const currentVersion = db.verno;
  const latestVersion = MIGRATION_VERSIONS.NORMALIZE_TIMESTAMPS;

  return {
    currentVersion,
    latestVersion,
    needsMigration: currentVersion < latestVersion,
  };
}

export { checkMigrationStatus, MIGRATION_VERSIONS };
```

**Why good:** Named version constants for clarity, upgrade functions transform existing data, migrations are idempotent (check before modify), status check for debugging

---

## Pattern 16: Multi-Tab Coordination

Handle multiple browser tabs accessing the same IndexedDB.

```typescript
// db/tab-coordinator.ts

// Named constants
const LOCK_TIMEOUT_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 5000;
const STALE_LOCK_THRESHOLD_MS = 10000;

interface TabLock {
  tabId: string;
  timestamp: number;
  operation: string;
}

class TabCoordinator {
  private readonly tabId = crypto.randomUUID();
  private readonly channel: BroadcastChannel;
  private activeLocks = new Map<string, TabLock>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.channel = new BroadcastChannel('app-tab-coordinator');
    this.setupListeners();
    this.startHeartbeat();
  }

  private setupListeners(): void {
    this.channel.onmessage = (event) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'LOCK_ACQUIRED':
          this.activeLocks.set(payload.operation, payload);
          break;

        case 'LOCK_RELEASED':
          this.activeLocks.delete(payload.operation);
          break;

        case 'HEARTBEAT':
          // Update timestamp for existing locks from this tab
          if (this.activeLocks.get(payload.operation)?.tabId === payload.tabId) {
            this.activeLocks.set(payload.operation, payload);
          }
          break;

        case 'DB_CHANGED':
          // Another tab made changes - emit event for UI refresh
          window.dispatchEvent(
            new CustomEvent('database-changed', { detail: payload })
          );
          break;
      }
    };
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      // Send heartbeat for any locks this tab holds
      for (const [operation, lock] of this.activeLocks) {
        if (lock.tabId === this.tabId) {
          this.channel.postMessage({
            type: 'HEARTBEAT',
            payload: { ...lock, timestamp: Date.now() },
          });
        }
      }

      // Clean up stale locks
      this.cleanupStaleLocks();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private cleanupStaleLocks(): void {
    const now = Date.now();

    for (const [operation, lock] of this.activeLocks) {
      if (now - lock.timestamp > STALE_LOCK_THRESHOLD_MS) {
        this.activeLocks.delete(operation);
      }
    }
  }

  async acquireLock(operation: string): Promise<boolean> {
    const existingLock = this.activeLocks.get(operation);

    // Check if lock exists and is not stale
    if (
      existingLock &&
      Date.now() - existingLock.timestamp < STALE_LOCK_THRESHOLD_MS
    ) {
      return false; // Lock held by another tab
    }

    const lock: TabLock = {
      tabId: this.tabId,
      timestamp: Date.now(),
      operation,
    };

    this.activeLocks.set(operation, lock);
    this.channel.postMessage({ type: 'LOCK_ACQUIRED', payload: lock });

    return true;
  }

  releaseLock(operation: string): void {
    const lock = this.activeLocks.get(operation);

    if (lock?.tabId === this.tabId) {
      this.activeLocks.delete(operation);
      this.channel.postMessage({
        type: 'LOCK_RELEASED',
        payload: { operation },
      });
    }
  }

  notifyDatabaseChange(collection: string, id: string): void {
    this.channel.postMessage({
      type: 'DB_CHANGED',
      payload: { collection, id, tabId: this.tabId },
    });
  }

  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Release all locks held by this tab
    for (const [operation, lock] of this.activeLocks) {
      if (lock.tabId === this.tabId) {
        this.releaseLock(operation);
      }
    }

    this.channel.close();
  }
}

// Singleton instance
const tabCoordinator = new TabCoordinator();

export { tabCoordinator, TabCoordinator };
export type { TabLock };
```

**Why good:** BroadcastChannel for inter-tab communication, heartbeat keeps locks fresh, stale lock cleanup prevents deadlocks, notifies other tabs of changes

---

## Pattern 17: IndexedDB Storage Quota Management

Monitor and manage storage usage to prevent quota exceeded errors.

```typescript
// db/storage-manager.ts

// Constants
const STORAGE_WARNING_THRESHOLD = 0.8; // 80%
const STORAGE_CRITICAL_THRESHOLD = 0.95; // 95%
const MIN_FREE_SPACE_MB = 50;

interface StorageInfo {
  usedBytes: number;
  totalBytes: number;
  percentUsed: number;
  status: 'ok' | 'warning' | 'critical';
}

async function getStorageInfo(): Promise<StorageInfo> {
  if (!navigator.storage?.estimate) {
    // Fallback for browsers without StorageManager
    return {
      usedBytes: 0,
      totalBytes: 0,
      percentUsed: 0,
      status: 'ok',
    };
  }

  const estimate = await navigator.storage.estimate();
  const used = estimate.usage ?? 0;
  const total = estimate.quota ?? 0;
  const percentUsed = total > 0 ? used / total : 0;

  let status: StorageInfo['status'] = 'ok';
  if (percentUsed >= STORAGE_CRITICAL_THRESHOLD) {
    status = 'critical';
  } else if (percentUsed >= STORAGE_WARNING_THRESHOLD) {
    status = 'warning';
  }

  return {
    usedBytes: used,
    totalBytes: total,
    percentUsed,
    status,
  };
}

async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    return false;
  }

  // Check if already persisted
  const isPersisted = await navigator.storage.persisted();
  if (isPersisted) {
    return true;
  }

  // Request persistence
  return navigator.storage.persist();
}

// Cleanup strategies when storage is low
interface CleanupResult {
  freedBytes: number;
  itemsRemoved: number;
}

async function performStorageCleanup(
  db: LocalDatabase
): Promise<CleanupResult> {
  let freedBytes = 0;
  let itemsRemoved = 0;

  // Strategy 1: Remove synced tombstones older than 7 days
  const TOMBSTONE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  const tombstoneThreshold = Date.now() - TOMBSTONE_AGE_MS;

  const tombstones = await db.todos
    .where('_deletedAt')
    .below(tombstoneThreshold)
    .and(item => item._syncStatus === 'synced')
    .toArray();

  for (const item of tombstones) {
    await db.todos.delete(item.id);
    itemsRemoved++;
    freedBytes += estimateObjectSize(item);
  }

  // Strategy 2: Clear old cache entries (if using cache table)
  // Add more cleanup strategies as needed

  return { freedBytes, itemsRemoved };
}

// Rough estimate of object size in bytes
function estimateObjectSize(obj: unknown): number {
  return new Blob([JSON.stringify(obj)]).size;
}

// Hook for React components
function useStorageInfo() {
  const [info, setInfo] = useState<StorageInfo | null>(null);

  useEffect(() => {
    getStorageInfo().then(setInfo);

    // Refresh periodically
    const interval = setInterval(() => {
      getStorageInfo().then(setInfo);
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, []);

  return info;
}

export {
  getStorageInfo,
  requestPersistentStorage,
  performStorageCleanup,
  useStorageInfo,
};
export type { StorageInfo, CleanupResult };
```

**Why good:** Proactive monitoring prevents quota errors, persistent storage prevents data eviction, cleanup strategies free space intelligently, size estimation for tracking
