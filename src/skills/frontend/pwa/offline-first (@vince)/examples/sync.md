# Synchronization Patterns

> Conflict resolution and synchronization patterns for offline-first applications. See [SKILL.md](../SKILL.md) for concepts.

---

## Pattern 18: Last-Write-Wins (LWW) Resolution

The simplest conflict resolution strategy where the most recent change wins.

```typescript
// sync/last-write-wins.ts

interface SyncableEntity {
  id: string;
  _lastModified: number;
  _serverTimestamp?: number;
  _localVersion: string;
  _serverVersion?: string;
  _syncStatus: 'synced' | 'pending' | 'conflicted';
}

interface ConflictResult<T> {
  resolved: T;
  winner: 'local' | 'server';
  loser: T;
}

// Named constants
const CLOCK_DRIFT_TOLERANCE_MS = 5000;

/**
 * Resolves conflict using Last-Write-Wins strategy.
 * Server timestamp takes precedence if available, falls back to client timestamps.
 */
function resolveWithLWW<T extends SyncableEntity>(
  local: T,
  server: T
): ConflictResult<T> {
  // Prefer server timestamps for comparison (more reliable)
  const localTime = local._serverTimestamp ?? local._lastModified;
  const serverTime = server._serverTimestamp ?? server._lastModified;

  // Account for minor clock drift - if within tolerance, server wins
  const timeDiff = Math.abs(localTime - serverTime);
  const localIsNewer = localTime > serverTime + CLOCK_DRIFT_TOLERANCE_MS;

  if (localIsNewer) {
    return {
      resolved: {
        ...local,
        _syncStatus: 'synced' as const,
        _serverVersion: server._serverVersion,
      },
      winner: 'local',
      loser: server,
    };
  }

  return {
    resolved: {
      ...server,
      _syncStatus: 'synced' as const,
      _localVersion: local._localVersion,
    },
    winner: 'server',
    loser: local,
  };
}

export { resolveWithLWW };
export type { ConflictResult };
```

**Why good:** Simple and predictable, handles clock drift, preserves version info from both sides

---

## Pattern 19: Field-Level Merge

Merge non-conflicting field changes, only conflict on same-field edits.

```typescript
// sync/field-merge.ts

interface FieldChange {
  field: string;
  localValue: unknown;
  serverValue: unknown;
  localTimestamp: number;
  serverTimestamp: number;
}

interface MergeResult<T> {
  merged: T;
  autoResolved: FieldChange[];
  conflicts: FieldChange[];
}

// Fields that should never be merged (sync metadata)
const SYNC_METADATA_FIELDS = [
  '_syncStatus',
  '_lastModified',
  '_localVersion',
  '_serverVersion',
  '_serverTimestamp',
  '_deletedAt',
  'id',
] as const;

/**
 * Performs field-level merge, identifying conflicts only where
 * both local and server changed the same field.
 */
function mergeFields<T extends Record<string, unknown>>(
  base: T,      // Last known common state
  local: T,     // Local changes
  server: T,    // Server changes
  localTimestamp: number,
  serverTimestamp: number
): MergeResult<T> {
  const merged = { ...base } as T;
  const autoResolved: FieldChange[] = [];
  const conflicts: FieldChange[] = [];

  const allFields = new Set([
    ...Object.keys(local),
    ...Object.keys(server),
  ]);

  for (const field of allFields) {
    // Skip sync metadata
    if (SYNC_METADATA_FIELDS.includes(field as typeof SYNC_METADATA_FIELDS[number])) {
      continue;
    }

    const baseValue = base[field];
    const localValue = local[field];
    const serverValue = server[field];

    const localChanged = !deepEqual(baseValue, localValue);
    const serverChanged = !deepEqual(baseValue, serverValue);

    if (!localChanged && !serverChanged) {
      // No changes
      continue;
    }

    if (localChanged && !serverChanged) {
      // Only local changed - use local
      (merged as Record<string, unknown>)[field] = localValue;
      autoResolved.push({
        field,
        localValue,
        serverValue,
        localTimestamp,
        serverTimestamp,
      });
    } else if (!localChanged && serverChanged) {
      // Only server changed - use server
      (merged as Record<string, unknown>)[field] = serverValue;
      autoResolved.push({
        field,
        localValue,
        serverValue,
        localTimestamp,
        serverTimestamp,
      });
    } else if (deepEqual(localValue, serverValue)) {
      // Both changed to same value - no conflict
      (merged as Record<string, unknown>)[field] = localValue;
    } else {
      // True conflict - both changed to different values
      conflicts.push({
        field,
        localValue,
        serverValue,
        localTimestamp,
        serverTimestamp,
      });
      // Default to server for merged result, but flag as conflict
      (merged as Record<string, unknown>)[field] = serverValue;
    }
  }

  return { merged, autoResolved, conflicts };
}

// Simple deep equality check
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return a === b;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) return false;

  return aKeys.every(key => deepEqual(aObj[key], bObj[key]));
}

export { mergeFields };
export type { FieldChange, MergeResult };
```

