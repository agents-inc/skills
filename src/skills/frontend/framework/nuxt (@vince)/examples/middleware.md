# Nuxt 3 - Middleware Examples

> Route middleware for authentication, authorization, and navigation guards. See [SKILL.md](../SKILL.md) for core concepts.

---

## Named Middleware

### Good Example - Authentication Guard

```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const { isLoggedIn } = useUser()

  if (!isLoggedIn.value) {
    // Store intended destination for post-login redirect
    const returnUrl = to.fullPath
    return navigateTo(`/login?redirect=${encodeURIComponent(returnUrl)}`)
  }
})
```

**Usage in page:**

```vue
<!-- pages/dashboard.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})
</script>

<template>
  <div>Protected dashboard content</div>
</template>
```

**Why good:** Middleware reusable across pages, encodes redirect URL for post-login navigation, definePageMeta attaches middleware

### Bad Example - Auth Check in Component

```vue
<!-- WRONG - Auth logic scattered in components -->
<script setup lang="ts">
const { isLoggedIn } = useUser()

// Runs after page renders, causes flash of content
onMounted(() => {
  if (!isLoggedIn.value) {
    navigateTo('/login')
  }
})
</script>
```

**Why bad:** Runs after initial render causing content flash, must repeat in every protected page, doesn't prevent server-side access

---

## Role-Based Authorization

### Good Example - Admin Middleware

```typescript
// middleware/admin.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const { user } = useUser()

  if (!user.value) {
    return navigateTo('/login')
  }

  if (user.value.role !== 'admin') {
    // Abort navigation entirely
    return abortNavigation()
  }
})
```

**Usage with multiple middleware:**

```vue
<!-- pages/admin/settings.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: ['auth', 'admin'] // Runs in order
})
</script>

<template>
  <div>Admin settings page</div>
</template>
```

**Why good:** abortNavigation prevents unauthorized access, middleware array runs in order, auth check before role check

---

## Global Middleware

### Good Example - Analytics Tracking

```typescript
// middleware/analytics.global.ts
export default defineNuxtRouteMiddleware((to, from) => {
  // .global suffix = runs on every navigation

  // Only track on client
  if (import.meta.client) {
    const { $analytics } = useNuxtApp()

    $analytics.trackPageView({
      path: to.fullPath,
      referrer: from.fullPath
    })
  }
})
```

**Why good:** .global suffix auto-runs on all routes, import.meta.client for client-only code, tracks referrer for navigation flow

### Good Example - Global Auth Check

```typescript
// middleware/01.auth-check.global.ts
// Numeric prefix controls execution order
export default defineNuxtRouteMiddleware((to, from) => {
  const { user, fetchUser } = useUser()

  // Skip if already loaded
  if (user.value !== undefined) {
    return
  }

  // Fetch user on first navigation
  if (import.meta.server) {
    return fetchUser()
  }
})
```

**Why good:** Numeric prefix (01.) controls global middleware order, fetchUser on server for SSR, conditional skip if already loaded

---

## Inline Middleware

### Good Example - Page-Specific Logic

```vue
<!-- pages/posts/[id]/edit.vue -->
<script setup lang="ts">
const route = useRoute()
const { user } = useUser()

definePageMeta({
  middleware: [
    'auth', // Named middleware first
    // Inline middleware for page-specific check
    async function (to, from) {
      const postId = to.params.id as string
      const post = await $fetch(`/api/posts/${postId}`)

      // Store for use in page
      useState('currentPost', () => post)

      // Only author can edit
      if (post.authorId !== user.value?.id) {
        return abortNavigation()
      }
    }
  ]
})

const post = useState('currentPost')
</script>

<template>
  <PostEditor v-if="post" :post="post" />
</template>
```

**Why good:** Inline middleware for one-off logic, combines with named middleware, useState shares data with page

---

## Conditional Redirects

### Good Example - Redirect If Logged In

```typescript
// middleware/guest.ts
// Redirect authenticated users away from auth pages
export default defineNuxtRouteMiddleware((to, from) => {
  const { isLoggedIn } = useUser()

  if (isLoggedIn.value) {
    // Get redirect target or default to home
    const redirect = to.query.redirect as string
    return navigateTo(redirect || '/dashboard')
  }
})
```

**Usage:**

```vue
<!-- pages/login.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: 'guest',
  layout: 'auth'
})
</script>
```

**Why good:** Prevents authenticated users from accessing login/register, respects redirect query param

---

## Middleware with External Data

### Good Example - Feature Flag Check

```typescript
// middleware/feature-flag.ts
export default defineNuxtRouteMiddleware(async (to, from) => {
  const featureName = to.meta.featureFlag as string | undefined

  if (!featureName) {
    return
  }

  const isEnabled = await $fetch(`/api/features/${featureName}`)

  if (!isEnabled) {
    // Show coming soon page
    return navigateTo('/coming-soon')
  }
})
```

**Usage:**

```vue
<!-- pages/beta-feature.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: 'feature-flag',
  featureFlag: 'new-dashboard' // Custom meta property
})
</script>
```

**Why good:** Async middleware waits for data, custom meta properties passed to middleware, graceful fallback for disabled features

---

## Middleware Patterns

### Good Example - Middleware Factory

```typescript
// middleware/require-permission.ts
import type { RouteLocationNormalized } from 'vue-router'

// Factory function for parameterized middleware
export function requirePermission(permission: string) {
  return defineNuxtRouteMiddleware((to: RouteLocationNormalized) => {
    const { user } = useUser()

    if (!user.value) {
      return navigateTo('/login')
    }

    if (!user.value.permissions.includes(permission)) {
      return navigateTo('/unauthorized')
    }
  })
}
```

**Note:** Nuxt middleware files export a single default, so use inline for parameterized:

```vue
<script setup lang="ts">
const { user } = useUser()

definePageMeta({
  middleware: [
    'auth',
    function (to) {
      if (!user.value?.permissions.includes('posts:write')) {
        return navigateTo('/unauthorized')
      }
    }
  ]
})
</script>
```

---

## Server vs Client Middleware

### Good Example - Environment-Aware Middleware

```typescript
// middleware/maintenance.global.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const config = useRuntimeConfig()

  // Check maintenance mode
  if (config.public.maintenanceMode) {
    // Skip maintenance page itself
    if (to.path === '/maintenance') {
      return
    }

    // Allow admin access during maintenance
    const { user } = useUser()
    if (user.value?.role === 'admin') {
      return
    }

    return navigateTo('/maintenance')
  }
})
```

**Why good:** Runtime config for environment-specific behavior, skips infinite redirect to maintenance page, admin bypass

---

## Quick Reference

| Middleware Type | File Pattern | Behavior |
|-----------------|--------------|----------|
| Named | `middleware/auth.ts` | Explicit opt-in via `definePageMeta` |
| Global | `middleware/analytics.global.ts` | Runs on every navigation |
| Inline | Function in `definePageMeta.middleware` | Page-specific logic |

| Function | Purpose |
|----------|---------|
| `navigateTo('/path')` | Redirect to path |
| `abortNavigation()` | Cancel navigation (stay on current page) |
| `definePageMeta({ middleware: [...] })` | Attach middleware to page |
| `import.meta.client` | Check if running on client |
| `import.meta.server` | Check if running on server |
