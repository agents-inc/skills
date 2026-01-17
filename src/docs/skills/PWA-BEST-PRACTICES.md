# Progressive Web App Best Practices

> Research document for creating atomic PWA skills
> Last updated: 2026-01-15

## Table of Contents

1. [Service Worker Patterns](#1-service-worker-patterns)
2. [Caching Strategies](#2-caching-strategies)
3. [Offline Functionality](#3-offline-functionality)
4. [Push Notifications](#4-push-notifications)
5. [Install Prompts](#5-install-prompts)
6. [Web App Manifest](#6-web-app-manifest)
7. [Background Sync](#7-background-sync)
8. [IndexedDB Patterns](#8-indexeddb-patterns)
9. [Workbox Patterns](#9-workbox-patterns)
10. [PWA Testing Strategies](#10-pwa-testing-strategies)

---

## 1. Service Worker Patterns

Service workers are scripts that run in the background, separate from web pages, enabling features like offline support, push notifications, and background sync.

### Core Patterns

#### Basic Service Worker Registration

```typescript
// service-worker-registration.ts
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none', // Always check for updates
    });

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available - notify user
          dispatchEvent(new CustomEvent('sw-update-available'));
        }
      });
    });

    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}
```

#### Service Worker Lifecycle Management

```typescript
// sw.ts - Service Worker file
declare const self: ServiceWorkerGlobalScope;

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;

// Install event - precache critical assets
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll([
        '/',
        '/index.html',
        '/styles/main.css',
        '/scripts/main.js',
        '/offline.html',
      ]);
      // Skip waiting to activate immediately
      await self.skipWaiting();
    })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      // Take control of all clients immediately
      await self.clients.claim();
    })()
  );
});

// Fetch event - intercept network requests
self.addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(handleFetch(event.request));
});

async function handleFetch(request: Request): Promise<Response> {
  // Implementation varies by caching strategy
  const cachedResponse = await caches.match(request);
  return cachedResponse ?? fetch(request);
}
```

#### Update Notification Pattern

```typescript
// update-notifier.ts
export function setupUpdateNotifier(): void {
  let refreshing = false;

  // Detect controller change (new SW activated)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  // Listen for update available event
  window.addEventListener('sw-update-available', () => {
    if (confirm('A new version is available. Reload to update?')) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
      });
    }
  });
}

// In sw.ts - handle skip waiting message
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

### Anti-Patterns

```typescript
// BAD: Caching too much
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Don't cache everything - leads to storage issues
      return cache.addAll([
        '/',
        '/all-images/*', // Avoid wildcards
        '/videos/*',     // Large files shouldn't be precached
      ]);
    })
  );
});

// BAD: Not versioning cache
const CACHE_NAME = 'my-cache'; // No version = stale content

// BAD: Blocking install with non-critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/critical.js',
        '/analytics.js', // Non-critical - shouldn't block install
        '/third-party.js',
      ]);
    })
  );
});

// BAD: Not handling fetch errors
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request)); // No fallback!
});
```

### When to Use vs When Not to Use

| Use When | Avoid When |
|----------|------------|
| Building apps requiring offline support | Simple static sites with no dynamic content |
| Need to cache API responses | Server-rendered apps where freshness is critical |
| Want push notification support | Sites with constantly changing content |
| Building installable PWAs | When HTTPS is not available |
| Need background sync capabilities | Simple landing pages |

---

## 2. Caching Strategies

Caching strategies determine how a PWA responds to network requests and handles offline scenarios.

### Core Patterns

#### Cache-First (Cache Falling Back to Network)

Best for: Static assets, fonts, images that rarely change.

```typescript
// cache-first-strategy.ts
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    // Only cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Return offline fallback if available
    return caches.match('/offline.html') as Promise<Response>;
  }
}

// Usage in service worker
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

  // Apply cache-first to static assets
  if (request.destination === 'image' ||
      request.destination === 'font' ||
      request.url.includes('/static/')) {
    event.respondWith(cacheFirst(request, 'static-cache-v1'));
  }
});
```

#### Network-First (Network Falling Back to Cache)

Best for: API requests, dynamic content, user-specific data.

```typescript
// network-first-strategy.ts
const NETWORK_TIMEOUT_MS = 3000;

async function networkFirst(
  request: Request,
  cacheName: string,
  timeoutMs: number = NETWORK_TIMEOUT_MS
): Promise<Response> {
  const cache = await caches.open(cacheName);

  try {
    // Race network against timeout
    const networkResponse = await Promise.race([
      fetch(request),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Network timeout')), timeoutMs)
      ),
    ]);

    // Update cache with fresh response
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // Fallback to cache
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Usage for API requests
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

  if (request.url.includes('/api/')) {
    event.respondWith(networkFirst(request, 'api-cache-v1'));
  }
});
```

#### Stale-While-Revalidate

Best for: Content needing fast load with background updates (news feeds, dashboards).

```typescript
// stale-while-revalidate-strategy.ts
async function staleWhileRevalidate(
  request: Request,
  cacheName: string
): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Start network fetch (don't await)
  const networkFetch = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
        // Optionally notify clients of update
        notifyClientsOfUpdate(request.url);
      }
      return networkResponse;
    })
    .catch(() => cachedResponse);

  // Return cached immediately, or wait for network
  return cachedResponse ?? networkFetch;
}

async function notifyClientsOfUpdate(url: string): Promise<void> {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'CACHE_UPDATED',
      url,
    });
  });
}
```

#### Cache-Only and Network-Only

```typescript
// cache-only-strategy.ts
// Use for precached app shell assets
async function cacheOnly(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const response = await cache.match(request);
  if (!response) {
    throw new Error(`Cache miss for: ${request.url}`);
  }
  return response;
}

// network-only-strategy.ts
// Use for non-GET requests, analytics, real-time data
async function networkOnly(request: Request): Promise<Response> {
  return fetch(request);
}
```

#### Strategy Router Pattern

```typescript
// strategy-router.ts
type CacheStrategy = 'cache-first' | 'network-first' | 'stale-while-revalidate' | 'cache-only' | 'network-only';

interface RouteConfig {
  pattern: RegExp;
  strategy: CacheStrategy;
  cacheName: string;
  options?: {
    networkTimeoutMs?: number;
    maxAgeSeconds?: number;
    maxEntries?: number;
  };
}

const ROUTES: RouteConfig[] = [
  { pattern: /\/api\//, strategy: 'network-first', cacheName: 'api-cache' },
  { pattern: /\.(png|jpg|svg|webp)$/, strategy: 'cache-first', cacheName: 'images' },
  { pattern: /\.(js|css)$/, strategy: 'stale-while-revalidate', cacheName: 'assets' },
  { pattern: /\/analytics/, strategy: 'network-only', cacheName: '' },
];

function getStrategy(request: Request): RouteConfig | undefined {
  return ROUTES.find((route) => route.pattern.test(request.url));
}

self.addEventListener('fetch', (event: FetchEvent) => {
  const route = getStrategy(event.request);
  if (!route) return;

  switch (route.strategy) {
    case 'cache-first':
      event.respondWith(cacheFirst(event.request, route.cacheName));
      break;
    case 'network-first':
      event.respondWith(networkFirst(event.request, route.cacheName));
      break;
    case 'stale-while-revalidate':
      event.respondWith(staleWhileRevalidate(event.request, route.cacheName));
      break;
    // ... other strategies
  }
});
```

### Anti-Patterns

```typescript
// BAD: Same strategy for all content
self.addEventListener('fetch', (event) => {
  // Using cache-first for everything serves stale API data
  event.respondWith(cacheFirst(event.request, 'single-cache'));
});

// BAD: No cache expiration
async function cacheFirstNoExpiry(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  return cached ?? fetch(request); // Cached forever!
}

// BAD: Caching POST requests
self.addEventListener('fetch', (event) => {
  // POST requests should NOT be cached
  event.respondWith(caches.match(event.request));
});

// BAD: Not checking response validity
async function unsafeCache(request: Request): Promise<Response> {
  const response = await fetch(request);
  // Caching error responses!
  await cache.put(request, response.clone());
  return response;
}
```

### When to Use Each Strategy

| Strategy | Use Case | Trade-off |
|----------|----------|-----------|
| Cache-First | Static assets, fonts, images | Fast but may serve stale content |
| Network-First | User data, API responses | Fresh but slower on poor connections |
| Stale-While-Revalidate | News feeds, dashboards | Fast and eventually fresh |
| Cache-Only | App shell, precached assets | Guaranteed offline but never updates |
| Network-Only | Analytics, real-time data | Always fresh but fails offline |

---

## 3. Offline Functionality

Offline-first design treats the local device as the primary source of truth, with network as background optimization.

### Core Patterns

#### Offline Detection

```typescript
// offline-detector.ts
export function createOfflineDetector(): {
  isOnline: () => boolean;
  subscribe: (callback: (online: boolean) => void) => () => void;
} {
  let online = navigator.onLine;
  const listeners = new Set<(online: boolean) => void>();

  const updateStatus = (status: boolean): void => {
    online = status;
    listeners.forEach((callback) => callback(status));
  };

  window.addEventListener('online', () => updateStatus(true));
  window.addEventListener('offline', () => updateStatus(false));

  return {
    isOnline: () => online,
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
}

// React hook
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const detector = createOfflineDetector();
    return detector.subscribe(setIsOnline);
  }, []);

  return isOnline;
}
```

#### Offline Queue Pattern

```typescript
// offline-queue.ts
interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
  retries: number;
}

