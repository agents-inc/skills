# Progress Tracking Examples

> Progress indicators, speed calculation, abort handling for file uploads. Reference from [SKILL.md](../SKILL.md).

---

## Pattern 1: XHR Upload with Progress

### Basic Progress Tracking

```typescript
// use-upload-progress.ts
import { useState, useCallback, useRef } from 'react';

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

  const calculateSpeed = useCallback(
    (loaded: number, time: number): number => {
      const timeDelta = time - lastTimeRef.current;
      const loadedDelta = loaded - lastLoadedRef.current;

      if (timeDelta > 0) {
        const currentSpeed = (loadedDelta / timeDelta) * 1000;
        speedSamplesRef.current.push(currentSpeed);

        if (speedSamplesRef.current.length > SPEED_SAMPLE_SIZE) {
          speedSamplesRef.current.shift();
        }
      }

      lastLoadedRef.current = loaded;
      lastTimeRef.current = time;

      // Return rolling average for smooth display
      const sum = speedSamplesRef.current.reduce((a, b) => a + b, 0);
      return sum / speedSamplesRef.current.length || 0;
    },
    []
  );

  const upload = useCallback(
    (file: File, url: string): Promise<Response> => {
      return new Promise((resolve, reject) => {
        setUploading(true);
        setError(null);
        setProgress(null);

        // Reset speed tracking
        speedSamplesRef.current = [];
        lastLoadedRef.current = 0;
        lastTimeRef.current = performance.now();

        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const speed = calculateSpeed(event.loaded, performance.now());
            const remaining = event.total - event.loaded;
            const remainingTime = speed > 0 ? remaining / speed : 0;

            setProgress({
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100),
              speed,
              remainingTime,
            });
          }
        });

        xhr.addEventListener('load', () => {
          setUploading(false);
          xhrRef.current = null;

          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(
              new Response(xhr.response, {
                status: xhr.status,
                headers: { 'Content-Type': xhr.getResponseHeader('Content-Type') || '' },
              })
            );
          } else {
            const err = new Error(`Upload failed: ${xhr.status}`);
            setError(err.message);
            reject(err);
          }
        });

        xhr.addEventListener('error', () => {
          setUploading(false);
          xhrRef.current = null;
          const err = new Error('Upload failed - network error');
          setError(err.message);
          reject(err);
        });

        xhr.addEventListener('abort', () => {
          setUploading(false);
          xhrRef.current = null;
          reject(new Error('Upload aborted'));
        });

        xhr.open('POST', url);
        xhr.send(file);
      });
    },
    [calculateSpeed]
  );

  const abort = useCallback(() => {
    xhrRef.current?.abort();
    xhrRef.current = null;
  }, []);

  return { progress, uploading, error, upload, abort };
}
```

