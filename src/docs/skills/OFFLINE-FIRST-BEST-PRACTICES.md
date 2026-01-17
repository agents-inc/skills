# Offline-First Application Best Practices

> Research document for creating atomic offline-first skills
> Last updated: 2026-01-17

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [IndexedDB Patterns](#2-indexeddb-patterns)
3. [Sync and Conflict Resolution](#3-sync-and-conflict-resolution)
4. [Optimistic UI with Offline Support](#4-optimistic-ui-with-offline-support)
5. [Network Status Detection](#5-network-status-detection)
6. [Background Sync API](#6-background-sync-api)
7. [Service Worker Caching Strategies](#7-service-worker-caching-strategies)
8. [Integration with Data Fetching Libraries](#8-integration-with-data-fetching-libraries)
9. [CRDT Libraries](#9-crdt-libraries)
10. [PouchDB/CouchDB Sync Patterns](#10-pouchdbcouchdb-sync-patterns)
11. [Testing Offline Scenarios](#11-testing-offline-scenarios)
12. [Anti-Patterns to Avoid](#12-anti-patterns-to-avoid)

---

## 1. Core Principles

Offline-first is a design philosophy where applications are built to work primarily with local data, treating network connectivity as an enhancement rather than a requirement.

### Key Principles

#### Local-First Data Storage

```typescript
// The local database is the single source of truth
// All reads/writes go through local storage first

interface OfflineFirstArchitecture {
  // Data layer hierarchy
  localDatabase: IndexedDB | SQLite;      // Primary source of truth
  syncQueue: PendingOperation[];           // Queued changes for sync
  networkLayer: APIClient;                 // Background sync when online
}

// Example: Reading data always from local
async function getUser(userId: string): Promise<User | null> {
  // Always read from local database first
  const localUser = await localDb.users.get(userId);

  // Optionally trigger background sync if online
  if (navigator.onLine) {
    syncService.queueRefresh('users', userId);
  }

  return localUser;
}
```

#### Single Source of Truth (SSOT)

```typescript
// repository-pattern.ts
// Repository acts as the single access point for all data operations

interface DataRepository<T> {
  // All reads come from local storage
  get(id: string): Promise<T | null>;
  getAll(): Promise<T[]>;
  query(filter: QueryFilter<T>): Promise<T[]>;

  // All writes go to local storage first, then sync
  save(item: T): Promise<void>;
  delete(id: string): Promise<void>;

  // Sync status
  getSyncStatus(id: string): Promise<SyncStatus>;
}

type SyncStatus = 'synced' | 'pending' | 'conflicted' | 'error';

// Implementation
class UserRepository implements DataRepository<User> {
  constructor(
    private localDb: LocalDatabase,
    private syncQueue: SyncQueue
  ) {}

  async save(user: User): Promise<void> {
    // 1. Save to local database immediately
    await this.localDb.users.put({
      ...user,
      _syncStatus: 'pending',
      _lastModified: Date.now(),
      _localVersion: crypto.randomUUID(),
    });

    // 2. Queue for background sync
    this.syncQueue.enqueue({
      type: 'UPSERT',
      collection: 'users',
      data: user,
      timestamp: Date.now(),
    });
  }
}
```

#### Synchronization Metadata

```typescript
// sync-metadata.ts
// Every record needs metadata for sync tracking

interface SyncableEntity {
  id: string;

  // Sync tracking fields
  _syncStatus: 'synced' | 'pending' | 'conflicted';
  _lastModified: number;        // Client timestamp
  _serverTimestamp?: number;    // Server timestamp for conflict resolution
  _localVersion: string;        // Local revision ID
  _serverVersion?: string;      // Server revision ID
  _deletedAt?: number;          // Soft delete timestamp (tombstone)
}

// Example entity with sync metadata
interface Todo extends SyncableEntity {
  title: string;
  completed: boolean;
  userId: string;
}

// Creating a new todo with sync metadata
function createTodo(title: string, userId: string): Todo {
  return {
    id: crypto.randomUUID(),
    title,
    completed: false,
    userId,
    _syncStatus: 'pending',
    _lastModified: Date.now(),
    _localVersion: crypto.randomUUID(),
  };
}
```

### When to Use Offline-First

| Use Case | Recommended Approach |
|----------|---------------------|
| Field service apps (poor connectivity) | Full offline-first with CRDT sync |
| Note-taking / productivity apps | Local-first with background sync |
| E-commerce catalog browsing | Cache-first with network refresh |
| Real-time dashboards | Network-first with cache fallback |
| Financial transactions | Network-required with offline queue |
| Collaborative editing | CRDT-based local-first |

### Architecture Decision Tree

```
Is the app usable without fresh server data?
├── YES → Can users make meaningful changes offline?
│   ├── YES → Full Offline-First Architecture
│   │   └── Do multiple users edit the same data?
│   │       ├── YES → Use CRDTs (Yjs, Automerge)
│   │       └── NO → Use simple last-write-wins sync
│   └── NO → Read-Only Offline (Cache-First)
└── NO → Network-First with graceful degradation
```

---

## 2. IndexedDB Patterns

IndexedDB provides robust client-side storage for offline applications. Use wrapper libraries like Dexie.js or idb for better developer experience.

### Using Dexie.js

```typescript
// db.ts - Database setup with Dexie.js
import Dexie, { type Table } from 'dexie';

interface User {
  id: string;
  name: string;
  email: string;
  _syncStatus: 'synced' | 'pending' | 'conflicted';
  _lastModified: number;
}

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  userId: string;
  _syncStatus: 'synced' | 'pending' | 'conflicted';
  _lastModified: number;
}

class AppDatabase extends Dexie {
  users!: Table<User, string>;
  todos!: Table<Todo, string>;

  constructor() {
    super('AppDatabase');

    this.version(1).stores({
      // Primary key and indexed fields
      users: 'id, email, _syncStatus',
      todos: 'id, userId, completed, _syncStatus, _lastModified',
    });
  }
}

export const db = new AppDatabase();
```

#### CRUD Operations with Dexie

```typescript
// user-repository.ts
import { db } from './db';

// Create
async function createUser(user: Omit<User, 'id' | '_syncStatus' | '_lastModified'>): Promise<User> {
  const newUser: User = {
    ...user,
    id: crypto.randomUUID(),
    _syncStatus: 'pending',
    _lastModified: Date.now(),
  };

  await db.users.add(newUser);
  return newUser;
}

// Read
async function getUser(id: string): Promise<User | undefined> {
  return db.users.get(id);
}

async function getUsersByStatus(status: User['_syncStatus']): Promise<User[]> {
  return db.users.where('_syncStatus').equals(status).toArray();
}

// Update
async function updateUser(id: string, changes: Partial<User>): Promise<void> {
  await db.users.update(id, {
    ...changes,
    _syncStatus: 'pending',
    _lastModified: Date.now(),
  });
}

// Delete (soft delete for sync)
async function deleteUser(id: string): Promise<void> {
  await db.users.update(id, {
    _syncStatus: 'pending',
    _lastModified: Date.now(),
    _deletedAt: Date.now(),
  });
}

// Bulk operations
async function bulkUpsertUsers(users: User[]): Promise<void> {
  await db.users.bulkPut(users);
}
```

#### Reactive Queries with Dexie

```typescript
// use-live-query.ts - React hook for reactive IndexedDB queries
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

// Reactive query that auto-updates when data changes
function useTodos(userId: string) {
  const todos = useLiveQuery(
    () => db.todos
      .where('userId')
      .equals(userId)
      .and(todo => !todo._deletedAt)
      .sortBy('_lastModified'),
    [userId]
  );

  return todos ?? [];
}

// Reactive count
function usePendingSyncCount() {
  return useLiveQuery(
    () => db.todos.where('_syncStatus').equals('pending').count()
  ) ?? 0;
}

// Complex reactive query
function useFilteredTodos(userId: string, showCompleted: boolean) {
  return useLiveQuery(
    async () => {
      let collection = db.todos.where('userId').equals(userId);

      if (!showCompleted) {
        collection = collection.and(todo => !todo.completed);
      }

      return collection.toArray();
    },
    [userId, showCompleted]
  ) ?? [];
}
```

### Using idb Library

```typescript
// db-idb.ts - Database setup with idb library
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface AppDBSchema extends DBSchema {
  users: {
    key: string;
    value: {
      id: string;
      name: string;
      email: string;
      _syncStatus: 'synced' | 'pending' | 'conflicted';
      _lastModified: number;
    };
    indexes: {
      'by-email': string;
      'by-sync-status': string;
    };
  };
  todos: {
    key: string;
    value: {
      id: string;
      title: string;
      completed: boolean;
      userId: string;
      _syncStatus: 'synced' | 'pending' | 'conflicted';
      _lastModified: number;
    };
    indexes: {
      'by-user': string;
      'by-sync-status': string;
    };
  };
  syncQueue: {
    key: number;
    value: {
      id?: number;
      operation: 'create' | 'update' | 'delete';
      collection: string;
      data: unknown;
      timestamp: number;
      retryCount: number;
    };
  };
}

let dbInstance: IDBPDatabase<AppDBSchema> | null = null;

export async function getDb(): Promise<IDBPDatabase<AppDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<AppDBSchema>('app-database', 1, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Version 1: Initial schema
      if (oldVersion < 1) {
        // Users store
        const userStore = db.createObjectStore('users', { keyPath: 'id' });
        userStore.createIndex('by-email', 'email', { unique: true });
        userStore.createIndex('by-sync-status', '_syncStatus');

        // Todos store
        const todoStore = db.createObjectStore('todos', { keyPath: 'id' });
        todoStore.createIndex('by-user', 'userId');
        todoStore.createIndex('by-sync-status', '_syncStatus');

        // Sync queue store
        db.createObjectStore('syncQueue', {
          keyPath: 'id',
          autoIncrement: true
        });
      }
    },
    blocked() {
      console.warn('Database blocked by older version in another tab');
    },
    blocking() {
      // Close db to allow upgrade in other tab
      dbInstance?.close();
      dbInstance = null;
    },
  });

  return dbInstance;
}
```

#### CRUD Operations with idb

```typescript
// operations-idb.ts
import { getDb } from './db-idb';

// Create with transaction
async function createTodo(todo: Omit<AppDBSchema['todos']['value'], 'id'>): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();

  const tx = db.transaction(['todos', 'syncQueue'], 'readwrite');

  await Promise.all([
    tx.objectStore('todos').add({ ...todo, id }),
    tx.objectStore('syncQueue').add({
      operation: 'create',
      collection: 'todos',
      data: { ...todo, id },
      timestamp: Date.now(),
      retryCount: 0,
    }),
    tx.done,
  ]);

  return id;
}

// Read with cursor for large datasets
async function getAllTodosByUser(userId: string): Promise<AppDBSchema['todos']['value'][]> {
  const db = await getDb();
  const todos: AppDBSchema['todos']['value'][] = [];

  const tx = db.transaction('todos', 'readonly');
  const index = tx.store.index('by-user');

  for await (const cursor of index.iterate(userId)) {
    todos.push(cursor.value);
  }

  return todos;
}

// Update
async function updateTodo(
  id: string,
  changes: Partial<AppDBSchema['todos']['value']>
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['todos', 'syncQueue'], 'readwrite');

  const existing = await tx.objectStore('todos').get(id);
  if (!existing) throw new Error(`Todo ${id} not found`);

  const updated = {
    ...existing,
    ...changes,
    _syncStatus: 'pending' as const,
    _lastModified: Date.now(),
  };

  await Promise.all([
    tx.objectStore('todos').put(updated),
    tx.objectStore('syncQueue').add({
      operation: 'update',
      collection: 'todos',
      data: updated,
      timestamp: Date.now(),
      retryCount: 0,
    }),
    tx.done,
  ]);
}
```

### Schema Migration Patterns

```typescript
// migrations.ts - Handling database version upgrades
import { openDB } from 'idb';

const DB_NAME = 'app-database';
const CURRENT_VERSION = 3;

export async function initDatabase() {
  return openDB(DB_NAME, CURRENT_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Migration from version 0 (new database)
      if (oldVersion < 1) {
        const userStore = db.createObjectStore('users', { keyPath: 'id' });
        userStore.createIndex('by-email', 'email');
      }

      // Migration from version 1 to 2: Add sync status
      if (oldVersion < 2) {
        const userStore = transaction.objectStore('users');
        userStore.createIndex('by-sync-status', '_syncStatus');

        // Migrate existing data
        userStore.openCursor().then(async function migrateCursor(cursor) {
          if (!cursor) return;

          const user = cursor.value;
          if (!user._syncStatus) {
            await cursor.update({
              ...user,
              _syncStatus: 'synced',
              _lastModified: Date.now(),
            });
          }

          return cursor.continue().then(migrateCursor);
        });
      }

      // Migration from version 2 to 3: Add todos store
      if (oldVersion < 3) {
        const todoStore = db.createObjectStore('todos', { keyPath: 'id' });
        todoStore.createIndex('by-user', 'userId');
        todoStore.createIndex('by-sync-status', '_syncStatus');
      }
    },
  });
}
```

---

## 3. Sync and Conflict Resolution

Conflict resolution is essential when multiple clients can modify the same data independently while offline.

### Last-Write-Wins (LWW)

```typescript
// lww-sync.ts - Simple last-write-wins strategy
interface LWWRecord {
  id: string;
  data: unknown;
  timestamp: number;  // Used for conflict resolution
  version: string;    // Server version for optimistic locking
}

async function syncWithLWW(
  localRecord: LWWRecord,
  serverRecord: LWWRecord | null
): Promise<{ action: 'push' | 'pull' | 'conflict'; result: LWWRecord }> {
  // No server record - push local
  if (!serverRecord) {
    return { action: 'push', result: localRecord };
  }

  // Local is newer - push
  if (localRecord.timestamp > serverRecord.timestamp) {
    return { action: 'push', result: localRecord };
  }

  // Server is newer - pull
  if (serverRecord.timestamp > localRecord.timestamp) {
    return { action: 'pull', result: serverRecord };
  }

  // Same timestamp - use version as tiebreaker
  if (localRecord.version > serverRecord.version) {
    return { action: 'push', result: localRecord };
  }

  return { action: 'pull', result: serverRecord };
}

// Sync service implementation
class SyncService {
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 1000;

  async syncCollection<T extends LWWRecord>(
    collection: string,
    localRecords: T[]
  ): Promise<SyncResult<T>> {
    const results: SyncResult<T> = {
      pushed: [],
      pulled: [],
      conflicts: [],
      errors: [],
    };

    for (const localRecord of localRecords) {
      try {
        const serverRecord = await this.fetchServerRecord<T>(collection, localRecord.id);
        const { action, result } = await syncWithLWW(localRecord, serverRecord);

        switch (action) {
          case 'push':
            await this.pushToServer(collection, result);
            results.pushed.push(result as T);
            break;
          case 'pull':
            await this.saveToLocal(collection, result);
            results.pulled.push(result as T);
            break;
          case 'conflict':
            results.conflicts.push({ local: localRecord, server: serverRecord! });
            break;
        }
      } catch (error) {
        results.errors.push({ record: localRecord, error });
      }
    }

    return results;
  }
}
```

### Field-Level Merge

```typescript
// field-merge-sync.ts - Merge non-conflicting field changes
interface MergeableRecord {
  id: string;
  fields: Record<string, { value: unknown; modifiedAt: number }>;
  _baseVersion: string;  // Version this record was based on
}

function mergeRecords(
  local: MergeableRecord,
  server: MergeableRecord,
  base: MergeableRecord | null
): { merged: MergeableRecord; conflicts: string[] } {
  const conflicts: string[] = [];
  const mergedFields: MergeableRecord['fields'] = {};

  const allFields = new Set([
    ...Object.keys(local.fields),
    ...Object.keys(server.fields),
  ]);

  for (const field of allFields) {
    const localField = local.fields[field];
    const serverField = server.fields[field];
    const baseField = base?.fields[field];

    // Only local changed
    if (localField?.modifiedAt !== baseField?.modifiedAt &&
        serverField?.modifiedAt === baseField?.modifiedAt) {
      mergedFields[field] = localField;
      continue;
    }

    // Only server changed
    if (serverField?.modifiedAt !== baseField?.modifiedAt &&
        localField?.modifiedAt === baseField?.modifiedAt) {
      mergedFields[field] = serverField;
      continue;
    }

    // Both changed - check if same value
    if (JSON.stringify(localField?.value) === JSON.stringify(serverField?.value)) {
      mergedFields[field] = localField;
      continue;
    }

    // True conflict - use LWW for this field
    if ((localField?.modifiedAt ?? 0) >= (serverField?.modifiedAt ?? 0)) {
      mergedFields[field] = localField;
    } else {
      mergedFields[field] = serverField;
    }
    conflicts.push(field);
  }

  return {
    merged: {
      id: local.id,
      fields: mergedFields,
      _baseVersion: server._baseVersion, // Use server's version as new base
    },
    conflicts,
  };
}
```

### Version Vector for Causality

```typescript
// version-vector.ts - Track causality across distributed clients
type ClientId = string;
type VersionVector = Map<ClientId, number>;

function createVersionVector(): VersionVector {
  return new Map();
}

function incrementVersion(vv: VersionVector, clientId: ClientId): VersionVector {
  const newVV = new Map(vv);
  newVV.set(clientId, (newVV.get(clientId) ?? 0) + 1);
  return newVV;
}

function compareVersionVectors(a: VersionVector, b: VersionVector): 'before' | 'after' | 'concurrent' {
  let aBeforeB = false;
  let bBeforeA = false;

  const allClients = new Set([...a.keys(), ...b.keys()]);

  for (const client of allClients) {
    const aVersion = a.get(client) ?? 0;
    const bVersion = b.get(client) ?? 0;

    if (aVersion < bVersion) aBeforeB = true;
    if (bVersion < aVersion) bBeforeA = true;
  }

  if (aBeforeB && !bBeforeA) return 'before';
  if (bBeforeA && !aBeforeB) return 'after';
  return 'concurrent';
}

function mergeVersionVectors(a: VersionVector, b: VersionVector): VersionVector {
  const merged = new Map(a);

  for (const [client, version] of b) {
    merged.set(client, Math.max(merged.get(client) ?? 0, version));
  }

  return merged;
}

// Usage in sync
interface VersionedRecord {
  id: string;
  data: unknown;
  versionVector: Record<string, number>; // Serializable version vector
}

function resolveConflict(local: VersionedRecord, server: VersionedRecord): VersionedRecord {
  const localVV = new Map(Object.entries(local.versionVector));
  const serverVV = new Map(Object.entries(server.versionVector));

  const comparison = compareVersionVectors(localVV, serverVV);

  switch (comparison) {
    case 'before':
      return server; // Server is causally after local
    case 'after':
      return local; // Local is causally after server
    case 'concurrent':
      // True conflict - need application-specific resolution
      // Default: use deterministic tiebreaker (e.g., lexicographic ID comparison)
      return local.id < server.id ? local : server;
  }
}
```

### Sync Queue Management

```typescript
// sync-queue.ts - Reliable offline operation queue
interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  collection: string;
  data: unknown;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

class SyncQueue {
  private readonly db: IDBPDatabase;
  private readonly STORE_NAME = 'syncQueue';
  private processing = false;

  async enqueue(operation: Omit<QueuedOperation, 'id' | 'retryCount'>): Promise<void> {
    await this.db.add(this.STORE_NAME, {
      ...operation,
      id: crypto.randomUUID(),
      retryCount: 0,
    });

    // Trigger processing if online
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

    switch (op.type) {
      case 'create':
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(op.data),
        });
        break;
      case 'update':
        await fetch(`${endpoint}/${(op.data as { id: string }).id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(op.data),
        });
        break;
      case 'delete':
        await fetch(`${endpoint}/${(op.data as { id: string }).id}`, {
          method: 'DELETE',
        });
        break;
    }
  }

  private async handleOperationError(op: QueuedOperation, error: unknown): Promise<void> {
    const MAX_RETRIES = 5;

    if (op.retryCount >= MAX_RETRIES) {
      // Move to dead letter queue or notify user
      console.error(`Operation ${op.id} failed after ${MAX_RETRIES} retries`, error);
      await this.db.delete(this.STORE_NAME, op.id);
      return;
    }

    // Increment retry count
    await this.db.put(this.STORE_NAME, {
      ...op,
      retryCount: op.retryCount + 1,
      lastError: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

---

## 4. Optimistic UI with Offline Support

Optimistic UI updates the interface immediately, assuming success, and rolls back if the operation fails.

### React useOptimistic Hook

```typescript
// use-optimistic-todo.ts - React 19 useOptimistic pattern
import { useOptimistic, useTransition } from 'react';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

type OptimisticTodo = Todo & { pending?: boolean };

function useTodoActions(initialTodos: Todo[]) {
  const [isPending, startTransition] = useTransition();

  const [optimisticTodos, addOptimisticTodo] = useOptimistic<
    OptimisticTodo[],
    { action: 'add' | 'update' | 'delete'; todo: Partial<Todo> & { id: string } }
  >(
    initialTodos,
    (state, { action, todo }) => {
      switch (action) {
        case 'add':
          return [...state, { ...todo, pending: true } as OptimisticTodo];
        case 'update':
          return state.map(t =>
            t.id === todo.id ? { ...t, ...todo, pending: true } : t
          );
        case 'delete':
          return state.filter(t => t.id !== todo.id);
        default:
          return state;
      }
    }
  );

  const addTodo = async (title: string) => {
    const newTodo: Todo = {
      id: crypto.randomUUID(),
      title,
      completed: false,
    };

    startTransition(async () => {
      // Optimistic update
      addOptimisticTodo({ action: 'add', todo: newTodo });

      try {
        // Save to local DB (always succeeds)
        await localDb.todos.add(newTodo);

        // Queue for sync (will happen when online)
        await syncQueue.enqueue({
          type: 'create',
          collection: 'todos',
          data: newTodo,
          timestamp: Date.now(),
        });
      } catch (error) {
        // Handle error - could show toast notification
        console.error('Failed to add todo:', error);
        throw error; // This will trigger rollback
      }
    });
  };

  return { todos: optimisticTodos, isPending, addTodo };
}
```

### TanStack Query Optimistic Updates

```typescript
// use-todo-mutation.ts - TanStack Query with optimistic updates
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from './db';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

function useUpdateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (todo: Todo) => {
      // Always save to local DB first
      await db.todos.put({
        ...todo,
        _syncStatus: 'pending',
        _lastModified: Date.now(),
      });

      // Queue for background sync
      await syncQueue.enqueue({
        type: 'update',
        collection: 'todos',
        data: todo,
        timestamp: Date.now(),
      });

      return todo;
    },

    onMutate: async (newTodo) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['todos'] });

      // Snapshot previous value
      const previousTodos = queryClient.getQueryData<Todo[]>(['todos']);

      // Optimistically update
      queryClient.setQueryData<Todo[]>(['todos'], (old) =>
        old?.map((todo) => (todo.id === newTodo.id ? newTodo : todo))
      );

      return { previousTodos };
    },

    onError: (err, newTodo, context) => {
      // Rollback on error
      if (context?.previousTodos) {
        queryClient.setQueryData(['todos'], context.previousTodos);
      }
    },

    onSettled: () => {
      // Refetch to ensure consistency (only if online)
      if (navigator.onLine) {
        queryClient.invalidateQueries({ queryKey: ['todos'] });
      }
    },
  });
}
```

### Rollback Pattern

```typescript
// rollback-manager.ts - Managing rollbacks for failed operations
interface PendingChange<T> {
  id: string;
  previousValue: T | null;
  newValue: T;
  timestamp: number;
}

class RollbackManager<T extends { id: string }> {
  private pendingChanges = new Map<string, PendingChange<T>>();

  async applyOptimistically(
    id: string,
    newValue: T,
    localDb: Table<T>,
    onUpdate: (items: T[]) => void
  ): Promise<() => Promise<void>> {
    // Get current value for rollback
    const previousValue = await localDb.get(id);

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
    const allItems = await localDb.toArray();
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

      const updatedItems = await localDb.toArray();
      onUpdate(updatedItems);
    };
  }

  async confirmChange(id: string): Promise<void> {
    this.pendingChanges.delete(id);
  }
}
```

---

## 5. Network Status Detection

Reliable network status detection is crucial for offline-first apps.

### Basic Detection

```typescript
// network-status.ts - Network status detection with events
type NetworkStatus = 'online' | 'offline' | 'slow';
type NetworkListener = (status: NetworkStatus) => void;

class NetworkStatusManager {
  private status: NetworkStatus = navigator.onLine ? 'online' : 'offline';
  private listeners = new Set<NetworkListener>();

  constructor() {
    window.addEventListener('online', () => this.updateStatus('online'));
    window.addEventListener('offline', () => this.updateStatus('offline'));

    // Check connection quality periodically when online
    if (navigator.onLine) {
      this.checkConnectionQuality();
    }
  }

  private updateStatus(newStatus: NetworkStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.listeners.forEach(listener => listener(newStatus));
    }
  }

  getStatus(): NetworkStatus {
    return this.status;
  }

  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // More reliable check using fetch
  async checkConnectionQuality(): Promise<NetworkStatus> {
    if (!navigator.onLine) {
      this.updateStatus('offline');
      return 'offline';
    }

    try {
      const start = performance.now();

      // Use a small endpoint that returns quickly
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-store',
      });

      const latency = performance.now() - start;

      if (!response.ok) {
        this.updateStatus('offline');
        return 'offline';
      }

      // Consider connection "slow" if latency > 2 seconds
      const SLOW_THRESHOLD_MS = 2000;
      const status = latency > SLOW_THRESHOLD_MS ? 'slow' : 'online';
      this.updateStatus(status);
      return status;
    } catch {
      this.updateStatus('offline');
      return 'offline';
    }
  }
}

export const networkStatus = new NetworkStatusManager();
```

### React Hook for Network Status

```typescript
// use-network-status.ts - React hook for network status
import { useSyncExternalStore, useCallback } from 'react';

function useNetworkStatus(): NetworkStatus {
  const getSnapshot = useCallback(() => networkStatus.getStatus(), []);

  const subscribe = useCallback((callback: () => void) => {
    return networkStatus.subscribe(() => callback());
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, () => 'online');
}

// Usage in component
function SyncIndicator() {
  const status = useNetworkStatus();

  return (
    <div className={`sync-indicator sync-indicator--${status}`}>
      {status === 'offline' && 'You are offline. Changes will sync when connected.'}
      {status === 'slow' && 'Slow connection detected. Some features may be delayed.'}
      {status === 'online' && 'Connected'}
    </div>
  );
}
```

### Connection-Aware Data Fetching

```typescript
// connection-aware-fetcher.ts
async function fetchWithOfflineSupport<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ data: T; source: 'network' | 'cache' }> {
  const cacheKey = `fetch:${url}`;

  // Check if online
  if (!navigator.onLine) {
    const cached = await localCache.get<T>(cacheKey);
    if (cached) {
      return { data: cached, source: 'cache' };
    }
    throw new Error('Offline and no cached data available');
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Cache successful response
    await localCache.set(cacheKey, data);

    return { data, source: 'network' };
  } catch (error) {
    // Try cache on network failure
    const cached = await localCache.get<T>(cacheKey);
    if (cached) {
      console.warn('Network failed, using cached data:', error);
      return { data: cached, source: 'cache' };
    }
    throw error;
  }
}
```

---

## 6. Background Sync API

The Background Sync API allows web applications to defer server synchronization until the user has a stable connection.

### Basic Background Sync

```typescript
// background-sync.ts - Register and handle background sync
async function registerBackgroundSync(tag: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('sync' in ServiceWorkerRegistration.prototype)) {
    console.warn('Background Sync not supported');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register(tag);
    return true;
  } catch (error) {
    console.error('Background sync registration failed:', error);
    return false;
  }
}

// Queue data and register sync
async function queueForSync(operation: SyncOperation): Promise<void> {
  // Store in IndexedDB
  const db = await getDb();
  await db.add('syncQueue', operation);

  // Register background sync
  const registered = await registerBackgroundSync('sync-pending-operations');

  if (!registered && navigator.onLine) {
    // Fallback: try to sync immediately if background sync not supported
    await processSyncQueue();
  }
}
```

### Service Worker Sync Handler

```typescript
// sw.ts - Service Worker sync event handler
declare const self: ServiceWorkerGlobalScope;

self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'sync-pending-operations') {
    event.waitUntil(processPendingOperations());
  }
});

async function processPendingOperations(): Promise<void> {
  const db = await openDB('app-database', 1);
  const operations = await db.getAll('syncQueue');

  for (const op of operations) {
    try {
      await executeSync(op);
      await db.delete('syncQueue', op.id);
    } catch (error) {
      // If network error, sync will be retried later
      if (error instanceof TypeError && error.message.includes('network')) {
        throw error; // Re-throw to trigger retry
      }
      // For other errors, mark as failed
      await db.put('syncQueue', {
        ...op,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

async function executeSync(operation: SyncOperation): Promise<void> {
  const response = await fetch(operation.endpoint, {
    method: operation.method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(operation.data),
  });

  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status}`);
  }
}
```

### Periodic Background Sync

```typescript
// periodic-sync.ts - For periodic data refresh
async function registerPeriodicSync(
  tag: string,
  minInterval: number // milliseconds
): Promise<boolean> {
  if (!('periodicSync' in ServiceWorkerRegistration.prototype)) {
    console.warn('Periodic Background Sync not supported');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check permission
    const status = await navigator.permissions.query({
      name: 'periodic-background-sync' as PermissionName,
    });

    if (status.state !== 'granted') {
      console.warn('Periodic sync permission not granted');
      return false;
    }

    await (registration as any).periodicSync.register(tag, { minInterval });
    return true;
  } catch (error) {
    console.error('Periodic sync registration failed:', error);
    return false;
  }
}

// Service worker handler
self.addEventListener('periodicsync', (event: any) => {
  if (event.tag === 'refresh-data') {
    event.waitUntil(refreshCachedData());
  }
});

async function refreshCachedData(): Promise<void> {
  // Fetch fresh data and update cache
  const response = await fetch('/api/data');
  const data = await response.json();

  const db = await openDB('app-database', 1);
  await db.put('cache', { key: 'data', value: data, timestamp: Date.now() });
}
```

---

## 7. Service Worker Caching Strategies

Different caching strategies serve different use cases.

### Cache-First Strategy

```typescript
// cache-first.ts - For static assets
async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open('static-cache-v1');
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);

  // Cache successful responses
  if (networkResponse.ok) {
    cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

// Service worker fetch handler
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

  // Use cache-first for static assets
  if (isStaticAsset(request.url)) {
    event.respondWith(cacheFirst(request));
  }
});

function isStaticAsset(url: string): boolean {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.svg', '.woff2'];
  return staticExtensions.some(ext => url.endsWith(ext));
}
```

### Network-First Strategy

```typescript
// network-first.ts - For dynamic/API content
async function networkFirst(request: Request): Promise<Response> {
  const cache = await caches.open('dynamic-cache-v1');
  const TIMEOUT_MS = 5000;

  try {
    const networkResponse = await Promise.race([
      fetch(request),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
      ),
    ]);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return cache.match('/offline.html') ?? new Response('Offline', { status: 503 });
    }

    throw error;
  }
}
```

### Stale-While-Revalidate Strategy

```typescript
// stale-while-revalidate.ts - Balance between speed and freshness
async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cache = await caches.open('swr-cache-v1');
  const cachedResponse = await cache.match(request);

  // Start network fetch in background
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });

  // Return cached response immediately if available
  if (cachedResponse) {
    // Background update happens via fetchPromise
    return cachedResponse;
  }

  // Wait for network if no cache
  return fetchPromise;
}
```

### Strategy Router

```typescript
// strategy-router.ts - Route requests to appropriate strategy
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't cache POST/PUT/DELETE requests
  if (request.method !== 'GET') {
    return;
  }

  // Static assets: Cache-first
  if (url.pathname.startsWith('/static/') ||
      url.pathname.match(/\.(js|css|png|jpg|svg|woff2)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // API calls: Network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // HTML pages: Stale-while-revalidate
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(networkFirst(request));
});
```

---

## 8. Integration with Data Fetching Libraries

### TanStack Query Offline Support

```typescript
// query-client-offline.ts - TanStack Query offline configuration
import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';

const CACHE_TIME_24_HOURS = 1000 * 60 * 60 * 24;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh for 5 minutes
      staleTime: 1000 * 60 * 5,
      // Keep in cache for 24 hours
      gcTime: CACHE_TIME_24_HOURS,
      // Don't refetch on window focus when offline
      refetchOnWindowFocus: (query) => navigator.onLine,
      // Retry with exponential backoff
      retry: (failureCount, error) => {
        // Don't retry if offline
        if (!navigator.onLine) return false;
        // Retry up to 3 times for network errors
        return failureCount < 3;
      },
      // networkMode controls behavior when offline
      networkMode: 'offlineFirst',
    },
    mutations: {
      // Queue mutations when offline
      networkMode: 'offlineFirst',
      // Retry mutations when back online
      retry: 3,
    },
  },
});

