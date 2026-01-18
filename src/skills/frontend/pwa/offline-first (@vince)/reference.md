# Offline-First Reference

> Decision frameworks, anti-patterns, and troubleshooting for offline-first applications. See [SKILL.md](SKILL.md) for concepts.

---

## Decision Frameworks

### Framework 1: Storage Strategy Selection

```
What type of data are you storing?
├─ Structured data (entities, records)
│   ├─ Need reactive queries?
│   │   └─ YES → Dexie.js 4.x with useLiveQuery
│   │   └─ NO → idb 8.x (lighter weight, ~1.2KB)
│   └─ Complex relational queries?
│       └─ YES → Consider SQLite via WebAssembly, PouchDB, or RxDB
│       └─ NO → Dexie.js or idb
├─ Simple key-value data (< 5MB, not critical)
│   └─ localStorage (sync, blocks UI) or idb-keyval (~295 bytes)
├─ Large files (images, videos)
│   └─ Cache API, OPFS, or File System Access API
└─ Sensitive data
    └─ Web Crypto API + IndexedDB (encrypt before storing)

Storage Limits:
├─ localStorage: 5MB per origin (sync, blocks UI)
├─ IndexedDB: 50% of available disk space (async)
├─ Safari: 7-day eviction on script-writable storage
└─ Request persistent storage to prevent eviction
```

### Framework 2: Conflict Resolution Strategy

```
What type of data is conflicting?
├─ Independent values (toggle, counter)
│   └─ Last-Write-Wins (LWW)
├─ Collaborative text (documents)
│   └─ CRDT (Yjs, Automerge)
├─ User preferences
│   └─ Field-Level Merge
├─ Business-critical data
│   └─ Manual Resolution with UI
└─ Ordered lists
    └─ Fractional Indexing + LWW
```

### Framework 3: Sync Frequency

```
How critical is data freshness?
├─ Real-time (< 1s)
│   └─ WebSocket + local cache (not offline-first)
├─ Near real-time (1-30s)
│   └─ Polling + optimistic updates
├─ Background sync (30s - 5min)
│   └─ Service Worker Background Sync (Chrome/Edge only - experimental)
│   └─ Fallback: online event listener + manual sync
└─ Manual/on-demand
    └─ User-triggered sync button

Note: Background Sync API is experimental - only Chrome/Edge support it.
Always implement fallback sync using 'online' event listener.
```

### Framework 4: Offline Capability Scope

```
What offline capabilities does the app need?
├─ Read-only offline
│   └─ Service Worker cache-first + IndexedDB cache
├─ Full CRUD offline
│   └─ IndexedDB + Sync Queue + Conflict Resolution
├─ Collaborative offline
│   └─ CRDTs + IndexedDB + Merge strategies
└─ No offline needed
    └─ Don't add complexity - use network-only
```

---

## Anti-Patterns

### Anti-Pattern 1: Hard Deletes

```typescript
// ❌ Bad - Hard delete loses data
async function deleteTodo(id: string): Promise<void> {
  await db.todos.delete(id);

  await syncQueue.enqueue({
    type: 'DELETE',
    data: { id },
  });
}

// Problem: If sync fails, server still has the item
// Next pull will "resurrect" the deleted item
```

```typescript
// ✅ Good - Soft delete with tombstone
async function deleteTodo(id: string): Promise<void> {
  await db.todos.update(id, {
    _deletedAt: Date.now(),
    _syncStatus: 'pending',
    _lastModified: Date.now(),
  });

  await syncQueue.enqueue({
    type: 'DELETE',
    data: { id, _deletedAt: Date.now() },
  });
}
```

**Why bad:** Hard deletes cause resurrection bugs when sync fails or is delayed.

---

### Anti-Pattern 2: Trusting navigator.onLine

```typescript
// ❌ Bad - navigator.onLine is unreliable
function isOnline(): boolean {
  return navigator.onLine;
}

// Can return true when:
// - Connected to WiFi with no internet
// - Behind captive portal
// - VPN disconnected
// - Severely degraded connection
```

```typescript
// ✅ Good - Verify with actual request
async function checkConnectivity(): Promise<boolean> {
  try {
    const response = await fetch('/api/health', {
      method: 'HEAD',
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}
```

