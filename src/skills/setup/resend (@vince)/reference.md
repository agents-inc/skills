# Resend Setup - Reference Guide

> Decision frameworks, anti-patterns, and red flags for Resend and React Email setup.

---

## Decision Framework

### Email Package Location

```
Where should email templates live?
├── Monorepo with multiple apps?
│   └── packages/emails/ - Shared across all apps
├── Single Next.js app?
│   └── src/emails/ or lib/emails/ - Inside app directory
└── Need to share with non-Next.js services?
    └── Separate package with npm publish
```

### Styling Approach

```
How should emails be styled?
├── Need utility classes? → Tailwind (wrap in <Tailwind>)
├── Need fine control? → Inline styles (style prop)
└── Need both? → Tailwind + style overrides
    └── Note: Grid, Flexbox, shadows don't work in email
```

### Sending Strategy

```
When should emails be sent?
├── User action (signup, password reset)
│   └── Synchronous - await the send
├── Background notification
│   └── Queue with retry (if high volume)
├── Transactional with tracking needed
│   └── Use Resend webhooks
└── Batch emails
    └── Use Resend batch API
```

---

## Integration Guide

**Works with:**

- **Next.js App Router**: API routes with `@react-email/components` render
- **Better Auth**: sendVerificationEmail and sendResetPassword callbacks
- **Hono**: Same pattern as Next.js routes
- **Turborepo/pnpm**: packages/emails with workspace dependencies
- **Vercel**: Native support, set env vars in dashboard

**Replaces / Conflicts with:**

- **SendGrid/Mailgun**: Direct alternatives - use one email provider
- **Nodemailer**: Lower level, Resend is higher abstraction
- **AWS SES directly**: Resend uses SES under the hood with better DX

---

## RED FLAGS

**High Priority Issues:**

- Hardcoded RESEND_API_KEY in source code (security vulnerability)
- Sending from unverified domain in production (emails will fail or spam)
- Using posthog-js email components (not @react-email/components)
- Not awaiting render() before sending (sends undefined HTML)

**Medium Priority Issues:**

- No error handling on email send (silent failures)
- Missing PreviewProps on templates (harder to test)
- Email templates inside app directory instead of package (bundling issues)
- Not using Tailwind wrapper (raw CSS harder to maintain)

**Common Mistakes:**

- Using Grid or Flexbox in emails (not supported by email clients)
- Expecting shadows or gradients to work (email limitation)
- Using rem units (email clients handle differently)
- Not testing in multiple email clients (Gmail, Outlook render differently)

**Gotchas & Edge Cases:**

- Resend has 100 emails/day free tier limit
- Unverified domains can only send to your account's email
- DNS propagation takes up to 48 hours for verification
- React Email dev server needs .react-email folder in monorepos
- Server Actions have 1MB limit for attachments

---

## Anti-Patterns to Avoid

### Hardcoded Secrets

```typescript
// ❌ ANTI-PATTERN: API key in source code
const resend = new Resend("re_actual_key_here");
// Commits to git, visible in build logs!
```

**Why it's wrong:** API keys in code get committed to git and exposed.

**What to do instead:** Use RESEND_API_KEY environment variable.

---

### Email Templates in App Directory

```
// ❌ ANTI-PATTERN: Templates mixed with app code
apps/client-next/
├── app/
├── components/
└── emails/          # BAD: Mixed with app code
    └── welcome.tsx
```

**Why it's wrong:** Can cause bundling issues, not reusable across apps.

**What to do instead:** Create packages/emails/ for monorepo separation.

---

### Not Awaiting Render

```typescript
// ❌ ANTI-PATTERN: Forgetting to await render
const html = render(WelcomeEmail({ userName: "John" }));
// html is a Promise, not a string!

await resend.emails.send({
  html, // Sends "[object Promise]" as email body
});
```

**Why it's wrong:** render() returns a Promise, email body will be garbage.

**What to do instead:** Always `await render()` before using the HTML.

---

### Missing Error Handling

```typescript
// ❌ ANTI-PATTERN: No error handling
await resend.emails.send({
  from: "...",
  to: "...",
  subject: "...",
  html: "...",
});
// If this fails, no indication to user or logs!
```

**Why it's wrong:** Silent failures mean lost emails and confused users.

**What to do instead:** Always check the error response and log/handle appropriately.

---

## Good vs Bad Comparisons

### API Key Handling

```typescript
// ✅ Good Example
const resend = new Resend(process.env.RESEND_API_KEY);
// Key from environment, not committed to code
```

**Why good:** Environment variables are secure, not committed to git, can vary per environment

```typescript
// ❌ Bad Example
const resend = new Resend("re_123abc456def");
// Hardcoded key exposed in source control!
```

**Why bad:** API key visible in git history, build logs, and to anyone with code access

---

### Template Organization

```
// ✅ Good Example
packages/
└── emails/
    ├── src/
    │   ├── templates/
    │   │   └── welcome.tsx
    │   └── index.ts
    └── package.json
```

**Why good:** Dedicated package, reusable across apps, clean separation

```
// ❌ Bad Example
apps/client-next/
├── app/
├── components/
└── emails/
    └── welcome.tsx
```

**Why bad:** Mixed with app code, bundling issues, not reusable

---

### Email Rendering

```typescript
// ✅ Good Example
const html = await render(WelcomeEmail({ userName: "John" }));
await resend.emails.send({ html, to, from, subject });
```

**Why good:** Properly awaits render(), HTML is actual string

```typescript
// ❌ Bad Example
const html = render(WelcomeEmail({ userName: "John" }));
await resend.emails.send({ html, to, from, subject });
// html is a Promise!
```

**Why bad:** render() returns Promise, email body is "[object Promise]"

---

### Error Handling

```typescript
// ✅ Good Example
const { data, error } = await resend.emails.send(emailOptions);

if (error) {
  console.error("[Email] Send failed:", error);
  return { success: false, error: error.message };
}

return { success: true, id: data?.id };
```

**Why good:** Checks for errors, logs for debugging, returns typed result

```typescript
// ❌ Bad Example
await resend.emails.send(emailOptions);
return { success: true };
```

**Why bad:** Ignores errors, no logging, reports success even on failure

---

## Email Client Compatibility Notes

### Supported CSS Properties

| Property | Gmail | Outlook | Apple Mail |
|----------|-------|---------|------------|
| `background-color` | Yes | Yes | Yes |
| `color` | Yes | Yes | Yes |
| `font-size` | Yes | Yes | Yes |
| `padding` | Yes | Yes | Yes |
| `margin` | Yes | Partial | Yes |
| `border` | Yes | Yes | Yes |
| `display: flex` | No | No | Yes |
| `display: grid` | No | No | Yes |
| `box-shadow` | No | No | Yes |
| `border-radius` | Yes | No | Yes |

### Best Practices for Compatibility

1. **Use tables for layout** - React Email handles this automatically
2. **Inline styles over classes** - Tailwind wrapper converts for you
3. **Use px units** - Most consistent across clients
4. **Test in multiple clients** - Gmail, Outlook, Apple Mail at minimum
5. **Provide fallback colors** - Not all gradients render
