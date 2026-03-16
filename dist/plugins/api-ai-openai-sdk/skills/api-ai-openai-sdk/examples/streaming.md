# OpenAI SDK -- Streaming Examples

> Streaming patterns for Chat Completions and Responses API: `stream: true` with async iterators, `.stream()` event-based helper, Responses API streaming. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [chat.md](chat.md) -- Chat Completions API
- [tools.md](tools.md) -- Tool/function calling
- [structured-output.md](structured-output.md) -- Structured outputs with Zod
- [embeddings-vision-audio.md](embeddings-vision-audio.md) -- Embeddings, vision, audio

---

## Basic Streaming with `for await`

```typescript
// streaming-chat.ts
import OpenAI from "openai";

const client = new OpenAI();

// Chat Completions streaming
const stream = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "developer", content: "You are a helpful assistant." },
    { role: "user", content: "Explain async/await in TypeScript." },
  ],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}
console.log(); // newline
```

---

## Event-Based Streaming with `.stream()` Helper

```typescript
import OpenAI from "openai";

const client = new OpenAI();

async function streamWithEvents(prompt: string): Promise<string> {
  const stream = client.chat.completions.stream({
    model: "gpt-4o",
    messages: [
      { role: "developer", content: "You are a helpful assistant." },
      { role: "user", content: prompt },
    ],
  });

  stream.on("content", (delta) => {
    process.stdout.write(delta);
  });

  stream.on("error", (error) => {
    console.error("Stream error:", error);
  });

  const content = await stream.finalContent();
  console.log(); // newline
  return content ?? "";
}

const result = await streamWithEvents("Explain promises in JavaScript.");
console.log("Final result length:", result.length);
```

---

## Responses API Streaming

```typescript
import OpenAI from "openai";

const client = new OpenAI();

const stream = await client.responses.create({
  model: "gpt-4o",
  input: "Write a haiku about TypeScript.",
  stream: true,
});

for await (const event of stream) {
  if (event.type === "response.output_text.delta") {
    process.stdout.write(event.delta);
  }
}
console.log();
```

---

## Stream Abort

```typescript
const stream = client.chat.completions.stream({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Tell me a long story." }],
});

// Cancel after a timeout
const ABORT_TIMEOUT_MS = 5_000;
setTimeout(() => stream.abort(), ABORT_TIMEOUT_MS);

stream.on("content", (delta) => {
  process.stdout.write(delta);
});

try {
  await stream.finalContent();
} catch (error) {
  console.log("Stream aborted");
}
```

---

## Stream Methods Reference

```typescript
const stream = client.chat.completions.stream({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
});

// Promise-based accessors
await stream.finalContent(); // Promise<string> -- last assistant content
await stream.finalMessage(); // Promise<ChatCompletionMessage>
await stream.allChatCompletions(); // Promise<ChatCompletion[]>

// Control
stream.abort(); // Cancel stream and network request
stream.controller; // Underlying AbortController
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