**Why good:** Only conflicts where both sides changed the same field, preserves non-conflicting changes from both sides, returns structured conflict info for UI

---

## Pattern 20: Conflict Resolution UI

Present conflicts to users and allow manual resolution.

```tsx
// components/conflict-resolver.tsx
import { useState, type ReactNode } from 'react';
import type { FieldChange, MergeResult } from '../sync/field-merge';

interface ConflictResolverProps<T> {
  entityName: string;
  localEntity: T;
  serverEntity: T;
  conflicts: FieldChange[];
  onResolve: (resolved: T) => Promise<void>;
  onCancel: () => void;
  renderField?: (field: string, value: unknown) => ReactNode;
}

type Resolution = 'local' | 'server';

function ConflictResolver<T extends Record<string, unknown>>({
  entityName,
  localEntity,
  serverEntity,
  conflicts,
  onResolve,
  onCancel,
  renderField = (field, value) => JSON.stringify(value),
}: ConflictResolverProps<T>) {
  const [resolutions, setResolutions] = useState<Map<string, Resolution>>(
    new Map()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allResolved = conflicts.every(c => resolutions.has(c.field));

  const handleFieldResolution = (field: string, choice: Resolution) => {
    setResolutions(prev => new Map(prev).set(field, choice));
  };

  const handleSubmit = async () => {
    if (!allResolved) return;

    setIsSubmitting(true);
    try {
      // Build resolved entity
      const resolved = { ...serverEntity };
      for (const [field, choice] of resolutions) {
        if (choice === 'local') {
          (resolved as Record<string, unknown>)[field] = localEntity[field];
        }
      }

      await onResolve(resolved as T);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby="conflict-title"
      aria-describedby="conflict-description"
    >
      <h2 id="conflict-title">Resolve Sync Conflict</h2>
      <p id="conflict-description">
        The {entityName} was modified both locally and on the server.
        Choose which version to keep for each field.
      </p>

      <div role="list" aria-label="Conflicting fields">
        {conflicts.map(conflict => (
          <div
            key={conflict.field}
            role="listitem"
            data-field={conflict.field}
          >
            <h3>{formatFieldName(conflict.field)}</h3>

            <fieldset>
              <legend>Choose version for {conflict.field}</legend>

              <label>
                <input
                  type="radio"
                  name={`conflict-${conflict.field}`}
                  value="local"
                  checked={resolutions.get(conflict.field) === 'local'}
                  onChange={() => handleFieldResolution(conflict.field, 'local')}
                />
                <span>Your changes</span>
                <span aria-label="Local value">
                  {renderField(conflict.field, conflict.localValue)}
                </span>
                <time dateTime={new Date(conflict.localTimestamp).toISOString()}>
                  {formatTimestamp(conflict.localTimestamp)}
                </time>
              </label>

              <label>
                <input
                  type="radio"
                  name={`conflict-${conflict.field}`}
                  value="server"
                  checked={resolutions.get(conflict.field) === 'server'}
                  onChange={() => handleFieldResolution(conflict.field, 'server')}
                />
                <span>Server version</span>
                <span aria-label="Server value">
                  {renderField(conflict.field, conflict.serverValue)}
                </span>
                <time dateTime={new Date(conflict.serverTimestamp).toISOString()}>
                  {formatTimestamp(conflict.serverTimestamp)}
                </time>
              </label>
            </fieldset>
          </div>
        ))}
      </div>

      <div role="group" aria-label="Actions">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allResolved || isSubmitting}
          aria-describedby={!allResolved ? 'resolve-all-hint' : undefined}
        >
          {isSubmitting ? 'Saving...' : 'Apply Resolution'}
        </button>
        {!allResolved && (
          <span id="resolve-all-hint">
            Please resolve all {conflicts.length - resolutions.size} remaining conflicts
          </span>
        )}
      </div>
    </div>
  );
}

function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function formatTimestamp(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(ts));
}

export { ConflictResolver };
export type { ConflictResolverProps };
```

