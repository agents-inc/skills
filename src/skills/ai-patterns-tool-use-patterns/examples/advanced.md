# Tool Use Patterns -- Advanced Examples

> Advanced patterns for parallel tool calls, multi-step agents, human-in-the-loop approval, streaming with tool calls, and security. See [core.md](core.md) for fundamentals.

**Prerequisites**: Understand the tool call loop, tool execution with error handling, and the tool registry from core examples.

---

## Pattern 6: Parallel Tool Calls

When a model requests multiple tool calls in a single response, execute them concurrently for better performance. Four 300ms calls complete in ~300ms total instead of ~1200ms sequentially.

### Good Example -- Concurrent Execution with Individual Error Handling

```typescript
// agent/parallel.ts

async function executeToolCallsInParallel(
  toolCalls: ToolCall[],
): Promise<ToolResultMessage[]> {
  const results = await Promise.allSettled(
    toolCalls.map(async (toolCall) => {
      const result = await executeTool(toolCall);
      return {
        role: "tool" as const,
        toolCallId: toolCall.id,
        content: JSON.stringify(result),
      };
    }),
  );

  return results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    // Promise.allSettled catches individual failures
    return {
      role: "tool" as const,
      toolCallId: toolCalls[index].id,
      content: JSON.stringify({
        success: false,
        error: `Tool execution failed: ${result.reason}`,
      }),
    };
  });
}

// Integration with the tool loop
async function runToolLoopWithParallel(
  userMessage: string,
  tools: ToolDefinition[],
  systemPrompt: string,
): Promise<string> {
  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  const MAX_STEPS = 10;

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await callLLM({ messages, tools });

    if (!response.toolCalls?.length) {
      return response.text;
    }

    messages.push({
      role: "assistant",
      content: response.text ?? null,
      toolCalls: response.toolCalls,
    });

    // Execute all tool calls concurrently
    const toolResults = await executeToolCallsInParallel(response.toolCalls);
    messages.push(...toolResults);
  }

  throw new Error(`Tool loop exceeded ${MAX_STEPS} steps`);
}
```

**Why good:** `Promise.allSettled` executes all calls concurrently and handles individual failures without aborting others. Each tool result is matched to its `toolCallId` regardless of completion order. Failed calls return structured errors so the model can recover.

### Bad Example -- Sequential Execution of Parallel Calls

```typescript
// BAD: Sequential execution wastes time
for (const toolCall of response.toolCalls) {
  const result = await executeTool(toolCall); // Each waits for the previous
  messages.push({
    role: "tool",
    toolCallId: toolCall.id,
    content: JSON.stringify(result),
  });
}
```

**Why bad:** Sequential execution negates the performance benefit of parallel tool calls. If each call takes 300ms, 4 calls take 1200ms instead of 300ms.

---

## Pattern 7: Multi-Step Agent with Conversation State

A complete agent that manages conversation state across multiple tool call rounds, with per-step tool filtering and graceful termination.

### Good Example -- Agent with Step-Aware Tool Control

