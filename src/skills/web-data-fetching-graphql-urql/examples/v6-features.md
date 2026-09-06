# URQL — Version Migration Examples

> The v6 GET default and the v4 → v6 upgrade steps. See [SKILL.md](../SKILL.md) for the red flags
> these produce.

---

## v6: queries go out as GET

From v6 a query whose text plus variables is under 2048 characters is sent as a GET with the query
in the URL. Mutations are unaffected and always POST.

That buys HTTP caching — a CDN or the browser can serve a repeat query — and costs three things: the
server has to accept GET for GraphQL, the query text lands in access logs and proxy logs, and any
CDN or CORS configuration in front of the endpoint has to tolerate the query string.

```typescript
import { Client, cacheExchange, fetchExchange } from "urql";

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_URL || "";
const exchanges = [cacheExchange, fetchExchange];

// POST for everything — the pre-v6 behaviour, and what a POST-only server needs
const postOnly = new Client({
  url: GRAPHQL_ENDPOINT,
  exchanges,
  preferGetMethod: false,
});

// The v6 default: GET under the 2048-character limit, POST above it
const withinLimit = new Client({
  url: GRAPHQL_ENDPOINT,
  exchanges,
  preferGetMethod: "within-url-limit", // same as true, and the default
});

// GET regardless of length — for a server and CDN with no URL length restriction
const alwaysGet = new Client({
  url: GRAPHQL_ENDPOINT,
  exchanges,
  preferGetMethod: "force",
});
```

The default splits by query length, so a server that rejects GET fails on short queries and succeeds
on long ones — which presents as an intermittent fault rather than a configuration error.

### Checking what the server accepts

```typescript
// utils/check-graphql-get-support.ts
async function checkGraphQLGetSupport(graphqlUrl: string): Promise<boolean> {
  try {
    const url = new URL(graphqlUrl);
    url.searchParams.set("query", `query { __typename }`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    return response.ok;
  } catch (error) {
    console.error("GET request not supported:", error);
    return false;
  }
}

const client = new Client({
  url: GRAPHQL_ENDPOINT,
  exchanges,
  preferGetMethod: await checkGraphQLGetSupport(GRAPHQL_ENDPOINT),
});
```

Run this once during the upgrade rather than on every start — a probe on every boot costs a round
trip before the first query and answers the same thing each time.

> On 6.0.0, `preferGetMethod: false` was ignored; 6.0.1 fixed it. Below 6.0.1 the opt-out does not
> take effect.

---

## v5: dedupExchange removed

Deduplication moved into the core client. Delete the exchange rather than replacing it.

```typescript
// v4
import { Client, dedupExchange, cacheExchange, fetchExchange } from "urql";
const client = new Client({
  url,
  exchanges: [dedupExchange, cacheExchange, fetchExchange],
});

// v5+
import { Client, cacheExchange, fetchExchange } from "urql";
const client = new Client({ url, exchanges: [cacheExchange, fetchExchange] });
```

The `maskTypename` utility was removed in the same release; a custom transform replaces it.

---

## Sources

- [Core changelog](https://github.com/urql-graphql/urql/blob/main/packages/core/CHANGELOG.md)
- [URQL documentation](https://nearform.com/open-source/urql/docs/)
