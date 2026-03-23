# Hugging Face Inference Quick Reference

> Method signatures, error types, provider list, and model recommendations. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Package Installation

```bash
npm install @huggingface/inference
```

---

## Client Initialization

```typescript
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(accessToken, {
  endpointUrl?: string,  // Custom endpoint URL (Inference Endpoints or local)
});
```

### Environment Variables

| Variable   | Purpose                              |
| ---------- | ------------------------------------ |
| `HF_TOKEN` | Hugging Face access token (required) |

---

## API Methods Reference

### NLP -- Chat & Text Generation

```typescript
// Chat Completion (OpenAI-compatible)
const response = await client.chatCompletion({
  model: string,            // Required: model ID on the Hub
  messages: Message[],      // Required: { role, content }[]
  max_tokens?: number,      // Max output tokens
  temperature?: number,     // 0-2 (default: 1)
  top_p?: number,           // Nucleus sampling
  provider?: string,        // Inference provider (default: "auto")
});
// Returns: { choices: [{ message: { role, content } }] }

// Chat Completion Streaming
const stream = client.chatCompletionStream({
  model: string,
  messages: Message[],
  max_tokens?: number,
  temperature?: number,
  provider?: string,
});
// Returns: AsyncGenerator<{ choices: [{ delta: { content } }] }>

// Text Generation
const result = await client.textGeneration({
  model: string,             // Required
  inputs: string,            // Required: prompt text
  parameters?: {
    max_new_tokens?: number, // Max tokens to generate
    temperature?: number,
    top_p?: number,
    repetition_penalty?: number,
  },
  provider?: string,
});
// Returns: { generated_text: string }

// Text Generation Streaming
const stream = client.textGenerationStream({
  model: string,
  inputs: string,
  parameters?: { ... },
  provider?: string,
});
// Returns: AsyncGenerator<{ token: { text, id, logprob }, generated_text?: string }>
```

### NLP -- Analysis Tasks

```typescript
// Feature Extraction (Embeddings)
await client.featureExtraction({
  model: string,    // Required
  inputs: string,   // Required: text to embed
});
// Returns: number[] | number[][]

// Summarization
await client.summarization({
  model: string,
  inputs: string,
  parameters?: { max_length?: number, min_length?: number },
});
// Returns: { summary_text: string }

// Translation
await client.translation({
  model: string,
  inputs: string,
  parameters?: { src_lang?: string, tgt_lang?: string },
});
// Returns: { translation_text: string }

// Text Classification
await client.textClassification({
  model: string,
  inputs: string,
});
// Returns: Array<{ label: string, score: number }>

// Token Classification (NER)
await client.tokenClassification({
  model: string,
  inputs: string,
});
// Returns: Array<{ entity_group: string, word: string, score: number, start: number, end: number }>

// Zero-Shot Classification
await client.zeroShotClassification({
  model: string,
  inputs: string[],
  parameters: { candidate_labels: string[] },
});

// Question Answering
await client.questionAnswering({
  model: string,
  inputs: { question: string, context: string },
});
// Returns: { answer: string, score: number, start: number, end: number }

// Fill Mask
await client.fillMask({
  model: string,
  inputs: string,   // Must contain [MASK] token
});

// Sentence Similarity
await client.sentenceSimilarity({
  model: string,
  inputs: { source_sentence: string, sentences: string[] },
});
// Returns: number[]
```

### Audio

```typescript
// Automatic Speech Recognition
await client.automaticSpeechRecognition({
  model: string,
  data: Blob | ArrayBuffer, // Audio file data
});
// Returns: { text: string }

// Audio Classification
await client.audioClassification({
  model: string,
  data: Blob | ArrayBuffer,
});
// Returns: Array<{ label: string, score: number }>

// Text to Speech
await client.textToSpeech({
  model: string,
  inputs: string,
});
// Returns: Blob (audio)

// Audio to Audio
await client.audioToAudio({
  model: string,
  data: Blob | ArrayBuffer,
});
// Returns: Array<{ blob: Blob, label: string, "content-type": string }>
```

### Computer Vision

```typescript
// Text to Image
await client.textToImage({
  model: string,
  inputs: string,        // Text prompt
  provider?: string,
}, {
  outputType?: "blob" | "url" | "dataUrl" | "json",  // Default: "blob"
});
// Returns: Blob | string (depends on outputType)

// Image Classification
await client.imageClassification({
  model: string,
  data: Blob | ArrayBuffer,
});
// Returns: Array<{ label: string, score: number }>

// Object Detection
await client.objectDetection({
  model: string,
  data: Blob | ArrayBuffer,
});
// Returns: Array<{ label: string, score: number, box: { xmin, ymin, xmax, ymax } }>

// Image to Text (Captioning)
await client.imageToText({
  model: string,
  data: Blob | ArrayBuffer,
});
// Returns: { generated_text: string }

// Image Segmentation
await client.imageSegmentation({
  model: string,
  data: Blob | ArrayBuffer,
});
// Returns: Array<{ label: string, score: number, mask: string }>

// Image to Image
await client.imageToImage({
  inputs: Blob,
  parameters?: { prompt?: string },
  model: string,
});
// Returns: Blob

// Zero-Shot Image Classification
await client.zeroShotImageClassification({
  model: string,
  inputs: { image: Blob },
  parameters: { candidate_labels: string[] },
});
```

### Multimodal

```typescript
// Visual Question Answering
await client.visualQuestionAnswering({
  model: string,
  inputs: { question: string, image: Blob },
});
// Returns: { answer: string, score: number }

// Document Question Answering
await client.documentQuestionAnswering({
  model: string,
  inputs: { question: string, image: Blob },
});
```

