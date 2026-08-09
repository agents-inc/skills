---
name: meta-reviewing-ai-reviewing
description: AI integration review patterns. Use when reviewing model API calls, prompt construction, LLM output handling, RAG pipelines, and tool-calling code. Covers prompt-injection call-chain tracing, output validation, token budgets, retry/timeout handling, streaming, and key/PII exposure.
---

# AI Code Review Patterns

> **Quick Guide:** When a diff touches model calls, trace every user-controlled string from its entry point into the prompt it lands in - that chain is the injection surface. Verify model output is validated before it drives control flow or storage, context growth is bounded, model calls carry timeouts and typed failure handling, and no keys or PII ride along in prompts or logs.

---

<critical_requirements>

## CRITICAL: Before Reviewing AI Code

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST trace every path where user-controlled input enters a prompt - through variables, retrieved documents, and tool results alike)**

**(You MUST verify every model response used in control flow, stored, or shown to other users is validated before use)**

**(You MUST check that conversation history and retrieved context are bounded - no accumulation without truncation)**

**(You MUST verify model calls carry a timeout and handle failure distinctly from success - transient errors retried or surfaced, never swallowed)**

**(You MUST verify no API keys, credentials, or PII appear in prompts, logs, or error messages the diff adds)**

</critical_requirements>

---

**Auto-detection:** review AI code, LLM PR review, prompt review, model call review, RAG review, tool calling review, agent loop review, completion handling review

**When to use:**

- Reviewing diffs containing model API calls (Anthropic, OpenAI, or other provider SDKs)
- Reviewing prompt construction, templates, or system prompt changes
- Reviewing parsing/consumption of LLM responses, including streaming
- Reviewing RAG retrieval pipelines or embedding code
- Reviewing agent orchestration and tool-calling loops

**When NOT to use:**

- When implementing AI features (use the relevant AI implementation skill)
- For plain REST/database code in the same diff (use the API reviewing skill)
- For prompt-quality tuning with no code change

**Key patterns covered:**

- Prompt-injection call-chain tracing
- Output validation before control flow and storage
- Token budget and context-growth review
- Failure handling around model calls (timeout, retry, typed errors)
- Streaming and partial-response handling
- Key/PII hygiene and model pinning

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Good/bad AI integration patterns to look for during review

---

<philosophy>

## Philosophy

**A model call is an untrusted boundary in both directions.** What goes in can carry an attacker's instructions; what comes out is a guess shaped like an answer. The review's job is to find the places the diff treats either direction as trusted.

**When reviewing AI code:**

- Map the call chain first: input entry → prompt assembly → API call → response parsing → consumption. Findings live at the joints.
- Treat retrieved documents and tool outputs as user-controlled - injection via a fetched page is still injection
- Ask of every response use: "what happens when the model returns garbage that parses?"
- Cost is a correctness concern: an unbounded loop of model calls is a defect even when every call succeeds

**When NOT to flag:**

- Don't demand fallback model chains for internal tooling or batch jobs where failing loudly is fine
- Don't demand prompt caching or cost optimization the spec never asked for
- Don't flag deterministic-output assumptions in throwaway scripts the way you would in a user-facing pipeline
- Don't demand eval harnesses in a diff that only rewords a prompt - note it and move on

**Core principles:**

- **The chain is the unit of review**: a sanitized entry point means nothing if a later join splices raw input
- **Validation before consumption**: a schema between the model and your control flow
- **Bounded everything**: history, retrieval, retries, and loops all need a ceiling
- **Failure is a first-class path**: model APIs fail often enough that unhandled rejection is a design decision, not an oversight

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Prompt-Injection Call-Chain Tracing

Follow every user-controlled string to the prompt it lands in.

```markdown
## Injection Trace

For EACH prompt the diff constructs or changes:

- [ ] List every interpolated value and classify it: static, developer-controlled, or user-controlled
- [ ] User-controlled values are delimited/structured (tagged blocks, separate messages), not spliced into instructions
- [ ] Retrieved documents and tool results are treated as user-controlled
- [ ] System-prompt content (rules, secrets, tool definitions) is never echoed into user-visible output paths
- [ ] Instructions and data are separated - the prompt never asks the model to obey text it also lets the user write
```

