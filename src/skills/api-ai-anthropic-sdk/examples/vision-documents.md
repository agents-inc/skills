# Anthropic SDK -- Vision & Document Examples

> Image input (base64, URL), PDF/document processing, and multi-modal patterns. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [streaming.md](streaming.md) -- Streaming responses
- [tool-use.md](tool-use.md) -- Tool/function calling
- [extended-thinking.md](extended-thinking.md) -- Extended thinking

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
        {
          type: "text",
          text: "Describe what you see in this image.",
        },
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

---

## Multiple Images in One Request

```typescript
import { readFileSync } from "node:fs";

const MAX_TOKENS = 2048;

const image1 = readFileSync("before.jpg").toString("base64");
const image2 = readFileSync("after.jpg").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: image1 },
        },
        {
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: image2 },
        },
        {
          type: "text",
          text: "Compare these two images and describe the differences.",
        },
      ],
    },
  ],
});
```

---

## PDF / Document Input

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

---

## Image with System Prompt

```typescript
const MAX_TOKENS = 2048;

const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  system:
    "You are a UI/UX expert. Analyze screenshots for accessibility issues, layout problems, and design improvements.",
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
        {
          type: "text",
          text: "Review this UI design for accessibility issues.",
        },
      ],
    },
  ],
});
```

---

## Multi-Turn Vision Conversation

```typescript
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

const MAX_TOKENS = 1024;

const messages: MessageParam[] = [
  {
    role: "user",
    content: [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: chartData,
        },
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

// Continue conversation about the same image
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

**Note:** You do not need to re-send the image in follow-up messages. It persists in the conversation history.

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
