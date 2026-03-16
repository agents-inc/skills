# Vercel AI SDK Tool Calling Examples

> Tool definitions, multi-step tool calling, tool results rendering, and approval flows. See [SKILL.md](../SKILL.md) for core concepts.

**Core patterns:** See [core.md](core.md). **Chat UI:** See [chat.md](chat.md).

---

## Pattern 1: Basic Tool Definition

### Good Example -- Weather Tool with Zod Schema

```typescript
// tools/weather-tool.ts
import { tool } from 'ai';
import { z } from 'zod';

export const weatherTool = tool({
  description: 'Get the current weather in a location. Use this when the user asks about weather conditions.',
  inputSchema: z.object({
    location: z.string().describe('City name, e.g. "San Francisco" or "Tokyo, Japan"'),
    unit: z.enum(['celsius', 'fahrenheit'])
      .default('celsius')
      .describe('Temperature unit preference'),
  }),
  execute: async ({ location, unit }) => {
    const response = await fetch(
      `https://api.weatherapi.com/v1/current.json?q=${encodeURIComponent(location)}`,
    );
    const data = await response.json();

    return {
      location,
      temperature: unit === 'celsius' ? data.current.temp_c : data.current.temp_f,
      unit,
      condition: data.current.condition.text,
      humidity: data.current.humidity,
    };
  },
});
```

**Why good:** Descriptive tool description tells model when to use it, `.describe()` on every input property, enum with default, named export, real API call with error-safe encoding

### Bad Example -- Minimal Tool Without Descriptions

```typescript
// BAD
const myTool = tool({
  description: '', // Model won't know when to use this
  inputSchema: z.object({
    q: z.string(), // No description -- model guesses what this means
  }),
  execute: async ({ q }) => {
    return await fetch(`/api?q=${q}`).then((r) => r.json());
  },
});
```

**Why bad:** Empty description, no property descriptions, single-letter parameter name, no URL encoding

---

## Pattern 2: Multiple Tools

### Good Example -- Tool Set for an Assistant

```typescript
// tools/assistant-tools.ts
import { tool } from 'ai';
import { z } from 'zod';

const MAX_SEARCH_RESULTS = 5;

export const searchTool = tool({
  description: 'Search the knowledge base for relevant documents. Use when the user asks questions about products, policies, or documentation.',
  inputSchema: z.object({
    query: z.string().describe('Search query string'),
    category: z.enum(['products', 'policies', 'docs', 'faq'])
      .optional()
      .describe('Optional category filter'),
  }),
  execute: async ({ query, category }) => {
    const results = await searchKnowledgeBase(query, { category, limit: MAX_SEARCH_RESULTS });
    return results.map((r) => ({ title: r.title, content: r.snippet, url: r.url }));
  },
});

export const calculatorTool = tool({
  description: 'Perform mathematical calculations. Use when the user needs arithmetic, percentages, or unit conversions.',
  inputSchema: z.object({
    expression: z.string().describe('Mathematical expression to evaluate, e.g. "15% of 200" or "32 * 1.8 + 32"'),
  }),
  execute: async ({ expression }) => {
    const result = evaluateExpression(expression);
    return { expression, result: result.value, formatted: result.formatted };
  },
});

export const createTicketTool = tool({
  description: 'Create a support ticket in the help desk system. Use when the user wants to report an issue or request help that requires human follow-up.',
  inputSchema: z.object({
    title: z.string().describe('Brief summary of the issue'),
    description: z.string().describe('Detailed description of the problem'),
    priority: z.enum(['low', 'medium', 'high', 'urgent'])
      .default('medium')
      .describe('Ticket priority level'),
  }),
  execute: async ({ title, description, priority }) => {
    const ticket = await helpdesk.createTicket({ title, description, priority });
    return { ticketId: ticket.id, status: 'created', url: ticket.url };
  },
});
```

**Why good:** Each tool has a clear description saying when to use it, named constant for limits, descriptive property names with `.describe()`, multiple tools for different capabilities

---

## Pattern 3: Multi-Step Tool Calling

### Good Example -- Agent Loop with stepCountIs

```typescript
// lib/agent.ts
import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { searchTool, calculatorTool } from '../tools/assistant-tools.js';

