# Ollama -- Tool/Function Calling Examples

> Tool definitions, single and parallel tool calls, multi-turn agent loops, streaming with tool calls. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, chat, streaming
- [structured-output.md](structured-output.md) -- Structured output with Zod
- [embeddings-vision.md](embeddings-vision.md) -- Embeddings, vision
- [model-management.md](model-management.md) -- Model lifecycle

---

## Single Tool Call

```typescript
import ollama from "ollama";

// Define the tool
const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Get the current weather for a city",
      parameters: {
        type: "object",
        required: ["city"],
        properties: {
          city: { type: "string", description: "City name" },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature unit",
          },
        },
      },
    },
  },
];

// Implement the tool
function getWeather(args: { city: string; unit?: string }): string {
  // In production, call a real weather API
  return JSON.stringify({
    city: args.city,
    temperature: 22,
    unit: args.unit ?? "celsius",
    condition: "sunny",
  });
}

// First request: model decides to call a tool
const messages = [
  { role: "user" as const, content: "What is the weather in Tokyo?" },
];

const response = await ollama.chat({
  model: "llama3.1",
  messages,
  tools,
});

// Process tool calls
if (response.message.tool_calls?.length) {
  // Add assistant message with tool calls to history
  messages.push(response.message);

  for (const toolCall of response.message.tool_calls) {
    const { name, arguments: args } = toolCall.function;
    console.log(`Calling ${name} with:`, args);

    // NOTE: args is already a parsed object (not a JSON string like OpenAI)
    const result = getWeather(args as { city: string; unit?: string });

    // Add tool result to history
    messages.push({
      role: "tool" as const,
      content: result,
    });
  }

  // Second request: model generates final answer with tool results
  const finalResponse = await ollama.chat({
    model: "llama3.1",
    messages,
    tools,
  });

  console.log("Answer:", finalResponse.message.content);
}
```

---

## Multi-Turn Agent Loop

Continuously loop until the model stops requesting tools.

```typescript
import ollama from "ollama";
import type { Message, Tool } from "ollama";

const MAX_TOOL_ITERATIONS = 10;

// Tool implementations
const toolImplementations: Record<
  string,
  (args: Record<string, unknown>) => string
> = {
  get_weather: (args) =>
    JSON.stringify({ city: args.city, temperature: 22, condition: "sunny" }),
  get_time: (args) =>
    JSON.stringify({ timezone: args.timezone, time: new Date().toISOString() }),
};

const tools: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather for a city",
      parameters: {
        type: "object",
        required: ["city"],
        properties: {
          city: { type: "string", description: "City name" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_time",
      description: "Get current time in a timezone",
      parameters: {
        type: "object",
        required: ["timezone"],
        properties: {
          timezone: {
            type: "string",
            description: "Timezone, e.g. Asia/Tokyo",
          },
        },
      },
    },
  },
];

async function agentLoop(userMessage: string): Promise<string> {
  const messages: Message[] = [
    {
      role: "system",
      content:
        "You help users with weather and time queries. Use the available tools.",
    },
    { role: "user", content: userMessage },
  ];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await ollama.chat({ model: "llama3.1", messages, tools });

    // No tool calls -- model is done
    if (!response.message.tool_calls?.length) {
      return response.message.content;
    }

    // Add assistant message with tool calls
    messages.push(response.message);

    // Execute each tool call
    for (const toolCall of response.message.tool_calls) {
      const { name, arguments: args } = toolCall.function;
      console.log(`[Tool: ${name}]`, args);

      const impl = toolImplementations[name];
      if (!impl) {
        messages.push({
          role: "tool",
          content: `Error: Unknown tool "${name}"`,
        });
        continue;
      }

      const result = impl(args as Record<string, unknown>);
      messages.push({ role: "tool", content: result });
    }
  }

  return "Max tool iterations reached.";
}

const answer = await agentLoop("What is the weather and time in London?");
console.log("Final answer:", answer);
```

---

## Streaming with Tool Calls

When streaming with tools, accumulate chunks and check for tool calls.

```typescript
import ollama from "ollama";
import type { Message, Tool } from "ollama";

const tools: Tool[] = [
  {
    type: "function",
    function: {
      name: "add",
      description: "Add two numbers together",
      parameters: {
        type: "object",
        required: ["a", "b"],
        properties: {
          a: { type: "number", description: "First number" },
          b: { type: "number", description: "Second number" },
        },
      },
    },
  },
];

const messages: Message[] = [{ role: "user", content: "What is 42 plus 58?" }];

const stream = await ollama.chat({
  model: "qwen3",
  messages,
  tools,
  stream: true,
});

// Accumulate streamed response
let content = "";
let thinking = "";
const toolCalls: Array<{
  function: { name: string; arguments: Record<string, unknown> };
}> = [];

for await (const chunk of stream) {
  if (chunk.message.thinking) {
    thinking += chunk.message.thinking;
  }
  if (chunk.message.content) {
    content += chunk.message.content;
    process.stdout.write(chunk.message.content);
  }
  if (chunk.message.tool_calls) {
    toolCalls.push(...chunk.message.tool_calls);
  }
}

// Process accumulated tool calls
if (toolCalls.length > 0) {
  // Build accumulated assistant message for history
  messages.push({
    role: "assistant",
    content,
    tool_calls: toolCalls,
  } as Message);

  for (const toolCall of toolCalls) {
    const { a, b } = toolCall.function.arguments as { a: number; b: number };
    const result = a + b;
    console.log(`\n[Tool: ${toolCall.function.name}(${a}, ${b}) = ${result}]`);
    messages.push({ role: "tool", content: String(result) });
  }

  // Get final answer
  const finalResponse = await ollama.chat({
    model: "qwen3",
    messages,
    tools,
  });

  console.log("\nAnswer:", finalResponse.message.content);
}
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