**Why good:** Uses XHR for progress events (fetch doesn't support upload progress), rolling average smooths speed display, provides abort capability, returns remaining time

---

## Pattern 2: Progress Bar Component

### Accessible Progress Bar

```typescript
// progress-bar.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import styles from './progress-bar.module.scss';

const progressVariants = cva(styles.progressBar, {
  variants: {
    size: {
      sm: styles.small,
      md: styles.medium,
      lg: styles.large,
    },
    status: {
      uploading: styles.uploading,
      success: styles.success,
      error: styles.error,
    },
  },
  defaultVariants: {
    size: 'md',
    status: 'uploading',
  },
});

interface ProgressBarProps extends VariantProps<typeof progressVariants> {
  progress: number; // 0-100
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function ProgressBar({
  progress,
  showLabel = true,
  label,
  size,
  status,
  className,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const displayLabel = label ?? `${Math.round(clampedProgress)}%`;

  return (
    <div
      className={progressVariants({ size, status, className })}
      role="progressbar"
      aria-valuenow={clampedProgress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Upload progress: ${displayLabel}`}
    >
      <div
        className={styles.fill}
        style={{ width: `${clampedProgress}%` }}
      />
      {showLabel && (
        <span className={styles.label} aria-hidden="true">
          {displayLabel}
        </span>
      )}
    </div>
  );
}
```

```scss
// progress-bar.module.scss
.progressBar {
  position: relative;
  width: 100%;
  background: var(--color-surface);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.small {
  height: 4px;
}

.medium {
  height: 8px;
}

.large {
  height: 16px;
}

.fill {
  height: 100%;
  transition: width 0.2s ease;
}

.uploading .fill {
  background: var(--color-primary);
}

.success .fill {
  background: var(--color-success);
}

.error .fill {
  background: var(--color-error);
}

.label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-white);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}
```

**Why good:** Accessible with role="progressbar" and aria attributes, variant support with CVA, clamps progress to valid range, label hidden from screen readers (aria-hidden) since aria-label provides info

---

## Pattern 3: Format Utilities

### Speed and Time Formatters

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
  if (!isFinite(seconds) || seconds < 0) {
    return 'Calculating...';
  }

  if (seconds < SECONDS_PER_MINUTE) {
    return `${Math.ceil(seconds)}s remaining`;
  }

  if (seconds < SECONDS_PER_HOUR) {
    const minutes = Math.ceil(seconds / SECONDS_PER_MINUTE);
    return `${minutes}m remaining`;
  }

  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.ceil(
    (seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE
  );
  return `${hours}h ${minutes}m remaining`;
}

export function formatProgress(loaded: number, total: number): string {
  return `${formatBytes(loaded)} / ${formatBytes(total)}`;
}
```

---

## Pattern 4: Upload Progress Display

### Complete Progress UI Component

```typescript
// upload-progress-display.tsx
import { ProgressBar } from './progress-bar';
import { formatBytes, formatSpeed, formatRemainingTime } from './format-progress';
import styles from './upload-progress-display.module.scss';

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
    <div className={styles.container} data-status={status}>
      <div className={styles.header}>
        <span className={styles.fileName} title={fileName}>
          {fileName}
        </span>

        {status === 'uploading' && onAbort && (
          <button
            type="button"
            className={styles.abortButton}
            onClick={onAbort}
            aria-label={`Cancel upload of ${fileName}`}
          >
            Cancel
          </button>
        )}

        {status === 'error' && onRetry && (
          <button
            type="button"
            className={styles.retryButton}
            onClick={onRetry}
            aria-label={`Retry upload of ${fileName}`}
          >
            Retry
          </button>
        )}
      </div>

      {status === 'uploading' && progress && (
        <>
          <ProgressBar
            progress={progress.percentage}
            status="uploading"
          />

          <div className={styles.details}>
            <span>
              {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
            </span>
            <span>{formatSpeed(progress.speed)}</span>
            <span>{formatRemainingTime(progress.remainingTime)}</span>
          </div>
        </>
      )}

      {status === 'pending' && (
        <div className={styles.pending} aria-live="polite">
          Waiting to upload...
        </div>
      )}

      {status === 'success' && (
        <div className={styles.success} role="status">
          <span aria-hidden="true">✓</span>
          Upload complete
        </div>
      )}

      {status === 'error' && error && (
        <div className={styles.error} role="alert">
          <span aria-hidden="true">✗</span>
          {error}
        </div>
      )}
    </div>
  );
}
```

```scss
// upload-progress-display.module.scss
.container {
  padding: var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-2);

  &[data-status='success'] {
    border-color: var(--color-success);
    background: var(--color-success-light);
  }

  &[data-status='error'] {
    border-color: var(--color-error);
    background: var(--color-error-light);
  }
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-2);
}

.fileName {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.abortButton,
.retryButton {
  padding: var(--spacing-1) var(--spacing-2);
  font-size: var(--text-sm);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.abortButton {
  background: var(--color-surface);
  color: var(--color-text-muted);

  &:hover {
    background: var(--color-error-light);
    color: var(--color-error);
  }
}

.retryButton {
  background: var(--color-primary);
  color: var(--color-white);

  &:hover {
    background: var(--color-primary-dark);
  }
}

.details {
  display: flex;
  justify-content: space-between;
  margin-top: var(--spacing-2);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.pending {
  color: var(--color-text-muted);
  font-style: italic;
}

.success {
  color: var(--color-success);
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.error {
  color: var(--color-error);
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}
```