```typescript
// agent/multi-step.ts
const MAX_AGENT_STEPS = 15;
const SUMMARIZE_AFTER_STEPS = 10;

interface AgentConfig {
  systemPrompt: string;
  tools: ToolRegistry;
  /** Optional: restrict which tools are available at each step */
  getActiveTools?: (step: number, messages: Message[]) => string[];
}

async function runAgent(
  userMessage: string,
  config: AgentConfig,
): Promise<AgentResult> {
  const messages: Message[] = [
    { role: "system", content: config.systemPrompt },
    { role: "user", content: userMessage },
  ];

  const allToolDefs = config.tools.toDefinitions();

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    // Per-step tool filtering (optional)
    const activeToolNames = config.getActiveTools?.(step, messages);
    const tools = activeToolNames
      ? config.tools.subset(activeToolNames)
      : allToolDefs;

    // Context management: summarize conversation if getting long
    if (step === SUMMARIZE_AFTER_STEPS) {
      const summary = await summarizeConversation(messages);
      // Replace middle messages with summary, keep system + first user + recent
      messages.splice(2, messages.length - 4, {
        role: "system",
        content: `Previous conversation summary: ${summary}`,
      });
    }

    const response = await callLLM({ messages, tools, toolChoice: "auto" });

    if (!response.toolCalls?.length) {
      return {
        text: response.text,
        steps: step,
        messages,
      };
    }

    messages.push({
      role: "assistant",
      content: response.text ?? null,
      toolCalls: response.toolCalls,
    });

    const results = await executeToolCallsInParallel(response.toolCalls);
    messages.push(...results);
  }

  // Graceful termination
  const finalResponse = await callLLM({
    messages: [
      ...messages,
      {
        role: "user",
        content:
          "Please provide your final answer based on all information gathered.",
      },
    ],
    tools: [],
    toolChoice: "none",
  });

  return { text: finalResponse.text, steps: MAX_AGENT_STEPS, messages };
}
```

**Why good:** Per-step tool filtering via `getActiveTools` reduces token cost and prevents irrelevant tool calls. Conversation summarization prevents context overflow in long runs. Graceful termination asks the model for a final answer instead of crashing. Parallel tool execution for each step.

---

## Pattern 8: Human-in-the-Loop Approval

For dangerous or irreversible operations, pause the agent loop and wait for human approval before executing.

### Good Example -- Approval Gate Pattern

```typescript
// agent/approval.ts
type ApprovalDecision = "approve" | "reject" | "modify";

interface ApprovalRequest {
  toolName: string;
  arguments: unknown;
  reason: string;
}

interface ApprovalResult {
  decision: ApprovalDecision;
  modifiedArguments?: unknown;
  rejectionReason?: string;
}

// Tools that require human approval before execution
const DANGEROUS_TOOLS = new Set([
  "delete_record",
  "send_email",
  "execute_sql",
  "deploy_service",
  "transfer_funds",
]);

async function executeWithApproval(
  toolCall: ToolCall,
  requestApproval: (req: ApprovalRequest) => Promise<ApprovalResult>,
): Promise<ToolResult> {
  // Non-dangerous tools execute immediately
  if (!DANGEROUS_TOOLS.has(toolCall.name)) {
    return executeTool(toolCall);
  }

  // Request human approval
  const approval = await requestApproval({
    toolName: toolCall.name,
    arguments: toolCall.arguments,
    reason: `Agent wants to call "${toolCall.name}" with these arguments.`,
  });

  switch (approval.decision) {
    case "approve":
      return executeTool(toolCall);

    case "modify":
      // Execute with human-modified arguments
      return executeTool({
        ...toolCall,
        arguments: approval.modifiedArguments ?? toolCall.arguments,
      });

    case "reject":
      // Return rejection to the model so it can adjust
      return {
        success: false,
        error:
          `Action "${toolCall.name}" was rejected by the user. ` +
          `Reason: ${approval.rejectionReason ?? "No reason given"}. ` +
          "Please suggest an alternative approach.",
      };
  }
}
```

**Why good:** Clear separation between safe tools (auto-execute) and dangerous tools (require approval). Three decision options: approve, modify (change arguments), reject. Rejection returns a structured error to the model with the reason, so it can adjust. Named constant set for dangerous tools.

#### Integration with the Tool Loop

```typescript
// In the tool loop, replace executeTool with executeWithApproval:
for (const toolCall of response.toolCalls) {
  const result = await executeWithApproval(toolCall, promptUserForApproval);
  messages.push({
    role: "tool",
    toolCallId: toolCall.id,
    content: JSON.stringify(result),
  });
}
```

---

## Pattern 9: Streaming with Tool Calls

When streaming LLM responses, tool call arguments arrive as partial JSON chunks that must be accumulated before parsing.

### Good Example -- Accumulating Streamed Tool Calls

