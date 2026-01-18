# Resend Setup - Deployment Examples

> Email preview server, Vercel configuration, and setup checklist.

[Back to SKILL.md](../SKILL.md) | [core.md](core.md) | [templates.md](templates.md) | [integrations.md](integrations.md)

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
| `RESEND_WEBHOOK_SECRET` | Production, Preview | `whsec_xxx...` (from Resend webhook dashboard) |

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

# Webhook secret for verifying Resend webhook signatures
# Get this from Resend Dashboard > Webhooks > Your webhook > Signing secret
RESEND_WEBHOOK_SECRET=whsec_your_secret_here
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

### Webhooks (Optional)
- [ ] Created webhook in Resend Dashboard > Webhooks
- [ ] Selected events to track (sent, delivered, bounced, etc.)
- [ ] Copied webhook signing secret to RESEND_WEBHOOK_SECRET env var
- [ ] Implemented webhook endpoint with signature verification
- [ ] Tested webhook delivery in Resend dashboard
```

---

## Related Examples

- For client setup and exports, see [core.md](core.md)
- For email templates and components, see [templates.md](templates.md)
- For Better Auth and API integration, see [integrations.md](integrations.md)
