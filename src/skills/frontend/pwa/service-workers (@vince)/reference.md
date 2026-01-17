# Service Worker Reference

> Decision frameworks, anti-patterns, and red flags for Service Worker implementation. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use Service Workers

```
Need offline functionality?
├─ YES → Is it a web application (not a simple website)?
│   ├─ YES → Service Worker ✓
│   └─ NO → Consider if browser caching is sufficient
└─ NO → Do you need sophisticated caching control?
    ├─ YES → Service Worker ✓
    └─ NO → Browser HTTP caching may be enough
```

### Caching Strategy Selection

```
Choosing a caching strategy?
├─ Is the content static and versioned (e.g., /app.abc123.js)?
│   └─ YES → Cache-first (Pattern 3)
├─ Does the content change frequently but should work offline?
│   └─ YES → Network-first with cache fallback (Pattern 4)
├─ Is speed critical but slight staleness acceptable?
│   └─ YES → Stale-while-revalidate (Pattern 5)
├─ Must content always be fresh (real-time data)?
│   └─ YES → Network-only (Pattern 17)
└─ Is it precached content that never changes?
    └─ YES → Cache-only (Pattern 16)
```

### Strategy by Content Type

| Content Type | Recommended Strategy | Rationale |
|-------------|---------------------|-----------|
| HTML pages | Network-first | Users expect fresh content |
| Static assets (hashed) | Cache-first | Hash guarantees freshness |
| Static assets (unhashed) | Stale-while-revalidate | Speed + eventual freshness |
| Images | Cache-first with limit | Speed, prevent unbounded growth |
| API responses (read) | Stale-while-revalidate | Speed + background refresh |
| API responses (user data) | Network-first | Freshness matters |
| Real-time data | Network-only | Must always be current |
| Fonts | Cache-first | Rarely change |

### Update Strategy Selection

```
How should updates be applied?
├─ Is it a critical security fix?
│   └─ YES → Aggressive update (Pattern 23) - use sparingly
├─ Does update require data migration?
│   └─ YES → Migration-aware update (Pattern 27)
├─ Want to minimize disruption?
│   └─ YES → Deferred update with user control (Pattern 24)
├─ Want automatic updates without disruption?
│   └─ YES → Update at idle time (Pattern 25)
└─ Rolling out gradually?
    └─ YES → Progressive rollout (Pattern 26)
```

---

## RED FLAGS

### High Priority Issues

- **No `event.waitUntil()` in install/activate** - Browser may terminate service worker before async operations complete, causing incomplete installations
- **Calling `skipWaiting()` unconditionally** - Users experience unexpected behavior changes mid-session
- **No cache versioning** - Old cached content persists forever, cache grows unbounded
- **Not cleaning up old caches** - Storage quota eventually exceeded, breaking the app
- **Missing offline fallback** - Users see browser error page instead of helpful offline message
- **Not checking `response.ok` before caching** - Error responses (404, 500) get cached

### Medium Priority Issues

- **No timeout on network requests** - Fetch hangs indefinitely on slow connections
- **Not cloning response before caching** - Response body can only be consumed once, causing errors
- **No cache size limits** - Unbounded growth leads to quota issues
- **Synchronous skipWaiting without user consent** - Breaks user expectations
- **Not handling all request methods** - Attempting to cache POST requests fails

### Common Mistakes

- **Caching cross-origin requests without CORS** - Opaque responses count against quota at high cost
- **Precaching too many assets** - Installation takes too long, may fail on slow connections
- **Not updating service worker file** - Browser caches SW file for 24h (HTTP caching)
- **Using `importScripts` with versioned URLs** - Must update SW file to load new scripts
- **Expecting localStorage access** - Service workers cannot access localStorage

### Gotchas & Edge Cases

- **Service workers only work over HTTPS** - Exception: localhost for development
- **Scope is determined by SW location** - `/sw.js` controls `/`, but `/scripts/sw.js` only controls `/scripts/`
- **Browser may terminate idle service workers** - Don't rely on in-memory state
- **`fetch` event fires for all requests in scope** - Including iframes, images, stylesheets
- **`clients.claim()` doesn't trigger reload** - Clients keep running with old page but new SW
- **Chrome DevTools "Update on reload" bypasses waiting** - Useful for dev, not representative of production
- **Manifest changes don't update service worker** - Only byte changes to SW file trigger update
- **IndexedDB transactions can't span await** - Complete DB work in single transaction

---

