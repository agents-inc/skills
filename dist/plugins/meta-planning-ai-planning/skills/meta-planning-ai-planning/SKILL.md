---
name: meta-planning-ai-planning
description: AI specification planning frameworks. Use when a spec touches model calls, prompts, retrieval, tool calling, agentic loops, or evals. Covers approach selection, model and provider choice, structured output contracts, loop guards, budgets, failure modes, and eval design.
---

# AI Planning Frameworks

> **Quick Guide:** Default to the simplest tier that satisfies the requirement — most features are one well-built model call. Pin the model id, define the output contract with a repair-vs-reject policy, budget in tokens and money rather than adjectives, enumerate the failure modes, and make quality measurable with an eval plan before implementation starts. Apply a framework only when the spec touches its artifact class — a feature with no retrieval needs no retrieval section.

---

<critical_requirements>

## CRITICAL: Before Specifying AI Features

> **All specifications must be grounded in the codebase's real model clients, prompt modules, schemas, and eval fixtures** — reference specific files with line numbers

**(You MUST justify the approach against the simpler tier — a fixed code-orchestrated chain beats an agentic loop whenever the step sequence is known)**

**(You MUST pin an explicit model id in configuration with a named fallback — never a floating alias, never inline in code)**

**(You MUST define the output contract completely: mechanism, schema, validation boundary, and a repair-vs-reject policy)**

**(You MUST state budgets as numbers — tokens per call, calls per request, cost per request, p95 latency — never as adjectives)**

**(You MUST identify where untrusted input enters every prompt, and require adversarial eval cases wherever it does)**

**(You MUST apply each framework only when the spec touches its artifact class — an unused section is omitted, never filled)**

</critical_requirements>

---

**Auto-detection:** AI spec, LLM feature spec, prompt design spec, model selection, RAG spec, retrieval design, tool calling spec, agent loop spec, eval plan, token budget, structured output

**When to use:**

- Specifying a feature that calls a model (classification, extraction, generation, summarization)
- Choosing between a single call, a fixed chain, retrieval, and an agentic loop
- Specifying prompt architecture, versioning, and untrusted-input boundaries
- Specifying structured output contracts and validation policy
- Specifying retrieval parameters, tool contracts, or loop guards
- Specifying eval datasets, metrics, thresholds, and budgets

**When NOT to use:**

- When implementing AI code (use the relevant AI implementation skill)
- For the API surface that exposes the capability (use the api planning skill)
- For the planning PROCESS itself — research, scope fencing, success criteria — which the PM agent carries

**Key patterns covered:**

- Approach selection (single call → chain → retrieval → agentic loop)
- Model and provider selection with pinned ids and fallback chains
- Prompt architecture: role split, versioning, untrusted-input boundaries
- Structured output strategy and repair-vs-reject policy
- Retrieval design parameters
- Agentic loop guards and tool side-effect classification
- Eval design and adversarial cases
- Failure-mode matrix
- Token, cost, and latency budgets

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Per-artifact spec section templates and a worked example specification

---

<philosophy>

## Philosophy

**Non-determinism is the material; contracts are what make it buildable.** A model's output cannot be trusted by construction, so every boundary — schema, budget, failure behavior, eval threshold — must be decided in the spec, or it gets decided implicitly in production.

**When specifying AI work:**

- Trace one existing model call end to end before specifying a new one — client, prompt module, validation, consumer
- Name the requirement that forces each tier of complexity; if nothing does, use the simpler tier
- Establish the baseline before proposing a change: current cost, latency, and quality numbers, or an explicit "unmeasured"
- Decide product questions in the spec — may the model answer from parametric knowledge when retrieval is empty? — rather than leaving them to the implementer

**When NOT to specify:**

- Don't specify an agentic loop for a step sequence known in advance
- Don't add retrieval infrastructure when the knowledge fits in the context window
- Don't fill a tool-contract or retrieval section for a feature that has neither
- Don't include implementation code — contracts, budgets, and behaviors only

**Core principles:**

- **Simplest sufficient tier**: most features are a single well-constructed call
- **Validate on receipt, every branch**: provider-side enforcement reduces violations; it does not eliminate them
- **Budgets are numbers**: "fast and cheap" is not implementable or reviewable
- **Refusals are surfaced, never retried**: retrying with softened wording is a bypass attempt
- **Eval thresholds gate the merge**: thresholds set after seeing results ratify instead of gating

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Choosing the Approach

