# File Upload — Presigned Upload Examples

> Uploading straight to object storage on a URL your server signed. Decisions are in
> [SKILL.md](../SKILL.md); [progress.md](progress.md) has the progress machinery these build on.

---

## Pattern 16: Client upload to a presigned URL

Two shapes, and which one you get depends on what the server issued.

A **presigned PUT** is a plain request: the URL carries the signature, the body is the file.

A **presigned POST** is a `FormData` submission carrying policy fields the storage service checks
before accepting anything. The file must be appended **last** — the service reads fields in order
and stops at the file.

```typescript
// presigned-upload.ts
interface PresignedPost {
  url: string;
  fields: Record<string, string>;
}

interface UploadOptions {
  onProgress?: (percentage: number) => void;
  abortSignal?: AbortSignal;
}

/** POST with a policy. Returns the key joined to the endpoint — see the note below. */
export async function uploadWithPresignedPost(
  file: File,
  credentials: PresignedPost,
  options: UploadOptions = {},
): Promise<string> {
  const { url, fields } = credentials;
  const formData = new FormData();

  // policy fields first
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  // file last — anything appended after it is ignored
  formData.append("file", file);

  await sendWithProgress(url, "POST", formData, options);
  return `${url}${fields.key}`;
}

/** PUT to a signed URL. The URL is the whole authorisation. */
export async function uploadWithPresignedPut(
  file: File,
  presignedUrl: string,
  options: UploadOptions = {},
): Promise<void> {
  await sendWithProgress(presignedUrl, "PUT", file, options, {
    // the content type has to match what the server signed for
    "Content-Type": file.type,
  });
}

function sendWithProgress(
  url: string,
  method: "PUT" | "POST",
  body: XMLHttpRequestBodyInit,
  options: UploadOptions,
  headers: Record<string, string> = {},
): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    options.abortSignal?.addEventListener("abort", () => xhr.abort());

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr);
      else reject(new Error(`Upload failed: ${xhr.status}`));
    });

    xhr.addEventListener("error", () =>
      reject(new Error("Upload failed - network error")),
    );
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    xhr.open(method, url);
    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.send(body);
  });
}
```

`${url}${fields.key}` is plain concatenation, so it only produces a valid URL when the endpoint
already ends in a slash — some services return it with one and some without. Check what yours
returns before relying on that return value. Better still, ignore it: store the key and build the
URL when you serve the object, which is what Pattern 20 does.

---

## Pattern 17: The signing endpoint's contract

The signing call is where authorisation happens, because after it the storage service will accept
anything the URL permits. Your endpoint does five things:

1. **Authorise the caller** for this upload — the presigned URL inherits no session.
2. **Check the declared size and type** against what this caller is allowed, before signing.
3. **Build the key server-side.** Never let the client choose it. Sanitise the display name and
   namespace the key: `uploads/${userId}/${Date.now()}-${sanitized}`, with
   `fileName.replace(/[^a-zA-Z0-9.-]/g, "_")` as the sanitiser.
4. **Sign for the shortest workable lifetime** — 15 to 60 minutes for an upload.
5. **Return the URL, the key and the expiry.** The key is what your database records; the URL is
   single-use scaffolding.

```typescript
// The request the client sends
interface PresignRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
}

// The response the client expects
interface PresignResponse {
  uploadUrl: string;
  key: string;
  expiresAt: string; // ISO 8601
}
```

Signing is done with the storage provider's own SDK, whose call shape belongs in its documentation
rather than here — it changes between providers and between major versions, and the contract above
is what does not.

The declared size is a claim, so it constrains only what you sign for. A POST policy makes the
storage service enforce it (Pattern 18); a PUT does not, and a bucket-side size limit is the backstop.

---

## Pattern 18: POST policy conditions

A POST policy is a signed document of constraints the storage service evaluates itself. It is the
only way to have a size limit enforced without your application seeing the bytes.

The condition syntax below is S3's, which the S3-compatible stores accept as well. A store with its
own upload API expresses the same constraints differently, so check its documentation rather than
assuming these array forms carry over.

```typescript
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// The conditions the server signs into the policy
const conditions = [
  ["content-length-range", 0, MAX_FILE_SIZE_BYTES],
  ["starts-with", "$Content-Type", "image/"],
  ["starts-with", "$key", `uploads/${userId}/`],
];

// What the server returns. `url` and `fields` are the PresignedPost of Pattern 16;
// fields carries the policy, the signature, the key and Content-Type.
interface PresignedPostResponse extends PresignedPost {
  expiresAt: string;
}
```

`starts-with` on the key is what stops a caller writing outside their own prefix, and
`content-length-range` is what stops them filling the bucket. Both are checked by the storage
service, so neither depends on the client behaving.

Not every object store supports browser POST form uploads; some accept presigned PUT only.
Cloudflare R2 is the one that catches people out — its presigned URLs cover GET, HEAD, PUT and
DELETE, and it states that POST multipart form uploads via HTML forms are not supported. Confirm
before designing around a policy, because the PUT path needs the size limit enforced elsewhere.

