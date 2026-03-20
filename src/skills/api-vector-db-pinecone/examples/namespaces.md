# Pinecone -- Namespaces & Multi-Tenancy Examples

> Namespace isolation patterns for multi-tenant applications. See [core.md](core.md) for basic vector operations.

**Related examples:**

- [core.md](core.md) -- Client setup, upsert, query, fetch, update, delete
- [metadata-filtering.md](metadata-filtering.md) -- Filter operators (alternative to namespace isolation)

---

## Namespace-Based Tenant Isolation

Namespaces physically separate data within an index. Queries scan only the target namespace, making them cheaper and faster than metadata filtering at scale.

```typescript
import type { Pinecone } from "@pinecone-database/pinecone";

const TOP_K = 10;

function getTenantIndex(pc: Pinecone, host: string, tenantId: string) {
  return pc.index({ host }).namespace(`tenant-${tenantId}`);
}

async function searchTenant(
  pc: Pinecone,
  host: string,
  tenantId: string,
  queryEmbedding: number[],
) {
  const ns = getTenantIndex(pc, host, tenantId);

  const results = await ns.query({
    vector: queryEmbedding,
    topK: TOP_K,
    includeMetadata: true,
  });

  return results.matches;
}

export { getTenantIndex, searchTenant };
```

**Why good:** Physical isolation per tenant, query cost proportional to tenant data size (not total index size), simple namespace naming convention

---

## Namespace Management API

The v7 SDK provides explicit namespace management methods.

```typescript
import type { Pinecone } from "@pinecone-database/pinecone";

const INDEX_HOST = process.env.PINECONE_INDEX_HOST!;

async function setupTenantNamespace(
  pc: Pinecone,
  tenantId: string,
): Promise<void> {
  const index = pc.index({ host: INDEX_HOST });
  const namespaceName = `tenant-${tenantId}`;

  // Create namespace (v7 API -- explicit creation)
  await index.createNamespace({
    name: namespaceName,
    // Optional: declare metadata schema for this namespace
  });
}

async function removeTenantNamespace(
  pc: Pinecone,
  tenantId: string,
): Promise<void> {
  const index = pc.index({ host: INDEX_HOST });
  // Deletes namespace and ALL vectors within it
  await index.deleteNamespace(`tenant-${tenantId}`);
}

async function listTenantNamespaces(pc: Pinecone): Promise<string[]> {
  const index = pc.index({ host: INDEX_HOST });
  const response = await index.listNamespaces({
    prefix: "tenant-", // Filter by prefix
  });

  return response.namespaces?.map((ns) => ns.name) ?? [];
}

export { setupTenantNamespace, removeTenantNamespace, listTenantNamespaces };
```

**Why good:** Explicit namespace lifecycle management, prefix-based listing for tenant discovery, `deleteNamespace` cleanly removes tenant data

---

## Tenant Onboarding and Offboarding

```typescript
import type { Pinecone } from "@pinecone-database/pinecone";

interface TenantData {
  id: string;
  documents: Array<{
    id: string;
    embedding: number[];
    metadata: Record<string, string | number>;
  }>;
}

const INDEX_HOST = process.env.PINECONE_INDEX_HOST!;
const UPSERT_BATCH_SIZE = 200;

async function onboardTenant(pc: Pinecone, tenant: TenantData): Promise<void> {
  const ns = pc.index({ host: INDEX_HOST }).namespace(`tenant-${tenant.id}`);

  // Batch upsert tenant documents
  for (let i = 0; i < tenant.documents.length; i += UPSERT_BATCH_SIZE) {
    const batch = tenant.documents.slice(i, i + UPSERT_BATCH_SIZE);
    await ns.upsert({
      records: batch.map((doc) => ({
        id: doc.id,
        values: doc.embedding,
        metadata: doc.metadata,
      })),
    });
  }
}

async function offboardTenant(pc: Pinecone, tenantId: string): Promise<void> {
  const index = pc.index({ host: INDEX_HOST });
  // Single call removes all tenant data
  await index.deleteNamespace(`tenant-${tenantId}`);
}

export { onboardTenant, offboardTenant };
```

**Why good:** Batched upserts during onboarding, single-call offboarding via `deleteNamespace`, clean data isolation

---

## Per-Namespace Statistics

```typescript
import type { Pinecone } from "@pinecone-database/pinecone";

const INDEX_HOST = process.env.PINECONE_INDEX_HOST!;

async function getTenantStats(
  pc: Pinecone,
  tenantId: string,
): Promise<{ recordCount: number }> {
  const index = pc.index({ host: INDEX_HOST });
  const stats = await index.describeIndexStats();

  const nsName = `tenant-${tenantId}`;
  const nsStats = stats.namespaces?.[nsName];

  if (!nsStats) {
    return { recordCount: 0 };
  }

  return { recordCount: nsStats.recordCount ?? 0 };
}

export { getTenantStats };
```

**Why good:** Per-namespace vector count, handles missing namespace gracefully

**Gotcha:** `describeIndexStats()` returns approximate counts. For exact counts after bulk operations, allow a few seconds for indexing to complete.

---

## Namespace vs Metadata Filtering -- Cost Comparison

```
Scenario: 100 tenants, 1 GB data each, querying one tenant

Namespace approach:
  Query scans: 1 GB (tenant's namespace only)
  Cost: ~1 read unit per query

Metadata filtering approach (single namespace):
  Query scans: 100 GB (entire namespace, then filters)
  Cost: ~100 read units per query

At 1,000 queries/day: namespace approach is 100x cheaper.
```

**Rule of thumb:** Use namespaces for multi-tenancy when you have more than a handful of tenants or when total data exceeds a few GB. Use metadata filtering only when you need cross-tenant queries.

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
