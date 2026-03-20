# Firebase -- Cloud Functions v2 & Admin SDK Examples

> HTTP endpoints, callable functions, Firestore triggers, scheduled functions, and Admin SDK patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for quick lookups.

**Related examples:**

- [core.md](core.md) -- Firebase project setup, emulator suite
- [firestore.md](firestore.md) -- Firestore CRUD, queries, real-time listeners
- [auth.md](auth.md) -- Authentication flows
- [storage.md](storage.md) -- File upload, download, delete
- [security-rules.md](security-rules.md) -- Firestore and Storage security rules

---

## Complete Cloud Functions v2 API

A full API example with HTTP endpoints, callable functions, Firestore triggers, and scheduled tasks.

### Entry Point

```typescript
// functions/src/index.ts
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Initialize Admin SDK (call once, before any function definitions)
initializeApp();

const db = getFirestore();
const adminAuth = getAuth();

// Re-export functions from separate modules
export { getPosts, getPostById } from "./api/posts";
export { createPost, updatePost } from "./api/post-mutations";
export { onPostCreated, onPostDeleted } from "./triggers/post-triggers";
export { cleanupExpiredSessions } from "./scheduled/cleanup";
```

### HTTP Function (onRequest)

```typescript
// functions/src/api/posts.ts
import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();
const POSTS_COLLECTION = "posts";
const DEFAULT_LIMIT = 20;

export const getPosts = onRequest(
  { cors: true, region: "us-central1", memory: "256MiB" },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const pageSize = Math.min(
        Number(req.query.limit) || DEFAULT_LIMIT,
        DEFAULT_LIMIT,
      );

      const snapshot = await db
        .collection(POSTS_COLLECTION)
        .where("published", "==", true)
        .orderBy("createdAt", "desc")
        .limit(pageSize)
        .get();

      const posts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json({ posts, count: posts.length });
    } catch (error) {
      console.error("Failed to fetch posts:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export const getPostById = onRequest(
  { cors: true, region: "us-central1" },
  async (req, res) => {
    const postId = req.path.split("/").pop();

    if (!postId) {
      res.status(400).json({ error: "Post ID required" });
      return;
    }

    try {
      const doc = await db.collection(POSTS_COLLECTION).doc(postId).get();

      if (!doc.exists) {
        res.status(404).json({ error: "Post not found" });
        return;
      }

      res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
      console.error("Failed to fetch post:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);
```

### Callable Function (onCall)

```typescript
// functions/src/api/post-mutations.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const db = getFirestore();
const POSTS_COLLECTION = "posts";
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 50000;

export const createPost = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in");
  }

  const { title, content, tags } = request.data;

  // Input validation
  if (!title || typeof title !== "string" || title.length > MAX_TITLE_LENGTH) {
    throw new HttpsError(
      "invalid-argument",
      `Title is required and must be under ${MAX_TITLE_LENGTH} characters`,
    );
  }

  if (
    !content ||
    typeof content !== "string" ||
    content.length > MAX_CONTENT_LENGTH
  ) {
    throw new HttpsError(
      "invalid-argument",
      `Content is required and must be under ${MAX_CONTENT_LENGTH} characters`,
    );
  }

  const docRef = await db.collection(POSTS_COLLECTION).add({
    title: title.trim(),
    content: content.trim(),
    tags: Array.isArray(tags) ? tags : [],
    authorId: request.auth.uid,
    published: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { id: docRef.id };
});

export const updatePost = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in");
  }

  const { postId, ...updates } = request.data;

  if (!postId) {
    throw new HttpsError("invalid-argument", "Post ID is required");
  }

  // Verify ownership
  const postSnap = await db.collection(POSTS_COLLECTION).doc(postId).get();

  if (!postSnap.exists) {
    throw new HttpsError("not-found", "Post not found");
  }

  if (postSnap.data()?.authorId !== request.auth.uid) {
    throw new HttpsError(
      "permission-denied",
      "You can only edit your own posts",
    );
  }

  await db
    .collection(POSTS_COLLECTION)
    .doc(postId)
    .update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });

  return { success: true };
});
```

