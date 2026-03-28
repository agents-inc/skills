# LangChain.js -- Setup, LCEL & Chat Model Examples

> Client initialization, provider switching, LCEL chain composition, prompt templates, and output parsers. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [structured-output-tools.md](structured-output-tools.md) -- Structured output and tool definition
- [agents.md](agents.md) -- Agent creation and tool-calling workflows
- [rag.md](rag.md) -- RAG pipelines
- [streaming.md](streaming.md) -- Streaming patterns

---

## Chat Model Initialization

```typescript
// lib/llm.ts
import { ChatOpenAI } from "@langchain/openai";

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

const model = new ChatOpenAI({
  model: "gpt-4.1",
  temperature: 0,
  timeout: TIMEOUT_MS,
  maxRetries: MAX_RETRIES,
});

export { model };
```

---

## Provider Switching

```typescript
// Switch provider by changing import + model name
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
  temperature: 0,
  maxTokens: 1024,
});
```

```typescript
// Runtime provider selection with initChatModel
import { initChatModel } from "langchain";

const model = await initChatModel("openai:gpt-4.1", {
  temperature: 0,
  maxTokens: 1000,
});

// Switch at runtime:
const anthropicModel = await initChatModel(
  "anthropic:claude-sonnet-4-5-20250929",
);
const googleModel = await initChatModel("google-genai:gemini-2.5-flash");
```

---

## Basic Invoke

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const model = new ChatOpenAI({ model: "gpt-4.1" });

// Simple string invoke
const response = await model.invoke("What is TypeScript?");
console.log(response.text);

// With message objects for multi-turn
const response2 = await model.invoke([
  new SystemMessage("You are a helpful coding assistant."),
  new HumanMessage("Explain generics in TypeScript."),
]);
console.log(response2.text);
```

---

## LCEL Chain with Pipe

```typescript
// Basic LCEL chain: prompt -> model -> parser
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const prompt = ChatPromptTemplate.fromTemplate(
  "Translate the following to {language}: {text}",
);
const model = new ChatOpenAI({ model: "gpt-4.1" });
const parser = new StringOutputParser();

const chain = prompt.pipe(model).pipe(parser);

const result = await chain.invoke({
  language: "French",
  text: "Hello, how are you?",
});
console.log(result); // "Bonjour, comment allez-vous ?"
```

---

## RunnableSequence.from()

```typescript
// Alternative syntax using RunnableSequence.from()
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";

const chain = RunnableSequence.from([
  ChatPromptTemplate.fromTemplate("Tell me a joke about {topic}"),
  new ChatOpenAI({ model: "gpt-4.1" }),
  new StringOutputParser(),
]);

const joke = await chain.invoke({ topic: "programming" });
```

---

## Multi-Message Prompt Template

```typescript
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

// Multi-role prompt with system message and chat history
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a {role}. Answer concisely."],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
]);

// Invoke with variables
import { HumanMessage, AIMessage } from "@langchain/core/messages";

const formattedPrompt = await prompt.invoke({
  role: "TypeScript tutor",
  chat_history: [
    new HumanMessage("What is a type?"),
    new AIMessage("A type describes the shape of data."),
  ],
  input: "Give me an example.",
});
```

**Note:** Role names are `system`, `human`, `ai` -- NOT `developer`, `user`, `assistant`.

---

## RunnablePassthrough and RunnableParallel

```typescript
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";

// RunnablePassthrough.assign adds computed keys to the input
const chain = RunnableSequence.from([
  RunnablePassthrough.assign({
    upperText: (input: { text: string }) => input.text.toUpperCase(),
  }),
  ChatPromptTemplate.fromTemplate(
    "Original: {text}\nUppercase: {upperText}\nSummarize both.",
  ),
  new ChatOpenAI({ model: "gpt-4.1" }),
  new StringOutputParser(),
]);

const result = await chain.invoke({ text: "hello world" });
```

```typescript
// RunnableParallel: run multiple chains on the same input
import { RunnableParallel } from "@langchain/core/runnables";

const parallel = RunnableParallel.from({
  summary: summaryChain,
  keywords: keywordsChain,
  sentiment: sentimentChain,
});

const results = await parallel.invoke({ text: "Some long article..." });
// results: { summary: "...", keywords: "...", sentiment: "..." }
```

---

## RunnableLambda

```typescript
import { RunnableLambda } from "@langchain/core/runnables";

// Wrap a plain function as a Runnable
const toUpperCase = RunnableLambda.from((input: string) => input.toUpperCase());

const chain = prompt
  .pipe(model)
  .pipe(new StringOutputParser())
  .pipe(toUpperCase);
```

**Warning:** `RunnableLambda` does NOT propagate streaming. If you need streaming through a custom function, subclass `Runnable` and implement `transform()`.

---

## Batch Invocation

```typescript
// Process multiple inputs in parallel
const results = await chain.batch([
  { text: "Hello", language: "French" },
  { text: "Goodbye", language: "Spanish" },
  { text: "Thank you", language: "Japanese" },
]);
// results: ["Bonjour", "Adiós", "ありがとう"]
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
