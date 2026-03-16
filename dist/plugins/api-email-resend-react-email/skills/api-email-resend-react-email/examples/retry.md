# Email - Retry Logic Examples

> Retry patterns for handling transient email failures. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for basic send pattern.

> **Note:** The complete retry implementation is in [core.md](core.md) Pattern 3. This file provides the retry strategy decision tree for quick reference.

---

## Retry Strategy Decision Tree

```
Is the error retryable?
+-- Rate limit --> Retry with exponential backoff
+-- Server error (5xx) --> Retry with backoff
+-- Invalid email --> Don't retry, log error
+-- Authentication error --> Don't retry, check API key
+-- Quota exceeded --> Don't retry, upgrade plan
```

---

## Retry Constants

```typescript
export const MAX_RETRY_ATTEMPTS = 3;
export const INITIAL_RETRY_DELAY_MS = 1000;
export const RETRY_BACKOFF_MULTIPLIER = 2;

// Errors that are safe to retry
const RETRYABLE_ERRORS = [
  "rate_limit_exceeded",
  "internal_server_error",
  "service_unavailable",
];
```

The full retry implementation with exponential backoff is in [core.md](core.md) Pattern 3.