// Persist to localStorage
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'QUERY_CACHE',
});

persistQueryClient({
  queryClient,
  persister,
  maxAge: CACHE_TIME_24_HOURS,
});
```

### React Query with IndexedDB Persistence

```typescript
// query-indexeddb-persister.ts - Persist queries to IndexedDB
import { openDB, type IDBPDatabase } from 'idb';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

export function createIndexedDBPersister(dbName = 'query-cache'): Persister {
  let db: IDBPDatabase | null = null;

  const getDB = async () => {
    if (!db) {
      db = await openDB(dbName, 1, {
        upgrade(database) {
          database.createObjectStore('cache');
        },
      });
    }
    return db;
  };

  return {
    persistClient: async (client: PersistedClient) => {
      const database = await getDB();
      await database.put('cache', client, 'tanstack-query');
    },
    restoreClient: async () => {
      const database = await getDB();
      return database.get('cache', 'tanstack-query') as Promise<PersistedClient | undefined>;
    },
    removeClient: async () => {
      const database = await getDB();
      await database.delete('cache', 'tanstack-query');
    },
  };
}
```

### Paused Mutations Pattern

```typescript
// paused-mutations.ts - Handle mutations when offline
import { useMutation, useQueryClient, onlineManager } from '@tanstack/react-query';

function useOfflineAwareMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    onSuccess?: (data: TData) => void;
    optimisticUpdate?: (variables: TVariables) => void;
    rollback?: () => void;
  } = {}
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,

    onMutate: async (variables) => {
      // Apply optimistic update regardless of online status
      options.optimisticUpdate?.(variables);

      // If offline, mutation will be paused
      if (!onlineManager.isOnline()) {
        console.log('Offline - mutation paused');
      }
    },

    onSuccess: (data) => {
      options.onSuccess?.(data);
    },

    onError: (error) => {
      // Rollback optimistic update
      options.rollback?.();
      console.error('Mutation failed:', error);
    },
  });
}

// Resume paused mutations when back online
function setupMutationResume() {
  onlineManager.setOnline(navigator.onLine);

  window.addEventListener('online', () => {
    onlineManager.setOnline(true);
    // This will automatically resume paused mutations
  });

  window.addEventListener('offline', () => {
    onlineManager.setOnline(false);
  });
}
```

---

## 9. CRDT Libraries

CRDTs enable automatic conflict resolution for collaborative offline-first apps.

### Yjs for Collaborative Editing

```typescript
// yjs-setup.ts - Yjs CRDT for collaborative editing
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';

// Create a Yjs document
const ydoc = new Y.Doc();

