---
name: ai-patterns-tool-use-patterns
description: Provider-agnostic patterns for LLM function calling, tool loops, and agentic workflows
---

# Tool Use Patterns

> **Quick Guide:** Tool use (function calling) lets LLMs invoke external functions. The universal pattern is: define tool schemas (JSON Schema for parameters) -> send tools + message to LLM -> detect tool_use in response -> execute locally -> return result to LLM -> repeat until the model responds with text. Guard every loop with a max-step limit, validate all tool inputs before execution, and return structured errors so the model can recover. Use tool choice control (`auto`, `required`, `none`, specific tool) to steer model behavior.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST guard every tool loop with a maximum step limit -- unbounded loops risk infinite API calls and runaway costs)**

**(You MUST validate all tool input arguments before execution -- LLM-generated arguments are untrusted input)**

**(You MUST return structured error messages to the model when tool execution fails -- never silently swallow errors or return empty results)**

**(You MUST use JSON Schema for tool parameter definitions -- all major providers require this format)**

**(You MUST treat tool definitions as token cost -- every tool schema is sent on every API call, so keep descriptions concise but precise)**

</critical_requirements>

---

**Auto-detection:** tool use, function calling, tool_calls, tool_use, tool call loop, agent loop, tool definition, tool schema, toolChoice, tool_choice, parallel tool calls, human-in-the-loop, tool approval, agentic workflow, multi-step agent, tool result, tool error

**When to use:**

- Implementing LLM tool calling / function calling in any provider
- Building agent loops that call tools iteratively until a task is complete
- Handling parallel tool calls (multiple tools in one response)
- Reporting tool errors back to the model for recovery
- Controlling tool selection (auto, required, none, force specific)
- Adding human approval gates before dangerous tool execution
- Streaming responses that include tool calls

**Key patterns covered:**

- Tool definition schemas (JSON Schema for parameters, descriptions)
- The core tool call loop (send -> detect -> execute -> return -> re-send)
- Parallel tool calls (handling multiple calls in one response)
- Error handling (reporting tool failures back to the model)
- Tool choice control (auto, required, none, specific tool)
- Multi-step agent workflows with conversation state
- Human-in-the-loop approval patterns
- Type-safe tool definitions in TypeScript
- Security (input validation, sandboxing, least privilege)
- Streaming with tool calls

**When NOT to use:**

- Simple text generation without tool calling -- no tools needed
- Structured output / JSON extraction -- use your provider's structured output feature instead
- Provider-specific SDK patterns -- use your provider's SDK skill for SDK-specific APIs

**Detailed Resources:**

- [examples/core.md](examples/core.md) -- Tool definitions, the tool call loop, error handling, type-safe tools
- [examples/advanced.md](examples/advanced.md) -- Parallel tool calls, multi-step agents, human-in-the-loop, streaming, security
- [reference.md](reference.md) -- Decision frameworks, provider comparison, anti-pattern checklist

---

<philosophy>

## Philosophy

Tool use is the mechanism that turns LLMs from text generators into agents. The model cannot execute code, query databases, or call APIs -- it can only _request_ that your code does so by emitting structured tool calls. Your code is the executor; the model is the planner.

**Core principles:**

1. **The model plans, you execute** -- The LLM emits tool call requests with structured arguments. Your code validates, executes, and returns results. Never let the model execute arbitrary code directly.
2. **Agents are loops** -- Every agent, from a simple weather bot to a complex coding assistant, follows the same loop: LLM decides -> system executes -> results feed back -> repeat. Complexity comes from the tools and state, not the loop itself.
3. **Tools are schemas** -- A tool definition is a JSON Schema that tells the model what function exists, what parameters it takes, and when to use it. Better descriptions produce better tool selection and argument quality.
4. **Errors are information** -- When a tool fails, return a structured error message to the model. The model can often recover by retrying with different arguments, choosing a different tool, or explaining the failure to the user.
5. **Defense in depth** -- LLM-generated arguments are untrusted input. Validate schemas, enforce types, limit argument ranges, sandbox execution, and require approval for dangerous operations.

**When to use tool calling:**

- The task requires real-world data the model doesn't have (weather, database, APIs)
- The task requires side effects (sending email, creating records, file operations)
- The task requires multi-step reasoning with intermediate data lookups
- The task requires computation the model can't do reliably (math, code execution)

**When NOT to use tool calling:**

- The model can answer from its training data alone
- You only need structured JSON output (use structured output features instead)
- The "tool" is just prompt engineering disguised as a function
- You want deterministic behavior (tool calling adds non-determinism from model decisions)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Tool Definition Schema

Every tool definition has three parts: a name, a description, and a parameter schema. The description is the most important part -- it guides the model's decision to call the tool and how it constructs arguments.

```typescript
// Provider-agnostic tool definition shape
interface ToolDefinition {
  name: string; // ^[a-zA-Z0-9_-]{1,64}$
  description: string; // When and why to use this tool
  parameters: JsonSchema; // JSON Schema for input arguments
}
```

