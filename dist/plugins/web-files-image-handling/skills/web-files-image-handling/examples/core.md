# Image Handling - Core Examples

> Core code examples for image handling patterns. See [SKILL.md](../SKILL.md) for decision guidance.

**Extended examples:**

- [canvas.md](canvas.md) - Canvas API manipulation, step-down scaling, cropping, filters
- [preview.md](preview.md) - Drag-and-drop, thumbnails, gallery grid

---

## Shared Utility: loadImage

Used by most patterns below. Creates an `HTMLImageElement` from a `File`, cleaning up the temporary object URL.

```typescript
// load-image.ts
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
```

---

## Pattern 1: Image Preview Hook

### Complete Implementation

```typescript
// use-image-preview.ts
import { useState, useEffect, useCallback } from "react";
import type { ChangeEvent } from "react";

interface ImagePreviewState {
  file: File | null;
  previewUrl: string | null;
  dimensions: { width: number; height: number } | null;
  error: string | null;
}

const INITIAL_STATE: ImagePreviewState = {
  file: null,
  previewUrl: null,
  dimensions: null,
  error: null,
};

export function useImagePreview() {
  const [state, setState] = useState<ImagePreviewState>(INITIAL_STATE);

  // Cleanup object URL on unmount or when previewUrl changes
  useEffect(() => {
    const currentUrl = state.previewUrl;
    return () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [state.previewUrl]);

  const setFile = useCallback((file: File | null) => {
    // Revoke previous URL before creating new one
    setState((prev) => {
      if (prev.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return prev;
    });

    if (!file) {
      setState(INITIAL_STATE);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setState({
        ...INITIAL_STATE,
        error: "Selected file is not an image",
      });
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    // Load image to get dimensions
    const img = new Image();
    img.onload = () => {
      setState({
        file,
        previewUrl,
        dimensions: { width: img.width, height: img.height },
        error: null,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      setState({
        ...INITIAL_STATE,
        error: "Failed to load image",
      });
    };
    img.src = previewUrl;
  }, []);

  const clear = useCallback(() => {
    setState((prev) => {
      if (prev.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return INITIAL_STATE;
    });
  }, []);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      setFile(file);
      // Reset input to allow re-selecting same file
      event.target.value = "";
    },
    [setFile],
  );

  return {
    ...state,
    setFile,
    clear,
    handleInputChange,
    hasImage: state.previewUrl !== null,
  };
}
```

**Why good:** Tracks dimensions for layout, validates image type, handles load errors, resets input for re-selection, proper cleanup in multiple places

---

## Pattern 2: Image Preview Component

### Complete Implementation

```typescript
// image-preview.tsx
import type { ReactNode } from 'react';
import { useImagePreview } from './use-image-preview';

interface ImagePreviewProps {
  onImageSelected?: (file: File) => void;
  onImageCleared?: () => void;
  accept?: string;
  maxSizeBytes?: number;
  children?: ReactNode;
  className?: string;
}

const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const DEFAULT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

export function ImagePreview({
  onImageSelected,
  onImageCleared,
  accept = DEFAULT_ACCEPT,
  maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
  children,
  className,
}: ImagePreviewProps) {
  const {
    file,
    previewUrl,
    dimensions,
    error,
    setFile,
    clear,
    hasImage,
  } = useImagePreview();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      if (selectedFile.size > maxSizeBytes) {
        const maxMB = maxSizeBytes / 1024 / 1024;
        alert(`File too large. Maximum size is ${maxMB}MB.`);
        event.target.value = '';
        return;
      }

      setFile(selectedFile);
      onImageSelected?.(selectedFile);
    }

    event.target.value = '';
  };

  const handleClear = () => {
    clear();
    onImageCleared?.();
  };

  return (
    <div className={className} data-has-image={hasImage || undefined}>
      <input
        type="file"
        accept={accept}
        onChange={handleFileChange}
        aria-label="Select image"
      />

      {error && (
        <p role="alert" data-error>
          {error}
        </p>
      )}

      {previewUrl && (
        <div data-preview-container>
          <img
            src={previewUrl}
            alt="Preview of selected image"
            data-preview-image
          />

          {dimensions && (
            <p data-dimensions>
              {dimensions.width} x {dimensions.height}
            </p>
          )}

          {file && (
            <p data-file-info>
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}

          <button
            type="button"
            onClick={handleClear}
            aria-label="Remove selected image"
          >
            Remove
          </button>
        </div>
      )}

      {!previewUrl && children}
    </div>
  );
}
```

**Why good:** Size validation before processing, exposes callbacks for parent integration, displays file info and dimensions, accessible labels and alerts, style-agnostic via className and data-attributes

