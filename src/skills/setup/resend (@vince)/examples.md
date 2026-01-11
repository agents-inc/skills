# Resend Setup - Code Examples

> All code examples for Resend and React Email setup patterns.

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

## Base Layout Component

Create a reusable layout for consistent email styling.

### Layout Implementation

```typescript
// packages/emails/src/layouts/base-layout.tsx
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

import { Footer } from "../components/footer";
import { Header } from "../components/header";

const CONTAINER_MAX_WIDTH = 600;
const CURRENT_YEAR = new Date().getFullYear();

interface BaseLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function BaseLayout({ preview, children }: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="bg-gray-100 font-sans">
          <Container
            className="mx-auto my-10 bg-white rounded-lg shadow-sm"
            style={{ maxWidth: CONTAINER_MAX_WIDTH }}
          >
            <Header />
            <Section className="px-8 py-6">{children}</Section>
            <Footer year={CURRENT_YEAR} />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

// Named export
export { BaseLayout };
```

**Why good:** Tailwind wrapper enables utility classes, consistent structure across all emails, preview text for inbox snippets

### Header Component

```typescript
// packages/emails/src/components/header.tsx
import { Img, Section } from "@react-email/components";

const LOGO_WIDTH = 120;
const LOGO_HEIGHT = 40;

interface HeaderProps {
  logoUrl?: string;
}

export function Header({ logoUrl }: HeaderProps) {
  return (
    <Section className="px-8 py-6 border-b border-gray-200">
      {logoUrl ? (
        <Img
          src={logoUrl}
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          alt="Logo"
        />
      ) : (
        <span className="text-xl font-bold text-gray-900">Your App</span>
      )}
    </Section>
  );
}

// Named export
export { Header };
```

### Footer Component

```typescript
// packages/emails/src/components/footer.tsx
import { Link, Section, Text } from "@react-email/components";

interface FooterProps {
  year: number;
  companyName?: string;
  unsubscribeUrl?: string;
}

export function Footer({
  year,
  companyName = "Your Company",
  unsubscribeUrl,
}: FooterProps) {
  return (
    <Section className="px-8 py-6 border-t border-gray-200 bg-gray-50">
      <Text className="text-center text-sm text-gray-500 m-0">
        &copy; {year} {companyName}. All rights reserved.
      </Text>
      {unsubscribeUrl && (
        <Text className="text-center text-xs text-gray-400 mt-2 m-0">
          <Link href={unsubscribeUrl} className="text-gray-400 underline">
            Unsubscribe from these emails
          </Link>
        </Text>
      )}
    </Section>
  );
}

// Named export
export { Footer };
```

---

## Sample Email Template

Create a verification email template as an example.

```typescript
// packages/emails/src/templates/verification-email.tsx
import { Button, Heading, Text } from "@react-email/components";

import { BaseLayout } from "../layouts/base-layout";

const CTA_BUTTON_PADDING_X = 20;
const CTA_BUTTON_PADDING_Y = 12;
const LINK_EXPIRY_HOURS = 24;

interface VerificationEmailProps {
  userName: string;
  verificationUrl: string;
}

export function VerificationEmail({
  userName,
  verificationUrl,
}: VerificationEmailProps) {
  return (
    <BaseLayout preview={`Verify your email address for Your App`}>
      <Heading className="text-2xl font-bold text-gray-900 mb-4">
        Verify your email address
      </Heading>

      <Text className="text-gray-600 mb-4">Hi {userName},</Text>

      <Text className="text-gray-600 mb-6">
        Thanks for signing up! Please verify your email address by clicking the
        button below.
      </Text>

      <Button
        href={verificationUrl}
        className="bg-blue-600 text-white font-semibold rounded-md"
        style={{
          paddingLeft: CTA_BUTTON_PADDING_X,
          paddingRight: CTA_BUTTON_PADDING_X,
          paddingTop: CTA_BUTTON_PADDING_Y,
          paddingBottom: CTA_BUTTON_PADDING_Y,
        }}
      >
        Verify Email Address
      </Button>

      <Text className="text-sm text-gray-500 mt-6">
        This link will expire in {LINK_EXPIRY_HOURS} hours. If you didn&apos;t
        create an account, you can safely ignore this email.
      </Text>
    </BaseLayout>
  );
}

// Export for Resend render
VerificationEmail.PreviewProps = {
  userName: "John",
  verificationUrl: "https://example.com/verify?token=abc123",
};

// Named export
export { VerificationEmail };
```

**Why good:** Uses BaseLayout for consistency, named constants for padding values, PreviewProps for dev server preview, proper prop typing

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

## Better Auth Integration

Configure Better Auth to use Resend for email verification and password reset.

### Auth Configuration

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { render } from "@react-email/components";

