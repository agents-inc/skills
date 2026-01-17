# File Upload and Handling Best Practices Research

## Overview

This document provides comprehensive patterns for implementing file upload functionality in modern web applications. Each section covers core patterns, anti-patterns, and usage guidelines.

---

## 1. File Upload UI Patterns (Drag & Drop, Multi-File)

### Core Patterns

#### Basic Dropzone Component

```typescript
// file-dropzone.tsx
import { useState, useRef, useCallback } from 'react';
import type { DragEvent, ChangeEvent } from 'react';

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string[];
  multiple?: boolean;
  maxFiles?: number;
  disabled?: boolean;
  children?: React.ReactNode;
}

type DropzoneState = 'idle' | 'drag-over' | 'drag-reject';

const DEFAULT_MAX_FILES = 10;

export function FileDropzone({
  onFilesSelected,
  accept = [],
  multiple = true,
  maxFiles = DEFAULT_MAX_FILES,
  disabled = false,
  children,
}: FileDropzoneProps) {
  const [state, setState] = useState<DropzoneState>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptString = accept.join(',');

  const isValidType = useCallback(
    (file: File): boolean => {
      if (accept.length === 0) return true;
      return accept.some((type) => {
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type.toLowerCase());
        }
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.replace('/*', '/'));
        }
        return file.type === type;
      });
    },
    [accept]
  );

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (disabled) return;

      const items = Array.from(event.dataTransfer.items);
      const hasValidFile = items.some(
        (item) => item.kind === 'file' && isValidType(item as unknown as File)
      );

      setState(hasValidFile ? 'drag-over' : 'drag-reject');
    },
    [disabled, isValidType]
  );

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setState('idle');
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setState('idle');

      if (disabled) return;

      const droppedFiles = Array.from(event.dataTransfer.files);
      const validFiles = droppedFiles.filter(isValidType);
      const filesToProcess = multiple ? validFiles.slice(0, maxFiles) : validFiles.slice(0, 1);

      if (filesToProcess.length > 0) {
        onFilesSelected(filesToProcess);
      }
    },
    [disabled, isValidType, multiple, maxFiles, onFilesSelected]
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;

      const fileArray = Array.from(files);
      const filesToProcess = multiple ? fileArray.slice(0, maxFiles) : fileArray.slice(0, 1);

      onFilesSelected(filesToProcess);

      // Reset input to allow selecting same file again
      event.target.value = '';
    },
    [multiple, maxFiles, onFilesSelected]
  );

  const openFileDialog = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  return (
    <div
      data-state={state}
      data-disabled={disabled || undefined}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={openFileDialog}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFileDialog();
        }
      }}
      aria-label="File upload area. Click or drag files to upload."
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptString}
        multiple={multiple}
        onChange={handleInputChange}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
        style={{ display: 'none' }}
      />
      {children}
    </div>
  );
}
```

#### File List Manager Hook

```typescript
// use-file-list.ts
import { useState, useCallback } from 'react';

interface FileWithId {
  id: string;
  file: File;
  preview?: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface UseFileListOptions {
  maxFiles?: number;
  maxSizeBytes?: number;
  allowDuplicates?: boolean;
}

const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function useFileList(options: UseFileListOptions = {}) {
  const {
    maxFiles = 10,
    maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
    allowDuplicates = false,
  } = options;

  const [files, setFiles] = useState<FileWithId[]>([]);

  const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  };

  const addFiles = useCallback(
    (newFiles: File[]): { added: FileWithId[]; rejected: Array<{ file: File; reason: string }> } => {
      const added: FileWithId[] = [];
      const rejected: Array<{ file: File; reason: string }> = [];

      setFiles((current) => {
        const availableSlots = maxFiles - current.length;
        let slotsUsed = 0;

        for (const file of newFiles) {
          if (slotsUsed >= availableSlots) {
            rejected.push({ file, reason: 'Maximum files limit reached' });
            continue;
          }

          if (file.size > maxSizeBytes) {
            rejected.push({ file, reason: `File exceeds ${maxSizeBytes / 1024 / 1024}MB limit` });
            continue;
          }

          if (!allowDuplicates) {
            const isDuplicate = current.some(
              (existing) =>
                existing.file.name === file.name &&
                existing.file.size === file.size &&
                existing.file.lastModified === file.lastModified
            );
            if (isDuplicate) {
              rejected.push({ file, reason: 'Duplicate file' });
              continue;
            }
          }

          const fileWithId: FileWithId = {
            id: generateId(),
            file,
            status: 'pending',
            progress: 0,
          };

          added.push(fileWithId);
          slotsUsed++;
        }

        return [...current, ...added];
      });

      return { added, rejected };
    },
    [maxFiles, maxSizeBytes, allowDuplicates]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((current) => {
      const file = current.find((f) => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return current.filter((f) => f.id !== id);
    });
  }, []);

  const updateFile = useCallback((id: string, updates: Partial<FileWithId>) => {
    setFiles((current) =>
      current.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  }, []);

  const clearFiles = useCallback(() => {
    setFiles((current) => {
      current.forEach((f) => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
      return [];
    });
  }, []);

  return {
    files,
    addFiles,
    removeFile,
    updateFile,
    clearFiles,
    hasFiles: files.length > 0,
    canAddMore: files.length < maxFiles,
  };
}
```

### Anti-Patterns

```typescript
// ANTI-PATTERN: Not cleaning up object URLs (memory leak)
function BadPreview({ file }: { file: File }) {
  const url = URL.createObjectURL(file); // Created on every render!
  return <img src={url} />;
}

// ANTI-PATTERN: Using stopPropagation without preventDefault
const handleDrop = (e: DragEvent) => {
  e.stopPropagation(); // Missing preventDefault - browser may open file!
  // ...
};

// ANTI-PATTERN: Synchronous file reading blocking UI
const handleFile = (file: File) => {
  const reader = new FileReader();
  reader.readAsDataURL(file); // No async handling, no progress
  return reader.result; // Will be undefined!
};

// ANTI-PATTERN: Not resetting file input after selection
<input
  type="file"
  onChange={(e) => {
    onSelect(e.target.files);
    // Missing: e.target.value = '' - cannot select same file twice
  }}
/>
```

### When to Use

| Scenario | Recommendation |
|----------|----------------|
| Simple single file upload | Basic `<input type="file">` is sufficient |
| Multi-file with preview | Full dropzone with file list management |
| Mobile-first app | Click-to-browse primary, drag-drop secondary |
| Image gallery upload | Dropzone + thumbnail previews |
| Form with optional attachment | Inline file input, not dropzone |

---

## 2. Chunked Upload for Large Files

### Core Patterns

