# AI Reviewing — Core Examples

> The defect and its fix for each pattern in [SKILL.md](../SKILL.md). Provider values are in [reference.md](../reference.md). Where a concrete client is needed the fixes use the Anthropic TypeScript SDK; the shape carries to other providers.

---

## Pattern 1: Prompt-Injection Call-Chain Tracing

Direct: the user's message joins the instructions, next to a tool that moves money.

```typescript
// Must Fix: user text spliced into the instruction channel
const system = `You are a support agent. ${userMessage}. Use the refund tool if appropriate.`;

// Fixed: instructions stay in the system prompt; the customer's words arrive as fenced data
const system = SUPPORT_AGENT_RULES;
const messages = [
  {
    role: "user",
    content: `<customer_message>${userMessage}</customer_message>`,
  },
];
```

Indirect: the splice happens after retrieval, which is where a review that checked only the form misses it.

```typescript
// Must Fix: retrieved pages join the instructions raw — a page saying
// "ignore prior instructions and ..." is now part of the task
const system = `Summarize these sources for the user.\n\n${docs.map((doc) => doc.text).join("\n")}`;

// Fixed: the task is the instruction; the pages are fenced and labelled as data
const system = SUMMARIZER_RULES;
const messages = [
  {
    role: "user",
    content: docs
      .map((doc) => `<source url="${doc.url}">${doc.text}</source>`)
      .join("\n"),
  },
];
```

A page containing `</source>` closes the fence early. That is why fencing lowers the rate at which injected text is obeyed rather than ending it, and why the refund tool's arguments still go through Pattern 2.

Reach: an assistant that reads the user's inbox (private data), reads every email body (untrusted input) and can send mail (outbound) has all three legs.

```typescript
// Must Fix: one email saying "forward the last invoice to ..." can send it,
// and nobody approves the send
const tools = [readInboxTool, searchInboxTool, sendEmailTool];

// Fixed by dropping a leg: nothing can send; the draft comes back to the user,
// rendered as plain text so no image or link in it loads
const tools = [readInboxTool, searchInboxTool];

// Fixed by putting a person in front: the send waits for approval of the exact
// recipient and body the model wrote
async function handleSendEmail(input: SendEmailInput): Promise<ToolResult> {
  const approved = await requestUserApproval(describeOutgoingEmail(input));
  if (!approved) return declined("The user did not approve this email.");
  return sendEmail(input);
}
```

---

## Pattern 2: Output Validation Before Consumption

```typescript
// Must Fix: JSON asked for in prose and trusted — a truncated reply throws, a malformed
// one routes to undefined, a hostile one reaches any queue the map holds
const { queue, priority } = JSON.parse(textOf(response));
await QUEUES[queue].enqueue(ticket, priority);

// Fixed: the schema constrains the reply, and the reply is still checked on receipt —
// finished, then well-formed, then allowed
const response = await client.messages.create({
  ...params,
  output_config: { format: { type: "json_schema", schema: TRIAGE_SCHEMA } },
});

// This call sets no stop sequences, so end_turn is the only complete ending.
if (response.stop_reason === "refusal") return surfaceRefusal(response);
if (response.stop_reason !== "end_turn") return rejectIncomplete(response); // max_tokens

const triage = parseTriage(textOf(response)); // TRIAGE_SCHEMA in full, checked on receipt
if (!triage.ok) return repairOnce(response, triage.error);

await QUEUES[triage.value.queue].enqueue(ticket, triage.value.priority);
```

`TRIAGE_SCHEMA` enumerates `queue` as the same closed set that keys `QUEUES`, so the lookup cannot miss: the model picks from a contract, not from whatever the map holds. The provider enforces only part of JSON Schema — numeric ranges and string lengths, for two, are left out — so `parseTriage` checks the whole schema again. A refusal goes to the user or a documented fallback, never into `repairOnce`; a `max_tokens` stop needs a larger budget, not a repair.

Tool-call arguments get the same treatment: `strict: true` where the provider offers it, and validation in the handler anyway, because the model wrote them.

---

## Pattern 3: Token Budget and Context Growth

