# SQLite + PowerSync - Attachment Handling

> Offline-capable file upload/download with AttachmentQueue. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

**Related:** [core.md](core.md) for schema and database setup, [sync.md](sync.md) for backend connector.

**Prerequisites:** `@powersync/react-native` v1.30.0+, a remote storage provider (e.g., Supabase Storage, S3).

---

## Pattern 11: Schema with AttachmentTable

Add `AttachmentTable` to your schema alongside tables that reference attachments.

```typescript
import {
  column,
  Schema,
  Table,
  AttachmentTable,
} from "@powersync/react-native";

const users = new Table({
  name: column.text,
  photo_id: column.text, // References an attachment ID
});

const messages = new Table({
  content: column.text,
  sender_id: column.text,
  attachment_id: column.text, // References an attachment ID
  created_at: column.text,
});

export const AppSchema = new Schema({
  users,
  messages,
  attachments: new AttachmentTable(), // Built-in table for attachment metadata
});
```

**Why good:** `AttachmentTable` provides columns for `id`, `filename`, `media_type`, `state`, `timestamp`, `size`. Your data tables reference attachments by ID.

---

## Pattern 12: AttachmentQueue Setup

The `AttachmentQueue` manages the full lifecycle: save locally, queue upload, sync state, download on other devices, retry on failure.

```typescript
import { AttachmentQueue } from "@powersync/react-native";
import type {
  LocalStorageAdapter,
  RemoteStorageAdapter,
} from "@powersync/react-native";
import { powersync } from "./database";

const SYNC_INTERVAL_MS = 30_000; // Retry failed uploads/downloads every 30s
const ARCHIVED_CACHE_LIMIT = 100; // Max orphaned attachments to keep

// Local storage adapter -- platform-specific file persistence
const localStorage: LocalStorageAdapter = createLocalStorageAdapter();

// Remote storage adapter -- your cloud storage provider
const remoteStorage: RemoteStorageAdapter = {
  uploadFile: async (filename: string, localUri: string): Promise<void> => {
    // Upload file to your cloud storage (e.g., Supabase Storage, S3)
    const fileData = await readFile(localUri);
    await uploadToCloud(filename, fileData);
  },

  downloadFile: async (filename: string): Promise<ArrayBuffer> => {
    // Download from cloud storage
    return await downloadFromCloud(filename);
  },

  deleteFile: async (filename: string): Promise<void> => {
    await deleteFromCloud(filename);
  },
};

export const attachmentQueue = new AttachmentQueue({
  db: powersync,
  localStorage,
  remoteStorage,
  syncIntervalMs: SYNC_INTERVAL_MS,
  archivedCacheLimit: ARCHIVED_CACHE_LIMIT,
  downloadAttachments: true, // Automatically download synced attachments
  watchAttachments: (onUpdate) => {
    // Watch your data model for attachment references
    // This tells the queue which attachments to track
    powersync.watch(
      `SELECT photo_id as id FROM users WHERE photo_id IS NOT NULL
       UNION
       SELECT attachment_id as id FROM messages WHERE attachment_id IS NOT NULL`,
      [],
      {
        onResult: (result) =>
          onUpdate(result.rows?._array?.map((r) => r.id) ?? []),
      },
    );
  },
});

// Initialize in app bootstrap (after powersync.init())
await attachmentQueue.init();
```

**Why good:** Queue handles retries automatically, `watchAttachments` detects new/removed references, unreferenced attachments are auto-archived

---

## Pattern 13: Uploading an Attachment

```typescript
import { attachmentQueue } from "./attachment-queue";

async function uploadUserPhoto(
  userId: string,
  photoData: ArrayBuffer,
): Promise<string> {
  // saveFile creates the attachment record and queues upload
  const attachment = await attachmentQueue.saveFile({
    data: photoData,
    fileExtension: "jpg",
    mediaType: "image/jpeg",
    // updateHook runs in the same transaction -- ensures consistency
    updateHook: async (tx, attachment) => {
      await tx.execute("UPDATE users SET photo_id = ? WHERE id = ?", [
        attachment.id,
        userId,
      ]);
    },
  });

  return attachment.id;
}
```

**Why good:** `updateHook` executes in the same SQLite transaction as the attachment record creation -- the data reference and metadata are always consistent

---

## Pattern 14: Deleting an Attachment

```typescript
async function removeUserPhoto(userId: string, photoId: string): Promise<void> {
  await attachmentQueue.deleteFile({
    id: photoId,
    updateHook: async (tx) => {
      await tx.execute("UPDATE users SET photo_id = NULL WHERE id = ?", [
        userId,
      ]);
    },
  });
}

// Alternative: simply remove the reference -- queue auto-archives unreferenced attachments
async function removePhotoReference(userId: string): Promise<void> {
  await powersync.execute("UPDATE users SET photo_id = NULL WHERE id = ?", [
    userId,
  ]);
  // The queue's watchAttachments will detect the orphaned attachment and archive it
}
```

---

## Pattern 15: Attachment States

| State             | Meaning                                             |
| ----------------- | --------------------------------------------------- |
| `QUEUED_UPLOAD`   | File saved locally, waiting to be uploaded          |
| `QUEUED_DOWNLOAD` | Synced from another device, waiting to download     |
| `SYNCED`          | Exists both locally and in cloud storage            |
| `QUEUED_DELETE`   | Marked for removal from local and cloud             |
| `ARCHIVED`        | No longer referenced by data, candidate for cleanup |

**Lifecycle:**

```
New file:     Save -> QUEUED_UPLOAD -> (upload) -> SYNCED
From server:  Sync -> QUEUED_DOWNLOAD -> (download) -> SYNCED
Remove ref:   SYNCED -> ARCHIVED -> (cache eviction) -> deleted
Delete:       SYNCED -> QUEUED_DELETE -> (delete remote) -> removed
```

---

## Pattern 16: Displaying Attachments

```tsx
import { useQuery } from "@powersync/react";
import { Image, View } from "react-native";

function UserAvatar({ userId }: { userId: string }) {
  const { data } = useQuery(
    `SELECT a.local_uri, a.state
     FROM users u
     JOIN attachments a ON u.photo_id = a.id
     WHERE u.id = ?`,
    [userId],
  );

  const attachment = data?.[0];

  if (!attachment?.local_uri) {
    return <PlaceholderAvatar />;
  }

  return (
    <View>
      <Image source={{ uri: attachment.local_uri }} />
      {attachment.state !== "SYNCED" && <UploadingIndicator />}
    </View>
  );
}

export { UserAvatar };
```

**Why good:** `local_uri` provides the on-device file path, `state` lets you show upload/download progress indicators, JOIN query is reactive via `useQuery`
