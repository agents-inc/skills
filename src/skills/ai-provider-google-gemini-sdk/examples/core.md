# Google Gemini SDK -- Setup & Configuration Examples

> Client initialization, environment config, system instructions, error handling, and token counting. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [multimodal.md](multimodal.md) -- Multimodal input (images, video, audio, PDF)
- [streaming.md](streaming.md) -- Streaming responses
- [tools.md](tools.md) -- Function calling / tool use
- [structured-output.md](structured-output.md) -- Structured JSON output
- [chat.md](chat.md) -- Multi-turn chat sessions
- [advanced.md](advanced.md) -- Embeddings, caching, safety settings

---

## Basic Client Setup

```typescript
// lib/gemini.ts
import { GoogleGenAI } from "@google/genai";

// Explicit API key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export { ai };
```

---

## Auto-Configured Client (Environment Variables)

```typescript
// Reads GOOGLE_API_KEY from environment automatically
const ai = new GoogleGenAI({});
```

Set the environment variable:

```bash
export GOOGLE_API_KEY="your-api-key"
```

---

## Vertex AI Configuration

```typescript
// lib/gemini-vertex.ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
});

export { ai };
```

Or auto-configure via environment:

```bash
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT="your-project-id"
export GOOGLE_CLOUD_LOCATION="us-central1"
```

```typescript
const ai = new GoogleGenAI({});
```

---

## Basic Text Generation

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Explain how async/await works in TypeScript.",
});

console.log(response.text);
```

---

## System Instructions

```typescript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "What are the benefits of immutability?",
  config: {
    systemInstruction:
      "You are a senior TypeScript developer. Give concise, practical answers with code examples.",
  },
});

console.log(response.text);
```

---

## Generation Parameters

```typescript
const MAX_OUTPUT_TOKENS = 2048;

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Write a haiku about TypeScript.",
  config: {
    temperature: 0.9, // Higher = more creative
    topP: 0.95, // Nucleus sampling
    topK: 40, // Top-k sampling
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    stopSequences: ["---"], // Stop generation at these strings
  },
});
```

---

## Thinking Configuration

```typescript
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Solve this step by step: What is 15% of 340?",
  config: {
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.HIGH,
      includeThoughts: true,
    },
  },
});

console.log(response.text);
```

---

## Error Handling

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function safeGenerate(prompt: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    // Check if content was blocked by safety filters
    const candidate = response.candidates?.[0];
    if (!candidate) {
      console.warn("No candidates returned -- content may have been blocked");
      return null;
    }

    if (candidate.finishReason === "SAFETY") {
      console.warn("Response blocked by safety filters");
      console.warn("Safety ratings:", JSON.stringify(candidate.safetyRatings));
      return null;
    }

    if (candidate.finishReason === "MAX_TOKENS") {
      console.warn("Response was truncated");
    }

    if (candidate.finishReason === "RECITATION") {
      console.warn("Response blocked due to recitation (copyright) concerns");
      return null;
    }

    return response.text;
  } catch (error) {
    if (error instanceof Error) {
      // HTTP-level errors from the API
      if (error.message.includes("400")) {
        console.error("Bad request -- check model name and parameters");
      } else if (
        error.message.includes("401") ||
        error.message.includes("403")
      ) {
        console.error("Authentication failed -- check API key");
      } else if (error.message.includes("429")) {
        console.error("Rate limited -- back off and retry");
      } else if (
        error.message.includes("500") ||
        error.message.includes("503")
      ) {
        console.error("Server error -- retry with exponential backoff");
      } else {
        console.error("Unexpected error:", error.message);
      }
    }
    return null;
  }
}

const result = await safeGenerate("Hello!");
if (result) {
  console.log(result);
}
```

---

## Token Counting

```typescript
const tokenResponse = await ai.models.countTokens({
  model: "gemini-2.5-flash",
  contents: "The quick brown fox jumps over the lazy dog.",
});

console.log(`Total tokens: ${tokenResponse.totalTokens}`);
```

---

## Usage Metadata (Cost Tracking)

```typescript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Explain TypeScript generics.",
});

console.log("Prompt tokens:", response.usageMetadata?.promptTokenCount);
console.log("Response tokens:", response.usageMetadata?.candidatesTokenCount);
console.log("Total tokens:", response.usageMetadata?.totalTokenCount);
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
