# Image Handling — Core Examples

> Preview, dimensions and EXIF. Decisions are in [SKILL.md](../SKILL.md);
> [canvas.md](canvas.md) has the processing pipeline and [preview.md](preview.md) the presentation
> patterns.

---

## Shared helper: `loadImage`

Most patterns below start here. The temporary URL is revoked in both callbacks, so a decode failure
leaks nothing.

```typescript
// load-image.ts
export function loadImage(file: File | Blob): Promise<HTMLImageElement> {
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

## Pattern 1: Preview hook

The live URL is held in a ref as well as in state. Revoking is a side effect, so it belongs in the
event handler and the effect cleanup — never inside a state updater, which React may call more than
once.

```typescript
// use-image-preview.ts
import { useCallback, useEffect, useRef, useState } from "react";
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
  const urlRef = useRef<string | null>(null);

  const revokeCurrent = useCallback(() => {
    if (!urlRef.current) return;
    URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  useEffect(() => revokeCurrent, [revokeCurrent]);

  const setFile = useCallback(
    (file: File | null) => {
      revokeCurrent();

      if (!file) {
        setState(INITIAL_STATE);
        return;
      }

      if (!file.type.startsWith("image/")) {
        setState({ ...INITIAL_STATE, error: "Selected file is not an image" });
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      urlRef.current = previewUrl;

      const img = new Image();
      img.onload = () => {
        // a newer selection may have replaced and revoked this URL mid-decode
        if (urlRef.current !== previewUrl) return;
        setState({
          file,
          previewUrl,
          dimensions: { width: img.width, height: img.height },
          error: null,
        });
      };
      img.onerror = () => {
        revokeCurrent();
        setState({ ...INITIAL_STATE, error: "Failed to load image" });
      };
      img.src = previewUrl;
    },
    [revokeCurrent],
  );

  const clear = useCallback(() => {
    revokeCurrent();
    setState(INITIAL_STATE);
  }, [revokeCurrent]);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setFile(event.target.files?.[0] ?? null);
      // clearing the value lets the same file be chosen again
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

Dimensions arrive asynchronously, so the state lands in one write after the decode rather than in
two — the layout never sees a URL without its size.

---

## Pattern 2: Preview component

Style-agnostic: a `className` passes through and every visual state is a data attribute.

```typescript
// image-preview.tsx
import type { ChangeEvent, ReactNode } from 'react';
import { useImagePreview } from './use-image-preview';

interface ImagePreviewProps {
  onImageSelected?: (file: File) => void;
  onImageCleared?: () => void;
  accept?: string;
  maxSizeBytes?: number;
  children?: ReactNode;
  className?: string;
}

const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const DEFAULT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

export function ImagePreview({
  onImageSelected,
  onImageCleared,
  accept = DEFAULT_ACCEPT,
  maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
  children,
  className,
}: ImagePreviewProps) {
  const { file, previewUrl, dimensions, error, setFile, clear, hasImage } =
    useImagePreview();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';
    if (!selectedFile) return;

    if (selectedFile.size > maxSizeBytes) {
      const maxMB = maxSizeBytes / 1024 / 1024;
      alert(`File too large. Maximum size is ${maxMB}MB.`);
      return;
    }

    setFile(selectedFile);
    onImageSelected?.(selectedFile);
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

      {error && <p role="alert" data-error>{error}</p>}

      {previewUrl && (
        <div data-preview-container>
          <img src={previewUrl} alt="Preview of selected image" data-preview-image />

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

          <button type="button" onClick={handleClear} aria-label="Remove selected image">
            Remove
          </button>
        </div>
      )}

      {!previewUrl && children}
    </div>
  );
}
```

---

## Pattern 3: Dimensions and validation

`createImageBitmap` reads the header without laying anything out, which is the cheapest way to ask
how big an image is. The `Image` fallback covers browsers that lack it and files it refuses.

```typescript
// image-dimensions.ts
interface ImageDimensions {
  width: number;
  height: number;
}

export async function getImageDimensions(file: File): Promise<ImageDimensions> {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close(); // holds decoded pixels until closed
      return dimensions;
    } catch {
      // fall through to the Image element
    }
  }

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

interface DimensionConstraints {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  aspectRatio?: number;
  aspectRatioTolerance?: number;
}

export async function validateImageDimensions(
  file: File,
  constraints: DimensionConstraints,
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
    // a tolerance is required: integer dimensions rarely divide to an exact ratio
    if (Math.abs(actualRatio - aspectRatio) > aspectRatioTolerance) {
      errors.push(
        `Aspect ratio must be ${aspectRatio.toFixed(2)} (got ${actualRatio.toFixed(2)})`,
      );
    }
  }

  return { valid: errors.length === 0, dimensions, errors };
}
```

Returning every failure rather than the first lets the UI say what is wrong in one pass.

---

## Pattern 4: EXIF orientation

Orientation lives in the APP1 segment near the start of a JPEG, so 64KB is enough to find it without
decoding anything.

Use `normalizeOrientation` only on bytes leaving the browser. Applying it and then rendering the
result gives you the rotation twice.

```typescript
// exif-orientation.ts
import { loadImage } from "./load-image";

type Orientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const EXIF_MARKER = 0xffe1;
const ORIENTATION_TAG = 0x0112;
const ORIENTATIONS_NEEDING_SWAP = [5, 6, 7, 8];
const DEFAULT_QUALITY = 0.85;
const HEADER_SIZE = 65_536;

export async function getExifOrientation(file: File): Promise<Orientation> {
  const buffer = await file.slice(0, HEADER_SIZE).arrayBuffer();
  const view = new DataView(buffer);

  if (view.getUint16(0) !== 0xffd8) return 1; // not a JPEG

  let offset = 2;
  while (offset < view.byteLength) {
    const marker = view.getUint16(offset);
    offset += 2;

    if (marker === EXIF_MARKER) {
      const length = view.getUint16(offset);
      return parseExifOrientation(new DataView(buffer, offset + 2, length - 2));
    }

    offset += view.getUint16(offset);
  }

  return 1;
}

function parseExifOrientation(view: DataView): Orientation {
  // TIFF headers declare their own byte order; 0x4949 is "II", little-endian
  const littleEndian = view.getUint16(6) === 0x4949;
  const ifdOffset = view.getUint32(10, littleEndian);
  const numEntries = view.getUint16(14 + ifdOffset, littleEndian);

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = 16 + ifdOffset + i * 12;
    if (view.getUint16(entryOffset, littleEndian) === ORIENTATION_TAG) {
      return view.getUint16(entryOffset + 8, littleEndian) as Orientation;
    }
  }

  return 1;
}

export async function normalizeOrientation(file: File): Promise<Blob> {
  const orientation = await getExifOrientation(file);
  if (orientation === 1) return file;

  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  // 5-8 rotate by a quarter turn, so the output is the transpose
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
      break; // flip X
    case 3:
      ctx.transform(-1, 0, 0, -1, width, height);
      break; // 180
    case 4:
      ctx.transform(1, 0, 0, -1, 0, height);
      break; // flip Y
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break; // 90 CW + flip
    case 6:
      ctx.transform(0, 1, -1, 0, height, 0);
      break; // 90 CW
    case 7:
      ctx.transform(0, -1, -1, 0, height, width);
      break; // 90 CCW + flip
    case 8:
      ctx.transform(0, -1, 1, 0, 0, width);
      break; // 90 CCW
  }
}
```

---

## Pattern 5: Gallery state

Per-file rejection reasons, asynchronous dimension loading, and one URL revoked per removal. The
live URLs are mirrored into a ref so the unmount cleanup does not close over a stale list.

```typescript
// use-image-gallery.ts
import { useCallback, useEffect, useRef, useState } from "react";

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
  options: { maxImages?: number; maxFileSizeBytes?: number } = {},
) {
  const {
    maxImages = DEFAULT_MAX_IMAGES,
    maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE,
  } = options;

  const [images, setImages] = useState<GalleryImage[]>([]);
  const urlsRef = useRef(new Set<string>());

  const revoke = useCallback((url: string) => {
    URL.revokeObjectURL(url);
    urlsRef.current.delete(url);
  }, []);

  useEffect(
    () => () => {
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current.clear();
    },
    [],
  );

  const addImages = useCallback(
    (files: File[]) => {
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
        urlsRef.current.add(previewUrl);

        toAdd.push({
          id,
          file,
          previewUrl,
          dimensions: null,
          status: "loading",
        });

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

  const removeImage = useCallback(
    (id: string) => {
      const image = images.find((img) => img.id === id);
      if (image) revoke(image.previewUrl);
      setImages((current) => current.filter((img) => img.id !== id));
    },
    [images, revoke],
  );

  const reorderImages = useCallback((fromIndex: number, toIndex: number) => {
    setImages((current) => {
      const result = [...current];
      const [moved] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, moved);
      return result;
    });
  }, []);

  const clearAll = useCallback(() => {
    images.forEach((img) => revoke(img.previewUrl));
    setImages([]);
  }, [images, revoke]);

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
