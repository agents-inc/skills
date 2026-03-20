# Weaviate -- Multi-Tenancy & Batch Examples

> Tenant management, batch imports, and cross-references. See [core.md](core.md) for connection and collection setup.

**Related examples:**

- [core.md](core.md) -- Connection, collection setup, object CRUD
- [search.md](search.md) -- nearText, nearVector, hybrid, bm25, filters, generative search

---

## Pattern 1: Enable Multi-Tenancy

Multi-tenancy must be enabled at collection creation time.

```typescript
import weaviate from "weaviate-client";
import { vectors, dataType } from "weaviate-client";

await client.collections.create({
  name: "CustomerDocument",
  multiTenancy: weaviate.configure.multiTenancy({
    enabled: true,
    autoTenantCreation: true, // Create tenants on first insert
  }),
  vectorizers: vectors.text2VecOpenAI(),
  properties: [
    { name: "title", dataType: dataType.TEXT },
    { name: "content", dataType: dataType.TEXT },
    { name: "docType", dataType: dataType.TEXT },
  ],
});
```

**Why good:** `autoTenantCreation: true` avoids manual tenant creation before inserts, useful for dynamic SaaS applications

```typescript
// Bad Example -- Querying multi-tenant collection without tenant context
const docs = client.collections.use("CustomerDocument");
const result = await docs.query.fetchObjects({ limit: 10 });
// FAILS: multi-tenant collection requires .withTenant()
```

**Why bad:** All operations on multi-tenant collections require `.withTenant()` -- queries without tenant context throw an error

---

## Pattern 2: Tenant Lifecycle Management

```typescript
const docs = client.collections.use("CustomerDocument");

// Create tenants manually
await docs.tenants.create([
  { name: "tenant-acme" },
  { name: "tenant-globex" },
  { name: "tenant-initech" },
]);

// List all tenants
const allTenants = await docs.tenants.get();
console.log("Tenants:", Object.keys(allTenants));

// Get specific tenants
const specific = await docs.tenants.getByNames([
  "tenant-acme",
  "tenant-globex",
]);
console.log(specific);

// Get single tenant
const acme = await docs.tenants.getByName("tenant-acme");
console.log(acme);

// Remove tenants (non-existent names are silently ignored)
await docs.tenants.remove([
  { name: "tenant-initech" },
  { name: "tenant-nonexistent" }, // Ignored
]);
```

---

## Pattern 3: Tenant State Management

Deactivate tenants to free memory, reactivate when needed.

```typescript
const docs = client.collections.use("CustomerDocument");

// Deactivate tenant (data stays on disk, freed from memory)
await docs.tenants.update({
  name: "tenant-acme",
  activityStatus: "INACTIVE",
});

// Offload tenant to cold storage (cloud deployments only)
await docs.tenants.update({
  name: "tenant-globex",
  activityStatus: "OFFLOADED",
});

// Reactivate tenant before querying
await docs.tenants.update({
  name: "tenant-acme",
  activityStatus: "ACTIVE",
});

// Now queries work again
const acmeDocs = docs.withTenant("tenant-acme");
const result = await acmeDocs.query.fetchObjects({ limit: 10 });
```

**Why good:** Tenant states manage memory for large multi-tenant deployments -- inactive tenants consume no memory

### Auto-Tenant Activation

```typescript
import weaviate from "weaviate-client";

// Enable auto-activation so queries automatically activate inactive tenants
const docs = client.collections.use("CustomerDocument");
await docs.config.update({
  multiTenancy: weaviate.reconfigure.multiTenancy({
    autoTenantActivation: true,
  }),
});
```

---

## Pattern 4: Multi-Tenant CRUD Operations

All data operations require tenant context via `.withTenant()`.

```typescript
const docs = client.collections.use("CustomerDocument");
const acmeDocs = docs.withTenant("tenant-acme");

// Insert
const uuid = await acmeDocs.data.insert({
  title: "Q3 Report",
  content: "Revenue increased by 15%...",
  docType: "report",
});

// Query
const result = await acmeDocs.query.nearText("quarterly revenue", {
  limit: 5,
  returnMetadata: ["distance"],
});

// Update
await acmeDocs.data.update({
  id: uuid,
  properties: { docType: "financial-report" },
});

// Delete
await acmeDocs.data.deleteById(uuid);

// Delete many
await acmeDocs.data.deleteMany(
  acmeDocs.filter.byProperty("docType").equal("draft"),
);
```

---

## Pattern 5: Batch Import with insertMany

Use `insertMany` for bulk data loading. Always check for errors -- partial failures are silent.

```typescript
const articles = client.collections.use("Article");
const BATCH_SIZE = 100;

interface ArticleData {
  title: string;
  body: string;
  category: string;
}

async function batchImport(
  collection: ReturnType<typeof client.collections.use>,
  data: ArticleData[],
) {
  // Process in chunks to avoid memory pressure
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const chunk = data.slice(i, i + BATCH_SIZE);

    const response = await collection.data.insertMany(chunk);

    // CRITICAL: Check for partial failures
    if (response.hasErrors) {
      for (const err of Object.values(response.errors)) {
        console.error(`Insert error at index ${err.index}:`, err.message);
      }
      throw new Error(
        `Batch insert failed with ${Object.keys(response.errors).length} errors`,
      );
    }

    console.log(
      `Imported ${Math.min(i + BATCH_SIZE, data.length)}/${data.length}`,
    );
  }
}

export { batchImport };
```

**Why good:** Chunked processing avoids memory pressure for large datasets, `hasErrors` check catches partial failures that would otherwise be silent

