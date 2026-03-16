# Next.js App Router - Route Groups

> Examples for organizing routes with different layouts using route groups. See [core.md](core.md) for foundational patterns.

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
import { MarketingNav } from "@/components/marketing-nav";
import { Footer } from "@/components/footer";

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
import { AppSidebar } from "@/components/app-sidebar";

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

**Why good:** Each section has appropriate layout, URLs don't include group name (/about not /marketing/about), clear separation of concerns

---

_See [core.md](core.md) for Server/Client Components, Streaming, Layouts, and Error Handling patterns._
