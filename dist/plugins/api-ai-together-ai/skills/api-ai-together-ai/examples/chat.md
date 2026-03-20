# Together AI SDK -- Chat Completions Examples

> Chat Completions API patterns: basic completion, multi-turn conversations, model selection, vision, and token control. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [streaming.md](streaming.md) -- Streaming responses
- [tools.md](tools.md) -- Tool/function calling
- [structured-output.md](structured-output.md) -- Structured outputs with Zod
- [images.md](images.md) -- Image generation, embeddings

---

## Basic Chat Completion

```typescript
// basic-chat.ts
import Together from "together-ai";

const client = new Together();

async function chat(userMessage: string): Promise<string> {
  const completion = await client.chat.completions.create({
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant. Be concise.",
      },
      { role: "user", content: userMessage },
    ],
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("No content in response");
  }

  return content;
}

const answer = await chat("What is TypeScript in one sentence?");
console.log(answer);
```

---

## Multi-Turn Conversations

```typescript
import Together from "together-ai";
import type { Together as TogetherTypes } from "together-ai";

const client = new Together();

const messages: TogetherTypes.Chat.CompletionCreateParams["messages"] = [
  { role: "system", content: "You are a TypeScript expert." },
  { role: "user", content: "What is a union type?" },
];

const completion = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  messages,
});

// Append assistant response for next turn
const assistantMessage = completion.choices[0].message;
messages.push({ role: "assistant", content: assistantMessage.content ?? "" });
messages.push({ role: "user", content: "Give me a real-world example." });

const followUp = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  messages,
});
```

---

## Controlling Output Length and Temperature

```typescript
const MAX_TOKENS = 500;

const completion = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  messages: [{ role: "user", content: "Summarize this article." }],
  max_tokens: MAX_TOKENS,
  temperature: 0, // Deterministic output
});

const finishReason = completion.choices[0].finish_reason;
if (finishReason === "length") {
  console.warn("Output was truncated -- increase max_tokens");
}
```

---

## Vision -- Image from URL

```typescript
import Together from "together-ai";

const client = new Together();

async function analyzeImage(
  imageUrl: string,
  question: string,
): Promise<string> {
  const response = await client.chat.completions.create({
    model: "Qwen/Qwen3-VL-8B-Instruct",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: question },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  });

  return response.choices[0].message.content ?? "";
}

const description = await analyzeImage(
  "https://example.com/photo.jpg",
  "Describe what you see in this image.",
);
console.log(description);
```

---

## Vision -- Multiple Images

```typescript
const response = await client.chat.completions.create({
  model: "Qwen/Qwen3-VL-8B-Instruct",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Compare these two images." },
        {
          type: "image_url",
          image_url: { url: "https://example.com/image1.jpg" },
        },
        {
          type: "image_url",
          image_url: { url: "https://example.com/image2.jpg" },
        },
      ],
    },
  ],
});
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
