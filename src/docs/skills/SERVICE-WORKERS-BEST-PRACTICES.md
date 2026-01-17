# Service Workers Best Practices Research (2025/2026)

> **Research Date:** January 2026
> **Purpose:** Comprehensive research on Service Worker patterns, caching strategies, and PWA implementation for skill creation

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Service Worker Lifecycle](#service-worker-lifecycle)
3. [Caching Strategies](#caching-strategies)
4. [Workbox Patterns](#workbox-patterns)
5. [Essential Implementation Patterns](#essential-implementation-patterns)
6. [Update and Versioning Strategies](#update-and-versioning-strategies)
7. [Background Sync and Push Notifications](#background-sync-and-push-notifications)
8. [Framework Integration](#framework-integration)
9. [Debugging Approaches](#debugging-approaches)
10. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
11. [Sources](#sources)

---

## Core Concepts

### What is a Service Worker?

A Service Worker is a JavaScript script that runs in the background, separate from the web page, acting as a **programmable network proxy** between the browser and the network. It enables:

- **Offline functionality** - Cache assets for offline access
- **Sophisticated caching strategies** - Control how resources are fetched and cached
- **Background sync** - Queue failed network requests and retry when connectivity returns
- **Push notifications** - Receive and display notifications even when the app is closed

### Key Characteristics

1. **Event-driven**: Service workers don't run continuously - they're started when events occur and terminated when idle
2. **No DOM access**: They run on a separate thread and cannot directly manipulate the DOM
3. **HTTPS required**: For security reasons, service workers only work over HTTPS (except localhost)
4. **Scope-limited**: They can only control pages within their defined scope

### Service Worker Scope

The scope determines which URLs a service worker can control:

```typescript
// Default scope: directory where sw.js is located
// If sw.js is at /js/sw.js, default scope is /js/
await navigator.serviceWorker.register('/sw.js');

// Explicit scope
await navigator.serviceWorker.register('/sw.js', {
  scope: '/app/',
});

// Broaden scope with Service-Worker-Allowed header
// Server must send: Service-Worker-Allowed: /
await navigator.serviceWorker.register('/js/sw.js', {
  scope: '/',
});
```

**Scope Rules:**
- Default scope is the directory containing the service worker script
- A worker at `/scripts/sw.js` cannot control `/` by default
- The `Service-Worker-Allowed` response header can expand the allowed scope
- More specific scopes take precedence when multiple registrations exist

---

## Service Worker Lifecycle

The service worker lifecycle consists of distinct phases that ensure safe, predictable updates:

### Phase 1: Registration

Registration triggers the download and parsing of the service worker script:

```typescript
// Feature detection and registration
async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service workers not supported');
    return undefined;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none', // Always check for updates
    });

    console.log('SW registered:', registration.scope);
    return registration;
  } catch (error) {
    console.error('SW registration failed:', error);
    return undefined;
  }
}
```

### Phase 2: Install Event

The install event fires once per service worker version - this is the optimal time to cache essential resources:

```typescript
// sw.ts
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/styles/main.css',
  '/scripts/app.js',
  '/images/logo.svg',
];

self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('Service Worker: Installing...');

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(PRECACHE_URLS);
      })
      .catch((error) => {
        console.error('Precaching failed:', error);
        throw error; // Reject to fail installation
      })
  );
});
```

**Key Points:**
- `event.waitUntil()` signals completion - if the promise rejects, installation fails
- Failed installation means the service worker is discarded
- Successful installation moves to the "waiting" state (unless `skipWaiting` is called)

### Phase 3: Waiting State

After installation, the new service worker enters a "waiting" state:

```typescript
// Check for waiting service worker
navigator.serviceWorker.ready.then((registration) => {
  if (registration.waiting) {
    console.log('New version waiting to activate');
    // Show update notification to user
  }
});
```

**Why Waiting Exists:**
- Prevents running multiple versions simultaneously
- Protects against storage conflicts and data corruption
- Old worker continues controlling clients until all tabs close

### Phase 4: Activate Event

Activation occurs when no clients are controlled by the previous worker:

```typescript
self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('Service Worker: Activating...');

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete old version caches
              return cacheName.startsWith('static-') &&
                     cacheName !== STATIC_CACHE;
            })
            .map((cacheName) => {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        // Take control of all clients immediately
        return self.clients.claim();
      })
  );
});
```

**Activation Tasks:**
- Clean up old caches
- Migrate databases if needed
- Use `clients.claim()` to take control of uncontrolled clients

### Phase 5: Fetch Event

Once active, the service worker intercepts network requests:

```typescript
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  event.respondWith(handleRequest(request));
});

async function handleRequest(request: Request): Promise<Response> {
  // Implementation depends on caching strategy
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  return fetch(request);
}
```

---

## Caching Strategies

### 1. Cache Only

Returns responses exclusively from cache - network is never consulted.

```typescript
self.addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      // No fallback - request fails if not in cache
      return new Response('Not found in cache', { status: 404 });
    })
  );
});
```

**Use Cases:**
- Versioned static assets (hash in filename)
- Assets precached during install
- Content that never changes

### 2. Network Only

Requests bypass the cache entirely - always fetches from network.

```typescript
self.addEventListener('fetch', (event: FetchEvent) => {
  // Don't call respondWith() - let browser handle normally
  // Or explicitly fetch:
  event.respondWith(fetch(event.request));
});
```

**Use Cases:**
- Non-GET requests (POST, PUT, DELETE)
- Analytics/logging endpoints
- Real-time data that must be fresh
- Resources where caching is harmful

### 3. Cache First (Offline First)

Check cache first, fall back to network if not cached:

```typescript
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Return offline fallback if available
    return new Response('Offline', { status: 503 });
  }
}

self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.destination === 'image') {
    event.respondWith(cacheFirst(event.request, 'images-cache'));
  }
});
```

**Use Cases:**
- Static assets (CSS, JS, images)
- Fonts
- Assets with cache-busting hashes
- Content that rarely changes

**Performance:** ~50ms (cache) vs ~500ms (network)

### 4. Network First

Try network first, fall back to cache if offline:

```typescript
async function networkFirst(
  request: Request,
  cacheName: string,
  timeoutMs = 3000
): Promise<Response> {
  const cache = await caches.open(cacheName);

  try {
    // Race network against timeout
    const networkResponse = await Promise.race([
      fetch(request),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      ),
    ]);

    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed - try cache
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // No cache either - return offline page
    return caches.match('/offline.html') ||
           new Response('Offline', { status: 503 });
  }
}

self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, 'pages-cache'));
  }
});
```

**Use Cases:**
- HTML pages
- API requests
- Frequently updated content
- Content where freshness is important

### 5. Stale-While-Revalidate

Return cached version immediately, update cache in background:

```typescript
async function staleWhileRevalidate(
  request: Request,
  cacheName: string
): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Background revalidation
  const networkPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });

  // Return cached immediately, or wait for network
  return cachedResponse || networkPromise;
}

self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(event.request, 'api-cache'));
  }
});
```

**Use Cases:**
- User avatars
- Non-critical API data
- Content that should be fast but eventually consistent
- Assets where slight staleness is acceptable

### Strategy Selection Guide

| Content Type | Strategy | Reason |
|-------------|----------|--------|
| App shell HTML | Network First | Need fresh content, offline fallback |
| Static assets (versioned) | Cache First | Immutable, speed priority |
| Images | Cache First | Large, slow to download |
| Fonts | Cache First | Stable, critical for rendering |
| API (critical) | Network First | Need current data |
| API (non-critical) | Stale-While-Revalidate | Speed with eventual freshness |
| User data | Network Only | Must be real-time |
| Analytics | Network Only | Non-cacheable |

---

## Workbox Patterns

[Workbox](https://developer.chrome.com/docs/workbox/) is Google's library for simplifying service worker development.

### Installation

```bash
npm install workbox-core workbox-routing workbox-strategies workbox-precaching workbox-recipes
```

### Basic Workbox Service Worker

```typescript
// sw.ts
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setDefaultHandler } from 'workbox-routing';
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
  NetworkOnly
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Precache static assets (injected by build tool)
precacheAndRoute(self.__WB_MANIFEST);

// Navigation requests - Network First with offline fallback
const navigationHandler = new NetworkFirst({
  cacheName: 'pages-cache',
  networkTimeoutSeconds: 3,
  plugins: [
    new CacheableResponsePlugin({
      statuses: [0, 200],
    }),
  ],
});

registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/\/api\//], // Exclude API routes
  })
);

// Static assets - Cache First
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'worker',
  new CacheFirst({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Images - Cache First with limits
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true, // Automatically delete on storage pressure
      }),
    ],
  })
);

// API requests - Stale While Revalidate
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);

// Fallback for unhandled requests
setDefaultHandler(new NetworkOnly());
```

### Workbox Recipes

Workbox Recipes provide common patterns as single-line implementations:

```typescript
import {
  pageCache,
  imageCache,
  staticResourceCache,
  googleFontsCache,
  offlineFallback,
  warmStrategyCache,
} from 'workbox-recipes';
import { CacheFirst } from 'workbox-strategies';

// Network-first for HTML with 3s timeout
pageCache();

// Cache-first for Google Fonts
googleFontsCache();

// Stale-while-revalidate for CSS/JS
staticResourceCache();

// Cache-first for images (60 images, 30 days)
imageCache();

// Offline fallback page
offlineFallback({
  pageFallback: '/offline.html',
  imageFallback: '/images/offline.svg',
  fontFallback: '/fonts/fallback.woff2',
});

// Pre-warm cache with critical resources
warmStrategyCache({
  urls: ['/offline.html', '/styles/critical.css'],
  strategy: new CacheFirst(),
});
```

### Custom Strategy with Plugins

```typescript
import { Strategy, StrategyHandler } from 'workbox-strategies';

class CacheFirstWithRefresh extends Strategy {
  async _handle(
    request: Request,
    handler: StrategyHandler
  ): Promise<Response> {
    const cachedResponse = await handler.cacheMatch(request);

    // Background refresh regardless of cache hit
    const fetchPromise = handler.fetch(request).then((response) => {
      if (response.ok) {
        handler.cachePut(request, response.clone());
      }
      return response;
    });

    // Return cached if available, otherwise wait for network
    return cachedResponse || fetchPromise;
  }
}

registerRoute(
  ({ url }) => url.pathname.startsWith('/content/'),
  new CacheFirstWithRefresh({
    cacheName: 'content-cache',
  })
);
```

### Handling Fallback Responses

```typescript
import { setCatchHandler } from 'workbox-routing';
import { matchPrecache } from 'workbox-precaching';

// Global fallback handler
setCatchHandler(async ({ event }) => {
  const { request } = event;

  switch (request.destination) {
    case 'document':
      return matchPrecache('/offline.html') ||
             new Response('Offline', { status: 503 });

    case 'image':
      return matchPrecache('/images/fallback.svg') ||
             new Response('', { status: 404 });

    default:
      return Response.error();
  }
});
```

---

## Essential Implementation Patterns

### Complete Service Worker Template

```typescript
// sw.ts - Complete service worker with TypeScript
declare const self: ServiceWorkerGlobalScope;

const CACHE_VERSION = 'v1.0.0';
const CACHES = {
  static: `static-${CACHE_VERSION}`,
  pages: `pages-${CACHE_VERSION}`,
  images: `images-${CACHE_VERSION}`,
  api: `api-${CACHE_VERSION}`,
} as const;

const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/styles/app.css',
  '/scripts/app.js',
];

const MAX_CACHE_ITEMS = {
  images: 100,
  api: 50,
} as const;

// Install - precache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHES.static);
      await cache.addAll(PRECACHE_URLS);
      // Force activation without waiting
      await self.skipWaiting();
    })()
  );
});

// Activate - cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => !Object.values(CACHES).includes(name))
          .map((name) => caches.delete(name))
      );

      // Take control of all clients
      await self.clients.claim();
    })()
  );
});

// Fetch - route requests to appropriate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Route based on request type
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(request));
  } else if (request.destination === 'image') {
    event.respondWith(handleImage(request));
  } else if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApi(request));
  } else {
    event.respondWith(handleStatic(request));
  }
});

// Network First for navigation
async function handleNavigate(request: Request): Promise<Response> {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(CACHES.pages);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    const cachedResponse = await caches.match(request);
    return cachedResponse || caches.match('/offline.html')!;
  }
}

// Cache First for images with limit
async function handleImage(request: Request): Promise<Response> {
  const cache = await caches.open(CACHES.images);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Limit cache size
      await limitCacheSize(cache, MAX_CACHE_ITEMS.images);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch {
    return new Response('', { status: 404 });
  }
}

// Stale While Revalidate for API
async function handleApi(request: Request): Promise<Response> {
  const cache = await caches.open(CACHES.api);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then(async (response) => {
    if (response.ok) {
      await limitCacheSize(cache, MAX_CACHE_ITEMS.api);
      cache.put(request, response.clone());
    }
    return response;
  });

  return cachedResponse || fetchPromise;
}

// Cache First for static assets
async function handleStatic(request: Request): Promise<Response> {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);

  if (networkResponse.ok) {
    const cache = await caches.open(CACHES.static);
    cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

// Utility: limit cache size
async function limitCacheSize(cache: Cache, maxItems: number): Promise<void> {
  const keys = await cache.keys();

  if (keys.length >= maxItems) {
    // Delete oldest entries (FIFO)
    const toDelete = keys.slice(0, keys.length - maxItems + 1);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}
```

### Registration with Update Detection

```typescript
// register-sw.ts
export interface ServiceWorkerUpdate {
  waiting: ServiceWorker;
  onUpdate: () => void;
}

export async function registerServiceWorker(): Promise<ServiceWorkerUpdate | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service workers not supported');
    return null;
  }

  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none',
  });

  // Check for updates periodically
  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  setInterval(() => registration.update(), CHECK_INTERVAL_MS);

  // Handle updates
  return new Promise((resolve) => {
    // Already waiting
    if (registration.waiting) {
      resolve({
        waiting: registration.waiting,
        onUpdate: () => skipWaiting(registration.waiting!),
      });
      return;
    }

    // Installing
    if (registration.installing) {
      trackInstalling(registration.installing, resolve);
      return;
    }

    // Watch for new installations
    registration.addEventListener('updatefound', () => {
      if (registration.installing) {
        trackInstalling(registration.installing, resolve);
      }
    });
  });
}

function trackInstalling(
  worker: ServiceWorker,
  resolve: (value: ServiceWorkerUpdate | null) => void
): void {
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      resolve({
        waiting: worker,
        onUpdate: () => skipWaiting(worker),
      });
    }
  });
}

function skipWaiting(worker: ServiceWorker): void {
  worker.postMessage({ type: 'SKIP_WAITING' });
}

// In service worker - handle skip waiting message
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// In app - reload when new worker takes control
let refreshing = false;
navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (!refreshing) {
    refreshing = true;
    window.location.reload();
  }
});
```

### React Hook for Service Worker Updates

```tsx
// use-service-worker.ts
import { useState, useEffect, useCallback } from 'react';

interface UseServiceWorkerResult {
  updateAvailable: boolean;
  applyUpdate: () => void;
}

export function useServiceWorker(): UseServiceWorkerResult {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const handleUpdate = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
        setUpdateAvailable(true);
      }
    };

    navigator.serviceWorker.ready.then(handleUpdate);

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }, []);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [waitingWorker]);

  return { updateAvailable, applyUpdate };
}

// Usage in component
function App() {
  const { updateAvailable, applyUpdate } = useServiceWorker();

  return (
    <div>
      {updateAvailable && (
        <div className="update-banner">
          <p>A new version is available!</p>
          <button onClick={applyUpdate}>Update Now</button>
        </div>
      )}
      {/* Rest of app */}
    </div>
  );
}
```

---

## Update and Versioning Strategies

### Cache Versioning Pattern

```typescript
// Version your caches to manage updates
const VERSION = '1.2.0';

const CACHES = {
  static: `static-${VERSION}`,
  pages: `pages-${VERSION}`,
  images: `images-${VERSION}`,
};

// Clean up old caches during activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // Keep only current version caches
            return !Object.values(CACHES).includes(cacheName);
          })
          .map((cacheName) => {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
});
```

### Update Strategies

#### 1. Aggressive Update (skipWaiting + claim)

Immediately activate the new worker - use for critical bug fixes:

```typescript
self.addEventListener('install', (event) => {
  event.waitUntil(
    precacheAssets().then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    cleanupOldCaches().then(() => self.clients.claim())
  );
});
```

**Warning:** This can disrupt user experience by changing behavior mid-session.

#### 2. Deferred Update (User-Triggered)

Let user decide when to update:

```typescript
// sw.ts - wait for message to activate
self.addEventListener('message', (event) => {
  if (event.data?.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// app.ts - show update UI
function showUpdatePrompt(registration: ServiceWorkerRegistration) {
  const updateBanner = document.createElement('div');
  updateBanner.innerHTML = `
    <p>New version available!</p>
    <button id="update-btn">Update</button>
    <button id="dismiss-btn">Later</button>
  `;

  document.body.appendChild(updateBanner);

  document.getElementById('update-btn')?.addEventListener('click', () => {
    registration.waiting?.postMessage({ action: 'SKIP_WAITING' });
  });

  document.getElementById('dismiss-btn')?.addEventListener('click', () => {
    updateBanner.remove();
  });
}
```

#### 3. Silent Update (Runtime Caching)

For apps using mostly runtime caching, updates happen naturally:

```typescript
// No skipWaiting - let lifecycle proceed normally
// New worker activates when user closes all tabs

// Rely on network-first strategies to get fresh content
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({ cacheName: 'pages' })
);
```

### When to Show Update Prompts

**Show prompts when:**
- Using extensive precaching
- Major UI/UX changes
- Breaking API changes
- Critical security fixes

**Skip prompts when:**
- Using mostly runtime caching
- Incremental content updates
- Non-breaking changes

---

## Background Sync and Push Notifications

### Background Sync

Queue failed requests and retry when connectivity returns:

```typescript
// sw.ts
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

// Queue failed POST requests
const bgSyncPlugin = new BackgroundSyncPlugin('formQueue', {
  maxRetentionTime: 24 * 60, // 24 hours in minutes
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request);
        console.log('Replay succeeded:', entry.request.url);
      } catch (error) {
        console.error('Replay failed:', error);
        await queue.unshiftRequest(entry);
        throw error; // Re-throw to trigger retry
      }
    }
  },
});

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'POST'
);
```

### Manual Background Sync

```typescript
// Register sync event from app
async function queueFormSubmission(data: FormData): Promise<void> {
  // Store data in IndexedDB
  await storeInIndexedDB('pendingForms', data);

  // Register for background sync
  const registration = await navigator.serviceWorker.ready;
  await registration.sync.register('form-sync');
}

// sw.ts - handle sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'form-sync') {
    event.waitUntil(processPendingForms());
  }
});

async function processPendingForms(): Promise<void> {
  const forms = await getFromIndexedDB('pendingForms');

  for (const form of forms) {
    try {
      await fetch('/api/submit', {
        method: 'POST',
        body: form,
      });
      await removeFromIndexedDB('pendingForms', form.id);
    } catch {
      // Keep in queue for next sync
      throw new Error('Sync failed');
    }
  }
}
```

### Push Notifications

```typescript
// sw.ts - handle push events
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  const data = event.data.json();

  const options: NotificationOptions = {
    body: data.body,
    icon: data.icon || '/icons/notification-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
    },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      return clients.openWindow(url);
    })
  );
});
```

### Push Subscription (Client-side)

```typescript
// Subscribe to push notifications
async function subscribeToPush(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;

  // Check permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return null;
  }

  // Get existing subscription or create new
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      ),
    });
  }

  // Send subscription to server
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });

  return subscription;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
```

---

## Framework Integration

### Vite PWA Plugin

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate', // or 'prompt'
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'My PWA App',
        short_name: 'PWA',
        description: 'My Progressive Web App',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.example\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true, // Enable in development
        type: 'module',
      },
    }),
  ],
});
```

### Custom Service Worker with Vite PWA (injectManifest)

```typescript
// vite.config.ts
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
  },
});

// src/sw.ts
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// Precache assets from build
precacheAndRoute(self.__WB_MANIFEST);

// Custom routing
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({ cacheName: 'pages' })
);
```

### Next.js PWA Setup

```typescript
// app/manifest.ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'My Next.js PWA',
    short_name: 'NextPWA',
    description: 'A Progressive Web App built with Next.js',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}