```typescript
// Bad Example -- Ignoring insertMany errors
const response = await articles.data.insertMany(largeDataset);
// response.hasErrors might be true, but we never check
// Some objects silently failed to insert
```

**Why bad:** `insertMany` can partially fail -- some objects insert, some don't. Without checking `hasErrors`, you have incomplete data

---

## Pattern 6: Batch Import with Deterministic IDs

Use `generateUuid5` for idempotent imports -- safe to retry without duplicates.

```typescript
import { generateUuid5 } from "weaviate-client";

const COLLECTION_NAME = "Article";

function prepareObjects(data: ArticleData[]) {
  return data.map((item) => ({
    properties: item,
    id: generateUuid5(COLLECTION_NAME, item.title), // Deterministic UUID from title
  }));
}

const articles = client.collections.use(COLLECTION_NAME);
const objects = prepareObjects(rawData);
const response = await articles.data.insertMany(objects);

if (response.hasErrors) {
  // Objects with duplicate IDs will fail -- expected on retry
  const realErrors = Object.values(response.errors).filter(
    (err) => !err.message.includes("already exists"),
  );
  if (realErrors.length > 0) {
    throw new Error(`Import failed: ${realErrors.length} non-duplicate errors`);
  }
}
```

**Why good:** Deterministic IDs make imports idempotent, filtering "already exists" errors enables safe retries

---

## Pattern 7: Batch Import with Custom Vectors

```typescript
const products = client.collections.use("Product");
const BATCH_SIZE = 100;

interface ProductWithEmbedding {
  properties: { title: string; description: string; price: number };
  vectors: number[];
}

async function importWithVectors(data: ProductWithEmbedding[]) {
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const chunk = data.slice(i, i + BATCH_SIZE);
    const response = await products.data.insertMany(chunk);

    if (response.hasErrors) {
      console.error("Batch errors:", response.errors);
      throw new Error("Import with vectors failed");
    }
  }
}
```

### Named Vectors in Batch

```typescript
const multiVectorObjects = data.map((item) => ({
  properties: { title: item.title, description: item.description },
  vectors: {
    title_vector: item.titleEmbedding,
    description_vector: item.descEmbedding,
  },
}));

await products.data.insertMany(multiVectorObjects);
```

---

## Pattern 8: Cross-References

Link objects across collections. Requires adding a reference property to the collection.

```typescript
import { dataType } from "weaviate-client";

// Create collections
await client.collections.create({
  name: "Author",
  vectorizers: vectors.text2VecOpenAI(),
  properties: [
    { name: "name", dataType: dataType.TEXT },
    { name: "bio", dataType: dataType.TEXT },
  ],
});

await client.collections.create({
  name: "Article",
  vectorizers: vectors.text2VecOpenAI(),
  properties: [
    { name: "title", dataType: dataType.TEXT },
    { name: "body", dataType: dataType.TEXT },
  ],
});

// Add cross-reference property
const articles = client.collections.use("Article");
await articles.config.addReference({
  name: "writtenBy",
  targetCollection: "Author",
});
```

### Create and Query References

```typescript
const authors = client.collections.use("Author");
const articles = client.collections.use("Article");

// Insert an author
const authorId = await authors.data.insert({
  name: "Jane Smith",
  bio: "AI researcher and writer",
});

// Insert an article with reference
const articleId = await articles.data.insert({
  properties: { title: "AI Ethics", body: "..." },
  references: { writtenBy: authorId },
});

// OR add reference after creation
await articles.data.referenceAdd({
  fromUuid: articleId,
  fromProperty: "writtenBy",
  to: authorId,
});

// Query with resolved references
const result = await articles.query.fetchObjects({
  limit: 5,
  returnReferences: [
    {
      linkOn: "writtenBy",
      returnProperties: ["name", "bio"],
    },
  ],
});

for (const obj of result.objects) {
  console.log("Article:", obj.properties.title);
  console.log(
    "Author:",
    obj.references?.writtenBy?.objects[0]?.properties.name,
  );
}
```

### Replace and Delete References

```typescript
// Replace all references on a property
await articles.data.referenceReplace({
  fromUuid: articleId,
  fromProperty: "writtenBy",
  to: [newAuthorId], // Replaces all existing references
});

// Delete specific reference
await articles.data.referenceDelete({
  fromUuid: articleId,
  fromProperty: "writtenBy",
  to: authorId,
});
```

---

## Pattern 9: Multi-Tenant Cross-References

Cross-references in multi-tenant collections can only point to objects in the same tenant or in non-multi-tenant collections.

```typescript
const tenantDocs = docs.withTenant("tenant-acme");

// Add reference property
await docs.config.addReference({
  name: "hasCategory",
  targetCollection: "Category", // Non-multi-tenant collection
});

// Create cross-reference
await tenantDocs.data.referenceAdd({
  fromUuid: documentId,
  fromProperty: "hasCategory",
  to: categoryId, // Category object in non-MT collection
});
```

**Why good:** Non-multi-tenant reference targets work across all tenants (shared lookup data)

```typescript
// Bad Example -- Cross-tenant reference
const acmeDocs = docs.withTenant("tenant-acme");
await acmeDocs.data.referenceAdd({
  fromUuid: acmeDocId,
  fromProperty: "relatedDoc",
  to: globexDocId, // Object in tenant-globex -- FAILS
});
```

**Why bad:** Multi-tenant cross-references cannot span tenants -- only same-tenant or non-multi-tenant targets

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
