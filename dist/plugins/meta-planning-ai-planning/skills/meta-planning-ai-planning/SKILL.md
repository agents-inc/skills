---
name: meta-planning-ai-planning
description: Specification frameworks for features that call a model — approach tier, model pinning, output contracts, budgets, failure modes and eval design. Load when a spec touches model calls, prompts, retrieval, tool calling, agent loops or evals.
---

# AI Planning Frameworks

> **Quick Guide:** Default to the lowest tier that meets the requirement — most features are one well-built call — and name the requirement behind every tier above it. Pin the model id, give every output a contract the code checks on receipt, state budgets in tokens and money, give each failure the feature can hit a row, and fix eval thresholds before the first run. Two provider facts shape the answers: a schema-constrained output mode guarantees shape only for a response that completed and was not refused, so the contract's remaining work is truncation, refusals and values; and reasoning tokens bill as output and count against the output ceiling, so a ceiling sized for the visible answer can run out before one appears.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — templates for the sections every model-calling feature needs, and a worked specification
- [examples/retrieval-and-agents.md](examples/retrieval-and-agents.md) — retrieval design, tool contracts and loop guards
- [reference.md](reference.md) — output-mode guarantees, budget line items, default failure behaviour, retrieval starting points, grading methods, eval set sizing

---

## Which path applies

A section belongs in the spec only when the feature has its artifact; one filled in for completeness reads to the implementer as something to build.

