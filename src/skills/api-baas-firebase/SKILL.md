---
name: api-baas-firebase
description: Firebase backend-as-a-service — Firestore, Authentication, Cloud Functions v2, Storage, Hosting, Admin SDK, security rules, emulator suite
---

# Firebase Patterns

> **Quick Guide:** Use Firebase as your backend-as-a-service for Firestore database, authentication, Cloud Functions, file storage, and hosting. Always use the modular SDK (`firebase/app`, `firebase/firestore`, etc.) for tree-shaking, type Firestore documents with TypeScript interfaces, write security rules for every collection, and use the Admin SDK only on the server.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use the modular Firebase SDK imports (`firebase/app`, `firebase/firestore`, `firebase/auth`) — NEVER use the deprecated `firebase/compat` namespace API)**

**(You MUST write Firestore security rules for EVERY collection — a collection without rules is wide open in production)**

**(You MUST NEVER expose Firebase Admin SDK credentials or service account keys in client-side code)**

**(You MUST use Cloud Functions v2 API (`firebase-functions/v2/https`, `firebase-functions/v2/firestore`) — NOT the deprecated v1 API)**

**(You MUST handle all Firestore operations with error checking — never assume reads/writes succeed)**

</critical_requirements>

---

**Auto-detection:** Firebase, initializeApp, firebase/app, firebase/firestore, firebase/auth, getFirestore, getAuth, onAuthStateChanged, collection, doc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, firebase-admin, firebase-functions, Cloud Functions, Firestore security rules, firebase.json, firebase deploy

**When to use:**

- Initializing Firebase and configuring services (Firestore, Auth, Storage, Functions)
- Implementing authentication (email/password, OAuth, phone, custom tokens)
- Querying and writing Firestore documents (CRUD, real-time listeners, transactions)
- Writing Cloud Functions v2 (HTTP handlers, callable functions, Firestore triggers, scheduled functions)
- Uploading and serving files from Firebase Storage
- Deploying to Firebase Hosting with function rewrites
- Writing Firestore and Storage security rules
- Using the Firebase Admin SDK for server-side operations

**Key patterns covered:**

- Modular SDK setup with `initializeApp` and service getters (`getFirestore`, `getAuth`, `getStorage`)
- Auth flows: sign up, sign in, OAuth, phone auth, `onAuthStateChanged`, session management
- Firestore CRUD with `doc()`, `collection()`, `getDocs()`, `setDoc()`, `updateDoc()`, `deleteDoc()`
- Firestore real-time listeners with `onSnapshot()`
- Firestore queries with `where()`, `orderBy()`, `limit()`, composite indexes
- Cloud Functions v2: `onRequest`, `onCall`, `onDocumentCreated`, `onSchedule`
- Firebase Admin SDK: `initializeApp()`, `getFirestore()`, `getAuth()`, custom tokens, user management
- Security rules: read/write granularity, auth-based access, data validation
- Emulator suite for local development and testing
- Offline persistence with `persistentLocalCache`

**When NOT to use:**

- Complex relational queries needing JOIN operations (use a SQL database with Drizzle/Prisma)
- Full server-side ORM patterns (Firestore is a document database, not relational)
- Non-Firebase authentication providers (use dedicated auth skills)
- Applications requiring complex server-side business logic beyond Cloud Functions scope

**Detailed Resources:**

- For decision frameworks and quick lookup tables, see [reference.md](reference.md)

**Client Setup & Firestore:**

- [examples/firebase.md](examples/firebase.md) — Setup, Firestore CRUD, auth flows, Cloud Functions, Storage

---

<philosophy>

## Philosophy

Firebase is Google's Backend-as-a-Service platform providing a complete backend through Firestore (document database), Authentication, Cloud Functions, Storage, Hosting, and more. The modular SDK (v12+) uses tree-shakeable ES module imports for minimal bundle sizes.

**Core principles:**

1. **Modular imports for tree-shaking** — Import only what you need from `firebase/firestore`, `firebase/auth`, etc. The modular SDK can reduce bundle size by 80%+ compared to the legacy namespace API.
2. **Document-oriented data model** — Firestore stores data as documents in collections. Design your data model around your query patterns, not normalized relations. Denormalization is expected.
3. **Security rules are mandatory** — Firestore and Storage are directly accessible from clients. Security rules are your only server-side access control. Every collection needs rules.
4. **Cloud Functions v2 on Cloud Run** — 2nd generation functions run on Cloud Run with better scaling, concurrency, longer timeouts (up to 60 minutes), and traffic splitting. Always use v2 for new projects.
5. **Offline-first with persistence** — Firestore supports offline persistence via IndexedDB. Enable it with `persistentLocalCache` for apps that must work without connectivity.
6. **Admin SDK for server-side** — The Firebase Admin SDK bypasses security rules and has full access. Use it only in trusted server environments (Cloud Functions, API servers).

