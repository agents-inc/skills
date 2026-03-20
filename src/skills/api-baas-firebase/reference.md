# Firebase Reference

> Firebase CLI commands, project structure, service configuration, and quick lookup tables. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Firebase CLI Commands

### Project Setup

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize a new project (interactive setup)
firebase init

# Select services: firestore, functions, hosting, storage, emulators
```

### Deployment

```bash
# Deploy everything
firebase deploy

# Deploy specific services
firebase deploy --only firestore:rules
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only storage

# Deploy a single function
firebase deploy --only functions:myFunctionName

# Preview hosting before deploying
firebase hosting:channel:deploy preview-channel
```

### Emulators

```bash
# Start all configured emulators
firebase emulators:start

# Start with data persistence
firebase emulators:start --import=./emulator-data --export-on-exit=./emulator-data

# Start specific emulators
firebase emulators:start --only firestore,auth,functions

# Run tests against emulators
firebase emulators:exec "npm test"

# Open Emulator UI in browser
# Default: http://localhost:4000
```

### Functions

```bash
# Initialize Cloud Functions with TypeScript
firebase init functions
# Select TypeScript when prompted

# Serve functions locally (uses emulator)
firebase emulators:start --only functions

# View function logs
firebase functions:log

# Delete a deployed function
firebase functions:delete myFunctionName
```

---

## Environment Variables

```bash
# Client-side (safe to expose -- use your framework's public env prefix)
FIREBASE_API_KEY=AIza...
FIREBASE_AUTH_DOMAIN=my-project.firebaseapp.com
FIREBASE_PROJECT_ID=my-project
FIREBASE_STORAGE_BUCKET=my-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc123

# Server-side only (NEVER expose to client)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

**Note:** Firebase API keys are NOT secret -- they identify your project but don't grant access. Security rules protect your data, not the API key. Use your framework's public env prefix (e.g., `NEXT_PUBLIC_`, `VITE_`) when exposing to client code.

---

## Project Structure

```
my-firebase-app/
+-- firebase.json               # Firebase project configuration
+-- firestore.rules             # Firestore security rules
+-- firestore.indexes.json      # Composite index definitions
+-- storage.rules               # Storage security rules
+-- functions/
|   +-- src/
|   |   +-- index.ts            # Cloud Functions entry point
|   |   +-- posts.ts            # Post-related functions
|   |   +-- auth.ts             # Auth trigger functions
|   +-- package.json            # Functions dependencies
|   +-- tsconfig.json           # TypeScript config for functions
+-- src/
|   +-- lib/
|   |   +-- firebase.ts         # Firebase client initialization
|   +-- types/
|   |   +-- post.ts             # Firestore document types
+-- emulator-data/              # Persisted emulator state
```

---

