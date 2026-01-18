# URQL v6+ Features

> New features and breaking changes in URQL v6+. See [SKILL.md](../SKILL.md) for concepts.

---

## v6.0.0 Breaking Change: GET Requests by Default

**CRITICAL:** URQL v6+ now uses GET requests for queries where query string + variables totals less than 2048 characters.

### Impact

- Your GraphQL server **MUST support GET requests** or you must opt out
- HTTP caching benefits (CDN, browser cache)
- Some servers may reject GET for GraphQL

### Configuration Options

```typescript
// lib/urql-client.ts
import { Client, cacheExchange, fetchExchange } from "urql";

const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_URL || "";

// Option 1: Disable GET requests (use POST for everything)
const client = new Client({
  url: GRAPHQL_ENDPOINT,
  exchanges: [cacheExchange, fetchExchange],
  preferGetMethod: false, // Force POST for all requests
});

// Option 2: Use GET within URL limit (default v6+ behavior)
const clientDefault = new Client({
  url: GRAPHQL_ENDPOINT,
  exchanges: [cacheExchange, fetchExchange],
  // preferGetMethod: true, // or 'within-url-limit' - default
});

// Option 3: Always use GET (ignore 2048 character limit)
const clientForceGet = new Client({
  url: GRAPHQL_ENDPOINT,
  exchanges: [cacheExchange, fetchExchange],
  preferGetMethod: "force", // Always GET, even if URL exceeds limit
});

export { client };
```

**Why good:** Explicit configuration prevents runtime errors when server doesn't support GET, `false` properly handled in v6.0.1+

---

## Pattern 1: preferGetMethod Configuration

### When to Use Each Option

```typescript
// Use preferGetMethod: false when:
// - GraphQL server doesn't support GET
// - Server requires all operations via POST
// - Using mutation-heavy API
const NO_GET_CONFIG = {
  url: "/graphql",
  preferGetMethod: false,
};

// Use preferGetMethod: true or 'within-url-limit' when:
// - Want HTTP caching benefits
// - Server supports GET
// - Queries are typically small
const DEFAULT_CONFIG = {
  url: "/graphql",
  preferGetMethod: "within-url-limit", // or true (same behavior)
};

// Use preferGetMethod: 'force' when:
// - Server has no URL length restrictions
// - Want all queries as GET for caching
// - Working with CDN that caches GET
const FORCE_GET_CONFIG = {
  url: "/graphql",
  preferGetMethod: "force",
};
```

---

## Pattern 2: Testing GET vs POST Behavior

```typescript
// lib/urql-client.test.ts
import { describe, expect, it, vi } from "vitest";
import { Client, cacheExchange, fetchExchange } from "urql";

const SHORT_QUERY = `query { user { id } }`; // Under 2048 chars
const LONG_QUERY = `query { ${"user { id } ".repeat(300)} }`; // Over 2048 chars

describe("URQL v6 GET behavior", () => {
  it("uses GET for short queries by default", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { user: { id: "1" } } }),
      })
    );
    global.fetch = mockFetch as any;

    const client = new Client({
      url: "/graphql",
      exchanges: [cacheExchange, fetchExchange],
      // Default: preferGetMethod is true
    });

    await client.query(SHORT_QUERY, {}).toPromise();

    // First argument to fetch is the URL
    expect(mockFetch.mock.calls[0][0]).toMatch(/^\/graphql\?/);
    // Second argument is options - should have method: 'GET'
    expect(mockFetch.mock.calls[0][1]?.method).toBe("GET");
  });

  it("uses POST for long queries by default", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      })
    );
    global.fetch = mockFetch as any;

    const client = new Client({
      url: "/graphql",
      exchanges: [cacheExchange, fetchExchange],
    });

    await client.query(LONG_QUERY, {}).toPromise();

    expect(mockFetch.mock.calls[0][1]?.method).toBe("POST");
  });

  it("uses POST for all queries when preferGetMethod: false", async () => {
    const mockFetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { user: { id: "1" } } }),
      })
    );
    global.fetch = mockFetch as any;

    const client = new Client({
      url: "/graphql",
      exchanges: [cacheExchange, fetchExchange],
      preferGetMethod: false,
    });

    await client.query(SHORT_QUERY, {}).toPromise();

    expect(mockFetch.mock.calls[0][1]?.method).toBe("POST");
  });
});
```

