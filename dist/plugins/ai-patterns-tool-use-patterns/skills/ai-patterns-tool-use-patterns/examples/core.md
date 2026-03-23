# Tool Use Patterns -- Core Examples

> Core patterns for tool definitions, the tool call loop, error handling, and type-safe tools. See [advanced.md](advanced.md) for parallel calls, multi-step agents, human-in-the-loop, and security.

**Prerequisites**: Understand the tool calling flow: define tools -> send to LLM -> detect tool calls -> execute -> return results -> repeat.

---

## Pattern 1: Complete Tool Definition with JSON Schema

Tool definitions tell the model what functions are available, what they do, and what arguments they accept. The schema uses JSON Schema format, which all major providers require.

### Good Example -- Precise, Constrained Definition

```typescript
// tools/definitions.ts
const MAX_SEARCH_RESULTS = 50;
const VALID_SORT_OPTIONS = ["relevance", "date", "popularity"] as const;

const searchDocsTool: ToolDefinition = {
  name: "search_documentation",
  description:
    "Search the project documentation for pages matching a query. " +
    "Returns titles, URLs, and relevance scores. " +
    "Use when the user asks about project features, configuration, or troubleshooting. " +
    "Do NOT use for general programming questions unrelated to this project.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Natural language search query. Be specific -- " +
          "'authentication setup' works better than 'auth'.",
        minLength: 1,
        maxLength: 200,
      },
      section: {
        type: "string",
        description:
          "Limit search to a specific docs section. " +
          "One of: 'guides', 'api-reference', 'troubleshooting', 'changelog'.",
        enum: ["guides", "api-reference", "troubleshooting", "changelog"],
      },
      limit: {
        type: "integer",
        description: `Number of results to return. Max ${MAX_SEARCH_RESULTS}.`,
        minimum: 1,
        maximum: MAX_SEARCH_RESULTS,
        default: 10,
      },
      sortBy: {
        type: "string",
        description: "How to order results.",
        enum: VALID_SORT_OPTIONS,
        default: "relevance",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
};
```

**Why good:** Description explains what the tool returns, when to use it, and when NOT to use it. Each parameter has a description with examples. Numeric parameters have min/max constraints. Enum parameters restrict values to valid options. `additionalProperties: false` prevents hallucinated extra fields. Named constants for limits.

### Bad Example -- Vague, Unconstrained Definition

```typescript
// BAD: Everything wrong with tool definitions
const badSearchTool: ToolDefinition = {
  name: "search", // Too generic, collides with other tools
  description: "Searches for stuff", // Useless description
  parameters: {
    type: "object",
    properties: {
      q: { type: "string" }, // Cryptic name, no description
      n: { type: "number" }, // No constraints, could be negative or 99999
      sort: { type: "string" }, // No enum, model will hallucinate values
    },
    // No required fields -- model might omit the query entirely
  },
};
```

**Why bad:** Generic name risks collision. No description guidance means wrong tool selection. Cryptic parameter names produce worse argument quality. No constraints means invalid values (negative limit, unknown sort). No `required` means the model might omit essential fields.

---

## Pattern 2: The Tool Call Loop -- Complete Implementation

The full implementation of the request-tool-respond cycle with proper error handling and conversation state management.

### Good Example -- Bounded Loop with Full State

