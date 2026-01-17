# Service Worker Update Examples

> Update handling and versioning patterns for Service Workers. See [SKILL.md](../SKILL.md) for concepts and [core.md](core.md) for basic patterns.

---

## Pattern 22: Version Tracking and Communication

Track service worker version and communicate with clients.

```typescript
// sw.ts - Version communication

declare const self: ServiceWorkerGlobalScope;

const SW_VERSION = "1.2.0";

// Message types
type ClientBoundMessage =
  | { type: "VERSION"; version: string }
  | { type: "UPDATE_AVAILABLE"; newVersion: string }
  | { type: "CACHE_UPDATED"; cacheName: string };

type WorkerBoundMessage =
  | { type: "GET_VERSION" }
  | { type: "SKIP_WAITING" }
  | { type: "CHECK_UPDATE" };

// Handle messages from clients
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
      // Trigger update check
      await self.registration.update();
      break;
  }
});

// Notify all clients of updates
async function notifyClients(message: ClientBoundMessage): Promise<void> {
  const clients = await self.clients.matchAll({ type: "window" });

  for (const client of clients) {
    client.postMessage(message);
  }
}

// On activation, notify clients of new version
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // Cache cleanup...

      await self.clients.claim();

      // Notify clients
      await notifyClients({
        type: "UPDATE_AVAILABLE",
        newVersion: SW_VERSION,
      });
    })()
  );
});

export type { ClientBoundMessage, WorkerBoundMessage };
```

**Why good:** Typed message protocol, bidirectional communication, notifies all clients on update, named exports

---

## Pattern 23: Aggressive Update Strategy

For critical updates, skip waiting and claim immediately.

```typescript
// sw.ts - Aggressive update (use sparingly)

const CACHE_VERSION = "v2.0.0";

// Install - skip waiting immediately
self.addEventListener("install", (event: ExtendableEvent) => {
  console.log("[SW] Installing critical update:", CACHE_VERSION);

  event.waitUntil(
    (async () => {
      const cache = await caches.open(`static-${CACHE_VERSION}`);
      await cache.addAll(PRECACHE_URLS);

      // AGGRESSIVE: Skip waiting immediately
      // Only use for critical security fixes or breaking changes
      await self.skipWaiting();
      console.log("[SW] Skipped waiting - taking control immediately");
    })()
  );
});

// Activate - claim all clients
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // Clean old caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== `static-${CACHE_VERSION}`)
          .map((name) => caches.delete(name))
      );

      // Take control immediately
      await self.clients.claim();

      // Optionally force reload all clients
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        client.postMessage({ type: "FORCE_RELOAD" });
      }
    })()
  );
});
```

**Warning:** This can disrupt user experience by changing behavior mid-session. Use only for critical fixes.

**Why good:** Clear warning about when to use, notifies clients to reload, comments explain aggressive behavior

---

## Pattern 24: Deferred Update Strategy

Let users choose when to apply updates.

```typescript
// Client-side update handler

interface UpdateHandler {
  checkForUpdates: () => Promise<boolean>;
  applyUpdate: () => void;
  dismissUpdate: () => void;
}

function createUpdateHandler(
  onUpdateAvailable: (version: string) => void
): UpdateHandler {
  let waitingWorker: ServiceWorker | null = null;
  let dismissedVersions = new Set<string>();

  // Load dismissed versions from storage
  const storedDismissed = localStorage.getItem("sw-dismissed-versions");
  if (storedDismissed) {
    dismissedVersions = new Set(JSON.parse(storedDismissed));
  }

  const saveDismissed = () => {
    localStorage.setItem(
      "sw-dismissed-versions",
      JSON.stringify([...dismissedVersions])
    );
  };

  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === "VERSION") {
      const version = event.data.version;
      if (!dismissedVersions.has(version)) {
        onUpdateAvailable(version);
      }
    }
  };

  navigator.serviceWorker.addEventListener("message", handleMessage);

  return {
    async checkForUpdates(): Promise<boolean> {
      const registration = await navigator.serviceWorker.ready;

      if (registration.waiting) {
        waitingWorker = registration.waiting;
        waitingWorker.postMessage({ type: "GET_VERSION" });
        return true;
      }

      // Trigger update check
      await registration.update();

      if (registration.waiting) {
        waitingWorker = registration.waiting;
        return true;
      }

      return false;
    },

    applyUpdate(): void {
      if (waitingWorker) {
        waitingWorker.postMessage({ type: "SKIP_WAITING" });
      }
    },

    dismissUpdate(): void {
      if (waitingWorker) {
        // Get version and add to dismissed
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

**Why good:** User controls when to update, dismissed versions tracked in localStorage, typed interface, named exports

---

## Pattern 25: Update at Idle Time

Apply updates when user is idle to minimize disruption.

```typescript
// update-at-idle.ts