### Firestore Trigger

```typescript
// functions/src/triggers/post-triggers.ts
import {
  onDocumentCreated,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const db = getFirestore();
const USERS_COLLECTION = "users";

export const onPostCreated = onDocumentCreated(
  { document: "posts/{postId}", region: "us-central1" },
  async (event) => {
    const data = event.data?.data();

    if (!data) {
      return;
    }

    // Increment the author's post count
    await db
      .collection(USERS_COLLECTION)
      .doc(data.authorId)
      .update({
        postCount: FieldValue.increment(1),
        lastPostAt: FieldValue.serverTimestamp(),
      });
  },
);

export const onPostDeleted = onDocumentDeleted(
  { document: "posts/{postId}", region: "us-central1" },
  async (event) => {
    const data = event.data?.data();

    if (!data) {
      return;
    }

    // Decrement the author's post count
    await db
      .collection(USERS_COLLECTION)
      .doc(data.authorId)
      .update({
        postCount: FieldValue.increment(-1),
      });
  },
);
```

### Scheduled Function

```typescript
// functions/src/scheduled/cleanup.ts
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();
const SESSIONS_COLLECTION = "sessions";
const SESSION_EXPIRY_DAYS = 30;
const MAX_BATCH_SIZE = 500;

export const cleanupExpiredSessions = onSchedule(
  {
    schedule: "every day 03:00",
    region: "us-central1",
    timeZone: "America/New_York",
  },
  async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - SESSION_EXPIRY_DAYS);

    const expired = await db
      .collection(SESSIONS_COLLECTION)
      .where("lastActive", "<", cutoff)
      .limit(MAX_BATCH_SIZE)
      .get();

    if (expired.empty) {
      console.log("No expired sessions to clean up");
      return;
    }

    const batch = db.batch();
    for (const doc of expired.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();

    console.log(`Deleted ${expired.docs.length} expired sessions`);
  },
);
```

**Key patterns:** Modular v2 imports from subpackages, `HttpsError` for typed error codes in callable functions, auth verification in callable functions, input validation with length limits, Firestore triggers for denormalized counter updates, scheduled functions with timezone, Admin SDK for server-side operations, `FieldValue.increment()` for atomic counters, named constants throughout

---

## Calling Cloud Functions from Client

Use `httpsCallable` to call `onCall` Cloud Functions from the client with automatic auth token handling.

```typescript
// services/api-service.ts
import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { functions } from "../lib/firebase";
import type { Post, PostCreate, PostUpdate } from "../types/post";

// --- Types ---

interface CreatePostResponse {
  id: string;
}

interface UpdatePostResponse {
  success: boolean;
}

// --- Callable Function Wrappers ---

const createPostFn = httpsCallable<PostCreate, CreatePostResponse>(
  functions,
  "createPost",
);

const updatePostFn = httpsCallable<
  PostUpdate & { postId: string },
  UpdatePostResponse
>(functions, "updatePost");

// --- Service Functions ---

export async function createPost(data: PostCreate): Promise<string> {
  const result: HttpsCallableResult<CreatePostResponse> =
    await createPostFn(data);
  return result.data.id;
}

export async function updatePost(
  postId: string,
  data: PostUpdate,
): Promise<void> {
  await updatePostFn({ postId, ...data });
}
```

**Key patterns:** `httpsCallable` generic types for request and response, named function variables, wrapped in service functions for abstraction, auth token automatically included by the client SDK

---

## Admin SDK (Server-Side)

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

**Key patterns:** Modular Admin SDK imports (`firebase-admin/app`, `firebase-admin/firestore`), default credentials in Cloud Functions, explicit `cert()` for standalone servers, custom tokens for third-party auth integration, custom claims for role-based access

---

_For core concepts, see [SKILL.md](../SKILL.md). For quick reference tables, see [reference.md](../reference.md)._
