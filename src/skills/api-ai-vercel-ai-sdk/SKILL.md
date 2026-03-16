---
name: api-ai-vercel-ai-sdk
description: Vercel AI SDK patterns - providers, text generation, streaming, structured output, tool calling, chat UI hooks, embeddings, and RAG
---

# Vercel AI SDK Patterns

> **Quick Guide:** Use Vercel AI SDK (v6) to build AI-powered applications with a unified provider API. Use `generateText`/`streamText` for text generation and streaming, `Output.object()`/`Output.array()` for structured data with Zod, `tool()` for function calling, and `useChat`/`useCompletion` hooks for React chat UIs. Supports OpenAI, Anthropic, Google, and 20+ providers through a single API.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use the `ai` package (v6) with `Output.object()` / `Output.array()` for structured output -- NOT the deprecated `generateObject` / `streamObject` functions)**

**(You MUST define tool input schemas with `z.object()` and use `.describe()` on each property to help the model understand expected inputs)**

**(You MUST use `streamText` for user-facing responses to enable progressive rendering -- use `generateText` only for background/non-interactive tasks)**

**(You MUST handle streaming errors via `onError` callback -- streamText errors become part of the stream and are NOT thrown)**

**(You MUST use `inputSchema` (not `parameters`) when defining tools -- `parameters` was renamed in SDK v5+)**

</critical_requirements>

---

**Auto-detection:** AI SDK, Vercel AI, generateText, streamText, generateObject, streamObject, Output.object, Output.array, useChat, useCompletion, @ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/google, tool(), toolChoice, embedMany, embed, cosineSimilarity, ToolLoopAgent, smoothStream

**When to use:**

- Building AI chat interfaces with streaming responses
- Generating structured data (JSON objects, arrays) from LLMs with Zod schema validation
- Implementing tool calling / function calling with LLMs
- Creating multi-provider AI applications (OpenAI, Anthropic, Google, etc.)
- Building RAG pipelines with embeddings and vector similarity
- Adding AI text completion or generation to any Node.js/React/Next.js app

**Key patterns covered:**

- Provider setup and model configuration (OpenAI, Anthropic, Google, custom)
- Text generation (`generateText`) and streaming (`streamText`)
- Structured output with Zod schemas (`Output.object`, `Output.array`, `Output.choice`)
- Tool calling with `tool()`, multi-step execution, and approval flows
- React hooks: `useChat` for chat UIs, `useCompletion` for text completion
- Embeddings (`embed`, `embedMany`) and RAG patterns with `cosineSimilarity`

**When NOT to use:**

- Simple static content that doesn't need AI generation
- Server-side-only batch jobs where a direct provider SDK (e.g., `openai` npm package) is simpler
- Image generation only (AI SDK supports it, but dedicated image SDKs may be more feature-rich)

**Detailed Resources:**

- For provider setup, text generation, and error handling, see [examples/core.md](examples/core.md)
- For chat UI patterns with useChat, see [examples/chat.md](examples/chat.md)
- For tool definitions and multi-step calling, see [examples/tools.md](examples/tools.md)
- For Zod-based structured output, see [examples/structured-output.md](examples/structured-output.md)
- For embeddings and RAG, see [examples/rag.md](examples/rag.md)
- For quick reference tables, see [reference.md](reference.md)

---

<philosophy>

## Philosophy

The Vercel AI SDK provides a **unified TypeScript API** for building AI-powered applications across providers. Instead of learning each provider's unique SDK, you write one set of code that works with OpenAI, Anthropic, Google, and 20+ other providers.

**Core principles:**

1. **Provider agnostic** -- Switch models by changing a string, not rewriting code. The provider abstraction means `generateText({ model: 'openai/gpt-4o' })` and `generateText({ model: 'anthropic/claude-sonnet-4.5' })` use the same API.
2. **Streaming first** -- `streamText` starts delivering tokens immediately. Use it for all user-facing responses. `generateText` blocks until completion and is better for background tasks and agent loops.
3. **Type-safe structured output** -- Define Zod schemas and get validated, typed objects back from the model. Use `.describe()` on schema properties to guide the model.
4. **Tools as first-class citizens** -- Define tools with Zod input schemas and execute functions. The SDK handles the tool call loop, including multi-step execution and human approval.
5. **Framework-agnostic UI hooks** -- `useChat` and `useCompletion` work with React, Svelte, Vue, and Angular. They manage streaming state, message history, and input handling.

