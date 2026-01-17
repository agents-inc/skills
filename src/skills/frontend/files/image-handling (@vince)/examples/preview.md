# Image Preview Examples

> Preview generation patterns for thumbnails and galleries. Reference from [SKILL.md](../SKILL.md).

---

## Pattern 1: Lazy Preview Generation

### Generate Previews On-Demand

```typescript
// lazy-preview.ts
import { useState, useCallback, useMemo } from 'react';

interface LazyImage {
  id: string;
  file: File;
  previewUrl: string | null;
  status: 'pending' | 'loading' | 'ready' | 'error';
}

const CONCURRENT_PREVIEWS = 3;

/**
 * Generate previews lazily as they scroll into view
 * Useful for large galleries where generating all previews upfront is expensive
 */
export function useLazyPreviews(files: File[]) {
  const [previews, setPreviews] = useState<Map<string, LazyImage>>(new Map());

  const initializeFiles = useCallback(() => {
    const newPreviews = new Map<string, LazyImage>();

    files.forEach((file, index) => {
      const id = `${file.name}-${index}-${file.size}`;
      newPreviews.set(id, {
        id,
        file,
        previewUrl: null,
        status: 'pending',
      });
    });

    setPreviews(newPreviews);
  }, [files]);

  const generatePreview = useCallback(async (id: string) => {
    setPreviews((current) => {
      const image = current.get(id);
      if (!image || image.status !== 'pending') return current;

      const updated = new Map(current);
      updated.set(id, { ...image, status: 'loading' });
      return updated;
    });

    try {
      const image = previews.get(id);
      if (!image) return;

      const previewUrl = URL.createObjectURL(image.file);

      // Validate it loads
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Load failed'));
        img.src = previewUrl;
      });

      setPreviews((current) => {
        const updated = new Map(current);
        const existing = updated.get(id);
        if (existing) {
          updated.set(id, { ...existing, previewUrl, status: 'ready' });
        }
        return updated;
      });
    } catch {
      setPreviews((current) => {
        const updated = new Map(current);
        const existing = updated.get(id);
        if (existing) {
          updated.set(id, { ...existing, status: 'error' });
        }
        return updated;
      });
    }
  }, [previews]);

  const cleanup = useCallback(() => {
    previews.forEach((image) => {
      if (image.previewUrl) {
        URL.revokeObjectURL(image.previewUrl);
      }
    });
    setPreviews(new Map());
  }, [previews]);

  const imagesList = useMemo(() => Array.from(previews.values()), [previews]);

  return {
    images: imagesList,
    initializeFiles,
    generatePreview,
    cleanup,
  };
}
```

**Why good:** Defers preview generation until needed, tracks loading state per image, proper cleanup method

---

## Pattern 2: Thumbnail Generation

### Create Smaller Versions

```typescript
// thumbnail-generator.ts
const THUMBNAIL_SIZES = {
  small: 100,
  medium: 200,
  large: 400,
} as const;

type ThumbnailSize = keyof typeof THUMBNAIL_SIZES;

interface Thumbnail {
  blob: Blob;
  url: string;
  width: number;
  height: number;
}

interface ThumbnailSet {
  small: Thumbnail;
  medium: Thumbnail;
  large: Thumbnail;
  original: { width: number; height: number };
}

const THUMBNAIL_QUALITY = 0.7;

/**
 * Generate multiple thumbnail sizes at once
 */
export async function generateThumbnailSet(file: File): Promise<ThumbnailSet> {
  const img = await loadImage(file);

  const [small, medium, large] = await Promise.all([
    createThumbnail(img, THUMBNAIL_SIZES.small),
    createThumbnail(img, THUMBNAIL_SIZES.medium),
    createThumbnail(img, THUMBNAIL_SIZES.large),
  ]);

  return {
    small,
    medium,
    large,
    original: { width: img.width, height: img.height },
  };
}

async function createThumbnail(
  img: HTMLImageElement,
  maxSize: number
): Promise<Thumbnail> {
  const { width, height } = calculateThumbnailSize(img.width, img.height, maxSize);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Thumbnail failed'))),
      'image/jpeg',
      THUMBNAIL_QUALITY
    );
  });

  return {
    blob,
    url: URL.createObjectURL(blob),
    width,
    height,
  };
}

function calculateThumbnailSize(
  originalWidth: number,
  originalHeight: number,
  maxSize: number
): { width: number; height: number } {
  const ratio = Math.min(maxSize / originalWidth, maxSize / originalHeight);

  // Don't upscale
  if (ratio >= 1) {
    return { width: originalWidth, height: originalHeight };
  }

  return {
    width: Math.round(originalWidth * ratio),
    height: Math.round(originalHeight * ratio),
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
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

/**
 * Cleanup thumbnail URLs
 */
export function cleanupThumbnailSet(thumbnails: ThumbnailSet): void {
  URL.revokeObjectURL(thumbnails.small.url);
  URL.revokeObjectURL(thumbnails.medium.url);
  URL.revokeObjectURL(thumbnails.large.url);
}
```

