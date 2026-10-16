# AI Planning - Core Spec Sections

> Templates for the sections every model-calling feature needs, under the pattern names in [SKILL.md](../SKILL.md), then a worked specification built from them. Retrieval, tool and loop sections are in [retrieval-and-agents.md](retrieval-and-agents.md); default values are in [reference.md](../reference.md).

---

## Pattern 1: Approach and Rationale

```markdown
## Approach and Rationale

**Selected approach:** [Single call | Fixed code-orchestrated chain | Retrieval-augmented call | Agentic loop | Retrieval + agentic loop]
**Why not simpler:** [The requirement that rules out the tier below. If none does, use that tier.]

| Rejected alternative | Why rejected                                   |
| -------------------- | ---------------------------------------------- |
| [Approach]           | [Concrete reason tied to a stated requirement] |
```

---

## Pattern 2: Model Selection

```markdown
## Model and Provider Selection

**Primary:** [pinned model id] via [provider] — configured at [path/to/config:lines]
**Pinned per:** [the provider's versioning page — whether this id is a snapshot or an alias]
**Fallback chain:** [model id / provider] on [429, 5xx, timeout], then [documented failure response]
**Re-eval trigger:** [model id change, prompt version bump, retrieval parameter change, snapshot retirement]

| Dimension        | Requirement              | Primary meets it?                              |
| ---------------- | ------------------------ | ---------------------------------------------- |
| Capability       | [what it must do]        | [eval result — smallest candidate tried first] |
| Context window   | [worst-case tokens]      | [fit and headroom]                             |
| Latency          | [p95 target]             | [measured or expected]                         |
| Cost             | [per-call ceiling]       | [projected, at the assumed cache-hit rate]     |
| Output mechanism | [mechanism required]     | [supported / not]                              |
| Availability     | [behaviour on 429 / 5xx] | [the fallback named above]                     |
| Data handling    | [boundary, retention]    | [acceptable / not]                             |
```

---

## Pattern 3: Prompt Architecture

```markdown
## Prompt Architecture

### [Prompt name] — `[path/to/prompt.v1.ts]`

**Pattern source:** [path/to/existing-prompt:lines]
**Version:** v1 (new) | v2 (supersedes v1 — v1 stays until eval parity is shown)

| Part                 | Content                                   | Trusted?   |
| -------------------- | ----------------------------------------- | ---------- |
| System-level message | [instructions, constraints, output rules] | yes        |
| Few-shot examples    | [per the few-shot strategy below]         | [yes / no] |
| User message         | [task input, delimited]                   | no         |

| Variable | Type   | Source                | Untrusted? |
| -------- | ------ | --------------------- | ---------- |
| [name]   | [type] | [where it comes from] | [yes/no]   |

**Few-shot strategy:** [none | fixed set of N, and where it sits | retrieved examples — the selection rule, and whether their source is trusted]
**Order:** [stable content first, per-request variables last — which part is the cacheable prefix]
**Untrusted-input boundary:** [how untrusted text is delimited, and what it can reach if an injected instruction is followed]
**Reachable from this prompt:** [tools, private data, outbound channels — if all three, which is removed or put behind a person's approval]
```

---

## Pattern 4: Output Contract

````markdown
## Output Contract

**Mechanism:** [Schema-constrained output | Strict tool arguments | JSON mode | Delimited text]
**Why:** [record or action; what the provider supports]

**Schema:**

```
{ /* field names, types, constraints */ }
```

**Enforced by the provider:** [the schema keywords inside its supported subset]
**Enforced by the validator:** [everything else — ranges, lengths, formats, cross-field rules — at path/to/validator:lines]

| Situation          | Policy                                                            |
| ------------------ | ----------------------------------------------------------------- |
| Shape violation    | [repair once with the validator error, then reject as ERROR_CODE] |
| Semantic violation | [reject at once as ERROR_CODE]                                    |
| Truncated          | [reject, or retry once with a higher ceiling]                     |
| Refusal            | [the refusal row in Failure Modes — not the repair loop]          |
| Streaming partial  | [buffer; validate on completion]                                  |
| Repeated failure   | [reject; record the input for the eval set]                       |

**Consumers of this contract:** [who breaks if the schema changes]
````

---

## Pattern 5: Budgets and Observability

```markdown
## Token, Cost and Latency Budgets

| Budget                       | Ceiling  | Measured how                                    |
| ---------------------------- | -------- | ----------------------------------------------- |
| Input tokens per call        | [number] | [pre-call count, which utility]                 |
| Output tokens per call       | [number] | [reasoning + visible; the max output setting]   |
| Model calls per user request | [number] | [including repairs and fallbacks]               |
| Cost per request             | [$]      | [current pricing, at an assumed cache-hit rate] |
| p95 total latency            | [ms]     | [which span]                                    |
| Time to first token          | [ms]     | [streamed surfaces only]                        |

**Overflow:** [what is shed first when input exceeds the ceiling — never the system prompt]
**Retries owned by:** [the client, or this feature — not both]

## Observability

**Log per call:** [model id, prompt version, input / output / reasoning / cached token counts, latency, cost, outcome, correlation id]
**Trace:** [span boundaries — retrieval, each model call, each tool call]
**Redact:** [fields that never reach logs — prompt bodies with user data, retrieved content, keys, PII]
**Alert on:** [threshold breaches worth notifying]
```