const IDLE_TIMEOUT_MS = 30000; // 30 seconds of inactivity
const MAX_IDLE_WAIT_MS = 300000; // 5 minutes max wait

async function applyUpdateWhenIdle(registration: ServiceWorkerRegistration): Promise<void> {
  if (!registration.waiting) {
    return;
  }

  return new Promise((resolve) => {
    let idleCallback: number | null = null;
    let maxWaitTimeout: ReturnType<typeof setTimeout> | null = null;

    const applyUpdate = () => {
      if (idleCallback !== null) {
        cancelIdleCallback(idleCallback);
      }
      if (maxWaitTimeout !== null) {
        clearTimeout(maxWaitTimeout);
      }

      registration.waiting?.postMessage({ type: "SKIP_WAITING" });
      resolve();
    };

    // Use requestIdleCallback if available
    if ("requestIdleCallback" in window) {
      const scheduleIdleCheck = () => {
        idleCallback = requestIdleCallback(
          () => {
            console.log("[SW] User idle, applying update");
            applyUpdate();
          },
          { timeout: IDLE_TIMEOUT_MS }
        );
      };

      scheduleIdleCheck();

      // Reschedule on user activity
      const activityEvents = ["mousedown", "keydown", "touchstart", "scroll"];

      const onActivity = () => {
        if (idleCallback !== null) {
          cancelIdleCallback(idleCallback);
        }
        scheduleIdleCheck();
      };

      activityEvents.forEach((event) => {
        window.addEventListener(event, onActivity, { passive: true });
      });
    }

    // Fallback: apply after max wait time regardless
    maxWaitTimeout = setTimeout(() => {
      console.log("[SW] Max wait time reached, applying update");
      applyUpdate();
    }, MAX_IDLE_WAIT_MS);
  });
}

export { applyUpdateWhenIdle };
```

**Why good:** Uses requestIdleCallback for browser-native idle detection, fallback for max wait time, cleans up listeners, named constants

---

## Pattern 26: Progressive Update Rollout

Roll out updates to a percentage of users.

```typescript
// progressive-rollout.ts

const ROLLOUT_STORAGE_KEY = "sw-rollout-bucket";
const BUCKET_COUNT = 100;

interface RolloutConfig {
  targetPercentage: number;
  featureFlagEndpoint?: string;
}

function getUserBucket(): number {
  // Check for existing bucket
  const stored = localStorage.getItem(ROLLOUT_STORAGE_KEY);
  if (stored !== null) {
    return parseInt(stored, 10);
  }

  // Assign random bucket
  const bucket = Math.floor(Math.random() * BUCKET_COUNT);
  localStorage.setItem(ROLLOUT_STORAGE_KEY, bucket.toString());
  return bucket;
}

async function shouldApplyUpdate(config: RolloutConfig): Promise<boolean> {
  const bucket = getUserBucket();

  // Check remote feature flag if endpoint provided
  if (config.featureFlagEndpoint) {
    try {
      const response = await fetch(config.featureFlagEndpoint);
      const data = await response.json();

      if (typeof data.targetPercentage === "number") {
        return bucket < data.targetPercentage;
      }
    } catch (error) {
      console.warn("[SW] Failed to fetch rollout config, using default");
    }
  }

  // Use local config
  return bucket < config.targetPercentage;
}

