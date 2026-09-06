# File Upload — Preview Examples

> A thumbnail for a file the user has just chosen. Decisions are in [SKILL.md](../SKILL.md); the
> file-list state that usually owns these URLs is in [core.md](core.md).

Preview here means displaying the file as picked. Resizing, cropping, converting or normalising
EXIF orientation before sending is image processing, and this skill sends the `File` it is given.

---

## Pattern 15: Preview with cleanup

The live URL is held in a ref as well as in state, because revoking is a side effect: it belongs in
the handler and the effect cleanup, not inside a state updater React may run more than once.

```typescript
// use-image-preview.ts
import { useCallback, useEffect, useRef, useState } from "react";

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
  const urlRef = useRef<string | null>(null);

  const revokeCurrent = useCallback(() => {
    if (!urlRef.current) return;
    URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  useEffect(() => revokeCurrent, [revokeCurrent]);

  const generatePreview = useCallback(
    async (file: File) => {
      revokeCurrent();
      setLoading(true);
      setError(null);

      try {
        if (!file.type.startsWith("image/")) {
          throw new Error("File is not an image");
        }

        const url = URL.createObjectURL(file);
        urlRef.current = url;

        const { width, height } = await getImageDimensions(url);
        // a newer call may have replaced and revoked this URL while we awaited
        if (urlRef.current !== url) return;
        setPreview({ url, width, height, aspectRatio: width / height });
      } catch (err) {
        revokeCurrent();
        setPreview(null);
        setError(
          err instanceof Error ? err.message : "Failed to generate preview",
        );
      } finally {
        setLoading(false);
      }
    },
    [revokeCurrent],
  );

  const clearPreview = useCallback(() => {
    revokeCurrent();
    setPreview(null);
    setError(null);
  }, [revokeCurrent]);

  return { preview, loading, error, generatePreview, clearPreview };
}

function getImageDimensions(
  url: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}
```

Dimensions land with the URL in one state write, so the layout never sees a preview whose size it
does not yet know — which is what would cause the list to jump as each thumbnail decodes.

Rendering it is one `<img src={preview.url}>`. Reserve the space from `aspectRatio` before the
image paints, or a list of previews reflows as each one arrives.

For a non-image file, there is nothing to preview: show the extension or a type icon from
`file.type` and skip the object URL entirely.
