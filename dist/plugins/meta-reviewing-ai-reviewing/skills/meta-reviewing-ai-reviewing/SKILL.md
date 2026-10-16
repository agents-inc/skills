---
name: meta-reviewing-ai-reviewing
description: AI integration review patterns. Use when reviewing model API calls, prompt construction, LLM output handling, RAG pipelines, and tool-calling code. Covers prompt-injection call-chain tracing, output validation, stop reasons, token budgets, retry and timeout handling, streaming, and key/PII exposure.
---

# AI Code Review Patterns

> **Quick Guide:** A model call is untrusted in both directions, so the review follows every user-controlled string into the prompt it lands in, and every response out to whatever it drives. Four facts about current providers change what counts as a defect. The Anthropic and OpenAI SDKs retry twice and time out after ten minutes by default, so a call with no options is protected but too patient for a person waiting, and a retry wrapper around it multiplies attempts. A response cut off at the token limit, or refused, arrives as a successful call. A stream can fail after its 200. And current reasoning models reject a non-default `temperature`, so setting one buys a 400 rather than determinism.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — the defect and its fix for each pattern below
- [reference.md](reference.md) — per-provider lookup: SDK retry and timeout defaults, stop and finish reasons, structured-output parameters, sampling parameters, history rules

---

<critical_requirements>

## Before reviewing AI code

**Trace every value interpolated into a prompt back to where it entered — retrieved documents and tool results included.** Injection is a property of the chain rather than the line: input sanitised at the entry point and spliced raw at a later join is still injected, and a fetched page is as hostile as anything a user types.

**Find what each model response is allowed to do, and check it is validated before it does it.** A response that picks a handler, fills tool arguments, is stored, or is shown to another user is untrusted input; models return malformed and adversarial output at some rate forever, and the check between response and action decides what that rate costs.

**Find the ceiling on everything that grows — history, retrieved context, retries, and loops that call the model.** Every token is billed on every call, so an unbounded one costs more each turn until it fails at the context limit, first for the most engaged user.

**Establish the timeout and retry policy each call actually runs with, SDK defaults included, and check failure reaches the caller as failure.** A call with no options gets ten minutes and two retries, timeouts included, so it can hang for half an hour; and a failure swallowed into an empty answer reads downstream as the model having nothing to say.

**Check that keys stay out of prompts and client bundles, and user content out of logs and error messages.** Anyone who talks to the model can extract its system prompt, and one debug line that logs a prompt ships every user's message to wherever logs go.

</critical_requirements>

---

**Auto-detection:** AI code review, LLM PR review, `messages.create`, `messages.stream`, `chat.completions.create`, `responses.create`, `stop_reason`, `finish_reason`, `max_tokens`, `maxRetries`, `tool_use`, `tool_calls`, `output_config`, `response_format`, system prompt, prompt template, retrieved chunks, embeddings, agent loop

**Applies to:**

- Diffs that add or change a model call, its options, or the client it runs on
- Prompt assembly — templates, system prompts, retrieved context, tool results fed back
- Code that consumes a response — parsing, tool dispatch, storage, display, streaming
- Agent and tool-calling loops
- Grading the AI-specific findings by severity

**Handled elsewhere:**

- Building the integration — choosing the provider and writing the prompts and client code is implementation; this skill finds what the diff gets wrong.
- Budgets, eval thresholds and the output contract — decided when the feature is specified; review checks the diff against whatever was decided.
- The code around the call — the handler, the database write and the auth check are reviewed as that layer's code; this skill covers the model boundary.
- Prompt wording with no code change — whether an instruction works is answered by an eval, not by reading the diff.
- Running and writing up the review — reading order, file:line evidence, tone and the approval decision belong to the general review process.

---

<philosophy>

## Philosophy

**A model call is an untrusted boundary in both directions.** What goes in can carry an attacker's instructions; what comes out is a guess shaped like an answer. The review finds the places the diff treats either direction as trusted.

Map the chain before reading lines: input entry → prompt assembly → API call → response checks → consumption. Findings live at the joints — the fetch was fine, the embedding was fine, and the splice between them is where the injection lands.

Ask of every response use what happens when the model returns garbage that parses — a valid label that is the wrong one, a well-formed refund for the wrong amount. Every check in Pattern 2 passes it, because a schema checks shape and never truth.

Cost is a correctness concern. An unbounded loop of model calls is a defect even when every call succeeds.

**Leave these unflagged:**

- Fallback model chains for internal tooling or batch jobs, where failing loudly is fine
- Prompt caching or cost optimisation the spec never asked for
- A missing `temperature: 0` — current reasoning models reject it, and where it is accepted it does not make output repeatable
- Eval harnesses in a diff that only rewords a prompt — note it and move on
- Throwaway scripts held to the standard of a user-facing pipeline

</philosophy>

---

<decision_framework>

## Severity