// public/sw.js
const CACHE_NAME = 'next-pwa-v1';
const OFFLINE_URL = '/offline';

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([OFFLINE_URL]);
    })
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
  }
});

// components/register-sw.tsx
'use client';

import { useEffect } from 'react';

export function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered:', registration.scope);
        })
        .catch((error) => {
          console.error('SW registration failed:', error);
        });
    }
  }, []);

  return null;
}
```

---

## Debugging Approaches

### Chrome DevTools

1. **Application Panel > Service Workers**
   - View registered workers
   - Force update
   - Skip waiting manually
   - Unregister workers

2. **Key Debugging Options:**
   - **Update on reload**: Force update check on every navigation
   - **Bypass for network**: Skip service worker entirely
   - **Offline**: Simulate offline mode

3. **Cache Storage Panel**
   - Inspect cached resources
   - Delete individual cache entries
   - Clear all caches

### Common Debugging Issues

```typescript
// Issue: Requests bypass service worker
// Solution: Ensure "Disable cache" in Network panel is unchecked

// Issue: Service worker not updating
// Solution: Check for byte differences or force update
registration.update();

// Issue: Fetch events not firing
// Solution: Verify scope and registration
console.log('SW scope:', registration.scope);
console.log('SW state:', registration.active?.state);
```

### Workbox Debugging

```typescript
// Enable verbose logging in development
import { setConfig } from 'workbox-core';

