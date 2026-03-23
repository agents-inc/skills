# LiteLLM -- Routing & Reliability Examples

> Fallback chains, load balancing strategies, cooldowns, retries, and priority routing. See [core.md](core.md) for basic setup.

**Related examples:**

- [core.md](core.md) -- Config structure, TypeScript client, Docker setup
- [keys-and-spend.md](keys-and-spend.md) -- Virtual keys, budgets, spend tracking

---

## Complete Fallback Configuration

```yaml
# config.yaml -- all fallback types
model_list:
  - model_name: claude-sonnet
    litellm_params:
      model: anthropic/claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

  - model_name: claude-haiku
    litellm_params:
      model: anthropic/claude-haiku-3-5-20241022
      api_key: os.environ/ANTHROPIC_API_KEY

litellm_settings:
  num_retries: 2 # Retries per model BEFORE falling back

  # General fallbacks -- triggered by 429, 500, connection errors
  # Fallbacks are tried in order: claude-sonnet fails -> try gpt-4o -> try gpt-4o-mini
  fallbacks:
    - claude-sonnet: ["gpt-4o", "gpt-4o-mini"]
    - gpt-4o: ["claude-sonnet"]

  # Context window exceeded -- model's max token limit hit
  # Typically fall back to a model with a larger context window
  context_window_fallbacks:
    - gpt-4o-mini: ["claude-sonnet"] # 128K -> 200K

  # Content policy violations -- provider rejected content
  content_policy_fallbacks:
    - claude-sonnet: ["gpt-4o"]

  # Catch-all -- any model group that fails and has no specific fallback
  # Does NOT apply to ContentPolicyViolationError or ContextWindowExceededError
  default_fallbacks: ["gpt-4o-mini"]
```

**Key insight:** Fallbacks reference `model_name` (client-facing alias), NOT `litellm_params.model` (provider route). This is the most common misconfiguration.

---

## Load Balancing: Multiple Deployments

Same `model_name` across entries creates a load-balanced group.

```yaml
model_list:
  # Three Azure deployments of the same model, load balanced
  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o-eastus
      api_base: https://eastus.openai.azure.com/
      api_key: os.environ/AZURE_EASTUS_KEY
      rpm: 100
      tpm: 200000

  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o-westus
      api_base: https://westus.openai.azure.com/
      api_key: os.environ/AZURE_WESTUS_KEY
      rpm: 100
      tpm: 200000

  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o-westeurope
      api_base: https://westeurope.openai.azure.com/
      api_key: os.environ/AZURE_WESTEUROPE_KEY
      rpm: 60
      tpm: 120000

router_settings:
  routing_strategy: usage-based-routing # Routes to deployment with lowest RPM/TPM usage
  num_retries: 2
  timeout: 30
```

**Key insight:** `rpm`/`tpm` values per deployment are required for `usage-based-routing` to make informed decisions. Without them, the router falls back to random selection.

---

## All Five Routing Strategies

```yaml
# Strategy 1: simple-shuffle (default)
# Random distribution -- good for general purpose
router_settings:
  routing_strategy: simple-shuffle
```

```yaml
# Strategy 2: least-busy
# Routes to deployment with fewest active in-flight requests
# Best for high-concurrency scenarios
router_settings:
  routing_strategy: least-busy
```

```yaml
# Strategy 3: usage-based-routing
# Routes to deployment with lowest RPM/TPM usage
# Requires rpm/tpm set per deployment
router_settings:
  routing_strategy: usage-based-routing
```

```yaml
# Strategy 4: latency-based-routing
# Routes to fastest responding deployment (based on recent response times)
router_settings:
  routing_strategy: latency-based-routing
```

```yaml
# Strategy 5: cost-based-routing
# Routes to cheapest deployment
router_settings:
  routing_strategy: cost-based-routing
```

---

## Priority-Based Routing

Use `order` to define deployment priority. Requires `enable_pre_call_checks: true`.

```yaml
model_list:
  # Primary deployment (order: 1 = highest priority, always tried first)
  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o-eastus
      api_base: https://eastus.openai.azure.com/
      api_key: os.environ/AZURE_EASTUS_KEY
      order: 1

  # Secondary deployment (used only when primary is rate-limited or down)
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
      order: 2

router_settings:
  enable_pre_call_checks: true # REQUIRED for order-based routing
```

**Key insight:** `order: 1` is always tried first. If rate-limited or unavailable, falls back to `order: 2`. Within the same order level, the configured routing strategy applies.

---

## Cooldowns and Allowed Failures

When a deployment fails repeatedly, LiteLLM puts it in cooldown (skipped for future requests temporarily).

```yaml
router_settings:
  allowed_fails: 3 # Number of failures before cooldown (default: 0)
  cooldown_time: 60 # Seconds to skip a failing deployment (default: 60)
  num_retries: 2 # Retries per deployment before marking as failed
  retry_after: 0 # Seconds to wait between retries (default: 0)
```

**Key insight:** `allowed_fails: 0` (default) means a single failure triggers cooldown. Set to 2-3 for deployments with occasional transient errors.

---

## Distributed Rate Limiting with Redis

For multi-instance proxy deployments, share rate limit state via Redis.

```yaml
router_settings:
  routing_strategy: usage-based-routing
  redis_host: os.environ/REDIS_HOST
  redis_password: os.environ/REDIS_PASSWORD
  redis_port: 6379
```

**When to use:** Running multiple LiteLLM proxy instances behind a load balancer. Without Redis, each instance tracks rate limits independently, leading to over-provisioning.

---

## Combining Load Balancing with Fallbacks

```yaml
model_list:
  # Load balanced group: "gpt-4o" (3 deployments)
  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o-eastus
      api_base: https://eastus.openai.azure.com/
      api_key: os.environ/AZURE_EASTUS_KEY
      rpm: 100

  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o-westus
      api_base: https://westus.openai.azure.com/
      api_key: os.environ/AZURE_WESTUS_KEY
      rpm: 100

  # Fallback model: "claude-sonnet"
  - model_name: claude-sonnet
    litellm_params:
      model: anthropic/claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY

litellm_settings:
  num_retries: 2
  # If ALL gpt-4o deployments fail (after retries + cooldowns), fall back to claude-sonnet
  fallbacks:
    - gpt-4o: ["claude-sonnet"]

router_settings:
  routing_strategy: usage-based-routing
  num_retries: 2
  timeout: 30
```

**Key insight:** The router first tries all deployments in the `gpt-4o` group (with retries and routing strategy). Only after the entire group is exhausted does it trigger the fallback to `claude-sonnet`.

---

## Enforcing Strict Rate Limits

By default, `rpm`/`tpm` values are advisory for routing decisions. To enforce as hard limits (reject with 429):

```yaml
router_settings:
  routing_strategy: usage-based-routing
  optional_pre_call_checks:
    - enforce_model_rate_limits # Reject requests exceeding rpm/tpm with 429
```

---

_For config structure and client setup, see [core.md](core.md). For key management and spend tracking, see [keys-and-spend.md](keys-and-spend.md)._
