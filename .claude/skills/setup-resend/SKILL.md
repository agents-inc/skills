# Resend Email & React Email Setup

> **Quick Guide:** One-time setup for Resend email API with React Email templates in a Next.js App Router monorepo. Covers package installation, environment variables, domain verification, React Email project structure, preview server, and Better Auth integration.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `RESEND_API_KEY` environment variable for the server-side API key - NEVER hardcode secrets)**

**(You MUST verify your sending domain in Resend dashboard before production emails - unverified domains only allow sending to your own email)**

**(You MUST create email templates in a dedicated `packages/emails/` directory for monorepo - not inside the Next.js app)**

**(You MUST use `@react-email/components` for email components - external UI libraries like Material UI are NOT supported)**

**(You MUST configure the Resend SDK with appropriate region for your users - reduces delivery latency)**

</critical_requirements>

---

**Auto-detection:** Resend setup, resend install, React Email setup, email templates setup, RESEND_API_KEY, domain verification, SPF DKIM DMARC, transactional email setup, email preview server

**When to use:**

- Initial Resend setup in a new project
- Setting up React Email templates package in monorepo
- Configuring domain verification and DNS records
- Setting up email preview server for development
- Integrating email sending with Better Auth

**When NOT to use:**

- Sending individual emails (use `backend/email.md` for patterns)
- Email template design patterns (use `backend/email.md` for patterns)
- Marketing email campaigns (use dedicated marketing tools)
- SMS or push notifications (different service)

**Key patterns covered:**

- Resend account and API key setup
- Domain verification (SPF, DKIM, DMARC)
- React Email package structure for monorepo
- Email preview server configuration
- Next.js App Router API route setup
- Better Auth email callbacks integration
- Environment variables configuration
- Vercel deployment setup

---

<philosophy>

## Philosophy

Resend is a **developer-first email API** built by the creators of React Email. It provides a simple API for sending transactional emails with excellent deliverability. React Email brings modern component patterns to email development, replacing legacy table-based HTML.

**Core principles:**

1. **Emails as React components** - Write emails with JSX, Tailwind CSS, and TypeScript
2. **Preview before send** - Local development server shows exact email rendering
3. **Monorepo separation** - Email templates in dedicated package, not mixed with app code
4. **Type-safe sending** - Full TypeScript support from template to API call

**When to use Resend:**

- Transactional emails (verification, password reset, notifications)
- Developer experience priority (best DX in the space)
- React/TypeScript stack
- Need reliable deliverability without managing email infrastructure

**When NOT to use Resend:**

- Marketing campaigns with complex analytics (use Mailchimp, SendGrid Marketing)
- Very high volume (>1M emails/month) without enterprise plan
- Non-JavaScript backend (consider Postmark, SendGrid)
- Need SMTP relay (Resend is API-only)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Resend Account and API Key Setup

Create a Resend account and get your API key for development.

#### Account Setup