const MAX_RETRIES = 3;
const QUEUE_STORE = 'offline-queue';

export class OfflineQueue {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    this.db = await this.openDatabase();
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('OfflineQueueDB', 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async enqueue(request: Request): Promise<string> {
    const id = crypto.randomUUID();
    const queuedRequest: QueuedRequest = {
      id,
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: request.body ? await request.text() : undefined,
      timestamp: Date.now(),
      retries: 0,
    };

    await this.saveToStore(queuedRequest);
    return id;
  }

  async processQueue(): Promise<void> {
    const requests = await this.getAllQueued();

    for (const queuedRequest of requests) {
      try {
        await this.replay(queuedRequest);
        await this.removeFromStore(queuedRequest.id);
      } catch (error) {
        if (queuedRequest.retries >= MAX_RETRIES) {
          await this.removeFromStore(queuedRequest.id);
          console.error('Request failed after max retries:', queuedRequest.url);
        } else {
          await this.incrementRetries(queuedRequest.id);
        }
      }
    }
  }

  private async replay(queuedRequest: QueuedRequest): Promise<Response> {
    const request = new Request(queuedRequest.url, {
      method: queuedRequest.method,
      headers: queuedRequest.headers,
      body: queuedRequest.body,
    });
    return fetch(request);
  }

  // IndexedDB operations...
  private async saveToStore(request: QueuedRequest): Promise<void> {
    // Implementation
  }

  private async getAllQueued(): Promise<QueuedRequest[]> {
    // Implementation
    return [];
  }

  private async removeFromStore(id: string): Promise<void> {
    // Implementation
  }

  private async incrementRetries(id: string): Promise<void> {
    // Implementation
  }
}
```

#### Optimistic UI Pattern

```typescript
// optimistic-mutation.ts
interface OptimisticMutation<T> {
  id: string;
  type: 'create' | 'update' | 'delete';
  data: T;
  status: 'pending' | 'synced' | 'failed';
  timestamp: number;
}

export function useOptimisticMutation<T extends { id: string }>(
  queryKey: string[],
  mutationFn: (data: T) => Promise<T>
) {
  const queryClient = useQueryClient();
  const offlineQueue = useRef(new OfflineQueue());

  return useMutation({
    mutationFn: async (data: T) => {
      // Try network first
      if (navigator.onLine) {
        return mutationFn(data);
      }
      // Queue for later
      await offlineQueue.current.enqueue(
        new Request('/api/items', {
          method: 'POST',
          body: JSON.stringify(data),
        })
      );
      return { ...data, _pending: true };
    },

    onMutate: async (newData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<T[]>(queryKey);

      // Optimistically update
      queryClient.setQueryData<T[]>(queryKey, (old) => {
        return [...(old ?? []), { ...newData, _optimistic: true }];
      });

      return { previousData };
    },

    onError: (err, newData, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
```

#### Offline Fallback Page

```typescript
// sw.ts - Offline fallback handling
const OFFLINE_PAGE = '/offline.html';
const OFFLINE_IMAGE = '/offline-image.svg';

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

  // Navigation requests - show offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open('offline-cache');
        return cache.match(OFFLINE_PAGE) as Promise<Response>;
      })
    );
    return;
  }

  // Image requests - show placeholder
  if (request.destination === 'image') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open('offline-cache');
        return cache.match(OFFLINE_IMAGE) as Promise<Response>;
      })
    );
    return;
  }
});
```

### Anti-Patterns

```typescript
// BAD: Ignoring offline state in UI
function SaveButton({ onSave }: { onSave: () => void }) {
  // No feedback about offline state
  return <button onClick={onSave}>Save</button>;
}

// GOOD: Show offline indicator
function SaveButton({ onSave }: { onSave: () => void }) {
  const isOnline = useOnlineStatus();
  return (
    <button onClick={onSave} disabled={!isOnline}>
      {isOnline ? 'Save' : 'Offline - Will sync later'}
    </button>
  );
}

// BAD: Not handling conflict resolution
async function syncData(local: Data, remote: Data): Promise<Data> {
  // Just overwrites - loses data!
  return remote;
}

// GOOD: Implement conflict resolution
async function syncDataWithConflictResolution(
  local: Data,
  remote: Data
): Promise<Data> {
  if (local.updatedAt > remote.updatedAt) {
    return local; // Last-write-wins
  }
  if (local.version !== remote.version) {
    // Handle conflict - could merge or prompt user
    return mergeConflicts(local, remote);
  }
  return remote;
}

// BAD: Unbounded offline queue
class UnboundedQueue {
  async enqueue(request: Request) {
    // Queue grows forever - storage issues!
    await this.store(request);
  }
}

// GOOD: Bounded queue with expiration
class BoundedQueue {
  private readonly MAX_ITEMS = 100;
  private readonly MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

  async enqueue(request: Request) {
    await this.pruneOldEntries();
    await this.enforceLimit();
    await this.store(request);
  }
}
```

### When to Use vs When Not to Use

| Use When | Avoid When |
|----------|------------|
| Users need to work without connectivity | Real-time collaboration is critical |
| Data can be synced eventually | Data must be immediately consistent |
| App is used in low-connectivity areas | Server-side validation is mandatory |
| User actions should never be lost | Security requires online verification |
| Content is primarily consumed offline | Fresh data is always required |

---

## 4. Push Notifications

Push notifications re-engage users with timely, relevant information even when the browser is closed.

### Core Patterns

#### VAPID Key Generation and Setup

```typescript
// vapid-setup.ts
// Generate keys with: npx web-push generate-vapid-keys

export const VAPID_PUBLIC_KEY = 'BEl62iUYgU...'; // Your public key

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
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

#### Permission Request Pattern

```typescript
// push-permission.ts
export async function requestPushPermission(): Promise<NotificationPermission> {
  // Check if push is supported
  if (!('PushManager' in window)) {
    throw new Error('Push notifications not supported');
  }

  // Check current permission
  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  // Request permission
  return Notification.requestPermission();
}

// React component - request on user action, not page load
function NotificationOptIn() {
  const [permission, setPermission] = useState(Notification.permission);
  const [loading, setLoading] = useState(false);

  const handleEnableNotifications = async () => {
    setLoading(true);
    try {
      const result = await requestPushPermission();
      setPermission(result);

      if (result === 'granted') {
        await subscribeToPush();
      }
    } finally {
      setLoading(false);
    }
  };

  if (permission === 'granted') {
    return <span>Notifications enabled</span>;
  }

  if (permission === 'denied') {
    return <span>Notifications blocked. Enable in browser settings.</span>;
  }

  return (
    <button onClick={handleEnableNotifications} disabled={loading}>
      {loading ? 'Enabling...' : 'Enable Notifications'}
    </button>
  );
}
```

#### Push Subscription

```typescript
// push-subscription.ts
export async function subscribeToPush(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;

  // Check existing subscription
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true, // Required - must show notification
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  // Send subscription to server
  await sendSubscriptionToServer(subscription);

  return subscription;
}

async function sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
        auth: arrayBufferToBase64(subscription.getKey('auth')),
      },
    }),
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
```

#### Service Worker Push Handler

```typescript
// sw.ts - Push event handling
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;

  const data = event.data.json() as {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: Record<string, unknown>;
    actions?: Array<{ action: string; title: string }>;
  };

  const options: NotificationOptions = {
    body: data.body,
    icon: data.icon ?? '/icons/notification-192.png',
    badge: data.badge ?? '/icons/badge-72.png',
    tag: data.tag ?? 'default',
    data: data.data,
    actions: data.actions,
    requireInteraction: false,
    silent: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data as { url?: string };

  // Handle action buttons
  if (action === 'view') {
    event.waitUntil(clients.openWindow(data.url ?? '/'));
  } else if (action === 'dismiss') {
    // Just close notification
  } else {
    // Default click - open app
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((windowClients) => {
        // Focus existing window or open new
        for (const client of windowClients) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow('/');
      })
    );
  }
});
```

#### Server-Side Push (Node.js)

```typescript
// push-server.ts
import webPush from 'web-push';

webPush.setVapidDetails(
  'mailto:support@example.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export async function sendPushNotification(
  subscription: webPush.PushSubscription,
  payload: PushPayload
): Promise<void> {
  try {
    await webPush.sendNotification(subscription, JSON.stringify(payload));
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 410) {
      // Subscription expired - remove from database
      await removeSubscription(subscription.endpoint);
    }
    throw error;
  }
}
```

### Anti-Patterns

