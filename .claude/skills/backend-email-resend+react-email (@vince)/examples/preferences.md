# Email - Preferences Examples

> Email preferences and unsubscribe handling for CAN-SPAM compliance. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for basic send pattern.

> **Database examples below use Drizzle ORM.** Adapt to your ORM of choice (Prisma, Kysely, raw SQL, etc.) - the patterns remain the same.

---

## Pattern 1: Preferences Schema

Store user email preferences in database.

```typescript
// lib/db/schema/email-preferences.ts
// Example using Drizzle ORM - adapt to your database solution
import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const emailPreferences = pgTable("email_preferences", {
  userId: text("user_id").primaryKey(),
  marketingEmails: boolean("marketing_emails").default(true),
  productUpdates: boolean("product_updates").default(true),
  teamNotifications: boolean("team_notifications").default(true),
  securityAlerts: boolean("security_alerts").default(true), // Cannot be disabled
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

---

## Pattern 2: Unsubscribe Endpoint

Token-based unsubscribe for security.

```typescript
// app/api/email/unsubscribe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm"; // Adapt to your ORM
import jwt from "jsonwebtoken";

import { db } from "@/lib/db";
import { emailPreferences } from "@/lib/db/schema";

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET!;

interface UnsubscribeToken {
  userId: string;
  category: "marketing" | "product_updates" | "team_notifications";
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect("/unsubscribe-error");
  }

  try {
    const decoded = jwt.verify(token, UNSUBSCRIBE_SECRET) as UnsubscribeToken;

    // Map category to column
    const columnMap = {
      marketing: "marketingEmails",
      product_updates: "productUpdates",
      team_notifications: "teamNotifications",
    } as const;

    const column = columnMap[decoded.category];

    // Update preference
    await db
      .update(emailPreferences)
      .set({ [column]: false, updatedAt: new Date() })
      .where(eq(emailPreferences.userId, decoded.userId));

    return NextResponse.redirect("/unsubscribe-success");
  } catch (err) {
    return NextResponse.redirect("/unsubscribe-error");
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

  return `${process.env.NEXT_PUBLIC_APP_URL}/api/email/unsubscribe?token=${token}`;
}

// Named export
export { generateUnsubscribeUrl };
export type { EmailCategory };
```

**Why good:** Token-based unsubscribe prevents unauthorized changes, security alerts cannot be disabled, preferences stored in database for checking before send

---

## Pattern 4: Checking Preferences Before Sending

Respect user preferences for non-transactional emails.

```typescript
// lib/email/send-notification.ts
import { eq } from "drizzle-orm"; // Adapt to your ORM

import { db } from "@/lib/db";
import { emailPreferences } from "@/lib/db/schema";
import { sendEmail } from "./send-email";
import { generateUnsubscribeUrl } from "./unsubscribe";
import { NotificationEmail } from "@repo/emails";

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
  // Check user preferences
  const prefs = await db
    .select()
    .from(emailPreferences)
    .where(eq(emailPreferences.userId, options.userId))
    .limit(1);

  const preferences = prefs[0];

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

// Named export
export { sendNotificationEmail };
```

**Why good:** Respects user preferences, includes proper unsubscribe link, returns reason if not sent

---

## Email Category Decision Tree

```
What type of email is this?
+-- Transactional (verification, password reset)
|   --> Always send, no unsubscribe needed
+-- Notification (mentions, comments)
|   --> Check preferences, include unsubscribe
+-- Marketing (promotions, newsletters)
    --> Require explicit opt-in, include unsubscribe
```
