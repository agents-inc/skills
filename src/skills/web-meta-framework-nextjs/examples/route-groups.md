# Next.js App Router — Route Groups

> Organising routes into sections with their own layouts. See [core.md](core.md) for routing and
> layouts.

---

## Pattern: Different Layouts per Section

### File Structure

```
app/
├── (marketing)/
│   ├── layout.tsx          # Marketing layout (navbar, footer)
│   ├── page.tsx            # Homepage (/)
│   ├── about/
│   │   └── page.tsx        # /about
│   └── pricing/
│       └── page.tsx        # /pricing
├── (app)/
│   ├── layout.tsx          # App layout (sidebar, no footer)
│   ├── dashboard/
│   │   └── page.tsx        # /dashboard
│   └── settings/
│       └── page.tsx        # /settings
└── (auth)/
    ├── layout.tsx          # Auth layout (centered, minimal)
    ├── login/
    │   └── page.tsx        # /login
    └── signup/
        └── page.tsx        # /signup
```

### Marketing Layout

```tsx
// app/(marketing)/layout.tsx
import { MarketingNav } from "./marketing-nav";
import { Footer } from "./footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MarketingNav />
      <main>{children}</main>
      <Footer />
    </>
  );
}
```

### App Layout

```tsx
// app/(app)/layout.tsx
import { AppSidebar } from "./app-sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <AppSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

### Auth Layout

```tsx
// app/(auth)/layout.tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
```

**Why good:** The parenthesised folder never reaches the URL — `/about`, not `/marketing/about` — so
three sections can carry three different chromes without nesting the paths. A group may also hold its
own root layout, in which case it acts as a separate root.

---

_See [core.md](core.md) for layouts, dynamic routes and error handling._