**Why good:** Accessible with proper ARIA, per-field resolution, disabled submit until all resolved, custom field rendering support

---

## Pattern 21: Version Vector for Causality

Track concurrent modifications using version vectors instead of timestamps.

```typescript
// sync/version-vector.ts

/**
 * A version vector tracks the "logical clock" of each node/client
 * that has modified an entity. Enables detecting true concurrent
 * modifications vs sequential updates.
 */
type VersionVector = Record<string, number>;

interface VersionedEntity {
  id: string;
  _versionVector: VersionVector;
  _nodeId: string; // This client's node ID
}

// Get or create persistent node ID for this client
function getNodeId(): string {
  const STORAGE_KEY = 'offline-first-node-id';
  let nodeId = localStorage.getItem(STORAGE_KEY);

  if (!nodeId) {
    nodeId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, nodeId);
  }

  return nodeId;
}

const NODE_ID = getNodeId();

/**
 * Increment the local node's version in the vector
 */
function incrementVersion(vector: VersionVector): VersionVector {
  return {
    ...vector,
    [NODE_ID]: (vector[NODE_ID] ?? 0) + 1,
  };
}

/**
 * Merge two version vectors, taking max of each node's version
 */
function mergeVectors(a: VersionVector, b: VersionVector): VersionVector {
  const merged: VersionVector = { ...a };

  for (const [node, version] of Object.entries(b)) {
    merged[node] = Math.max(merged[node] ?? 0, version);
  }

  return merged;
}

type CompareResult = 'before' | 'after' | 'concurrent' | 'equal';

/**
 * Compare two version vectors to determine causality:
 * - 'before': a happened before b
 * - 'after': a happened after b
 * - 'concurrent': a and b are concurrent (conflict)
 * - 'equal': a and b are identical
 */
function compareVectors(a: VersionVector, b: VersionVector): CompareResult {
  let aBeforeB = true;
  let bBeforeA = true;

  const allNodes = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const node of allNodes) {
    const aVersion = a[node] ?? 0;
    const bVersion = b[node] ?? 0;

    if (aVersion > bVersion) {
      bBeforeA = false;
    }
    if (bVersion > aVersion) {
      aBeforeB = false;
    }
  }

  if (aBeforeB && bBeforeA) {
    return 'equal';
  }
  if (aBeforeB) {
    return 'before';
  }
  if (bBeforeA) {
    return 'after';
  }
  return 'concurrent';
}

/**
 * Check if entity needs sync based on version comparison
 */
function needsSync(local: VersionedEntity, server: VersionedEntity): {
  needsUpload: boolean;
  needsDownload: boolean;
  hasConflict: boolean;
} {
  const comparison = compareVectors(
    local._versionVector,
    server._versionVector
  );

  return {
    needsUpload: comparison === 'after',
    needsDownload: comparison === 'before',
    hasConflict: comparison === 'concurrent',
  };
}

export {
  getNodeId,
  NODE_ID,
  incrementVersion,
  mergeVectors,
  compareVectors,
  needsSync,
};
export type { VersionVector, VersionedEntity, CompareResult };
```

**Why good:** Detects true concurrent edits vs sequential updates, no clock synchronization needed, deterministic conflict detection, persistent node ID

---

## Pattern 22: Delta Sync Protocol

Sync only changed items since last sync using server-provided cursors.

