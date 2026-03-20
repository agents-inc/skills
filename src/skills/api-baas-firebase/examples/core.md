# Firebase -- Core Examples

> Project initialization, modular SDK setup, emulator connections, and environment configuration. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for quick lookups.

**Related examples:**

- [firestore.md](firestore.md) -- Firestore CRUD, queries, real-time listeners
- [auth.md](auth.md) -- Authentication flows
- [functions.md](functions.md) -- Cloud Functions v2, Admin SDK
- [storage.md](storage.md) -- File upload, download, delete
- [security-rules.md](security-rules.md) -- Firestore and Storage security rules

---

## Firebase App Initialization (Modular SDK)

Initialize Firebase with the modular SDK for tree-shaking. Each service has its own import path.

```typescript
// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY!,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.FIREBASE_PROJECT_ID!,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.FIREBASE_APP_ID!,
};

// Initialize Firebase -- call once at app startup
const app = initializeApp(firebaseConfig);

// Export service instances
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
```

**Why good:** Modular imports enable tree-shaking, environment variables keep config out of code, each service initialized from the app instance, named exports for all services

```typescript
// BAD: Legacy compat namespace API
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/auth";

firebase.initializeApp({
  apiKey: "AIza...", // Hardcoded
  projectId: "my-project",
});

const db = firebase.firestore();
const auth = firebase.auth();
export default { db, auth };
```

**Why bad:** Compat imports prevent tree-shaking (entire SDK bundled), hardcoded credentials leak in source control, side-effect imports, default export

---

## Emulator Suite for Local Development

Use the Firebase Emulator Suite for local development and testing without touching production data.

### Connect to Emulators

```typescript
// lib/firebase.ts -- add emulator connections in development
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

const FIRESTORE_EMULATOR_PORT = 8080;
const AUTH_EMULATOR_PORT = 9099;
const STORAGE_EMULATOR_PORT = 9199;
const FUNCTIONS_EMULATOR_PORT = 5001;

if (process.env.NODE_ENV === "development") {
  connectFirestoreEmulator(db, "localhost", FIRESTORE_EMULATOR_PORT);
  connectAuthEmulator(auth, `http://localhost:${AUTH_EMULATOR_PORT}`);
  connectStorageEmulator(storage, "localhost", STORAGE_EMULATOR_PORT);
  connectFunctionsEmulator(functions, "localhost", FUNCTIONS_EMULATOR_PORT);
}
```

### Start Emulators

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Initialize project (creates firebase.json)
firebase init

# Start all emulators with data persistence
firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data

# Start specific emulators only
firebase emulators:start --only firestore,auth,functions

# Run emulators and execute tests, then shut down
firebase emulators:exec "npm test"
```

**Why good:** Emulator connections guarded by `NODE_ENV`, named constants for ports, `--import/--export-on-exit` persists emulator data between sessions, `emulators:exec` for CI pipelines

---

## Offline Persistence

Enable Firestore offline persistence for apps that need to work without connectivity.

```typescript
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { initializeApp } from "firebase/app";

const app = initializeApp(firebaseConfig);

// Enable persistent offline cache with multi-tab support
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
```

**Why good:** `initializeFirestore` with `persistentLocalCache` is the modern approach (replaces deprecated `enableIndexedDbPersistence`), `persistentMultipleTabManager` enables multi-tab sync, configured at initialization time

```typescript
// BAD: Deprecated persistence API
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const db = getFirestore(app);
enableIndexedDbPersistence(db); // Deprecated -- use initializeFirestore instead
```

**Why bad:** `enableIndexedDbPersistence` is deprecated, must be called before any other Firestore operations, does not support multi-tab by default

---

_For core concepts, see [SKILL.md](../SKILL.md). For quick reference tables, see [reference.md](../reference.md)._