```
Is it a safety or correctness defect the diff introduces?
├─ User-controlled text spliced into the instruction channel → MUST FIX
├─ Private data + untrusted input + an outbound or mutating tool, with no person confirming the action → MUST FIX
├─ Unvalidated model output driving control flow, tools, storage, or other users' screens → MUST FIX
├─ Keys in prompts or client bundles; prompts or user content in logs or errors → MUST FIX
├─ User data the task does not need in a prompt, or a prompt sent to a model or provider the spec does not allow → MUST FIX
├─ A loop that calls the model (agent, retry, map-over-items) with no ceiling → MUST FIX
├─ A request parameter the model rejects, so every call returns a 400 → MUST FIX
└─ NO → Is it a robustness or cost gap?
    ├─ Timeout unsuited to the caller, or failure swallowed, on a production path → SHOULD FIX
    ├─ Retries stacked on the SDK's own, or retrying what cannot succeed → SHOULD FIX
    ├─ History or retrieval with no ceiling → SHOULD FIX
    ├─ Truncated, refused or broken-stream response consumed as complete → SHOULD FIX
    ├─ A record asked for as JSON in prose where the provider offers a schema-constrained mode → SHOULD FIX
    ├─ A model id literal where the codebase already names its models in one place → SHOULD FIX
    └─ NO → Is it a genuine enhancement?
        ├─ Tightening an already-safe output schema → NICE TO HAVE
        ├─ Fallback model chain for internal tooling → don't write it
        ├─ Prompt-wording preferences → don't write it
        └─ Cost optimisations the spec never asked for → don't write it
```

User content a task needs is not a finding in its prompt — summarising a user's email needs the email. Anything beyond that need is: everything a prompt carries leaves for the provider and can come back in a reply, so a whole customer record interpolated where only the name is used is a Must Fix. So is user content in a log line or an error message, and any prompt sent to a model or provider the spec does not allow.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Prompt-Injection Call-Chain Tracing

