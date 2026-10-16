# AI Planning - Retrieval and Agent Sections

> Templates for the sections a feature adds when it retrieves, calls tools or runs a loop. See [core.md](core.md) for the sections every model call needs, and [reference.md](../reference.md#retrieval-starting-points) for retrieval starting values.

**Prerequisites:** Pattern 3 (untrusted input) and Pattern 6 (failure modes) in [core.md](core.md) — retrieved text and tool results are untrusted input, and both add failure rows.

---

## Pattern 8: Retrieval Design

```markdown
## Retrieval Design

| Parameter       | Value                         | Rationale / pattern source                                         |
| --------------- | ----------------------------- | ------------------------------------------------------------------ |
| Corpus          | [what is indexed]             | [owner, size, change rate, who can write into it]                  |
| Chunk size      | [tokens]                      | [why; eval result]                                                 |
| Overlap         | [tokens or %]                 | [why]                                                              |
| Split boundary  | [structural / fixed]          | [why]                                                              |
| Embedding model | [pinned id]                   | [path:lines]                                                       |
| Store           | [store and index]             | [path:lines]                                                       |
| Retrieval mode  | [semantic / keyword / hybrid] | [why]                                                              |
| Top-k           | [retrieve k, re-rank to n]    | [n chosen by the eval set]                                         |
| Access filters  | [tenant, locale, permission]  | [inside the retrieval query — permission-aware store or partition] |
| Context budget  | [max tokens assembled]        | [how chunks are shed to fit]                                       |
| Citations       | [required / not]              | [metadata each chunk carries]                                      |

**Empty retrieval:** [answer from the model's own knowledge | abstain with a documented response] — a product decision, stated here
**Low similarity:** [threshold, and the behaviour below it]
**Reindex and staleness:** [who triggers reindex; how staleness is observable]
**Corpus intake:** [how documents are validated before they enter; retrieved text is fenced like any untrusted input]
```

---

## Pattern 9: Tool Contracts and Agentic Loops

### Tool contract

Use when the model calls tools, with or without a loop.

````markdown
## Tool Contracts

### `[tool_name]`

**Purpose:** [one sentence — what the model uses it for]
**Side effects:** [read-only | mutating]
**Idempotent:** [yes | no — and the key strategy]
**Confirmation required:** [yes — by whom | no]
**After an ambiguous failure:** [may run again | may not]
**Reaches:** [private data it reads; outbound channels it writes to]

| Name   | Type   | Required | Constraints  | Description  |
| ------ | ------ | -------- | ------------ | ------------ |
| [name] | [type] | [yes/no] | [enum/range] | [what it is] |

**Result returned to the model:**

```
{ /* shape with field types — this is prompt surface: small and unambiguous */ }
```

**Error behaviour:** [what the model receives on failure, and whether it may retry]
````

### Agentic loop

Use when the model chooses and orders its own steps.

```markdown
## Agentic Loop Design

| Guard                 | Value                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| Step budget           | [max model turns]                                                                                         |
| Token budget          | [cumulative input + output ceiling]                                                                       |
| Wall-clock budget     | [total elapsed limit]                                                                                     |
| Repetition guard      | [behaviour on N identical consecutive tool calls]                                                         |
| Termination           | [every condition, including success]                                                                      |
| Partial-result policy | [what is returned, flagged as truncated, when a budget trips — in place of the framework's default error] |

**State carried between steps:** [exactly what persists; nothing else does]
**Human checkpoints:** [where a person approves, or none]
**Recovery on tool failure:** [return the error to the model once, then escalate]
```
