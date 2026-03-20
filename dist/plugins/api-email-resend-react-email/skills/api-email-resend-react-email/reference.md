# Email Reference

> Decision frameworks, anti-patterns, and red flags for the Email skill. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) folder for code examples.

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

### Scheduled vs Immediate Sending

```
Should email be sent now?
├── Time-sensitive (password reset, verification)
│   └── Send immediately
├── User timezone matters (reminders, digests)
│   └── Schedule for appropriate local time
├── Campaign with specific launch time
│   └── Schedule using scheduledAt parameter
└── Batch notification
    └── Note: scheduledAt not supported in batch API
```

### Idempotency Key Usage

```
Should you use an idempotency key?
├── Payment/order confirmations
│   └── YES - use order ID as key
├── User-triggered actions (signup, password reset)
│   └── YES - use request ID or user+action combo
├── Retryable requests (webhook handlers, queues)
│   └── YES - prevents duplicate sends on retry
└── One-off manual sends
    └── Optional - not strictly necessary
```

</decision_framework>

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
const resend = new Resend(process.env.PUBLIC_RESEND_KEY);
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

**What to do instead:** Check email preferences before sending non-transactional emails.

</anti_patterns>