**When to use Firebase:**

- Rapid prototyping and MVPs with auth, database, and storage out of the box
- Real-time applications (chat, live dashboards, collaborative editing) via Firestore listeners
- Mobile and web apps needing offline support with automatic sync
- Projects wanting serverless backend logic with Cloud Functions
- Applications needing simple file storage with security rules

**When NOT to use:**

- Complex relational data with many-to-many relationships and JOINs (use a relational database)
- Applications needing full-text search (Firestore has limited search — integrate Algolia or Typesense)
- High-write-throughput scenarios exceeding 10,000 writes/second to a single document
- Applications requiring complex server-side transactions spanning multiple services

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Firebase App Initialization (Modular SDK)

Initialize Firebase with the modular SDK for tree-shaking. Each service has its own import path.

```typescript
// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Initialize Firebase — call once at app startup
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

### Pattern 2: Firestore CRUD Operations

Use modular functions for all Firestore read/write operations. Always type your documents.

#### TypeScript Document Types

```typescript
// types/post.ts
export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Omit auto-generated fields for creation
export type PostCreate = Omit<Post, "id" | "createdAt" | "updatedAt">;
```

#### Read Operations

```typescript
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Post } from "../types/post";

const POSTS_COLLECTION = "posts";
const DEFAULT_PAGE_SIZE = 20;

// Get a single document by ID
async function getPost(postId: string): Promise<Post> {
  const docRef = doc(db, POSTS_COLLECTION, postId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error(`Post not found: ${postId}`);
  }

  return { id: docSnap.id, ...docSnap.data() } as Post;
}

// Query documents with filters
async function getPublishedPosts(): Promise<Post[]> {
  const postsRef = collection(db, POSTS_COLLECTION);
  const q = query(
    postsRef,
    where("published", "==", true),
    orderBy("createdAt", "desc"),
    limit(DEFAULT_PAGE_SIZE),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Post);
}
```

**Why good:** Named constants for collection name and page size, existence check before accessing data, typed return values, modular imports for each Firestore function

#### Write Operations

```typescript
import {
  doc,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { PostCreate } from "../types/post";

const POSTS_COLLECTION = "posts";

// Create a document with auto-generated ID
async function createPost(data: PostCreate): Promise<string> {
  const docRef = doc(collection(db, POSTS_COLLECTION));

  await setDoc(docRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

// Update specific fields
async function updatePost(
  postId: string,
  data: Partial<PostCreate>,
): Promise<void> {
  const docRef = doc(db, POSTS_COLLECTION, postId);

  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// Delete a document
async function deletePost(postId: string): Promise<void> {
  const docRef = doc(db, POSTS_COLLECTION, postId);
  await deleteDoc(docRef);
}
```

**Why good:** `serverTimestamp()` ensures consistent server-side timestamps, `doc(collection(db, ...))` generates auto-IDs, `updateDoc` for partial updates, typed input parameters

```typescript
// BAD: Untyped, no error handling, magic strings
import { getFirestore, doc, setDoc } from "firebase/firestore";

async function save(data: any) {
  await setDoc(doc(getFirestore(), "posts", data.id), data);
}
```

**Why bad:** `any` type loses all safety, `getFirestore()` called on every operation instead of shared instance, no `serverTimestamp()`, no error handling, magic string for collection name

---

### Pattern 3: Firestore Real-Time Listeners

Subscribe to document and collection changes with `onSnapshot`. Always unsubscribe to prevent memory leaks.

```typescript
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Post } from "../types/post";

const POSTS_COLLECTION = "posts";

// Listen to a collection query
function subscribeToPublishedPosts(
  onUpdate: (posts: Post[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const postsRef = collection(db, POSTS_COLLECTION);
  const q = query(
    postsRef,
    where("published", "==", true),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const posts = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Post,
      );
      onUpdate(posts);
    },
    (error) => {
      onError(new Error(`Failed to listen to posts: ${error.message}`));
    },
  );
}

// Listen to a single document
function subscribeToPost(
  postId: string,
  onUpdate: (post: Post | null) => void,
): Unsubscribe {
  const docRef = doc(db, POSTS_COLLECTION, postId);

  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate({ id: snapshot.id, ...snapshot.data() } as Post);
    } else {
      onUpdate(null);
    }
  });
}

