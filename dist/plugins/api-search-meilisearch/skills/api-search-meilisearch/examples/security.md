# Meilisearch -- Security & Multi-Tenancy Examples

> API keys, tenant tokens, search rules, and multi-tenant patterns. Reference from [SKILL.md](../SKILL.md).

**Prerequisites:** Understand client setup from [core.md](core.md) first.

**Related examples:**

- [core.md](core.md) -- Client setup, document operations
- [filtering.md](filtering.md) -- Filter syntax (tenant tokens use filters to restrict access)

---

## API Key Types

Meilisearch has three tiers of API keys:

| Key Type         | Access Level                          | Use Where                         |
| ---------------- | ------------------------------------- | --------------------------------- |
| **Master key**   | Full admin access (all operations)    | Server-side only, environment var |
| **Admin key**    | Index management, documents, settings | Server-side backend only          |
| **Search key**   | Search only (read-only)               | Can be exposed to frontend        |
| **Tenant token** | Search + per-user filter restrictions | Frontend, multi-tenant apps       |

---

## Creating Scoped API Keys

```typescript
import type { Meilisearch } from "meilisearch";

async function createSearchOnlyKey(client: Meilisearch): Promise<string> {
  const key = await client.createKey({
    description: "Public search key for frontend",
    actions: ["search"],
    indexes: ["products", "articles"], // Restrict to specific indexes
    expiresAt: new Date("2026-12-31"),
  });

  return key.key;
}

async function createAdminKey(client: Meilisearch): Promise<string> {
  const key = await client.createKey({
    description: "Backend admin key for indexing",
    actions: [
      "documents.add",
      "documents.delete",
      "settings.update",
      "indexes.create",
    ],
    indexes: ["products"],
    expiresAt: null, // No expiration
  });

  return key.key;
}

export { createSearchOnlyKey, createAdminKey };
```

**Why good:** Principle of least privilege -- frontend gets search-only access to specific indexes, backend gets only the actions it needs, expiration dates on keys

---

## Tenant Tokens for Multi-Tenancy

Tenant tokens restrict which documents a user can see within a shared index. The token is a JWT generated server-side and passed to the frontend.

### How Tenant Tokens Work

1. All tenants' documents live in a single index with a `tenantId` field
2. `tenantId` must be in `filterableAttributes`
3. Server generates a JWT with a filter rule: `tenantId = "tenant-123"`
4. Frontend uses this JWT as its API key
5. Meilisearch automatically applies the filter to every search

### Generating Tenant Tokens (Server-Side)

```typescript
import { generateTenantToken } from "meilisearch/token";

const SEARCH_API_KEY = process.env.MEILISEARCH_SEARCH_KEY!;
const SEARCH_API_KEY_UID = process.env.MEILISEARCH_SEARCH_KEY_UID!;

async function createTenantSearchToken(tenantId: string): Promise<string> {
  const TOKEN_EXPIRY_HOURS = 24;
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

  const token = await generateTenantToken({
    apiKey: SEARCH_API_KEY,
    apiKeyUid: SEARCH_API_KEY_UID,
    searchRules: {
      products: {
        filter: `tenantId = "${tenantId}"`,
      },
    },
    expiresAt,
  });

  return token;
}

export { createTenantSearchToken };
```

**Why good:** Short-lived tokens (24 hours), filter scoped to specific tenant, uses search-only API key (not master key), `apiKeyUid` is the UID of the search key (not the key itself)

### Using Tenant Tokens (Client-Side)

```typescript
import { Meilisearch } from "meilisearch";

// Token received from your authentication endpoint
function createTenantClient(tenantToken: string): Meilisearch {
  return new Meilisearch({
    host: "https://search.example.com",
    apiKey: tenantToken, // JWT token acts as the API key
  });
}

// All searches through this client are automatically filtered to the tenant
// Even if the user manipulates the search query, they cannot see other tenants' data

export { createTenantClient };
```

**Why good:** Token used as API key -- Meilisearch validates and extracts the filter rule, the filter cannot be bypassed by the frontend

### Search Rules Patterns

```typescript
// Restrict to specific index with filter
const singleIndexRule = {
  products: {
    filter: `tenantId = "${tenantId}"`,
  },
};

// Restrict to multiple indexes
const multiIndexRule = {
  products: {
    filter: `tenantId = "${tenantId}"`,
  },
  orders: {
    filter: `customerId = "${tenantId}"`,
  },
};

// Wildcard: apply to all indexes
const wildcardRule = {
  "*": {
    filter: `organizationId = "${orgId}"`,
  },
};

// No filter, just index access restriction
const indexAccessOnly = {
  products: null, // Full access to products index, no filter
};
```

---

## Multi-Tenant Index Setup

```typescript
import type { Meilisearch } from "meilisearch";

interface TenantDocument {
  id: string;
  tenantId: string; // Required for multi-tenancy
  [key: string]: unknown;
}

const INDEX_NAME = "products";

async function setupMultiTenantIndex(client: Meilisearch): Promise<void> {
  const index = client.index(INDEX_NAME);

  await index
    .updateSettings({
      // tenantId MUST be filterable for tenant tokens to work
      filterableAttributes: ["tenantId", "price", "categories", "brand"],
      // tenantId should NOT be searchable (users shouldn't search for tenant IDs)
      searchableAttributes: ["name", "description", "brand"],
    })
    .waitTask();
}

export { setupMultiTenantIndex };
```

**Why good:** `tenantId` is filterable (required for tenant tokens) but NOT searchable (prevents leaking tenant IDs in search results)

---

## API Key Rotation

```typescript
import type { Meilisearch, Key } from "meilisearch";

async function rotateSearchKey(
  client: Meilisearch,
  oldKeyUid: string,
): Promise<Key> {
  // 1. Create new key with same permissions
  const newKey = await client.createKey({
    description: "Search key (rotated)",
    actions: ["search"],
    indexes: ["products", "articles"],
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  });

  // 2. Update your application to use the new key
  // ... deploy with new key ...

  // 3. Delete old key after grace period
  // await client.deleteKey(oldKeyUid);

  return newKey;
}

export { rotateSearchKey };
```

**Important:** Deleting an API key immediately invalidates all tenant tokens signed with that key. Always ensure a grace period where both old and new keys are valid.

---

## Common Security Mistakes

```typescript
// BAD: Master key in frontend code
const client = new Meilisearch({
  host: "https://search.example.com",
  apiKey: "master-key-abc123", // Exposes full admin access
});

// BAD: Generating tenant token with master key
const token = await generateTenantToken({
  apiKey: "master-key-abc123", // Tokens MUST be signed with a search API key
  apiKeyUid: "...",
  searchRules: { products: { filter: `tenantId = "t1"` } },
});

// BAD: Token without expiration in multi-tenant app
const token2 = await generateTenantToken({
  apiKey: searchKey,
  apiKeyUid: searchKeyUid,
  searchRules: { products: { filter: `tenantId = "t1"` } },
  // No expiresAt -- token valid forever, cannot be revoked
});
```

**Why bad:** Master key in frontend exposes admin access, tenant tokens must be signed with a search-only API key (not master key), tokens without expiration cannot be revoked if compromised

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
