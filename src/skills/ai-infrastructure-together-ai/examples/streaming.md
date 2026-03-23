# Together AI SDK -- Streaming Examples

> Streaming patterns: `stream: true` with async iterators, stream cancellation, and controller access. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [chat.md](chat.md) -- Chat Completions API
- [tools.md](tools.md) -- Tool/function calling
- [structured-output.md](structured-output.md) -- Structured outputs with Zod
- [images.md](images.md) -- Image generation, embeddings

---

## Basic Streaming with `for await`

```typescript
// streaming-chat.ts
import Together from "together-ai";

const client = new Together();

const stream = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
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

## Collecting Full Response from Stream

```typescript
import Together from "together-ai";

const client = new Together();

async function streamToString(prompt: string): Promise<string> {
  const stream = await client.chat.completions.create({
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: prompt },
    ],
    stream: true,
  });

  const parts: string[] = [];

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      parts.push(content);
      process.stdout.write(content); // Show progress
    }
  }
  console.log(); // newline

  return parts.join("");
}

const result = await streamToString("Explain promises in JavaScript.");
console.log("Total length:", result.length);
```

---

## Stream Cancellation

```typescript
import Together from "together-ai";

const client = new Together();

const stream = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  messages: [{ role: "user", content: "Tell me a long story." }],
  stream: true,
});

let tokenCount = 0;
const MAX_TOKENS_TO_READ = 100;

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
    tokenCount++;
    if (tokenCount >= MAX_TOKENS_TO_READ) {
      // Cancel the stream by using the controller
      stream.controller.abort();
      break;
    }
  }
}
console.log("\nStream cancelled after", tokenCount, "chunks");
```

---

## Streaming with Tool Calls

```typescript
import Together from "together-ai";

const client = new Together();

const stream = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  messages: [{ role: "user", content: "What is the weather in Tokyo?" }],
  tools: [
    {
      type: "function",
      function: {
        name: "get_weather",
        description: "Get weather for a city",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string" },
          },
          required: ["location"],
        },
      },
    },
  ],
  stream: true,
});

for await (const chunk of stream) {
  const toolCalls = chunk.choices[0]?.delta?.tool_calls ?? [];
  for (const toolCall of toolCalls) {
    console.log("Tool call delta:", toolCall);
  }
}
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
