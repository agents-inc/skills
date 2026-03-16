---
name: api-email-resend-react-email
description: Resend + React Email templates
---

# Email Patterns with Resend and React Email

> **Quick Guide:** Use Resend for transactional emails with React Email templates. Always `await render()` before sending (it returns a Promise). Server-side only - never expose API keys to clients. Implement retry with exponential backoff for transient failures. Include unsubscribe links in non-transactional emails (CAN-SPAM). Use `resend.batch.send()` for 2-100 recipients (no attachments or scheduling support in batch). React Email 5.0+ deprecated `renderAsync` - use `render()` instead. Webhook verification requires raw request body and `webhookSecret` parameter.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST await `render()` before passing HTML to resend.emails.send() - render returns a Promise)**

**(You MUST handle Resend API errors and implement retry logic for transient failures)**

**(You MUST use server-side sending for all emails - never expose RESEND_API_KEY to the client)**

**(You MUST include unsubscribe links in marketing/notification emails - required for CAN-SPAM compliance)**

**(You MUST use typed props interfaces for all email templates - enables compile-time validation)**

</critical_requirements>

---

**Auto-detection:** Resend, React Email, @react-email/components, resend.emails.send, email template, transactional email, verification email, password reset email, notification email, email rendering, resend.batch.send, resend.webhooks.verify

**When to use:**

- Sending transactional emails (verification, password reset, receipts)
- Creating React Email templates with Tailwind styling
- Building notification systems with email delivery
- Implementing email tracking via webhooks
- Batch sending to multiple recipients

**When NOT to use:**

- Marketing campaign management (use dedicated marketing tools)
- SMS or push notifications (different services)
- Email list management (use Resend Audiences or marketing tools)

---

<philosophy>

## Philosophy

Email in modern applications follows a **server-side, template-driven** approach. React Email brings component patterns to email development, while Resend handles reliable delivery.

**Core principles:**

1. **Server-side only** - Never expose API keys to clients
2. **Typed templates** - Props interfaces catch errors at compile time
3. **Reliable delivery** - Error handling with retry logic for transient failures
4. **Non-blocking** - Fire-and-forget for non-critical emails

**When to send emails:**

- User authentication events (verification, password reset, 2FA)
- Transactional confirmations (purchases, signups, invitations)
- Important notifications (security alerts, account changes)
- Team collaboration (invites, mentions, updates)

**When NOT to send emails:**

- Every minor action (creates email fatigue)
- Marketing without consent (spam, illegal)
- Real-time alerts (use push notifications)
- In-app actions (show in-app notifications instead)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Email Template Structure

Define typed props, use React Email components, add PreviewProps for the dev server.

```typescript
interface WelcomeEmailProps {
  userName: string;
  loginUrl: string;
  features?: string[];
}

export function WelcomeEmail({ userName, loginUrl, features = [] }: WelcomeEmailProps) {
  return (
    <BaseLayout preview={`Welcome, ${userName}!`}>
      <Heading>Welcome!</Heading>
      <Text>Hi {userName},</Text>
      <Button href={loginUrl}>Get Started</Button>
    </BaseLayout>
  );
}

WelcomeEmail.PreviewProps = { userName: "John", loginUrl: "..." } satisfies WelcomeEmailProps;
```

See [examples/core.md](examples/core.md) Pattern 1 for complete template with layout and styling.

---

### Pattern 2: Sending with Error Handling

Always await `render()`, check the `{ data, error }` response, return typed results.

```typescript
const html = await render(options.react); // CRITICAL: must await

const { data, error } = await resend.emails.send({
  from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`,
  to: options.to,
  subject: options.subject,
  html,
});

if (error) {
  return { success: false, error: error.message };
}
return { success: true, id: data?.id };
```

See [examples/core.md](examples/core.md) Pattern 2-3 for complete send wrapper and retry with exponential backoff.

---

### Pattern 3: Async (Fire-and-Forget) Sending

For non-critical emails (welcome, notifications), don't block the response.

```typescript
// Non-blocking - catches errors internally
sendEmailAsync(options);
return Response.json({ success: true }); // Returns immediately
```

Track in-flight promises for graceful shutdown. See [examples/async-batch.md](examples/async-batch.md) Pattern 1-2.

---

### Pattern 4: Batch API

Use `resend.batch.send()` for 2-100 recipients. Render all templates in parallel.

```typescript
const rendered = await Promise.all(
  emails.map(async (e) => ({
    from,
    to: e.to,
    subject: e.subject,
    html: await render(e.react),
  })),
);
const { data, error } = await resend.batch.send(rendered);
```

**Batch limitations:** No `attachments`, no `scheduledAt`. Tags and idempotency keys are supported. See [examples/async-batch.md](examples/async-batch.md) Pattern 3-4.

---

### Pattern 5: Webhook Verification

Use `resend.webhooks.verify()` with the raw request body. JSON parsing breaks signature verification.

```typescript
const payload = await request.text(); // Raw body, NOT .json()

