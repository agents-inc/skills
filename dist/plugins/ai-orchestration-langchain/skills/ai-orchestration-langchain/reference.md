# LangChain.js Quick Reference

> Package map, import paths, model IDs, environment variables, and key API signatures. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Package Installation

```bash
# Core (always required as peer dependency)
npm install @langchain/core

# Main package (chains, agents, higher-level composables)
npm install langchain

# Provider packages (install the ones you need)
npm install @langchain/openai          # ChatOpenAI, OpenAIEmbeddings
npm install @langchain/anthropic       # ChatAnthropic
npm install @langchain/google-genai    # ChatGoogleGenerativeAI

# RAG utilities
npm install @langchain/textsplitters   # RecursiveCharacterTextSplitter
npm install @langchain/community       # Document loaders, community integrations

# Vector stores (pick one for production)
npm install @langchain/classic         # MemoryVectorStore (prototyping only)
```

**Version alignment is critical.** All `@langchain/*` packages must share the same `@langchain/core` version. Check with:

```bash
npm ls @langchain/core
```

If you see multiple versions, add `overrides` (npm) or `resolutions` (yarn) to your `package.json`:

```json
{
  "overrides": {
    "@langchain/core": "^0.3.40"
  }
}
```

---

## Import Path Map

| What                                                                            | Import Path                              |
| ------------------------------------------------------------------------------- | ---------------------------------------- |
| `ChatOpenAI`, `OpenAIEmbeddings`                                                | `@langchain/openai`                      |
| `ChatAnthropic`                                                                 | `@langchain/anthropic`                   |
| `ChatGoogleGenerativeAI`                                                        | `@langchain/google-genai`                |
| `ChatPromptTemplate`, `MessagesPlaceholder`                                     | `@langchain/core/prompts`                |
| `StringOutputParser`, `JsonOutputParser`                                        | `@langchain/core/output_parsers`         |
| `StructuredOutputParser`                                                        | `@langchain/core/output_parsers`         |
| `RunnableSequence`, `RunnablePassthrough`, `RunnableParallel`, `RunnableLambda` | `@langchain/core/runnables`              |
| `tool`, `DynamicStructuredTool`, `StructuredTool`                               | `@langchain/core/tools`                  |
| `HumanMessage`, `AIMessage`, `SystemMessage`                                    | `@langchain/core/messages`               |
| `RecursiveCharacterTextSplitter`                                                | `@langchain/textsplitters`               |
| `MemoryVectorStore`                                                             | `@langchain/classic/vectorstores/memory` |
| `createAgent`                                                                   | `langchain`                              |
| `initChatModel`                                                                 | `langchain`                              |
| `AgentExecutor`, `createToolCallingAgent`                                       | `langchain/agents` (legacy)              |
| `Document`                                                                      | `@langchain/core/documents`              |

---

## Environment Variables

| Variable                         | Purpose                                                                |
| -------------------------------- | ---------------------------------------------------------------------- |
| `OPENAI_API_KEY`                 | OpenAI API key (auto-detected by `ChatOpenAI`)                         |
| `ANTHROPIC_API_KEY`              | Anthropic API key (auto-detected by `ChatAnthropic`)                   |
| `GOOGLE_API_KEY`                 | Google AI API key (auto-detected by `ChatGoogleGenerativeAI`)          |
| `LANGCHAIN_TRACING_V2`           | Set to `true` to enable LangSmith tracing                              |
| `LANGCHAIN_API_KEY`              | LangSmith API key                                                      |
| `LANGCHAIN_PROJECT`              | LangSmith project name (default: `default`)                            |
| `LANGCHAIN_CALLBACKS_BACKGROUND` | Set to `true` in non-serverless environments to reduce tracing latency |

---

## Chat Model Configuration

```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "gpt-4o", // Required: model ID
  temperature: 0, // 0-2 (default: 1)
  maxTokens: 1000, // Max output tokens
  timeout: 30_000, // Request timeout in ms
  maxRetries: 2, // Retry count on transient errors
  apiKey: undefined, // Auto-reads from env
});
```

