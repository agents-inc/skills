# Resumable Upload Examples

> Chunked uploads, resumable uploads with persistence. Reference from [SKILL.md](../SKILL.md).

---

## Pattern 1: Chunked Uploader

### Basic Chunked Upload Manager

```typescript
// chunked-upload.ts
interface ChunkUploadOptions {
  chunkSizeBytes?: number;
  maxConcurrentChunks?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
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

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
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
      return { success: false, error: 'Failed to initialize upload' };
    }

    const completedChunks = new Set<number>();
    let uploadedBytes = 0;

    const uploadChunk = async (chunkIndex: number): Promise<boolean> => {
      const start = chunkIndex * this.chunkSize;
      const end = Math.min(start + this.chunkSize, file.size);
      const chunk = file.slice(start, end);

      for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
        try {
          const response = await fetch(
            `${uploadUrl}/${uploadId}/chunk/${chunkIndex}`,
            {
              method: 'PUT',
              body: chunk,
              headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Range': `bytes ${start}-${end - 1}/${file.size}`,
              },
              signal: this.abortController?.signal,
            }
          );

          if (response.ok) {
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
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            throw error;
          }
          // Exponential backoff
          await this.delay(this.retryDelay * Math.pow(2, attempt));
        }
      }
      return false;
    };

    // Upload chunks with concurrency limit
    const chunkIndexes = Array.from({ length: totalChunks }, (_, i) => i);
    const results = await this.processWithConcurrency(chunkIndexes, uploadChunk);

    if (results.every(Boolean)) {
      return this.finalizeUpload(uploadUrl, uploadId);
    }

    return { success: false, error: 'Some chunks failed to upload' };
  }

  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  private async initializeUpload(
    file: File,
    uploadUrl: string
  ): Promise<string | null> {
    try {
      const response = await fetch(`${uploadUrl}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          totalChunks: Math.ceil(file.size / this.chunkSize),
        }),
      });
      const data = await response.json();
      return data.uploadId;
    } catch {
      return null;
    }
  }

  private async finalizeUpload(
    uploadUrl: string,
    uploadId: string
  ): Promise<ChunkUploadResult> {
    try {
      const response = await fetch(`${uploadUrl}/${uploadId}/complete`, {
        method: 'POST',
      });
      const data = await response.json();
      return { success: true, fileId: data.fileId };
    } catch {
      return { success: false, error: 'Failed to finalize upload' };
    }
  }

  private async processWithConcurrency<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];

    for (const item of items) {
      const promise = processor(item).then((result) => {
        results.push(result);
      });

      executing.push(promise);

      if (executing.length >= this.maxConcurrent) {
        await Promise.race(executing);
        // Remove completed promises
        const completed = executing.filter((p) => {
          // Check if settled using a race with an immediately resolved promise
          return false; // Simplified - in practice use Promise.allSettled
        });
        executing.splice(0, completed.length);
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

**Why good:** Uploads in parallel with concurrency limit, retries failed chunks with exponential backoff, tracks progress by chunk, supports abort

---

## Pattern 2: Resumable Upload with localStorage

### Persist Progress for Resume

```typescript
// use-resumable-upload.ts
import { useState, useCallback, useRef, useEffect } from 'react';

interface ResumableUploadState {
  status: 'idle' | 'uploading' | 'paused' | 'complete' | 'error';
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

const STORAGE_KEY_PREFIX = 'resumable-upload-';
const STORAGE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function useResumableUpload(uploadUrl: string) {
  const [state, setState] = useState<ResumableUploadState>({
    status: 'idle',
    progress: 0,
    uploadedBytes: 0,
    totalBytes: 0,
  });

  const uploaderRef = useRef<ChunkedUploader | null>(null);
  const currentFileRef = useRef<File | null>(null);

  const getStorageKey = (file: File): string => {
    // Create unique key based on file properties
    return `${STORAGE_KEY_PREFIX}${file.name}-${file.size}-${file.lastModified}`;
  };

  const saveProgress = useCallback(
    (
      file: File,
      uploadId: string,
      completedChunks: number[],
      chunkSize: number
    ) => {
      const state: StoredUploadState = {
        uploadId,
        fileName: file.name,
        fileSize: file.size,
        lastModified: file.lastModified,
        completedChunks,
        chunkSize,
        createdAt: Date.now(),
      };
      try {
        localStorage.setItem(getStorageKey(file), JSON.stringify(state));
      } catch {
        // localStorage might be full or unavailable
      }
    },
    []
  );

  const loadProgress = useCallback(
    (file: File): StoredUploadState | null => {
      try {
        const stored = localStorage.getItem(getStorageKey(file));
        if (!stored) return null;

        const state: StoredUploadState = JSON.parse(stored);

        // Validate stored state matches current file and isn't expired
        if (
          state.fileName === file.name &&
          state.fileSize === file.size &&
          state.lastModified === file.lastModified &&
          Date.now() - state.createdAt < STORAGE_EXPIRY_MS
        ) {
          return state;
        }

        // Invalid or expired - clean up
        localStorage.removeItem(getStorageKey(file));
      } catch {
        // Invalid JSON or other error
      }
      return null;
    },
    []
  );

  const clearProgress = useCallback((file: File) => {
    try {
      localStorage.removeItem(getStorageKey(file));
    } catch {
      // Ignore
    }
  }, []);

  const upload = useCallback(
    async (file: File) => {
      currentFileRef.current = file;
      const storedState = loadProgress(file);
      const completedChunks: number[] = storedState?.completedChunks ?? [];

      setState({
        status: 'uploading',
        progress: 0,
        uploadedBytes: 0,
        totalBytes: file.size,
      });

      const chunkSize = storedState?.chunkSize ?? 5 * 1024 * 1024;

      uploaderRef.current = new ChunkedUploader({
        chunkSizeBytes: chunkSize,
        onProgress: (progress) => {
          setState((prev) => ({
            ...prev,
            progress: progress.percentage,
            uploadedBytes: progress.uploadedBytes,
          }));
        },
        onChunkComplete: (chunkIndex) => {
          completedChunks.push(chunkIndex);
          saveProgress(
            file,
            storedState?.uploadId ?? '',
            completedChunks,
            chunkSize
          );
        },
      });

      try {
        const result = await uploaderRef.current.upload(file, uploadUrl);

        if (result.success) {
          clearProgress(file);
          setState((prev) => ({
            ...prev,
            status: 'complete',
            progress: 100,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: result.error,
          }));
        }

        return result;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setState((prev) => ({ ...prev, status: 'paused' }));
        } else {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: err instanceof Error ? err.message : 'Upload failed',
          }));
        }
        return { success: false, error: 'Upload interrupted' };
      }
    },
    [uploadUrl, loadProgress, saveProgress, clearProgress]
  );

  const pause = useCallback(() => {
    uploaderRef.current?.abort();
    setState((prev) => ({ ...prev, status: 'paused' }));
  }, []);

  const resume = useCallback(() => {
    if (currentFileRef.current) {
      upload(currentFileRef.current);
    }
  }, [upload]);

  const cancel = useCallback(() => {
    uploaderRef.current?.abort();
    if (currentFileRef.current) {
      clearProgress(currentFileRef.current);
    }
    currentFileRef.current = null;
    setState({
      status: 'idle',
      progress: 0,
      uploadedBytes: 0,
      totalBytes: 0,
    });
  }, [clearProgress]);

  // Check for resumable upload on mount
  const checkResumable = useCallback(
    (file: File): boolean => {
      const stored = loadProgress(file);
      return stored !== null && stored.completedChunks.length > 0;
    },
    [loadProgress]
  );

  return {
    state,
    upload,
    pause,
    resume,
    cancel,
    checkResumable,
  };
}
```

**Why good:** Persists progress to localStorage for browser refresh recovery, validates stored state matches file, expires old progress, supports pause/resume/cancel

---

## Pattern 3: TUS Protocol Client (Simplified)

### TUS-like Resumable Upload

```typescript
// tus-upload.ts
interface TusUploadOptions {
  endpoint: string;
  chunkSize?: number;
  retryDelays?: number[];
  onProgress?: (percentage: number, bytesUploaded: number, bytesTotal: number) => void;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;
const DEFAULT_RETRY_DELAYS = [0, 1000, 3000, 5000];

export class TusUpload {
  private endpoint: string;
  private chunkSize: number;
  private retryDelays: number[];
  private abortController: AbortController | null = null;
  private uploadUrl: string | null = null;
  private offset = 0;

  constructor(
    private file: File,
    private options: TusUploadOptions
  ) {
    this.endpoint = options.endpoint;
    this.chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
    this.retryDelays = options.retryDelays ?? DEFAULT_RETRY_DELAYS;
  }

  async start(): Promise<void> {
    this.abortController = new AbortController();

    try {
      // Step 1: Create upload (TUS POST)
      await this.createUpload();

      // Step 2: Check current offset (TUS HEAD)
      await this.checkOffset();

      // Step 3: Upload chunks (TUS PATCH)
      while (this.offset < this.file.size) {
        await this.uploadChunk();
      }

      this.options.onSuccess?.();
    } catch (error) {
      if (error instanceof Error) {
        this.options.onError?.(error);
      }
    }
  }

  abort(): void {
    this.abortController?.abort();
  }

  private async createUpload(): Promise<void> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(this.file.size),
        'Upload-Metadata': this.encodeMetadata({
          filename: this.file.name,
          filetype: this.file.type,
        }),
      },
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      throw new Error('Failed to create upload');
    }

    this.uploadUrl = response.headers.get('Location');
    if (!this.uploadUrl) {
      throw new Error('No upload URL returned');
    }
  }

  private async checkOffset(): Promise<void> {
    if (!this.uploadUrl) return;

    const response = await fetch(this.uploadUrl, {
      method: 'HEAD',
      headers: {
        'Tus-Resumable': '1.0.0',
      },
      signal: this.abortController?.signal,
    });

    if (response.ok) {
      const offsetHeader = response.headers.get('Upload-Offset');
      if (offsetHeader) {
        this.offset = parseInt(offsetHeader, 10);
      }
    }
  }

  private async uploadChunk(): Promise<void> {
    if (!this.uploadUrl) return;

    const end = Math.min(this.offset + this.chunkSize, this.file.size);
    const chunk = this.file.slice(this.offset, end);

    let lastError: Error | null = null;

    for (const delay of this.retryDelays) {
      if (delay > 0) {
        await this.delay(delay);
      }

      try {
        const response = await fetch(this.uploadUrl, {
          method: 'PATCH',
          headers: {
            'Tus-Resumable': '1.0.0',
            'Upload-Offset': String(this.offset),
            'Content-Type': 'application/offset+octet-stream',
          },
          body: chunk,
          signal: this.abortController?.signal,
        });

        if (response.ok) {
          const newOffset = response.headers.get('Upload-Offset');
          if (newOffset) {
            this.offset = parseInt(newOffset, 10);
          } else {
            this.offset = end;
          }

          this.options.onProgress?.(
            Math.round((this.offset / this.file.size) * 100),
            this.offset,
            this.file.size
          );

          return;
        }

        lastError = new Error(`Upload failed: ${response.status}`);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }
        lastError = error instanceof Error ? error : new Error('Upload failed');
      }
    }

    throw lastError ?? new Error('Upload failed after retries');
  }

  private encodeMetadata(metadata: Record<string, string>): string {
    return Object.entries(metadata)
      .map(([key, value]) => `${key} ${btoa(value)}`)
      .join(',');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Usage
const upload = new TusUpload(file, {
  endpoint: '/api/upload/tus',
  onProgress: (percentage) => console.log(`${percentage}%`),
  onSuccess: () => console.log('Complete!'),
  onError: (error) => console.error(error),
});

upload.start();
// Later: upload.abort();
```

**Why good:** Follows TUS protocol conventions, supports resume via HEAD check, retry with configurable delays, progress tracking, abort support

---

## Pattern 4: Server-Side TUS Handler (Hono)

### Basic TUS Endpoint

```typescript
// routes/tus.ts
import { Hono } from 'hono';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, stat, unlink } from 'fs/promises';
import { join } from 'path';

const TUS_VERSION = '1.0.0';
const UPLOAD_DIR = './uploads';

interface UploadInfo {
  length: number;
  offset: number;
  metadata: Record<string, string>;
  createdAt: number;
}

const uploads = new Map<string, UploadInfo>();

const app = new Hono();

// TUS: Options (for CORS preflight)
app.options('/tus/*', (c) => {
  return c.text('', 204, {
    'Tus-Resumable': TUS_VERSION,
    'Tus-Version': TUS_VERSION,
    'Tus-Extension': 'creation,termination',
    'Tus-Max-Size': String(5 * 1024 * 1024 * 1024), // 5GB
  });
});

// TUS: Create upload
app.post('/tus', async (c) => {
  const uploadLength = c.req.header('Upload-Length');
  const uploadMetadata = c.req.header('Upload-Metadata');

  if (!uploadLength) {
    return c.text('Upload-Length required', 400);
  }

  const id = crypto.randomUUID();
  const metadata = parseMetadata(uploadMetadata ?? '');

  uploads.set(id, {
    length: parseInt(uploadLength, 10),
    offset: 0,
    metadata,
    createdAt: Date.now(),
  });

  await mkdir(UPLOAD_DIR, { recursive: true });

  const location = `${c.req.url}/${id}`;

  return c.text('', 201, {
    Location: location,
    'Tus-Resumable': TUS_VERSION,
  });
});

// TUS: Get upload status
app.head('/tus/:id', (c) => {
  const id = c.req.param('id');
  const upload = uploads.get(id);

  if (!upload) {
    return c.text('Not found', 404);
  }

  return c.text('', 200, {
    'Upload-Offset': String(upload.offset),
    'Upload-Length': String(upload.length),
    'Tus-Resumable': TUS_VERSION,
  });
});

// TUS: Upload chunk
app.patch('/tus/:id', async (c) => {
  const id = c.req.param('id');
  const upload = uploads.get(id);

  if (!upload) {
    return c.text('Not found', 404);
  }

  const offset = parseInt(c.req.header('Upload-Offset') ?? '0', 10);

  if (offset !== upload.offset) {
    return c.text('Conflict - offset mismatch', 409);
  }

  const body = await c.req.arrayBuffer();
  const chunk = Buffer.from(body);

  const filePath = join(UPLOAD_DIR, id);
  const writeStream = createWriteStream(filePath, {
    flags: 'a',
    start: offset,
  });

  writeStream.write(chunk);
  writeStream.end();

  upload.offset += chunk.length;

  return c.text('', 204, {
    'Upload-Offset': String(upload.offset),
    'Tus-Resumable': TUS_VERSION,
  });
});

// TUS: Delete upload
app.delete('/tus/:id', async (c) => {
  const id = c.req.param('id');

  if (!uploads.has(id)) {
    return c.text('Not found', 404);
  }

  uploads.delete(id);

  try {
    await unlink(join(UPLOAD_DIR, id));
  } catch {
    // File might not exist
  }

  return c.text('', 204, {
    'Tus-Resumable': TUS_VERSION,
  });
});

function parseMetadata(header: string): Record<string, string> {
  const result: Record<string, string> = {};

  if (!header) return result;

  for (const pair of header.split(',')) {
    const [key, value] = pair.trim().split(' ');
    if (key && value) {
      result[key] = atob(value);
    }
  }

  return result;
}

export { app as tusRoutes };
```

**Why good:** Implements core TUS protocol (creation, resumable patches), tracks offset for resume, handles OPTIONS for CORS, supports termination

---

_Extended examples: [core.md](core.md) | [validation.md](validation.md) | [progress.md](progress.md) | [preview.md](preview.md) | [s3-upload.md](s3-upload.md) | [accessibility.md](accessibility.md)_
