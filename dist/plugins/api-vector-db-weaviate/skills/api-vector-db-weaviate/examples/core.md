# Weaviate -- Core Patterns

> Connection setup, collection management, object CRUD, and basic queries. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [search.md](search.md) -- nearText, nearVector, hybrid, bm25, filters, generative search (RAG)
- [multi-tenancy.md](multi-tenancy.md) -- Tenant management, batch imports, cross-references

---

## Connection: Weaviate Cloud

```typescript
import weaviate from "weaviate-client";

const QUERY_TIMEOUT_SECONDS = 30;
const INSERT_TIMEOUT_SECONDS = 120;
const INIT_TIMEOUT_SECONDS = 5;

async function createCloudClient() {
  const url = process.env.WEAVIATE_URL;
  const apiKey = process.env.WEAVIATE_API_KEY;
  if (!url || !apiKey) {
    throw new Error(
      "WEAVIATE_URL and WEAVIATE_API_KEY environment variables are required",
    );
  }

  const client = await weaviate.connectToWeaviateCloud(url, {
    authCredentials: new weaviate.ApiKey(apiKey),
    headers: {
      "X-OpenAI-Api-Key": process.env.OPENAI_API_KEY ?? "",
    },
    timeout: {
      query: QUERY_TIMEOUT_SECONDS,
      insert: INSERT_TIMEOUT_SECONDS,
      init: INIT_TIMEOUT_SECONDS,
    },
  });

  return client;
}

export { createCloudClient };
```

**Why good:** Environment variable validation, named timeout constants, API key header for vectorizer module, `authCredentials` for Weaviate Cloud authentication

```typescript
// Bad Example -- Leaked connections, missing headers
import weaviate from "weaviate-client";

const client = await weaviate.connectToWeaviateCloud(
  "https://my-instance.weaviate.network",
  {
    authCredentials: new weaviate.ApiKey("hardcoded-key"),
  },
);
// No X-OpenAI-Api-Key header -- nearText queries will fail silently
// No client.close() -- gRPC connection leaks
// Hardcoded credentials -- leak in version control
```

**Why bad:** Hardcoded credentials, missing vectorizer API key header causes silent search failures, no `client.close()` leaks gRPC connections

---

## Connection: Local Docker

```typescript
import weaviate from "weaviate-client";

const LOCAL_HTTP_PORT = 8080;
const LOCAL_GRPC_PORT = 50051;

async function createLocalClient() {
  const client = await weaviate.connectToLocal({
    port: LOCAL_HTTP_PORT,
    grpcPort: LOCAL_GRPC_PORT,
    headers: {
      "X-OpenAI-Api-Key": process.env.OPENAI_API_KEY ?? "",
    },
  });

  return client;
}

export { createLocalClient };
```

**Why good:** Explicit ports with named constants, headers still provided for vectorizer modules even locally

---

## Connection: Cleanup Pattern

Always close the client when done. Use try/finally in scripts or shutdown hooks in servers.

```typescript
// Script pattern -- try/finally
const client = await createCloudClient();
try {
  // ... perform operations
} finally {
  client.close();
}
```

```typescript
// Server pattern -- shutdown hook
const client = await createCloudClient();

process.on("SIGTERM", () => {
  client.close();
  process.exit(0);
});

process.on("SIGINT", () => {
  client.close();
  process.exit(0);
});
```

---

## Collection: Basic Creation

```typescript
import { vectors, dataType, generative } from "weaviate-client";

async function createArticleCollection(client: WeaviateClient) {
  await client.collections.create({
    name: "Article",
    vectorizers: vectors.text2VecOpenAI({
      model: "text-embedding-3-small",
    }),
    generative: generative.openAI({
      model: "gpt-4o",
    }),
    properties: [
      { name: "title", dataType: dataType.TEXT },
      { name: "body", dataType: dataType.TEXT },
      { name: "category", dataType: dataType.TEXT },
      { name: "author", dataType: dataType.TEXT },
      { name: "publishedAt", dataType: dataType.DATE },
      { name: "wordCount", dataType: dataType.INT },
    ],
  });
}

export { createArticleCollection };
```