**When to use Vercel AI SDK:**

- Multi-provider applications where you want to switch models easily
- Streaming chat interfaces with React/Next.js
- Structured data extraction from natural language
- Agent-style applications with tool calling loops
- RAG systems with embedding and retrieval

**When NOT to use:**

- Single-provider scripts where the native SDK is simpler and has fewer dependencies
- Extremely high-throughput batch processing (direct API calls avoid SDK overhead)
- Non-TypeScript environments (the SDK is TypeScript-first)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Provider Setup

Configure providers via direct imports (auto-reads env vars) or custom instances. The AI Gateway (`gateway`) routes to any provider with a `provider/model` string.

```typescript
// provider-setup.ts
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { gateway } from 'ai';

// Option 1: Direct provider imports (reads OPENAI_API_KEY, etc. from env)
const model = openai('gpt-4o');

// Option 2: AI Gateway with provider/model string format
const gatewayModel = gateway('anthropic/claude-sonnet-4.5');

// Option 3: Custom provider configuration
import { createAnthropic } from '@ai-sdk/anthropic';

const customAnthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com/v1',
});
const customModel = customAnthropic('claude-sonnet-4.5');
```

**Why good:** Gateway string format makes model switching trivial, env vars auto-detected, custom instances allow proxy/custom auth

```typescript
// BAD: Hardcoded API keys
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: 'sk-1234567890abcdef', // NEVER hardcode API keys
});
```

**Why bad:** Hardcoded secrets leak into version control, use environment variables instead

#### Model Aliases

```typescript
// model-aliases.ts
import { customProvider, gateway } from 'ai';

export const models = customProvider({
  languageModels: {
    fast: gateway('openai/gpt-4o-mini'),
    smart: gateway('anthropic/claude-sonnet-4.5'),
    reasoning: gateway('openai/o3'),
  },
  fallbackProvider: gateway,
});

// Usage: models('fast'), models('smart')
```

---

### Pattern 2: Text Generation with generateText

Use `generateText` for non-interactive tasks where you need the complete response before proceeding. Returns a promise that resolves when generation is complete.

```typescript
// generate-text.ts
import { generateText } from 'ai';

const { text, usage, finishReason } = await generateText({
  model: 'openai/gpt-4o',
  system: 'You are a professional technical writer. Write clear, concise content.',
  prompt: `Summarize the following article in 3-5 sentences: ${article}`,
});

console.log(text);
console.log(`Tokens used: ${usage.totalTokens}`);
```

**Why good:** System prompt sets behavior, prompt provides task, destructured result gives text and metadata

```typescript
// BAD: Using generateText for user-facing chat responses
export async function POST(request: Request) {
  const { messages } = await request.json();

  // BAD: Blocks until complete response -- user sees nothing until done
  const { text } = await generateText({
    model: 'openai/gpt-4o',
    messages,
  });

  return new Response(text);
}
```

**Why bad:** User sees no output until entire response is generated, use `streamText` for user-facing responses

#### Messages Format

```typescript
import { generateText } from 'ai';
import type { ModelMessage } from 'ai';

const messages: ModelMessage[] = [
  { role: 'user', content: 'What is TypeScript?' },
  { role: 'assistant', content: 'TypeScript is a typed superset of JavaScript.' },
  { role: 'user', content: 'What are its main benefits?' },
];

const { text, response } = await generateText({
  model: 'anthropic/claude-sonnet-4.5',
  system: 'You are a helpful programming assistant.',
  messages,
});

// Append response messages for multi-turn conversation
messages.push(...response.messages);
```

---

