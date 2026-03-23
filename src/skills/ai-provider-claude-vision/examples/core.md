# Claude Vision -- Image & PDF Input Examples

> Base64 images, URL images, Files API, PDF documents, multi-image patterns, and token estimation. See [SKILL.md](../SKILL.md) for core concepts.

**Related examples:**

- [extraction.md](extraction.md) -- Structured extraction, comparison, prompting, caching

---

## Base64 Image Input

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";

const client = new Anthropic();
const MAX_TOKENS = 1024;

const imageData = readFileSync("screenshot.png").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: imageData,
          },
        },
        { type: "text", text: "Describe what you see in this image." },
      ],
    },
  ],
});

for (const block of message.content) {
  if (block.type === "text") {
    console.log(block.text);
  }
}
```

**Supported media types:** `image/jpeg`, `image/png`, `image/gif`, `image/webp`

---

## URL Image Input

```typescript
const MAX_TOKENS = 1024;

const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "url",
            url: "https://example.com/chart.png",
          },
        },
        {
          type: "text",
          text: "Analyze this chart and summarize the key trends.",
        },
      ],
    },
  ],
});
```

**When to use:** Image is already publicly hosted. Avoids base64 encoding and reduces request payload.

---

## Files API Image Input (Beta)

Upload once, reference by `file_id` across multiple requests. Reduces payload size for multi-turn conversations.

```typescript
import Anthropic, { toFile } from "@anthropic-ai/sdk";
import { createReadStream } from "node:fs";

const client = new Anthropic();
const MAX_TOKENS = 1024;

// Upload once
const fileUpload = await client.beta.files.upload({
  file: await toFile(createReadStream("photo.jpg"), undefined, {
    type: "image/jpeg",
  }),
  betas: ["files-api-2025-04-14"],
});

// Use file_id in messages -- no base64 re-encoding per request
const message = await client.beta.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  betas: ["files-api-2025-04-14"],
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "file", file_id: fileUpload.id },
        },
        { type: "text", text: "Describe this image." },
      ],
    },
  ],
});
```

**When to use:** Multi-turn conversations with images (avoids re-sending base64 every turn), or images used across multiple requests.

---

## PDF Document Input (Base64)

```typescript
import { readFileSync } from "node:fs";

const MAX_TOKENS = 4096;
const pdfData = readFileSync("contract.pdf").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: pdfData,
          },
        },
        {
          type: "text",
          text: "Summarize the key terms and obligations in this contract.",
        },
      ],
    },
  ],
});
```

**Key difference from images:** PDFs use `type: "document"`, not `type: "image"`.

---

## PDF Document Input (URL)

```typescript
const MAX_TOKENS = 2048;

const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "document",
          source: {
            type: "url",
            url: "https://example.com/annual-report.pdf",
          },
        },
        { type: "text", text: "What are the key financial highlights?" },
      ],
    },
  ],
});
```

---

## Multiple Images in One Request

Label images to help Claude reference them clearly.

```typescript
import { readFileSync } from "node:fs";

const MAX_TOKENS = 2048;

const designA = readFileSync("design-a.png").toString("base64");
const designB = readFileSync("design-b.png").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Image 1:" },
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: designA },
        },
        { type: "text", text: "Image 2:" },
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: designB },
        },
        {
          type: "text",
          text: "Compare these two UI designs. Which has better visual hierarchy and why?",
        },
      ],
    },
  ],
});
```

---

## Image with System Prompt

```typescript
const MAX_TOKENS = 2048;

const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  system:
    "You are a UI/UX expert. Analyze screenshots for accessibility issues, layout problems, and design improvements. Be specific about WCAG compliance.",
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: screenshotData,
          },
        },
        { type: "text", text: "Review this UI for accessibility issues." },
      ],
    },
  ],
});
```

---

## Multi-Turn Vision Conversation

Images persist in conversation history -- no need to re-send them.

```typescript
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

const MAX_TOKENS = 1024;

const messages: MessageParam[] = [
  {
    role: "user",
    content: [
      {
        type: "image",
        source: { type: "base64", media_type: "image/png", data: chartData },
      },
      { type: "text", text: "What does this chart show?" },
    ],
  },
];

// First turn
const response1 = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages,
});

// Continue conversation -- image persists in history
messages.push({ role: "assistant", content: response1.content });
messages.push({
  role: "user",
  content: "What is the peak value and when does it occur?",
});

const response2 = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages,
});
```

**Note:** You do not need to re-send the image in follow-up messages. It persists in the conversation history. However, if using base64, the full data is re-transmitted with every turn (consider the Files API for multi-turn image conversations).

---

## Token Estimation Utility

```typescript
const TOKENS_PER_PIXEL_DIVISOR = 750;
const MAX_LONG_EDGE_PX = 1568;
const MAX_MEGAPIXELS = 1.15;

function estimateImageTokens(width: number, height: number): number {
  const longEdge = Math.max(width, height);
  const megapixels = (width * height) / 1_000_000;

  let w = width;
  let h = height;

  if (longEdge > MAX_LONG_EDGE_PX || megapixels > MAX_MEGAPIXELS) {
    const scale = Math.min(
      MAX_LONG_EDGE_PX / longEdge,
      Math.sqrt(MAX_MEGAPIXELS / megapixels),
    );
    w = Math.round(width * scale);
    h = Math.round(height * scale);
  }

  return Math.ceil((w * h) / TOKENS_PER_PIXEL_DIVISOR);
}

// Use with countTokens for exact pre-request cost estimation
const tokenCount = await client.messages.countTokens({
  model: "claude-sonnet-4-6",
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: imageData },
        },
        { type: "text", text: "Describe this image." },
      ],
    },
  ],
});

console.log("Exact input tokens:", tokenCount.input_tokens);
```

---

_For structured extraction and prompting patterns, see [extraction.md](extraction.md). For quick lookup tables, see [reference.md](../reference.md)._
