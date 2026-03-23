# Hugging Face Inference -- Setup, Chat & Text Generation Examples

> Client initialization, chat completion, text generation, streaming, providers, endpoints, and error handling. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [tasks.md](tasks.md) -- Embeddings, image generation, audio, translation, summarization

---

## Basic Client Setup

```typescript
// lib/hf-client.ts
import { InferenceClient } from "@huggingface/inference";

// Requires HF_TOKEN environment variable
const client = new InferenceClient(process.env.HF_TOKEN);

export { client };
```

---

## With Specific Provider

```typescript
// lib/hf-client.ts
import { InferenceClient } from "@huggingface/inference";

// HF token routes requests through HF's proxy to the provider
const client = new InferenceClient(process.env.HF_TOKEN);

// Provider specified per-request
const response = await client.chatCompletion({
  model: "Qwen/Qwen3-32B",
  provider: "cerebras", // Route to Cerebras infrastructure
  messages: [{ role: "user", content: "Hello!" }],
});
```

---

## With Dedicated Inference Endpoint

```typescript
// lib/hf-endpoint.ts
import { InferenceClient } from "@huggingface/inference";

// Option 1: endpointUrl in constructor
const ENDPOINT_URL =
  "https://j3z5luu0ooo76jnl.us-east-1.aws.endpoints.huggingface.cloud/v1/";

const client = new InferenceClient(process.env.HF_TOKEN, {
  endpointUrl: ENDPOINT_URL,
});

// Model parameter is ignored -- endpoint serves a specific model
const response = await client.chatCompletion({
  messages: [{ role: "user", content: "What is the capital of France?" }],
});

console.log(response.choices[0].message.content);

export { client };
```

```typescript
// Option 2: .endpoint() helper
import { InferenceClient } from "@huggingface/inference";

const ENDPOINT_URL =
  "https://j3z5luu0ooo76jnl.us-east-1.aws.endpoints.huggingface.cloud/v1/";

const client = new InferenceClient(process.env.HF_TOKEN);
const endpointClient = client.endpoint(ENDPOINT_URL);

const response = await endpointClient.chatCompletion({
  messages: [{ role: "user", content: "Hello!" }],
});
```

---

## With Local Endpoint (Ollama, llama.cpp, vLLM, TGI, LiteLLM)

```typescript
// lib/hf-local.ts
import { InferenceClient } from "@huggingface/inference";

// No token needed for local endpoints
const client = new InferenceClient(undefined, {
  endpointUrl: "http://localhost:8080",
});

const response = await client.chatCompletion({
  messages: [{ role: "user", content: "What is the capital of France?" }],
});

console.log(response.choices[0].message.content);
```

---

## Disable Endpoint Retry-on-Error

```typescript
// By default, calls wait for model to load (scale-to-zero endpoints)
// Disable to handle 503 errors yourself
const response = await client.chatCompletion(
  {
    messages: [{ role: "user", content: "Hello" }],
  },
  {
    retry_on_error: false,
  },
);
```

---

## Chat Completion -- Basic

```typescript
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);
const MAX_TOKENS = 512;
const TEMPERATURE = 0.1;

async function chat(userMessage: string): Promise<string> {
  const response = await client.chatCompletion({
    model: "Qwen/Qwen3-32B",
    provider: "cerebras",
    messages: [
      { role: "system", content: "You are a helpful assistant. Be concise." },
      { role: "user", content: userMessage },
    ],
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No content in response");
  }

  return content;
}

const answer = await chat("What is TypeScript in one sentence?");
console.log(answer);
```

---

## Chat Completion -- Multi-Turn

```typescript
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);
const MAX_TOKENS = 512;

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

const messages: Message[] = [
  { role: "system", content: "You are a TypeScript expert." },
  { role: "user", content: "What is a union type?" },
];

const response = await client.chatCompletion({
  model: "Qwen/Qwen3-32B",
  provider: "cerebras",
  messages,
  max_tokens: MAX_TOKENS,
});

// Append assistant response for next turn
const assistantContent = response.choices[0].message.content ?? "";
messages.push({ role: "assistant", content: assistantContent });
messages.push({ role: "user", content: "Give me a real-world example." });

const followUp = await client.chatCompletion({
  model: "Qwen/Qwen3-32B",
  provider: "cerebras",
  messages,
  max_tokens: MAX_TOKENS,
});
```

---

## Chat Completion -- Streaming

