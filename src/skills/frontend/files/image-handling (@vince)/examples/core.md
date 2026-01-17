# Image Handling Core Examples

> Core code examples for image handling patterns. Reference from [SKILL.md](../SKILL.md).

**Extended examples:**

- [canvas.md](canvas.md) - Canvas API manipulation, step-down scaling
- [preview.md](preview.md) - Preview generation, thumbnails, galleries

---

## Pattern 1: Basic Image Preview Hook

### Complete Implementation

```typescript
// use-image-preview.ts
import { useState, useEffect, useCallback } from 'react';
import type { ChangeEvent } from 'react';

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

    // Validate it's an image
    if (!file.type.startsWith('image/')) {
      setState({
        ...INITIAL_STATE,
        error: 'Selected file is not an image',
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
        error: 'Failed to load image',
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
      event.target.value = '';
    },
    [setFile]
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
    handleInputChange,
    hasImage,
  } = useImagePreview();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      // Validate size
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
        id="image-preview-input"
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

**Why good:** Size validation before processing, exposes callbacks for parent integration, displays file info and dimensions, accessible labels and alerts

---

## Pattern 3: Multiple Image Gallery

### Complete Implementation

```typescript
// use-image-gallery.ts
import { useState, useCallback, useEffect } from 'react';

interface GalleryImage {
  id: string;
  file: File;
  previewUrl: string;
  dimensions: { width: number; height: number } | null;
  status: 'loading' | 'ready' | 'error';
}

interface UseImageGalleryOptions {
  maxImages?: number;
  maxFileSizeBytes?: number;
}

const DEFAULT_MAX_IMAGES = 10;
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;

export function useImageGallery(options: UseImageGalleryOptions = {}) {
  const {
    maxImages = DEFAULT_MAX_IMAGES,
    maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE,
  } = options;

  const [images, setImages] = useState<GalleryImage[]>([]);

  const addImages = useCallback(
    (files: File[]): { added: number; rejected: Array<{ name: string; reason: string }> } => {
      const rejected: Array<{ name: string; reason: string }> = [];
      const toAdd: GalleryImage[] = [];

      for (const file of files) {
        // Check capacity
        if (images.length + toAdd.length >= maxImages) {
          rejected.push({ name: file.name, reason: 'Gallery full' });
          continue;
        }

        // Check file type
        if (!file.type.startsWith('image/')) {
          rejected.push({ name: file.name, reason: 'Not an image' });
          continue;
        }

        // Check file size
        if (file.size > maxFileSizeBytes) {
          const maxMB = maxFileSizeBytes / 1024 / 1024;
          rejected.push({ name: file.name, reason: `Exceeds ${maxMB}MB limit` });
          continue;
        }

        const id = crypto.randomUUID();
        const previewUrl = URL.createObjectURL(file);

        toAdd.push({
          id,
          file,
          previewUrl,
          dimensions: null,
          status: 'loading',
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
                    status: 'ready' as const,
                  }
                : item
            )
          );
        };
        img.onerror = () => {
          setImages((current) =>
            current.map((item) =>
              item.id === id ? { ...item, status: 'error' as const } : item
            )
          );
        };
        img.src = previewUrl;
      }

      if (toAdd.length > 0) {
        setImages((current) => [...current, ...toAdd]);
      }

      return { added: toAdd.length, rejected };
    },
    [images.length, maxImages, maxFileSizeBytes]
  );

  const removeImage = useCallback((id: string) => {
    setImages((current) => {
      const image = current.find((img) => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.previewUrl);
      }
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

**Why good:** Tracks loading state per image, validates each file individually, returns rejection reasons for user feedback, supports reordering, proper cleanup on remove and unmount

---

## Pattern 4: File to Blob Conversion

### For Form Submission

```typescript
// file-conversion.ts

/**
 * Convert a Blob back to a File for form submission
 */
export function blobToFile(blob: Blob, fileName: string, mimeType?: string): File {
  return new File([blob], fileName, {
    type: mimeType ?? blob.type,
    lastModified: Date.now(),
  });
}

/**
 * Read file as ArrayBuffer for binary operations
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read as ArrayBuffer'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Read file as Data URL (Base64)
 * Use sparingly - creates large strings in memory
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read as Data URL'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}
```

**Why good:** Preserves filename and type in File conversion, separate functions for different needs, warns about Data URL memory impact

---

## Pattern 5: Image Dimension Extraction

### Without Loading Full Image

```typescript
// image-dimensions.ts

interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Get image dimensions without fully decoding the image
 * More efficient than creating Image element for dimension check only
 */
export async function getImageDimensions(file: File): Promise<ImageDimensions> {
  // Try createImageBitmap first (most efficient)
  if ('createImageBitmap' in window) {
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
      reject(new Error('Failed to load image'));
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
  }
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
    errors.push(`Width must be at least ${minWidth}px (got ${dimensions.width}px)`);
  }
  if (dimensions.width > maxWidth) {
    errors.push(`Width must be at most ${maxWidth}px (got ${dimensions.width}px)`);
  }
  if (dimensions.height < minHeight) {
    errors.push(`Height must be at least ${minHeight}px (got ${dimensions.height}px)`);
  }
  if (dimensions.height > maxHeight) {
    errors.push(`Height must be at most ${maxHeight}px (got ${dimensions.height}px)`);
  }

  if (aspectRatio !== undefined) {
    const actualRatio = dimensions.width / dimensions.height;
    const ratioDiff = Math.abs(actualRatio - aspectRatio);
    if (ratioDiff > aspectRatioTolerance) {
      errors.push(
        `Aspect ratio must be ${aspectRatio.toFixed(2)} (got ${actualRatio.toFixed(2)})`
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

**Why good:** Uses createImageBitmap when available (more efficient), properly frees bitmap memory, comprehensive constraint validation with detailed error messages

---

_Extended examples: [canvas.md](canvas.md) | [preview.md](preview.md)_
