# Cohere SDK -- Tool Use & RAG Examples

> Function calling, document grounding, citation handling, and full RAG pipelines. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, chat, streaming, error handling
- [embeddings-rerank.md](embeddings-rerank.md) -- Embeddings, rerank, semantic search pipeline

---

## RAG with Inline Documents

Pass documents directly to `chat()` for grounded answers with automatic citations.

```typescript
import { CohereClientV2 } from "cohere-ai";

const client = new CohereClientV2({ token: process.env.CO_API_KEY });

const response = await client.chat({
  model: "command-a-03-2025",
  messages: [
    { role: "user", content: "What is TypeScript and who created it?" },
  ],
  documents: [
    {
      data: {
        text: "TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.",
        title: "TypeScript Overview",
        url: "https://typescriptlang.org",
      },
    },
    {
      data: {
        text: "TypeScript was developed by Microsoft and first released in 2012.",
        title: "TypeScript History",
      },
    },
  ],
});

// Grounded response text
console.log(response.message.content[0].text);

// Citations show which documents support each claim
if (response.message.citations) {
  for (const citation of response.message.citations) {
    console.log(`"${citation.text}" [${citation.start}-${citation.end}]`);
    for (const source of citation.sources) {
      console.log(`  Source: ${JSON.stringify(source)}`);
    }
  }
}
```

**Why good:** Documents include metadata (title, url) for richer citations, response is grounded in provided facts

---

## V2 Document Format

V2 uses `{ data: { ... } }` format for documents. The `data` object can contain any fields -- the model uses them for grounding.

```typescript
// Good: V2 document format with data wrapper
const documents = [
  { data: { text: "Content here", title: "Title", id: "doc-1" } },
  { data: { text: "More content", source: "internal-wiki" } },
];

// BAD: V1 format (string or flat object) -- does not work with V2
const documents = [
  "Content here", // V1 string format
  { text: "Content", title: "Title" }, // V1 flat object
];
```

**Why bad:** V2 requires the `data` wrapper object. V1 formats cause errors or produce no citations.

---

## Full RAG Pipeline: Embed + Rerank + Chat

```typescript
import { CohereClientV2 } from "cohere-ai";

const client = new CohereClientV2({ token: process.env.CO_API_KEY });

const EMBEDDING_MODEL = "embed-v4.0";
const RERANK_MODEL = "rerank-v4.0-pro";
const CHAT_MODEL = "command-a-03-2025";
const TOP_N = 3;

async function ragQuery(
  query: string,
  corpus: Array<{ text: string; title: string }>,
): Promise<{ answer: string; citations: unknown[] }> {
  // Step 1: Embed the query
  const queryEmbed = await client.embed({
    model: EMBEDDING_MODEL,
    inputType: "search_query",
    texts: [query],
    embeddingTypes: ["float"],
  });

  // Step 2: Retrieve candidates (simplified -- use vector DB in production)
  // In production, use the query embedding against your vector store
  const candidateTexts = corpus.map((doc) => doc.text);

  // Step 3: Rerank for precision
  const reranked = await client.rerank({
    model: RERANK_MODEL,
    query,
    documents: candidateTexts,
    topN: TOP_N,
  });

  // Step 4: Build documents for chat
  const topDocs = reranked.results.map((r) => ({
    data: {
      text: corpus[r.index].text,
      title: corpus[r.index].title,
    },
  }));

  // Step 5: Chat with grounded documents
  const response = await client.chat({
    model: CHAT_MODEL,
    messages: [{ role: "user", content: query }],
    documents: topDocs,
  });

  return {
    answer: response.message.content[0].text,
    citations: response.message.citations ?? [],
  };
}
```

---

## Tool Use: Basic Function Calling

4-step loop: user message -> model returns tool_calls -> execute tools -> return results.

```typescript
import { CohereClientV2 } from "cohere-ai";

const client = new CohereClientV2({ token: process.env.CO_API_KEY });

// Step 1: Define tools with JSON Schema
const tools = [
  {
    type: "function" as const,
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
      },
    },
  },
];

// Step 2: Send user message with tools
const messages: Array<Record<string, unknown>> = [
  { role: "user", content: "What is the weather in Tokyo?" },
];

const response = await client.chat({
  model: "command-a-03-2025",
  messages,
  tools,
});

// Step 3: Check if model wants to call tools
if (response.message.toolCalls && response.message.toolCalls.length > 0) {
  // CRITICAL: Append the FULL assistant message (including tool_calls and tool_plan)
  messages.push({
    role: "assistant",
    toolPlan: response.message.toolPlan,
    toolCalls: response.message.toolCalls,
  });

  // Step 4: Execute each tool and append results
  for (const toolCall of response.message.toolCalls) {
    const args = JSON.parse(toolCall.function.arguments);

    // Execute the actual function (simplified)
    const result = await getWeather(args.location, args.unit);

    // Append tool result with matching tool_call_id
    messages.push({
      role: "tool",
      toolCallId: toolCall.id,
      content: [
        {
          type: "document",
          document: { data: JSON.stringify(result) },
        },
      ],
    });
  }

  // Step 5: Get final response with grounded citations
  const finalResponse = await client.chat({
    model: "command-a-03-2025",
    messages,
    tools,
  });

  console.log(finalResponse.message.content[0].text);

  // Citations reference the tool outputs
  if (finalResponse.message.citations) {
    for (const citation of finalResponse.message.citations) {
      console.log(`"${citation.text}": ${JSON.stringify(citation.sources)}`);
    }
  }
}
```

