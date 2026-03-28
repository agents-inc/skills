# Supabase Auth Examples

> Full auth flows, OAuth, magic links, session refresh, and middleware protection. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Email/Password Authentication

### Good Example — Sign Up with Metadata

```typescript
async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    throw new Error(`Sign up failed: ${error.message}`);
  }

  // Note: data.user exists but may not be confirmed yet (check email)
  return data;
}
```

**Why good:** Passes user metadata at signup, `emailRedirectTo` for email confirmation callback, error checked before using data

### Good Example — Sign In

```typescript
async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Supabase intentionally returns ambiguous errors to prevent user enumeration
    throw new Error("Invalid email or password");
  }

  return data.session;
}
```

**Why good:** Generic error message prevents user enumeration (don't reveal whether email exists), returns session for immediate use

---

## Pattern 2: OAuth (Social Login)

### Good Example — GitHub OAuth

```typescript
async function signInWithGitHub() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: "read:user user:email",
    },
  });

  if (error) {
    throw new Error(`OAuth failed: ${error.message}`);
  }

  // Browser will redirect to GitHub — no further code runs
}
```

### Good Example — Google OAuth

```typescript
async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    throw new Error(`OAuth failed: ${error.message}`);
  }
}
```

### Good Example — OAuth Callback Handler

```typescript
// /auth/callback route handler
async function handleOAuthCallback() {
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = hashParams.get("access_token");

  if (!accessToken) {
    // Handle PKCE flow: exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(
      new URLSearchParams(window.location.search).get("code") ?? "",
    );

    if (error) {
      throw new Error(`OAuth callback failed: ${error.message}`);
    }
  }

  // Session is now available via supabase.auth.getSession()
}
```

**Why good:** Handles both implicit and PKCE flows, `redirectTo` points to callback route, scopes request specific permissions, `queryParams` for provider-specific options

---

## Pattern 3: Magic Link (Passwordless)

### Good Example — Send and Verify Magic Link

```typescript
// Send magic link email
async function sendMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    throw new Error(`Failed to send magic link: ${error.message}`);
  }

  // User receives email with login link
}

// Handle the callback (user clicks the link)
// The session is automatically established when the user lands on the redirect URL
// onAuthStateChange will fire with SIGNED_IN event
```

**Why good:** Simple passwordless flow, redirect URL for after email click, error handling, session auto-established on callback

---

## Pattern 4: Auth State Listener

### Good Example — Global Auth State Management

```typescript
// Register early in app lifecycle (e.g., app initialization)
function setupAuthListener(callbacks: {
  onSignIn: (session: Session) => void;
  onSignOut: () => void;
}) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    // IMPORTANT: Do NOT call Supabase methods directly in this callback
    // Use setTimeout to defer if needed

    switch (event) {
      case "SIGNED_IN":
        if (session) {
          setTimeout(() => callbacks.onSignIn(session), 0);
        }
        break;
      case "SIGNED_OUT":
        setTimeout(() => callbacks.onSignOut(), 0);
        break;
      case "TOKEN_REFRESHED":
        // Token refreshed automatically — session updated
        break;
      case "USER_UPDATED":
        // User profile was updated via updateUser()
        break;
      case "PASSWORD_RECOVERY":
        // User landed on password reset page
        break;
    }
  });

  // Return cleanup function
  return () => subscription.unsubscribe();
}

// Usage
const cleanup = setupAuthListener({
  onSignIn: (session) => {
    // Navigate to dashboard, update UI state
  },
  onSignOut: () => {
    // Navigate to login, clear local state
  },
});

// On app unmount
cleanup();
```

**Why good:** Registered early in lifecycle, `setTimeout` prevents deadlocks, cleanup via unsubscribe, all events handled, callback pattern decouples auth from UI

### Bad Example — Calling Supabase Inside Listener

```typescript
// BAD: Can cause deadlocks
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_IN") {
    // BAD: Calling Supabase inside the callback can deadlock
    const { data } = await supabase.from("profiles").select("*").single();
    // BAD: Using async callback
  }
});
```

**Why bad:** Calling Supabase methods inside the callback can cause deadlocks, async callbacks risk race conditions, no cleanup via unsubscribe

---

## Pattern 5: Session Management

### Good Example — Getting and Verifying the Current User

```typescript
// Get the current session (reads from local storage — NOT secure for server-side)
async function getSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(`Failed to get session: ${error.message}`);
  }

  return session;
}

// SECURE: Verify the user server-side (makes API call to Supabase)
async function getAuthenticatedUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Not authenticated");
  }

  return user;
}

// Sign out
async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(`Sign out failed: ${error.message}`);
  }
}
```

**Why good:** `getSession()` for quick client-side checks, `getUser()` for secure server-side verification, clear distinction between the two

**When to use:** Use `getSession()` for UI state (is user logged in?). Use `getUser()` on the server to verify identity before performing sensitive operations. `getSession()` can be tampered with — it reads from local storage.

---

## Pattern 6: Middleware Auth Protection

### Good Example — Protecting Server Routes

```typescript
// middleware/auth.ts
import type { Database } from "../database.types";

async function requireAuth(request: Request) {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
    });
  }

  const token = authHeader.replace("Bearer ", "");

  const supabase = createClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );

  // IMPORTANT: Use getUser() not getSession() for server-side verification
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
    });
  }

  return { user, supabase };
}
```

**Why good:** Extracts JWT from Authorization header, creates per-request client with user JWT, uses `getUser()` (not `getSession()`) for server-side verification, returns both user and scoped client

---

## Pattern 7: Password Reset

### Good Example — Request and Complete Password Reset

```typescript
// Step 1: Request password reset email
async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });

  if (error) {
    throw new Error(`Password reset request failed: ${error.message}`);
  }

  // Email sent — user clicks link and lands on redirectTo URL
}

// Step 2: Update password (after user lands on reset page)
// The PASSWORD_RECOVERY event fires in onAuthStateChange
async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(`Password update failed: ${error.message}`);
  }

  return data.user;
}
```

**Why good:** Two-step flow (request + update), `redirectTo` for password reset page, `onAuthStateChange` fires `PASSWORD_RECOVERY` event when user lands on reset page

---

_For database query patterns, see [database.md](database.md). For storage patterns, see [storage.md](storage.md)._
