# Appwrite Auth Examples

> Full auth flows, OAuth, magic URL, sessions, and team management. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Email/Password Authentication

### Good Example — Sign Up (Create Account + Session)

```typescript
import { ID, AppwriteException, type Models } from "appwrite";

async function signUp(
  email: string,
  password: string,
  name: string,
): Promise<{ user: Models.User<Models.Preferences>; session: Models.Session }> {
  try {
    // Step 1: Create the user account
    const user = await account.create({
      userId: ID.unique(),
      email,
      password,
      name,
    });

    // Step 2: Create a session (account.create does NOT log the user in)
    const session = await account.createEmailPasswordSession({
      email,
      password,
    });

    return { user, session };
  } catch (error) {
    if (error instanceof AppwriteException) {
      throw new Error(`Sign up failed: ${error.message}`);
    }
    throw error;
  }
}
```

**Why good:** Two-step process (create account + create session), object parameters for all SDK calls, `ID.unique()` for user ID, typed return with `Models` namespace, `AppwriteException` handling

### Good Example — Sign In

```typescript
async function signIn(
  email: string,
  password: string,
): Promise<Models.Session> {
  try {
    return await account.createEmailPasswordSession({ email, password });
  } catch (error) {
    if (error instanceof AppwriteException) {
      // Don't expose whether the email exists — generic message
      throw new Error("Invalid email or password");
    }
    throw error;
  }
}
```

**Why good:** Generic error message prevents user enumeration, returns session for immediate use

### Bad Example — Forgetting to Create Session After Account Creation

```typescript
// BAD: User account created but NOT logged in
async function signUp(email: string, password: string) {
  const user = await account.create({ userId: ID.unique(), email, password });
  return user; // User exists but has no active session!
}
```

**Why bad:** `account.create()` only registers the user — it does NOT create a session. The user will appear "not logged in" until `createEmailPasswordSession()` is called.

---

## Pattern 2: OAuth (Social Login)

### Good Example — GitHub OAuth

```typescript
import { OAuthProvider } from "appwrite";

function signInWithGitHub() {
  account.createOAuth2Session({
    provider: OAuthProvider.Github,
    success: `${window.location.origin}/auth/callback`,
    failure: `${window.location.origin}/auth/failure`,
    scopes: ["read:user", "user:email"],
  });
  // IMPORTANT: Browser redirects here — no code after this runs
}
```

### Good Example — Google OAuth

```typescript
import { OAuthProvider } from "appwrite";

function signInWithGoogle() {
  account.createOAuth2Session({
    provider: OAuthProvider.Google,
    success: `${window.location.origin}/auth/callback`,
    failure: `${window.location.origin}/auth/failure`,
    scopes: ["openid", "email", "profile"],
  });
}
```

### Good Example — OAuth Callback Handler

```typescript
// /auth/callback page — session is automatically established after redirect
async function handleOAuthCallback() {
  try {
    const user = await account.get();
    // User is now authenticated — redirect to app
    return user;
  } catch {
    // Session wasn't established — redirect to login
    window.location.href = "/login";
  }
}
```

**Why good:** Both success and failure URLs provided, scopes request specific permissions, callback page calls `account.get()` to verify session

### Bad Example — Missing Failure URL

```typescript
// BAD: No failure redirect
account.createOAuth2Session({
  provider: OAuthProvider.Github,
  success: `${window.location.origin}/auth/callback`,
  // Missing failure URL — where does the user go on auth failure?
});
```

**Why bad:** Without a failure URL, the user has no redirect target if authentication fails

---

## Pattern 3: Magic URL (Passwordless)

### Good Example — Send and Verify Magic Link

```typescript
import { ID } from "appwrite";

// Step 1: Send magic link email
async function sendMagicLink(email: string) {
  try {
    await account.createMagicURLToken({
      userId: ID.unique(),
      email,
      url: `${window.location.origin}/auth/magic-callback`,
    });
    // Email sent — user clicks the link
  } catch (error) {
    if (error instanceof AppwriteException) {
      throw new Error(`Failed to send magic link: ${error.message}`);
    }
    throw error;
  }
}

// Step 2: Handle the callback (user clicked the link)
async function handleMagicURLCallback(userId: string, secret: string) {
  try {
    // Exchange the token for a session
    const session = await account.updateMagicURLSession({ userId, secret });
    return session;
  } catch (error) {
    if (error instanceof AppwriteException) {
      throw new Error(`Magic link verification failed: ${error.message}`);
    }
    throw error;
  }
}
```

**Why good:** Two-step flow (create token + update session), object parameters for all calls, `ID.unique()` for new users (creates account if needed), callback URL for redirect, token exchange for session

---

## Pattern 4: Anonymous Sessions

