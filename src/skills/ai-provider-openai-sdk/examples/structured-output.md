# OpenAI SDK -- Structured Output Examples

> Type-safe structured responses with Zod: `zodResponseFormat` for Chat Completions, `zodTextFormat` for Responses API, refusal handling, complex schemas. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [chat.md](chat.md) -- Chat Completions API
- [streaming.md](streaming.md) -- Streaming responses
- [tools.md](tools.md) -- Tool/function calling
- [embeddings-vision-audio.md](embeddings-vision-audio.md) -- Embeddings, vision, audio

---

## Chat Completions Structured Output with `zodResponseFormat`

```typescript
// structured-output.ts
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI();

// Define the schema for extracted data
const ArticleSummary = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  wordCount: z.number(),
});

type ArticleSummary = z.infer<typeof ArticleSummary>;

async function extractArticleSummary(
  articleText: string,
): Promise<ArticleSummary | null> {
  const completion = await client.chat.completions.parse({
    model: "gpt-4o",
    messages: [
      {
        role: "developer",
        content: "Extract a structured summary from the provided article text.",
      },
      { role: "user", content: articleText },
    ],
    response_format: zodResponseFormat(ArticleSummary, "article_summary"),
  });

  const message = completion.choices[0].message;

  // Handle safety refusals
  if (message.refusal) {
    console.warn("Model refused:", message.refusal);
    return null;
  }

  return message.parsed;
}

const article = `
TypeScript 5.8 brings exciting new features including improved type inference,
better error messages, and performance optimizations. The release focuses on
developer experience improvements that make everyday coding more productive.
`;

const summary = await extractArticleSummary(article);
if (summary) {
  console.log(`Title: ${summary.title}`);
  console.log(`Sentiment: ${summary.sentiment}`);
  console.log("Key Points:");
  summary.keyPoints.forEach((point) => console.log(`  - ${point}`));
}
```

---

## Handling Refusals

```typescript
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI();

const SomeSchema = z.object({
  content: z.string(),
});

const completion = await client.chat.completions.parse({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Generate harmful content" }],
  response_format: zodResponseFormat(SomeSchema, "output"),
});

const message = completion.choices[0].message;

if (message.refusal) {
  console.log("Model refused:", message.refusal);
} else if (message.parsed) {
  console.log("Parsed output:", message.parsed);
}
```

---

## Responses API Structured Output with `zodTextFormat`

```typescript
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI();

const PersonSchema = z.object({
  name: z.string(),
  age: z.number(),
});

const response = await client.responses.parse({
  model: "gpt-4o",
  input: "Jane is 54 years old.",
  text: {
    format: zodTextFormat(PersonSchema, "person"),
  },
});

console.log(response.output_parsed);
// { name: 'Jane', age: 54 }
```

---

## Manual JSON Schema (Anti-Pattern)

Avoid this -- use `zodResponseFormat` instead:

```typescript
// BAD: Manually constructing JSON schema
const completion = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Extract data" }],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "event",
      strict: true,
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          date: { type: "string" },
        },
        required: ["name", "date"],
        additionalProperties: false,
      },
    },
  },
});
// Then manually JSON.parse the content -- error-prone
const data = JSON.parse(completion.choices[0].message.content ?? "{}");
```

**Why bad:** Manual JSON schema is verbose and error-prone, no type safety, manual parsing can fail. Use `zodResponseFormat` + `.parse()` instead.

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