// Persist to IndexedDB for offline support
const persistence = new IndexeddbPersistence('my-document', ydoc);

persistence.on('synced', () => {
  console.log('Content loaded from IndexedDB');
});

// Optional: Connect to peers for real-time sync
const provider = new WebrtcProvider('my-room', ydoc, {
  signaling: ['wss://signaling.example.com'],
});

// Shared data types
const yText = ydoc.getText('content');
const yArray = ydoc.getArray<string>('items');
const yMap = ydoc.getMap<unknown>('settings');

// Observe changes
yText.observe((event) => {
  console.log('Text changed:', yText.toString());
});

yArray.observe((event) => {
  console.log('Array changed:', yArray.toArray());
});

// Make changes (automatically synced)
yText.insert(0, 'Hello, World!');
yArray.push(['item1', 'item2']);
yMap.set('theme', 'dark');
```

### Yjs with React

```typescript
// use-yjs-state.ts - React hook for Yjs state
import { useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';

function useYjsArray<T>(yArray: Y.Array<T>): [T[], (items: T[]) => void] {
  const [items, setItems] = useState<T[]>(() => yArray.toArray());

  useEffect(() => {
    const observer = () => {
      setItems(yArray.toArray());
    };

    yArray.observe(observer);
    return () => yArray.unobserve(observer);
  }, [yArray]);

  const updateItems = useCallback((newItems: T[]) => {
    yArray.doc?.transact(() => {
      yArray.delete(0, yArray.length);
      yArray.push(newItems);
    });
  }, [yArray]);

  return [items, updateItems];
}

function useYjsMap<T extends Record<string, unknown>>(
  yMap: Y.Map<unknown>
): [T, (updates: Partial<T>) => void] {
  const [state, setState] = useState<T>(() => Object.fromEntries(yMap.entries()) as T);

  useEffect(() => {
    const observer = () => {
      setState(Object.fromEntries(yMap.entries()) as T);
    };

    yMap.observe(observer);
    return () => yMap.unobserve(observer);
  }, [yMap]);

  const updateState = useCallback((updates: Partial<T>) => {
    Object.entries(updates).forEach(([key, value]) => {
      yMap.set(key, value);
    });
  }, [yMap]);

  return [state, updateState];
}
```

### RxDB for Reactive Offline-First

```typescript
// rxdb-setup.ts - RxDB reactive database
import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { replicateRxCollection } from 'rxdb/plugins/replication';

addRxPlugin(RxDBQueryBuilderPlugin);

// Define schema
const todoSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    title: { type: 'string' },
    completed: { type: 'boolean' },
    createdAt: { type: 'number' },
  },
  required: ['id', 'title', 'completed'],
};