- **The feature calls a model** — approach, model, prompt, output contract, budgets, failure modes and eval plan; follow [examples/core.md](examples/core.md).
- **It retrieves from a corpus** — add the retrieval section from [examples/retrieval-and-agents.md](examples/retrieval-and-agents.md#pattern-8-retrieval-design).
- **The model calls tools, or orders its own steps** — add tool contracts and loop guards from [examples/retrieval-and-agents.md](examples/retrieval-and-agents.md#pattern-9-tool-contracts-and-agentic-loops).

---

<critical_requirements>

## Before specifying an AI feature

**Name the requirement that rules out the simpler tier before specifying a chain, retrieval or a loop.** Each tier up adds cost, latency and failure rows, and a known step sequence run as a loop buys non-determinism and no capability.

**Pin the model id in configuration, name its fallback, and list what forces a re-eval.** A floating alias changes quality with no deploy, and a fallback nobody named becomes an unhandled exception on the first 5xx.

**Give every model output a contract — mechanism, schema, the validation that runs on receipt, and a repair-or-reject rule.** Provider-side enforcement covers shape for a completed, unrefused response and nothing more, so truncation, refusals and wrong values reach the consumer unless the spec stops them.

**State budgets as numbers, counting reasoning tokens as output and cached input at its cached rate.** An adjective cannot be implemented or reviewed, and a cost line that leaves out either is wrong — low without the reasoning, high without the cache.

**Mark every untrusted input and bound what it can reach.** Delimiting lowers the odds that an injected instruction is followed without preventing it, so the prompt gets adversarial eval cases and its tools get only the access the task needs.

</critical_requirements>

---

**Auto-detection:** AI feature spec, LLM feature spec, model selection, pinned model id, model fallback, prompt version, system prompt, untrusted input, prompt injection, structured output contract, repair or reject, refusal handling, token budget, reasoning tokens, prompt caching, retrieval design, chunk size, re-ranking, tool contract, agent loop, step budget, eval plan, eval threshold, LLM-as-judge

**Applies to:**

- Choosing between a single call, a fixed chain, retrieval and an agentic loop, and recording why the simpler tier lost
- Model selection, prompt architecture and the output contract for each model call
- Token, cost and latency budgets, and the behaviour for each way a call fails
- Retrieval parameters, tool contracts and loop guards
- Eval sets, metrics and the thresholds that gate a merge

**Handled elsewhere:**

- The spec's general shape — research, goal, scope fence, success criteria — belongs to the planning process; this skill adds the sections a model call brings
- Provider SDK calls — parameter names, client setup, streaming plumbing — are the implementation's; the spec names the mechanism, not the call
- The interface that exposes the feature — request and response shapes, error statuses — is settled with that interface; the failure matrix here says what the feature does, not how the interface reports it

---

<philosophy>

## Philosophy

**Non-determinism is the material; contracts are what make it buildable.** A model's output cannot be trusted by construction, so every boundary — schema, budget, failure behaviour, eval threshold — is decided in the spec, or production decides it implicitly.

- **Start from the existing call path.** Trace one model call end to end — client, prompt module, validation, consumer — and cite each as the pattern source with its file and lines; the new feature inherits its retries, timeout and logging, and a bare path leaves the implementer to guess which code was meant.
- **Record the baseline** — current cost, latency and quality, or an explicit "unmeasured" — so the change has something to beat.
- **Decide product questions in the spec**: whether the model may answer when retrieval finds nothing, whether its output acts or only advises.
- **Contracts, budgets and behaviours, not code.** Implementation code in a spec gets followed instead of the codebase's own patterns.

</philosophy>

---

<decision_framework>

## Which tier

Two independent questions, both answered for every feature:

```
Where does the knowledge the task needs live?
├─ In the model or the request         → nothing to add
├─ A bounded set that fits the window  → inline it, cached where the provider caches
├─ A large or growing corpus           → retrieval
└─ A live system of record             → a tool call, not retrieval

Who decides the sequence of steps?
├─ There is one step                   → single call
├─ Several, known in advance           → fixed chain orchestrated in code — cheaper, debuggable, evaluable
└─ Several, chosen by the model as it goes → agentic loop, with every guard in Pattern 9
```

The answers combine — retrieval feeding a single call, a tool call inside a fixed chain — and most features answer "in the request" and "one step". Specify a higher tier only by naming the requirement that forces it, and record each rejected alternative with its reason. Fitting the window is a limit, not evidence of use: quality falls as input grows well before the limit, so the eval set — not the token count — decides whether inlining holds.

## Which output mechanism

```
Is the output an action against a tool or system, a record to consume, or actions followed by a record?
├─ An action  → tool calling, with strict (schema-constrained) arguments where the provider offers them
├─ A record   → the first the provider offers:
│               1. a schema-constrained output mode
│               2. a single submit tool with strict arguments
│               3. JSON mode — valid JSON, schema unchecked
│               4. delimited text + strict parser, with the widest eval coverage
└─ Actions, then a record → one tool per action; the final record through a terminal final-answer tool,
                            or the provider's schema-constrained output on the last turn
```

**Every branch validates on receipt.** Constrained decoding enforces only the schema subset the provider supports — ranges, lengths and formats outside it move to the validator — on a response that completed and was not refused, and it never checks whether a value is true.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Approach and Rationale

The proportionality record: the tier chosen, the requirement that rules out the one below, the alternatives rejected.

```markdown
**Selected approach:** fixed code-orchestrated chain — classify, then summarize long tickets
**Why not simpler:** one call cannot skip summarizing the short majority without paying for it
**Why not a loop:** the step sequence is known in advance
**Why not retrieval:** the label taxonomy fits in the system prompt
```

Template: [examples/core.md](examples/core.md#pattern-1-approach-and-rationale)

### Pattern 2: Model Selection

Score candidates against the requirement — capability on the eval set with the smallest tried first, context, latency, cost, output mechanism, availability, data handling — and record the table.

```markdown
**Primary:** [pinned id] — configured at [config file], never inline
**Fallback chain:** [id] on 429 / 5xx / timeout, then [documented failure response]
**Re-eval trigger:** model id, prompt version or retrieval parameters change; the snapshot retires
```

Pinned snapshots retire on a published schedule, so the spec names who re-runs the eval at migration.

Template: [examples/core.md](examples/core.md#pattern-2-model-selection)

### Pattern 3: Prompt Architecture

Every prompt is named, located, versioned and trust-annotated.

```markdown
**Module:** `prompts/triage-classify.v1.ts` — version logged with every call

| Variable | Source             | Untrusted? |
| -------- | ------------------ | ---------- |
| body     | inbound ticket     | yes        |
| taxonomy | `config/labels.ts` | no         |
```

- **Versioned, never edited in place.** A shipped prompt is superseded by the next version, so eval results attribute to a revision.
- **Instructions in the system-level message, task input in the user message.** Untrusted text is fenced with the codebase's existing delimiter helper, and retrieved documents count as untrusted.
- **Stable content first, per-request content last.** Provider caches match on an exact prefix, so one per-request value near the top — a timestamp, a user's name — makes every call a miss. When the per-request input is a long document, Claude's [long-context guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#long-context-prompting) puts it near the top, above the query and instructions, so the spec states which wins — cache hits (the document after the stable prefix) or long-context quality (the document above the query) — and keeps the stable part above both either way.
- **Bound what untrusted text can reach.** A feature combining untrusted input, private data and an outbound channel — a tool that sends, a link that renders — drops one of the three or puts a person in front of the action, because no injection detector is reliable enough to make the combination safe.
- **List every variable the template reads, with its type and source.** A variable the template reads but the spec never mentions is a contract gap, and the implementer decides its source and its trust.

Template: [examples/core.md](examples/core.md#pattern-3-prompt-architecture)

### Pattern 4: Output Contract

The mechanism from the decision framework, the schema with what the provider enforces and what the validator enforces, and the repair-or-reject rule.

```markdown
| Situation          | Policy                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| Shape violation    | one repair attempt with the validator's error appended, then reject    |
| Semantic violation | reject at once — a repair attempt tends to launder the bad value       |
| Truncated          | reject, or retry once with a higher ceiling — never parse the fragment |
| Refusal            | the refusal policy in Pattern 6 — never the repair loop                |
```

Streamed partial JSON is buffered and validated on completion; nothing acts on a fragment.

Template: [examples/core.md](examples/core.md#pattern-4-output-contract)

### Pattern 5: Budgets and Observability

Per call and per user request, in tokens, money and milliseconds, with the overflow rule — what is shed first, never the system prompt.

```markdown
| Budget                            | Ceiling                              |
| --------------------------------- | ------------------------------------ |
| Output tokens per call            | [reasoning + visible]                |
| Model calls per user request      | [n, including repairs and fallbacks] |
| Cost per request                  | [$, at an assumed cache-hit rate]    |
| p95 latency / time to first token | [ms]                                 |
```

Observability names what is logged per call (model id, prompt version, token counts, latency, cost, outcome, correlation id), the trace spans, what is redacted field by field, and what alerts.

Template: [examples/core.md](examples/core.md#pattern-5-budgets-and-observability)

### Pattern 6: Failure-Mode Matrix

A row per failure the feature can hit, with its detection signal and required behaviour. Each row becomes a success criterion with a mocked trigger.

```markdown
| Failure      | Detection                        | Required behaviour                                                            |
| ------------ | -------------------------------- | ----------------------------------------------------------------------------- |
| Rate limited | 429 with a rate-limit error code | wait out retry-after if sent, else backoff with jitter; capped; then fallback |
| Quota spent  | 429 with a quota or spend code   | fail at once — waiting never clears it                                        |
| Incomplete   | output ceiling reached           | reject; never parse the fragment                                              |
| Refusal      | the provider's refusal signal    | surface it, or a fallback model the provider documents — the spec picks       |
```

Default behaviour for every row: [reference.md](reference.md#default-failure-behaviour). Template: [examples/core.md](examples/core.md#pattern-6-failure-mode-matrix)

### Pattern 7: Eval Plan

A dataset with a location and case count, named metrics with thresholds fixed before the first run, a grading method per metric, the regression set, and the model id, prompt version and retrieval parameters recorded with every run.

```markdown
| Metric               | Threshold                     | Grading                                          |
| -------------------- | ----------------------------- | ------------------------------------------------ |
| Label accuracy       | ≥ 0.90 on 400 cases           | deterministic                                    |
| Injection resistance | every case, in each of 5 runs | deterministic                                    |
| Summary groundedness | ≥ 0.95                        | model-graded, checked against human raters first |
```

- **Size the set so the threshold's interval excludes the failing value** — [reference.md](reference.md#eval-set-size) has the table.
- **Run must-pass cases more than once**; one pass of a non-deterministic system is one sample.
- **Cover empty and degenerate input, not only the happy path** — empty input is a common way a model call fails in production, and a set of happy-path cases never exercises it.
- **Require adversarial cases wherever untrusted text reaches the prompt**: instruction override, delimiter escape, and exfiltration through every tool or channel the call can reach.

Template: [examples/core.md](examples/core.md#pattern-7-eval-plan)

### Pattern 8: Retrieval Design

Chunking, retrieval mode, top-k and re-ranking, access filters and freshness — plus four behaviours the spec decides: empty retrieval, low-similarity retrieval, citations, and whether the model may answer from its own knowledge when retrieval finds nothing.

```markdown
| Parameter      | Value                                                |
| -------------- | ---------------------------------------------------- |
| Split boundary | structural (headings) where the corpus has structure |
| Retrieval mode | hybrid — queries carry error codes                   |
| Top-k          | retrieve wide, re-rank to the n the eval set picks   |
| Access filters | tenant and permission, inside the retrieval query    |
```

Access control lives in the query, against a permission-aware store or a partition. A filter applied after the search returns fewer than k results for a small tenant, and a filter asked of the model is not enforcement. Retrieved text is untrusted input, including what an upload or an insider put into the corpus.

Starting values: [reference.md](reference.md#retrieval-starting-points). Template: [examples/retrieval-and-agents.md](examples/retrieval-and-agents.md#pattern-8-retrieval-design)

### Pattern 9: Tool Contracts and Agentic Loops

Every tool is read-only or mutating; a mutating one names its idempotency strategy, whether it needs confirmation, and whether it may run again after an ambiguous failure. Every loop names six guards.

```markdown
| Guard                 | Value                                                         |
| --------------------- | ------------------------------------------------------------- |
| Step budget           | [max model turns]                                             |
| Token budget          | [cumulative ceiling across the loop]                          |
| Wall-clock budget     | [elapsed limit]                                               |
| Termination           | [every condition, including success]                          |
| Repetition guard      | [behaviour on identical consecutive tool calls]               |
| Partial-result policy | [what is returned, flagged as truncated, when a budget trips] |
```

State carried between steps is named exactly; nothing else persists.

Template: [examples/retrieval-and-agents.md](examples/retrieval-and-agents.md#pattern-9-tool-contracts-and-agentic-loops)

</patterns>

---

<red_flags>

## Red flags

**Breaks in production:**

- An output ceiling sized for the visible answer on a model that reasons — reasoning spends it, the response returns incomplete with no answer, and the tokens are billed — size it for both and give "incomplete" a failure row.
- A refusal sent through the repair loop or the transport retry — the same request is refused and billed again — detect the refusal signal and apply the spec's refusal policy.
- Every 429 retried — a spent quota or spend cap also answers 429, and no wait clears it — tell them apart by error code.
- A retry policy specified on top of a client that already retries — the attempts multiply — state which layer owns retries.
- Empty-retrieval behaviour left undecided — the model answers from its own knowledge and the answer looks cited — decide answer-or-abstain in the spec.
- The system prompt truncated to fit — instructions vanish with no error — shed the lowest-priority context instead.
- A step cap with no partial-result policy — agent frameworks commonly end the run with an error when the cap trips, discarding a partial answer that was available — state what each tripped budget returns.
- A mutating tool allowed to run again after an ambiguous failure with no idempotency key — the action applies twice — put the key in the tool contract.
- Eval thresholds chosen after seeing results — the gate ratifies whatever shipped — fix them in the spec.

**Surprising behaviour:**

- A valid-shaped record with an invented value passes schema validation; semantic checks are separate code.
- An id's shape does not say whether it is pinned: a dateless id is a fixed snapshot on one provider and a hot-swapped alias on another, so the spec cites the provider's versioning page.
- A threshold on a small eval set measures noise — at 0.90 on 40 cases, 0.85 and 0.95 are indistinguishable.
- A model judge is swayed by answer length and by the order a pair is presented in, and its scores mean nothing until they are checked against human labels.

</red_flags>
