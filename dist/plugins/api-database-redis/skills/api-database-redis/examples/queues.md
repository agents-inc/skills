# Redis -- Queues & Locks Examples

> BullMQ job queues, Redis Streams with consumer groups, and distributed locks. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Connection setup (`maxRetriesPerRequest: null` for BullMQ)
- [pub-sub.md](pub-sub.md) -- Fire-and-forget messaging (vs persistent queues)
- [rate-limiting.md](rate-limiting.md) -- Lua scripts for atomic operations

---

## BullMQ: Complete Email Queue

```typescript
import { Queue, Worker, QueueEvents, type Job } from "bullmq";
import Redis from "ioredis";

// Job data types
interface EmailJobData {
  to: string;
  subject: string;
  templateId: string;
  variables: Record<string, string>;
}

interface EmailJobResult {
  messageId: string;
  sentAt: string;
}

// Constants
const QUEUE_NAME = "emails";
const MAX_ATTEMPTS = 3;
const BACKOFF_DELAY_MS = 1000;
const WORKER_CONCURRENCY = 5;
const STALLED_INTERVAL_MS = 30000;
const COMPLETED_RETENTION = 1000;
const FAILED_RETENTION = 5000;

// Connection factory -- each BullMQ component needs its own connection
function createConnection(): Redis {
  return new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null, // REQUIRED for BullMQ
  });
}

// Queue
const emailQueue = new Queue<EmailJobData, EmailJobResult>(QUEUE_NAME, {
  connection: createConnection(),
  defaultJobOptions: {
    attempts: MAX_ATTEMPTS,
    backoff: { type: "exponential", delay: BACKOFF_DELAY_MS },
    removeOnComplete: { count: COMPLETED_RETENTION },
    removeOnFail: { count: FAILED_RETENTION },
  },
});

// Worker
const emailWorker = new Worker<EmailJobData, EmailJobResult>(
  QUEUE_NAME,
  async (job: Job<EmailJobData, EmailJobResult>) => {
    const { to, subject, templateId, variables } = job.data;

    // Report progress
    await job.updateProgress(10);

    // Render template
    const html = await renderTemplate(templateId, variables);
    await job.updateProgress(50);

    // Send email
    const result = await sendEmail({ to, subject, html });
    await job.updateProgress(100);

    return {
      messageId: result.id,
      sentAt: new Date().toISOString(),
    };
  },
  {
    connection: createConnection(),
    concurrency: WORKER_CONCURRENCY,
    stalledInterval: STALLED_INTERVAL_MS,
  },
);

// Event handlers
emailWorker.on("completed", (job, result) => {
  console.log(`Email sent to ${job.data.to} (messageId: ${result.messageId})`);
});

emailWorker.on("failed", (job, err) => {
  console.error(
    `Email to ${job?.data.to} failed after ${job?.attemptsMade} attempts:`,
    err.message,
  );
});

// QueueEvents for monitoring
const emailEvents = new QueueEvents(QUEUE_NAME, {
  connection: createConnection(),
});

emailEvents.on("waiting", ({ jobId }) => {
  console.log(`Email job ${jobId} is waiting`);
});

export { emailQueue, emailWorker, emailEvents };
```

**Why good:** `maxRetriesPerRequest: null` is required for BullMQ, typed job data with generics, exponential backoff for retries, cleanup policies prevent unbounded Redis memory growth, separate connection per Queue/Worker (BullMQ requirement), progress reporting

```typescript
// ❌ Bad Example - BullMQ without required config
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";

const connection = new Redis(); // Missing maxRetriesPerRequest: null
const queue = new Queue("emails", { connection });
// BullMQ will throw: "maxRetriesPerRequest must be null"
```

**Why bad:** BullMQ requires `maxRetriesPerRequest: null` -- without it, ioredis gives up retrying after a set number of attempts, but BullMQ expects to retry forever

---

## BullMQ: Adding Jobs with Scheduling

```typescript
const REPORT_DELAY_MS = 60000; // 1 minute
const HIGH_PRIORITY = 1;
const NORMAL_PRIORITY = 5;

// Immediate high-priority email
await emailQueue.add(
  "transactional",
  {
    to: "user@example.com",
    subject: "Password Reset",
    templateId: "password-reset",
    variables: { resetLink: "https://..." },
  },
  { priority: HIGH_PRIORITY },
);

// Delayed email
await emailQueue.add(
  "reminder",
  {
    to: "user@example.com",
    subject: "Complete your profile",
    templateId: "profile-reminder",
    variables: { userName: "Alice" },
  },
  { delay: REPORT_DELAY_MS, priority: NORMAL_PRIORITY },
);

// Repeating email (cron schedule)
await emailQueue.add(
  "daily-digest",
  {
    to: "user@example.com",
    subject: "Your Daily Digest",
    templateId: "daily-digest",
    variables: {},
  },
  { repeat: { pattern: "0 9 * * *", tz: "America/New_York" } },
);

// Bulk add
await emailQueue.addBulk([
  {
    name: "welcome",
    data: {
      to: "a@example.com",
      subject: "Welcome",
      templateId: "welcome",
      variables: {},
    },
  },
  {
    name: "welcome",
    data: {
      to: "b@example.com",
      subject: "Welcome",
      templateId: "welcome",
      variables: {},
    },
  },
]);
```

---

## BullMQ: Graceful Shutdown

```typescript
async function shutdown(): Promise<void> {
  console.log("Shutting down workers...");

  // Close worker first (stop accepting new jobs)
  await emailWorker.close();

  // Close event listener
  await emailEvents.close();

  // Close queue last
  await emailQueue.close();

  console.log("All BullMQ connections closed");
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { shutdown };
```

---

