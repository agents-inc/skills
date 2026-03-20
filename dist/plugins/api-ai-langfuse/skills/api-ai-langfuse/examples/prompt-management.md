# Langfuse -- Prompt Management Examples

> Fetching prompts, compiling variables, text vs chat prompts, versioning, labels, caching, and linking prompts to traces. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Setup, environment config, flush/shutdown
- [tracing.md](tracing.md) -- Manual tracing patterns
- [openai-integration.md](openai-integration.md) -- OpenAI auto-instrumentation
- [scores-datasets.md](scores-datasets.md) -- Scores and datasets

---

## Fetching and Compiling Text Prompts

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

// Fetch a text prompt (production label by default)
const prompt = await langfuse.prompt.get("summarize-article");

// Compile with variables -- replaces {{variable}} placeholders
const compiled = prompt.compile({
  topic: "climate change",
  length: "200 words",
});
// -> "Write a 200 words summary about climate change."

// Use compiled prompt with your LLM
const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "developer", content: compiled },
    { role: "user", content: articleText },
  ],
});
```

---

## Chat Prompts

Chat prompts return an array of message objects ready for LLM APIs.

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

// Fetch a chat prompt
const chatPrompt = await langfuse.prompt.get("customer-support", {
  type: "chat",
});

// Compile with variables
const messages = chatPrompt.compile({
  userName: "Alice",
  productName: "Pro Plan",
});
// -> [
//   { role: "system", content: "You are helping Alice with their Pro Plan." },
//   { role: "user", content: "{{user_message}}" }
// ]

// Use directly with OpenAI
const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    ...messages,
    { role: "user", content: "How do I cancel my subscription?" },
  ],
});
```

---

## Prompt Versioning and Labels

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

// Default: fetches "production" label
const prodPrompt = await langfuse.prompt.get("classifier");

// Fetch a specific label (for A/B testing or staging)
const stagingPrompt = await langfuse.prompt.get("classifier", {
  label: "staging",
});

// Fetch a specific version number
const v2Prompt = await langfuse.prompt.get("classifier", {
  version: 2,
});
```

---

## Cache Control

The SDK caches prompts by default. Control caching behavior for development or frequently updated prompts.

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

// Bypass cache -- always fetch from server
const freshPrompt = await langfuse.prompt.get("classifier", {
  cacheTtlSeconds: 0,
});

// Custom cache TTL (in seconds)
const CACHE_TTL_SECONDS = 300;
const cachedPrompt = await langfuse.prompt.get("classifier", {
  cacheTtlSeconds: CACHE_TTL_SECONDS,
});
```

**Note:** When a cached prompt expires, the SDK returns the stale prompt immediately while refreshing in the background. This prevents latency spikes from cache misses.

---

## Creating Prompts Programmatically

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

// Create a text prompt
await langfuse.prompt.create({
  name: "summarize-article",
  prompt: "Write a {{length}} summary about {{topic}}. Focus on key facts.",
  type: "text",
});

// Create a chat prompt
await langfuse.prompt.create({
  name: "customer-support",
  prompt: [
    {
      role: "system",
      content: "You are a support agent helping {{userName}}.",
    },
    { role: "user", content: "{{user_message}}" },
  ],
  type: "chat",
});
```

---

## Linking Prompts to Traces

When using `observeOpenAI`, pass the `langfusePrompt` option to link a prompt version to the generation trace.

```typescript
import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();
const openai = observeOpenAI(new OpenAI());

async function classifyWithManagedPrompt(text: string): Promise<string> {
  const prompt = await langfuse.prompt.get("classifier");
  const compiled = prompt.compile({ text });

  // Link prompt version to the trace for tracking
  const trackedOpenai = observeOpenAI(new OpenAI(), {
    langfusePrompt: prompt,
    generationName: "classify-text",
  });

  const completion = await trackedOpenai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: compiled }],
  });

  return completion.choices[0].message.content ?? "";
}
```

---

## Prompt with Fallback

For guaranteed availability, provide a fallback prompt in case the Langfuse API is unreachable.

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

const FALLBACK_PROMPT = "Summarize the following text concisely: {{text}}";

const prompt = await langfuse.prompt.get("summarizer", {
  fallback: FALLBACK_PROMPT,
});

// If Langfuse API is down, compile() uses the fallback template
const compiled = prompt.compile({ text: articleContent });
```

---

_For tracing patterns, see [tracing.md](tracing.md). For setup, see [core.md](core.md)._
