# Image Preview Examples

> Image preview, thumbnails, EXIF orientation handling. Reference from [SKILL.md](../SKILL.md).

---

## Pattern 1: Image Preview Hook

### Preview with Proper Cleanup

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

  const generatePreview = useCallback(
    async (file: File) => {
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
        setError(
          err instanceof Error ? err.message : 'Failed to generate preview'
        );
        setPreview(null);
      } finally {
        setLoading(false);
      }
    },
    [preview?.url]
  );

  const clearPreview = useCallback(() => {
    if (preview?.url) {
      URL.revokeObjectURL(preview.url);
    }
    setPreview(null);
    setError(null);
  }, [preview?.url]);

  return { preview, loading, error, generatePreview, clearPreview };
}

function getImageDimensions(
  url: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}
```

**Why good:** Cleans up object URLs on unmount and when generating new preview, validates file type, provides dimensions for layout, handles errors gracefully

---

## Pattern 2: Image Preview Component

### Accessible Image Preview

```typescript
// image-preview.tsx
import { useEffect, useRef } from 'react';
import styles from './image-preview.module.scss';

interface ImagePreviewProps {
  file: File;
  alt?: string;
  maxWidth?: number;
  maxHeight?: number;
  className?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

const DEFAULT_MAX_WIDTH = 400;
const DEFAULT_MAX_HEIGHT = 300;

export function ImagePreview({
  file,
  alt = 'Image preview',
  maxWidth = DEFAULT_MAX_WIDTH,
  maxHeight = DEFAULT_MAX_HEIGHT,
  className,
  onLoad,
  onError,
}: ImagePreviewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    // Create object URL
    const url = URL.createObjectURL(file);
    urlRef.current = url;

    if (imgRef.current) {
      imgRef.current.src = url;
    }

    // Cleanup on unmount or file change
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [file]);

  const handleLoad = () => {
    onLoad?.();
  };

  const handleError = () => {
    onError?.(new Error('Failed to load image'));
  };