```typescript
// BAD: Requesting permission immediately on page load
window.addEventListener('load', () => {
  Notification.requestPermission(); // Annoying! Users will deny
});

// GOOD: Request after user engagement
function enableNotificationsButton() {
  // Only show after user has engaged with app
  return <button onClick={requestPushPermission}>Enable Notifications</button>;
}

// BAD: Too many notifications
async function sendAllNotifications() {
  for (const user of users) {
    await sendPushNotification(user.subscription, {
      title: 'Update!',
      body: 'Check out our new feature!', // Spammy!
    });
  }
}

// GOOD: Respect frequency limits
const MAX_DAILY_NOTIFICATIONS = 1;
const MAX_WEEKLY_NOTIFICATIONS = 5;

async function sendRateLimitedNotification(userId: string, payload: PushPayload) {
  const dailyCount = await getDailyNotificationCount(userId);
  const weeklyCount = await getWeeklyNotificationCount(userId);

  if (dailyCount >= MAX_DAILY_NOTIFICATIONS || weeklyCount >= MAX_WEEKLY_NOTIFICATIONS) {
    return; // Skip notification
  }

  await sendPushNotification(await getSubscription(userId), payload);
}

// BAD: Generic, non-personalized messages
const genericNotification = {
  title: 'New Update',
  body: 'Something happened on our site!',
};

// GOOD: Personalized, actionable messages
const personalizedNotification = {
  title: 'Your order shipped!',
  body: 'Order #12345 is on its way. Tap to track.',
  data: { orderId: '12345', url: '/orders/12345' },
};
```

### When to Use vs When Not to Use

| Use When | Avoid When |
|----------|------------|
| Time-sensitive information | Marketing messages without value |
| User-initiated alerts (order updates) | High-frequency updates |
| Re-engagement is valuable | Users haven't opted in |
| Content is personalized | Generic announcements |
| Action is required | Information is not urgent |

---

## 5. Install Prompts

Custom install prompts provide better UX than browser defaults by explaining app benefits.

### Core Patterns

#### Capturing the beforeinstallprompt Event

```typescript
// install-prompt.ts
let deferredPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function setupInstallPrompt(
  onPromptAvailable: () => void,
  onInstalled: () => void
): () => void {
  const handleBeforeInstallPrompt = (event: Event) => {
    // Prevent default browser prompt
    event.preventDefault();
    // Save event for later
    deferredPrompt = event as BeforeInstallPromptEvent;
    // Notify app that install is available
    onPromptAvailable();
  };

  const handleAppInstalled = () => {
    deferredPrompt = null;
    onInstalled();
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);

  return () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', handleAppInstalled);
  };
}

export async function triggerInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) {
    return 'unavailable';
  }

  // Show browser prompt
  await deferredPrompt.prompt();

  // Wait for user choice
  const { outcome } = await deferredPrompt.userChoice;

  // Can only use prompt once
  deferredPrompt = null;

  return outcome;
}
```

#### React Hook for Install Prompt

```typescript
// use-install-prompt.ts
interface InstallPromptState {
  isInstallable: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  triggerInstall: () => Promise<void>;
}

export function useInstallPrompt(): InstallPromptState {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  useEffect(() => {
    return setupInstallPrompt(
      () => setIsInstallable(true),
      () => {
        setIsInstalled(true);
        setIsInstallable(false);
      }
    );
  }, []);

  const triggerInstall = useCallback(async () => {
    const result = await triggerInstallPrompt();
    if (result === 'accepted') {
      setIsInstalled(true);
    }
    setIsInstallable(false);
  }, []);

  return {
    isInstallable,
    isInstalled,
    isStandalone,
    triggerInstall,
  };
}
```

#### Install Banner Component

```typescript
// install-banner.tsx
interface InstallBannerProps {
  appName: string;
  description: string;
  iconSrc: string;
}

export function InstallBanner({ appName, description, iconSrc }: InstallBannerProps) {
  const { isInstallable, isStandalone, triggerInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('install-banner-dismissed') === 'true';
  });

  // Don't show if already installed or dismissed
  if (!isInstallable || isStandalone || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('install-banner-dismissed', 'true');
  };

  const handleInstall = async () => {
    await triggerInstall();
  };

  return (
    <div className={styles.installBanner}>
      <img src={iconSrc} alt={appName} className={styles.icon} />
      <div className={styles.content}>
        <h3 className={styles.title}>Install {appName}</h3>
        <p className={styles.description}>{description}</p>
      </div>
      <div className={styles.actions}>
        <button onClick={handleDismiss} className={styles.dismissButton}>
          Not now
        </button>
        <button onClick={handleInstall} className={styles.installButton}>
          Install
        </button>
      </div>
    </div>
  );
}
```

#### iOS Install Instructions (Safari)

```typescript
// ios-install-instructions.tsx
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isSafari(): boolean {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function IOSInstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show on iOS Safari, not in standalone mode
    if (isIOS() && isSafari() && !isInStandaloneMode()) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className={styles.iosPrompt}>
      <p>
        To install this app, tap{' '}
        <span className={styles.shareIcon}>⬆️</span> and then{' '}
        <strong>"Add to Home Screen"</strong>
      </p>
      <button onClick={() => setShow(false)}>Dismiss</button>
    </div>
  );
}
```

#### Strategic Prompt Timing

```typescript
// strategic-prompt.ts
interface PromptTrigger {
  type: 'engagement' | 'conversion' | 'return-visit' | 'feature-use';
  threshold: number;
}

const PROMPT_TRIGGERS: PromptTrigger[] = [
  { type: 'engagement', threshold: 3 }, // After 3 page views
  { type: 'conversion', threshold: 1 }, // After first purchase
  { type: 'return-visit', threshold: 2 }, // On second visit
  { type: 'feature-use', threshold: 5 }, // After using 5 features
];

class InstallPromptManager {
  private metrics: Map<string, number> = new Map();

  trackEvent(type: PromptTrigger['type']): void {
    const current = this.metrics.get(type) ?? 0;
    this.metrics.set(type, current + 1);
  }

  shouldShowPrompt(): boolean {
    return PROMPT_TRIGGERS.some(
      (trigger) => (this.metrics.get(trigger.type) ?? 0) >= trigger.threshold
    );
  }
}
```

### Anti-Patterns

```typescript
// BAD: Showing prompt immediately
useEffect(() => {
  triggerInstallPrompt(); // No context! Users will dismiss
}, []);

// GOOD: Show after engagement
useEffect(() => {
  const unsubscribe = onUserCompletesPurchase(() => {
    // User is engaged - good time to prompt
    showInstallBanner();
  });
  return unsubscribe;
}, []);

// BAD: No explanation of benefits
function BadInstallPrompt() {
  return <button onClick={triggerInstall}>Install</button>;
}

// GOOD: Explain value proposition
function GoodInstallPrompt() {
  return (
    <div>
      <h3>Install for offline access</h3>
      <ul>
        <li>Works without internet</li>
        <li>Faster loading</li>
        <li>Easy access from home screen</li>
      </ul>
      <button onClick={triggerInstall}>Install App</button>
    </div>
  );
}

// BAD: Prompting repeatedly after dismissal
function PersistentPrompt() {
  const { isInstallable, triggerInstall } = useInstallPrompt();
  // Shows every time - annoying!
  return isInstallable ? <button onClick={triggerInstall}>Install</button> : null;
}

// GOOD: Respect dismissal
function RespectfulPrompt() {
  const { isInstallable, triggerInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem('dismissed') === 'true'
  );

  if (!isInstallable || dismissed) return null;

  return (
    <div>
      <button onClick={triggerInstall}>Install</button>
      <button onClick={() => {
        setDismissed(true);
        localStorage.setItem('dismissed', 'true');
      }}>
        Not now
      </button>
    </div>
  );
}
```

### When to Use vs When Not to Use

| Use When | Avoid When |
|----------|------------|
| User is engaged with the app | First visit with no context |
| After meaningful interaction | Immediately on page load |
| User will benefit from installation | App provides little offline value |
| Can explain clear benefits | No clear value proposition |
| Strategic moments (post-purchase) | Random or frequent prompting |

---

## 6. Web App Manifest

The manifest provides metadata for installable PWAs, defining appearance and behavior.

### Core Patterns

#### Complete Manifest Example

```json
{
  "name": "My Progressive Web App",
  "short_name": "MyPWA",
  "description": "A comprehensive PWA example with offline support",
  "id": "/",
  "start_url": "/?source=pwa",
  "scope": "/",
  "display": "standalone",
  "display_override": ["window-controls-overlay", "standalone", "browser"],
  "orientation": "any",
  "theme_color": "#1a1a2e",
  "background_color": "#ffffff",
  "categories": ["productivity", "utilities"],
  "lang": "en-US",
  "dir": "ltr",
  "icons": [
    {
      "src": "/icons/icon-72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-152.png",
      "sizes": "152x152",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-384.png",
      "sizes": "384x384",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/icon.svg",
      "sizes": "any",
      "type": "image/svg+xml"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/desktop-home.png",
      "sizes": "1920x1080",
      "type": "image/png",
      "form_factor": "wide",
      "label": "Home screen on desktop"
    },
    {
      "src": "/screenshots/mobile-home.png",
      "sizes": "750x1334",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Home screen on mobile"
    }
  ],
  "shortcuts": [
    {
      "name": "New Document",
      "short_name": "New",
      "description": "Create a new document",
      "url": "/new?source=shortcut",
      "icons": [{ "src": "/icons/shortcut-new.png", "sizes": "96x96" }]
    },
    {
      "name": "Recent Files",
      "short_name": "Recent",
      "url": "/recent?source=shortcut",
      "icons": [{ "src": "/icons/shortcut-recent.png", "sizes": "96x96" }]
    }
  ],
  "related_applications": [
    {
      "platform": "play",
      "url": "https://play.google.com/store/apps/details?id=com.example.app",
      "id": "com.example.app"
    }
  ],
  "prefer_related_applications": false,
  "share_target": {
    "action": "/share-handler",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url",
      "files": [
        {
          "name": "media",
          "accept": ["image/*", "video/*"]
        }
      ]
    }
  },
  "protocol_handlers": [
    {
      "protocol": "web+myapp",
      "url": "/protocol?url=%s"
    }
  ],
  "file_handlers": [
    {
      "action": "/open-file",
      "accept": {
        "application/json": [".json"],
        "text/plain": [".txt", ".md"]
      }
    }
  ],
  "launch_handler": {
    "client_mode": "focus-existing"
  }
}
```

