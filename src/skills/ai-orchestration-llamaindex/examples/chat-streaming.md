# LlamaIndex.TS -- Chat Engines & Streaming Examples

> Conversational interfaces over indexed data, streaming responses, and system prompt configuration. See [core.md](core.md) for basic setup.

**Prerequisites:** Understand Settings configuration and VectorStoreIndex from [core.md](core.md).

**Related examples:**

- [core.md](core.md) -- Setup, indexing, query engines
- [agents.md](agents.md) -- Agent creation, tools
- [ingestion.md](ingestion.md) -- Text splitters, custom readers

---

## ContextChatEngine -- Basic Usage

```typescript
// chat/context-chat.ts
import {
  VectorStoreIndex,
  ContextChatEngine,
  SimpleDirectoryReader,
  Settings,
} from "llamaindex";
import { openai, OpenAIEmbedding } from "@llamaindex/openai";

Settings.llm = openai({ model: "gpt-4o" });
Settings.embedModel = new OpenAIEmbedding({ model: "text-embedding-3-small" });

const SIMILARITY_TOP_K = 3;

const documents = await new SimpleDirectoryReader().loadData({
  directoryPath: "./data",
});
const index = await VectorStoreIndex.fromDocuments(documents);
const retriever = index.asRetriever({ similarityTopK: SIMILARITY_TOP_K });

const chatEngine = new ContextChatEngine({
  retriever,
  systemPrompt:
    "You are a helpful assistant. Answer questions using the provided context. " +
    "If the context does not contain the answer, say so explicitly.",
});

// First turn
const response1 = await chatEngine.chat({
  message: "What is the return policy?",
});
console.log("Bot:", response1.message.content);

// Follow-up (chat engine remembers history)
const response2 = await chatEngine.chat({
  message: "Does that apply to digital products too?",
});
console.log("Bot:", response2.message.content);
```

**Why good:** Custom system prompt sets behavior, retriever injects relevant context per turn, follow-up questions use conversation history

---

## Streaming Chat Engine

```typescript
const chatEngine = new ContextChatEngine({
  retriever,
  systemPrompt: "You are a concise assistant.",
});

// Stream the response
const stream = await chatEngine.chat({
  message: "Explain the benefits of TypeScript",
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.message.content);
}
console.log(); // Final newline
```

**Why good:** Progressive output for user-facing chat, same engine supports both streaming and non-streaming

---

## Query Engine Streaming

```typescript
const queryEngine = index.asQueryEngine();

// Stream a query response
const stream = await queryEngine.query({
  query: "Summarize the key findings",
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.message.content);
}
```

**Why good:** Same streaming pattern as chat engine, `stream: true` option on query

---

## Chat with Custom Response Synthesizer

```typescript
import {
  ContextChatEngine,
  getResponseSynthesizer,
  responseModeSchema,
} from "llamaindex";

// Use tree_summarize for summarization-heavy conversations
const synthesizer = getResponseSynthesizer(
  responseModeSchema.Enum.tree_summarize,
);

const chatEngine = new ContextChatEngine({
  retriever,
  responseSynthesizer: synthesizer,
  systemPrompt: "Summarize information concisely.",
});
```

**Why good:** Explicit response mode selection, tree_summarize is optimal for summarization tasks

---

## Chat History Management

```typescript
const chatEngine = new ContextChatEngine({ retriever });

// Chat maintains internal history
await chatEngine.chat({ message: "What products do you offer?" });
await chatEngine.chat({ message: "Tell me more about the premium plan." });

// Reset history when starting a new conversation
chatEngine.reset();
await chatEngine.chat({ message: "I have a billing question." });
```

**Why good:** Explicit reset for new conversations, prevents context bleed between sessions

---

## Response Synthesizer Streaming (Standalone)

```typescript
import { getResponseSynthesizer, responseModeSchema } from "llamaindex";

const synthesizer = getResponseSynthesizer(responseModeSchema.Enum.compact);

// Synthesize from nodes directly
const response = await synthesizer.synthesize({
  query: "What are the main themes?",
  nodesWithScore: retrievedNodes,
  stream: true,
});

for await (const chunk of response) {
  process.stdout.write(chunk.message.content);
}
```

**Why good:** Direct synthesizer usage for custom pipelines, bypasses query engine when you have your own retrieval

---

## Express API with Streaming Chat

```typescript
// routes/chat.ts
import { ContextChatEngine } from "llamaindex";
import type { Request, Response } from "express";

// Pre-initialized chat engine (created at startup)
let chatEngine: ContextChatEngine;

async function handleChat(req: Request, res: Response) {
  const { message } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const stream = await chatEngine.chat({ message, stream: true });

  for await (const chunk of stream) {
    const content = chunk.message.content;
    if (content) {
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }

  res.write("data: [DONE]\n\n");
  res.end();
}
```

**Why good:** SSE-compatible streaming, pre-initialized engine avoids per-request overhead, proper headers

---

_For core setup and indexing, see [core.md](core.md). For agent patterns, see [agents.md](agents.md)._
