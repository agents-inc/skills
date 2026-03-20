# Firebase -- Cloud Storage Examples

> File upload with progress tracking, download URLs, deletion, client-side validation, and App Check. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for quick lookups.

**Related examples:**

- [core.md](core.md) -- Firebase project setup, emulator suite
- [firestore.md](firestore.md) -- Firestore CRUD, queries, real-time listeners
- [auth.md](auth.md) -- Authentication flows
- [functions.md](functions.md) -- Cloud Functions v2, Admin SDK
- [security-rules.md](security-rules.md) -- Firestore and Storage security rules

---

## Storage Upload with Progress and Validation

Complete file upload flow with client-side validation, progress tracking, and typed results.

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

## Simple Upload (without progress)

For cases where progress tracking is not needed.

```typescript
import {
  ref,
  uploadBytes,
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

// Delete a file
async function deleteAvatar(userId: string): Promise<void> {
  const storageRef = ref(storage, `${AVATARS_PATH}/${userId}/avatar.png`);
  await deleteObject(storageRef);
}
```

**Key patterns:** `uploadBytes` for simple non-resumable uploads, `getDownloadURL` for publicly accessible URLs, named constants for paths and limits

---

## App Check Setup

Protect your backend resources from abuse by verifying requests come from your app.

```typescript
// lib/firebase.ts -- add App Check initialization
import { initializeApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";

const app = initializeApp(firebaseConfig);

// Enable App Check with reCAPTCHA Enterprise
const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY!;

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