// Create database
async function createDatabase() {
  const db = await createRxDatabase({
    name: 'todosdb',
    storage: getRxStorageDexie(),
  });

  await db.addCollections({
    todos: { schema: todoSchema },
  });

  // Setup replication
  const replicationState = replicateRxCollection({
    collection: db.todos,
    replicationIdentifier: 'todos-replication',
    push: {
      async handler(docs) {
        const response = await fetch('/api/todos/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(docs),
        });
        return response.json();
      },
    },
    pull: {
      async handler(lastPulledCheckpoint, batchSize) {
        const response = await fetch(
          `/api/todos/pull?checkpoint=${lastPulledCheckpoint}&limit=${batchSize}`
        );
        return response.json();
      },
    },
    live: true,
    retryTime: 5000,
  });

  return { db, replicationState };
}

// React hook for RxDB queries
function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    const subscription = db.todos
      .find()
      .sort({ createdAt: 'desc' })
      .$.subscribe((results) => {
        setTodos(results.map((doc) => doc.toJSON()));
      });

    return () => subscription.unsubscribe();
  }, []);

  return todos;
}
```

---

## 10. PouchDB/CouchDB Sync Patterns

PouchDB provides seamless sync with CouchDB for offline-first applications.

### Basic Setup

```typescript
// pouchdb-setup.ts - PouchDB with CouchDB sync
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';

