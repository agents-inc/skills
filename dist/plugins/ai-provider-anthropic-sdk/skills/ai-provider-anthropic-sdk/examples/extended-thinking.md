# Anthropic SDK -- Extended Thinking Examples

> Extended thinking configuration, streaming thinking blocks, thinking with tool use, display options, and constraints. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [streaming.md](streaming.md) -- Streaming responses
- [tool-use.md](tool-use.md) -- Tool/function calling
- [vision-documents.md](vision-documents.md) -- Images and PDFs

---

## Adaptive Thinking (Recommended for 4.6 Models)

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MAX_TOKENS = 16_000;

// Adaptive thinking -- Claude decides when and how much to reason
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  thinking: { type: "adaptive" },
  messages: [
    {
      role: "user",
      content: "Are there infinitely many primes p such that p mod 4 = 3?",
    },
  ],
} as unknown as Anthropic.MessageCreateParamsNonStreaming);

// Response may contain thinking blocks BEFORE text blocks
for (const block of response.content) {
  if (block.type === "thinking") {
    console.log("Thinking:", block.thinking);
  } else if (block.type === "text") {
    console.log("\nAnswer:", block.text);
  }
}
```

**Note:** The TypeScript SDK does not yet include `"adaptive"` in its type definitions. The `as unknown as` assertion is required.

---

## Adaptive Thinking with Effort Control

```typescript
const MAX_TOKENS = 16_000;

// Control thinking depth with the effort parameter
const response = await client.messages.create({
  model: "claude-opus-4-6",
  max_tokens: MAX_TOKENS,
  thinking: { type: "adaptive" },
  output_config: { effort: "medium" }, // "max" (Opus only) | "high" (default) | "medium" | "low"
  messages: [{ role: "user", content: "What is the capital of France?" }],
} as unknown as Anthropic.MessageCreateParamsNonStreaming);
```

| Effort level     | Thinking behavior                                             |
| ---------------- | ------------------------------------------------------------- |
| `max`            | Always thinks, no constraints on depth. **Opus 4.6 only.**    |
| `high` (default) | Always thinks. Deep reasoning on complex tasks.               |
| `medium`         | Moderate thinking. May skip for very simple queries.          |
| `low`            | Minimal thinking. Skips for simple tasks where speed matters. |

---

## Manual Extended Thinking (Older Models)

For models before 4.6 (e.g., `claude-sonnet-4-5`, `claude-opus-4-5`), use manual thinking with `budget_tokens`. This is deprecated on 4.6 models but still works.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MAX_TOKENS = 16_000;
const THINKING_BUDGET = 10_000;

const response = await client.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: MAX_TOKENS,
  thinking: {
    type: "enabled",
    budget_tokens: THINKING_BUDGET,
  },
  messages: [
    {
      role: "user",
      content: "Are there infinitely many primes p such that p mod 4 = 3?",
    },
  ],
});

for (const block of response.content) {
  if (block.type === "thinking") {
    console.log("Thinking:", block.thinking);
  } else if (block.type === "text") {
    console.log("\nAnswer:", block.text);
  }
}
```

**Key constraint:** `budget_tokens` must be less than `max_tokens`. Claude may use less than the budget.

---

## Streaming with Adaptive Thinking

```typescript
const MAX_TOKENS = 16_000;

// Using .stream() helper with adaptive thinking
const stream = await client.messages.stream({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  thinking: { type: "adaptive" },
  messages: [{ role: "user", content: "What is the GCD of 1071 and 462?" }],
} as unknown as Anthropic.MessageStreamParams);

stream.on("streamEvent", (event) => {
  if (event.type === "content_block_start") {
    if (event.content_block.type === "thinking") {
      process.stdout.write("\n[Thinking] ");
    } else if (event.content_block.type === "text") {
      process.stdout.write("\n[Answer] ");
    }
  }
  if (event.type === "content_block_delta") {
    if (event.delta.type === "thinking_delta") {
      process.stdout.write(event.delta.thinking);
    } else if (event.delta.type === "text_delta") {
      process.stdout.write(event.delta.text);
    }
  }
});

await stream.done();
```

---

## Streaming with Raw SSE

```typescript
const MAX_TOKENS = 16_000;

const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  thinking: { type: "adaptive" },
  messages: [{ role: "user", content: "Solve: What is 27 * 453?" }],
  stream: true,
} as unknown as Anthropic.MessageCreateParamsStreaming);

for await (const event of response) {
  if (event.type === "content_block_start") {
    const blockType = event.content_block.type;
    console.log(`\nStarting ${blockType} block...`);
  }

  if (event.type === "content_block_delta") {
    if (event.delta.type === "thinking_delta") {
      process.stdout.write(event.delta.thinking);
    } else if (event.delta.type === "text_delta") {
      process.stdout.write(event.delta.text);
    }
  }

  if (event.type === "content_block_stop") {
    console.log("\n(Block complete)");
  }
}
```

---

