# Upstash Quick Reference

> Command cheat sheet, constructor options, environment variables, eviction policies, and production checklist. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Constructor Options

### Redis Constructor

```typescript
import { Redis } from "@upstash/redis";

// Option 1: Auto-load from environment (preferred)
const redis = Redis.fromEnv();

// Option 2: Explicit configuration
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  automaticDeserialization: true, // default: true
  responseEncoding: "base64", // default: "base64" (set false to disable)
  enableAutoPipelining: false, // default: false
  enableTelemetry: true, // default: true
  signal: () => AbortSignal.timeout(5000), // request timeout
});
```

| Option                     | Default    | Description                                                           |
| -------------------------- | ---------- | --------------------------------------------------------------------- |
| `url`                      | --         | REST API endpoint (`UPSTASH_REDIS_REST_URL`)                          |
| `token`                    | --         | Auth token (`UPSTASH_REDIS_REST_TOKEN`)                               |
| `automaticDeserialization` | `true`     | Auto `JSON.parse` responses; set `false` for raw strings              |
| `responseEncoding`         | `"base64"` | Request base64-encoded responses; set `false` if output looks garbled |
| `enableAutoPipelining`     | `false`    | Batch commands from same event loop tick into single request          |
| `enableTelemetry`          | `true`     | Send anonymous usage data; disable with `UPSTASH_DISABLE_TELEMETRY=1` |
| `latencyLogging`           | `true`     | Log per-command latency to console; set `false` to suppress           |
| `signal`                   | --         | Factory function returning `AbortSignal` for request timeouts         |

---

## Environment Variables

| Variable                     | Purpose                         | Required            |
| ---------------------------- | ------------------------------- | ------------------- |
| `UPSTASH_REDIS_REST_URL`     | REST API endpoint               | Yes                 |
| `UPSTASH_REDIS_REST_TOKEN`   | REST API auth token             | Yes                 |
| `UPSTASH_DISABLE_TELEMETRY`  | Set to `1` to disable telemetry | No                  |
| `QSTASH_TOKEN`               | QStash auth token               | For QStash          |
| `QSTASH_CURRENT_SIGNING_KEY` | QStash webhook verification key | For QStash receiver |
| `QSTASH_NEXT_SIGNING_KEY`    | QStash webhook verification key | For QStash receiver |

---

## Command Quick Reference

### String Commands

| Command                         | Upstash SDK                             |
| ------------------------------- | --------------------------------------- |
| `SET key value`                 | `redis.set("key", value)`               |
| `SET key value EX seconds`      | `redis.set("key", value, { ex: 300 })`  |
| `SET key value PX milliseconds` | `redis.set("key", value, { px: 5000 })` |
| `SET key value NX`              | `redis.set("key", value, { nx: true })` |
| `SET key value XX`              | `redis.set("key", value, { xx: true })` |
| `GET key`                       | `redis.get<Type>("key")`                |
| `GETDEL key`                    | `redis.getdel("key")`                   |
| `MGET key1 key2`                | `redis.mget<[T1, T2]>("k1", "k2")`      |
| `MSET key1 val1 key2 val2`      | `redis.mset({ k1: "v1", k2: "v2" })`    |
| `INCR key`                      | `redis.incr("key")`                     |
| `INCRBY key amount`             | `redis.incrby("key", 5)`                |
| `DECR key`                      | `redis.decr("key")`                     |
| `DECRBY key amount`             | `redis.decrby("key", 5)`                |
| `APPEND key value`              | `redis.append("key", "text")`           |

**Key difference from ioredis:** SET options use an object `{ ex, px, nx, xx }` -- NOT positional args like `"EX", 300`.

### Hash Commands

