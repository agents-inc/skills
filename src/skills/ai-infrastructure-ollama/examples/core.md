# Ollama -- Setup, Chat & Generate Examples

> Client initialization, chat completions, text generation, streaming, error handling, and cloud API. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [tools.md](tools.md) -- Tool/function calling
- [structured-output.md](structured-output.md) -- Structured output with Zod
- [embeddings-vision.md](embeddings-vision.md) -- Embeddings, vision, multimodal
- [model-management.md](model-management.md) -- Pull, list, show, delete

---

## Default Client Setup

```typescript
// lib/ollama.ts
import ollama from "ollama";

// Pre-configured singleton -- connects to http://127.0.0.1:11434
// No configuration needed for local development
export { ollama };
```

---

## Custom Client (Remote Server)

```typescript
// lib/ollama.ts
import { Ollama } from "ollama";

const ollama = new Ollama({
  host: "http://192.168.1.100:11434",
  headers: {
    "X-Custom-Header": "custom-value",
  },
});

export { ollama };
```

---

## Cloud API Client (ollama.com)

```typescript
// lib/ollama-cloud.ts
import { Ollama } from "ollama";

const ollama = new Ollama({
  host: "https://ollama.com",
  headers: {
    Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
  },
});

export { ollama };
```

---

## Browser Client

```typescript
// For browser environments (requires a bundler)
import ollama from "ollama/browser";

const response = await ollama.chat({
  model: "llama3.1",
  messages: [{ role: "user", content: "Hello from the browser!" }],
});
```

---

## Basic Chat Completion

```typescript
import ollama from "ollama";

async function chat(userMessage: string): Promise<string> {
  const response = await ollama.chat({
    model: "llama3.1",
    messages: [
      { role: "system", content: "You are a helpful assistant. Be concise." },
      { role: "user", content: userMessage },
    ],
  });

  return response.message.content;
}

const answer = await chat("What is TypeScript in one sentence?");
console.log(answer);
```

---

## Multi-Turn Conversation

```typescript
import ollama from "ollama";
import type { Message } from "ollama";

const messages: Message[] = [
  { role: "system", content: "You are a TypeScript expert." },
  { role: "user", content: "What is a union type?" },
];

const first = await ollama.chat({ model: "llama3.1", messages });

// Append assistant response for next turn
messages.push(first.message);
messages.push({ role: "user", content: "Give me a real-world example." });

const followUp = await ollama.chat({ model: "llama3.1", messages });
console.log(followUp.message.content);
```

---

## Chat with Model Options

```typescript
import ollama from "ollama";

const NUM_CTX = 8192;

const response = await ollama.chat({
  model: "llama3.1",
  messages: [{ role: "user", content: "Write a story about a robot." }],
  options: {
    temperature: 0, // Deterministic output
    num_ctx: NUM_CTX, // Context window size
    seed: 42, // Reproducible output
  },
  keep_alive: "30m", // Keep model loaded for 30 minutes
});

console.log(response.message.content);
```

---

## Text Generation (Non-Chat)

```typescript
import ollama from "ollama";

const response = await ollama.generate({
  model: "llama3.1",
  prompt: "Write a haiku about TypeScript.",
  system: "You are a creative writer.",
});

console.log(response.response);

// Performance metrics
const tokensPerSecond = (response.eval_count / response.eval_duration) * 1e9;
console.log(`Speed: ${tokensPerSecond.toFixed(1)} tokens/sec`);
```

---

## Chat Streaming

```typescript
import ollama from "ollama";

const stream = await ollama.chat({
  model: "llama3.1",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Explain async/await in TypeScript." },
  ],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.message.content);
}
console.log(); // newline
```

---

## Generate Streaming

```typescript
import ollama from "ollama";

const stream = await ollama.generate({
  model: "llama3.1",
  prompt: "Write a limerick about programming.",
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.response);
}
console.log();
```

---

## Streaming with Thinking Mode

```typescript
import ollama from "ollama";

const stream = await ollama.chat({
  model: "qwen3",
  messages: [{ role: "user", content: "What is 15 * 23 + 47?" }],
  stream: true,
  think: true,
});

let thinking = "";
let content = "";

for await (const chunk of stream) {
  if (chunk.message.thinking) {
    thinking += chunk.message.thinking;
    process.stderr.write(chunk.message.thinking); // Show thinking on stderr
  }
  if (chunk.message.content) {
    content += chunk.message.content;
    process.stdout.write(chunk.message.content);
  }
}

console.log();
// Accumulated `thinking` and `content` are needed for multi-turn history
```

---

## Abort Active Streams

```typescript
import ollama from "ollama";

// Start a long-running stream
const streamPromise = (async () => {
  const stream = await ollama.chat({
    model: "llama3.1",
    messages: [{ role: "user", content: "Tell me a very long story." }],
    stream: true,
  });

  try {
    for await (const chunk of stream) {
      process.stdout.write(chunk.message.content);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.log("\nStream aborted");
    } else {
      throw error;
    }
  }
})();

// Cancel all active streams after timeout
const ABORT_TIMEOUT_MS = 5_000;
setTimeout(() => ollama.abort(), ABORT_TIMEOUT_MS);

await streamPromise;
```

---

## Error Handling

```typescript
import ollama from "ollama";

async function safeChat(prompt: string): Promise<string | null> {
  try {
    const response = await ollama.chat({
      model: "llama3.1",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
    });

    return response.message.content;
  } catch (error) {
    if (error instanceof Error) {
      // Model not found -- needs to be pulled
      if (error.message.includes("not found")) {
        console.error("Model not found. Run: ollama pull llama3.1");
        return null;
      }

      // Connection error -- Ollama server not running
      if (error.message.includes("ECONNREFUSED")) {
        console.error(
          "Cannot connect to Ollama. Is it running? Run: ollama serve",
        );
        return null;
      }

      // Abort error from ollama.abort()
      if (error.name === "AbortError") {
        console.log("Request was cancelled");
        return null;
      }

      console.error("Ollama error:", error.message);
    }

    throw error;
  }
}

const result = await safeChat("Hello!");
if (result) {
  console.log(result);
}
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