```
Does the task need knowledge that is not in the model and not in the request?
├─ NO  → Single model call with a well-built prompt. Stop here. Most features end here.
└─ YES → Where does that knowledge live?
    ├─ A bounded set that fits the context window (< ~30% of it) → Pass it directly. No retrieval infrastructure.
    ├─ A large or growing corpus → Retrieval (RAG)
    └─ A live system of record (database, third-party API) → Tool calling, not retrieval

Does the task need multiple dependent actions the model must sequence itself?
├─ NO  → Single call, or a fixed chain of calls you orchestrate in code
│         (a fixed chain is cheaper, more debuggable, and easier to eval than a loop)
└─ YES → Agentic loop with an explicit step budget and termination conditions
```

**Default to the simplest tier that satisfies the requirement.** Specify the more complex tier only when you can name the requirement that forces it, and record the rejected alternatives with the reason each was rejected.

---

### Pattern 2: Model and Provider Selection

Score the candidates against the actual requirement and record the table in the spec.

| Dimension      | Question to answer                                                        |
| -------------- | ------------------------------------------------------------------------- |
| Capability     | Does the smallest candidate pass the eval set? Test before assuming not.  |
| Context window | Does the worst-case assembled prompt fit with headroom for output?        |
| Latency        | Does the p95 profile fit the surface (streamed UI vs background job)?     |
| Cost           | What is the blended cost per request at projected volume?                 |
| Structured out | Does the provider support the output mechanism you selected?              |
| Availability   | What is the fallback when this provider returns 429 or 5xx?               |
| Versioning     | Is the model id pinned? What is the deprecation and re-eval plan?         |
| Data handling  | Does request content leave an acceptable boundary? Any retention concern? |

**Rules:**

- Always pin an explicit model id in configuration, never a floating alias, and never inline in code.
- Always name a fallback, even if the fallback is "fail closed with error X" — an unnamed fallback becomes an unhandled exception.
- Re-run the eval set when changing model id, prompt version, or retrieval parameters. Any of the three can move quality.

---

### Pattern 3: Prompt Architecture

Every prompt the spec introduces is named, located, versioned, and trust-annotated.

- **Location and version.** A prompt is a module with a version suffix in its filename (`prompts/summarize-ticket.v1.ts`), following the shape of an existing prompt module. The version is logged with every call so eval results attribute to a specific revision. Editing a shipped prompt in place is out of scope; ship the next version instead.
- **Role split.** Instructions live exclusively in the system message. Task input is interpolated only into the user-role message. Few-shot examples, when used, are assistant-role and trusted.
- **Untrusted-input boundary.** Name every variable, its source, and whether it is untrusted. Untrusted text is delimited with the codebase's existing fence helper, and a fenced instruction ("ignore your previous instructions") must not change behavior — the eval set includes this case. Retrieved document text is untrusted too.
- **Variables.** List each variable with its type and source. A variable the template reads but the spec never mentions is a contract gap.

---

### Pattern 4: Structured Output Strategy

```
Does the provider support tool calling / function calling?
├─ YES → Is the output a single well-defined record?
│   ├─ YES → Tool calling with a single submit-style tool. Strongest schema adherence.
│   └─ NO  → Tool calling with one tool per action, plus a terminal final-answer tool
└─ NO  → Does it support a JSON/structured output mode?
    ├─ YES → JSON mode + schema validation on receipt
    └─ NO  → Delimited free text + strict parser. Requires the widest eval coverage.
```

**Every branch validates on receipt.** Provider-side schema enforcement reduces violations; it does not eliminate them, and it never covers semantic correctness (a valid-shaped record with a hallucinated value passes schema validation).

**Repair-vs-reject policy — state it explicitly:**

