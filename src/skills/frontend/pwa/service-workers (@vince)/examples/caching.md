# Service Worker Caching Examples

> Advanced caching strategy examples for Service Workers. See [SKILL.md](../SKILL.md) for concepts and [core.md](core.md) for basic patterns.

---

## Pattern 14: Network-First with Timeout

Network-first strategy that falls back to cache quickly on slow networks.

```typescript
// strategies/network-first-with-timeout.ts

const NETWORK_TIMEOUT_MS = 3000;

async function networkFirstWithTimeout(
  request: Request,
  cacheName: string,
  timeoutMs: number = NETWORK_TIMEOUT_MS
): Promise<Response> {
  const cache = await caches.open(cacheName);

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Network timeout")), timeoutMs);
  });

  try {
    // Race network against timeout
    const networkResponse = await Promise.race([fetch(request), timeoutPromise]);

    // Cache successful responses
    if (networkResponse.ok) {
      // Don't await - cache in background
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log("[SW] Network failed or timed out, trying cache:", request.url);

    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // No cache available - return appropriate error
    if (request.mode === "navigate") {
      const offlinePage = await caches.match("/offline.html");
      if (offlinePage) return offlinePage;
    }

    throw error;
  }
}

export { networkFirstWithTimeout };
```

**Why good:** Named timeout constant, races network against timeout, background caching doesn't block response, proper fallback chain

---

## Pattern 15: Cache-First with Background Refresh

Return cached immediately but refresh in background for next request.

```typescript
// strategies/cache-first-refresh.ts

async function cacheFirstWithBackgroundRefresh(
  request: Request,
  cacheName: string
): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Always try to refresh in background
  const refreshPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
        console.log("[SW] Background refresh completed:", request.url);
      }
      return networkResponse;
    })
    .catch((error) => {
      console.log("[SW] Background refresh failed:", request.url, error);
      return null;
    });

  // Return cached if available
  if (cachedResponse) {
    return cachedResponse;
  }

  // No cache - wait for network
  const networkResponse = await refreshPromise;
  if (networkResponse) {
    return networkResponse;
  }

  throw new Error("No cached or network response available");
}

export { cacheFirstWithBackgroundRefresh };
```

**Why good:** Immediate response from cache, background refresh keeps cache fresh, handles cache miss gracefully

---

## Pattern 16: Cache-Only Strategy

Return only cached responses - never hit the network.

```typescript
// strategies/cache-only.ts

const FALLBACK_RESPONSE_STATUS = 404;

async function cacheOnly(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  // No cache available - return appropriate response
  return new Response("Not found in cache", {
    status: FALLBACK_RESPONSE_STATUS,
    statusText: "Not Found",
    headers: { "Content-Type": "text/plain" },
  });
}

export { cacheOnly };
```

**When to use:** Versioned assets with hash in filename, precached content that must be available

**Why good:** Simple and fast, appropriate fallback response, named constant for status

---

## Pattern 17: Network-Only Strategy

Bypass cache entirely - always fetch from network.

```typescript
// strategies/network-only.ts

async function networkOnly(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch (error) {
    console.error("[SW] Network request failed:", request.url, error);

    // Return offline response for navigation
    if (request.mode === "navigate") {
      const offlinePage = await caches.match("/offline.html");
      if (offlinePage) return offlinePage;
    }

    throw error;
  }
}

export { networkOnly };
```

**When to use:** Non-GET requests (POST, PUT, DELETE), analytics endpoints, real-time data that must be fresh

**Why good:** Still provides offline fallback for navigation, error handling for failed fetches

---

## Pattern 18: Cache with Expiration

Track cache entry timestamps and expire old entries.

```typescript
// strategies/cache-with-expiration.ts

interface CacheEntry {
  response: Response;
  timestamp: number;
}

const EXPIRATION_DB_NAME = "cache-expiration";
const EXPIRATION_STORE_NAME = "timestamps";

const MAX_AGE_SECONDS = {
  api: 5 * 60, // 5 minutes
  images: 30 * 24 * 60 * 60, // 30 days
  static: 7 * 24 * 60 * 60, // 7 days
} as const;

// Store timestamp when caching
async function cacheWithTimestamp(
  cache: Cache,
  request: Request,
  response: Response
): Promise<void> {
  // Clone response for caching
  await cache.put(request, response.clone());

  // Store timestamp in IndexedDB
  const db = await openExpirationDB();
  const tx = db.transaction(EXPIRATION_STORE_NAME, "readwrite");
  const store = tx.objectStore(EXPIRATION_STORE_NAME);

  await store.put({
    url: request.url,
    timestamp: Date.now(),
  });
}

// Check if cache entry is expired
async function isCacheExpired(url: string, maxAgeSeconds: number): Promise<boolean> {
  try {
    const db = await openExpirationDB();
    const tx = db.transaction(EXPIRATION_STORE_NAME, "readonly");
    const store = tx.objectStore(EXPIRATION_STORE_NAME);

    const entry = await store.get(url);
    if (!entry) {
      return true; // No timestamp = expired
    }

    const ageMs = Date.now() - entry.timestamp;
    const maxAgeMs = maxAgeSeconds * 1000;

    return ageMs > maxAgeMs;
  } catch {
    return true; // On error, treat as expired
  }
}

// Cache-first with expiration check
async function cacheFirstWithExpiration(
  request: Request,
  cacheName: string,
  maxAgeSeconds: number
): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Check if cached response is still valid
  if (cachedResponse) {
    const expired = await isCacheExpired(request.url, maxAgeSeconds);

    if (!expired) {
      return cachedResponse;
    }

    console.log("[SW] Cache expired:", request.url);
  }

  // Fetch fresh response
  const networkResponse = await fetch(request);

  if (networkResponse.ok) {
    await cacheWithTimestamp(cache, request, networkResponse);
  }

  return networkResponse;
}

// Helper to open IndexedDB
function openExpirationDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(EXPIRATION_DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EXPIRATION_STORE_NAME)) {
        db.createObjectStore(EXPIRATION_STORE_NAME, { keyPath: "url" });
      }
    };
  });
}

export { cacheFirstWithExpiration, cacheWithTimestamp, MAX_AGE_SECONDS };
```

