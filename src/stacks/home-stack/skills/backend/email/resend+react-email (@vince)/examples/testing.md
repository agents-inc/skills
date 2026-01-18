# Email - Testing Examples

> Testing patterns for email templates. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for basic template structure.

---

## Pattern 1: Preview Server

Use React Email's preview server for visual testing during development.

```bash
# Start React Email preview server
bun run email:dev

# View at http://localhost:3001
# - See all templates
# - Modify PreviewProps
# - View HTML source
```

---

## Pattern 2: Unit Testing Templates

Test rendered output with Vitest.

```typescript
// packages/emails/src/templates/__tests__/welcome-email.test.tsx
import { render } from "@react-email/components";
import { describe, it, expect } from "vitest";

import { WelcomeEmail } from "../welcome-email";

describe("WelcomeEmail", () => {
  it("renders with required props", async () => {
    const html = await render(
      WelcomeEmail({
        userName: "John",
        loginUrl: "https://example.com/login",
      })
    );

    expect(html).toContain("Welcome to Your App!");
    expect(html).toContain("John");
    expect(html).toContain("https://example.com/login");
  });

  it("renders optional features list", async () => {
    const html = await render(
      WelcomeEmail({
        userName: "John",
        loginUrl: "https://example.com/login",
        features: ["Feature 1", "Feature 2"],
      })
    );

    expect(html).toContain("Feature 1");
    expect(html).toContain("Feature 2");
  });

  it("handles empty features gracefully", async () => {
    const html = await render(
      WelcomeEmail({
        userName: "John",
        loginUrl: "https://example.com/login",
        features: [],
      })
    );

    expect(html).not.toContain("Here's what you can do:");
  });
});
```

**Why good:** Tests actual rendered output, covers edge cases, catches rendering issues before sending

---

## Pattern 3: Testing Send Functions

Test email sending with mocked Resend client.

```typescript
// lib/email/__tests__/send-email.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendEmail } from "../send-email";

// Mock Resend client
vi.mock("@repo/emails", () => ({
  getResendClient: () => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "test-id" }, error: null }),
    },
  }),
  DEFAULT_FROM_ADDRESS: "test@example.com",
  DEFAULT_FROM_NAME: "Test App",
}));

describe("sendEmail", () => {
  it("returns success with email id", async () => {
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      react: <div>Test</div>,
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe("test-id");
  });

  it("handles API errors", async () => {
    // Override mock for this test
    vi.mocked(getResendClient).mockReturnValue({
      emails: {
        send: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Rate limited" },
        }),
      },
    });

    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      react: <div>Test</div>,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Rate limited");
  });
});
```

---

## Testing Checklist

- [ ] All templates render without errors
- [ ] Required props are validated (TypeScript)
- [ ] Optional props have sensible defaults
- [ ] Preview props are defined for dev server
- [ ] Edge cases handled (empty arrays, null values)
- [ ] Links are properly escaped
- [ ] Special characters render correctly (&apos;, etc.)
