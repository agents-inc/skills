# tRPC — Reference

> Error codes, batching and invalidation lookup, and the v10 → v11 map. See [SKILL.md](SKILL.md) for
> the decisions and the red flags, and [examples/](examples/) for full code.

---

## Error codes

| Code                    | HTTP | For                                       |
| ----------------------- | ---- | ----------------------------------------- |
| `BAD_REQUEST`           | 400  | Invalid input the validator did not catch |
| `UNAUTHORIZED`          | 401  | Not authenticated                         |
| `FORBIDDEN`             | 403  | Authenticated, not permitted              |
| `NOT_FOUND`             | 404  | No such resource                          |
| `METHOD_NOT_SUPPORTED`  | 405  | Wrong HTTP method                         |
| `TIMEOUT`               | 408  | Request timed out                         |
| `CONFLICT`              | 409  | Duplicate or conflicting state            |
| `PRECONDITION_FAILED`   | 412  | A precondition was not met                |
| `PAYLOAD_TOO_LARGE`     | 413  | Body too large                            |
| `UNPROCESSABLE_CONTENT` | 422  | Semantically invalid                      |
| `TOO_MANY_REQUESTS`     | 429  | Rate limited                              |
| `CLIENT_CLOSED_REQUEST` | 499  | Client disconnected                       |
| `INTERNAL_SERVER_ERROR` | 500  | Unexpected failure                        |
| `NOT_IMPLEMENTED`       | 501  | Not built yet                             |
| `BAD_GATEWAY`           | 502  | Upstream failed                           |
| `SERVICE_UNAVAILABLE`   | 503  | Temporarily down                          |
| `GATEWAY_TIMEOUT`       | 504  | Upstream timed out                        |

A validation failure needs no throw — the validator's own error is caught and formatted by
`errorFormatter`.

---

## Batching

`httpBatchLink` combines the calls made in one render pass into a single request:

```typescript
// three calls, one round trip
const user = useQuery(trpc.user.getById.queryOptions({ id: "1" }));
const posts = useQuery(trpc.post.list.queryOptions());
const comments = useQuery(trpc.comment.recent.queryOptions());
```

## Invalidation

| After a mutation that           | Invalidate                                               |
| ------------------------------- | -------------------------------------------------------- |
| Changed one item                | `trpc.user.getById.queryKey({ id })`                     |
| Added to or removed from a list | `trpc.post.list.queryKey()`                              |
| Touched several procedures      | One `invalidateQueries` per key, or the router-level key |

Keys are hierarchical, so a key without its input arguments matches every variant of that procedure.
An `invalidateQueries()` with no key at all refetches the entire cache, including queries the
mutation cannot have affected.

## Prefetching

```typescript
onMouseEnter={() => queryClient.prefetchQuery(trpc.user.getById.queryOptions({ id: userId }))}
```

The same options object serves the hook and the prefetch, so the two cannot key differently.

---

<migration_notice>

## v10 → v11

**Transformer moved into the link.**

```typescript
// v10
createTRPCClient({ transformer: superjson, links: [...] });
// v11
httpBatchLink({ url: "/api/trpc", transformer: superjson });
```

**Middleware reads raw input through a function.**

```typescript
const input = opts.rawInput; // v10
const input = await opts.getRawInput(); // v11
```

**Subscriptions are async generators.**

```typescript
.subscription(async function* ({ signal }) {
  for await (const data of stream({ signal })) {
    yield tracked(data.id, data);
  }
});
```

**Renamed:** `createTRPCProxyClient` → `createTRPCClient`.

**Removed:** `.interop()`, `inferHandlerInput<T>`, `ProcedureArgs<T>`.

**Requires:** TypeScript 5.7.2+, Node 18+, and a query client on v5 — where `isLoading` became
`isPending`.

**Added:** `@trpc/tanstack-react-query` with the options factories; `File`, `Blob` and
`Uint8Array` accepted in inputs; `httpBatchStreamLink` for streamed responses;
`httpSubscriptionLink` for server-sent events; `tracked()` for resumable subscriptions; and
`createTRPCOptionsProxy` for prefetching from server components.

### Installing v11

```bash
npm install @trpc/server@^11 @trpc/client@^11 @trpc/tanstack-react-query @tanstack/react-query@^5
```

Replace `@trpc/tanstack-react-query` with `@trpc/react-query@^11` for the classic integration.

</migration_notice>