**Why bad:** navigator.onLine only checks if there's a network interface, not actual internet connectivity.

---

### Anti-Pattern 3: Sync Without Retry Logic

```typescript
// ❌ Bad - No retry on failure
async function syncItem(item: Todo): Promise<void> {
  const response = await fetch('/api/todos', {
    method: 'POST',
    body: JSON.stringify(item),
  });

  if (!response.ok) {
    throw new Error('Sync failed'); // Lost forever
  }
}
```

```typescript
// ✅ Good - Queue with exponential backoff
async function syncItem(item: Todo): Promise<void> {
  await syncQueue.enqueue({
    type: 'UPSERT',
    data: item,
    timestamp: Date.now(),
  });
  // Queue handles retries with exponential backoff
}
```

**Why bad:** Transient failures cause permanent data loss without retry logic.

---

### Anti-Pattern 4: Timestamp-Only Conflict Detection

```typescript
// ❌ Bad - Relies only on timestamps
function hasConflict(local: Todo, server: Todo): boolean {
  return local._lastModified !== server._lastModified;
}

// Problems:
// - Clock drift between devices
// - Simultaneous edits at "same" time
// - No way to detect concurrent vs sequential changes
```

```typescript
// ✅ Good - Use version vectors
function hasConflict(local: Todo, server: Todo): boolean {
  const comparison = compareVectors(
    local._versionVector,
    server._versionVector
  );
  return comparison === 'concurrent';
}
```

**Why bad:** Timestamps can't distinguish concurrent edits from sequential ones.

---

### Anti-Pattern 5: Blocking UI on Sync

```typescript
// ❌ Bad - Block UI while syncing
async function saveTodo(todo: Todo): Promise<void> {
  setLoading(true);

  // User waits...
  const response = await fetch('/api/todos', {
    method: 'POST',
    body: JSON.stringify(todo),
  });

  if (response.ok) {
    await db.todos.put(todo);
  }

  setLoading(false);
}
```

```typescript
// ✅ Good - Local-first, non-blocking
async function saveTodo(todo: Todo): Promise<void> {
  // Immediate local save
  await db.todos.put({
    ...todo,
    _syncStatus: 'pending',
  });

  // Background sync (non-blocking)
  syncQueue.enqueue({ type: 'UPSERT', data: todo });
}
```

**Why bad:** Users wait for network operations, defeating the purpose of offline-first.

---

### Anti-Pattern 6: Missing Offline Detection in UI

```typescript
// ❌ Bad - No indication of sync state
function TodoItem({ todo }: { todo: Todo }) {
  return (
    <li>
      <span>{todo.title}</span>
    </li>
  );
}

// Users don't know:
// - If their changes are saved
// - If changes will sync
// - If there's a conflict
```

```typescript
// ✅ Good - Clear sync indicators
function TodoItem({ todo }: { todo: Todo }) {
  return (
    <li data-sync-status={todo._syncStatus}>
      <span>{todo.title}</span>
      <SyncIndicator status={todo._syncStatus} />
    </li>
  );
}
```

**Why bad:** Users lose trust when they can't see sync status.

---

### Anti-Pattern 7: Unbounded Sync Queue

```typescript
// ❌ Bad - No limits on queue
async function enqueue(operation: Operation): Promise<void> {
  await db.syncQueue.add(operation);
  // Queue can grow infinitely if offline for long time
}
```

```typescript
// ✅ Good - Queue management with limits
const MAX_QUEUE_SIZE = 1000;
const QUEUE_PRUNE_THRESHOLD = 800;

async function enqueue(operation: Operation): Promise<void> {
  const queueSize = await db.syncQueue.count();

  if (queueSize >= MAX_QUEUE_SIZE) {
    // Prune oldest synced operations
    await pruneOldOperations(QUEUE_PRUNE_THRESHOLD);
  }

  await db.syncQueue.add(operation);
}
```

**Why bad:** Unbounded queues can exhaust storage or cause OOM during sync.

---

### Anti-Pattern 8: Ignoring Storage Quotas

```typescript
// ❌ Bad - No quota handling
async function saveData(key: string, data: unknown): Promise<void> {
  await db.cache.put(key, data); // May throw QuotaExceededError
}
```

