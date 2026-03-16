# Email - Authentication Integration

> **This file has been removed.** Auth integration patterns belong in your authentication skill/documentation, not in the email skill.

**Key guidance:** Wire your auth system's email callbacks (verification, password reset) to the `sendEmailWithRetry()` function from [core.md](core.md) Pattern 3. The email skill handles sending; your auth system handles when to trigger it.

```typescript
// In your auth configuration, connect callbacks to the email send function:
async function sendVerificationEmail(
  user: { email: string; name?: string },
  url: string,
) {
  await sendEmailWithRetry({
    to: user.email,
    subject: "Verify your email address",
    react: VerificationEmail({
      userName: user.name ?? "there",
      verificationUrl: url,
    }),
  });
}
```

See [core.md](core.md) for the full `sendEmailWithRetry` implementation.