#### TypeScript Manifest Type Definition

```typescript
// manifest.types.ts
export interface WebAppManifest {
  name: string;
  short_name?: string;
  description?: string;
  id?: string;
  start_url: string;
  scope?: string;
  display: 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser';
  display_override?: Array<'fullscreen' | 'standalone' | 'minimal-ui' | 'browser' | 'window-controls-overlay'>;
  orientation?: 'any' | 'natural' | 'landscape' | 'portrait' | 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary';
  theme_color?: string;
  background_color?: string;
  icons: ManifestIcon[];
  screenshots?: ManifestScreenshot[];
  shortcuts?: ManifestShortcut[];
  categories?: string[];
  lang?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  related_applications?: RelatedApplication[];
  prefer_related_applications?: boolean;
  share_target?: ShareTarget;
  protocol_handlers?: ProtocolHandler[];
  file_handlers?: FileHandler[];
  launch_handler?: LaunchHandler;
}

export interface ManifestIcon {
  src: string;
  sizes: string;
  type?: string;
  purpose?: 'any' | 'maskable' | 'monochrome';
}

export interface ManifestScreenshot {
  src: string;
  sizes: string;
  type?: string;
  form_factor?: 'wide' | 'narrow';
  label?: string;
}

export interface ManifestShortcut {
  name: string;
  short_name?: string;
  description?: string;
  url: string;
  icons?: ManifestIcon[];
}

export interface ShareTarget {
  action: string;
  method?: 'GET' | 'POST';
  enctype?: string;
  params: {
    title?: string;
    text?: string;
    url?: string;
    files?: Array<{ name: string; accept: string[] }>;
  };
}

export interface ProtocolHandler {
  protocol: string;
  url: string;
}

export interface FileHandler {
  action: string;
  accept: Record<string, string[]>;
}

export interface LaunchHandler {
  client_mode: 'auto' | 'navigate-new' | 'navigate-existing' | 'focus-existing';
}
```

#### Manifest Generation Script

```typescript
// generate-manifest.ts
import type { WebAppManifest, ManifestIcon } from './manifest.types';

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

function generateIcons(basePath: string): ManifestIcon[] {
  const icons: ManifestIcon[] = ICON_SIZES.map((size) => ({
    src: `${basePath}/icon-${size}.png`,
    sizes: `${size}x${size}`,
    type: 'image/png',
    purpose: size >= 192 ? 'any' : undefined,
  }));

  // Add maskable icon
  icons.push({
    src: `${basePath}/maskable-512.png`,
    sizes: '512x512',
    type: 'image/png',
    purpose: 'maskable',
  });

  // Add SVG for any size
  icons.push({
    src: `${basePath}/icon.svg`,
    sizes: 'any',
    type: 'image/svg+xml',
  });

  return icons;
}

export function generateManifest(config: {
  name: string;
  shortName: string;
  description: string;
  themeColor: string;
  backgroundColor: string;
}): WebAppManifest {
  return {
    name: config.name,
    short_name: config.shortName,
    description: config.description,
    id: '/',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    theme_color: config.themeColor,
    background_color: config.backgroundColor,
    icons: generateIcons('/icons'),
  };
}
```

#### HTML Link and Meta Tags

```html
<!-- index.html -->
<head>
  <!-- Manifest link -->
  <link rel="manifest" href="/manifest.webmanifest">

  <!-- Theme color for browser chrome -->
  <meta name="theme-color" content="#1a1a2e">

  <!-- iOS-specific meta tags (fallback) -->
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="MyPWA">

  <!-- iOS icons (Safari doesn't use manifest icons) -->
  <link rel="apple-touch-icon" href="/icons/icon-152.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png">

  <!-- Splash screens for iOS -->
  <link rel="apple-touch-startup-image" href="/splash/splash-640x1136.png"
        media="(device-width: 320px) and (device-height: 568px)">

  <!-- Microsoft tiles -->
  <meta name="msapplication-TileColor" content="#1a1a2e">
  <meta name="msapplication-TileImage" content="/icons/icon-144.png">
</head>
```

### Anti-Patterns

```json
// BAD: Missing required fields
{
  "name": "My App"
  // Missing icons, start_url, display
}

// BAD: Insufficient icon sizes
{
  "name": "My App",
  "icons": [
    { "src": "/icon.png", "sizes": "64x64" }
  ]
  // Need 192x192 and 512x512 minimum
}

// BAD: start_url pointing to external domain
{
  "start_url": "https://different-domain.com"
  // Must be same origin as manifest
}

// BAD: Using deprecated meta tags instead of manifest
<!-- Don't do this -->
<meta name="mobile-web-app-capable" content="yes">
<!-- Use manifest instead -->

// BAD: No maskable icon
{
  "icons": [
    { "src": "/icon.png", "sizes": "512x512" }
  ]
  // Should include purpose: "maskable" icon for Android adaptive icons
}
```

### When to Use Each Manifest Feature

| Feature | Use When | Avoid When |
|---------|----------|------------|
| `display: standalone` | App-like experience desired | Content site that needs browser chrome |
| `display: fullscreen` | Games, immersive experiences | General apps |
| `shortcuts` | Common actions users repeat | Too many options (max 4 recommended) |
| `share_target` | App can receive shared content | App doesn't process shared data |
| `file_handlers` | App opens specific file types | Web-only functionality |
| `screenshots` | Want rich install UI | Screenshots not representative |

---

## 7. Background Sync

Background sync enables reliable data synchronization by deferring failed requests until connectivity returns.

### Core Patterns

#### One-Time Background Sync

```typescript
// background-sync-registration.ts
export async function registerBackgroundSync(tag: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('sync' in ServiceWorkerRegistration.prototype)) {
    console.warn('Background Sync not supported');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register(tag);
    return true;
  } catch (error) {
    console.error('Background sync registration failed:', error);
    return false;
  }
}

// Usage
async function saveFormOffline(formData: FormData): Promise<void> {
  // Store data for later sync
  await storeInIndexedDB('pending-forms', formData);
  // Register sync
  await registerBackgroundSync('sync-forms');
}
```

#### Service Worker Sync Handler

```typescript
// sw.ts - Background sync handler
interface SyncManager {
  register(tag: string): Promise<void>;
}

interface SyncEvent extends ExtendableEvent {
  tag: string;
  lastChance: boolean;
}

declare global {
  interface ServiceWorkerGlobalScope {
    onsync: ((this: ServiceWorkerGlobalScope, ev: SyncEvent) => void) | null;
  }

  interface ServiceWorkerRegistration {
    sync: SyncManager;
  }
}

self.addEventListener('sync', (event: SyncEvent) => {
  console.log('Sync event received:', event.tag);

  switch (event.tag) {
    case 'sync-forms':
      event.waitUntil(syncPendingForms());
      break;
    case 'sync-messages':
      event.waitUntil(syncPendingMessages());
      break;
    case 'sync-analytics':
      event.waitUntil(syncAnalyticsData());
      break;
    default:
      console.warn('Unknown sync tag:', event.tag);
  }
});

async function syncPendingForms(): Promise<void> {
  const db = await openDatabase();
  const pendingForms = await getAllPendingForms(db);

  for (const form of pendingForms) {
    try {
      const response = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form.data),
      });

      if (response.ok) {
        await deletePendingForm(db, form.id);
      } else if (response.status >= 500) {
        // Server error - will retry
        throw new Error(`Server error: ${response.status}`);
      } else {
        // Client error - don't retry
        await markFormAsFailed(db, form.id);
      }
    } catch (error) {
      console.error('Sync failed for form:', form.id, error);
      throw error; // Re-throw to trigger retry
    }
  }
}
```

#### Periodic Background Sync