```typescript
// sync/delta-sync.ts

interface SyncCursor {
  collection: string;
  lastSyncTimestamp: number;
  lastServerId?: string; // For pagination
}

interface DeltaSyncResult<T> {
  items: T[];
  hasMore: boolean;
  nextCursor: SyncCursor;
  serverTimestamp: number;
}

// Named constants
const DEFAULT_BATCH_SIZE = 100;
const CURSOR_STORAGE_KEY = 'sync-cursors';

class DeltaSyncManager {
  private cursors: Map<string, SyncCursor>;

  constructor() {
    this.cursors = this.loadCursors();
  }

  private loadCursors(): Map<string, SyncCursor> {
    try {
      const stored = localStorage.getItem(CURSOR_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, SyncCursor>;
        return new Map(Object.entries(parsed));
      }
    } catch {
      console.warn('Failed to load sync cursors');
    }
    return new Map();
  }

  private saveCursors(): void {
    const obj = Object.fromEntries(this.cursors);
    localStorage.setItem(CURSOR_STORAGE_KEY, JSON.stringify(obj));
  }

  getCursor(collection: string): SyncCursor {
    return this.cursors.get(collection) ?? {
      collection,
      lastSyncTimestamp: 0,
    };
  }

  updateCursor(cursor: SyncCursor): void {
    this.cursors.set(cursor.collection, cursor);
    this.saveCursors();
  }

  async fetchDelta<T>(
    collection: string,
    fetcher: (cursor: SyncCursor, batchSize: number) => Promise<DeltaSyncResult<T>>,
    options: { batchSize?: number } = {}
  ): Promise<T[]> {
    const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    const allItems: T[] = [];
    let cursor = this.getCursor(collection);

    // Fetch all pages
    while (true) {
      const result = await fetcher(cursor, batchSize);
      allItems.push(...result.items);

      // Update cursor
      this.updateCursor(result.nextCursor);
      cursor = result.nextCursor;

      if (!result.hasMore) {
        break;
      }
    }

    return allItems;
  }

  resetCursor(collection: string): void {
    this.cursors.delete(collection);
    this.saveCursors();
  }
}

// Example API fetcher implementation
async function fetchTodosDelta(
  cursor: SyncCursor,
  batchSize: number
): Promise<DeltaSyncResult<Todo>> {
  const params = new URLSearchParams({
    since: cursor.lastSyncTimestamp.toString(),
    limit: batchSize.toString(),
    ...(cursor.lastServerId && { after: cursor.lastServerId }),
  });

  const response = await fetch(`/api/todos/sync?${params}`);

  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status}`);
  }

  const data = await response.json();

  return {
    items: data.items,
    hasMore: data.hasMore,
    serverTimestamp: data.serverTimestamp,
    nextCursor: {
      collection: 'todos',
      lastSyncTimestamp: data.serverTimestamp,
      lastServerId: data.items.length > 0
        ? data.items[data.items.length - 1].id
        : cursor.lastServerId,
    },
  };
}

export { DeltaSyncManager, fetchTodosDelta };
export type { SyncCursor, DeltaSyncResult };
```

**Why good:** Only fetches changes since last sync (efficient), paginated for large datasets, cursor persistence survives app restarts

---

## Pattern 23: Background Sync with Service Worker

Queue sync operations for reliable background execution.

```typescript
// service-worker/sync-handler.ts
// This code runs in the service worker context

interface SyncTag {
  tag: string;
  collection: string;
}

const SYNC_TAG_PREFIX = 'sync-';

// Register for background sync
async function registerBackgroundSync(collection: string): Promise<void> {
  if (!('sync' in self.registration)) {
    console.warn('Background sync not supported');
    return;
  }

  const tag = `${SYNC_TAG_PREFIX}${collection}`;

  try {
    await self.registration.sync.register(tag);
    console.log(`Background sync registered: ${tag}`);
  } catch (error) {
    console.error('Failed to register background sync:', error);
  }
}

// Handle sync event in service worker
self.addEventListener('sync', (event: SyncEvent) => {
  if (!event.tag.startsWith(SYNC_TAG_PREFIX)) return;

  const collection = event.tag.slice(SYNC_TAG_PREFIX.length);

  event.waitUntil(
    processSyncQueue(collection).catch(error => {
      console.error(`Background sync failed for ${collection}:`, error);
      // Return rejected promise to retry
      throw error;
    })
  );
});

async function processSyncQueue(collection: string): Promise<void> {
  // Open IndexedDB from service worker
  const db = await openDatabase();

  // Get pending operations for this collection
  const operations = await db.getAll('syncQueue');
  const collectionOps = operations.filter(op => op.collection === collection);

  // Process each operation
  for (const op of collectionOps) {
    try {
      await executeOperation(op);
      await db.delete('syncQueue', op.id);
    } catch (error) {
      // Update retry count
      await db.put('syncQueue', {
        ...op,
        retryCount: op.retryCount + 1,
        lastError: error instanceof Error ? error.message : 'Unknown',
      });

      // Re-throw to signal failure to sync manager
      if (op.retryCount >= 4) {
        // Max retries exceeded - leave in queue for manual handling
        continue;
      }
      throw error;
    }
  }
}

