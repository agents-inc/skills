# Webhooks Quick Reference

> Header conventions and implementation checklists. Referenced from [SKILL.md](SKILL.md).

---

## Webhook Header Conventions

The [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks) specification defines these headers:

| Header              | Purpose                                        | Example            |
| ------------------- | ---------------------------------------------- | ------------------ |
| `webhook-id`        | Unique event identifier for idempotency        | `evt_1234abcd`     |
| `webhook-timestamp` | Unix timestamp (seconds) for replay protection | `1714556800`       |
| `webhook-signature` | HMAC-SHA256 signature of `timestamp.body`      | `a1b2c3d4...`      |
| `content-type`      | Always `application/json`                      | `application/json` |

**Provider-specific variants:**

| Provider | Signature Header        | Timestamp           | Format                     |
| -------- | ----------------------- | ------------------- | -------------------------- |
| Stripe   | `stripe-signature`      | In header (`t=...`) | `t=timestamp,v1=signature` |
| GitHub   | `x-hub-signature-256`   | N/A                 | `sha256=signature`         |
| Shopify  | `x-shopify-hmac-sha256` | N/A                 | Base64-encoded HMAC        |
| Twilio   | `x-twilio-signature`    | N/A                 | Base64-encoded HMAC        |

---

## Security Checklist

- [ ] Signatures verified against raw body (not parsed JSON)
- [ ] Using `crypto.timingSafeEqual` (not `===`)
- [ ] Buffer length checked before `timingSafeEqual`
- [ ] Timestamp validated within tolerance window (5 min default)
- [ ] Webhook secret stored in environment variable (not hardcoded)
- [ ] Webhook endpoints not exposed via wildcard CORS

## Reliability Checklist

- [ ] Idempotency enforced via stored webhook ID
- [ ] Idempotency store has TTL (7-30 days)
- [ ] 200 returned immediately, processing is async
- [ ] Duplicate webhooks return 200 (not error)
- [ ] Unknown event types logged and skipped (not thrown)

## Sending Checklist

- [ ] Every payload signed with HMAC-SHA256
- [ ] `webhook-id`, `webhook-timestamp`, `webhook-signature` headers included
- [ ] Retry with exponential backoff + jitter
- [ ] Max retry cap (5-10 attempts)
- [ ] Delay cap (e.g., 1 hour max)
- [ ] 4xx permanent failures go to DLQ immediately
- [ ] 429 respects `Retry-After` header
- [ ] 410 disables the endpoint subscription
- [ ] Dead letter queue preserves full event context