```typescript
// periodic-sync.ts
interface PeriodicSyncManager {
  register(tag: string, options?: { minInterval: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}

const MIN_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours minimum

export async function registerPeriodicSync(
  tag: string,
  intervalMs: number = MIN_SYNC_INTERVAL_MS
): Promise<boolean> {
  if (!('periodicSync' in ServiceWorkerRegistration.prototype)) {
    console.warn('Periodic Background Sync not supported');
    return false;
  }

  try {
    const status = await navigator.permissions.query({
      name: 'periodic-background-sync' as PermissionName,
    });

    if (status.state !== 'granted') {
      console.warn('Periodic sync permission not granted');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const periodicSync = (registration as ServiceWorkerRegistration & { periodicSync: PeriodicSyncManager }).periodicSync;

    await periodicSync.register(tag, {
      minInterval: Math.max(intervalMs, MIN_SYNC_INTERVAL_MS),
    });

    return true;
  } catch (error) {
    console.error('Periodic sync registration failed:', error);
    return false;
  }
}

// Service worker handler
interface PeriodicSyncEvent extends ExtendableEvent {
  tag: string;
}

self.addEventListener('periodicsync', (event: PeriodicSyncEvent) => {
  switch (event.tag) {
    case 'update-content':
      event.waitUntil(fetchAndCacheLatestContent());
      break;
    case 'sync-user-data':
      event.waitUntil(syncUserDataInBackground());
      break;
  }
});

async function fetchAndCacheLatestContent(): Promise<void> {
  const cache = await caches.open('content-cache');
  const urls = ['/api/articles/latest', '/api/notifications'];

  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        console.error('Failed to fetch:', url);
      }
    })
  );
}
```

#### Background Sync with Workbox

```typescript
// sw-workbox.ts
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

// Create background sync queue
const bgSyncPlugin = new BackgroundSyncPlugin('api-queue', {
  maxRetentionTime: 24 * 60, // Retry for max 24 hours (in minutes)
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request.clone());
        console.log('Replay successful:', entry.request.url);
      } catch (error) {
        console.error('Replay failed:', entry.request.url);
        await queue.unshiftRequest(entry);
        throw error;
      }
    }
  },
});

// Apply to POST requests
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'POST'
);
```

#### Sync Status UI

```typescript
// sync-status.tsx
interface PendingSync {
  id: string;
  type: string;
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed';
}

export function SyncStatusIndicator() {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const checkPending = async () => {
      const count = await getPendingSyncCount();
      setPendingCount(count);
    };

    checkPending();

    // Listen for sync status updates
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === 'SYNC_START') {
        setSyncing(true);
      } else if (event.data.type === 'SYNC_COMPLETE') {
        setSyncing(false);
        checkPending();
      }
    });
  }, []);

  if (pendingCount === 0 && !syncing) {
    return null;
  }

  return (
    <div className={styles.syncStatus}>
      {syncing ? (
        <span>Syncing...</span>
      ) : (
        <span>{pendingCount} items pending sync</span>
      )}
    </div>
  );
}
```

### Anti-Patterns

```typescript
// BAD: Using background sync for large files
async function syncLargeFile(): Promise<void> {
  // Background sync is for small data!
  // Service worker may be terminated during large transfers
  await fetch('/api/upload', {
    method: 'POST',
    body: largeFile, // Don't do this!
  });
}

// GOOD: Use chunked uploads or Background Fetch API for large files
async function uploadLargeFile(file: File): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  await (registration as ServiceWorkerRegistration & {
    backgroundFetch: {
      fetch: (id: string, requests: Request[], options: object) => Promise<void>;
    };
  }).backgroundFetch.fetch('upload-large-file', [
    new Request('/api/upload-chunk', { method: 'POST', body: file }),
  ], {
    title: 'Uploading file...',
    downloadTotal: file.size,
  });
}

// BAD: No retry limit
async function syncWithoutLimit(): Promise<void> {
  // This will retry forever!
  while (true) {
    try {
      await fetch('/api/sync');
      break;
    } catch {
      // Keep trying forever - bad!
    }
  }
}

// GOOD: Implement retry limit
const MAX_RETRIES = 5;

async function syncWithLimit(id: string): Promise<void> {
  const item = await getPendingItem(id);

  if (item.retries >= MAX_RETRIES) {
    await markAsFailed(id);
    throw new Error('Max retries exceeded');
  }

  try {
    await fetch('/api/sync', { method: 'POST', body: JSON.stringify(item.data) });
    await deletePendingItem(id);
  } catch {
    await incrementRetryCount(id);
    throw new Error('Sync failed, will retry');
  }
}

// BAD: Not storing data before registering sync
function badSyncRegistration(): void {
  // Data will be lost if page closes!
  registerBackgroundSync('sync-data');
}

// GOOD: Persist data first
async function goodSyncRegistration(data: unknown): Promise<void> {
  // Store data in IndexedDB first
  await storeInIndexedDB('pending-sync', { id: crypto.randomUUID(), data });
  // Then register sync
  await registerBackgroundSync('sync-data');
}
```

### When to Use vs When Not to Use

| Use When | Avoid When |
|----------|------------|
| Small data payloads (< 1MB) | Large file uploads |
| Actions should complete eventually | Real-time data required |
| User actions that failed offline | Frequent polling scenarios |
| Form submissions, message sending | Streaming data |
| Analytics and logging | Time-sensitive operations |

---

## 8. IndexedDB Patterns

IndexedDB provides client-side storage for structured data, enabling offline functionality and performance optimization.

### Core Patterns

#### Using the `idb` Library

```typescript
// db.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Define database schema with TypeScript
interface MyAppDB extends DBSchema {
  users: {
    key: string;
    value: {
      id: string;
      name: string;
      email: string;
      createdAt: Date;
      updatedAt: Date;
    };
    indexes: {
      'by-email': string;
      'by-createdAt': Date;
    };
  };
  posts: {
    key: string;
    value: {
      id: string;
      title: string;
      content: string;
      authorId: string;
      tags: string[];
      status: 'draft' | 'published';
      createdAt: Date;
    };
    indexes: {
      'by-author': string;
      'by-status': string;
      'by-tags': string;
    };
  };
  pendingSync: {
    key: string;
    value: {
      id: string;
      action: 'create' | 'update' | 'delete';
      entity: string;
      data: unknown;
      timestamp: number;
      retries: number;
    };
    indexes: {
      'by-entity': string;
      'by-timestamp': number;
    };
  };
}

const DB_NAME = 'my-app-db';
const DB_VERSION = 1;

export async function initDatabase(): Promise<IDBPDatabase<MyAppDB>> {
  return openDB<MyAppDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Users store
      if (!db.objectStoreNames.contains('users')) {
        const userStore = db.createObjectStore('users', { keyPath: 'id' });
        userStore.createIndex('by-email', 'email', { unique: true });
        userStore.createIndex('by-createdAt', 'createdAt');
      }

      // Posts store
      if (!db.objectStoreNames.contains('posts')) {
        const postStore = db.createObjectStore('posts', { keyPath: 'id' });
        postStore.createIndex('by-author', 'authorId');
        postStore.createIndex('by-status', 'status');
        postStore.createIndex('by-tags', 'tags', { multiEntry: true });
      }

      // Pending sync store
      if (!db.objectStoreNames.contains('pendingSync')) {
        const syncStore = db.createObjectStore('pendingSync', { keyPath: 'id' });
        syncStore.createIndex('by-entity', 'entity');
        syncStore.createIndex('by-timestamp', 'timestamp');
      }
    },
    blocked() {
      console.warn('Database upgrade blocked by another tab');
    },
    blocking() {
      console.warn('This tab is blocking a database upgrade');
    },
    terminated() {
      console.error('Database connection terminated unexpectedly');
    },
  });
}
```

#### Repository Pattern

```typescript
// repository.ts
import type { IDBPDatabase } from 'idb';
import type { MyAppDB } from './db';

export interface Repository<T> {
  getById(id: string): Promise<T | undefined>;
  getAll(): Promise<T[]>;
  save(item: T): Promise<void>;
  delete(id: string): Promise<void>;
}

export function createUserRepository(db: IDBPDatabase<MyAppDB>): Repository<MyAppDB['users']['value']> {
  return {
    async getById(id) {
      return db.get('users', id);
    },

    async getAll() {
      return db.getAll('users');
    },

    async save(user) {
      await db.put('users', {
        ...user,
        updatedAt: new Date(),
      });
    },

    async delete(id) {
      await db.delete('users', id);
    },
  };
}

// Extended repository with queries
export function createPostRepository(db: IDBPDatabase<MyAppDB>) {
  const base: Repository<MyAppDB['posts']['value']> = {
    async getById(id) {
      return db.get('posts', id);
    },

    async getAll() {
      return db.getAll('posts');
    },

    async save(post) {
      await db.put('posts', post);
    },

    async delete(id) {
      await db.delete('posts', id);
    },
  };

  return {
    ...base,

    async getByAuthor(authorId: string) {
      return db.getAllFromIndex('posts', 'by-author', authorId);
    },

    async getPublished() {
      return db.getAllFromIndex('posts', 'by-status', 'published');
    },

    async getByTag(tag: string) {
      return db.getAllFromIndex('posts', 'by-tags', tag);
    },

    async getRecent(limit: number) {
      const tx = db.transaction('posts', 'readonly');
      const store = tx.objectStore('posts');
      const posts: MyAppDB['posts']['value'][] = [];

      let cursor = await store.openCursor(null, 'prev');
      while (cursor && posts.length < limit) {
        posts.push(cursor.value);
        cursor = await cursor.continue();
      }

      return posts;
    },
  };
}
```

#### Sync Queue Implementation

