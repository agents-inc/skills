---
name: meta-reviewing-reviewing
description: Code review process — reading order, findings, severity, scope and the approval decision. Load when reviewing a diff or PR, writing review comments, or deciding whether to approve or request changes.
---

# Code Review Patterns

> **Quick Guide:** A review is worth what the author can act on. Start from the diff's purpose and the file the change is about — a design problem there leads the review. Must Fix blocks approval, Should Fix is strongly recommended, Nice to Have is optional, and a finding that earns none of them is not written. Approve once the diff meets its success criteria and leaves the code healthier, even where you would have written it differently; a clean diff gets a short approval, not manufactured findings.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — worked findings, labelled and unlabelled reviews, scope findings, the verdict's evidence, praise, a complete clean review
- [reference.md](reference.md) — inline comment prefixes, and how verdicts map to platform review states

---

<critical_requirements>

## Before writing a review

**Read the specification or description, then every changed file in full, before writing a finding.** The purpose is the yardstick for every judgement, and a finding written from a partial read is about code you have not seen — the check it calls missing may sit below where you stopped.

**Judge the diff against its purpose, not against an ideal codebase.** The author can act on what the diff changed; a finding about code it never touched, or a refactor its specification never asked for, is work with nothing to weigh it against.

**Give every finding a `file:line`, the consequence of leaving it, and a fix pointed at an existing pattern where the codebase has one.** Without the location the author hunts for it, and without the consequence it is weighed as a style note.

**Label every finding with its severity, and leave unwritten anything that earns none.** Authors read unlabelled comments as mandatory, so a typo and an injection compete for the same round and the trivia buries the defect.

**Verify each success criterion with evidence before approving.** An approval that skips them ratifies whatever shipped.

**Name what the diff did well, specifically and sincerely.** Praise that names a choice tells the author what to repeat; generic praise tells them nothing and reads as filler.

</critical_requirements>

---

**Auto-detection:** code review, review this PR, pull request review, review the diff, review comments, approve, request changes, LGTM, nit:, blocking, non-blocking, Must Fix, Should Fix, Nice to Have, success criteria, review verdict

**Applies to:**

- Reviewing a diff, PR or implementation against the specification it was written to
- Deciding a finding's severity, and whether it is worth writing at all
- Writing a finding the author can act on without a follow-up question
- Choosing between approve, request changes and major revisions

**Handled elsewhere:**

- What to look for in a particular kind of code — UI, server, command-line, model-calling or infrastructure — is a domain checklist's job; this skill decides what a finding from any of them is worth and how it is written
- Formatting, lint and type errors belong to the tools that report them; a review restating their output spends the author's attention on what a machine already said
- Auditing a whole system's security — threat models, penetration tests — is its own discipline; this skill catches the security defects a diff makes visible
- Choosing an architecture before code exists — a review judges the design a diff carries, not the one a specification should have picked

---

<philosophy>

## Philosophy

Review exists to keep a codebase getting healthier while changes keep landing. That makes it a filter rather than an audit: the bar is "better than before and fit for its purpose", not "how I would have written it", because there is no perfect code to hold a diff against — only better code.

**Restraint is part of rigour.** A speculative suggestion sends the author to work the diff's purpose never asked for, as surely as a missed bug does by omission, and a review padded with them teaches authors to skim the next one, including the finding that matters.

**The reviewer reports; the author fixes.** A finding names the problem and the pattern that solves it, and leaves the change to the person who owns it.

</philosophy>

---

<decision_framework>

## How severe is this finding?

```
Would leaving it break something — behaviour, security, data, a critical
performance problem, a required success criterion, or a major violation of
a convention the codebase documents?
├─ YES → MUST FIX
└─ NO → Is it an improvement to code the diff changed?
    ├─ YES → Is the churn worth the diff's purpose, and does the spec ask for it?
    │   ├─ NO to either → don't write it
    │   └─ YES → Is the cost concrete in this diff — an edge case the spec implies,
    │            a swallowed error, a measured slowdown, a minor convention
    │            deviation in the changed lines?
    │       ├─ YES → SHOULD FIX
    │       └─ NO → don't write it — it is speculation
    └─ NO → Is it an addition the author may take or leave — tests beyond adequate,
            documentation, a clearly labelled future idea?
        ├─ YES → NICE TO HAVE
        └─ NO → don't write it — a style preference, a wording preference, an unrequested refactor
```

## Which verdict

**Approve** — every success criterion met with evidence, tests adequate for what changed and passing, no Must Fix. Should Fix findings travel with the approval as strong recommendations, and a minor one can become a follow-up rather than hold the merge.

**Request changes** — a Must Fix exists, or a criterion is unmet or unevidenced, and the fixes are patches to this approach.

**Major revisions needed** — the approach itself has to change: a design that cannot meet the spec, a systemic security flaw, existing behaviour broken.

**Unsure?** Request changes with the specific question that would settle it. That resolves in one round, where blocking indefinitely and approving on hope both cost more.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Purpose first, then the core of the change

Read the description and its criteria, find the file the rest of the diff exists to serve, and judge its design before anything else. A design problem there leads the review, alone if need be — line comments on code about to be rewritten are wasted on both sides.