### Common Model IDs

| Provider  | Model ID                   | Notes                |
| --------- | -------------------------- | -------------------- |
| OpenAI    | `gpt-4o`                   | General purpose      |
| OpenAI    | `gpt-4o-mini`              | Cost-optimized       |
| OpenAI    | `o4-mini`                  | Reasoning model      |
| Anthropic | `claude-sonnet-4-20250514` | General purpose      |
| Anthropic | `claude-haiku-3-20250120`  | Fast, cost-optimized |
| Google    | `gemini-2.5-flash-lite`    | Fast, cost-optimized |

### Embedding Model IDs

| Provider | Model ID                 | Import                                      |
| -------- | ------------------------ | ------------------------------------------- |
| OpenAI   | `text-embedding-3-small` | `OpenAIEmbeddings` from `@langchain/openai` |
| OpenAI   | `text-embedding-3-large` | `OpenAIEmbeddings` from `@langchain/openai` |

---

## Runnable Interface

Every LangChain component implements the Runnable interface:

```typescript
interface Runnable<Input, Output> {
  invoke(input: Input): Promise<Output>;
  stream(input: Input): AsyncGenerator<Output>;
  batch(inputs: Input[]): Promise<Output[]>;
  pipe<NewOutput>(next: Runnable<Output, NewOutput>): RunnableSequence;
}
```

### Key Runnable Types

| Type                  | Purpose                                                  | Import                      |
| --------------------- | -------------------------------------------------------- | --------------------------- |
| `RunnableSequence`    | Chain of steps (created by `.pipe()`)                    | `@langchain/core/runnables` |
| `RunnablePassthrough` | Pass input through unchanged, optionally assign new keys | `@langchain/core/runnables` |
| `RunnableParallel`    | Run multiple runnables in parallel on same input         | `@langchain/core/runnables` |
| `RunnableLambda`      | Wrap a plain function as a Runnable                      | `@langchain/core/runnables` |

---

## Prompt Template Patterns

```typescript
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

// Single-template (creates one user message)
ChatPromptTemplate.fromTemplate("Summarize: {text}");

// Multi-message template
ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant."],
  ["human", "{input}"],
]);

// With chat history placeholder
ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant."],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
]);
```

**Role names:** `system`, `human`, `ai` (NOT `developer`, `user`, `assistant`)

---

## Output Parser Types

| Parser                   | Output Type                                   | Import                           |
| ------------------------ | --------------------------------------------- | -------------------------------- |
| `StringOutputParser`     | `string`                                      | `@langchain/core/output_parsers` |
| `JsonOutputParser`       | `Record<string, unknown>`                     | `@langchain/core/output_parsers` |
| `StructuredOutputParser` | Typed object (from Zod)                       | `@langchain/core/output_parsers` |
| `withStructuredOutput()` | Typed object (from Zod, via function calling) | Method on chat models            |

---

## Tool Definition

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const myTool = tool(
  async (input) => {
    return "result";
  },
  {
    name: "tool_name", // snake_case required
    description: "What this tool does",
    schema: z.object({
      param: z.string().describe("Description for the model"),
    }),
  },
);
```

---

## Legacy vs Current API

| Legacy (Deprecated)                        | Current (Use This)                                      |
| ------------------------------------------ | ------------------------------------------------------- |
| `LLMChain`                                 | LCEL: `prompt.pipe(model).pipe(parser)`                 |
| `ConversationChain`                        | LCEL with `MessagesPlaceholder`                         |
| `SequentialChain`                          | LCEL: `chain1.pipe(chain2)`                             |
| `AgentExecutor` + `createToolCallingAgent` | `createAgent()`                                         |
| `BufferMemory`                             | LangGraph checkpointing or `RunnableWithMessageHistory` |
| `ConversationSummaryMemory`                | LangGraph with summary nodes                            |
| `langchain/text_splitter`                  | `@langchain/textsplitters`                              |