**Why good:** Shows all progress details (bytes, speed, ETA), abort button during upload, retry button on error, accessible with aria-live and role attributes, visual state indication

---

## Pattern 5: Multi-File Progress Manager

### Managing Multiple Concurrent Uploads

```typescript
// use-multi-upload.ts
import { useState, useCallback, useRef } from 'react';

interface FileUploadState {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface UseMultiUploadOptions {
  maxConcurrent?: number;
  uploadUrl: string;
  onFileComplete?: (file: File, response: Response) => void;
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
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const activeCountRef = useRef(0);

  const generateId = () =>
    `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const uploadFile = useCallback(
    async (state: FileUploadState) => {
      const controller = new AbortController();
      abortControllersRef.current.set(state.id, controller);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === state.id ? { ...f, status: 'uploading', progress: 0 } : f
        )
      );

      try {
        const xhr = new XMLHttpRequest();

        await new Promise<void>((resolve, reject) => {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setFiles((prev) =>
                prev.map((f) =>
                  f.id === state.id ? { ...f, progress } : f
                )
              );
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          });

          xhr.addEventListener('error', () =>
            reject(new Error('Network error'))
          );
          xhr.addEventListener('abort', () =>
            reject(new Error('Upload cancelled'))
          );

          controller.signal.addEventListener('abort', () => xhr.abort());

          xhr.open('POST', uploadUrl);
          xhr.send(state.file);
        });

        setFiles((prev) =>
          prev.map((f) =>
            f.id === state.id ? { ...f, status: 'success', progress: 100 } : f
          )
        );

        onFileComplete?.(
          state.file,
          new Response(null, { status: 200 })
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Upload failed';
        setFiles((prev) =>
          prev.map((f) =>
            f.id === state.id ? { ...f, status: 'error', error: message } : f
          )
        );
      } finally {
        abortControllersRef.current.delete(state.id);
        activeCountRef.current--;
        processQueue();
      }
    },
    [uploadUrl, onFileComplete]
  );

  const processQueue = useCallback(() => {
    setFiles((prev) => {
      const pending = prev.filter((f) => f.status === 'pending');
      const canStart = maxConcurrent - activeCountRef.current;

      pending.slice(0, canStart).forEach((file) => {
        activeCountRef.current++;
        uploadFile(file);
      });

      // Check if all complete
      const allDone = prev.every(
        (f) => f.status === 'success' || f.status === 'error'
      );
      if (allDone && prev.length > 0) {
        onAllComplete?.();
      }

      return prev;
    });
  }, [maxConcurrent, uploadFile, onAllComplete]);

  const addFiles = useCallback(
    (newFiles: File[]) => {
      const newStates: FileUploadState[] = newFiles.map((file) => ({
        id: generateId(),
        file,
        status: 'pending',
        progress: 0,
      }));

      setFiles((prev) => [...prev, ...newStates]);

      // Start processing after state update
      setTimeout(processQueue, 0);
    },
    [processQueue]
  );

  const abortFile = useCallback((id: string) => {
    abortControllersRef.current.get(id)?.abort();
  }, []);

  const retryFile = useCallback(
    (id: string) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, status: 'pending', progress: 0, error: undefined } : f
        )
      );
      setTimeout(processQueue, 0);
    },
    [processQueue]
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
    isUploading: files.some((f) => f.status === 'uploading'),
  };
}
```

**Why good:** Limits concurrent uploads to prevent overwhelming server/browser, maintains queue of pending files, supports abort/retry per file, tracks individual progress, fires callbacks on completion

---

_Extended examples: [core.md](core.md) | [validation.md](validation.md) | [preview.md](preview.md) | [s3-upload.md](s3-upload.md) | [resumable.md](resumable.md) | [accessibility.md](accessibility.md)_
