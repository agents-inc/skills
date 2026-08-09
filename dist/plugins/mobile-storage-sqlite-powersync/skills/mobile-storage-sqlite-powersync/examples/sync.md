# SQLite + PowerSync - Sync Patterns

> Backend connectors, sync rules, and conflict resolution. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

**Related:** [core.md](core.md) for schema and database setup.

---

## Pattern 6: Backend Connector (Generic)

The connector interface requires two methods: `fetchCredentials()` for authentication and `uploadData()` for pushing local changes to your backend.

```typescript
import type {
  PowerSyncBackendConnector,
  PowerSyncCredentials,
  AbstractPowerSyncDatabase,
} from "@powersync/react-native";

const POWERSYNC_URL = "https://your-instance.powersync.journeyapps.com";

export const connector: PowerSyncBackendConnector = {
  fetchCredentials: async (): Promise<PowerSyncCredentials> => {
    // Get auth token from your authentication provider
    const session = await getAuthSession();

    if (!session) {
      throw new Error("Not authenticated");
    }

    return {
      endpoint: POWERSYNC_URL,
      token: session.accessToken,
      expiresAt: session.expiresAt
        ? new Date(session.expiresAt * 1000)
        : undefined,
    };
  },

  uploadData: async (database: AbstractPowerSyncDatabase): Promise<void> => {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        await sendOperationToBackend(op);
      }
      // Mark transaction as successfully uploaded
      await transaction.complete();
    } catch (error) {
      // Transaction will be retried after a delay (default: 5 seconds)
      throw error;
    }
  },
};
```

**Why good:** Clean separation of auth and upload logic, transaction-based processing, unhandled errors trigger automatic retries

**Gotcha:** `fetchCredentials()` is cached by the SDK and only called when credentials expire or on initial connect. Don't put side effects here.

---

## Pattern 7: Supabase Backend Connector

A complete connector for Supabase, the most common PowerSync backend.

```typescript
import type {
  PowerSyncBackendConnector,
  PowerSyncCredentials,
  AbstractPowerSyncDatabase,
  CrudEntry,
} from "@powersync/react-native";
import { UpdateType } from "@powersync/react-native";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-key";
const POWERSYNC_URL = "https://your-instance.powersync.journeyapps.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function applyOperation(op: CrudEntry): Promise<void> {
  const table = supabase.from(op.table);

  switch (op.op) {
    case UpdateType.PUT: {
      // PUT = full row upsert (insert or replace)
      const record = { ...op.opData, id: op.id };
      const { error } = await table.upsert(record);
      if (error) throw new Error(`PUT failed on ${op.table}: ${error.message}`);
      break;
    }
    case UpdateType.PATCH: {
      // PATCH = partial update (only changed fields)
      const { error } = await table.update(op.opData).eq("id", op.id);
      if (error)
        throw new Error(`PATCH failed on ${op.table}: ${error.message}`);
      break;
    }
    case UpdateType.DELETE: {
      const { error } = await table.delete().eq("id", op.id);
      if (error)
        throw new Error(`DELETE failed on ${op.table}: ${error.message}`);
      break;
    }
  }
}

export const supabaseConnector: PowerSyncBackendConnector = {
  fetchCredentials: async (): Promise<PowerSyncCredentials> => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw new Error(`Auth failed: ${error.message}`);
    if (!session) throw new Error("No active session");

    return {
      endpoint: POWERSYNC_URL,
      token: session.access_token,
      expiresAt: session.expires_at
        ? new Date(session.expires_at * 1000)
        : undefined,
    };
  },

  uploadData: async (database: AbstractPowerSyncDatabase): Promise<void> => {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        await applyOperation(op);
      }
      await transaction.complete();
    } catch (error) {
      // Rethrow to trigger retry
      throw error;
    }
  },
};
```

**Why good:** Handles all three operation types (PUT/PATCH/DELETE), maps directly to Supabase PostgREST, errors trigger retries

---

## Pattern 8: Sync Rules (Bucket Definitions)

Sync rules are YAML files configured on the PowerSync Service. They define which data each client receives.

### Per-User Data

```yaml
bucket_definitions:
  user_lists:
    # Parameters determine which buckets are created
    parameters: SELECT request.user_id() as user_id
    # Data queries select rows for each bucket
    data:
      - SELECT * FROM lists WHERE owner_id = bucket.user_id
      - SELECT * FROM todos WHERE list_id IN (
        SELECT id FROM lists WHERE owner_id = bucket.user_id
        )
```

### Global Data (All Clients)

```yaml
bucket_definitions:
  global_config:
    # No parameters = global bucket, synced to everyone
    data:
      - SELECT * FROM app_config
      - SELECT * FROM categories
```

