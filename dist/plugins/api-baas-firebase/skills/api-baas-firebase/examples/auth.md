# Firebase -- Authentication Examples

> Email/password auth, OAuth providers, auth state management, and token handling. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for quick lookups.

**Related examples:**

- [core.md](core.md) -- Firebase project setup, emulator suite
- [firestore.md](firestore.md) -- Firestore CRUD, queries, real-time listeners
- [functions.md](functions.md) -- Cloud Functions v2, Admin SDK
- [storage.md](storage.md) -- File upload, download, delete
- [security-rules.md](security-rules.md) -- Firestore and Storage security rules

---

## Email/Password Auth

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

// Listen to auth state -- register early in app lifecycle
function subscribeToAuthState(
  callback: (user: User | null) => void,
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}
```

---

## OAuth (Social Login)

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

// Sign in with GitHub (redirect -- better for mobile)
async function signInWithGithub(): Promise<void> {
  await signInWithRedirect(auth, githubProvider);
}
```

---

## Get Current User Token (for API calls)

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

**Key patterns:** Modular imports for each auth function, typed `User` return values, `Unsubscribe` for cleanup, separate providers as constants, token retrieval with force refresh for API calls

---

## Auth Service with User Profile Sync

A complete auth service that manages sign-up with Firestore profile creation, OAuth with profile sync, and auth state observation.

```typescript
// services/auth-service.ts
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

// --- Constants ---

const USERS_COLLECTION = "users";

// --- Auth State Observer ---

export function subscribeToAuthState(
  callback: (user: User | null) => void,
): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

// --- Sign Up with Profile Creation ---

const googleProvider = new GoogleAuthProvider();

export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );

  // Create user profile document in Firestore
  await setDoc(doc(db, USERS_COLLECTION, credential.user.uid), {
    email,
    displayName,
    createdAt: serverTimestamp(),
  });

  return credential.user;
}

// --- OAuth with Profile Sync ---

export async function signInWithGoogle(): Promise<User> {
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
    { merge: true },
  );

  return result.user;
}

// --- Sign In / Sign Out ---

export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}
```

**Key patterns:** Framework-agnostic auth service (wire into your framework's state/context layer), `subscribeToAuthState` returns `Unsubscribe` for cleanup, profile creation on sign-up with `serverTimestamp()`, `merge: true` for OAuth profile updates (don't overwrite existing data), typed `User` return values

---

_For core concepts, see [SKILL.md](../SKILL.md). For quick reference tables, see [reference.md](../reference.md)._