## Redis Streams: Order Processing Pipeline

```typescript
import Redis from "ioredis";

const STREAM_KEY = "stream:orders";
const GROUP_NAME = "order-processors";
const BLOCK_MS = 5000;
const BATCH_SIZE = 10;
const CLAIM_MIN_IDLE_MS = 30000;

// Producer
async function addOrderEvent(
  redis: Redis,
  event: { orderId: string; action: string; data: Record<string, unknown> },
): Promise<string> {
  return redis.xadd(
    STREAM_KEY,
    "*",
    "orderId",
    event.orderId,
    "action",
    event.action,
    "data",
    JSON.stringify(event.data),
  );
}

// Consumer with pending message recovery
async function startConsumer(
  redis: Redis,
  consumerName: string,
): Promise<void> {
  // Ensure group exists
  try {
    await redis.xgroup("CREATE", STREAM_KEY, GROUP_NAME, "0", "MKSTREAM");
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes("BUSYGROUP")) {
      throw err;
    }
  }

  // Process pending messages first (messages claimed but not ACKed)
  await processPending(redis, consumerName);

  // Then process new messages
  while (true) {
    const results = await redis.xreadgroup(
      "GROUP",
      GROUP_NAME,
      consumerName,
      "COUNT",
      String(BATCH_SIZE),
      "BLOCK",
      String(BLOCK_MS),
      "STREAMS",
      STREAM_KEY,
      ">",
    );

    if (!results) continue;

    for (const [, messages] of results) {
      for (const [id, fields] of messages) {
        const event = parseStreamFields(fields);
        try {
          await processOrder(event);
          await redis.xack(STREAM_KEY, GROUP_NAME, id);
        } catch (err) {
          console.error(`Failed to process ${id}:`, err);
          // Will be retried via pending recovery
        }
      }
    }
  }
}

// Claim and reprocess messages stuck in pending state
async function processPending(
  redis: Redis,
  consumerName: string,
): Promise<void> {
  const pending = await redis.xpending(
    STREAM_KEY,
    GROUP_NAME,
    "-",
    "+",
    String(BATCH_SIZE),
  );

  for (const [id, , idleTime] of pending) {
    if (Number(idleTime) > CLAIM_MIN_IDLE_MS) {
      const claimed = await redis.xclaim(
        STREAM_KEY,
        GROUP_NAME,
        consumerName,
        CLAIM_MIN_IDLE_MS,
        id,
      );

      for (const [claimedId, fields] of claimed) {
        try {
          const event = parseStreamFields(fields);
          await processOrder(event);
          await redis.xack(STREAM_KEY, GROUP_NAME, claimedId);
        } catch (err) {
          console.error(`Failed to reprocess ${claimedId}:`, err);
        }
      }
    }
  }
}

function parseStreamFields(fields: string[]): {
  orderId: string;
  action: string;
  data: Record<string, unknown>;
} {
  const obj: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    obj[fields[i]] = fields[i + 1];
  }
  return {
    orderId: obj.orderId,
    action: obj.action,
    data: JSON.parse(obj.data),
  };
}

export { addOrderEvent, startConsumer };
```

**Why good:** MKSTREAM creates stream if it doesn't exist, processes pending messages on startup for crash recovery, XCLAIM reclaims stuck messages from dead consumers, XACK confirms processing, field parsing handles Redis stream key-value pairs

---

## Distributed Lock with SET NX

```typescript
import type Redis from "ioredis";
import crypto from "node:crypto";

const LOCK_DEFAULT_TTL_MS = 10000; // 10 seconds
const LOCK_RETRY_DELAY_MS = 100;

interface LockOptions {
  ttlMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
}

async function acquireLock(
  redis: Redis,
  resource: string,
  options: LockOptions = {},
): Promise<string | null> {
  const {
    ttlMs = LOCK_DEFAULT_TTL_MS,
    retryCount = 3,
    retryDelayMs = LOCK_RETRY_DELAY_MS,
  } = options;

  const lockKey = `lock:${resource}`;
  const lockValue = crypto.randomUUID(); // Unique owner ID

  for (let i = 0; i <= retryCount; i++) {
    const acquired = await redis.set(lockKey, lockValue, "PX", ttlMs, "NX");

    if (acquired === "OK") {
      return lockValue; // Return owner ID for safe release
    }

    if (i < retryCount) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  return null; // Failed to acquire
}

// Release lock only if we still own it (Lua script for atomicity)
async function releaseLock(
  redis: Redis,
  resource: string,
  lockValue: string,
): Promise<boolean> {
  const lockKey = `lock:${resource}`;

  const result = await redis.eval(
    `
    if redis.call('GET', KEYS[1]) == ARGV[1] then
      return redis.call('DEL', KEYS[1])
    else
      return 0
    end
    `,
    1,
    lockKey,
    lockValue,
  );

  return result === 1;
}

export { acquireLock, releaseLock };
```

#### Usage with Resource Protection

```typescript
async function processExclusiveTask(redis: Redis, taskId: string) {
  const lockValue = await acquireLock(redis, `task:${taskId}`, {
    ttlMs: 30000,
  });

  if (!lockValue) {
    console.log(`Task ${taskId} is already being processed`);
    return;
  }

  try {
    // Do exclusive work here
    await performTask(taskId);
  } finally {
    // Always release in finally block
    await releaseLock(redis, `task:${taskId}`, lockValue);
  }
}
```

**Why good:** UUID lock value ensures only the owner can release, Lua script makes GET+DEL atomic (prevents releasing someone else's lock), PX for millisecond TTL precision, retry logic for contention, finally block ensures release even on error

---

_Full skill documentation: [SKILL.md](../SKILL.md) | Quick reference: [reference.md](../reference.md)_
