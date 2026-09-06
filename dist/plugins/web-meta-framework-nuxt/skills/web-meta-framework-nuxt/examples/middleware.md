# Nuxt — Route Middleware

> Authentication, authorization and navigation guards. The middleware-type table is in
> [SKILL.md](../SKILL.md) and the return-value decision tree in [reference.md](../reference.md).

---

## Named Middleware

### Good Example - Authentication Guard

```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const { isLoggedIn } = useUser();

  if (!isLoggedIn.value) {
    // Store intended destination for post-login redirect
    const returnUrl = to.fullPath;
    return navigateTo(`/login?redirect=${encodeURIComponent(returnUrl)}`);
  }
});
```

**Usage in page:**

```vue
<!-- pages/dashboard.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: "auth",
});
</script>

<template>
  <div>Protected dashboard content</div>
</template>
```

**Why good:** The guard runs before the route commits, so the protected page never renders — and
encoding `to.fullPath` means the user lands back where they were aiming after logging in.

### Bad Example — the check inside the component

```vue
<!-- WRONG - Auth logic scattered in components -->
<script setup lang="ts">
const { isLoggedIn } = useUser();

// Runs after page renders, causes flash of content
onMounted(() => {
  if (!isLoggedIn.value) {
    navigateTo("/login");
  }
});
</script>
```

**Why bad:** `onMounted` fires after the page has rendered, so the protected content flashes on screen
before the redirect — and it never runs at all during SSR, so the markup was already sent.

---

## Role-Based Authorization

### Good Example — an admin guard

```typescript
// middleware/admin.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const { user } = useUser();

  if (!user.value) {
    return navigateTo("/login");
  }

  if (user.value.role !== "admin") {
    // Abort navigation entirely
    return abortNavigation();
  }
});
```

**Usage with multiple middleware:**

```vue
<!-- pages/admin/settings.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: ["auth", "admin"], // Runs in order
});
</script>

<template>
  <div>Admin settings page</div>
</template>
```

**Why good:** The array runs in order, so `auth` establishes that there is a user before `admin` reads
their role. `abortNavigation()` leaves the user where they were rather than redirecting them
somewhere that would also refuse them.

---

## Global Middleware

### Good Example — analytics

```typescript
// middleware/analytics.global.ts
export default defineNuxtRouteMiddleware((to, from) => {
  // .global suffix = runs on every navigation

  // Only track on client
  if (import.meta.client) {
    const { $analytics } = useNuxtApp();

    $analytics.trackPageView({
      path: to.fullPath,
      referrer: from.fullPath,
    });
  }
});
```

**Why good:** Global middleware runs during SSR too, so the `import.meta.client` guard is what stops
the tracker firing once per render on the server as well as once in the browser.

### Good Example — a global auth check

```typescript
// middleware/01.auth-check.global.ts
// Numeric prefix controls execution order
export default defineNuxtRouteMiddleware((to, from) => {
  const { user, fetchUser } = useUser();

  // Skip if already loaded
  if (user.value !== undefined) {
    return;
  }

  // Fetch user on first navigation
  if (import.meta.server) {
    return fetchUser();
  }
});
```

**Why good:** Global middleware otherwise runs in alphabetical order, which is not an order anyone
chose — the `01.` prefix makes the session load first. The early return means the fetch happens once
per session rather than once per navigation.

---

## Inline Middleware

### Good Example — logic for one page

```vue
<!-- pages/posts/[id]/edit.vue -->
<script setup lang="ts">
const route = useRoute();
const { user } = useUser();

definePageMeta({
  middleware: [
    "auth", // Named middleware first
    // Inline middleware for page-specific check
    async function (to, from) {
      const postId = to.params.id as string;
      const post = await $fetch(`/api/posts/${postId}`);

      // Store for use in page
      useState("currentPost", () => post);

      // Only author can edit
      if (post.authorId !== user.value?.id) {
        return abortNavigation();
      }
    },
  ],
});

const post = useState("currentPost");
</script>

<template>
  <PostEditor v-if="post" :post="post" />
</template>
```

**Why good:** The ownership check needs the post, and the page needs it too — fetching it in the
guard and stashing it in `useState` means it is fetched once rather than twice.

---

## Conditional Redirects

### Good Example — keeping signed-in users off the login page

```typescript
// middleware/guest.ts
// Redirect authenticated users away from auth pages
export default defineNuxtRouteMiddleware((to, from) => {
  const { isLoggedIn } = useUser();

  if (isLoggedIn.value) {
    // Get redirect target or default to home
    const redirect = to.query.redirect as string;
    return navigateTo(redirect || "/dashboard");
  }
});
```

**Usage:**

```vue
<!-- pages/login.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: "guest",
  layout: "auth",
});
</script>
```

**Why good:** It is the mirror of `auth`, and it honours the same `redirect` query param that `auth`
set — so a user who logs in mid-journey continues where they left off.

---

## Middleware with External Data

### Good Example — a feature flag

```typescript
// middleware/feature-flag.ts
export default defineNuxtRouteMiddleware(async (to, from) => {
  const featureName = to.meta.featureFlag as string | undefined;

  if (!featureName) {
    return;
  }

  const isEnabled = await $fetch(`/api/features/${featureName}`);

  if (!isEnabled) {
    // Show coming soon page
    return navigateTo("/coming-soon");
  }
});
```

**Usage:**

```vue
<!-- pages/beta-feature.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: "feature-flag",
  featureFlag: "new-dashboard", // Custom meta property
});
</script>
```

**Why good:** Middleware may be async, and navigation waits for it. The flag name lives in the page's
own `definePageMeta`, so one middleware file serves every flagged page.

---

## Parameterised Middleware

### Good Example — a factory

```typescript
// middleware/require-permission.ts
import type { RouteLocationNormalized } from "vue-router";

// Factory function for parameterized middleware
export function requirePermission(permission: string) {
  return defineNuxtRouteMiddleware((to: RouteLocationNormalized) => {
    const { user } = useUser();

    if (!user.value) {
      return navigateTo("/login");
    }

    if (!user.value.permissions.includes(permission)) {
      return navigateTo("/unauthorized");
    }
  });
}
```

A file in `middleware/` exports one default and takes no arguments, so a parameterised guard has to
be inline:

```vue
<script setup lang="ts">
const { user } = useUser();

definePageMeta({
  middleware: [
    "auth",
    function (to) {
      if (!user.value?.permissions.includes("posts:write")) {
        return navigateTo("/unauthorized");
      }
    },
  ],
});
</script>
```

---

## Environment-Aware Middleware

### Good Example — maintenance mode

```typescript
// middleware/maintenance.global.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const config = useRuntimeConfig();

  // Check maintenance mode
  if (config.public.maintenanceMode) {
    // Skip maintenance page itself
    if (to.path === "/maintenance") {
      return;
    }

    // Allow admin access during maintenance
    const { user } = useUser();
    if (user.value?.role === "admin") {
      return;
    }

    return navigateTo("/maintenance");
  }
});
```

**Why good:** The guard exempts `/maintenance` itself, which is what stops the redirect looping — and
the admin bypass means whoever has to fix the outage can still reach the app.

---

_The middleware-type table is in [SKILL.md](../SKILL.md); the return-value decision tree and the
middleware checklist are in [reference.md](../reference.md)._