// Usage — always store and call the unsubscribe function
const unsubscribe = subscribeToPublishedPosts(
  (posts) => console.log("Posts updated:", posts.length),
  (error) => console.error(error),
);

// Cleanup when component unmounts or listener is no longer needed
unsubscribe();
```

**Why good:** Returns `Unsubscribe` function for cleanup, separate error callback, typed callback parameters, existence check for single-doc listener

```typescript
// BAD: No cleanup, no error handling
onSnapshot(collection(db, "posts"), (snapshot) => {
  // Listener runs forever — memory leak
  const posts = snapshot.docs.map((d) => d.data());
});
```

**Why bad:** No unsubscribe stored (memory leak), no error callback (silent failures), untyped data, no query filters (listens to entire collection)

---

### Pattern 4: Firestore Transactions and Batched Writes

Use transactions for atomic read-then-write operations. Use batched writes for multiple writes without reads.

```typescript
import {
  runTransaction,
  writeBatch,
  doc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

const POSTS_COLLECTION = "posts";
const USERS_COLLECTION = "users";

// Transaction: atomic read-then-write (e.g., increment a counter)
async function likePost(postId: string, userId: string): Promise<void> {
  const postRef = doc(db, POSTS_COLLECTION, postId);
  const likeRef = doc(db, POSTS_COLLECTION, postId, "likes", userId);

  await runTransaction(db, async (transaction) => {
    const postSnap = await transaction.get(postRef);

    if (!postSnap.exists()) {
      throw new Error(`Post not found: ${postId}`);
    }

    transaction.update(postRef, { likeCount: increment(1) });
    transaction.set(likeRef, { createdAt: serverTimestamp() });
  });
}

// Batched write: multiple writes without reads (up to 500 operations)
const MAX_BATCH_SIZE = 500;

async function deleteUserPosts(postIds: string[]): Promise<void> {
  const batch = writeBatch(db);

  for (const postId of postIds.slice(0, MAX_BATCH_SIZE)) {
    const docRef = doc(db, POSTS_COLLECTION, postId);
    batch.delete(docRef);
  }

  await batch.commit();
}
```

**Why good:** Transaction ensures atomic increment (no race conditions), `increment()` for safe counter updates, batch write for bulk operations, `MAX_BATCH_SIZE` constant documents the 500 limit

---

### Pattern 5: Authentication Flows

Use Firebase Authentication with the modular SDK. Handle auth state changes with `onAuthStateChanged`.

#### Email/Password Auth

```typescript
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { auth } from "../lib/firebase";

// Sign up
async function signUp(email: string, password: string): Promise<User> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );
  return credential.user;
}

// Sign in
async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

// Sign out
async function logOut(): Promise<void> {
  await signOut(auth);
}

// Listen to auth state — register early in app lifecycle
function subscribeToAuthState(
  callback: (user: User | null) => void,
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}
```

#### OAuth (Social Login)

```typescript
import {
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  GithubAuthProvider,
  type User,
} from "firebase/auth";
import { auth } from "../lib/firebase";

const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

// Sign in with Google (popup)
async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

// Sign in with GitHub (redirect — better for mobile)
async function signInWithGithub(): Promise<void> {
  await signInWithRedirect(auth, githubProvider);
}
```

#### Get Current User Token (for API calls)

```typescript
import { auth } from "../lib/firebase";

async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;

  if (!user) {
    return null;
  }

  // Force refresh if token is expired
  return user.getIdToken(/* forceRefresh */ true);
}