---

## Pattern 3: Image Dimension Extraction and Validation

### Without Loading Full Image

```typescript
// image-dimensions.ts

interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Get image dimensions efficiently.
 * Uses createImageBitmap (avoids layout/decode) with Image element fallback.
 */
export async function getImageDimensions(file: File): Promise<ImageDimensions> {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close(); // Free memory
      return dimensions;
    } catch {
      // Fall through to Image method
    }
  }

  // Fallback: Image element
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

/**
 * Validate image dimensions against constraints
 */
export async function validateImageDimensions(
  file: File,
  constraints: {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    aspectRatio?: number;
    aspectRatioTolerance?: number;
  },
): Promise<{ valid: boolean; dimensions: ImageDimensions; errors: string[] }> {
  const {
    minWidth = 0,
    maxWidth = Infinity,
    minHeight = 0,
    maxHeight = Infinity,
    aspectRatio,
    aspectRatioTolerance = 0.01,
  } = constraints;

  const dimensions = await getImageDimensions(file);
  const errors: string[] = [];

  if (dimensions.width < minWidth) {
    errors.push(
      `Width must be at least ${minWidth}px (got ${dimensions.width}px)`,
    );
  }
  if (dimensions.width > maxWidth) {
    errors.push(
      `Width must be at most ${maxWidth}px (got ${dimensions.width}px)`,
    );
  }
  if (dimensions.height < minHeight) {
    errors.push(
      `Height must be at least ${minHeight}px (got ${dimensions.height}px)`,
    );
  }
  if (dimensions.height > maxHeight) {
    errors.push(
      `Height must be at most ${maxHeight}px (got ${dimensions.height}px)`,
    );
  }

  if (aspectRatio !== undefined) {
    const actualRatio = dimensions.width / dimensions.height;
    const ratioDiff = Math.abs(actualRatio - aspectRatio);
    if (ratioDiff > aspectRatioTolerance) {
      errors.push(
        `Aspect ratio must be ${aspectRatio.toFixed(2)} (got ${actualRatio.toFixed(2)})`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    dimensions,
    errors,
  };
}
```

**Why good:** Uses createImageBitmap when available (more efficient, avoids layout), properly frees bitmap memory, comprehensive constraint validation with detailed error messages

---

## Pattern 4: EXIF Orientation Parsing

### Read and Normalize Orientation

```typescript
// exif-orientation.ts
type Orientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const EXIF_MARKER = 0xffe1;
const ORIENTATION_TAG = 0x0112;
const ORIENTATIONS_NEEDING_SWAP = [5, 6, 7, 8];
const DEFAULT_QUALITY = 0.85;

/**
 * Read EXIF orientation from JPEG header without loading full image.
 * Only reads first 64KB of file data.
 */
export async function getExifOrientation(file: File): Promise<Orientation> {
  const HEADER_SIZE = 65536;
  const buffer = await file.slice(0, HEADER_SIZE).arrayBuffer();
  const view = new DataView(buffer);

  // Check for JPEG magic bytes
  if (view.getUint16(0) !== 0xffd8) {
    return 1; // Not JPEG, assume normal orientation
  }

  let offset = 2;
  while (offset < view.byteLength) {
    const marker = view.getUint16(offset);
    offset += 2;

    if (marker === EXIF_MARKER) {
      const length = view.getUint16(offset);
      const exifData = new DataView(buffer, offset + 2, length - 2);
      return parseExifOrientation(exifData);
    }

    const segmentLength = view.getUint16(offset);
    offset += segmentLength;
  }

  return 1; // No EXIF found
}

function parseExifOrientation(view: DataView): Orientation {
  const littleEndian = view.getUint16(6) === 0x4949;
  const ifdOffset = view.getUint32(10, littleEndian);
  const numEntries = view.getUint16(14 + ifdOffset, littleEndian);

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = 16 + ifdOffset + i * 12;
    const tag = view.getUint16(entryOffset, littleEndian);

    if (tag === ORIENTATION_TAG) {
      return view.getUint16(entryOffset + 8, littleEndian) as Orientation;
    }
  }

  return 1;
}

/**
 * Normalize orientation by re-drawing with correct transform.
 * Use ONLY for upload processing - modern browsers auto-rotate for display.
 */
export async function normalizeOrientation(file: File): Promise<Blob> {
  const orientation = await getExifOrientation(file);

  if (orientation === 1) {
    return file;
  }

  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get context");

  const needsSwap = ORIENTATIONS_NEEDING_SWAP.includes(orientation);
  canvas.width = needsSwap ? img.height : img.width;
  canvas.height = needsSwap ? img.width : img.height;

  applyOrientationTransform(ctx, orientation, img.width, img.height);
  ctx.drawImage(img, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Blob failed"))),
      file.type || "image/jpeg",
      DEFAULT_QUALITY,
    );
  });
}

function applyOrientationTransform(
  ctx: CanvasRenderingContext2D,
  orientation: Orientation,
  width: number,
  height: number,
): void {
  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, width, 0);
      break; // Flip horizontal
    case 3:
      ctx.transform(-1, 0, 0, -1, width, height);
      break; // Rotate 180
    case 4:
      ctx.transform(1, 0, 0, -1, 0, height);
      break; // Flip vertical
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break; // Rotate 90 CW + flip
    case 6:
      ctx.transform(0, 1, -1, 0, height, 0);
      break; // Rotate 90 CW
    case 7:
      ctx.transform(0, -1, -1, 0, height, width);
      break; // Rotate 90 CCW + flip
    case 8:
      ctx.transform(0, -1, 1, 0, 0, width);
      break; // Rotate 90 CCW
  }
}

// Uses loadImage utility defined above
```

