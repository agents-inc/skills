# Clerk Pre-Built Components Examples

> UI components, customization, and the appearance prop. See [SKILL.md](../SKILL.md) for core concepts.

**Core setup:** See [core.md](core.md). **Client hooks:** See [hooks.md](hooks.md). **Server auth:** See [server.md](server.md).

---

## Pattern 1: Show Component (Conditional Rendering)

The `<Show>` component (Core 3) replaces deprecated `<SignedIn>`, `<SignedOut>`, and `<Protect>`.

### Good Example -- Auth-Aware Navigation

```tsx
// components/nav-bar.tsx
"use client";

import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  OrganizationSwitcher,
} from "@clerk/nextjs";
import Link from "next/link";

export function NavBar() {
  return (
    <nav className="nav-bar">
      <Link href="/">Home</Link>

      <Show when="signed-in">
        <Link href="/dashboard">Dashboard</Link>
        <OrganizationSwitcher />
        <UserButton />
      </Show>

      <Show when="signed-out">
        <SignInButton mode="modal" />
        <SignUpButton mode="modal" />
      </Show>
    </nav>
  );
}
```

**Why good:** `<Show>` for conditional rendering, modal mode opens sign-in overlay (no page navigation), `<UserButton>` provides profile/sign-out menu, named export

### Good Example -- Role-Based UI

```tsx
// components/admin-nav.tsx
"use client";

import { Show } from "@clerk/nextjs";
import Link from "next/link";

export function AdminNav() {
  return (
    <nav>
      {/* Visible to all signed-in users */}
      <Show when="signed-in">
        <Link href="/dashboard">Dashboard</Link>
      </Show>

      {/* Visible only to org admins */}
      <Show when={{ role: "org:admin" }}>
        <Link href="/admin">Admin Panel</Link>
        <Link href="/admin/members">Manage Members</Link>
      </Show>

      {/* Permission-based rendering */}
      <Show when={{ permission: "org:billing:manage" }}>
        <Link href="/billing">Billing</Link>
      </Show>

      {/* Callback-based condition */}
      <Show
        when={(has) =>
          has({ role: "org:admin" }) || has({ permission: "org:reports:read" })
        }
        fallback={<p>You do not have access to reports.</p>}
      >
        <Link href="/reports">Reports</Link>
      </Show>
    </nav>
  );
}
```

**Why good:** Multiple `<Show>` conditions (string, object, callback), fallback for unauthorized users, combines role and permission checks

### Bad Example -- Using Deprecated Components

```tsx
// BAD: Removed in Core 3
import { SignedIn, SignedOut, Protect } from "@clerk/nextjs";

export default function Nav() {
  return (
    <>
      <SignedIn>
        <Link href="/dashboard">Dashboard</Link>
      </SignedIn>
      <SignedOut>
        <SignInButton />
      </SignedOut>
      <Protect role="admin" fallback={<p>No access</p>}>
        <Link href="/admin">Admin</Link>
      </Protect>
    </>
  );
}
```

**Why bad:** `<SignedIn>`, `<SignedOut>`, `<Protect>` removed in Core 3, must migrate to `<Show>` with `when` prop

---

## Pattern 2: UserButton and UserProfile

### Good Example -- UserButton with Custom Menu Items

```tsx
// components/user-menu.tsx
"use client";

import { UserButton } from "@clerk/nextjs";

export function UserMenu() {
  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Link
          label="My Orders"
          labelIcon={<ShoppingCartIcon />}
          href="/orders"
        />
        <UserButton.Link
          label="Billing"
          labelIcon={<CreditCardIcon />}
          href="/billing"
        />
        <UserButton.Action label="manageAccount" />
        <UserButton.Action label="signOut" />
      </UserButton.MenuItems>
    </UserButton>
  );
}
```

**Why good:** Custom menu items alongside built-in actions, `manageAccount` opens Clerk profile manager, type-safe built-in action labels

### Good Example -- UserProfile on Dedicated Page

```tsx
// app/settings/[[...settings]]/page.tsx
import { UserProfile } from "@clerk/nextjs";

export function SettingsPage() {
  return (
    <main className="settings-page">
      <h1>Account Settings</h1>
      <UserProfile />
    </main>
  );
}
```

**Why good:** Catch-all route handles Clerk's multi-tab navigation, full profile management UI (name, email, password, security, connected accounts)

