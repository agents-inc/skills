# Clerk Quick Reference

> Environment variables, Clerk Dashboard setup, webhook events, and common configuration. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Environment Variables

| Variable                                          | Required     | Description                                         |
| ------------------------------------------------- | ------------ | --------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`               | Yes          | Public key from Clerk Dashboard (starts with `pk_`) |
| `CLERK_SECRET_KEY`                                | Yes          | Secret key from Clerk Dashboard (starts with `sk_`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`                   | No           | Custom sign-in page path (default: Clerk hosted)    |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`                   | No           | Custom sign-up page path (default: Clerk hosted)    |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | No           | Redirect after sign-in (default: `/`)               |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | No           | Redirect after sign-up (default: `/`)               |
| `CLERK_WEBHOOK_SIGNING_SECRET`                    | For webhooks | Webhook signing secret (starts with `whsec_`)       |

**Keys are found in:** Clerk Dashboard > Configure > API Keys

**Webhook secret is found in:** Clerk Dashboard > Webhooks > Select endpoint > Signing Secret

---

## Clerk Dashboard Setup Checklist

1. Create application at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Configure authentication methods (email, social, phone)
3. Copy API keys to `.env.local`
4. Enable Organizations (if needed): Configure > Organizations
5. Set up roles and permissions (if needed): Configure > Organizations > Roles
6. Add webhook endpoint (if needed): Webhooks > Add Endpoint
7. Configure redirect URLs: Configure > Paths

---

## Webhook Event Types

### User Events

| Event          | Trigger              | Payload          |
| -------------- | -------------------- | ---------------- |
| `user.created` | New user signs up    | `UserJSON`       |
| `user.updated` | User profile changes | `UserJSON`       |
| `user.deleted` | User account deleted | `{ id: string }` |

### Session Events

| Event             | Trigger         | Payload       |
| ----------------- | --------------- | ------------- |
| `session.created` | User signs in   | `SessionJSON` |
| `session.ended`   | User signs out  | `SessionJSON` |
| `session.removed` | Session revoked | `SessionJSON` |

### Organization Events

| Event                             | Trigger              | Payload                      |
| --------------------------------- | -------------------- | ---------------------------- |
| `organization.created`            | New org created      | `OrganizationJSON`           |
| `organization.updated`            | Org settings changed | `OrganizationJSON`           |
| `organization.deleted`            | Org deleted          | `{ id: string }`             |
| `organizationMembership.created`  | Member added         | `OrganizationMembershipJSON` |
| `organizationMembership.updated`  | Member role changed  | `OrganizationMembershipJSON` |
| `organizationMembership.deleted`  | Member removed       | `OrganizationMembershipJSON` |
| `organizationInvitation.created`  | Invite sent          | `OrganizationInvitationJSON` |
| `organizationInvitation.accepted` | Invite accepted      | `OrganizationInvitationJSON` |
| `organizationInvitation.revoked`  | Invite revoked       | `OrganizationInvitationJSON` |

### Email & SMS Events

| Event           | Trigger              | Payload     |
| --------------- | -------------------- | ----------- |
| `email.created` | Email sent via Clerk | `EmailJSON` |
| `sms.created`   | SMS sent via Clerk   | `SMSJSON`   |

---

## Default Organization Roles

| Role   | Slug         | Default Permissions                                                       |
| ------ | ------------ | ------------------------------------------------------------------------- |
| Admin  | `org:admin`  | All system permissions (manage members, manage org, manage billing, etc.) |
| Member | `org:member` | Read members, read billing                                                |

**Custom permissions format:** `org:<feature>:<action>` (e.g., `org:invoices:create`, `org:reports:read`)

---

## Hooks Quick Reference

| Hook                    | Purpose               | Key Returns                                                        |
| ----------------------- | --------------------- | ------------------------------------------------------------------ |
| `useUser()`             | User profile data     | `isLoaded`, `isSignedIn`, `user`                                   |
| `useAuth()`             | Auth state and tokens | `userId`, `sessionId`, `orgId`, `getToken()`, `has()`, `signOut()` |
| `useClerk()`            | Low-level Clerk API   | Full Clerk instance                                                |
| `useSession()`          | Current session info  | `isLoaded`, `isSignedIn`, `session`                                |
| `useOrganization()`     | Active org data       | `organization`, `membership`, `isLoaded`                           |
| `useOrganizationList()` | All user orgs         | `organizationList`, `isLoaded`, `createOrganization()`             |
| `useSignIn()`           | Custom sign-in flows  | `signIn`, `setActive`, `isLoaded`                                  |
| `useSignUp()`           | Custom sign-up flows  | `signUp`, `setActive`, `isLoaded`                                  |

---

## Server-Side Helpers Quick Reference

| Helper                 | Import                   | Context                                           | Returns                                                                    |
| ---------------------- | ------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------- |
| `auth()`               | `@clerk/nextjs/server`   | Server Components, Route Handlers, Server Actions | `userId`, `sessionId`, `orgId`, `protect()`, `has()`, `redirectToSignIn()` |
| `currentUser()`        | `@clerk/nextjs/server`   | Server Components, Route Handlers, Server Actions | Full `BackendUser` object or `null`                                        |
| `clerkMiddleware()`    | `@clerk/nextjs/server`   | Middleware file                                   | Middleware handler                                                         |
| `createRouteMatcher()` | `@clerk/nextjs/server`   | Middleware file                                   | Route matching function                                                    |
| `verifyWebhook()`      | `@clerk/nextjs/webhooks` | Webhook Route Handlers                            | Verified webhook event                                                     |

---

## Component Quick Reference

| Component                  | Purpose                   | Usage                               |
| -------------------------- | ------------------------- | ----------------------------------- |
| `<ClerkProvider>`          | Auth context wrapper      | Wrap app in layout.tsx              |
| `<SignIn />`               | Full sign-in form         | Dedicated page with catch-all route |
| `<SignUp />`               | Full sign-up form         | Dedicated page with catch-all route |
| `<UserButton />`           | Avatar with dropdown menu | Header/nav bar                      |
| `<UserProfile />`          | Full profile management   | Dedicated settings page             |
| `<OrganizationSwitcher />` | Org picker + creator      | Header/sidebar                      |
| `<OrganizationProfile />`  | Org settings management   | Org settings page                   |
| `<OrganizationList />`     | List user's organizations | Org selection page                  |
| `<Show>`                   | Conditional rendering     | Auth/role/permission gating         |
| `<SignInButton />`         | Button that opens sign-in | Header when signed out              |
| `<SignUpButton />`         | Button that opens sign-up | Header when signed out              |

---

## Middleware File Naming

| Next.js Version | Filename        | Location               |
| --------------- | --------------- | ---------------------- |
| Next.js 16+     | `proxy.ts`      | Project root or `src/` |
| Next.js <=15    | `middleware.ts` | Project root or `src/` |

The code is identical in both cases -- only the filename differs.

---

## Core 3 Migration Cheat Sheet

| Core 2 (Deprecated)               | Core 3 (Current)                        |
| --------------------------------- | --------------------------------------- |
| `<SignedIn>`                      | `<Show when="signed-in">`               |
| `<SignedOut>`                     | `<Show when="signed-out">`              |
| `<Protect role="admin">`          | `<Show when={{ role: "org:admin" }}>`   |
| `<Protect permission="...">`      | `<Show when={{ permission: "..." }}>`   |
| `<Protect condition={...}>`       | `<Show when={(has) => has(...)}>`       |
| `@clerk/clerk-react`              | `@clerk/react`                          |
| `@clerk/types`                    | `@clerk/shared/types`                   |
| `appearance.layout`               | `appearance.options`                    |
| `authMiddleware()`                | `clerkMiddleware()`                     |
| `middleware.ts` (Next.js 16)      | `proxy.ts`                              |
| `getToken()` returns null offline | `getToken()` throws `ClerkOfflineError` |

---

## Version Requirements (Core 3)

- Node.js 20.9.0+
- Next.js 15.2.3+
- Expo SDK 53+

Run `npx @clerk/upgrade` to automate migration.
