# Redis Quick Reference

> Decision frameworks, command reference, connection options, anti-patterns, and production checklist. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Command Quick Reference

### String Commands

| Command                    | Description                 | Example                                   |
| -------------------------- | --------------------------- | ----------------------------------------- |
| `SET key value`            | Set a string value          | `redis.set("key", "value")`               |
| `GET key`                  | Get a string value          | `redis.get("key")`                        |
| `SET key value EX seconds` | Set with TTL (seconds)      | `redis.set("key", "val", "EX", 300)`      |
| `SET key value PX ms`      | Set with TTL (milliseconds) | `redis.set("key", "val", "PX", 500)`      |
| `SET key value NX`         | Set only if not exists      | `redis.set("key", "val", "EX", 30, "NX")` |
| `MGET key1 key2`           | Get multiple keys           | `redis.mget("k1", "k2")`                  |
| `MSET key1 val1 key2 val2` | Set multiple keys           | `redis.mset("k1", "v1", "k2", "v2")`      |
| `INCR key`                 | Increment by 1              | `redis.incr("counter")`                   |
| `INCRBY key amount`        | Increment by amount         | `redis.incrby("counter", 5)`              |
| `DECR key`                 | Decrement by 1              | `redis.decr("counter")`                   |
| `APPEND key value`         | Append to string            | `redis.append("log", "entry\n")`          |

### Hash Commands

| Command                | Description         | Example                                              |
| ---------------------- | ------------------- | ---------------------------------------------------- |
| `HSET key field value` | Set hash field      | `redis.hset("user:1", "name", "Alice")`              |
| `HSET key obj`         | Set multiple fields | `redis.hset("user:1", { name: "Alice", age: "30" })` |
| `HGET key field`       | Get hash field      | `redis.hget("user:1", "name")`                       |
| `HGETALL key`          | Get all fields      | `redis.hgetall("user:1")`                            |
| `HMGET key f1 f2`      | Get multiple fields | `redis.hmget("user:1", "name", "age")`               |
| `HDEL key field`       | Delete field        | `redis.hdel("user:1", "age")`                        |
| `HINCRBY key field n`  | Increment field     | `redis.hincrby("user:1", "visits", 1)`               |
| `HEXISTS key field`    | Check field exists  | `redis.hexists("user:1", "name")`                    |

### List Commands

| Command                 | Description          | Example                        |
| ----------------------- | -------------------- | ------------------------------ |
| `LPUSH key value`       | Push to left (head)  | `redis.lpush("queue", "item")` |
| `RPUSH key value`       | Push to right (tail) | `redis.rpush("queue", "item")` |
| `LPOP key`              | Pop from left        | `redis.lpop("queue")`          |
| `RPOP key`              | Pop from right       | `redis.rpop("queue")`          |
| `LRANGE key start stop` | Get range            | `redis.lrange("queue", 0, -1)` |
| `LTRIM key start stop`  | Trim to range        | `redis.ltrim("queue", 0, 99)`  |
| `LLEN key`              | Get length           | `redis.llen("queue")`          |
| `BRPOP key timeout`     | Blocking pop         | `redis.brpop("queue", 5)`      |

### Set Commands

| Command                | Description      | Example                            |
| ---------------------- | ---------------- | ---------------------------------- |
| `SADD key member`      | Add member       | `redis.sadd("tags", "redis")`      |
| `SREM key member`      | Remove member    | `redis.srem("tags", "redis")`      |
| `SMEMBERS key`         | Get all members  | `redis.smembers("tags")`           |
| `SISMEMBER key member` | Check membership | `redis.sismember("tags", "redis")` |
| `SCARD key`            | Get count        | `redis.scard("tags")`              |
| `SINTER key1 key2`     | Intersection     | `redis.sinter("tags1", "tags2")`   |
| `SUNION key1 key2`     | Union            | `redis.sunion("tags1", "tags2")`   |
| `SDIFF key1 key2`      | Difference       | `redis.sdiff("tags1", "tags2")`    |

### Sorted Set Commands