---

## Pattern 19: Multipart uploads

Past a few hundred megabytes, one request is too fragile: a drop at 90% costs the whole transfer.
Multipart splits the object into parts, each with its own presigned URL, each retryable alone.

The server's side is a contract of two calls:

```typescript
// POST /uploads/multipart — begin, and hand back a signed URL per part
interface MultipartInitResponse {
  uploadId: string;
  key: string;
  parts: Array<{ partNumber: number; uploadUrl: string }>;
}

// POST /uploads/multipart/complete — assemble, given each part's ETag
interface MultipartCompleteRequest {
  uploadId: string;
  key: string;
  parts: Array<{ partNumber: number; etag: string }>;
}
```

Part numbers start at 1, and the complete call needs them in order. An upload that is never
completed or aborted leaves its parts stored and billed but invisible in a listing — set a lifecycle
rule that expires incomplete uploads.

The client uploads the parts, respecting a concurrency limit, and collects the `ETag` each part
returns:

```typescript
// multipart-client.ts
interface MultipartUploadOptions {
  onProgress?: (percentage: number) => void;
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

  const uploadPart = (part: {
    partNumber: number;
    uploadUrl: string;
  }): Promise<PartUploadResult> => {
    const start = (part.partNumber - 1) * partSizeBytes;
    const chunk = file.slice(start, Math.min(start + partSizeBytes, file.size));

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (!e.lengthComputable || !onProgress) return;
        // completed parts plus this part's bytes so far
        onProgress(Math.round(((completedBytes + e.loaded) / file.size) * 100));
      });

      xhr.addEventListener("load", () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`Part ${part.partNumber} failed: ${xhr.status}`));
          return;
        }

        // needs CORS ExposeHeaders: ["ETag"], or this reads null
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) {
          reject(new Error("Missing ETag in response"));
          return;
        }

        completedBytes += chunk.size;
        onPartComplete?.(part.partNumber);
        resolve({ partNumber: part.partNumber, etag: etag.replace(/"/g, "") });
      });

      xhr.addEventListener("error", () =>
        reject(new Error(`Part ${part.partNumber} failed`)),
      );

      xhr.open("PUT", part.uploadUrl);
      xhr.setRequestHeader("Content-Type", "application/octet-stream");
      xhr.send(chunk);
    });
  };

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
          executing.splice(executing.indexOf(promise), 1);
        });

      executing.push(promise);
    }

    if (executing.length > 0) await Promise.race(executing);
  }

  return results;
}
```

The progress figure only counts whole completed parts plus the part currently reporting, so with
several in flight it advances unevenly. Smooth it by summing per-part `loaded` values if that
matters.

---

## Pattern 20: The whole flow as a hook

Preparing, uploading and finishing are three states the UI wants to distinguish — "getting ready"
and "uploading" fail for different reasons and are worth saying differently.

```typescript
// use-presigned-upload.ts
import { useCallback, useRef, useState } from "react";
import { uploadWithPresignedPut } from "./presigned-upload";

interface UploadState {
  status: "idle" | "preparing" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
  key?: string;
}

interface UsePresignedUploadOptions {
  presignEndpoint: string;
  maxSizeBytes?: number;
  onSuccess?: (key: string) => void;
  onError?: (error: Error) => void;
}

const DEFAULT_MAX_SIZE = 100 * 1024 * 1024;
const IDLE: UploadState = { status: "idle", progress: 0 };

export function usePresignedUpload(options: UsePresignedUploadOptions) {
  const {
    presignEndpoint,
    maxSizeBytes = DEFAULT_MAX_SIZE,
    onSuccess,
    onError,
  } = options;

  const [state, setState] = useState<UploadState>(IDLE);
  const abortControllerRef = useRef<AbortController | null>(null);

  const upload = useCallback(
    async (file: File) => {
      if (file.size > maxSizeBytes) {
        const maxMB = maxSizeBytes / (1024 * 1024);
        const error = new Error(`File exceeds ${maxMB}MB limit`);
        setState({ status: "error", progress: 0, error: error.message });
        onError?.(error);
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        setState({ status: "preparing", progress: 0 });

        const presignResponse = await fetch(presignEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          }),
          signal: controller.signal,
        });

        if (!presignResponse.ok) throw new Error("Failed to get upload URL");

        const { uploadUrl, key } = await presignResponse.json();

        setState({ status: "uploading", progress: 0 });

        await uploadWithPresignedPut(file, uploadUrl, {
          onProgress: (progress) => setState((prev) => ({ ...prev, progress })),
          abortSignal: controller.signal,
        });

        // the key is what the application stores; the URL was scaffolding
        setState({ status: "success", progress: 100, key });
        onSuccess?.(key);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setState(IDLE);
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

  const abort = useCallback(() => abortControllerRef.current?.abort(), []);
  const reset = useCallback(() => setState(IDLE), []);

  return {
    ...state,
    upload,
    abort,
    reset,
    isUploading: state.status === "uploading" || state.status === "preparing",
  };
}
```
