# BullMQ Core Patterns

> Related: [advanced.md](advanced.md) -- FlowProducer, rate limiting, job scheduling, events, concurrency

---

## Connection Factory

BullMQ v5 requires explicit Redis connections. Workers need `maxRetriesPerRequest: null`; producers (Queue) can use a default or limited retry count for faster failure feedback.

```typescript
// ✅ Good -- Connection factory with consumer/producer separation
import Redis from "ioredis";

const RETRY_DELAY_BASE_MS = 50;
const RETRY_DELAY_MAX_MS = 2000;
const PRODUCER_MAX_RETRIES = 3;

function createWorkerConnection(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required");
  return new Redis(url, {
    maxRetriesPerRequest: null, // REQUIRED for Workers
    retryStrategy(times) {
      return Math.min(times * RETRY_DELAY_BASE_MS, RETRY_DELAY_MAX_MS);
    },
  });
}

function createProducerConnection(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required");
  return new Redis(url, {
    maxRetriesPerRequest: PRODUCER_MAX_RETRIES,
    retryStrategy(times) {
      return Math.min(times * RETRY_DELAY_BASE_MS, RETRY_DELAY_MAX_MS);
    },
  });
}

export { createWorkerConnection, createProducerConnection };
```

**Why good:** Separate factories for producers (fast failure for HTTP handlers) and consumers (infinite retries for background workers), named constants, env var validation

```typescript
// ❌ Bad -- No maxRetriesPerRequest, hardcoded URL, shared connection
import Redis from "ioredis";
const redis = new Redis("redis://localhost:6379");
const queue = new Queue("emails", { connection: redis });
const worker = new Worker("emails", processor, { connection: redis });
```

**Why bad:** Missing `maxRetriesPerRequest: null` causes BullMQ Worker to throw, hardcoded URL breaks in production, sharing connection between Queue and Worker can cause blocking conflicts

---

## Queue and Worker with Typed Jobs

Use TypeScript generics on Queue, Worker, and Job for type-safe job data and return values.

```typescript
// ✅ Good -- Typed queue and worker
import { Queue, Worker, type Job } from "bullmq";

interface EmailJobData {
  to: string;
  subject: string;
  body: string;
}

type EmailJobReturn = { messageId: string };

const QUEUE_NAME = "emails";
const MAX_ATTEMPTS = 3;
const BACKOFF_DELAY_MS = 1000;
const KEEP_COMPLETED = 200;

// Producer
const emailQueue = new Queue<EmailJobData>(QUEUE_NAME, {
  connection: createProducerConnection(),
  defaultJobOptions: {
    attempts: MAX_ATTEMPTS,
    backoff: { type: "exponential", delay: BACKOFF_DELAY_MS },
    removeOnComplete: { count: KEEP_COMPLETED },
    removeOnFail: false,
  },
});

// Consumer
const emailWorker = new Worker<EmailJobData, EmailJobReturn>(
  QUEUE_NAME,
  async (job: Job<EmailJobData>) => {
    const result = await sendEmail(
      job.data.to,
      job.data.subject,
      job.data.body,
    );
    return { messageId: result.id };
  },
  { connection: createWorkerConnection() },
);

// Error handler -- prevents unhandled errors from crashing the process
emailWorker.on("error", (err) => {
  console.error("Worker error:", err.message);
});

export { emailQueue, emailWorker };
```

**Why good:** Generics enforce type safety on `job.data` and return values, `defaultJobOptions` applies to all jobs, `removeOnComplete` with count prevents unbounded Redis memory, error handler prevents process crash

```typescript
// ❌ Bad -- No types, no error handler, no defaultJobOptions
const queue = new Queue("emails", { connection: createWorkerConnection() });
const worker = new Worker(
  "emails",
  async (job) => {
    await sendEmail(job.data.to, job.data.subject, job.data.body);
    // No return value, no error handler
  },
  { connection: createWorkerConnection() },
);
```

**Why bad:** No type safety on job data, no error event handler risks crash, no retry/backoff config means failures are permanent

---

## Adding Jobs

