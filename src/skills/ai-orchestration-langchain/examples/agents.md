# LangChain.js -- Agent Examples

> Agent creation with `createAgent()`, custom state, middleware, chat history, and streaming agents. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Setup, LCEL chains, prompt templates
- [structured-output-tools.md](structured-output-tools.md) -- Structured output and tool definition
- [rag.md](rag.md) -- RAG pipelines
- [streaming.md](streaming.md) -- Streaming patterns

---

## Basic Agent with createAgent()

```typescript
import { createAgent } from "langchain";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const search = tool(
  async ({ query }) => {
    // In production, call a real search API
    return `Search results for: ${query}`;
  },
  {
    name: "search",
    description: "Search for information on the web",
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  },
);

const calculator = tool(
  async ({ expression }) => {
    return String(eval(expression));
  },
  {
    name: "calculator",
    description: "Evaluate a mathematical expression",
    schema: z.object({
      expression: z.string().describe("Math expression to evaluate"),
    }),
  },
);

const agent = createAgent({
  model: "openai:gpt-4.1",
  tools: [search, calculator],
  systemPrompt: "You are a helpful research assistant. Use tools when needed.",
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "What is 42 * 17?" }],
});
console.log(result.messages.at(-1));
```

---

## Agent with Streaming Output

```typescript
import { createAgent } from "langchain";

const agent = createAgent({
  model: "openai:gpt-4.1",
  tools: [search],
  systemPrompt: "You are a helpful assistant.",
});

// Stream intermediate steps and final response
const stream = await agent.stream(
  { messages: [{ role: "user", content: "Research LangChain.js" }] },
  { streamMode: "values" },
);

for await (const step of stream) {
  const lastMessage = step.messages.at(-1);
  if (lastMessage) {
    console.log(
      `[${lastMessage.constructor.name}]`,
      lastMessage.text ?? lastMessage.content,
    );
  }
}
```

---

## Agent with Chat History

```typescript
import { createAgent } from "langchain";

const agent = createAgent({
  model: "openai:gpt-4.1",
  tools: [search],
  systemPrompt: "You are a helpful assistant.",
});

// First turn
const result1 = await agent.invoke({
  messages: [{ role: "user", content: "What is LangChain?" }],
});

// Second turn with full history
const result2 = await agent.invoke({
  messages: [
    { role: "user", content: "What is LangChain?" },
    { role: "assistant", content: result1.messages.at(-1)?.text ?? "" },
    { role: "user", content: "How does it compare to direct SDK usage?" },
  ],
});
```

---

## Agent with Custom State

```typescript
import { createAgent } from "langchain";
import { StateSchema, MessagesValue } from "@langchain/langgraph";
import { z } from "zod";

// Extend agent state with custom fields
const CustomState = new StateSchema({
  messages: MessagesValue,
  userPreferences: z.record(z.string(), z.string()),
  sessionId: z.string(),
});

const agent = createAgent({
  model: "openai:gpt-4.1",
  tools: [search],
  stateSchema: CustomState,
  systemPrompt: "You are a personalized assistant.",
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "Find me a restaurant" }],
  userPreferences: { cuisine: "Italian", priceRange: "moderate" },
  sessionId: "session-123",
});
```

---

## Agent with Middleware

```typescript
import { createAgent, createMiddleware } from "langchain";

// Logging middleware
const loggingMiddleware = createMiddleware({
  name: "LoggingMiddleware",
  wrapModelCall: async (request, handler) => {
    console.log(`[LLM Call] ${request.messages.length} messages`);
    const start = Date.now();
    const result = await handler(request);
    const elapsed = Date.now() - start;
    console.log(`[LLM Response] ${elapsed}ms`);
    return result;
  },
});

const agent = createAgent({
  model: "openai:gpt-4.1",
  tools: [search],
  middleware: [loggingMiddleware],
});
```

---

## Legacy Pattern: AgentExecutor (Avoid for New Code)

```typescript
// This pattern is DEPRECATED -- use createAgent() instead
// Shown here only for reference when maintaining existing code
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant."],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
  new MessagesPlaceholder("agent_scratchpad"),
]);

const llm = new ChatOpenAI({ model: "gpt-4.1", temperature: 0 });
const agent = createToolCallingAgent({ llm, tools: [search], prompt });
const executor = new AgentExecutor({ agent, tools: [search] });

const result = await executor.invoke({
  input: "What is LangChain?",
  chat_history: [],
});
console.log(result.output);
```

**Why this is legacy:** `AgentExecutor` does not integrate with LangGraph state management, does not support custom state schemas, and is harder to extend with middleware.

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