// Use in API calls
async function fetchFromApi(endpoint: string): Promise<Response> {
  const token = await getIdToken();

  if (!token) {
    throw new Error("User not authenticated");
  }

  return fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

**Why good:** Modular imports for each auth function, typed `User` return values, `Unsubscribe` for cleanup, separate providers as constants, token retrieval with force refresh for API calls

---

### Pattern 6: Cloud Functions v2

Write Cloud Functions using the v2 API. Import from `firebase-functions/v2/*` subpackages.

#### HTTP Function

```typescript
// functions/src/index.ts
import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp } from "firebase-admin/app";

initializeApp();
const db = getFirestore();

const POSTS_COLLECTION = "posts";
const DEFAULT_LIMIT = 10;

export const getPosts = onRequest(
  { cors: true, region: "us-central1" },
  async (req, res) => {
    try {
      const snapshot = await db
        .collection(POSTS_COLLECTION)
        .orderBy("createdAt", "desc")
        .limit(DEFAULT_LIMIT)
        .get();

      const posts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json({ posts });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  },
);
```

#### Callable Function

```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const db = getFirestore();
const POSTS_COLLECTION = "posts";

export const createPost = onCall({ region: "us-central1" }, async (request) => {
  // Verify authentication
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Must be signed in to create a post",
    );
  }

  const { title, content } = request.data;

  if (!title || !content) {
    throw new HttpsError("invalid-argument", "Title and content are required");
  }

  const docRef = await db.collection(POSTS_COLLECTION).add({
    title,
    content,
    authorId: request.auth.uid,
    published: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { id: docRef.id };
});
```

#### Firestore Trigger

```typescript
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const db = getFirestore();
const USERS_COLLECTION = "users";

export const onPostCreated = onDocumentCreated(
  { document: "posts/{postId}", region: "us-central1" },
  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      return;
    }

    const postData = snapshot.data();
    const authorId = postData.authorId;

    // Increment the author's post count
    await db
      .collection(USERS_COLLECTION)
      .doc(authorId)
      .update({
        postCount: FieldValue.increment(1),
      });
  },
);
```

#### Scheduled Function

```typescript
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();
const SESSIONS_COLLECTION = "sessions";
const SESSION_EXPIRY_DAYS = 30;

export const cleanupExpiredSessions = onSchedule(
  { schedule: "every 24 hours", region: "us-central1" },
  async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - SESSION_EXPIRY_DAYS);

    const expired = await db
      .collection(SESSIONS_COLLECTION)
      .where("lastActive", "<", cutoff)
      .get();

    const batch = db.batch();
    for (const doc of expired.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  },
);
```

**Why good:** v2 imports from subpackages (`firebase-functions/v2/https`, `firebase-functions/v2/firestore`), region specified, `HttpsError` for callable error handling, auth check in callable, Admin SDK for server-side Firestore, named constants

```typescript
// BAD: v1 API (deprecated for new projects)
import * as functions from "firebase-functions";

export const myFunc = functions.https.onRequest((req, res) => {
  // v1: no concurrency, no region options object, no traffic splitting
  res.send("Hello");
});

export const onPost = functions.firestore
  .document("posts/{postId}")
  .onCreate((snap, context) => {
    // v1 trigger syntax
  });
```

**Why bad:** v1 namespace import prevents tree-shaking, no concurrency support, limited configuration options, deprecated `functions.config()` for secrets, no region specification

---

### Pattern 7: Firebase Admin SDK (Server-Side)

Use the Admin SDK in Cloud Functions, API routes, or any trusted server environment. The Admin SDK bypasses all security rules.

```typescript
// functions/src/admin.ts
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

// In Cloud Functions, initializeApp() uses default credentials automatically
initializeApp();

// In standalone servers, use a service account
// initializeApp({
//   credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)),
// });

export const adminDb = getFirestore();
export const adminAuth = getAuth();
export const adminStorage = getStorage();

// Create a custom token for a user
async function createCustomToken(
  uid: string,
  claims?: object,
): Promise<string> {
  return adminAuth.createCustomToken(uid, claims);
}

// Verify an ID token from a client
async function verifyIdToken(idToken: string) {
  return adminAuth.verifyIdToken(idToken);
}

// Admin Firestore operations bypass security rules
async function adminGetUser(userId: string) {
  const userRecord = await adminAuth.getUser(userId);
  return userRecord;
}

// Set custom claims on a user (e.g., admin role)
async function setAdminRole(uid: string): Promise<void> {
  await adminAuth.setCustomUserClaims(uid, { admin: true });
}
```

**Why good:** Modular Admin SDK imports (`firebase-admin/app`, `firebase-admin/firestore`), default credentials in Cloud Functions, explicit `cert()` for standalone servers, custom tokens for third-party auth integration, custom claims for role-based access

---

### Pattern 8: Firebase Storage

Upload, download, and manage files with Firebase Storage using the modular SDK.

```typescript
import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTaskSnapshot,
} from "firebase/storage";
import { storage } from "../lib/firebase";

const AVATARS_PATH = "avatars";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Simple upload
async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("File exceeds 5MB limit");
  }

  const storageRef = ref(storage, `${AVATARS_PATH}/${userId}/avatar.png`);
  await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: { uploadedBy: userId },
  });

  return getDownloadURL(storageRef);
}

// Resumable upload with progress tracking
function uploadWithProgress(
  path: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<string> {
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot: UploadTaskSnapshot) => {
        const PERCENT_MULTIPLIER = 100;
        const percent =
          (snapshot.bytesTransferred / snapshot.totalBytes) *
          PERCENT_MULTIPLIER;
        onProgress(percent);
      },
      (error) => reject(new Error(`Upload failed: ${error.message}`)),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      },
    );
  });
}

// Delete a file
async function deleteAvatar(userId: string): Promise<void> {
  const storageRef = ref(storage, `${AVATARS_PATH}/${userId}/avatar.png`);
  await deleteObject(storageRef);
}
```

**Why good:** Modular imports, file size validation before upload, `uploadBytesResumable` for progress tracking, `getDownloadURL` for publicly accessible URLs, named constants for paths and limits

---

### Pattern 9: Security Rules

Firestore and Storage security rules are your primary access control mechanism. Rules are deployed via `firebase deploy --only firestore:rules` or `firebase deploy --only storage`.

#### Firestore Security Rules

```
// firestore.rules
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function: check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper function: check if user owns the resource
    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    // Helper function: check if user has admin custom claim
    function isAdmin() {
      return request.auth.token.admin == true;
    }

    // Posts collection
    match /posts/{postId} {
      // Anyone can read published posts; authors can read their own drafts
      allow read: if resource.data.published == true
                  || isOwner(resource.data.authorId);

      // Only authenticated users can create posts as themselves
      allow create: if isAuthenticated()
                    && request.resource.data.authorId == request.auth.uid
                    && request.resource.data.title is string
                    && request.resource.data.title.size() > 0
                    && request.resource.data.title.size() <= 200;

      // Authors can update their own posts
      allow update: if isOwner(resource.data.authorId)
                    && request.resource.data.authorId == resource.data.authorId;

      // Authors and admins can delete posts
      allow delete: if isOwner(resource.data.authorId) || isAdmin();

      // Subcollection: likes
      match /likes/{likeId} {
        allow read: if true;
        allow create: if isAuthenticated() && likeId == request.auth.uid;
        allow delete: if isAuthenticated() && likeId == request.auth.uid;
      }
    }

    // User profiles
    match /users/{userId} {
      allow read: if true;
      allow create: if isOwner(userId);
      allow update: if isOwner(userId);
      allow delete: if false; // Users cannot delete their own profile document
    }
  }
}
```

**Why good:** `rules_version = '2'` required for collection group queries, helper functions reduce duplication, granular read/write split into create/update/delete, data validation on create, ownership check prevents authorId spoofing on update, subcollection rules nested properly

#### Storage Security Rules

```
// storage.rules
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    // Avatars: users can upload/read their own avatar
    match /avatars/{userId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }

    // Documents: authenticated users can upload, only owner can read
    match /documents/{userId}/{fileName} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && request.resource.size < 10 * 1024 * 1024;
    }

    // Deny everything else by default
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

**Why good:** File size limits enforced in rules, content type validation for images, owner-based access control, default deny for unmatched paths

```
// BAD: Wide-open security rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // DANGER: Anyone can read/write everything
    }
  }
}
```

**Why bad:** No authentication check, no access control, no data validation, entire database is public read/write — this is the default test-mode rule and must NEVER be deployed to production

---

### Pattern 10: Emulator Suite for Local Development

Use the Firebase Emulator Suite for local development and testing without touching production data.

#### Connect to Emulators

```typescript
// lib/firebase.ts — add emulator connections in development
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

