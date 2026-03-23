# Cohere SDK -- Setup, Chat & Streaming Examples

> Client initialization, chat completions, streaming, multi-turn conversations, and error handling. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [embeddings-rerank.md](embeddings-rerank.md) -- Embeddings, rerank, semantic search pipeline
- [tools-rag.md](tools-rag.md) -- Tool use, RAG with documents, citation handling

---

## Basic Client Setup

```typescript
// lib/cohere.ts
import { CohereClientV2 } from "cohere-ai";

const client = new CohereClientV2({
  token: process.env.CO_API_KEY,
});

export { client };
```

---

## Production Configuration

```typescript
// lib/cohere.ts
import { CohereClientV2 } from "cohere-ai";

const TIMEOUT_MS = 30_000;

const client = new CohereClientV2({
  token: process.env.CO_API_KEY,
  timeout: TIMEOUT_MS,
  clientName: "my-app",
});

export { client };
```

---

## Basic Chat Completion

```typescript
import { CohereClientV2 } from "cohere-ai";

const client = new CohereClientV2({ token: process.env.CO_API_KEY });

async function chat(userMessage: string): Promise<string> {
  const response = await client.chat({
    model: "command-a-03-2025",
    messages: [
      { role: "system", content: "You are a helpful assistant. Be concise." },
      { role: "user", content: userMessage },
    ],
  });

  const content = response.message.content[0].text;
  console.log(
    `Tokens: input=${response.usage?.tokens?.inputTokens}, output=${response.usage?.tokens?.outputTokens}`,
  );

  if (response.finishReason === "MAX_TOKENS") {
    console.warn("Response was truncated");
  }

  return content;
}

const answer = await chat("What is TypeScript in one sentence?");
console.log(answer);
```

---

## Multi-Turn Conversation

```typescript
import { CohereClientV2 } from "cohere-ai";

const client = new CohereClientV2({ token: process.env.CO_API_KEY });

const messages: Array<{ role: string; content: string }> = [
  { role: "system", content: "You are a TypeScript expert." },
  { role: "user", content: "What is a union type?" },
];

const response = await client.chat({
  model: "command-a-03-2025",
  messages,
});

// Append assistant response for next turn
const assistantText = response.message.content[0].text;
messages.push({ role: "assistant", content: assistantText });
messages.push({ role: "user", content: "Give me a real-world example." });

const followUp = await client.chat({
  model: "command-a-03-2025",
  messages,
});

console.log(followUp.message.content[0].text);
```

---

## Streaming with Content Deltas

```typescript
import { CohereClientV2 } from "cohere-ai";

const client = new CohereClientV2({ token: process.env.CO_API_KEY });

const stream = await client.chatStream({
  model: "command-a-03-2025",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Explain async/await in TypeScript." },
  ],
});

for await (const event of stream) {
  if (event.type === "content-delta") {
    process.stdout.write(event.delta?.message?.content?.text ?? "");
  }
  if (event.type === "message-end") {
    console.log(`\nFinish reason: ${event.delta?.finishReason}`);
  }
}
```

---

## Streaming with All Event Types

```typescript
import { CohereClientV2 } from "cohere-ai";

const client = new CohereClientV2({ token: process.env.CO_API_KEY });

const stream = await client.chatStream({
  model: "command-a-03-2025",
  messages: [{ role: "user", content: "Tell me about TypeScript." }],
});

for await (const event of stream) {
  switch (event.type) {
    case "message-start":
      // Stream has begun
      break;
    case "content-delta":
      process.stdout.write(event.delta?.message?.content?.text ?? "");
      break;
    case "citation-start":
      // Citation generated (only with documents/tools)
      break;
    case "tool-plan-delta":
      // Model reasoning about which tool to call
      break;
    case "tool-call-start":
      // Tool call initiated
      break;
    case "message-end":
      console.log(`\nDone. Reason: ${event.delta?.finishReason}`);
      break;
  }
}
```

---

## Production Error Handling

```typescript
import { CohereClientV2, CohereError, CohereTimeoutError } from "cohere-ai";

const TIMEOUT_MS = 30_000;

const client = new CohereClientV2({
  token: process.env.CO_API_KEY,
  timeout: TIMEOUT_MS,
});

async function safeChat(prompt: string): Promise<string | null> {
  try {
    const response = await client.chat({
      model: "command-a-03-2025",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
    });

    if (response.finishReason === "MAX_TOKENS") {
      console.warn("Response was truncated");
    }

    return response.message.content[0].text;
  } catch (error) {
    if (error instanceof CohereTimeoutError) {
      console.error("Request timed out");
      return null;
    }

    if (error instanceof CohereError) {
      console.error(`Cohere API Error [${error.statusCode}]: ${error.message}`);

      if (error.statusCode === 429) {
        console.error("Rate limited -- back off and retry");
      }

      if (error.statusCode === 401) {
        throw new Error(
          "Invalid API key. Check CO_API_KEY environment variable.",
        );
      }

      return null;
    }

    // Unknown errors should be re-thrown
    throw error;
  }
}

const result = await safeChat("Hello!");
if (result) {
  console.log(result);
}
```

---

## Temperature and Output Control

```typescript
const MAX_TOKENS = 500;

const response = await client.chat({
  model: "command-a-03-2025",
  messages: [{ role: "user", content: "Summarize this article." }],
  temperature: 0, // Deterministic output
  maxTokens: MAX_TOKENS,
});

if (response.finishReason === "MAX_TOKENS") {
  console.warn("Output was truncated -- increase maxTokens");
}
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