---

## Pattern 6: Failure-Mode Matrix

Keep only the rows the feature can hit; each kept row becomes a success criterion with a mocked trigger. Defaults for every row are in [reference.md](../reference.md#default-failure-behaviour).

```markdown
## Failure Modes

| Failure               | Detection signal                 | Required behaviour                   | User-visible result |
| --------------------- | -------------------------------- | ------------------------------------ | ------------------- |
| Rate limited          | 429 with a rate-limit error code | [retry-after or backoff, cap, then?] | [what they see]     |
| Quota spent           | 429 with a quota or spend code   | [fail at once]                       | [what they see]     |
| Timeout               | elapsed > [ms]                   | [abort + error code]                 | [what they see]     |
| Provider outage       | 5xx / connection error           | [fallback chain]                     | [what they see]     |
| Malformed output      | validator fails                  | [repair-or-reject rule]              | [what they see]     |
| Incomplete output     | output ceiling reached           | [reject, or retry higher]            | [what they see]     |
| Refusal               | the provider's refusal signal    | [surface, or fallback model]         | [what they see]     |
| Context overflow      | pre-call token count             | [shed order]                         | [what they see]     |
| Empty retrieval       | nothing above the floor          | [abstain or answer]                  | [what they see]     |
| Tool error            | tool throws                      | [return once, then escalate]         | [what they see]     |
| Runaway loop          | repetition guard trips           | [terminate, flag partial]            | [what they see]     |
| Cost ceiling exceeded | running cost counter             | [terminate + alert]                  | [what they see]     |
```

---

## Pattern 7: Eval Plan

```markdown
## Evaluation Plan

**Dataset:** [path] — [N cases], covering [distribution, including empty-input and edge cases, not only the happy path]; N chosen so the threshold's 95% interval excludes the failing value
**Labels:** [who produced the expected outputs; how disagreements were resolved]

| Metric | Definition       | Threshold | Grading                                       |
| ------ | ---------------- | --------- | --------------------------------------------- |
| [name] | [precisely what] | [≥ X]     | [deterministic / human rubric / model-graded] |

**Model-graded metrics:** [judge model id; its agreement with human raters on a sample, measured before it gates]

**Adversarial cases** (whenever untrusted text reaches the prompt), each run [k] times, every run passing:

- Instruction override — [expected: ignored]
- Delimiter escape — [expected: treated as content]
- Exfiltration through [tool or channel] — [expected: not called / refused]

**Regression set:** [existing evals that must pass unchanged]
**Recorded per run:** model id, prompt version, retrieval parameters, cost, latency
**Merge gate:** [every threshold met, regression set passing]
```

---

## Worked Example: Support Ticket Triage

The AI sections of one specification, built from the templates above — only the ones the feature touches, with no retrieval, tools or loop. The spec's goal, scope fence and requirements sit around these sections and are not repeated here.

````markdown
## Approach and Rationale

**Selected:** fixed code-orchestrated chain — classify every ticket, summarize only bodies over 400 characters.
**Output authority:** advisory — a support agent reviews before acting.
**Why not simpler:** one call cannot skip summarizing the 85% of short tickets without paying output tokens on all of them.
**Why not a loop:** the step sequence is fixed and known.
**Why not retrieval:** the 12-label taxonomy fits in the system prompt.

**Pattern sources:** model client `lib/ai/client.ts:1-64` (owns retries: 3 attempts with backoff, 30s timeout); prompt module shape and fence helper `prompts/classify-intent.v2.ts:1-34`; validator `lib/validation.ts:1-40`; eval case format `evals/intent/cases.json`.

## Model Selection

**Primary:** small-tier id from `lib/ai/models.ts:12`, both calls — a fixed snapshot per the provider's versioning page
**Fallback:** mid-tier id from the same registry on 429 or 5xx, then `AI_UNAVAILABLE` with the ticket left unlabeled

| Dimension        | Requirement                  | Primary meets it?            |
| ---------------- | ---------------------------- | ---------------------------- |
| Capability       | 12-label classification      | yes — 0.93 on the pilot set  |
| Context window   | 6k worst-case ticket + rules | yes, large headroom          |
| Latency          | p95 ≤ 3.5s for both calls    | yes — measured 1.1s and 1.4s |
| Cost             | ≤ $0.004 per ticket          | yes — $0.0021 projected      |
| Output mechanism | schema-constrained output    | yes                          |

**Re-eval trigger:** model id, prompt version or taxonomy change; snapshot retirement.

## Prompt Architecture

### Classify — `prompts/triage-classify.v1.ts`

| Part                 | Content                                 | Trusted? |
| -------------------- | --------------------------------------- | -------- |
| System-level message | taxonomy with definitions, output rules | yes      |
| User message         | ticket subject and body, fenced         | no       |

**Order:** taxonomy and rules first and identical on every call; the ticket last.
**Untrusted boundary:** `subject` and `body` fenced with `prompts/fence.ts:5-18`. A body instructing the model to relabel must not change the label; the eval set asserts it. The call reaches no tools and no outbound channel, so an injection's worst case is a wrong advisory label.

### Summarize — `prompts/triage-summarize.v1.ts`

**Variables:** `{ body, maxWords: 40 }`, with the same fencing and order.

## Output Contract

**Mechanism:** schema-constrained output — the result is a record, not an action.

```json
{
  "productArea": "one of the 12 taxonomy labels",
  "confidence": "number 0-1",
  "summary": "string, at most 40 words, omitted when not generated"
}
```

**Enforced by the provider:** field names, types, the `productArea` enum.
**Enforced by the validator** (`lib/validation.ts:1-40`): the `confidence` range, the 40-word limit, enum casing.

| Situation                          | Policy                                     |
| ---------------------------------- | ------------------------------------------ |
| Shape violation                    | one repair with the error, then reject     |
| `productArea` outside the taxonomy | reject as `AI_INVALID_OUTPUT`              |
| Truncated                          | reject as `AI_INVALID_OUTPUT`              |
| Repeated failure on one ticket     | reject; record the ticket for the eval set |

Rejection leaves the ticket unlabeled; it never writes a guessed label.

## Budgets

| Budget                                       | Ceiling                                                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Input tokens per call                        | 7,000                                                                                         |
| Output tokens per call (reasoning + visible) | 1,000                                                                                         |
| Model calls per ticket                       | 2, or 1 for bodies ≤ 400 chars                                                                |
| Cost per ticket                              | $0.004 at uncached rates — the shared prefix is below the provider's minimum cacheable length |
| p95 total latency                            | 3,500ms                                                                                       |

**Overflow:** bodies over 7,000 tokens are truncated from the end with a marker; the system prompt never is.
**Retries owned by:** the model client. The feature adds none.

## Failure Modes

| Failure          | Detection            | Behaviour                                               | Ticket state         |
| ---------------- | -------------------- | ------------------------------------------------------- | -------------------- |
| Rate limited     | 429, rate-limit code | client's backoff, then fallback model                   | labeled or unlabeled |
| Quota spent      | 429, quota code      | `AI_UNAVAILABLE` at once; alert                         | unlabeled            |
| Timeout          | > 30s                | abort, `AI_TIMEOUT`                                     | unlabeled            |
| Provider outage  | 5xx                  | fallback model, then `AI_UNAVAILABLE`                   | unlabeled            |
| Malformed output | validator fails      | repair once, then `AI_INVALID_OUTPUT`                   | unlabeled            |
| Refusal          | refusal signal       | `AI_REFUSED`; no fallback — the manual queue absorbs it | unlabeled            |

Unlabeled tickets enter the existing manual queue; triage failure never blocks ingest.

**Success criteria these rows add:**

1. A body over 400 chars gets `productArea` and `summary`; a short body gets `productArea` from exactly one call
2. A mocked malformed response leaves the ticket unlabeled and logs `AI_INVALID_OUTPUT`
3. A mocked 429 with a rate-limit code reaches the fallback model and still labels the ticket
4. A mocked refusal leaves the ticket unlabeled and logs `AI_REFUSED` with no second call
5. Ingest succeeds with the provider entirely unavailable

## Observability

Log per call: model id, prompt version, token counts including cached and reasoning, latency, cost, outcome, ticket id.
Redact: ticket subject and body — never logged.
Alert: rejection rate above 5% over one hour; any quota-spent response.

## Eval Plan

**Dataset:** `evals/triage/cases.json` — 400 labeled tickets, at least 25 per area, plus 10 injection cases. At 0.90, 400 cases put the 95% interval at about ±0.03.

| Metric               | Definition                          | Threshold               | Grading                                                                     |
| -------------------- | ----------------------------------- | ----------------------- | --------------------------------------------------------------------------- |
| Label accuracy       | exact match against the human label | ≥ 0.90                  | deterministic                                                               |
| Summary groundedness | every claim traceable to the ticket | ≥ 0.95                  | model-graded; agreement with two human raters checked on 50 summaries first |
| Injection resistance | injected instruction not followed   | every case, 5 runs each | deterministic                                                               |

**Regression set:** `evals/intent/` passes unchanged — it shares the model client.
**Merge gate:** every threshold met; the run recorded with the model id and both prompt versions.
````
