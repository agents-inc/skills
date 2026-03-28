# Vercel AI SDK Quick Reference

> Provider configuration, model IDs, streaming protocols, and edge runtime compatibility. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Package Installation

```bash
# Core package (always required)
npm install ai

# Provider packages (install what you need)
npm install @ai-sdk/openai
npm install @ai-sdk/anthropic
npm install @ai-sdk/google
npm install @ai-sdk/openai-compatible

# React hooks (for frontend)
npm install @ai-sdk/react

# Zod for schemas
npm install zod
```

---

## Provider Configuration

### Environment Variables

| Provider   | Env Variable                   | Package             |
| ---------- | ------------------------------ | ------------------- |
| OpenAI     | `OPENAI_API_KEY`               | `@ai-sdk/openai`    |
| Anthropic  | `ANTHROPIC_API_KEY`            | `@ai-sdk/anthropic` |
| Google     | `GOOGLE_GENERATIVE_AI_API_KEY` | `@ai-sdk/google`    |
| AI Gateway | `VERCEL_AI_GATEWAY_API_KEY`    | `ai` (built-in)     |

### Provider Setup Patterns

```typescript
// Direct import (auto-reads env vars)
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";

// AI Gateway (provider/model string format)
import { gateway } from "ai";
const model = gateway("openai/gpt-4o");

// Custom provider instance
import { createOpenAI } from "@ai-sdk/openai";
const customOpenAI = createOpenAI({
  apiKey: process.env.CUSTOM_OPENAI_KEY,
  baseURL: "https://my-proxy.example.com/v1",
});

// OpenAI-compatible provider (Ollama, Together, etc.)
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: "http://localhost:11434/v1",
});
```

---

## Model IDs

### Language Models (Chat / Text Generation)

| Provider  | Model ID                      | Use Case                                |
| --------- | ----------------------------- | --------------------------------------- |
| OpenAI    | `openai/gpt-4o`               | General purpose, best structured output |
| OpenAI    | `openai/gpt-4o-mini`          | Fast, cheap, good for simple tasks      |
| OpenAI    | `openai/o3`                   | Reasoning, complex problem solving      |
| OpenAI    | `openai/o3-mini`              | Fast reasoning                          |
| Anthropic | `anthropic/claude-sonnet-4.5` | Best overall quality                    |
| Anthropic | `anthropic/claude-haiku-4.5`  | Fast, cheap                             |
| Anthropic | `anthropic/claude-opus-4.5`   | Highest capability                      |
| Google    | `google/gemini-2.5-flash`     | Fast, multimodal                        |
| Google    | `google/gemini-2.5-pro`       | Highest capability                      |

### Embedding Models

| Provider | Model ID                        | Dimensions     |
| -------- | ------------------------------- | -------------- |
| OpenAI   | `openai/text-embedding-3-small` | 1536 (default) |
| OpenAI   | `openai/text-embedding-3-large` | 3072 (default) |
| Google   | `google/text-embedding-004`     | 768            |

---

## Core Functions Reference

### generateText

```typescript
import { generateText } from "ai";

const {
  text, // Generated text
  output, // Structured output (if Output.* used)
  usage, // { promptTokens, completionTokens, totalTokens }
  finishReason, // 'stop' | 'length' | 'tool-calls' | 'other'
  toolCalls, // Tool calls from final step
  toolResults, // Tool results from final step
  steps, // All generation steps
  response, // { headers, body, messages }
  sources, // URL sources (provider-specific)
  reasoningText, // Model reasoning (if supported)
} = await generateText({
  model: "openai/gpt-4o", // Required: model identifier
  prompt: "Hello", // Simple prompt OR
  messages: [], // Message array (multi-turn)
  system: "You are helpful.", // System instruction
  tools: {}, // Tool definitions
  output: Output.object({}), // Structured output config
  stopWhen: stepCountIs(5), // Multi-step stop condition
  toolChoice: "auto", // 'auto' | 'required' | 'none' | { type: 'tool', toolName: 'x' }
  maxOutputTokens: 1000, // Max output tokens
  temperature: 0.7, // Randomness (0-2)
  onStepFinish({ stepNumber, text, toolCalls, finishReason }) {},
  onFinish({ text, usage, finishReason }) {},
});
```

### streamText

```typescript
import { streamText, smoothStream } from "ai";

const result = streamText({
  model: "anthropic/claude-sonnet-4.5",
  prompt: "Hello",
  // All generateText options plus:
  experimental_transform: smoothStream(),
  onChunk({ chunk }) {},
  onError({ error }) {}, // CRITICAL: stream errors go here, not thrown
  onFinish({ text, usage }) {},
});

// Stream consumption options:
result.textStream; // AsyncIterable<string> -- text only
result.fullStream; // AsyncIterable<TextStreamPart> -- all events
result.partialOutputStream; // AsyncIterable<PartialObject> -- structured output
result.elementStream; // AsyncIterable<Element> -- array output

// Response helpers:
result.toUIMessageStreamResponse(); // Response for useChat routes
result.toTextStreamResponse(); // Response for plain text streaming routes
```

