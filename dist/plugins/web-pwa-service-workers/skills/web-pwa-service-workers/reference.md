# Service Worker Reference

> Decision frameworks, anti-patterns, and red flags for Service Worker implementation. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use Service Workers

```
Need offline functionality?
├─ YES → Is it a web application (not a simple website)?
│   ├─ YES → Service Worker
│   └─ NO → Consider if browser caching is sufficient
└─ NO → Do you need sophisticated caching control?
    ├─ YES → Service Worker
    └─ NO → Browser HTTP caching may be enough
```

### Caching Strategy Selection

```
Choosing a caching strategy?
├─ Is the content static and versioned (e.g., /app.abc123.js)?
│   └─ YES → Cache-first
├─ Does the content change frequently but should work offline?
│   └─ YES → Network-first with cache fallback
├─ Is speed critical but slight staleness acceptable?
│   └─ YES → Stale-while-revalidate
├─ Must content always be fresh (real-time data)?
│   └─ YES → Network-only
└─ Is it precached content that never changes?
    └─ YES → Cache-only
```

### Strategy by Content Type

| Content Type              | Recommended Strategy   | Rationale                       |
| ------------------------- | ---------------------- | ------------------------------- |
| HTML pages                | Network-first          | Users expect fresh content      |
| Static assets (hashed)    | Cache-first            | Hash guarantees freshness       |
| Static assets (unhashed)  | Stale-while-revalidate | Speed + eventual freshness      |
| Images                    | Cache-first with limit | Speed, prevent unbounded growth |
| API responses (read)      | Stale-while-revalidate | Speed + background refresh      |
| API responses (user data) | Network-first          | Freshness matters               |
| Real-time data            | Network-only           | Must always be current          |
| Fonts                     | Cache-first            | Rarely change                   |

### Update Strategy Selection

```
How should updates be applied?
├─ Is it a critical security fix?
│   └─ YES → Aggressive update (Pattern 11) - use sparingly
├─ Does update require data migration?
│   └─ YES → Migration-aware update (Pattern 15)
├─ Want to minimize disruption?
│   └─ YES → Deferred update with user control (Pattern 12)
├─ Want automatic updates without disruption?
│   └─ YES → Update at idle time (Pattern 13)
└─ Rolling out gradually?
    └─ YES → Progressive rollout (Pattern 14)
```

---

## Anti-Patterns

### Unconditional skipWaiting

```typescript
// WRONG - Skips waiting unconditionally
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await precache();
      await self.skipWaiting(); // BAD: Doesn't consider running clients
    })(),
  );
});

// CORRECT - Let clients control when to update
self.addEventListener("install", (event) => {
  event.waitUntil(precache());
  // Don't call skipWaiting - let client trigger via message
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
```

### Missing waitUntil

```typescript
// WRONG - Browser may terminate before completion
self.addEventListener("install", (event) => {
  precacheAssets(); // No waitUntil!
});

// CORRECT
self.addEventListener("install", (event) => {
  event.waitUntil(precacheAssets());
});
```

### Caching Without Version

```typescript
// WRONG - No version in cache name
const CACHE_NAME = "app-cache";
// How do you know which caches to delete on upgrade?

// CORRECT - Versioned cache names
const CACHE_VERSION = "v1.0.0";
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;
```

### No Response Clone Before Caching

```typescript
// WRONG - Response body consumed twice
const response = await fetch(event.request);
cache.put(event.request, response); // Consumes body
return response; // Body already consumed!

// CORRECT - Clone for cache, original for client
const response = await fetch(event.request);
cache.put(event.request, response.clone());
return response;
```

### Caching Error Responses

```typescript
// WRONG - Caches 404, 500, etc
const response = await fetch(request);
cache.put(request, response.clone());

// CORRECT - Only cache successful responses
const response = await fetch(request);
if (response.ok) {
  cache.put(request, response.clone());
}
```

### No Offline Fallback

