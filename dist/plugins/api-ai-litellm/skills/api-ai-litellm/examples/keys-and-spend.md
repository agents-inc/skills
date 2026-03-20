# LiteLLM -- Keys & Spend Tracking Examples

> Virtual key management, budgets, rate limits, team management, and spend tracking. See [core.md](core.md) for basic setup.

**Related examples:**

- [core.md](core.md) -- Config structure, TypeScript client, Docker setup
- [routing.md](routing.md) -- Fallbacks, load balancing, cooldowns, retries

**Prerequisites:** PostgreSQL database configured in `general_settings.database_url` and `LITELLM_SALT_KEY` set for credential encryption.

---

## Enable Virtual Keys

```yaml
# config.yaml -- minimum config for virtual keys
general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY # Must start with sk-
  database_url: os.environ/DATABASE_URL # PostgreSQL connection string
```

```bash
# Required environment variables
export LITELLM_MASTER_KEY="sk-your-master-key"
export LITELLM_SALT_KEY="sk-your-salt-key"       # Encrypts stored credentials
export DATABASE_URL="postgresql://user:pass@localhost:5432/litellm"
```

---

## Generate a Virtual Key

```bash
# Basic key with model restrictions
curl 'http://localhost:4000/key/generate' \
  -H 'Authorization: Bearer sk-your-master-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "models": ["claude-sonnet", "gpt-4o"],
    "key_alias": "backend-team-production"
  }'
# Response: { "key": "sk-tXL0wt5-lOOVK...", ... }
```

```bash
# Key with budget, rate limits, and expiry
curl 'http://localhost:4000/key/generate' \
  -H 'Authorization: Bearer sk-your-master-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "models": ["claude-sonnet", "gpt-4o", "gpt-4o-mini"],
    "max_budget": 100.0,
    "duration": "30d",
    "tpm_limit": 100000,
    "rpm_limit": 60,
    "metadata": {
      "team": "backend",
      "project": "document-search",
      "environment": "production"
    }
  }'
```

---

## Use Virtual Key in TypeScript Client

```typescript
// lib/llm-client.ts
import OpenAI from "openai";

// Use the generated virtual key -- NOT the master key in application code
const client = new OpenAI({
  baseURL: process.env.LITELLM_PROXY_URL ?? "http://localhost:4000",
  apiKey: process.env.LITELLM_API_KEY, // Virtual key: sk-tXL0wt5-lOOVK...
});

export { client };
```

**Key insight:** Application code uses virtual keys. Master key is only for admin operations (key generation, config updates). Never embed the master key in application code.

---

## Team Management

```bash
# Create a team
curl 'http://localhost:4000/team/new' \
  -H 'Authorization: Bearer sk-your-master-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "team_alias": "ml-team",
    "models": ["claude-sonnet", "gpt-4o"],
    "max_budget": 500.0,
    "tpm_limit": 500000,
    "rpm_limit": 300
  }'
# Response: { "team_id": "team-abc123", ... }
```

```bash
# Create a user in the team
curl 'http://localhost:4000/user/new' \
  -H 'Authorization: Bearer sk-your-master-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_email": "developer@company.com",
    "user_role": "internal_user",
    "team_id": "team-abc123",
    "max_budget": 50.0
  }'
```

```bash
# Generate a key for the team member
curl 'http://localhost:4000/key/generate' \
  -H 'Authorization: Bearer sk-your-master-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "team_id": "team-abc123",
    "user_id": "user-xyz",
    "models": ["claude-sonnet", "gpt-4o"],
    "max_budget": 50.0,
    "duration": "90d"
  }'
```

**Budget hierarchy:** Organization > Team > User > Key. Child entities inherit constraints from parents. A key's effective budget is the minimum of its own budget and its team/user budget.

---

## Query Key Spend

```bash
# Get key info including current spend
curl 'http://localhost:4000/key/info?key=sk-tXL0wt5-lOOVK...' \
  -H 'Authorization: Bearer sk-your-master-key'
# Response includes: { "info": { "spend": 12.45, "max_budget": 100.0, ... } }
```

```bash
# Get user spend summary
curl 'http://localhost:4000/user/info?user_id=user-xyz' \
  -H 'Authorization: Bearer sk-your-master-key'
```

---

## Query Spend Reports

```bash
# Daily activity breakdown (by model, provider, key)
curl 'http://localhost:4000/user/daily/activity?start_date=2025-03-01&end_date=2025-03-31' \
  -H 'Authorization: Bearer sk-your-master-key'
```

```bash
# Global spend report grouped by team
curl 'http://localhost:4000/global/spend/report?start_date=2025-03-01&end_date=2025-03-31&group_by=team' \
  -H 'Authorization: Bearer sk-your-master-key'
```

```bash
# Individual transaction logs
curl 'http://localhost:4000/spend/logs?summarize=false' \
  -H 'Authorization: Bearer sk-your-master-key'
```

---

## Tag-Based Spend Tracking in TypeScript

```typescript
import { client } from "./lib/llm-client.js";

// Attach tags for cost attribution by project, feature, or team
const completion = await client.chat.completions.create({
  model: "claude-sonnet",
  messages: [{ role: "user", content: "Analyze this document." }],
  metadata: {
    tags: [
      "project:document-search",
      "feature:summarization",
      "env:production",
    ],
    trace_user_id: "user-abc-123",
    generation_name: "doc-summary-v2",
  },
} as any); // metadata is a LiteLLM extension

// Cost is also returned in response headers
// x-litellm-response-cost: 0.0023
```

**Key insight:** Tags can be set on keys (apply to all requests), teams, or per-request. Per-request tags override key-level tags. Use consistent tag naming (e.g., `project:name`, `team:name`) for clean reporting.

---

## Key Rotation

```bash
# Rotate a key with a 24-hour grace period
# Both old and new keys work during the grace period
curl 'http://localhost:4000/key/regenerate' \
  -H 'Authorization: Bearer sk-your-master-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "key": "sk-tXL0wt5-lOOVK...",
    "duration": "90d",
    "metadata": {"rotated": "2025-03-20"}
  }'
```

---

## Rate Limit Tiers

Define reusable rate limit tiers and assign them to keys.

```bash
# Create a tier
curl 'http://localhost:4000/budget/new' \
  -H 'Authorization: Bearer sk-your-master-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "budget_id": "tier-standard",
    "max_budget": 100.0,
    "tpm_limit": 100000,
    "rpm_limit": 60,
    "budget_duration": "30d"
  }'
```

```bash
# Assign tier to a key
curl 'http://localhost:4000/key/generate' \
  -H 'Authorization: Bearer sk-your-master-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "models": ["claude-sonnet", "gpt-4o"],
    "budget_id": "tier-standard"
  }'
```

---

_For config structure and client setup, see [core.md](core.md). For routing and reliability, see [routing.md](routing.md)._
