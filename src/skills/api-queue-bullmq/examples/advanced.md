# BullMQ Advanced Patterns

> Related: [core.md](core.md) -- Queue setup, Worker processing, job options, connection factory, graceful shutdown

---

## FlowProducer (Parent-Child Job Trees)

FlowProducer creates DAG-like job trees where a parent waits for all children to complete before being processed itself. The entire tree is added atomically.

```typescript
// ✅ Good -- Video processing pipeline with FlowProducer
import { FlowProducer, Worker, type Job } from "bullmq";

const flowProducer = new FlowProducer({ connection: createWorkerConnection() });

// Add a flow -- parent waits for all children
const flow = await flowProducer.add({
  name: "publish-video",
  queueName: "videos",
  data: { videoId: "abc-123" },
  children: [
    {
      name: "extract-audio",
      queueName: "media-processing",
      data: { videoId: "abc-123" },
    },
    {
      name: "generate-thumbnail",
      queueName: "media-processing",
      data: { videoId: "abc-123", size: "720p" },
    },
    {
      name: "transcode-hd",
      queueName: "media-processing",
      data: { videoId: "abc-123", format: "mp4" },
    },
  ],
});

// flow.job = parent job reference
// flow.children = child job references
```

**Why good:** Atomic addition (all jobs added or none), parent automatically waits for all children, children can be in different queues

#### Accessing Children Results from Parent Processor

```typescript
// ✅ Good -- Parent processor reads children values
const videoWorker = new Worker(
  "videos",
  async (job: Job) => {
    // Returns object keyed by "queueName:jobId"
    const childrenValues = await job.getChildrenValues();
    // e.g. { "media-processing:1": { audioUrl: "..." }, "media-processing:2": { thumbnailUrl: "..." } }

    const results = Object.values(childrenValues);
    await publishVideo(job.data.videoId, results);
  },
  { connection: createWorkerConnection() },
);
```

**Why good:** `getChildrenValues()` provides all child results, parent processor only runs after all children succeed

**Gotcha:** `getChildrenValues()` returns an object keyed by `"queueName:jobId"`, not an array. If you need ordered results, include an index in child job data.

---

## Rate Limiting

### Global Rate Limiter

The `limiter` option on Worker is global across all Worker instances on the same queue.

```typescript
// ✅ Good -- Rate-limited API consumer
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_DURATION_MS = 1000;

const apiWorker = new Worker(
  "api-calls",
  async (job: Job) => {
    const response = await callExternalApi(job.data);
    return response;
  },
  {
    connection: createWorkerConnection(),
    limiter: { max: RATE_LIMIT_MAX, duration: RATE_LIMIT_DURATION_MS },
  },
);
```

**Why good:** Global limit (10 jobs/second across ALL workers on this queue), named constants, prevents API throttling

### Manual / Dynamic Rate Limiting

For APIs that return rate limit headers, use dynamic rate limiting.

```typescript
// ✅ Good -- Dynamic rate limiting based on API response
const dynamicWorker = new Worker(
  "api-calls",
  async (job: Job) => {
    const response = await callExternalApi(job.data);

    if (response.status === 429) {
      const retryAfterMs = Number(response.headers["retry-after"]) * 1000;
      await dynamicWorker.rateLimit(retryAfterMs);
      throw Worker.RateLimitError();
    }

    return response.data;
  },
  { connection: createWorkerConnection() },
);
```

**Why good:** `worker.rateLimit(duration)` pauses the entire queue for the specified duration, `Worker.RateLimitError()` signals BullMQ to retry after the limit expires (does not count as a failed attempt)

---

## Job Schedulers (Repeatable/Cron Jobs)

`upsertJobScheduler` (v5.16.0+) replaces the deprecated `repeat` option. It is idempotent -- safe to call on every application startup.

```typescript
// ✅ Good -- Fixed interval scheduler
const CLEANUP_INTERVAL_MS = 3_600_000; // 1 hour

await emailQueue.upsertJobScheduler(
  "hourly-cleanup",
  { every: CLEANUP_INTERVAL_MS },
  {
    name: "cleanup-expired",
    data: { type: "expired-sessions" },
    opts: { removeOnComplete: true },
  },
);

// ✅ Good -- Cron-based scheduler
await emailQueue.upsertJobScheduler(
  "nightly-report",
  { pattern: "0 0 2 * * *" }, // Every day at 2:00 AM
  {
    name: "generate-report",
    data: { type: "daily-summary" },
    opts: { attempts: 3, backoff: { type: "exponential", delay: 5000 } },
  },
);
```