async function executeOperation(op: QueuedOperation): Promise<void> {
  const methods: Record<string, string> = {
    CREATE: 'POST',
    UPDATE: 'PUT',
    DELETE: 'DELETE',
    UPSERT: 'PUT',
  };

  const response = await fetch(`/api/${op.collection}`, {
    method: methods[op.type],
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(op.data),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

// Export for TypeScript (self.registration.sync types)
declare global {
  interface ServiceWorkerRegistration {
    readonly sync: SyncManager;
  }

  interface SyncManager {
    register(tag: string): Promise<void>;
  }

  interface SyncEvent extends ExtendableEvent {
    readonly tag: string;
  }
}

export { registerBackgroundSync };
```

### Client-Side Registration

```typescript
// client/register-sync.ts

async function requestSyncWhenOnline(collection: string): Promise<void> {
  if (!navigator.onLine) {
    // Will sync when online via background sync
    return;
  }

  // If online, trigger immediate sync
  const registration = await navigator.serviceWorker.ready;

  if ('sync' in registration) {
    await registration.sync.register(`sync-${collection}`);
  } else {
    // Fallback: sync immediately without service worker
    await syncCollection(collection);
  }
}

export { requestSyncWhenOnline };
```

**Why good:** Sync continues even if app is closed, browser retries automatically on failure, queue persisted in IndexedDB, graceful fallback

---

## Pattern 24: Pull-Push Sync Strategy

Full bidirectional sync with server as source of truth for conflicts.

```typescript
// sync/pull-push-sync.ts

interface SyncResult {
  uploaded: number;
  downloaded: number;
  conflicts: number;
  errors: string[];
}

// Named constants
const SYNC_BATCH_SIZE = 50;

class PullPushSync<T extends SyncableEntity> {
  constructor(
    private readonly localDb: LocalTable<T>,
    private readonly apiEndpoint: string,
    private readonly conflictResolver: ConflictResolver<T>
  ) {}

  async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      uploaded: 0,
      downloaded: 0,
      conflicts: 0,
      errors: [],
    };

    try {
      // Step 1: Pull - fetch server changes first
      const serverChanges = await this.pull();
      result.downloaded = serverChanges.length;

      // Step 2: Merge - apply server changes, detect conflicts
      const conflicts = await this.merge(serverChanges);
      result.conflicts = conflicts.length;

      // Step 3: Push - upload local changes
      const uploaded = await this.push();
      result.uploaded = uploaded;
    } catch (error) {
      result.errors.push(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    return result;
  }

  private async pull(): Promise<T[]> {
    // Get last sync timestamp
    const lastSync = await this.getLastSyncTimestamp();

    const response = await fetch(
      `${this.apiEndpoint}/changes?since=${lastSync}`
    );

    if (!response.ok) {
      throw new Error(`Pull failed: ${response.status}`);
    }

    const data = await response.json();
    return data.items as T[];
  }

  private async merge(serverItems: T[]): Promise<T[]> {
    const conflicts: T[] = [];

    for (const serverItem of serverItems) {
      const localItem = await this.localDb.get(serverItem.id);

      if (!localItem) {
        // New item from server
        await this.localDb.put({
          ...serverItem,
          _syncStatus: 'synced',
        });
        continue;
      }

      if (localItem._syncStatus === 'synced') {
        // No local changes - just update
        await this.localDb.put({
          ...serverItem,
          _syncStatus: 'synced',
        });
        continue;
      }

      // Local has changes - check for conflict
      if (serverItem._serverVersion !== localItem._serverVersion) {
        // True conflict - both changed
        const resolved = await this.conflictResolver.resolve(
          localItem,
          serverItem
        );

        if (resolved) {
          await this.localDb.put(resolved);
        } else {
          // Mark as conflicted for manual resolution
          await this.localDb.put({
            ...localItem,
            _syncStatus: 'conflicted',
          });
          conflicts.push(localItem);
        }
      } else {
        // Server version matches - local changes are newer
        // Keep local, will push in next step
      }
    }

    return conflicts;
  }

  private async push(): Promise<number> {
    const pendingItems = await this.localDb.getByStatus('pending');
    let uploaded = 0;

    // Batch uploads
    for (let i = 0; i < pendingItems.length; i += SYNC_BATCH_SIZE) {
      const batch = pendingItems.slice(i, i + SYNC_BATCH_SIZE);

      const response = await fetch(`${this.apiEndpoint}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batch }),
      });

      if (!response.ok) {
        throw new Error(`Push failed: ${response.status}`);
      }

      const result = await response.json();

      // Update local items with server versions
      for (const item of result.items) {
        await this.localDb.put({
          ...item,
          _syncStatus: 'synced',
        });
        uploaded++;
      }
    }

    return uploaded;
  }

  private async getLastSyncTimestamp(): Promise<number> {
    const key = `lastSync:${this.apiEndpoint}`;
    const stored = localStorage.getItem(key);
    return stored ? parseInt(stored, 10) : 0;
  }
}

export { PullPushSync };
export type { SyncResult };
```

**Why good:** Full bidirectional sync, batched uploads for efficiency, clear conflict handling, preserves both versions for manual resolution

---

## Pattern 25: Sync Status Indicators

Visual feedback for sync state at both entity and app levels.

```tsx
// components/sync-status-indicator.tsx

type EntitySyncStatus = 'synced' | 'pending' | 'conflicted' | 'error';

interface EntitySyncIndicatorProps {
  status: EntitySyncStatus;
  lastSynced?: number;
  size?: 'sm' | 'md';
}

function EntitySyncIndicator({
  status,
  lastSynced,
  size = 'sm',
}: EntitySyncIndicatorProps) {
  const labels: Record<EntitySyncStatus, string> = {
    synced: 'Synced',
    pending: 'Saving...',
    conflicted: 'Conflict detected',
    error: 'Sync failed',
  };

  const icons: Record<EntitySyncStatus, string> = {
    synced: '✓',
    pending: '↻',
    conflicted: '⚠',
    error: '✕',
  };

  return (
    <span
      role="status"
      aria-label={labels[status]}
      data-sync-status={status}
      data-size={size}
      title={
        lastSynced
          ? `Last synced: ${new Date(lastSynced).toLocaleString()}`
          : undefined
      }
    >
      <span aria-hidden="true">{icons[status]}</span>
      {status === 'pending' && (
        <span className="sr-only">Saving changes...</span>
      )}
    </span>
  );
}

// App-level sync indicator
interface AppSyncStatusProps {
  isOnline: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  onForceSync?: () => void;
  isSyncing?: boolean;
}

function AppSyncStatus({
  isOnline,
  pendingCount,
  lastSyncTime,
  onForceSync,
  isSyncing = false,
}: AppSyncStatusProps) {
  return (
    <div role="status" aria-live="polite" data-testid="app-sync-status">
      {!isOnline ? (
        <span data-status="offline">
          <span aria-hidden="true">●</span>
          Offline - changes saved locally
        </span>
      ) : pendingCount > 0 ? (
        <span data-status="syncing">
          <span aria-hidden="true">↻</span>
          {isSyncing ? 'Syncing...' : `${pendingCount} changes pending`}
        </span>
      ) : (
        <span data-status="synced">
          <span aria-hidden="true">✓</span>
          All changes synced
          {lastSyncTime && (
            <time dateTime={new Date(lastSyncTime).toISOString()}>
              {formatRelativeTime(lastSyncTime)}
            </time>
          )}
        </span>
      )}

      {isOnline && pendingCount > 0 && !isSyncing && onForceSync && (
        <button
          type="button"
          onClick={onForceSync}
          aria-label="Sync now"
        >
          Sync now
        </button>
      )}
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const diff = timestamp - Date.now();
  const diffMinutes = Math.round(diff / 60000);
  const diffHours = Math.round(diff / 3600000);
  const diffDays = Math.round(diff / 86400000);

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute');
  }
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  }
  return rtf.format(diffDays, 'day');
}

export { EntitySyncIndicator, AppSyncStatus };
export type { EntitySyncStatus, EntitySyncIndicatorProps, AppSyncStatusProps };
```

**Why good:** Semantic data attributes for styling, accessible labels, relative time formatting, force sync option for users