const MAX_AGENT_STEPS = 10;

export async function runAssistant(userMessage: string) {
  const { text, steps } = await generateText({
    model: 'anthropic/claude-sonnet-4.5',
    system: `You are a helpful assistant with access to tools.
Use tools when you need external information.
Chain multiple tool calls if needed to fully answer the question.`,
    tools: {
      search: searchTool,
      calculator: calculatorTool,
    },
    stopWhen: stepCountIs(MAX_AGENT_STEPS),
    prompt: userMessage,
    onStepFinish({ stepNumber, text, toolCalls, finishReason }) {
      console.log(`Step ${stepNumber}: ${finishReason}`);
      for (const call of toolCalls) {
        console.log(`  Called: ${call.toolName}(${JSON.stringify(call.args)})`);
      }
    },
  });

  // Extract all tool calls across all steps
  const allToolCalls = steps.flatMap((step) => step.toolCalls);
  console.log(`Total tool calls: ${allToolCalls.length} across ${steps.length} steps`);

  return { text, steps, toolCallCount: allToolCalls.length };
}
```

**Why good:** Named constant for max steps, `onStepFinish` for observability, extracts tool calls from steps, system prompt explains tool usage

### Bad Example -- No Step Limit

```typescript
// BAD: No stopWhen -- risks infinite tool calling loops
const { text } = await generateText({
  model: 'openai/gpt-4o',
  tools: { search: searchTool },
  // No stopWhen! Could loop indefinitely
  prompt: 'Research everything about TypeScript.',
});
```

**Why bad:** No `stopWhen` for multi-step tools risks infinite loops, no step logging, no tool call tracking

---

## Pattern 4: ToolLoopAgent (v6)

### Good Example -- Reusable Agent

```typescript
// agents/weather-agent.ts
import { ToolLoopAgent, Output } from 'ai';
import { z } from 'zod';
import { weatherTool } from '../tools/weather-tool.js';

export const weatherAgent = new ToolLoopAgent({
  model: 'anthropic/claude-sonnet-4.5',
  instructions: 'You are a weather assistant. Use the weather tool to get current conditions, then provide a helpful summary with recommendations.',
  tools: { weather: weatherTool },
  // Default stopWhen is stepCountIs(20)
});

// Usage
const result = await weatherAgent.generate({
  prompt: 'What should I wear in San Francisco and Tokyo today?',
});

console.log(result.text);
```

**Why good:** Reusable agent definition, `instructions` (not `system` -- v6 naming), tools attached to agent, semantic model alias possible

### Good Example -- Agent with Structured Output

```typescript
// agents/analysis-agent.ts
import { ToolLoopAgent, Output, tool } from 'ai';
import { z } from 'zod';

