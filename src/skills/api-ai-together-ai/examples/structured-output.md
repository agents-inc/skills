# Together AI SDK -- Structured Output Examples

> Structured output patterns: JSON schema mode with Zod, regex mode, vision with JSON, and complex schemas. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [chat.md](chat.md) -- Chat Completions API
- [streaming.md](streaming.md) -- Streaming responses
- [tools.md](tools.md) -- Tool/function calling
- [images.md](images.md) -- Image generation, embeddings

---

## JSON Schema Mode with Zod

```typescript
// structured-output.ts
import Together from "together-ai";
import { z } from "zod";

const client = new Together();

const VoiceNoteSchema = z.object({
  title: z.string().describe("A title for the voice note"),
  summary: z.string().describe("A one sentence summary"),
  actionItems: z
    .array(z.string())
    .describe("A list of action items from the note"),
});

type VoiceNote = z.infer<typeof VoiceNoteSchema>;

const jsonSchema = z.toJSONSchema(VoiceNoteSchema);

async function extractVoiceNote(transcript: string): Promise<VoiceNote> {
  const completion = await client.chat.completions.create({
    model: "Qwen/Qwen3.5-9B",
    messages: [
      {
        role: "system",
        content: `Extract structured data from the transcript. Only answer in JSON. Follow this schema: ${JSON.stringify(jsonSchema)}`,
      },
      { role: "user", content: transcript },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "voice_note",
        schema: jsonSchema,
      },
    },
  });

  return JSON.parse(completion.choices[0].message.content ?? "{}");
}

const note = await extractVoiceNote(
  "Need to buy groceries today and schedule a meeting with the team for Friday.",
);
console.log(note.title);
console.log(note.actionItems);
```

---

## Complex Nested Schema

```typescript
import Together from "together-ai";
import { z } from "zod";

const client = new Together();

const ArticleSummary = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  topics: z.array(
    z.object({
      name: z.string(),
      relevance: z.number().describe("Relevance score 0-1"),
    }),
  ),
});

const jsonSchema = z.toJSONSchema(ArticleSummary);

const completion = await client.chat.completions.create({
  model: "Qwen/Qwen3.5-9B",
  messages: [
    {
      role: "system",
      content: `Extract article summary. Only answer in JSON. Schema: ${JSON.stringify(jsonSchema)}`,
    },
    {
      role: "user",
      content:
        "TypeScript 5.8 brings improved type inference and better error messages, making everyday coding more productive.",
    },
  ],
  response_format: {
    type: "json_schema",
    json_schema: { name: "article_summary", schema: jsonSchema },
  },
});

const article = JSON.parse(completion.choices[0].message.content ?? "{}");
console.log(`Title: ${article.title}`);
console.log(`Sentiment: ${article.sentiment}`);
```

---

## Regex Mode (Constrained Output)

Constrain output to a regex pattern for classification tasks.

```typescript
import Together from "together-ai";

const client = new Together();

const MAX_TOKENS = 10;

const completion = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  temperature: 0.2,
  max_tokens: MAX_TOKENS,
  messages: [
    {
      role: "system",
      content:
        "Classify the sentiment of the text as positive, neutral, or negative.",
    },
    { role: "user", content: "Wow. I loved the movie!" },
  ],
  response_format: {
    type: "regex",
    // @ts-ignore -- regex type not in SDK types yet
    pattern: "(positive|neutral|negative)",
  },
});

console.log(completion.choices[0].message.content);
// Output: "positive"
```

---

## Vision Model with JSON Output

Extract structured data from images.

```typescript
import Together from "together-ai";
import { z } from "zod";

const client = new Together();

const ImageDescription = z.object({
  description: z.string().describe("What the image shows"),
  objectCount: z.number().describe("Number of main objects"),
  dominantColors: z.array(z.string()).describe("Main colors in the image"),
});

const jsonSchema = z.toJSONSchema(ImageDescription);

const completion = await client.chat.completions.create({
  model: "Qwen/Qwen3-VL-8B-Instruct",
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Describe this image. Only answer in JSON. Schema: ${JSON.stringify(jsonSchema)}`,
        },
        {
          type: "image_url",
          image_url: { url: "https://example.com/photo.jpg" },
        },
      ],
    },
  ],
  response_format: {
    type: "json_schema",
    json_schema: { name: "image_description", schema: jsonSchema },
  },
});

const description = JSON.parse(completion.choices[0].message.content ?? "{}");
console.log(description);
```

---

## Zod v3 vs Zod v4

```typescript
// Zod v4 (recommended): Use built-in z.toJSONSchema()
import { z } from "zod";
const schema = z.object({ name: z.string() });
const jsonSchema = z.toJSONSchema(schema); // Built-in

// Zod v3: Use zodToJsonSchema from separate package
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
const schema = z.object({ name: z.string() });
const jsonSchema = zodToJsonSchema(schema); // External package
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