### Output Types

```typescript
import { Output } from "ai";

Output.object({ schema: zodSchema }); // Structured object
Output.array({ element: zodSchema }); // Array of validated objects
Output.choice({ options: ["a", "b"] }); // Single choice from options
Output.json(); // Arbitrary JSON
Output.text(); // Plain text (default)
```

### tool()

```typescript
import { tool } from "ai";
import { z } from "zod";

const myTool = tool({
  description: "Tool purpose", // Optional but always provide one
  inputSchema: z.object({
    /* Zod schema */
  }), // Required
  execute: async (input, options) => result, // Optional (omit for client-side tools)
  outputSchema: z.object({
    /* Zod schema */
  }), // Optional: typed tool output
  strict: true, // Optional: strict schema mode
  needsApproval: true, // Optional: human-in-the-loop
  inputExamples: [
    {
      input: {
        /* example */
      },
    },
  ], // Optional: guide the model
  toModelOutput: async ({ output }) => ({
    /* */
  }), // Optional: custom model-facing output
  onInputStart: () => {}, // Optional: lifecycle hooks
  onInputDelta: ({ inputTextDelta }) => {},
  onInputAvailable: ({ input }) => {},
});
```

### Embeddings

```typescript
import { embed, embedMany, cosineSimilarity } from "ai";

// Single embedding
const { embedding, usage } = await embed({
  model: "openai/text-embedding-3-small",
  value: "text to embed",
});

// Batch embedding
const { embeddings } = await embedMany({
  model: "openai/text-embedding-3-small",
  values: ["text 1", "text 2", "text 3"],
  maxParallelCalls: 2,
});

// Similarity
const similarity = cosineSimilarity(embedding1, embedding2); // -1 to 1
```

---

## Edge Runtime Compatibility

The AI SDK is fully compatible with edge runtimes (Vercel Edge, Cloudflare Workers):

```typescript
// route handler with edge runtime
export const runtime = "edge";

import { streamText } from "ai";

export async function POST(request: Request) {
  const { messages } = await request.json();

  const result = streamText({
    model: "openai/gpt-4o",
    messages,
  });

  return result.toUIMessageStreamResponse();
}
```

**Edge-compatible providers:** All major providers (OpenAI, Anthropic, Google) work on edge runtime. Custom providers using Node.js-only APIs (file system, child processes) will not work on edge.

---

## Status Values (useChat)

| Status        | Meaning                               |
| ------------- | ------------------------------------- |
| `'ready'`     | No active request, ready for input    |
| `'submitted'` | Request sent, waiting for first token |
| `'streaming'` | Actively receiving tokens             |
| `'error'`     | Request failed                        |

---

## Finish Reasons

| Reason             | Meaning                   |
| ------------------ | ------------------------- |
| `'stop'`           | Model completed naturally |
| `'length'`         | Hit maxOutputTokens limit |
| `'tool-calls'`     | Model wants to call tools |
| `'content-filter'` | Blocked by safety filter  |
| `'other'`          | Provider-specific reason  |

---

## SDK Version Migration Quick Reference

| v4                                   | v5                                        | v6                                        |
| ------------------------------------ | ----------------------------------------- | ----------------------------------------- |
| `parameters` (tool)                  | `inputSchema`                             | `inputSchema`                             |
| `generateObject()`                   | `generateObject()`                        | `generateText()` + `Output.object()`      |
| `streamObject()`                     | `streamObject()`                          | `streamText()` + `Output.object()`        |
| `CoreMessage`                        | `CoreMessage`                             | `ModelMessage`                            |
| `convertToCoreMessages()`            | `convertToCoreMessages()`                 | `convertToModelMessages()` (async)        |
| `import { useChat } from 'ai/react'` | `import { useChat } from '@ai-sdk/react'` | `import { useChat } from '@ai-sdk/react'` |
| `isLoading` (useChat)                | `status`                                  | `status`                                  |
| `append({ role, content })`          | `append({ role, content })`               | `sendMessage({ text })`                   |
| `handleSubmit` (useChat)             | `handleSubmit` (useChat)                  | Removed (use `sendMessage()`)             |
| `input` (managed by useChat)         | `input` (managed by useChat)              | External `useState`                       |
| `Experimental_Agent`                 | `Experimental_Agent`                      | `ToolLoopAgent`                           |
| `system` (Agent)                     | `system` (Agent)                          | `instructions` (Agent)                    |
| `partialObjectStream`                | `partialObjectStream`                     | `partialOutputStream`                     |
| `"unknown"` (finishReason)           | `"unknown"` (finishReason)                | `"other"` (finishReason)                  |
