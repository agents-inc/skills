# Resend Setup - Core Examples

> Essential patterns for Resend client setup and package configuration.

[Back to SKILL.md](../SKILL.md) | [templates.md](templates.md) | [integrations.md](integrations.md) | [deployment.md](deployment.md)

---

## TypeScript Configuration

```json
// packages/emails/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "ES2020"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Resend Client Setup

Create a singleton Resend client for the server-side.

### Constants

```typescript
// packages/emails/src/constants.ts
export const DEFAULT_FROM_ADDRESS = "noreply@yourdomain.com";
export const DEFAULT_FROM_NAME = "Your App";
export const DEFAULT_REPLY_TO = "support@yourdomain.com";
```

### Client Singleton

```typescript
// packages/emails/src/client.ts
import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is required");
    }

    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

// Named export
export { getResendClient };
```

**Why good:** Singleton prevents multiple client instances, throws clear error if API key missing, lazy initialization

---

## Package Exports

Export all templates and utilities for use in apps.

```typescript
// packages/emails/src/index.ts

// Client
export { getResendClient } from "./client";

// Constants
export {
  DEFAULT_FROM_ADDRESS,
  DEFAULT_FROM_NAME,
  DEFAULT_REPLY_TO,
} from "./constants";

// Templates
export { VerificationEmail } from "./templates/verification-email";
export { PasswordResetEmail } from "./templates/password-reset";
export { WelcomeEmail } from "./templates/welcome-email";

// Types
export type { VerificationEmailProps } from "./templates/verification-email";
export type { PasswordResetEmailProps } from "./templates/password-reset";
export type { WelcomeEmailProps } from "./templates/welcome-email";
```

---

## Related Examples

- For email templates and components, see [templates.md](templates.md)
- For Better Auth and API integration, see [integrations.md](integrations.md)
- For deployment and preview server, see [deployment.md](deployment.md)
