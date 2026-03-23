# Mistral SDK -- Function Calling Examples

> Tool definitions, tool call loop, parallel tool calls, streaming function calling. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [chat.md](chat.md) -- Chat completions and streaming
- [structured-output.md](structured-output.md) -- Structured outputs with Zod
- [embeddings-vision.md](embeddings-vision.md) -- Embeddings and vision
- [codestral.md](codestral.md) -- Codestral FIM code completion

---

## Basic Function Calling

```typescript
// function-calling.ts
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({ apiKey: process.env["MISTRAL_API_KEY"] ?? "" });

const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Get the current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature unit",
          },
        },
        required: ["location"],
      },
    },
  },
];

const result = await client.chat.complete({
  model: "mistral-large-latest",
  messages: [{ role: "user", content: "What is the weather in Paris?" }],
  tools,
  toolChoice: "any", // Forces tool use
});

const toolCall = result?.choices?.[0]?.message?.toolCalls?.[0];
if (toolCall) {
  const args = JSON.parse(toolCall.function.arguments);
  console.log(`Call ${toolCall.function.name} with:`, args);
  console.log(`Tool call ID: ${toolCall.id}`);
}
```

**Why good:** Uses `toolChoice` (camelCase), `toolCalls` (camelCase), `as const` for type literal, checks for tool calls

---

## Complete Tool Call Loop

The standard pattern: send message with tools -> get tool calls -> execute -> send results back.

```typescript
// tool-loop.ts
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({ apiKey: process.env["MISTRAL_API_KEY"] ?? "" });

// Tool implementations
async function getWeather(args: {
  location: string;
  unit?: string;
}): Promise<string> {
  return JSON.stringify({
    location: args.location,
    temperature: 22,
    unit: args.unit ?? "celsius",
    condition: "sunny",
  });
}

async function searchDatabase(args: { query: string }): Promise<string> {
  return JSON.stringify({
    results: [{ id: 1, title: `Result for: ${args.query}` }],
  });
}

const toolImplementations: Record<
  string,
  (args: Record<string, unknown>) => Promise<string>
> = {
  get_weather: getWeather as (args: Record<string, unknown>) => Promise<string>,
  search_database: searchDatabase as (
    args: Record<string, unknown>,
  ) => Promise<string>,
};

const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Get current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
          unit: { type: "string", enum: ["celsius", "fahrenheit"] },
        },
        required: ["location"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_database",
      description: "Search the knowledge base",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
    },
  },
];

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    function: { name: string; arguments: string };
  }>;
}

const MAX_TOOL_ITERATIONS = 5;

const messages: ChatMessage[] = [
  {
    role: "system",
    content: "You help users with weather and search queries.",
  },
  {
    role: "user",
    content: "What is the weather in London and search for TypeScript guides?",
  },
];

let iterations = 0;

while (iterations < MAX_TOOL_ITERATIONS) {
  const result = await client.chat.complete({
    model: "mistral-large-latest",
    messages,
    tools,
  });

  const choice = result?.choices?.[0];
  if (!choice) break;

  const assistantMessage = choice.message;

  // Check if the model wants to call tools
  if (!assistantMessage?.toolCalls || assistantMessage.toolCalls.length === 0) {
    // No tool calls -- model has a final answer
    console.log("Final answer:", assistantMessage?.content);
    break;
  }

  // Add assistant message with tool calls to history
  messages.push({
    role: "assistant",
    content:
      typeof assistantMessage.content === "string"
        ? assistantMessage.content
        : "",
    toolCalls: assistantMessage.toolCalls.map((tc) => ({
      id: tc.id ?? "",
      function: { name: tc.function.name, arguments: tc.function.arguments },
    })),
  });

  // Execute each tool call and add results
  for (const toolCall of assistantMessage.toolCalls) {
    const fnName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);
    console.log(`Calling ${fnName}(${JSON.stringify(args)})`);

    const impl = toolImplementations[fnName];
    if (!impl) {
      throw new Error(`Unknown tool: ${fnName}`);
    }

    const toolResult = await impl(args);

    messages.push({
      role: "tool",
      name: fnName,
      content: toolResult,
      toolCallId: toolCall.id ?? "",
    });
  }

  iterations++;
}
```

**Why good:** Bounded loop with MAX_TOOL_ITERATIONS, proper tool message format with `toolCallId`, handles parallel tool calls

---

## Tool Choice Options

```typescript
// "auto" (default) -- model decides whether to call tools
const result1 = await client.chat.complete({
  model: "mistral-large-latest",
  messages: [{ role: "user", content: "Hello" }],
  tools,
  toolChoice: "auto",
});

// "any" -- forces the model to call at least one tool
const result2 = await client.chat.complete({
  model: "mistral-large-latest",
  messages: [{ role: "user", content: "Get weather in Tokyo" }],
  tools,
  toolChoice: "any",
});

// "none" -- prevents any tool calls
const result3 = await client.chat.complete({
  model: "mistral-large-latest",
  messages: [{ role: "user", content: "Tell me about weather" }],
  tools,
  toolChoice: "none",
});
```

---

## Sequential Tool Calls

```typescript
// Force sequential tool calling (disable parallel calls)
const result = await client.chat.complete({
  model: "mistral-large-latest",
  messages: [{ role: "user", content: "Weather in Paris and London?" }],
  tools,
  parallelToolCalls: false, // Forces sequential -- model calls one tool at a time
});
```

**Why good:** `parallelToolCalls: false` ensures tools are called one at a time, useful for dependent operations

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
