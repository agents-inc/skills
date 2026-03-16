# Resend Setup - Reference Guide

> Decision frameworks and anti-patterns for Resend and React Email setup.

---

## Decision Framework

### Email Package Location

```
Where should email templates live?
├── Monorepo with multiple apps?
│   └── packages/emails/ - Shared across all apps
├── Single app?
│   └── src/emails/ or lib/emails/ - Inside app directory
└── Need to share across separate repos?
    └── Separate package with npm publish
```

### Styling Approach

```
How should emails be styled?
├── Need utility classes? → Tailwind (wrap in <Tailwind>)
├── Need fine control? → Inline styles (style prop)
└── Need both? → Tailwind + style overrides
    └── Note: Grid, Flexbox, shadows don't work in most email clients
```

### Content Prop Selection

```
How to pass email content to resend.emails.send()?
├── Using Resend SDK? → react prop (preferred, no render step)
├── Using non-Resend provider? → render() to HTML string
└── Need plain text version? → text prop alongside react/html
```

---

## Anti-Patterns

### Hardcoded API Key

```typescript
// BAD: API key in source code
const resend = new Resend("re_actual_key_here");
```

**Fix:** Use `process.env.RESEND_API_KEY`.

---

### Wrong `render()` Import

```typescript
// BAD: render is not in @react-email/components
import { render } from "@react-email/components";

// GOOD: render lives in @react-email/render
import { render } from "@react-email/render";
```

**Fix:** Install `@react-email/render` separately. Or better: skip `render()` entirely and use the `react` prop with Resend.

---

### Forgetting to Await `render()`

```typescript
// BAD: render() returns a Promise
const html = render(WelcomeEmail({ userName: "John" }));
await resend.emails.send({ html }); // Sends "[object Promise]"
```

**Fix:** Always `await render()` before using the result.

---

### Parsing Webhook Body as JSON

```typescript
// BAD: Parsing before verification breaks the cryptographic signature
const body = await request.json();
resend.webhooks.verify({ payload: JSON.stringify(body), ... });

// GOOD: Use raw text body
const payload = await request.text();
resend.webhooks.verify({ payload, ... });
```

**Fix:** Always use `request.text()` for webhook payloads.
