# Image Handling - Preview Examples

> Advanced preview generation patterns. See [core.md](core.md) for basic preview hook and component.

**Prerequisites:** Understand Pattern 1-2 from [core.md](core.md) first.

---

## Pattern 1: Drag-and-Drop Preview Zone

### Visual Feedback During Drag

Uses a drag counter to handle nested element enter/leave events correctly (the most common drag-and-drop bug).

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

**Why good:** Drag counter handles nested elements correctly, validates during drop, accessible with role and aria-label, style-agnostic via className and data-attributes

---

## Pattern 2: Thumbnail Generation

### Create Multiple Sizes in Parallel

```typescript
// thumbnail-generator.ts
import { loadImage } from "./load-image";

const THUMBNAIL_SIZES = {
  small: 100,
  medium: 200,
  large: 400,
} as const;

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
  maxSize: number,
): Promise<Thumbnail> {
  const ratio = Math.min(maxSize / img.width, maxSize / img.height);

  // Don't upscale
  if (ratio >= 1) {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Thumbnail failed"))),
        "image/jpeg",
        THUMBNAIL_QUALITY,
      );
    });
    return {
      blob,
      url: URL.createObjectURL(blob),
      width: img.width,
      height: img.height,
    };
  }

  const width = Math.round(img.width * ratio);
  const height = Math.round(img.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Thumbnail failed"))),
      "image/jpeg",
      THUMBNAIL_QUALITY,
    );
  });

  return { blob, url: URL.createObjectURL(blob), width, height };
}

/** Cleanup all thumbnail URLs */
export function cleanupThumbnailSet(thumbnails: ThumbnailSet): void {
  URL.revokeObjectURL(thumbnails.small.url);
  URL.revokeObjectURL(thumbnails.medium.url);
  URL.revokeObjectURL(thumbnails.large.url);
}
```

**Why good:** Generates all sizes in parallel, doesn't upscale small images, provides cleanup function for all URLs

---

## Pattern 3: Preview Gallery Grid

### Multiple Images with Keyboard Navigation

```typescript
// preview-gallery.tsx
import { useCallback } from 'react';

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

**Why good:** ARIA listbox pattern for accessibility, keyboard Delete/Backspace support, stopPropagation on remove button prevents triggering select, lazy loading images

---

_Extended examples: [core.md](core.md) | [canvas.md](canvas.md)_