| Command                     | Description        | Example                                     |
| --------------------------- | ------------------ | ------------------------------------------- |
| `ZADD key score member`     | Add with score     | `redis.zadd("lb", 100, "player1")`          |
| `ZSCORE key member`         | Get score          | `redis.zscore("lb", "player1")`             |
| `ZRANK key member`          | Get rank (asc)     | `redis.zrank("lb", "player1")`              |
| `ZREVRANK key member`       | Get rank (desc)    | `redis.zrevrank("lb", "player1")`           |
| `ZRANGE key start stop`     | Get range (asc)    | `redis.zrange("lb", 0, 9)`                  |
| `ZREVRANGE key start stop`  | Get range (desc)   | `redis.zrevrange("lb", 0, 9, "WITHSCORES")` |
| `ZRANGEBYSCORE key min max` | Get by score range | `redis.zrangebyscore("lb", 50, 100)`        |
| `ZINCRBY key incr member`   | Increment score    | `redis.zincrby("lb", 10, "player1")`        |
| `ZREM key member`           | Remove member      | `redis.zrem("lb", "player1")`               |
| `ZCARD key`                 | Get count          | `redis.zcard("lb")`                         |

### Stream Commands

| Command                                      | Description   | Example                                                                   |
| -------------------------------------------- | ------------- | ------------------------------------------------------------------------- |
| `XADD key * field value`                     | Add entry     | `redis.xadd("stream", "*", "k", "v")`                                     |
| `XREAD COUNT n STREAMS key id`               | Read entries  | `redis.xread("COUNT", "10", "STREAMS", "s", "0")`                         |
| `XRANGE key start end`                       | Get range     | `redis.xrange("stream", "-", "+")`                                        |
| `XLEN key`                                   | Get length    | `redis.xlen("stream")`                                                    |
| `XGROUP CREATE key group id`                 | Create group  | `redis.xgroup("CREATE", "s", "g", "0", "MKSTREAM")`                       |
| `XREADGROUP GROUP g c COUNT n STREAMS key >` | Consumer read | `redis.xreadgroup("GROUP", "g", "c", "COUNT", "10", "STREAMS", "s", ">")` |
| `XACK key group id`                          | Acknowledge   | `redis.xack("stream", "group", "id")`                                     |
| `XCLAIM key group consumer min-idle id`      | Claim pending | `redis.xclaim("s", "g", "c", 30000, "id")`                                |

### Key Management Commands

| Command                             | Description           | Example                                 |
| ----------------------------------- | --------------------- | --------------------------------------- |
| `DEL key`                           | Delete key (blocking) | `redis.del("key")`                      |
| `UNLINK key`                        | Delete key (async)    | `redis.unlink("key")`                   |
| `EXPIRE key seconds`                | Set TTL               | `redis.expire("key", 300)`              |
| `PEXPIRE key ms`                    | Set TTL (ms)          | `redis.pexpire("key", 500)`             |
| `TTL key`                           | Get TTL (seconds)     | `redis.ttl("key")`                      |
| `PTTL key`                          | Get TTL (ms)          | `redis.pttl("key")`                     |
| `EXISTS key`                        | Check existence       | `redis.exists("key")`                   |
| `TYPE key`                          | Get type              | `redis.type("key")`                     |
| `RENAME key newkey`                 | Rename key            | `redis.rename("old", "new")`            |
| `SCAN cursor MATCH pattern COUNT n` | Iterate keys          | `redis.scanStream({ match: "user:*" })` |

---

## ioredis Connection Options

| Option                   | Default       | Description                                                    |
| ------------------------ | ------------- | -------------------------------------------------------------- |
| `port`                   | `6379`        | Redis port                                                     |
| `host`                   | `"127.0.0.1"` | Redis host                                                     |
| `family`                 | `4`           | IP version (4 = IPv4, 6 = IPv6)                                |
| `password`               | `null`        | Redis AUTH password                                            |
| `db`                     | `0`           | Database index                                                 |
| `keyPrefix`              | `""`          | Prefix for all keys                                            |
| `retryStrategy`          | built-in      | Function returning delay (ms) or non-number to stop            |
| `maxRetriesPerRequest`   | `20`          | Max retries per command (null = infinite, required for BullMQ) |
| `enableReadyCheck`       | `true`        | Check if server is ready on connect                            |
| `enableOfflineQueue`     | `true`        | Queue commands while disconnected                              |
| `connectTimeout`         | `10000`       | Connection timeout (ms)                                        |
| `lazyConnect`            | `false`       | Don't connect until first command                              |
| `tls`                    | `null`        | TLS options for secure connections                             |
| `enableAutoPipelining`   | `false`       | Auto-batch commands in same event loop tick                    |
| `showFriendlyErrorStack` | `false`       | Better error stack traces (slower)                             |

