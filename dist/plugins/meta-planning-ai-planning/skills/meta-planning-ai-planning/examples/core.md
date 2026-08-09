# AI Planning - Per-Artifact Spec Sections

> Section templates for AI specifications, one per artifact class. Include a section only when the spec touches that artifact class — a feature with no retrieval carries no retrieval section, no tools no tool contracts, no loop no loop design. See [../SKILL.md](../SKILL.md) for the frameworks behind each.

---

## Approach and Rationale section

Use for every AI feature — the proportionality record.

```markdown
<approach_decision>

## Approach and Rationale

**Selected approach:** [Single call | Fixed code-orchestrated chain | Retrieval-augmented call | Agentic loop | Retrieval + agentic loop]

**Why not simpler:** [Name the requirement that rules out the tier below. If nothing does, use the simpler tier.]

**Rejected alternatives:**

| Alternative | Why rejected                                   |
| ----------- | ---------------------------------------------- |
| [Approach]  | [Concrete reason tied to a stated requirement] |

</approach_decision>
```

---

## Model Selection section

Use for every feature that calls a model.

```markdown
<model_selection>

## Model and Provider Selection

**Primary:** [pinned model id] via [provider] — configured at [/path/to/config:lines]
**Fallback chain:** [model id / provider] on [trigger — 429, 5xx, timeout], then [documented failure response]

| Dimension      | Requirement          | Primary meets it?                |
| -------------- | -------------------- | -------------------------------- |
| Capability     | [what it must do]    | [evidence — eval result or note] |
| Context window | [worst-case tokens]  | [fit + headroom]                 |
| Latency        | [p95 target]         | [expected profile]               |
| Cost           | [per-call ceiling]   | [projected]                      |
| Structured out | [mechanism required] | [supported / not]                |

**Version pinning:** [Where the id lives. Never a floating alias, never inline in code.]
**Re-eval trigger:** [What forces a full eval re-run — model id change, prompt version bump, retrieval parameter change]

</model_selection>
```

---

## Prompt Architecture section

Use for every prompt the spec introduces or changes.

```markdown
<prompt_architecture>

## Prompt Architecture

### [Prompt name] — `[path/to/prompt.v1.ts]`

**Pattern source:** [/path/to/existing-prompt.ts:lines]
**Version:** v1 (new) | v2 (supersedes v1 — v1 stays until eval parity is shown)

**Role split:**

| Role      | Content                                          | Trusted? |
| --------- | ------------------------------------------------ | -------- |
| system    | [Instructions, constraints, output requirements] | Yes      |
| user      | [Task input, delimited]                          | No       |
| assistant | [Few-shot examples, if any]                      | Yes      |

**Variables:**

| Variable | Type   | Source                | Untrusted? |
| -------- | ------ | --------------------- | ---------- |
| [name]   | [type] | [where it comes from] | [yes/no]   |

**Untrusted-input boundary:** [How untrusted text is delimited and why instructions cannot escape it]
**Few-shot strategy:** [None | Fixed set of N | Retrieved examples — and the selection rule]

</prompt_architecture>
```

---

## Retrieval Design section

Use only when the feature retrieves. Omit entirely otherwise.

```markdown
<retrieval_design>

## Retrieval Design

| Parameter       | Value                      | Rationale / pattern source                    |
| --------------- | -------------------------- | --------------------------------------------- |
| Corpus          | [what is indexed]          | [owner, size, change rate]                    |
| Chunk size      | [tokens]                   | [why]                                         |
| Overlap         | [tokens or %]              | [why]                                         |
| Split boundary  | [fixed / structural]       | [why]                                         |
| Embedding model | [pinned id]                | [/path:lines]                                 |
| Store           | [vector store + index]     | [/path:lines]                                 |
| Retrieval mode  | [semantic/keyword/hybrid]  | [why]                                         |
| Top-k           | [retrieve k, re-rank to n] | [why]                                         |
| Pre-filters     | [tenant, locale, ACL]      | [applied before search — never post-filtered] |
| Context budget  | [max tokens assembled]     | [how chunks are shed to fit]                  |
| Citations       | [required / not]           | [metadata each chunk carries]                 |

**Empty retrieval behavior:** [Answer from parametric knowledge | Abstain with documented response] — this is a product decision, stated here.
**Low-similarity behavior:** [Threshold and what happens below it]
**Reindex trigger and staleness:** [Who triggers it, how staleness is observable]

</retrieval_design>
```

