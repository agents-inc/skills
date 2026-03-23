# LlamaIndex.TS -- Agents & Tools Examples

> Agent creation, tool definitions, multi-agent workflows, and QueryEngineTool patterns. See [core.md](core.md) for basic setup.

**Prerequisites:** Understand Settings configuration and VectorStoreIndex from [core.md](core.md).

**Related examples:**

- [core.md](core.md) -- Setup, indexing, query engines
- [chat-streaming.md](chat-streaming.md) -- Chat engines, streaming

---

## Basic Agent with Custom Tools

```typescript
// agents/weather-agent.ts
import "dotenv/config";
import { tool, Settings } from "llamaindex";
import { agent } from "@llamaindex/workflow";
import { openai } from "@llamaindex/openai";
import { z } from "zod";

Settings.llm = openai({ model: "gpt-4o" });

const getWeather = tool({
  name: "getWeather",
  description: "Get current weather for a city",
  parameters: z.object({
    city: z.string({ description: "City name (e.g. 'Paris')" }),
    unit: z
      .enum(["celsius", "fahrenheit"])
      .default("celsius")
      .describe("Temperature unit"),
  }),
  execute: async ({ city, unit }) => {
    // Replace with actual API call
    return {
      city,
      temperature: unit === "celsius" ? 22 : 72,
      condition: "sunny",
    };
  },
});

const weatherAgent = agent({
  tools: [getWeather],
});

const result = await weatherAgent.run("What's the weather in Paris?");
console.log(result.data);
```

**Why good:** Zod schema with descriptions guides the model, default values reduce friction, typed execute function

---

## Agent with Streaming Output

```typescript
import { agentStreamEvent } from "@llamaindex/workflow";

const events = weatherAgent.runStream(
  "Compare weather in Paris and Tokyo, recommend which to visit",
);

for await (const event of events) {
  if (agentStreamEvent.include(event)) {
    process.stdout.write(event.data.delta);
  }
}
console.log(); // Final newline
```

**Why good:** Type-safe event filtering, progressive output, simple for-await pattern

---

## Agent with Structured Output

```typescript
import { z } from "zod";

const travelRecommendation = z.object({
  city: z.string(),
  reason: z.string(),
  bestSeason: z.string(),
  averageCost: z.number(),
});

const result = await weatherAgent.run("Recommend a city to visit in summer", {
  responseFormat: travelRecommendation,
});

// result.data.object is typed as { city, reason, bestSeason, averageCost }
console.log(result.data.object);
```

**Why good:** Zod schema validates and types the response, structured data extraction

---

## RAG Agent with QueryEngineTool

```typescript
// agents/rag-agent.ts
import {
  VectorStoreIndex,
  SimpleDirectoryReader,
  QueryEngineTool,
  Settings,
} from "llamaindex";
import { agent } from "@llamaindex/workflow";
import { openai, OpenAIEmbedding } from "@llamaindex/openai";

Settings.llm = openai({ model: "gpt-4o" });
Settings.embedModel = new OpenAIEmbedding({ model: "text-embedding-3-small" });

// Create index from documents
const documents = await new SimpleDirectoryReader().loadData({
  directoryPath: "./data/product-docs",
});
const index = await VectorStoreIndex.fromDocuments(documents);

// Wrap query engine as a tool
const docSearchTool = new QueryEngineTool({
  queryEngine: index.asQueryEngine(),
  metadata: {
    name: "product_docs",
    description:
      "Search product documentation for features, pricing, and technical specs",
  },
});

const ragAgent = agent({
  tools: [docSearchTool],
  systemPrompt:
    "You are a product support agent. Use the product_docs tool to answer questions accurately. Cite sources.",
});

const response = await ragAgent.run("What are the pricing tiers?");
console.log(response.data);
```

**Why good:** QueryEngineTool bridges RAG and agents, descriptive metadata for accurate tool routing, system prompt sets behavior

---

## Multi-Agent Workflow

```typescript
// agents/multi-agent.ts
import { tool, Settings, QueryEngineTool, VectorStoreIndex } from "llamaindex";
import { agent, multiAgent } from "@llamaindex/workflow";
import { openai } from "@llamaindex/openai";
import { z } from "zod";

Settings.llm = openai({ model: "gpt-4o" });

// Technical support agent
const techAgent = agent({
  name: "TechSupport",
  description: "Handles technical questions about APIs and integrations",
  tools: [techDocsTool], // QueryEngineTool over technical docs
});

// Billing agent
const billingAgent = agent({
  name: "Billing",
  description: "Handles billing, pricing, and subscription questions",
  tools: [billingDocsTool], // QueryEngineTool over billing docs
});

// Router agent -- delegates to specialists
const routerAgent = agent({
  name: "Router",
  description: "Routes customer questions to the right specialist",
  tools: [],
  canHandoffTo: [techAgent, billingAgent],
});

// Create multi-agent system
const system = multiAgent({
  agents: [routerAgent, techAgent, billingAgent],
  rootAgent: routerAgent,
});

const result = await system.run("How do I update my payment method?");
console.log(result.data);
// Router identifies this as billing -> hands off to Billing agent
```

**Why good:** Named agents with descriptions for routing, `canHandoffTo` for delegation, root agent as entry point

---

## Agent with Multiple Tool Types

```typescript
import { tool, FunctionTool, QueryEngineTool } from "llamaindex";
import { agent } from "@llamaindex/workflow";
import { z } from "zod";

// Tool from Zod schema (recommended for new tools)
const calculateTool = tool({
  name: "calculate",
  description: "Perform arithmetic calculations",
  parameters: z.object({
    expression: z.string({ description: "Math expression like '2 + 2'" }),
  }),
  execute: async ({ expression }) => {
    // Use a safe math parser, never eval()
    return { result: "4" };
  },
});

// FunctionTool wrapping an existing function
function lookupUser(params: { userId: string }): {
  name: string;
  email: string;
} {
  return { name: "Alice", email: "alice@example.com" };
}

const userLookupTool = new FunctionTool(lookupUser, {
  name: "lookupUser",
  description: "Look up user details by ID",
  parameters: {
    type: "object",
    properties: {
      userId: { type: "string", description: "User ID" },
    },
    required: ["userId"],
  },
});

// QueryEngineTool wrapping an index
const knowledgeTool = new QueryEngineTool({
  queryEngine: index.asQueryEngine(),
  metadata: {
    name: "knowledge_base",
    description: "Search internal knowledge base for company policies",
  },
});

const supportAgent = agent({
  tools: [calculateTool, userLookupTool, knowledgeTool],
});
```

**Why good:** Shows all three tool types, Zod-based `tool()` preferred for new tools, FunctionTool for legacy functions, QueryEngineTool for RAG

---

## Agent Event Monitoring

```typescript
import { agentToolCallEvent, agentStreamEvent } from "@llamaindex/workflow";

const events = myAgent.runStream("Research the best practices for RAG");

for await (const event of events) {
  // Track tool calls
  if (agentToolCallEvent.include(event)) {
    console.log(`Tool called: ${event.data.toolName}`);
    console.log(`  Args: ${JSON.stringify(event.data.toolKwargs)}`);
  }

  // Stream text output
  if (agentStreamEvent.include(event)) {
    process.stdout.write(event.data.delta);
  }
}
```

**Why good:** Typed event discrimination, tool call visibility for debugging, concurrent streaming output

---

_For core setup, see [core.md](core.md). For chat and streaming details, see [chat-streaming.md](chat-streaming.md)._
