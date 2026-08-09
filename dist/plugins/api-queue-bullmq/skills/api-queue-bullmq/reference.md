# BullMQ Quick Reference

## Job Options

| Option             | Type                          | Description                                            |
| ------------------ | ----------------------------- | ------------------------------------------------------ |
| `delay`            | `number`                      | Milliseconds to wait before processing                 |
| `priority`         | `number`                      | 1 = highest, MAX_INT = lowest (performance cost)       |
| `attempts`         | `number`                      | Max processing attempts (1 = no retries)               |
| `backoff`          | `{ type, delay }`             | Retry strategy: `"fixed"`, `"exponential"`, `"custom"` |
| `removeOnComplete` | `boolean \| { count?, age? }` | Auto-remove completed jobs                             |
| `removeOnFail`     | `boolean \| { count?, age? }` | Auto-remove failed jobs                                |
| `lifo`             | `boolean`                     | Last-in-first-out processing                           |
| `jobId`            | `string`                      | Custom ID (must be string, not integer)                |
| `timeout`          | `number`                      | Milliseconds before job is considered timed out        |

## Worker Options

| Option             | Type                         | Description                                                        |
| ------------------ | ---------------------------- | ------------------------------------------------------------------ |
| `connection`       | `Redis \| ConnectionOptions` | **Required.** ioredis connection with `maxRetriesPerRequest: null` |
| `concurrency`      | `number`                     | Max parallel jobs per Worker instance (default: 1)                 |
| `limiter`          | `{ max, duration }`          | Global rate limit across all Workers                               |
| `autorun`          | `boolean`                    | Start processing immediately (default: true)                       |
| `lockDuration`     | `number`                     | Lock TTL in ms (default: 30000)                                    |
| `stalledInterval`  | `number`                     | Stall check interval in ms (default: 30000)                        |
| `maxStalledCount`  | `number`                     | Stalls before moving to failed (default: 1)                        |
| `useWorkerThreads` | `boolean`                    | Use worker threads for sandboxed processors                        |

## Worker Events

| Event       | Payload                     | When                              |
| ----------- | --------------------------- | --------------------------------- |
| `completed` | `(job, returnvalue)`        | Job finished successfully         |
| `failed`    | `(job \| undefined, error)` | Job threw an error                |
| `progress`  | `(job, progress)`           | `job.updateProgress()` called     |
| `error`     | `(error)`                   | Worker-level error (must handle)  |
| `drained`   | `()`                        | Queue is empty, no more jobs      |
| `stalled`   | `(jobId)`                   | Job lock expired, will be retried |

## QueueEvents Events

| Event       | Payload                   | When                                 |
| ----------- | ------------------------- | ------------------------------------ |
| `completed` | `{ jobId, returnvalue }`  | Any job completed across all Workers |
| `failed`    | `{ jobId, failedReason }` | Any job failed across all Workers    |
| `progress`  | `{ jobId, data }`         | Any job progress update              |
| `stalled`   | `{ jobId }`               | Any job stalled                      |
| `waiting`   | `{ jobId }`               | Job added to the queue               |
| `delayed`   | `{ jobId, delay }`        | Job delayed                          |

## Job Lifecycle

```
added -> waiting -> active -> completed
                      |
                      +-> failed (retries exhausted)
                      |
                      +-> stalled -> waiting (re-queued)

delayed -> waiting (after delay expires)
```

## Decision Table

| Scenario                 | Pattern                                            |
| ------------------------ | -------------------------------------------------- |
| One-time background job  | `queue.add(name, data)`                            |
| Delayed job              | `queue.add(name, data, { delay })`                 |
| Priority job             | `queue.add(name, data, { priority: 1 })`           |
| Bulk jobs                | `queue.addBulk([...])`                             |
| Recurring interval       | `queue.upsertJobScheduler(id, { every })`          |
| Recurring cron           | `queue.upsertJobScheduler(id, { pattern })`        |
| Parent-child workflow    | `flowProducer.add({ children: [...] })`            |
| Rate-limited processing  | Worker `limiter: { max, duration }`                |
| CPU-intensive processing | Sandboxed processor (file path)                    |
| Dynamic rate limiting    | `worker.rateLimit(ms)` + `Worker.RateLimitError()` |

## Anti-Patterns

| Anti-Pattern                                | Fix                                               |
| ------------------------------------------- | ------------------------------------------------- |
| No `connection` on constructor              | Always pass `connection` (required in v5)         |
| Missing `maxRetriesPerRequest: null`        | Use connection factory for Workers                |
| Integer job IDs                             | Use string IDs only                               |
| No `worker.on("error", ...)`                | Always register error handler                     |
| No graceful shutdown                        | Handle SIGTERM/SIGINT with `worker.close()`       |
| No `removeOnComplete`/`removeOnFail`        | Configure auto-removal to prevent memory growth   |
| Using `repeat` on `queue.add()`             | Use `upsertJobScheduler` (deprecated since v5.16) |
| Using QueueScheduler class                  | Removed in v4; Workers handle this now            |
| Sharing connection for Worker + QueueEvents | Each needs its own connection                     |
| CPU work without sandboxed processor        | Causes stalled jobs from blocked event loop       |
| Non-idempotent processors                   | BullMQ is at-least-once; design for duplicates    |

## Production Checklist

- [ ] Redis `maxmemory-policy` set to `noeviction`
- [ ] All Workers use `maxRetriesPerRequest: null`
- [ ] Error event handler on every Worker
- [ ] Graceful shutdown on SIGTERM/SIGINT with timeout
- [ ] `removeOnComplete`/`removeOnFail` configured
- [ ] Processors are idempotent (at-least-once delivery)
- [ ] CPU-intensive work uses sandboxed processors
- [ ] QueueEvents has its own connection
- [ ] Job IDs are strings (not integers)
- [ ] Named constants for all delays, limits, and retry counts