#### Good Tool Definition

```typescript
// Good: precise description, constrained parameters, .describe() on each property
const VALID_UNITS = ["celsius", "fahrenheit"] as const;

const getWeatherTool: ToolDefinition = {
  name: "get_current_weather",
  description:
    "Get the current weather conditions for a specific city. " +
    "Returns temperature, humidity, and conditions. " +
    "Use this when the user asks about current weather, NOT forecasts.",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "City name and optional country code, e.g. 'London, UK'",
      },
      unit: {
        type: "string",
        enum: VALID_UNITS,
        description: "Temperature unit. Defaults to celsius if not specified.",
      },
    },
    required: ["location"],
  },
};
```

**Why good:** Description explains what the tool returns, when to use it, and when NOT to use it. Parameters have descriptions and constraints (enum). Named constant for valid values.

#### Bad Tool Definition

```typescript
// Bad: vague description, no parameter descriptions, no constraints
const weatherTool: ToolDefinition = {
  name: "weather",
  description: "Gets weather", // BAD: too vague
  parameters: {
    type: "object",
    properties: {
      loc: { type: "string" }, // BAD: no description, cryptic name
      u: { type: "string" }, // BAD: no enum constraint
    },
  },
};
```

**Why bad:** Vague description causes incorrect tool selection, no parameter descriptions cause malformed arguments, no enum constraint causes invalid values, cryptic parameter names confuse the model

---

### Pattern 2: The Core Tool Call Loop

The fundamental pattern for tool use. Send a message with tool definitions, check if the response contains tool calls, execute them, return results, and let the model generate a final response. See [examples/core.md](examples/core.md) for the complete implementation.

```typescript
const MAX_TOOL_STEPS = 10;

for (let step = 0; step < MAX_TOOL_STEPS; step++) {
  const response = await callLLM({ messages, tools });
  if (!response.toolCalls?.length) return response.text;
  messages.push({ role: "assistant", toolCalls: response.toolCalls });
  for (const tc of response.toolCalls) {
    messages.push({
      role: "tool",
      toolCallId: tc.id,
      content: JSON.stringify(await executeTool(tc)),
    });
  }
}
```

**Key points:** Always use a bounded `for` loop with a named constant (`MAX_TOOL_STEPS`) -- never `while (true)`. Always append the assistant message (with tool calls) before tool results. Include graceful termination when the step limit is reached.

---

### Pattern 3: Tool Execution with Error Handling

When a tool fails, return a structured error to the model instead of crashing. The model can often recover by retrying, choosing a different approach, or explaining the failure. See [examples/core.md](examples/core.md) for the complete validation pipeline.

```typescript
// Four-step validation: tool exists -> JSON parses -> schema validates -> execution succeeds
async function executeTool(toolCall: ToolCall): Promise<ToolResult> {
  const handler = toolRegistry[toolCall.name];
  if (!handler)
    return { success: false, error: `Unknown tool: "${toolCall.name}"` };
  const validated = handler.schema.safeParse(toolCall.arguments);
  if (!validated.success)
    return { success: false, error: `Invalid args: ${validated.error}` };
  try {
    return { success: true, data: await handler.execute(validated.data) };
  } catch (error) {
    return {
      success: false,
      error: `Tool failed: ${error instanceof Error ? error.message : "Unknown"}`,
    };
  }
}
```

**Key points:** Always validate tool existence, parse JSON arguments, validate against schema, and catch execution errors. Return structured `{ success, data?, error? }` results so the model can recover. Never crash the loop on tool errors.

---

### Pattern 4: Tool Choice Control

Control whether and how the model uses tools. All major providers support four modes.

```typescript
type ToolChoice =
  | "auto" // Model decides whether to call tools (default)
  | "required" // Model MUST call at least one tool
  | "none" // Model MUST NOT call any tools
  | { name: string }; // Model MUST call this specific tool
```

#### When to Use Each Mode

```typescript
// auto (default) -- let the model decide
const response = await callLLM({
  messages,
  tools,
  toolChoice: "auto",
});

// required -- force tool use (e.g., first step of an agent must act)
const response = await callLLM({
  messages,
  tools,
  toolChoice: "required",
});

// none -- disable tools (e.g., final response must be text only)
const response = await callLLM({
  messages,
  tools,
  toolChoice: "none",
});

// specific tool -- force a particular tool (e.g., classification step)
const response = await callLLM({
  messages,
  tools,
  toolChoice: { name: "classify_intent" },
});
```

**Decision guidance:**

| Mode       | Use When                                                              |
| ---------- | --------------------------------------------------------------------- |
| `auto`     | General-purpose agent -- model decides based on context               |
| `required` | Agent's first step must always call a tool (e.g., data lookup)        |
| `none`     | Final response generation -- no more tool calls allowed               |
| `{ name }` | Pipeline step that must use a specific tool (e.g., extract, classify) |

**When to use:** When you need to constrain or guarantee tool behavior at specific points in a workflow

---

