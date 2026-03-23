# Claude Vision -- Extraction & Prompting Examples

> Structured data extraction, image comparison, prompting best practices, and caching patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Related examples:**

- [core.md](core.md) -- Base64, URL, file_id, PDF, multi-image input

---

## Structured Receipt Extraction

Extract typed data from receipt images using Zod schemas.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { readFileSync } from "node:fs";

const client = new Anthropic();
const MAX_TOKENS = 1024;

const ReceiptData = z.object({
  merchant: z.string(),
  date: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      price: z.number(),
    }),
  ),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  currency: z.string(),
});

const receiptImage = readFileSync("receipt.jpg").toString("base64");

const response = await client.messages.parse({
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
            media_type: "image/jpeg",
            data: receiptImage,
          },
        },
        {
          type: "text",
          text: "Extract all receipt information from this image. Include every line item with exact prices.",
        },
      ],
    },
  ],
  output_config: { format: zodOutputFormat(ReceiptData) },
});

const receipt = response.parsed_output;
if (receipt) {
  console.log(`${receipt.merchant} - ${receipt.date}`);
  for (const item of receipt.items) {
    console.log(
      `  ${item.name} x${item.quantity}: ${receipt.currency}${item.price}`,
    );
  }
  console.log(`Total: ${receipt.currency}${receipt.total}`);
}
```

---

## Chart Data Extraction

Extract data points from chart images.

```typescript
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const MAX_TOKENS = 2048;

const ChartData = z.object({
  chartType: z.enum(["bar", "line", "pie", "scatter", "area", "other"]),
  title: z.string(),
  xAxisLabel: z.string(),
  yAxisLabel: z.string(),
  dataPoints: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
      unit: z.string().optional(),
    }),
  ),
  trends: z.array(z.string()),
  keyInsight: z.string(),
});

const response = await client.messages.parse({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: chartImage },
        },
        {
          type: "text",
          text: "Extract all data from this chart. Include approximate values for each data point, axis labels, and overall trends.",
        },
      ],
    },
  ],
  output_config: { format: zodOutputFormat(ChartData) },
});
```

---

## Form / Document Field Extraction

Extract specific fields from a form or structured document.

```typescript
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const MAX_TOKENS = 1024;

const FormFields = z.object({
  formTitle: z.string(),
  fields: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      fieldType: z.enum(["text", "checkbox", "date", "signature", "number"]),
      isRequired: z.boolean(),
      isFilled: z.boolean(),
    }),
  ),
  signatures: z.array(
    z.object({
      label: z.string(),
      isSigned: z.boolean(),
    }),
  ),
});

const response = await client.messages.parse({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: formImage },
        },
        {
          type: "text",
          text: "Extract all form fields, their labels, values, and whether they are filled in.",
        },
      ],
    },
  ],
  output_config: { format: zodOutputFormat(FormFields) },
});
```

---

## Image Comparison Pattern

Compare two images with structured output.

```typescript
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const MAX_TOKENS = 2048;

const ComparisonResult = z.object({
  similarities: z.array(z.string()),
  differences: z.array(z.string()),
  image1Strengths: z.array(z.string()),
  image2Strengths: z.array(z.string()),
  recommendation: z.string(),
});

const response = await client.messages.parse({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Design A:" },
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: designA },
        },
        { type: "text", text: "Design B:" },
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: designB },
        },
        {
          type: "text",
          text: "Compare these two UI designs. Evaluate visual hierarchy, readability, and accessibility.",
        },
      ],
    },
  ],
  output_config: { format: zodOutputFormat(ComparisonResult) },
});
```

---

## PDF with Prompt Caching

Cache a PDF for repeated analysis -- subsequent queries about the same document use cached tokens at 0.1x cost.

```typescript
import { readFileSync } from "node:fs";

const MAX_TOKENS = 2048;
const pdfData = readFileSync("annual-report.pdf").toString("base64");

// First query -- caches the PDF
const response1 = await client.messages.create({
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
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: "What are the key financial highlights?" },
      ],
    },
  ],
});

console.log("Cache write tokens:", response1.usage.cache_creation_input_tokens);

// Second query -- reads from cache (0.1x cost for cached tokens)
const response2 = await client.messages.create({
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
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: "What risks are mentioned in the report?" },
      ],
    },
  ],
});

console.log("Cache read tokens:", response2.usage.cache_read_input_tokens);
```

**Note:** Cache lasts 5 minutes by default. Use `ttl: "1h"` for longer caching (2x write cost, same 0.1x read cost).

---

## Screenshot Analysis with Specific Instructions

Focused system prompts produce better results for specialized analysis.

```typescript
const MAX_TOKENS = 2048;

const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  system: [
    "You are a front-end code reviewer analyzing UI screenshots.",
    "For each issue found, provide:",
    "1. The specific element affected",
    "2. The issue category (spacing, alignment, typography, color contrast, responsiveness)",
    "3. A concrete fix suggestion",
    "Focus on issues a developer can act on. Skip subjective aesthetic opinions.",
  ].join("\n"),
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
          text: "Review this dashboard screenshot. List all UI issues that need fixing.",
        },
      ],
    },
  ],
});
```

---

## Multi-Document Extraction

Process multiple documents and combine results.

```typescript
import { readFileSync } from "node:fs";

const MAX_TOKENS = 4096;

const invoice1 = readFileSync("invoice-jan.pdf").toString("base64");
const invoice2 = readFileSync("invoice-feb.pdf").toString("base64");

const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Invoice 1 (January):" },
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: invoice1,
          },
        },
        { type: "text", text: "Invoice 2 (February):" },
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: invoice2,
          },
        },
        {
          type: "text",
          text: "Compare these two invoices. List any changes in pricing, quantities, or line items between months.",
        },
      ],
    },
  ],
});
```

---

_For input format patterns, see [core.md](core.md). For quick lookup tables, see [reference.md](../reference.md)._
