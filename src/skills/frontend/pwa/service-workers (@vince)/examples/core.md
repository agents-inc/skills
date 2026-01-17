# Service Worker Core Examples

> Core code examples for Service Worker lifecycle and registration. See [SKILL.md](../SKILL.md) for concepts.

**Extended patterns:** See [caching.md](caching.md) and [updates.md](updates.md) for caching strategies and update handling.

---

## Pattern 9: Complete Service Worker Template

A production-ready service worker with all lifecycle handlers, caching strategies, and proper error handling.

```typescript
// sw.ts - Complete service worker template
declare const self: ServiceWorkerGlobalScope;

// ============================================================================
// CONSTANTS
// ============================================================================

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
const LOG_PREFIX = "[SW]";

// ============================================================================
// UTILITIES
// ============================================================================

function log(message: string, ...args: unknown[]): void {
  console.log(`${LOG_PREFIX} ${message}`, ...args);
}

function logError(message: string, ...args: unknown[]): void {
  console.error(`${LOG_PREFIX} ${message}`, ...args);
}

async function limitCacheSize(cache: Cache, maxItems: number): Promise<void> {
  const keys = await cache.keys();

  if (keys.length > maxItems) {
    const deleteCount = keys.length - maxItems;
    const toDelete = keys.slice(0, deleteCount);

    await Promise.all(
      toDelete.map((request) => {
        log("Evicting:", request.url);
        return cache.delete(request);
      })
    );
  }
}

// ============================================================================
// CACHING STRATEGIES
// ============================================================================

async function cacheFirst(request: Request, cacheName: CacheName): Promise<Response> {
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
  timeoutMs: number = NETWORK_TIMEOUT_MS
): Promise<Response> {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await Promise.race([
      fetch(request),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Network timeout")), timeoutMs)
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
  cacheName: CacheName
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
  maxItems: number
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

// ============================================================================
// LIFECYCLE HANDLERS
// ============================================================================

// Install - precache critical assets
self.addEventListener("install", (event: ExtendableEvent) => {
  log("Installing version:", CACHE_VERSION);

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHES.static);

      // Add all precache URLs, handling failures gracefully
      const results = await Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(url))
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        logError("Failed to precache some assets:", failed);
      }

      log("Precached", PRECACHE_URLS.length - failed.length, "assets");
    })()
  );
});

// Activate - cleanup old caches
self.addEventListener("activate", (event: ExtendableEvent) => {
  log("Activating version:", CACHE_VERSION);

  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const currentCaches = Object.values(CACHES);

      await Promise.all(
        cacheNames
          .filter((name) => !currentCaches.includes(name))
          .map((name) => {
            log("Deleting old cache:", name);
            return caches.delete(name);
          })
      );

      await self.clients.claim();
      log("Claimed all clients");
    })()
  );
});

// Fetch - route to strategies
self.addEventListener("fetch", (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Route based on request type
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, CACHES.pages));
  } else if (request.destination === "image") {
    event.respondWith(cacheFirstWithLimit(request, CACHES.images, MAX_CACHE_ITEMS.images));
  } else if (url.pathname.startsWith("/api/")) {
    event.respondWith(staleWhileRevalidate(request, CACHES.api));
  } else {
    event.respondWith(cacheFirst(request, CACHES.static));
  }
});

// Message handler for skip waiting
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data?.type === "SKIP_WAITING") {
    log("Skip waiting requested");
    self.skipWaiting();
  }
});
```

**Why good:** Complete template with all lifecycle handlers, typed constants, named exports, proper error handling, graceful precache failures, cache versioning, message handler for user-controlled updates

---

## Pattern 10: TypeScript Service Worker Types

Type definitions for service worker global scope and events.

```typescript
// types/service-worker.d.ts

// Extend ServiceWorkerGlobalScope for better type safety
declare const self: ServiceWorkerGlobalScope;

interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface FetchEvent extends ExtendableEvent {
  request: Request;
  respondWith(response: Promise<Response> | Response): void;
  clientId: string;
  resultingClientId: string;
  preloadResponse: Promise<Response | undefined>;
}

interface ExtendableMessageEvent extends ExtendableEvent {
  data: unknown;
  origin: string;
  lastEventId: string;
  source: Client | ServiceWorker | MessagePort | null;
  ports: readonly MessagePort[];
}

interface NotificationEvent extends ExtendableEvent {
  notification: Notification;
  action: string;
}

interface SyncEvent extends ExtendableEvent {
  tag: string;
  lastChance: boolean;
}

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

**Why good:** Full type coverage for service worker events, discriminated unions for messages, proper extends relationships

---

## Pattern 11: Service Worker Registration Hook

A custom hook for managing service worker registration state.

```typescript
// hooks/use-service-worker.ts
import { useState, useEffect, useCallback } from "react";

interface UseServiceWorkerReturn {
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
  applyUpdate: () => void;
  isSupported: boolean;
  error: Error | null;
}

const SW_PATH = "/sw.js";
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function useServiceWorker(): UseServiceWorkerReturn {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const isSupported = "serviceWorker" in navigator;

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
  }, [waitingWorker]);

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    let intervalId: ReturnType<typeof setInterval>;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register(SW_PATH, {
          scope: "/",
          updateViaCache: "none",
        });

        setRegistration(reg);

        // Check for updates periodically
        intervalId = setInterval(() => {
          reg.update();
        }, UPDATE_CHECK_INTERVAL_MS);

        // Handle waiting worker
        const handleWaiting = (worker: ServiceWorker) => {
          setWaitingWorker(worker);
          setUpdateAvailable(true);
        };

        if (reg.waiting) {
          handleWaiting(reg.waiting);
        }

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              handleWaiting(installing);
            }
          });
        });

        // Reload on controller change
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Registration failed"));
      }
    };

    register();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isSupported]);

  return {
    registration,
    updateAvailable,
    applyUpdate,
    isSupported,
    error,
  };
}

export { useServiceWorker };
export type { UseServiceWorkerReturn };
```

**Why good:** Encapsulates registration complexity, tracks update state, provides applyUpdate callback, handles cleanup, proper error handling, named exports

---

## Pattern 12: Update Banner Component

UI component to notify users of available updates.

```typescript
// components/update-banner.tsx
import { useServiceWorker } from "../hooks/use-service-worker";

function UpdateBanner() {
  const { updateAvailable, applyUpdate } = useServiceWorker();

  if (!updateAvailable) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="update-banner" // Style with your styling solution
    >
      <p>A new version is available!</p>
      <div>
        <button
          type="button"
          onClick={applyUpdate}
          aria-label="Update to new version now"
        >
          Update Now
        </button>
        <button
          type="button"
          onClick={() => {
            // Dismiss banner - update will apply on next visit
          }}
          aria-label="Dismiss update notification"
        >
          Later
        </button>
      </div>
    </div>
  );
}

export { UpdateBanner };
```

**Why good:** Uses the hook for state, accessible with role and aria attributes, clear user actions, named export

---

## Pattern 13: Offline Detection Hook

Track online/offline status for UI updates.

```typescript
// hooks/use-online-status.ts
import { useState, useEffect } from "react";

function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

export { useOnlineStatus };
```

### Usage with Offline Indicator

```typescript
// components/offline-indicator.tsx
import { useOnlineStatus } from "../hooks/use-online-status";

function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="offline-indicator" // Style with your styling solution
    >
      <span aria-hidden="true">!</span>
      <span>You are currently offline</span>
    </div>
  );
}

export { OfflineIndicator };
```

**Why good:** SSR-safe with typeof check, proper cleanup, accessible announcements, named exports