#### Start Emulators

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

### Pattern 11: Offline Persistence

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
enableIndexedDbPersistence(db); // Deprecated — use initializeFirestore instead
```

**Why bad:** `enableIndexedDbPersistence` is deprecated, must be called before any other Firestore operations, does not support multi-tab by default

</patterns>

---

<performance>

## Performance Optimization

### Query Performance

- **Use composite indexes** — Firestore auto-creates single-field indexes but compound queries (multiple `where` + `orderBy`) need composite indexes. Deploy via `firestore.indexes.json` or let Firestore error messages guide you with auto-generated index links.
- **Limit result sets** — Always use `limit()` to cap query results. Unbounded queries fetch all matching documents.
- **Paginate with cursors** — Use `startAfter()` with the last document snapshot for efficient pagination instead of `offset()`.
- **Select specific fields** — Use `select()` in Admin SDK queries to fetch only needed fields (client SDK always fetches full documents).

### Bundle Size

- **Use `initializeAuth` for granular control** — `getAuth()` enables all auth methods by default. Use `initializeAuth()` with only the providers you need for smaller bundles.
- **Use `firebase/firestore/lite`** — If you don't need real-time listeners, import from `firebase/firestore/lite` for a smaller Firestore bundle (no `onSnapshot`).

### Cloud Functions

- **Minimize cold starts** — Use `onInit()` for lazy initialization. Keep function dependencies small. Consider "fat functions" (one entry point routing to handlers) over many small functions.
- **Set appropriate memory/timeout** — Configure `memory` and `timeoutSeconds` in function options instead of using defaults.
- **Use global variables for reusable connections** — Initialize Admin SDK and database connections outside the function handler so they persist across invocations.

</performance>

---

<decision_framework>

## Decision Framework

### Firestore vs Realtime Database

```
What does your app need?
+-- Complex queries (where, orderBy, compound) --> Firestore
+-- Simple key-value lookups with low latency --> Realtime Database
+-- Offline support with rich queries --> Firestore
+-- Presence system (online/offline status) --> Realtime Database
+-- Multi-region availability --> Firestore
+-- Very frequent small updates (typing indicators) --> Realtime Database
+-- For most new projects --> Firestore (recommended default)
```

### Auth Method Selection

```
What auth flow does the user need?
+-- Email + Password --> createUserWithEmailAndPassword / signInWithEmailAndPassword
+-- Social login (Google, GitHub, etc.) --> signInWithPopup / signInWithRedirect
+-- Phone + SMS --> signInWithPhoneNumber (requires reCAPTCHA)
+-- Email link (passwordless) --> sendSignInLinkToEmail
+-- Custom backend auth --> Admin SDK createCustomToken + client signInWithCustomToken
+-- Anonymous (guest) --> signInAnonymously (upgrade later with linkWithCredential)
```

### Cloud Functions: onRequest vs onCall

```
Who is calling the function?
+-- External webhooks, third-party services --> onRequest (raw HTTP)
+-- Your own client app (web/mobile) --> onCall (automatic auth, input validation)
+-- Firestore document changes --> onDocumentCreated / onDocumentUpdated / onDocumentDeleted
+-- Scheduled/cron tasks --> onSchedule
+-- Authentication events --> onUserCreated / onUserDeleted (from firebase-functions/v2/identity)
```

### Client SDK vs Admin SDK

```
Where is the code running?
+-- Browser / Client-side --> Client SDK (firebase) — security rules enforced
+-- Cloud Functions --> Admin SDK (firebase-admin) — bypasses security rules
+-- API server / backend --> Admin SDK (firebase-admin) — use service account
+-- NEVER use Admin SDK in client code --> It bypasses all security
```

### Storage: When to Use Firebase Storage

```
What kind of files?
+-- User-generated content (avatars, uploads) --> Firebase Storage with security rules
+-- Public static assets (CSS, images) --> Firebase Hosting (faster CDN)
+-- Large files with progress tracking --> Firebase Storage with uploadBytesResumable
+-- Server-generated files (reports, exports) --> Firebase Storage via Admin SDK
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **React / Next.js**: Use `onAuthStateChanged` in a context provider, Firestore listeners in `useEffect` with cleanup
- **React Query / TanStack Query**: Wrap Firestore reads in query functions, use `onSnapshot` for real-time invalidation
- **Firebase Hosting + Cloud Functions**: Rewrite rules in `firebase.json` route requests to functions
- **App Check**: Protect your backend resources from abuse by verifying requests come from your app (`initializeAppCheck` with reCAPTCHA Enterprise)
- **Firebase Extensions**: Pre-built Cloud Functions for common tasks (Stripe payments, image resizing, email sending)

