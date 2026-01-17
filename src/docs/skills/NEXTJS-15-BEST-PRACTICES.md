# Next.js 14/15 Best Practices Research

> Research document for creating atomic skills. Based on Next.js 15 App Router patterns as of January 2025.

---

## Table of Contents

1. [App Router Patterns](#1-app-router-patterns)
2. [Server vs Client Components](#2-server-vs-client-components)
3. [Server Actions](#3-server-actions)
4. [Route Handlers](#4-route-handlers)
5. [Middleware Patterns](#5-middleware-patterns)
6. [Image Optimization](#6-image-optimization)
7. [Font Optimization](#7-font-optimization)
8. [Metadata/SEO](#8-metadataseo)
9. [ISR and Static Generation](#9-isr-and-static-generation)
10. [Streaming and Suspense](#10-streaming-and-suspense)

---

## 1. App Router Patterns

### Core Patterns

#### File Convention Structure

```
app/
├── layout.tsx          # Root layout (required) - wraps all pages
├── page.tsx            # Homepage (/)
├── loading.tsx         # Loading UI (Suspense fallback)
├── error.tsx           # Error boundary for this segment
├── not-found.tsx       # 404 page
├── global-error.tsx    # Root-level error boundary
├── (auth)/             # Route group (no URL impact)
│   ├── login/
│   │   └── page.tsx    # /login
│   └── register/
│       └── page.tsx    # /register
├── dashboard/
│   ├── layout.tsx      # Nested layout for /dashboard/*
│   ├── page.tsx        # /dashboard
│   ├── loading.tsx     # Loading for dashboard segment
│   ├── error.tsx       # Error boundary for dashboard
│   └── settings/
│       └── page.tsx    # /dashboard/settings
└── products/
    └── [id]/
        └── page.tsx    # /products/:id (dynamic route)
```

#### Root Layout (Required)

```typescript
// app/layout.tsx
import type { ReactNode } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | My App',
    default: 'My App',
  },
  description: 'Application description',
};

interface RootLayoutProps {
  children: ReactNode;
}

export function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <header>{/* Navigation */}</header>
        <main>{children}</main>
        <footer>{/* Footer */}</footer>
      </body>
    </html>
  );
}

export default RootLayout;
```

#### Nested Layouts

```typescript
// app/dashboard/layout.tsx
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/sidebar';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="dashboard-container">
      <Sidebar />
      <div className="dashboard-content">{children}</div>
    </div>
  );
}

export default DashboardLayout;
```

#### Error Boundaries

```typescript
// app/dashboard/error.tsx
'use client'; // Error boundaries MUST be Client Components

import { useEffect } from 'react';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Log error to monitoring service
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div role="alert">
      <h2>Something went wrong!</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}

export default ErrorBoundary;
```

#### Global Error Boundary

```typescript
// app/global-error.tsx
'use client';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// Must include <html> and <body> since it replaces root layout
export function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html>
      <body>
        <h1>Fatal Error</h1>
        <p>{error.message}</p>
        <button onClick={reset}>Reload Application</button>
      </body>
    </html>
  );
}

export default GlobalError;
```

#### Route Groups for Organization

```typescript
// app/(marketing)/layout.tsx - Marketing pages layout
// app/(app)/layout.tsx - Application pages layout (requires auth)
// URL structure is NOT affected by (folder) convention

// Example: Separate layouts for public vs authenticated routes
// app/
// ├── (marketing)/
// │   ├── layout.tsx     # Public layout
// │   ├── page.tsx       # / (homepage)
// │   ├── about/page.tsx # /about
// │   └── pricing/page.tsx
// └── (app)/
//     ├── layout.tsx     # Authenticated layout with sidebar
//     ├── dashboard/page.tsx # /dashboard
//     └── settings/page.tsx  # /settings
```

#### Parallel Routes

```typescript
// app/layout.tsx with parallel routes
// Slots: @modal, @sidebar

// app/
// ├── layout.tsx
// ├── page.tsx
// ├── @modal/
// │   ├── default.tsx    # Default when slot not active
// │   └── (.)products/[id]/page.tsx  # Intercepting route for modal
// └── @sidebar/
//     └── default.tsx

interface RootLayoutProps {
  children: ReactNode;
  modal: ReactNode;
  sidebar: ReactNode;
}

export function RootLayout({ children, modal, sidebar }: RootLayoutProps) {
  return (
    <html>
      <body>
        <div className="layout">
          <aside>{sidebar}</aside>
          <main>{children}</main>
          {modal}
        </div>
      </body>
    </html>
  );
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN: God layouts with too much logic
// BAD
export function Layout({ children }: { children: ReactNode }) {
  const user = await getUser(); // Data fetching in layout
  const settings = await getSettings();
  const notifications = await getNotifications();
  // ... 500 lines of logic
  return <div>{children}</div>;
}

// GOOD: Keep layouts thin, delegate to components
export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="layout">
      <Header /> {/* Header fetches its own data */}
      <Sidebar /> {/* Sidebar fetches its own data */}
      {children}
    </div>
  );
}

// ANTI-PATTERN: Missing error.tsx in critical routes
// Always add error.tsx to routes that fetch data or have complex logic

// ANTI-PATTERN: Not using Route Groups for organization
// BAD: Flat structure with unrelated pages
// app/login/page.tsx
// app/dashboard/page.tsx
// app/api-docs/page.tsx

// GOOD: Grouped by feature/concern
// app/(auth)/login/page.tsx
// app/(app)/dashboard/page.tsx
// app/(docs)/api-docs/page.tsx
```

### When to Use

| Pattern | Use When | Avoid When |
|---------|----------|------------|
| Nested Layouts | Shared UI across child routes | Every page needs different layout |
| Route Groups | Organizing code, separate layouts | Simple flat structure is sufficient |
| Parallel Routes | Split views, modals, dashboards | Simple single-content pages |
| Error Boundaries | Data fetching, external APIs | Static content pages |
| loading.tsx | Page-level loading states | Need granular component loading |

### Performance Considerations

- Layouts are **not re-rendered** on navigation between child routes
- Use layouts for persistent UI elements (navigation, sidebars)
- Push data fetching to leaf components, not layouts
- Add `loading.tsx` at meaningful boundaries for perceived performance
- `error.tsx` boundaries prevent full page crashes

---

## 2. Server vs Client Components

### Decision Tree

```
Is the component interactive (onClick, onChange, form inputs)?
├─ YES → Client Component ('use client')
└─ NO → Does it use React hooks (useState, useEffect)?
    ├─ YES → Client Component
    └─ NO → Does it need browser APIs (window, document, localStorage)?
        ├─ YES → Client Component
        └─ NO → Server Component (default)
```

### Core Patterns

#### Server Component (Default)

```typescript
// app/products/page.tsx
// Server Component - NO 'use client' directive

import { db } from '@/lib/db';
import { ProductCard } from '@/components/product-card';

interface Product {
  id: string;
  name: string;
  price: number;
}

async function getProducts(): Promise<Product[]> {
  // Direct database access - no API needed
  return db.products.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function ProductsPage() {
  const products = await getProducts();

  return (
    <div className="products-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export default ProductsPage;
```

#### Client Component

```typescript
// components/add-to-cart-button.tsx
'use client';

import { useState, useTransition } from 'react';
import { addToCart } from '@/actions/cart';

interface AddToCartButtonProps {
  productId: string;
}

export function AddToCartButton({ productId }: AddToCartButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = () => {
    startTransition(async () => {
      const result = await addToCart(productId);
      setMessage(result.message);
    });
  };

  return (
    <div>
      <button onClick={handleClick} disabled={isPending}>
        {isPending ? 'Adding...' : 'Add to Cart'}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}
```

#### Composition Pattern: Server Parent + Client Child

```typescript
// app/products/[id]/page.tsx (Server Component)
import { db } from '@/lib/db';
import { AddToCartButton } from '@/components/add-to-cart-button';
import { ProductGallery } from '@/components/product-gallery';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function ProductPage({ params }: PageProps) {
  const { id } = await params; // Next.js 15: params is async
  const product = await db.products.findUnique({ where: { id } });

  if (!product) {
    notFound();
  }

  return (
    <div>
      <h1>{product.name}</h1>
      {/* Client Component for interactivity */}
      <ProductGallery images={product.images} />
      <p>{product.description}</p>
      <p>${product.price}</p>
      {/* Client Component for cart functionality */}
      <AddToCartButton productId={product.id} />
    </div>
  );
}

export default ProductPage;
```

#### Passing Server Data to Client Components

```typescript
// Server Component passes serializable data to Client Component
// app/dashboard/page.tsx (Server)
import { getUser } from '@/lib/auth';
import { DashboardClient } from './dashboard-client';

export async function DashboardPage() {
  const user = await getUser();

  // Pass serializable data (no functions, no classes)
  return (
    <DashboardClient
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
      }}
    />
  );
}

// dashboard-client.tsx (Client)
'use client';

interface User {
  id: string;
  name: string;
  email: string;
}

interface DashboardClientProps {
  user: User;
}

export function DashboardClient({ user }: DashboardClientProps) {
  return <div>Welcome, {user.name}!</div>;
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN: 'use client' at the top level
// BAD - entire page becomes client-side
// app/products/page.tsx
'use client'; // DON'T do this for pages!

// ANTI-PATTERN: Passing non-serializable data
// BAD
<ClientComponent
  onSubmit={async (data) => await saveData(data)} // Functions can't be passed
  user={userClassInstance} // Class instances can't be serialized
/>

// GOOD: Use Server Actions for mutations
<ClientComponent userId={user.id} /> // Pass only serializable data

// ANTI-PATTERN: Unnecessary 'use client' for static content
// BAD
'use client';
export function StaticCard({ title }: { title: string }) {
  return <div>{title}</div>; // No interactivity - doesn't need 'use client'
}

// ANTI-PATTERN: Importing Server Component into Client Component
// BAD - This won't work as expected
'use client';
import { ServerDataComponent } from './server-component'; // Will be converted to Client
```

### When to Use

| Component Type | Use Cases |
|----------------|-----------|
| Server Component | Data fetching, database access, sensitive logic, SEO content, static UI |
| Client Component | Event handlers, useState/useEffect, browser APIs, third-party client libs |

### Performance Considerations

- Server Components: **Zero JavaScript** sent to browser
- Client Components: Increase bundle size and hydration time
- Push `'use client'` as **deep as possible** in the tree
- Server Components can `await` - no loading state waterfall
- Avoid prop drilling by keeping data fetching close to usage

---

## 3. Server Actions

### Core Patterns

#### Basic Server Action

```typescript
// actions/user.ts
'use server';

import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

interface ActionResult {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
}

export async function updateUser(
  userId: string,
  formData: FormData
): Promise<ActionResult> {
  // 1. Validate input
  const validatedFields = UpdateUserSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Validation failed',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  // 2. Perform mutation
  try {
    await db.users.update({
      where: { id: userId },
      data: validatedFields.data,
    });

    // 3. Revalidate cache
    revalidatePath('/profile');

    return { success: true, message: 'Profile updated successfully' };
  } catch (error) {
    return { success: false, message: 'Failed to update profile' };
  }
}
```

#### Server Action with Form (Progressive Enhancement)

```typescript
// app/contact/page.tsx
import { submitContact } from '@/actions/contact';

export function ContactPage() {
  return (
    <form action={submitContact}>
      <label htmlFor="email">Email</label>
      <input type="email" id="email" name="email" required />

      <label htmlFor="message">Message</label>
      <textarea id="message" name="message" required />

      <button type="submit">Send</button>
    </form>
  );
}

// actions/contact.ts
'use server';

import { redirect } from 'next/navigation';

export async function submitContact(formData: FormData) {
  const email = formData.get('email') as string;
  const message = formData.get('message') as string;

  // Save to database or send email
  await saveContactMessage({ email, message });

  // Redirect after successful submission
  redirect('/contact/success');
}
```

#### Server Action with Client Component

```typescript
// components/newsletter-form.tsx
'use client';

import { useActionState } from 'react';
import { subscribeToNewsletter } from '@/actions/newsletter';

const initialState = {
  success: false,
  message: '',
};

export function NewsletterForm() {
  const [state, formAction, isPending] = useActionState(
    subscribeToNewsletter,
    initialState
  );

  return (
    <form action={formAction}>
      <input
        type="email"
        name="email"
        placeholder="Enter your email"
        required
        disabled={isPending}
      />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Subscribing...' : 'Subscribe'}
      </button>
      {state.message && (
        <p className={state.success ? 'success' : 'error'}>
          {state.message}
        </p>
      )}
    </form>
  );
}

// actions/newsletter.ts
'use server';

import { z } from 'zod';

interface State {
  success: boolean;
  message: string;
}

export async function subscribeToNewsletter(
  prevState: State,
  formData: FormData
): Promise<State> {
  const email = formData.get('email');

  const result = z.string().email().safeParse(email);
  if (!result.success) {
    return { success: false, message: 'Invalid email address' };
  }

  try {
    await addSubscriber(result.data);
    return { success: true, message: 'Successfully subscribed!' };
  } catch {
    return { success: false, message: 'Failed to subscribe' };
  }
}
```

#### Optimistic Updates

```typescript
// components/like-button.tsx
'use client';

import { useOptimistic, useTransition } from 'react';
import { toggleLike } from '@/actions/likes';

interface LikeButtonProps {
  postId: string;
  initialLikes: number;
  isLiked: boolean;
}

export function LikeButton({ postId, initialLikes, isLiked }: LikeButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticState, setOptimisticState] = useOptimistic(
    { likes: initialLikes, isLiked },
    (state, newIsLiked: boolean) => ({
      likes: newIsLiked ? state.likes + 1 : state.likes - 1,
      isLiked: newIsLiked,
    })
  );

  const handleClick = () => {
    startTransition(async () => {
      setOptimisticState(!optimisticState.isLiked);
      await toggleLike(postId);
    });
  };

  return (
    <button onClick={handleClick} disabled={isPending}>
      {optimisticState.isLiked ? '❤️' : '🤍'} {optimisticState.likes}
    </button>
  );
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN: Trusting client data
// BAD - Never trust prices from client
export async function createOrder(formData: FormData) {
  const price = formData.get('price'); // User can manipulate this!
  await db.orders.create({ data: { price } });
}

// GOOD - Always fetch prices server-side
export async function createOrder(formData: FormData) {
  const productId = formData.get('productId') as string;
  const product = await db.products.findUnique({ where: { id: productId } });
  await db.orders.create({ data: { price: product.price } });
}

// ANTI-PATTERN: Missing authentication/authorization
// BAD
export async function deletePost(postId: string) {
  await db.posts.delete({ where: { id: postId } }); // Anyone can delete!
}

// GOOD
export async function deletePost(postId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const post = await db.posts.findUnique({ where: { id: postId } });
  if (post.authorId !== session.userId) throw new Error('Forbidden');

  await db.posts.delete({ where: { id: postId } });
}

// ANTI-PATTERN: Not handling errors
// BAD
export async function updateProfile(formData: FormData) {
  await db.users.update({ ... }); // Unhandled errors crash the app
}

// GOOD
export async function updateProfile(formData: FormData) {
  try {
    await db.users.update({ ... });
    return { success: true };
  } catch (error) {
    console.error('Profile update failed:', error);
    return { success: false, message: 'Update failed' };
  }
}
```

### When to Use

| Use Server Actions | Use Route Handlers Instead |
|--------------------|---------------------------|
| Form submissions | Webhook endpoints |
| Mutations from UI | External API consumption |
| Data updates with revalidation | File uploads with progress |
| Progressive enhancement needed | Third-party integrations |

### Performance Considerations

- Server Actions use POST method automatically (CSRF protection)
- Progressive enhancement: Forms work without JavaScript
- Use `revalidatePath` or `revalidateTag` to update caches
- Bind arguments with `.bind()` for secure data passing
- Actions are encrypted and signed automatically

---

## 4. Route Handlers

### Core Patterns

#### Basic Route Handler

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// GET /api/users
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '10');

  const users = await db.users.findMany({
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json({ users, page, limit });
}

// POST /api/users
const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = CreateUserSchema.parse(body);

    const user = await db.users.create({ data: validatedData });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### Dynamic Route Handler

```typescript
// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { RouteContext } from 'next';

type Params = { id: string };

// GET /api/users/:id
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/users/[id]'>
) {
  const { id } = await context.params; // Next.js 15: params is async

  const user = await db.users.findUnique({ where: { id } });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json(user);
}

// DELETE /api/users/:id
export async function DELETE(
  request: NextRequest,
  context: RouteContext<'/api/users/[id]'>
) {
  const { id } = await context.params;

  try {
    await db.users.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
```

#### Route Handler with Authentication

```typescript
// app/api/protected/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Proceed with authenticated logic
  return NextResponse.json({ user: session.user });
}
```

#### Reusable Handler Wrapper

```typescript
// lib/api-handler.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

type Handler = (
  request: NextRequest,
  context: { session: Session }
) => Promise<NextResponse>;

export function withAuth(handler: Handler) {
  return async (request: NextRequest) => {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return handler(request, { session });
  };
}

// Usage in route.ts
import { withAuth } from '@/lib/api-handler';

export const GET = withAuth(async (request, { session }) => {
  // session is guaranteed to exist
  return NextResponse.json({ userId: session.user.id });
});
```

#### Static Route Handler (Cached)

```typescript
// app/api/config/route.ts
// Next.js 15: GET handlers are NOT cached by default
// Opt-in to caching with route segment config

export const dynamic = 'force-static'; // Enable caching
export const revalidate = 3600; // Revalidate every hour

export async function GET() {
  const config = await getPublicConfig();
  return NextResponse.json(config);
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN: Calling Route Handlers from Server Components
// BAD - Creates unnecessary HTTP request
// app/page.tsx (Server Component)
export async function Page() {
  const res = await fetch('http://localhost:3000/api/users'); // DON'T
  const users = await res.json();
  return <UserList users={users} />;
}

// GOOD - Call database directly in Server Components
export async function Page() {
  const users = await db.users.findMany(); // Direct access
  return <UserList users={users} />;
}

// ANTI-PATTERN: route.ts in same directory as page.tsx
// This will cause conflicts - a directory can have EITHER route.ts OR page.tsx

// ANTI-PATTERN: Not handling all error cases
// BAD
export async function POST(request: NextRequest) {
  const body = await request.json(); // Throws if not JSON
  // ...
}

// GOOD
export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  // ...
}
```

### When to Use

| Use Route Handlers | Use Server Actions |
|--------------------|-------------------|
| External webhooks | Form mutations |
| Public API endpoints | In-app data updates |
| Third-party service callbacks | Progressive enhancement |
| File streaming | Revalidation after change |

### Performance Considerations

- **Next.js 15 Breaking Change**: GET handlers NOT cached by default
- Use `export const dynamic = 'force-static'` to enable caching
- Route Handlers run in Edge or Node.js runtime
- Avoid Route Handlers for Server Component data fetching
- Use proper HTTP status codes for caching behavior

---

## 5. Middleware Patterns

### Critical Security Update (CVE-2025-29927)

> **IMPORTANT**: As of Next.js 15.2.3, middleware should NOT be the sole authentication layer. Implement defense-in-depth with verification at data access points.

### Core Patterns

#### Basic Middleware Structure

```typescript
// middleware.ts (root of project)
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Example: Add custom header
  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);

  return response;
}

// Specify which routes trigger middleware
export const config = {
  matcher: [
    // Match all routes except static files and api
    '/((?!_next/static|_next/image|favicon.ico|api).*)',
  ],
};
```

#### Authentication Middleware (Optimistic Check Only)

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password'];
const AUTH_ROUTES = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for session cookie (optimistic check only)
  const sessionCookie = request.cookies.get('session');
  const hasSession = Boolean(sessionCookie?.value);

  // Redirect authenticated users away from auth pages
  if (hasSession && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect unauthenticated users to login
  if (!hasSession && !PUBLIC_ROUTES.includes(pathname)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
```

#### Defense-in-Depth: Data Access Layer

```typescript
// lib/dal.ts (Data Access Layer)
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

// Cached session verification - called at data access points
export const verifySession = cache(async () => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;

  if (!sessionToken) {
    redirect('/login');
  }

  // Verify session in database
  const session = await db.sessions.findUnique({
    where: { token: sessionToken },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    redirect('/login');
  }

  return { user: session.user };
});

// Secure data fetching function
export async function getSecureUserData() {
  const { user } = await verifySession(); // Always verify

  return db.userData.findUnique({
    where: { userId: user.id },
  });
}
```

#### Using DAL in Server Components

```typescript
// app/dashboard/page.tsx
import { verifySession } from '@/lib/dal';
import { db } from '@/lib/db';

export async function DashboardPage() {
  // Verify session at data access point (not just middleware)
  const { user } = await verifySession();

  const dashboardData = await db.dashboard.findUnique({
    where: { userId: user.id },
  });

  return <Dashboard data={dashboardData} user={user} />;
}
```

#### Geolocation and Locale Middleware

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de'];
const DEFAULT_LOCALE = 'en';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if pathname already has locale
  const pathnameHasLocale = SUPPORTED_LOCALES.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    return NextResponse.next();
  }

  // Detect locale from header or geolocation
  const acceptLanguage = request.headers.get('accept-language');
  const detectedLocale = acceptLanguage?.split(',')[0].split('-')[0];
  const locale = SUPPORTED_LOCALES.includes(detectedLocale ?? '')
    ? detectedLocale
    : DEFAULT_LOCALE;

  // Redirect to localized path
  return NextResponse.redirect(
    new URL(`/${locale}${pathname}`, request.url)
  );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN: Relying solely on middleware for auth
// BAD - Middleware can be bypassed (CVE-2025-29927)
export function middleware(request: NextRequest) {
  const session = request.cookies.get('session');
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  // User is "authenticated" - but not verified at data layer!
}

// ANTI-PATTERN: Database calls in middleware
// BAD - Blocks every request
export async function middleware(request: NextRequest) {
  const user = await db.users.findUnique({ ... }); // Slow!
}

// ANTI-PATTERN: Infinite redirect loops
// BAD
export function middleware(request: NextRequest) {
  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
    // If /login also triggers middleware, infinite loop!
  }
}

// GOOD - Always check current path
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!hasSession && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

### When to Use

| Use Middleware | Avoid Middleware |
|----------------|------------------|
| Optimistic auth redirects | Database queries |
| Locale detection | Heavy computation |
| A/B testing flags | Session verification (use DAL) |
| Bot detection | Sole authentication layer |
| Request logging | File processing |

### Performance Considerations

- Middleware runs on EVERY matched request
- Keep middleware logic lightweight (< 100ms)
- Use `matcher` to exclude static assets
- Cache session verification with React `cache()`
- Middleware runs at the Edge by default

---

## 6. Image Optimization

### Core Patterns

#### Basic Image Component

```typescript
import Image from 'next/image';

// Local image (automatically optimized)
import heroImage from '@/public/hero.jpg';

export function Hero() {
  return (
    <Image
      src={heroImage}
      alt="Hero banner showing product lineup"
      placeholder="blur" // Automatic blur placeholder for local images
      priority // Preload for LCP images
    />
  );
}
```

#### Responsive Images with `sizes`

```typescript
import Image from 'next/image';

export function ProductCard({ product }) {
  return (
    <div className="product-card">
      <Image
        src={product.imageUrl}
        alt={product.name}
        width={400}
        height={300}
        // Tell browser: image is 100% of viewport on mobile,
        // 50% on tablet, 33% on desktop
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="product-image"
      />
    </div>
  );
}
```

#### Fill Mode for Container-Based Sizing

```typescript
import Image from 'next/image';

export function BackgroundImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative h-[400px] w-full">
      <Image
        src={src}
        alt={alt}
        fill // Image fills container
        style={{ objectFit: 'cover' }}
        sizes="100vw" // Full viewport width
      />
    </div>
  );
}
```

#### Configuring Image Domains

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.example.com',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: '*.cloudinary.com',
      },
    ],
    // Custom device sizes for srcset
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    // Sizes for images smaller than viewport
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Output format
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
```

#### LCP Optimization Pattern

```typescript
import Image from 'next/image';

// For above-the-fold hero images
export function HeroSection() {
  return (
    <section className="hero">
      <Image
        src="/hero-banner.jpg"
        alt="Welcome to our platform"
        width={1920}
        height={1080}
        priority // Disables lazy loading, preloads image
        sizes="100vw"
        quality={85} // Balance quality vs size
      />
    </section>
  );
}

// For below-the-fold images
export function GalleryImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={400}
      height={300}
      loading="lazy" // Default behavior
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,..." // Custom blur
    />
  );
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN: Missing alt text
// BAD
<Image src="/photo.jpg" alt="" width={400} height={300} />

// GOOD - Descriptive alt text
<Image
  src="/photo.jpg"
  alt="Team members collaborating in modern office space"
  width={400}
  height={300}
/>

// ANTI-PATTERN: Using priority on all images
// BAD - Only LCP images should have priority
{images.map((img) => (
  <Image src={img.src} priority /> // Don't do this!
))}

// GOOD - Priority only for above-the-fold
<Image src={heroImage} priority />
{belowFoldImages.map((img) => (
  <Image src={img.src} loading="lazy" />
))}

// ANTI-PATTERN: Missing sizes prop with fill
// BAD - Defaults to 100vw, may load unnecessarily large image
<div style={{ width: '300px', position: 'relative' }}>
  <Image src="/img.jpg" fill alt="..." />
</div>

// GOOD - Specify actual rendered size
<div style={{ width: '300px', position: 'relative' }}>
  <Image src="/img.jpg" fill alt="..." sizes="300px" />
</div>

// ANTI-PATTERN: Using <img> instead of <Image>
// BAD - No optimization
<img src="/large-photo.jpg" />

// GOOD - Automatic optimization
<Image src="/large-photo.jpg" width={800} height={600} alt="..." />
```

### When to Use

| Use `<Image>` | Use Native `<img>` or `unoptimized` |
|---------------|-------------------------------------|
| JPG, PNG, WebP photos | SVG icons (use inline SVG) |
| Product images | Animated GIFs |
| Hero banners | Images < 1KB |
| User avatars | Third-party CDN with own optimization |

### Performance Considerations

- `priority` images are preloaded (use for LCP only)
- `sizes` prop reduces downloaded image size significantly
- WebP/AVIF served automatically when supported
- Blur placeholder improves perceived performance
- Quality 75-85 is typically optimal balance
- Use `fetchPriority="high"` for critical images (Next.js 15)

---

## 7. Font Optimization

### Core Patterns

#### Google Fonts (Recommended)

```typescript
// app/layout.tsx
import { Inter, Roboto_Mono } from 'next/font/google';

// Variable font (recommended - single file, multiple weights)
const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Prevent FOIT
  variable: '--font-inter',
});

// Non-variable font with specific weights
const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-roboto-mono',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

#### CSS Usage with Variables

```css
/* globals.css or SCSS module */
:root {
  --font-sans: var(--font-inter), system-ui, sans-serif;
  --font-mono: var(--font-roboto-mono), monospace;
}

body {
  font-family: var(--font-sans);
}

code,
pre {
  font-family: var(--font-mono);
}
```

#### Local Fonts

```typescript
// app/layout.tsx
import localFont from 'next/font/local';

const customFont = localFont({
  src: [
    {
      path: '../fonts/CustomFont-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/CustomFont-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/CustomFont-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-custom',
});

// Or variable font (single file)
const customVariable = localFont({
  src: '../fonts/CustomFont-Variable.woff2',
  display: 'swap',
  variable: '--font-custom',
});
```

#### Tailwind CSS v4 Integration

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}

// app/globals.css (Tailwind v4)
@import 'tailwindcss';

@theme {
  --font-sans: var(--font-inter), system-ui, sans-serif;
}
```

#### Font Preloading for Critical Text

```typescript
// For critical above-the-fold text
const headingFont = localFont({
  src: '../fonts/Heading.woff2',
  display: 'swap',
  preload: true, // Default true for primary font
  variable: '--font-heading',
});

// For secondary fonts not in initial viewport
const decorativeFont = localFont({
  src: '../fonts/Decorative.woff2',
  display: 'swap',
  preload: false, // Don't preload if not above-the-fold
  variable: '--font-decorative',
});
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN: Loading fonts in Client Components
// BAD - Causes layout shift
'use client';
import { useEffect } from 'react';

export function Component() {
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/...';
    document.head.appendChild(link);
  }, []);
}

// ANTI-PATTERN: Too many font weights
// BAD - Large download
const inter = Inter({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
});

// GOOD - Only weights you actually use
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '600', '700'], // Regular, Semi-bold, Bold
});

// ANTI-PATTERN: Missing display: 'swap'
// BAD - Can cause FOIT (Flash of Invisible Text)
const inter = Inter({ subsets: ['latin'] }); // No display specified

// GOOD
const inter = Inter({
  subsets: ['latin'],
  display: 'swap', // Shows fallback font while loading
});

// ANTI-PATTERN: External font loading
// BAD - External network request, no privacy
<link href="https://fonts.googleapis.com/..." rel="stylesheet" />

// GOOD - Self-hosted via next/font
import { Inter } from 'next/font/google'; // Bundled at build time
```

### When to Use

| Font Type | Use Case |
|-----------|----------|
| Variable fonts | Modern projects, multiple weights needed |
| Google Fonts | Quick setup, common typefaces |
| Local fonts | Custom branded fonts, offline support |
| System fonts | Maximum performance, minimal styling |

### Performance Considerations

- `next/font` self-hosts fonts at build time (no external requests)
- Variable fonts reduce total download size
- `display: 'swap'` prevents invisible text
- Only include subsets you need (latin, latin-ext, etc.)
- Preload only above-the-fold fonts
- CSS `size-adjust` prevents layout shift

---

## 8. Metadata/SEO

### Core Patterns

#### Static Metadata

```typescript
// app/layout.tsx - Root metadata with template
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://example.com'),
  title: {
    template: '%s | My App',
    default: 'My App - Best Product Ever',
  },
  description: 'The best product for solving your problems.',
  keywords: ['product', 'solution', 'app'],
  authors: [{ name: 'Company Name' }],
  creator: 'Company Name',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'My App',
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@handle',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};
```

#### Dynamic Metadata with generateMetadata

```typescript
// app/products/[slug]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  const product = await db.products.findUnique({
    where: { slug },
  });

  if (!product) {
    return {
      title: 'Product Not Found',
    };
  }

  return {
    title: product.name, // Will use template: "Product Name | My App"
    description: product.description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 160),
      images: [
        {
          url: product.imageUrl,
          width: 1200,
          height: 630,
          alt: product.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: product.description.slice(0, 160),
      images: [product.imageUrl],
    },
    alternates: {
      canonical: `/products/${slug}`,
    },
  };
}
```

#### JSON-LD Structured Data

```typescript
// app/products/[slug]/page.tsx
import type { Product, WithContext } from 'schema-dts';

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  const jsonLd: WithContext<Product> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.imageUrl,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductContent product={product} />
    </>
  );
}
```

#### OpenGraph Image Generation

```typescript
// app/og/route.tsx
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') ?? 'My App';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a2e',
          color: 'white',
        }}
      >
        <div style={{ fontSize: 60, fontWeight: 'bold' }}>{title}</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

// Usage in metadata:
// openGraph: { images: ['/og?title=My+Page+Title'] }
```

#### File-Based OG Images

```typescript
// app/products/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Product Image';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function OGImage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);

  return new ImageResponse(
    (
      <div style={{ /* styles */ }}>
        <h1>{product.name}</h1>
        <p>{product.description}</p>
      </div>
    ),
    size
  );
}
```

#### Sitemap Generation

```typescript
// app/sitemap.ts
import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await db.products.findMany({
    select: { slug: true, updatedAt: true },
  });

  const productUrls = products.map((product) => ({
    url: `https://example.com/products/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [
    {
      url: 'https://example.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://example.com/about',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    ...productUrls,
  ];
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN: Duplicate metadata across pages
// BAD - Same description everywhere
export const metadata = { description: 'Welcome to our site' };

// GOOD - Unique, descriptive metadata per page
export const metadata = {
  description: 'Browse our collection of handcrafted leather goods.',
};

// ANTI-PATTERN: Missing canonical URLs for dynamic routes
// BAD - No canonical, potential duplicate content issues
export async function generateMetadata({ params }) {
  return { title: product.name };
}

// GOOD - Always set canonical for dynamic pages
export async function generateMetadata({ params }) {
  return {
    title: product.name,
    alternates: {
      canonical: `/products/${params.slug}`,
    },
  };
}

// ANTI-PATTERN: Client-side metadata
// BAD - Won't be seen by crawlers
'use client';
export function Page() {
  useEffect(() => {
    document.title = 'My Page'; // Don't do this!
  }, []);
}

// GOOD - Server-side metadata
export const metadata = { title: 'My Page' };
```

### When to Use

| Pattern | Use Case |
|---------|----------|
| Static metadata | Pages with fixed content |
| generateMetadata | Dynamic pages (products, articles) |
| File-based OG images | Unique social previews per page |
| Route-based OG | Shared template with query params |
| JSON-LD | Rich snippets (products, articles, FAQ) |

### Performance Considerations

- Metadata is resolved on the server (no client impact)
- `generateMetadata` waits can be parallelized with page data
- OG image generation adds request latency
- Use `metadataBase` to avoid repeating full URLs
- Sitemap generation runs at build time for static pages

---

## 9. ISR and Static Generation

### Core Patterns

#### Static Generation with generateStaticParams

```typescript
// app/products/[slug]/page.tsx
import { db } from '@/lib/db';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Generate static pages at build time
export async function generateStaticParams() {
  const products = await db.products.findMany({
    select: { slug: true },
  });

  return products.map((product) => ({
    slug: product.slug,
  }));
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await db.products.findUnique({ where: { slug } });

  return <ProductContent product={product} />;
}
```

#### Time-Based ISR

```typescript
// app/products/[slug]/page.tsx

// Revalidate every hour
export const revalidate = 3600;

// Or per-fetch revalidation
async function getProduct(slug: string) {
  const res = await fetch(`https://api.example.com/products/${slug}`, {
    next: { revalidate: 3600 }, // Cache for 1 hour
  });
  return res.json();
}
```

#### On-Demand Revalidation with Tags

```typescript
// app/products/[slug]/page.tsx
async function getProduct(slug: string) {
  const res = await fetch(`https://api.example.com/products/${slug}`, {
    next: { tags: [`product-${slug}`] }, // Tag this request
  });
  return res.json();
}

// app/api/revalidate/route.ts
import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { tag, secret } = await request.json();

  // Verify webhook secret
  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  revalidateTag(tag); // Invalidate cache for this tag

  return NextResponse.json({ revalidated: true, tag });
}
```

#### On-Demand Revalidation with Path

```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { path, secret } = await request.json();

  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  // Revalidate specific path
  revalidatePath(path);

  // Or revalidate entire layout segment
  revalidatePath('/products', 'layout');

  return NextResponse.json({ revalidated: true, path });
}
```

#### Dynamic Params Control

```typescript
// app/products/[slug]/page.tsx

// Only pre-rendered paths are valid, 404 for others
export const dynamicParams = false;

// Or allow dynamic rendering for unknown paths (default)
export const dynamicParams = true;

export async function generateStaticParams() {
  // Only these slugs will be pre-rendered
  return [{ slug: 'product-1' }, { slug: 'product-2' }];
}
```

#### Force Static Rendering

```typescript
// app/products/page.tsx

// Force static rendering even with dynamic APIs
export const dynamic = 'force-static';

// Revalidate the static page every hour
export const revalidate = 3600;

export default async function ProductsPage() {
  const products = await getProducts();
  return <ProductList products={products} />;
}
```

#### Route Segment Configuration

```typescript
// Route segment config options
export const dynamic = 'auto' | 'force-dynamic' | 'force-static' | 'error';
export const dynamicParams = true | false;
export const revalidate = false | 0 | number;
export const fetchCache = 'auto' | 'force-cache' | 'force-no-store' | ...;
export const runtime = 'nodejs' | 'edge';
export const preferredRegion = 'auto' | 'global' | 'home' | string[];
export const maxDuration = number; // Seconds

// Common combinations:
// SSG: force-static (or just generateStaticParams)
// SSR: force-dynamic or revalidate = 0
// ISR: revalidate = 3600 (or any positive number)
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN: Using searchParams with static generation
// BAD - Forces dynamic rendering for entire route
export default function Page({ searchParams }) {
  const filter = searchParams.filter; // Makes page dynamic!
}

// GOOD - Use client-side state for filters
'use client';
export function FilteredList() {
  const [filter, setFilter] = useState('');
  // Handle filtering client-side
}

// ANTI-PATTERN: Overly broad cache tags
// BAD - Invalidates too much
fetch(url, { next: { tags: ['products'] } }); // All products invalidated together

// GOOD - Specific tags
fetch(url, { next: { tags: [`product-${id}`] } }); // Granular invalidation

// ANTI-PATTERN: Mixing fetch caching strategies
// BAD - Confusing cache behavior
const data1 = await fetch(url1, { cache: 'force-cache' });
const data2 = await fetch(url2, { cache: 'no-store' }); // Page becomes dynamic

// GOOD - Consistent strategy per route
export const revalidate = 3600; // All fetches follow this
```

### When to Use

| Strategy | Use Case |
|----------|----------|
| Static (generateStaticParams) | Known, finite paths (products, blog posts) |
| ISR (time-based) | Content that changes periodically |
| ISR (on-demand) | CMS webhooks, instant updates needed |
| Dynamic (force-dynamic) | User-specific content, real-time data |

### Performance Considerations

- Static pages served from CDN edge (fastest)
- ISR pages serve stale while revalidating (SWR)
- First request after revalidation is slower (regenerating)
- Use specific tags over broad ones for cache efficiency
- `dynamicParams: false` returns 404 faster for unknown paths

---

## 10. Streaming and Suspense

### Core Patterns

#### Page-Level Loading with loading.tsx

```typescript
// app/dashboard/loading.tsx
export default function DashboardLoading() {
  return (
    <div className="dashboard-skeleton">
      <div className="skeleton-header" />
      <div className="skeleton-cards">
        <div className="skeleton-card" />
        <div className="skeleton-card" />
        <div className="skeleton-card" />
      </div>
    </div>
  );
}

// This automatically wraps app/dashboard/page.tsx in Suspense
```

#### Component-Level Suspense

```typescript
// app/dashboard/page.tsx
import { Suspense } from 'react';
import { RevenueChart } from '@/components/revenue-chart';
import { RecentOrders } from '@/components/recent-orders';
import { TopProducts } from '@/components/top-products';

export default function DashboardPage() {
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      <div className="dashboard-grid">
        {/* Each card loads independently */}
        <Suspense fallback={<ChartSkeleton />}>
          <RevenueChart />
        </Suspense>

        <Suspense fallback={<TableSkeleton />}>
          <RecentOrders />
        </Suspense>

        <Suspense fallback={<ListSkeleton />}>
          <TopProducts />
        </Suspense>
      </div>
    </div>
  );
}

// components/revenue-chart.tsx (Server Component)
async function RevenueChart() {
  const data = await getRevenueData(); // Slow fetch
  return <Chart data={data} />;
}
```

#### Parallel Data Fetching

```typescript
// GOOD - Parallel fetching (fast)
async function DashboardPage() {
  // Start all fetches simultaneously
  const revenuePromise = getRevenueData();
  const ordersPromise = getRecentOrders();
  const productsPromise = getTopProducts();

  // Wait for all
  const [revenue, orders, products] = await Promise.all([
    revenuePromise,
    ordersPromise,
    productsPromise,
  ]);

  return (
    <div>
      <RevenueChart data={revenue} />
      <OrdersTable data={orders} />
      <ProductsList data={products} />
    </div>
  );
}

// BAD - Sequential waterfall (slow)
async function DashboardPage() {
  const revenue = await getRevenueData(); // Wait...
  const orders = await getRecentOrders(); // Then wait...
  const products = await getTopProducts(); // Then wait...
  // Total time = sum of all fetches
}
```

#### Streaming with Suspense for Progressive Loading

```typescript
// app/search/page.tsx
import { Suspense } from 'react';
import { SearchResults } from '@/components/search-results';
import { SearchFilters } from '@/components/search-filters';

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;

  return (
    <div className="search-page">
      {/* Filters load instantly */}
      <SearchFilters />

      {/* Results stream in as they load */}
      <Suspense
        key={q} // Reset suspense when query changes
        fallback={<ResultsSkeleton />}
      >
        <SearchResults query={q ?? ''} />
      </Suspense>
    </div>
  );
}
```

#### Nested Suspense Boundaries

```typescript
// For granular loading states
export default function ProductPage({ params }) {
  return (
    <div>
      <Suspense fallback={<HeaderSkeleton />}>
        <ProductHeader productId={params.id} />

        <Suspense fallback={<DetailsSkeleton />}>
          <ProductDetails productId={params.id} />

          <Suspense fallback={<ReviewsSkeleton />}>
            <ProductReviews productId={params.id} />
          </Suspense>
        </Suspense>
      </Suspense>
    </div>
  );
}
```

#### Streaming with Error Boundaries

```typescript
// Combine Suspense with error handling
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

export default function Dashboard() {
  return (
    <div>
      <ErrorBoundary
        fallback={<div>Failed to load revenue data</div>}
      >
        <Suspense fallback={<ChartSkeleton />}>
          <RevenueChart />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary
        fallback={<div>Failed to load orders</div>}
      >
        <Suspense fallback={<TableSkeleton />}>
          <RecentOrders />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
```

### Anti-Patterns to Avoid

```typescript
// ANTI-PATTERN: Suspense in Client Components for data
// BAD - Suspense in client won't stream server data
'use client';
export function Dashboard() {
  return (
    <Suspense fallback={<Loading />}>
      <DataComponent /> // This won't stream from server
    </Suspense>
  );
}

// GOOD - Keep Suspense boundaries in Server Components
// app/dashboard/page.tsx (Server Component)
export default function Dashboard() {
  return (
    <Suspense fallback={<Loading />}>
      <ServerDataComponent />
    </Suspense>
  );
}

// ANTI-PATTERN: Too many Suspense boundaries
// BAD - UI pops in piece by piece (jarring)
<Suspense><Title /></Suspense>
<Suspense><Subtitle /></Suspense>
<Suspense><Description /></Suspense>

// GOOD - Group related content
<Suspense>
  <Title />
  <Subtitle />
  <Description />
</Suspense>

// ANTI-PATTERN: Suspense without meaningful fallback
// BAD
<Suspense fallback={null}>
  <SlowComponent />
</Suspense>

// GOOD - Informative fallback
<Suspense fallback={<SkeletonMatchingLayout />}>
  <SlowComponent />
</Suspense>
```

### When to Use

| Pattern | Use Case |
|---------|----------|
| loading.tsx | Page-level loading states |
| Component Suspense | Independent sections that load at different speeds |
| Nested Suspense | Hierarchical content with progressive reveal |
| Parallel fetching | Multiple independent data sources |

### Performance Considerations

- Streaming only works with Server Components
- Browsers may buffer responses until 1KB threshold
- loading.tsx = automatic Suspense boundary at page level
- Use `key` prop on Suspense to reset when params change
- Place Suspense boundaries at meaningful UX break points
- Avoid sequential awaits (use Promise.all or Suspense)

---

## Sources

### App Router Patterns
- [Inside the App Router: Best Practices for Next.js File and Directory Structure (2025 Edition)](https://medium.com/better-dev-nextjs-react/inside-the-app-router-best-practices-for-next-js-file-and-directory-structure-2025-edition-ed6bc14a8da3)
- [Next.js Error Handling Patterns](https://betterstack.com/community/guides/scaling-nodejs/error-handling-nextjs/)
- [Next.js 15: Error Handling best practices](https://devanddeliver.com/blog/frontend/next-js-15-error-handling-best-practices-for-code-and-routes)
- [Next.js Docs: Error Handling](https://nextjs.org/docs/app/api-reference/file-conventions/error)

### Server vs Client Components
- [Next.js Docs: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Server Components vs Client Components in Next.js 15](https://medium.com/@shahzad.malik_75994/server-components-vs-client-components-choosing-the-right-approach-in-next-js-15-723ecf060e7e)
- [React Server Components vs Client Components](https://medium.com/@123ajaybisht/react-server-components-vs-client-components-when-to-use-what-bcec46cacded)

### Server Actions
- [Nextjs 15 — Actions Best Practice](https://medium.com/@lior_amsalem/nextjs-15-actions-best-practice-bf5cc023301e)
- [Next.js Docs: Server Actions and Mutations](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Exploring Next.js 15 and Server Actions](https://dev.to/brayancodes/exploring-nextjs-15-and-server-actions-features-and-best-practices-1393)

### Route Handlers
- [Next.js Docs: Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Building APIs with Next.js](https://nextjs.org/blog/building-apis-with-nextjs)
- [Next.js 15 API Examples](https://www.wisp.blog/blog/nextjs-15-api-get-and-post-request-examples)

### Middleware
- [Next.js Authentication Best Practices in 2025](https://www.franciscomoretti.com/blog/modern-nextjs-authentication-best-practices)
- [Next.js Middleware Authentication: Protecting Routes in 2025](https://www.hashbuilds.com/articles/next-js-middleware-authentication-protecting-routes-in-2025)
- [Complete Next.js Security Guide 2025](https://www.turbostarter.dev/blog/complete-nextjs-security-guide-2025-authentication-api-protection-and-best-practices)
- [Next.js Docs: Authentication](https://nextjs.org/docs/app/guides/authentication)

### Image Optimization
- [Next.js Docs: Image Component](https://nextjs.org/docs/app/api-reference/components/image)
- [Next.js Image Optimization Guide](https://strapi.io/blog/nextjs-image-optimization-developers-guide)
- [Next.js Docs: Image Optimization](https://nextjs.org/docs/app/getting-started/images)

### Font Optimization
- [Next.js Docs: Font Optimization](https://nextjs.org/docs/app/getting-started/fonts)
- [Next.js Fonts Guide](https://www.contentful.com/blog/next-js-fonts/)
- [Google Fonts in Next.js 15 + Tailwind v4](https://www.buildwithmatija.com/blog/how-to-use-custom-google-fonts-in-next-js-15-and-tailwind-v4)

### Metadata/SEO
- [Next.js 15 SEO: Complete Guide to Metadata & Optimization](https://www.digitalapplied.com/blog/nextjs-seo-guide)
- [Next.js Docs: generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Next.js Docs: Metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)

### ISR and Static Generation
- [Next.js Docs: ISR](https://nextjs.org/docs/app/guides/incremental-static-regeneration)
- [Next.js 15: ISR](https://dev.to/sonaykara/nextjs-15-incremental-static-regeneration-isr-2jkm)
- [Next.js Docs: generateStaticParams](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)
- [Next.js Docs: Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)

### Streaming and Suspense
- [A Complete Next.js Streaming Guide](https://dev.to/boopykiki/a-complete-nextjs-streaming-guide-loadingtsx-suspense-and-performance-9g9)
- [The Next.js 15 Streaming Handbook](https://www.freecodecamp.org/news/the-nextjs-15-streaming-handbook/)
- [Mastering React Suspense in Next.js 15](https://www.wisp.blog/blog/mastering-react-suspense-in-nextjs-15-a-developers-guide)
- [Next.js Docs: Loading UI and Streaming](https://nextjs.org/docs/14/app/building-your-application/routing/loading-ui-and-streaming)

### Anti-Patterns
- [10 Next.js Anti Patterns to Avoid](https://javascript.plainenglish.io/10-next-js-anti-patterns-to-avoid-as-a-next-js-developer-f7828bf569d4)
- [Stop using these outdated React/Next.js patterns in 2025](https://medium.com/mern-mastery/stop-using-these-outdated-react-next-js-patterns-in-2025-3d1be5f3aea2)
- [React & Next.js in 2025 - Modern Best Practices](https://strapi.io/blog/react-and-nextjs-in-2025-modern-best-practices)

### Parallel and Intercepting Routes
- [Next.js Docs: Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes)
- [Next.js Docs: Intercepting Routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes)
- [Mastering Next.js Routing](https://dev.to/devjordan/mastering-nextjs-routing-dynamic-routes-route-groups-and-parallel-routes-1m5h)