---

## Pattern 3: Appearance Prop Customization

### Good Example -- Global Theme via ClerkProvider

```tsx
// app/layout.tsx
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

const BRAND_COLOR = "#6366f1";
const BORDER_RADIUS = "0.75rem";

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider
          appearance={{
            baseTheme: dark,
            variables: {
              colorPrimary: BRAND_COLOR,
              borderRadius: BORDER_RADIUS,
              fontFamily: "Inter, sans-serif",
            },
            elements: {
              // Target specific internal elements
              formButtonPrimary:
                "bg-indigo-600 hover:bg-indigo-700 text-white",
              card: "shadow-lg border border-gray-200",
              headerTitle: "text-2xl font-bold",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
```

**Why good:** Named constants for brand values, `variables` for broad theme changes, `elements` for specific component targeting, dark theme as base, applies to all Clerk components

### Good Example -- Per-Component Appearance Override

```tsx
// app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs";

const SIGN_IN_APPEARANCE = {
  elements: {
    rootBox: "mx-auto max-w-md",
    card: "rounded-xl shadow-2xl",
    headerTitle: "text-3xl font-bold text-center",
    headerSubtitle: "text-gray-500 text-center",
    socialButtonsBlockButton: "rounded-lg border-2",
  },
} as const;

export function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <SignIn appearance={SIGN_IN_APPEARANCE} />
    </main>
  );
}
```

**Why good:** Per-component override (doesn't affect other Clerk components), extracted to named constant, `as const` for type safety, centered layout

### Good Example -- Stacking Multiple Themes

```tsx
// app/layout.tsx
import { ClerkProvider } from "@clerk/nextjs";
import { dark, neobrutalism } from "@clerk/themes";

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider
          appearance={{
            baseTheme: [dark, neobrutalism],
            variables: {
              colorPrimary: "#ff6b6b",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
```

**Why good:** Themes stack in order (last wins for conflicts), custom variables applied on top, easy to swap themes

---

## Pattern 4: SignIn and SignUp with Routing

### Good Example -- Modal Mode

```tsx
// components/auth-buttons.tsx
"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";

export function AuthButtons() {
  return (
    <div className="auth-buttons">
      <SignInButton mode="modal">
        <button className="btn btn-primary">Sign In</button>
      </SignInButton>

      <SignUpButton mode="modal">
        <button className="btn btn-secondary">Create Account</button>
      </SignUpButton>
    </div>
  );
}
```

**Why good:** Modal mode keeps user on current page, custom button styling by wrapping with your own element, no page navigation required

### Good Example -- Redirect Mode with Custom Routing

```tsx
// components/auth-buttons.tsx
"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";

const SIGN_IN_REDIRECT = "/dashboard";
const SIGN_UP_REDIRECT = "/onboarding";

export function AuthButtons() {
  return (
    <div className="auth-buttons">
      <SignInButton
        mode="redirect"
        forceRedirectUrl={SIGN_IN_REDIRECT}
      >
        <button className="btn btn-primary">Sign In</button>
      </SignInButton>

      <SignUpButton
        mode="redirect"
        forceRedirectUrl={SIGN_UP_REDIRECT}
      >
        <button className="btn btn-secondary">Get Started</button>
      </SignUpButton>
    </div>
  );
}
```

**Why good:** Named constants for redirect URLs, redirect mode navigates to dedicated auth pages, `forceRedirectUrl` overrides default redirect

---

## Pattern 5: OrganizationSwitcher

### Good Example -- Switcher with Creation

```tsx
// components/org-switcher.tsx
"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";

export function OrgSwitcher() {
  return (
    <OrganizationSwitcher
      hidePersonal
      afterCreateOrganizationUrl="/org/:slug"
      afterSelectOrganizationUrl="/org/:slug"
      appearance={{
        elements: {
          rootBox: "w-full",
          organizationSwitcherTrigger:
            "w-full justify-between rounded-lg border p-2",
        },
      }}
    />
  );
}
```

**Why good:** `hidePersonal` removes personal workspace option (B2B apps), `:slug` placeholder in URLs auto-replaced with org slug, custom styling for full-width trigger

---

_For client hooks, see [hooks.md](hooks.md). For server-side auth, see [server.md](server.md). For organizations, see [organizations.md](organizations.md)._