async function conditionalUpdate(
  registration: ServiceWorkerRegistration,
  config: RolloutConfig
): Promise<boolean> {
  if (!registration.waiting) {
    return false;
  }

  const shouldUpdate = await shouldApplyUpdate(config);

  if (shouldUpdate) {
    console.log("[SW] User in rollout group, applying update");
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    return true;
  }

  console.log("[SW] User not in rollout group, deferring update");
  return false;
}

export { conditionalUpdate, getUserBucket, shouldApplyUpdate };
export type { RolloutConfig };
```

**Why good:** Consistent bucketing per user, optional remote config, fallback to local config, named exports

---

## Pattern 27: Update with Data Migration

Handle data migrations when updating service worker versions.

```typescript
// sw.ts - Data migration during update

declare const self: ServiceWorkerGlobalScope;

const CACHE_VERSION = "v2.0.0";
const PREVIOUS_VERSION = "v1.0.0";

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
      console.log("[SW] Running migration v1.0.0 -> v2.0.0");

      // Example: Migrate IndexedDB schema
      const db = await openDatabase();

      // Add new object store
      if (!db.objectStoreNames.contains("newStore")) {
        // Would need to handle version upgrade
        console.log("[SW] Database migration needed");
      }

      // Example: Transform cached data
      const oldCache = await caches.open(`api-${PREVIOUS_VERSION}`);
      const newCache = await caches.open(`api-${CACHE_VERSION}`);

      const requests = await oldCache.keys();

      for (const request of requests) {
        const response = await oldCache.match(request);
        if (response) {
          // Transform data if needed
          const data = await response.json();
          const transformed = transformData(data);

          const newResponse = new Response(JSON.stringify(transformed), {
            headers: response.headers,
          });

          await newCache.put(request, newResponse);
        }
      }

      console.log("[SW] Migration complete");
    },
  },
];

function transformData(data: unknown): unknown {
  // Apply data transformations
  return data;
}

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("app-db", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function runMigrations(fromVersion: string): Promise<void> {
  const applicableMigrations = MIGRATIONS.filter(
    (m) => m.fromVersion === fromVersion && m.toVersion === CACHE_VERSION
  );

  for (const migration of applicableMigrations) {
    await migration.migrate();
  }
}

// Activation with migration
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // Detect previous version from cache names
      const cacheNames = await caches.keys();
      const previousStaticCache = cacheNames.find(
        (name) => name.startsWith("static-") && name !== `static-${CACHE_VERSION}`
      );

      if (previousStaticCache) {
        const prevVersion = previousStaticCache.replace("static-", "");
        await runMigrations(prevVersion);
      }

      // Clean old caches
      await Promise.all(
        cacheNames
          .filter((name) => !name.includes(CACHE_VERSION))
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});
```

**Why good:** Versioned migration tasks, detects previous version from cache names, transforms cached data, proper cleanup after migration

---

## Pattern 28: Service Worker Self-Update Check

Periodically check for updates and notify users.

```typescript
// sw.ts - Self-update checking

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const SW_VERSION = "1.0.0";

let updateCheckInterval: ReturnType<typeof setInterval> | null = null;

// Start periodic update checks
function startUpdateChecks(): void {
  if (updateCheckInterval) {
    return;
  }

  updateCheckInterval = setInterval(async () => {
    try {
      // Fetch a version endpoint or the SW file itself
      const response = await fetch("/api/sw-version");
      const data = await response.json();

      if (data.version !== SW_VERSION) {
        console.log("[SW] New version available:", data.version);

        // Notify all clients
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          client.postMessage({
            type: "NEW_VERSION_AVAILABLE",
            currentVersion: SW_VERSION,
            newVersion: data.version,
          });
        }

        // Trigger registration update
        await self.registration.update();
      }
    } catch (error) {
      console.error("[SW] Update check failed:", error);
    }
  }, UPDATE_CHECK_INTERVAL_MS);
}

// Stop update checks (e.g., when going offline)
function stopUpdateChecks(): void {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
}

// Start checks when service worker activates
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      // ... other activation logic

      startUpdateChecks();
    })()
  );
});

export { startUpdateChecks, stopUpdateChecks };
```

**Why good:** Named constant for interval, notifies clients of available updates, can be stopped/started, checks remote version endpoint
