# Firebase Examples

> Practical examples for Firestore CRUD, authentication flows, Cloud Functions v2, and Storage. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for quick lookups.

---

## Example 1: Complete Firestore CRUD Service

A full-featured service for managing posts with typed documents, error handling, and pagination.

```typescript
// services/post-service.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

// --- Types ---

export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  published: boolean;
  tags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type PostCreate = Omit<Post, "id" | "createdAt" | "updatedAt">;
export type PostUpdate = Partial<Omit<Post, "id" | "createdAt" | "updatedAt">>;

export interface PaginatedResult<T> {
  items: T[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

// --- Constants ---

const POSTS_COLLECTION = "posts";
const DEFAULT_PAGE_SIZE = 20;

// --- Helpers ---

function mapDoc(doc: DocumentSnapshot): Post {
  if (!doc.exists()) {
    throw new Error(`Document not found: ${doc.id}`);
  }
  return { id: doc.id, ...doc.data() } as Post;
}

function mapDocs(docs: QueryDocumentSnapshot[]): Post[] {
  return docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Post);
}

// --- CRUD Operations ---

export async function getPost(postId: string): Promise<Post> {
  const docRef = doc(db, POSTS_COLLECTION, postId);
  const snapshot = await getDoc(docRef);
  return mapDoc(snapshot);
}

export async function createPost(data: PostCreate): Promise<string> {
  const docRef = doc(collection(db, POSTS_COLLECTION));
  await setDoc(docRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updatePost(
  postId: string,
  data: PostUpdate,
): Promise<void> {
  const docRef = doc(db, POSTS_COLLECTION, postId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePost(postId: string): Promise<void> {
  const docRef = doc(db, POSTS_COLLECTION, postId);
  await deleteDoc(docRef);
}

// --- Queries ---

export async function getPublishedPosts(
  pageSize: number = DEFAULT_PAGE_SIZE,
  lastDoc?: QueryDocumentSnapshot,
): Promise<PaginatedResult<Post>> {
  const postsRef = collection(db, POSTS_COLLECTION);
  const constraints = [
    where("published", "==", true),
    orderBy("createdAt", "desc"),
    limit(pageSize + 1), // Fetch one extra to check if there's more
  ];

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(postsRef, ...constraints);
  const snapshot = await getDocs(q);

  const hasMore = snapshot.docs.length > pageSize;
  const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

  return {
    items: mapDocs(docs),
    lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
    hasMore,
  };
}

export async function getPostsByAuthor(authorId: string): Promise<Post[]> {
  const postsRef = collection(db, POSTS_COLLECTION);
  const q = query(
    postsRef,
    where("authorId", "==", authorId),
    orderBy("createdAt", "desc"),
  );
  const snapshot = await getDocs(q);
  return mapDocs(snapshot.docs);
}

export async function getPostsByTag(tag: string): Promise<Post[]> {
  const postsRef = collection(db, POSTS_COLLECTION);
  const q = query(
    postsRef,
    where("tags", "array-contains", tag),
    orderBy("createdAt", "desc"),
    limit(DEFAULT_PAGE_SIZE),
  );
  const snapshot = await getDocs(q);
  return mapDocs(snapshot.docs);
}
```

**Key patterns:** Typed document interfaces with `Omit<>` for create/update variants, `serverTimestamp()` for consistent timestamps, cursor-based pagination with `startAfter()`, "fetch N+1" pattern to detect `hasMore`, helper functions for doc mapping

---

## Example 2: Real-Time Chat with Firestore Listeners

A complete chat implementation using `onSnapshot` for real-time updates.

```typescript
// services/chat-service.ts
import {
  collection,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
  type Timestamp,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";

// --- Types ---

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  roomId: string;
  createdAt: Timestamp;
}

export interface ChatRoom {
  id: string;
  name: string;
  memberIds: string[];
  lastMessage?: string;
  lastMessageAt?: Timestamp;
}

// --- Constants ---

const ROOMS_COLLECTION = "rooms";
const MESSAGES_SUBCOLLECTION = "messages";
const RECENT_MESSAGES_LIMIT = 50;

// --- Real-Time Listeners ---

export function subscribeToMessages(
  roomId: string,
  onUpdate: (messages: Message[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const messagesRef = collection(
    db,
    ROOMS_COLLECTION,
    roomId,
    MESSAGES_SUBCOLLECTION,
  );
  const q = query(
    messagesRef,
    orderBy("createdAt", "asc"),
    limit(RECENT_MESSAGES_LIMIT),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Message,
      );
      onUpdate(messages);
    },
    (error) => {
      if (onError) {
        onError(new Error(`Chat listener failed: ${error.message}`));
      }
    },
  );
}

export function subscribeToUserRooms(
  userId: string,
  onUpdate: (rooms: ChatRoom[]) => void,
): Unsubscribe {
  const roomsRef = collection(db, ROOMS_COLLECTION);
  const q = query(
    roomsRef,
    where("memberIds", "array-contains", userId),
    orderBy("lastMessageAt", "desc"),
  );

  return onSnapshot(q, (snapshot) => {
    const rooms = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as ChatRoom,
    );
    onUpdate(rooms);
  });
}

// --- Send Message ---

export async function sendMessage(roomId: string, text: string): Promise<void> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Must be signed in to send messages");
  }

  const messagesRef = collection(
    db,
    ROOMS_COLLECTION,
    roomId,
    MESSAGES_SUBCOLLECTION,
  );
  const messageRef = doc(messagesRef);

  // Write message and update room's last message in parallel
  const roomRef = doc(db, ROOMS_COLLECTION, roomId);

  await Promise.all([
    setDoc(messageRef, {
      text,
      senderId: user.uid,
      senderName: user.displayName ?? "Anonymous",
      roomId,
      createdAt: serverTimestamp(),
    }),
    setDoc(
      roomRef,
      {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
      },
      { merge: true },
    ),
  ]);
}
```

