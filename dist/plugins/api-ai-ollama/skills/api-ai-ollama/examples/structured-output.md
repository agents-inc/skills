# Ollama -- Structured Output Examples

> Structured output with JSON schemas via Zod, data extraction, vision extraction. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, chat, streaming
- [tools.md](tools.md) -- Tool/function calling
- [embeddings-vision.md](embeddings-vision.md) -- Embeddings, vision
- [model-management.md](model-management.md) -- Model lifecycle

---

## Basic Structured Output with Zod

```typescript
import ollama from "ollama";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const Country = z.object({
  name: z.string(),
  capital: z.string(),
  languages: z.array(z.string()),
  population: z.number(),
});

type Country = z.infer<typeof Country>;

const response = await ollama.chat({
  model: "llama3.1",
  messages: [
    {
      role: "user",
      content: "Tell me about Japan. Respond in JSON.",
    },
  ],
  format: zodToJsonSchema(Country),
});

// Response content is a JSON string -- parse and validate
const country: Country = Country.parse(JSON.parse(response.message.content));
console.log(`${country.name}: capital is ${country.capital}`);
console.log(`Languages: ${country.languages.join(", ")}`);
```

---

## Data Extraction

```typescript
import ollama from "ollama";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const ArticleSummary = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  sentiment: z.enum(["positive", "negative", "neutral"]),
});

type ArticleSummary = z.infer<typeof ArticleSummary>;

async function extractSummary(articleText: string): Promise<ArticleSummary> {
  const response = await ollama.chat({
    model: "llama3.1",
    messages: [
      {
        role: "system",
        content:
          "Extract a structured summary from the provided text. Respond in JSON.",
      },
      { role: "user", content: articleText },
    ],
    format: zodToJsonSchema(ArticleSummary),
    options: { temperature: 0 }, // Deterministic for extraction
  });

  return ArticleSummary.parse(JSON.parse(response.message.content));
}

const article = `
TypeScript 5.8 introduces improved type inference for conditional types,
better error messages, and performance optimizations. The release focuses
on developer experience.
`;

const summary = await extractSummary(article);
console.log(`Title: ${summary.title}`);
console.log(`Sentiment: ${summary.sentiment}`);
summary.keyPoints.forEach((p) => console.log(`  - ${p}`));
```

---

## Complex Nested Schema

```typescript
import ollama from "ollama";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const Address = z.object({
  street: z.string(),
  city: z.string(),
  country: z.string(),
  postalCode: z.string(),
});

const Person = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email(),
  address: Address,
  skills: z.array(z.string()),
});

type Person = z.infer<typeof Person>;

const response = await ollama.chat({
  model: "llama3.1",
  messages: [
    {
      role: "user",
      content:
        "Generate a fictional software developer profile with full details. Respond in JSON.",
    },
  ],
  format: zodToJsonSchema(Person),
});

const person: Person = Person.parse(JSON.parse(response.message.content));
console.log(`${person.name}, ${person.age}, ${person.address.city}`);
```

---

## Vision-Based Extraction

Use structured output with vision models to extract typed data from images.

```typescript
import ollama from "ollama";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { readFileSync } from "node:fs";

const ImageAnalysis = z.object({
  description: z.string(),
  objects: z.array(z.string()),
  dominantColors: z.array(z.string()),
  mood: z.enum(["happy", "sad", "neutral", "dramatic", "peaceful"]),
});

type ImageAnalysis = z.infer<typeof ImageAnalysis>;

async function analyzeImage(imagePath: string): Promise<ImageAnalysis> {
  const imageBuffer = readFileSync(imagePath);
  const base64Image = imageBuffer.toString("base64");

  const response = await ollama.chat({
    model: "llama3.2-vision",
    messages: [
      {
        role: "user",
        content: "Analyze this image in detail. Respond in JSON.",
        images: [base64Image],
      },
    ],
    format: zodToJsonSchema(ImageAnalysis),
  });

  return ImageAnalysis.parse(JSON.parse(response.message.content));
}

const analysis = await analyzeImage("./photo.jpg");
console.log(`Description: ${analysis.description}`);
console.log(`Objects: ${analysis.objects.join(", ")}`);
console.log(`Mood: ${analysis.mood}`);
```

---

## Anti-Pattern: format: 'json' Without Schema

```typescript
// BAD: Using format: 'json' instead of a JSON schema
const response = await ollama.chat({
  model: "llama3.1",
  messages: [{ role: "user", content: "Tell me about France as JSON" }],
  format: "json",
});

// No schema enforcement -- model can return ANY JSON shape
// Could be { "country": "France" } or { "name": "France", "info": "..." }
const data = JSON.parse(response.message.content);
// data is `any` -- no type safety, no validation
```

**Why bad:** `format: 'json'` only ensures valid JSON syntax, not structure. The model can return any shape. Always use `zodToJsonSchema()` for predictable, type-safe extraction.

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