  return (
    <div
      className={`${styles.container} ${className ?? ''}`}
      style={{ maxWidth, maxHeight }}
    >
      <img
        ref={imgRef}
        alt={alt}
        className={styles.image}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}
```

```scss
// image-preview.module.scss
.container {
  position: relative;
  display: inline-block;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.image {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}
```

**Why good:** Object URL created in effect, cleaned up on unmount/file change, maintains aspect ratio with object-fit, callbacks for load/error handling

---

## Pattern 3: Image Resizer Utility

### Client-Side Image Resizing

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
    const ratio = Math.min(
      maxWidth / originalWidth,
      maxHeight / originalHeight
    );
    if (ratio < 1) {
      newWidth = Math.round(originalWidth * ratio);
      newHeight = Math.round(originalHeight * ratio);
    }
  } else {
    newWidth = Math.min(originalWidth, maxWidth);
    newHeight = Math.min(originalHeight, maxHeight);
  }

  // Use OffscreenCanvas for better performance
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

// Helper to create a File from the resized blob
export async function resizeImageToFile(
  file: File,
  options: ResizeOptions
): Promise<File> {
  const { blob } = await resizeImage(file, options);

  // Preserve original filename with new extension
  const ext = options.format?.split('/')[1] ?? 'jpg';
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const newName = `${baseName}.${ext}`;

  return new File([blob], newName, { type: options.format ?? 'image/jpeg' });
}
```

**Why good:** Uses OffscreenCanvas for performance (works in Web Workers), maintains aspect ratio by default, provides both original and new dimensions, high-quality smoothing

---

## Pattern 4: EXIF Orientation Handler

### Fix Rotated Images from Mobile

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
  // Orientation values: 1-8
  // 1: Normal
  // 2: Flipped horizontally
  // 3: Rotated 180°
  // 4: Flipped vertically
  // 5: Rotated 90° CW + flipped horizontally
  // 6: Rotated 90° CW
  // 7: Rotated 90° CCW + flipped horizontally
  // 8: Rotated 90° CCW

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
  const HEADER_SIZE = 65536;
  const buffer = await file.slice(0, HEADER_SIZE).arrayBuffer();
  const view = new DataView(buffer);

  // Check for JPEG SOI marker
  if (view.getUint16(0) !== 0xffd8) {
    return 1; // Not a JPEG or no orientation
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

  return 1; // No EXIF orientation found
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

**Why good:** Handles all 8 EXIF orientations, reads only file header (efficient), preserves original format, handles non-JPEG files gracefully

---

## Pattern 5: Thumbnail Generator

### Generate Thumbnails for File List

```typescript
// thumbnail-generator.ts
interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

const DEFAULT_THUMBNAIL_WIDTH = 150;
const DEFAULT_THUMBNAIL_HEIGHT = 150;
const DEFAULT_QUALITY = 0.7;

export async function generateThumbnail(
  file: File,
  options: ThumbnailOptions = {}
): Promise<string> {
  const {
    width = DEFAULT_THUMBNAIL_WIDTH,
    height = DEFAULT_THUMBNAIL_HEIGHT,
    quality = DEFAULT_QUALITY,
    format = 'image/jpeg',
  } = options;

  if (!file.type.startsWith('image/')) {
    throw new Error('File is not an image');
  }

  // Fix orientation first
  const orientedBlob = await fixImageOrientation(file);
  const imageBitmap = await createImageBitmap(orientedBlob);

  // Calculate crop to fit thumbnail (center crop)
  const sourceAspect = imageBitmap.width / imageBitmap.height;
  const targetAspect = width / height;

  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = imageBitmap.width;
  let sourceHeight = imageBitmap.height;

  if (sourceAspect > targetAspect) {
    // Image is wider - crop sides
    sourceWidth = imageBitmap.height * targetAspect;
    sourceX = (imageBitmap.width - sourceWidth) / 2;
  } else {
    // Image is taller - crop top/bottom
    sourceHeight = imageBitmap.width / targetAspect;
    sourceY = (imageBitmap.height - sourceHeight) / 2;
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    imageBitmap,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height
  );

  imageBitmap.close();

  const blob = await canvas.convertToBlob({ type: format, quality });
  return URL.createObjectURL(blob);
}

// Hook for managing thumbnails
export function useThumbnails() {
  const thumbnailsRef = useRef<Map<string, string>>(new Map());

  const getThumbnail = useCallback(
    async (fileId: string, file: File): Promise<string> => {
      // Check cache first
      const cached = thumbnailsRef.current.get(fileId);
      if (cached) {
        return cached;
      }

      const url = await generateThumbnail(file);
      thumbnailsRef.current.set(fileId, url);
      return url;
    },
    []
  );

  const clearThumbnail = useCallback((fileId: string) => {
    const url = thumbnailsRef.current.get(fileId);
    if (url) {
      URL.revokeObjectURL(url);
      thumbnailsRef.current.delete(fileId);
    }
  }, []);

  const clearAll = useCallback(() => {
    thumbnailsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    thumbnailsRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      thumbnailsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  return { getThumbnail, clearThumbnail, clearAll };
}
```

**Why good:** Center crops to maintain focus, fixes EXIF orientation before generating, caches thumbnails with cleanup, uses efficient OffscreenCanvas

---

## Anti-Pattern Examples

### What NOT to Do

```typescript
// ANTI-PATTERN: Creating object URLs without cleanup
function BadPreview({ file }: { file: File }) {
  // Memory leak! New URL created on every render
  const url = URL.createObjectURL(file);
  return <img src={url} />;
}

// ANTI-PATTERN: Not handling EXIF orientation
function NaivePreview({ file }: { file: File }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    setUrl(URL.createObjectURL(file));
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Images from phones may appear rotated!
  return <img src={url} />;
}

// ANTI-PATTERN: Using toDataURL for large images
function HugeMemoryPreview({ file }: { file: File }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => setDataUrl(reader.result as string);
    reader.readAsDataURL(file); // Creates huge base64 string!
  }, [file]);

  return <img src={dataUrl} />;
}

// ANTI-PATTERN: Blocking main thread with large image processing
function SlowPreview({ file }: { file: File }) {
  const processImage = (file: File) => {
    const reader = new FileReader();
    reader.readAsDataURL(file); // Blocks UI for large files
    // Synchronous processing follows...
  };
}
```

---

_Extended examples: [core.md](core.md) | [validation.md](validation.md) | [progress.md](progress.md) | [s3-upload.md](s3-upload.md) | [resumable.md](resumable.md) | [accessibility.md](accessibility.md)_
