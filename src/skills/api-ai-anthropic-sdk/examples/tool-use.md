# Anthropic SDK -- Tool Use / Function Calling Examples

> Tool definitions, the tool_use -> tool_result conversation loop, parallel tool calls, strict mode, and the automated tool runner. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [streaming.md](streaming.md) -- Streaming responses
- [vision-documents.md](vision-documents.md) -- Images and PDFs
- [extended-thinking.md](extended-thinking.md) -- Extended thinking

---

## Basic Tool Use with Manual Loop

The fundamental pattern: define tools, send request, check for `tool_use` stop reason, execute the tool, send `tool_result` back.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

const client = new Anthropic();
const MAX_TOKENS = 1024;

// 1. Define tools
const tools: Anthropic.Messages.Tool[] = [
  {
    name: "get_weather",
    description: "Get the current weather for a location",
    input_schema: {
      type: "object" as const,
      properties: {
        location: {
          type: "string",
          description: "City name, e.g. San Francisco",
        },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
          description: "Temperature unit",
        },
      },
      required: ["location"],
    },
  },
];

// 2. Send initial request
const messages: MessageParam[] = [
  { role: "user", content: "What is the weather in Paris?" },
];

const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  tools,
  messages,
});

// 3. Check if Claude wants to call a tool
if (response.stop_reason === "tool_use") {
  // Include the full assistant response in history (all content blocks)
  messages.push({ role: "assistant", content: response.content });

  // Find and execute all tool_use blocks
  const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

  for (const block of response.content) {
    if (block.type === "tool_use") {
      console.log(`Calling ${block.name} with:`, block.input);

      // Execute the tool (your implementation)
      const result = await executeToolCall(block.name, block.input);

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }
  }

  // 4. Send tool results back
  messages.push({ role: "user", content: toolResults });

  const finalResponse = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: MAX_TOKENS,
    tools,
    messages,
  });

  // Now we get the text response
  for (const block of finalResponse.content) {
    if (block.type === "text") {
      console.log(block.text);
    }
  }
}

// Tool implementation (your code)
async function executeToolCall(
  name: string,
  input: unknown,
): Promise<Record<string, unknown>> {
  if (name === "get_weather") {
    const { location } = input as { location: string };
    return { temperature: 22, unit: "celsius", condition: "sunny", location };
  }
  throw new Error(`Unknown tool: ${name}`);
}
```

---

## Complete Tool Loop (Multiple Rounds)

Claude may need multiple tool calls before producing a final answer. Loop until `stop_reason !== "tool_use"`.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

const client = new Anthropic();
const MAX_TOKENS = 2048;
const MAX_TOOL_ROUNDS = 10;

const tools: Anthropic.Messages.Tool[] = [
  {
    name: "get_weather",
    description: "Get weather for a city",
    input_schema: {
      type: "object" as const,
      properties: { location: { type: "string" } },
      required: ["location"],
    },
  },
  {
    name: "get_time",
    description: "Get current time in a timezone",
    input_schema: {
      type: "object" as const,
      properties: { timezone: { type: "string" } },
      required: ["timezone"],
    },
  },
];

const messages: MessageParam[] = [
  {
    role: "user",
    content: "What is the weather and time in London and Tokyo?",
  },
];

let round = 0;
let response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  tools,
  messages,
});

while (response.stop_reason === "tool_use" && round < MAX_TOOL_ROUNDS) {
  round++;
  messages.push({ role: "assistant", content: response.content });

  // Execute all tool calls in this round
  const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

  for (const block of response.content) {
    if (block.type === "tool_use") {
      const result = await executeToolCall(block.name, block.input);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }
  }

  messages.push({ role: "user", content: toolResults });

  response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: MAX_TOKENS,
    tools,
    messages,
  });
}

// Final text response
for (const block of response.content) {
  if (block.type === "text") {
    console.log(block.text);
  }
}
```

---

## Parallel Tool Calls

Claude can request multiple tool calls in a single response. All `tool_use` blocks in one response should be executed and their results returned together.

