# Langfuse -- Scores & Datasets Examples

> Creating scores (numeric, categorical, boolean), attaching to traces/observations, datasets, experiments, and evaluation workflows. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Setup, environment config, flush/shutdown
- [tracing.md](tracing.md) -- Manual tracing patterns
- [openai-integration.md](openai-integration.md) -- OpenAI auto-instrumentation
- [prompt-management.md](prompt-management.md) -- Prompt management

---

## Score Types

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

// Numeric score (float value)
langfuse.score.create({
  traceId: "trace-abc-123",
  name: "relevance",
  value: 0.92,
  dataType: "NUMERIC",
});

// Categorical score (string value)
langfuse.score.create({
  traceId: "trace-abc-123",
  name: "tone",
  value: "professional",
  dataType: "CATEGORICAL",
});

// Boolean score (0 or 1 as float, NOT true/false)
langfuse.score.create({
  traceId: "trace-abc-123",
  name: "contains-pii",
  value: 0,
  dataType: "BOOLEAN",
});
```

**Note:** Boolean scores use `0` (false) or `1` (true) as float values, not JavaScript `true`/`false`.

---

## Scoring Specific Observations

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

// Score a specific generation within a trace
langfuse.score.create({
  traceId: "trace-abc-123",
  observationId: "obs-def-456",
  name: "accuracy",
  value: 0.88,
  dataType: "NUMERIC",
});
```

---

## Scoring Active Observations

Score the currently active OTel span without needing trace/observation IDs.

```typescript
import { startActiveObservation } from "@langfuse/tracing";
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

await startActiveObservation("process-query", async (span) => {
  span.update({ input: { query: "What is AI?" } });

  const result = await processQuery("What is AI?");

  // Score the active observation (this span)
  langfuse.score.activeObservation({
    name: "quality",
    value: 0.95,
    dataType: "NUMERIC",
  });

  // Score the active trace (root trace)
  langfuse.score.activeTrace({
    name: "user-satisfaction",
    value: "satisfied",
    dataType: "CATEGORICAL",
  });

  span.update({ output: { result } });
});

// Flush in short-lived processes
await langfuse.score.flush();
```

---

## User Feedback Scores

Capture user feedback (thumbs up/down, ratings) as scores.

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

// User thumbs up/down
function handleFeedback(traceId: string, isPositive: boolean) {
  langfuse.score.create({
    traceId,
    name: "user-feedback",
    value: isPositive ? 1 : 0,
    dataType: "BOOLEAN",
    comment: isPositive
      ? "User liked the response"
      : "User disliked the response",
  });
}

// User star rating (1-5)
function handleRating(traceId: string, rating: number) {
  langfuse.score.create({
    traceId,
    name: "user-rating",
    value: rating,
    dataType: "NUMERIC",
  });
}
```

---

## Session-Level Scores

Score an entire session (multiple traces).

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

// Score a session
langfuse.score.create({
  sessionId: "session-xyz-789",
  name: "session-quality",
  value: "excellent",
  dataType: "CATEGORICAL",
});
```

---

## Creating Datasets

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

// Create a dataset
await langfuse.api.datasets.create({
  name: "qa-benchmark",
  description: "Question-answer pairs for regression testing",
  metadata: {
    author: "Alice",
    created: "2025-10-01",
    type: "benchmark",
  },
});

// Add items to the dataset
await langfuse.api.datasetItems.create({
  datasetName: "qa-benchmark",
  input: {
    question: "What is the capital of France?",
  },
  expectedOutput: {
    answer: "Paris",
  },
  metadata: {
    difficulty: "easy",
    category: "geography",
  },
});

await langfuse.api.datasetItems.create({
  datasetName: "qa-benchmark",
  input: {
    question: "Explain quantum entanglement in simple terms.",
  },
  expectedOutput: {
    answer:
      "Quantum entanglement is when two particles are connected so that measuring one instantly affects the other, regardless of distance.",
  },
  metadata: {
    difficulty: "hard",
    category: "physics",
  },
});
```

---

## Running Experiments

Run your LLM function against a dataset and collect results.

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

// Get the dataset
const dataset = await langfuse.dataset.get("qa-benchmark");

// Run experiment with a task function
const result = await dataset.runExperiment({
  name: "gpt-4o-baseline-v1",
  description: "Baseline experiment with gpt-4o",
  task: async ({ item }) => {
    // Your LLM function
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "developer", content: "Answer the question accurately." },
        { role: "user", content: item.input.question },
      ],
    });
    return completion.choices[0].message.content;
  },
});

console.log(`Experiment: ${result.runName}`);
console.log(`Results: ${result.itemResults.length} items processed`);
console.log(`URL: ${result.datasetRunUrl}`);
```

---

## Experiments with Evaluators

Add evaluators to automatically score experiment results.

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

const dataset = await langfuse.dataset.get("qa-benchmark");

const result = await dataset.runExperiment({
  name: "gpt-4o-with-eval",
  task: async ({ item }) => {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: item.input.question }],
    });
    return completion.choices[0].message.content;
  },
  evaluators: [
    // Per-item evaluator
    async ({ input, output, expectedOutput }) => {
      const isCorrect = output
        ?.toLowerCase()
        .includes(expectedOutput?.answer?.toLowerCase() ?? "");
      return {
        name: "contains-answer",
        value: isCorrect ? 1 : 0,
        dataType: "BOOLEAN" as const,
      };
    },
  ],
});
```

---

## Linking Dataset Items to Production Traces

Connect dataset items to real production traces for context.

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

// Link a dataset item to a source trace
await langfuse.api.datasetItems.create({
  datasetName: "qa-benchmark",
  input: { question: "What is the capital of France?" },
  expectedOutput: { answer: "Paris" },
  sourceTraceId: "trace-from-production-123",
  sourceObservationId: "obs-456",
});
```

---

## Versioned Datasets

Run experiments against specific dataset snapshots.

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

// Get dataset at a specific version timestamp
const versionTimestamp = new Date("2025-12-15T06:30:00").toISOString();
const versionedDataset = await langfuse.dataset.get("qa-benchmark", {
  version: versionTimestamp,
});

const result = await versionedDataset.runExperiment({
  name: "baseline-on-v1",
  description: "Running against December 2025 snapshot",
  task: async ({ item }) => {
    return await myLLMFunction(item.input);
  },
});
```

---

## Archiving Dataset Items

```typescript
import { LangfuseClient } from "@langfuse/client";

const langfuse = new LangfuseClient();

// Archive a dataset item by ID
await langfuse.api.datasetItems.create({
  id: "item-abc-123",
  status: "ARCHIVED",
});
```

---

_For tracing patterns, see [tracing.md](tracing.md). For setup, see [core.md](core.md)._
