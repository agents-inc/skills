---
name: api-ai-huggingface-inference
description: Hugging Face Inference SDK patterns for TypeScript/Node.js — InferenceClient setup, chat completion, text generation, streaming, embeddings, image generation, audio transcription, translation, summarization, and Inference Endpoints
---

# Hugging Face Inference Patterns

> **Quick Guide:** Use `@huggingface/inference` (v4+) to access 200k+ ML models on the Hugging Face Hub. Use `InferenceClient` with `chatCompletion()` for OpenAI-compatible chat, `textGeneration()` for raw text completion, `chatCompletionStream()` for streaming, `featureExtraction()` for embeddings, `textToImage()` for image generation, and `automaticSpeechRecognition()` for audio transcription. Set `provider` to route through inference providers (Cerebras, Together, Groq, etc.) or use `endpointUrl` for dedicated Inference Endpoints.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST always pass an access token to `InferenceClient` -- never deploy without authentication)**

**(You MUST use `chatCompletion()` / `chatCompletionStream()` for conversational LLM tasks -- these follow the OpenAI-compatible message format)**

**(You MUST handle errors using `InferenceClientError` and its subclasses -- never use bare catch blocks without error type checking)**

**(You MUST specify a `model` parameter for every inference call -- there is no default model)**

**(You MUST never hardcode access tokens -- always use environment variables via `process.env.HF_TOKEN`)**

</critical_requirements>

---

**Auto-detection:** Hugging Face, huggingface, @huggingface/inference, InferenceClient, HfInference, hf.chatCompletion, hf.textGeneration, hf.featureExtraction, hf.textToImage, hf.automaticSpeechRecognition, hf.translation, hf.summarization, hf.textToSpeech, chatCompletionStream, textGenerationStream, HF_TOKEN, inference provider, Inference Endpoints

**When to use:**

- Accessing any of the 200k+ models hosted on the Hugging Face Hub
- Running chat completion with open-source LLMs (Qwen, Mistral, Llama, etc.)
- Generating embeddings with sentence-transformer models for semantic search
- Generating images from text prompts (FLUX, Stable Diffusion)
- Transcribing audio with automatic speech recognition models
- Running translation, summarization, text classification, or NER tasks
- Deploying models on dedicated Inference Endpoints for production use
- Using third-party inference providers (Cerebras, Together, Groq, Replicate, etc.) through a unified API

**Key patterns covered:**

- InferenceClient initialization and configuration
- Chat Completion API (OpenAI-compatible messages format, streaming)
- Text generation (raw completion, streaming)
- Embeddings via feature extraction
- Image generation (text-to-image)
- Audio transcription (automatic speech recognition)
- Translation, summarization, and text classification
- Inference Endpoints (dedicated deployments)
- Inference Providers (routing through third-party services)
- Error handling with typed error classes

**When NOT to use:**

- If you only use OpenAI models -- use the OpenAI SDK directly
- If you need a provider-agnostic unified SDK with structured outputs and tool calling -- use a higher-level AI SDK
- If you need to fine-tune or train models -- use the `@huggingface/hub` package or Python `transformers`

---

## Examples Index

- [Core: Setup, Chat & Text Generation](examples/core.md) -- Client init, chat completion, text generation, streaming, error handling
- [Tasks: Embeddings, Vision, Audio & NLP](examples/tasks.md) -- Feature extraction, image generation, speech recognition, translation, summarization, classification
- [Quick API Reference](reference.md) -- Method signatures, error types, provider list, model recommendations

---

<philosophy>

## Philosophy

The `@huggingface/inference` SDK provides a **unified TypeScript client** for accessing hundreds of thousands of ML models through multiple backends: serverless Inference Providers, dedicated Inference Endpoints, and local servers.

**Core principles:**

1. **Model-agnostic access** -- One client, any model on the Hub. Swap models by changing the `model` parameter without code changes.
2. **Provider flexibility** -- Route inference through 20+ providers (Cerebras, Together, Groq, Replicate, etc.) with a single `provider` parameter, or deploy your own Inference Endpoints.
3. **Task-oriented API** -- Methods map to ML tasks (`chatCompletion`, `textToImage`, `automaticSpeechRecognition`), not raw HTTP endpoints.
4. **OpenAI-compatible chat** -- `chatCompletion()` uses the OpenAI message format (`role` + `content`), making migration between providers easy.
5. **Streaming as async generators** -- `chatCompletionStream()` and `textGenerationStream()` return `AsyncGenerator`, consumed with `for await...of`.