| Command                | Upstash SDK                                         |
| ---------------------- | --------------------------------------------------- |
| `HSET key field value` | `redis.hset("key", { field: "value" })`             |
| `HGET key field`       | `redis.hget<Type>("key", "field")`                  |
| `HGETALL key`          | `redis.hgetall<Record<string, T>>("key")`           |
| `HMGET key f1 f2`      | `redis.hmget<Record<string, T>>("key", "f1", "f2")` |
| `HDEL key field`       | `redis.hdel("key", "field")`                        |
| `HINCRBY key field n`  | `redis.hincrby("key", "field", 1)`                  |
| `HEXISTS key field`    | `redis.hexists("key", "field")`                     |
| `HKEYS key`            | `redis.hkeys("key")`                                |
| `HVALS key`            | `redis.hvals("key")`                                |
| `HLEN key`             | `redis.hlen("key")`                                 |

### List Commands

| Command                 | Upstash SDK                     |
| ----------------------- | ------------------------------- |
| `LPUSH key value`       | `redis.lpush("key", "value")`   |
| `RPUSH key value`       | `redis.rpush("key", "value")`   |
| `LPOP key`              | `redis.lpop("key")`             |
| `RPOP key`              | `redis.rpop("key")`             |
| `LRANGE key start stop` | `redis.lrange("key", 0, -1)`    |
| `LLEN key`              | `redis.llen("key")`             |
| `LINDEX key index`      | `redis.lindex("key", 0)`        |
| `LSET key index value`  | `redis.lset("key", 0, "value")` |
| `LTRIM key start stop`  | `redis.ltrim("key", 0, 99)`     |

### Set Commands

| Command                | Upstash SDK                        |
| ---------------------- | ---------------------------------- |
| `SADD key member`      | `redis.sadd("key", "member")`      |
| `SREM key member`      | `redis.srem("key", "member")`      |
| `SMEMBERS key`         | `redis.smembers("key")`            |
| `SISMEMBER key member` | `redis.sismember("key", "member")` |
| `SCARD key`            | `redis.scard("key")`               |
| `SINTER key1 key2`     | `redis.sinter("key1", "key2")`     |
| `SUNION key1 key2`     | `redis.sunion("key1", "key2")`     |
| `SDIFF key1 key2`      | `redis.sdiff("key1", "key2")`      |
| `SPOP key`             | `redis.spop("key")`                |

### Sorted Set Commands

| Command                    | Upstash SDK                                       |
| -------------------------- | ------------------------------------------------- |
| `ZADD key score member`    | `redis.zadd("key", { score: 100, member: "p1" })` |
| `ZSCORE key member`        | `redis.zscore("key", "member")`                   |
| `ZRANK key member`         | `redis.zrank("key", "member")`                    |
| `ZRANGE key start stop`    | `redis.zrange("key", 0, 9)`                       |
| `ZREVRANGE key start stop` | `redis.zrange("key", 0, 9, { rev: true })`        |
| `ZINCRBY key incr member`  | `redis.zincrby("key", 10, "member")`              |
| `ZREM key member`          | `redis.zrem("key", "member")`                     |
| `ZCARD key`                | `redis.zcard("key")`                              |

**Key difference from ioredis:** `ZADD` uses `{ score, member }` object -- NOT positional args.

### Key Management Commands

| Command              | Upstash SDK                            |
| -------------------- | -------------------------------------- |
| `DEL key`            | `redis.del("key")`                     |
| `EXISTS key`         | `redis.exists("key")`                  |
| `EXPIRE key seconds` | `redis.expire("key", 300)`             |
| `PEXPIRE key ms`     | `redis.pexpire("key", 5000)`           |
| `TTL key`            | `redis.ttl("key")`                     |
| `PTTL key`           | `redis.pttl("key")`                    |
| `TYPE key`           | `redis.type("key")`                    |
| `RENAME key newkey`  | `redis.rename("old", "new")`           |
| `SCAN cursor`        | `redis.scan(0, { match: "user:*" })`   |
| `KEYS pattern`       | `redis.keys("user:*")` (avoid in prod) |

---

## @upstash/ratelimit Response Shape