```typescript
// WRONG - No fallback, user sees browser error page
event.respondWith(
  caches.match(event.request).then((cached) => cached || fetch(event.request)),
);

// CORRECT - Offline fallback for navigation
event.respondWith(
  (async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    try {
      return await fetch(event.request);
    } catch {
      if (event.request.mode === "navigate") {
        return caches.match("/offline.html");
      }
      throw new Error("Offline");
    }
  })(),
);
```

---

## Service Worker Lifecycle Reference

### Lifecycle Events

| Event      | When it Fires                    | Common Use                                     |
| ---------- | -------------------------------- | ---------------------------------------------- |
| `install`  | New SW downloaded and parsed     | Precache critical assets                       |
| `activate` | SW takes control (after waiting) | Clean up old caches, enable navigation preload |
| `fetch`    | Any network request in scope     | Serve cached responses                         |
| `message`  | Client sends message             | Handle skip waiting, get version               |
| `push`     | Push notification received       | Show notification                              |
| `sync`     | Background sync triggered        | Retry failed requests                          |

### Registration States

| State        | Description                     | Can Intercept Fetch? |
| ------------ | ------------------------------- | -------------------- |
| `installing` | Downloading and running install | No                   |
| `installed`  | Install complete, waiting       | No                   |
| `activating` | Running activate event          | No                   |
| `activated`  | Active and controlling          | Yes                  |
| `redundant`  | Replaced by newer SW            | No                   |

### Cache API Methods

| Method                         | Description                 |
| ------------------------------ | --------------------------- |
| `caches.open(name)`            | Open or create a cache      |
| `caches.delete(name)`          | Delete a cache              |
| `caches.keys()`                | List all cache names        |
| `caches.match(request)`        | Search all caches for match |
| `cache.add(url)`               | Fetch and add to cache      |
| `cache.addAll(urls)`           | Fetch and add multiple      |
| `cache.put(request, response)` | Add response to cache       |
| `cache.match(request)`         | Find matching response      |
| `cache.delete(request)`        | Remove from cache           |
| `cache.keys()`                 | List all cached requests    |

### Navigation Preload API

| Method                                                 | Description                                           |
| ------------------------------------------------------ | ----------------------------------------------------- |
| `registration.navigationPreload.enable()`              | Enable navigation preloading                          |
| `registration.navigationPreload.disable()`             | Disable navigation preloading                         |
| `registration.navigationPreload.setHeaderValue(value)` | Set custom `Service-Worker-Navigation-Preload` header |
| `event.preloadResponse`                                | Promise resolving to preloaded Response               |

**When to use:** Network-first HTML pages where content cannot be precached (dynamic/authenticated pages). Not needed for precached app shells.

**Warning:** If you enable navigation preload, you MUST use `event.preloadResponse` in your fetch handler. Using `fetch(event.request)` instead results in double requests.

---

## Checklists

### Registration Checklist

- [ ] Feature detection (`'serviceWorker' in navigator`)
- [ ] Proper scope configuration
- [ ] Error handling for registration failure
- [ ] Update check interval configured
- [ ] Controller change listener for reload

### Installation Checklist

- [ ] Uses `event.waitUntil()`
- [ ] Precaches critical assets
- [ ] Handles precache failures gracefully
- [ ] Does NOT call `skipWaiting()` unconditionally

### Activation Checklist

- [ ] Uses `event.waitUntil()`
- [ ] Cleans up old versioned caches
- [ ] Calls `clients.claim()` if needed

### Fetch Checklist

- [ ] Skips non-GET requests
- [ ] Handles cross-origin appropriately
- [ ] Uses appropriate strategy per content type
- [ ] Checks `response.ok` before caching
- [ ] Clones response before caching
- [ ] Has offline fallback for navigation
- [ ] Has timeout for network requests

### Update Checklist

- [ ] Users can see update is available
- [ ] Users can control when to apply update
- [ ] Page reloads after update takes effect
- [ ] Old service worker state cleaned up

### Security Checklist

- [ ] Only serves over HTTPS (except localhost)
- [ ] Doesn't cache sensitive data inappropriately
- [ ] Handles credential requirements properly
