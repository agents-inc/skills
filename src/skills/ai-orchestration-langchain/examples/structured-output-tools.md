# LangChain.js -- Structured Output & Tool Examples

> Structured output with `withStructuredOutput()`, tool definition with `tool()`, binding tools to models, and handling tool call responses. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Setup, LCEL chains, prompt templates
- [agents.md](agents.md) -- Agent creation and tool-calling workflows
- [rag.md](rag.md) -- RAG pipelines
- [streaming.md](streaming.md) -- Streaming patterns

---

## Basic Structured Output

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const MovieSchema = z.object({
  title: z.string().describe("The movie title"),
  year: z.number().describe("Release year"),
  genres: z.array(z.string()).describe("List of genres"),
  rating: z.number().min(0).max(10).describe("Rating out of 10"),
});

const structuredModel = new ChatOpenAI({
  model: "gpt-4o",
}).withStructuredOutput(MovieSchema);

const movie = await structuredModel.invoke(
  "Tell me about the movie Inception.",
);
// movie: { title: "Inception", year: 2010, genres: ["Sci-Fi", ...], rating: 8.8 }
// Fully typed as z.infer<typeof MovieSchema>
```

---

## Structured Output in an LCEL Chain

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

const AnalysisSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  confidence: z.number().min(0).max(1),
  keywords: z.array(z.string()),
  summary: z.string(),
});

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a text analysis expert."],
  ["human", "Analyze this text: {text}"],
]);

const model = new ChatOpenAI({ model: "gpt-4o" }).withStructuredOutput(
  AnalysisSchema,
);

// withStructuredOutput returns a Runnable, so it composes with .pipe()
const chain = prompt.pipe(model);

const analysis = await chain.invoke({
  text: "LangChain makes building AI apps much easier!",
});
// analysis: { sentiment: "positive", confidence: 0.95, keywords: [...], summary: "..." }
```

---

## Nested and Complex Schemas

```typescript
import { z } from "zod";

const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  country: z.string(),
});

const PersonSchema = z.object({
  name: z.string().describe("Full name"),
  age: z.number().describe("Age in years"),
  occupation: z.string().describe("Current job title"),
  address: AddressSchema.describe("Home address"),
  skills: z.array(z.string()).describe("Professional skills"),
});

const model = new ChatOpenAI({ model: "gpt-4o" }).withStructuredOutput(
  PersonSchema,
);
const person = await model.invoke(
  "Extract info: John is a 30-year-old engineer in London.",
);
```

**Note:** For deeply nested Zod schemas, TypeScript may report "Type instantiation is excessively deep." Fix by adding an explicit generic: `model.withStructuredOutput<z.infer<typeof PersonSchema>>(PersonSchema)`.

---

## Handling Structured Output Errors

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const StrictSchema = z.object({
  answer: z.string(),
  sources: z.array(z.string()).min(1),
});

const model = new ChatOpenAI({ model: "gpt-4o" }).withStructuredOutput(
  StrictSchema,
  {
    // Use "functionCalling" (default) or "jsonSchema" method
    method: "functionCalling",
  },
);

try {
  const result = await model.invoke("What is the capital of France?");
  console.log(result);
} catch (error) {
  // withStructuredOutput can throw if the model returns malformed output
  // or if the Zod schema validation fails
  console.error("Structured output failed:", error);
}
```

---

## Defining Tools with `tool()`

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Simple tool
const calculator = tool(
  async ({ expression }) => {
    // In production, use a safe math evaluator
    return String(eval(expression));
  },
  {
    name: "calculator",
    description: "Evaluate a mathematical expression",
    schema: z.object({
      expression: z
        .string()
        .describe("Math expression to evaluate, e.g. '2 + 2'"),
    }),
  },
);

// Tool with multiple parameters
const searchDatabase = tool(
  async ({ query, limit }) => {
    // In production, query your database
    return JSON.stringify({
      results: [{ id: 1, title: `Result for: ${query}` }],
      total: 1,
    });
  },
  {
    name: "search_database",
    description: "Search the database for records matching a query",
    schema: z.object({
      query: z.string().describe("Search terms"),
      limit: z.number().default(10).describe("Maximum number of results"),
    }),
  },
);
```

**Important:** Always use `snake_case` for tool names. Some providers reject camelCase names.

---

## Binding Tools to a Model

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const getWeather = tool(
  async ({ location }) => `Weather in ${location}: 22C, sunny`,
  {
    name: "get_weather",
    description: "Get current weather for a city",
    schema: z.object({
      location: z.string().describe("City name"),
    }),
  },
);

const getTime = tool(
  async ({ timezone }) =>
    `Time in ${timezone}: ${new Date().toLocaleTimeString()}`,
  {
    name: "get_time",
    description: "Get current time in a timezone",
    schema: z.object({
      timezone: z.string().describe("Timezone, e.g. 'America/New_York'"),
    }),
  },
);

// Bind tools to model
const modelWithTools = new ChatOpenAI({ model: "gpt-4o" }).bindTools([
  getWeather,
  getTime,
]);

const response = await modelWithTools.invoke("What is the weather in London?");

// Check for tool calls in the response
if (response.tool_calls && response.tool_calls.length > 0) {
  for (const toolCall of response.tool_calls) {
    console.log(`Tool: ${toolCall.name}`);
    console.log(`Args: ${JSON.stringify(toolCall.args)}`);
  }
}
```

---

## Manual Tool Call Loop

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, ToolMessage } from "@langchain/core/messages";
import type { AIMessage } from "@langchain/core/messages";

const model = new ChatOpenAI({ model: "gpt-4o" }).bindTools([getWeather]);

// Step 1: Get model's tool call request
const messages = [new HumanMessage("What is the weather in Tokyo?")];
const aiResponse = (await model.invoke(messages)) as AIMessage;

// Step 2: Execute the tool
if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
  const toolCall = aiResponse.tool_calls[0];
  const toolResult = await getWeather.invoke(toolCall.args);

  // Step 3: Send tool result back to the model
  messages.push(aiResponse);
  messages.push(
    new ToolMessage({
      tool_call_id: toolCall.id ?? "",
      content: toolResult,
    }),
  );

  // Step 4: Get final response
  const finalResponse = await model.invoke(messages);
  console.log(finalResponse.text);
}
```

**Note:** This manual loop is educational. For production, use `createAgent()` which handles the loop automatically.

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
