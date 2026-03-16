# Vercel AI SDK Structured Output Examples

> generateObject patterns with Zod schemas, streamObject, enum/union schemas, and error handling. See [SKILL.md](../SKILL.md) for core concepts.

**Core patterns:** See [core.md](core.md). **Tool calling:** See [tools.md](tools.md).

---

## Pattern 1: Basic Object Generation

### Good Example -- Recipe with Zod Schema

```typescript
// lib/recipe-generator.ts
import { generateText, Output } from 'ai';
import { z } from 'zod';

const recipeSchema = z.object({
  name: z.string().describe('The recipe name'),
  servings: z.number().int().positive().describe('Number of servings'),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('Difficulty level'),
  prepTimeMinutes: z.number().int().positive().describe('Preparation time in minutes'),
  cookTimeMinutes: z.number().int().positive().describe('Cooking time in minutes'),
  ingredients: z.array(
    z.object({
      name: z.string().describe('Ingredient name'),
      amount: z.string().describe('Amount with unit, e.g. "200g" or "2 cups"'),
      optional: z.boolean().default(false).describe('Whether this ingredient is optional'),
    }),
  ).describe('List of ingredients'),
  steps: z.array(z.string()).describe('Step-by-step cooking instructions'),
  tags: z.array(z.string()).describe('Recipe tags like "vegetarian", "quick", "gluten-free"'),
});

type Recipe = z.infer<typeof recipeSchema>;

export async function generateRecipe(prompt: string): Promise<Recipe> {
  const { output } = await generateText({
    model: 'openai/gpt-4o',
    output: Output.object({
      schema: recipeSchema,
      name: 'Recipe',
      description: 'A detailed recipe with ingredients and instructions.',
    }),
    prompt,
  });

  return output;
}

// Usage
const recipe = await generateRecipe('A quick vegetarian pasta for 2 people');
console.log(`${recipe.name} (${recipe.difficulty})`);
console.log(`Prep: ${recipe.prepTimeMinutes}min, Cook: ${recipe.cookTimeMinutes}min`);
recipe.ingredients.forEach((i) => console.log(`  - ${i.amount} ${i.name}`));
```

**Why good:** Comprehensive schema with `.describe()` on every property, named type with `z.infer`, `name` and `description` on `Output.object()` for model guidance, typed return value

### Bad Example -- Missing Descriptions

```typescript
// BAD
import { generateText, Output } from 'ai';
import { z } from 'zod';

const schema = z.object({
  n: z.string(),        // What is "n"?
  items: z.array(z.string()), // Items of what?
  v: z.number(),        // What value?
});

const { output } = await generateText({
  model: 'openai/gpt-4o',
  output: Output.object({ schema }),
  prompt: 'Generate something.',
});
```

**Why bad:** No `.describe()` on properties, cryptic names, vague prompt, model has to guess what each field means

---

## Pattern 2: Streaming Partial Objects

### Good Example -- Progressive UI Update

```typescript
// lib/stream-recipe.ts
import { streamText, Output } from 'ai';
import { z } from 'zod';

const articleSchema = z.object({
  title: z.string().describe('Article title'),
  summary: z.string().describe('One paragraph summary'),
  sections: z.array(
    z.object({
      heading: z.string().describe('Section heading'),
      content: z.string().describe('Section content'),
    }),
  ).describe('Article sections'),
  metadata: z.object({
    readTimeMinutes: z.number().describe('Estimated reading time'),
    category: z.string().describe('Article category'),
    tags: z.array(z.string()).describe('Relevant tags'),
  }).describe('Article metadata'),
});

export async function streamArticle(topic: string) {
  const { partialOutputStream } = streamText({
    model: 'anthropic/claude-sonnet-4.5',
    output: Output.object({ schema: articleSchema }),
    prompt: `Write a comprehensive article about: ${topic}`,
    onError({ error }) {
      console.error('Stream error:', error);
    },
  });

  // Partial objects have optional fields that fill in progressively
  for await (const partial of partialOutputStream) {
    console.clear();

    if (partial.title) {
      console.log(`Title: ${partial.title}`);
    }
    if (partial.summary) {
      console.log(`Summary: ${partial.summary}`);
    }
    if (partial.sections) {
      console.log(`Sections: ${partial.sections.length}`);
      for (const section of partial.sections) {
        if (section.heading) {
          console.log(`  ## ${section.heading}`);
        }
      }
    }
  }
}
```

**Why good:** `partialOutputStream` yields objects as they build up, progressive rendering, error handling with `onError`, nested schema with descriptions

---

## Pattern 3: Array Output with Element Streaming

### Good Example -- Generating a List of Items

```typescript
// lib/generate-heroes.ts
import { streamText, Output } from 'ai';
import { z } from 'zod';