**When to use Hugging Face Inference:**

- You want access to open-source models (Qwen, Mistral, Llama, FLUX, Whisper, etc.)
- You need to run diverse ML tasks (NLP, vision, audio) from one SDK
- You want to switch between inference providers without changing your code
- You need dedicated GPU deployments via Inference Endpoints

**When NOT to use:**

- You only use OpenAI models -- use the OpenAI SDK
- You need structured outputs with Zod schema validation -- use a higher-level AI SDK
- You need complex agent tool-calling loops -- use an agent framework

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Client Setup

Initialize with your Hugging Face access token. The token is required for authenticated access.

```typescript
// lib/hf-client.ts -- basic setup
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);

export { client };
```

```typescript
// lib/hf-client.ts -- with custom endpoint
const ENDPOINT_URL =
  "https://your-endpoint.us-east-1.aws.endpoints.huggingface.cloud/v1/";

const client = new InferenceClient(process.env.HF_TOKEN, {
  endpointUrl: ENDPOINT_URL,
});

export { client };
```

**Why good:** Token from env var, named constant for endpoint URL, named export

```typescript
// BAD: Hardcoded token, no named export
const hf = new InferenceClient("hf_abc123xyz");
export default hf;
```

**Why bad:** Hardcoded token is a security risk, default export violates conventions

**See:** [examples/core.md](examples/core.md) for provider routing, local endpoints, and endpoint helper

---

### Pattern 2: Chat Completion (OpenAI-Compatible)

Use `chatCompletion()` for conversational LLM tasks. Follows the OpenAI message format.

```typescript
const MAX_TOKENS = 512;
const TEMPERATURE = 0.1;

const response = await client.chatCompletion({
  model: "Qwen/Qwen3-32B",
  provider: "cerebras",
  messages: [
    { role: "system", content: "You are a helpful coding assistant." },
    { role: "user", content: "Explain TypeScript generics." },
  ],
  max_tokens: MAX_TOKENS,
  temperature: TEMPERATURE,
});

console.log(response.choices[0].message.content);
```

**Why good:** Named constants for parameters, explicit model and provider, system message for behavior

```typescript
// BAD: No model specified, magic numbers, no system message
const response = await client.chatCompletion({
  messages: [{ role: "user", content: "do something" }],
  max_tokens: 512,
  temperature: 0.1,
});
```

**Why bad:** Missing required `model`, magic numbers, vague prompt, no system instruction

**See:** [examples/core.md](examples/core.md) for multi-turn conversations and provider selection

---

### Pattern 3: Streaming Chat Completion

Use `chatCompletionStream()` for streaming responses. Returns an `AsyncGenerator`.

```typescript
const MAX_TOKENS = 512;
let fullResponse = "";

for await (const chunk of client.chatCompletionStream({
  model: "Qwen/Qwen3-32B",
  provider: "cerebras",
  messages: [{ role: "user", content: "Explain async/await in TypeScript." }],
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
```

**Why good:** Async generator consumed with `for await`, progressive output, null checks on chunk data

```typescript
// BAD: Not checking chunk.choices, ignoring null content
for await (const chunk of client.chatCompletionStream({
  model: "...",
  messages: [],
})) {
  process.stdout.write(chunk.choices[0].delta.content); // May throw on null
}
```

**Why bad:** No null check -- `choices` may be empty, `content` may be null between chunks

**See:** [examples/core.md](examples/core.md) for text generation streaming

---

### Pattern 4: Text Generation (Raw Completion)

Use `textGeneration()` for prompt continuation without the chat message format.

```typescript
const MAX_NEW_TOKENS = 250;

const result = await client.textGeneration({
  model: "mistralai/Mixtral-8x7B-v0.1",
  provider: "together",
  inputs: "The key benefits of TypeScript are",
  parameters: { max_new_tokens: MAX_NEW_TOKENS },
});

console.log(result.generated_text);
```

**Why good:** Named constant, clear prompt, explicit provider, direct access to `generated_text`

**See:** [examples/core.md](examples/core.md) for streaming text generation

---

### Pattern 5: Embeddings (Feature Extraction)

