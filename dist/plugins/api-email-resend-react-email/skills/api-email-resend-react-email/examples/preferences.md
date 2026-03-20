# Email - Preferences Examples

> Email preferences and unsubscribe handling for CAN-SPAM compliance. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for basic send pattern.

> **Database examples below are pseudocode.** Adapt to your ORM/database solution - the patterns remain the same.

---

## Pattern 1: Preferences Schema

Store user email preferences in database.

```typescript
// lib/db/schema/email-preferences.ts
// Adapt to your database solution (Drizzle, Prisma, Kysely, etc.)

// Schema concept - implement with your ORM:
// table: email_preferences
//   user_id: text (primary key)
//   marketing_emails: boolean (default: true)
//   product_updates: boolean (default: true)
//   team_notifications: boolean (default: true)
//   security_alerts: boolean (default: true, cannot be disabled)
//   updated_at: timestamp

interface EmailPreferences {
  userId: string;
  marketingEmails: boolean;
  productUpdates: boolean;
  teamNotifications: boolean;
  securityAlerts: boolean; // Cannot be disabled
  updatedAt: Date;
}
```

---

## Pattern 2: Unsubscribe Endpoint

Token-based unsubscribe for security.

```typescript
// api/email/unsubscribe/route.ts
import jwt from "jsonwebtoken";

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET!;

interface UnsubscribeToken {
  userId: string;
  category: "marketing" | "product_updates" | "team_notifications";
}

// Adapt to your web framework's route handler
export async function handleUnsubscribe(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return Response.redirect("/unsubscribe-error");
  }

  try {
    const decoded = jwt.verify(token, UNSUBSCRIBE_SECRET) as UnsubscribeToken;

    // Map category to database column
    const columnMap = {
      marketing: "marketingEmails",
      product_updates: "productUpdates",
      team_notifications: "teamNotifications",
    } as const;

    const column = columnMap[decoded.category];

    // Update preference in your database
    await updateEmailPreference(decoded.userId, column, false);

    return Response.redirect("/unsubscribe-success");
  } catch (err) {
    return Response.redirect("/unsubscribe-error");
  }
}
```

---

## Pattern 3: Generating Unsubscribe URL

Create signed unsubscribe tokens.

```typescript
// lib/email/unsubscribe.ts
import jwt from "jsonwebtoken";

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET!;
const UNSUBSCRIBE_TOKEN_EXPIRY = "30d";

type EmailCategory = "marketing" | "product_updates" | "team_notifications";

export function generateUnsubscribeUrl(
  userId: string,
  category: EmailCategory,
): string {
  const token = jwt.sign({ userId, category }, UNSUBSCRIBE_SECRET, {
    expiresIn: UNSUBSCRIBE_TOKEN_EXPIRY,
  });

  return `${process.env.APP_URL}/api/email/unsubscribe?token=${token}`;
}

export type { EmailCategory };
```

**Why good:** Token-based unsubscribe prevents unauthorized changes, security alerts cannot be disabled, preferences stored in database for checking before send

---

## Pattern 4: Checking Preferences Before Sending

Respect user preferences for non-transactional emails.

```typescript
// lib/email/send-notification.ts
import { sendEmail } from "./send-email";
import { generateUnsubscribeUrl } from "./unsubscribe";
import { NotificationEmail } from "../templates/notification-email";

interface NotificationOptions {
  userId: string;
  email: string;
  userName: string;
  category: "marketing" | "product_updates" | "team_notifications";
  title: string;
  body: string;
  actionUrl: string;
  actionText: string;
}

export async function sendNotificationEmail(
  options: NotificationOptions,
): Promise<{ sent: boolean; reason?: string }> {
  // Check user preferences (implement with your database solution)
  const preferences = await getEmailPreferences(options.userId);

  // Check if user has opted out of this category
  const categoryMap = {
    marketing: preferences?.marketingEmails ?? true,
    product_updates: preferences?.productUpdates ?? true,
    team_notifications: preferences?.teamNotifications ?? true,
  };

  if (!categoryMap[options.category]) {
    return { sent: false, reason: "User has opted out of this category" };
  }

  // Generate unsubscribe URL
  const unsubscribeUrl = generateUnsubscribeUrl(
    options.userId,
    options.category,
  );

  // Send email
  const result = await sendEmail({
    to: options.email,
    subject: options.title,
    react: NotificationEmail({
      userName: options.userName,
      notificationType: "update",
      title: options.title,
      body: options.body,
      actionUrl: options.actionUrl,
      actionText: options.actionText,
      unsubscribeUrl,
    }),
  });

  return { sent: result.success, reason: result.error };
}
```

**Why good:** Respects user preferences, includes proper unsubscribe link, returns reason if not sent
