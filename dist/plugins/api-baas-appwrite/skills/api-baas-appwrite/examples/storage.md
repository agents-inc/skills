# Appwrite Storage Examples

> File upload, download, preview with image transforms, and bucket permissions. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: File Upload

### Good Example — Upload with Permissions and Validation

```typescript
import { ID, Permission, Role, AppwriteException } from "appwrite";

const BUCKET_ID = "user-uploads";
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

async function uploadFile(file: File, userId: string) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds ${MAX_FILE_SIZE_MB}MB limit`);
  }

  try {
    return await storage.createFile({
      bucketId: BUCKET_ID,
      fileId: ID.unique(),
      file,
      permissions: [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ],
    });
  } catch (error) {
    if (error instanceof AppwriteException) {
      throw new Error(`Upload failed: ${error.message}`);
    }
    throw error;
  }
}
```

**Why good:** Client-side size validation before upload, `ID.unique()` for auto-generated file ID, explicit permissions (without them the file is inaccessible), named constants for bucket and limits

### Good Example — Avatar Upload (Upsert Pattern)

```typescript
const AVATAR_BUCKET = "avatars";

async function uploadAvatar(userId: string, file: File) {
  // Use a deterministic file ID so the same user always overwrites their avatar
  const fileId = `avatar-${userId}`;

  try {
    // Try to delete existing avatar first
    await storage.deleteFile({ bucketId: AVATAR_BUCKET, fileId });
  } catch {
    // File doesn't exist yet — that's fine
  }

  return await storage.createFile({
    bucketId: AVATAR_BUCKET,
    fileId,
    file,
    permissions: [Permission.read(Role.any())], // Public avatar
  });
}
```

**Why good:** Deterministic file ID ensures one avatar per user, delete-then-create pattern for upsert (Appwrite `createFile` does not have an upsert option), public read permission for avatars

### Bad Example — No Permissions on Upload

```typescript
// BAD: File uploaded but inaccessible
await storage.createFile({ bucketId: BUCKET_ID, fileId: ID.unique(), file });
// No permissions — nobody can download this file!
```

**Why bad:** Without permissions, the file exists in the bucket but is invisible and inaccessible to all users

---

## Pattern 2: File Preview (Images)

### Good Example — Image Transforms

```typescript
const IMAGES_BUCKET = "product-images";
const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_HEIGHT = 200;
const FULL_WIDTH = 1200;
const OPTIMIZED_WIDTH = 800;
const OPTIMIZED_HEIGHT = 600;
const OPTIMIZED_QUALITY = 80;

// Thumbnail URL
function getThumbnailUrl(fileId: string) {
  return storage.getFilePreview({
    bucketId: IMAGES_BUCKET,
    fileId,
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
  });
}

// Full-size URL
function getFullImageUrl(fileId: string) {
  return storage.getFilePreview({
    bucketId: IMAGES_BUCKET,
    fileId,
    width: FULL_WIDTH,
  });
}

// Preview with quality control
function getOptimizedPreview(fileId: string) {
  return storage.getFilePreview({
    bucketId: IMAGES_BUCKET,
    fileId,
    width: OPTIMIZED_WIDTH,
    height: OPTIMIZED_HEIGHT,
    quality: OPTIMIZED_QUALITY,
  });
}
```

**Why good:** Named constants for dimensions, `getFilePreview` handles server-side resizing (saves bandwidth), quality parameter for compression control

**When to use:** `getFilePreview()` only works on image files (JPEG, PNG, GIF, WebP). For non-image files, use `getFileDownload()` or `getFileView()`.

---

## Pattern 3: File Download and View

### Good Example — Download vs View

```typescript
const DOCUMENTS_BUCKET = "documents";

// Download — returns URL with Content-Disposition: attachment header
// Browser will prompt a file save dialog
function getDownloadUrl(fileId: string) {
  return storage.getFileDownload({ bucketId: DOCUMENTS_BUCKET, fileId });
}

// View — returns URL without attachment header
// Browser will display the file inline (e.g., PDF in browser)
function getViewUrl(fileId: string) {
  return storage.getFileView({ bucketId: DOCUMENTS_BUCKET, fileId });
}
```

**Why good:** `getFileDownload` forces a download dialog, `getFileView` displays inline — choose based on UX intent

---

## Pattern 4: File Management

### Good Example — List, Delete, Update

```typescript
import { Query } from "appwrite";

const BUCKET_ID = "user-uploads";
const FILES_PER_PAGE = 25;

// List files with pagination
async function listUserFiles(page: number) {
  return await storage.listFiles({
    bucketId: BUCKET_ID,
    queries: [
      Query.limit(FILES_PER_PAGE),
      Query.offset(page * FILES_PER_PAGE),
      Query.orderDesc("$createdAt"),
    ],
  });
}

// Delete a file
async function deleteFile(fileId: string) {
  try {
    await storage.deleteFile({ bucketId: BUCKET_ID, fileId });
  } catch (error) {
    if (error instanceof AppwriteException) {
      throw new Error(`Delete failed: ${error.message}`);
    }
    throw error;
  }
}

// Update file permissions (e.g., share with another user)
async function shareFile(fileId: string, targetUserId: string) {
  const file = await storage.getFile({ bucketId: BUCKET_ID, fileId });
  const currentPermissions = file.$permissions;

  await storage.updateFile({
    bucketId: BUCKET_ID,
    fileId,
    permissions: [
      ...currentPermissions,
      Permission.read(Role.user(targetUserId)),
    ],
  });
}
```

**Why good:** Query-based file listing with pagination, preserves existing permissions when sharing, `getFile` to read current permissions before updating

---

_For auth patterns, see [auth.md](auth.md). For database patterns, see [core.md](core.md). For functions, see [functions.md](functions.md)._
