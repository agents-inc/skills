# Service Worker - Caching Examples

> Advanced caching strategy examples for Service Workers. See [SKILL.md](../SKILL.md) for concepts and [core.md](core.md) for core lifecycle patterns.

---

## Pattern 5: Cache-First with Background Refresh

Return cached immediately but refresh in background for next request. Useful for content that's acceptable stale for current visit but should be fresh on next.

```typescript
async function cacheFirstWithBackgroundRefresh(
  request: Request,
  cacheName: string,
): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Always try to refresh in background
  const refreshPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  if (cachedResponse) {
    return cachedResponse; // Return stale, refresh happens in background
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

**Why good:** Immediate response from cache, background refresh keeps cache fresh for next visit, handles cache miss gracefully

---

## Pattern 6: Cache with Expiration

Track cache entry timestamps via IndexedDB and expire old entries. Useful when content has a known maximum staleness tolerance.

```typescript
const EXPIRATION_DB_NAME = "cache-expiration";
const EXPIRATION_STORE_NAME = "timestamps";

const MAX_AGE_SECONDS = {
  api: 5 * 60, // 5 minutes
  images: 30 * 24 * 60 * 60, // 30 days
  static: 7 * 24 * 60 * 60, // 7 days
} as const;

async function cacheFirstWithExpiration(
  request: Request,
  cacheName: string,
  maxAgeSeconds: number,
): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    const expired = await isCacheExpired(request.url, maxAgeSeconds);
    if (!expired) {
      return cachedResponse;
    }
  }

  const networkResponse = await fetch(request);

  if (networkResponse.ok) {
    await cacheWithTimestamp(cache, request, networkResponse);
  }

  return networkResponse;
}

async function cacheWithTimestamp(
  cache: Cache,
  request: Request,
  response: Response,
): Promise<void> {
  await cache.put(request, response.clone());

  const db = await openExpirationDB();
  const tx = db.transaction(EXPIRATION_STORE_NAME, "readwrite");
  tx.objectStore(EXPIRATION_STORE_NAME).put({
    url: request.url,
    timestamp: Date.now(),
  });
}

async function isCacheExpired(
  url: string,
  maxAgeSeconds: number,
): Promise<boolean> {
  try {
    const db = await openExpirationDB();
    const tx = db.transaction(EXPIRATION_STORE_NAME, "readonly");
    const entry = await tx.objectStore(EXPIRATION_STORE_NAME).get(url);

    if (!entry) return true;

    const ageMs = Date.now() - entry.timestamp;
    return ageMs > maxAgeSeconds * 1000;
  } catch {
    return true; // On error, treat as expired
  }
}

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

export { cacheFirstWithExpiration, MAX_AGE_SECONDS };
```

**Why good:** Per-content-type expiration, IndexedDB for persistent timestamps, handles missing timestamps, named constants

---

## Pattern 7: Selective API Caching

Route API requests to different caching strategies based on endpoint patterns. First matching config wins.

```typescript
type ApiCacheConfig = {
  pattern: RegExp;
  strategy: "network-first" | "stale-while-revalidate" | "cache-first";
  maxAgeSeconds: number;
  maxEntries: number;
};

const API_CACHE_NAME = "api-cache";

const API_CACHE_CONFIG: ApiCacheConfig[] = [
  {
    pattern: /\/api\/users\/me$/,
    strategy: "stale-while-revalidate",
    maxAgeSeconds: 5 * 60,
    maxEntries: 1,
  },
  {
    pattern: /\/api\/products/,
    strategy: "cache-first",
    maxAgeSeconds: 60 * 60,
    maxEntries: 50,
  },
  {
    pattern: /\/api\/search/,
    strategy: "network-first",
    maxAgeSeconds: 60,
    maxEntries: 20,
  },
  {
    pattern: /\/api\//,
    strategy: "network-first",
    maxAgeSeconds: 5 * 60,
    maxEntries: 100,
  },
];

function findCacheConfig(url: string): ApiCacheConfig | null {
  return API_CACHE_CONFIG.find((config) => config.pattern.test(url)) ?? null;
}

async function handleApiRequest(request: Request): Promise<Response> {
  const config = findCacheConfig(request.url);
  if (!config) return fetch(request);

  // Dispatch to strategy implementation (see core.md Pattern 2)
  switch (config.strategy) {
    case "cache-first":
      return cacheFirst(request, API_CACHE_NAME);
    case "network-first":
      return networkFirst(request, API_CACHE_NAME);
    case "stale-while-revalidate":
      return staleWhileRevalidate(request, API_CACHE_NAME);
  }
}

export { handleApiRequest, API_CACHE_CONFIG };
export type { ApiCacheConfig };
```

**Why good:** Declarative config, pattern-based routing, first match wins, typed config, clean dispatch

---

## Pattern 8: Navigation Preload

Fetch navigation requests in parallel with service worker bootup. Eliminates the latency penalty of SW startup for network-first HTML pages.

```typescript
declare const self: ServiceWorkerGlobalScope;

const PAGES_CACHE = "pages-v1";

// Enable navigation preload in activate
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

// Use preloaded response in fetch handler
self.addEventListener("fetch", (event: FetchEvent) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(PAGES_CACHE);

      try {
        // Use preloaded response if available (avoids double fetch)
        const preloadResponse = await event.preloadResponse;
        if (preloadResponse) {
          cache.put(event.request, preloadResponse.clone());
          return preloadResponse;
        }

        // Fallback to normal fetch
        const networkResponse = await fetch(event.request);
        if (networkResponse.ok) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) return cachedResponse;

        const offlinePage = await caches.match("/offline.html");
        if (offlinePage) return offlinePage;

        return new Response("Offline", { status: 503 });
      }
    })(),
  );
});
```

**When to use:** Network-first HTML pages with dynamic/authenticated content. Not needed for precached app shells.

**Warning:** If you enable navigation preload, you MUST use `event.preloadResponse`. Using `fetch(event.request)` instead results in two network requests for the same resource.

---

## Pattern 9: Storage Cleanup

Monitor storage quota and clean caches when approaching limits. Prevents quota exceeded errors.

```typescript
const STORAGE_QUOTA_THRESHOLD = 0.9; // 90% of quota
const CLEANUP_PERCENTAGE = 0.3; // Remove 30% when cleaning

interface StorageEstimate {
  quota: number;
  usage: number;
  percentUsed: number;
}

async function getStorageEstimate(): Promise<StorageEstimate | null> {
  if (!navigator.storage?.estimate) return null;

  const estimate = await navigator.storage.estimate();
  const quota = estimate.quota ?? 0;
  const usage = estimate.usage ?? 0;

  return { quota, usage, percentUsed: quota > 0 ? usage / quota : 0 };
}

async function checkAndCleanup(): Promise<void> {
  const estimate = await getStorageEstimate();
  if (!estimate || estimate.percentUsed <= STORAGE_QUOTA_THRESHOLD) return;

  const cacheNames = await caches.keys();

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    const deleteCount = Math.floor(keys.length * CLEANUP_PERCENTAGE);

    if (deleteCount > 0) {
      const toDelete = keys.slice(0, deleteCount);
      await Promise.all(toDelete.map((key) => cache.delete(key)));
    }
  }
}

export { checkAndCleanup, getStorageEstimate };
export type { StorageEstimate };
```

**Why good:** Uses Storage API for quota awareness, configurable thresholds, FIFO cleanup, prevents quota exceeded errors