```typescript
// sync-queue.ts
import type { IDBPDatabase } from 'idb';
import type { MyAppDB } from './db';

type SyncItem = MyAppDB['pendingSync']['value'];

export class SyncQueue {
  constructor(private db: IDBPDatabase<MyAppDB>) {}

  async enqueue(
    action: SyncItem['action'],
    entity: string,
    data: unknown
  ): Promise<string> {
    const id = crypto.randomUUID();
    const item: SyncItem = {
      id,
      action,
      entity,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    await this.db.add('pendingSync', item);
    return id;
  }

  async dequeue(id: string): Promise<void> {
    await this.db.delete('pendingSync', id);
  }

  async getAll(): Promise<SyncItem[]> {
    return this.db.getAllFromIndex('pendingSync', 'by-timestamp');
  }

  async getByEntity(entity: string): Promise<SyncItem[]> {
    return this.db.getAllFromIndex('pendingSync', 'by-entity', entity);
  }

  async incrementRetries(id: string): Promise<void> {
    const item = await this.db.get('pendingSync', id);
    if (item) {
      item.retries += 1;
      await this.db.put('pendingSync', item);
    }
  }

  async clear(): Promise<void> {
    await this.db.clear('pendingSync');
  }
}
```

#### Transaction Patterns

```typescript
// transactions.ts
import type { IDBPDatabase } from 'idb';
import type { MyAppDB } from './db';

// Batch write pattern
export async function batchWritePosts(
  db: IDBPDatabase<MyAppDB>,
  posts: MyAppDB['posts']['value'][]
): Promise<void> {
  const tx = db.transaction('posts', 'readwrite');

  await Promise.all([
    ...posts.map((post) => tx.store.put(post)),
    tx.done,
  ]);
}

// Multi-store transaction pattern
export async function createUserWithPost(
  db: IDBPDatabase<MyAppDB>,
  user: MyAppDB['users']['value'],
  post: MyAppDB['posts']['value']
): Promise<void> {
  const tx = db.transaction(['users', 'posts'], 'readwrite');

  await Promise.all([
    tx.objectStore('users').put(user),
    tx.objectStore('posts').put(post),
    tx.done,
  ]);
}

// Cursor iteration for large datasets
export async function processAllPosts(
  db: IDBPDatabase<MyAppDB>,
  processor: (post: MyAppDB['posts']['value']) => void
): Promise<void> {
  const tx = db.transaction('posts', 'readonly');
  let cursor = await tx.store.openCursor();

  while (cursor) {
    processor(cursor.value);
    cursor = await cursor.continue();
  }
}

// Paginated reads
export async function getPostsPaginated(
  db: IDBPDatabase<MyAppDB>,
  page: number,
  pageSize: number
): Promise<MyAppDB['posts']['value'][]> {
  const tx = db.transaction('posts', 'readonly');
  const store = tx.objectStore('posts');
  const posts: MyAppDB['posts']['value'][] = [];
  const offset = page * pageSize;
  let count = 0;

  let cursor = await store.openCursor();

  // Skip to offset
  while (cursor && count < offset) {
    count++;
    cursor = await cursor.continue();
  }

  // Collect page items
  while (cursor && posts.length < pageSize) {
    posts.push(cursor.value);
    cursor = await cursor.continue();
  }

  return posts;
}
```

#### React Integration

```typescript
// use-indexed-db.ts
import { useEffect, useState, useCallback } from 'react';
import type { IDBPDatabase } from 'idb';
import { initDatabase, type MyAppDB } from './db';

let dbInstance: IDBPDatabase<MyAppDB> | null = null;

export function useDatabase() {
  const [db, setDb] = useState<IDBPDatabase<MyAppDB> | null>(dbInstance);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(!dbInstance);

  useEffect(() => {
    if (dbInstance) return;

    let cancelled = false;

    initDatabase()
      .then((database) => {
        if (!cancelled) {
          dbInstance = database;
          setDb(database);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { db, error, loading };
}

// Hook for a specific collection
export function useCollection<K extends keyof MyAppDB>(collectionName: K) {
  const { db, loading, error } = useDatabase();
  const [items, setItems] = useState<MyAppDB[K]['value'][]>([]);

  const refresh = useCallback(async () => {
    if (!db) return;
    const data = await db.getAll(collectionName);
    setItems(data);
  }, [db, collectionName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(
    async (item: MyAppDB[K]['value']) => {
      if (!db) return;
      await db.add(collectionName, item);
      await refresh();
    },
    [db, collectionName, refresh]
  );

  const update = useCallback(
    async (item: MyAppDB[K]['value']) => {
      if (!db) return;
      await db.put(collectionName, item);
      await refresh();
    },
    [db, collectionName, refresh]
  );

  const remove = useCallback(
    async (id: MyAppDB[K]['key']) => {
      if (!db) return;
      await db.delete(collectionName, id);
      await refresh();
    },
    [db, collectionName, refresh]
  );

  return { items, loading, error, add, update, remove, refresh };
}
```

### Anti-Patterns

```typescript
// BAD: Not handling transaction timing
async function badTransaction(db: IDBPDatabase<MyAppDB>) {
  const tx = db.transaction('posts', 'readwrite');

  // This will cause the transaction to close!
  await fetch('/api/validate');

  // Transaction is now closed - this will fail!
  await tx.store.put(newPost);
}

// GOOD: Keep transactions synchronous
async function goodTransaction(db: IDBPDatabase<MyAppDB>) {
  // Fetch data first
  const validated = await fetch('/api/validate');

  // Then do the transaction
  const tx = db.transaction('posts', 'readwrite');
  await tx.store.put(newPost);
  await tx.done;
}

// BAD: Opening new connection for each operation
async function badConnection() {
  const db = await openDB('mydb', 1); // New connection each time!
  const data = await db.get('store', 'key');
  db.close();
  return data;
}

// GOOD: Reuse database connection
let dbInstance: IDBPDatabase<MyAppDB> | null = null;

async function getDb(): Promise<IDBPDatabase<MyAppDB>> {
  if (!dbInstance) {
    dbInstance = await initDatabase();
  }
  return dbInstance;
}

// BAD: Storing large blobs inefficiently
async function badBlobStorage(db: IDBPDatabase<MyAppDB>, image: Blob) {
  // Storing large blobs directly can cause performance issues
  await db.put('images', { id: 'img1', data: image });
}

// GOOD: Use chunked storage or reference external storage
async function goodBlobStorage(image: Blob) {
  // Store in Cache API instead, reference by URL
  const cache = await caches.open('images');
  const response = new Response(image);
  await cache.put('/images/img1', response);
}

// BAD: No error handling
async function noErrorHandling(db: IDBPDatabase<MyAppDB>) {
  await db.put('posts', post); // If this fails, app crashes
}

// GOOD: Proper error handling
async function withErrorHandling(db: IDBPDatabase<MyAppDB>) {
  try {
    await db.put('posts', post);
  } catch (error) {
    if ((error as DOMException).name === 'QuotaExceededError') {
      // Handle storage full
      await cleanupOldData(db);
      await db.put('posts', post);
    } else {
      throw error;
    }
  }
}
```

### When to Use vs When Not to Use

| Use When | Avoid When |
|----------|------------|
| Structured data storage needed | Simple key-value pairs (use localStorage) |
| Offline data persistence | Small amounts of session data |
| Complex querying required | Data accessed only from service worker |
| Large datasets (>5MB) | Real-time sync is mandatory |
| Need indexes for searching | Sensitive data (use encrypted storage) |

---

## 9. Workbox Patterns

Workbox is Google's library for building production-ready service workers with best practices built in.

### Core Patterns

#### Basic Workbox Setup

```typescript
// sw.ts - Workbox service worker
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute, Route } from 'workbox-routing';
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
  NetworkOnly
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Precache static assets (injected by build tool)
precacheAndRoute(self.__WB_MANIFEST);

// Clean up old caches
cleanupOutdatedCaches();

// Skip waiting and claim clients
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
```

#### Strategy Configuration

```typescript
// workbox-strategies.ts
import { registerRoute } from 'workbox-routing';
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

const ONE_DAY_IN_SECONDS = 24 * 60 * 60;
const ONE_WEEK_IN_SECONDS = 7 * ONE_DAY_IN_SECONDS;
const ONE_MONTH_IN_SECONDS = 30 * ONE_DAY_IN_SECONDS;

// Cache-first for static assets (images, fonts)
registerRoute(
  ({ request }) =>
    request.destination === 'image' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: ONE_MONTH_IN_SECONDS,
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// Stale-while-revalidate for CSS and JS
registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: ONE_WEEK_IN_SECONDS,
      }),
    ],
  })
);

// Network-first for API calls
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: ONE_DAY_IN_SECONDS,
      }),
    ],
  })
);
```

#### Background Sync with Workbox

```typescript
// workbox-background-sync.ts
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

const bgSyncPlugin = new BackgroundSyncPlugin('api-queue', {
  maxRetentionTime: 24 * 60, // 24 hours in minutes
  forceSyncFallback: true,
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        const response = await fetch(entry.request.clone());

        if (!response.ok) {
          throw new Error(`Failed with status: ${response.status}`);
        }

        // Notify app of successful sync
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
          client.postMessage({
            type: 'SYNC_SUCCESS',
            url: entry?.request.url,
          });
        });
      } catch (error) {
        // Put request back in queue for retry
        await queue.unshiftRequest(entry);
        throw error;
      }
    }
  },
});

// Apply to mutation requests
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/') &&
    ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method),
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'POST'
);

registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/') &&
    ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method),
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'PUT'
);

registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/') &&
    ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method),
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'DELETE'
);
```