1. Sign up at [resend.com](https://resend.com)
2. Navigate to API Keys section
3. Create a new API key with appropriate permissions

```bash
# API key format
re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### Environment Variables

```bash
# apps/client-next/.env.local

# Resend Configuration
RESEND_API_KEY=re_your_api_key_here

# Optional: Specify sending region for lower latency
# Options: us-east-1 (default), eu-west-1, sa-east-1, ap-northeast-1
RESEND_REGION=us-east-1

# Email "from" address (must be verified domain or onboarding@resend.dev for testing)
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME="Your App"
```

**Why good:** Environment variables protect secrets, region setting reduces latency, separate FROM variables enable easy updates

---

### Pattern 2: Domain Verification (Production Required)

Verify your domain to send from custom addresses. Unverified accounts can only send to your own email.

#### DNS Records Required

Add these records in your domain's DNS settings (Cloudflare, Route 53, etc.):

```markdown
## Required DNS Records

### SPF Record (TXT)
Host: @
Type: TXT
Value: v=spf1 include:amazonses.com ~all

### DKIM Records (CNAME) - Resend provides 3 records
Host: resend._domainkey
Type: CNAME
Value: (provided by Resend dashboard)

Host: resend2._domainkey
Type: CNAME
Value: (provided by Resend dashboard)

Host: resend3._domainkey
Type: CNAME
Value: (provided by Resend dashboard)

### DMARC Record (TXT) - Recommended
Host: _dmarc
Type: TXT
Value: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

#### Verification Process

1. Go to Resend Dashboard > Domains
2. Click "Add Domain"
3. Enter your domain (e.g., `yourdomain.com`)
4. Copy the provided DNS records
5. Add records to your DNS provider
6. Click "Verify" - may take up to 48 hours for DNS propagation

**Why good:** Domain verification improves deliverability, prevents emails from landing in spam, required for production sending

---

### Pattern 3: React Email Package Structure (Monorepo)

Create a dedicated package for email templates in your monorepo.

#### Package Setup

```bash
# Create the emails package
mkdir -p packages/emails
cd packages/emails

# Initialize package
bun init

# Install dependencies
bun add @react-email/components resend
bun add -D react-email typescript @types/react
```

#### Package Configuration

```json
// packages/emails/package.json
{
  "name": "@repo/emails",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "dev": "email dev --port 3001",
    "preview": "email preview",
    "export": "email export --outDir dist"
  },
  "dependencies": {
    "@react-email/components": "^0.0.37",
    "resend": "^4.1.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "react-email": "^3.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Why good:** Dedicated package enables reuse across apps, dev script starts preview server, separate from app code prevents bundling issues

#### Directory Structure

```
packages/emails/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Export all templates
│   ├── client.ts             # Resend client singleton
│   ├── layouts/
│   │   └── base-layout.tsx   # Shared layout wrapper
│   ├── components/
│   │   ├── button.tsx        # Reusable button
│   │   ├── footer.tsx        # Email footer
│   │   └── header.tsx        # Email header
│   └── templates/
│       ├── verification-email.tsx
│       ├── password-reset.tsx
│       ├── welcome-email.tsx
│       └── notification.tsx
└── emails/                   # For react-email dev server
    └── (symlink to src/templates or copy)
```

#### TypeScript Configuration

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

### Pattern 4: Resend Client Setup

Create a singleton Resend client for the server-side.

#### Constants

```typescript
// packages/emails/src/constants.ts
export const DEFAULT_FROM_ADDRESS = "noreply@yourdomain.com";
export const DEFAULT_FROM_NAME = "Your App";
export const DEFAULT_REPLY_TO = "support@yourdomain.com";
```

#### Client Singleton

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

### Pattern 5: Base Layout Component

Create a reusable layout for consistent email styling.

#### Layout Implementation

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

#### Header Component

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

#### Footer Component

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

### Pattern 6: Sample Email Template

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

### Pattern 7: Package Exports

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

### Pattern 8: Better Auth Integration

Configure Better Auth to use Resend for email verification and password reset.

#### Auth Configuration

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

### Pattern 9: Next.js API Route for Email

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

### Pattern 10: Email Preview Server

Set up the React Email preview server for development.

#### Workspace Configuration

```json
// package.json (root)
{
  "scripts": {
    "email:dev": "bun --cwd packages/emails run dev",
    "email:preview": "bun --cwd packages/emails run preview"
  }
}
```

#### Running Preview Server

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

### Pattern 11: Vercel Deployment Configuration

Configure environment variables for production deployment.

#### Vercel Environment Variables

| Variable | Environment | Value |
|----------|-------------|-------|
| `RESEND_API_KEY` | Production, Preview | `re_xxx...` |
| `EMAIL_FROM_ADDRESS` | Production | `noreply@yourdomain.com` |
| `EMAIL_FROM_NAME` | Production | `Your App Name` |

#### .env.example Template

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

### Pattern 12: Initial Setup Checklist

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

</patterns>

---

<decision_framework>

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

</decision_framework>

---

<integration>

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

</integration>

---

<red_flags>

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

</red_flags>

---

<anti_patterns>

## Anti-Patterns to Avoid

### Hardcoded Secrets

```typescript
// ANTI-PATTERN: API key in source code
const resend = new Resend("re_actual_key_here");
// Commits to git, visible in build logs!
```

**Why it's wrong:** API keys in code get committed to git and exposed.

**What to do instead:** Use RESEND_API_KEY environment variable.

---

### Email Templates in App Directory

```
// ANTI-PATTERN: Templates mixed with app code
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
// ANTI-PATTERN: Forgetting to await render
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
// ANTI-PATTERN: No error handling
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

</anti_patterns>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `RESEND_API_KEY` environment variable for the server-side API key - NEVER hardcode secrets)**

**(You MUST verify your sending domain in Resend dashboard before production emails - unverified domains only allow sending to your own email)**

**(You MUST create email templates in a dedicated `packages/emails/` directory for monorepo - not inside the Next.js app)**

**(You MUST use `@react-email/components` for email components - external UI libraries like Material UI are NOT supported)**

**(You MUST configure the Resend SDK with appropriate region for your users - reduces delivery latency)**

**Failure to follow these rules will cause email delivery failures, security vulnerabilities, or bundling issues.**

</critical_reminders>

---

## Sources

- [Resend Next.js Documentation](https://resend.com/docs/send-with-nextjs)
- [React Email Documentation](https://react.email/docs)
- [React Email Monorepo Setup](https://react.email/docs/getting-started/monorepo-setup/npm)
- [React Email Tailwind Component](https://react.email/docs/components/tailwind)
- [Better Auth Email Configuration](https://www.better-auth.com/docs/concepts/email)
- [Resend + Better Auth Integration](https://resend.com/customers/better-auth)
- [Resend Error Handling](https://resend.com/docs/api-reference/errors)
