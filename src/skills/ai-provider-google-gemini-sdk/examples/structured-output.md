# Google Gemini SDK -- Structured Output Examples

> JSON mode with `responseMimeType`, Zod schemas with `zodToJsonSchema`, enum extraction, raw JSON Schema. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [multimodal.md](multimodal.md) -- Multimodal input
- [streaming.md](streaming.md) -- Streaming responses
- [tools.md](tools.md) -- Function calling
- [chat.md](chat.md) -- Multi-turn chat
- [advanced.md](advanced.md) -- Embeddings, caching, safety

---

## Structured Output with Zod Schema

```typescript
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ArticleSummary = z.object({
  title: z.string().describe("The article's title"),
  summary: z.string().describe("A concise summary"),
  keyPoints: z.array(z.string()).describe("Key takeaways"),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  wordCount: z.number().describe("Approximate word count"),
});

type ArticleSummary = z.infer<typeof ArticleSummary>;

const articleText = `
TypeScript 5.8 brings exciting new features including improved type inference,
better error messages, and performance optimizations. The release focuses on
developer experience improvements.
`;

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: `Extract a structured summary from this article:\n\n${articleText}`,
  config: {
    responseMimeType: "application/json",
    responseJsonSchema: zodToJsonSchema(ArticleSummary),
  },
});

const summary = ArticleSummary.parse(JSON.parse(response.text ?? "{}"));
console.log(`Title: ${summary.title}`);
console.log(`Sentiment: ${summary.sentiment}`);
console.log("Key Points:");
summary.keyPoints.forEach((point) => console.log(`  - ${point}`));
```

**Key steps:**

1. Define a Zod schema
2. Convert with `zodToJsonSchema()`
3. Set `responseMimeType: "application/json"`
4. Pass converted schema to `responseJsonSchema`
5. Parse response with `schema.parse(JSON.parse(response.text))`

---

## Enum Extraction

```typescript
const FeedbackSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative"]),
  category: z.enum(["bug", "feature-request", "praise", "question"]),
  summary: z.string(),
});

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "The new dark mode is amazing! Could you also add a blue theme?",
  config: {
    responseMimeType: "application/json",
    responseJsonSchema: zodToJsonSchema(FeedbackSchema),
  },
});

const feedback = FeedbackSchema.parse(JSON.parse(response.text ?? "{}"));
console.log(`Sentiment: ${feedback.sentiment}`);
console.log(`Category: ${feedback.category}`);
```

---

## Array of Objects

```typescript
const TodoSchema = z.object({
  todos: z.array(
    z.object({
      task: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      estimatedMinutes: z.number(),
    }),
  ),
});

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents:
    "I need to fix the login bug, write API docs, and update dependencies.",
  config: {
    responseMimeType: "application/json",
    responseJsonSchema: zodToJsonSchema(TodoSchema),
  },
});

const result = TodoSchema.parse(JSON.parse(response.text ?? "{}"));
for (const todo of result.todos) {
  console.log(`[${todo.priority}] ${todo.task} (~${todo.estimatedMinutes}min)`);
}
```

---

## Raw JSON Schema (Without Zod)

If you prefer raw JSON Schema:

```typescript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "List 3 popular cookie recipes.",
  config: {
    responseMimeType: "application/json",
    responseJsonSchema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          recipeName: { type: "string" },
          prepTimeMinutes: { type: "number" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        },
        required: ["recipeName", "prepTimeMinutes", "difficulty"],
      },
    },
  },
});

const recipes = JSON.parse(response.text ?? "[]");
```

**Note:** Prefer Zod + `zodToJsonSchema` over raw JSON Schema for type safety and validation.

---

## Structured Output with Multimodal Input

```typescript
import * as fs from "node:fs";

const ReceiptSchema = z.object({
  merchantName: z.string(),
  date: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      price: z.number(),
      quantity: z.number(),
    }),
  ),
  total: z.number(),
  currency: z.string(),
});

const receiptImage = fs.readFileSync("receipt.jpg", { encoding: "base64" });

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    { text: "Extract the receipt data from this image." },
    { inlineData: { mimeType: "image/jpeg", data: receiptImage } },
  ],
  config: {
    responseMimeType: "application/json",
    responseJsonSchema: zodToJsonSchema(ReceiptSchema),
  },
});

const receipt = ReceiptSchema.parse(JSON.parse(response.text ?? "{}"));
console.log(`${receipt.merchantName} -- ${receipt.total} ${receipt.currency}`);
```

---

## Anti-Pattern: Manual JSON Parsing Without Schema

```typescript
// BAD: No schema constraint, fragile parsing
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Return a JSON object with name and age fields.",
});

const data = JSON.parse(response.text ?? "{}"); // No type safety, may fail
```

**Why bad:** Without `responseMimeType` and `responseJsonSchema`, the model may return text with markdown formatting (e.g., wrapped in ` ```json ` blocks), breaking `JSON.parse`. The schema constraint guarantees valid JSON output.

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
