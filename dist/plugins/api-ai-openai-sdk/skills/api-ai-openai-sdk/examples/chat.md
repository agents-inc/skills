# OpenAI SDK -- Chat Completions Examples

> Chat Completions API patterns: basic completion, multi-turn conversations, system/developer messages, temperature, token control. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [streaming.md](streaming.md) -- Streaming responses
- [tools.md](tools.md) -- Tool/function calling
- [structured-output.md](structured-output.md) -- Structured outputs with Zod
- [embeddings-vision-audio.md](embeddings-vision-audio.md) -- Embeddings, vision, audio

---

## Basic Chat Completion

```typescript
// basic-chat.ts
import OpenAI from "openai";

const client = new OpenAI();

async function chat(userMessage: string): Promise<string> {
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "developer",
        content: "You are a helpful assistant. Be concise.",
      },
      { role: "user", content: userMessage },
    ],
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("No content in response");
  }

  console.log(`Tokens: ${completion.usage?.total_tokens}`);
  return content;
}

const answer = await chat("What is TypeScript in one sentence?");
console.log(answer);
```

---

## Multi-Turn Conversations

```typescript
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const client = new OpenAI();

const messages: ChatCompletionMessageParam[] = [
  { role: "developer", content: "You are a TypeScript expert." },
  { role: "user", content: "What is a union type?" },
];

const completion = await client.chat.completions.create({
  model: "gpt-4o",
  messages,
});

// Append assistant response for next turn
const assistantMessage = completion.choices[0].message;
messages.push(assistantMessage);
messages.push({ role: "user", content: "Give me a real-world example." });

const followUp = await client.chat.completions.create({
  model: "gpt-4o",
  messages,
});
```

---

## Token Usage Tracking

```typescript
const completion = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
});

const usage = completion.usage;
if (usage) {
  console.log(`Prompt tokens: ${usage.prompt_tokens}`);
  console.log(`Completion tokens: ${usage.completion_tokens}`);
  console.log(`Total tokens: ${usage.total_tokens}`);

  // Cached tokens (prompt caching)
  if (usage.prompt_tokens_details?.cached_tokens) {
    console.log(`Cached: ${usage.prompt_tokens_details.cached_tokens}`);
  }
}
```

---

## Controlling Output Length

```typescript
const MAX_TOKENS = 500;

const completion = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Summarize this article." }],
  max_tokens: MAX_TOKENS,
  temperature: 0, // Deterministic output for caching
});

if (completion.choices[0].finish_reason === "length") {
  console.warn("Output was truncated -- increase max_tokens");
}
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