---

## Tool Contracts section

Use only when the model calls tools.

````markdown
<tool_contracts>

## Tool Contracts

### `[tool_name]`

**Purpose:** [One sentence — what the model uses it for]
**Side effects:** [Read-only | Mutating]
**Idempotent:** [Yes | No — and the key strategy if not]
**Confirmation required:** [Yes — by whom | No]

**Parameters:**

| Name   | Type   | Required | Constraints  | Description  |
| ------ | ------ | -------- | ------------ | ------------ |
| [name] | [type] | [yes/no] | [enum/range] | [what it is] |

**Result shape returned to the model:**

```
{ /* shape with field types — this is prompt surface, keep it small and unambiguous */ }
```

**Error behavior:** [What the model receives on tool failure, and whether it may retry]

</tool_contracts>
````

---

## Agentic Loop section

Use only when the model drives a multi-step loop.

```markdown
<agent_loop>

## Agentic Loop Design

| Guard                 | Value                                                 |
| --------------------- | ----------------------------------------------------- |
| Step budget           | [max model turns]                                     |
| Token budget          | [cumulative input+output ceiling]                     |
| Wall-clock budget     | [total elapsed limit]                                 |
| Repetition guard      | [behavior on N identical consecutive tool calls]      |
| Termination           | [every condition, including the success condition]    |
| Partial-result policy | [what is returned when a budget trips before success] |

**State carried between steps:** [Exactly what persists — nothing else does]
**Human-in-the-loop checkpoints:** [Where a person must approve, or None]
**Recovery on tool failure:** [Return error to model once, then escalate — or as specified]

</agent_loop>
```

---

## Output Contract section

Use for every feature that consumes model output.

````markdown
<output_contract>

## Output Contract

**Mechanism:** [Tool calling | JSON/structured mode | Delimited free text]
**Why:** [Tied to provider support and output shape]

**Schema:**

```
{ /* field names, types, constraints */ }
```

**Validation:** [Which validator, at which boundary, from /path:lines]

| Situation          | Policy                                                        |
| ------------------ | ------------------------------------------------------------- |
| Shape violation    | [Repair once with validator error, then reject as ERROR_CODE] |
| Semantic violation | [Reject immediately as ERROR_CODE]                            |
| Streaming partial  | [Buffer; validate only on completion]                         |
| Repeated failure   | [Reject; record input for the eval set]                       |

**Downstream consumers of this contract:** [Who breaks if the schema changes]

</output_contract>
````

---

## Budgets section

Use for every feature that calls a model.

```markdown
<budgets>

## Token, Cost, and Latency Budgets

| Budget                       | Ceiling  | Measured how                       |
| ---------------------------- | -------- | ---------------------------------- |
| Input tokens per call        | [number] | [pre-call count, which utility]    |
| Output tokens per call       | [number] | [max output setting]               |
| Model calls per user request | [number] | [and when the extra calls trigger] |
| Cost per request (blended)   | [$]      | [at current pricing]               |
| p95 total latency            | [ms]     | [which span]                       |
| Time to first token          | [ms]     | [streamed surfaces only]           |

**Overflow behavior:** [What is shed first when the input budget is exceeded — never the system prompt]

</budgets>
```

---

## Failure Modes section

Use for every feature that calls a model; keep only the applicable rows.

```markdown
<failure_modes>

## Failure Modes

| Failure               | Detection signal         | Required behavior          | User-visible result |
| --------------------- | ------------------------ | -------------------------- | ------------------- |
| Rate limited          | 429 / provider header    | [backoff, attempts, then?] | [what they see]     |
| Timeout               | elapsed > [ms]           | [abort + error code]       | [what they see]     |
| Provider outage       | 5xx / connection error   | [fallback chain]           | [what they see]     |
| Malformed output      | schema validation fails  | [repair-vs-reject policy]  | [what they see]     |
| Context overflow      | pre-call token count     | [shed order]               | [what they see]     |
| Empty retrieval       | zero results above floor | [abstain or answer]        | [what they see]     |
| Model refusal         | refusal in response      | [surface unchanged]        | [what they see]     |
| Tool error            | tool throws              | [return once, escalate]    | [what they see]     |
| Runaway loop          | repetition guard trips   | [terminate, flag partial]  | [what they see]     |
| Cost ceiling exceeded | running cost counter     | [terminate + alert]        | [what they see]     |

</failure_modes>
```

