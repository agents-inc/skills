# File Upload — Resumable Examples

> Splitting a file so a failure costs one slice rather than the whole transfer. Decisions are in
> [SKILL.md](../SKILL.md); the presigned equivalent is in
> [presigned-upload.md](presigned-upload.md).

---

## Pattern 21: Chunked uploader

Three server calls — initialise, send each chunk, finalise — with a concurrency limit and per-chunk
retry. `Content-Range` tells the server where each chunk belongs, so they may arrive in any order.

```typescript
// chunked-upload.ts
interface ChunkUploadOptions {
  chunkSizeBytes?: number;
  maxConcurrentChunks?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  // indexes an earlier run already landed; these are skipped, which is the resume
  completedChunkIndexes?: number[];
  onProgress?: (progress: ChunkProgress) => void;
  onChunkComplete?: (chunkIndex: number) => void;
}

interface ChunkProgress {
  uploadedBytes: number;
  totalBytes: number;
  percentage: number;
  chunksCompleted: number;
  totalChunks: number;
}

interface ChunkUploadResult {
  success: boolean;
  fileId?: string;
  error?: string;
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;
const DEFAULT_MAX_CONCURRENT = 3;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

export class ChunkedUploader {
  private chunkSize: number;
  private maxConcurrent: number;
  private retryAttempts: number;
  private retryDelay: number;
  private abortController: AbortController | null = null;

  constructor(private options: ChunkUploadOptions = {}) {
    this.chunkSize = options.chunkSizeBytes ?? DEFAULT_CHUNK_SIZE;
    this.maxConcurrent = options.maxConcurrentChunks ?? DEFAULT_MAX_CONCURRENT;
    this.retryAttempts = options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
    this.retryDelay = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  }

  async upload(file: File, uploadUrl: string): Promise<ChunkUploadResult> {
    this.abortController = new AbortController();
    const totalChunks = Math.ceil(file.size / this.chunkSize);
    const uploadId = await this.initializeUpload(file, uploadUrl);

    if (!uploadId) {
      return { success: false, error: "Failed to initialize upload" };
    }

    const sizeOfChunk = (index: number) =>
      Math.min((index + 1) * this.chunkSize, file.size) -
      index * this.chunkSize;

    // a resume starts with these already done, so progress must start there too
    const alreadyDone = new Set(this.options.completedChunkIndexes ?? []);
    const completedChunks = new Set<number>(alreadyDone);
    let uploadedBytes = [...alreadyDone].reduce(
      (total, index) => total + sizeOfChunk(index),
      0,
    );

    const uploadChunk = async (chunkIndex: number): Promise<boolean> => {
      const start = chunkIndex * this.chunkSize;
      const end = Math.min(start + this.chunkSize, file.size);
      const chunk = file.slice(start, end);

      for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
        try {
          const response = await fetch(
            `${uploadUrl}/${uploadId}/chunk/${chunkIndex}`,
            {
              method: "PUT",
              body: chunk,
              headers: {
                "Content-Type": "application/octet-stream",
                "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
              },
              signal: this.abortController?.signal,
            },
          );

          // a 5xx is as retryable as a dropped connection, and worth the same backoff
          if (!response.ok) {
            await this.delay(this.retryDelay * Math.pow(2, attempt));
            continue;
          }

          completedChunks.add(chunkIndex);
          uploadedBytes += chunk.size;

          this.options.onProgress?.({
            uploadedBytes,
            totalBytes: file.size,
            percentage: Math.round((uploadedBytes / file.size) * 100),
            chunksCompleted: completedChunks.size,
            totalChunks,
          });

          this.options.onChunkComplete?.(chunkIndex);
          return true;
        } catch (error) {
          // an abort is deliberate; never retry through one
          if (error instanceof Error && error.name === "AbortError")
            throw error;
          await this.delay(this.retryDelay * Math.pow(2, attempt));
        }
      }
      return false;
    };

    const chunkIndexes = Array.from(
      { length: totalChunks },
      (_, i) => i,
    ).filter((index) => !alreadyDone.has(index));

    const results = await this.processWithConcurrency(
      chunkIndexes,
      uploadChunk,
    );

    if (results.every(Boolean)) {
      return this.finalizeUpload(uploadUrl, uploadId);
    }

    return { success: false, error: "Some chunks failed to upload" };
  }

  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  private async initializeUpload(
    file: File,
    uploadUrl: string,
  ): Promise<string | null> {
    try {
      const response = await fetch(`${uploadUrl}/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          totalChunks: Math.ceil(file.size / this.chunkSize),
        }),
      });
      return (await response.json()).uploadId;
    } catch {
      return null;
    }
  }

  private async finalizeUpload(
    uploadUrl: string,
    uploadId: string,
  ): Promise<ChunkUploadResult> {
    try {
      const response = await fetch(`${uploadUrl}/${uploadId}/complete`, {
        method: "POST",
      });
      return { success: true, fileId: (await response.json()).fileId };
    } catch {
      return { success: false, error: "Failed to finalize upload" };
    }
  }

  private async processWithConcurrency<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = [];
    const executing = new Set<Promise<void>>();

    for (const item of items) {
      const promise = processor(item).then((result) => {
        results.push(result);
        executing.delete(promise);
      });

      executing.add(promise);

      if (executing.size >= this.maxConcurrent) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

---

## Pattern 22: Resuming across a reload

The key is `name-size-lastModified`, which identifies the same file across sessions without reading
it. Validating all three on load is what stops a differently-named file of the same size resuming
into someone else's upload.

The chunk size is stored alongside the completed indexes because it is what gives them meaning: an
index is an offset only in terms of the size that produced it, so resuming with a different chunk
size would skip the wrong bytes.

```typescript
// use-resumable-upload.ts
import { useCallback, useRef, useState } from "react";
import { ChunkedUploader } from "./chunked-upload";

interface ResumableUploadState {
  status: "idle" | "uploading" | "paused" | "complete" | "error";
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  error?: string;
}

interface StoredUploadState {
  uploadId: string;
  fileName: string;
  fileSize: number;
  lastModified: number;
  completedChunks: number[];
  chunkSize: number;
  createdAt: number;
}

const STORAGE_KEY_PREFIX = "resumable-upload-";
const STORAGE_EXPIRY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;

const IDLE: ResumableUploadState = {
  status: "idle",
  progress: 0,
  uploadedBytes: 0,
  totalBytes: 0,
};

function getStorageKey(file: File): string {
  return `${STORAGE_KEY_PREFIX}${file.name}-${file.size}-${file.lastModified}`;
}

export function useResumableUpload(uploadUrl: string) {
  const [state, setState] = useState<ResumableUploadState>(IDLE);
  const uploaderRef = useRef<ChunkedUploader | null>(null);
  const currentFileRef = useRef<File | null>(null);

  const saveProgress = useCallback(
    (
      file: File,
      uploadId: string,
      completedChunks: number[],
      chunkSize: number,
    ) => {
      const stored: StoredUploadState = {
        uploadId,
        fileName: file.name,
        fileSize: file.size,
        lastModified: file.lastModified,
        completedChunks,
        chunkSize,
        createdAt: Date.now(),
      };
      try {
        localStorage.setItem(getStorageKey(file), JSON.stringify(stored));
      } catch {
        // storage full or blocked — the upload still works, it just cannot resume
      }
    },
    [],
  );

  const loadProgress = useCallback((file: File): StoredUploadState | null => {
    try {
      const raw = localStorage.getItem(getStorageKey(file));
      if (!raw) return null;

      const stored: StoredUploadState = JSON.parse(raw);

      const matchesFile =
        stored.fileName === file.name &&
        stored.fileSize === file.size &&
        stored.lastModified === file.lastModified;
      const fresh = Date.now() - stored.createdAt < STORAGE_EXPIRY_MS;

      if (matchesFile && fresh) return stored;

      // stale or mismatched: the server has probably discarded its side too
      localStorage.removeItem(getStorageKey(file));
    } catch {
      // unparseable entry — treat as absent
    }
    return null;
  }, []);

  const clearProgress = useCallback((file: File) => {
    localStorage.removeItem(getStorageKey(file));
  }, []);

  const upload = useCallback(
    async (file: File) => {
      currentFileRef.current = file;
      const stored = loadProgress(file);
      const completedChunks = stored?.completedChunks ?? [];
      const chunkSize = stored?.chunkSize ?? DEFAULT_CHUNK_SIZE;

      setState({ ...IDLE, status: "uploading", totalBytes: file.size });

      uploaderRef.current = new ChunkedUploader({
        chunkSizeBytes: chunkSize,
        // without this the uploader restarts from chunk 0 and the stored progress does nothing
        completedChunkIndexes: [...completedChunks],
        onProgress: (progress) =>
          setState((prev) => ({
            ...prev,
            progress: progress.percentage,
            uploadedBytes: progress.uploadedBytes,
          })),
        onChunkComplete: (chunkIndex) => {
          completedChunks.push(chunkIndex);
          saveProgress(
            file,
            stored?.uploadId ?? "",
            completedChunks,
            chunkSize,
          );
        },
      });

      try {
        const result = await uploaderRef.current.upload(file, uploadUrl);

        if (result.success) {
          clearProgress(file);
          setState((prev) => ({ ...prev, status: "complete", progress: 100 }));
        } else {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: result.error,
          }));
        }

        return result;
      } catch (err) {
        // an abort is a pause: the stored progress stays, ready to resume
        if (err instanceof Error && err.name === "AbortError") {
          setState((prev) => ({ ...prev, status: "paused" }));
        } else {
          setState((prev) => ({
            ...prev,
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          }));
        }
        return { success: false, error: "Upload interrupted" };
      }
    },
    [uploadUrl, loadProgress, saveProgress, clearProgress],
  );

  const pause = useCallback(() => {
    uploaderRef.current?.abort();
    setState((prev) => ({ ...prev, status: "paused" }));
  }, []);

  const resume = useCallback(() => {
    if (currentFileRef.current) upload(currentFileRef.current);
  }, [upload]);

  const cancel = useCallback(() => {
    uploaderRef.current?.abort();
    if (currentFileRef.current) clearProgress(currentFileRef.current);
    currentFileRef.current = null;
    setState(IDLE);
  }, [clearProgress]);

  const checkResumable = useCallback(
    (file: File): boolean =>
      (loadProgress(file)?.completedChunks.length ?? 0) > 0,
    [loadProgress],
  );

  return { state, upload, pause, resume, cancel, checkResumable };
}
```

Call `checkResumable` before starting, and ask the user — silently resuming a half-finished upload
they have forgotten about is worse than restarting one.

---

## Pattern 23: tus client

tus is an open resumable-upload protocol, so a client and a server written against it interoperate
without a shared implementation. Three verbs: `POST` creates the upload and returns its URL, `HEAD`
reports how many bytes the server already holds, `PATCH` appends from that offset.

```typescript
// tus-upload.ts
interface TusUploadOptions {
  endpoint: string;
  chunkSize?: number;
  retryDelays?: number[];
  onProgress?: (
    percentage: number,
    bytesUploaded: number,
    bytesTotal: number,
  ) => void;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;
const DEFAULT_RETRY_DELAYS = [0, 1000, 3000, 5000];
const TUS_VERSION = "1.0.0";

export class TusUpload {
  private endpoint: string;
  private chunkSize: number;
  private retryDelays: number[];
  private abortController: AbortController | null = null;
  private uploadUrl: string | null = null;
  private offset = 0;

  constructor(
    private file: File,
    private options: TusUploadOptions,
  ) {
    this.endpoint = options.endpoint;
    this.chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
    this.retryDelays = options.retryDelays ?? DEFAULT_RETRY_DELAYS;
  }

  async start(): Promise<void> {
    this.abortController = new AbortController();

    try {
      await this.createUpload();
      // the offset may be non-zero already, which is what makes this resumable
      await this.checkOffset();

      while (this.offset < this.file.size) {
        await this.uploadChunk();
      }

      this.options.onSuccess?.();
    } catch (error) {
      if (error instanceof Error) this.options.onError?.(error);
    }
  }

  abort(): void {
    this.abortController?.abort();
  }

  private async createUpload(): Promise<void> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Tus-Resumable": TUS_VERSION,
        "Upload-Length": String(this.file.size),
        "Upload-Metadata": this.encodeMetadata({
          filename: this.file.name,
          filetype: this.file.type,
        }),
      },
      signal: this.abortController?.signal,
    });

    if (!response.ok) throw new Error("Failed to create upload");

    this.uploadUrl = response.headers.get("Location");
    if (!this.uploadUrl) throw new Error("No upload URL returned");
  }

  private async checkOffset(): Promise<void> {
    if (!this.uploadUrl) return;

    const response = await fetch(this.uploadUrl, {
      method: "HEAD",
      headers: { "Tus-Resumable": TUS_VERSION },
      signal: this.abortController?.signal,
    });

    if (!response.ok) return;

    const offsetHeader = response.headers.get("Upload-Offset");
    if (offsetHeader) this.offset = parseInt(offsetHeader, 10);
  }

  private async uploadChunk(): Promise<void> {
    if (!this.uploadUrl) return;

    const end = Math.min(this.offset + this.chunkSize, this.file.size);
    const chunk = this.file.slice(this.offset, end);

    let lastError: Error | null = null;

    for (const delay of this.retryDelays) {
      if (delay > 0) await this.delay(delay);

      try {
        const response = await fetch(this.uploadUrl, {
          method: "PATCH",
          headers: {
            "Tus-Resumable": TUS_VERSION,
            "Upload-Offset": String(this.offset),
            "Content-Type": "application/offset+octet-stream",
          },
          body: chunk,
          signal: this.abortController?.signal,
        });

        if (response.ok) {
          // trust the server's offset over the local arithmetic
          const newOffset = response.headers.get("Upload-Offset");
          this.offset = newOffset ? parseInt(newOffset, 10) : end;

          this.options.onProgress?.(
            Math.round((this.offset / this.file.size) * 100),
            this.offset,
            this.file.size,
          );

          return;
        }

        lastError = new Error(`Upload failed: ${response.status}`);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        lastError = error instanceof Error ? error : new Error("Upload failed");
      }
    }

    throw lastError ?? new Error("Upload failed after retries");
  }

  /** tus metadata is comma-separated `key base64(value)` pairs. */
  private encodeMetadata(metadata: Record<string, string>): string {
    return Object.entries(metadata)
      .map(([key, value]) => `${key} ${btoa(value)}`)
      .join(",");
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

---

## Pattern 24: The tus server contract

| Method    | Path       | Purpose                   | Headers                                                          |
| --------- | ---------- | ------------------------- | ---------------------------------------------------------------- |
| `OPTIONS` | `/tus/*`   | Preflight and discovery   | `Tus-Version`, `Tus-Extension`, `Tus-Max-Size`                   |
| `POST`    | `/tus`     | Create an upload          | `Upload-Length`, `Upload-Metadata`; returns `Location`           |
| `HEAD`    | `/tus/:id` | Report the current offset | Returns `Upload-Offset`, `Upload-Length`                         |
| `PATCH`   | `/tus/:id` | Append from the offset    | `Upload-Offset`, `Content-Type: application/offset+octet-stream` |
| `DELETE`  | `/tus/:id` | Terminate and clean up    | —                                                                |

Every response carries `Tus-Resumable: 1.0.0`. A `PATCH` whose `Upload-Offset` does not match the
server's must answer `409` rather than writing — that mismatch is the client and server disagreeing
about what landed, and appending anyway corrupts the file. Store the length, offset and creation
time per upload ID, and expire abandoned ones.

A conforming server implementation is more work than it looks; the protocol has published server
libraries for most runtimes.