**Why good:** Explicit property data types prevent auto-detection surprises, vectorizer and generative model configured at creation

---

## Collection: Named Vectors

Use named vectors when objects need multiple embedding representations (e.g., title vs body, or different models).

```typescript
import { vectors, dataType, configure } from "weaviate-client";

await client.collections.create({
  name: "Product",
  vectorizers: [
    vectors.text2VecOpenAI({
      name: "title_vector",
      sourceProperties: ["title", "brand"],
      vectorIndexConfig: configure.vectorIndex.hnsw(),
    }),
    vectors.text2VecOpenAI({
      name: "description_vector",
      sourceProperties: ["description"],
      vectorIndexConfig: configure.vectorIndex.hnsw(),
    }),
    vectors.selfProvided({
      name: "image_vector",
      vectorIndexConfig: configure.vectorIndex.hnsw(),
    }),
  ],
  properties: [
    { name: "title", dataType: dataType.TEXT },
    { name: "brand", dataType: dataType.TEXT },
    { name: "description", dataType: dataType.TEXT },
    { name: "price", dataType: dataType.NUMBER },
  ],
});
```

**Why good:** Separate vectors for different semantic fields, `selfProvided` for externally computed image embeddings, `sourceProperties` controls which fields each vector covers

```typescript
// Bad Example -- Named vectors without targetVector in query
const products = client.collections.use("Product");
const result = await products.query.nearText("leather jacket", { limit: 5 });
// Defaults to first named vector -- may search title_vector when you wanted description_vector
```

**Why bad:** Without `targetVector`, Weaviate uses the first named vector, which may not be the intended search field

---

## Collection: Vectorizer Property Controls

Skip vectorization for properties that shouldn't influence search, or include the property name in the embedding.

```typescript
import { vectors, dataType, tokenization } from "weaviate-client";

await client.collections.create({
  name: "Document",
  vectorizers: vectors.text2VecOpenAI(),
  properties: [
    {
      name: "title",
      dataType: dataType.TEXT,
      vectorizePropertyName: true, // "title: My Article" vectorized together
      tokenization: tokenization.LOWERCASE,
    },
    {
      name: "body",
      dataType: dataType.TEXT,
      tokenization: tokenization.WHITESPACE,
    },
    {
      name: "internalId",
      dataType: dataType.TEXT,
      skipVectorization: true, // Don't include in embedding
    },
    {
      name: "createdAt",
      dataType: dataType.DATE,
      skipVectorization: true,
    },
  ],
});
```

**Why good:** `skipVectorization` on non-semantic fields prevents noise in embeddings, `vectorizePropertyName` adds context for short fields, tokenization controls keyword search behavior

---

## Collection: Check and Delete

```typescript
// Check if collection exists before creating
const exists = await client.collections.exists("Article");
if (!exists) {
  await client.collections.create({ name: "Article" /* ... */ });
}

// Get collection configuration
const articles = client.collections.use("Article");
const config = await articles.config.get();
console.log(config);

// List all collections
const allCollections = await client.collections.listAll();

// Delete collection (permanent -- deletes all data)
await client.collections.delete("Article");
```

---

## Object: Insert Single

```typescript
const articles = client.collections.use("Article");

const uuid = await articles.data.insert({
  title: "Introduction to Vector Databases",
  body: "Vector databases store data alongside embeddings...",
  category: "technology",
  author: "Jane Smith",
  publishedAt: new Date("2024-06-15").toISOString(),
  wordCount: 1500,
});

console.log("Inserted:", uuid);
```

---

## Object: Insert with Explicit ID

Use `generateUuid5` for deterministic, idempotent IDs based on content.

```typescript
import { generateUuid5 } from "weaviate-client";

const articles = client.collections.use("Article");
const data = {
  title: "Deterministic ID Example",
  body: "Content here...",
  category: "tutorial",
};

const deterministicId = generateUuid5("Article", JSON.stringify(data));

const uuid = await articles.data.insert({
  properties: data,
  id: deterministicId,
});
```