### Pattern 3: Streaming with streamText

Use `streamText` for all user-facing responses. It immediately starts streaming tokens. Errors are part of the stream (not thrown) -- use `onError` to handle them.

```typescript
// stream-text.ts
import { streamText, smoothStream } from 'ai';

const result = streamText({
  model: 'anthropic/claude-sonnet-4.5',
  system: 'You are a helpful assistant.',
  prompt: 'Explain the benefits of TypeScript in detail.',
  experimental_transform: smoothStream(),
  onChunk({ chunk }) {
    if (chunk.type === 'text') {
      process.stdout.write(chunk.text);
    }
  },
  onFinish({ text, usage, finishReason }) {
    console.log(`\nFinished: ${finishReason}, tokens: ${usage.totalTokens}`);
  },
  onError({ error }) {
    console.error('Stream error:', error);
  },
});

// Option 1: Consume text stream
for await (const textPart of result.textStream) {
  process.stdout.write(textPart);
}

// Option 2: Consume full stream with event types
for await (const part of result.fullStream) {
  switch (part.type) {
    case 'text-delta':
      process.stdout.write(part.textDelta);
      break;
    case 'tool-call':
      console.log('Tool called:', part.toolName);
      break;
    case 'error':
      console.error('Stream error:', part.error);
      break;
    case 'finish':
      console.log('Done:', part.finishReason);
      break;
  }
}
```

**Why good:** `smoothStream()` provides natural-feeling output, `onError` catches stream errors, `fullStream` gives granular control over all event types

#### Next.js Route Handler

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';

export async function POST(request: Request) {
  const { messages } = await request.json();

  const result = streamText({
    model: 'openai/gpt-4o',
    system: 'You are a helpful assistant.',
    messages,
  });

  return result.toTextStreamResponse();
}
```

---

### Pattern 4: Structured Output with Zod

Use `Output.object()` with `generateText`/`streamText` for type-safe structured data. The Zod schema both validates output and guides the model. Use `.describe()` on properties for clarity.

```typescript
// structured-output.ts
import { generateText, Output } from 'ai';
import { z } from 'zod';

const recipeSchema = z.object({
  name: z.string().describe('The name of the recipe'),
  servings: z.number().describe('Number of servings'),
  ingredients: z.array(
    z.object({
      name: z.string().describe('Ingredient name'),
      amount: z.string().describe('Amount with unit, e.g. "200g" or "2 cups"'),
    }),
  ).describe('List of ingredients with amounts'),
  steps: z.array(z.string()).describe('Step-by-step cooking instructions'),
  prepTimeMinutes: z.number().describe('Preparation time in minutes'),
  cookTimeMinutes: z.number().describe('Cooking time in minutes'),
});

const { output } = await generateText({
  model: 'openai/gpt-4o',
  output: Output.object({
    schema: recipeSchema,
  }),
  prompt: 'Generate a vegetarian lasagna recipe for 4 people.',
});

// output is fully typed: { name: string, servings: number, ... }
console.log(output.name);
console.log(`Prep: ${output.prepTimeMinutes}min, Cook: ${output.cookTimeMinutes}min`);
```

**Why good:** Zod schema provides runtime validation and TypeScript types, `.describe()` guides the model, `Output.object()` is the v6 pattern

```typescript
// BAD: Deprecated generateObject (removed in v6)
import { generateObject } from 'ai';

const { object } = await generateObject({
  model: 'openai/gpt-4o',
  schema: z.object({ name: z.string() }),
  prompt: 'Generate a recipe.',
});
```

**Why bad:** `generateObject` is deprecated in v6, use `generateText` with `Output.object()` instead

#### Streaming Partial Objects

```typescript
import { streamText, Output } from 'ai';
import { z } from 'zod';

const { partialOutputStream } = streamText({
  model: 'openai/gpt-4o',
  output: Output.object({ schema: recipeSchema }),
  prompt: 'Generate a vegetarian lasagna recipe.',
});