```typescript
// agent/streaming.ts
interface StreamedToolCall {
  id: string;
  name: string;
  argumentChunks: string[];
}

async function processToolCallStream(
  stream: AsyncIterable<StreamChunk>,
): Promise<{ text: string; toolCalls: ToolCall[] }> {
  let text = "";
  const partialToolCalls = new Map<number, StreamedToolCall>();

  for await (const chunk of stream) {
    // Text content
    if (chunk.type === "text-delta") {
      text += chunk.text;
      // Optionally emit to UI: onTextDelta(chunk.text)
      continue;
    }

    // Tool call start -- model declares it wants to call a tool
    if (chunk.type === "tool-call-start") {
      partialToolCalls.set(chunk.index, {
        id: chunk.toolCallId,
        name: chunk.toolName,
        argumentChunks: [],
      });
      continue;
    }

    // Tool call argument delta -- partial JSON arrives incrementally
    if (chunk.type === "tool-call-delta") {
      const partial = partialToolCalls.get(chunk.index);
      if (partial) {
        partial.argumentChunks.push(chunk.argumentDelta);
      }
      continue;
    }
  }

  // Assemble complete tool calls from accumulated chunks
  const toolCalls: ToolCall[] = Array.from(partialToolCalls.values()).map(
    (partial) => ({
      id: partial.id,
      name: partial.name,
      arguments: partial.argumentChunks.join(""),
    }),
  );

  return { text, toolCalls };
}
```

**Why good:** Accumulates partial argument chunks per tool call index. Handles interleaved text and tool call deltas. Assembles complete tool calls only after the stream ends. Supports multiple concurrent tool calls (indexed by position).

### Bad Example -- Parsing Each Chunk Individually

```typescript
// BAD: Treating each argument chunk as a complete tool call
for await (const chunk of stream) {
  if (chunk.type === "tool-call-delta") {
    // BAD: Partial JSON is not valid -- JSON.parse will throw
    const args = JSON.parse(chunk.argumentDelta);
    await executeTool({ name: chunk.toolName, arguments: args });
  }
}
```

**Why bad:** Argument deltas are partial JSON fragments (e.g., `{"loc` then `ation":` then `"London"}`). Parsing each chunk individually will always fail. Must accumulate all chunks before parsing.

---

## Pattern 10: Security -- Input Validation and Sandboxing

LLM-generated tool arguments are untrusted input. Apply defense-in-depth: validate schemas, enforce permissions, sandbox execution, and rate limit.

### Good Example -- Defense-in-Depth Tool Execution

```typescript
// agent/security.ts
import { z } from "zod";

const TOOL_TIMEOUT_MS = 30_000;
const MAX_TOOL_CALLS_PER_MINUTE = 30;

interface SecureToolConfig {
  schema: z.ZodType;
  execute: (args: unknown) => Promise<unknown>;
  /** Maximum execution time in ms */
  timeoutMs?: number;
  /** Allowed operations (for tools that access external resources) */
  allowedDomains?: string[];
  /** Require human approval */
  requiresApproval?: boolean;
}

async function executeSecurely(
  toolCall: ToolCall,
  config: SecureToolConfig,
): Promise<ToolResult> {
  // 1. Schema validation (reject malformed arguments)
  const validation = config.schema.safeParse(toolCall.arguments);
  if (!validation.success) {
    return {
      success: false,
      error: `Validation failed: ${validation.error.message}`,
    };
  }

  // 2. Domain allowlist (prevent exfiltration via URL arguments)
  if (config.allowedDomains && "url" in validation.data) {
    const url = new URL(validation.data.url as string);
    if (!config.allowedDomains.includes(url.hostname)) {
      return {
        success: false,
        error: `Domain "${url.hostname}" is not in the allowlist.`,
      };
    }
  }

  // 3. Timeout (prevent hung tools from blocking the agent)
  const timeoutMs = config.timeoutMs ?? TOOL_TIMEOUT_MS;

  try {
    const result = await Promise.race([
      config.execute(validation.data),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Tool execution timed out")),
          timeoutMs,
        ),
      ),
    ]);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Execution failed",
    };
  }
}
```

