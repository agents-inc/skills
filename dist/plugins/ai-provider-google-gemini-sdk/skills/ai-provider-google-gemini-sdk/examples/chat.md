# Google Gemini SDK -- Chat Session Examples

> Multi-turn conversations with `ai.chats.create()`, history management, streaming chat, and chat with tools. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [multimodal.md](multimodal.md) -- Multimodal input
- [streaming.md](streaming.md) -- Streaming responses
- [tools.md](tools.md) -- Function calling
- [structured-output.md](structured-output.md) -- Structured JSON output
- [advanced.md](advanced.md) -- Embeddings, caching, safety

---

## Basic Chat Session

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const chat = ai.chats.create({
  model: "gemini-2.5-flash",
  config: {
    systemInstruction: "You are a helpful TypeScript tutor. Be concise.",
  },
});

const r1 = await chat.sendMessage({ message: "What is a generic type?" });
console.log("Response 1:", r1.text);

const r2 = await chat.sendMessage({ message: "Show me an example." });
console.log("Response 2:", r2.text);

// Chat automatically remembers the conversation
const r3 = await chat.sendMessage({
  message: "How does it differ from `any`?",
});
console.log("Response 3:", r3.text);
```

**Key point:** `sendMessage` takes `{ message: string }` (an object), not a plain string.

---

## Chat with Pre-Loaded History

```typescript
const chat = ai.chats.create({
  model: "gemini-2.5-flash",
  history: [
    {
      role: "user",
      parts: [{ text: "Hello, I'm learning TypeScript." }],
    },
    {
      role: "model",
      parts: [
        {
          text: "Welcome! TypeScript is a great choice. What would you like to learn about?",
        },
      ],
    },
  ],
  config: {
    systemInstruction: "You are a patient coding tutor.",
  },
});

// Continues from the pre-loaded history
const response = await chat.sendMessage({
  message: "Tell me about interfaces vs types.",
});
console.log(response.text);
```

**Note:** Chat history uses `role: "model"` (not `"assistant"`) for Gemini responses -- differs from other providers' convention.

---

## Streaming Chat

```typescript
const chat = ai.chats.create({
  model: "gemini-2.5-flash",
  config: {
    systemInstruction: "You are a creative writing assistant.",
  },
});

// Stream the first message
const stream1 = await chat.sendMessageStream({
  message: "Start a story about a developer who discovers their code is alive.",
});

for await (const chunk of stream1) {
  process.stdout.write(chunk.text ?? "");
}

console.log("\n\n--- Continue ---\n");

// Stream a follow-up -- chat remembers the story
const stream2 = await chat.sendMessageStream({
  message: "Now the code starts making its own pull requests.",
});

for await (const chunk of stream2) {
  process.stdout.write(chunk.text ?? "");
}
```

---

## Getting Chat History

```typescript
const chat = ai.chats.create({ model: "gemini-2.5-flash" });

await chat.sendMessage({ message: "Hello!" });
await chat.sendMessage({ message: "What is TypeScript?" });

// Retrieve full conversation history
const history = chat.getHistory();
for (const entry of history) {
  const text = entry.parts?.map((p) => p.text).join("") ?? "";
  console.log(`[${entry.role}]: ${text.slice(0, 80)}...`);
}
```

---

## Chat with Function Calling

```typescript
const getStockPriceDeclaration = {
  name: "get_stock_price",
  description: "Get the current stock price for a ticker symbol",
  parametersJsonSchema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Stock ticker symbol, e.g. AAPL" },
    },
    required: ["symbol"],
  },
};

const chat = ai.chats.create({
  model: "gemini-2.5-flash",
  config: {
    tools: [{ functionDeclarations: [getStockPriceDeclaration] }],
    systemInstruction:
      "You are a financial assistant. Use tools to get real data.",
  },
});

const r1 = await chat.sendMessage({ message: "What is Apple's stock price?" });

if (r1.functionCalls && r1.functionCalls.length > 0) {
  const call = r1.functionCalls[0];
  console.log(`Function call: ${call.name}(${JSON.stringify(call.args)})`);
  // Execute the function and send result back through chat
}
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