PouchDB.plugin(PouchDBFind);

// Local database
const localDb = new PouchDB('todos');

// Remote CouchDB (only connect when online)
const remoteDb = new PouchDB('https://couch.example.com/todos', {
  auth: { username: 'user', password: 'pass' },
});

// Start continuous bidirectional sync
function startSync() {
  const sync = localDb.sync(remoteDb, {
    live: true,      // Continuous sync
    retry: true,     // Auto-retry on failure
  });

  sync.on('change', (info) => {
    console.log('Sync change:', info.direction, info.change.docs.length, 'docs');
  });

  sync.on('paused', (err) => {
    if (err) {
      console.log('Sync paused due to error:', err);
    } else {
      console.log('Sync paused - up to date');
    }
  });

  sync.on('error', (err) => {
    console.error('Sync error:', err);
  });

  return sync;
}
```

### Conflict Resolution with PouchDB

```typescript
// pouchdb-conflicts.ts - Handling conflicts in PouchDB
interface TodoDoc {
  _id: string;
  _rev: string;
  _conflicts?: string[];
  title: string;
  completed: boolean;
  updatedAt: number;
}

// Check for conflicts
async function getDocWithConflicts(docId: string): Promise<{
  doc: TodoDoc;
  conflicts: TodoDoc[];
}> {
  const doc = await localDb.get<TodoDoc>(docId, { conflicts: true });
  const conflicts: TodoDoc[] = [];

  if (doc._conflicts) {
    for (const rev of doc._conflicts) {
      const conflictDoc = await localDb.get<TodoDoc>(docId, { rev });
      conflicts.push(conflictDoc);
    }
  }

  return { doc, conflicts };
}

// Resolve conflicts using a merge strategy
async function resolveConflicts(docId: string): Promise<void> {
  const { doc, conflicts } = await getDocWithConflicts(docId);

  if (conflicts.length === 0) return;

  // Merge strategy: take the most recently updated
  const allVersions = [doc, ...conflicts];
  const winner = allVersions.reduce((latest, current) =>
    current.updatedAt > latest.updatedAt ? current : latest
  );

  // Delete losing revisions
  const deletions = allVersions
    .filter((v) => v._rev !== winner._rev)
    .map((v) => ({
      _id: v._id,
      _rev: v._rev,
      _deleted: true,
    }));

  // Update winner and delete losers
  await localDb.bulkDocs([
    { ...winner, _rev: doc._rev }, // Update to keep winner as current
    ...deletions,
  ]);
}

// Auto-resolve conflicts on changes
localDb.changes({
  live: true,
  conflicts: true,
}).on('change', async (change) => {
  if (change.doc?._conflicts?.length) {
    await resolveConflicts(change.id);
  }
});
```

### Partial Data Fetching

```typescript
// pouchdb-partial-sync.ts - Sync only relevant data
// Use filtered replication to sync only user's data
function syncUserData(userId: string) {
  return localDb.sync(remoteDb, {
    live: true,
    retry: true,
    filter: 'app/by_user', // Server-side filter function
    query_params: { userId },
  });
}

// Alternative: Use multiple databases per data type
const databases = {
  users: new PouchDB('users'),
  todos: new PouchDB('todos'),
  settings: new PouchDB('settings'),
};

// Sync important data first
async function prioritizedSync() {
  // 1. Sync user settings first (small, critical)
  await databases.settings.replicate.from(
    new PouchDB('https://couch.example.com/settings')
  );

  // 2. Then sync recent todos
  await databases.todos.replicate.from(
    new PouchDB('https://couch.example.com/todos'),
    { filter: 'app/recent', query_params: { days: 7 } }
  );

  // 3. Start continuous sync for everything
  Object.entries(databases).forEach(([name, db]) => {
    db.sync(new PouchDB(`https://couch.example.com/${name}`), {
      live: true,
      retry: true,
    });
  });
}
```

---

## 11. Testing Offline Scenarios

Testing offline behavior is crucial for reliable offline-first applications.

### Playwright Offline Testing

```typescript
// offline.spec.ts - Playwright tests for offline scenarios
import { test, expect } from '@playwright/test';

