# AI Reviewing - Core Examples

> Good/bad AI integration patterns to look for during review. See [../SKILL.md](../SKILL.md) for checklists and the severity framework.

---

## Instruction/Data Separation

```typescript
// Must Fix: retrieved document content joins the instruction channel raw -
// a hostile page can rewrite the task ("ignore prior instructions and ...")
const prompt = `Summarize these sources for the user.\n\n${docs.map((d) => d.text).join("\n")}`;

// Good: untrusted content is fenced and labeled as data, instructions stay separate
const messages = [
  { role: "system", content: SUMMARIZER_RULES },
  {
    role: "user",
    content: docs
      .map((d) => `<source url="${d.url}">${d.text}</source>`)
      .join("\n"),
  },
];
```

Trace the chain, not the line: the fetch was fine, the embedding was fine - the splice is where injection happens.

---

## Schema-Validated Structured Output

```typescript
// Must Fix: parse-and-trust - malformed output crashes, hostile output routes
const { action, args } = JSON.parse(completion.text);
await toolHandlers[action](args);

// Good: fence-stripped, schema-parsed, failure has a path
const toolCallSchema = z.object({
  action: z.enum(["search", "summarize", "escalate"]),
  args: z.record(z.string(), z.unknown()),
});

const raw = stripCodeFences(completion.text);
const parsed = toolCallSchema.safeParse(JSON.parse(raw));
if (!parsed.success) {
  return await repairAndRetry(raw, parsed.error, { maxAttempts: 1 });
}
await toolHandlers[parsed.data.action](parsed.data.args);
```

The `z.enum` is the control-flow guard: the model picks from a contract, not from every key the handler map happens to have.

---

## Bounded Agent Loop

```typescript
// Must Fix: the model decides when to stop - a loop of tool calls bills until the provider cuts you off
while (true) {
  const step = await runAgentStep(messages);
  if (step.done) break;
  messages.push(step.toolResult);
}

// Good: budget is code, not model judgment
for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
  const step = await runAgentStep(messages);
  if (step.done) return step.answer;
  messages.push(step.toolResult);
}
throw new AgentBudgetExceededError(MAX_AGENT_TURNS);
```

---

## Transient vs Non-Transient Failures

```typescript
// Should Fix: retries a context-overflow 400 three times with the same oversized prompt,
// and retries content-filter refusals as if they were network blips
const response = await pRetry(() => client.messages.create(params), {
  retries: 3,
});

// Good: retry only what can succeed on retry
const response = await pRetry(
  () => client.messages.create(params, { timeout: 30_000 }),
  {
    retries: 3,
    shouldRetry: (error) =>
      isRateLimit(error) || isServerError(error) || isTimeout(error),
  },
);
```

---

## Mid-Stream Failure Handling

```typescript
// Should Fix: a dropped connection at 80% persists a truncated answer as complete
let text = "";
for await (const chunk of stream) {
  text += chunk.delta;
}
await saveAnswer(text);

// Good: completion is a signal, not an assumption
let text = "";
try {
  for await (const chunk of stream) {
    text += chunk.delta;
  }
} catch (error) {
  await markAnswerFailed(conversationId, error);
  throw error;
}
if (!streamCompletedNormally(stream)) {
  await markAnswerFailed(conversationId, new TruncatedStreamError());
  return;
}
await saveAnswer(text);
```

---

## Key and PII Hygiene, Pinned Models

```typescript
// Must Fix: key inline, full prompt (user PII) in logs, model string scattered
const client = new Anthropic({ apiKey: "sk-ant-..." });
logger.info(`calling claude with: ${JSON.stringify(messages)}`);
await client.messages.create({ model: "claude-sonnet-5", messages });

// Good: key from config, metadata-only logging, model pinned once
const client = new Anthropic({ apiKey: config.anthropicApiKey });
logger.info(
  { messageCount: messages.length, model: MODELS.chat },
  "model call",
);
await client.messages.create({ model: MODELS.chat, messages });
```
