# S3 Upload Examples

> S3 presigned URLs, multipart uploads for large files. Reference from [SKILL.md](../SKILL.md).

---

## Pattern 1: Direct-to-S3 Upload (Client)

### Upload with Presigned URL

```typescript
// s3-upload.ts
interface S3UploadCredentials {
  url: string;
  fields: Record<string, string>;
}

interface S3UploadOptions {
  onProgress?: (progress: number) => void;
  abortSignal?: AbortSignal;
}

export async function uploadToS3(
  file: File,
  credentials: S3UploadCredentials,
  options: S3UploadOptions = {},
): Promise<string> {
  const { url, fields } = credentials;

  const formData = new FormData();

  // Add presigned fields first (order matters for S3)
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });

  // File must be last
  formData.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (options.abortSignal) {
      options.abortSignal.addEventListener("abort", () => xhr.abort());
    }

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Construct the final URL from the key
        const fileUrl = `${url}${fields.key}`;
        resolve(fileUrl);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () =>
      reject(new Error("Upload failed - network error")),
    );
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    xhr.open("POST", url);
    xhr.send(formData);
  });
}

// Simple PUT upload for presigned PUT URLs
export async function uploadWithPresignedPut(
  file: File,
  presignedUrl: string,
  options: S3UploadOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (options.abortSignal) {
      options.abortSignal.addEventListener("abort", () => xhr.abort());
    }

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}
```

**Why good:** Handles both POST (with policy) and PUT presigned URLs, progress tracking with XHR, abort support, correct field order for S3

---

## Pattern 2: Server-Side Presigned URL Generation

Your server endpoint should:

1. **Validate the request** - check file size, type, and user permissions
2. **Sanitize the filename** - replace special characters: `fileName.replace(/[^a-zA-Z0-9.-]/g, '_')`
3. **Generate a unique key** - e.g. `uploads/${userId}/${timestamp}-${sanitizedName}`
4. **Create the presigned URL** using your cloud SDK (AWS SDK `getSignedUrl`, GCS `generateSignedUrl`, etc.)
5. **Set expiration** - 15-60 minutes for uploads
6. **Return URL + key + expiration** to the client

```typescript
// Server-side presigned URL generation (framework-agnostic)
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const PRESIGNED_URL_EXPIRY_SECONDS = 3600;

// In your route handler:
const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
const key = `uploads/${userId}/${Date.now()}-${sanitizedName}`;

const command = new PutObjectCommand({
  Bucket: process.env.S3_BUCKET,
  Key: key,
  ContentType: fileType,
  ContentLength: fileSize,
});

const presignedUrl = await getSignedUrl(s3Client, command, {
  expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
});

// Return: { uploadUrl: presignedUrl, key, expiresAt }
```

**Why good:** Validates before generating URL, sanitizes filename, time-limited for security, client never sees storage credentials

---

## Pattern 3: Presigned POST Policy

POST policies add server-enforced constraints (size limits, content type restrictions):

```typescript
// Using AWS SDK createPresignedPost
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

const { url, fields } = await createPresignedPost(s3Client, {
  Bucket: process.env.S3_BUCKET,
  Key: `${keyPrefix}/\${filename}`, // S3 replaces ${filename}
  Conditions: [
    ["content-length-range", 0, MAX_FILE_SIZE_BYTES],
    ["starts-with", "$Content-Type", fileType.split("/")[0]],
    ["starts-with", "$key", keyPrefix],
  ],
  Fields: { "Content-Type": fileType },
  Expires: POLICY_EXPIRY_SECONDS,
});

// Return: { url, fields, expiresAt }
```

**Why good:** Server-side file size enforcement, content type restrictions, key prefix ensures files go to correct location, conditions prevent abuse

---

## Pattern 4: Multipart Upload for Large Files

### Initialize and Complete Multipart Upload

```typescript
// multipart-upload.ts
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const PART_EXPIRY_SECONDS = 3600;

interface MultipartUploadInit {
  uploadId: string;
  key: string;
  parts: Array<{
    partNumber: number;
    uploadUrl: string;
  }>;
}

const DEFAULT_PART_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function initializeMultipartUpload(
  s3Client: S3Client,
  bucket: string,
  key: string,
  fileSize: number,
  partSizeBytes: number = DEFAULT_PART_SIZE_BYTES,
): Promise<MultipartUploadInit> {
  // Create multipart upload
  const createCommand = new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
  });

  const { UploadId } = await s3Client.send(createCommand);

  if (!UploadId) {
    throw new Error("Failed to create multipart upload");
  }

  // Generate presigned URLs for each part
  const totalParts = Math.ceil(fileSize / partSizeBytes);
  const parts: MultipartUploadInit["parts"] = [];

  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    const uploadPartCommand = new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId,
      PartNumber: partNumber,
    });

    const uploadUrl = await getSignedUrl(s3Client, uploadPartCommand, {
      expiresIn: PART_EXPIRY_SECONDS,
    });

    parts.push({ partNumber, uploadUrl });
  }

  return {
    uploadId: UploadId,
    key,
    parts,
  };
}

export async function completeMultipartUpload(
  s3Client: S3Client,
  bucket: string,
  key: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>,
): Promise<string> {
  const command = new CompleteMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts
        .sort((a, b) => a.partNumber - b.partNumber)
        .map(({ partNumber, etag }) => ({
          PartNumber: partNumber,
          ETag: etag,
        })),
    },
  });

  const response = await s3Client.send(command);
  return response.Location ?? `https://${bucket}.s3.amazonaws.com/${key}`;
}