#### Chunked Upload Manager

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
          const response = await fetch(`${uploadUrl}/${uploadId}/chunk/${chunkIndex}`, {
            method: 'PUT',
            body: chunk,
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Range': `bytes ${start}-${end - 1}/${file.size}`,
            },
            signal: this.abortController?.signal,
          });

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
          await this.delay(this.retryDelay * (attempt + 1));
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

  private async initializeUpload(file: File, uploadUrl: string): Promise<string | null> {
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

  private async finalizeUpload(uploadUrl: string, uploadId: string): Promise<ChunkUploadResult> {
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
        executing.splice(
          executing.findIndex((p) => p === promise),
          1
        );
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

#### Resumable Upload Hook

```typescript
// use-resumable-upload.ts
import { useState, useCallback, useRef } from 'react';

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
  completedChunks: number[];
  lastModified: number;
}

const STORAGE_KEY_PREFIX = 'resumable-upload-';

export function useResumableUpload(uploadUrl: string) {
  const [state, setState] = useState<ResumableUploadState>({
    status: 'idle',
    progress: 0,
    uploadedBytes: 0,
    totalBytes: 0,
  });

  const uploaderRef = useRef<ChunkedUploader | null>(null);

  const getStorageKey = (file: File): string => {
    return `${STORAGE_KEY_PREFIX}${file.name}-${file.size}-${file.lastModified}`;
  };

  const saveProgress = useCallback((file: File, uploadId: string, completedChunks: number[]) => {
    const state: StoredUploadState = {
      uploadId,
      fileName: file.name,
      fileSize: file.size,
      completedChunks,
      lastModified: Date.now(),
    };
    localStorage.setItem(getStorageKey(file), JSON.stringify(state));
  }, []);

  const loadProgress = useCallback((file: File): StoredUploadState | null => {
    const stored = localStorage.getItem(getStorageKey(file));
    if (!stored) return null;

    try {
      const state: StoredUploadState = JSON.parse(stored);
      // Validate stored state matches current file
      if (state.fileName === file.name && state.fileSize === file.size) {
        return state;
      }
    } catch {
      // Invalid stored state
    }
    return null;
  }, []);

  const clearProgress = useCallback((file: File) => {
    localStorage.removeItem(getStorageKey(file));
  }, []);

  const upload = useCallback(
    async (file: File) => {
      setState({
        status: 'uploading',
        progress: 0,
        uploadedBytes: 0,
        totalBytes: file.size,
      });

      const completedChunks: number[] = [];
      const storedState = loadProgress(file);

      uploaderRef.current = new ChunkedUploader({
        onProgress: (progress) => {
          setState((prev) => ({
            ...prev,
            progress: progress.percentage,
            uploadedBytes: progress.uploadedBytes,
          }));
        },
        onChunkComplete: (chunkIndex) => {
          completedChunks.push(chunkIndex);
          saveProgress(file, storedState?.uploadId ?? '', completedChunks);
        },
      });

      const result = await uploaderRef.current.upload(file, uploadUrl);

      if (result.success) {
        clearProgress(file);
        setState((prev) => ({ ...prev, status: 'complete', progress: 100 }));
      } else {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: result.error,
        }));
      }

      return result;
    },
    [uploadUrl, loadProgress, saveProgress, clearProgress]
  );

  const pause = useCallback(() => {
    uploaderRef.current?.abort();
    setState((prev) => ({ ...prev, status: 'paused' }));
  }, []);

  const cancel = useCallback(() => {
    uploaderRef.current?.abort();
    setState({
      status: 'idle',
      progress: 0,
      uploadedBytes: 0,
      totalBytes: 0,
    });
  }, []);

  return { state, upload, pause, cancel };
}
```

### Anti-Patterns

```typescript
// ANTI-PATTERN: Loading entire file into memory
const uploadFile = async (file: File) => {
  const content = await file.arrayBuffer(); // Loads entire file!
  await fetch('/upload', { body: content });
};

// ANTI-PATTERN: No retry logic for transient failures
const uploadChunk = async (chunk: Blob) => {
  const response = await fetch('/upload', { body: chunk });
  if (!response.ok) throw new Error('Failed'); // Single failure = total failure
};

// ANTI-PATTERN: Sequential chunk uploads
for (const chunk of chunks) {
  await uploadChunk(chunk); // Very slow - no parallelism
}

// ANTI-PATTERN: No abort capability
const upload = async (file: File) => {
  // No way to cancel this upload once started
  for (let i = 0; i < chunks; i++) {
    await uploadChunk(i);
  }
};
```

### When to Use

| File Size | Recommendation |
|-----------|----------------|
| < 5MB | Simple single request upload |
| 5MB - 100MB | Chunked upload with progress |
| 100MB+ | Chunked + resumable with persistence |
| Any size on mobile | Always chunked (unstable connections) |

---

## 3. Image Preview and Manipulation

### Core Patterns

#### Image Preview Hook

```typescript
// use-image-preview.ts
import { useState, useEffect, useCallback } from 'react';

interface ImagePreview {
  url: string;
  width: number;
  height: number;
  aspectRatio: number;
}

interface UseImagePreviewResult {
  preview: ImagePreview | null;
  loading: boolean;
  error: string | null;
  generatePreview: (file: File) => Promise<void>;
  clearPreview: () => void;
}

const MAX_PREVIEW_DIMENSION = 1200;

export function useImagePreview(): UseImagePreviewResult {
  const [preview, setPreview] = useState<ImagePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (preview?.url) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview?.url]);

  const generatePreview = useCallback(async (file: File) => {
    // Cleanup previous preview
    if (preview?.url) {
      URL.revokeObjectURL(preview.url);
    }

    setLoading(true);
    setError(null);

    try {
      // Validate it's an image
      if (!file.type.startsWith('image/')) {
        throw new Error('File is not an image');
      }

      const url = URL.createObjectURL(file);
      const dimensions = await getImageDimensions(url);

      setPreview({
        url,
        width: dimensions.width,
        height: dimensions.height,
        aspectRatio: dimensions.width / dimensions.height,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [preview?.url]);

  const clearPreview = useCallback(() => {
    if (preview?.url) {
      URL.revokeObjectURL(preview.url);
    }
    setPreview(null);
    setError(null);
  }, [preview?.url]);

  return { preview, loading, error, generatePreview, clearPreview };
}

function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}
```

#### Image Resizer Utility

```typescript
// image-resizer.ts
interface ResizeOptions {
  maxWidth: number;
  maxHeight: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
  maintainAspectRatio?: boolean;
}

interface ResizeResult {
  blob: Blob;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

const DEFAULT_QUALITY = 0.85;

export async function resizeImage(
  file: File,
  options: ResizeOptions
): Promise<ResizeResult> {
  const {
    maxWidth,
    maxHeight,
    quality = DEFAULT_QUALITY,
    format = 'image/jpeg',
    maintainAspectRatio = true,
  } = options;

  // Load image
  const imageBitmap = await createImageBitmap(file);
  const { width: originalWidth, height: originalHeight } = imageBitmap;

  // Calculate new dimensions
  let newWidth = originalWidth;
  let newHeight = originalHeight;

  if (maintainAspectRatio) {
    const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight);
    if (ratio < 1) {
      newWidth = Math.round(originalWidth * ratio);
      newHeight = Math.round(originalHeight * ratio);
    }
  } else {
    newWidth = Math.min(originalWidth, maxWidth);
    newHeight = Math.min(originalHeight, maxHeight);
  }

  // Use OffscreenCanvas for better performance (works in Web Workers)
  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Enable image smoothing for better quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw resized image
  ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight);
  imageBitmap.close();

  // Convert to blob
  const blob = await canvas.convertToBlob({ type: format, quality });

  return {
    blob,
    width: newWidth,
    height: newHeight,
    originalWidth,
    originalHeight,
  };
}

// Helper for batch processing
export async function resizeImages(
  files: File[],
  options: ResizeOptions,
  onProgress?: (completed: number, total: number) => void
): Promise<ResizeResult[]> {
  const results: ResizeResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const result = await resizeImage(files[i], options);
    results.push(result);
    onProgress?.(i + 1, files.length);
  }

  return results;
}
```

#### EXIF Orientation Handler

```typescript
// exif-orientation.ts
const EXIF_ORIENTATION_FLAG = 0x0112;

export async function fixImageOrientation(file: File): Promise<Blob> {
  const orientation = await getExifOrientation(file);

  if (orientation <= 1) {
    return file; // No rotation needed
  }

  const imageBitmap = await createImageBitmap(file);
  const { width, height } = imageBitmap;

  // Determine if we need to swap dimensions
  const swapDimensions = orientation >= 5 && orientation <= 8;
  const canvasWidth = swapDimensions ? height : width;
  const canvasHeight = swapDimensions ? width : height;

  const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Apply transformations based on EXIF orientation
  const transforms: Record<number, () => void> = {
    2: () => ctx.transform(-1, 0, 0, 1, width, 0),
    3: () => ctx.transform(-1, 0, 0, -1, width, height),
    4: () => ctx.transform(1, 0, 0, -1, 0, height),
    5: () => ctx.transform(0, 1, 1, 0, 0, 0),
    6: () => ctx.transform(0, 1, -1, 0, height, 0),
    7: () => ctx.transform(0, -1, -1, 0, height, width),
    8: () => ctx.transform(0, -1, 1, 0, 0, width),
  };

  transforms[orientation]?.();
  ctx.drawImage(imageBitmap, 0, 0);
  imageBitmap.close();

  return canvas.convertToBlob({ type: file.type });
}

async function getExifOrientation(file: File): Promise<number> {
  const buffer = await file.slice(0, 65536).arrayBuffer();
  const view = new DataView(buffer);

  // Check for JPEG SOI marker
  if (view.getUint16(0) !== 0xffd8) {
    return 1;
  }

  let offset = 2;
  while (offset < view.byteLength) {
    const marker = view.getUint16(offset);

    if (marker === 0xffe1) {
      // APP1 marker (EXIF)
      const exifOffset = offset + 4;
      if (
        view.getUint32(exifOffset) === 0x45786966 && // "Exif"
        view.getUint16(exifOffset + 4) === 0x0000
      ) {
        return parseExifOrientation(view, exifOffset + 6);
      }
    }

    offset += 2 + view.getUint16(offset + 2);
  }

  return 1;
}

function parseExifOrientation(view: DataView, tiffOffset: number): number {
  const littleEndian = view.getUint16(tiffOffset) === 0x4949;
  const ifdOffset = view.getUint32(tiffOffset + 4, littleEndian);
  const numEntries = view.getUint16(tiffOffset + ifdOffset, littleEndian);

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = tiffOffset + ifdOffset + 2 + i * 12;
    const tag = view.getUint16(entryOffset, littleEndian);

    if (tag === EXIF_ORIENTATION_FLAG) {
      return view.getUint16(entryOffset + 8, littleEndian);
    }
  }

  return 1;
}
```

### Anti-Patterns

```typescript
// ANTI-PATTERN: Creating object URLs without cleanup
function BadImagePreview({ file }: { file: File }) {
  // Memory leak! New URL created on every render, never revoked
  return <img src={URL.createObjectURL(file)} />;
}

// ANTI-PATTERN: Blocking main thread with large image processing
const processImage = (file: File) => {
  const reader = new FileReader();
  reader.readAsDataURL(file); // Blocks UI for large files
  // Synchronous processing follows...
};

// ANTI-PATTERN: Not handling EXIF orientation
const displayImage = (file: File) => {
  // Images from phones may appear rotated!
  return <img src={URL.createObjectURL(file)} />;
};

// ANTI-PATTERN: Using toDataURL for large images
const saveImage = (canvas: HTMLCanvasElement) => {
  return canvas.toDataURL('image/png'); // Creates huge base64 string in memory
};
```

### When to Use

| Scenario | Recommendation |
|----------|----------------|
| Thumbnail gallery | Resize on client before display |
| Profile photo upload | Resize + crop on client, full processing on server |
| Image editing app | Use Web Workers for all processing |
| Simple file attachment | Object URL preview only, no processing |

---

## 4. PDF Handling and Preview

### Core Patterns

#### PDF Preview Component (using PDF.js)

```typescript
// pdf-preview.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface PDFPreviewProps {
  file: File | string; // File object or URL
  page?: number;
  scale?: number;
  onLoadSuccess?: (numPages: number) => void;
  onLoadError?: (error: Error) => void;
}

const DEFAULT_SCALE = 1.5;

export function PDFPreview({
  file,
  page = 1,
  scale = DEFAULT_SCALE,
  onLoadSuccess,
  onLoadError,
}: PDFPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPDF = async () => {
      setLoading(true);
      setError(null);

      try {
        const source = file instanceof File ? await file.arrayBuffer() : file;

        const loadingTask = pdfjsLib.getDocument({
          data: source instanceof ArrayBuffer ? source : undefined,
          url: typeof source === 'string' ? source : undefined,
        });

        const pdfDoc = await loadingTask.promise;

        if (cancelled) {
          pdfDoc.destroy();
          return;
        }

        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);
        onLoadSuccess?.(pdfDoc.numPages);
      } catch (err) {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error('Failed to load PDF');
          setError(error.message);
          onLoadError?.(error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPDF();

    return () => {
      cancelled = true;
      pdfDocRef.current?.destroy();
    };
  }, [file, onLoadSuccess, onLoadError]);

  useEffect(() => {
    const renderPage = async () => {
      const pdfDoc = pdfDocRef.current;
      const canvas = canvasRef.current;

      if (!pdfDoc || !canvas || page < 1 || page > numPages) return;

      const pdfPage = await pdfDoc.getPage(page);
      const viewport = pdfPage.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const context = canvas.getContext('2d');
      if (!context) return;

      await pdfPage.render({
        canvasContext: context,
        viewport,
      }).promise;
    };

    if (numPages > 0) {
      renderPage();
    }
  }, [page, scale, numPages]);

  if (loading) {
    return <div aria-busy="true" aria-label="Loading PDF">Loading...</div>;
  }

  if (error) {
    return <div role="alert">{error}</div>;
  }

  return (
    <div>
      <canvas ref={canvasRef} aria-label={`PDF page ${page} of ${numPages}`} />
    </div>
  );
}
```

#### PDF Thumbnail Generator

```typescript
// pdf-thumbnail.ts
import * as pdfjsLib from 'pdfjs-dist';

interface ThumbnailOptions {
  width?: number;
  height?: number;
  page?: number;
  quality?: number;
}

const DEFAULT_THUMBNAIL_WIDTH = 200;
const DEFAULT_QUALITY = 0.8;

export async function generatePDFThumbnail(
  file: File,
  options: ThumbnailOptions = {}
): Promise<Blob> {
  const {
    width = DEFAULT_THUMBNAIL_WIDTH,
    page = 1,
    quality = DEFAULT_QUALITY,
  } = options;

  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  try {
    const pdfPage = await pdfDoc.getPage(page);
    const originalViewport = pdfPage.getViewport({ scale: 1 });

    // Calculate scale to fit desired width
    const scale = width / originalViewport.width;
    const viewport = pdfPage.getViewport({ scale });

    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Failed to get canvas context');
    }

    await pdfPage.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    return canvas.convertToBlob({ type: 'image/jpeg', quality });
  } finally {
    pdfDoc.destroy();
  }
}
```

#### PDF Text Extraction

```typescript
// pdf-text-extract.ts
import * as pdfjsLib from 'pdfjs-dist';

interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export async function extractPDFText(file: File): Promise<ExtractedPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: ExtractedPage[] = [];

  try {
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();

      const text = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');

      pages.push({ pageNumber: i, text });
    }
  } finally {
    pdfDoc.destroy();
  }

  return pages;
}
```

### Anti-Patterns

```typescript
// ANTI-PATTERN: Loading PDF.js worker from CDN in production
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.example.com/pdf.worker.js';
// Security risk + reliability issue

// ANTI-PATTERN: Not destroying PDF document after use
const loadPDF = async (file: File) => {
  const doc = await pdfjsLib.getDocument(file).promise;
  // Missing: doc.destroy() - memory leak!
  return doc;
};

// ANTI-PATTERN: Rendering all pages at once
const renderAllPages = async (doc: PDFDocumentProxy) => {
  // For a 100-page document, this creates 100 canvases!
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const canvas = document.createElement('canvas');
    // ...
  }
};

// ANTI-PATTERN: Loading entire PDF into base64
const previewPDF = async (file: File) => {
  const reader = new FileReader();
  reader.readAsDataURL(file); // Huge memory usage for large PDFs
};
```

### When to Use

| Scenario | Recommendation |
|----------|----------------|
| PDF preview/thumbnail | PDF.js with page-by-page rendering |
| PDF form filling | PDF.js for display, server for processing |
| PDF text search | Extract text on upload, index server-side |
| PDF generation | Server-side only (puppeteer, pdfkit) |
| Simple PDF download link | No preview needed - just download link |

---

## 5. File Validation Patterns

### Core Patterns

#### Comprehensive File Validator

```typescript
// file-validator.ts
interface ValidationRule {
  validate: (file: File) => Promise<boolean> | boolean;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface FileValidatorOptions {
  maxSizeBytes?: number;
  minSizeBytes?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
  validateContent?: boolean;
  customRules?: ValidationRule[];
}

const BYTES_PER_MB = 1024 * 1024;

// Magic numbers for file type detection
const FILE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // + WEBP at offset 8
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'application/zip': [[0x50, 0x4b, 0x03, 0x04]],
};

export class FileValidator {
  private rules: ValidationRule[] = [];

  constructor(options: FileValidatorOptions = {}) {
    this.buildRules(options);
  }

  private buildRules(options: FileValidatorOptions): void {
    const {
      maxSizeBytes,
      minSizeBytes,
      allowedTypes,
      allowedExtensions,
      validateContent = false,
      customRules = [],
    } = options;

    // Size validation
    if (maxSizeBytes !== undefined) {
      this.rules.push({
        validate: (file) => file.size <= maxSizeBytes,
        message: `File must be smaller than ${maxSizeBytes / BYTES_PER_MB}MB`,
      });
    }

    if (minSizeBytes !== undefined) {
      this.rules.push({
        validate: (file) => file.size >= minSizeBytes,
        message: `File must be at least ${minSizeBytes} bytes`,
      });
    }

    // MIME type validation
    if (allowedTypes?.length) {
      this.rules.push({
        validate: (file) => {
          return allowedTypes.some((type) => {
            if (type.endsWith('/*')) {
              return file.type.startsWith(type.replace('/*', '/'));
            }
            return file.type === type;
          });
        },
        message: `File type must be one of: ${allowedTypes.join(', ')}`,
      });
    }

    // Extension validation
    if (allowedExtensions?.length) {
      this.rules.push({
        validate: (file) => {
          const ext = '.' + file.name.split('.').pop()?.toLowerCase();
          return allowedExtensions.includes(ext);
        },
        message: `File extension must be one of: ${allowedExtensions.join(', ')}`,
      });
    }

    // Content validation (magic bytes)
    if (validateContent && allowedTypes?.length) {
      this.rules.push({
        validate: async (file) => {
          const actualType = await detectFileType(file);
          return actualType !== null && allowedTypes.includes(actualType);
        },
        message: 'File content does not match declared type',
      });
    }

    // Custom rules
    this.rules.push(...customRules);
  }

  async validate(file: File): Promise<ValidationResult> {
    const errors: string[] = [];

    for (const rule of this.rules) {
      const isValid = await rule.validate(file);
      if (!isValid) {
        errors.push(rule.message);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async validateMany(files: File[]): Promise<Map<File, ValidationResult>> {
    const results = new Map<File, ValidationResult>();

    for (const file of files) {
      results.set(file, await this.validate(file));
    }

    return results;
  }
}

async function detectFileType(file: File): Promise<string | null> {
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  for (const [mimeType, signatures] of Object.entries(FILE_SIGNATURES)) {
    for (const signature of signatures) {
      if (signature.every((byte, index) => bytes[index] === byte)) {
        return mimeType;
      }
    }
  }

  return null;
}
```

#### Image-Specific Validator

```typescript
// image-validator.ts
interface ImageValidationOptions {
  maxWidth?: number;
  maxHeight?: number;
  minWidth?: number;
  minHeight?: number;
  aspectRatio?: { width: number; height: number; tolerance?: number };
  maxSizeBytes?: number;
}

interface ImageValidationResult {
  valid: boolean;
  errors: string[];
  dimensions?: { width: number; height: number };
}

const DEFAULT_ASPECT_RATIO_TOLERANCE = 0.01;

export async function validateImage(
  file: File,
  options: ImageValidationOptions = {}
): Promise<ImageValidationResult> {
  const errors: string[] = [];

  // Basic file validation
  if (!file.type.startsWith('image/')) {
    return { valid: false, errors: ['File is not an image'] };
  }

  if (options.maxSizeBytes && file.size > options.maxSizeBytes) {
    errors.push(`Image must be smaller than ${options.maxSizeBytes / BYTES_PER_MB}MB`);
  }

  // Load image to get dimensions
  const dimensions = await getImageDimensions(file);

  if (!dimensions) {
    return { valid: false, errors: ['Failed to load image'] };
  }

  // Dimension validation
  if (options.maxWidth && dimensions.width > options.maxWidth) {
    errors.push(`Image width must not exceed ${options.maxWidth}px`);
  }

  if (options.maxHeight && dimensions.height > options.maxHeight) {
    errors.push(`Image height must not exceed ${options.maxHeight}px`);
  }

  if (options.minWidth && dimensions.width < options.minWidth) {
    errors.push(`Image width must be at least ${options.minWidth}px`);
  }

  if (options.minHeight && dimensions.height < options.minHeight) {
    errors.push(`Image height must be at least ${options.minHeight}px`);
  }

  // Aspect ratio validation
  if (options.aspectRatio) {
    const expectedRatio = options.aspectRatio.width / options.aspectRatio.height;
    const actualRatio = dimensions.width / dimensions.height;
    const tolerance = options.aspectRatio.tolerance ?? DEFAULT_ASPECT_RATIO_TOLERANCE;

    if (Math.abs(actualRatio - expectedRatio) > tolerance) {
      errors.push(
        `Image aspect ratio must be ${options.aspectRatio.width}:${options.aspectRatio.height}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    dimensions,
  };
}