if (process.env.NODE_ENV === 'development') {
  setConfig({
    debug: true,
  });
}
```

### Debugging URLs

- `chrome://inspect/#service-workers` - All running service workers
- `chrome://serviceworker-internals/` - Detailed SW internals

### Logging Patterns

```typescript
// sw.ts - structured logging
const LOG_PREFIX = '[SW]';

function log(message: string, data?: unknown): void {
  console.log(`${LOG_PREFIX} ${message}`, data || '');
}

self.addEventListener('install', (event) => {
  log('Installing version:', CACHE_VERSION);
  // ...
});

self.addEventListener('fetch', (event) => {
  log('Fetch:', {
    url: event.request.url,
    mode: event.request.mode,
    destination: event.request.destination,
  });
  // ...
});
```

---

## Anti-Patterns to Avoid

### 1. Never Change Service Worker URL

```typescript
// BAD: Versioned SW URLs create infinite loops
navigator.serviceWorker.register('/sw-v1.js');
navigator.serviceWorker.register('/sw-v2.js'); // User may never get this

// GOOD: Keep same URL, version caches internally
navigator.serviceWorker.register('/sw.js');
```

### 2. Don't Store State in Global Variables

```typescript
// BAD: Service workers restart frequently
let cachedData = []; // Lost on restart

self.addEventListener('fetch', (event) => {
  cachedData.push(event.request.url); // Unreliable
});

// GOOD: Use Cache API or IndexedDB
self.addEventListener('fetch', (event) => {
  event.waitUntil(
    caches.open('data-cache').then((cache) => {
      // Persistent storage
    })
  );
});
```