**Key patterns:** Subcollection pattern for messages within rooms, `array-contains` for membership queries, `onSnapshot` with error callback, `Unsubscribe` return type, `merge: true` for partial document updates, auth check before writes

---

## Example 3: Authentication with React Context

A complete auth context pattern using Firebase Authentication with React.

```typescript
// contexts/auth-context.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type User,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

// --- Types ---

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
}

// --- Constants ---

const USERS_COLLECTION = "users";

// --- Context ---

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

// --- Provider ---

const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function signIn(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signUp(
    email: string,
    password: string,
    displayName: string
  ): Promise<void> {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Create user profile document in Firestore
    await setDoc(doc(db, USERS_COLLECTION, credential.user.uid), {
      email,
      displayName,
      createdAt: serverTimestamp(),
    });
  }

  async function signInWithGoogle(): Promise<void> {
    const result = await signInWithPopup(auth, googleProvider);

    // Create/update user profile on first OAuth sign-in
    await setDoc(
      doc(db, USERS_COLLECTION, result.user.uid),
      {
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        lastLoginAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  async function logOut(): Promise<void> {
    await signOut(auth);
  }

  const value: AuthContextValue = {
    user,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    logOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// --- Usage ---
// function ProtectedPage() {
//   const { user, loading, logOut } = useAuth();
//
//   if (loading) return <div>Loading...</div>;
//   if (!user) return <Navigate to="/login" />;
//
//   return (
//     <div>
//       <p>Welcome, {user.displayName}</p>
//       <button onClick={logOut}>Sign Out</button>
//     </div>
//   );
// }
```

**Key patterns:** Auth state in React context, `loading` state for initial auth check, `onAuthStateChanged` cleanup in `useEffect`, user profile creation on sign-up, `merge: true` for OAuth profile updates (don't overwrite existing data), typed context value

---

## Example 4: Cloud Functions v2 — Complete API

A full API example with HTTP endpoints, callable functions, and Firestore triggers.

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

## Example 5: Storage Upload with Progress and Validation

Complete file upload flow with client-side validation, progress tracking, and security rules.

```typescript
// services/storage-service.ts
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
  type UploadTaskSnapshot,
} from "firebase/storage";
import { storage, auth } from "../lib/firebase";

// --- Constants ---

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// --- Types ---

export interface UploadResult {
  url: string;
  path: string;
}

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percent: number;
}

// --- Validation ---

function validateImageFile(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(
      `Invalid image type: ${file.type}. Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
    );
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Image exceeds 5MB size limit");
  }
}

function validateDocumentFile(file: File): void {
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    throw new Error(`Invalid document type: ${file.type}`);
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error("Document exceeds 20MB size limit");
  }
}

// --- Upload Functions ---

export function uploadImage(
  file: File,
  path: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadResult> {
  validateImageFile(file);
  return uploadFile(file, path, onProgress);
}

export function uploadDocument(
  file: File,
  path: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadResult> {
  validateDocumentFile(file);
  return uploadFile(file, path, onProgress);
}

function uploadFile(
  file: File,
  path: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadResult> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Must be authenticated to upload files");
  }

  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: { uploadedBy: user.uid },
  });

  return new Promise((resolve, reject) => {
    const PERCENT_MULTIPLIER = 100;

    uploadTask.on(
      "state_changed",
      (snapshot: UploadTaskSnapshot) => {
        if (onProgress) {
          onProgress({
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            percent:
              (snapshot.bytesTransferred / snapshot.totalBytes) *
              PERCENT_MULTIPLIER,
          });
        }
      },
      (error) => reject(new Error(`Upload failed: ${error.message}`)),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ url, path });
      },
    );
  });
}

// --- Delete ---

export async function deleteFile(path: string): Promise<void> {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}

// --- List Files ---

export async function listUserFiles(userId: string): Promise<string[]> {
  const listRef = ref(storage, `documents/${userId}`);
  const result = await listAll(listRef);
  return result.items.map((item) => item.fullPath);
}
```

**Key patterns:** Client-side validation before upload (type and size), resumable upload with progress callback, auth check before upload, `customMetadata` for audit trail, typed upload result with URL and path, separate validation functions per file category

---

## Example 6: Calling Cloud Functions from Client

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

## Example 7: App Check Setup

Protect your backend resources from abuse by verifying requests come from your app.

```typescript
// lib/firebase.ts — add App Check initialization
import { initializeApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";

const app = initializeApp(firebaseConfig);

// Enable App Check with reCAPTCHA Enterprise
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY!;

// Enable debug token in development
if (process.env.NODE_ENV === "development") {
  // @ts-expect-error -- Firebase debug token global
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
  isTokenAutoRefreshEnabled: true,
});
```

**Key patterns:** reCAPTCHA Enterprise is the recommended provider (reCAPTCHA v3 is being phased out), debug token in development for emulator support, `isTokenAutoRefreshEnabled` keeps the token fresh, `@ts-expect-error` for the global debug token

---

_For core concepts, see [SKILL.md](../SKILL.md). For quick reference tables, see [reference.md](../reference.md)._