**Why good:** `upsert` is idempotent (won't duplicate on restart), template defines job name/data/opts, cron via `pattern` field

#### Managing Schedulers

```typescript
// Remove a scheduler
await emailQueue.removeJobScheduler("hourly-cleanup");

// List all active schedulers
const schedulers = await emailQueue.getJobSchedulers();
for (const scheduler of schedulers) {
  console.log(scheduler.id, scheduler.pattern ?? scheduler.every);
}
```

**Gotcha:** `every` intervals align to the clock. A 2000ms interval fires at 0s, 2s, 4s -- not 2s after you called `upsertJobScheduler`.

```typescript
// ❌ Bad -- Using deprecated repeat option
await emailQueue.add(
  "cleanup",
  { type: "expired" },
  {
    repeat: { every: 3600000 }, // Deprecated since v5.16.0
  },
);
```

**Why bad:** `repeat` option is deprecated; `upsertJobScheduler` provides better management (list, remove, upsert semantics)

---

## QueueEvents for Global Monitoring

QueueEvents listens to all Workers on a queue using Redis Streams. Requires its own dedicated connection.

```typescript
// ✅ Good -- Global event monitoring
import { QueueEvents } from "bullmq";

const QUEUE_NAME = "emails";

const queueEvents = new QueueEvents(QUEUE_NAME, {
  connection: createWorkerConnection(),
});

queueEvents.on("completed", ({ jobId, returnvalue }) => {
  console.log(`Job ${jobId} completed:`, returnvalue);
});

queueEvents.on("failed", ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed:`, failedReason);
});

queueEvents.on("progress", ({ jobId, data }) => {
  console.log(`Job ${jobId} progress:`, data);
});

queueEvents.on("stalled", ({ jobId }) => {
  console.warn(`Job ${jobId} stalled -- processor may be blocked`);
});
```

**Why good:** Global monitoring across all Workers, uses Redis Streams (reliable even across reconnections), stalled event helps detect CPU-blocked processors

#### Waiting for a Specific Job

```typescript
// ✅ Wait for a specific job to complete (useful in HTTP handlers)
const job = await emailQueue.add("send-receipt", data);
const result = await job.waitUntilFinished(queueEvents);
// result = return value from the processor
```

**Why good:** `waitUntilFinished` blocks until the specific job completes or fails, useful for synchronous-feeling endpoints that need the result

**Gotcha:** `waitUntilFinished` will throw if the job fails. Wrap in try-catch.

---

## Concurrency

### Local Concurrency (Per Worker)

```typescript
// ✅ Good -- I/O-bound worker with concurrency
const CONCURRENCY = 20;

const worker = new Worker(
  "api-calls",
  async (job: Job) => {
    return await callExternalApi(job.data);
  },
  {
    connection: createWorkerConnection(),
    concurrency: CONCURRENCY,
  },
);

// Dynamic adjustment at runtime
worker.concurrency = 5;
```

**Why good:** Named constant for concurrency, I/O-bound work benefits from parallel processing, dynamic adjustment for backpressure

**When NOT to use concurrency:** CPU-intensive processors block the event loop, preventing BullMQ from renewing job locks. This causes stalled jobs. Use sandboxed processors instead.

---

## Sandboxed Processors

Run processors in a separate process (or worker thread) to prevent CPU-intensive work from blocking the event loop.

```typescript
// ✅ Good -- Sandboxed processor (separate file)
import { Worker } from "bullmq";
import path from "node:path";

const processorPath = path.join(__dirname, "processors", "image-resize.js");

const imageWorker = new Worker("images", processorPath, {
  connection: createWorkerConnection(),
  useWorkerThreads: true, // Use Node.js Worker Threads (lighter than child processes)
  concurrency: 4,
});
```

```typescript
// processors/image-resize.ts -- the processor file
import type { SandboxedJob } from "bullmq";

export default async function (job: SandboxedJob) {
  // CPU-intensive work here -- runs in a separate thread
  const result = await resizeImage(job.data.imagePath, job.data.dimensions);
  return { outputPath: result.path };
}
```

**Why good:** `useWorkerThreads: true` is lighter than child processes, CPU work cannot block the main event loop, lock renewal continues uninterrupted

**Gotcha:** The processor file must export a default function (this is the one exception to the named-export convention). ESM projects can use `pathToFileURL()` from `node:url` instead of `path.join`.

---

## Custom Backoff Strategies

Define custom retry delay logic in the Worker settings.

```typescript
// ✅ Good -- Custom backoff with jitter
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

const worker = new Worker("emails", processor, {
  connection: createWorkerConnection(),
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      // Exponential with jitter
      const exponential = Math.min(
        Math.pow(2, attemptsMade) * BASE_DELAY_MS,
        MAX_DELAY_MS,
      );
      const jitter = Math.random() * BASE_DELAY_MS;
      return exponential + jitter;
    },
  },
});

// Reference the custom strategy when adding jobs
await emailQueue.add("send", data, {
  attempts: 5,
  backoff: { type: "custom" },
});
```

**Why good:** Jitter prevents thundering herd when many jobs retry simultaneously, capped exponential prevents excessive delays, custom logic for domain-specific retry behavior

**Key behavior:** A custom backoff returning `0` moves the job to the end of the waiting list. Returning `-1` moves it directly to failed (no more retries).