---

## Observability section

Use for every feature that calls a model.

```markdown
<observability>

## Observability

**Log per call:** [model id, prompt version, input/output token counts, latency, cost, outcome, correlation id]
**Trace:** [span boundaries — retrieval, each model call, each tool call]
**Redact:** [Which fields never reach logs — prompt bodies with user data, retrieved content, API keys, PII]
**Alert on:** [Threshold breaches worth paging or notifying]

</observability>
```

---

## Eval Plan section

Use for every feature that calls a model.

```markdown
<eval_plan>

## Evaluation Plan

**Dataset:** [path] — [N cases], covering [distribution]
**Labels:** [Who produced expected outputs; how disagreements were resolved]

| Metric | Definition       | Threshold | Grading method                          |
| ------ | ---------------- | --------- | --------------------------------------- |
| [name] | [precisely what] | [>= X]    | [deterministic / rubric / model-graded] |

**Adversarial cases (required whenever untrusted text reaches the prompt):**

- Instruction override attempt — [expected: instruction ignored]
- Delimiter escape attempt — [expected: treated as content]
- Exfiltration attempt against [tool] — [expected: tool not called / call refused]

**Regression set:** [Which existing evals must still pass unchanged]
**Recorded per run:** model id, prompt version, retrieval parameters, cost, latency
**Merge gate:** [All thresholds met + regression set passing]

</eval_plan>
```

---

## Worked example — support ticket triage

A complete specification using the sections above (only the ones the feature touches — no retrieval, no tools beyond the submit tool, no loop).

````markdown
# Support Ticket Triage

## Goal

Classify and summarize inbound support tickets on ingest so agents see a product area and a two-sentence summary before opening a ticket.

**Mode:** New capability
**Output authority:** Advisory — a support agent reviews before acting

## Context

**Problem:** Tickets arrive unlabeled. Triage is manual and adds ~4 minutes per ticket.
**Priority:** High

**Current State:**

- Model client: `lib/ai/client.ts:1-64` — provider wrapper with 3-attempt backoff and a 30s timeout
- Prompts: `prompts/classify-intent.v2.ts:1-34` — module shape, variable interpolation, fence helper
- Validation: `lib/validation.ts:1-40` — schema module used at every parse boundary
- Evals: `evals/intent/cases.json` — case format to match
- No retrieval infrastructure exists. None is added here.

**Desired State:** Every ingested ticket carries `productArea` and, when long enough to warrant it, `summary`.

## Approach and Rationale

**Selected:** Fixed code-orchestrated chain — classify always, summarize only when the ticket body exceeds 400 characters.

**Why not simpler:** A single call cannot skip summarization for the 85% of short tickets without wasting output tokens on all of them.
**Why not an agentic loop:** The step sequence is fixed and known. A loop would add non-determinism and cost with no capability gain.
**Why not retrieval:** Classification needs the taxonomy only, and the taxonomy fits in the system prompt.

## Model Selection

**Primary:** small-tier id from `lib/ai/models.ts:12` — both calls
**Fallback:** mid-tier id from the same registry on 429 or 5xx, then `AI_UNAVAILABLE` with the ticket left unlabeled

| Dimension      | Requirement                  | Primary meets it?            |
| -------------- | ---------------------------- | ---------------------------- |
| Capability     | 12-label classification      | Yes — 0.93 on the pilot set  |
| Context window | 6k worst-case ticket + rules | Yes, large headroom          |
| Latency        | p95 <= 3.5s for both calls   | Yes — measured 1.1s and 1.4s |
| Cost           | <= $0.004 blended per ticket | Yes — $0.0021 projected      |
| Structured out | Tool calling                 | Yes                          |

**Re-eval trigger:** any change to model id, prompt version, or the label taxonomy.

## Prompt Architecture

### Classify — `prompts/triage-classify.v1.ts`

**Pattern source:** `prompts/classify-intent.v2.ts:1-34`

| Role   | Content                                          | Trusted? |
| ------ | ------------------------------------------------ | -------- |
| system | 12-label taxonomy with definitions, output rules | Yes      |
| user   | Ticket subject + body, fenced                    | No       |

**Variables:** `{ subject, body }` — both untrusted, both fenced via `prompts/fence.ts:5-18`.
**Untrusted boundary:** all instructions live in the system message. A ticket body instructing the model to relabel must not change the label; the eval set asserts this.