export async function abortMultipartUpload(
  s3Client: S3Client,
  bucket: string,
  key: string,
  uploadId: string,
): Promise<void> {
  const command = new AbortMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
  });

  await s3Client.send(command);
}
```

---

## Pattern 5: Client Multipart Uploader

### Upload Parts in Parallel

```typescript
// multipart-client.ts
interface MultipartUploadOptions {
  onProgress?: (progress: number) => void;
  maxConcurrent?: number;
  onPartComplete?: (partNumber: number) => void;
}

interface PartUploadResult {
  partNumber: number;
  etag: string;
}

const DEFAULT_MAX_CONCURRENT = 4;

export async function uploadMultipart(
  file: File,
  parts: Array<{ partNumber: number; uploadUrl: string }>,
  partSizeBytes: number,
  options: MultipartUploadOptions = {},
): Promise<PartUploadResult[]> {
  const {
    onProgress,
    maxConcurrent = DEFAULT_MAX_CONCURRENT,
    onPartComplete,
  } = options;

  const results: PartUploadResult[] = [];
  let completedBytes = 0;
  const totalBytes = file.size;

  const uploadPart = async (part: {
    partNumber: number;
    uploadUrl: string;
  }): Promise<PartUploadResult> => {
    const start = (part.partNumber - 1) * partSizeBytes;
    const end = Math.min(start + partSizeBytes, file.size);
    const chunk = file.slice(start, end);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          // Calculate overall progress
          const partProgress = e.loaded;
          const currentTotal = completedBytes + partProgress;
          onProgress(Math.round((currentTotal / totalBytes) * 100));
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader("ETag");
          if (!etag) {
            reject(new Error("Missing ETag in response"));
            return;
          }

          completedBytes += chunk.size;
          onPartComplete?.(part.partNumber);

          resolve({
            partNumber: part.partNumber,
            etag: etag.replace(/"/g, ""),
          });
        } else {
          reject(new Error(`Part ${part.partNumber} failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener("error", () =>
        reject(new Error(`Part ${part.partNumber} failed`)),
      );

      xhr.open("PUT", part.uploadUrl);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.send(chunk);
    });
  };

  // Upload parts with concurrency limit
  const queue = [...parts];
  const executing: Promise<void>[] = [];

  while (queue.length > 0 || executing.length > 0) {
    while (executing.length < maxConcurrent && queue.length > 0) {
      const part = queue.shift()!;
      const promise = uploadPart(part)
        .then((result) => {
          results.push(result);
        })
        .finally(() => {
          const index = executing.indexOf(promise);
          if (index > -1) executing.splice(index, 1);
        });

      executing.push(promise);
    }

    if (executing.length > 0) {
      await Promise.race(executing);
    }
  }

  return results;
}
```

**Why good:** Uploads parts in parallel with concurrency limit, tracks overall progress, extracts ETag for completion, handles errors per-part

---

## Pattern 6: Complete Upload Flow Hook

### Full S3 Upload Hook

```typescript
// use-s3-upload.ts
import { useState, useCallback, useRef } from "react";

interface S3UploadState {
  status:
    | "idle"
    | "preparing"
    | "uploading"
    | "completing"
    | "success"
    | "error";
  progress: number;
  error?: string;
  url?: string;
}

interface UseS3UploadOptions {
  presignEndpoint: string;
  maxSizeBytes?: number;
  onSuccess?: (url: string) => void;
  onError?: (error: Error) => void;
}

const DEFAULT_MAX_SIZE = 100 * 1024 * 1024; // 100MB

export function useS3Upload(options: UseS3UploadOptions) {
  const {
    presignEndpoint,
    maxSizeBytes = DEFAULT_MAX_SIZE,
    onSuccess,
    onError,
  } = options;

  const [state, setState] = useState<S3UploadState>({
    status: "idle",
    progress: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const upload = useCallback(
    async (file: File) => {
      // Validate size
      if (file.size > maxSizeBytes) {
        const maxMB = maxSizeBytes / (1024 * 1024);
        const error = new Error(`File exceeds ${maxMB}MB limit`);
        setState({ status: "error", progress: 0, error: error.message });
        onError?.(error);
        return;
      }

      abortControllerRef.current = new AbortController();

      try {
        // Step 1: Get presigned URL
        setState({ status: "preparing", progress: 0 });

        const presignResponse = await fetch(presignEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!presignResponse.ok) {
          throw new Error("Failed to get upload URL");
        }

        const { uploadUrl, key } = await presignResponse.json();

        // Step 2: Upload to S3
        setState({ status: "uploading", progress: 0 });

        await uploadWithPresignedPut(file, uploadUrl, {
          onProgress: (progress) => {
            setState((prev) => ({ ...prev, progress }));
          },
          abortSignal: abortControllerRef.current.signal,
        });

        // Step 3: Complete
        const finalUrl = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
        setState({ status: "success", progress: 100, url: finalUrl });
        onSuccess?.(finalUrl);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setState({ status: "idle", progress: 0 });
          return;
        }

        const error = err instanceof Error ? err : new Error("Upload failed");
        setState({ status: "error", progress: 0, error: error.message });
        onError?.(error);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [presignEndpoint, maxSizeBytes, onSuccess, onError],
  );

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setState({ status: "idle", progress: 0 });
  }, []);

  return {
    ...state,
    upload,
    abort,
    reset,
    isUploading: state.status === "uploading" || state.status === "preparing",
  };
}
```

**Why good:** Complete flow from presign to upload, size validation before starting, abort support, status tracking for UI feedback, success/error callbacks

---

_Extended examples: [core.md](core.md) | [validation.md](validation.md) | [progress.md](progress.md) | [preview.md](preview.md) | [resumable.md](resumable.md) | [accessibility.md](accessibility.md)_