```typescript
// ✅ Single job with options
const DELAY_MS = 60_000;
const HIGH_PRIORITY = 1;

await emailQueue.add(
  "send-welcome",
  {
    to: "user@example.com",
    subject: "Welcome",
    body: "Hello!",
  },
  {
    delay: DELAY_MS, // Wait 60s before processing
    priority: HIGH_PRIORITY, // 1 = highest priority
    jobId: "welcome-user-123", // Idempotent -- same ID won't add duplicate
  },
);

// ✅ Bulk add -- single Redis round-trip
await emailQueue.addBulk([
  {
    name: "send-notification",
    data: { to: "a@example.com", subject: "Hi", body: "..." },
  },
  {
    name: "send-notification",
    data: { to: "b@example.com", subject: "Hi", body: "..." },
  },
  {
    name: "send-notification",
    data: { to: "c@example.com", subject: "Hi", body: "..." },
  },
]);
```

**Why good:** `addBulk` sends all jobs in a single round-trip, `jobId` prevents duplicates, named constants for delay and priority

**Gotcha:** Job IDs must be strings in BullMQ v5. Integer IDs throw an exception.

---

## Job Progress

Report progress from within a processor so external listeners can track it.

```typescript
// ✅ Good -- Progress reporting from processor
const worker = new Worker<ImportJobData>(
  "imports",
  async (job: Job<ImportJobData>) => {
    const BATCH_SIZE = 100;
    const { rows } = job.data;
    const total = rows.length;

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await processBatch(batch);
      const PERCENTAGE_MULTIPLIER = 100;
      await job.updateProgress(
        Math.round(((i + batch.length) / total) * PERCENTAGE_MULTIPLIER),
      );
    }

    return { processed: total };
  },
  { connection: createWorkerConnection() },
);

// Listen for progress from outside
worker.on("progress", (job, progress) => {
  console.log(`Job ${job.id}: ${progress}%`);
});
```

**Why good:** `updateProgress` stores progress in Redis so any listener can read it, batch processing yields control to the event loop (prevents stalls)

---

## Graceful Shutdown

```typescript
// ✅ Good -- Shutdown with timeout
const SHUTDOWN_TIMEOUT_MS = 30_000;

async function gracefulShutdown(workers: Worker[]): Promise<void> {
  const closePromise = Promise.all(workers.map((w) => w.close()));

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error("Shutdown timed out")),
      SHUTDOWN_TIMEOUT_MS,
    );
  });

  try {
    await Promise.race([closePromise, timeoutPromise]);
  } catch (err) {
    console.error("Forced shutdown:", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", () => gracefulShutdown([emailWorker]));
process.on("SIGINT", () => gracefulShutdown([emailWorker]));
```

**Why good:** Timeout prevents indefinite hang if a processor is stuck, handles both SIGTERM and SIGINT, `close()` stops accepting new jobs and waits for in-progress ones

```typescript
// ❌ Bad -- No shutdown handler
// Process exits immediately on SIGTERM, jobs become stalled
```

**Why bad:** In-progress jobs are abandoned and marked as stalled, then re-processed by another Worker (duplicate processing)

---

## Queue Management

```typescript
// Pause/resume a queue (affects all Workers)
await emailQueue.pause();
await emailQueue.resume();

// Drain -- remove all waiting and delayed jobs (does not affect active jobs)
await emailQueue.drain();

// Obliterate -- remove ALL data for this queue from Redis
await emailQueue.obliterate();

// Get job counts by status
const counts = await emailQueue.getJobCounts(
  "waiting",
  "active",
  "completed",
  "failed",
  "delayed",
);
// { waiting: 5, active: 2, completed: 100, failed: 3, delayed: 1 }

// Get jobs by status
const failedJobs = await emailQueue.getJobs(["failed"], 0, 10);
for (const job of failedJobs) {
  console.log(job.id, job.failedReason);
  await job.retry(); // Move back to waiting
}
```

**Why good:** `getJobCounts` for monitoring dashboards, `getJobs` with pagination for inspection, `retry()` for manual recovery, `obliterate` for clean slate in development