for await (const partialObject of partialOutputStream) {
  // partialObject has optional fields as the object builds up
  console.clear();
  console.log(partialObject);
}
```

#### Array Output with Element Streaming

```typescript
import { streamText, Output } from 'ai';
import { z } from 'zod';

const heroSchema = z.object({
  name: z.string().describe('Hero name'),
  class: z.string().describe('Character class'),
  description: z.string().describe('Brief backstory'),
});

const { elementStream } = streamText({
  model: 'anthropic/claude-sonnet-4.5',
  output: Output.array({ element: heroSchema }),
  prompt: 'Generate 5 hero descriptions for a fantasy RPG.',
});

for await (const hero of elementStream) {
  // Each hero is complete and validated before yielding
  console.log(`${hero.name} (${hero.class}): ${hero.description}`);
}
```

---

### Pattern 5: Tool Calling

Define tools with `tool()`, Zod input schemas, and `execute` functions. The SDK handles the tool call lifecycle including multi-step loops.

```typescript
// tools.ts
import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';

const weatherTool = tool({
  description: 'Get the current weather in a location',
  inputSchema: z.object({
    location: z.string().describe('City name or coordinates'),
    unit: z.enum(['celsius', 'fahrenheit']).default('celsius')
      .describe('Temperature unit'),
  }),
  execute: async ({ location, unit }) => {
    const data = await fetchWeatherAPI(location, unit);
    return {
      location,
      temperature: data.temperature,
      condition: data.condition,
      unit,
    };
  },
});

const MAX_TOOL_STEPS = 5;

const { text, steps } = await generateText({
  model: 'openai/gpt-4o',
  tools: { weather: weatherTool },
  stopWhen: stepCountIs(MAX_TOOL_STEPS),
  prompt: 'What is the weather in San Francisco and Tokyo?',
});

// Access all tool calls across steps
const allToolCalls = steps.flatMap((step) => step.toolCalls);
console.log(`Made ${allToolCalls.length} tool calls`);
console.log(text);
```

**Why good:** Zod schema with `.describe()` guides model, `stepCountIs()` prevents infinite loops, named constant for max steps

```typescript
// BAD: Tool with no description and magic numbers
const myTool = tool({
  description: '', // Empty description -- model won't know when to use it
  inputSchema: z.object({
    q: z.string(), // No description on the property
  }),
  execute: async ({ q }) => fetch(`/api?q=${q}`),
});

const { text } = await generateText({
  model: 'openai/gpt-4o',
  tools: { myTool },
  stopWhen: stepCountIs(100), // Magic number, too high
  prompt: 'Search for something',
});
```

**Why bad:** Empty tool description, no property descriptions, magic number for step count, unclear parameter names

#### Tool Approval (Human-in-the-Loop)

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const PAYMENT_APPROVAL_THRESHOLD = 1000;

const paymentTool = tool({
  description: 'Process a payment to a recipient',
  inputSchema: z.object({
    amount: z.number().describe('Payment amount in USD'),
    recipient: z.string().describe('Recipient name or ID'),
  }),
  needsApproval: async ({ amount }) => amount > PAYMENT_APPROVAL_THRESHOLD,
  execute: async ({ amount, recipient }) => {
    return await processPayment(amount, recipient);
  },
});
```

---

### Pattern 6: useChat Hook (React)

`useChat` manages streaming chat state in React. In v6, it uses a transport-based architecture and no longer manages input state internally.

```tsx
// chat-page.tsx
'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';

export function ChatPage() {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, stop, error } = useChat();

  const isStreaming = status === 'streaming';
  const isLoading = status === 'submitted';

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    sendMessage({ role: 'user', content: input });
    setInput('');
  }

  return (
    <div>
      <div>
        {messages.map((message) => (
          <div key={message.id}>
            <strong>{message.role}:</strong>
            {message.parts.map((part, i) => {
              if (part.type === 'text') {
                return <span key={i}>{part.text}</span>;
              }
              return null;
            })}
          </div>
        ))}
      </div>

      {error && <div>Error: {error.message}</div>}

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading}
        />
        {isStreaming ? (
          <button type="button" onClick={stop}>Stop</button>
        ) : (
          <button type="submit" disabled={isLoading}>Send</button>
        )}
      </form>
    </div>
  );
}
```

