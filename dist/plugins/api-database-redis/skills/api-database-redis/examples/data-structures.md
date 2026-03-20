# Redis -- Data Structure Examples

> Typed helpers for strings, hashes, lists, sets, and sorted sets. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [caching.md](caching.md) -- Cache-aside and write-through patterns
- [core.md](core.md) -- Connection setup, pipelining, transactions
- [rate-limiting.md](rate-limiting.md) -- Sorted sets for sliding window rate limiting

---

## Strings (Key-Value)

```typescript
import type Redis from "ioredis";

const DEFAULT_TTL_SECONDS = 3600; // 1 hour

async function setWithTTL(
  redis: Redis,
  key: string,
  value: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  await redis.set(key, value, "EX", ttlSeconds);
}

async function getOrNull(redis: Redis, key: string): Promise<string | null> {
  return redis.get(key);
}

export { setWithTTL, getOrNull };
```

---

## Hashes (Object-like)

```typescript
import type Redis from "ioredis";

interface UserProfile {
  name: string;
  email: string;
  role: string;
}

const USER_KEY_PREFIX = "user:";
const USER_TTL_SECONDS = 1800; // 30 minutes

async function setUserProfile(
  redis: Redis,
  userId: string,
  profile: UserProfile,
): Promise<void> {
  const key = `${USER_KEY_PREFIX}${userId}`;
  await redis.hset(key, profile);
  await redis.expire(key, USER_TTL_SECONDS);
}

async function getUserProfile(
  redis: Redis,
  userId: string,
): Promise<UserProfile | null> {
  const key = `${USER_KEY_PREFIX}${userId}`;
  const data = await redis.hgetall(key);
  if (!data || Object.keys(data).length === 0) {
    return null;
  }
  return data as UserProfile;
}

export { setUserProfile, getUserProfile };
```

**Why good:** Key prefix separates concerns, TTL prevents stale data, null check on empty hash response, typed return

**Gotcha:** `hgetall` returns an empty object `{}` for non-existent keys, not `null`. Always check `Object.keys(data).length === 0`. All values come back as strings -- numbers need explicit `parseInt`/`parseFloat`.

---

## Sorted Sets (Leaderboards, Rankings)

```typescript
import type Redis from "ioredis";

const LEADERBOARD_KEY = "leaderboard:global";
const TOP_PLAYERS_COUNT = 10;

async function updateScore(
  redis: Redis,
  playerId: string,
  score: number,
): Promise<void> {
  await redis.zadd(LEADERBOARD_KEY, score, playerId);
}

async function getTopPlayers(
  redis: Redis,
): Promise<Array<{ playerId: string; score: number }>> {
  // ZREVRANGE returns highest scores first
  // Note: ZREVRANGE is deprecated since Redis 6.2 in favor of ZRANGE ... REV,
  // but ioredis provides typed support for zrevrange
  const results = await redis.zrevrange(
    LEADERBOARD_KEY,
    0,
    TOP_PLAYERS_COUNT - 1,
    "WITHSCORES",
  );

  const players: Array<{ playerId: string; score: number }> = [];
  for (let i = 0; i < results.length; i += 2) {
    players.push({
      playerId: results[i],
      score: parseFloat(results[i + 1]),
    });
  }
  return players;
}

async function getPlayerRank(
  redis: Redis,
  playerId: string,
): Promise<number | null> {
  // ZREVRANK returns 0-based rank (highest score = rank 0)
  const rank = await redis.zrevrank(LEADERBOARD_KEY, playerId);
  return rank !== null ? rank + 1 : null; // Convert to 1-based
}

export { updateScore, getTopPlayers, getPlayerRank };
```

**Why good:** Named constants for key and count, ZREVRANGE for descending order, WITHSCORES returns scores alongside members, 1-based rank conversion for user display

---

## Lists (Queues, Recent Items)

```typescript
import type Redis from "ioredis";

const RECENT_ITEMS_KEY = "recent:items";
const MAX_RECENT_ITEMS = 50;

async function addRecentItem(redis: Redis, item: string): Promise<void> {
  await redis
    .pipeline()
    .lpush(RECENT_ITEMS_KEY, item)
    .ltrim(RECENT_ITEMS_KEY, 0, MAX_RECENT_ITEMS - 1)
    .exec();
}

async function getRecentItems(redis: Redis): Promise<string[]> {
  return redis.lrange(RECENT_ITEMS_KEY, 0, MAX_RECENT_ITEMS - 1);
}

export { addRecentItem, getRecentItems };
```

**Why good:** Pipeline groups push and trim into single round-trip, LTRIM caps list size preventing unbounded growth, named constants for key and limit

---

## Sets (Unique Collections)

```typescript
import type Redis from "ioredis";

const TAG_KEY_PREFIX = "tags:";

async function addTags(
  redis: Redis,
  entityId: string,
  tags: string[],
): Promise<void> {
  if (tags.length === 0) return;
  const key = `${TAG_KEY_PREFIX}${entityId}`;
  await redis.sadd(key, ...tags);
}

async function getTags(redis: Redis, entityId: string): Promise<string[]> {
  return redis.smembers(`${TAG_KEY_PREFIX}${entityId}`);
}

async function getCommonTags(
  redis: Redis,
  entityId1: string,
  entityId2: string,
): Promise<string[]> {
  return redis.sinter(
    `${TAG_KEY_PREFIX}${entityId1}`,
    `${TAG_KEY_PREFIX}${entityId2}`,
  );
}

export { addTags, getTags, getCommonTags };
```

**Why good:** Sets automatically deduplicate, SINTER finds common elements without application logic, spread operator for variadic SADD

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
