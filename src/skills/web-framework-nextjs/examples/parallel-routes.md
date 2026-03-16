# Next.js App Router - Parallel Routes and Modals

> Examples for parallel routes, intercepting routes, and modal patterns. See [core.md](core.md) for foundational patterns.

**Prerequisites**: Understand Server/Client Components and Layouts from core examples first.

---

## Pattern: Photo Gallery Modal with Intercepting Routes

### File Structure

```
app/
├── @modal/
│   ├── (.)photo/[id]/page.tsx
│   └── default.tsx
├── photo/[id]/page.tsx
├── page.tsx
└── layout.tsx
```

### Root Layout with Parallel Slot

```tsx
// app/layout.tsx
export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html>
      <body>
        {children}
        {modal}
      </body>
    </html>
  );
}
```

### Default Slot (Required)

```tsx
// app/@modal/default.tsx
export default function Default() {
  return null;
}
```

### Intercepted Route (Modal View)

```tsx
// app/@modal/(.)photo/[id]/page.tsx
import { Modal } from "@/components/modal";
import { getPhoto } from "@/lib/data";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PhotoModal({ params }: PageProps) {
  const { id } = await params;
  const photo = await getPhoto(id);

  return (
    <Modal>
      <img src={photo.url} alt={photo.title} className="max-w-full" />
      <h2 className="mt-4 text-xl font-semibold">{photo.title}</h2>
      <p className="text-gray-600">{photo.description}</p>
    </Modal>
  );
}
```

### Full Page Route (Direct Navigation)

```tsx
// app/photo/[id]/page.tsx (Full page for direct navigation)
import { getPhoto } from "@/lib/data";
import Link from "next/link";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PhotoPage({ params }: PageProps) {
  const { id } = await params;
  const photo = await getPhoto(id);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link href="/" className="text-blue-500 hover:underline">
        &larr; Back to Gallery
      </Link>
      <img src={photo.url} alt={photo.title} className="mt-4 w-full" />
      <h1 className="mt-4 text-2xl font-bold">{photo.title}</h1>
      <p className="mt-2 text-gray-600">{photo.description}</p>
    </div>
  );
}
```

### Modal Component

```tsx
// components/modal.tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

interface ModalProps {
  children: React.ReactNode;
}

export function Modal({ children }: ModalProps) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    },
    [handleClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
    >
      <div className="bg-white rounded-lg p-6 max-w-2xl max-h-[90vh] overflow-auto relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          &times;
        </button>
        {children}
      </div>
    </div>
  );
}
```

### Gallery Page

```tsx
// app/page.tsx (Gallery)
import Link from "next/link";
import { getPhotos } from "@/lib/data";

export default async function GalleryPage() {
  const photos = await getPhotos();

  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      {photos.map((photo) => (
        <Link key={photo.id} href={`/photo/${photo.id}`}>
          <img
            src={photo.thumbnail}
            alt={photo.title}
            className="w-full h-48 object-cover rounded hover:opacity-90"
          />
        </Link>
      ))}
    </div>
  );
}
```

**Why good:** Clicking photo opens modal with URL `/photo/123`, gallery stays visible behind modal, browser back closes modal, direct link to `/photo/123` shows full page, URL is shareable

---

_See [core.md](core.md) for Server/Client Components, Streaming, Layouts, and Error Handling patterns._
