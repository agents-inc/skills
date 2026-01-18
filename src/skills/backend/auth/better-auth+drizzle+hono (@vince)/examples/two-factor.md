# Better Auth - Two-Factor Authentication Examples

> TOTP-based two-factor authentication patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Additional Examples:**
- [core.md](core.md) - Sign up, sign in, client setup
- [oauth.md](oauth.md) - GitHub, Google OAuth providers
- [organizations.md](organizations.md) - Multi-tenancy and invitations
- [sessions.md](sessions.md) - Session configuration and revocation

---

## Server Configuration

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/lib/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  plugins: [
    twoFactor({
      issuer: "MyApp", // Shown in authenticator app
      // Optional: skip verification on enable (not recommended)
      // skipVerificationOnEnable: false,
    }),
  ],
});

export { auth };
```

After adding the plugin, run:
```bash
# Step 1: Generate Better Auth schema
npx @better-auth/cli generate

# Step 2: Generate Drizzle migration
npx drizzle-kit generate

# Step 3: Apply migration to database
npx drizzle-kit migrate
```

---

## Client Configuration

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [
    twoFactorClient({
      twoFactorPage: "/auth/two-factor", // Redirect for 2FA verification
    }),
  ],
});

export { authClient };
```

---

## Enable 2FA Flow

```typescript
// components/enable-2fa.tsx
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export function Enable2FA() {
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleEnable = async (password: string) => {
    try {
      const result = await authClient.twoFactor.enable({
        password,
      });

      if (result.error) {
        setError(result.error.message);
        return;
      }

      // Get TOTP URI for QR code generation
      setTotpUri(result.data?.totpURI ?? null);
      setBackupCodes(result.data?.backupCodes ?? []);
    } catch (err) {
      setError("Failed to enable 2FA");
    }
  };

  return (
    <div>
      {/* Render QR code from totpUri */}
      {/* Display backup codes for user to save */}
    </div>
  );
}

// Named export
export { Enable2FA };
```

---

## Verify 2FA on Sign In

```typescript
// components/verify-2fa.tsx
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export function Verify2FA() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    try {
      const result = await authClient.twoFactor.verifyTOTP({
        code,
        trustDevice: true, // Skip 2FA on this device for future logins
      });

      if (result.error) {
        setError("Invalid code. Please try again.");
        return;
      }

      // Redirect to dashboard on success
      window.location.href = "/dashboard";
    } catch (err) {
      setError("Verification failed");
    }
  };

  return (
    <div>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter 6-digit code"
        maxLength={6}
      />
      <button onClick={handleVerify} type="button">
        Verify
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
}

// Named export
export { Verify2FA };
```

**Why good:** trustDevice reduces friction for trusted devices, backup codes stored for recovery, TOTP secrets encrypted in database
