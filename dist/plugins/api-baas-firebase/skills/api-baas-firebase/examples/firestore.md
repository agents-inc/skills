# Firebase -- Firestore Examples

> CRUD operations, queries, real-time listeners, batch writes, transactions, and pagination. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for quick lookups.

**Related examples:**

- [setup.md](setup.md) -- Firebase project setup, emulator suite
- [auth.md](auth.md) -- Authentication flows
- [functions.md](functions.md) -- Cloud Functions v2, Admin SDK
- [storage.md](storage.md) -- File upload, download, delete
- [security-rules.md](security-rules.md) -- Firestore and Storage security rules

---

## Complete Firestore CRUD Service

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

## Real-Time Chat with Firestore Listeners

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

## Transactions and Batched Writes

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

**Key patterns:** Transaction ensures atomic increment (no race conditions), `increment()` for safe counter updates, batch write for bulk operations, `MAX_BATCH_SIZE` constant documents the 500 limit

---

_For core concepts, see [SKILL.md](../SKILL.md). For quick reference tables, see [reference.md](../reference.md)._