```typescript
// When response contains multiple tool_use blocks:
// response.content = [
//   { type: "tool_use", id: "toolu_1", name: "get_weather", input: { location: "London" } },
//   { type: "tool_use", id: "toolu_2", name: "get_weather", input: { location: "Tokyo" } },
// ]

// Execute all in parallel
const toolBlocks = response.content.filter(
  (block): block is Anthropic.Messages.ToolUseBlock =>
    block.type === "tool_use",
);

const toolResults = await Promise.all(
  toolBlocks.map(async (block) => {
    const result = await executeToolCall(block.name, block.input);
    return {
      type: "tool_result" as const,
      tool_use_id: block.id,
      content: JSON.stringify(result),
    };
  }),
);

// Send all results back in one message
messages.push({ role: "assistant", content: response.content });
messages.push({ role: "user", content: toolResults });
```

---

## Tool Choice Options

```typescript
const MAX_TOKENS = 1024;

// Auto (default) -- Claude decides whether to call a tool
await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  tools,
  tool_choice: { type: "auto" },
  messages,
});

// Any -- force Claude to call at least one tool
await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  tools,
  tool_choice: { type: "any" },
  messages,
});

// Specific tool -- force a particular tool
await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  tools,
  tool_choice: { type: "tool", name: "get_weather" },
  messages,
});

// None -- disable tool calling even though tools are defined
await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  tools,
  tool_choice: { type: "none" },
  messages,
});
```

**Note:** `tool_choice: { type: "any" }` and specific tool forcing are NOT compatible with extended thinking. Only `"auto"` and `"none"` work when thinking is enabled.

---

## Strict Tool Definitions

Enable `strict: true` for guaranteed schema adherence on tool inputs.

```typescript
const tools: Anthropic.Messages.Tool[] = [
  {
    name: "search_flights",
    description: "Search for available flights",
    strict: true, // Guarantees input matches schema exactly
    input_schema: {
      type: "object" as const,
      properties: {
        destination: { type: "string" },
        date: { type: "string", description: "ISO 8601 date" },
        passengers: { type: "number" },
      },
      required: ["destination", "date", "passengers"],
      additionalProperties: false,
    },
  },
];
```

---

## Tool Error Handling

When a tool execution fails, send the error back as a `tool_result` with `is_error: true`.

```typescript
for (const block of response.content) {
  if (block.type === "tool_use") {
    try {
      const result = await executeToolCall(block.name, block.input);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    } catch (error) {
      // Send error back to Claude so it can adapt
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        is_error: true,
      });
    }
  }
}
```

**Why this matters:** Claude can recover from tool errors if you report them. It may try a different approach or ask the user for clarification.

---

## Automated Tool Runner (Beta)

The SDK provides a `toolRunner` that automates the tool call loop.

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const client = new Anthropic();

const weatherTool = betaZodTool({
  name: "get_weather",
  inputSchema: z.object({
    location: z.string(),
  }),
  description: "Get the current weather in a given location",
  run: async (input) => {
    // Your tool implementation
    return `The weather in ${input.location} is 22C and sunny`;
  },
});

// Runs the tool loop automatically
const finalMessage = await client.beta.messages.toolRunner({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [
    { role: "user", content: "What is the weather in San Francisco?" },
  ],
  tools: [weatherTool],
});

console.log(finalMessage.content);
```

---

## Streaming with Tool Runner

```typescript
const runner = client.beta.messages.toolRunner({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Weather in London?" }],
  tools: [weatherTool],
  stream: true,
});

for await (const messageStream of runner) {
  for await (const event of messageStream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      process.stdout.write(event.delta.text);
    }
  }
}

const finalResult = await runner;
console.log("\nFinal:", finalResult.content);
```

---

## Caching Tool Definitions

For repeated requests with the same tools, cache the tool definitions to save tokens.

```typescript
const MAX_TOKENS = 1024;

// Place cache_control on the last tool definition
const toolsWithCache: Anthropic.Messages.Tool[] = [
  {
    name: "search_docs",
    description: "Search documentation",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "get_document",
    description: "Retrieve a document by ID",
    input_schema: {
      type: "object" as const,
      properties: { doc_id: { type: "string" } },
      required: ["doc_id"],
    },
    cache_control: { type: "ephemeral" }, // Cache all tools up to this point
  },
];
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
