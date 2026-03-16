# Vercel AI SDK Core Examples

> Provider setup, generateText, streamText, and error handling patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Chat patterns:** See [chat.md](chat.md). **Tool calling:** See [tools.md](tools.md). **Structured output:** See [structured-output.md](structured-output.md). **RAG:** See [rag.md](rag.md).

---

## Pattern 1: Provider Setup

### Good Example -- AI Gateway (Simplest)

```typescript
// lib/ai.ts
import { gateway } from 'ai';
import { generateText } from 'ai';

// AI Gateway: just use provider/model strings
// Requires VERCEL_AI_GATEWAY_API_KEY or provider-specific env vars
const { text } = await generateText({
  model: gateway('openai/gpt-4o'),
  prompt: 'Hello, world!',
});
```

**Why good:** Zero configuration, model string is self-documenting, works with any provider supported by Vercel AI Gateway

### Good Example -- Direct Provider Imports

```typescript
// lib/ai.ts
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

// Each provider auto-reads its env var:
// OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY

const { text } = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Hello!',
});
```

**Why good:** Explicit provider imports, type-safe model selection, env vars auto-detected

### Good Example -- Custom Provider with Proxy

```typescript
// lib/ai.ts
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
});

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

export { openai, anthropic };
```

**Why good:** Custom base URLs for proxies or self-hosted models, env vars for all configuration, named exports

### Good Example -- Model Aliases

```typescript
// lib/models.ts
import { customProvider, gateway } from 'ai';

export const models = customProvider({
  languageModels: {
    fast: gateway('openai/gpt-4o-mini'),
    smart: gateway('anthropic/claude-sonnet-4.5'),
    reasoning: gateway('openai/o3'),
    cheap: gateway('anthropic/claude-haiku-4.5'),
  },
  fallbackProvider: gateway,
});

// Usage anywhere in the app:
// import { models } from '@/lib/models';
// const { text } = await generateText({ model: models('smart'), prompt: '...' });
```

**Why good:** Semantic model names, centralized model configuration, easy to swap underlying models

### Bad Example -- Hardcoded Keys

```typescript
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: 'sk-proj-abc123def456', // NEVER do this
});
```

**Why bad:** API key exposed in source code, will leak to version control, violates security best practices

### Good Example -- OpenAI-Compatible Provider (Ollama, Together AI)

```typescript
// lib/ai.ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const ollama = createOpenAICompatible({
  name: 'ollama',
  baseURL: 'http://localhost:11434/v1',
});

const together = createOpenAICompatible({
  name: 'together',
  apiKey: process.env.TOGETHER_API_KEY,
  baseURL: 'https://api.together.xyz/v1',
});

export { ollama, together };
```

**Why good:** Works with any OpenAI-compatible API, named exports, env vars for sensitive config

---

## Pattern 2: generateText -- Basic Text Generation

### Good Example -- Simple Generation

```typescript
// lib/summarize.ts
import { generateText } from 'ai';

export async function summarizeArticle(article: string): Promise<string> {
  const { text, usage } = await generateText({
    model: 'openai/gpt-4o',
    system: 'You are a professional editor. Write concise, accurate summaries.',
    prompt: `Summarize the following article in 3-5 sentences:\n\n${article}`,
  });

  console.log(`Tokens used: ${usage.totalTokens}`);
  return text;
}
```

**Why good:** System prompt sets persona, clear task in prompt, usage tracking, typed return value

### Good Example -- Multi-Turn Messages

```typescript
// lib/conversation.ts
import { generateText } from 'ai';
import type { ModelMessage } from 'ai';

const messages: ModelMessage[] = [
  { role: 'user', content: 'What is TypeScript?' },
  { role: 'assistant', content: 'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.' },
  { role: 'user', content: 'What are generics in TypeScript?' },
];

const { text, response } = await generateText({
  model: 'anthropic/claude-sonnet-4.5',
  system: 'You are a TypeScript expert. Explain concepts with code examples.',
  messages,
});

// Append response for continued conversation
messages.push(...response.messages);
```

**Why good:** `ModelMessage` type (v6), conversation history preserved, response messages appended for multi-turn

### Bad Example -- No System Prompt, No Error Handling

```typescript
const { text } = await generateText({
  model: 'openai/gpt-4o',
  prompt: 'write something',
});
// No system prompt -- unpredictable output style
// No try/catch -- unhandled errors crash the app
// No usage tracking -- no cost visibility
```

**Why bad:** Missing system prompt, no error handling, no usage tracking, vague prompt

### Good Example -- With onFinish Callback

```typescript
import { generateText } from 'ai';

const { text } = await generateText({
  model: 'openai/gpt-4o',
  system: 'You are a helpful assistant.',
  prompt: 'List 5 TypeScript tips.',
  onFinish({ text, finishReason, usage }) {
    // Log for observability
    console.log(`Finish reason: ${finishReason}`);
    console.log(`Prompt tokens: ${usage.promptTokens}`);
    console.log(`Completion tokens: ${usage.completionTokens}`);
  },
});
```

---

## Pattern 3: streamText -- Streaming Text

### Good Example -- Basic Streaming

```typescript
// lib/stream.ts
import { streamText, smoothStream } from 'ai';

const result = streamText({
  model: 'anthropic/claude-sonnet-4.5',
  system: 'You are a creative writing assistant.',
  prompt: 'Write a short story about a robot learning to paint.',
  experimental_transform: smoothStream(),
  onError({ error }) {
    console.error('Stream error:', error);
  },
  onFinish({ text, usage, finishReason }) {
    console.log(`Finished (${finishReason}), tokens: ${usage.totalTokens}`);
  },
});

// Consume the text stream
for await (const textPart of result.textStream) {
  process.stdout.write(textPart);
}
```