**Why good:** Generates all sizes in parallel, doesn't upscale small images, provides cleanup function

---

## Pattern 3: Preview with Progress

### Show Generation Progress

```typescript
// preview-with-progress.ts
import { useState, useCallback, useRef } from 'react';

interface PreviewProgress {
  loaded: number;
  total: number;
  percentage: number;
}

interface ProgressivePreviewState {
  previewUrl: string | null;
  progress: PreviewProgress | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
}

const INITIAL_STATE: ProgressivePreviewState = {
  previewUrl: null,
  progress: null,
  status: 'idle',
  error: null,
};

/**
 * Generate preview with progress tracking
 * Useful for large images where load time is noticeable
 */
export function usePreviewWithProgress() {
  const [state, setState] = useState<ProgressivePreviewState>(INITIAL_STATE);
  const abortRef = useRef<(() => void) | null>(null);

  const generatePreview = useCallback((file: File) => {
    // Cancel any in-progress generation
    abortRef.current?.();

    let cancelled = false;
    abortRef.current = () => {
      cancelled = true;
    };

    setState({
      ...INITIAL_STATE,
      status: 'loading',
      progress: { loaded: 0, total: file.size, percentage: 0 },
    });

    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (cancelled) return;

      if (event.lengthComputable) {
        setState((prev) => ({
          ...prev,
          progress: {
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
          },
        }));
      }
    };

    reader.onload = () => {
      if (cancelled) return;

      const dataUrl = reader.result as string;

      // Validate image loads
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;

        // Create object URL from blob for better performance
        const url = URL.createObjectURL(file);
        setState({
          previewUrl: url,
          progress: { loaded: file.size, total: file.size, percentage: 100 },
          status: 'ready',
          error: null,
        });
      };

      img.onerror = () => {
        if (cancelled) return;
        setState({
          previewUrl: null,
          progress: null,
          status: 'error',
          error: 'Invalid image file',
        });
      };

      img.src = dataUrl;
    };

    reader.onerror = () => {
      if (cancelled) return;
      setState({
        previewUrl: null,
        progress: null,
        status: 'error',
        error: 'Failed to read file',
      });
    };

    reader.readAsDataURL(file);
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.();
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }
    setState(INITIAL_STATE);
  }, [state.previewUrl]);

  return {
    ...state,
    generatePreview,
    clear,
    isLoading: state.status === 'loading',
    isReady: state.status === 'ready',
    hasError: state.status === 'error',
  };
}
```

**Why good:** Reports load progress, cancellable, validates image after load, proper cleanup

---

## Pattern 4: Drag-and-Drop Preview Zone

### Visual Feedback During Drag

```typescript
// drag-drop-preview.tsx
import { useState, useCallback, useRef } from 'react';
import type { DragEvent } from 'react';

interface DragDropPreviewProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string[];
  maxFiles?: number;
  className?: string;
}

const DEFAULT_ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DEFAULT_MAX_FILES = 10;

export function DragDropPreviewZone({
  onFilesSelected,
  accept = DEFAULT_ACCEPT,
  maxFiles = DEFAULT_MAX_FILES,
  className,
}: DragDropPreviewProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const dragCountRef = useRef(0);

  const validateFiles = useCallback(
    (files: File[]): { valid: File[]; errors: string[] } => {
      const valid: File[] = [];
      const errors: string[] = [];

      files.forEach((file) => {
        if (!accept.includes(file.type)) {
          errors.push(`${file.name}: Invalid file type`);
        } else if (valid.length >= maxFiles) {
          errors.push(`${file.name}: Maximum ${maxFiles} files allowed`);
        } else {
          valid.push(file);
        }
      });

      return { valid, errors };
    },
    [accept, maxFiles]
  );

  const handleDragEnter = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCountRef.current++;
    setIsDragActive(true);
    setDragError(null);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCountRef.current--;
    if (dragCountRef.current === 0) {
      setIsDragActive(false);
    }
  }, []);

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragCountRef.current = 0;
      setIsDragActive(false);

      const files = Array.from(event.dataTransfer.files);
      const { valid, errors } = validateFiles(files);

      if (errors.length > 0) {
        setDragError(errors.join(', '));
      }

      if (valid.length > 0) {
        onFilesSelected(valid);
      }
    },
    [onFilesSelected, validateFiles]
  );

  return (
    <div
      className={className}
      data-drag-active={isDragActive || undefined}
      data-drag-error={!!dragError || undefined}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      aria-label="Drop zone for images"
    >
      {isDragActive ? (
        <p>Drop images here...</p>
      ) : (
        <p>Drag and drop images here, or click to select</p>
      )}

      {dragError && (
        <p role="alert" data-error>
          {dragError}
        </p>
      )}
    </div>
  );
}
```