**Replaces / Conflicts with:**

- **Supabase**: Alternative BaaS — don't use both for the same purpose
- **AWS Amplify**: Alternative BaaS — pick one platform
- **Custom auth (Clerk, Auth0)**: Firebase Auth can replace these, or vice versa — don't mix auth providers

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Wide-open security rules in production** — The default test-mode rules (`allow read, write: if true`) give everyone full access to your entire database. This is the single most common Firebase security vulnerability.
- **Admin SDK credentials in client code** — Service account keys or Admin SDK imports in browser bundles give attackers full bypass of all security rules.
- **Using the compat/namespace API** — `firebase/compat/*` imports prevent tree-shaking, bundling the entire SDK. The compat layer will be removed in a future major version.
- **Not handling auth state changes** — Calling Firestore without waiting for `onAuthStateChanged` can result in unauthenticated requests that fail silently against security rules.

**Medium Priority Issues:**

- **Using v1 Cloud Functions API** — v1 (`functions.https.onRequest`) lacks concurrency, traffic splitting, and longer timeouts. All new functions should use v2 (`firebase-functions/v2/https`).
- **Not unsubscribing from `onSnapshot`** — Leaked listeners keep WebSocket connections open, consume bandwidth, and cause memory leaks.
- **Unbounded queries** — Queries without `limit()` can fetch thousands of documents, causing performance issues and high read costs.
- **Monotonically increasing document IDs** — Sequential IDs like `user1`, `user2` create hotspots. Use Firestore auto-generated IDs or UUIDs.
- **Using `functions.config()`** — Deprecated and will fail after March 2027. Use Cloud Secret Manager (`defineSecret()`) or environment variables.