```typescript
type RatelimitResponse = {
  success: boolean; // Request allowed (true) or rejected (false)
  limit: number; // Max requests per window
  remaining: number; // Requests left in current window
  reset: number; // Unix timestamp (ms) when limits reset
  pending: Promise<unknown>; // Async operations -- MUST handle in edge runtimes
  reason?: string; // "timeout" | "cacheBlock" | "denyList" | undefined
  deniedValue?: string; // Value from deny list if reason is "denyList"
};
```

---

## Upstash Global Database

| Aspect                | Detail                                                      |
| --------------------- | ----------------------------------------------------------- |
| **Architecture**      | 1 primary region + N read regions                           |
| **Write routing**     | All writes go to primary, replicated async to read regions  |
| **Read routing**      | Reads served from nearest replica                           |
| **Consistency model** | Eventually consistent (Last-Write-Wins conflict resolution) |
| **Read latency**      | <1ms same-region, <50ms cross-continent (p99)               |
| **Write cost**        | Replicated to all regions = (N+1) x write commands billed   |
| **Best for**          | Read-heavy workloads with global users                      |
| **Avoid for**         | Write-heavy workloads, strong consistency requirements      |

---

## Eviction Policies

Set via Upstash Console when creating the database:

| Policy            | Behavior                                         |
| ----------------- | ------------------------------------------------ |
| `noeviction`      | Return error when memory limit reached (default) |
| `allkeys-lru`     | Evict least recently used keys                   |
| `allkeys-lfu`     | Evict least frequently used keys                 |
| `allkeys-random`  | Evict random keys                                |
| `volatile-lru`    | Evict LRU keys that have TTL set                 |
| `volatile-lfu`    | Evict LFU keys that have TTL set                 |
| `volatile-random` | Evict random keys that have TTL set              |
| `volatile-ttl`    | Evict keys with shortest TTL first               |

**Recommendation:** Use `allkeys-lru` for caching workloads. Use `noeviction` when all data must persist (session stores).

---

## Production Checklist

### Setup

- [ ] `Redis.fromEnv()` used (no hardcoded credentials)
- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set in all environments
- [ ] TTL set on all cache keys (`{ ex: seconds }` on `set()`)
- [ ] Pipeline used for 3+ independent commands in a handler
- [ ] Eviction policy configured in Upstash Console

### Rate Limiting

- [ ] `@upstash/ratelimit` used instead of manual Lua scripts
- [ ] `pending` promise handled with `context.waitUntil()` in edge runtimes
- [ ] Rate limit headers set on 429 responses (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- [ ] Appropriate algorithm selected (sliding window for strict, fixed window for simple, token bucket for burst)

### Global Database (if used)

- [ ] Primary region set closest to write-heavy services
- [ ] Read regions placed near user populations
- [ ] Application handles eventual consistency (no read-after-write guarantees across regions)
- [ ] Write cost multiplier accounted for in budget

### Security

- [ ] REST tokens not committed to version control
- [ ] `UPSTASH_DISABLE_TELEMETRY=1` set if telemetry unwanted
- [ ] QStash webhook signatures verified with `Receiver`

---

## Unsupported Operations (REST API Limitations)

These Redis features are NOT available through `@upstash/redis`:

- **Pub/Sub** (`SUBSCRIBE`, `PUBLISH`) -- requires persistent TCP connection
- **Blocking commands** (`BRPOP`, `BLPOP`, `XREAD BLOCK`) -- HTTP cannot block
- **Lua scripting** (`EVAL`, `EVALSHA`) -- not exposed via REST API
- **WATCH** -- optimistic locking requires connection state
- **CLIENT commands** -- no persistent connection to manage
- **CLUSTER commands** -- managed by Upstash internally

**Alternative:** Use ioredis with a TCP connection for these features.

---

_Full skill documentation: [SKILL.md](SKILL.md) | Examples: [examples/](examples/)_
