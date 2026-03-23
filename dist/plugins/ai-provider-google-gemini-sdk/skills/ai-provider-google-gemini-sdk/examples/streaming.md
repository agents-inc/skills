# Google Gemini SDK -- Streaming Examples

> Streaming text generation, streaming chat, and abort patterns. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [multimodal.md](multimodal.md) -- Multimodal input
- [tools.md](tools.md) -- Function calling
- [structured-output.md](structured-output.md) -- Structured JSON output
- [chat.md](chat.md) -- Multi-turn chat
- [advanced.md](advanced.md) -- Embeddings, caching, safety

---

## Basic Streaming

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateContentStream({
  model: "gemini-2.5-flash",
  contents: "Write a short story about a time-traveling developer.",
});

for await (const chunk of response) {
  process.stdout.write(chunk.text ?? "");
}
```

---

## Streaming with System Instructions

```typescript
const response = await ai.models.generateContentStream({
  model: "gemini-2.5-flash",
  contents: "Explain the event loop in Node.js.",
  config: {
    systemInstruction:
      "You are a senior backend engineer. Use clear analogies.",
    temperature: 0.3,
  },
});

let fullText = "";
for await (const chunk of response) {
  const text = chunk.text ?? "";
  process.stdout.write(text);
  fullText += text;
}

console.log("\n\nFull response length:", fullText.length);
```

---

## Streaming Structured Output

Structured output works with streaming -- the JSON accumulates across chunks:

```typescript
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const RecipeSchema = z.object({
  name: z.string(),
  ingredients: z.array(z.string()),
  steps: z.array(z.string()),
});

const stream = await ai.models.generateContentStream({
  model: "gemini-2.5-flash",
  contents: "Give me a recipe for chocolate chip cookies.",
  config: {
    responseMimeType: "application/json",
    responseJsonSchema: zodToJsonSchema(RecipeSchema),
  },
});

let jsonText = "";
for await (const chunk of stream) {
  jsonText += chunk.text ?? "";
}

const recipe = RecipeSchema.parse(JSON.parse(jsonText));
console.log("Recipe:", recipe.name);
```

**Note:** Parse the complete JSON string after the stream finishes -- partial chunks are not valid JSON.

---

## Streaming Chat

```typescript
const chat = ai.chats.create({
  model: "gemini-2.5-flash",
  config: {
    systemInstruction: "You are a helpful coding tutor.",
  },
});

// First message -- streamed
const stream1 = await chat.sendMessageStream({
  message: "What are TypeScript generics?",
});

for await (const chunk of stream1) {
  process.stdout.write(chunk.text ?? "");
}

console.log("\n---");

// Second message -- also streamed, chat maintains history
const stream2 = await chat.sendMessageStream({
  message: "Show me a practical example.",
});

for await (const chunk of stream2) {
  process.stdout.write(chunk.text ?? "");
}
```

---

## Collecting Full Response from Stream

```typescript
const stream = await ai.models.generateContentStream({
  model: "gemini-2.5-flash",
  contents: "Explain dependency injection.",
});

const chunks: string[] = [];
for await (const chunk of stream) {
  const text = chunk.text ?? "";
  chunks.push(text);
  process.stdout.write(text);
}

const fullResponse = chunks.join("");
```

---

## Abort Pattern

Use `AbortController` to cancel a streaming request:

```typescript
const controller = new AbortController();
const ABORT_TIMEOUT_MS = 10_000;

// Cancel after timeout
const timeoutId = setTimeout(() => controller.abort(), ABORT_TIMEOUT_MS);

try {
  const stream = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: "Write a very long essay about distributed systems.",
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.text ?? "");
  }

  clearTimeout(timeoutId);
} catch (error) {
  if (error instanceof Error && error.name === "AbortError") {
    console.log("\nRequest was cancelled");
  } else {
    throw error;
  }
}
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
