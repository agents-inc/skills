# Frontend Image Handling Best Practices Research

> **Research Date:** January 2026
> **Focus:** Client-side image preview, compression, cropping, and upload patterns for React/TypeScript

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Image Preview Patterns](#image-preview-patterns)
3. [Client-Side Compression](#client-side-compression)
4. [Canvas API Patterns](#canvas-api-patterns)
5. [EXIF Orientation Handling](#exif-orientation-handling)
6. [Drag and Drop Uploads](#drag-and-drop-uploads)
7. [Image Cropping](#image-cropping)
8. [Modern Format Conversion](#modern-format-conversion)
9. [Progressive Loading](#progressive-loading)
10. [Accessibility Requirements](#accessibility-requirements)
11. [Library Recommendations](#library-recommendations)
12. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
13. [Performance Considerations](#performance-considerations)

---

## Core Concepts

### The Image Upload Pipeline

```
User Selection → Preview → Validate → Process → Upload
     │              │          │         │         │
     ▼              ▼          ▼         ▼         ▼
  File Input   createObjectURL  Type    Resize   FormData
  or D&D       or FileReader   Size    Compress    POST
                               EXIF     Crop
```

### Key Browser APIs

| API | Purpose | Browser Support |
|-----|---------|-----------------|
| `URL.createObjectURL()` | Create temporary URLs for files | Universal |
| `FileReader` | Read file contents (Base64, ArrayBuffer) | Universal |
| `Canvas API` | Image manipulation (resize, crop, compress) | Universal |
| `OffscreenCanvas` | Non-blocking canvas operations | Modern browsers |
| `createImageBitmap()` | Efficient image decoding | Modern browsers |
| `File System Access API` | Native file picker dialogs | Chrome/Edge |

---

## Image Preview Patterns

### Pattern 1: URL.createObjectURL (Recommended)

The most efficient method for displaying image previews. Creates a temporary URL without reading the entire file into memory.

```typescript
import { useState, useEffect, useCallback, type ChangeEvent } from 'react';

interface ImagePreviewState {
  file: File | null;
  previewUrl: string | null;
}

function useImagePreview() {
  const [state, setState] = useState<ImagePreviewState>({
    file: null,
    previewUrl: null,
  });

  // Cleanup: Revoke URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (state.previewUrl) {
        URL.revokeObjectURL(state.previewUrl);
      }
    };
  }, [state.previewUrl]);

  const handleFileSelect = useCallback((file: File | null) => {
    // Revoke previous URL if exists
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }

    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setState({ file, previewUrl });
    } else {
      setState({ file: null, previewUrl: null });
    }
  }, [state.previewUrl]);

  const clearPreview = useCallback(() => {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }
    setState({ file: null, previewUrl: null });
  }, [state.previewUrl]);

  return {
    file: state.file,
    previewUrl: state.previewUrl,
    handleFileSelect,
    clearPreview,
  };
}

// Usage in component
function ImageUploader() {
  const { previewUrl, handleFileSelect, clearPreview } = useImagePreview();

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    handleFileSelect(file);
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={onFileChange}
        aria-label="Select image to upload"
      />
      {previewUrl && (
        <div>
          <img src={previewUrl} alt="Preview of selected image" />
          <button type="button" onClick={clearPreview}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
```

**Why good:** Fast, memory-efficient (no Base64 encoding overhead), automatic cleanup with `revokeObjectURL`

### Pattern 2: FileReader for Base64 (When Needed)

Use when you need the actual Base64 data (e.g., for API payloads or localStorage).

```typescript
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };

    reader.onerror = () => {
      reject(new Error('FileReader error'));
    };

    reader.readAsDataURL(file);
  });
}

// Hook with abort controller for cleanup
function useFileReaderPreview() {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const readFile = useCallback(async (file: File) => {
    // Abort any previous read
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const result = await readFileAsDataURL(file);

      // Check if aborted before updating state
      if (!abortControllerRef.current.signal.aborted) {
        setDataUrl(result);
      }
    } catch (err) {
      if (!abortControllerRef.current?.signal.aborted) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return { dataUrl, isLoading, error, readFile };
}
```

### Pattern 3: Multiple Image Preview

```typescript
interface ImageFile {
  id: string;
  file: File;
  previewUrl: string;
}

function useMultipleImagePreview(maxFiles = 10) {
  const [images, setImages] = useState<ImageFile[]>([]);

  const addImages = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newImages: ImageFile[] = fileArray
      .slice(0, maxFiles - images.length)
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));

    setImages((prev) => [...prev, ...newImages]);
  }, [images.length, maxFiles]);

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.previewUrl);
      }
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
  }, [images]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, []); // Empty deps - only cleanup on unmount

  return { images, addImages, removeImage, clearAll };
}
```

---

## Client-Side Compression

### Using browser-image-compression

The most popular library for client-side image compression. Supports Web Workers for non-blocking operations.

```typescript
import imageCompression from 'browser-image-compression';

interface CompressionOptions {
  maxSizeMB: number;
  maxWidthOrHeight: number;
  useWebWorker: boolean;
  onProgress?: (progress: number) => void;
  preserveExif?: boolean;
  fileType?: string;
}

const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  preserveExif: false,
};

async function compressImage(
  file: File,
  options: Partial<CompressionOptions> = {}
): Promise<File> {
  const mergedOptions = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };

  console.log(`Original file size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

  const compressedFile = await imageCompression(file, mergedOptions);

  console.log(`Compressed file size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

  return compressedFile;
}

// Hook for compression with progress
function useImageCompression() {
  const [progress, setProgress] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const compress = useCallback(async (
    file: File,
    options?: Partial<CompressionOptions>
  ): Promise<File | null> => {
    setIsCompressing(true);
    setProgress(0);
    setError(null);

    try {
      const compressed = await compressImage(file, {
        ...options,
        onProgress: setProgress,
      });
      return compressed;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Compression failed'));
      return null;
    } finally {
      setIsCompressing(false);
    }
  }, []);

  return { compress, progress, isCompressing, error };
}

// Complete upload component with compression
function CompressedImageUploader() {
  const { compress, progress, isCompressing } = useImageCompression();
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Show original preview immediately
    const originalPreview = URL.createObjectURL(file);
    setPreview(originalPreview);

    // Compress in background
    const compressed = await compress(file, {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1200,
    });

    if (compressed) {
      // Update preview with compressed version
      URL.revokeObjectURL(originalPreview);
      setPreview(URL.createObjectURL(compressed));
      setCompressedFile(compressed);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={isCompressing}
        aria-busy={isCompressing}
      />

      {isCompressing && (
        <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          Compressing: {progress}%
        </div>
      )}

      {preview && (
        <img src={preview} alt="Preview" style={{ maxWidth: '300px' }} />
      )}
    </div>
  );
}
```

---

## Canvas API Patterns

### Basic Image Resize

```typescript
interface ResizeOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number; // 0-1 for JPEG/WebP
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

async function resizeImage(
  file: File,
  options: ResizeOptions
): Promise<Blob> {
  const { maxWidth, maxHeight, quality, mimeType } = options;

  // Create image element
  const img = await createImageFromFile(file);

  // Calculate new dimensions maintaining aspect ratio
  const { width, height } = calculateDimensions(
    img.width,
    img.height,
    maxWidth,
    maxHeight
  );

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Enable image smoothing for better quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw image
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      mimeType,
      quality
    );
  });
}

function createImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  // Scale down if larger than max dimensions
  if (width > maxWidth || height > maxHeight) {
    const widthRatio = maxWidth / width;
    const heightRatio = maxHeight / height;
    const ratio = Math.min(widthRatio, heightRatio);

    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  return { width, height };
}
```

### Step-Down Scaling for Better Quality

For significant size reductions, scale in steps rather than all at once:

```typescript
async function stepDownResize(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  steps = 2
): Promise<HTMLCanvasElement> {
  let currentWidth = img.width;
  let currentHeight = img.height;
  let source: HTMLImageElement | HTMLCanvasElement = img;

  // Calculate step factor
  const widthFactor = Math.pow(targetWidth / currentWidth, 1 / steps);
  const heightFactor = Math.pow(targetHeight / currentHeight, 1 / steps);

  for (let i = 0; i < steps; i++) {
    const isLastStep = i === steps - 1;

    currentWidth = isLastStep ? targetWidth : Math.round(currentWidth * widthFactor);
    currentHeight = isLastStep ? targetHeight : Math.round(currentHeight * heightFactor);

    const canvas = document.createElement('canvas');
    canvas.width = currentWidth;
    canvas.height = currentHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get context');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, currentWidth, currentHeight);

    source = canvas;
  }

  return source as HTMLCanvasElement;
}
```

### Binary Search for Target File Size

```typescript
async function compressToTargetSize(
  file: File,
  targetSizeKB: number,
  mimeType: 'image/jpeg' | 'image/webp' = 'image/jpeg'
): Promise<Blob> {
  const img = await createImageFromFile(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get context');

  ctx.drawImage(img, 0, 0);

  let minQuality = 0.1;
  let maxQuality = 1.0;
  let bestBlob: Blob | null = null;
  const targetBytes = targetSizeKB * 1024;
  const maxIterations = 10;

  for (let i = 0; i < maxIterations; i++) {
    const quality = (minQuality + maxQuality) / 2;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Blob creation failed'))),
        mimeType,
        quality
      );
    });

    if (blob.size <= targetBytes) {
      bestBlob = blob;
      minQuality = quality; // Try higher quality
    } else {
      maxQuality = quality; // Try lower quality
    }

    // Close enough (within 5%)
    if (Math.abs(blob.size - targetBytes) / targetBytes < 0.05) {
      return blob;
    }
  }

  return bestBlob ?? (await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject()),
      mimeType,
      minQuality
    );
  }));
}
```

---

## EXIF Orientation Handling

### The Problem

Photos from mobile devices often have EXIF orientation metadata. Some browsers auto-rotate, others don't, causing inconsistent display.

### Solution: Normalize Orientation Before Processing

```typescript
import { getOrientation } from 'get-orientation/browser';

type Orientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

async function normalizeImageOrientation(file: File): Promise<Blob> {
  const orientation = await getOrientation(file) as Orientation;

  // Orientation 1 is normal - no transformation needed
  if (orientation === 1) {
    return file;
  }

  const img = await createImageFromFile(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Failed to get context');

  // Swap dimensions for 90/270 degree rotations
  const needsSwap = [5, 6, 7, 8].includes(orientation);
  canvas.width = needsSwap ? img.height : img.width;
  canvas.height = needsSwap ? img.width : img.height;

  // Apply transformation based on orientation
  applyExifTransform(ctx, orientation, img.width, img.height);

  ctx.drawImage(img, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Blob creation failed'))),
      file.type || 'image/jpeg',
      0.92
    );
  });
}

function applyExifTransform(
  ctx: CanvasRenderingContext2D,
  orientation: Orientation,
  width: number,
  height: number
): void {
  // EXIF orientation values:
  // 1: Normal
  // 2: Flip horizontal
  // 3: Rotate 180
  // 4: Flip vertical
  // 5: Rotate 90 CW + flip horizontal
  // 6: Rotate 90 CW
  // 7: Rotate 90 CCW + flip horizontal
  // 8: Rotate 90 CCW

  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, height, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, height, width);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, width);
      break;
  }
}
```

### Using browser-image-compression with EXIF

```typescript
import imageCompression from 'browser-image-compression';

const compressedFile = await imageCompression(file, {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  // Library handles EXIF orientation automatically
  // But you can preserve other EXIF data:
  preserveExif: false, // Set to true to keep metadata
});
```

---

## Drag and Drop Uploads

### Using react-dropzone

```typescript
import { useDropzone, type Accept, type FileRejection } from 'react-dropzone';
import { useCallback, useState } from 'react';

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
}

const ACCEPTED_IMAGE_TYPES: Accept = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILES = 5;

function ImageDropzone() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const onDrop = useCallback((
    acceptedFiles: File[],
    rejectedFiles: FileRejection[]
  ) => {
    // Handle accepted files
    const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending',
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    // Handle rejected files
    const newErrors = rejectedFiles.map((rejection) => {
      const errorMessages = rejection.errors.map((e) => {
        switch (e.code) {
          case 'file-invalid-type':
            return `${rejection.file.name}: Invalid file type`;
          case 'file-too-large':
            return `${rejection.file.name}: File too large (max ${MAX_FILE_SIZE_MB}MB)`;
          case 'too-many-files':
            return `Too many files (max ${MAX_FILES})`;
          default:
            return `${rejection.file.name}: ${e.message}`;
        }
      });
      return errorMessages.join(', ');
    });

    setErrors(newErrors);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
  } = useDropzone({
    onDrop,
    accept: ACCEPTED_IMAGE_TYPES,
    maxSize: MAX_FILE_SIZE_BYTES,
    maxFiles: MAX_FILES,
    multiple: true,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        data-drag-active={isDragActive}
        data-drag-accept={isDragAccept}
        data-drag-reject={isDragReject}
        className="dropzone"
        role="button"
        aria-label="Drop images here or click to select"
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop the images here...</p>
        ) : (
          <p>Drag and drop images here, or click to select</p>
        )}
        <p className="hint">
          Accepts: JPG, PNG, WebP, GIF (max {MAX_FILE_SIZE_MB}MB each, up to {MAX_FILES} files)
        </p>
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="errors">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="previews">
          {files.map((file) => (
            <li key={file.id}>
              <img src={file.preview} alt={`Preview of ${file.file.name}`} />
              <span>{file.file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(file.id)}
                aria-label={`Remove ${file.file.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Native HTML5 Drag and Drop (No Library)

```typescript
import { useState, useCallback, type DragEvent } from 'react';

function NativeDropzone() {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    );

    setFiles((prev) => [...prev, ...droppedFiles]);
  }, []);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-dragging={isDragging}
      className="native-dropzone"
      role="button"
      tabIndex={0}
      aria-label="Drop zone for images"
    >
      {isDragging ? 'Drop images here' : 'Drag images here'}
    </div>
  );
}
```

---

## Image Cropping

### Using react-image-crop

```typescript
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useState, useRef, useCallback } from 'react';

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  aspectRatio?: number;
}

function ImageCropper({ imageSrc, onCropComplete, aspectRatio }: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback(() => {
    if (aspectRatio && imgRef.current) {
      const { width, height } = imgRef.current;
      const cropWidth = Math.min(width, height * aspectRatio);
      const cropHeight = cropWidth / aspectRatio;

      setCrop({
        unit: '%',
        x: ((width - cropWidth) / 2 / width) * 100,
        y: ((height - cropHeight) / 2 / height) * 100,
        width: (cropWidth / width) * 100,
        height: (cropHeight / height) * 100,
      });
    }
  }, [aspectRatio]);

  const getCroppedImage = useCallback(async () => {
    if (!completedCrop || !imgRef.current) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (blob) {
          onCropComplete(blob);
        }
      },
      'image/jpeg',
      0.9
    );
  }, [completedCrop, onCropComplete]);

  return (
    <div>
      <ReactCrop
        crop={crop}
        onChange={(c) => setCrop(c)}
        onComplete={(c) => setCompletedCrop(c)}
        aspect={aspectRatio}
      >
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Image to crop"
          onLoad={onImageLoad}
        />
      </ReactCrop>

      <button type="button" onClick={getCroppedImage}>
        Apply Crop
      </button>
    </div>
  );
}
```

### Using react-easy-crop

```typescript
import Cropper from 'react-easy-crop';
import { useState, useCallback } from 'react';

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

function EasyCropComponent({ imageSrc }: { imageSrc: string }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);

  const onCropComplete = useCallback(
    (_croppedArea: CropArea, croppedAreaPixels: CropArea) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const getCroppedImage = useCallback(async () => {
    if (!croppedAreaPixels) return null;

    const image = await createImageFromUrl(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;

    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9);
    });
  }, [imageSrc, croppedAreaPixels]);

  return (
    <div style={{ position: 'relative', width: '100%', height: 400 }}>
      <Cropper
        image={imageSrc}
        crop={crop}
        zoom={zoom}
        aspect={16 / 9}
        onCropChange={setCrop}
        onZoomChange={setZoom}
        onCropComplete={onCropComplete}
      />
    </div>
  );
}

function createImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.crossOrigin = 'anonymous';
    image.src = url;
  });
}
```

### Crop-Then-Upload Workflow

```typescript
import { useState, useCallback } from 'react';

type WorkflowStep = 'select' | 'crop' | 'preview' | 'upload';

function CropThenUploadWorkflow() {
  const [step, setStep] = useState<WorkflowStep>('select');
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    setOriginalFile(file);
    setOriginalPreview(URL.createObjectURL(file));
    setStep('crop');
  }, []);

  const handleCropComplete = useCallback((blob: Blob) => {
    setCroppedBlob(blob);
    setCroppedPreview(URL.createObjectURL(blob));
    setStep('preview');
  }, []);

  const handleUpload = useCallback(async () => {
    if (!croppedBlob || !originalFile) return;

    setStep('upload');

    const formData = new FormData();
    formData.append('image', croppedBlob, originalFile.name);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      // Success - cleanup
      if (originalPreview) URL.revokeObjectURL(originalPreview);
      if (croppedPreview) URL.revokeObjectURL(croppedPreview);

      // Reset state
      setStep('select');
      setOriginalFile(null);
      setOriginalPreview(null);
      setCroppedBlob(null);
      setCroppedPreview(null);
    } catch (error) {
      console.error('Upload error:', error);
      setStep('preview'); // Allow retry
    }
  }, [croppedBlob, originalFile, originalPreview, croppedPreview]);

  return (
    <div>
      {step === 'select' && (
        <FileSelector onFileSelect={handleFileSelect} />
      )}

      {step === 'crop' && originalPreview && (
        <ImageCropper
          imageSrc={originalPreview}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
        />
      )}

      {step === 'preview' && croppedPreview && (
        <div>
          <img src={croppedPreview} alt="Cropped preview" />
          <button onClick={() => setStep('crop')}>Re-crop</button>
          <button onClick={handleUpload}>Upload</button>
        </div>
      )}

      {step === 'upload' && (
        <div>Uploading...</div>
      )}
    </div>
  );
}
```

---

## Modern Format Conversion

### Browser Support (2025/2026)

| Format | Browser Support | Best For |
|--------|-----------------|----------|
| WebP | 95%+ | General use, good balance |
| AVIF | 93%+ | Photos, maximum compression |
| JPEG | 100% | Fallback, compatibility |
| PNG | 100% | Transparency, lossless |

### Format Detection

```typescript
async function supportsImageFormat(format: 'webp' | 'avif'): Promise<boolean> {
  const testImages: Record<string, string> = {
    webp: 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=',
    avif: 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKBzgABpAQ0AIAyAwA0z0AAA==',
  };

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.width > 0 && img.height > 0);
    img.onerror = () => resolve(false);
    img.src = testImages[format];
  });
}

// Cache detection results
const formatSupportCache = new Map<string, boolean>();

async function getFormatSupport(format: 'webp' | 'avif'): Promise<boolean> {
  if (formatSupportCache.has(format)) {
    return formatSupportCache.get(format)!;
  }

  const supported = await supportsImageFormat(format);
  formatSupportCache.set(format, supported);
  return supported;
}
```

### Convert to Modern Format

```typescript
async function convertToModernFormat(
  file: File,
  preferAvif = true
): Promise<Blob> {
  const supportsAvif = await getFormatSupport('avif');
  const supportsWebp = await getFormatSupport('webp');

  let targetFormat: string;
  let mimeType: string;

  if (preferAvif && supportsAvif) {
    targetFormat = 'avif';
    mimeType = 'image/avif';
  } else if (supportsWebp) {
    targetFormat = 'webp';
    mimeType = 'image/webp';
  } else {
    // Fallback to JPEG
    targetFormat = 'jpeg';
    mimeType = 'image/jpeg';
  }

  const img = await createImageFromFile(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.drawImage(img, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error(`Failed to convert to ${targetFormat}`));
        }
      },
      mimeType,
      0.85
    );
  });
}
```

---

## Progressive Loading

### LQIP (Low Quality Image Placeholder) Pattern

```typescript
import { useState, useEffect } from 'react';

interface ProgressiveImageProps {
  lowQualitySrc: string; // Tiny placeholder (< 2KB)
  highQualitySrc: string;
  alt: string;
  className?: string;
}

function ProgressiveImage({
  lowQualitySrc,
  highQualitySrc,
  alt,
  className,
}: ProgressiveImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(lowQualitySrc);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setCurrentSrc(highQualitySrc);
      setIsLoaded(true);
    };
    img.src = highQualitySrc;
  }, [highQualitySrc]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      data-loaded={isLoaded}
      style={{
        filter: isLoaded ? 'none' : 'blur(20px)',
        transition: 'filter 0.3s ease-out',
      }}
    />
  );
}
```

### BlurHash Implementation

```typescript
import { decode } from 'blurhash';
import { useEffect, useRef, useState } from 'react';

interface BlurHashImageProps {
  blurhash: string;
  src: string;
  alt: string;
  width: number;
  height: number;
}

function BlurHashImage({ blurhash, src, alt, width, height }: BlurHashImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Render blurhash to canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const pixels = decode(blurhash, 32, 32);
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(32, 32);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
  }, [blurhash]);

  return (
    <div style={{ position: 'relative', width, height }}>
      {/* Blurhash placeholder */}
      <canvas
        ref={canvasRef}
        width={32}
        height={32}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: isLoaded ? 0 : 1,
          transition: 'opacity 0.3s',
        }}
      />

      {/* Actual image */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setIsLoaded(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.3s',
        }}
      />
    </div>
  );
}
```

### Intersection Observer for Lazy Loading

```typescript
import { useRef, useState, useEffect } from 'react';

function useLazyImage(src: string, options?: IntersectionObserverInit) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px', ...options }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return {
    imgRef,
    src: isInView ? src : undefined,
    isLoaded,
    onLoad: () => setIsLoaded(true),
  };
}

// Usage
function LazyImage({ src, alt }: { src: string; alt: string }) {
  const { imgRef, src: lazySrc, isLoaded, onLoad } = useLazyImage(src);

  return (
    <img
      ref={imgRef}
      src={lazySrc}
      alt={alt}
      onLoad={onLoad}
      data-loaded={isLoaded}
    />
  );
}
```

---

## Accessibility Requirements

### WCAG 2.2 Compliance for Image Uploads

```typescript
interface AccessibleImageUploadProps {
  id: string;
  label: string;
  description?: string;
  accept?: string;
  maxSizeMB?: number;
  required?: boolean;
  error?: string;
  onFileSelect: (file: File) => void;
}

function AccessibleImageUpload({
  id,
  label,
  description,
  accept = 'image/*',
  maxSizeMB = 5,
  required = false,
  error,
  onFileSelect,
}: AccessibleImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div className="image-upload">
      {/* Visible label */}
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>

      {/* Description for screen readers */}
      {description && (
        <p id={descriptionId} className="description">
          {description}
        </p>
      )}

      {/* Accessible dropzone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={handleKeyDown}
        aria-describedby={[
          description ? descriptionId : null,
          error ? errorId : null,
        ].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? 'true' : undefined}
        className="dropzone"
      >
        <span>
          Click or drag to upload an image
        </span>
        <span className="file-requirements">
          Accepted formats: JPG, PNG, WebP. Max size: {maxSizeMB}MB
        </span>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        onChange={handleChange}
        required={required}
        aria-describedby={description ? descriptionId : undefined}
        className="visually-hidden"
      />

      {/* Error message */}
      {error && (
        <p id={errorId} role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
```

### Upload Progress Accessibility

```typescript
interface UploadProgressProps {
  progress: number;
  fileName: string;
  status: 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

function UploadProgress({
  progress,
  fileName,
  status,
  errorMessage,
}: UploadProgressProps) {
  return (
    <div
      role="region"
      aria-label={`Upload progress for ${fileName}`}
    >
      <span className="file-name">{fileName}</span>

      {status === 'uploading' && (
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Uploading ${fileName}: ${progress}% complete`}
        >
          <div
            className="progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {status === 'success' && (
        <span role="status" aria-live="polite">
          Upload complete
        </span>
      )}

      {status === 'error' && (
        <span role="alert">
          Upload failed: {errorMessage}
        </span>
      )}
    </div>
  );
}
```

### Key Accessibility Requirements

1. **Labels and Instructions (WCAG 3.3.2)**
   - Every file input must have a visible label
   - Provide clear instructions for file types and size limits
   - Use `aria-describedby` to associate instructions

2. **Keyboard Navigation (WCAG 2.1.1)**
   - Dropzones must be focusable (`tabIndex={0}`)
   - Support Enter and Space keys to trigger file dialog
   - Ensure all controls are keyboard accessible

3. **Error Identification (WCAG 3.3.1)**
   - Use `role="alert"` for error messages
   - Associate errors with inputs via `aria-describedby`
   - Use `aria-invalid="true"` on invalid inputs

4. **Status Messages (WCAG 4.1.3)**
   - Use `aria-live="polite"` for success messages
   - Use `role="progressbar"` with proper ARIA attributes
   - Announce upload completion to screen readers

---

## Library Recommendations

### Image Compression

| Library | Size | Features | Best For |
|---------|------|----------|----------|
| **browser-image-compression** | 8KB | Web Worker, EXIF, all formats | General use |
| **Compressor.js** | 5KB | Simple API, EXIF orientation | Quick integration |
| **Squoosh** | Heavy | Best quality, many codecs | Quality-critical apps |

### Drag and Drop

| Library | Size | Features | Best For |
|---------|------|----------|----------|
| **react-dropzone** | 8KB | Full-featured, TypeScript | Production apps |
| **Native HTML5** | 0KB | Basic functionality | Simple needs |
| **FilePond** | 40KB | Full upload solution | Complete solution |

### Image Cropping

| Library | Size | Features | Best For |
|---------|------|----------|----------|
| **react-image-crop** | 5KB | Zero deps, a11y, touch | Lightweight needs |
| **react-easy-crop** | 12KB | Zoom, rotation, mobile | Touch-first apps |
| **react-cropper** | 40KB | Full CropperJS features | Advanced editing |
| **React Advanced Cropper** | 25KB | Highly customizable | Custom UIs |

### Progressive Loading

| Library | Size | Features | Best For |
|---------|------|----------|----------|
| **blurhash** | 2KB | Compact placeholders | Network efficiency |
| **react-progressive-image** | 3KB | Simple blur-up | Basic LQIP |
| **next/image** | Built-in | Automatic optimization | Next.js apps |

---

## Anti-Patterns to Avoid

### Memory Leaks

```typescript
// BAD: Not revoking object URLs
function BadImagePreview({ file }: { file: File }) {
  const [preview] = useState(() => URL.createObjectURL(file));
  // Memory leak - URL never revoked!
  return <img src={preview} />;
}

// GOOD: Proper cleanup
function GoodImagePreview({ file }: { file: File }) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return preview ? <img src={preview} /> : null;
}
```

### Blocking the Main Thread

```typescript
// BAD: Synchronous processing of large images
async function badProcessImages(files: File[]) {
  for (const file of files) {
    await processImage(file); // Blocks UI between each
  }
}

// GOOD: Use Web Workers and show progress
async function goodProcessImages(
  files: File[],
  onProgress: (progress: number) => void
) {
  const results = await Promise.all(
    files.map(async (file, index) => {
      const result = await imageCompression(file, { useWebWorker: true });
      onProgress(((index + 1) / files.length) * 100);
      return result;
    })
  );
  return results;
}
```

### Ignoring EXIF Orientation

```typescript
// BAD: Displaying image directly without orientation check
function BadImageDisplay({ file }: { file: File }) {
  // Image might appear rotated on some devices!
  return <img src={URL.createObjectURL(file)} />;
}

// GOOD: Normalize orientation first
async function normalizeAndDisplay(file: File): Promise<string> {
  const normalized = await normalizeImageOrientation(file);
  return URL.createObjectURL(normalized);
}
```

### Oversized Canvas Operations

```typescript
// BAD: Attempting to process very large images
async function badResize(file: File) {
  const img = await createImageFromFile(file);
  const canvas = document.createElement('canvas');
  // May crash browser if image is too large (>32k pixels)
  canvas.width = img.width;
  canvas.height = img.height;
}

// GOOD: Limit canvas size to browser maximum
const MAX_CANVAS_DIMENSION = 4096;

async function goodResize(file: File, maxSize = MAX_CANVAS_DIMENSION) {
  const img = await createImageFromFile(file);

  // Scale down if exceeds browser limits
  const scale = Math.min(
    1,
    maxSize / img.width,
    maxSize / img.height
  );

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  // Safe to proceed
}
```

### Poor Error Handling

```typescript
// BAD: No error handling
async function badUpload(file: File) {
  const compressed = await imageCompression(file, options);
  await fetch('/upload', { method: 'POST', body: compressed });
}

// GOOD: Comprehensive error handling
async function goodUpload(
  file: File,
  onError: (error: Error) => void
): Promise<boolean> {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Invalid file type. Please select an image.');
    }

    // Validate file size
    const MAX_SIZE_MB = 10;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      throw new Error(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
    }

    const compressed = await imageCompression(file, options);

    const response = await fetch('/upload', {
      method: 'POST',
      body: compressed,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    onError(error instanceof Error ? error : new Error('Unknown error'));
    return false;
  }
}
```

---

## Performance Considerations

### 1. Web Worker Processing

Use Web Workers for compression to avoid blocking the UI:

```typescript
// browser-image-compression handles this automatically
const compressed = await imageCompression(file, {
  useWebWorker: true, // Default: true
  maxSizeMB: 1,
});
```

### 2. Batch Processing with Concurrency Control

```typescript
async function processImagesWithConcurrency(
  files: File[],
  maxConcurrent = 3
): Promise<File[]> {
  const results: File[] = [];
  const executing: Promise<void>[] = [];

  for (const file of files) {
    const promise = imageCompression(file, { useWebWorker: true })
      .then((compressed) => {
        results.push(compressed);
      });

    executing.push(promise);

    if (executing.length >= maxConcurrent) {
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
```

### 3. Debounce Crop Updates

```typescript
import { useDebouncedCallback } from 'use-debounce';

function CropperWithDebounce() {
  const [crop, setCrop] = useState<Crop>();

  // Debounce the expensive crop calculation
  const debouncedOnCropComplete = useDebouncedCallback(
    (pixelCrop: PixelCrop) => {
      generateCroppedImage(pixelCrop);
    },
    150
  );

  return (
    <ReactCrop
      crop={crop}
      onChange={setCrop}
      onComplete={debouncedOnCropComplete}
    />
  );
}
```

### 4. Preload Critical Images

```typescript
function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    link.onload = () => resolve();
    link.onerror = reject;
    document.head.appendChild(link);
  });
}
```

### 5. Memory Management Best Practices

```typescript
// Process images sequentially to control memory
async function processSequentially(files: File[]): Promise<Blob[]> {
  const results: Blob[] = [];

  for (const file of files) {
    // Create temporary URL
    const url = URL.createObjectURL(file);

    try {
      const processed = await processImage(url);
      results.push(processed);
    } finally {
      // Always cleanup
      URL.revokeObjectURL(url);
    }

    // Optional: Force garbage collection pause
    await new Promise((r) => setTimeout(r, 10));
  }

  return results;
}
```

---

## Sources

### Image Preview and Upload
- [CoreUI - How to preview uploaded image in React](https://coreui.io/answers/how-to-preview-uploaded-image-in-react/)
- [LogRocket - Using FileReader API to preview images](https://blog.logrocket.com/using-filereader-api-preview-images-react/)
- [BezKoder - React Image Upload with Preview](https://www.bezkoder.com/react-image-upload-preview/)

### Client-Side Compression
- [browser-image-compression - npm](https://www.npmjs.com/package/browser-image-compression)
- [Halodoc - Leveraging Client-Side Image Compression](https://blogs.halodoc.io/optimizing-for-speed-image-compression/)
- [ImageKit - Image compression techniques in JavaScript](https://imagekit.io/blog/image-compression-techniques-in-javascript/)

### Canvas API
- [MDN - Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [MDN - HTMLCanvasElement.toBlob()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob)
- [IMG.LY - How to resize and compress images](https://img.ly/blog/how-to-compress-an-image-before-uploading-it-in-javascript/)

### EXIF Handling
- [FilePond - Image EXIF Orientation](https://pqina.nl/filepond/docs/api/plugins/image-exif-orientation/)
- [get-orientation - GitHub](https://github.com/mooyoul/get-orientation)

### Drag and Drop
- [react-dropzone - GitHub](https://github.com/react-dropzone/react-dropzone)
- [ClarityDev - React TypeScript Drag Drop Guide](https://claritydev.net/blog/react-typescript-drag-drop-file-upload-guide)

### Image Cropping
- [LogRocket - Top React image cropping libraries](https://blog.logrocket.com/top-react-image-cropping-libraries/)
- [Pqina - 8 Great React Image Croppers](https://pqina.nl/pintura/blog/8-great-react-image-croppers/)
- [react-image-crop - npm](https://www.npmjs.com/package/react-image-crop)

### Modern Formats
- [Crystallize - AVIF vs WebP](https://crystallize.com/blog/avif-vs-webp)
- [SpeedVitals - WebP vs AVIF 2025](https://speedvitals.com/blog/webp-vs-avif/)
- [Smashing Magazine - Modern Image Formats](https://www.smashingmagazine.com/2021/09/modern-image-formats-avif-webp/)

### Progressive Loading
- [Ben Honeywill - Progressive Image Loading with React Hooks](https://benhoneywill.com/progressive-image-loading-with-react-hooks/)
- [Medium - LQIP Blurred Image Loading](https://medium.com/@ravipatel.it/web-progressive-enhancement-with-lqip-blurred-image-loading-using-css-and-javascript-fc1043b0a9d5)

### Accessibility
- [Filestack - HTML File Upload Accessibility](https://blog.filestack.com/html-file-upload-accessibility/)
- [Uploadcare - Building an accessible file uploader](https://uploadcare.com/blog/file-uploader-accessibility/)
- [W3C - WAI-ARIA 1.3](https://w3c.github.io/aria/)

### Memory Management
- [MDN - URL.createObjectURL()](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static)
- [Trailhead - Safely Process Images Without Memory Overflows](https://trailheadtechnology.com/safely-process-images-in-the-browser-without-memory-overflows/)