```typescript
// agent/tool-loop.ts
import type { Message, ToolCall, LLMResponse } from "./types";

const MAX_TOOL_STEPS = 10;

interface ToolLoopResult {
  text: string;
  toolCallsExecuted: number;
  messages: Message[];
}

async function runToolLoop(
  userMessage: string,
  tools: ToolDefinition[],
  systemPrompt: string,
): Promise<ToolLoopResult> {
  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  let toolCallsExecuted = 0;

  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    const response: LLMResponse = await callLLM({
      messages,
      tools,
      toolChoice: "auto",
    });

    // Model responded with text (no tool calls) -- we're done
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return {
        text: response.text,
        toolCallsExecuted,
        messages,
      };
    }

    // CRITICAL: Append the assistant message WITH tool calls to history
    // before appending tool results. The message sequence must be:
    // assistant (with tool_calls) -> tool result(s) -> next assistant
    messages.push({
      role: "assistant",
      content: response.text ?? null,
      toolCalls: response.toolCalls,
    });

    // Execute each tool call and append results
    for (const toolCall of response.toolCalls) {
      const result = await executeTool(toolCall);
      messages.push({
        role: "tool",
        toolCallId: toolCall.id,
        content: JSON.stringify(result),
      });
      toolCallsExecuted++;
    }
  }

  // Exhausted step limit -- ask the model to wrap up without tools
  messages.push({
    role: "user",
    content:
      "You have reached the maximum number of tool calls. " +
      "Please provide your best answer based on the information gathered so far.",
  });

  const finalResponse = await callLLM({
    messages,
    tools,
    toolChoice: "none", // Force text-only response
  });

  return {
    text: finalResponse.text,
    toolCallsExecuted,
    messages,
  };
}
```

**Why good:** Bounded loop with named constant `MAX_TOOL_STEPS`. Assistant message (with tool calls) is appended before tool results, maintaining correct message sequence. Graceful degradation when step limit is reached (asks model to summarize). Returns metadata (calls executed, full message history) for logging. Uses `toolChoice: "none"` to force final text response.

### Bad Example -- Broken Message Sequence

```typescript
// BAD: Missing assistant message in conversation history
async function brokenLoop(message: string): Promise<string> {
  const messages = [{ role: "user", content: message }];
  for (let i = 0; i < 5; i++) {
    const response = await callLLM({ messages, tools });
    if (!response.toolCalls?.length) return response.text;

    // BAD: Tool results added without the preceding assistant message
    // Most providers will reject this message sequence
    for (const tc of response.toolCalls) {
      const result = await executeTool(tc);
      messages.push({
        role: "tool",
        toolCallId: tc.id,
        content: JSON.stringify(result),
      });
    }
  }
  return "Failed"; // BAD: generic error, no graceful degradation
}
```

**Why bad:** Missing assistant message before tool results breaks the message sequence (most providers reject this). Generic "Failed" string instead of asking the model to summarize. No metadata returned for debugging.

---

## Pattern 3: Tool Execution with Validation and Error Reporting

The tool executor validates arguments, catches errors, and returns structured results the model can reason about.

### Good Example -- Full Validation Pipeline

```typescript
// agent/executor.ts
import { z } from "zod";

interface ToolHandler {
  schema: z.ZodType;
  execute: (args: unknown) => Promise<unknown>;
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

const toolRegistry: Record<string, ToolHandler> = {};

function registerTool(
  name: string,
  schema: z.ZodType,
  execute: (args: unknown) => Promise<unknown>,
): void {
  toolRegistry[name] = { schema, execute };
}

async function executeTool(toolCall: ToolCall): Promise<ToolResult> {
  // 1. Validate tool exists
  const handler = toolRegistry[toolCall.name];
  if (!handler) {
    return {
      success: false,
      error:
        `Unknown tool: "${toolCall.name}". ` +
        `Available tools: ${Object.keys(toolRegistry).join(", ")}`,
    };
  }

  // 2. Parse arguments (they arrive as a JSON string)
  let parsedArgs: unknown;
  try {
    parsedArgs =
      typeof toolCall.arguments === "string"
        ? JSON.parse(toolCall.arguments)
        : toolCall.arguments;
  } catch {
    return {
      success: false,
      error: `Invalid JSON in arguments for "${toolCall.name}": ${toolCall.arguments}`,
    };
  }

  // 3. Validate arguments against schema
  const validation = handler.schema.safeParse(parsedArgs);
  if (!validation.success) {
    const issues = validation.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      success: false,
      error: `Invalid arguments for "${toolCall.name}": ${issues}`,
    };
  }

  // 4. Execute with error boundary
  try {
    const data = await handler.execute(validation.data);
    return { success: true, data };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown execution error";
    return {
      success: false,
      error: `Tool "${toolCall.name}" execution failed: ${message}`,
    };
  }
}
```

