# Code Review - Reference

> Lookup only. Severity and verdict decisions and the red flags are in [SKILL.md](SKILL.md); worked reviews are in [examples/core.md](examples/core.md).

---

## Inline comment prefixes

A review grouped under severity headings needs no prefixes. Findings posted as separate inline comments carry their severity one by one, because authors read unlabelled comments as mandatory. Pick one vocabulary per review.

| Meaning                     | Google review guide           | Conventional Comments                    |
| --------------------------- | ----------------------------- | ---------------------------------------- |
| Must Fix                    | unprefixed — read as required | `issue (blocking):`                      |
| Should Fix                  | no equivalent label           | `issue (non-blocking):`                  |
| Nice to Have                | `Nit:`, `Optional:`           | `nitpick:`, `suggestion (non-blocking):` |
| Not a request               | `FYI:`                        | `note:`, `thought:`                      |
| A concern you are unsure of | —                             | `question:`                              |
| Praise                      | —                             | `praise:`                                |

---

## Verdicts and platform review states

| Verdict                | Review state (GitHub's names) | Note                                                                   |
| ---------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| Approve                | Approve                       | Should Fix and Nice to Have findings go in the same review             |
| Request changes        | Request changes               | —                                                                      |
| Major revisions needed | Request changes               | No separate state exists; the first line of the review body carries it |
| No verdict yet         | Comment                       | A question sent before the review is complete                          |
