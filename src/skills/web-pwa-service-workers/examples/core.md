# Service Worker - Core Examples

> Core code examples for Service Worker lifecycle and registration. See [SKILL.md](../SKILL.md) for concepts.

**Extended patterns:** See [caching.md](caching.md) for advanced caching strategies and [updates.md](updates.md) for update handling.

---

## Pattern 1: Service Worker Registration

Complete client-side registration with update detection, user-controlled updates, and reload on controller change.

```typescript
// register-service-worker.ts
const SW_PATH = "/sw.js";
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

interface ServiceWorkerState {
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
  applyUpdate: () => void;
}

async function registerServiceWorker(): Promise<ServiceWorkerState> {
  if (!("serviceWorker" in navigator)) {
    return {
      registration: null,
      updateAvailable: false,
      applyUpdate: () => {},
    };
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_PATH, {
      scope: "/",
      updateViaCache: "none",
    });

    // Check for updates periodically
    setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS);

    let updateAvailable = false;
    let waitingWorker: ServiceWorker | null = null;

    const handleUpdate = (worker: ServiceWorker) => {
      waitingWorker = worker;
      updateAvailable = true;
      window.dispatchEvent(new CustomEvent("sw-update-available"));
    };

    if (registration.waiting) {
      handleUpdate(registration.waiting);
    }

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;

      installing.addEventListener("statechange", () => {
        if (
          installing.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          handleUpdate(installing);
        }
      });
    });

    // Reload when new worker takes control
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    return {
      registration,
      updateAvailable,
      applyUpdate: () => waitingWorker?.postMessage({ type: "SKIP_WAITING" }),
    };
  } catch (error) {
    console.error("Service Worker registration failed:", error);
    return {
      registration: null,
      updateAvailable: false,
      applyUpdate: () => {},
    };
  }
}

export { registerServiceWorker };
export type { ServiceWorkerState };
```

**Why good:** Feature detection, periodic update checks, tracks waiting worker for user-controlled updates, handles controller change to reload, dispatches custom event for UI notification

---

## Pattern 2: Complete Service Worker Template

A production-ready service worker with all lifecycle handlers, caching strategies, and proper error handling.

```typescript
// sw.ts - Complete service worker template
declare const self: ServiceWorkerGlobalScope;

// ---- Constants ----

const CACHE_VERSION = "v1.0.0";

const CACHES = {
  static: `static-${CACHE_VERSION}`,
  pages: `pages-${CACHE_VERSION}`,
  images: `images-${CACHE_VERSION}`,
  api: `api-${CACHE_VERSION}`,
} as const;

type CacheName = (typeof CACHES)[keyof typeof CACHES];

const PRECACHE_URLS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/styles/app.css",
  "/scripts/app.js",
  "/images/logo.svg",
] as const;

const MAX_CACHE_ITEMS = {
  images: 100,
  api: 50,
} as const;

const NETWORK_TIMEOUT_MS = 3000;

// ---- Utilities ----

async function limitCacheSize(cache: Cache, maxItems: number): Promise<void> {
  const keys = await cache.keys();

  if (keys.length > maxItems) {
    const deleteCount = keys.length - maxItems;
    const toDelete = keys.slice(0, deleteCount);

    await Promise.all(toDelete.map((request) => cache.delete(request)));
  }
}

// ---- Caching Strategies ----

async function cacheFirst(
  request: Request,
  cacheName: CacheName,
): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);

  if (networkResponse.ok) {
    cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

async function networkFirst(
  request: Request,
  cacheName: CacheName,
  timeoutMs: number = NETWORK_TIMEOUT_MS,
): Promise<Response> {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await Promise.race([
      fetch(request),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Network timeout")), timeoutMs),
      ),
    ]);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    if (request.mode === "navigate") {
      const offlinePage = await caches.match("/offline.html");
      if (offlinePage) return offlinePage;
    }

    return new Response("Offline", { status: 503 });
  }
}

async function staleWhileRevalidate(
  request: Request,
  cacheName: CacheName,
): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse.ok) {
        await limitCacheSize(cache, MAX_CACHE_ITEMS.api);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetchPromise;
  if (networkResponse) {
    return networkResponse;
  }

  return new Response("No data available", { status: 503 });
}

async function cacheFirstWithLimit(
  request: Request,
  cacheName: CacheName,
  maxItems: number,
): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);

  if (networkResponse.ok) {
    await limitCacheSize(cache, maxItems - 1);
    cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

// ---- Lifecycle Handlers ----

// Install - precache critical assets
self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHES.static);
      const results = await Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(url)),
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        console.error("[SW] Failed to precache some assets:", failed);
      }
    })(),
  );
});

// Activate - cleanup old caches
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const currentCaches = Object.values(CACHES);

      await Promise.all(
        cacheNames
          .filter((name) => !currentCaches.includes(name))
          .map((name) => caches.delete(name)),
      );

      await self.clients.claim();
    })(),
  );
});

// Fetch - route to strategies
self.addEventListener("fetch", (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, CACHES.pages));
  } else if (request.destination === "image") {
    event.respondWith(
      cacheFirstWithLimit(request, CACHES.images, MAX_CACHE_ITEMS.images),
    );
  } else if (url.pathname.startsWith("/api/")) {
    event.respondWith(staleWhileRevalidate(request, CACHES.api));
  } else {
    event.respondWith(cacheFirst(request, CACHES.static));
  }
});

// Message handler for skip waiting
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
```