async function getImageDimensions(
  file: File
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}
```

### Anti-Patterns

```typescript
// ANTI-PATTERN: Trusting file extension only
const isValidImage = (file: File) => {
  return file.name.match(/\.(jpg|png|gif)$/i); // Can be spoofed!
};

// ANTI-PATTERN: Trusting MIME type only
const isValidPDF = (file: File) => {
  return file.type === 'application/pdf'; // Can be spoofed!
};

// ANTI-PATTERN: Validating only on client
const uploadFile = async (file: File) => {
  if (isValidImage(file)) {
    await fetch('/upload', { body: file });
  }
  // Server must ALSO validate!
};

// ANTI-PATTERN: Blocking validation for large files
const validateContent = async (file: File) => {
  const content = await file.text(); // Reads entire file into memory!
  return content.startsWith('%PDF');
};
```

### When to Use

| Validation Type | When to Use |
|-----------------|-------------|
| Extension only | Never alone - always combine with others |
| MIME type | Quick client-side feedback |
| Magic bytes | Security-critical uploads |
| Image dimensions | Profile photos, specific size requirements |
| Full server-side | Always - client validation is UX only |

---

## 6. Progress Indicators

### Core Patterns

#### Upload Progress Hook

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

  const calculateSpeed = useCallback((loaded: number, time: number): number => {
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

    // Return average speed
    const sum = speedSamplesRef.current.reduce((a, b) => a + b, 0);
    return sum / speedSamplesRef.current.length || 0;
  }, []);

  const upload = useCallback(
    (file: File, url: string): Promise<Response> => {
      return new Promise((resolve, reject) => {
        setUploading(true);
        setError(null);
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
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(new Response(xhr.response, { status: xhr.status }));
          } else {
            const error = new Error(`Upload failed: ${xhr.status}`);
            setError(error.message);
            reject(error);
          }
        });

        xhr.addEventListener('error', () => {
          setUploading(false);
          const error = new Error('Upload failed');
          setError(error.message);
          reject(error);
        });

        xhr.addEventListener('abort', () => {
          setUploading(false);
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

#### Progress Bar Component

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
      aria-label={displayLabel}
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

#### Speed and Time Formatter

```typescript
// format-progress.ts
const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * 1024;
const BYTES_PER_GB = BYTES_PER_MB * 1024;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * 60;