## firebase.json Configuration

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs22"
  },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "function": {
          "functionId": "api",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "storage": {
    "rules": "storage.rules"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "storage": { "port": 9199 },
    "hosting": { "port": 5000 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

---

## Modular SDK Import Paths

| Service            | Import Path               | Key Exports                                                                                                                                                                      |
| ------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App                | `firebase/app`            | `initializeApp`, `getApp`, `getApps`                                                                                                                                             |
| Firestore          | `firebase/firestore`      | `getFirestore`, `collection`, `doc`, `getDocs`, `getDoc`, `setDoc`, `updateDoc`, `deleteDoc`, `onSnapshot`, `query`, `where`, `orderBy`, `limit`, `runTransaction`, `writeBatch` |
| Firestore Lite     | `firebase/firestore/lite` | Same as above minus `onSnapshot` (smaller bundle)                                                                                                                                |
| Auth               | `firebase/auth`           | `getAuth`, `createUserWithEmailAndPassword`, `signInWithEmailAndPassword`, `signInWithPopup`, `signOut`, `onAuthStateChanged`                                                    |
| Storage            | `firebase/storage`        | `getStorage`, `ref`, `uploadBytes`, `uploadBytesResumable`, `getDownloadURL`, `deleteObject`                                                                                     |
| Functions (client) | `firebase/functions`      | `getFunctions`, `httpsCallable`, `connectFunctionsEmulator`                                                                                                                      |

---

## Admin SDK Import Paths

| Service   | Import Path                | Key Exports                                                            |
| --------- | -------------------------- | ---------------------------------------------------------------------- |
| App       | `firebase-admin/app`       | `initializeApp`, `cert`, `getApp`, `getApps`                           |
| Firestore | `firebase-admin/firestore` | `getFirestore`, `FieldValue`, `Timestamp`                              |
| Auth      | `firebase-admin/auth`      | `getAuth`, `createCustomToken`, `verifyIdToken`, `setCustomUserClaims` |
| Storage   | `firebase-admin/storage`   | `getStorage`                                                           |
| Messaging | `firebase-admin/messaging` | `getMessaging`, `send`, `sendMulticast`                                |

---

## Cloud Functions v2 Import Paths

| Trigger Type    | Import Path                       | Key Exports                                                                        |
| --------------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| HTTP / Callable | `firebase-functions/v2/https`     | `onRequest`, `onCall`, `HttpsError`                                                |
| Firestore       | `firebase-functions/v2/firestore` | `onDocumentCreated`, `onDocumentUpdated`, `onDocumentDeleted`, `onDocumentWritten` |
| Auth            | `firebase-functions/v2/identity`  | `beforeUserCreated`, `beforeUserSignedIn`                                          |
| Scheduler       | `firebase-functions/v2/scheduler` | `onSchedule`                                                                       |
| Storage         | `firebase-functions/v2/storage`   | `onObjectFinalized`, `onObjectDeleted`                                             |
| Pub/Sub         | `firebase-functions/v2/pubsub`    | `onMessagePublished`                                                               |
| Alerts          | `firebase-functions/v2/alerts`    | `onAlertPublished`                                                                 |

---

## Firestore Query Operators

| Method                                     | Description                 | Example                                                  |
| ------------------------------------------ | --------------------------- | -------------------------------------------------------- |
| `where("field", "==", value)`              | Equality                    | `where("published", "==", true)`                         |
| `where("field", "!=", value)`              | Not equal                   | `where("status", "!=", "archived")`                      |
| `where("field", ">", value)`               | Greater than                | `where("age", ">", 18)`                                  |
| `where("field", ">=", value)`              | Greater than or equal       | `where("price", ">=", 10)`                               |
| `where("field", "<", value)`               | Less than                   | `where("score", "<", 50)`                                |
| `where("field", "<=", value)`              | Less than or equal          | `where("count", "<=", 100)`                              |
| `where("field", "in", [])`                 | In array (max 30 values)    | `where("status", "in", ["active", "pending"])`           |
| `where("field", "not-in", [])`             | Not in array (max 10)       | `where("role", "not-in", ["banned"])`                    |
| `where("field", "array-contains", val)`    | Array contains              | `where("tags", "array-contains", "firebase")`            |
| `where("field", "array-contains-any", [])` | Array contains any (max 30) | `where("tags", "array-contains-any", ["web", "mobile"])` |
| `orderBy("field", "asc"\|"desc")`          | Sort results                | `orderBy("createdAt", "desc")`                           |
| `limit(n)`                                 | Limit results               | `limit(20)`                                              |
| `startAfter(docSnapshot)`                  | Cursor pagination           | `startAfter(lastDoc)`                                    |
| `startAt(value)`                           | Start at value              | `startAt("A")`                                           |
| `endBefore(value)`                         | End before value            | `endBefore("Z")`                                         |

---

## Firestore Limits

| Limit                                  | Value          |
| -------------------------------------- | -------------- |
| Max document size                      | 1 MB           |
| Max fields per document                | 20,000         |
| Max nested depth                       | 20 levels      |
| Max writes per batch                   | 500            |
| Max `in` / `array-contains-any` values | 30             |
| Max `not-in` values                    | 10             |
| Sustained write rate per document      | 1 write/second |
| Max composite indexes per database     | 200            |
| Max single-field index exemptions      | 200            |

---

## Auth Events (onAuthStateChanged)

| State           | `user` Parameter | When                                    |
| --------------- | ---------------- | --------------------------------------- |
| Initializing    | `null`           | Page load, before session check         |
| Signed in       | `User` object    | After sign-in or session restore        |
| Signed out      | `null`           | After sign-out or session expiry        |
| Token refreshed | `User` (updated) | ID token auto-refreshed (every ~1 hour) |

---

## Package Versions (as of March 2026)

| Package              | Version | Purpose                                          |
| -------------------- | ------- | ------------------------------------------------ |
| `firebase`           | 12.11.0 | Client SDK (Firestore, Auth, Storage, etc.)      |
| `firebase-admin`     | 13.7.0  | Admin SDK (server-side, bypasses security rules) |
| `firebase-functions` | 7.2.2   | Cloud Functions SDK (v2 API)                     |
| `firebase-tools`     | latest  | Firebase CLI                                     |

**Runtime Requirements:**

- Node.js 20 or 22 (Node.js 18 deprecated early 2025)
- ES2020+ target in tsconfig.json
