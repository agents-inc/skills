# AI Planning - Reference

> Lookup only. Decisions and red flags are in [SKILL.md](SKILL.md); section templates are in [examples/core.md](examples/core.md) and [examples/retrieval-and-agents.md](examples/retrieval-and-agents.md).

---

## Output modes

| Mode                      | Guarantees                                           | Does not guarantee                                                                                                                            |
| ------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema-constrained output | JSON matching the schema's types and required fields | completion (an output ceiling cuts it off), refusals (they replace the schema), keywords outside the provider's supported subset, true values |
| Strict tool arguments     | arguments matching the tool's input schema           | the same four                                                                                                                                 |
| JSON mode                 | valid JSON                                           | any schema                                                                                                                                    |
| Delimited text            | nothing                                              | —                                                                                                                                             |

Keywords commonly outside the supported subset: numeric ranges, string lengths, formats, recursive schemas. A provider either rejects the request or documents the keyword as unenforced — check its schema-support page and move whatever it will not enforce to the validator.

---

## Budget line items

| Item                           | Counts as                                               | Planning consequence                                                                              |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Reasoning tokens               | output — billed, and counted against the output ceiling | size the ceiling for reasoning + answer; an exhausted ceiling can return no answer and still bill |
| Cached input                   | input at the cached rate, a fraction of the base rate   | state the assumed hit rate; a hit needs an identical prefix                                       |
| Prompt below the cache minimum | uncached input                                          | a short shared prefix is not cached at all                                                        |
| Repairs and fallbacks          | extra calls                                             | count them in calls per request                                                                   |

---

## Default failure behaviour

| Failure               | Detection signal                                             | Default behaviour                                                                                                     |
| --------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Rate limited          | 429 with a rate-limit error code                             | wait at least retry-after when sent, else exponential backoff with jitter; cap attempts and total time; then fallback |
| Quota spent           | 429 with a quota, credit or spend-cap code                   | fail at once and alert — waiting never clears it                                                                      |
| Timeout               | elapsed > budget                                             | abort, documented timeout error                                                                                       |
| Provider outage       | 5xx / connection error                                       | fallback chain, then documented degraded response                                                                     |
| Malformed output      | validator fails                                              | the repair-or-reject rule                                                                                             |
| Incomplete output     | output ceiling reached                                       | reject; retry once with a higher ceiling only if the budget allows                                                    |
| Refusal               | the provider's refusal signal (stop reason or refusal field) | surface it, or a fallback model the provider documents for refusals; never the repair loop                            |
| Context overflow      | pre-call token count                                         | shed lowest-priority context; never the system prompt                                                                 |
| Empty retrieval       | nothing above the similarity floor                           | the spec's answer-or-abstain decision                                                                                 |
| Tool error            | tool throws or errors                                        | return the error to the model once; escalate on repeat                                                                |
| Runaway loop          | repetition guard trips                                       | terminate; return the partial result flagged as truncated                                                             |
| Cost ceiling exceeded | running cost counter                                         | terminate, return the partial result, alert                                                                           |

---

## Retrieval starting points

Starting values to tune on the eval set, not answers.

| Parameter      | Start at                                                                                                   | Move it when                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Chunk size     | a few hundred tokens — one documented default is 512                                                       | answers need surrounding narrative → larger              |
| Overlap        | 10–25% of the chunk                                                                                        | facts straddle boundaries → more; index size is the cost |
| Split boundary | structural — headings, sections, code units                                                                | the corpus has no reliable structure → fixed tokens      |
| Retrieval mode | hybrid where queries carry exact identifiers — error codes, SKUs, symbol names                             | queries are purely descriptive → semantic alone          |
| Top-k          | retrieve wide, re-rank narrow; one published run re-ranked 150 to 20, and 20 outperformed 5 and 10         | the eval set picks n — fewer is not automatically better |
| Re-ranking     | add when precision at n is the bottleneck                                                                  | it adds latency on every query                           |
| Inline instead | a knowledge set small enough to fit, with caching — one provider's guidance puts the line near 200k tokens | quality on the eval set drops as the set grows           |

---

## Grading methods

| Method                  | Use for                                    | Known weakness                                                                                                                                                                              |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deterministic assertion | exact labels, schema, must-not-call checks | cannot judge open text                                                                                                                                                                      |
| Human rubric            | open text; calibrating the other two       | slow, and raters disagree — record inter-rater agreement                                                                                                                                    |
| Model-graded            | open text at volume                        | swayed by length and by presentation order, may favour its own model family; trust it only after measuring agreement with human raters on a sample, against their agreement with each other |

---

## Eval set size

At pass rate p on n independent cases, the 95% interval is ±1.96·√(p(1−p)/n).

| Cases | ±95% at p = 0.90 |
| ----- | ---------------- |
| 40    | 0.09             |
| 100   | 0.06             |
| 200   | 0.04             |
| 400   | 0.03             |
| 1,000 | 0.02             |

- Cases that share a source — several questions on one document — are not independent; the true interval is wider.
- Comparing two prompt or model versions on the same cases, analyse the per-case difference; it removes case-difficulty variance.
- Must-pass cases run several times each — one pass of a non-deterministic system is one sample.