```typescript
// ✅ Good - Handle quota proactively
async function saveData(key: string, data: unknown): Promise<void> {
  const storageInfo = await getStorageInfo();

  if (storageInfo.status === 'critical') {
    await performStorageCleanup();
  }

  try {
    await db.cache.put(key, data);
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      await performStorageCleanup();
      await db.cache.put(key, data); // Retry once
    }
    throw error;
  }
}
```

**Why bad:** QuotaExceededError crashes the app without warning.

---

### Anti-Pattern 9: Awaiting Non-IndexedDB Operations Mid-Transaction

```typescript
// ❌ Bad - Awaiting fetch inside transaction
async function updateWithServerData(id: string): Promise<void> {
  const tx = db.transaction('todos', 'readwrite');
  const store = tx.objectStore('todos');

  // Transaction will auto-close during this await!
  const serverData = await fetch(`/api/todos/${id}`).then(r => r.json());

  // TRANSACTION_INACTIVE_ERR - transaction already closed
  await store.put(serverData);
}
```

```typescript
// ✅ Good - Fetch first, then transaction
async function updateWithServerData(id: string): Promise<void> {
  // Fetch outside transaction
  const serverData = await fetch(`/api/todos/${id}`).then(r => r.json());

  // Short-lived transaction
  const tx = db.transaction('todos', 'readwrite');
  const store = tx.objectStore('todos');
  await store.put(serverData);
  await tx.done;
}
```

**Why bad:** IndexedDB transactions auto-close when control returns to the event loop without pending requests. Any `await` on non-IndexedDB operations (fetch, setTimeout, etc.) causes the transaction to close, resulting in `TRANSACTION_INACTIVE_ERR`.

---

## Troubleshooting Guide

### Issue: Data "Disappears" After Sync

**Symptoms:**
- User creates item offline
- After coming online and syncing, item is gone

**Causes:**
1. Server rejects item (validation, auth)
2. Conflict resolved in favor of server
3. Hard delete on another device synced over

**Solutions:**
1. Check server response for errors, log sync failures
2. Implement user-visible conflict resolution
3. Use soft deletes with tombstone retention

---

### Issue: Duplicate Items After Sync

**Symptoms:**
- Same item appears multiple times after sync
- Duplicates have different IDs

**Causes:**
1. Item created offline, synced, then local ID not updated to server ID
2. Multiple devices create "same" item offline

**Solutions:**
1. Server should return created ID, update local record
2. Use client-generated UUIDs instead of server auto-increment
3. Implement deduplication based on content hash

---

### Issue: Sync Queue Never Empties

**Symptoms:**
- Pending count never goes to zero
- Same operations retry indefinitely

**Causes:**
1. Server consistently rejects operations
2. No max retry limit
3. Operations queued faster than processed

**Solutions:**
1. Log and surface server errors to user
2. Implement max retry with dead-letter queue
3. Batch operations, implement rate limiting

---

### Issue: Optimistic Update Shows Then Reverts

**Symptoms:**
- UI updates immediately
- Then reverts after network call fails

**Causes:**
1. Server validation fails
2. Conflict with newer server data
3. Authorization error

**Solutions:**
1. Validate locally before optimistic update
2. Show "pending" state, only confirm after sync
3. Handle auth errors gracefully (re-authenticate)

---

### Issue: IndexedDB QuotaExceededError

**Symptoms:**
- App crashes with QuotaExceededError
- Storage full error messages

**Causes:**
1. Too much data cached
2. Tombstones never cleaned up
3. Sync queue growing unbounded

**Solutions:**
1. Request persistent storage permission
2. Implement tombstone cleanup (Pattern 12)
3. Monitor storage with quota management (Pattern 17)
4. Implement data eviction strategy (LRU cache)

---

### Issue: Safari Data Eviction (7-Day Cap)

**Symptoms:**
- Data disappears after ~7 days on iOS Safari
- Users report losing offline data on Safari

**Causes:**
Safari (iOS 13.4+, macOS Safari 13.1+) enforces a 7-day cap on all script-writable storage including IndexedDB, service worker registration, and Cache API if the user doesn't interact with the site.

