# Image Handling — Preview Examples

> Presenting images once you hold them. Prerequisites are Patterns 1–2 in [core.md](core.md);
> the processing they build on is in [canvas.md](canvas.md).

---

## Pattern 6: Thumbnail set

Decode once and draw at every size, rather than re-decoding per size. Never upscale — enlarging a
small source produces a bigger file that looks worse.

```typescript
// thumbnail-generator.ts
import { loadImage } from "./load-image";

const THUMBNAIL_SIZES = { small: 100, medium: 200, large: 400 } as const;
const THUMBNAIL_QUALITY = 0.7;

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
  const scale = Math.min(ratio, 1); // 1 means the source is already smaller

  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

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

/** Every thumbnail holds an object URL; release the set when it goes out of use. */
export function cleanupThumbnailSet(thumbnails: ThumbnailSet): void {
  URL.revokeObjectURL(thumbnails.small.url);
  URL.revokeObjectURL(thumbnails.medium.url);
  URL.revokeObjectURL(thumbnails.large.url);
}
```

Where the reduction to `small` is more than half — it usually is — route it through the step-down
resize in [canvas.md](canvas.md) instead of drawing in one pass.

---

## Pattern 7: Gallery grid

The listbox role gives arrow-key semantics for free, and `Delete`/`Backspace` removes without a
pointer.

```typescript
// preview-gallery.tsx
import { useCallback } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';

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
    (event: KeyboardEvent, id: string) => {
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

  const handleRemoveClick = (event: MouseEvent, id: string) => {
    // without this the click also selects the item being removed
    event.stopPropagation();
    onRemove?.(id);
  };

  if (images.length === 0) {
    return (
      <div className={className} data-empty>
        <p>No images selected</p>
      </div>
    );
  }

  return (
    <div className={className} role="listbox" aria-label="Image gallery">
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
              onClick={(e) => handleRemoveClick(e, image.id)}
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

`loading="lazy"` matters more here than elsewhere: a grid of object URLs decodes every image at
once otherwise, and each decode holds full-resolution pixels.
