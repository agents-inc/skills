---
name: web-server-state-react-query
description: React Query server state — query keys and query options, caching policy, error handling, and typed clients generated from an API schema
---

# React Query Patterns

> **Quick Guide:** React Query owns the server cache — what was fetched, how long it stays fresh,
> and when it is evicted. Every entry is identified by its `queryKey`, and `staleTime` and `gcTime`
> are two separate clocks rather than one. v5 removed `onError`/`onSuccess`/`onSettled` from
> `useQuery`, so error side effects belong in the component or on the shared `QueryCache`.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — generated client output, provider and auth setup, consuming query options, fetch timeouts
- [examples/error-handling.md](examples/error-handling.md) — component states, global handlers, retry backoff, error boundaries
- [reference.md](reference.md) — configuration and error-strategy lookup, v4 → v5 migration table

---

## Which path applies

- **The API has a schema you can generate from** — generate types, service functions and query
  options from it, then call `useQuery(generatedOptions())`. Keys and types come from one source, so
  a schema change surfaces as a compile error. Pattern 1.
- **No schema, or one you do not control** — write the query function by hand, validate the response
  at the parse boundary, and design the query keys deliberately, since nothing generates them.
  Everything from Pattern 2 onward applies unchanged.

---

<critical_requirements>

## Before writing React Query code

**Read the API base URL from the environment.** One build then runs against every environment.

**Regenerate the client when the schema changes, and commit the generated output.** The regenerated
types turn a breaking API change into a compile error in review rather than a runtime error in
production.

</critical_requirements>

---

**Auto-detection:** `useQuery`, `useMutation`, `useInfiniteQuery`, `useSuspenseQuery`, `QueryClient`,
`QueryClientProvider`, `QueryCache`, `MutationCache`, `queryKey`, `queryOptions`, `staleTime`,
`gcTime`, `invalidateQueries`, `placeholderData`, `initialPageParam`, `openapi-ts`

**Applies to:**

- Caching, invalidating and refetching server data
- QueryClient defaults, retry policy and global error handling
- Generating typed query options from an API schema
- Dependent, conditional and debounced queries

**Handled elsewhere:**

- Client-only state that never came from a server — this skill caches responses and settles nothing
  about state a user typed
- Authoring the API schema; this skill consumes one
- APIs addressed through a graph query language, whose clients cache normalised entities rather than
  whole responses under a key
- Long-lived socket streams — this cache is request/response shaped

---

<patterns>

## Core patterns

### Pattern 1: Generated query options

Point the generator at the schema and let it emit types, service functions and query options
together. The query key is generated with them, so no two call sites can disagree about it.

```typescript
// openapi-ts.config.ts
export default defineConfig({
  input: "./openapi.yaml",
  output: "src/api-client",
  plugins: ["@hey-api/typescript", "@hey-api/sdk", "@tanstack/react-query"],
});
```

A fetch client is bundled from `@hey-api/openapi-ts` v0.73 — name a client plugin explicitly only to
customise its options.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Client and cache configuration

Configure the base URL and the QueryClient defaults once, in a provider. Build the client inside
`useState` so a re-render never swaps the cache out from under the tree.

```typescript
const FIVE_MINUTES_MS = 5 * 60 * 1000;

const [queryClient] = useState(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: { staleTime: FIVE_MINUTES_MS, refetchOnWindowFocus: false },
      },
    }),
);

client.setConfig({ baseUrl: process.env.API_BASE_URL ?? "" });
```

The `QueryClient` half applies however the data is fetched. `client` is the generated client, and
its `setConfig()` merges into the existing config rather than replacing it, so auth and a custom
`fetch` can be set from separate call sites; a hand-written query function reads its base URL
wherever it already does.

Full code: [examples/core.md](examples/core.md) — provider setup, static and dynamic auth, and a
`fetch` wrapper that aborts on a timeout

---

### Pattern 3: Consuming and overriding query options

Call the generated options directly, and spread them when one call site needs a different policy.

```typescript
const { data, isPending, error } = useQuery(getFeaturesOptions());

const TEN_MINUTES_MS = 10 * 60 * 1000;
const { data: slow } = useQuery({
  ...getFeaturesOptions(),
  staleTime: TEN_MINUTES_MS,
  enabled: someCondition,
});
```

With no generator, the `queryOptions` helper defines the same thing by hand, and typed:

```typescript
import { queryOptions } from "@tanstack/react-query";

const featuresOptions = () =>
  queryOptions({ queryKey: ["features"], queryFn: getFeatures });
```

Either way the key and the function are declared in one place, which is what stops two call sites
opening two cache entries for one endpoint and an `invalidateQueries` reaching only one of them.
Spreading the options preserves the key, so an override shares the entry rather than adding another.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Error handling

Component-level `error` covers the query a user is looking at; `QueryCache` and `MutationCache`
cover everything else from one place.

```typescript
new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // A query that already held data failed a background refetch — the component shows stale
      // data and no error, so the notification is the only signal.
      if (query.state.data !== undefined) notify(error.message);
    },
  }),
  mutationCache: new MutationCache({
    onError: () => notify("Operation failed."),
  }),
});
```

Full code: [examples/error-handling.md](examples/error-handling.md)

---

### Pattern 5: Conditional and debounced queries

Key the query on the debounced value, and gate it with `enabled` so an empty term never reaches the
network.

```typescript
const DEBOUNCE_DELAY_MS = 500;

const debouncedTerm = useDebounce(searchTerm, DEBOUNCE_DELAY_MS);
const { data } = useQuery({
  queryKey: ["search", debouncedTerm],
  queryFn: () => searchApi(debouncedTerm),
  enabled: debouncedTerm.length > 0,
});
```

Keying on the raw term instead caches one entry per keystroke.

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `onError` / `onSuccess` / `onSettled` on `useQuery` — removed in v5, so the side effect silently
  never runs. Use the component's `error` or `QueryCache.onError`.
- `client.setConfig()` called inside a query function — it mutates config every in-flight request
  shares, so concurrent queries race for the base URL.
- An `AbortController` timeout with no `clearTimeout` on the success path — the timer keeps the
  closure alive after the response has landed.
- A query rendered with neither an `error` branch nor an error boundary above it — a rejected fetch
  takes the subtree down.

**Surprising behaviour:**

- `setConfig()` merges rather than replaces, so a partial call silently keeps the previous auth.
- Server-side retry defaults to `0` in v5, where v4 retried three times.
- A `fetch` timeout is unrelated to `staleTime` and `gcTime` — the first bounds one request, the
  other two bound the cache entry.
- `retry` left on against local mocks turns a mock that is simply missing into a slow failure.
- Hand-written interfaces for a response the schema already types drift silently: the field the
  backend added is absent from the type and absent from every render that needed it.
- A hand-written `useQuery` wrapper beside a generated option gives the same endpoint two query keys
  and two cache entries, so invalidating one leaves the other stale.

</red_flags>