**Why good:** Uses drag counter for nested element handling, validates during drop, shows errors, accessible with role and aria-label

---

## Pattern 5: Responsive Image Preview

### Size-Appropriate Preview

```typescript
// responsive-preview.tsx
import { useState, useEffect, useRef, useCallback } from 'react';

interface ResponsivePreviewProps {
  file: File;
  alt: string;
  className?: string;
}

const BREAKPOINT_SIZES = {
  small: 320,
  medium: 640,
  large: 1280,
} as const;

/**
 * Generate size-appropriate preview based on container width
 */
export function ResponsivePreview({ file, alt, className }: ResponsivePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Observe container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Generate appropriately-sized preview
  useEffect(() => {
    if (containerWidth === 0) return;

    let cancelled = false;
    let url: string | null = null;

    async function generatePreview() {
      // Determine target size based on container width
      let targetSize = BREAKPOINT_SIZES.large;
      if (containerWidth < 400) {
        targetSize = BREAKPOINT_SIZES.small;
      } else if (containerWidth < 800) {
        targetSize = BREAKPOINT_SIZES.medium;
      }

      // Account for device pixel ratio
      const scaledSize = targetSize * Math.min(window.devicePixelRatio, 2);

      const resizedBlob = await resizeForPreview(file, scaledSize);

      if (cancelled) return;

      url = URL.createObjectURL(resizedBlob);
      setPreviewUrl(url);
    }

    generatePreview().catch(console.error);

    return () => {
      cancelled = true;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [file, containerWidth]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div ref={containerRef} className={className}>
      {previewUrl && (
        <img
          src={previewUrl}
          alt={alt}
          loading="lazy"
          decoding="async"
        />
      )}
    </div>
  );
}

async function resizeForPreview(file: File, maxSize: number): Promise<Blob> {
  const img = await loadImage(file);

  // Skip resize if image is already smaller
  if (img.width <= maxSize && img.height <= maxSize) {
    return file;
  }

  const ratio = Math.min(maxSize / img.width, maxSize / img.height);
  const width = Math.round(img.width * ratio);
  const height = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Resize failed'))),
      'image/jpeg',
      0.85
    );
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
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
```

**Why good:** Observes container size, generates appropriately-sized preview, accounts for device pixel ratio, skips resize for small images

---

## Pattern 6: Preview Gallery Grid

### Multiple Images with Selection

```typescript
// preview-gallery.tsx
import { useState, useCallback, useEffect } from 'react';

interface GalleryImage {
  id: string;
  file: File;
  previewUrl: string;
}

interface PreviewGalleryProps {
  images: GalleryImage[];
  onSelect?: (id: string) => void;
  onRemove?: (id: string) => void;
  selectedId?: string;
  className?: string;
}

export function PreviewGallery({
  images,
  onSelect,
  onRemove,
  selectedId,
  className,
}: PreviewGalleryProps) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, id: string) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect?.(id);
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        onRemove?.(id);
      }
    },
    [onSelect, onRemove]
  );

  if (images.length === 0) {
    return (
      <div className={className} data-empty>
        <p>No images selected</p>
      </div>
    );
  }

  return (
    <div
      className={className}
      role="listbox"
      aria-label="Image gallery"
    >
      {images.map((image, index) => (
        <div
          key={image.id}
          role="option"
          aria-selected={selectedId === image.id}
          tabIndex={0}
          data-selected={selectedId === image.id || undefined}
          onClick={() => onSelect?.(image.id)}
          onKeyDown={(e) => handleKeyDown(e, image.id)}
        >
          <img
            src={image.previewUrl}
            alt={`Preview ${index + 1}: ${image.file.name}`}
            loading="lazy"
            decoding="async"
          />

          <span data-file-name>{image.file.name}</span>

          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(image.id);
              }}
              aria-label={`Remove ${image.file.name}`}
            >
              <span aria-hidden="true">x</span>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

**Why good:** Keyboard navigation support, ARIA listbox pattern, stop propagation on remove button, lazy loading images

---

_Extended examples: [core.md](core.md) | [canvas.md](canvas.md)_
