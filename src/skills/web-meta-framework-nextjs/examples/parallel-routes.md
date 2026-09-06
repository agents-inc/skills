# Next.js App Router — Parallel Routes and Modals

> Parallel slots, intercepting routes and the modal pattern. Read [core.md](core.md) for layouts and
> [server-components.md](server-components.md) for the Server/Client boundary first.

---

## Pattern: Dashboard with Multiple Slots

A `@name` folder is a slot: it arrives as a prop on the segment's layout and renders alongside
`children` rather than instead of it.

```
app/dashboard/
├── @analytics/
│   ├── page.tsx       slot content
│   └── default.tsx    what renders when the slot has no match
├── @team/
│   ├── page.tsx
│   └── default.tsx
├── layout.tsx         receives analytics and team as props
└── page.tsx           becomes children
```

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
  analytics,
  team,
}: {
  children: React.ReactNode;
  analytics: React.ReactNode;
  team: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">{children}</div>
      <div>{analytics}</div>
      <div>{team}</div>
    </div>
  );
}
```

**Why good:** Each slot fetches and streams on its own, gets its own `loading.tsx` and `error.tsx`,
and can be shown or hidden per user role from the layout. Slots do not appear in the URL — a
`default.tsx` in each one is what stops a hard refresh 404ing, and on Next.js 16 its absence fails
the build.

---

## Pattern: Photo Gallery Modal with Intercepting Routes

Interception matches a route from a different place in the tree, so a soft navigation renders the
modal while a direct visit renders the full page.

| Convention | Matches        |
| ---------- | -------------- |
| `(.)`      | the same level |
| `(..)`     | one level up   |
| `(..)(..)` | two levels up  |
| `(...)`    | the `app` root |

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
import { Modal } from "../../../../components/modal";
import { getPhoto } from "../../../../lib/data";

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
// app/photo/[id]/page.tsx — full page, rendered on direct navigation
import Link from "next/link";
import { getPhoto } from "../../../lib/data";

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
// app/page.tsx — the gallery
import Link from "next/link";
import { getPhotos } from "../lib/data";

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

**Why good:** Clicking a photo shows the modal at `/photo/123` with the gallery still behind it, the
back button closes it, and the same URL pasted into a new tab renders the full page. `router.back()`
rather than `router.push()` is what makes the browser history behave.

---

_See [core.md](core.md) for layouts, dynamic routes and error handling._
