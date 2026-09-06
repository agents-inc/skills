# Cookie Manipulation

> Reading and writing cookies inside Server Actions. See [server-actions.md](server-actions.md) for
> the action shape.

---

## Pattern: Setting Cookies in Server Actions

### Good Example — a theme preference

```typescript
// app/actions/preferences.ts
"use server";

import { cookies } from "next/headers";

const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

export async function setTheme(formData: FormData) {
  const theme = formData.get("theme") as string;

  if (theme !== "light" && theme !== "dark") {
    throw new Error("Invalid theme");
  }

  // Next.js 15+: cookies() is async
  const cookieStore = await cookies();

  cookieStore.set("theme", theme, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: THEME_COOKIE_MAX_AGE,
    path: "/",
  });

  // Setting cookies triggers re-render with new values
}
```

**Why good:** The theme is validated against the two values the app understands, so a crafted request
cannot store arbitrary text. Writing the cookie triggers a server re-render, which is how the new
theme reaches the page without any client state. `cookies()` is a Promise from Next.js 15 onward.

---

## Cookie Settings

| Setting    | Recommendation                                                        |
| ---------- | --------------------------------------------------------------------- |
| `httpOnly` | `true` where only the server reads it — no script can reach it (XSS)  |
| `secure`   | `true` in production, so it never travels over plain HTTP             |
| `sameSite` | `'lax'` or `'strict'`, so a third-party page cannot trigger it (CSRF) |
| `maxAge`   | A named constant — the seconds arithmetic is unreadable inline        |
| `path`     | `'/'` unless the cookie belongs to one route subtree                  |