| Situation                              | Policy                                                              |
| -------------------------------------- | ------------------------------------------------------------------- |
| Shape violation (missing/typo'd field) | One repair attempt with the validator error appended, then reject   |
| Semantic violation (impossible value)  | Reject immediately; repair attempts tend to launder the bad value   |
| Streaming partial JSON                 | Buffer and validate only on completion; never act on partial output |
| Repeated failure on the same input     | Reject and record the input for eval-set inclusion                  |

---

### Pattern 5: Retrieval Design

| Decision           | Options                                    | How to choose                                                                      |
| ------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Chunk size         | Small (200-400) vs large (800-1500) tokens | Small for fact lookup; large when answers need surrounding narrative               |
| Overlap            | 0 vs 10-20% of chunk size                  | Overlap when facts straddle boundaries; costs index size                           |
| Split boundary     | Fixed tokens vs structural (heading, code) | Structural whenever the corpus has reliable structure — it preserves meaning       |
| Retrieval mode     | Semantic, keyword, hybrid                  | Hybrid when queries contain exact identifiers (error codes, SKUs, symbol names)    |
| Top-k              | Retrieve k, re-rank to n                   | Retrieve wide (15-30), re-rank narrow (3-8). Wide-only retrieval dilutes context.  |
| Re-ranking         | None vs cross-encoder/model re-rank        | Add when precision@5 is the bottleneck; it costs latency                           |
| Metadata filtering | Pre-filter vs post-filter                  | Pre-filter on tenant, locale, or permission — never post-filter access control     |
| Freshness          | Batch reindex vs incremental               | Match the corpus change rate; state who triggers reindex and how staleness is seen |

**Always specify:** what happens on empty retrieval, what happens on low-similarity retrieval, whether answers must cite sources, and whether the model may answer from parametric knowledge when retrieval returns nothing. That last one is a product decision, not an implementation detail — decide it in the spec.

---

### Pattern 6: Agentic Loop Guards

Every loop specification names all six:

| Guard                 | Specification requirement                                                |
| --------------------- | ------------------------------------------------------------------------ |
| Step budget           | Hard maximum number of model turns                                       |
| Token budget          | Cumulative input+output ceiling across the whole loop                    |
| Wall-clock budget     | Total elapsed limit, independent of step count                           |
| Termination           | Every condition that ends the loop, including the success condition      |
| Repetition guard      | Behavior when the model repeats an identical tool call                   |
| Partial-result policy | What is returned when a budget is exhausted before the success condition |

**Tool side effects must be classified.** Every tool is read-only or mutating. Mutating tools need: idempotency strategy, whether they require confirmation, and whether they are permitted on a retry after an ambiguous failure.

**State carried between steps** is named exactly — nothing else persists. On step-budget exhaustion, return the partial answer flagged as truncated; never silently return an unfinished result as complete.

---

### Pattern 7: Eval Design

| Component    | Requirement                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Dataset      | Concrete location and case count. Include adversarial and empty-input cases, not just happy path |
| Labels       | Who produced the expected outputs, and how disagreements were resolved                           |
| Metrics      | Named and computable. "Accuracy" alone is not a metric — say accuracy of what, measured how      |
| Thresholds   | A number per metric that gates the merge                                                         |
| Grading      | Deterministic assertion, rubric grading, or model-graded — state which, and its known weakness   |
| Regression   | Which existing evals must continue to pass unchanged                                             |
| Cost/latency | Measured per run, recorded alongside quality metrics                                             |
| Provenance   | Every eval run records model id, prompt version, and retrieval parameters                        |

**Include adversarial cases whenever untrusted text reaches the prompt.** At minimum: instruction override, delimiter escape, and exfiltration attempts against any tool the loop can call.

---

### Pattern 8: Failure-Mode Matrix

Enumerate every applicable row for the feature. Absent rows become production incidents.

| Failure               | Detection signal         | Required behavior                                              |
| --------------------- | ------------------------ | -------------------------------------------------------------- |
| Rate limited          | 429 / provider header    | Backoff with jitter, capped attempts, then fallback provider   |
| Timeout               | Elapsed > budget         | Abort the call, return the documented timeout error            |
| Provider outage       | 5xx / connection error   | Fallback chain, then documented degraded response              |
| Malformed output      | Schema validation fails  | Repair-vs-reject policy from Pattern 4                         |
| Context overflow      | Pre-call token count     | Shed lowest-priority context; never truncate the system prompt |
| Empty retrieval       | Zero results above floor | Documented no-context behavior; decide answer-vs-abstain       |
| Model refusal         | Refusal in response      | Surface unchanged; never retry with softened wording           |
| Tool error            | Tool throws or errors    | Return the error to the model once; escalate on repeat         |
| Runaway loop          | Repetition guard trips   | Terminate with partial result flagged as truncated             |
| Cost ceiling exceeded | Running cost counter     | Terminate and return partial; alert per observability section  |

---

### Pattern 9: Budgets and Observability

**Budget in tokens and money, not adjectives.** Per call: input and output token ceilings. Per user request: maximum model calls, blended cost target at current pricing, p95 end-to-end latency, and time-to-first-token for streamed surfaces. State the overflow behavior: what is shed first when the input budget is exceeded — never the system prompt.

**Observability names four things:** what is logged per call (model id, prompt version, token counts, latency, cost, outcome, correlation id), the trace span boundaries (retrieval, each model call, each tool call), what is redacted (prompt bodies with user data, retrieved content, keys, PII — named field by field), and what alerts (threshold breaches worth notifying).

</patterns>

---

<decision_framework>

## Decision Framework

### Which Spec Sections Does This Feature Need?

Apply a framework only when the spec touches its artifact class. The per-artifact section templates live in [examples/core.md](examples/core.md).

```
Does the feature call a model at all?
├─ YES → Approach rationale (Pattern 1) + Model Selection (Pattern 2) + Prompt Architecture (Pattern 3)
│        + Output Contract (Pattern 4) + Budgets (Pattern 9) + Failure Modes (Pattern 8) + Eval Plan (Pattern 7)
├─ Does it retrieve from a corpus? → Retrieval Design section (Pattern 5)
├─ Does the model call tools?      → Tool Contracts section (see examples/core.md)
├─ Does the model sequence steps?  → Agentic Loop section (Pattern 6)
└─ None of the above touched       → the section is omitted, never filled
```

### Common Specification Mistakes

| Mistake                                         | Consequence                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| Specifying an agentic loop for a fixed sequence | Non-deterministic, expensive, hard to eval — a code chain was sufficient  |
| Omitting the empty-retrieval case               | The model answers from parametric knowledge and the answer looks cited    |
| "Validate the response" with no schema          | The developer invents a schema; downstream consumers break on drift       |
| No prompt version in the spec                   | Eval results cannot attribute to a revision; regressions are untraceable  |
| Floating model alias instead of a pinned id     | Silent quality shift when the provider rotates the alias                  |
| Budgets stated as adjectives ("fast", "cheap")  | No implementable target, no reviewable violation                          |
| No adversarial eval cases with untrusted input  | Prompt injection ships undetected                                         |
| Retry on refusals                               | Wastes budget and reads as an attempt to bypass a safety response         |
| Truncating the system prompt on overflow        | Instructions silently disappear; behavior changes without an error        |
| Post-filtering retrieval for access control     | Cross-tenant content reaches the model before it is filtered out          |
| Eval thresholds set after seeing results        | The gate ratifies whatever shipped instead of gating it                   |
| Including implementation code in the spec       | The developer follows your sketch instead of the codebase's real patterns |

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues (a spec with one of these is incomplete):**

- A model call with no output schema or validation boundary
- A floating model alias, or a model id inline in code
- An agentic loop missing any of the six guards
- Untrusted input reaching the system message, or fenced input with no adversarial eval case
- Budgets as adjectives, or no budgets at all
- No behavior defined for a failure row the feature can hit

**Medium Priority Issues:**

- A loop specified where the step sequence is known in advance
- Retrieval infrastructure for knowledge that fits the context window
- An unversioned prompt, or an in-place edit to a shipped prompt version
- Empty-retrieval behavior left undecided
- No regression eval set named

**Common Mistakes:**

- Treating provider-side schema enforcement as validation
- Repair attempts on semantic violations (laundering the bad value)
- Acting on streamed partial JSON before completion
- Specifying "handle API errors gracefully" instead of a per-row failure matrix

**Gotchas & Edge Cases:**

- A valid-shaped record with a hallucinated value passes schema validation — semantic checks are separate
- Retried refusals read as bypass attempts; surface them unchanged
- Changing any of model id, prompt version, or retrieval parameters moves quality — all three trigger re-eval
- A mutating tool retried after an ambiguous failure can double-apply; idempotency is part of the tool contract

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All specifications must be grounded in the codebase's real model clients, prompt modules, schemas, and eval fixtures**

**(You MUST justify the approach against the simpler tier — a fixed code-orchestrated chain beats an agentic loop whenever the step sequence is known)**

**(You MUST pin an explicit model id in configuration with a named fallback — never a floating alias, never inline in code)**

**(You MUST define the output contract completely: mechanism, schema, validation boundary, and a repair-vs-reject policy)**

**(You MUST state budgets as numbers — tokens per call, calls per request, cost per request, p95 latency)**

**(You MUST identify where untrusted input enters every prompt, and require adversarial eval cases wherever it does)**

**(You MUST apply each framework only when the spec touches its artifact class — an unused section is omitted, never filled)**

**Failure to specify these contracts produces AI features whose outputs go unvalidated, whose costs are unbounded, whose injections ship undetected, and whose regressions cannot be traced to a prompt revision.**

</critical_reminders>