Use `featureExtraction()` for generating vector embeddings for semantic search and RAG.

```typescript
const embeddings = await client.featureExtraction({
  model: "sentence-transformers/all-MiniLM-L6-v2",
  inputs: "That is a happy person",
});
// Returns: number[] (embedding vector)
```

**Why good:** Purpose-built embedding model, simple input/output

**See:** [examples/tasks.md](examples/tasks.md) for batch embeddings and cosine similarity

---

### Pattern 6: Image Generation (Text-to-Image)

Use `textToImage()` to generate images from text prompts. Returns a `Blob`.

```typescript
const imageBlob = await client.textToImage({
  model: "black-forest-labs/FLUX.1-dev",
  inputs: "a serene mountain landscape at sunset",
  provider: "replicate",
});
// imageBlob is a Blob -- write to file or convert to buffer
```

**Why good:** Explicit model and provider, descriptive prompt

**See:** [examples/tasks.md](examples/tasks.md) for saving images, image-to-image, and output formats

---

### Pattern 7: Audio Transcription

Use `automaticSpeechRecognition()` for speech-to-text.

```typescript
import { readFileSync } from "node:fs";

const result = await client.automaticSpeechRecognition({
  model: "facebook/wav2vec2-large-960h-lv60-self",
  data: readFileSync("audio/recording.flac"),
});

console.log(result.text);
```

**Why good:** Uses `data` parameter with file buffer, outputs `.text`

**See:** [examples/tasks.md](examples/tasks.md) for Whisper models, audio classification, and text-to-speech

---

### Pattern 8: Error Handling

Always catch `InferenceClientError` and its subclasses. Re-throw unexpected errors.

```typescript
import {
  InferenceClientError,
  InferenceClientInputError,
  InferenceClientProviderApiError,
  InferenceClientProviderOutputError,
  InferenceClientHubApiError,
} from "@huggingface/inference";

try {
  const result = await client.chatCompletion({
    model: "Qwen/Qwen3-32B",
    messages: [{ role: "user", content: "Hello" }],
  });
} catch (error) {
  if (error instanceof InferenceClientProviderApiError) {
    console.error("Provider API error:", error.message);
    console.error("Request:", error.request);
    console.error("Response:", error.response);
  } else if (error instanceof InferenceClientHubApiError) {
    console.error("Hub API error:", error.message);
  } else if (error instanceof InferenceClientProviderOutputError) {
    console.error("Malformed provider response:", error.message);
  } else if (error instanceof InferenceClientInputError) {
    console.error("Invalid input:", error.message);
  } else if (error instanceof InferenceClientError) {
    console.error("Inference error:", error.message);
  } else {
    throw error; // Re-throw non-inference errors
  }
}
```

**Why good:** Specific error types for each failure mode, request/response details for debugging, re-throws unexpected errors

**See:** [examples/core.md](examples/core.md) for full error handling patterns

</patterns>

---

<decision_framework>

## Decision Framework

### Which Method to Use

```
What is your task?
+-- Conversational LLM (messages) -> chatCompletion() / chatCompletionStream()
+-- Raw text continuation -> textGeneration() / textGenerationStream()
+-- Embeddings for search/RAG -> featureExtraction()
+-- Image from text prompt -> textToImage()
+-- Speech to text -> automaticSpeechRecognition()
+-- Text to speech -> textToSpeech()
+-- Language translation -> translation()
+-- Summarize long text -> summarization()
+-- Classify text -> textClassification()
+-- Named entity recognition -> tokenClassification()
+-- Classify image -> imageClassification()
+-- Detect objects -> objectDetection()
+-- Caption an image -> imageToText()
+-- Answer questions from context -> questionAnswering()
```

### Chat Completion vs Text Generation

```
Do you have a conversation with roles (system/user/assistant)?
+-- YES -> chatCompletion() / chatCompletionStream()
|   Uses OpenAI-compatible message format
|   Supports system messages, multi-turn
+-- NO -> Do you want to continue/complete a text prompt?
    +-- YES -> textGeneration() / textGenerationStream()
    |   Takes raw text input via 'inputs'
    +-- NO -> Use a task-specific method instead
```

### Serverless vs Dedicated

