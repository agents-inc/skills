# Mistral SDK -- Structured Output Examples

> Type-safe structured responses with Zod via `chat.parse()`, and JSON mode via `responseFormat`. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [chat.md](chat.md) -- Chat completions and streaming
- [function-calling.md](function-calling.md) -- Tool/function calling
- [embeddings-vision.md](embeddings-vision.md) -- Embeddings and vision
- [codestral.md](codestral.md) -- Codestral FIM code completion

---

## Structured Output with `chat.parse()` and Zod

```typescript
// structured-output.ts
import { Mistral } from "@mistralai/mistralai";
import { z } from "zod";

const client = new Mistral({ apiKey: process.env["MISTRAL_API_KEY"] ?? "" });

const ArticleSummary = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  sentiment: z.enum(["positive", "negative", "neutral"]),
});

type ArticleSummary = z.infer<typeof ArticleSummary>;

const MAX_TOKENS = 512;

async function extractSummary(
  articleText: string,
): Promise<ArticleSummary | null> {
  const result = await client.chat.parse({
    model: "mistral-large-latest",
    messages: [
      {
        role: "system",
        content: "Extract a structured summary from the article.",
      },
      { role: "user", content: articleText },
    ],
    responseFormat: ArticleSummary, // Pass Zod schema directly
    maxTokens: MAX_TOKENS,
    temperature: 0,
  });

  // Access the typed parsed result
  const parsed = result.choices?.[0]?.message?.parsed;
  return parsed ?? null;
}

const article = `
TypeScript 5.8 brings improved type inference, better error messages,
and performance optimizations focused on developer experience.
`;

const summary = await extractSummary(article);
if (summary) {
  console.log(`Title: ${summary.title}`);
  console.log(`Sentiment: ${summary.sentiment}`);
  console.log("Key Points:");
  summary.keyPoints.forEach((point) => console.log(`  - ${point}`));
}
```

**Why good:** Zod schema passed directly to `responseFormat`, `message.parsed` is fully typed, named constants

---

## JSON Mode (Simple)

When you need JSON output without strict schema validation, use `responseFormat: { type: "json_object" }`.

```typescript
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({ apiKey: process.env["MISTRAL_API_KEY"] ?? "" });

const result = await client.chat.complete({
  model: "mistral-large-latest",
  messages: [
    {
      role: "user",
      content:
        "List the top 3 programming languages with their use cases. Return as JSON.",
    },
  ],
  responseFormat: { type: "json_object" },
});

const content = result?.choices?.[0]?.message?.content;
if (typeof content === "string") {
  const data = JSON.parse(content);
  console.log(data);
}
```

**Why good:** Uses `responseFormat` (camelCase), explicitly asks for JSON in the prompt (recommended even with JSON mode)

### BAD: snake_case response_format

```typescript
// BAD: Using REST API naming in the SDK
const result = await client.chat.complete({
  model: "mistral-large-latest",
  messages: [{ role: "user", content: "Return JSON" }],
  response_format: { type: "json_object" }, // WRONG: silently ignored
});
```

**Why bad:** The SDK uses camelCase -- `response_format` is silently ignored, model returns plain text

---

## Complex Schema with Nested Objects

```typescript
import { Mistral } from "@mistralai/mistralai";
import { z } from "zod";

const client = new Mistral({ apiKey: process.env["MISTRAL_API_KEY"] ?? "" });

const Address = z.object({
  street: z.string(),
  city: z.string(),
  country: z.string(),
  postalCode: z.string(),
});

const Person = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email(),
  addresses: z.array(Address),
  occupation: z.string().optional(),
});

const MAX_TOKENS = 512;

const result = await client.chat.parse({
  model: "mistral-large-latest",
  messages: [
    { role: "system", content: "Extract person details from the text." },
    {
      role: "user",
      content:
        "John Smith, 34, works as a software engineer. " +
        "Email: john@example.com. Lives at 123 Main St, Paris, France 75001.",
    },
  ],
  responseFormat: Person,
  maxTokens: MAX_TOKENS,
  temperature: 0,
});

const person = result.choices?.[0]?.message?.parsed;
if (person) {
  console.log(`${person.name}, age ${person.age}`);
  console.log(`Email: ${person.email}`);
  person.addresses.forEach((addr) => {
    console.log(`Address: ${addr.street}, ${addr.city}, ${addr.country}`);
  });
}
```

---

## Accessing Raw vs Parsed Content

```typescript
const result = await client.chat.parse({
  model: "mistral-large-latest",
  messages: [
    { role: "system", content: "Extract book information." },
    { role: "user", content: "I read 'Dune' by Frank Herbert." },
  ],
  responseFormat: z.object({
    name: z.string(),
    authors: z.array(z.string()),
  }),
});

const message = result.choices?.[0]?.message;

// Raw JSON string (always available)
console.log("Raw:", message?.content);

// Parsed and typed object (available via chat.parse)
console.log("Parsed:", message?.parsed);
```

**Why good:** Shows both access paths -- `content` for raw JSON, `parsed` for typed object

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
