# File Upload — Progress Examples

> Reporting how an upload is going, and letting the user stop it. Decisions are in
> [SKILL.md](../SKILL.md).

---

## Pattern 10: XHR upload with progress

`xhr.upload` is the only progress source for a request body. The rolling average over the last few
samples is what makes the speed readable — a raw per-event figure swings by an order of magnitude
between packets.

```typescript
// use-upload-progress.ts
import { useCallback, useRef, useState } from "react";

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
}

interface UseUploadProgressResult {
  progress: UploadProgress | null;
  uploading: boolean;
  error: string | null;
  upload: (file: File, url: string) => Promise<Response>;
  abort: () => void;
}

const SPEED_SAMPLE_SIZE = 5;

export function useUploadProgress(): UseUploadProgressResult {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const speedSamplesRef = useRef<number[]>([]);
  const lastLoadedRef = useRef(0);
  const lastTimeRef = useRef(0);

  const calculateSpeed = useCallback((loaded: number, time: number): number => {
    const timeDelta = time - lastTimeRef.current;
    const loadedDelta = loaded - lastLoadedRef.current;

    if (timeDelta > 0) {
      speedSamplesRef.current.push((loadedDelta / timeDelta) * 1000);
      if (speedSamplesRef.current.length > SPEED_SAMPLE_SIZE) {
        speedSamplesRef.current.shift();
      }
    }

    lastLoadedRef.current = loaded;
    lastTimeRef.current = time;

    const samples = speedSamplesRef.current;
    return samples.reduce((a, b) => a + b, 0) / samples.length || 0;
  }, []);

  const upload = useCallback(
    (file: File, url: string): Promise<Response> =>
      new Promise((resolve, reject) => {
        setUploading(true);
        setError(null);
        setProgress(null);

        speedSamplesRef.current = [];
        lastLoadedRef.current = 0;
        lastTimeRef.current = performance.now();

        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.addEventListener("progress", (event) => {
          // false when the body has no known length — show a spinner instead
          if (!event.lengthComputable) return;

          const speed = calculateSpeed(event.loaded, performance.now());
          const remaining = event.total - event.loaded;

          setProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
            speed,
            remainingTime: speed > 0 ? remaining / speed : 0,
          });
        });

        xhr.addEventListener("load", () => {
          setUploading(false);
          xhrRef.current = null;

          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(
              new Response(xhr.response, {
                status: xhr.status,
                headers: {
                  "Content-Type": xhr.getResponseHeader("Content-Type") || "",
                },
              }),
            );
            return;
          }

          const err = new Error(`Upload failed: ${xhr.status}`);
          setError(err.message);
          reject(err);
        });

        xhr.addEventListener("error", () => {
          setUploading(false);
          xhrRef.current = null;
          const err = new Error("Upload failed - network error");
          setError(err.message);
          reject(err);
        });

        xhr.addEventListener("abort", () => {
          setUploading(false);
          xhrRef.current = null;
          reject(new Error("Upload aborted"));
        });

        xhr.open("POST", url);
        xhr.send(file);
      }),
    [calculateSpeed],
  );

  const abort = useCallback(() => {
    xhrRef.current?.abort();
    xhrRef.current = null;
  }, []);

  return { progress, uploading, error, upload, abort };
}
```

Wrapping the response in a `Response` keeps callers from caring that this used XHR at all.

---

## Pattern 11: Progress bar

The visible percentage is `aria-hidden`, because `aria-label` already announces it — otherwise a
screen reader reads it twice.

```typescript
// progress-bar.tsx
type ProgressSize = 'sm' | 'md' | 'lg';
type ProgressStatus = 'uploading' | 'success' | 'error';

interface ProgressBarProps {
  progress: number; // 0-100
  size?: ProgressSize;
  status?: ProgressStatus;
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function ProgressBar({
  progress,
  showLabel = true,
  label,
  size = 'md',
  status = 'uploading',
  className,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const displayLabel = label ?? `${Math.round(clamped)}%`;

  return (
    <div
      className={className}
      data-size={size}
      data-status={status}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Upload progress: ${displayLabel}`}
    >
      <div data-fill style={{ width: `${clamped}%` }} />
      {showLabel && <span aria-hidden="true">{displayLabel}</span>}
    </div>
  );
}
```

---

## Pattern 12: Formatters

```typescript
// format-progress.ts
const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * 1024;
const BYTES_PER_GB = BYTES_PER_MB * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_MB) return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  if (bytes < BYTES_PER_GB) return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
  return `${(bytes / BYTES_PER_GB).toFixed(2)} GB`;
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * 60;

