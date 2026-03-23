# Mistral SDK -- Chat & Streaming Examples

> Chat completions, streaming with async iteration, multi-turn conversations, and token tracking. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [structured-output.md](structured-output.md) -- Structured outputs with Zod
- [function-calling.md](function-calling.md) -- Tool/function calling
- [embeddings-vision.md](embeddings-vision.md) -- Embeddings and vision
- [codestral.md](codestral.md) -- Codestral FIM code completion

---

## Basic Chat Completion

```typescript
// basic-chat.ts
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({ apiKey: process.env["MISTRAL_API_KEY"] ?? "" });

async function chat(userMessage: string): Promise<string> {
  const result = await client.chat.complete({
    model: "mistral-large-latest",
    messages: [
      { role: "system", content: "You are a helpful assistant. Be concise." },
      { role: "user", content: userMessage },
    ],
  });

  const content = result?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in response");
  }

  // Log token usage
  if (result.usage) {
    console.log(`Tokens: ${result.usage.totalTokens}`);
  }

  return typeof content === "string" ? content : content.join("");
}

const answer = await chat("What is TypeScript in one sentence?");
console.log(answer);
```

**Why good:** Safe optional chaining on nullable fields, handles `content` being `string | string[]`, token tracking

---

## Streaming with Async Iteration

```typescript
// streaming-chat.ts
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({ apiKey: process.env["MISTRAL_API_KEY"] ?? "" });

const result = await client.chat.stream({
  model: "mistral-large-latest",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Explain async/await in TypeScript." },
  ],
});

// IMPORTANT: events wrap data in event.data -- not directly on event
for await (const event of result) {
  const content = event.data.choices[0]?.delta?.content;
  if (content) {
    // content may be string | string[] depending on model
    process.stdout.write(
      typeof content === "string" ? content : content.join(""),
    );
  }
}
console.log(); // newline
```

**Why good:** Accesses `event.data.choices[0]` (not `event.choices[0]`), handles string union type

### BAD: OpenAI-style streaming (wrong for Mistral)

```typescript
// BAD: Trying OpenAI's event shape
for await (const chunk of result) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? ""); // WRONG: no .data wrapper
}
```

**Why bad:** Mistral wraps streaming data in `event.data` -- accessing `chunk.choices` directly fails silently or throws

---

## Multi-Turn Conversation

```typescript
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({ apiKey: process.env["MISTRAL_API_KEY"] ?? "" });

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const messages: ChatMessage[] = [
  { role: "system", content: "You are a TypeScript expert." },
  { role: "user", content: "What is a union type?" },
];

const first = await client.chat.complete({
  model: "mistral-large-latest",
  messages,
});

const firstContent = first?.choices?.[0]?.message?.content;
if (firstContent) {
  // Append assistant response for next turn
  messages.push({
    role: "assistant",
    content:
      typeof firstContent === "string" ? firstContent : firstContent.join(""),
  });
  messages.push({ role: "user", content: "Give me a real-world example." });

  const followUp = await client.chat.complete({
    model: "mistral-large-latest",
    messages,
  });

  console.log(followUp?.choices?.[0]?.message?.content);
}
```

---

## Controlling Output Length and Temperature

```typescript
const MAX_TOKENS = 500;

const result = await client.chat.complete({
  model: "mistral-large-latest",
  messages: [{ role: "user", content: "Summarize this article." }],
  maxTokens: MAX_TOKENS,
  temperature: 0, // Deterministic output
});

const finishReason = result?.choices?.[0]?.finishReason;
if (finishReason === "length") {
  console.warn("Output was truncated -- increase maxTokens");
}
```

**Why good:** Uses `maxTokens` (camelCase), checks `finishReason` (camelCase) for truncation

---

## Token Usage Tracking

```typescript
const result = await client.chat.complete({
  model: "mistral-large-latest",
  messages: [{ role: "user", content: "Hello" }],
});

const usage = result?.usage;
if (usage) {
  console.log(`Prompt tokens: ${usage.promptTokens}`);
  console.log(`Completion tokens: ${usage.completionTokens}`);
  console.log(`Total tokens: ${usage.totalTokens}`);
}
```

**Why good:** Uses camelCase properties (`promptTokens`, not `prompt_tokens`)

---

## Streaming with Abort

```typescript
const controller = new AbortController();
const ABORT_TIMEOUT_MS = 5_000;

setTimeout(() => controller.abort(), ABORT_TIMEOUT_MS);

try {
  const result = await client.chat.stream(
    {
      model: "mistral-large-latest",
      messages: [{ role: "user", content: "Tell me a long story." }],
    },
    {
      fetchOptions: { signal: controller.signal },
    },
  );

  for await (const event of result) {
    const content = event.data.choices[0]?.delta?.content;
    if (content) {
      process.stdout.write(
        typeof content === "string" ? content : content.join(""),
      );
    }
  }
} catch (error) {
  if (error instanceof Error && error.name === "AbortError") {
    console.log("\nStream aborted");
  } else {
    throw error;
  }
}
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