**Why good:** External input state management (v6 pattern), status-based UI states, stop button for streaming, error display, message parts rendering

```tsx
// BAD: v4 patterns that are deprecated
import { useChat } from 'ai/react'; // Wrong import path

function Chat() {
  // BAD: handleSubmit and input are no longer managed by useChat in v6
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat();

  return (
    <form onSubmit={handleSubmit}>
      <input value={input} onChange={handleInputChange} />
    </form>
  );
}
```

**Why bad:** Import path changed to `@ai-sdk/react`, v6 no longer manages input state internally, `isLoading` replaced by `status`

---

### Pattern 7: useCompletion Hook (React)

`useCompletion` handles single-turn text completions (not multi-turn chat). Good for autocomplete, summarization, and one-shot generation.

```tsx
// completion-page.tsx
'use client';

import { useCompletion } from '@ai-sdk/react';

export function CompletionPage() {
  const {
    completion,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
  } = useCompletion({
    api: '/api/completion',
    onFinish(prompt, completion) {
      console.log('Completed:', completion);
    },
    onError(error) {
      console.error('Completion error:', error);
    },
  });

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={handleInputChange}
          placeholder="Enter a prompt..."
          rows={4}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Generating...' : 'Generate'}
        </button>
        {isLoading && (
          <button type="button" onClick={stop}>Stop</button>
        )}
      </form>

      {error && <div>Error: {error.message}</div>}

      {completion && (
        <div>
          <h3>Result:</h3>
          <p>{completion}</p>
        </div>
      )}
    </div>
  );
}
```

**Why good:** Manages input state, streaming completion text, loading/error states, stop support, callbacks for finish/error

</patterns>

---

<decision_framework>

## Decision Framework

### Which Function to Use

```
Do you need AI-generated content?
├─ YES -> Is it user-facing (needs progressive display)?
│   ├─ YES -> Is it a multi-turn conversation?
│   │   ├─ YES -> useChat hook (React) or streamText (server)
│   │   └─ NO -> Is it a single completion/generation?
│   │       ├─ YES -> useCompletion hook (React) or streamText (server)
│   │       └─ NO -> streamText with custom UI
│   └─ NO -> Is it a background task (agent, batch)?
│       ├─ YES -> generateText (blocks until complete)
│       └─ NO -> generateText for simple one-shots
├─ Do you need structured data (JSON/objects)?
│   ├─ YES -> Output.object() with Zod schema
│   │   ├─ Need streaming partial object? -> streamText + partialOutputStream
│   │   ├─ Need array of items? -> Output.array() + elementStream
│   │   └─ Need one of N options? -> Output.choice()
│   └─ NO -> Plain text generation
├─ Do you need the model to call functions?
│   ├─ YES -> Define tools with tool() + Zod inputSchema
│   │   ├─ Multi-step reasoning? -> stopWhen: stepCountIs(N)
│   │   ├─ Need human approval? -> needsApproval on tool
│   │   └─ Single tool call? -> Default (stops after first response)
│   └─ NO -> No tools needed
└─ Do you need vector embeddings?
    ├─ Single text -> embed()
    ├─ Batch of texts -> embedMany()
    └─ Similarity search -> cosineSimilarity()
```

### Which Provider to Choose