import { db } from "@/lib/db";
import {
  getResendClient,
  VerificationEmail,
  PasswordResetEmail,
  DEFAULT_FROM_ADDRESS,
  DEFAULT_FROM_NAME,
} from "@repo/emails";

const PASSWORD_RESET_EXPIRY_SECONDS = 3600; // 1 hour

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const resend = getResendClient();
      const html = await render(
        PasswordResetEmail({
          userName: user.name ?? "there",
          resetUrl: url,
        })
      );

      await resend.emails.send({
        from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`,
        to: user.email,
        subject: "Reset your password",
        html,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const resend = getResendClient();
      const html = await render(
        VerificationEmail({
          userName: user.name ?? "there",
          verificationUrl: url,
        })
      );

      await resend.emails.send({
        from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`,
        to: user.email,
        subject: "Verify your email address",
        html,
      });
    },
  },
});

// Named export
export { auth };
```

**Why good:** Uses React Email templates with `render()`, imports from @repo/emails package, integrates cleanly with Better Auth callbacks

---

## Next.js API Route for Email

Create an API route for sending emails from your app.

```typescript
// app/api/email/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { render } from "@react-email/components";

import { auth } from "@/lib/auth";
import {
  getResendClient,
  WelcomeEmail,
  DEFAULT_FROM_ADDRESS,
  DEFAULT_FROM_NAME,
} from "@repo/emails";

const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_INTERNAL_ERROR = 500;

export async function POST(request: NextRequest) {
  // Verify user is authenticated
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_UNAUTHORIZED }
    );
  }

  try {
    const resend = getResendClient();
    const html = await render(
      WelcomeEmail({
        userName: session.user.name ?? "there",
      })
    );

    const { data, error } = await resend.emails.send({
      from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_ADDRESS}>`,
      to: session.user.email,
      subject: "Welcome to Your App!",
      html,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: HTTP_STATUS_INTERNAL_ERROR }
      );
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: HTTP_STATUS_INTERNAL_ERROR }
    );
  }
}
```

**Why good:** Session verification prevents abuse, error handling with proper status codes, returns email ID for tracking

---

## Email Preview Server

Set up the React Email preview server for development.

### Workspace Configuration

```json
// package.json (root)
{
  "scripts": {
    "email:dev": "bun --cwd packages/emails run dev",
    "email:preview": "bun --cwd packages/emails run preview"
  }
}
```

### Running Preview Server

```bash
# Start preview server on port 3001
bun run email:dev

# Opens at http://localhost:3001
# - View all email templates
# - See rendered HTML output
# - Test with different props
```

**Why good:** Preview server shows exact email rendering, separate port from main app, PreviewProps enable testing variations

---

## Vercel Deployment Configuration

Configure environment variables for production deployment.

### Vercel Environment Variables

| Variable | Environment | Value |
|----------|-------------|-------|
| `RESEND_API_KEY` | Production, Preview | `re_xxx...` |
| `EMAIL_FROM_ADDRESS` | Production | `noreply@yourdomain.com` |
| `EMAIL_FROM_NAME` | Production | `Your App Name` |

### .env.example Template

```bash
# apps/client-next/.env.example

# ================================================================
# Resend Email Configuration
# ================================================================
# Get your API key from: https://resend.com/api-keys
# Create a new key with "Sending access" permission

RESEND_API_KEY=re_your_api_key_here

# Email sending configuration
# For development: use onboarding@resend.dev or your verified email
# For production: use your verified domain
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME="Your App"

# Optional: Reply-to address for customer support
EMAIL_REPLY_TO=support@yourdomain.com
```

---

## Initial Setup Checklist

Complete checklist for first-time Resend setup.

```markdown
## Resend Setup Checklist

### Account Setup
- [ ] Created Resend account at resend.com
- [ ] Generated API key with sending permissions
- [ ] Added RESEND_API_KEY to .env.local

### Domain Verification (Production)
- [ ] Added domain in Resend dashboard
- [ ] Added SPF record to DNS
- [ ] Added DKIM records (3 CNAME records) to DNS
- [ ] Added DMARC record to DNS (recommended)
- [ ] Verified domain in Resend dashboard
- [ ] Updated EMAIL_FROM_ADDRESS to use verified domain

### React Email Package
- [ ] Created packages/emails directory
- [ ] Installed @react-email/components and resend
- [ ] Created base layout component
- [ ] Created header and footer components
- [ ] Created initial email templates
- [ ] Exported templates from index.ts
- [ ] Added email:dev script to root package.json

### Integration
- [ ] Created Resend client singleton
- [ ] Integrated with Better Auth (verification, password reset)
- [ ] Tested sending via preview server
- [ ] Verified emails appear in Resend dashboard

### Deployment
- [ ] Added environment variables to Vercel
- [ ] Created .env.example for team
- [ ] Tested email sending in preview deployment
- [ ] Confirmed production emails not landing in spam
```