### Summarize — `prompts/triage-summarize.v1.ts`

**Variables:** `{ body, maxWords: 40 }`. Same fencing.

## Output Contract

**Mechanism:** tool calling — `submit_triage`
**Schema:**

```json
{
  "productArea": "one of the 12 taxonomy labels",
  "confidence": "number 0-1",
  "summary": "string, <= 40 words, omitted when not generated"
}
```

**Validation:** schema module at `lib/validation.ts:1-40`, applied on receipt.

| Situation                           | Policy                                         |
| ----------------------------------- | ---------------------------------------------- |
| Shape violation                     | One repair attempt with the error, then reject |
| `productArea` outside the taxonomy  | Reject immediately as `AI_INVALID_OUTPUT`      |
| Repeated failure on the same ticket | Reject; record the ticket for the eval set     |

Rejection leaves the ticket unlabeled. It never writes a guessed label.

## Budgets

| Budget                  | Ceiling                          |
| ----------------------- | -------------------------------- |
| Input tokens per call   | 7,000                            |
| Output tokens per call  | 200                              |
| Model calls per ticket  | 2 max, 1 for bodies <= 400 chars |
| Blended cost per ticket | $0.004                           |
| p95 total latency       | 3,500ms                          |

**Overflow:** ticket bodies over 7,000 tokens are truncated from the end with a marker. The system prompt is never truncated.

## Failure Modes

| Failure          | Detection    | Behavior                              | Ticket state         |
| ---------------- | ------------ | ------------------------------------- | -------------------- |
| Rate limited     | 429          | Backoff x3, then fallback model       | Labeled or unlabeled |
| Timeout          | > 30s        | Abort, `AI_TIMEOUT`                   | Unlabeled            |
| Provider outage  | 5xx          | Fallback model, then `AI_UNAVAILABLE` | Unlabeled            |
| Malformed output | Schema fails | Repair once, then `AI_INVALID_OUTPUT` | Unlabeled            |
| Refusal          | Refusal text | Record and skip; no retry             | Unlabeled            |

Unlabeled tickets enter the existing manual queue unchanged. Triage failure never blocks ingest.

## Observability

Log per call: model id, prompt version, token counts, latency, cost, outcome, ticket id.
Redact: ticket subject and body. Never logged.
Alert: rejection rate above 5% over a 1-hour window.

## Eval Plan

**Dataset:** `evals/triage/cases.json` — 40 labeled tickets across all 12 areas, plus 5 injection cases.

| Metric               | Definition                          | Threshold | Grading       |
| -------------------- | ----------------------------------- | --------- | ------------- |
| Label accuracy       | Exact match against the human label | >= 0.90   | Deterministic |
| Summary groundedness | Every claim traceable to the ticket | >= 0.95   | Rubric        |
| Injection resistance | Injected instruction not followed   | 1.00      | Deterministic |

**Regression set:** `evals/intent/` must pass unchanged — it shares the model client.
**Merge gate:** all thresholds met, run recorded with model id and prompt versions.

## Requirements

**Must Have:**

1. Every ingested ticket is classified or explicitly left unlabeled
2. Summarization runs only for bodies over 400 characters
3. Invalid output leaves the ticket unlabeled — never a guessed label
4. Triage failure never blocks ingest

**Must NOT Have:**

- Reply drafting — separate spec
- Retrieval over past tickets — separate spec
- Any user-facing chat surface
- Auto-routing based on the label — advisory only in this release

## Success Criteria

**Functional:**

1. A ticket with a body over 400 chars receives both `productArea` and `summary`
2. A ticket with a short body receives `productArea` only, with exactly one model call
3. A mocked malformed response leaves the ticket unlabeled and logs `AI_INVALID_OUTPUT`
4. A mocked 429 exercises the fallback model and still labels the ticket
5. Ingest succeeds when the provider is entirely unavailable

**Quality:**

1. Label accuracy >= 0.90 on `evals/triage/cases.json`
2. All 5 injection cases resist the injected instruction
3. `evals/intent/` regression set passes unchanged

**Technical:**

1. Tests pass; `tsc --noEmit` clean
2. Both prompts live in `prompts/` with `.v1` suffixes; none inline
3. No changes outside `lib/ai/`, `prompts/`, `evals/triage/`, and the ingest handler
````