```
What are your deployment needs?
+-- Prototyping / low volume -> Serverless Inference Providers (provider: "auto")
|   Free tier available, shared infrastructure, may have cold starts
+-- Production / high volume -> Inference Endpoints (endpointUrl)
|   Dedicated GPU, autoscaling, scale-to-zero, private infrastructure
+-- Local development -> Local endpoint (endpointUrl: "http://localhost:8080")
    Works with llama.cpp, Ollama, vLLM, TGI, LiteLLM
```

### When to Use This SDK vs Others

```
Do you need access to 200k+ open-source models?
+-- YES -> Use @huggingface/inference
+-- NO -> Do you only use OpenAI models?
    +-- YES -> Not this skill's scope -- use the OpenAI SDK directly
    +-- NO -> Do you need structured outputs / tool calling?
        +-- YES -> Not this skill's scope -- use a higher-level AI SDK
        +-- NO -> @huggingface/inference works for most ML tasks
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Hardcoding access tokens instead of using environment variables (security breach risk)
- Using bare `catch` blocks without checking `InferenceClientError` types (hides API errors, loses debug info)
- Omitting the `model` parameter -- every inference call requires an explicit model
- Not consuming `chatCompletionStream()` / `textGenerationStream()` generators (tokens are silently lost)
- Using `textGeneration()` for conversational tasks instead of `chatCompletion()` (wrong API shape)

**Medium Priority Issues:**

- Not specifying `provider` when a specific provider is needed (default `"auto"` picks based on your HF settings, which may not be optimal)
- Not checking `chunk.choices` length before accessing `chunk.choices[0]` in streaming (may throw on empty chunks)
- Using `request()` / `streamingRequest()` directly -- these are deprecated, use task-specific methods
- Ignoring `max_tokens` / `max_new_tokens` limits (output may be truncated or excessively long)
- Not handling model loading time for serverless inference (cold models return 503, then load)

**Common Mistakes:**

- Confusing `chatCompletion()` parameters with `textGeneration()` parameters -- chat uses `messages` + `max_tokens`, text generation uses `inputs` + `parameters.max_new_tokens`
- Using `inputs` parameter with `chatCompletion()` -- it uses `messages`, not `inputs`
- Using `messages` parameter with `textGeneration()` -- it uses `inputs`, not `messages`
- Forgetting that `textToImage()` returns a `Blob`, not a URL or Buffer
- Treating `featureExtraction()` output as always a flat array -- shape depends on the model (can be nested arrays for batch inputs)
- Not passing `data` (binary) for audio/image tasks, or passing a string path instead of the actual file buffer

**Gotchas & Edge Cases:**

- The `provider: "auto"` default selects providers based on your HF account settings at `hf.co/settings/inference-providers` -- not by availability or speed. Set an explicit provider for predictable routing.
- Serverless models may need time to load (cold start). First requests to a cold model may return 503 errors while the model warms up. The SDK handles retries, but initial requests can be slow.
- When using Inference Endpoints with `endpointUrl`, the model parameter is often ignored because the endpoint serves a specific model.
- `chatCompletion()` is OpenAI-API compatible -- it works with any OpenAI-compatible endpoint, not just Hugging Face.
- `HfInference` is still exported for backward compatibility but `InferenceClient` is the current class name.
- Third-party provider API keys can be passed as the `accessToken` -- when authenticated with a non-HF key, requests go directly to the provider instead of through HF's routing layer.
- Tree-shakeable imports (`import { textGeneration } from "@huggingface/inference"`) require passing `accessToken` as a parameter instead of constructor.
- `textToImage()` supports multiple output types: `blob` (default), `url`, `dataUrl`, or `json` via the options `outputType` parameter.
- Translation requires `parameters.src_lang` and `parameters.tgt_lang` for many-to-many models like `mbart-large-50-many-to-many-mmt`.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST always pass an access token to `InferenceClient` -- never deploy without authentication)**

**(You MUST use `chatCompletion()` / `chatCompletionStream()` for conversational LLM tasks -- these follow the OpenAI-compatible message format)**

**(You MUST handle errors using `InferenceClientError` and its subclasses -- never use bare catch blocks without error type checking)**

**(You MUST specify a `model` parameter for every inference call -- there is no default model)**

**(You MUST never hardcode access tokens -- always use environment variables via `process.env.HF_TOKEN`)**

**Failure to follow these rules will produce insecure, unreliable, or silently failing AI integrations.**

</critical_reminders>