### Pattern 5: Type-Safe Tool Definitions in TypeScript

Use a typed registry pattern with Zod schemas to get compile-time safety for tool definitions and runtime validation for execution. See [examples/core.md](examples/core.md) for the complete `ToolRegistry` class implementation.

```typescript
import { z } from "zod";

// Define tool with schema + execute function -- TypeScript infers argument types
function defineTool<T extends z.ZodType>(config: {
  name: string;
  description: string;
  schema: T;
  execute: (args: z.infer<T>) => Promise<unknown>;
}) {
  return config;
}
```

**When to use:** Any TypeScript project implementing tool calling -- Zod validates at runtime, TypeScript catches schema/handler mismatches at compile time

</patterns>

---

<decision_framework>

## Decision Framework

### Do You Need Tool Calling?

```
Does the task require information the model doesn't have?
+-- YES -> Tool calling (fetch data from APIs, databases, files)
+-- NO -> Does the task require side effects?
    +-- YES -> Tool calling (send email, create record, execute code)
    +-- NO -> Do you need structured JSON output?
        +-- YES -> Use structured output features (NOT tool calling)
        +-- NO -> Plain text generation, no tools needed
```

### Which Loop Pattern?

```
How many tools might the model call?
+-- Single tool call per request
|   +-- Simple request-response with one tool execution
|   +-- No loop needed, just one round-trip
+-- Multiple sequential tool calls
|   +-- Use the bounded tool call loop (Pattern 2)
|   +-- Set MAX_TOOL_STEPS based on task complexity
+-- Multiple parallel tool calls in one response
|   +-- Execute all tool calls concurrently (Promise.all)
|   +-- Then return all results and loop
+-- Complex multi-step agent
    +-- Use the bounded loop with conversation state
    +-- Add human-in-the-loop for dangerous operations
    +-- Consider per-step tool filtering
```

### How to Handle Tool Errors?

```
Tool execution failed. What to do?
+-- Return structured error to the model
|   +-- Include error message and context
|   +-- Model can retry, choose alternative, or explain failure
+-- NEVER: silently return empty result
+-- NEVER: crash the loop
+-- NEVER: retry automatically without telling the model
    (the model should decide whether to retry)
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Unbounded tool loop (`while (true)`) without a step counter -- risks infinite API calls and runaway costs
- Executing tool arguments without validation -- LLM-generated arguments are untrusted input, treat like user input
- Swallowing tool errors silently (returning `null` or `{}`) -- the model cannot recover from failures it doesn't know about
- Allowing arbitrary code execution from tool arguments without sandboxing -- prompt injection can escalate to code execution
- Tool descriptions that say "Gets data" -- vague descriptions cause wrong tool selection and malformed arguments

**Medium Priority Issues:**

- Sending all tools on every API call when only a subset is relevant -- wastes tokens and confuses the model
- Not including the assistant message (with tool calls) in conversation history before tool results -- breaks the message sequence
- Using `tool_choice: "required"` without a fallback for when no tool makes sense -- forces meaningless tool calls
- Returning raw database rows or full API responses as tool results -- overwhelms context with irrelevant data; summarize or truncate
- Not logging tool calls and results -- impossible to debug agent behavior in production

**Common Mistakes:**

- Forgetting that tool call arguments arrive as a JSON string, not a parsed object -- always `JSON.parse()` before use
- Assuming the model will always call tools when tools are available -- with `auto` mode, it may respond with text directly
- Treating tool calling as structured output -- they solve different problems (actions vs data extraction)
- Putting business logic in tool descriptions instead of tool implementations -- descriptions guide selection, not execution

**Gotchas & Edge Cases:**

- Tool definitions consume tokens on every API call -- 10 tools with detailed schemas can use 1000+ tokens per request
- Parallel tool calls may arrive in any order -- never assume execution order matches definition order
- Some models hallucinate tool names or arguments that don't match any definition -- always validate the tool name exists in your registry
- Streaming responses with tool calls require accumulating partial JSON chunks before parsing -- the arguments arrive incrementally, not all at once
- Returning very large tool results (>4000 tokens) can push the conversation past context limits -- truncate or summarize large results
- The model maintains full conversation context including all tool calls and results -- long agent runs accumulate significant token usage
- Different providers use different message formats for tool results (`role: "tool"` vs content blocks) -- abstract this in your callLLM wrapper

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST guard every tool loop with a maximum step limit -- unbounded loops risk infinite API calls and runaway costs)**

**(You MUST validate all tool input arguments before execution -- LLM-generated arguments are untrusted input)**

**(You MUST return structured error messages to the model when tool execution fails -- never silently swallow errors or return empty results)**

**(You MUST use JSON Schema for tool parameter definitions -- all major providers require this format)**

**(You MUST treat tool definitions as token cost -- every tool schema is sent on every API call, so keep descriptions concise but precise)**

**Failure to follow these rules will produce agents that run up API costs in infinite loops, execute unvalidated input, or silently fail without the model being able to recover.**

</critical_reminders>