const heroSchema = z.object({
  name: z.string().describe('Hero character name'),
  class: z.string().describe('Character class like Warrior, Mage, Rogue'),
  level: z.number().int().min(1).max(100).describe('Character level 1-100'),
  abilities: z.array(z.string()).describe('List of special abilities'),
  backstory: z.string().describe('Brief character backstory (2-3 sentences)'),
});

type Hero = z.infer<typeof heroSchema>;

const TARGET_HERO_COUNT = 5;

export async function generateHeroes(): Promise<Hero[]> {
  const heroes: Hero[] = [];

  const { elementStream } = streamText({
    model: 'openai/gpt-4o',
    output: Output.array({ element: heroSchema }),
    prompt: `Generate ${TARGET_HERO_COUNT} unique hero characters for a fantasy RPG.`,
    onError({ error }) {
      console.error('Generation error:', error);
    },
  });

  for await (const hero of elementStream) {
    // Each hero is complete and validated before being yielded
    heroes.push(hero);
    console.log(`Generated: ${hero.name} (${hero.class} Lv.${hero.level})`);
  }

  return heroes;
}
```

**Why good:** `Output.array()` with element schema, `elementStream` yields complete validated items, named constant for count, typed return array

### Good Example -- Non-Streaming Array

```typescript
import { generateText, Output } from 'ai';
import { z } from 'zod';

const citySchema = z.object({
  name: z.string().describe('City name'),
  country: z.string().describe('Country name'),
  population: z.number().describe('Approximate population'),
  knownFor: z.string().describe('What the city is famous for'),
});

const TARGET_CITY_COUNT = 10;

const { output } = await generateText({
  model: 'openai/gpt-4o',
  output: Output.array({ element: citySchema }),
  prompt: `List the ${TARGET_CITY_COUNT} most visited cities in the world.`,
});

// output is City[] -- fully typed
output.forEach((city) => {
  console.log(`${city.name}, ${city.country}: ${city.knownFor}`);
});
```

**Why good:** `Output.array()` for non-streaming batch generation, typed output array, named constant

---

## Pattern 4: Choice / Enum Output

### Good Example -- Classification

```typescript
// lib/classify.ts
import { generateText, Output } from 'ai';

const SENTIMENT_OPTIONS = ['positive', 'negative', 'neutral', 'mixed'] as const;

export async function classifySentiment(text: string) {
  const { output } = await generateText({
    model: 'openai/gpt-4o-mini',
    output: Output.choice({
      options: [...SENTIMENT_OPTIONS],
    }),
    prompt: `Classify the sentiment of the following text:\n\n"${text}"`,
  });

  return output; // Type: 'positive' | 'negative' | 'neutral' | 'mixed'
}

// Usage
const sentiment = await classifySentiment('I love this product! Best purchase ever.');
console.log(`Sentiment: ${sentiment}`); // "positive"
```

**Why good:** Named constant for options, `Output.choice()` constrains output to valid values, typed return, simple efficient pattern for classification

---

## Pattern 5: Nested and Complex Schemas

### Good Example -- E-Commerce Product Schema

```typescript
// lib/product-generator.ts
import { generateText, Output } from 'ai';
import { z } from 'zod';

const priceSchema = z.object({
  amount: z.number().positive().describe('Price amount in dollars'),
  currency: z.literal('USD').describe('Currency code'),
  discountPercent: z.number().min(0).max(100).optional().describe('Discount percentage if on sale'),
});

const dimensionsSchema = z.object({
  width: z.number().positive().describe('Width in centimeters'),
  height: z.number().positive().describe('Height in centimeters'),
  depth: z.number().positive().describe('Depth in centimeters'),
  weightGrams: z.number().positive().describe('Weight in grams'),
});

const productSchema = z.object({
  name: z.string().describe('Product name'),
  description: z.string().describe('Marketing description (2-3 sentences)'),
  sku: z.string().describe('Stock keeping unit, e.g. "PROD-001"'),
  category: z.enum(['electronics', 'clothing', 'home', 'sports', 'books'])
    .describe('Product category'),
  price: priceSchema.describe('Pricing information'),
  dimensions: dimensionsSchema.optional().describe('Physical dimensions if applicable'),
  features: z.array(z.string()).min(3).max(8).describe('Key product features'),
  inStock: z.boolean().describe('Whether the product is currently in stock'),
  rating: z.number().min(1).max(5).describe('Average customer rating 1-5'),
});

type Product = z.infer<typeof productSchema>;