**Why good:** `generateUuid5` produces the same UUID for the same input -- safe to retry without creating duplicates

---

## Object: Insert with Pre-Computed Vector

```typescript
const articles = client.collections.use("Article");
const EMBEDDING_DIM = 1536;

// Single default vector
await articles.data.insert({
  properties: { title: "Custom Vector Example", body: "..." },
  vectors: myEmbeddingArray, // number[] matching collection vector dimension
});

// Named vectors
const products = client.collections.use("Product");
await products.data.insert({
  properties: { title: "Jacket", description: "Warm winter jacket" },
  vectors: {
    title_vector: titleEmbedding,
    description_vector: descEmbedding,
    image_vector: imageEmbedding,
  },
});
```

---

## Object: Update vs Replace

```typescript
const articles = client.collections.use("Article");
const objectId = "ed89d9e7-4c9d-4a6a-8d20-095cb0026f54";

// Update (merge) -- preserves properties NOT included
await articles.data.update({
  id: objectId,
  properties: {
    wordCount: 2000, // Only this property changes
  },
});

// Replace (overwrite) -- DELETES properties NOT included
await articles.data.replace({
  id: objectId,
  properties: {
    title: "Replaced Title",
    body: "Replaced body",
    // category, author, publishedAt, wordCount are DELETED
  },
});
```

**Why good:** Clear distinction between merge and overwrite semantics

```typescript
// Bad Example -- Using replace when update was intended
await articles.data.replace({
  id: objectId,
  properties: { wordCount: 2000 },
});
// All other properties (title, body, category, etc.) are now DELETED
```

**Why bad:** `replace` deletes every property not explicitly provided -- use `update` for partial changes

---

## Object: Delete

```typescript
const articles = client.collections.use("Article");

// Delete single object by ID
await articles.data.deleteById("ed89d9e7-4c9d-4a6a-8d20-095cb0026f54");

// Delete multiple objects matching a filter
const deleteResult = await articles.data.deleteMany(
  articles.filter.byProperty("category").equal("draft"),
);
console.log("Deleted:", deleteResult);

// Delete by ID list
const idsToDelete = ["id-1", "id-2", "id-3"];
await articles.data.deleteMany(articles.filter.byId().containsAny(idsToDelete));

// Dry run -- check what would be deleted without deleting
const dryResult = await articles.data.deleteMany(
  articles.filter.byProperty("category").equal("old"),
  { dryRun: true, verbose: true },
);
console.log("Would delete:", dryResult);
```

---

## Object: Iterate Over Entire Collection

Use `iterator()` to process all objects without loading everything into memory.

```typescript
const articles = client.collections.use("Article");

for await (const item of articles.iterator()) {
  console.log(item.uuid, item.properties.title);
}

// With specific return properties
for await (const item of articles.iterator({
  returnProperties: ["title", "category"],
})) {
  processArticle(item);
}
```

**Why good:** Memory-efficient -- streams objects in batches internally, unlike `fetchObjects` which loads a fixed page

---

## TypeScript Generics

Use generics for compile-time type safety on collection objects.

```typescript
interface Article {
  title: string;
  body: string;
  category: string;
  author: string;
  publishedAt: string;
  wordCount: number;
}

const articles = client.collections.use<Article>("Article");

// Now insert and query methods are typed
const uuid = await articles.data.insert({
  title: "Typed Insert",
  body: "This is type-checked at compile time",
  category: "tutorial",
  author: "Developer",
  publishedAt: new Date().toISOString(),
  wordCount: 500,
  // misspelledField: "error" // TypeScript error!
});

const result = await articles.query.fetchObjects({ limit: 5 });
for (const obj of result.objects) {
  // obj.properties is typed as Article
  console.log(obj.properties.title); // string, not unknown
}
```

**Why good:** Compile-time type checking catches property name typos, wrong types, and missing fields before runtime

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