### 3. Avoid Unbounded Caches

```typescript
// BAD: Cache grows indefinitely
cache.put(request, response.clone()); // No limits

// GOOD: Use expiration plugins or manual limits
import { ExpirationPlugin } from 'workbox-expiration';

new CacheFirst({
  plugins: [
    new ExpirationPlugin({
      maxEntries: 50,
      maxAgeSeconds: 30 * 24 * 60 * 60,
      purgeOnQuotaError: true,
    }),
  ],
});
```

### 4. Don't Precache Everything

```typescript
// BAD: Precache entire app
const PRECACHE = [
  '/',
  '/about',
  '/contact',
  '/products',
  '/products/1',
  '/products/2',
  // ... hundreds more
];

// GOOD: Precache only critical assets
const PRECACHE = [
  '/',
  '/offline.html',
  '/styles/critical.css',
  '/scripts/app.js',
];
// Use runtime caching for everything else
```

### 5. Always Handle Errors

```typescript
// BAD: No error handling
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// GOOD: Proper fallbacks
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match('/offline.html');
    })
  );
});
```

### 6. Don't Skip Waiting Unconditionally in Production

```typescript
// BAD: Always skip waiting - can break user sessions
self.addEventListener('install', () => {
  self.skipWaiting(); // Risky in production
});

// GOOD: User-triggered updates
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

### 7. Handle Opaque Responses Carefully

```typescript
// BAD: Cache opaque responses without limits
registerRoute(
  ({ url }) => url.origin !== location.origin,
  new CacheFirst() // Opaque responses use ~7MB each
);