### Multi-Tenant (Organization-Based)

```yaml
bucket_definitions:
  org_data:
    parameters: >
      SELECT org_id FROM org_members
      WHERE user_id = request.user_id()
    data:
      - SELECT * FROM projects WHERE org_id = bucket.org_id
      - SELECT * FROM tasks WHERE project_id IN (
        SELECT id FROM projects WHERE org_id = bucket.org_id
        )
```

### Client Parameters

```yaml
bucket_definitions:
  filtered_data:
    # request.parameters() accesses client-provided params
    parameters: >
      SELECT request.parameters() ->> 'region' as region
    data:
      - SELECT * FROM stores WHERE region = bucket.region
```

Client-side:

```typescript
await powersync.connect(connector, {
  params: { region: "us-west" },
});
```

**Constraints:**

- Maximum 1,000 buckets per client (default, higher on Team/Enterprise plans)
- Table names in data queries must match client-side schema table names
- Only a subset of SQL is supported in sync rules

---

## Pattern 9: Conflict Resolution Strategies

### Default: Last-Write-Wins (via Supabase Upsert)

```typescript
// This is what the default Supabase connector does -- upsert replaces the row
case UpdateType.PUT: {
  const record = { ...op.opData, id: op.id };
  await supabase.from(op.table).upsert(record);
  break;
}
```

**When to use:** Simple apps where the latest write should always win.

### Timestamp-Based Rejection

```typescript
async function applyWithTimestampCheck(op: CrudEntry): Promise<void> {
  if (op.op === UpdateType.PATCH && op.opData) {
    // Fetch current server version
    const { data: serverRow } = await supabase
      .from(op.table)
      .select("updated_at")
      .eq("id", op.id)
      .single();

    // Reject if server is newer
    if (serverRow && op.opData.updated_at < serverRow.updated_at) {
      console.warn(`Stale update rejected for ${op.table}:${op.id}`);
      return; // Skip this operation
    }
  }

  await applyOperation(op);
}
```

**When to use:** When stale writes should be silently dropped.

### Server-Side Business Rule Validation

```typescript
async function applyWithValidation(op: CrudEntry): Promise<void> {
  if (op.table === "orders" && op.op === UpdateType.PATCH) {
    const { data: order } = await supabase
      .from("orders")
      .select("status")
      .eq("id", op.id)
      .single();

    // Prevent modifying shipped orders
    if (order?.status === "shipped") {
      throw new Error(`Cannot modify shipped order ${op.id}`);
    }
  }

  await applyOperation(op);
}
```

**When to use:** Business-critical data with state machine constraints.

### Conflict Recording (User Resolution)

```typescript
async function applyWithConflictRecording(op: CrudEntry): Promise<void> {
  if (op.op !== UpdateType.PATCH) {
    await applyOperation(op);
    return;
  }

  const { data: serverRow } = await supabase
    .from(op.table)
    .select("*")
    .eq("id", op.id)
    .single();

  // If server version differs, record conflict instead of overwriting
  if (serverRow && serverRow.updated_at !== op.opData?.updated_at) {
    await supabase.from("write_conflicts").insert({
      table_name: op.table,
      row_id: op.id,
      client_data: op.opData,
      server_data: serverRow,
      resolved: false,
    });
    return; // Don't apply -- let user resolve
  }

  await applyOperation(op);
}
```

**When to use:** High-stakes data (medical, financial) where losing information is unacceptable.

---

## Pattern 10: Upload Error Handling and Retries

```typescript
const MAX_RETRY_OPERATIONS = 50;

uploadData: async (database: AbstractPowerSyncDatabase): Promise<void> => {
  // Process in batches to avoid overwhelming the backend
  const batch = await database.getCrudBatch(MAX_RETRY_OPERATIONS);
  if (!batch) return;

  const failures: CrudEntry[] = [];

  for (const op of batch.crud) {
    try {
      await applyOperation(op);
    } catch (error) {
      console.error(`Failed to upload ${op.op} on ${op.table}:${op.id}`, error);
      failures.push(op);
    }
  }

  if (failures.length === 0) {
    // All operations succeeded -- mark batch complete
    await batch.complete();
  } else {
    // Some failed -- throw to trigger retry of entire batch
    throw new Error(`${failures.length} operations failed, will retry`);
  }
},
```

**Why good:** Batch processing limits payload size, individual error logging helps debugging, failed batch triggers automatic retry

**Alternative:** Use `getNextCrudTransaction()` instead of `getCrudBatch()` when operations must be applied atomically (all-or-nothing per transaction).
