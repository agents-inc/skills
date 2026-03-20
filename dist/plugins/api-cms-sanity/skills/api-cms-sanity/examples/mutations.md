# Sanity Mutations & Real-Time Examples

> Create, patch, delete, transactions, and real-time listeners. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for client setup.

**Prerequisites**: Understand client setup from core examples first. Mutations require a client configured with `useCdn: false` and a write-capable API token.

---

## Pattern 1: Creating Documents

### Good Example — Create with Type Safety

```typescript
import { client } from "../lib/sanity-client";

// create() auto-generates _id if not provided
const newPost = await client.create({
  _type: "post",
  title: "New Blog Post",
  slug: { _type: "slug", current: "new-blog-post" },
  published: false,
  publishedAt: new Date().toISOString(),
});
// newPost._id is the auto-generated document ID

// createIfNotExists() — only creates if _id doesn't exist
await client.createIfNotExists({
  _id: "singleton-site-settings",
  _type: "siteSettings",
  title: "My Site",
});

// createOrReplace() — overwrites entirely if document exists
await client.createOrReplace({
  _id: "singleton-site-settings",
  _type: "siteSettings",
  title: "Updated Site Title",
  description: "New description",
});
```

**Why good:** `create()` for new documents with auto-generated IDs, `createIfNotExists()` for idempotent initialization, `createOrReplace()` for singletons that should always reflect the latest state, slug includes `_type: "slug"` as required by the schema

### Bad Example — Create with Existing ID

```typescript
// BAD: create() with an _id that already exists will error
await client.create({
  _id: "existing-doc-id",
  _type: "post",
  title: "This will fail",
});
```

**Why bad:** `create()` fails if a document with the given `_id` already exists — use `createOrReplace()` or `createIfNotExists()` for idempotent operations

---

## Pattern 2: Patching Documents

### Good Example — Various Patch Operations

```typescript
// Set fields
await client
  .patch("post-123")
  .set({
    title: "Updated Title",
    published: true,
    publishedAt: new Date().toISOString(),
  })
  .commit();

// Unset (remove) fields
await client.patch("post-123").unset(["temporaryFlag", "draftNotes"]).commit();

// Increment/decrement numeric fields
await client.patch("post-123").inc({ viewCount: 1 }).commit();
await client.patch("post-123").dec({ remainingSlots: 1 }).commit();

// Insert into an array at a specific position
await client
  .patch("post-123")
  .insert("after", "tags[-1]", [
    { _key: crypto.randomUUID(), label: "typescript" },
  ])
  .commit();

// Append to end of array
await client
  .patch("post-123")
  .append("tags", [{ _key: crypto.randomUUID(), label: "new-tag" }])
  .commit();

// Chain multiple patch operations
await client
  .patch("post-123")
  .set({ title: "New Title" })
  .inc({ revisionCount: 1 })
  .commit();
```

**Why good:** `.commit()` always called to send the mutation, `_key` included on array items (required by Sanity), `crypto.randomUUID()` generates unique keys, multiple operations chained in a single patch

### Bad Example — Missing commit()

```typescript
// BAD: Patch without .commit() does nothing!
client.patch("post-123").set({ title: "This is never sent" });
// No network request made — mutation is discarded
```

**Why bad:** Without `.commit()`, the patch is constructed but never sent to the API — this is a silent no-op

---

## Pattern 3: Deleting Documents

### Good Example — Delete by ID

```typescript
// Delete a single document
await client.delete("post-123");

// Delete with specific options
await client.delete("post-123", {
  visibility: "async", // Return immediately, sync in background
});
```

**Why good:** Simple single-document deletion by ID, `visibility` option controls when the request returns

---

## Pattern 4: Transactions (Atomic Multi-Mutation)

### Good Example — Grouped Mutations

```typescript
// All mutations in a transaction succeed or fail together
await client
  .transaction()
  .create({
    _type: "activityLog",
    action: "archived",
    documentId: "post-123",
    timestamp: new Date().toISOString(),
  })
  .patch("post-123", (p) =>
    p.set({ archived: true, archivedAt: new Date().toISOString() }),
  )
  .commit();

// Transaction with multiple deletes
const idsToDelete = ["post-1", "post-2", "post-3"];
const tx = client.transaction();
for (const id of idsToDelete) {
  tx.delete(id);
}
await tx.commit();
```

**Why good:** Transaction ensures atomicity (both log creation and archival happen or neither does), callback style for patch within transaction, batch deletes in a single atomic operation

---

## Pattern 5: Mutation Visibility Options

### Good Example — Controlling Write Consistency

```typescript
// sync (default): Waits for mutation to be committed AND indexed
// Queries immediately see the change
await client.create(doc, { visibility: "sync" });

// async: Returns after commit, indexes in background
// Faster response, but queries may not reflect the change immediately
await client.create(doc, { visibility: "async" });

// Dry run: Validates without applying
const result = await client.create(doc, { dryRun: true });
// Useful for validating mutations before executing them
```

**Why good:** `sync` for consistency-critical operations (user sees their own change), `async` for bulk operations where speed matters, `dryRun` for validation without side effects

---

## Pattern 6: Real-Time Listeners

### Good Example — Subscribe to Document Changes

```typescript
// Listen for changes to published posts
const LISTENER_QUERY = `*[_type == "post" && published == true]`;

const subscription = client.listen(LISTENER_QUERY).subscribe({
  next: (update) => {
    if (update.type === "mutation") {
      const { documentId, transition, result } = update;
      // transition: 'update' | 'appear' | 'disappear'

      switch (transition) {
        case "appear":
          // Document now matches the filter (new or newly matching)
          console.log(`New post appeared: ${documentId}`);
          break;
        case "update":
          // Existing matching document was modified
          console.log(`Post updated: ${documentId}`);
          break;
        case "disappear":
          // Document no longer matches the filter (deleted or no longer matching)
          console.log(`Post disappeared: ${documentId}`);
          break;
      }
    }
  },
  error: (err) => {
    console.error("Listener error:", err.message);
  },
});

// Cleanup: always unsubscribe when done
subscription.unsubscribe();
```

**Why good:** Observable-based subscription with error handling, `transition` field indicates what happened, cleanup via `unsubscribe()` prevents connection leaks, GROQ filter scopes to relevant documents

### Good Example — Listener with Options

```typescript
// Listen with include options
const subscription = client
  .listen(
    `*[_type == "post"]`,
    {}, // No parameters for this query
    {
      includeResult: true, // Include the full document in the event
      includePreviousRevision: false, // Don't include the previous version
      visibility: "query", // Only fire when the change is queryable
    },
  )
  .subscribe({
    next: (update) => {
      if (update.type === "mutation" && update.result) {
        // update.result contains the full document
        console.log("Updated document:", update.result.title);
      }
    },
    error: (err) => console.error(err),
  });
```

**Why good:** `includeResult: true` gives the full document without a separate fetch, `visibility: "query"` ensures the event fires only when the change is visible to queries (consistent state)

### Important Caveats

- **Projections are ignored** — `client.listen()` only uses the filter portion of a GROQ query. Projections, ordering, and slicing have no effect.
- **Reconnection** — The listener automatically reconnects on disconnection, but events during the gap may be missed. For critical use cases, combine with periodic re-fetching.
- **For production frontends** — Evaluate the newer Sanity Live Content API as a simpler alternative to raw listeners.

---

_For client setup and GROQ, see [core.md](core.md). For schema definitions, see [schemas.md](schemas.md). For Portable Text and images, see [rich-content.md](rich-content.md)._