export function formatBytes(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_MB) return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  if (bytes < BYTES_PER_GB) return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
  return `${(bytes / BYTES_PER_GB).toFixed(2)} GB`;
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatRemainingTime(seconds: number): string {
  if (seconds < SECONDS_PER_MINUTE) {
    return `${Math.ceil(seconds)}s remaining`;
  }
  if (seconds < SECONDS_PER_HOUR) {
    const minutes = Math.ceil(seconds / SECONDS_PER_MINUTE);
    return `${minutes}m remaining`;
  }
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.ceil((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  return `${hours}h ${minutes}m remaining`;
}

export function formatProgress(loaded: number, total: number): string {
  return `${formatBytes(loaded)} / ${formatBytes(total)}`;
}
```

### Anti-Patterns

```typescript
// ANTI-PATTERN: Fake progress (no real tracking)
const [progress, setProgress] = useState(0);
useEffect(() => {
  const interval = setInterval(() => {
    setProgress((p) => Math.min(90, p + 10)); // Fake progress!
  }, 500);
}, []);

// ANTI-PATTERN: No aria attributes
<div className="progress-bar">
  <div style={{ width: `${progress}%` }} /> {/* Not accessible */}
</div>

// ANTI-PATTERN: Progress updates too frequently
xhr.upload.onprogress = (e) => {
  setProgress(e.loaded / e.total); // May fire 100+ times per second
};

// ANTI-PATTERN: No speed smoothing
const speed = (loaded - lastLoaded) / (time - lastTime);
// Single sample = jumpy speed display
```

### When to Use

| Upload Size | Progress Indicator |
|-------------|-------------------|
| < 1MB | Simple spinner |
| 1-10MB | Progress bar |
| 10MB+ | Progress bar + speed + ETA |
| Background uploads | Toast notification with progress |

---

## 7. S3/Cloud Storage Integration Patterns

### Core Patterns

#### Direct-to-S3 Upload (Client)

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
  options: S3UploadOptions = {}
): Promise<string> {
  const { url, fields } = credentials;

  const formData = new FormData();

  // Add presigned fields first (order matters for S3)
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });

  // File must be last
  formData.append('file', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (options.abortSignal) {
      options.abortSignal.addEventListener('abort', () => xhr.abort());
    }

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Construct the final URL
        const fileUrl = `${url}${fields.key}`;
        resolve(fileUrl);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.open('POST', url);
    xhr.send(formData);
  });
}
```

#### Presigned URL Generator (Server - Hono)

```typescript
// routes/upload.ts (Hono backend)
import { Hono } from 'hono';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const PRESIGNED_URL_EXPIRY_SECONDS = 3600;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const presignRequestSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().max(MAX_FILE_SIZE_BYTES),
});

const app = new Hono();

app.post(
  '/api/upload/presign',
  zValidator('json', presignRequestSchema),
  async (c) => {
    const { fileName, fileType, fileSize } = c.req.valid('json');
    const userId = c.get('userId'); // From auth middleware

    // Generate unique key
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `uploads/${userId}/${timestamp}-${sanitizedName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      ContentType: fileType,
      ContentLength: fileSize,
      // Optional: Add metadata
      Metadata: {
        'original-name': fileName,
        'uploaded-by': userId,
      },
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
    });

    return c.json({
      uploadUrl: presignedUrl,
      key,
      expiresAt: new Date(Date.now() + PRESIGNED_URL_EXPIRY_SECONDS * 1000).toISOString(),
    });
  }
);