**Why good:** Per-cache-type expiration times, IndexedDB for timestamp storage, named constants, handles missing timestamps

---

## Pattern 19: Precache with Fallback

Precache critical assets with fallback for failures.

```typescript
// precache/precache-with-fallback.ts

interface PrecacheResult {
  successful: string[];
  failed: string[];
}

const PRECACHE_URLS = [
  // Critical - must succeed
  { url: "/", critical: true },
  { url: "/offline.html", critical: true },
  { url: "/manifest.json", critical: true },

  // Optional - failures are acceptable
  { url: "/styles/app.css", critical: false },
  { url: "/scripts/app.js", critical: false },
  { url: "/images/logo.svg", critical: false },
] as const;

async function precacheWithFallback(cacheName: string): Promise<PrecacheResult> {
  const cache = await caches.open(cacheName);
  const result: PrecacheResult = {
    successful: [],
    failed: [],
  };

  // Precache critical assets first
  const criticalUrls = PRECACHE_URLS.filter((p) => p.critical);
  for (const { url } of criticalUrls) {
    try {
      await cache.add(url);
      result.successful.push(url);
    } catch (error) {
      console.error("[SW] Critical precache failed:", url, error);
      // Re-throw for critical assets - installation should fail
      throw new Error(`Critical asset failed to cache: ${url}`);
    }
  }

  // Precache optional assets with best-effort
  const optionalUrls = PRECACHE_URLS.filter((p) => !p.critical);
  const optionalResults = await Promise.allSettled(
    optionalUrls.map(async ({ url }) => {
      await cache.add(url);
      return url;
    })
  );

  optionalResults.forEach((settledResult, index) => {
    const url = optionalUrls[index].url;
    if (settledResult.status === "fulfilled") {
      result.successful.push(url);
    } else {
      console.warn("[SW] Optional precache failed:", url);
      result.failed.push(url);
    }
  });

  console.log(
    "[SW] Precache complete:",
    result.successful.length,
    "succeeded,",
    result.failed.length,
    "failed"
  );

  return result;
}

export { precacheWithFallback };
export type { PrecacheResult };
```

**Why good:** Distinguishes critical vs optional assets, fails installation only for critical failures, reports results, named exports

---

## Pattern 20: Selective API Caching

Cache API responses based on endpoint patterns.

```typescript
// strategies/selective-api-cache.ts

type ApiCacheConfig = {
  pattern: RegExp;
  strategy: "network-first" | "stale-while-revalidate" | "cache-first";
  maxAgeSeconds: number;
  maxEntries: number;
};

const API_CACHE_NAME = "api-cache";

const API_CACHE_CONFIG: ApiCacheConfig[] = [
  // User profile - stale is okay, update in background
  {
    pattern: /\/api\/users\/me$/,
    strategy: "stale-while-revalidate",
    maxAgeSeconds: 60 * 5, // 5 minutes
    maxEntries: 1,
  },

  // Product catalog - cache aggressively
  {
    pattern: /\/api\/products/,
    strategy: "cache-first",
    maxAgeSeconds: 60 * 60, // 1 hour
    maxEntries: 50,
  },

  // Search results - always fresh
  {
    pattern: /\/api\/search/,
    strategy: "network-first",
    maxAgeSeconds: 60, // 1 minute fallback
    maxEntries: 20,
  },

  // Default for other API calls
  {
    pattern: /\/api\//,
    strategy: "network-first",
    maxAgeSeconds: 60 * 5, // 5 minutes
    maxEntries: 100,
  },
];

function findCacheConfig(url: string): ApiCacheConfig | null {
  for (const config of API_CACHE_CONFIG) {
    if (config.pattern.test(url)) {
      return config;
    }
  }
  return null;
}

async function handleApiRequest(request: Request): Promise<Response> {
  const config = findCacheConfig(request.url);

  if (!config) {
    // No caching rule - pass through
    return fetch(request);
  }

  switch (config.strategy) {
    case "cache-first":
      return cacheFirst(request, API_CACHE_NAME);
    case "network-first":
      return networkFirst(request, API_CACHE_NAME);
    case "stale-while-revalidate":
      return staleWhileRevalidate(request, API_CACHE_NAME);
    default:
      return fetch(request);
  }
}

// Import strategy implementations from other modules
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  // Implementation from Pattern 3
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request: Request, cacheName: string): Promise<Response> {
  // Implementation from Pattern 4
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("Network and cache both failed");
  }
}

async function staleWhileRevalidate(
  request: Request,
  cacheName: string
): Promise<Response> {
  // Implementation from Pattern 5
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });

  return cached || fetchPromise;
}

export { handleApiRequest, API_CACHE_CONFIG };
export type { ApiCacheConfig };
```

