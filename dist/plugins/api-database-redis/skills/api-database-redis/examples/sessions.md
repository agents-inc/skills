# Redis -- Session Storage Examples

> Session storage patterns with Express connect-redis and Hono manual middleware. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Connection setup, error handling
- [caching.md](caching.md) -- Cache-aside and write-through patterns
- [rate-limiting.md](rate-limiting.md) -- Rate limiting middleware integration

---

## Express Session with connect-redis

> **Note:** connect-redis v9+ only supports node-redis (not ioredis). Use node-redis `createClient()` for session storage.

```typescript
import express from "express";
import session from "express-session";
import { RedisStore } from "connect-redis";
import { createClient } from "redis";

const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_TTL_SECONDS = 86400; // 24 hours
const SESSION_PREFIX = "sess:";
const COOKIE_MAX_AGE_MS = 86400000; // 24 hours

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on("error", (err) => {
  console.error("Redis session store error:", err.message);
});
await redisClient.connect();

const app = express();

app.use(
  session({
    store: new RedisStore({
      client: redisClient,
      prefix: SESSION_PREFIX,
      ttl: SESSION_TTL_SECONDS,
    }),
    secret: SESSION_SECRET,
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something is stored
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true, // Prevent XSS access to cookie
      maxAge: COOKIE_MAX_AGE_MS,
      sameSite: "lax", // CSRF protection
    },
  }),
);

export { app };
```

**Why good:** `resave: false` prevents race conditions with parallel requests, `saveUninitialized: false` avoids empty sessions, secure cookie in production, httpOnly prevents XSS, sameSite prevents CSRF, uses node-redis as required by connect-redis v9+

---

## Hono Session Middleware (Manual)

```typescript
import type Redis from "ioredis";
import { createMiddleware } from "hono/factory";
import { getCookie, setCookie } from "hono/cookie";
import crypto from "node:crypto";

const SESSION_PREFIX = "session:";
const SESSION_TTL_SECONDS = 86400;
const SESSION_COOKIE_NAME = "sid";

function sessionMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME) ?? crypto.randomUUID();

    const key = `${SESSION_PREFIX}${sessionId}`;
    const raw = await redis.get(key);
    const session = raw ? JSON.parse(raw) : {};

    c.set("session", session);
    c.set("sessionId", sessionId);

    await next();

    // Save session after response
    const updatedSession = c.get("session");
    await redis.set(
      key,
      JSON.stringify(updatedSession),
      "EX",
      SESSION_TTL_SECONDS,
    );

    // Set cookie if new session
    if (!getCookie(c, SESSION_COOKIE_NAME)) {
      setCookie(c, SESSION_COOKIE_NAME, sessionId, {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        maxAge: SESSION_TTL_SECONDS,
      });
    }
  });
}

export { sessionMiddleware };
```

**Why good:** Creates session only when needed, HttpOnly and SameSite cookie flags for security, TTL auto-expires abandoned sessions, JSON serialization for flexible session data

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
