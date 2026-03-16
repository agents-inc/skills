# Service Worker - Update Examples

> Update handling and versioning patterns for Service Workers. See [SKILL.md](../SKILL.md) for concepts and [core.md](core.md) for basic lifecycle patterns.

---

## Pattern 10: Version Tracking and Communication

Typed bidirectional messaging between service worker and clients for version tracking and update coordination.

```typescript
// sw.ts - Version communication
declare const self: ServiceWorkerGlobalScope;

const SW_VERSION = "1.2.0";

type ClientBoundMessage =
  | { type: "VERSION"; version: string }
  | { type: "UPDATE_AVAILABLE"; newVersion: string }
  | { type: "CACHE_UPDATED"; cacheName: string };

type WorkerBoundMessage =
  | { type: "GET_VERSION" }
  | { type: "SKIP_WAITING" }
  | { type: "CHECK_UPDATE" };

self.addEventListener("message", async (event: ExtendableMessageEvent) => {
  const message = event.data as WorkerBoundMessage;

  switch (message.type) {
    case "GET_VERSION":
      event.source?.postMessage({
        type: "VERSION",
        version: SW_VERSION,
      } as ClientBoundMessage);
      break;

    case "SKIP_WAITING":
      await self.skipWaiting();
      break;

    case "CHECK_UPDATE":
      await self.registration.update();
      break;
  }
});

async function notifyClients(message: ClientBoundMessage): Promise<void> {
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage(message);
  }
}

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await notifyClients({ type: "UPDATE_AVAILABLE", newVersion: SW_VERSION });
    })(),
  );
});

export type { ClientBoundMessage, WorkerBoundMessage };
```

**Why good:** Typed message protocol with discriminated unions, bidirectional communication, notifies all clients on activation

---

## Pattern 11: Aggressive Update (Use Sparingly)

For critical security fixes, skip waiting and claim immediately. Disrupts user session.

```typescript
const CACHE_VERSION = "v2.0.0";

// Install - skip waiting immediately
self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(`static-${CACHE_VERSION}`);
      await cache.addAll(PRECACHE_URLS);

      // AGGRESSIVE: Only use for critical security fixes
      await self.skipWaiting();
    })(),
  );
});

// Activate - claim and optionally force reload
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== `static-${CACHE_VERSION}`)
          .map((name) => caches.delete(name)),
      );

      await self.clients.claim();

      // Notify clients to reload
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.postMessage({ type: "FORCE_RELOAD" });
      }
    })(),
  );
});
```

**Warning:** This disrupts user experience mid-session. Use only for critical security fixes or breaking changes.

---

## Pattern 12: Deferred Update with User Control

Let users choose when to apply updates. Track dismissed versions to avoid re-prompting.

```typescript
interface UpdateHandler {
  checkForUpdates: () => Promise<boolean>;
  applyUpdate: () => void;
  dismissUpdate: () => void;
}

function createUpdateHandler(
  onUpdateAvailable: (version: string) => void,
): UpdateHandler {
  let waitingWorker: ServiceWorker | null = null;
  let dismissedVersions = new Set<string>();

  const storedDismissed = localStorage.getItem("sw-dismissed-versions");
  if (storedDismissed) {
    dismissedVersions = new Set(JSON.parse(storedDismissed));
  }

  const saveDismissed = () => {
    localStorage.setItem(
      "sw-dismissed-versions",
      JSON.stringify([...dismissedVersions]),
    );
  };

  navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
    if (
      event.data?.type === "VERSION" &&
      !dismissedVersions.has(event.data.version)
    ) {
      onUpdateAvailable(event.data.version);
    }
  });

  return {
    async checkForUpdates(): Promise<boolean> {
      const registration = await navigator.serviceWorker.ready;

      if (registration.waiting) {
        waitingWorker = registration.waiting;
        waitingWorker.postMessage({ type: "GET_VERSION" });
        return true;
      }

      await registration.update();
      return !!registration.waiting;
    },

    applyUpdate(): void {
      waitingWorker?.postMessage({ type: "SKIP_WAITING" });
    },

    dismissUpdate(): void {
      if (waitingWorker) {
        waitingWorker.postMessage({ type: "GET_VERSION" });

        const handler = (event: MessageEvent) => {
          if (event.data?.type === "VERSION") {
            dismissedVersions.add(event.data.version);
            saveDismissed();
            navigator.serviceWorker.removeEventListener("message", handler);
          }
        };

        navigator.serviceWorker.addEventListener("message", handler);
      }
    },
  };
}

export { createUpdateHandler };
export type { UpdateHandler };
```

**Why good:** User controls update timing, dismissed versions persisted in localStorage, framework-agnostic (wire up to any UI)

---

## Pattern 13: Update at Idle Time

Apply updates when user is idle to minimize disruption. Uses `requestIdleCallback` with a max-wait fallback.