**Why good:** `smoothStream()` for natural output, `onError` for stream error handling, `onFinish` for logging, async iteration

### Good Example -- Full Stream with Event Types

```typescript
import { streamText } from 'ai';

const result = streamText({
  model: 'openai/gpt-4o',
  prompt: 'Explain quantum computing.',
  onError({ error }) {
    console.error('Stream error:', error);
  },
});

for await (const part of result.fullStream) {
  switch (part.type) {
    case 'text-delta':
      process.stdout.write(part.textDelta);
      break;
    case 'tool-call':
      console.log(`Tool call: ${part.toolName}(${JSON.stringify(part.args)})`);
      break;
    case 'tool-result':
      console.log(`Tool result: ${JSON.stringify(part.result)}`);
      break;
    case 'source':
      if (part.sourceType === 'url') {
        console.log(`Source: ${part.url}`);
      }
      break;
    case 'error':
      console.error('Stream error:', part.error);
      break;
    case 'finish':
      console.log(`Done: ${part.finishReason}`);
      break;
  }
}
```

**Why good:** `fullStream` gives granular control over all event types, typed switch cases, handles tool calls and sources inline

### Good Example -- Next.js Route Handler

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';

export async function POST(request: Request) {
  const { messages } = await request.json();

  const result = streamText({
    model: 'openai/gpt-4o',
    system: 'You are a helpful assistant.',
    messages,
    onError({ error }) {
      console.error('Chat stream error:', error);
    },
  });

  return result.toTextStreamResponse();
}
```

**Why good:** `toTextStreamResponse()` creates proper streaming Response, error logging, system prompt

### Bad Example -- Not Consuming the Stream

```typescript
import { streamText } from 'ai';

function startStream() {
  // BAD: streamText returns immediately -- you MUST consume the stream
  const result = streamText({
    model: 'openai/gpt-4o',
    prompt: 'Tell me a story.',
  });

  // result.textStream is never consumed!
  // The stream runs but nothing happens
  console.log('Done!'); // Prints immediately, before any tokens arrive
}
```

**Why bad:** `streamText` returns immediately, stream must be consumed via `textStream`, `fullStream`, or `toTextStreamResponse()`

---

## Pattern 4: Error Handling

### Good Example -- generateText Error Handling

```typescript
import { generateText, NoObjectGeneratedError } from 'ai';

try {
  const { text } = await generateText({
    model: 'openai/gpt-4o',
    prompt: 'Generate a summary.',
  });
  return text;
} catch (error) {
  if (NoObjectGeneratedError.isInstance(error)) {
    console.error('Model failed to generate valid output:', error.cause);
    console.error('Raw text:', error.text);
    return null;
  }
  throw error; // Re-throw unexpected errors
}
```

**Why good:** SDK-specific error types with `.isInstance()`, access to error cause and raw text, re-throws unexpected errors

### Good Example -- streamText Error Handling

```typescript
import { streamText } from 'ai';

const result = streamText({
  model: 'openai/gpt-4o',
  prompt: 'Hello',
  onError({ error }) {
    // CRITICAL: This is the only way to catch stream errors
    // streamText does NOT throw -- errors go into the stream
    console.error('Stream error:', error);
  },
  onFinish({ finishReason }) {
    if (finishReason === 'length') {
      console.warn('Output was truncated due to token limit');
    }
  },
});

// Also check for errors in fullStream
for await (const part of result.fullStream) {
  if (part.type === 'error') {
    console.error('Error in stream:', part.error);
  }
}
```

**Why good:** `onError` callback catches stream errors, `finishReason` check for truncation, dual error handling with fullStream

### Bad Example -- Ignoring Stream Errors

```typescript
const result = streamText({
  model: 'openai/gpt-4o',
  prompt: 'Hello',
  // No onError callback!
});

// Errors silently appear in the stream and are lost
for await (const text of result.textStream) {
  process.stdout.write(text);
}
```

**Why bad:** `streamText` does NOT throw errors, without `onError` or `fullStream` error checking, failures are silent

### Good Example -- Tool Error Handling

```typescript
import { generateText, NoSuchToolError, InvalidToolInputError } from 'ai';

try {
  const { text, steps } = await generateText({
    model: 'openai/gpt-4o',
    tools: { /* ... */ },
    prompt: 'Use the tools to help me.',
  });

  // Check for tool-level errors in steps
  const toolErrors = steps.flatMap((step) =>
    step.content.filter((part) => part.type === 'tool-error'),
  );

  if (toolErrors.length > 0) {
    console.error('Tool execution errors:', toolErrors);
  }

  return text;
} catch (error) {
  if (NoSuchToolError.isInstance(error)) {
    console.error('Model tried to call unknown tool:', error);
  } else if (InvalidToolInputError.isInstance(error)) {
    console.error('Model provided invalid tool input:', error);
  }
  throw error;
}
```

**Why good:** Catches SDK-specific error types, checks step-level tool errors, comprehensive error coverage

---

_For chat UI patterns, see [chat.md](chat.md). For tool calling, see [tools.md](tools.md). For structured output, see [structured-output.md](structured-output.md). For RAG, see [rag.md](rag.md)._