**Why good:** Tests verify GET/POST behavior based on query length and configuration, mocks fetch to inspect actual HTTP method used

---

## Pattern 3: Migration from v5 to v6

### Breaking Changes Checklist

```typescript
// Before v6 (v5 and earlier)
const client = new Client({
  url: "/graphql",
  exchanges: [cacheExchange, fetchExchange],
  // All queries used POST by default
});

// After v6 - Option A: Keep old behavior (POST only)
const client = new Client({
  url: "/graphql",
  exchanges: [cacheExchange, fetchExchange],
  preferGetMethod: false, // Opt out of GET requests
});

// After v6 - Option B: Use new behavior (GET for small queries)
const client = new Client({
  url: "/graphql",
  exchanges: [cacheExchange, fetchExchange],
  // No change needed - GET is default for queries < 2048 chars
});
```

### Server Compatibility Check

```typescript
// utils/check-graphql-get-support.ts
/**
 * Check if GraphQL server supports GET requests
 * Run this during setup/migration to v6
 */
async function checkGraphQLGetSupport(graphqlUrl: string): Promise<boolean> {
  try {
    const testQuery = `query { __typename }`;
    const url = new URL(graphqlUrl);
    url.searchParams.set("query", testQuery);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.ok;
  } catch (error) {
    console.error("GET request not supported:", error);
    return false;
  }
}

// Usage during migration
const supportsGet = await checkGraphQLGetSupport(process.env.GRAPHQL_URL!);
const client = new Client({
  url: process.env.GRAPHQL_URL!,
  exchanges: [cacheExchange, fetchExchange],
  preferGetMethod: supportsGet, // Only enable if server supports it
});

export { checkGraphQLGetSupport };
```

**Why good:** Migration path is explicit, compatibility check prevents runtime errors, documents both options

---

## v6 RED FLAGS

**High Priority:**

- ❌ **Server doesn't support GET requests** - Set `preferGetMethod: false` or queries will fail
- ❌ **Assuming POST is still default** - v6 changed to GET for small queries
- ❌ **Not testing GET behavior** - Integration tests may fail if server rejects GET

**Common Mistakes:**

- Forgetting to check if your GraphQL server supports GET requests
- Not updating server logs/monitoring to handle GET query strings
- CDN/proxy configuration doesn't support query strings with special characters
- CORS policy may need updating for GET requests with query parameters

**Gotchas:**

- Mutations always use POST (unchanged)
- GET requests include query in URL - may expose sensitive data in logs
- URL encoding may cause issues with special characters in queries
- Some GraphQL servers require POST by specification adherence
- v6.0.1 fixed a bug where `preferGetMethod: false` was ignored

---

## v5 Changes (Already in Documentation)

**v5.0.0 Breaking Changes:**

1. **dedupExchange removed** - Deduplication is now built into core client
2. **maskTypename utility removed** - Use custom transforms instead

### Migration from v4 to v5

```typescript
// v4 - dedupExchange explicitly included
import { Client, dedupExchange, cacheExchange, fetchExchange } from "urql";

const client = new Client({
  url: "/graphql",
  exchanges: [dedupExchange, cacheExchange, fetchExchange],
});

// v5 - dedupExchange removed (now built-in)
import { Client, cacheExchange, fetchExchange } from "urql";

const client = new Client({
  url: "/graphql",
  exchanges: [cacheExchange, fetchExchange], // dedupExchange removed
});
```

**Why good:** Deduplication happens automatically in v5+, no manual exchange needed, smaller exchange array

---

## Sources

All information verified against official URQL documentation and changelog:

- [URQL v6.0.0 Changelog](https://github.com/urql-graphql/urql/blob/main/packages/core/CHANGELOG.md)
- [URQL Official Documentation](https://nearform.com/open-source/urql/docs/)
- [URQL GitHub Repository](https://github.com/urql-graphql/urql)
