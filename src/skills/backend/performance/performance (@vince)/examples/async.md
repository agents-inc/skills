# Async Performance Examples

Event loop optimization, worker threads, and CPU-bound task handling.

---

## Event Loop Fundamentals

Node.js uses a single thread for JavaScript execution. Blocking this thread blocks ALL concurrent requests.

```typescript
// Bad Example - Blocking the event loop
import { readFileSync } from "fs";

app.get("/report", (req, res) => {
  // BAD: Synchronous file read blocks all other requests
  const data = readFileSync("large-file.csv");

  // BAD: CPU-intensive processing blocks event loop
  const result = processLargeDataset(data);

  res.json(result);
});
```

**Why bad:** While this request is processing, no other requests can be handled. 1000 concurrent users all wait for this one operation.

```typescript
// Good Example - Non-blocking async operations
import { readFile } from "fs/promises";

app.get("/report", async (req, res) => {
  // GOOD: Async file read doesn't block
  const data = await readFile("large-file.csv");

  // But CPU-intensive work still blocks - see Worker Threads below
  const result = processLargeDataset(data);

  res.json(result);
});
```

**Better but not complete:** Async I/O is non-blocking, but CPU-intensive `processLargeDataset` still blocks. Use Worker Threads for CPU work.

---

## Worker Threads for CPU-Bound Tasks

Offload CPU-intensive operations to separate threads.

### Worker Definition

```typescript
// workers/data-processor.worker.ts
import { parentPort, workerData } from "worker_threads";

interface WorkerInput {
  data: string;
  options: ProcessingOptions;
}

interface ProcessingOptions {
  format: "csv" | "json";
  aggregate: boolean;
}

// Heavy computation runs in separate thread
function processData(input: WorkerInput) {
  const { data, options } = input;

  // CPU-intensive work here
  const rows = data.split("\n");
  const processed = rows.map((row) => {
    // Complex processing...
    return transformRow(row, options);
  });

  if (options.aggregate) {
    return aggregateResults(processed);
  }

  return processed;
}

// Receive data from main thread
const result = processData(workerData as WorkerInput);

// Send result back to main thread
parentPort?.postMessage(result);
```

### Worker Manager

```typescript
// lib/worker-pool.ts
import { Worker } from "worker_threads";
import { cpus } from "os";

const WORKER_SCRIPT = "./workers/data-processor.worker.js";
const MAX_WORKERS = cpus().length;
const WORKER_TIMEOUT_MS = 30000;

interface WorkerTask<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

class WorkerPool {
  private workers: Worker[] = [];
  private queue: Array<{ data: unknown; task: WorkerTask<unknown> }> = [];
  private activeWorkers = 0;

  async runTask<T>(data: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Worker timeout"));
      }, WORKER_TIMEOUT_MS);

      const task: WorkerTask<T> = { resolve, reject, timeout };

      if (this.activeWorkers < MAX_WORKERS) {
        this.executeTask(data, task);
      } else {
        this.queue.push({ data, task: task as WorkerTask<unknown> });
      }
    });
  }

  private executeTask<T>(data: unknown, task: WorkerTask<T>) {
    this.activeWorkers++;

    const worker = new Worker(WORKER_SCRIPT, { workerData: data });

    worker.on("message", (result: T) => {
      clearTimeout(task.timeout);
      task.resolve(result);
      this.cleanup(worker);
    });

    worker.on("error", (error) => {
      clearTimeout(task.timeout);
      task.reject(error);
      this.cleanup(worker);
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        clearTimeout(task.timeout);
        task.reject(new Error(`Worker exited with code ${code}`));
      }
      this.cleanup(worker);
    });
  }

  private cleanup(worker: Worker) {
    this.activeWorkers--;
    worker.terminate();

    // Process next queued task
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.executeTask(next.data, next.task);
    }
  }
}

export const workerPool = new WorkerPool();
```

### Usage in Request Handler

```typescript
// Good Example - CPU work offloaded to worker
import { workerPool } from "./lib/worker-pool";

app.get("/report", async (req, res) => {
  // I/O is async - doesn't block
  const data = await readFile("large-file.csv", "utf-8");

  // CPU work offloaded to worker thread - doesn't block event loop
  const result = await workerPool.runTask({
    data,
    options: { format: "csv", aggregate: true },
  });

  res.json(result);
});
```

**Why good:** Main thread remains free to handle other requests while worker processes data, worker pool limits concurrency preventing resource exhaustion, timeout prevents hung workers

---

## setImmediate for Long-Running Loops

For CPU-bound operations that can't be moved to workers, break them into chunks.

```typescript
// Bad Example - Long loop blocks event loop
async function processLargeArray(items: Item[]) {
  const results: ProcessedItem[] = [];

  for (const item of items) {
    results.push(expensiveTransform(item)); // Blocks until complete
  }

  return results;
}
```

