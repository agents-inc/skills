# Vercel KV / Upstash Redis Quick Reference

> Command reference, environment variables, plan limits, and migration guide. See [SKILL.md](SKILL.md) for core concepts and [examples/core.md](examples/core.md) for code examples.

---

## Environment Variables

| Variable                   | Source                               | Description                                         |
| -------------------------- | ------------------------------------ | --------------------------------------------------- |
| `UPSTASH_REDIS_REST_URL`   | Upstash console / Vercel integration | REST API endpoint (`https://<name>.upstash.io`)     |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash console / Vercel integration | Bearer token for REST API authentication            |
| `KV_REST_API_URL`          | Legacy `@vercel/kv`                  | Deprecated -- migrate to `UPSTASH_REDIS_REST_URL`   |
| `KV_REST_API_TOKEN`        | Legacy `@vercel/kv`                  | Deprecated -- migrate to `UPSTASH_REDIS_REST_TOKEN` |

**On Vercel:** These are injected automatically when you install the Upstash Redis integration from the Marketplace.

**Locally:** Copy from Upstash console to `.env.local` or use `vercel env pull`.

---

## Command Quick Reference

### String Commands

| Method                         | Description                   | Example                              |
| ------------------------------ | ----------------------------- | ------------------------------------ |
| `redis.set(key, value, opts?)` | Set value (auto-serialized)   | `redis.set("k", obj, { ex: 300 })`   |
| `redis.get<T>(key)`            | Get value (auto-deserialized) | `redis.get<User>("k")`               |
| `redis.setex(key, ttl, value)` | Set with TTL (seconds)        | `redis.setex("k", 300, obj)`         |
| `redis.setnx(key, value)`      | Set only if not exists        | `redis.setnx("k", obj)`              |
| `redis.mget<T>(keys...)`       | Get multiple keys             | `redis.mget("k1", "k2")`             |
| `redis.mset(pairs)`            | Set multiple keys             | `redis.mset({ k1: "v1", k2: "v2" })` |
| `redis.incr(key)`              | Increment by 1                | `redis.incr("counter")`              |
| `redis.incrby(key, n)`         | Increment by n                | `redis.incrby("counter", 5)`         |
| `redis.decr(key)`              | Decrement by 1                | `redis.decr("counter")`              |
| `redis.del(keys...)`           | Delete keys                   | `redis.del("k1", "k2")`              |

### Hash Commands

| Method                         | Description        | Example                             |
| ------------------------------ | ------------------ | ----------------------------------- |
| `redis.hset(key, fields)`      | Set hash fields    | `redis.hset("u:1", { name: "A" })`  |
| `redis.hget<T>(key, field)`    | Get hash field     | `redis.hget("u:1", "name")`         |
| `redis.hgetall<T>(key)`        | Get all fields     | `redis.hgetall("u:1")`              |
| `redis.hdel(key, fields...)`   | Delete fields      | `redis.hdel("u:1", "age")`          |
| `redis.hincrby(key, field, n)` | Increment field    | `redis.hincrby("u:1", "visits", 1)` |
| `redis.hexists(key, field)`    | Check field exists | `redis.hexists("u:1", "name")`      |

### Sorted Set Commands

| Method                                  | Description     | Example                                          |
| --------------------------------------- | --------------- | ------------------------------------------------ |
| `redis.zadd(key, { score, member })`    | Add with score  | `redis.zadd("lb", { score: 100, member: "p1" })` |
| `redis.zrange(key, start, stop)`        | Get range (asc) | `redis.zrange("lb", 0, 9)`                       |
| `redis.zrem(key, members...)`           | Remove members  | `redis.zrem("lb", "p1")`                         |
| `redis.zcard(key)`                      | Get count       | `redis.zcard("lb")`                              |
| `redis.zremrangebyscore(key, min, max)` | Remove by score | `redis.zremrangebyscore("lb", 0, cutoff)`        |

### Key Management

| Method                       | Description                 | Example                           |
| ---------------------------- | --------------------------- | --------------------------------- |
| `redis.expire(key, seconds)` | Set TTL                     | `redis.expire("k", 300)`          |
| `redis.ttl(key)`             | Get remaining TTL           | `redis.ttl("k")`                  |
| `redis.exists(keys...)`      | Check existence             | `redis.exists("k1", "k2")`        |
| `redis.keys(pattern)`        | Find keys (caution in prod) | `redis.keys("user:*")`            |
| `redis.scan(cursor, opts?)`  | Iterate keys safely         | `redis.scan(0, { match: "u:*" })` |

---

## Pipeline and Transaction API

```typescript
// Pipeline (non-atomic batch -- single HTTP request)
const pipe = redis.pipeline();
pipe.set("k1", "v1");
pipe.get("k2");
const results = await pipe.exec<[string, string | null]>();

// Transaction (atomic MULTI/EXEC -- single HTTP request)
const tx = redis.multi();
tx.decrby("balance:a", 100);
tx.incrby("balance:b", 100);
const results = await tx.exec<[number, number]>();
```

---

## Client Configuration Options

```typescript
const redis = new Redis({
  url: "...", // REST API URL (required)
  token: "...", // Auth token (required)
  automaticDeserialization: true, // Default: true -- auto JSON parse responses
  enableTelemetry: false, // Default: true -- anonymous usage stats
});
```

---

## Plan Limits (Upstash)

| Limit             | Free   | Pay-as-you-go | Fixed plans     |
| ----------------- | ------ | ------------- | --------------- |
| Monthly commands  | 500K   | Per-command   | Unlimited       |
| Max storage       | 256 MB | 100 GB        | 250 MB - 500 GB |
| Max request size  | 10 MB  | 10 MB         | Up to 100 MB    |
| Max record size   | 100 MB | 100 MB        | Up to 5 GB      |
| Max ops/sec       | 10,000 | 10,000        | 10,000 - 16,000 |
| Monthly bandwidth | 10 GB  | 200 GB free   | 50 GB - 20 TB   |
| Databases (free)  | 10     | 10            | Plan-specific   |

---

## Migration from @vercel/kv to @upstash/redis

### Package swap

```bash
npm uninstall @vercel/kv
npm install @upstash/redis
```

### Code changes

```typescript
// Before (@vercel/kv)
import { kv } from "@vercel/kv";
await kv.set("key", value);
const data = await kv.get("key");

// After (@upstash/redis)
import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();
await redis.set("key", value);
const data = await redis.get("key");
```

### Environment variable changes

| Old (Vercel KV)     | New (Upstash)              |
| ------------------- | -------------------------- |
| `KV_REST_API_URL`   | `UPSTASH_REDIS_REST_URL`   |
| `KV_REST_API_TOKEN` | `UPSTASH_REDIS_REST_TOKEN` |

**API compatibility:** The command API is identical -- `@vercel/kv` was a thin wrapper around `@upstash/redis`. Only the import, client initialization, and env var names change.

---

_Full skill documentation: [SKILL.md](SKILL.md) | Examples: [examples/core.md](examples/core.md)_