#### Offline Fallback with Workbox

```typescript
// workbox-offline-fallback.ts
import { registerRoute, setCatchHandler, setDefaultHandler } from 'workbox-routing';
import { NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { precacheAndRoute, matchPrecache } from 'workbox-precaching';

// Precache offline page
precacheAndRoute([
  { url: '/offline.html', revision: '1' },
  { url: '/offline-image.svg', revision: '1' },
]);

// Set default handler for all routes
setDefaultHandler(new NetworkFirst());

// Set catch handler for failed requests
setCatchHandler(async ({ event, request }) => {
  // For navigation requests, return offline page
  if (request.destination === 'document') {
    return matchPrecache('/offline.html') ?? Response.error();
  }

  // For images, return placeholder
  if (request.destination === 'image') {
    return matchPrecache('/offline-image.svg') ?? Response.error();
  }

  // For other requests, return error response
  return Response.error();
});
```

#### Navigation Preload

```typescript
// workbox-navigation-preload.ts
import { enable as enableNavigationPreload } from 'workbox-navigation-preload';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

// Enable navigation preload
enableNavigationPreload();

// Use preloaded response
const navigationHandler = new NetworkFirst({
  cacheName: 'navigations',
  plugins: [
    {
      // Use preloaded response when available
      requestWillFetch: async ({ request }) => {
        return request;
      },
    },
  ],
});

const navigationRoute = new NavigationRoute(navigationHandler, {
  // Exclude certain paths from navigation handling
  denylist: [/\/api\//, /\/admin\//],
});

registerRoute(navigationRoute);
```

#### Workbox Window (Client-Side)

```typescript
// workbox-window-setup.ts
import { Workbox, messageSW } from 'workbox-window';

export function registerServiceWorker(): Workbox | null {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  const wb = new Workbox('/sw.js');

  // Handle waiting service worker
  wb.addEventListener('waiting', (event) => {
    // New version available
    const shouldUpdate = confirm(
      'A new version is available. Would you like to update?'
    );

    if (shouldUpdate) {
      // Tell waiting SW to skip waiting and activate
      wb.messageSkipWaiting();
    }
  });

  // Handle controller change (new SW activated)
  wb.addEventListener('controlling', () => {
    // Reload to use new version
    window.location.reload();
  });

  // Handle activation
  wb.addEventListener('activated', (event) => {
    if (event.isUpdate) {
      console.log('Service worker updated');
    } else {
      console.log('Service worker activated for first time');
    }
  });

  // Handle registration
  wb.register().then((registration) => {
    console.log('Service worker registered:', registration?.scope);
  });

  return wb;
}

// React hook
export function useServiceWorker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [wb, setWb] = useState<Workbox | null>(null);

  useEffect(() => {
    const workbox = registerServiceWorker();

    if (workbox) {
      setWb(workbox);

      workbox.addEventListener('waiting', () => {
        setUpdateAvailable(true);
      });
    }
  }, []);

  const update = useCallback(() => {
    if (wb) {
      wb.messageSkipWaiting();
    }
  }, [wb]);

  return { updateAvailable, update };
}
```

#### Webpack/Vite Integration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: 'auto',
      registerType: 'prompt',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB
      },
      manifest: {
        name: 'My PWA',
        short_name: 'MyPWA',
        theme_color: '#1a1a2e',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
});
```

### Anti-Patterns

```typescript
// BAD: Caching everything with same strategy
registerRoute(
  () => true, // Matches everything
  new CacheFirst() // Wrong for API calls!
);

// GOOD: Different strategies for different content
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({ cacheName: 'images' })
);

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: 'api' })
);

// BAD: No cache expiration
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    // No expiration - cache grows forever!
  })
);

// GOOD: Set expiration limits
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true, // Delete cache if quota exceeded
      }),
    ],
  })
);

// BAD: Caching non-cacheable responses
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new CacheFirst({
    cacheName: 'api',
    // No response validation!
  })
);

// GOOD: Only cache valid responses
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200], // Only cache successful responses
      }),
    ],
  })
);

// BAD: Precaching too many files
precacheAndRoute([
  // Precaching everything including large files
  { url: '/video.mp4', revision: '1' }, // 50MB video!
  { url: '/large-image.png', revision: '1' }, // 10MB image!
]);

// GOOD: Only precache essential files
precacheAndRoute([
  { url: '/index.html', revision: '1' },
  { url: '/main.js', revision: '1' },
  { url: '/main.css', revision: '1' },
  { url: '/offline.html', revision: '1' },
]);
// Use runtime caching for larger assets
```

### When to Use vs When Not to Use

| Use When | Avoid When |
|----------|------------|
| Building production PWAs | Simple static sites |
| Need multiple caching strategies | Single, simple caching need |
| Want built-in best practices | Learning service workers from scratch |
| Complex offline requirements | No offline functionality needed |
| Need background sync | Very simple use cases |

---

## 10. PWA Testing Strategies

Testing PWAs requires validating offline functionality, performance, and user experience across browsers and devices.

### Core Patterns

#### Lighthouse Integration with Playwright

```typescript
// lighthouse.config.ts
import type { Config, Flags } from 'lighthouse';

export const lighthouseConfig: Config = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'],
    formFactor: 'mobile',
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
    },
  },
};

export const lighthouseFlags: Flags = {
  output: ['html', 'json'],
  logLevel: 'error',
};

export const thresholds = {
  performance: 80,
  accessibility: 90,
  'best-practices': 90,
  seo: 90,
  pwa: 90,
};
```

```typescript
// lighthouse.test.ts
import { test, expect, chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { lighthouseConfig, lighthouseFlags, thresholds } from './lighthouse.config';

const REMOTE_DEBUGGING_PORT = 9222;

test.describe('Lighthouse PWA Audit', () => {
  test('should meet PWA requirements', async () => {
    // Launch Chrome with debugging port
    const browser = await chromium.launch({
      args: [`--remote-debugging-port=${REMOTE_DEBUGGING_PORT}`],
    });

    const page = await browser.newPage();
    await page.goto('http://localhost:3000');

    // Run Lighthouse
    const result = await lighthouse(
      'http://localhost:3000',
      {
        ...lighthouseFlags,
        port: REMOTE_DEBUGGING_PORT,
      },
      lighthouseConfig
    );

    const categories = result?.lhr?.categories;

    // Assert thresholds
    expect(categories?.performance?.score! * 100).toBeGreaterThanOrEqual(
      thresholds.performance
    );
    expect(categories?.accessibility?.score! * 100).toBeGreaterThanOrEqual(
      thresholds.accessibility
    );
    expect(categories?.['best-practices']?.score! * 100).toBeGreaterThanOrEqual(
      thresholds['best-practices']
    );
    expect(categories?.seo?.score! * 100).toBeGreaterThanOrEqual(thresholds.seo);
    expect(categories?.pwa?.score! * 100).toBeGreaterThanOrEqual(thresholds.pwa);

    await browser.close();
  });
});
```

#### Service Worker Testing

```typescript
// service-worker.test.ts
import { test, expect, Page } from '@playwright/test';

test.describe('Service Worker', () => {
  test('should register service worker', async ({ page }) => {
    await page.goto('/');

    // Wait for service worker to register
    const swRegistration = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return {
        scope: registration.scope,
        active: !!registration.active,
      };
    });

    expect(swRegistration.active).toBe(true);
    expect(swRegistration.scope).toContain('/');
  });

  test('should cache static assets', async ({ page }) => {
    await page.goto('/');

    // Wait for caching to complete
    await page.waitForTimeout(2000);

    const cacheNames = await page.evaluate(async () => {
      return caches.keys();
    });

    expect(cacheNames).toContain('static-assets');
  });

  test('should serve cached content offline', async ({ page, context }) => {
    // Load page online first
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Go offline
    await context.setOffline(true);

    // Navigate to same page
    await page.reload();

    // Should still load from cache
    const title = await page.title();
    expect(title).toBeTruthy();

    // Go back online
    await context.setOffline(false);
  });
});
```

#### Offline Functionality Testing

```typescript
// offline.test.ts
import { test, expect } from '@playwright/test';

test.describe('Offline Functionality', () => {
  test('should show offline page when navigating offline', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Go offline
    await context.setOffline(true);

    // Try to navigate to new page
    await page.goto('/new-page');

    // Should show offline fallback
    const offlineMessage = page.getByText(/offline/i);
    await expect(offlineMessage).toBeVisible();

    await context.setOffline(false);
  });

  test('should queue form submissions when offline', async ({
    page,
    context,
  }) => {
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');

    // Go offline
    await context.setOffline(true);

    // Fill and submit form
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="message"]', 'Test message');
    await page.click('button[type="submit"]');

    // Should show queued message
    const queuedMessage = page.getByText(/queued|will sync/i);
    await expect(queuedMessage).toBeVisible();

    // Go back online
    await context.setOffline(false);

    // Wait for sync
    await page.waitForTimeout(3000);

    // Should show success
    const successMessage = page.getByText(/sent|success/i);
    await expect(successMessage).toBeVisible();
  });

  test('should display cached data when offline', async ({ page, context }) => {
    // Load data while online
    await page.goto('/articles');
    await page.waitForSelector('[data-testid="article-list"]');

    const onlineArticleCount = await page
      .locator('[data-testid="article-item"]')
      .count();

    // Go offline
    await context.setOffline(true);

    // Reload page
    await page.reload();

    // Should still show cached articles
    const offlineArticleCount = await page
      .locator('[data-testid="article-item"]')
      .count();
    expect(offlineArticleCount).toBe(onlineArticleCount);

    await context.setOffline(false);
  });
});
```

#### Install Prompt Testing

```typescript
// install-prompt.test.ts
import { test, expect, Page } from '@playwright/test';