const event = resend.webhooks.verify({
  payload,
  headers: {
    id: request.headers.get("svix-id") ?? "",
    timestamp: request.headers.get("svix-timestamp") ?? "",
    signature: request.headers.get("svix-signature") ?? "",
  },
  webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
});
```

See [examples/webhooks.md](examples/webhooks.md) for full handler with event processing and Svix alternative.

---

### Pattern 6: Scheduled Sending, Idempotency Keys, Tags

```typescript
// Scheduled (up to 30 days, NOT supported in batch)
await resend.emails.send({ ...payload, scheduledAt: futureDate.toISOString() });

// Idempotency (256 char limit, expires 24h)
await resend.emails.send({
  ...payload,
  headers: { "Idempotency-Key": orderId },
});

// Tags (ASCII alphanumeric, underscores, dashes only)
await resend.emails.send({
  ...payload,
  tags: [{ name: "campaign", value: "launch" }],
});
```

See [examples/advanced-features.md](examples/advanced-features.md) for complete implementations with validation.

---

### Pattern 7: Unsubscribe and Preferences

Non-transactional emails MUST include unsubscribe links (CAN-SPAM). Use signed tokens for security.

```typescript
// In every notification/marketing template:
<Link href={unsubscribeUrl}>Unsubscribe from these notifications</Link>

// Generate signed unsubscribe URLs
const token = jwt.sign({ userId, category }, UNSUBSCRIBE_SECRET, { expiresIn: "30d" });
const url = `${APP_URL}/api/email/unsubscribe?token=${token}`;
```

See [examples/preferences.md](examples/preferences.md) for preference schema, checking before send, and unsubscribe endpoint.

</patterns>

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Template structure, sending with error handling, retry logic
- [examples/async-batch.md](examples/async-batch.md) - Async sending, batch API
- [examples/webhooks.md](examples/webhooks.md) - Webhook handler with signature verification
- [examples/templates.md](examples/templates.md) - Password Reset, Notification templates
- [examples/preferences.md](examples/preferences.md) - Unsubscribe, email preferences
- [examples/advanced-features.md](examples/advanced-features.md) - Scheduled sending, idempotency keys, tags
- [reference.md](reference.md) - Decision frameworks, anti-patterns

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Not awaiting `render()` - sends `"[object Promise]"` as email body
- API key exposed on client - security vulnerability
- No error handling - silent failures
- Missing unsubscribe links in non-transactional emails - CAN-SPAM violation
- Sending without checking user preferences - spam

**Medium Priority Issues:**

- No retry logic for transient failures (rate limits, 5xx errors)
- Sync sending blocking request handlers for non-critical emails
- Hardcoded from address instead of environment variable
- No webhook verification signature check
- Not logging email send results

**Common Mistakes:**

- Using `Grid` or `Flexbox` in email templates (not supported by email clients)
- Expecting shadows or gradients to render in emails
- Using `rem` units (email clients handle differently)
- Forgetting `PreviewProps` for dev server

**Gotchas & Edge Cases:**

- `render()` is async in React Email 5.0+ (`renderAsync` deprecated)
- Batch API limited to 100 emails, does NOT support `attachments` or `scheduledAt`
- Webhooks require raw request body - JSON parsing breaks signature verification
- Webhook verify uses `webhookSecret` parameter (not `secret`)
- Webhook headers object uses short keys: `id`, `timestamp`, `signature`
- Idempotency keys expire after 24 hours, max 256 characters
- Tags: ASCII alphanumeric, underscores, dashes only, max 256 chars per key/value
- Tailwind in emails requires `@react-email/tailwind` wrapper (Tailwind 4 supported in React Email 5.0+)
- Images must use absolute URLs (no relative paths)

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST await `render()` before passing HTML to resend.emails.send() - render returns a Promise)**

**(You MUST handle Resend API errors and implement retry logic for transient failures)**

**(You MUST use server-side sending for all emails - never expose RESEND_API_KEY to the client)**

**(You MUST include unsubscribe links in marketing/notification emails - required for CAN-SPAM compliance)**

**(You MUST use typed props interfaces for all email templates - enables compile-time validation)**

**Failure to follow these rules will cause email delivery failures, security vulnerabilities, or legal compliance issues.**

</critical_reminders>

---

## Sources

- [Resend Node.js SDK](https://resend.com/docs/send-with-nodejs)
- [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email)
- [Resend Batch API](https://resend.com/docs/api-reference/emails/send-batch-emails)
- [Resend Webhooks Verification](https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests)
- [Resend Idempotency Keys](https://resend.com/blog/engineering-idempotency-keys)
- [Resend Error Handling](https://resend.com/docs/api-reference/errors)
- [React Email Components](https://react.email/docs/components)
- [React Email 5.0 Release](https://resend.com/blog/react-email-5)