**Why good:** Complete template with all lifecycle handlers, typed constants, proper error handling with `Promise.allSettled`, cache versioning, message handler for user-controlled updates, cache size limits

---

## Pattern 3: TypeScript Service Worker Types

Type definitions for service worker global scope and events. Add as a `.d.ts` file in your project.

```typescript
// types/service-worker.d.ts
declare const self: ServiceWorkerGlobalScope;

// Message types for client-worker communication
type ServiceWorkerMessage =
  | { type: "SKIP_WAITING" }
  | { type: "GET_VERSION"; requestId: string }
  | { type: "CLEAR_CACHE"; cacheName: string };

type ClientMessage =
  | { type: "VERSION_RESPONSE"; version: string; requestId: string }
  | { type: "CACHE_CLEARED"; cacheName: string }
  | { type: "UPDATE_AVAILABLE"; version: string };
```

**Why good:** Discriminated unions for type-safe message passing, covers common client-worker communication patterns

---

## Pattern 4: Precache with Critical/Optional Split

Distinguish critical assets (must succeed) from optional ones (best-effort). Installation fails only if a critical asset fails.

```typescript
interface PrecacheResult {
  successful: string[];
  failed: string[];
}

const PRECACHE_URLS = [
  { url: "/", critical: true },
  { url: "/offline.html", critical: true },
  { url: "/manifest.json", critical: true },
  { url: "/styles/app.css", critical: false },
  { url: "/scripts/app.js", critical: false },
  { url: "/images/logo.svg", critical: false },
] as const;

async function precacheWithFallback(
  cacheName: string,
): Promise<PrecacheResult> {
  const cache = await caches.open(cacheName);
  const result: PrecacheResult = { successful: [], failed: [] };

  // Critical assets - fail installation if any fail
  const criticalUrls = PRECACHE_URLS.filter((p) => p.critical);
  for (const { url } of criticalUrls) {
    try {
      await cache.add(url);
      result.successful.push(url);
    } catch (error) {
      throw new Error(`Critical asset failed to cache: ${url}`);
    }
  }

  // Optional assets - best-effort
  const optionalUrls = PRECACHE_URLS.filter((p) => !p.critical);
  const optionalResults = await Promise.allSettled(
    optionalUrls.map(async ({ url }) => {
      await cache.add(url);
      return url;
    }),
  );

  optionalResults.forEach((settledResult, index) => {
    const url = optionalUrls[index].url;
    if (settledResult.status === "fulfilled") {
      result.successful.push(url);
    } else {
      result.failed.push(url);
    }
  });

  return result;
}

export { precacheWithFallback };
export type { PrecacheResult };
```

**Why good:** Critical assets fail installation, optional assets degrade gracefully, reports results for debugging