// GOOD: Limit or avoid caching opaque responses
registerRoute(
  ({ url }) => url.origin !== location.origin,
  new NetworkFirst({
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10, // Strict limit
      }),
    ],
  })
);
```

### 8. Don't Ignore the Scope

```typescript
// BAD: SW at /scripts/sw.js trying to control /
navigator.serviceWorker.register('/scripts/sw.js', {
  scope: '/', // Won't work without Service-Worker-Allowed header
});

// GOOD: Place SW at the root
navigator.serviceWorker.register('/sw.js', {
  scope: '/',
});
```

---

## Sources

### Official Documentation
- [MDN: Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
- [MDN: Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [web.dev: Service Worker Lifecycle](https://web.dev/articles/service-worker-lifecycle)
- [Chrome: Workbox](https://developer.chrome.com/docs/workbox/)
- [Chrome: Workbox Caching Strategies](https://developer.chrome.com/docs/workbox/caching-strategies-overview)
- [Chrome: Workbox Recipes](https://developer.chrome.com/docs/workbox/modules/workbox-recipes)
- [Chrome: Workbox Strategies](https://developer.chrome.com/docs/workbox/modules/workbox-strategies)
- [Next.js PWA Guide](https://nextjs.org/docs/app/guides/progressive-web-apps)

### Tutorials and Guides
- [Service Worker Lifecycle Complete Guide](https://codesamplez.com/front-end/service-worker-lifecycle-guide)
- [Service Worker Lifecycle Explained](https://felixgerschau.com/service-worker-lifecycle-update/)
- [Handling Service Worker Updates](https://whatwebcando.today/articles/handling-service-worker-updates/)
- [Chrome: Handling Service Worker Updates](https://developer.chrome.com/docs/workbox/handling-service-worker-updates)
- [web.dev: Workbox](https://web.dev/learn/pwa/workbox)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/guide/)

### Caching Strategies
- [MDN: Caching - PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching)
- [Service Worker Caching Strategies](https://dev.to/pahanperera/service-worker-caching-strategies-1dib)
- [Caching Strategies in PWA](https://borstch.com/blog/caching-strategies-in-pwa-cache-first-network-first-stale-while-revalidate-etc)

### Background Sync and Push
- [Chrome: Periodic Background Sync](https://developer.chrome.com/docs/capabilities/periodic-background-sync)
- [PWA Workshop: Background Sync](https://pwa-workshop.js.org/6-background-sync/)
- [Advanced Service Worker Features](https://codesamplez.com/front-end/advanced-service-worker-features)
- [Using Push Notifications in PWAs](https://www.magicbell.com/blog/using-push-notifications-in-pwas)

### Debugging
- [Chrome: Debug PWAs](https://developer.chrome.com/docs/devtools/progressive-web-apps)
- [Chrome: Debug Background Services](https://developer.chrome.com/docs/devtools/javascript/background-services)
- [Chrome: Workbox Troubleshooting](https://developer.chrome.com/docs/workbox/troubleshooting-and-logging)
- [Debug PWAs with Chrome DevTools](https://www.zeepalm.com/blog/debug-pwas-chrome-devtools)
- [Tips for Debugging Service Workers](https://blog.openreplay.com/tips-tricks-debugging-service-workers/)

### Framework Integration
- [Vite PWA Plugin GitHub](https://github.com/vite-pwa/vite-plugin-pwa)
- [Building PWA with Serwist](https://javascript.plainenglish.io/building-a-progressive-web-app-pwa-in-next-js-with-serwist-next-pwa-successor-94e05cb418d7)
- [Next.js PWA in 2025](https://medium.com/@jakobwgnr/how-to-build-a-next-js-pwa-in-2025-f334cd9755df)
- [FreeCodeCamp: Implement Service Worker with Workbox](https://www.freecodecamp.org/news/implement-a-service-worker-with-workbox-in-a-pwa/)