**Why good:** Four-step validation pipeline: tool exists -> JSON parses -> schema validates -> execution succeeds. Each failure returns a descriptive error the model can act on. Arguments are parsed from JSON string (how they arrive from most providers). Zod `safeParse` gives field-level error messages. Error boundary catches execution failures without crashing the loop.

### Bad Example -- No Validation, Crashes on Error

```typescript
// BAD: Everything that can go wrong
async function unsafeExecute(toolCall: ToolCall): Promise<unknown> {
  const handler = toolRegistry[toolCall.name]!; // Crashes if missing
  const args = JSON.parse(toolCall.arguments); // Crashes on invalid JSON
  return handler.execute(args); // No schema validation, throws on error
}
```

**Why bad:** Non-null assertion crashes on unknown tool. Unhandled JSON.parse throws on malformed arguments. No schema validation lets invalid data reach execution. Unhandled execution errors crash the entire agent loop.

---

## Pattern 4: Tool Registry Pattern

A typed registry that maps tool names to their handlers, supporting dynamic tool registration and serialization to API format.

### Good Example -- Typed Registry with Serialization

```typescript
// tools/registry.ts
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

interface Tool<T extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: T;
  execute: (args: z.infer<T>) => Promise<unknown>;
}

class ToolRegistry {
  private tools = new Map<string, Tool>();

  register<T extends z.ZodType>(config: {
    name: string;
    description: string;
    schema: T;
    execute: (args: z.infer<T>) => Promise<unknown>;
  }): void {
    this.tools.set(config.name, config);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /** Serialize all tools to the JSON Schema format LLM providers expect */
  toDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.schema, {
        target: "openApi3",
        $refStrategy: "none",
      }),
    }));
  }

  /** Get a subset of tools by name (for per-step filtering) */
  subset(names: string[]): ToolDefinition[] {
    return this.toDefinitions().filter((t) => names.includes(t.name));
  }

  listNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

// Usage
const registry = new ToolRegistry();

registry.register({
  name: "get_user",
  description: "Look up a user by their ID. Returns name, email, and role.",
  schema: z.object({
    userId: z.string().uuid().describe("The user's unique identifier"),
  }),
  execute: async ({ userId }) => {
    return db.users.findById(userId);
  },
});

// Pass to LLM
const response = await callLLM({
  messages,
  tools: registry.toDefinitions(),
});
```

**Why good:** Type-safe registration with Zod schema + inferred execute arguments. `toDefinitions()` serializes to the format LLM providers expect. `subset()` enables per-step tool filtering (reduce token cost). Single source of truth for tool metadata and execution logic.

---

## Pattern 5: Formatting Tool Results

Tool results should be concise, structured, and include only information the model needs to formulate its response.

### Good Example -- Summarized, Structured Results

```typescript
// tools/result-formatter.ts
const MAX_RESULT_LENGTH = 2000;

function formatToolResult(data: unknown): string {
  const json = JSON.stringify(data, null, 2);

  // Truncate oversized results to prevent context overflow
  if (json.length > MAX_RESULT_LENGTH) {
    const truncated = json.slice(0, MAX_RESULT_LENGTH);
    return (
      truncated +
      `\n... [truncated, ${json.length - MAX_RESULT_LENGTH} chars omitted]`
    );
  }

  return json;
}

// For list results, return summary + items
function formatListResult(
  items: unknown[],
  totalCount: number,
  limit: number,
): string {
  return JSON.stringify({
    items,
    showing: items.length,
    totalAvailable: totalCount,
    note:
      items.length < totalCount
        ? `Showing ${items.length} of ${totalCount}. Ask the user if they want more.`
        : undefined,
  });
}
```

**Why good:** Truncation prevents context overflow from oversized results. List results include count and pagination hint. Structured JSON is easier for the model to parse than free text. Named constant for max length.

### Bad Example -- Raw Database Dump

```typescript
// BAD: Returning entire database rows
async function rawResult(userId: string): Promise<unknown> {
  // Returns ALL columns including internal IDs, timestamps, soft-delete flags
  return db.query("SELECT * FROM users WHERE id = $1", [userId]);
}
```

**Why bad:** `SELECT *` returns irrelevant internal fields, wasting context tokens. No truncation means a large row set could overflow context. No structure or summary for the model to work with.
