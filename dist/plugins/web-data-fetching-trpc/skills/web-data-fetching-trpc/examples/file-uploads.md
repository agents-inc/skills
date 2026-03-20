# tRPC File Uploads with FormData

> Native file upload support in tRPC v11+. See [core.md](core.md) for setup patterns.

**Prerequisites**: Understand Pattern 1 (Router Setup) and Pattern 2 (CRUD Router) from core examples first.

> **Note:** File upload support requires tRPC v11+. This pattern is self-contained and can be added to any tRPC setup.

---

## Server-Side File Handler (tRPC v11+)

```typescript
// packages/api/src/routers/upload.ts
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const uploadRouter = router({
  // tRPC v11 supports FormData natively
  uploadAvatar: protectedProcedure
    .input(
      z.object({
        file: z.instanceof(File),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { file } = input;

      // Validate file size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `File too large. Max size: ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
        });
      }

      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
        });
      }

      // Upload to storage (e.g., S3)
      const url = await uploadToStorage(file, ctx.user.id);

      // Update user avatar
      await ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { avatarUrl: url },
      });

      return { url };
    }),
});

// Named export
export { uploadRouter };
```

---

## Client-Side File Upload

```typescript
// apps/client/components/avatar-upload.tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../lib/trpc";
import { useState } from "react";

const MAX_FILE_SIZE_MB = 5;

export function AvatarUpload() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<string | null>(null);

  const uploadMutation = useMutation({
    ...trpc.upload.uploadAvatar.mutationOptions(),
    onSuccess: () => {
      toast.success("Avatar uploaded!");
      queryClient.invalidateQueries({ queryKey: trpc.user.me.queryKey() });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side preview
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload
    uploadMutation.mutate({ file });
  };

  return (
    <div>
      {preview && <img src={preview} alt="Preview" />}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={uploadMutation.isPending}
      />
      {uploadMutation.isPending && <Spinner />}
    </div>
  );
}

// Named export
export { AvatarUpload };
```

---