```typescript
// Must Fix: user text spliced into the instruction channel
const prompt = `You are a support agent. ${userMessage}. Use the refund tool if appropriate.`;

// Good: instructions and untrusted data are separate, and the data is fenced
const messages = [
  { role: "system", content: SUPPORT_AGENT_RULES },
  {
    role: "user",
    content: `<customer_message>${userMessage}</customer_message>`,
  },
];
```

**Why this matters:** Injection is a chain property, not a line property. The one splice you don't trace is the one that lets a pasted email operate your tools.

---

### Pattern 2: Output Validation Before Consumption

A model response is a guess - validate it before it acts.

```markdown
## Output Validation Review

For EACH place the diff consumes a model response:

- [ ] Structured output is schema-parsed (Zod or equivalent), not JSON.parse-and-trust
- [ ] Parse failures have a handling path: retry, repair, or explicit error - never undefined flowing on
- [ ] Responses driving control flow (classifications, tool choices) are checked against the allowed set
- [ ] Model output stored or shown to OTHER users is treated as untrusted content (escaped/sanitized per sink)
- [ ] Tool-call arguments from the model are validated like user input before execution
```

```typescript
// Must Fix: control flow on unvalidated output
const action = JSON.parse(response.text).action;
await handlers[action](payload); // model typo = property lookup on undefined; hostile output = arbitrary handler

// Good: the model chooses from a contract, not a namespace
const parsed = actionSchema.safeParse(JSON.parse(response.text));
if (!parsed.success) return retryWithRepair(response.text, parsed.error);
await handlers[parsed.data.action](parsed.data.payload);
```

**Why this matters:** LLMs produce plausible malformed output at some rate forever. Unvalidated consumption converts that rate directly into production incidents.

---

### Pattern 3: Token Budget and Context Growth

Everything appended needs a ceiling.

```markdown
## Context Growth Review

When the diff touches history, retrieval, or prompt assembly:

- [ ] Conversation history has a truncation/windowing strategy, not unbounded push
- [ ] Retrieved chunks are capped in count and size before joining into the prompt
- [ ] max_tokens is set deliberately for the call's purpose
- [ ] Loops that call the model (agents, retries, map-over-items) have an iteration or budget cap
```

```typescript
// Should Fix: history grows until the context overflows - cost climbs every turn until then
messages.push(userTurn, assistantTurn);

// Good: bounded window
messages = [...messages, userTurn, assistantTurn].slice(-MAX_TURNS);
```

**Why this matters:** Unbounded context fails twice: rising cost per request on the way up, then hard context-length errors at the top - usually first hit by your most engaged user.

---

### Pattern 4: Failure Handling Around Model Calls

Model APIs fail routinely; the diff must decide what that means.

```markdown
## Failure Path Review

For EACH model call the diff adds:

- [ ] A timeout exists - SDK default or explicit - and suits the caller (interactive vs batch)
- [ ] Transient failures (429, 5xx, timeouts) are retried with backoff OR deliberately surfaced - not swallowed
- [ ] Non-transient failures (400, content filter, context overflow) are NOT retried blindly
- [ ] The caller can distinguish "model failed" from "model answered badly" - different handling, different logging
- [ ] Where the spec demands availability: a degraded path exists (fallback model, cached answer, honest error)
```

```typescript
// Must Fix: one 429 during a traffic spike kills the request; a hang holds it forever
const response = await client.messages.create({ model, messages });

// Good: bounded patience, typed failure
const response = await withRetry(
  () => client.messages.create({ model, messages }, { timeout: 30_000 }),
  { retries: 3, retryOn: isTransient, backoff: "exponential" },
);
```

**Why this matters:** Rate limits and provider incidents are weekly events, not edge cases. Code that treats a model call like a local function call outages with its provider.

---

### Pattern 5: Streaming and Partial Responses

A stream can die mid-token; the consumer must stay coherent.