## Omitted Thinking Display

Use `display: "omitted"` for faster streaming when you do not need to show thinking to users. The model still reasons internally, but thinking text is not transmitted.

```typescript
const MAX_TOKENS = 16_000;

const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  thinking: {
    type: "adaptive",
    display: "omitted", // Thinking blocks have empty .thinking, only .signature
  },
  messages: [{ role: "user", content: "What is 27 * 453?" }],
} as unknown as Anthropic.MessageCreateParamsNonStreaming);

for (const block of response.content) {
  if (block.type === "thinking") {
    // block.thinking is empty, but block.signature is present
    // (needed for multi-turn -- pass it back unmodified)
    console.log("Thinking: [omitted]");
  } else if (block.type === "text") {
    console.log("Answer:", block.text);
  }
}
```

**Benefits:** Faster time-to-first-text in streaming. Same cost (full thinking tokens still billed). Useful for automated pipelines that do not surface thinking to users.

---

## Extended Thinking with Tool Use

Extended thinking works alongside tool use. Claude reasons about which tools to call. Adaptive thinking automatically enables interleaved thinking (thinking between tool calls).

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

const client = new Anthropic();
const MAX_TOKENS = 16_000;

const tools: Anthropic.Messages.Tool[] = [
  {
    name: "get_weather",
    description: "Get current weather for a location",
    input_schema: {
      type: "object" as const,
      properties: { location: { type: "string" } },
      required: ["location"],
    },
  },
];

const messages: MessageParam[] = [
  { role: "user", content: "What is the weather in Paris?" },
];

// First request -- Claude thinks, then calls the tool
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  thinking: { type: "adaptive" },
  tools,
  messages,
} as unknown as Anthropic.MessageCreateParamsNonStreaming);

// CRITICAL: Include ALL content blocks (thinking + tool_use) in history
messages.push({ role: "assistant", content: response.content });

// Execute tool calls
const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
for (const block of response.content) {
  if (block.type === "tool_use") {
    const result = await executeToolCall(block.name, block.input);
    toolResults.push({
      type: "tool_result",
      tool_use_id: block.id,
      content: JSON.stringify(result),
    });
  }
}

// Send tool results back -- KEEP thinking config consistent
messages.push({ role: "user", content: toolResults });

const finalResponse = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  thinking: { type: "adaptive" }, // Same thinking config as first request
  tools,
  messages,
} as unknown as Anthropic.MessageCreateParamsNonStreaming);

for (const block of finalResponse.content) {
  if (block.type === "text") {
    console.log(block.text);
  }
}
```

**Critical rules for thinking + tools:**

1. **Include thinking blocks unmodified** in conversation history. Do not omit or edit them.
2. **Keep thinking parameters identical** between rounds in a tool use loop. Changing `budget_tokens` mid-loop causes errors.
3. **Only `tool_choice: "auto"` and `"none"` work** with thinking enabled. `"any"` and specific tool forcing will error.

---

## Multi-Turn with Thinking History

When continuing a conversation that used thinking, you must pass back the thinking blocks.

```typescript
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

const MAX_TOKENS = 16_000;

const messages: MessageParam[] = [
  { role: "user", content: "Solve this step by step: x^2 + 5x + 6 = 0" },
];

const response1 = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  thinking: { type: "adaptive" },
  messages,
} as unknown as Anthropic.MessageCreateParamsNonStreaming);

// Include ALL content blocks -- thinking + text
messages.push({ role: "assistant", content: response1.content });
messages.push({ role: "user", content: "Now graph this function." });

const response2 = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  thinking: { type: "adaptive" },
  messages,
} as unknown as Anthropic.MessageCreateParamsNonStreaming);
```

---

## Key Constraints Reference

| Constraint           | Details                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| Recommended mode     | `thinking: { type: "adaptive" }` on Opus 4.6 and Sonnet 4.6                                                    |
| `budget_tokens`      | Deprecated on 4.6 models. Must be less than `max_tokens` on older models (except with interleaved thinking)    |
| Tool choice          | Only `"auto"` and `"none"` supported with thinking                                                             |
| Thinking toggle      | Cannot toggle thinking on/off mid-turn during tool use                                                         |
| Thinking blocks      | Must be passed back unmodified in multi-turn history                                                           |
| Display options      | `"summarized"` (default) or `"omitted"`                                                                        |
| Effort parameter     | `output_config: { effort }` -- `"max"` (Opus 4.6 only), `"high"` (default), `"medium"`, `"low"`                |
| Interleaved thinking | Automatic with adaptive mode. Manual mode on Sonnet 4.6 requires `interleaved-thinking-2025-05-14` beta header |
| Max output           | Opus 4.6: 128K tokens; Sonnet 4.6 / Haiku 4.5: 64K tokens                                                      |
| Billing              | Billed for full thinking tokens, not summarized output                                                         |
| TypeScript SDK       | `"adaptive"` type not yet in SDK type definitions -- use type assertion                                        |

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