const analysisSchema = z.object({
  summary: z.string().describe('Brief analysis summary'),
  sentiment: z.enum(['positive', 'negative', 'neutral']).describe('Overall sentiment'),
  keyPoints: z.array(z.string()).describe('Key points extracted'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
});

const webSearchTool = tool({
  description: 'Search the web for current information about a topic.',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async ({ query }) => {
    return await performWebSearch(query);
  },
});

export const analysisAgent = new ToolLoopAgent({
  model: 'openai/gpt-4o',
  instructions: 'You are a research analyst. Search for information and provide structured analysis.',
  tools: { webSearch: webSearchTool },
  output: Output.object({ schema: analysisSchema }),
});

// Usage -- output is typed as the schema
const { output } = await analysisAgent.generate({
  prompt: 'Analyze the current state of TypeScript adoption in enterprise.',
});

console.log(`Sentiment: ${output.sentiment}`);
console.log(`Confidence: ${output.confidence}`);
output.keyPoints.forEach((point) => console.log(`- ${point}`));
```

**Why good:** Agent combines tools with structured output, schema describes expected shape, typed output, reusable across app

---

## Pattern 5: Tool Approval (Human-in-the-Loop)

### Good Example -- Payment with Approval Gate

```typescript
// tools/payment-tool.ts
import { tool } from 'ai';
import { z } from 'zod';

const APPROVAL_THRESHOLD = 100;

export const paymentTool = tool({
  description: 'Process a payment to a recipient. Amounts over $100 require human approval.',
  inputSchema: z.object({
    amount: z.number().positive().describe('Payment amount in USD'),
    recipient: z.string().describe('Recipient name or account ID'),
    memo: z.string().optional().describe('Optional payment memo'),
  }),
  needsApproval: async ({ amount }) => amount > APPROVAL_THRESHOLD,
  execute: async ({ amount, recipient, memo }) => {
    const result = await processPayment({ amount, recipient, memo });
    return {
      transactionId: result.id,
      status: 'completed',
      amount,
      recipient,
    };
  },
});
```

**Why good:** Named constant for threshold, dynamic approval based on amount, descriptive fields, clear approval description in tool description

### Good Example -- Destructive Action Approval

```typescript
// tools/admin-tools.ts
import { tool } from 'ai';
import { z } from 'zod';

export const deleteRecordTool = tool({
  description: 'Permanently delete a record from the database. This action cannot be undone.',
  inputSchema: z.object({
    recordId: z.string().describe('ID of the record to delete'),
    recordType: z.enum(['user', 'order', 'product']).describe('Type of record'),
  }),
  needsApproval: true, // Always require approval for destructive actions
  execute: async ({ recordId, recordType }) => {
    await database.delete(recordType, recordId);
    return { deleted: true, recordId, recordType };
  },
});
```

**Why good:** Always requires approval (not conditional), clear warning in description, typed enum for record types

---

## Pattern 6: Tool Execution Options

### Good Example -- Tool with Abort Signal and Messages

```typescript
// tools/long-running-tool.ts
import { tool } from 'ai';
import { z } from 'zod';

const REQUEST_TIMEOUT_MS = 30_000;

export const researchTool = tool({
  description: 'Research a topic by querying multiple sources. May take several seconds.',
  inputSchema: z.object({
    topic: z.string().describe('Topic to research'),
    depth: z.enum(['quick', 'thorough']).default('quick').describe('Research depth'),
  }),
  execute: async ({ topic, depth }, { abortSignal, toolCallId, messages }) => {
    console.log(`Tool call ${toolCallId}: Researching "${topic}" (${depth})`);

    // Use abort signal for cancellation
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    // Combine abort signals
    const combinedSignal = abortSignal
      ? AbortSignal.any([abortSignal, controller.signal])
      : controller.signal;

    try {
      const results = await fetchResearch(topic, {
        depth,
        signal: combinedSignal,
      });

      return {
        topic,
        sources: results.sources,
        summary: results.summary,
      };
    } finally {
      clearTimeout(timeout);
    }
  },
});
```

**Why good:** Named constant for timeout, abort signal support for cancellation, toolCallId for tracking, messages access for context, cleanup with finally

---

## Pattern 7: Tool Input Lifecycle Hooks

### Good Example -- Streaming Tool Input Display

```typescript
// tools/code-tool.ts
import { tool } from 'ai';
import { z } from 'zod';

export const codeGeneratorTool = tool({
  description: 'Generate code based on a description.',
  inputSchema: z.object({
    language: z.string().describe('Programming language'),
    description: z.string().describe('What the code should do'),
  }),
  execute: async ({ language, description }) => {
    return await generateCode(language, description);
  },
  onInputStart: () => {
    console.log('Model starting to generate tool input...');
  },
  onInputDelta: ({ inputTextDelta }) => {
    // Stream the raw input as it arrives (useful for UI)
    process.stdout.write(inputTextDelta);
  },
  onInputAvailable: ({ input }) => {
    console.log('\nComplete tool input:', JSON.stringify(input, null, 2));
  },
});
```

**Why good:** Lifecycle hooks for progressive UI, `onInputDelta` shows input as model generates it, `onInputAvailable` when full input is ready

---

## Pattern 8: Preliminary Tool Results (Streaming)

### Good Example -- Progressive Status Updates

```typescript
// tools/data-tool.ts
import { tool } from 'ai';
import { z } from 'zod';

export const dataAnalysisTool = tool({
  description: 'Analyze a dataset and return insights.',
  inputSchema: z.object({
    datasetId: z.string().describe('ID of the dataset to analyze'),
    metrics: z.array(z.string()).describe('Metrics to calculate'),
  }),
  async *execute({ datasetId, metrics }) {
    // Yield preliminary result (shown to user while processing)
    yield {
      status: 'loading' as const,
      message: `Loading dataset ${datasetId}...`,
      results: undefined,
    };

    const dataset = await loadDataset(datasetId);

    yield {
      status: 'processing' as const,
      message: `Analyzing ${dataset.rowCount} rows for ${metrics.length} metrics...`,
      results: undefined,
    };

    const results = await analyzeDataset(dataset, metrics);

    // Final yield is the complete result
    yield {
      status: 'complete' as const,
      message: 'Analysis complete',
      results,
    };
  },
});
```

**Why good:** Generator function yields progressive status updates, user sees loading states, final yield is the complete result

---

## Pattern 9: Tool Choice Control

### Good Example -- Forcing Tool Usage

```typescript
import { generateText, stepCountIs } from 'ai';
import { weatherTool, searchTool } from '../tools/index.js';

const MAX_STEPS = 3;

// Force the model to use a specific tool
const { text } = await generateText({
  model: 'openai/gpt-4o',
  tools: { weather: weatherTool, search: searchTool },
  toolChoice: { type: 'tool', toolName: 'weather' },
  stopWhen: stepCountIs(MAX_STEPS),
  prompt: 'What is the weather in Paris?',
});

// Force the model to use ANY tool (not generate text)
const { text: text2 } = await generateText({
  model: 'openai/gpt-4o',
  tools: { weather: weatherTool, search: searchTool },
  toolChoice: 'required', // Must use at least one tool
  stopWhen: stepCountIs(MAX_STEPS),
  prompt: 'Look up information about TypeScript.',
});

// Prevent tool usage
const { text: text3 } = await generateText({
  model: 'openai/gpt-4o',
  tools: { weather: weatherTool },
  toolChoice: 'none', // Tools available but model cannot use them
  prompt: 'Just chat with me.',
});
```

**Why good:** Named constant for steps, `toolChoice` controls model behavior, three modes shown: specific tool, any tool required, no tools

---

## Pattern 10: Active Tools (Per-Step)

### Good Example -- Restricting Available Tools

```typescript
import { generateText, stepCountIs } from 'ai';
import { searchTool, calculatorTool, createTicketTool } from '../tools/index.js';

const MAX_STEPS = 5;

// Only expose subset of tools
const { text } = await generateText({
  model: 'openai/gpt-4o',
  tools: { search: searchTool, calculator: calculatorTool, createTicket: createTicketTool },
  activeTools: ['search', 'calculator'], // createTicket not available
  stopWhen: stepCountIs(MAX_STEPS),
  prompt: 'Help me research TypeScript.',
});

// Dynamic per-step tool selection with prepareStep
const { text: text2 } = await generateText({
  model: 'openai/gpt-4o',
  tools: { search: searchTool, calculator: calculatorTool, createTicket: createTicketTool },
  stopWhen: stepCountIs(MAX_STEPS),
  prepareStep: async ({ stepNumber }) => {
    // Only allow ticket creation after initial research
    if (stepNumber === 0) {
      return { activeTools: ['search', 'calculator'] };
    }
    return { activeTools: ['search', 'calculator', 'createTicket'] };
  },
  prompt: 'Research and then create a ticket if needed.',
});
```

**Why good:** `activeTools` restricts which tools are available, `prepareStep` enables dynamic per-step control, progressive tool access

---

_For core patterns, see [core.md](core.md). For structured output, see [structured-output.md](structured-output.md)._