```typescript
const IDLE_TIMEOUT_MS = 30000; // 30 seconds of inactivity
const MAX_IDLE_WAIT_MS = 300000; // 5 minutes max wait

async function applyUpdateWhenIdle(
  registration: ServiceWorkerRegistration,
): Promise<void> {
  if (!registration.waiting) return;

  return new Promise((resolve) => {
    let idleCallback: number | null = null;
    let maxWaitTimeout: ReturnType<typeof setTimeout> | null = null;

    const applyUpdate = () => {
      if (idleCallback !== null) cancelIdleCallback(idleCallback);
      if (maxWaitTimeout !== null) clearTimeout(maxWaitTimeout);

      registration.waiting?.postMessage({ type: "SKIP_WAITING" });
      resolve();
    };

    if ("requestIdleCallback" in window) {
      const scheduleIdleCheck = () => {
        idleCallback = requestIdleCallback(() => applyUpdate(), {
          timeout: IDLE_TIMEOUT_MS,
        });
      };

      scheduleIdleCheck();

      // Reschedule on user activity
      const activityEvents = ["mousedown", "keydown", "touchstart", "scroll"];
      const onActivity = () => {
        if (idleCallback !== null) cancelIdleCallback(idleCallback);
        scheduleIdleCheck();
      };

      activityEvents.forEach((event) => {
        window.addEventListener(event, onActivity, { passive: true });
      });
    }

    // Fallback: apply after max wait time regardless
    maxWaitTimeout = setTimeout(applyUpdate, MAX_IDLE_WAIT_MS);
  });
}

export { applyUpdateWhenIdle };
```

**Why good:** Uses `requestIdleCallback` for browser-native idle detection, max-wait fallback prevents indefinite deferral, reschedules on user activity

---

## Pattern 14: Progressive Rollout

Roll out updates to a percentage of users using persistent bucketing.

```typescript
const ROLLOUT_STORAGE_KEY = "sw-rollout-bucket";
const BUCKET_COUNT = 100;

interface RolloutConfig {
  targetPercentage: number;
  featureFlagEndpoint?: string;
}

function getUserBucket(): number {
  const stored = localStorage.getItem(ROLLOUT_STORAGE_KEY);
  if (stored !== null) return parseInt(stored, 10);

  const bucket = Math.floor(Math.random() * BUCKET_COUNT);
  localStorage.setItem(ROLLOUT_STORAGE_KEY, bucket.toString());
  return bucket;
}

async function shouldApplyUpdate(config: RolloutConfig): Promise<boolean> {
  const bucket = getUserBucket();

  if (config.featureFlagEndpoint) {
    try {
      const response = await fetch(config.featureFlagEndpoint);
      const data = await response.json();
      if (typeof data.targetPercentage === "number") {
        return bucket < data.targetPercentage;
      }
    } catch {
      // Fall through to local config
    }
  }

  return bucket < config.targetPercentage;
}

async function conditionalUpdate(
  registration: ServiceWorkerRegistration,
  config: RolloutConfig,
): Promise<boolean> {
  if (!registration.waiting) return false;

  const shouldUpdate = await shouldApplyUpdate(config);

  if (shouldUpdate) {
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    return true;
  }

  return false;
}

export { conditionalUpdate, getUserBucket, shouldApplyUpdate };
export type { RolloutConfig };
```

**Why good:** Consistent bucketing per user, optional remote config with local fallback, deterministic rollout

---

## Pattern 15: Update with Data Migration

Handle data migrations between service worker versions. Detect previous version from cache names and run versioned migration tasks.

```typescript
declare const self: ServiceWorkerGlobalScope;

const CACHE_VERSION = "v2.0.0";

interface MigrationTask {
  fromVersion: string;
  toVersion: string;
  migrate: () => Promise<void>;
}

const MIGRATIONS: MigrationTask[] = [
  {
    fromVersion: "v1.0.0",
    toVersion: "v2.0.0",
    async migrate() {
      // Example: transform cached API data to new schema
      const oldCache = await caches.open("api-v1.0.0");
      const newCache = await caches.open(`api-${CACHE_VERSION}`);

      const requests = await oldCache.keys();
      for (const request of requests) {
        const response = await oldCache.match(request);
        if (response) {
          const data = await response.json();
          const transformed = transformData(data);
          await newCache.put(
            request,
            new Response(JSON.stringify(transformed), {
              headers: response.headers,
            }),
          );
        }
      }
    },
  },
];

function transformData(data: unknown): unknown {
  return data; // Apply actual transformation
}

async function runMigrations(fromVersion: string): Promise<void> {
  const applicable = MIGRATIONS.filter(
    (m) => m.fromVersion === fromVersion && m.toVersion === CACHE_VERSION,
  );

  for (const migration of applicable) {
    await migration.migrate();
  }
}

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const previousStaticCache = cacheNames.find(
        (name) =>
          name.startsWith("static-") && name !== `static-${CACHE_VERSION}`,
      );

      if (previousStaticCache) {
        const prevVersion = previousStaticCache.replace("static-", "");
        await runMigrations(prevVersion);
      }

      // Clean old caches after migration
      await Promise.all(
        cacheNames
          .filter((name) => !name.includes(CACHE_VERSION))
          .map((name) => caches.delete(name)),
      );

      await self.clients.claim();
    })(),
  );
});
```

**Why good:** Versioned migration tasks, detects previous version from cache names, transforms cached data before cleanup, runs migrations before deleting old caches