export { app as uploadRoutes };
```

#### Multipart Upload for Large Files (Server)

```typescript
// multipart-upload.ts
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const PART_EXPIRY_SECONDS = 3600;

interface MultipartUploadInit {
  uploadId: string;
  key: string;
  parts: Array<{
    partNumber: number;
    uploadUrl: string;
  }>;
}

export async function initializeMultipartUpload(
  s3Client: S3Client,
  bucket: string,
  key: string,
  fileSize: number,
  partSizeBytes: number
): Promise<MultipartUploadInit> {
  // Create multipart upload
  const createCommand = new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
  });

  const { UploadId } = await s3Client.send(createCommand);

  if (!UploadId) {
    throw new Error('Failed to create multipart upload');
  }

  // Generate presigned URLs for each part
  const totalParts = Math.ceil(fileSize / partSizeBytes);
  const parts: MultipartUploadInit['parts'] = [];

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
  parts: Array<{ partNumber: number; etag: string }>
): Promise<string> {
  const command = new CompleteMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts.map(({ partNumber, etag }) => ({
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
  uploadId: string
): Promise<void> {
  const command = new AbortMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
  });

  await s3Client.send(command);
}
```

### Anti-Patterns

```typescript
// ANTI-PATTERN: Exposing AWS credentials to client
const s3 = new S3Client({
  credentials: {
    accessKeyId: 'AKIAXXXXXXXX', // Never in client code!
    secretAccessKey: 'xxxxx',
  },
});

// ANTI-PATTERN: Proxy uploads through server
app.post('/upload', async (c) => {
  const file = await c.req.blob();
  await s3Client.send(new PutObjectCommand({ Body: file }));
  // Server becomes bottleneck + pays for bandwidth twice
});

// ANTI-PATTERN: No expiration on presigned URLs
const url = await getSignedUrl(s3Client, command, {
  expiresIn: 86400 * 365, // 1 year - security risk!
});

// ANTI-PATTERN: Predictable S3 keys
const key = `uploads/${fileName}`; // Easy to guess/overwrite
```

### When to Use

| Scenario | Pattern |
|----------|---------|
| Files < 5MB | Single presigned PUT URL |
| Files 5MB - 5GB | Multipart upload with presigned URLs |
| Files > 5GB | Multipart upload is required |
| Private files | Presigned GET URLs for access |
| Public files | CloudFront distribution |

---

## 8. Presigned URL Patterns

### Core Patterns

#### Presigned URL Service

```typescript
// presigned-url-service.ts
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface PresignedUrlOptions {
  expiresIn?: number;
  contentType?: string;
  contentDisposition?: 'inline' | 'attachment';
  fileName?: string;
}

const DEFAULT_UPLOAD_EXPIRY = 3600; // 1 hour
const DEFAULT_DOWNLOAD_EXPIRY = 900; // 15 minutes

export class PresignedUrlService {
  constructor(
    private s3Client: S3Client,
    private bucket: string
  ) {}

  async getUploadUrl(
    key: string,
    options: PresignedUrlOptions = {}
  ): Promise<{ url: string; expiresAt: Date }> {
    const expiresIn = options.expiresIn ?? DEFAULT_UPLOAD_EXPIRY;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: options.contentType,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn });

    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async getDownloadUrl(
    key: string,
    options: PresignedUrlOptions = {}
  ): Promise<{ url: string; expiresAt: Date }> {
    const expiresIn = options.expiresIn ?? DEFAULT_DOWNLOAD_EXPIRY;

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: options.contentDisposition === 'attachment'
        ? `attachment; filename="${options.fileName ?? key.split('/').pop()}"`
        : undefined,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn });

    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  // For POST uploads (supports more features like file size limits)
  async getPostPolicy(
    keyPrefix: string,
    options: {
      maxSizeBytes?: number;
      expiresIn?: number;
      contentType?: string;
    } = {}
  ): Promise<{
    url: string;
    fields: Record<string, string>;
  }> {
    const { createPresignedPost } = await import('@aws-sdk/s3-presigned-post');

    const { url, fields } = await createPresignedPost(this.s3Client, {
      Bucket: this.bucket,
      Key: `${keyPrefix}/\${filename}`,
      Conditions: [
        ['content-length-range', 0, options.maxSizeBytes ?? 10 * 1024 * 1024],
        ['starts-with', '$Content-Type', options.contentType ?? ''],
      ],
      Expires: options.expiresIn ?? DEFAULT_UPLOAD_EXPIRY,
    });

    return { url, fields };
  }
}
```

#### URL Refresh Strategy

```typescript
// use-refreshing-url.ts
import { useState, useEffect, useCallback } from 'react';

