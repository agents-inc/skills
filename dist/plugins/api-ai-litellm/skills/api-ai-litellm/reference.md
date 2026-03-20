# LiteLLM Proxy Quick Reference

> Config.yaml schema, provider prefixes, routing strategies, API endpoints, and environment variables. See [SKILL.md](SKILL.md) for core patterns and [examples/](examples/) for code examples.

---

## config.yaml Top-Level Schema

```yaml
model_list: # Required -- model definitions
  - model_name: "" # Client-facing alias
    litellm_params: # Provider routing
      model: "" # provider/model-id (REQUIRED)
      api_key: "" # os.environ/VAR_NAME
      api_base: "" # Provider endpoint URL
      api_version: "" # Provider API version (Azure)
      rpm: 0 # Requests per minute (per deployment)
      tpm: 0 # Tokens per minute (per deployment)
      order: 0 # Priority for routing (1 = highest)

litellm_settings: # Module-level config
  num_retries: 0 # Retries per model before fallback
  request_timeout: 600 # Timeout in seconds
  drop_params: false # Drop unsupported params silently
  fallbacks: [] # [{"model_a": ["model_b"]}]
  context_window_fallbacks: [] # For ContextWindowExceededError
  content_policy_fallbacks: [] # For ContentPolicyViolationError
  default_fallbacks: [] # Catch-all fallback list
  success_callback: [] # ["langfuse", "custom_callback"]
  cache: false # Enable response caching

router_settings: # Load balancing config
  routing_strategy: "" # See strategies table below
  num_retries: 2 # Router-level retries
  timeout: 30 # Router timeout (seconds)
  enable_pre_call_checks: false # Required for order-based routing
  redis_host: "" # For distributed rate limiting
  redis_password: ""
  redis_port: 6379

general_settings: # Server config
  master_key: "" # Must start with sk-
  database_url: "" # PostgreSQL (for virtual keys)
  alerting: [] # ["slack"]
```

---

## Provider Prefix Format

| Provider  | Prefix         | Example                                    |
| --------- | -------------- | ------------------------------------------ |
| OpenAI    | `openai/`      | `openai/gpt-4o`                            |
| Anthropic | `anthropic/`   | `anthropic/claude-sonnet-4-20250514`       |
| Azure     | `azure/`       | `azure/my-deployment-name`                 |
| Bedrock   | `bedrock/`     | `bedrock/anthropic.claude-3-sonnet`        |
| Google    | `gemini/`      | `gemini/gemini-2.5-pro`                    |
| Vertex AI | `vertex_ai/`   | `vertex_ai/gemini-2.5-pro`                 |
| Groq      | `groq/`        | `groq/llama-3.3-70b-versatile`             |
| Together  | `together_ai/` | `together_ai/meta-llama/Llama-3-70b-chat`  |
| Mistral   | `mistral/`     | `mistral/mistral-large-latest`             |
| Cohere    | `cohere_chat/` | `cohere_chat/command-r-plus`               |
| Ollama    | `ollama/`      | `ollama/llama3`                            |
| vLLM      | `openai/`      | `openai/model-name` (with custom api_base) |

**Full list:** [docs.litellm.ai/docs/providers](https://docs.litellm.ai/docs/providers)

---

## Routing Strategies

| Strategy                | Behavior                                         | When to Use            |
| ----------------------- | ------------------------------------------------ | ---------------------- |
| `simple-shuffle`        | Random distribution (default)                    | General purpose        |
| `least-busy`            | Routes to deployment with fewest active requests | High concurrency       |
| `usage-based-routing`   | Routes to lowest RPM/TPM usage                   | Respect rate limits    |
| `latency-based-routing` | Routes to fastest responding deployment          | Minimize response time |
| `cost-based-routing`    | Routes to cheapest deployment                    | Minimize cost          |

---

## Key Management API Endpoints

| Endpoint          | Method | Purpose                  |
| ----------------- | ------ | ------------------------ |
| `/key/generate`   | POST   | Create virtual key       |
| `/key/info`       | GET    | Get key details + spend  |
| `/key/update`     | POST   | Update key params        |
| `/key/delete`     | POST   | Delete key               |
| `/key/regenerate` | POST   | Rotate key               |
| `/user/new`       | POST   | Create user              |
| `/user/info`      | GET    | Get user details + spend |
| `/team/new`       | POST   | Create team              |
| `/team/info`      | GET    | Get team details         |
| `/v1/models`      | GET    | List available models    |
| `/health`         | GET    | Proxy health check       |
| `/config/update`  | POST   | Update config at runtime |

**All management endpoints require `Authorization: Bearer <master-key>`.**

---

## Environment Variables

| Variable                | Purpose                                 |
| ----------------------- | --------------------------------------- |
| `LITELLM_MASTER_KEY`    | Proxy admin key (alternative to config) |
| `LITELLM_SALT_KEY`      | Encryption key for stored credentials   |
| `DATABASE_URL`          | PostgreSQL connection string            |
| `OPENAI_API_KEY`        | OpenAI provider key                     |
| `ANTHROPIC_API_KEY`     | Anthropic provider key                  |
| `AZURE_API_KEY`         | Azure OpenAI provider key               |
| `AZURE_API_BASE`        | Azure OpenAI endpoint URL               |
| `AWS_ACCESS_KEY_ID`     | AWS Bedrock access key                  |
| `AWS_SECRET_ACCESS_KEY` | AWS Bedrock secret key                  |
| `AWS_REGION_NAME`       | AWS Bedrock region                      |

---

## Key Generation Parameters

```json
{
  "models": ["claude-sonnet", "gpt-4o"],
  "max_budget": 50.0,
  "duration": "30d",
  "metadata": { "team": "backend" },
  "user_id": "user-123",
  "team_id": "team-abc",
  "tpm_limit": 100000,
  "rpm_limit": 60,
  "key_alias": "backend-team-key"
}
```

**Duration format:** `"30s"`, `"5m"`, `"24h"`, `"7d"`, `"90d"`

---

## Spend Tracking Endpoints

| Endpoint               | Method | Purpose                        |
| ---------------------- | ------ | ------------------------------ |
| `/spend/logs`          | GET    | Individual transaction logs    |
| `/user/daily/activity` | GET    | Daily breakdown by model/key   |
| `/global/spend/report` | GET    | Spend report grouped by entity |

**Response header:** `x-litellm-response-cost` contains the cost of each request in USD.

---

## Docker Quick Start

```bash
# 1. Get docker-compose.yml
curl -O https://raw.githubusercontent.com/BerriAI/litellm/main/docker-compose.yml

# 2. Create .env
echo 'LITELLM_MASTER_KEY=sk-change-me-in-production' > .env
echo 'LITELLM_SALT_KEY=sk-salt-change-me' >> .env

# 3. Create config.yaml (see examples/core.md)

# 4. Start
docker compose up -d

# 5. Verify
curl http://localhost:4000/health
```