test.describe('Offline functionality', () => {
  test('should show cached content when offline', async ({ page, context }) => {
    // First, load the page while online to populate cache
    await page.goto('/todos');
    await page.waitForSelector('[data-testid="todo-list"]');

    // Go offline
    await context.setOffline(true);

    // Reload the page
    await page.reload();

    // Should still show content from cache
    await expect(page.locator('[data-testid="todo-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
  });

  test('should queue changes when offline and sync when back online', async ({ page, context }) => {
    await page.goto('/todos');

    // Go offline
    await context.setOffline(true);

    // Add a new todo
    await page.fill('[data-testid="new-todo-input"]', 'Offline todo');
    await page.click('[data-testid="add-todo-button"]');

    // Verify todo appears in UI
    await expect(page.locator('text=Offline todo')).toBeVisible();

    // Verify pending sync indicator
    await expect(page.locator('[data-testid="pending-sync"]')).toContainText('1');

    // Go back online
    await context.setOffline(false);

    // Wait for sync to complete
    await expect(page.locator('[data-testid="pending-sync"]')).toContainText('0');
  });

  test('should handle sync failures gracefully', async ({ page, context }) => {
    await page.goto('/todos');

    // Mock API to return error
    await page.route('**/api/todos', (route) => {
      route.fulfill({ status: 500, body: 'Server error' });
    });

    // Try to add todo
    await page.fill('[data-testid="new-todo-input"]', 'Will fail');
    await page.click('[data-testid="add-todo-button"]');

    // Should show error message but keep local change
    await expect(page.locator('[data-testid="sync-error"]')).toBeVisible();
    await expect(page.locator('text=Will fail')).toBeVisible();
  });
});
```

### Mock Service Worker for Offline Testing

```typescript
// msw-offline-handlers.ts - MSW handlers for offline simulation
import { http, HttpResponse, delay } from 'msw';

// Simulate network conditions
export const offlineHandlers = [
  // Simulate slow network
  http.get('/api/todos', async () => {
    await delay(5000); // 5 second delay
    return HttpResponse.json([]);
  }),

  // Simulate network failure
  http.post('/api/todos', () => {
    return HttpResponse.error();
  }),

  // Simulate intermittent failures
  http.put('/api/todos/:id', () => {
    if (Math.random() > 0.5) {
      return HttpResponse.error();
    }
    return HttpResponse.json({ success: true });
  }),
];

// Testing with MSW
import { setupServer } from 'msw/node';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const server = setupServer(...offlineHandlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('handles network error gracefully', async () => {
  server.use(
    http.post('/api/todos', () => HttpResponse.error())
  );

  render(<TodoApp />);

  await userEvent.type(screen.getByPlaceholderText('New todo'), 'Test todo');
  await userEvent.click(screen.getByText('Add'));

  // Should show error but keep local state
  await waitFor(() => {
    expect(screen.getByText('Test todo')).toBeInTheDocument();
    expect(screen.getByText(/sync failed/i)).toBeInTheDocument();
  });
});
```

### Unit Testing Sync Logic

```typescript
// sync-logic.test.ts - Testing sync and conflict resolution
import { describe, it, expect, vi } from 'vitest';
import { SyncService } from './sync-service';
import { ConflictResolver } from './conflict-resolver';

describe('ConflictResolver', () => {
  it('should use last-write-wins for concurrent updates', () => {
    const resolver = new ConflictResolver('last-write-wins');

    const local = {
      id: '1',
      title: 'Local change',
      timestamp: 1000,
    };

    const server = {
      id: '1',
      title: 'Server change',
      timestamp: 2000,
    };

    const result = resolver.resolve(local, server);

    expect(result).toEqual(server);
  });

  it('should merge non-conflicting field changes', () => {
    const resolver = new ConflictResolver('field-merge');

    const base = { id: '1', title: 'Original', completed: false };
    const local = { id: '1', title: 'Local title', completed: false };
    const server = { id: '1', title: 'Original', completed: true };

    const result = resolver.merge(local, server, base);

    expect(result).toEqual({
      id: '1',
      title: 'Local title',    // Local change
      completed: true,         // Server change
    });
  });
});

describe('SyncService', () => {
  it('should queue operations when offline', async () => {
    const mockDb = {
      add: vi.fn(),
      getAll: vi.fn().mockResolvedValue([]),
    };

    const syncService = new SyncService(mockDb);

    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    await syncService.save({ id: '1', title: 'Test' });

    expect(mockDb.add).toHaveBeenCalledWith('syncQueue', expect.objectContaining({
      type: 'create',
      data: { id: '1', title: 'Test' },
    }));
  });

  it('should process queue when back online', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const mockDb = {
      getAll: vi.fn().mockResolvedValue([
        { id: '1', type: 'create', data: { id: 'a', title: 'Test' } },
      ]),
      delete: vi.fn(),
    };

    const syncService = new SyncService(mockDb);
    await syncService.processQueue();

    expect(mockFetch).toHaveBeenCalled();
    expect(mockDb.delete).toHaveBeenCalledWith('syncQueue', '1');
  });
});
```

### Testing with fake-indexeddb

```typescript
// indexeddb.test.ts - Testing IndexedDB operations
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';

class TestDatabase extends Dexie {
  todos!: Dexie.Table<{ id: string; title: string }, string>;

  constructor() {
    super('TestDb');
    this.version(1).stores({
      todos: 'id',
    });
  }
}

describe('IndexedDB operations', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = new TestDatabase();
    await db.todos.clear();
  });

  it('should persist and retrieve data', async () => {
    await db.todos.add({ id: '1', title: 'Test todo' });

    const todo = await db.todos.get('1');

    expect(todo).toEqual({ id: '1', title: 'Test todo' });
  });

  it('should handle bulk operations', async () => {
    await db.todos.bulkAdd([
      { id: '1', title: 'Todo 1' },
      { id: '2', title: 'Todo 2' },
    ]);

    const all = await db.todos.toArray();

    expect(all).toHaveLength(2);
  });
});
```

---

## 12. Anti-Patterns to Avoid

### Common Mistakes

```typescript
// ANTI-PATTERNS - DO NOT DO THIS

// BAD: Assuming navigator.onLine is reliable
async function fetchData() {
  if (navigator.onLine) {
    // Navigator.onLine can be true even without actual internet
    return fetch('/api/data'); // Will fail if no actual connectivity
  }
  return getCachedData();
}

// GOOD: Always handle network failures
async function fetchData() {
  try {
    const response = await fetch('/api/data', {
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    await cacheData(data); // Cache successful response
    return data;
  } catch (error) {
    return getCachedData(); // Fallback to cache
  }
}

// BAD: Not queueing mutations when offline
async function saveTodo(todo: Todo) {
  // This will fail silently when offline
  await fetch('/api/todos', {
    method: 'POST',
    body: JSON.stringify(todo),
  });
}

// GOOD: Always save locally first, queue for sync
async function saveTodo(todo: Todo) {
  // 1. Save to local database immediately
  await db.todos.add({ ...todo, _syncStatus: 'pending' });

  // 2. Queue for background sync
  await syncQueue.enqueue({
    type: 'create',
    collection: 'todos',
    data: todo,
  });
}

// BAD: Not handling conflicts
async function syncData() {
  const localData = await db.todos.toArray();
  // Just overwrite server - loses data!
  await fetch('/api/todos/bulk', {
    method: 'PUT',
    body: JSON.stringify(localData),
  });
}

// BAD: Caching everything
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('my-cache').then((cache) => {
      // Don't cache user-specific or frequently changing data
      return cache.addAll([
        '/',
        '/api/user-data', // BAD: User data changes frequently
        '/api/feed',      // BAD: Feed is highly dynamic
      ]);
    })
  );
});

