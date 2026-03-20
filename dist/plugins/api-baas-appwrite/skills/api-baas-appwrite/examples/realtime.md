# Appwrite Realtime Examples

> Channel subscriptions, event filtering, cleanup patterns. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Subscribe to Table Changes

### Good Example — Listen for Row Events

```typescript
import { Realtime, Channel } from "appwrite";

const DATABASE_ID = "main";
const MESSAGES_TABLE = "messages";

// Subscribe to all changes on a table
const subscription = await realtime.subscribe(
  Channel.tablesdb(DATABASE_ID).table(MESSAGES_TABLE),
  (response) => {
    const events = response.events;

    if (events.includes("tablesdb.*.tables.*.rows.*.create")) {
      handleNewMessage(response.payload);
    }

    if (events.includes("tablesdb.*.tables.*.rows.*.update")) {
      handleUpdatedMessage(response.payload);
    }

    if (events.includes("tablesdb.*.tables.*.rows.*.delete")) {
      handleDeletedMessage(response.payload);
    }
  },
);

function handleNewMessage(payload: unknown) {
  // Add new message to UI
}

function handleUpdatedMessage(payload: unknown) {
  // Update existing message in UI
}

function handleDeletedMessage(payload: unknown) {
  // Remove message from UI
}

// IMPORTANT: Always clean up when done
await subscription.close();
```

**Why good:** `Channel` helper for type-safe channel construction, event string matching to filter by operation type, separate handlers per event, explicit cleanup with `subscription.close()`

### Bad Example — Not Unsubscribing

```typescript
// BAD: Subscription leaks — never closed
realtime.subscribe(
  Channel.tablesdb(DATABASE_ID).table(MESSAGES_TABLE),
  (response) => {
    console.log(response);
  },
);
// No reference saved — cannot unsubscribe
// WebSocket stays open indefinitely
```

**Why bad:** No reference to the subscription means you cannot close it, leaked subscriptions cause duplicate events and memory issues, each new subscribe without closing the old one tears down and recreates the WebSocket

---

## Pattern 2: Subscribe to a Specific Row

### Good Example — Single Row Updates

```typescript
const DATABASE_ID = "main";
const ORDERS_TABLE = "orders";

async function watchOrder(orderId: string, onUpdate: (order: unknown) => void) {
  const subscription = await realtime.subscribe(
    Channel.tablesdb(DATABASE_ID).table(ORDERS_TABLE).row(orderId),
    (response) => {
      onUpdate(response.payload);
    },
  );

  // Return cleanup function
  return () => subscription.close();
}

// Usage
const cleanup = await watchOrder("order-123", (order) => {
  console.log("Order updated:", order);
});

// When done watching
await cleanup();
```

**Why good:** Subscribes to a single row (not entire table), callback pattern decouples realtime from UI, returns cleanup function for lifecycle management

**When to use:** Order status tracking, live document editing, real-time form collaboration. More efficient than table-wide subscriptions when you only care about one row.

---

## Pattern 3: Subscribe to File Events

### Good Example — Watch for Uploads

```typescript
const subscription = await realtime.subscribe(Channel.files(), (response) => {
  if (response.events.includes("buckets.*.files.*.create")) {
    console.log("New file uploaded:", response.payload);
  }
});
```

**Why good:** `Channel.files()` subscribes to all file events across all buckets, event filtering narrows to create events only

---

## Pattern 4: Subscribe to Account Events

### Good Example — User Session Changes

```typescript
const subscription = await realtime.subscribe(Channel.account(), (response) => {
  const events = response.events;

  if (events.some((e) => e.includes("sessions.*.create"))) {
    console.log("New session created");
  }

  if (events.some((e) => e.includes("sessions.*.delete"))) {
    console.log("Session ended — user may have signed out");
    // Redirect to login or refresh auth state
  }
});
```

**Why good:** `Channel.account()` tracks session and account changes, useful for detecting sign-out from another tab/device

---

## Pattern 5: Multiple Channel Subscriptions

### Good Example — Subscribe to Multiple Channels

```typescript
const DATABASE_ID = "main";
const MESSAGES_TABLE = "messages";
const USERS_TABLE = "users";

const subscription = await realtime.subscribe(
  [
    Channel.tablesdb(DATABASE_ID).table(MESSAGES_TABLE),
    Channel.tablesdb(DATABASE_ID).table(USERS_TABLE),
    Channel.account(),
  ],
  (response) => {
    // Check which channel the event came from
    if (response.events.some((e) => e.includes("messages"))) {
      handleMessageEvent(response);
    } else if (response.events.some((e) => e.includes("users"))) {
      handleUserEvent(response);
    } else {
      handleAccountEvent(response);
    }
  },
);
```

**Why good:** Single subscription for multiple channels (single WebSocket), event string inspection to route to correct handler, more efficient than multiple separate subscriptions (avoids WebSocket reconnection)

---

## Pattern 6: Realtime with Query Filtering

### Good Example — Server-Side Event Filtering

```typescript
import { Query } from "appwrite";

const DATABASE_ID = "main";
const MESSAGES_TABLE = "messages";
const ROOM_ID = "room-123";

// Subscribe with query filters — events are filtered server-side
const subscription = await realtime.subscribe(
  Channel.tablesdb(DATABASE_ID).table(MESSAGES_TABLE),
  (response) => {
    // Only receives events matching the query
    console.log("Message in room:", response.payload);
  },
  [Query.equal("roomId", ROOM_ID)],
);
```

**Why good:** Server-side filtering reduces unnecessary events to the client, `Query.equal` narrows to a specific room, less client-side processing needed

**When to use:** Chat rooms, filtered dashboards, multi-tenant apps where you only need events for a subset of rows.

---

_For database patterns, see [core.md](core.md). For auth patterns, see [auth.md](auth.md). For storage, see [storage.md](storage.md)._