interface RefreshingUrlOptions {
  refreshThresholdMs?: number;
  onRefresh?: (newUrl: string) => void;
  onError?: (error: Error) => void;
}

const DEFAULT_REFRESH_THRESHOLD_MS = 60000; // Refresh 1 minute before expiry

export function useRefreshingUrl(
  key: string,
  getUrl: (key: string) => Promise<{ url: string; expiresAt: Date }>,
  options: RefreshingUrlOptions = {}
) {
  const { refreshThresholdMs = DEFAULT_REFRESH_THRESHOLD_MS } = options;

  const [url, setUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getUrl(key);
      setUrl(result.url);
      setExpiresAt(result.expiresAt);
      setError(null);
      options.onRefresh?.(result.url);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get URL');
      setError(error);
      options.onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [key, getUrl, options]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!expiresAt) return;

    const timeUntilRefresh = expiresAt.getTime() - Date.now() - refreshThresholdMs;

    if (timeUntilRefresh <= 0) {
      refresh();
      return;
    }

    const timeout = setTimeout(refresh, timeUntilRefresh);
    return () => clearTimeout(timeout);
  }, [expiresAt, refreshThresholdMs, refresh]);

  return { url, loading, error, refresh, expiresAt };
}
```

### Anti-Patterns

```typescript
// ANTI-PATTERN: Caching presigned URLs too long
const urlCache = new Map<string, string>();
const getUrl = async (key: string) => {
  if (urlCache.has(key)) return urlCache.get(key)!; // May be expired!
  // ...
};

// ANTI-PATTERN: Not tracking expiration
const url = await getPresignedUrl(key);
return url; // Client has no idea when this expires

// ANTI-PATTERN: Very short expiration for downloads
const url = await getSignedUrl(command, { expiresIn: 30 });
// User can't even finish downloading!

// ANTI-PATTERN: No content-type restrictions
const url = await getPresignedPutUrl(key);
// Any file type can be uploaded
```

### When to Use

| Scenario | Expiration Time |
|----------|-----------------|
| Upload URL | 15-60 minutes |
| Download (streaming) | 1-4 hours |
| Download (share link) | 24 hours max |
| Image preview | 15 minutes (with refresh) |

---

## 9. File Type Detection

### Core Patterns

#### Magic Byte Detection

```typescript
// file-type-detection.ts
interface FileSignature {
  mime: string;
  extension: string;
  signature: number[];
  offset?: number;
}

const FILE_SIGNATURES: FileSignature[] = [
  // Images
  { mime: 'image/jpeg', extension: 'jpg', signature: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', extension: 'png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/gif', extension: 'gif', signature: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', extension: 'webp', signature: [0x52, 0x49, 0x46, 0x46] },
  { mime: 'image/bmp', extension: 'bmp', signature: [0x42, 0x4d] },
  { mime: 'image/tiff', extension: 'tiff', signature: [0x49, 0x49, 0x2a, 0x00] },
  { mime: 'image/tiff', extension: 'tiff', signature: [0x4d, 0x4d, 0x00, 0x2a] },
  { mime: 'image/x-icon', extension: 'ico', signature: [0x00, 0x00, 0x01, 0x00] },
  { mime: 'image/svg+xml', extension: 'svg', signature: [0x3c, 0x73, 0x76, 0x67] }, // <svg

  // Documents
  { mime: 'application/pdf', extension: 'pdf', signature: [0x25, 0x50, 0x44, 0x46] }, // %PDF

  // Archives
  { mime: 'application/zip', extension: 'zip', signature: [0x50, 0x4b, 0x03, 0x04] },
  { mime: 'application/gzip', extension: 'gz', signature: [0x1f, 0x8b] },
  { mime: 'application/x-rar-compressed', extension: 'rar', signature: [0x52, 0x61, 0x72, 0x21] },
  { mime: 'application/x-7z-compressed', extension: '7z', signature: [0x37, 0x7a, 0xbc, 0xaf] },

  // Audio
  { mime: 'audio/mpeg', extension: 'mp3', signature: [0x49, 0x44, 0x33] }, // ID3
  { mime: 'audio/mpeg', extension: 'mp3', signature: [0xff, 0xfb] },
  { mime: 'audio/wav', extension: 'wav', signature: [0x52, 0x49, 0x46, 0x46] },
  { mime: 'audio/ogg', extension: 'ogg', signature: [0x4f, 0x67, 0x67, 0x53] },

  // Video
  { mime: 'video/mp4', extension: 'mp4', signature: [0x00, 0x00, 0x00], offset: 0 },
  { mime: 'video/webm', extension: 'webm', signature: [0x1a, 0x45, 0xdf, 0xa3] },

  // Office documents (OOXML)
  { mime: 'application/vnd.openxmlformats-officedocument', extension: 'docx', signature: [0x50, 0x4b, 0x03, 0x04] },
];

