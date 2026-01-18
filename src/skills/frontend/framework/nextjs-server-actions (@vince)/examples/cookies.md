# Cookie Manipulation

> Server-side preference storage via Server Actions. For client state, see [Zustand skill](../../client-state-management/zustand%20(@vince)/SKILL.md).

---

## Pattern: Setting Cookies in Server Actions

### Good Example - Theme preference cookie

```typescript
// app/actions/preferences.ts
'use server'

import { cookies } from 'next/headers'

const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year in seconds

export async function setTheme(formData: FormData) {
  const theme = formData.get('theme') as string

  if (theme !== 'light' && theme !== 'dark') {
    throw new Error('Invalid theme')
  }

  // Next.js 15+: cookies() is async
  const cookieStore = await cookies()

  cookieStore.set('theme', theme, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: THEME_COOKIE_MAX_AGE,
    path: '/',
  })

  // Setting cookies triggers re-render with new values
}
```

**Why good:** Named constant for max age. Validates input. Secure cookie settings. Server Action can set cookies that trigger UI updates. Uses async cookies() API (Next.js 15+).

---

## Cookie Best Practices

| Setting | Recommendation |
|---------|----------------|
| `httpOnly` | `true` for server-read cookies (prevents XSS) |
| `secure` | `true` in production (HTTPS only) |
| `sameSite` | `'lax'` or `'strict'` (CSRF protection) |
| `maxAge` | Named constant, appropriate duration |
| `path` | `'/'` unless scoped to specific routes |