### Recommended Production Configuration

```typescript
const PRODUCTION_OPTIONS = {
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  retryStrategy(times: number) {
    const MAX_RETRY_DELAY_MS = 2000;
    const BASE_DELAY_MS = 50;
    return Math.min(times * BASE_DELAY_MS, MAX_RETRY_DELAY_MS);
  },
  enableReadyCheck: true,
  enableOfflineQueue: true,
  enableAutoPipelining: true,
} as const;
```

### Recommended BullMQ Configuration

```typescript
const BULLMQ_OPTIONS = {
  maxRetriesPerRequest: null, // REQUIRED
  enableReadyCheck: false,
} as const;
```

### Recommended Test Configuration

```typescript
const TEST_OPTIONS = {
  maxRetriesPerRequest: 1,
  connectTimeout: 3000,
  lazyConnect: true,
  enableOfflineQueue: false,
} as const;
```

---

## Anti-Patterns

### Using KEYS in Production

```typescript
// ❌ ANTI-PATTERN: Blocks entire Redis server
const keys = await redis.keys("user:*"); // Scans ALL keys -- O(N)
```

**Why it's wrong:** `KEYS` scans the entire keyspace and blocks Redis during execution. On a server with millions of keys, this can take seconds and block all other clients.

**What to do instead:** Use `SCAN` (or `scanStream` in ioredis) for incremental iteration:

```typescript
const stream = redis.scanStream({ match: "user:*", count: 100 });
```

---

### Missing TTL on Cache Keys

```typescript
// ❌ ANTI-PATTERN: Cache without expiration
await redis.set("cache:user:123", JSON.stringify(user));
// Key persists forever -- stale data, unbounded memory
```

**Why it's wrong:** Without TTL, cache entries accumulate until Redis runs out of memory, and stale data is served indefinitely.

**What to do instead:** Always set TTL:

```typescript
const CACHE_TTL_SECONDS = 300;
await redis.set(
  "cache:user:123",
  JSON.stringify(user),
  "EX",
  CACHE_TTL_SECONDS,
);
```

---

### Assuming Pipeline Atomicity

```typescript
// ❌ ANTI-PATTERN: Expecting atomicity from pipeline
const pipeline = redis.pipeline();
pipeline.get("balance:user1"); // Read balance
pipeline.decrby("balance:user1", 100); // Subtract
pipeline.incrby("balance:user2", 100); // Add
await pipeline.exec();
// NOT atomic -- another client can modify balance between get and decrby
```

**Why it's wrong:** Pipelines batch commands for network efficiency but do NOT provide atomicity. Other clients can interleave commands between pipeline steps.

**What to do instead:** Use Lua scripts for atomic multi-command operations, or WATCH + MULTI/EXEC for optimistic locking.

---

### Single Connection for Pub/Sub

```typescript
// ❌ ANTI-PATTERN: Reusing connection for subscribe and commands
const redis = new Redis();
await redis.subscribe("channel");
await redis.get("key"); // THROWS: Connection is in subscriber mode
```

**Why it's wrong:** When a Redis connection enters subscriber mode, it can ONLY execute SUBSCRIBE, UNSUBSCRIBE, PSUBSCRIBE, PUNSUBSCRIBE, PING, and QUIT. All other commands throw errors.

**What to do instead:** Create separate connections for subscribing and regular commands.

---

### Shared BullMQ Connection

```typescript
// ❌ ANTI-PATTERN: Sharing connection between Queue and Worker
const connection = new Redis({ maxRetriesPerRequest: null });
const queue = new Queue("tasks", { connection });
const worker = new Worker("tasks", processor, { connection });
// Queue and Worker interfere with each other's connection state
```

**Why it's wrong:** BullMQ Queue and Worker manage their connections independently. Sharing a connection causes unpredictable behavior, especially during reconnection.

**What to do instead:** Create a new connection for each Queue, Worker, and QueueEvents instance:

```typescript
const queue = new Queue("tasks", { connection: createConnection() });
const worker = new Worker("tasks", processor, {
  connection: createConnection(),
});
```

---

### Storing Large Objects