---

## Recommended Models by Task

| Task                       | Model                                              | Notes                    |
| -------------------------- | -------------------------------------------------- | ------------------------ |
| Chat Completion            | `Qwen/Qwen3-32B`                                   | Strong open-source LLM   |
| Chat Completion            | `mistralai/Mixtral-8x7B-v0.1`                      | Mixture of experts       |
| Text Generation            | `mistralai/Mixtral-8x7B-v0.1`                      | Text continuation        |
| Embeddings                 | `sentence-transformers/all-MiniLM-L6-v2`           | Fast, good quality       |
| Multilingual Embeddings    | `intfloat/multilingual-e5-large`                   | Cross-lingual            |
| Text-to-Image              | `black-forest-labs/FLUX.1-dev`                     | High quality image gen   |
| Image Classification       | `google/vit-base-patch16-224`                      | General purpose          |
| Object Detection           | `facebook/detr-resnet-50`                          | General purpose          |
| Speech Recognition         | `facebook/wav2vec2-large-960h-lv60-self`           | English                  |
| Audio Classification       | `superb/hubert-large-superb-er`                    | Emotion recognition      |
| Text-to-Speech             | `espnet/kan-bayashi_ljspeech_vits`                 | English TTS              |
| Translation                | `t5-base`                                          | English focused          |
| Translation (multilingual) | `facebook/mbart-large-50-many-to-many-mmt`         | 50 languages             |
| Summarization              | `facebook/bart-large-cnn`                          | News summarization       |
| Sentiment Analysis         | `distilbert-base-uncased-finetuned-sst-2-english`  | Binary sentiment         |
| NER                        | `dbmdz/bert-large-cased-finetuned-conll03-english` | Named entities           |
| Zero-Shot Classification   | `facebook/bart-large-mnli`                         | No training needed       |
| Question Answering         | `deepset/roberta-base-squad2`                      | Extractive QA            |
| Image Captioning           | `nlpconnect/vit-gpt2-image-captioning`             | General captioning       |
| Fill Mask                  | `bert-base-uncased`                                | Masked language modeling |
| Zero-Shot Image Class.     | `openai/clip-vit-large-patch14-336`                | No training needed       |

---

## Error Types

| Error Class                          | Cause                                        | Has `.request` / `.response`? |
| ------------------------------------ | -------------------------------------------- | ----------------------------- |
| `InferenceClientError`               | Base class for all errors                    | No                            |
| `InferenceClientInputError`          | Invalid input parameters                     | No                            |
| `InferenceClientProviderApiError`    | Provider API errors (rate limits, auth, 5xx) | Yes                           |
| `InferenceClientHubApiError`         | HF Hub API errors (model not found)          | Yes                           |
| `InferenceClientProviderOutputError` | Malformed provider response                  | No                            |

All errors extend the base `Error` class via `InferenceClientError`.

---

## Supported Inference Providers

| Provider        | Key Tasks Supported              |
| --------------- | -------------------------------- |
| Baseten         | Chat, text generation            |
| Blackforestlabs | Image generation                 |
| Cerebras        | Chat completion, text generation |
| Clarifai        | Chat, text, image generation     |
| Cohere          | Chat, text, embeddings           |
| DeepInfra       | Chat, text, embeddings           |
| Fal.ai          | Image, video generation          |
| Featherless AI  | Chat, text generation            |
| Fireworks AI    | Chat, text generation            |
| Groq            | Chat completion (fast inference) |
| HF Inference    | All tasks (Hugging Face's own)   |
| Hyperbolic      | Chat, text generation            |
| Nebius          | Chat, text generation            |
| Novita          | Chat, image generation           |
| Nscale          | Chat, text generation            |
| NVIDIA          | Chat, text, embeddings           |
| OVHcloud        | Chat, text generation            |
| Public AI       | Chat, text generation            |
| Replicate       | Image generation, audio          |
| Sambanova       | Chat, text generation            |
| Scaleway        | Chat, text generation            |
| Together        | Chat, text, image generation     |
| Wavespeed.ai    | Image, video generation          |
| Z.ai            | Chat, text generation            |

Set `provider: "auto"` (default) to use your account's preferred provider order.

---

## Tree-Shakeable Import Pattern

```typescript
// Instead of InferenceClient class, import individual functions
import {
  chatCompletion,
  textGeneration,
  featureExtraction,
} from "@huggingface/inference";

// Each function requires accessToken as a parameter
await chatCompletion({
  accessToken: process.env.HF_TOKEN,
  model: "Qwen/Qwen3-32B",
  provider: "cerebras",
  messages: [{ role: "user", content: "Hello" }],
});
```

---

## Endpoint Configuration Patterns

```typescript
// Serverless (default) -- through HF Hub routing
const client = new InferenceClient(process.env.HF_TOKEN);

// Dedicated Inference Endpoint
const client = new InferenceClient(process.env.HF_TOKEN, {
  endpointUrl: "https://your-endpoint.aws.endpoints.huggingface.cloud/v1/",
});

// Local endpoint (llama.cpp, Ollama, vLLM, TGI, LiteLLM)
const client = new InferenceClient(undefined, {
  endpointUrl: "http://localhost:8080",
});

// Third-party provider direct (skip HF routing)
const client = new InferenceClient(process.env.MISTRAL_API_KEY, {
  endpointUrl: "https://api.mistral.ai",
});

// Using .endpoint() helper
const endpointClient = client.endpoint("https://your-endpoint.cloud/v1/");
```