**Solutions:**
1. Request persistent storage: `navigator.storage.persist()` - Safari may still ignore this
2. Educate users to add the app to home screen (PWA mode has longer retention)
3. Implement server-side backup with periodic sync
4. Show warning banner on Safari about potential data loss
5. Use Service Worker to maintain site engagement

---

### Issue: Slow Initial Load

**Symptoms:**
- App takes long time to start
- IndexedDB queries are slow

**Causes:**
1. Loading all data on startup
2. Missing indexes on queried fields
3. Too much data in single table

**Solutions:**
1. Implement pagination, load visible data first
2. Add indexes for frequently queried fields
3. Partition data into multiple tables/stores
4. Use cursor-based queries instead of getAll()

---

## Testing Offline Scenarios

### Simulating Offline State

```typescript
// test/offline-simulation.ts

// Method 1: Service Worker intercept
self.addEventListener('fetch', (event) => {
  if (globalThis.__SIMULATE_OFFLINE__) {
    event.respondWith(
      Promise.reject(new TypeError('Simulated offline'))
    );
  }
});

// Method 2: Mock fetch for tests
function createOfflineFetch(): typeof fetch {
  return async () => {
    throw new TypeError('Failed to fetch');
  };
}

// Method 3: Network Information API mock
Object.defineProperty(navigator, 'onLine', {
  get: () => false,
  configurable: true,
});
```

### Test Scenarios Checklist

```markdown
## Offline Tests
- [ ] Create item while offline → queued
- [ ] Edit item while offline → local update + queued
- [ ] Delete item while offline → soft delete + queued
- [ ] View items while offline → from IndexedDB

## Sync Tests
- [ ] Queue processes when online
- [ ] Failed sync retries with backoff
- [ ] Conflict detected when server data differs
- [ ] Resolved conflicts update local

## Edge Cases
- [ ] Rapid offline/online transitions
- [ ] Multiple tabs editing same item
- [ ] Storage quota exceeded
- [ ] Large queue processing
- [ ] Network timeout handling
```

---

## Performance Considerations

### IndexedDB Optimization

| Operation | Optimization |
|-----------|--------------|
| Bulk reads | Use `getAll()` with index, not `toArray()` |
| Bulk writes | Use transactions, batch `put()` calls |
| Large datasets | Implement pagination, virtual scrolling |
| Complex queries | Add compound indexes |
| Real-time updates | Use Dexie's `liveQuery` |

### Sync Optimization

| Strategy | When to Use |
|----------|-------------|
| Delta sync | Default - only sync changes |
| Batch uploads | Many small changes |
| Compressed payloads | Large data volumes |
| Background sync | Non-critical updates |
| Priority queuing | Critical changes first |

### Memory Management

```typescript
// Avoid holding large datasets in memory
const BATCH_SIZE = 100;

async function processLargeDataset(
  db: Database
): Promise<void> {
  let offset = 0;

  while (true) {
    const batch = await db.todos
      .offset(offset)
      .limit(BATCH_SIZE)
      .toArray();

    if (batch.length === 0) break;

    await processBatch(batch);
    offset += BATCH_SIZE;

    // Allow GC between batches
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}
```

---

## Security Considerations

### Sensitive Data in IndexedDB

IndexedDB is not encrypted by default. For sensitive data:

```typescript
// Encrypt before storing
import { encrypt, decrypt } from './crypto-utils';

async function saveSensitiveData(
  key: string,
  data: SensitiveData
): Promise<void> {
  const encrypted = await encrypt(
    JSON.stringify(data),
    await getEncryptionKey()
  );
  await db.sensitiveStore.put({ key, encrypted });
}

async function getSensitiveData(
  key: string
): Promise<SensitiveData | null> {
  const record = await db.sensitiveStore.get(key);
  if (!record) return null;

  const decrypted = await decrypt(
    record.encrypted,
    await getEncryptionKey()
  );
  return JSON.parse(decrypted);
}
```

### Authentication Token Storage

```typescript
// Don't store tokens in localStorage (XSS vulnerable)
// Use httpOnly cookies when possible
// If must store locally, use IndexedDB with encryption

// Clear sensitive data on logout
async function logout(): Promise<void> {
  await db.sensitiveStore.clear();
  await db.syncQueue.clear();
  // Retain non-sensitive cached data for offline use
}
```
