# AWS SDK v3 — Messaging Patterns (SQS & SNS)

> SQS send/receive/delete, SNS publish, FIFO queues, and dead-letter patterns. See [SKILL.md](../SKILL.md) for decision guidance.

**Related examples:**

- [Core Patterns](core.md) — Client setup, S3, DynamoDB, error handling
- [Advanced](advanced.md) — Lambda, Secrets Manager, presigned URLs, middleware

---

## SQS — Send Message

```typescript
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({});

export async function enqueueOrder(
  queueUrl: string,
  order: OrderPayload,
): Promise<string> {
  const result = await sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(order),
      MessageAttributes: {
        eventType: { DataType: "String", StringValue: "order.created" },
      },
    }),
  );
  return result.MessageId!;
}
```

**Why good:** message attributes enable filtering at the subscription level, typed `SendMessageCommand` provides input validation

---

## SQS — Receive and Delete Messages

Always delete messages after successful processing. Undeleted messages reappear after the visibility timeout.

```typescript
import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

const MAX_MESSAGES = 10;
const WAIT_TIME_SECONDS = 20; // Long polling — reduces empty responses and cost

export async function pollMessages(queueUrl: string): Promise<void> {
  const { Messages } = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: MAX_MESSAGES,
      WaitTimeSeconds: WAIT_TIME_SECONDS,
      MessageAttributeNames: ["All"],
    }),
  );

  // IMPORTANT: Messages may be undefined (not empty array) when queue is empty
  for (const message of Messages ?? []) {
    try {
      const body = JSON.parse(message.Body!);
      await processMessage(body);

      // Delete only after successful processing
      await sqs.send(
        new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: message.ReceiptHandle!,
        }),
      );
    } catch (error) {
      // Message stays in queue — will be retried after visibility timeout
      console.error(`Failed to process message ${message.MessageId}:`, error);
    }
  }
}
```

**Why good:** long polling (`WaitTimeSeconds: 20`) reduces empty responses and API costs, per-message try/catch prevents one failure from blocking the batch, delete-after-process ensures at-least-once delivery

```typescript
// BAD: Deleting before processing
for (const message of Messages ?? []) {
  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle!,
    }),
  );
  await processMessage(JSON.parse(message.Body!)); // If this fails, message is lost
}
```

**Why bad:** deleting before processing means failed messages are lost permanently — they never return to the queue

---

## SQS — FIFO Queue

FIFO queues guarantee ordering and exactly-once processing within a message group.

```typescript
const FIFO_QUEUE_URL =
  "https://sqs.us-east-1.amazonaws.com/123456789012/orders.fifo";

export async function enqueueFifoMessage(
  orderId: string,
  payload: unknown,
): Promise<void> {
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: FIFO_QUEUE_URL,
      MessageBody: JSON.stringify(payload),
      MessageGroupId: orderId, // Messages with same group ID are ordered
      MessageDeduplicationId: `${orderId}-${Date.now()}`, // Prevents duplicate processing
    }),
  );
}
```

**Why good:** `MessageGroupId` ensures all messages for the same order are processed in order, `MessageDeduplicationId` prevents duplicate delivery within the 5-minute deduplication window

**Gotcha:** FIFO queue URLs must end with `.fifo`. The `MessageGroupId` and `MessageDeduplicationId` are required for FIFO queues.

---

## SQS — Batch Send

Use `SendMessageBatchCommand` to send up to 10 messages in a single API call.

```typescript
import { SendMessageBatchCommand } from "@aws-sdk/client-sqs";

const MAX_BATCH_SIZE = 10;

export async function enqueueBatch(
  queueUrl: string,
  messages: OrderPayload[],
): Promise<void> {
  // Split into chunks of MAX_BATCH_SIZE
  for (let i = 0; i < messages.length; i += MAX_BATCH_SIZE) {
    const batch = messages.slice(i, i + MAX_BATCH_SIZE);
    await sqs.send(
      new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: batch.map((msg, idx) => ({
          Id: String(idx),
          MessageBody: JSON.stringify(msg),
        })),
      }),
    );
  }
}
```

---

## SNS — Publish to Topic

```typescript
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const sns = new SNSClient({});

export async function publishEvent(
  topicArn: string,
  event: { type: string; payload: unknown },
): Promise<string> {
  const result = await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(event.payload),
      MessageAttributes: {
        eventType: { DataType: "String", StringValue: event.type },
      },
    }),
  );
  return result.MessageId!;
}
```

**Why good:** message attributes enable SNS subscription filter policies — subscribers only receive events matching their filter

---

## SNS — Publish with Subject (for Email Subscriptions)

```typescript
export async function sendNotification(
  topicArn: string,
  subject: string,
  message: string,
): Promise<void> {
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Subject: subject, // Used as email subject for email subscribers
      Message: message,
    }),
  );
}
```

---

## SNS — Publish to FIFO Topic

```typescript
const FIFO_TOPIC_ARN = "arn:aws:sns:us-east-1:123456789012:orders.fifo";

export async function publishFifoEvent(
  groupId: string,
  payload: unknown,
): Promise<void> {
  await sns.send(
    new PublishCommand({
      TopicArn: FIFO_TOPIC_ARN,
      Message: JSON.stringify(payload),
      MessageGroupId: groupId,
      MessageDeduplicationId: `${groupId}-${Date.now()}`,
    }),
  );
}
```

**Gotcha:** FIFO topic ARNs must end with `.fifo`. FIFO topics can only deliver to FIFO SQS queues, not standard queues or other endpoint types.
