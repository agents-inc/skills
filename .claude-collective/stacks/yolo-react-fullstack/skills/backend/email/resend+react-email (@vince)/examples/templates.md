# Email - Template Examples

> Template patterns for common email types. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for basic template structure.

---

## Pattern 1: Password Reset Email

Security-focused template with expiry messaging.

```typescript
// packages/emails/src/templates/password-reset.tsx
import { Button, Heading, Text } from "@react-email/components";

import { BaseLayout } from "../layouts/base-layout";

const CTA_PADDING_X = 24;
const CTA_PADDING_Y = 12;
const LINK_EXPIRY_MINUTES = 60;

interface PasswordResetEmailProps {
  userName: string;
  resetUrl: string;
}

export function PasswordResetEmail({
  userName,
  resetUrl,
}: PasswordResetEmailProps) {
  return (
    <BaseLayout preview="Reset your password">
      <Heading className="text-2xl font-bold text-gray-900 mb-4">
        Reset your password
      </Heading>

      <Text className="text-gray-600 mb-4">Hi {userName},</Text>

      <Text className="text-gray-600 mb-6">
        We received a request to reset your password. Click the button below to
        create a new password.
      </Text>

      <Button
        href={resetUrl}
        className="bg-blue-600 text-white font-semibold rounded-md"
        style={{
          paddingLeft: CTA_PADDING_X,
          paddingRight: CTA_PADDING_X,
          paddingTop: CTA_PADDING_Y,
          paddingBottom: CTA_PADDING_Y,
        }}
      >
        Reset Password
      </Button>

      <Text className="text-sm text-gray-500 mt-6">
        This link will expire in {LINK_EXPIRY_MINUTES} minutes.
      </Text>

      <Text className="text-sm text-gray-500 mt-4">
        If you didn&apos;t request a password reset, you can safely ignore this
        email. Your password will remain unchanged.
      </Text>
    </BaseLayout>
  );
}

PasswordResetEmail.PreviewProps = {
  userName: "John",
  resetUrl: "https://example.com/reset?token=abc123",
} satisfies PasswordResetEmailProps;

// Named exports
export { PasswordResetEmail };
export type { PasswordResetEmailProps };
```

**Why good:** Clear security messaging, expiry time communicated, reassurance for users who didn't request reset

---

## Pattern 2: Notification Email with Unsubscribe

Template with required CAN-SPAM unsubscribe link.

```typescript
// packages/emails/src/templates/notification-email.tsx
import { Button, Heading, Link, Text } from "@react-email/components";

import { BaseLayout } from "../layouts/base-layout";

const CTA_PADDING_X = 20;
const CTA_PADDING_Y = 10;

interface NotificationEmailProps {
  userName: string;
  notificationType: "mention" | "comment" | "update";
  title: string;
  body: string;
  actionUrl: string;
  actionText: string;
  unsubscribeUrl: string;
}

const NOTIFICATION_TITLES: Record<string, string> = {
  mention: "You were mentioned",
  comment: "New comment on your post",
  update: "Project update",
};

export function NotificationEmail({
  userName,
  notificationType,
  title,
  body,
  actionUrl,
  actionText,
  unsubscribeUrl,
}: NotificationEmailProps) {
  return (
    <BaseLayout preview={title}>
      <Text className="text-sm text-blue-600 font-medium mb-2">
        {NOTIFICATION_TITLES[notificationType]}
      </Text>

      <Heading className="text-xl font-bold text-gray-900 mb-4">
        {title}
      </Heading>

      <Text className="text-gray-600 mb-4">Hi {userName},</Text>

      <Text className="text-gray-600 mb-6">{body}</Text>

      <Button
        href={actionUrl}
        className="bg-blue-600 text-white font-semibold rounded-md"
        style={{
          paddingLeft: CTA_PADDING_X,
          paddingRight: CTA_PADDING_X,
          paddingTop: CTA_PADDING_Y,
          paddingBottom: CTA_PADDING_Y,
        }}
      >
        {actionText}
      </Button>

      {/* REQUIRED: Unsubscribe link for CAN-SPAM compliance */}
      <Text className="text-xs text-gray-400 mt-8 text-center">
        <Link href={unsubscribeUrl} className="text-gray-400 underline">
          Unsubscribe from these notifications
        </Link>
      </Text>
    </BaseLayout>
  );
}

NotificationEmail.PreviewProps = {
  userName: "John",
  notificationType: "mention",
  title: "Sarah mentioned you in a comment",
  body: '@John can you review this?',
  actionUrl: "https://example.com/comments/123",
  actionText: "View Comment",
  unsubscribeUrl: "https://example.com/unsubscribe?token=abc",
} satisfies NotificationEmailProps;

// Named exports
export { NotificationEmail };
export type { NotificationEmailProps };
```

**Why good:** Unsubscribe link is required for compliance, notification type enables different styling, props are fully typed