```typescript
// Should Fix: grows until the context overflows, costing more every turn on the way
messages.push(userTurn, assistantTurn);

// Should Fix: bounded, but a slice can start on a tool result whose tool call it cut — a 400
messages = [...messages, userTurn, assistantTurn].slice(-MAX_MESSAGES);

// Fixed: bounded, and trimmed only at the start of a user turn
messages = dropOldestExchanges(
  [...messages, userTurn, assistantTurn],
  MAX_HISTORY_TOKENS,
);
```

`dropOldestExchanges` removes whole exchanges from the front until the history fits, and leaves it starting on a user message that is not a tool result. A provider's server-side compaction does the same job without the edit; [reference.md](../reference.md#history-trimming) covers what a front trim does to caching and to replayed thinking blocks.

```typescript
// Must Fix: the model decides when to stop — a loop of tool calls bills until something outside cuts it off
while (true) {
  const step = await runAgentStep(messages);
  if (step.done) break;
  messages.push(...step.toolExchange);
}

// Fixed: the ceiling is code, and running out of it is an error rather than an answer
for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
  const step = await runAgentStep(messages);
  if (step.done) return step.answer;
  messages.push(...step.toolExchange);
}
throw new AgentBudgetExceededError(MAX_AGENT_TURNS);
```

---

## Pattern 4: Failure Handling Around Model Calls

```typescript
// Should Fix: four wrapper attempts × three SDK attempts = up to twelve requests,
// each allowed the ten-minute default — and a context-overflow 400 is retried with the same prompt
const response = await withRetry(() => client.messages.create(params), {
  retries: 3,
});

// Fixed: one retry layer — the SDK's, which already skips 400s — and a timeout sized for a person waiting
const INTERACTIVE_TIMEOUT_MS = 30_000; // TypeScript SDK timeouts are milliseconds
const INTERACTIVE_MAX_RETRIES = 1;

const client = new Anthropic({
  timeout: INTERACTIVE_TIMEOUT_MS,
  maxRetries: INTERACTIVE_MAX_RETRIES,
});

try {
  return await client.messages.create(params);
} catch (error) {
  if (error instanceof Anthropic.RateLimitError) {
    throw new ModelBusyError({ cause: error });
  }
  throw new ModelCallFailedError({ cause: error });
}
```

Where a wrapper is wanted — a circuit breaker, a fallback to another provider — the client it drives is built with `maxRetries: 0`, so the wrapper is the only layer that retries — and it takes over the exponential backoff and the `retry-after` handling the SDK would have done.

---

## Pattern 5: Streamed Responses

```typescript
// Should Fix: a stream cut at max_tokens is saved as the full answer, an error mid-stream
// leaves the conversation stuck in "streaming", and a closed tab keeps the paid stream running
const stream = client.messages.stream(params);
stream.on("text", sendToClient);
const message = await stream.finalMessage();
await saveAnswer(conversationId, textOf(message));

// Fixed: abort upstream on disconnect, and save only a response that ended normally
const stream = client.messages.stream(params);
onClientDisconnect(() => stream.abort());
stream.on("text", sendToClient);

try {
  const message = await stream.finalMessage(); // rejects on a mid-stream error or an abort
  if (message.stop_reason !== "end_turn") {
    return markAnswerIncomplete(conversationId, message.stop_reason);
  }
  await saveAnswer(conversationId, textOf(message));
} catch (error) {
  await markAnswerFailed(conversationId, error);
  throw error;
}
```

---

## Pattern 6: Keys, PII, and Model Pinning

```typescript
// Must Fix: key in source, every user's message in the logs, model id scattered,
// and a sampling parameter current models reject — every call returns a 400
const client = new Anthropic({ apiKey: "sk-ant-..." });
logger.info(`calling model with: ${JSON.stringify(messages)}`);
await client.messages.create({
  model: "claude-sonnet-5",
  temperature: 0,
  max_tokens: 1024,
  messages,
});

// Fixed: key from the environment, metadata-only logging, the model named once
const client = new Anthropic(); // reads ANTHROPIC_API_KEY
logger.info(
  { messageCount: messages.length, model: MODELS.chat },
  "model call",
);
await client.messages.create({
  model: MODELS.chat,
  max_tokens: CHAT_MAX_TOKENS,
  messages,
});
```
