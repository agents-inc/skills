# Redis -- Session Storage Examples

> Session storage patterns with Express connect-redis and Hono manual middleware. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [setup.md](setup.md) -- Connection setup, error handling
- [caching.md](caching.md) -- Cache-aside and write-through patterns
- [rate-limiting.md](rate-limiting.md) -- Rate limiting middleware integration

---

## Express Session with connect-redis

```typescript
import express from "express";
import session from "express-session";
import RedisStore from "connect-redis";
import Redis from "ioredis";

const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_TTL_SECONDS = 86400; // 24 hours
const SESSION_PREFIX = "sess:";
const COOKIE_MAX_AGE_MS = 86400000; // 24 hours

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

const redisClient = new Redis(process.env.REDIS_URL!);
redisClient.on("error", (err) => {
  console.error("Redis session store error:", err.message);
});

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

**Why good:** `resave: false` prevents race conditions with parallel requests, `saveUninitialized: false` avoids empty sessions, secure cookie in production, httpOnly prevents XSS, sameSite prevents CSRF

---

## Hono Session Middleware (Manual)

```typescript
import type Redis from "ioredis";
import { createMiddleware } from "hono/factory";
import crypto from "node:crypto";

const SESSION_PREFIX = "session:";
const SESSION_TTL_SECONDS = 86400;
const SESSION_COOKIE_NAME = "sid";

function sessionMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const sessionId = c.req.cookie(SESSION_COOKIE_NAME) ?? crypto.randomUUID();

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
    if (!c.req.cookie(SESSION_COOKIE_NAME)) {
      c.header(
        "Set-Cookie",
        `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,
      );
    }
  });
}

export { sessionMiddleware };
```

**Why good:** Creates session only when needed, HttpOnly and SameSite cookie flags for security, TTL auto-expires abandoned sessions, JSON serialization for flexible session data

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