**Common Mistakes:**

- **Not adding `.select()` after Admin SDK queries** — Without `select()`, all document fields are returned, increasing data transfer.
- **Calling `getFirestore()` on every operation** — Initialize once and reuse the instance. Each call creates overhead.
- **Missing composite indexes** — Compound queries fail at runtime if the required composite index doesn't exist. Check error messages for the auto-generated index creation link.
- **Deploying without testing security rules** — Use the emulator to test rules before deploying. Use `firebase emulators:exec "npm test"` in CI.
- **Using `enableIndexedDbPersistence`** — Deprecated. Use `initializeFirestore` with `persistentLocalCache` instead.

**Gotchas & Edge Cases:**

- **Firestore queries are "all or nothing" with security rules** — If a query could potentially return documents the user isn't allowed to read, the entire query fails (not just the unauthorized documents).
- **Firestore limits** — 1 MB max document size, 20,000 fields per document, 500 writes per batch, 1 write per second per document sustained.
- **Security rules propagation delay** — Rule updates take up to 1 minute to affect new queries, and up to 10 minutes for active listeners.
- **`serverTimestamp()` returns `null` in `onSnapshot` pending writes** — Until the server confirms the write, the timestamp field is `null` locally. Handle this with `{ serverTimestamps: 'estimate' }` in snapshot options.
- **Firebase Hosting has a 60-second timeout** — Even if your Cloud Function has a longer timeout, requests through Hosting rewrites timeout at 60 seconds.
- **`onAuthStateChanged` fires on page load** — It fires with `null` initially, then with the user if a session exists. Always handle the initial `null` state.
- **Firestore `in` queries are limited to 30 values** — `where("field", "in", array)` supports a maximum of 30 elements in the array (increased from 10 in recent versions).
- **Cloud Functions cold starts** — First invocation after idle has additional latency. Use `onInit()` for lazy initialization and keep dependencies minimal.
- **Admin SDK `initializeApp()` should be called once** — Multiple calls throw an error unless you provide a unique app name. Guard with a try-catch or check `getApps().length`.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use the modular Firebase SDK imports (`firebase/app`, `firebase/firestore`, `firebase/auth`) — NEVER use the deprecated `firebase/compat` namespace API)**

**(You MUST write Firestore security rules for EVERY collection — a collection without rules is wide open in production)**

**(You MUST NEVER expose Firebase Admin SDK credentials or service account keys in client-side code)**

**(You MUST use Cloud Functions v2 API (`firebase-functions/v2/https`, `firebase-functions/v2/firestore`) — NOT the deprecated v1 API)**

**(You MUST handle all Firestore operations with error checking — never assume reads/writes succeed)**

**Failure to follow these rules will create security vulnerabilities, bloated bundles, deprecated code paths, and silent runtime failures.**

</critical_reminders>