**Why good:** Schema validation before execution catches malformed arguments. Domain allowlist prevents data exfiltration through URL parameters. Timeout prevents hung tools from blocking the agent indefinitely. Named constants for timeout and rate limits.

### Security Checklist

```typescript
// Defense-in-depth layers for tool execution:
//
// 1. VALIDATE: Parse arguments with Zod schema (reject malformed input)
// 2. AUTHORIZE: Check that the tool is in the allowed set for this context
// 3. CONSTRAIN: Enforce allowlists for URLs, file paths, SQL tables
// 4. TIMEOUT: Wrap execution in a timeout to prevent hangs
// 5. SANDBOX: Run code execution tools in isolated environments
// 6. RATE LIMIT: Cap tool calls per time window to prevent abuse
// 7. AUDIT: Log every tool call with arguments and results
// 8. APPROVE: Require human approval for destructive operations
```

---

## Pattern 11: Per-Step Tool Filtering

Reduce token cost and improve model focus by only sending relevant tools at each step. A research agent's first step needs `search`, not `send_email`.

### Good Example -- Step-Aware Tool Selection

```typescript
// agent/tool-filter.ts
type AgentPhase = "research" | "analysis" | "action" | "report";

const PHASE_TOOLS: Record<AgentPhase, string[]> = {
  research: ["search_web", "search_docs", "fetch_url"],
  analysis: ["analyze_data", "compare_options", "calculate"],
  action: ["create_record", "update_record", "send_notification"],
  report: ["format_report", "generate_chart"],
};

function determinePhase(step: number, messages: Message[]): AgentPhase {
  // Simple heuristic: research first, then analyze, then act, then report
  const toolCallCount = messages.filter((m) => m.role === "tool").length;

  if (toolCallCount === 0) return "research";
  if (step < 5) return "analysis";
  if (step < 10) return "action";
  return "report";
}

// Used with getActiveTools in the agent config:
const agentConfig: AgentConfig = {
  systemPrompt: "You are a research assistant...",
  tools: registry,
  getActiveTools: (step, messages) => {
    const phase = determinePhase(step, messages);
    return PHASE_TOOLS[phase];
  },
};
```

**Why good:** Reduces token cost by only sending relevant tools. Prevents the model from calling irrelevant tools (e.g., `send_email` during research). Phase-based filtering matches natural agent workflow. Named constant for phase-tool mapping.

---

## Pattern 12: Tool Result Caching

For idempotent tools (same input always produces same output), cache results to avoid redundant API calls when the model retries.

### Good Example -- Cache by Tool Name + Arguments

```typescript
// agent/cache.ts
const CACHE_TTL_MS = 60_000;

const toolResultCache = new Map<
  string,
  { result: ToolResult; timestamp: number }
>();

function getCacheKey(toolCall: ToolCall): string {
  return `${toolCall.name}:${JSON.stringify(toolCall.arguments)}`;
}

async function executeWithCache(
  toolCall: ToolCall,
  idempotentTools: Set<string>,
): Promise<ToolResult> {
  // Only cache idempotent tools (read-only operations)
  if (!idempotentTools.has(toolCall.name)) {
    return executeTool(toolCall);
  }

  const key = getCacheKey(toolCall);
  const cached = toolResultCache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  const result = await executeTool(toolCall);
  if (result.success) {
    toolResultCache.set(key, { result, timestamp: Date.now() });
  }

  return result;
}

const IDEMPOTENT_TOOLS = new Set([
  "search_database",
  "get_user",
  "fetch_weather",
  "calculate",
]);
```

**Why good:** Only caches idempotent (read-only) tools -- write operations always execute. TTL prevents stale results. Cache key includes arguments for correct invalidation. Failed results are not cached (retry might succeed). Named constant for TTL.