```typescript
// Good Example - Chunked processing with setImmediate
const CHUNK_SIZE = 100;

async function processLargeArray(items: Item[]): Promise<ProcessedItem[]> {
  const results: ProcessedItem[] = [];

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);

    // Process chunk
    for (const item of chunk) {
      results.push(expensiveTransform(item));
    }

    // Yield to event loop between chunks
    if (i + CHUNK_SIZE < items.length) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  return results;
}
```

**Why good:** `setImmediate` yields control back to event loop between chunks, allows other requests to be processed during long operations, total throughput same but latency for other requests improved

**Trade-off:** Adds slight overhead per chunk, total processing time slightly longer, but system remains responsive

---

## Async Best Practices

### Parallel vs Sequential

```typescript
// Bad Example - Sequential when parallel possible
async function getUserData(userId: string) {
  const user = await getUser(userId);
  const posts = await getPosts(userId);
  const friends = await getFriends(userId);
  // Total time: getUser + getPosts + getFriends

  return { user, posts, friends };
}

// Good Example - Parallel independent operations
async function getUserData(userId: string) {
  const [user, posts, friends] = await Promise.all([
    getUser(userId),
    getPosts(userId),
    getFriends(userId),
  ]);
  // Total time: max(getUser, getPosts, getFriends)

  return { user, posts, friends };
}
```

**Why good:** Independent operations run in parallel, total time is the slowest operation, not the sum

### Promise.allSettled for Partial Failures

```typescript
// Good Example - Handle partial failures gracefully
async function getUserDataResilient(userId: string) {
  const results = await Promise.allSettled([
    getUser(userId),
    getPosts(userId),
    getFriends(userId),
  ]);

  return {
    user: results[0].status === "fulfilled" ? results[0].value : null,
    posts: results[1].status === "fulfilled" ? results[1].value : [],
    friends: results[2].status === "fulfilled" ? results[2].value : [],
  };
}
```

**Why good:** One failure doesn't fail entire request, graceful degradation, can still return partial data

### Avoid Unbounded Parallelism

```typescript
// Bad Example - Unbounded parallelism can overwhelm resources
async function processAllUsers(userIds: string[]) {
  // If userIds has 10,000 items, this creates 10,000 concurrent operations!
  await Promise.all(userIds.map((id) => processUser(id)));
}

// Good Example - Bounded concurrency
import pLimit from "p-limit";

const MAX_CONCURRENT = 10;
const limit = pLimit(MAX_CONCURRENT);

async function processAllUsers(userIds: string[]) {
  await Promise.all(
    userIds.map((id) => limit(() => processUser(id))),
  );
}
```

**Why good:** Limits concurrent operations to prevent resource exhaustion, predictable memory usage, prevents overwhelming downstream services

---

## Event Loop Lag Monitoring

```typescript
// Monitor event loop lag in production
const CHECK_INTERVAL_MS = 1000;
const LAG_WARNING_THRESHOLD_MS = 50;
const LAG_CRITICAL_THRESHOLD_MS = 200;

let lastCheck = process.hrtime.bigint();

setInterval(() => {
  const now = process.hrtime.bigint();
  const expectedNs = BigInt(CHECK_INTERVAL_MS * 1_000_000);
  const actualNs = now - lastCheck;
  const lagMs = Number(actualNs - expectedNs) / 1_000_000;

  if (lagMs > LAG_CRITICAL_THRESHOLD_MS) {
    console.error(`CRITICAL: Event loop lag ${lagMs.toFixed(2)}ms`);
  } else if (lagMs > LAG_WARNING_THRESHOLD_MS) {
    console.warn(`WARNING: Event loop lag ${lagMs.toFixed(2)}ms`);
  }

  lastCheck = now;
}, CHECK_INTERVAL_MS);

// Or use dedicated library
import { monitorEventLoopDelay } from "perf_hooks";

const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

// Periodically report
setInterval(() => {
  console.log({
    min: histogram.min / 1e6,
    max: histogram.max / 1e6,
    mean: histogram.mean / 1e6,
    p99: histogram.percentile(99) / 1e6,
  });
  histogram.reset();
}, 60000);
```

---

## When to Use Each Pattern

| Scenario | Solution | Notes |
|----------|----------|-------|
| File I/O | `fs/promises` | Always use async versions |
| CPU < 50ms | Keep on main thread | Worker overhead not worth it |
| CPU 50-500ms | setImmediate chunking | Simple, no worker complexity |
| CPU > 500ms | Worker Threads | Offload completely |
| Many small async ops | p-limit | Bound concurrency |
| Independent I/O | Promise.all | Parallel execution |
| Partial failure OK | Promise.allSettled | Graceful degradation |

---

## See Also

- [caching.md](caching.md) - Redis caching patterns
- [database.md](database.md) - Query optimization and connection pooling