// Helper to trigger beforeinstallprompt
async function triggerInstallPrompt(page: Page) {
  return page.evaluate(() => {
    const event = new Event('beforeinstallprompt', {
      bubbles: true,
      cancelable: true,
    });

    // Add prompt method
    (event as Event & { prompt: () => Promise<void> }).prompt = async () => {};
    (event as Event & { userChoice: Promise<{ outcome: string }> }).userChoice =
      Promise.resolve({ outcome: 'accepted' });

    window.dispatchEvent(event);
  });
}

test.describe('Install Prompt', () => {
  test('should show install banner when installable', async ({ page }) => {
    await page.goto('/');

    // Trigger install prompt
    await triggerInstallPrompt(page);

    // Install banner should appear
    const installBanner = page.getByTestId('install-banner');
    await expect(installBanner).toBeVisible();
  });

  test('should hide banner after dismissal', async ({ page }) => {
    await page.goto('/');
    await triggerInstallPrompt(page);

    // Click dismiss
    await page.getByRole('button', { name: /not now|dismiss/i }).click();

    // Banner should hide
    const installBanner = page.getByTestId('install-banner');
    await expect(installBanner).not.toBeVisible();

    // Should stay hidden on reload
    await page.reload();
    await triggerInstallPrompt(page);
    await expect(installBanner).not.toBeVisible();
  });
});
```

#### Push Notification Testing

```typescript
// push-notifications.test.ts
import { test, expect } from '@playwright/test';

test.describe('Push Notifications', () => {
  test.beforeEach(async ({ context }) => {
    // Grant notification permission
    await context.grantPermissions(['notifications']);
  });

  test('should request permission on button click', async ({ page }) => {
    await page.goto('/settings');

    // Click enable notifications
    await page.getByRole('button', { name: /enable notifications/i }).click();

    // Should show enabled state
    const enabledText = page.getByText(/notifications enabled/i);
    await expect(enabledText).toBeVisible();
  });

  test('should subscribe to push after permission granted', async ({
    page,
  }) => {
    await page.goto('/settings');

    // Click enable
    await page.getByRole('button', { name: /enable notifications/i }).click();

    // Check subscription was created
    const subscription = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.pushManager.getSubscription();
    });

    expect(subscription).not.toBeNull();
  });
});
```

#### Manifest Validation

```typescript
// manifest.test.ts
import { test, expect } from '@playwright/test';
import type { WebAppManifest } from './manifest.types';

test.describe('Web App Manifest', () => {
  test('should have valid manifest', async ({ page }) => {
    const response = await page.goto('/manifest.webmanifest');
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('application/manifest+json');

    const manifest: WebAppManifest = await response?.json();

    // Required fields
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBeTruthy();
    expect(manifest.icons).toHaveLength(expect.any(Number));

    // Icon requirements
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');

    // Maskable icon
    const hasMaskable = manifest.icons.some((icon) => icon.purpose === 'maskable');
    expect(hasMaskable).toBe(true);
  });

  test('should have manifest linked in HTML', async ({ page }) => {
    await page.goto('/');

    const manifestLink = await page.getAttribute('link[rel="manifest"]', 'href');
    expect(manifestLink).toBeTruthy();
  });
});
```

#### IndexedDB Testing

```typescript
// indexeddb.test.ts
import { test, expect } from '@playwright/test';

test.describe('IndexedDB Storage', () => {
  test('should persist data in IndexedDB', async ({ page }) => {
    await page.goto('/');

    // Add data
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('test-db', 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('items', { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const tx = db.transaction('items', 'readwrite');
      tx.objectStore('items').put({ id: '1', name: 'Test Item' });
      await new Promise((resolve) => (tx.oncomplete = resolve));
    });

    // Reload page
    await page.reload();

    // Verify data persisted
    const data = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open('test-db', 1);
        request.onsuccess = () => resolve(request.result);
      });

      const tx = db.transaction('items', 'readonly');
      return new Promise((resolve) => {
        const request = tx.objectStore('items').get('1');
        request.onsuccess = () => resolve(request.result);
      });
    });

    expect(data).toEqual({ id: '1', name: 'Test Item' });
  });
});
```

#### CI/CD Integration

```yaml
# .github/workflows/pwa-tests.yml
name: PWA Tests

on: [push, pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Start server
        run: npm run preview &

      - name: Wait for server
        run: npx wait-on http://localhost:4173

      - name: Run Lighthouse
        uses: treosh/lighthouse-ci-action@v11
        with:
          urls: |
            http://localhost:4173
          configPath: ./lighthouserc.json
          uploadArtifacts: true

  playwright-pwa:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Build
        run: npm run build

      - name: Run PWA tests
        run: npm run test:pwa

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

### Anti-Patterns

```typescript
// BAD: Testing with real network
test('should load data', async ({ page }) => {
  await page.goto('/');
  // Actually calls real API - slow and flaky!
  await expect(page.getByTestId('data')).toBeVisible();
});

// GOOD: Mock network requests
test('should load data', async ({ page }) => {
  await page.route('/api/data', (route) => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ items: [] }),
    });
  });

  await page.goto('/');
  await expect(page.getByTestId('data')).toBeVisible();
});

// BAD: Not waiting for service worker
test('should work offline', async ({ page, context }) => {
  await page.goto('/');
  await context.setOffline(true);
  // Service worker might not be ready!
  await page.reload();
});

// GOOD: Wait for service worker to be ready
test('should work offline', async ({ page, context }) => {
  await page.goto('/');

  // Wait for SW to be ready and caching complete
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active !== null;
  });
  await page.waitForLoadState('networkidle');

  await context.setOffline(true);
  await page.reload();
});

// BAD: Hardcoded timeouts
test('should sync', async ({ page }) => {
  await page.waitForTimeout(5000); // Magic number!
});

// GOOD: Wait for specific conditions
test('should sync', async ({ page }) => {
  await page.waitForSelector('[data-testid="sync-complete"]');
  // Or
  await expect(page.getByText('Synced')).toBeVisible();
});
```

### When to Use Each Testing Strategy

| Strategy | Use When |
|----------|----------|
| Lighthouse audit | Checking PWA criteria, performance baselines |
| Playwright offline tests | Verifying service worker behavior |
| Install prompt tests | Testing custom install UX |
| Push notification tests | Validating notification permission flow |
| IndexedDB tests | Ensuring data persistence |
| CI/CD integration | Preventing regressions on every commit |

---

## Summary: PWA Implementation Checklist

### Essential Requirements

- [ ] HTTPS enabled (required for service workers)
- [ ] Valid Web App Manifest with required fields
- [ ] Service worker registered and functional
- [ ] At least 192x192 and 512x512 icons
- [ ] Offline fallback page implemented

### Recommended Features

- [ ] Cache-first for static assets
- [ ] Network-first for API calls
- [ ] Background sync for mutations
- [ ] Install prompt on strategic user engagement
- [ ] Push notification opt-in (not on page load)

### Testing Requirements

- [ ] Lighthouse PWA score >= 90
- [ ] Offline functionality verified
- [ ] Service worker caching tested
- [ ] Install flow tested
- [ ] CI/CD integration for regression prevention

---

## Sources

- [MDN - Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [web.dev - Learn PWA](https://web.dev/learn/pwa/)
- [Chrome Developers - Workbox](https://developer.chrome.com/docs/workbox/)
- [web.dev - Installation Prompt](https://web.dev/learn/pwa/installation-prompt)
- [MDN - Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)
- [MDN - Background Sync](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)
- [web.dev - Offline Data](https://web.dev/learn/pwa/offline-data)
- [GitHub - idb Library](https://github.com/jakearchibald/idb)
- [FreeCodeCamp - Workbox Tutorial](https://www.freecodecamp.org/news/implement-a-service-worker-with-workbox-in-a-pwa/)
- [DEV Community - PWA Best Practices 2025](https://dev.to/farheen_dev/tired-of-bugs-and-delays-these-10-pwa-teams-got-it-right-in-2025-2n3d)
- [TestingPlus - Lighthouse + Playwright Integration](https://testingplus.me/how-to-integrate-lighthouse-playwright-performance-testing-2025-guide/)
- [MagicBell - PWA Push Notifications](https://www.magicbell.com/blog/using-push-notifications-in-pwas)
- [Borstch - PWA Caching Strategies](https://borstch.com/blog/caching-strategies-in-pwa-cache-first-network-first-stale-while-revalidate-etc)
- [LogRocket - Offline-first Apps 2025](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
