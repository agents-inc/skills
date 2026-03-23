# LangChain.js -- Streaming Examples

> Streaming from models, LCEL chains, and agents. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Setup, LCEL chains, prompt templates
- [structured-output-tools.md](structured-output-tools.md) -- Structured output and tool definition
- [agents.md](agents.md) -- Agent creation and tool-calling workflows
- [rag.md](rag.md) -- RAG pipelines

---

## Model Streaming

```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({ model: "gpt-4o" });

const stream = await model.stream(
  "Explain how async generators work in TypeScript.",
);
for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

---

## LCEL Chain Streaming

```typescript
// Streaming propagates through the entire LCEL chain
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const chain = ChatPromptTemplate.fromTemplate("Explain {topic} simply.")
  .pipe(new ChatOpenAI({ model: "gpt-4o" }))
  .pipe(new StringOutputParser());

const stream = await chain.stream({ topic: "quantum computing" });
for await (const chunk of stream) {
  // Each chunk is a string fragment
  process.stdout.write(chunk);
}
```

**Key insight:** Streaming only propagates through components that implement `transform()`. `StringOutputParser` supports streaming. Custom `RunnableLambda` functions do NOT -- they buffer the full input before running.

---

## Streaming with Stream Events

```typescript
// streamEvents gives detailed events for each step in a chain
const chain = prompt.pipe(model).pipe(parser);

const eventStream = chain.streamEvents(
  { topic: "machine learning" },
  { version: "v2" },
);

for await (const event of eventStream) {
  if (event.event === "on_llm_stream") {
    // Token-level streaming from the LLM
    process.stdout.write(event.data.chunk.text);
  }
  if (event.event === "on_chain_end") {
    console.log("\n[Chain complete]");
  }
}
```

**Available events:**

| Event            | When                     |
| ---------------- | ------------------------ |
| `on_llm_start`   | LLM call begins          |
| `on_llm_stream`  | Each token from LLM      |
| `on_llm_end`     | LLM call completes       |
| `on_chain_start` | Chain step begins        |
| `on_chain_end`   | Chain step completes     |
| `on_tool_start`  | Tool execution begins    |
| `on_tool_end`    | Tool execution completes |

---

## Agent Streaming

```typescript
import { createAgent } from "langchain";

const agent = createAgent({
  model: "openai:gpt-4o",
  tools: [searchTool],
  systemPrompt: "You are a helpful assistant.",
});

// Stream with "values" mode -- get full state at each step
const stream = await agent.stream(
  { messages: [{ role: "user", content: "Search for LangChain tutorials" }] },
  { streamMode: "values" },
);

for await (const step of stream) {
  const lastMsg = step.messages.at(-1);
  if (lastMsg) {
    // Could be AIMessage (thinking), ToolMessage (result), or final answer
    console.log(
      `[${lastMsg.constructor.name}]`,
      lastMsg.text ?? lastMsg.content,
    );
  }
}
```

---

## RAG Chain Streaming

```typescript
import {
  RunnableSequence,
  RunnablePassthrough,
} from "@langchain/core/runnables";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";

const ragChain = RunnableSequence.from([
  {
    context: retriever.pipe(formatDocs),
    question: new RunnablePassthrough(),
  },
  prompt,
  new ChatOpenAI({ model: "gpt-4o" }),
  new StringOutputParser(),
]);

// The retrieval step runs to completion, then the LLM streams
const stream = await ragChain.stream("What are LCEL chains?");
for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

**Note:** The retrieval step (`retriever.pipe(formatDocs)`) does NOT stream -- it runs to completion and returns all documents. The LLM generation step streams token-by-token.

---

## Collecting Streamed Output

```typescript
// If you need both streaming and the final result
const chunks: string[] = [];
const stream = await chain.stream({ topic: "TypeScript" });

for await (const chunk of stream) {
  process.stdout.write(chunk);
  chunks.push(chunk);
}

const fullResponse = chunks.join("");
console.log("\n\nFull response length:", fullResponse.length);
```

---

## Streaming Gotcha: RunnableLambda

```typescript
// BAD: RunnableLambda blocks streaming
import { RunnableLambda } from "@langchain/core/runnables";

const postProcess = RunnableLambda.from((text: string) => text.toUpperCase());

const chain = prompt
  .pipe(model)
  .pipe(new StringOutputParser())
  .pipe(postProcess);
// .stream() will buffer all LLM output, then uppercase the entire result at once
// No progressive output is visible to the user

// GOOD: Use a streaming-compatible Runnable
import { Runnable, type RunnableConfig } from "@langchain/core/runnables";

class StreamingUpperCase extends Runnable<string, string> {
  lc_namespace = ["custom"];

  async invoke(input: string): Promise<string> {
    return input.toUpperCase();
  }

  async *_transform(
    inputGenerator: AsyncGenerator<string>,
    _options: Partial<RunnableConfig>,
  ): AsyncGenerator<string> {
    for await (const chunk of inputGenerator) {
      yield chunk.toUpperCase();
    }
  }
}
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