Follow every user-controlled string to the prompt it lands in, then to what the model can do after reading it. Delimiting untrusted text and instructing the model to ignore commands inside it lower how often an injection is obeyed without preventing it, so what the output can reach is the control that holds. Three legs in one path are therefore a Must Fix: private data, untrusted input reaching the model, and an outbound or mutating tool — an image or link the client renders counts, because loading it sends data out — with no person confirming the action. Drop one leg, or put a person in front of the action. Sources are in [reference.md](reference.md#external-references-by-finding-class).

```markdown
For each prompt the diff builds or changes:

- [ ] Every interpolated value is classified: static, developer-controlled, or user-controlled
- [ ] Retrieved documents and tool results count as user-controlled
- [ ] User-controlled text sits in its own message or block, delimited — never spliced into the instructions
- [ ] Nothing in the system prompt would cause harm if a user read it: no secrets, no access rule the code does not also enforce
- [ ] Private data, untrusted input and an outbound or mutating tool never meet in one path unless a person confirms the action first
```

Full code: [examples/core.md](examples/core.md#pattern-1-prompt-injection-call-chain-tracing)

### Pattern 2: Output Validation Before Consumption

A response is a guess. Check that it finished, then that it has the right shape, then that its choices are allowed — before it acts.

```markdown
For each place the diff consumes a model response:

- [ ] The stop reason is checked first — a truncated or refused response arrives as a success, and a refusal is surfaced or sent to a documented fallback, never repaired or retried
- [ ] A record comes from the provider's schema-constrained output mode where it offers one, not JSON asked for in prose
- [ ] Structured output is still parsed against a runtime schema on receipt, not `JSON.parse`-and-trust
- [ ] A parse failure has a path — repair once, reject, or raise — never `undefined` flowing on
- [ ] A choice that drives control flow (a label, an action, a tool name) is checked against the allowed set
- [ ] Tool-call arguments are validated like user input before the tool runs
- [ ] Output stored or shown to other users is encoded for its sink — HTML, SQL, shell
```

Full code: [examples/core.md](examples/core.md#pattern-2-output-validation-before-consumption)

### Pattern 3: Token Budget and Context Growth

Everything appended needs a ceiling, and the trim has to land where the API accepts it.

```markdown
When the diff touches history, retrieval, or prompt assembly:

- [ ] Conversation history has a ceiling — a window, a summary, or the provider's compaction
- [ ] A trim never leaves a tool result without the tool call before it
- [ ] Retrieved chunks are capped in count and size before joining the prompt
- [ ] `max_tokens` is set for the call's purpose
- [ ] Loops that call the model — agents, retries, map-over-items — have an iteration or budget cap
```

Full code: [examples/core.md](examples/core.md#pattern-3-token-budget-and-context-growth)

### Pattern 4: Failure Handling Around Model Calls

Model APIs fail routinely, and the diff decides what each failure means.

```markdown
For each model call the diff adds:

- [ ] The timeout it runs with is known — SDK default or explicit — and an interactive path sets its own
- [ ] Retries live in one layer: the SDK's `maxRetries`, or a wrapper driving a client set to 0 — and a hand-written layer backs off exponentially and honours `retry-after`, because a 429 retried at once lands in the same rate-limit window
- [ ] Nothing that cannot succeed on retry is retried — 400s, auth errors, context overflow, refusals
- [ ] The caller can tell "the call failed" from "the model answered badly", and handles and logs them differently
- [ ] Where the spec demands availability, a degraded path exists: fallback model, cached answer, honest error
```

Full code: [examples/core.md](examples/core.md#pattern-4-failure-handling-around-model-calls)

### Pattern 5: Streamed Responses

A stream can fail after its 200 and can end early; the consumer stays coherent either way.

```markdown
When the diff handles streamed output:

- [ ] A mid-stream error or disconnect is handled — partial text is discarded or marked, never kept as complete
- [ ] Parse and persist steps wait for the end of the stream and check its stop reason
- [ ] Streamed tool-call arguments are parsed only once their block closes
- [ ] A client disconnect aborts the upstream request, so no paid stream runs on for nobody
- [ ] The UI distinguishes streaming, done, and failed mid-stream
```

Full code: [examples/core.md](examples/core.md#pattern-5-streamed-responses)

### Pattern 6: Keys, PII, and Model Pinning

The operational hygiene around the call. Prompt logging is the quiet leak, and scattered model strings make the next migration a search-and-hope.

```markdown
- [ ] API keys come from configuration — never a literal in the diff, never logged, never in a browser bundle
- [ ] Prompts and responses carrying user content stay out of logs and errors — log ids, counts and the model, not bodies
- [ ] A prompt carries only the user data its task needs, and goes only to models and providers the spec allows
- [ ] Where the codebase already names its models in one place, model ids come from there rather than as literals; where a provider's alias can move to a newer snapshot, the dated snapshot
- [ ] Sampling parameters, where set, are ones the model accepts, and nothing downstream relies on them for repeatability
```

Full code: [examples/core.md](examples/core.md#pattern-6-keys-pii-and-model-pinning)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A retry wrapper around an SDK call that keeps its own retries — each wrapper attempt is up to three SDK attempts, so `retries: 3` is up to twelve requests. Drive the wrapper with a client built with `maxRetries: 0`, or drop the wrapper.
- `JSON.parse` on response text with no schema and no failure branch — malformed output throws, or flows on as `undefined`. Parse against a schema and give the failure a path.
- A model-chosen string indexing a handler map, or model-written arguments passed straight to a tool — a typo calls `undefined`, and a hostile reply reaches anything the map holds. Check the choice against the allowed set and the arguments against the tool's schema.
- Response text read without the stop reason — truncation (`max_tokens`, `length`) and refusals arrive as HTTP 200, so truncated JSON fails to parse and a refusal is stored as the answer.
- `temperature`, `top_p` or `top_k` set on a current reasoning model — most current Claude models and OpenAI's reasoning models reject non-default values with a 400; [reference.md](reference.md) lists which.
- `while (true)` around an agent step — the model decides when to stop, and a loop of tool calls bills until something outside cuts it off. The ceiling belongs in code.
- `messages.push` with no trim anywhere — each turn costs more than the last until the context limit turns it into an error. A plain `slice` is no cure: it can cut a tool call away from its result, which the API rejects.
- Retrying everything — a context-overflow 400 retried with the same prompt fails identically every time, and a retried refusal reads as an attempt to get around it.
- A literal key, or `dangerouslyAllowBrowser: true`, in code that ships — the key reaches every visitor. Calls go through a server.
- A log line carrying the prompt or response body, or the SDK's debug log level in deployed config — at `debug` the Anthropic TypeScript SDK logs request and response bodies.

**Surprising behaviour:**

- Delimiting untrusted text in tags or a separate message lowers how often injected instructions are obeyed; it does not stop them, and a document can contain the closing tag.
- Sanitising the user's input while splicing retrieved documents raw leaves the door open — indirect injection arrives through the fetch, not the form.
- The Anthropic API can send an `error` event (`overloaded_error`, for one) after a stream has returned 200, so handling keyed on HTTP status never sees it.
- Streamed tool-call arguments arrive as partial JSON fragments; parsing before the block closes sees half an object.
- Timeouts are retried. With SDK defaults the caller can wait three times the timeout — thirty minutes — before hearing of a failure.
- Models wrap JSON in markdown fences when it is asked for in prose. A provider's schema-constrained output mode does not, so a fence-stripper in the diff says that mode is not in use.
- `temperature: 0` is not deterministic: the same prompt yields different completions as server batch sizes vary. It is never a reason to skip validation.
- Token counts differ by tokenizer, so a budget tuned on one model can overflow on another — Anthropic's tokenizer from Claude Opus 4.7 on uses up to 1.35× as many tokens as the one before.

</red_flags>
