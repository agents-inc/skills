# LiteLLM -- Config & Client Setup Examples

> Proxy config.yaml structure, TypeScript client via OpenAI SDK, model routing, streaming, and Docker deployment. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [routing.md](routing.md) -- Fallbacks, load balancing, cooldowns, retries
- [keys-and-spend.md](keys-and-spend.md) -- Virtual keys, budgets, rate limits, spend tracking

---

## Complete config.yaml (Multi-Provider)

```yaml
# config.yaml -- production setup with multiple providers
model_list:
  # Anthropic
  - model_name: claude-sonnet
    litellm_params:
      model: anthropic/claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY

  - model_name: claude-haiku
    litellm_params:
      model: anthropic/claude-haiku-3-5-20241022
      api_key: os.environ/ANTHROPIC_API_KEY

  # OpenAI
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

  # Azure (same model, different region for load balancing)
  - model_name: gpt-4o-azure
    litellm_params:
      model: azure/gpt-4o-deploy
      api_base: os.environ/AZURE_API_BASE
      api_key: os.environ/AZURE_API_KEY
      api_version: "2025-01-01-preview"

  # Embeddings
  - model_name: text-embedding
    litellm_params:
      model: openai/text-embedding-3-small
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  num_retries: 2
  request_timeout: 60
  drop_params: true # Silently drop params a provider doesn't support
  fallbacks: [{ "claude-sonnet": ["gpt-4o"] }]
  default_fallbacks: ["gpt-4o-mini"] # Catch-all if any model group fails

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL

router_settings:
  routing_strategy: simple-shuffle
  num_retries: 2
  timeout: 60
```

---

## TypeScript Client Setup

```typescript
// lib/llm-client.ts
import OpenAI from "openai";

const PROXY_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

// Point at LiteLLM proxy -- NOT at a provider directly
const client = new OpenAI({
  baseURL: process.env.LITELLM_PROXY_URL ?? "http://localhost:4000",
  apiKey: process.env.LITELLM_API_KEY, // Virtual key or master key
  timeout: PROXY_TIMEOUT_MS,
  maxRetries: MAX_RETRIES,
});

export { client };
```

---

## Basic Completion

```typescript
import { client } from "./lib/llm-client.js";

// model matches config.yaml model_name, NOT provider model ID
const completion = await client.chat.completions.create({
  model: "claude-sonnet",
  messages: [
    { role: "system", content: "You are a helpful coding assistant." },
    {
      role: "user",
      content:
        "Explain the difference between type and interface in TypeScript.",
    },
  ],
});

console.log(completion.choices[0].message.content);
```

---

## Streaming Through Proxy

Streaming works transparently -- no proxy-side configuration needed.

```typescript
import { client } from "./lib/llm-client.js";

// for-await streaming
const stream = await client.chat.completions.create({
  model: "claude-sonnet",
  messages: [{ role: "user", content: "Write a haiku about TypeScript." }],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) process.stdout.write(content);
}
```

```typescript
// Event-based streaming with .stream() helper
const stream = client.chat.completions.stream({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Explain async/await." }],
});

stream.on("content", (delta) => process.stdout.write(delta));
const finalContent = await stream.finalContent();
```

---

## Passing LiteLLM Metadata

LiteLLM extends the OpenAI API with a `metadata` field for spend tracking and tagging. This is not part of the OpenAI SDK types.

```typescript
import { client } from "./lib/llm-client.js";

// Option 1: metadata field (LiteLLM extension, needs type assertion)
const completion = await client.chat.completions.create({
  model: "claude-sonnet",
  messages: [{ role: "user", content: "Hello" }],
  metadata: {
    tags: ["project:search", "env:production"],
    trace_user_id: "user-abc-123",
  },
} as any);

// Option 2: extra_body (type-safe, works with any SDK)
const completion2 = await client.chat.completions.create(
  {
    model: "claude-sonnet",
    messages: [{ role: "user", content: "Hello" }],
  },
  {
    body: {
      metadata: {
        tags: ["project:search"],
      },
    },
  },
);
```

---

## Embeddings Through Proxy

```typescript
import { client } from "./lib/llm-client.js";

const response = await client.embeddings.create({
  model: "text-embedding", // model_name from config.yaml
  input: ["TypeScript generics", "JavaScript closures"],
});

const embeddings = response.data.map((item) => item.embedding);
console.log(
  `Got ${embeddings.length} embeddings of dimension ${embeddings[0].length}`,
);
```

---

## Structured Output via Proxy

Structured outputs with `zodResponseFormat` work transparently through the proxy.

```typescript
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { client } from "./lib/llm-client.js";

const ExtractedEntity = z.object({
  name: z.string(),
  type: z.enum(["person", "organization", "location"]),
  confidence: z.number(),
});

const completion = await client.chat.completions.parse({
  model: "gpt-4o", // Must be a model that supports structured output
  messages: [
    { role: "system", content: "Extract entities from text." },
    { role: "user", content: "Elon Musk visited the Tesla factory in Austin." },
  ],
  response_format: zodResponseFormat(ExtractedEntity, "entity"),
});

const entity = completion.choices[0].message.parsed;
// entity: { name: "Elon Musk", type: "person", confidence: 0.95 }
```

---

## Docker Compose Production Setup

```yaml
# docker-compose.yml
services:
  litellm:
    image: ghcr.io/berriai/litellm:main-latest
    ports:
      - "4000:4000"
    volumes:
      - ./config.yaml:/app/config.yaml
    environment:
      - LITELLM_MASTER_KEY=${LITELLM_MASTER_KEY}
      - LITELLM_SALT_KEY=${LITELLM_SALT_KEY}
      - DATABASE_URL=postgresql://llmproxy:${DB_PASSWORD}@db:5432/litellm
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - db
    command: --config /app/config.yaml --port 4000

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: llmproxy
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: litellm
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

```bash
# .env
LITELLM_MASTER_KEY=sk-your-production-master-key
LITELLM_SALT_KEY=sk-your-salt-key
DB_PASSWORD=strong-db-password
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

```bash
# Start and verify
docker compose up -d
curl http://localhost:4000/health
curl -X POST http://localhost:4000/chat/completions \
  -H "Authorization: Bearer sk-your-production-master-key" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet", "messages": [{"role": "user", "content": "Hello!"}]}'
```

---

## Model Alias Mapping

Use `model_group_alias` to create shorthand names that map to existing model groups.

```yaml
router_settings:
  model_group_alias:
    gpt-4: gpt-4o # Requests for "gpt-4" route to the "gpt-4o" group
    claude: claude-sonnet # Requests for "claude" route to "claude-sonnet" group
```

---

_For routing and reliability patterns, see [routing.md](routing.md). For key management and spend tracking, see [keys-and-spend.md](keys-and-spend.md). For decision frameworks, see [reference.md](../reference.md)._