```markdown
## Streaming Review

When the diff handles streamed output:

- [ ] Mid-stream errors/disconnects are handled - partial text is discarded or clearly marked, not silently kept as complete
- [ ] Accumulation is complete before parse/persist steps that need the whole response
- [ ] Client disconnect aborts the upstream model request (no orphaned paid streams)
- [ ] UI state distinguishes "streaming", "done", and "failed mid-stream"
```

**Why this matters:** A stream that dies at 80% looks like a short answer. Persisting or acting on it silently corrupts downstream data with truncated content.

---

### Pattern 6: Keys, PII, and Model Pinning

The operational hygiene around the call.

```markdown
## Hygiene Review

- [ ] API keys come from config/env - never literal in the diff, never logged
- [ ] Prompts containing user PII are not dumped wholesale into logs or error messages
- [ ] Model identifiers are named constants - pinned versions, not scattered string literals
- [ ] Temperature/params are deliberate for the task (deterministic tasks near 0)
```

**Why this matters:** Prompt logging is the quiet PII leak: one debug line ships every user's message content to the log platform. Scattered model strings make the next migration a grep-and-pray.

</patterns>

---

<decision_framework>

## Decision Framework

### Severity Classification for AI Issues

```
Is this a safety or correctness defect the diff introduces?
├─ User-controlled text spliced into the instruction channel → MUST FIX
├─ Unvalidated model output driving control flow, tools, or storage → MUST FIX
├─ Keys or PII in prompts, logs, or error messages → MUST FIX
├─ Unbounded model-call loop (agent/retry without a cap) → MUST FIX
└─ NO → Is it a robustness or cost gap?
    ├─ No timeout / transient failures unhandled on a production path → SHOULD FIX
    ├─ Unbounded history or retrieval growth → SHOULD FIX
    ├─ Partial stream treated as complete → SHOULD FIX
    ├─ Model ids as scattered string literals → SHOULD FIX
    └─ NO → Is it a genuine enhancement?
        ├─ Tightening an already-safe output schema → NICE TO HAVE
        ├─ Fallback model chain for internal tooling → DON'T MENTION
        ├─ Prompt-wording preferences → DON'T MENTION
        └─ Cost optimizations the spec never asked for → DON'T MENTION
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues (Must Fix):**

- Template literals splicing user text directly into system/instruction prompts
- `JSON.parse(response)` with no schema and no failure path
- Model-chosen strings indexing into handler/tool maps unchecked
- `while` agent loops with no iteration cap
- API keys hardcoded or logged; full prompts with PII logged
- Tool-call arguments executed without validation

**Medium Priority Issues (Should Fix):**

- Model calls with no timeout on request paths
- Retry-on-everything (including 400s and content filters)
- History arrays that only ever grow
- Streaming handlers with no mid-stream error branch
- Unpinned or scattered model identifiers

**Common Mistakes:**

- Sanitizing direct user input but splicing retrieved documents raw (indirect injection)
- Validating happy-path JSON but letting the parse-failure branch return undefined
- Retrying a context-overflow error with the same oversized prompt
- Treating temperature 0 as deterministic enough to skip output validation
- Logging "the whole request for debugging" on a path that carries user content

**Gotchas & Edge Cases:**

- Models emit markdown-fenced JSON (` ```json `) - parsers that don't strip fences fail intermittently
- Token counts differ per model family - a budget tuned for one model overflows on another
- Content-filter responses can arrive as successful completions with refusal text, not errors
- Streamed tool-call arguments arrive fragmented; parsing before the stream closes sees half a JSON object
- Provider SDK retries can stack with your own retry wrapper - multiplying worst-case latency

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST trace every path where user-controlled input enters a prompt - through variables, retrieved documents, and tool results alike)**

**(You MUST verify every model response used in control flow, stored, or shown to other users is validated before use)**

**(You MUST check that conversation history and retrieved context are bounded - no accumulation without truncation)**

**(You MUST verify model calls carry a timeout and handle failure distinctly from success - transient errors retried or surfaced, never swallowed)**

**(You MUST verify no API keys, credentials, or PII appear in prompts, logs, or error messages the diff adds)**

**Failure to catch these issues will result in injectable prompts, garbage output driving real actions, runaway token spend, and user data sitting in logs.**

</critical_reminders>