// BAD: Not versioning cache
const CACHE_NAME = 'my-cache'; // No version = stale cache forever

// GOOD: Version your cache
const CACHE_VERSION = 'v2.1.0';
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;

// BAD: Blocking on non-critical sync
async function loadApp() {
  // Don't block app load on sync
  await syncAllData(); // Can take minutes on slow connection!
  renderApp();
}

// GOOD: Load immediately, sync in background
async function loadApp() {
  // Load from local database immediately
  const localData = await db.todos.toArray();
  renderApp(localData);

  // Sync in background (non-blocking)
  syncAllData().catch(console.error);
}

// BAD: No retry logic for sync
async function pushToServer(data: unknown) {
  await fetch('/api/sync', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  // If this fails, data is lost!
}

// GOOD: Implement retry with exponential backoff
async function pushToServer(data: unknown, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (response.ok) return;
    } catch (error) {
      if (attempt === retries - 1) throw error;
      await delay(Math.pow(2, attempt) * 1000); // Exponential backoff
    }
  }
}

// BAD: Storing sensitive data without encryption
await db.users.add({
  id: '1',
  email: 'user@example.com',
  authToken: 'secret-token', // Stored in plain text!
});

// BAD: No tombstones for deletions
async function deleteTodo(id: string) {
  await db.todos.delete(id); // Other devices won't know to delete
}

// GOOD: Use soft deletes with tombstones
async function deleteTodo(id: string) {
  await db.todos.update(id, {
    _deleted: true,
    _deletedAt: Date.now(),
    _syncStatus: 'pending',
  });
}
```

### Architecture Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Server as source of truth | App unusable offline | Local database as source of truth |
| Sync on every action | Poor UX, battery drain | Batch sync with debouncing |
| No conflict strategy | Data loss | Implement explicit conflict resolution |
| Unlimited local cache | Storage quota exceeded | Implement cache eviction policies |
| No sync status UI | Users confused about data state | Show sync status indicators |
| Blocking on network | App feels slow | Optimistic updates with background sync |

### Data Retention Best Practices

```typescript
// cache-eviction.ts - Proper cache management
const RETENTION_POLICIES = {
  // User content: Keep until synced, then 90 days
  userContent: {
    keepWhilePending: true,
    maxAgeDays: 90,
  },
  // Feed data: Short retention
  feedData: {
    keepWhilePending: false,
    maxAgeDays: 7,
  },
  // Settings: Keep indefinitely
  settings: {
    keepWhilePending: true,
    maxAgeDays: Infinity,
  },
};

async function evictOldData() {
  const now = Date.now();

  for (const [collection, policy] of Object.entries(RETENTION_POLICIES)) {
    if (policy.maxAgeDays === Infinity) continue;

    const cutoff = now - (policy.maxAgeDays * 24 * 60 * 60 * 1000);

    await db[collection]
      .where('_lastModified')
      .below(cutoff)
      .and((item) => !policy.keepWhilePending || item._syncStatus === 'synced')
      .delete();
  }
}

// Run eviction periodically
setInterval(evictOldData, 24 * 60 * 60 * 1000); // Daily
```

---

## Sources

### Core Principles
- [Offline-First Architecture: Designing for Reality, Not Just the Cloud](https://medium.com/@jusuftopic/offline-first-architecture-designing-for-reality-not-just-the-cloud-e5fd18e50a79)
- [Build an offline-first app | Android Developers](https://developer.android.com/topic/architecture/data-layer/offline-first)
- [Local-first software: You own your data](https://www.inkandswitch.com/essay/local-first/)
- [Offline-first frontend apps in 2025 - LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)

### IndexedDB and Libraries
- [Dexie.js - IndexedDB Made Simple](https://dexie.org)
- [GitHub - jakearchibald/idb](https://github.com/jakearchibald/idb)
- [Using IndexedDB - MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)
- [RxDB - JavaScript Database](https://rxdb.info/)

### Sync and Conflict Resolution
- [CRDT Implementation Guide - Velt](https://velt.dev/blog/crdt-implementation-guide-conflict-free-apps)
- [Best CRDT Libraries 2025 - Velt](https://velt.dev/blog/best-crdt-libraries-real-time-data-sync)
- [The CRDT Dictionary - Ian Duncan](https://www.iankduncan.com/engineering/2025-11-27-crdt-dictionary/)
- [About CRDTs](https://crdt.tech/)

### Network Status
- [Navigator: onLine property - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine)
- [Detect Online and Offline Status - CodePro](https://codepro.blog/2025/08/17/network-status-with-javascript/)

### Background Sync
- [Background Synchronization API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
- [Periodic Background Sync API - Chrome Developers](https://developer.chrome.com/docs/capabilities/periodic-background-sync)
- [Background Sync in PWAs - Zee Palm](https://www.zeepalm.com/blog/background-sync-in-pwas-service-worker-guide)

### Service Worker Caching
- [Strategies for service worker caching - Chrome Developers](https://developer.chrome.com/docs/workbox/caching-strategies-overview)
- [Caching - Progressive web apps | MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching)
- [Service Worker Caching Strategies - Medium](https://tianyaschool.medium.com/service-worker-caching-strategies-offline-first-vs-network-first-39bfbce38e1b)

### Data Fetching Libraries
- [persistQueryClient - TanStack Query Docs](https://tanstack.com/query/v4/docs/framework/react/plugins/persistQueryClient)
- [React TanStack Query Offline Example](https://tanstack.com/query/v4/docs/framework/react/examples/offline)
- [React Native Offline First with TanStack Query](https://dev.to/fedorish/react-native-offline-first-with-tanstack-query-1pe5)

### CRDT Libraries
- [Yjs Docs](https://docs.yjs.dev)
- [GitHub - yjs/yjs](https://github.com/yjs/yjs)
- [RxDB - Local First / Offline First](https://rxdb.info/offline-first.html)

### PouchDB/CouchDB
- [Offline-First with CouchDB and PouchDB in 2025 - Neighbourhoodie](https://neighbourhood.ie/blog/2025/03/26/offline-first-with-couchdb-and-pouchdb-in-2025)
- [PouchDB Replication Guide](https://pouchdb.com/guides/replication.html)
- [Partial Data Fetching with PouchDB - Neighbourhoodie](https://neighbourhood.ie/blog/2025/07/16/partial-data-fetching-on-initial-load-with-pouchdb-and-couchdb)

### Testing
- [Offline but Not Broken: Testing Cached Data with Playwright](https://www.thegreenreport.blog/articles/offline-but-not-broken-testing-cached-data-with-playwright/offline-but-not-broken-testing-cached-data-with-playwright.html)
- [Network | Playwright](https://playwright.dev/docs/network)
- [Service Workers | Playwright](https://playwright.dev/docs/service-workers)
- [Mock Service Worker](https://mswjs.io/)

### Optimistic UI
- [useOptimistic - React Docs](https://react.dev/reference/react/useOptimistic)
- [Understanding optimistic UI and React's useOptimistic Hook - LogRocket](https://blog.logrocket.com/understanding-optimistic-ui-react-useoptimistic-hook/)
- [TanStack DB for reactive, offline-ready React apps - LogRocket](https://blog.logrocket.com/tanstack-db-ux/)
