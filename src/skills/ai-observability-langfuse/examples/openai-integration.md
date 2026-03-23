# Langfuse -- OpenAI Integration Examples

> Auto-instrumentation with `observeOpenAI()`, streaming token tracking, custom attributes, and nested tracing. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Setup, environment config, flush/shutdown
- [tracing.md](tracing.md) -- Manual tracing patterns
- [prompt-management.md](prompt-management.md) -- Prompt management
- [scores-datasets.md](scores-datasets.md) -- Scores and datasets

---

## Basic OpenAI Wrapper

```typescript
// lib/openai.ts
import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";

// Wrap the OpenAI client -- all calls automatically traced
const openai = observeOpenAI(new OpenAI());

export { openai };
```

```typescript
// usage.ts
import { openai } from "./lib/openai";

const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "developer", content: "You are a helpful assistant." },
    { role: "user", content: "Explain async/await in TypeScript." },
  ],
});

console.log(completion.choices[0].message.content);
// Langfuse automatically captures: model, tokens, cost, latency
```

---

## Custom Trace Attributes

Pass metadata to control how the generation appears in Langfuse.

```typescript
import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";

const openai = observeOpenAI(new OpenAI(), {
  generationName: "intent-classifier",
  sessionId: "session-abc-123",
  userId: "user-456",
  tags: ["production", "classifier-v2"],
  generationMetadata: {
    feature: "intent-classification",
    version: "2.1",
  },
});

const result = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "I want to book a flight" }],
});
```

---

## Streaming with Token Tracking

For streaming calls, set `stream_options.include_usage` to capture token counts.

```typescript
import { openai } from "./lib/openai";

const stream = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Tell me a story." }],
  stream: true,
  stream_options: { include_usage: true }, // REQUIRED for token tracking on streams
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) process.stdout.write(content);
}
// Token usage automatically captured by observeOpenAI
```

**Without `stream_options: { include_usage: true }`**, OpenAI does not return token counts for streaming responses, and Langfuse will show `null` for token usage.

---

## Nested Inside Manual Traces

Combine `observeOpenAI` with manual tracing for richer context.

```typescript
import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";
import { startActiveObservation } from "@langfuse/tracing";

const openai = observeOpenAI(new OpenAI());

async function summarizeArticle(article: string): Promise<string> {
  return await startActiveObservation("summarize-article", async (span) => {
    span.update({ input: { articleLength: article.length } });

    // OpenAI call is automatically a child of "summarize-article"
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "developer",
          content: "Summarize the following article concisely.",
        },
        { role: "user", content: article },
      ],
    });

    const summary = completion.choices[0].message.content ?? "";
    span.update({ output: { summary, summaryLength: summary.length } });
    return summary;
  });
}
```

---

## Multi-Step Pipeline with OpenAI

```typescript
import OpenAI from "openai";
import { observeOpenAI } from "@langfuse/openai";
import { startActiveObservation, propagateAttributes } from "@langfuse/tracing";

const openai = observeOpenAI(new OpenAI());

async function chatPipeline(
  userId: string,
  sessionId: string,
  message: string,
): Promise<string> {
  return await propagateAttributes(
    { userId, sessionId, tags: ["chat-v3"] },
    async () => {
      return await startActiveObservation("chat-pipeline", async (rootSpan) => {
        rootSpan.update({ input: { message } });

        // Step 1: Classify intent
        const intentResult = await startActiveObservation(
          "classify-intent",
          async () => {
            const completion = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [
                {
                  role: "developer",
                  content:
                    "Classify the user intent as: question, command, or greeting.",
                },
                { role: "user", content: message },
              ],
              temperature: 0,
            });
            return completion.choices[0].message.content ?? "unknown";
          },
          { asType: "agent" },
        );

        // Step 2: Generate response based on intent
        const response = await startActiveObservation(
          "generate-response",
          async () => {
            const completion = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [
                {
                  role: "developer",
                  content: `User intent: ${intentResult}. Respond appropriately.`,
                },
                { role: "user", content: message },
              ],
            });
            return completion.choices[0].message.content ?? "";
          },
          { asType: "generation" },
        );

        rootSpan.update({ output: { intent: intentResult, response } });
        return response;
      });
    },
  );
}
```

---

## Limitations

- `observeOpenAI()` does **NOT** support the OpenAI Assistants API (server-side state is incompatible)
- Requires OpenAI SDK version >= 4.0.0
- Requires OTel `NodeSDK` to be initialized before using the wrapper
- Token counts on streaming calls require explicit `stream_options: { include_usage: true }`

---

_For tracing patterns, see [tracing.md](tracing.md). For setup, see [core.md](core.md)._
