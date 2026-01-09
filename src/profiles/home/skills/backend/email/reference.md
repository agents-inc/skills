# Email Reference

> Decision frameworks, anti-patterns, red flags, and integration guides for the Email skill.

---

<decision_framework>

## Decision Framework

### Sync vs Async Sending

```
Is email required for the response?
├── YES (e.g., password reset confirmation)
│   └── Await the send, handle errors
└── NO (e.g., welcome email, notification)
    └── Send async, don't await
```

### Single vs Batch Sending

```
How many emails?
├── 1 email → resend.emails.send()
├── 2-100 emails → resend.batch.send()
└── 100+ emails → Loop with batch API
```

### Retry Strategy

```
Is the error retryable?
├── Rate limit → Retry with exponential backoff
├── Server error (5xx) → Retry with backoff
├── Invalid email → Don't retry, log error
├── Authentication error → Don't retry, check API key
└── Quota exceeded → Don't retry, upgrade plan
```

### Email Category

```
What type of email is this?
├── Transactional (verification, password reset)
│   └── Always send, no unsubscribe needed
├── Notification (mentions, comments)
│   └── Check preferences, include unsubscribe
└── Marketing (promotions, newsletters)
    └── Require explicit opt-in, include unsubscribe
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **Better Auth**: sendVerificationEmail and sendResetPassword callbacks
- **Hono API Routes**: Same patterns as Next.js
- **React Query**: Track email sending status with mutations
- **PostHog**: Track email events via webhooks
- **Drizzle ORM**: Store email preferences and events

**Replaces / Conflicts with:**

- **Nodemailer**: Lower level, Resend is higher abstraction
- **SendGrid/Mailgun**: Direct alternatives - use one provider
- **AWS SES directly**: Resend uses SES under the hood with better DX

</integration>

---

<anti_patterns>

## Anti-Patterns

### Not Awaiting render()

```typescript
// ANTI-PATTERN: Forgetting to await
const html = render(WelcomeEmail({ userName }));
await resend.emails.send({ html }); // Sends "[object Promise]"!
```

**Why it's wrong:** render() returns a Promise, email body will be garbage.

**What to do instead:** Always `const html = await render(...)`.

---

### Client-Side Email Sending

```typescript
// ANTI-PATTERN: Exposing API key to client
"use client";
const resend = new Resend(process.env.NEXT_PUBLIC_RESEND_KEY);
// API key visible in browser bundle!
```

**Why it's wrong:** API key exposed, anyone can send emails as you.

**What to do instead:** Only send emails from server-side code.

---

### Silent Failure

```typescript
// ANTI-PATTERN: No error handling
await resend.emails.send({ ... });
// If this fails, no one knows!
```

**Why it's wrong:** Lost emails, confused users, no debugging info.

**What to do instead:** Check error response, log failures, implement retry.

---

### Missing Unsubscribe

```typescript
// ANTI-PATTERN: No unsubscribe in marketing email
const MarketingEmail = () => (
  <BaseLayout>
    <Text>Check out our new features!</Text>
    {/* No unsubscribe link - illegal! */}
  </BaseLayout>
);
```

**Why it's wrong:** CAN-SPAM violation, users mark as spam instead.

**What to do instead:** Always include unsubscribe link in non-transactional emails.

---

### Ignoring Preferences

```typescript
// ANTI-PATTERN: Sending without checking preferences
async function sendNewsletter(users: User[]) {
  for (const user of users) {
    await sendEmail({ to: user.email, ... });
    // User may have opted out!
  }
}
```

**Why it's wrong:** Spam to users who opted out, damages reputation.

**What to do instead:** Check emailPreferences before sending non-transactional emails.

</anti_patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Not awaiting render() - sends garbage HTML
- API key exposed on client - security vulnerability
- No error handling - silent failures
- Missing unsubscribe links - CAN-SPAM violation
- Sending without checking preferences - spam

**Medium Priority Issues:**

- No retry logic for transient failures
- Sync sending blocking request handlers
- Hardcoded from address instead of environment variable
- No webhook verification signature check
- Not logging email send results

**Common Mistakes:**

- Using Grid or Flexbox in templates (not supported)
- Expecting shadows or gradients to render
- Not testing in multiple email clients
- Forgetting PreviewProps for dev server
- Using rem units (email clients handle differently)

**Gotchas & Edge Cases:**

- Resend batch API limited to 100 emails per request
- render() is async - must await before send
- Webhooks use svix-signature header for verification
- Some email clients strip JavaScript entirely
- Tailwind in emails requires @react-email/tailwind wrapper
- Images must be absolute URLs (no relative paths)

</red_flags>