```typescript
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);
const MAX_TOKENS = 512;

async function streamChat(prompt: string): Promise<string> {
  let fullResponse = "";

  for await (const chunk of client.chatCompletionStream({
    model: "Qwen/Qwen3-32B",
    provider: "cerebras",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: prompt },
    ],
    max_tokens: MAX_TOKENS,
  })) {
    if (chunk.choices && chunk.choices.length > 0) {
      const content = chunk.choices[0].delta.content;
      if (content) {
        process.stdout.write(content);
        fullResponse += content;
      }
    }
  }

  console.log(); // newline
  return fullResponse;
}

const result = await streamChat("Explain promises in JavaScript.");
console.log("Response length:", result.length);
```

---

## Text Generation -- Non-Streaming

```typescript
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);
const MAX_NEW_TOKENS = 250;

const result = await client.textGeneration({
  model: "mistralai/Mixtral-8x7B-v0.1",
  provider: "together",
  inputs: "The key benefits of TypeScript are",
  parameters: { max_new_tokens: MAX_NEW_TOKENS },
});

console.log(result.generated_text);
```

---

## Text Generation -- Streaming

```typescript
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);
const MAX_NEW_TOKENS = 250;

for await (const output of client.textGenerationStream({
  model: "mistralai/Mixtral-8x7B-v0.1",
  provider: "together",
  inputs: "The key benefits of TypeScript are",
  parameters: { max_new_tokens: MAX_NEW_TOKENS },
})) {
  if (output.token.text) {
    process.stdout.write(output.token.text);
  }
}
console.log();
```

---

## Tree-Shakeable Imports

```typescript
// Import individual functions for smaller bundles
import { textGeneration, chatCompletion } from "@huggingface/inference";

const MAX_NEW_TOKENS = 250;

// Each function requires accessToken as a parameter
const result = await textGeneration({
  accessToken: process.env.HF_TOKEN,
  model: "mistralai/Mixtral-8x7B-v0.1",
  provider: "together",
  inputs: "The key benefits of TypeScript are",
  parameters: { max_new_tokens: MAX_NEW_TOKENS },
});
```

---

## Third-Party Provider API Key (Direct)

```typescript
import { InferenceClient } from "@huggingface/inference";

// Using a provider's own API key bypasses HF routing -- goes directly to provider
const client = new InferenceClient(process.env.MISTRAL_API_KEY, {
  endpointUrl: "https://api.mistral.ai",
});

const response = await client.chatCompletion({
  model: "mistral-tiny",
  messages: [{ role: "user", content: "Hello!" }],
});
```

---

## Error Handling -- Production Pattern

```typescript
import { InferenceClient } from "@huggingface/inference";
import {
  InferenceClientError,
  InferenceClientInputError,
  InferenceClientProviderApiError,
  InferenceClientProviderOutputError,
  InferenceClientHubApiError,
} from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);
const MAX_TOKENS = 512;

async function safeChat(prompt: string): Promise<string | null> {
  try {
    const response = await client.chatCompletion({
      model: "Qwen/Qwen3-32B",
      provider: "cerebras",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
      max_tokens: MAX_TOKENS,
    });

    return response.choices[0].message.content;
  } catch (error) {
    if (error instanceof InferenceClientProviderApiError) {
      // API-level errors from the inference provider (rate limits, auth, server errors)
      console.error("Provider API error:", error.message);
      console.error("Request details:", error.request);
      console.error("Response details:", error.response);
      return null;
    }

    if (error instanceof InferenceClientHubApiError) {
      // Errors from the HF Hub API (model not found, repo issues)
      console.error("Hub API error:", error.message);
      return null;
    }

    if (error instanceof InferenceClientProviderOutputError) {
      // Provider returned malformed response
      console.error("Malformed provider response:", error.message);
      return null;
    }

    if (error instanceof InferenceClientInputError) {
      // Invalid input parameters
      console.error("Invalid input:", error.message);
      return null;
    }

    // Catch-all for any @huggingface/inference error
    if (error instanceof InferenceClientError) {
      console.error("Inference error:", error.message);
      return null;
    }

    // Unknown errors should be re-thrown
    throw error;
  }
}

const result = await safeChat("Hello!");
if (result) {
  console.log(result);
} else {
  console.error("Failed to get response");
}
```

---

## Error Type Reference

```typescript
// Error class hierarchy:
// InferenceClientError (base)
//   +-- InferenceClientInputError         (invalid input parameters)
//   +-- InferenceClientProviderApiError    (provider API errors: rate limits, auth, 5xx)
//   |     .request  -- Request details (URL, method, headers)
//   |     .response -- Response details (status code, body)
//   +-- InferenceClientHubApiError         (HF Hub API errors: model not found)
//   |     .request  -- Request details
//   |     .response -- Response details
//   +-- InferenceClientProviderOutputError (malformed provider response)
```

---

_For task-specific examples (embeddings, images, audio), see [tasks.md](tasks.md). For API reference tables, see [reference.md](../reference.md)._