**Why good:** Pattern-based configuration, different strategies per endpoint, typed config, first match wins, named exports

---

## Pattern 21: Cache Storage Cleanup

Clean up storage when approaching quota limits.

```typescript
// cleanup/storage-cleanup.ts

const STORAGE_QUOTA_THRESHOLD = 0.9; // 90% of quota
const CLEANUP_PERCENTAGE = 0.3; // Remove 30% when cleaning

interface StorageEstimate {
  quota: number;
  usage: number;
  percentUsed: number;
}

async function getStorageEstimate(): Promise<StorageEstimate | null> {
  if (!navigator.storage?.estimate) {
    return null;
  }

  const estimate = await navigator.storage.estimate();
  const quota = estimate.quota ?? 0;
  const usage = estimate.usage ?? 0;
  const percentUsed = quota > 0 ? usage / quota : 0;

  return { quota, usage, percentUsed };
}

async function shouldCleanup(): Promise<boolean> {
  const estimate = await getStorageEstimate();
  if (!estimate) return false;

  return estimate.percentUsed > STORAGE_QUOTA_THRESHOLD;
}

async function cleanupCaches(): Promise<void> {
  const cacheNames = await caches.keys();

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    const deleteCount = Math.floor(keys.length * CLEANUP_PERCENTAGE);

    if (deleteCount > 0) {
      // Delete oldest entries
      const toDelete = keys.slice(0, deleteCount);
      await Promise.all(toDelete.map((key) => cache.delete(key)));

      console.log(`[SW] Cleaned ${deleteCount} entries from ${cacheName}`);
    }
  }
}

async function checkAndCleanup(): Promise<void> {
  const needsCleanup = await shouldCleanup();

  if (needsCleanup) {
    console.log("[SW] Storage quota threshold reached, cleaning up...");
    await cleanupCaches();

    const estimate = await getStorageEstimate();
    console.log("[SW] After cleanup:", estimate?.percentUsed.toFixed(2), "% used");
  }
}

export { checkAndCleanup, getStorageEstimate };
export type { StorageEstimate };
```

**Why good:** Uses Storage API for quota awareness, configurable thresholds, FIFO cleanup, logs cleanup actions

---

## Pattern 22: Navigation Preload

Fetch navigation requests in parallel with service worker bootup to reduce latency for network-first HTML.

```typescript
// sw.ts - Navigation preload for network-first HTML

declare const self: ServiceWorkerGlobalScope;

const PAGES_CACHE = "pages-v1";

// Enable navigation preload in activate
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // Feature detection - not all browsers support this
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
        console.log("[SW] Navigation preload enabled");
      }

      await self.clients.claim();
    })()
  );
});

// Use preloaded response in fetch handler
self.addEventListener("fetch", (event: FetchEvent) => {
  if (event.request.mode !== "navigate") {
    return; // Only handle navigation requests
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(PAGES_CACHE);

      try {
        // Use preloaded response if available (avoids double fetch)
        const preloadResponse = await event.preloadResponse;
        if (preloadResponse) {
          console.log("[SW] Using preloaded response:", event.request.url);
          // Cache for offline fallback
          cache.put(event.request, preloadResponse.clone());
          return preloadResponse;
        }

        // Fallback to normal fetch if preload not available
        const networkResponse = await fetch(event.request);
        if (networkResponse.ok) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        console.log("[SW] Navigation failed, trying cache:", event.request.url);

        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Return offline page
        const offlinePage = await caches.match("/offline.html");
        if (offlinePage) return offlinePage;

        throw error;
      }
    })()
  );
});
```

**When to use:** Network-first HTML pages with dynamic content that cannot be precached (e.g., authenticated pages, personalized content). Not needed for precached app shells.

**Why good:** Uses feature detection, avoids double fetch by using `event.preloadResponse`, caches response for offline fallback, proper error handling chain

**Warning:** If you enable navigation preload, you MUST use `event.preloadResponse`. Using `fetch(event.request)` instead results in two network requests for the same resource.