```
What is your primary concern?
├─ Best reasoning / complex tasks -> anthropic/claude-sonnet-4.5 or openai/o3
├─ Fast + cheap for simple tasks -> openai/gpt-4o-mini or anthropic/claude-haiku-4.5
├─ Structured output reliability -> openai/gpt-4o (best schema adherence)
├─ Multi-modal (images + text) -> openai/gpt-4o or anthropic/claude-sonnet-4.5
├─ Google ecosystem / grounding -> google/gemini-2.5-flash
└─ Provider agnostic -> Use AI Gateway with model aliases
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **Next.js**: Route handlers for `streamText`, React Server Components, edge runtime compatible
- **React**: `useChat` and `useCompletion` hooks from `@ai-sdk/react`
- **Svelte/Vue/Angular**: Framework-specific hooks from `@ai-sdk/svelte`, `@ai-sdk/vue`, `@ai-sdk/angular`
- **Zod**: Schema validation for structured output (`Output.object()`) and tool input schemas
- **Node.js**: Full support for all core functions (`generateText`, `streamText`, `embed`, etc.)
- **MCP (Model Context Protocol)**: Connect to MCP servers for standardized tool access

**Provider packages:**

- `@ai-sdk/openai` -- OpenAI (GPT-4o, o3, etc.)
- `@ai-sdk/anthropic` -- Anthropic (Claude Sonnet, Opus, Haiku)
- `@ai-sdk/google` -- Google (Gemini models)
- `@ai-sdk/openai-compatible` -- Any OpenAI-compatible API

**Replaces / Conflicts with:**

- Direct `openai` npm package -- AI SDK provides a unified API across providers
- `langchain` -- AI SDK is lighter-weight for TypeScript-specific use cases

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using deprecated `generateObject` / `streamObject` instead of `generateText` + `Output.object()` (removed in v6)
- Using `parameters` instead of `inputSchema` in tool definitions (renamed in v5+)
- Using `generateText` for user-facing chat responses (blocks until complete, no streaming)
- Hardcoding API keys in source code instead of using environment variables
- Using `import { useChat } from 'ai/react'` instead of `import { useChat } from '@ai-sdk/react'`
- Using `CoreMessage` type instead of `ModelMessage` (renamed in v6)

**Medium Priority Issues:**

- Missing `.describe()` on Zod schema properties for structured output (model gets less guidance)
- Not setting `stopWhen` with `stepCountIs()` for multi-step tool calling (risks infinite loops)
- Not handling stream errors with `onError` callback (errors silently disappear)
- Using `system` instead of `instructions` in `ToolLoopAgent` (renamed in v6)

**Common Mistakes:**

- Forgetting that `streamText` does NOT throw errors -- they appear in the stream as error events
- Not consuming the stream from `streamText` -- the function returns immediately, you must iterate the stream
- Using `object` destructure from deprecated `generateObject` instead of `output` from `generateText` with `Output.object()`
- Passing raw strings to `model` parameter without a provider prefix (e.g., `'gpt-4o'` instead of `'openai/gpt-4o'`)

**Gotchas & Edge Cases:**

- `smoothStream()` transform adds slight delay but makes output feel more natural -- always use for chat UIs
- `Output.array()` with `elementStream` yields each element only when fully validated -- partial elements are not emitted
- `embed()` and `embedMany()` require embedding model strings (e.g., `'openai/text-embedding-3-small'`), not chat model strings
- Zod schema support varies by provider -- complex unions and transforms may not work with all models
- `useChat` v6 no longer manages input state -- you must use external `useState` for the input field
- `fullStream` gives you all event types including `tool-call`, `tool-result`, `source`, and `error` -- `textStream` only gives text deltas
- Token usage is available via `usage` property on results, including cache hit details in `usage.inputTokenDetails`

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use the `ai` package (v6) with `Output.object()` / `Output.array()` for structured output -- NOT the deprecated `generateObject` / `streamObject` functions)**

**(You MUST define tool input schemas with `z.object()` and use `.describe()` on each property to help the model understand expected inputs)**

**(You MUST use `streamText` for user-facing responses to enable progressive rendering -- use `generateText` only for background/non-interactive tasks)**

**(You MUST handle streaming errors via `onError` callback -- streamText errors become part of the stream and are NOT thrown)**

**(You MUST use `inputSchema` (not `parameters`) when defining tools -- `parameters` was renamed in SDK v5+)**

**Failure to follow these rules will produce broken AI integrations, deprecated API usage, or poor user experiences with blocked responses.**

</critical_reminders>
