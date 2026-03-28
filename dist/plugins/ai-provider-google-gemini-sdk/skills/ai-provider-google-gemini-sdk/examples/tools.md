# Google Gemini SDK -- Function Calling / Tool Use Examples

> Function declarations, calling modes, manual tool loop for multi-turn, parallel function calls, and built-in tools (Google Search). See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [multimodal.md](multimodal.md) -- Multimodal input
- [streaming.md](streaming.md) -- Streaming responses
- [structured-output.md](structured-output.md) -- Structured JSON output
- [chat.md](chat.md) -- Multi-turn chat
- [advanced.md](advanced.md) -- Embeddings, caching, safety

---

## Single Function Call

```typescript
import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const getWeatherDeclaration = {
  name: "get_weather",
  description: "Get current weather for a city",
  parametersJsonSchema: {
    type: "object",
    properties: {
      location: { type: "string", description: "City name, e.g. 'Tokyo'" },
      unit: {
        type: "string",
        enum: ["celsius", "fahrenheit"],
        description: "Temperature unit",
      },
    },
    required: ["location"],
  },
};

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "What is the weather in Tokyo?",
  config: {
    tools: [{ functionDeclarations: [getWeatherDeclaration] }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.AUTO,
      },
    },
  },
});

if (response.functionCalls && response.functionCalls.length > 0) {
  const call = response.functionCalls[0];
  console.log(`Function: ${call.name}`);
  console.log(`Args:`, call.args);
  console.log(`Call ID: ${call.id}`);
}
```

---

## Multi-Turn Tool Loop (Complete Pattern)

The model calls a function, you execute it, send the result back, and the model generates a final answer:

```typescript
import { GoogleGenAI } from "@google/genai";
import type { Content } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Tool implementations
function getWeather(args: { location: string }): string {
  // In production, call a real weather API
  return JSON.stringify({
    location: args.location,
    temperature: 22,
    condition: "sunny",
  });
}

function getTime(args: { timezone: string }): string {
  return JSON.stringify({
    timezone: args.timezone,
    time: new Date().toISOString(),
  });
}

const toolImplementations: Record<
  string,
  (args: Record<string, unknown>) => string
> = {
  get_weather: getWeather as (args: Record<string, unknown>) => string,
  get_time: getTime as (args: Record<string, unknown>) => string,
};

const tools = [
  {
    functionDeclarations: [
      {
        name: "get_weather",
        description: "Get current weather for a city",
        parametersJsonSchema: {
          type: "object",
          properties: { location: { type: "string" } },
          required: ["location"],
        },
      },
      {
        name: "get_time",
        description: "Get current time in a timezone",
        parametersJsonSchema: {
          type: "object",
          properties: { timezone: { type: "string" } },
          required: ["timezone"],
        },
      },
    ],
  },
];

const MAX_TOOL_ROUNDS = 5;
let contents: Content[] = [
  {
    role: "user",
    parts: [{ text: "What is the weather and time in London?" }],
  },
];

for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: { tools },
  });

  if (result.functionCalls && result.functionCalls.length > 0) {
    // Add model's function call to history
    contents.push({
      role: "model",
      parts: result.functionCalls.map((fc) => ({ functionCall: fc })),
    });

    // Execute ALL function calls and send results back
    const functionResponses = result.functionCalls.map((fc) => {
      const impl = toolImplementations[fc.name];
      const output = impl
        ? impl(fc.args as Record<string, unknown>)
        : '{"error": "unknown function"}';
      return {
        functionResponse: {
          name: fc.name,
          response: { result: JSON.parse(output) },
          id: fc.id,
        },
      };
    });

    contents.push({ role: "user", parts: functionResponses });
  } else {
    // Model returned text -- done
    console.log(result.text);
    break;
  }
}
```

**Key points:**

- Process ALL function calls before sending results back -- partial responses cause errors
- Include `id` in function responses to match calls
- Use `MAX_TOOL_ROUNDS` to prevent infinite loops

---

## Force Function Calling

Use `FunctionCallingConfigMode.ANY` to force the model to always call a function:

```typescript
import { FunctionCallingConfigMode } from "@google/genai";

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "The room feels too bright.",
  config: {
    tools: [{ functionDeclarations: [controlLightDeclaration] }],
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingConfigMode.ANY,
        allowedFunctionNames: ["control_light"],
      },
    },
  },
});
```

| Mode        | Behavior                                                          |
| ----------- | ----------------------------------------------------------------- |
| `AUTO`      | Model decides whether to call a function                          |
| `ANY`       | Model always calls a function from allowed list                   |
| `NONE`      | Model never calls functions (text-only response)                  |
| `VALIDATED` | Like AUTO but guarantees function call schema adherence (Preview) |

---

## Parallel Function Calls

The model may return multiple function calls in a single response:

```typescript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Turn on the disco ball, start playing music, and dim the lights!",
  config: {
    tools: [{ functionDeclarations: [discoBallDecl, musicDecl, lightsDecl] }],
    toolConfig: {
      functionCallingConfig: { mode: FunctionCallingConfigMode.ANY },
    },
  },
});

// Process ALL calls -- don't just take the first one
for (const call of response.functionCalls ?? []) {
  console.log(`${call.name}(${JSON.stringify(call.args)}) -- ID: ${call.id}`);
}
```

---

## Function Calling in Chat

```typescript
const chat = ai.chats.create({
  model: "gemini-2.5-flash",
  config: {
    tools: [{ functionDeclarations: [getWeatherDeclaration] }],
  },
});

const r1 = await chat.sendMessage({ message: "What is the weather in Paris?" });

if (r1.functionCalls && r1.functionCalls.length > 0) {
  const call = r1.functionCalls[0];
  const weatherData = getWeather(call.args as { location: string });

  // Send function result back through chat
  // Chat automatically maintains the conversation context
  // You need to manually add the function response to history
  console.log(`Would call ${call.name} with`, call.args);
}
```

---

## Built-in Google Search Tool

Gemini supports built-in tools that execute server-side:

```typescript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "What were the major tech news stories today?",
  config: {
    tools: [{ googleSearch: {} }],
  },
});

console.log(response.text);
// Response includes grounding with web search results
```

---

## Built-in Code Execution Tool

```typescript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Calculate the first 20 Fibonacci numbers.",
  config: {
    tools: [{ codeExecution: {} }],
  },
});

console.log(response.text);
```

---

## Combining Built-in and Custom Tools

```typescript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Search for the current Tesla stock price, then convert it to EUR.",
  config: {
    tools: [
      { googleSearch: {} },
      { functionDeclarations: [convertCurrencyDeclaration] },
    ],
  },
});
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