## Anti-Patterns

### Unconditional skipWaiting

Calling `skipWaiting()` immediately in the install event can cause issues when old tabs are still running.

```typescript
// WRONG - Skips waiting unconditionally
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await precache();
      await self.skipWaiting(); // BAD: Doesn't consider running clients
    })()
  );
});

// CORRECT - Let clients control when to update
self.addEventListener("install", (event) => {
  event.waitUntil(precache());
  // Don't call skipWaiting - let client trigger it
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting(); // User-controlled update
  }
});
```

### Missing waitUntil

Without `waitUntil`, the browser may terminate the service worker before async operations complete.

```typescript
// WRONG - No waitUntil
self.addEventListener("install", (event) => {
  precacheAssets(); // Browser may terminate before this completes!
});

// CORRECT - Use waitUntil
self.addEventListener("install", (event) => {
  event.waitUntil(precacheAssets());
});
```

### Caching Without Version

Without versioning, old cache entries persist indefinitely.

```typescript
// WRONG - No version in cache name
const CACHE_NAME = "app-cache";

self.addEventListener("activate", (event) => {
  // How do you know which caches to delete?
});

// CORRECT - Versioned cache names
const CACHE_VERSION = "v1.0.0";
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    )
  );
});
```

### No Response Clone Before Caching

Response bodies can only be consumed once.

```typescript
// WRONG - Uses response twice
socket.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      const response = await fetch(event.request);
      cache.put(event.request, response); // Consumes body
      return response; // Body already consumed!
    })()
  );
});

// CORRECT - Clone before caching
self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      const response = await fetch(event.request);
      cache.put(event.request, response.clone()); // Clone for cache
      return response; // Original for client
    })()
  );
});
```

### Caching Error Responses

Error responses get cached and served on subsequent requests.

```typescript
// WRONG - Caches all responses
const response = await fetch(request);
cache.put(request, response.clone()); // Caches 404, 500, etc!

// CORRECT - Only cache successful responses
const response = await fetch(request);
if (response.ok) {
  cache.put(request, response.clone());
}
```

### No Offline Fallback

Users see a browser error page when offline instead of a helpful message.

```typescript
// WRONG - No fallback
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
    // If both fail, user sees browser error
  );
});

// CORRECT - Offline fallback
self.addEventListener("fetch", (event) => {
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
        throw error;
      }
    })()
  );
});
```

### No Network Timeout

Fetch hangs indefinitely on slow connections.

```typescript
// WRONG - No timeout
const response = await fetch(request); // Hangs forever on slow network

// CORRECT - Timeout with fallback
const response = await Promise.race([
  fetch(request),
  new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000)),
]);
```

---

## Service Worker Lifecycle Reference

### Lifecycle Events

| Event | When it Fires | Common Use |
|-------|---------------|------------|
| `install` | New SW downloaded and parsed | Precache critical assets |
| `activate` | SW takes control (after waiting) | Clean up old caches |
| `fetch` | Any network request in scope | Serve cached responses |
| `message` | Client sends message | Handle skip waiting, get version |
| `push` | Push notification received | Show notification |
| `sync` | Background sync triggered | Retry failed requests |

### Registration States

| State | Description | Can Use Fetch? |
|-------|-------------|----------------|
| `installing` | Downloading and running install | No |
| `installed` | Install complete, waiting | No |
| `activating` | Running activate event | No |
| `activated` | Active and controlling | Yes |
| `redundant` | Replaced by newer SW | No |

### Cache API Methods

| Method | Description |
|--------|-------------|
| `caches.open(name)` | Open or create a cache |
| `caches.delete(name)` | Delete a cache |
| `caches.keys()` | List all cache names |
| `caches.match(request)` | Search all caches for match |
| `cache.add(url)` | Fetch and add to cache |
| `cache.addAll(urls)` | Fetch and add multiple |
| `cache.put(request, response)` | Add response to cache |
| `cache.match(request)` | Find matching response |
| `cache.delete(request)` | Remove from cache |
| `cache.keys()` | List all cached requests |

---

## Checklist

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
- [ ] Handles migration if needed

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
- [ ] Validates cached responses before use
- [ ] Handles credential requirements properly
- [ ] Doesn't cache sensitive data inappropriately

### Performance Checklist

- [ ] Precache list is minimal and critical
- [ ] Cache size limits prevent unbounded growth
- [ ] Uses appropriate strategy (not always network-first)
- [ ] Considers storage quota
