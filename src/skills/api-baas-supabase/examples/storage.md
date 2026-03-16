# Supabase Storage Examples

> File upload, signed URLs, bucket policies, and image transforms. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: File Upload

### Good Example — Upload with Error Handling

```typescript
const BUCKET_NAME = "documents";
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

async function uploadFile(
  userId: string,
  file: File,
  folder = "uploads",
): Promise<string> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds ${MAX_FILE_SIZE_MB}MB limit`);
  }

  const fileExtension = file.name.split(".").pop();
  const filePath = `${userId}/${folder}/${crypto.randomUUID()}.${fileExtension}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return data.path;
}
```

**Why good:** Named constants for bucket and size limits, unique filename prevents collisions, user-scoped path, file size validation before upload, `upsert: false` prevents accidental overwrites

### Good Example — Upload with Upsert (Avatar)

```typescript
const AVATAR_BUCKET = "avatars";

async function uploadAvatar(userId: string, file: File): Promise<string> {
  const filePath = `${userId}/avatar.png`;

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: true, // Replace existing avatar
    });

  if (error) {
    throw new Error(`Avatar upload failed: ${error.message}`);
  }

  // Return public URL for display
  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);

  return publicUrl;
}
```

**Why good:** `upsert: true` replaces existing avatar (one avatar per user), explicit `contentType`, returns public URL for immediate display, deterministic path (`userId/avatar.png`)

---

## Pattern 2: Signed URLs (Private Files)

### Good Example — Time-Limited Access

```typescript
const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

async function getPrivateFileUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("private-documents")
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY_SECONDS);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

// Batch signed URLs for multiple files
async function getMultipleSignedUrls(filePaths: string[]): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from("private-documents")
    .createSignedUrls(filePaths, SIGNED_URL_EXPIRY_SECONDS);

  if (error) {
    throw new Error(`Failed to create signed URLs: ${error.message}`);
  }

  return data.map((item) => item.signedUrl);
}
```

**Why good:** Named constant for expiry duration, batch method for multiple files (single API call), error handling

**When to use:** Private files that need temporary access (document downloads, invoice PDFs, private images). Signed URLs expire — do not cache them longer than their expiry.

---

## Pattern 3: Public URLs (Public Buckets)

### Good Example — Public File Access

```typescript
const PUBLIC_BUCKET = "public-assets";

function getPublicFileUrl(filePath: string): string {
  const {
    data: { publicUrl },
  } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(filePath);

  return publicUrl;
}

// With image transforms (for image files in public buckets)
function getResizedImageUrl(
  filePath: string,
  width: number,
  height: number,
): string {
  const {
    data: { publicUrl },
  } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(filePath, {
    transform: {
      width,
      height,
      resize: "contain",
    },
  });

  return publicUrl;
}
```

**Why good:** `getPublicUrl` is synchronous (no `await`), image transforms resize server-side (saves bandwidth), `resize: "contain"` preserves aspect ratio

**When to use:** Public assets (avatars, product images, logos). Public bucket URLs are permanent and bypass all access policies.

---

## Pattern 4: File Management

### Good Example — List, Move, Delete

```typescript
const BUCKET_NAME = "documents";

// List files in a folder
async function listUserFiles(userId: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(`${userId}/uploads`, {
      limit: 100,
      offset: 0,
      sortBy: { column: "created_at", order: "desc" },
    });

  if (error) {
    throw new Error(`Failed to list files: ${error.message}`);
  }

  return data;
}

// Delete files
async function deleteFiles(filePaths: string[]) {
  const { error } = await supabase.storage.from(BUCKET_NAME).remove(filePaths);

  if (error) {
    throw new Error(`Failed to delete files: ${error.message}`);
  }
}

// Move/rename a file
async function moveFile(fromPath: string, toPath: string) {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .move(fromPath, toPath);

  if (error) {
    throw new Error(`Failed to move file: ${error.message}`);
  }
}
```

**Why good:** Pagination with limit/offset, sorting by creation date, batch delete with array of paths, move for rename operations

---

## Pattern 5: Storage Bucket Policies (RLS)

### Good Example — User-Scoped Bucket Access

```sql
-- Storage uses RLS on the storage.objects table
-- Users can upload to their own folder
create policy "Users can upload to own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'documents'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

-- Users can read their own files
create policy "Users can read own files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'documents'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

-- Users can update (overwrite) their own files
create policy "Users can update own files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'documents'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

-- Users can delete their own files
create policy "Users can delete own files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'documents'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);
```

**Why good:** Policies on `storage.objects` table, `storage.foldername(name)` extracts folder from path, first folder is user ID, separate policies per operation, bucket_id check restricts to specific bucket

### Good Example — Public Avatars Bucket

```sql
-- Anyone can view avatars
create policy "Public avatar access"
on storage.objects for select
to anon, authenticated
using ( bucket_id = 'avatars' );

-- Only authenticated users can upload their own avatar
create policy "Users upload own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);
```

**Why good:** Public read access for avatars, write restricted to own folder, combines public and authenticated roles appropriately

---

## Pattern 6: Signed Upload URLs (Client-Side Upload)

### Good Example — Server Creates URL, Client Uploads

```typescript
// Server-side: Create a signed upload URL
async function createUploadUrl(filePath: string) {
  const { data, error } = await supabaseAdmin.storage
    .from("documents")
    .createSignedUploadUrl(filePath);

  if (error) {
    throw new Error(`Failed to create upload URL: ${error.message}`);
  }

  return data;
}

// Client-side: Upload directly to the signed URL
async function uploadToSignedUrl(signedUrl: string, token: string, file: File) {
  const { data, error } = await supabase.storage
    .from("documents")
    .uploadToSignedUrl(signedUrl, token, file);

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return data;
}
```

**Why good:** Server controls where files can be uploaded (security), client uploads directly to storage (no server proxy needed), signed upload URLs expire after 2 hours

**When to use:** Large file uploads where you want the client to upload directly to storage without proxying through your server. The server creates the signed URL (controlling path and permissions), and the client uploads directly.

---

_For auth patterns, see [auth.md](auth.md). For database queries, see [database.md](database.md). For edge functions, see [edge-functions.md](edge-functions.md)._