export function formatRemainingTime(seconds: number): string {
  // an estimate before the first sample is Infinity, not a number to show
  if (!isFinite(seconds) || seconds < 0) return "Calculating...";

  if (seconds < SECONDS_PER_MINUTE) return `${Math.ceil(seconds)}s remaining`;

  if (seconds < SECONDS_PER_HOUR) {
    return `${Math.ceil(seconds / SECONDS_PER_MINUTE)}m remaining`;
  }

  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.ceil((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  return `${hours}h ${minutes}m remaining`;
}

export function formatProgress(loaded: number, total: number): string {
  return `${formatBytes(loaded)} / ${formatBytes(total)}`;
}
```

---

## Pattern 13: Progress display

Cancel while it runs, retry once it has failed — the same slot, different affordance.

```typescript
// upload-progress-display.tsx
import { ProgressBar } from './progress-bar';
import {
  formatBytes,
  formatSpeed,
  formatRemainingTime,
} from './format-progress';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed: number;
  remainingTime: number;
}

interface UploadProgressDisplayProps {
  fileName: string;
  progress: UploadProgress | null;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  onAbort?: () => void;
  onRetry?: () => void;
}

export function UploadProgressDisplay({
  fileName,
  progress,
  status,
  error,
  onAbort,
  onRetry,
}: UploadProgressDisplayProps) {
  return (
    <div data-status={status}>
      <div>
        <span title={fileName}>{fileName}</span>

        {status === 'uploading' && onAbort && (
          <button
            type="button"
            onClick={onAbort}
            aria-label={`Cancel upload of ${fileName}`}
          >
            Cancel
          </button>
        )}

        {status === 'error' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            aria-label={`Retry upload of ${fileName}`}
          >
            Retry
          </button>
        )}
      </div>

      {status === 'uploading' && progress && (
        <>
          <ProgressBar progress={progress.percentage} status="uploading" />
          <div>
            <span>
              {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
            </span>
            <span>{formatSpeed(progress.speed)}</span>
            <span>{formatRemainingTime(progress.remainingTime)}</span>
          </div>
        </>
      )}

      {status === 'pending' && (
        <div aria-live="polite">Waiting to upload...</div>
      )}

      {status === 'success' && (
        <div role="status">
          <span aria-hidden="true">✓</span> Upload complete
        </div>
      )}

      {status === 'error' && error && (
        <div role="alert">
          <span aria-hidden="true">✗</span> {error}
        </div>
      )}
    </div>
  );
}
```

---

## Pattern 14: Concurrent uploads

A cap on how many run at once. Without it, twenty files open twenty connections, each one slower
than three would have been, and each competing for the same upstream bandwidth.

```typescript
// use-multi-upload.ts
import { useCallback, useEffect, useRef, useState } from "react";

interface FileUploadState {
  id: string;
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

interface UseMultiUploadOptions {
  maxConcurrent?: number;
  uploadUrl: string;
  onFileComplete?: (file: File) => void;
  onAllComplete?: () => void;
}

const DEFAULT_MAX_CONCURRENT = 3;

export function useMultiUpload(options: UseMultiUploadOptions) {
  const {
    maxConcurrent = DEFAULT_MAX_CONCURRENT,
    uploadUrl,
    onFileComplete,
    onAllComplete,
  } = options;

  const [files, setFiles] = useState<FileUploadState[]>([]);
  const abortControllersRef = useRef(new Map<string, AbortController>());
  const activeCountRef = useRef(0);

  // the queue reads this rather than reading state inside an updater: starting an
  // upload is a side effect, and React may run an updater more than once
  const filesRef = useRef<FileUploadState[]>([]);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const patch = useCallback((id: string, changes: Partial<FileUploadState>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...changes } : f)),
    );
  }, []);

  const uploadFile = useCallback(
    async (state: FileUploadState) => {
      const controller = new AbortController();
      abortControllersRef.current.set(state.id, controller);

      patch(state.id, { status: "uploading", progress: 0 });

      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (e) => {
            if (!e.lengthComputable) return;
            patch(state.id, {
              progress: Math.round((e.loaded / e.total) * 100),
            });
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed: ${xhr.status}`));
          });

          xhr.addEventListener("error", () =>
            reject(new Error("Network error")),
          );
          xhr.addEventListener("abort", () =>
            reject(new Error("Upload cancelled")),
          );

          controller.signal.addEventListener("abort", () => xhr.abort());

          xhr.open("POST", uploadUrl);
          xhr.send(state.file);
        });

        patch(state.id, { status: "success", progress: 100 });
        onFileComplete?.(state.file);
      } catch (err) {
        patch(state.id, {
          status: "error",
          error: err instanceof Error ? err.message : "Upload failed",
        });
      } finally {
        abortControllersRef.current.delete(state.id);
        activeCountRef.current--;
        processQueue();
      }
    },
    [uploadUrl, onFileComplete, patch],
  );

  const processQueue = useCallback(() => {
    const current = filesRef.current;
    const pending = current.filter((f) => f.status === "pending");
    const slots = maxConcurrent - activeCountRef.current;

    pending.slice(0, slots).forEach((file) => {
      activeCountRef.current++;
      uploadFile(file);
    });

    const allSettled =
      current.length > 0 &&
      current.every((f) => f.status === "success" || f.status === "error");
    if (allSettled) onAllComplete?.();
  }, [maxConcurrent, uploadFile, onAllComplete]);

  const addFiles = useCallback(
    (newFiles: File[]) => {
      setFiles((prev) => [
        ...prev,
        ...newFiles.map((file) => ({
          id: crypto.randomUUID(),
          file,
          status: "pending" as const,
          progress: 0,
        })),
      ]);

      // deferred so the commit, and the ref that mirrors it, land before the queue reads
      setTimeout(processQueue, 0);
    },
    [processQueue],
  );

  const abortFile = useCallback((id: string) => {
    abortControllersRef.current.get(id)?.abort();
  }, []);

  const retryFile = useCallback(
    (id: string) => {
      patch(id, { status: "pending", progress: 0, error: undefined });
      setTimeout(processQueue, 0);
    },
    [patch, processQueue],
  );

  const removeFile = useCallback((id: string) => {
    abortControllersRef.current.get(id)?.abort();
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return {
    files,
    addFiles,
    abortFile,
    retryFile,
    removeFile,
    isUploading: files.some((f) => f.status === "uploading"),
  };
}
```