---

## Tool Use: Multiple Tools

```typescript
const tools = [
  {
    type: "function" as const,
    function: {
      name: "search_docs",
      description: "Search documentation and return relevant snippets",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          topK: { type: "integer", description: "Max results" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_user_info",
      description: "Get information about a user by ID",
      parameters: {
        type: "object",
        properties: {
          userId: { type: "string", description: "User ID" },
        },
        required: ["userId"],
      },
    },
  },
];

// The model may call multiple tools in a single response
// Process ALL tool calls before sending results back
const response = await client.chat({
  model: "command-a-03-2025",
  messages: [
    { role: "user", content: "Find docs about auth and look up user 123" },
  ],
  tools,
});

if (response.message.toolCalls) {
  messages.push({
    role: "assistant",
    toolPlan: response.message.toolPlan,
    toolCalls: response.message.toolCalls,
  });

  // Execute ALL tool calls
  for (const toolCall of response.message.toolCalls) {
    const args = JSON.parse(toolCall.function.arguments);
    const fn = functionMap[toolCall.function.name];
    const result = await fn(args);

    messages.push({
      role: "tool",
      toolCallId: toolCall.id,
      content: [
        { type: "document", document: { data: JSON.stringify(result) } },
      ],
    });
  }

  // Model generates final response using all tool results
  const finalResponse = await client.chat({
    model: "command-a-03-2025",
    messages,
    tools,
  });
}
```

---

## Tool Result Document Format

Tool results use the document format with `type: "document"` and `data`.

```typescript
// Good: Document format with data
messages.push({
  role: "tool",
  toolCallId: toolCall.id,
  content: [
    {
      type: "document",
      document: {
        data: JSON.stringify({
          temperature: 22,
          condition: "sunny",
          location: "Tokyo",
        }),
      },
    },
  ],
});

// BAD: Plain string content
messages.push({
  role: "tool",
  toolCallId: toolCall.id,
  content: "Temperature: 22, Condition: sunny", // May work but no citation grounding
});
```

**Why bad:** Using plain strings instead of document format means the model cannot generate fine-grained citations referencing specific fields from the tool output.

---

## Streaming with Tool Use

```typescript
const stream = await client.chatStream({
  model: "command-a-03-2025",
  messages: [{ role: "user", content: "What is the weather in Paris?" }],
  tools,
});

let toolPlan = "";
const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
let currentToolCall: { id: string; name: string; arguments: string } | null =
  null;

for await (const event of stream) {
  switch (event.type) {
    case "tool-plan-delta":
      // Model's reasoning about which tools to call
      toolPlan += event.delta?.message?.toolPlan ?? "";
      break;

    case "tool-call-start":
      currentToolCall = {
        id: event.delta?.message?.toolCalls?.id ?? "",
        name: event.delta?.message?.toolCalls?.function?.name ?? "",
        arguments: "",
      };
      break;

    case "tool-call-delta":
      if (currentToolCall) {
        currentToolCall.arguments +=
          event.delta?.message?.toolCalls?.function?.arguments ?? "";
      }
      break;

    case "tool-call-end":
      if (currentToolCall) {
        toolCalls.push(currentToolCall);
        currentToolCall = null;
      }
      break;

    case "content-delta":
      process.stdout.write(event.delta?.message?.content?.text ?? "");
      break;

    case "message-end":
      console.log(`\nFinish reason: ${event.delta?.finishReason}`);
      break;
  }
}

// If tool calls were collected, execute them and continue the conversation
if (toolCalls.length > 0) {
  // ... execute tools and submit results as shown in previous examples
}
```

---

## Citation Processing Helper

```typescript
interface ProcessedCitation {
  text: string;
  start: number;
  end: number;
  sourceIds: string[];
}

function processCitations(
  responseText: string,
  citations: Array<{
    start: number;
    end: number;
    text: string;
    sources: unknown[];
  }>,
): ProcessedCitation[] {
  return citations.map((c) => ({
    text: c.text,
    start: c.start,
    end: c.end,
    sourceIds: c.sources.map((s: { id?: string }) => s.id ?? "unknown"),
  }));
}

// Use with any response that has citations
const response = await client.chat({
  model: "command-a-03-2025",
  messages: [{ role: "user", content: "Tell me about TypeScript." }],
  documents: [{ data: { text: "TypeScript was created by Microsoft." } }],
});

if (response.message.citations) {
  const processed = processCitations(
    response.message.content[0].text,
    response.message.citations,
  );
  console.log("Citations:", processed);
}
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
