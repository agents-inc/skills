# Together AI SDK -- Tool/Function Calling Examples

> Function calling patterns: tool definitions, tool_choice control, multi-step tool loops, parallel calls. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [chat.md](chat.md) -- Chat Completions API
- [streaming.md](streaming.md) -- Streaming responses
- [structured-output.md](structured-output.md) -- Structured outputs with Zod
- [images.md](images.md) -- Image generation, embeddings

---

## Basic Function Calling

```typescript
import Together from "together-ai";

const client = new Together();

const completion = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  messages: [{ role: "user", content: "What is the weather in Tokyo?" }],
  tools: [
    {
      type: "function",
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
          additionalProperties: false,
        },
        strict: true,
      },
    },
  ],
});

const toolCall = completion.choices[0].message.tool_calls?.[0];
if (toolCall) {
  const args = JSON.parse(toolCall.function.arguments);
  console.log(`Call ${toolCall.function.name} with:`, args);
}
```

---

## Multiple Tools

```typescript
import Together from "together-ai";

const client = new Together();

const completion = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  messages: [
    {
      role: "system",
      content: "You help users by calling available tools.",
    },
    {
      role: "user",
      content: "What is the weather in London and search for restaurants?",
    },
  ],
  tools: [
    {
      type: "function",
      function: {
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
    },
    {
      type: "function",
      function: {
        name: "search_restaurants",
        description: "Search for restaurants in a city",
        parameters: {
          type: "object",
          properties: {
            city: { type: "string", description: "City to search" },
            cuisine: { type: "string", description: "Cuisine type" },
          },
          required: ["city"],
          additionalProperties: false,
        },
      },
    },
  ],
});

// Model may return one or more tool calls
const toolCalls = completion.choices[0].message.tool_calls ?? [];
for (const toolCall of toolCalls) {
  const args = JSON.parse(toolCall.function.arguments);
  console.log(`Call ${toolCall.function.name}:`, args);
}
```

---

## Controlling Tool Invocation with `tool_choice`

```typescript
// Force a specific function
const completion = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  messages: [{ role: "user", content: "Tell me about Paris" }],
  tools: [
    /* ... */
  ],
  tool_choice: {
    type: "function",
    function: { name: "get_weather" },
  },
});

// Force at least one tool call (any tool)
const required = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  messages: [{ role: "user", content: "Hello" }],
  tools: [
    /* ... */
  ],
  tool_choice: "required",
});

// Disable tool calling for this request
const noTools = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  messages: [{ role: "user", content: "Hello" }],
  tools: [
    /* ... */
  ],
  tool_choice: "none",
});
```

---

## Multi-Step Tool Loop

Execute tool calls and feed results back to the model.

```typescript
import Together from "together-ai";

const client = new Together();

// Tool implementations
async function getWeather(location: string): Promise<string> {
  return JSON.stringify({ location, temperature: 22, condition: "sunny" });
}

async function searchDatabase(query: string): Promise<string> {
  return JSON.stringify({ results: [{ id: 1, title: `Result: ${query}` }] });
}

const toolImplementations: Record<
  string,
  (args: Record<string, string>) => Promise<string>
> = {
  get_weather: (args) => getWeather(args.location),
  search_database: (args) => searchDatabase(args.query),
};

const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Get weather for a city",
      parameters: {
        type: "object" as const,
        properties: {
          location: { type: "string", description: "City name" },
        },
        required: ["location"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_database",
      description: "Search the database",
      parameters: {
        type: "object" as const,
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
];

// Initial request
const messages: Array<{
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}> = [
  { role: "system", content: "Help users with weather and database queries." },
  { role: "user", content: "What is the weather in London?" },
];

const completion = await client.chat.completions.create({
  model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  messages,
  tools,
});

const assistantMessage = completion.choices[0].message;

// If model wants to call tools, execute them and continue
if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
  // Add assistant message with tool calls
  messages.push({
    role: "assistant",
    content: assistantMessage.content,
    tool_calls: assistantMessage.tool_calls,
  });

  // Execute each tool and add results
  for (const toolCall of assistantMessage.tool_calls) {
    const args = JSON.parse(toolCall.function.arguments);
    const impl = toolImplementations[toolCall.function.name];
    const result = impl ? await impl(args) : "Unknown tool";

    messages.push({
      role: "tool",
      content: result,
      tool_call_id: toolCall.id,
      name: toolCall.function.name,
    });
  }

  // Get final response without tools
  const finalCompletion = await client.chat.completions.create({
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    messages,
  });

  console.log("Final answer:", finalCompletion.choices[0].message.content);
}
```

---

## Supported Models for Function Calling

Not all Together AI models support function calling. Currently supported:

- `meta-llama/Llama-3.3-70B-Instruct-Turbo`
- `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8`
- `Qwen/Qwen3.5-397B-A17B`
- `Qwen/Qwen3.5-9B`
- `Qwen/Qwen3-Next-80B-A3B-Instruct`
- `Qwen/Qwen2.5-7B-Instruct-Turbo`
- `deepseek-ai/DeepSeek-V3`
- `deepseek-ai/DeepSeek-R1`
- `mistralai/Mistral-Small-24B-Instruct-2501`

Check [Together AI docs](https://docs.together.ai/docs/function-calling) for the latest model support.

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