```text
1. Purpose — does the description make sense; what are the success criteria?
2. Core    — the file or two the change is about. Is it designed to meet them?
3. If not  → that finding leads; line-level detail waits for the redesign.
4. If so   → the rest, in an order that builds understanding — tests are often the clearest way in.
```

Full code: [examples/core.md](examples/core.md#pattern-1-purpose-first-then-the-core-of-the-change)

### Pattern 2: The finding

Location, problem, consequence, and a fix pointed at the codebase's own pattern — written about the code, never about the author.

```markdown
**Must Fix — failed save reported as success** · `src/profile/save-profile.ts:42`

The `put` call has no rejection path, and `profile-form.tsx:88` shows "Saved"
unconditionally, so a failed save reads as success and the edit is lost on reload.
Map the rejection to the form's error state, as `settings/save-settings.ts:31` does.
```

Full code: [examples/core.md](examples/core.md#pattern-2-the-finding)

### Pattern 3: Labelled severity

Group findings under their severity, or prefix each inline comment, so the author can tell what blocks from what does not without asking.

```markdown
**Must Fix**

- `search.ts:24` — the search term is interpolated into SQL, so any caller can read the whole table

**Nice to Have**

- nit: `rows` → `matchingUsers` at `search.ts:30`; three lists are in scope there
```

Full code: [examples/core.md](examples/core.md#pattern-3-labelled-severity) · prefix vocabularies: [reference.md](reference.md#inline-comment-prefixes)

### Pattern 4: Scope against the spec

Compare what the diff does with what was asked. A change to something the spec fenced off blocks; an unrequested feature or refactor is asked into its own change; a reinvented utility is pointed at the existing one. Code the diff never touched is not this review's subject.

```text
Spec: email validation, name and bio editing, save.
Diff: + phone validation, avatar upload   → Should Fix: split into their own change
      ~ src/auth/session.ts                → question first — dependency or stray edit?
        (spec: "leave auth unchanged")       a stray edit is Must Fix
      + validateEmail() in profile-form.ts → Should Fix: lib/validation.ts already exports it
```

Full code: [examples/core.md](examples/core.md#pattern-4-scope-against-the-spec)

### Pattern 5: Evidence for the verdict

Each success criterion with its status and the evidence that settles it, plus one line naming what was not reviewed — an approval is read as covering everything it does not exclude.

```markdown
| Criterion                        | Status | Evidence                            |
| -------------------------------- | ------ | ----------------------------------- |
| Edit form rejects invalid emails | MET    | `profile-form.test.ts:41`           |
| A failed save shows an error     | UNMET  | `save-profile.ts:42` — see Must Fix |

Not reviewed: `src/api/generated/*` — regenerated from the schema; one file spot-checked.
```

Full code: [examples/core.md](examples/core.md#pattern-5-evidence-for-the-verdict)

### Pattern 6: Specific praise

Name the choice and why it was right. Look for something sincere; where nothing stands out, say less rather than invent it.

```markdown
- Reuses `formatOutput` instead of adding a second serializer, so `--json` and the
  table view cannot drift apart (`status.ts:31`)
```

Full code: [examples/core.md](examples/core.md#pattern-6-specific-praise)

### Pattern 7: The clean review

A diff with nothing wrong gets a short approval: the criteria with their evidence, what was done well, the verdict. Zero findings is a complete review, not an unfinished one.

```markdown
**Verdict:** Approve — both criteria met (table below); no findings.
```

Full code: [examples/core.md](examples/core.md#pattern-7-the-clean-review)

</patterns>

---

<red_flags>

## Red flags

**Costs the author a round:**

- Two findings that contradict — "extract this helper", "leave the existing helper alone" — the author can satisfy one, and the next round reopens the other.
- Asking for an abstraction "in case it's needed later" — the diff grows, the next review is harder, and the purpose has not moved; the problem worth solving is the one the code has now.
- Blocking on a style point no guide or linter states — where the code is consistent with its surroundings, the author's choice stands.

**Misleads the verdict:**

- Approving without naming what was not read — the approval is taken to cover it.
- Asserting what code does without reading it, including a helper or callee outside the diff that the change relies on — the finding rests on an assumption rather than on the code. Read it, or put the finding as a question.
- Flagging an unfamiliar pattern as wrong before searching the codebase for it — it may be the convention.
- Applying a domain checklist from memory — a remembered checklist is where invented findings come from; load that domain's checklist, or review on correctness, security and convention grounds and say so.
- Polishing minor findings while the core of the change goes unread — the blocker ships under a list of nits.

**Surprising behaviour:**

- Some duplication is deliberate — two call sites that will change for different reasons; check before flagging it.
- A performance finding with no measured or evident cost in this diff is speculation, and low-traffic code rarely needs the optimisation.
- A "convention violation" may be the newer pattern the codebase is moving to — check recent changes before flagging it.
- High coverage is easy to reach with weak tests; read whether the assertions would fail if the code broke.
- A file outside the spec's scope may be a dependency the change needed — ask before flagging it.
- A second-round review that does not say which earlier findings are resolved leaves the author guessing which still stand.

</red_flags>
