# Resend Setup - Email Templates

> Base layout, reusable components, and sample email template patterns.

[Back to SKILL.md](../SKILL.md) | [core.md](core.md) | [integrations.md](integrations.md) | [deployment.md](deployment.md)

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

---

## Header Component

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

---

## Footer Component

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

## Related Examples

- For client setup and exports, see [core.md](core.md)
- For Better Auth and API integration, see [integrations.md](integrations.md)
- For deployment and preview server, see [deployment.md](deployment.md)