interface DetectionResult {
  mime: string;
  extension: string;
  confidence: 'high' | 'medium' | 'low';
}

export async function detectFileType(file: File): Promise<DetectionResult | null> {
  const HEADER_SIZE = 12;
  const buffer = await file.slice(0, HEADER_SIZE).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  for (const sig of FILE_SIGNATURES) {
    const offset = sig.offset ?? 0;
    const matches = sig.signature.every(
      (byte, index) => bytes[offset + index] === byte
    );

    if (matches) {
      // Additional validation for ambiguous signatures
      if (sig.signature[0] === 0x50 && sig.signature[1] === 0x4b) {
        // ZIP-based format - need deeper inspection
        const detailedType = await detectZipBasedFormat(file);
        if (detailedType) return detailedType;
      }

      return {
        mime: sig.mime,
        extension: sig.extension,
        confidence: sig.signature.length >= 4 ? 'high' : 'medium',
      };
    }
  }

  // Fallback to extension-based detection
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext) {
    return {
      mime: file.type || 'application/octet-stream',
      extension: ext,
      confidence: 'low',
    };
  }

  return null;
}

async function detectZipBasedFormat(file: File): Promise<DetectionResult | null> {
  // Read more of the file to check internal structure
  const buffer = await file.slice(0, 1000).arrayBuffer();
  const text = new TextDecoder().decode(buffer);

  if (text.includes('word/')) {
    return { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx', confidence: 'high' };
  }
  if (text.includes('xl/')) {
    return { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx', confidence: 'high' };
  }
  if (text.includes('ppt/')) {
    return { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', extension: 'pptx', confidence: 'high' };
  }

  return { mime: 'application/zip', extension: 'zip', confidence: 'high' };
}
```

#### Validation with Type Detection

```typescript
// validated-file-type.ts
interface TypeValidationResult {
  valid: boolean;
  declaredType: string;
  actualType: string | null;
  mismatch: boolean;
  error?: string;
}

export async function validateFileType(
  file: File,
  allowedTypes: string[]
): Promise<TypeValidationResult> {
  const detected = await detectFileType(file);

  const result: TypeValidationResult = {
    valid: false,
    declaredType: file.type,
    actualType: detected?.mime ?? null,
    mismatch: false,
  };

  // Check if declared type is allowed
  const declaredAllowed = allowedTypes.some((type) => {
    if (type.endsWith('/*')) {
      return file.type.startsWith(type.replace('/*', '/'));
    }
    return file.type === type;
  });

  if (!declaredAllowed) {
    result.error = `File type ${file.type} is not allowed`;
    return result;
  }

  // Check if actual type matches declared
  if (detected) {
    const actualAllowed = allowedTypes.some((type) => {
      if (type.endsWith('/*')) {
        return detected.mime.startsWith(type.replace('/*', '/'));
      }
      return detected.mime === type;
    });

    result.mismatch = !actualAllowed || detected.mime !== file.type;

    if (!actualAllowed) {
      result.error = `File content (${detected.mime}) does not match allowed types`;
      return result;
    }
  }

  result.valid = true;
  return result;
}
```

### Anti-Patterns

```typescript
// ANTI-PATTERN: Only checking extension
const isImage = (file: File) => /\.(jpg|png|gif)$/i.test(file.name);
// malware.exe renamed to photo.jpg passes!

// ANTI-PATTERN: Only checking MIME type
const isImage = (file: File) => file.type.startsWith('image/');
// MIME type is user-controlled and can be spoofed

// ANTI-PATTERN: Not handling detection failure
const type = await detectFileType(file);
doSomething(type.mime); // May be null!

// ANTI-PATTERN: Trusting client detection on server
app.post('/upload', async (c) => {
  const { detectedType } = await c.req.json();
  // Server must re-detect, not trust client!
});
```

### When to Use

| Security Level | Detection Method |
|----------------|-----------------|
| Low (user content) | Extension + MIME type |
| Medium (internal) | Magic bytes |
| High (security-critical) | Magic bytes + deep inspection on server |

---

## 10. Accessibility in File Uploads

### Core Patterns

#### Accessible File Input

```typescript
// accessible-file-input.tsx
import { useId, useRef, forwardRef, useImperativeHandle } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import styles from './accessible-file-input.module.scss';

interface AccessibleFileInputProps {
  label: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  hint?: string;
  onFilesSelected: (files: File[]) => void;
  className?: string;
}

export interface AccessibleFileInputHandle {
  focus: () => void;
  click: () => void;
}

export const AccessibleFileInput = forwardRef<
  AccessibleFileInputHandle,
  AccessibleFileInputProps
>(function AccessibleFileInput(
  {
    label,
    accept,
    multiple = false,
    disabled = false,
    required = false,
    error,
    hint,
    onFilesSelected,
    className,
  },
  ref
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    click: () => inputRef.current?.click(),
  }));

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onFilesSelected(Array.from(files));
    }
    // Reset to allow selecting same file
    event.target.value = '';
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  const describedBy = [
    hint ? hintId : null,
    error ? errorId : null,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>

      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}

      <div
        className={styles.inputWrapper}
        data-disabled={disabled || undefined}
        data-error={error ? true : undefined}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onClick={() => inputRef.current?.click()}
        aria-label={`${label}. ${multiple ? 'Multiple files allowed.' : ''} Press Enter or Space to browse.`}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          required={required}
          onChange={handleChange}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={styles.hiddenInput}
          tabIndex={-1}
        />
        <span className={styles.buttonText}>
          Choose {multiple ? 'files' : 'file'}
        </span>
      </div>

      {error && (
        <p id={errorId} className={styles.error} role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
});
```

#### Accessible Dropzone

```typescript
// accessible-dropzone.tsx
import { useState, useRef, useCallback, useId } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import styles from './accessible-dropzone.module.scss';

interface AccessibleDropzoneProps {
  label: string;
  description?: string;
  accept?: string[];
  multiple?: boolean;
  disabled?: boolean;
  maxFiles?: number;
  onFilesSelected: (files: File[]) => void;
  children?: React.ReactNode;
}

type DropzoneState = 'idle' | 'drag-over' | 'drag-reject';

export function AccessibleDropzone({
  label,
  description,
  accept = [],
  multiple = true,
  disabled = false,
  maxFiles = 10,
  onFilesSelected,
  children,
}: AccessibleDropzoneProps) {
  const [state, setState] = useState<DropzoneState>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const descriptionId = `${id}-description`;

  const announceRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string) => {
    if (announceRef.current) {
      announceRef.current.textContent = message;
    }
  }, []);

  const isValidType = useCallback((file: File): boolean => {
    if (accept.length === 0) return true;
    return accept.some((type) => {
      if (type.startsWith('.')) {
        return file.name.toLowerCase().endsWith(type.toLowerCase());
      }
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.replace('/*', '/'));
      }
      return file.type === type;
    });
  }, [accept]);

  const handleFiles = useCallback((files: File[]) => {
    const validFiles = files.filter(isValidType);
    const filesToProcess = multiple
      ? validFiles.slice(0, maxFiles)
      : validFiles.slice(0, 1);

    if (filesToProcess.length > 0) {
      onFilesSelected(filesToProcess);
      announce(
        `${filesToProcess.length} ${filesToProcess.length === 1 ? 'file' : 'files'} selected: ${filesToProcess.map((f) => f.name).join(', ')}`
      );
    } else if (files.length > 0) {
      announce('No valid files selected. Please check file type requirements.');
    }
  }, [isValidType, multiple, maxFiles, onFilesSelected, announce]);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setState('idle');

    if (disabled) return;

    const files = Array.from(event.dataTransfer.files);
    handleFiles(files);
  }, [disabled, handleFiles]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) {
      setState('drag-over');
    }
  }, [disabled]);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setState('idle');
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      inputRef.current?.click();
    }
  }, [disabled]);

  const acceptString = accept.join(',');
  const acceptDescription = accept.length > 0
    ? `Accepted file types: ${accept.join(', ')}`
    : 'All file types accepted';

  return (
    <>
      {/* Live region for announcements */}
      <div
        ref={announceRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={styles.srOnly}
      />

      <div
        className={styles.dropzone}
        data-state={state}
        data-disabled={disabled || undefined}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        aria-label={`${label}. ${acceptDescription}. ${multiple ? `Up to ${maxFiles} files allowed.` : 'Single file only.'} Click or press Enter to browse files, or drag and drop files here.`}
        aria-describedby={description ? descriptionId : undefined}
        aria-disabled={disabled}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptString}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files) {
              handleFiles(Array.from(e.target.files));
              e.target.value = '';
            }
          }}
          className={styles.hiddenInput}
          tabIndex={-1}
          aria-hidden="true"
        />

        {children ?? (
          <div className={styles.content}>
            <p className={styles.label}>{label}</p>
            {description && (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            )}
            <p className={styles.hint}>
              Drag and drop or click to browse
            </p>
          </div>
        )}
      </div>
    </>
  );
}
```

#### Accessible File List

```typescript
// accessible-file-list.tsx
import { useId } from 'react';
import styles from './accessible-file-list.module.scss';