**Why good:** Reads EXIF from first 64KB only (no full image decode), handles all 8 orientation values, clearly documents when manual handling is needed vs browser auto-rotation

---

## Pattern 5: Multiple Image Gallery Hook

### With Validation and Reordering

```typescript
// use-image-gallery.ts
import { useState, useCallback, useEffect } from "react";

interface GalleryImage {
  id: string;
  file: File;
  previewUrl: string;
  dimensions: { width: number; height: number } | null;
  status: "loading" | "ready" | "error";
}

const DEFAULT_MAX_IMAGES = 10;
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;

export function useImageGallery(
  options: {
    maxImages?: number;
    maxFileSizeBytes?: number;
  } = {},
) {
  const {
    maxImages = DEFAULT_MAX_IMAGES,
    maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE,
  } = options;

  const [images, setImages] = useState<GalleryImage[]>([]);

  const addImages = useCallback(
    (
      files: File[],
    ): { added: number; rejected: Array<{ name: string; reason: string }> } => {
      const rejected: Array<{ name: string; reason: string }> = [];
      const toAdd: GalleryImage[] = [];

      for (const file of files) {
        if (images.length + toAdd.length >= maxImages) {
          rejected.push({ name: file.name, reason: "Gallery full" });
          continue;
        }
        if (!file.type.startsWith("image/")) {
          rejected.push({ name: file.name, reason: "Not an image" });
          continue;
        }
        if (file.size > maxFileSizeBytes) {
          const maxMB = maxFileSizeBytes / 1024 / 1024;
          rejected.push({
            name: file.name,
            reason: `Exceeds ${maxMB}MB limit`,
          });
          continue;
        }

        const id = crypto.randomUUID();
        const previewUrl = URL.createObjectURL(file);

        toAdd.push({
          id,
          file,
          previewUrl,
          dimensions: null,
          status: "loading",
        });

        // Load dimensions asynchronously
        const img = new Image();
        img.onload = () => {
          setImages((current) =>
            current.map((item) =>
              item.id === id
                ? {
                    ...item,
                    dimensions: { width: img.width, height: img.height },
                    status: "ready" as const,
                  }
                : item,
            ),
          );
        };
        img.onerror = () => {
          setImages((current) =>
            current.map((item) =>
              item.id === id ? { ...item, status: "error" as const } : item,
            ),
          );
        };
        img.src = previewUrl;
      }

      if (toAdd.length > 0) {
        setImages((current) => [...current, ...toAdd]);
      }

      return { added: toAdd.length, rejected };
    },
    [images.length, maxImages, maxFileSizeBytes],
  );

  const removeImage = useCallback((id: string) => {
    setImages((current) => {
      const image = current.find((img) => img.id === id);
      if (image) URL.revokeObjectURL(image.previewUrl);
      return current.filter((img) => img.id !== id);
    });
  }, []);

  const reorderImages = useCallback((fromIndex: number, toIndex: number) => {
    setImages((current) => {
      const result = [...current];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      return result;
    });
  }, []);

  const clearAll = useCallback(() => {
    setImages((current) => {
      current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      return [];
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    images,
    addImages,
    removeImage,
    reorderImages,
    clearAll,
    count: images.length,
    canAddMore: images.length < maxImages,
    remainingSlots: maxImages - images.length,
  };
}
```

**Why good:** Per-file validation with rejection reasons, async dimension loading, reorder support, individual and batch URL cleanup, unmount cleanup

---

_Extended examples: [canvas.md](canvas.md) | [preview.md](preview.md)_