```typescript
// ❌ ANTI-PATTERN: Storing large blobs
await redis.set("report", JSON.stringify(largeDataset)); // 5 MB object
// Wastes memory, slow serialization, blocks Redis during transfer
```

**Why it's wrong:** Redis is optimized for small, fast operations. Large values waste memory, increase serialization time, and block the single-threaded Redis server during transfer.

**What to do instead:** Store a reference (URL or ID) and fetch the actual data from object storage (S3) or database.

---

## Production Checklist

### Connection Management

- [ ] Error event handlers on all Redis client instances
- [ ] Retry strategy configured with exponential backoff and max delay
- [ ] Separate connections for Pub/Sub subscribers
- [ ] Separate connections for each BullMQ Queue/Worker/QueueEvents
- [ ] `maxRetriesPerRequest: null` on BullMQ connections
- [ ] TLS enabled in production (`tls: {}` option or `rediss://` URL)
- [ ] Connection monitoring (track `connect`, `close`, `reconnecting` events)

### Data Management

- [ ] TTL set on all cache keys
- [ ] Key prefixes to separate concerns (e.g., `cache:`, `session:`, `lock:`, `queue:`)
- [ ] `UNLINK` instead of `DEL` for large keys (non-blocking)
- [ ] `SCAN` instead of `KEYS` for pattern matching
- [ ] JSON serialization error handling for cache reads

### Performance

- [ ] Auto-pipelining enabled for high-throughput scenarios
- [ ] Manual pipelines for batch operations
- [ ] Lua scripts for atomic multi-command operations
- [ ] Connection pooling via Cluster or multiple clients
- [ ] `maxmemory` and eviction policy configured on Redis server

### Security

- [ ] Redis password set (`requirepass` in redis.conf)
- [ ] TLS for connections in production
- [ ] Bind to specific interfaces (not `0.0.0.0` in production)
- [ ] Rename or disable dangerous commands (`FLUSHALL`, `CONFIG`, `DEBUG`)
- [ ] Separate Redis instances or databases for different environments

### Monitoring

- [ ] Track Redis memory usage (`INFO memory`)
- [ ] Monitor key count and expiration rates
- [ ] Alert on connection failures and reconnections
- [ ] Monitor BullMQ queue depths and stalled jobs
- [ ] Track Pub/Sub subscriber counts

---

## Key Naming Conventions

```
{type}:{entity}:{id}               -- Standard pattern
cache:user:123                      -- Cached user data
session:abc-def-ghi                 -- Session data
lock:order:456                      -- Distributed lock
ratelimit:ip:192.168.1.1            -- Rate limit counter
queue:email                         -- BullMQ queue data
stream:events:orders                -- Stream key
leaderboard:global                  -- Sorted set for rankings
{entity}:{id}:{field}               -- Granular keys
user:123:preferences                -- User preferences
```

**Best practices:**

- Use colons `:` as delimiters (Redis convention)
- Include the data type or purpose as the first segment
- Keep keys short but descriptive
- Use `keyPrefix` option in ioredis for application-level namespacing
- In Cluster mode, use `{hash-tag}` to colocate related keys: `{user:123}:profile`, `{user:123}:settings`

---

## ioredis vs node-redis Comparison

| Feature         | ioredis (v5.x)            | node-redis (v5.x)                           |
| --------------- | ------------------------- | ------------------------------------------- |
| TypeScript      | Written in TypeScript     | TypeScript support                          |
| Cluster         | Built-in `Redis.Cluster`  | `createCluster()`                           |
| Sentinel        | Built-in                  | Built-in                                    |
| Auto-pipelining | `enableAutoPipelining`    | Not available                               |
| Lua scripting   | `defineCommand()`         | `client.eval()`                             |
| Pub/Sub         | Event-based (`message`)   | `client.subscribe()` returns async iterator |
| Streams         | Full support              | Full support                                |
| Redis Stack     | Not supported             | Full support (JSON, Search, TimeSeries)     |
| BullMQ          | Required (native support) | Not compatible                              |
| Connection      | Lazy or eager             | Must call `.connect()`                      |
| Command style   | Lowercase (`redis.set()`) | Lowercase or camelCase (`client.set()`)     |
| Downloads/week  | ~10M                      | ~7M                                         |
| Maintenance     | Community (best-effort)   | Redis team (active)                         |