export async function generateProductListing(brief: string): Promise<Product> {
  const { output } = await generateText({
    model: 'openai/gpt-4o',
    output: Output.object({
      schema: productSchema,
      name: 'Product',
      description: 'An e-commerce product listing.',
    }),
    prompt: `Generate a realistic product listing based on this brief: ${brief}`,
  });

  return output;
}
```

**Why good:** Composed schemas from smaller pieces, constraints (`.min()`, `.max()`, `.positive()`), optional nested objects, enum for categories, named type inference

---

## Pattern 6: Combining Tools with Structured Output

### Good Example -- Research and Summarize

```typescript
// lib/research-pipeline.ts
import { generateText, Output, tool, stepCountIs } from 'ai';
import { z } from 'zod';

const summarySchema = z.object({
  topic: z.string().describe('Research topic'),
  summary: z.string().describe('Comprehensive summary of findings'),
  keyFacts: z.array(z.string()).describe('Key facts discovered'),
  sources: z.array(z.string()).describe('Source URLs used'),
  confidence: z.enum(['high', 'medium', 'low']).describe('Confidence level in findings'),
});

const webSearchTool = tool({
  description: 'Search the web for information about a topic.',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async ({ query }) => {
    return await performWebSearch(query);
  },
});

const MAX_RESEARCH_STEPS = 5;

export async function researchTopic(topic: string) {
  const { output, steps } = await generateText({
    model: 'anthropic/claude-sonnet-4.5',
    system: 'You are a research assistant. Search for information, then provide a structured summary.',
    tools: { webSearch: webSearchTool },
    output: Output.object({ schema: summarySchema }),
    stopWhen: stepCountIs(MAX_RESEARCH_STEPS),
    prompt: `Research the following topic thoroughly: ${topic}`,
  });

  console.log(`Research completed in ${steps.length} steps`);
  return output; // Typed as summarySchema
}
```

**Why good:** Tools gather data, structured output formats the result, named constant for step limit, type-safe output, system prompt guides workflow

---

## Pattern 7: Error Handling for Structured Output

### Good Example -- Graceful Fallback

```typescript
// lib/extract.ts
import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().describe('Person name'),
  email: z.string().email().describe('Email address'),
  phone: z.string().optional().describe('Phone number if mentioned'),
  company: z.string().optional().describe('Company name if mentioned'),
});

type Contact = z.infer<typeof contactSchema>;

export async function extractContact(text: string): Promise<Contact | null> {
  try {
    const { output } = await generateText({
      model: 'openai/gpt-4o',
      output: Output.object({ schema: contactSchema }),
      prompt: `Extract contact information from the following text. If no contact info is present, return a minimal object with "unknown" values.\n\n${text}`,
    });

    return output;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      console.error('Failed to extract contact:', error.cause);
      console.error('Raw model output:', error.text);
      return null;
    }
    throw error; // Re-throw unexpected errors
  }
}
```

**Why good:** `NoObjectGeneratedError.isInstance()` for type-safe error handling, access to raw text on failure, null return for graceful fallback, re-throws unexpected errors

### Good Example -- Stream Error Handling

```typescript
import { streamText, Output } from 'ai';
import { z } from 'zod';

const schema = z.object({
  title: z.string(),
  content: z.string(),
});

const result = streamText({
  model: 'openai/gpt-4o',
  output: Output.object({ schema }),
  prompt: 'Generate an article.',
  onError({ error }) {
    // CRITICAL: Stream errors go here, NOT thrown
    console.error('Stream error during structured output:', error);
  },
});

for await (const partial of result.partialOutputStream) {
  // Safe to consume -- errors handled by onError
  console.log(partial);
}
```

**Why good:** `onError` handles stream failures, prevents silent errors during structured output streaming

---

## Pattern 8: Unstructured JSON and Text Output

### Good Example -- When Schema Is Unknown

```typescript
import { generateText, Output } from 'ai';

// Output.json() -- validates JSON syntax only, no schema
const { output: jsonOutput } = await generateText({
  model: 'openai/gpt-4o',
  output: Output.json(),
  prompt: 'Return the weather for 3 cities as a JSON object.',
});

console.log(typeof jsonOutput); // 'object' -- parsed JSON
console.log(jsonOutput); // { "cities": [...] } -- shape unknown

// Output.text() -- plain text (default behavior)
const { text } = await generateText({
  model: 'openai/gpt-4o',
  output: Output.text(),
  prompt: 'Write a haiku about programming.',
});

console.log(text); // Plain string
```

**Why good:** `Output.json()` for when you need JSON but don't know the schema, `Output.text()` is the default for plain text

**When to use:** `Output.json()` for exploratory/prototyping phases before defining a schema, `Output.text()` for prose/creative content

---

_For core patterns, see [core.md](core.md). For tool calling, see [tools.md](tools.md). For RAG, see [rag.md](rag.md)._
