# OpenAI SDK -- Tool/Function Calling Examples

> Function calling patterns: manual tool definitions, Zod-based tools with `zodFunction`, automated tool loops with `runTools`, Responses API function calling. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [chat.md](chat.md) -- Chat Completions API
- [streaming.md](streaming.md) -- Streaming responses
- [structured-output.md](structured-output.md) -- Structured outputs with Zod
- [embeddings-vision-audio.md](embeddings-vision-audio.md) -- Embeddings, vision, audio

---

## Chat Completions with Manual Tool Definitions

```typescript
import OpenAI from "openai";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

const client = new OpenAI();

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
          unit: { type: "string", enum: ["celsius", "fahrenheit"] },
        },
        required: ["location"],
        additionalProperties: false,
      },
      strict: true,
    },
  },
];

const completion = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "What is the weather in Tokyo?" }],
  tools,
});

const toolCall = completion.choices[0].message.tool_calls?.[0];
if (toolCall) {
  const args = JSON.parse(toolCall.function.arguments);
  console.log(`Call ${toolCall.function.name} with:`, args);
}
```

---

## Zod-Based Tools with `zodFunction`

```typescript
// function-calling.ts
import OpenAI from "openai";
import { zodFunction } from "openai/helpers/zod";
import { z } from "zod";

const client = new OpenAI();

// Define tool schemas with Zod
const GetWeatherParams = z.object({
  location: z.string().describe('City name, e.g. "San Francisco"'),
  unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
});

const SearchDatabaseParams = z.object({
  query: z.string().describe("Search query string"),
  limit: z.number().default(10).describe("Max results to return"),
});

// Tool implementations
async function getWeather(
  args: z.infer<typeof GetWeatherParams>,
): Promise<string> {
  // In production, call a real weather API
  return JSON.stringify({
    location: args.location,
    temperature: 22,
    unit: args.unit,
    condition: "sunny",
  });
}

async function searchDatabase(
  args: z.infer<typeof SearchDatabaseParams>,
): Promise<string> {
  // In production, query your database
  return JSON.stringify({
    results: [{ id: 1, title: `Result for: ${args.query}` }],
    total: 1,
  });
}

// Map tool names to implementations
const toolImplementations: Record<string, (args: unknown) => Promise<string>> =
  {
    get_weather: getWeather as (args: unknown) => Promise<string>,
    search_database: searchDatabase as (args: unknown) => Promise<string>,
  };

// Create completion with tools
const completion = await client.chat.completions.parse({
  model: "gpt-4o",
  messages: [
    {
      role: "developer",
      content: "You help users by calling available tools.",
    },
    { role: "user", content: "What is the weather in Tokyo?" },
  ],
  tools: [
    zodFunction({ name: "get_weather", parameters: GetWeatherParams }),
    zodFunction({ name: "search_database", parameters: SearchDatabaseParams }),
  ],
});

// Process tool calls
const message = completion.choices[0].message;
if (message.tool_calls && message.tool_calls.length > 0) {
  for (const toolCall of message.tool_calls) {
    const fnName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);
    console.log(`Calling ${fnName} with:`, args);

    const impl = toolImplementations[fnName];
    if (impl) {
      const result = await impl(args);
      console.log(`Result: ${result}`);
    }
  }
}
```

---

## Automated Tool Loop with `runTools`

```typescript
// run-tools.ts
import OpenAI from "openai";

const client = new OpenAI();

const MAX_TOOL_CALLS = 5;

async function getWeather(args: { location: string }): Promise<string> {
  return `Weather in ${args.location}: 22C, sunny`;
}

async function getTime(args: { timezone: string }): Promise<string> {
  return `Time in ${args.timezone}: ${new Date().toLocaleTimeString()}`;
}

const runner = client.chat.completions.runTools({
  model: "gpt-4o",
  messages: [
    { role: "developer", content: "Help users with weather and time queries." },
    {
      role: "user",
      content: "What is the weather and current time in London?",
    },
  ],
  tools: [
    {
      type: "function",
      function: {
        function: getWeather,
        parse: JSON.parse,
        description: "Get current weather for a location",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string", description: "City name" },
          },
          required: ["location"],
        },
      },
    },
    {
      type: "function",
      function: {
        function: getTime,
        parse: JSON.parse,
        description: "Get current time in a timezone",
        parameters: {
          type: "object",
          properties: {
            timezone: {
              type: "string",
              description: "Timezone, e.g. Europe/London",
            },
          },
          required: ["timezone"],
        },
      },
    },
  ],
  maxChatCompletions: MAX_TOOL_CALLS,
});

// Monitor the tool execution loop
runner.on("message", (msg) => {
  if (msg.role === "assistant" && msg.tool_calls) {
    console.log(`[Tool calls: ${msg.tool_calls.length}]`);
  }
  if (msg.role === "tool") {
    console.log(`[Tool result received]`);
  }
});

const finalContent = await runner.finalContent();
console.log("\nFinal answer:", finalContent);
```

---

## Responses API Function Calling

```typescript
// responses-function-calling.ts
import OpenAI from "openai";

const client = new OpenAI();

// Define the function tool for Responses API
const response = await client.responses.create({
  model: "gpt-4o",
  instructions: "You are a helpful assistant with access to weather data.",
  input: "What is the weather like in San Francisco and New York?",
  tools: [
    {
      type: "function",
      name: "get_weather",
      description: "Get current weather for a city",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
        },
        required: ["location"],
        additionalProperties: false,
      },
    },
  ],
});

// Process function call outputs
const functionCalls = response.output.filter(
  (item) => item.type === "function_call",
);

for (const call of functionCalls) {
  console.log(`Function: ${call.name}`);
  console.log(`Arguments: ${call.arguments}`);
  console.log(`Call ID: ${call.call_id}`);
}

// Submit function results back to continue the conversation
if (functionCalls.length > 0) {
  const toolOutputs = functionCalls.map((call) => ({
    type: "function_call_output" as const,
    call_id: call.call_id,
    output: JSON.stringify({ temperature: 22, condition: "sunny" }),
  }));

  const followUp = await client.responses.create({
    model: "gpt-4o",
    input: toolOutputs,
    previous_response_id: response.id,
    store: true,
  });

  console.log("Final answer:", followUp.output_text);
}
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