### Good Example — Guest Session with Account Upgrade

```typescript
// Create an anonymous (guest) session
async function createGuestSession() {
  try {
    return await account.createAnonymousSession();
  } catch (error) {
    if (error instanceof AppwriteException) {
      throw new Error(`Guest session failed: ${error.message}`);
    }
    throw error;
  }
}

// Later: Convert anonymous account to email/password account
async function upgradeGuestAccount(email: string, password: string) {
  try {
    // This converts the anonymous user to a permanent account
    await account.updateEmail({ email, password });
    return await account.get();
  } catch (error) {
    if (error instanceof AppwriteException) {
      throw new Error(`Account upgrade failed: ${error.message}`);
    }
    throw error;
  }
}
```

**Why good:** Anonymous sessions let users try the app without registration, `updateEmail` converts the anonymous account in-place (data is preserved)

---

## Pattern 5: Session Management

### Good Example — Get Current User Safely

```typescript
import type { Models } from "appwrite";

async function getCurrentUser(): Promise<Models.User<Models.Preferences> | null> {
  try {
    return await account.get();
  } catch {
    // No active session — user is not logged in
    return null;
  }
}
```

**Why good:** `account.get()` throws 401 if no session exists — returning `null` provides a clean "no user" signal without propagating the exception

### Good Example — Sign Out

```typescript
// Sign out current device only
async function signOut() {
  try {
    await account.deleteSession({ sessionId: "current" });
  } catch (error) {
    if (error instanceof AppwriteException) {
      // Session may already be expired — safe to ignore
      console.warn(`Sign out warning: ${error.message}`);
    }
  }
}

// Sign out ALL devices
async function signOutEverywhere() {
  await account.deleteSessions();
}
```

**Why good:** `deleteSession({ sessionId: "current" })` only ends the current session, `deleteSessions()` for security-critical sign-out-everywhere, catches already-expired sessions gracefully

### Good Example — List Active Sessions

```typescript
async function getActiveSessions(): Promise<Models.Session[]> {
  const result = await account.listSessions();
  return result.sessions;
}
```

---

## Pattern 6: Email Verification

### Good Example — Send and Confirm Verification

```typescript
// Step 1: Send verification email
async function sendVerificationEmail() {
  await account.createEmailVerification({
    url: `${window.location.origin}/auth/verify`,
  });
}

// Step 2: Handle verification callback
async function confirmVerification(userId: string, secret: string) {
  await account.updateEmailVerification({ userId, secret });
}
```

**Why good:** Object parameters for all calls, redirect URL for verification callback, two-step flow (create + confirm). Note: the method is `updateEmailVerification` (not `updateVerification`).

---

## Pattern 7: Teams and Memberships

### Good Example — Create Team and Invite Members

```typescript
import { Teams, ID, type Models } from "appwrite";

const teams = new Teams(client);

// Create a team
async function createTeam(
  name: string,
): Promise<Models.Team<Models.Preferences>> {
  return await teams.create({ teamId: ID.unique(), name });
}

// Invite a member by email with roles
async function inviteTeamMember(
  teamId: string,
  email: string,
  roles: string[],
) {
  return await teams.createMembership({
    teamId,
    roles,
    email,
    url: `${window.location.origin}/teams/accept`,
  });
}

// List team members
async function listTeamMembers(teamId: string) {
  return await teams.listMemberships({ teamId });
}

// Update member roles
async function updateMemberRoles(
  teamId: string,
  membershipId: string,
  roles: string[],
) {
  return await teams.updateMembership({ teamId, membershipId, roles });
}
```

**Why good:** Object parameters for all calls, `ID.unique()` for team ID, email-based invitation with redirect URL, roles as string array (any custom role names), separate methods for CRUD

**When to use:** Multi-user collaboration features (workspaces, projects, organizations). Teams integrate with the permissions system via `Role.team(teamId)` and `Role.team(teamId, "role")`.

---

## Pattern 8: Password Reset

### Good Example — Request and Complete Password Reset

```typescript
// Step 1: Request password reset
async function requestPasswordReset(email: string) {
  await account.createRecovery({
    email,
    url: `${window.location.origin}/auth/reset-password`,
  });
}

// Step 2: Complete password reset (on the reset page)
async function completePasswordReset(
  userId: string,
  secret: string,
  newPassword: string,
) {
  await account.updateRecovery({ userId, secret, password: newPassword });
}
```

**Why good:** Object parameters for all calls, two-step flow (create recovery + update recovery), redirect URL for reset page, `secret` from the email link used to verify the request

---

_For database patterns, see [core.md](core.md). For storage patterns, see [storage.md](storage.md). For functions, see [functions.md](functions.md)._