interface FileItem {
  id: string;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
}

interface AccessibleFileListProps {
  files: FileItem[];
  onRemove: (id: string) => void;
  label?: string;
}

export function AccessibleFileList({
  files,
  onRemove,
  label = 'Selected files',
}: AccessibleFileListProps) {
  const listId = useId();

  if (files.length === 0) {
    return null;
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusLabel = (file: FileItem): string => {
    switch (file.status) {
      case 'pending':
        return 'Waiting to upload';
      case 'uploading':
        return `Uploading: ${file.progress ?? 0}% complete`;
      case 'success':
        return 'Upload complete';
      case 'error':
        return `Upload failed: ${file.error ?? 'Unknown error'}`;
    }
  };

  return (
    <div className={styles.container}>
      <h3 id={listId} className={styles.heading}>
        {label} ({files.length})
      </h3>

      <ul
        className={styles.list}
        aria-labelledby={listId}
        role="list"
      >
        {files.map((file) => (
          <li
            key={file.id}
            className={styles.item}
            data-status={file.status}
          >
            <div className={styles.info}>
              <span className={styles.name}>{file.name}</span>
              <span className={styles.size}>{formatSize(file.size)}</span>
            </div>

            <div
              className={styles.status}
              role="status"
              aria-live="polite"
            >
              {file.status === 'uploading' && file.progress !== undefined && (
                <div
                  className={styles.progressBar}
                  role="progressbar"
                  aria-valuenow={file.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${file.name} upload progress`}
                >
                  <div
                    className={styles.progressFill}
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              )}
              <span className={styles.statusText}>
                {getStatusLabel(file)}
              </span>
            </div>

            <button
              type="button"
              className={styles.removeButton}
              onClick={() => onRemove(file.id)}
              aria-label={`Remove ${file.name} from upload list`}
              disabled={file.status === 'uploading'}
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Anti-Patterns

```typescript
// ANTI-PATTERN: No keyboard support
<div onClick={openFileDialog} className="dropzone">
  {/* Can't be activated with keyboard! */}
</div>

// ANTI-PATTERN: Missing labels
<input type="file" onChange={handleFile} />
{/* Screen readers can't describe this */}

// ANTI-PATTERN: Visual-only status
<div className={uploading ? 'spinner' : 'done'} />
{/* No announcement for screen readers */}

// ANTI-PATTERN: Drag-drop only
<div onDrop={handleDrop}>Drop files here</div>
{/* No alternative for keyboard/screen reader users */}

// ANTI-PATTERN: Color-only error indication
<div style={{ borderColor: error ? 'red' : 'gray' }}>
  {/* Color blind users can't see the error */}
</div>

// ANTI-PATTERN: Auto-removing files without warning
const handleUpload = async (file: File) => {
  await upload(file);
  removeFromList(file); // User doesn't know what happened
};
```

### Accessibility Checklist

| Requirement | Implementation |
|-------------|----------------|
| Keyboard navigation | `tabIndex={0}`, Enter/Space activation |
| Focus visible | `:focus-visible` styles |
| Labels | `<label>` or `aria-label` |
| Error announcements | `role="alert"` + `aria-live="polite"` |
| Progress announcements | `role="progressbar"` + `aria-valuenow` |
| Status updates | `role="status"` + `aria-live` |
| Required indication | Visual + `aria-required` |
| Disabled state | Visual + `aria-disabled` |

---

## Summary Decision Matrix

| Feature | Small Files (<5MB) | Medium (5-50MB) | Large (>50MB) |
|---------|-------------------|-----------------|---------------|
| Upload Method | Single request | Chunked | Chunked + resumable |
| Progress | Spinner | Progress bar | Progress + ETA |
| Preview | Object URL | Object URL + resize | Thumbnail only |
| Validation | Client + server | Client + server | Client + server |
| Storage | Direct upload | Presigned URL | Multipart presigned |

## Key Takeaways

1. **Never trust client-side validation alone** - Always validate on server
2. **Always cleanup object URLs** - Prevent memory leaks
3. **Use chunked uploads for reliability** - Not just for large files
4. **Implement proper accessibility from the start** - It's harder to retrofit
5. **Use presigned URLs for direct-to-S3** - Avoid proxying through server
6. **Detect file types by content** - Extensions and MIME types can be spoofed
7. **Provide meaningful progress feedback** - Users need to know what's happening
8. **Handle EXIF orientation** - Mobile photos often need rotation
9. **Use Web Workers for heavy processing** - Keep UI responsive
10. **Plan for failure** - Network issues, aborts, and retries are normal
