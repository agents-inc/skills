---
name: meta-methodology-research-methodology
description: Investigation flow (Glob -> Grep -> Read), evidence-based research with file:line references, structured output format for AI consumption. Use for pattern discovery, implementation research, and codebase investigation.
---

# Research Methodology

> **Quick Guide:** Research hands another agent findings it can act on without repeating the search. Locate files by name, narrow by content, then read the files that carry the answer; every claim names the file, line range and symbol it came from, and a search that found nothing is reported together with the search. Two tool facts change what a result means. A search that returns nothing is not proof of absence: the Grep tool skips gitignored files, Glob's list is capped, and a long file's Read can come back partial. And on macOS, Linux and WSL, Claude Code leaves the Glob and Grep tools out of the default tool set, so the same steps run through `find` and `grep` in the shell.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — the search sequence, the evidence shape, the findings template, path and absence checks, scoping, progress notes, and a worked example
- [reference.md](reference.md) — what each search tool skips and where it truncates, which tools a session has, and the pre-report checklist

---

## Which path applies

- **The instructions you are working under define a report shape** — fill that shape; this skill supplies the evidence each entry carries and the checks it passes.
- **No report shape is given** — use the findings template in [examples/core.md](examples/core.md#pattern-3-structured-findings).

---

<critical_requirements>

## Before reporting findings

**Open a file before its path or contents enter the findings.** A path inferred from convention is a guess, and the agent acting on it opens a file that is not there.

**Give every claim the file, line range and symbol it came from.** The range lets the reader check the claim in one read; the symbol lets them find it again once an edit has moved the lines.

**Report a search that found nothing together with the search.** An absence is only as strong as the pattern, path and filters behind it, and the reader can rerun those but not your conclusion.

**Leave the code as you found it while you investigate.** A change made mid-investigation alters the evidence, and the reader can no longer tell which state a claim was read from.

</critical_requirements>

---

**Auto-detection:** where is X defined, how does X work in this codebase, find similar implementations, catalogue the components / endpoints / commands, pattern discovery, codebase investigation, architecture investigation, API catalogue, file:line references, usage count, Files to Reference, research findings, Glob, Grep

**Applies to:**

- Finding where a pattern lives and how consistently it is followed
- Cataloguing what exists — components, APIs and endpoints, commands, configuration, architectural decisions
- Finding the closest existing implementation before building something new
- Writing findings another agent acts on without repeating the search

**Handled elsewhere:**

- Making the change the findings point at — research ends at the location, and the implementation and its tests are a separate step
- Judging whether the code is good — research reports what is there and how often; quality and security verdicts belong to review
- Turning findings into a specification — scope and acceptance criteria belong to planning

---

<philosophy>

The reader of a finding did not watch the investigation. They cannot tell a claim that was read from one that was inferred, so the only claims worth handing over are ones they can check: a location, the code as it reads there, and the search that produced it. A finding they have to re-derive saved them nothing, and a wrong one costs more than none, because they build on it.

</philosophy>

---

<decision_framework>

## Which search first

```text
What do you already know?
├─ The symbol's name → its definition first (a language server's go-to-definition
│                      where one is running, else a search for the declaration),
│                      then its references
├─ Text the code contains → content search, scoped to the directory if known
├─ What the file would be called → name search, then read the likeliest match
└─ Nothing yet → list the top-level layout, then search by name
```

## How far to go

The question sets the deliverable, and the deliverable sets the depth.

```text
"How does X work?"          → X's flow: 2–3 exemplary files read end to end
"What exists for X?"        → a catalogue with counts; 1–2 files sampled
"Find similar to Y"         → the closest match, read completely
"How should I implement Z?" → the existing code to follow, in reading order
"Patterns for X?"           → several instances, and where they vary
```

## When to stop

```text
Is the question that was asked answered?
├─ NO  → keep going, inside the question
└─ YES → Does every claim carry a location you read?
         ├─ YES → report
         └─ NO  → read the file now, or drop the claim
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Locate, Narrow, Read

Find candidates by name, narrow them by content, then read the files that carry the answer. Each step is cheaper than the next, so the expensive reads land only on files already shown to matter.

```text
Glob  "src/**/*error*"                    → 6 candidate files
Grep  "extends AppError" in src/ (count)  → 4 matches in 4 files
Read  src/errors/app-error.ts             → class AppError, lines 8–31
```

Where the session has no Glob or Grep tool, `find` and `grep` in the shell are the same two steps.

Full walk-through: [examples/core.md](examples/core.md#pattern-1-locate-narrow-read)

### Pattern 2: Evidence-Based Claims

One claim, one location: the file, the line range, the symbol, the code as it reads there, and how many instances exist.

```text
AppError base class — src/errors/app-error.ts:8-31, class AppError
Usage: 4 subclasses (Grep "extends AppError" in src/, count mode → 4)
```

Full shape, beside the version that fails: [examples/core.md](examples/core.md#pattern-2-evidence-based-claims)

### Pattern 3: Structured Findings

Where no report shape is given: a summary, the patterns found, the files to read in order, the existing files to follow, the gaps, and a verification table that includes the searches that came back empty.

```text
## Research Summary        ## Recommended Approach
## Patterns Found           ## Gaps
## Files to Reference       ## Verification Checklist
```

Full template: [examples/core.md](examples/core.md#pattern-3-structured-findings)

### Pattern 4: Verifying Paths and Absences

A path enters the findings once the file has been opened, never from convention; a path seen only in a search result goes under Gaps as not read. An absence enters with its search, after a control — a search for something known to be there, over the same path with the same filters — has shown the search can find text at all.

```text
Grep "jwt" -i in src/      → 0 matches
Grep "session" -i in src/  → 12 matches   (control: the search works here)
Finding: no JWT handling in src/ — gitignored files not searched
```

Full code: [examples/core.md](examples/core.md#pattern-4-verifying-paths-and-absences)

### Pattern 5: Scope to the Question

Report what the question asked for. Material outside it becomes one line under Gaps where it bears on the answer, and is left out where it does not.

```text
Asked:  How does the API authenticate requests?
Report: the session flow, the route guard, the files to read first
Leave:  database schema, deployment, the client's login form
```

Full code: [examples/core.md](examples/core.md#pattern-5-scope-to-the-question)

### Pattern 6: Progress Notes for Long Research

Research spanning several packages keeps a running note — files examined, patterns found with their counts, gaps — so a compaction or a handoff resumes from the note rather than from memory.

Full template: [examples/core.md](examples/core.md#pattern-6-progress-notes-for-long-research)

</patterns>

---

<red_flags>

## Red flags

**Misleads the agent acting on the findings:**

- A path written from convention (`utils/formatDate.ts`) rather than from a search result — the reader opens a file that is not there. Write the path the search returned.
- A pattern inferred from a file name, or from what codebases in that framework usually do — it describes other codebases. Read the file and quote it.
- An API described from a call site — one caller's arguments, not the contract. Follow it to the declaration.
- "Around line 50", "in the auth module", "follow the existing convention" — the reader repeats your search. Give the file, the range and the symbol.
- A usage count read off a listing of matching lines — the listing stops at the tool's result limit, so the count comes out low. Count with the count mode, whose total covers every match.
- A universal ("all routes use this") with no count behind it — the one exception the reader trusted you about breaks their change. State the count and the search.
- Implementation code, or verdicts on quality, in findings that asked for locations — an answer to a question nobody asked, arriving without the context the implementer has. Name the existing file to follow.
- Findings with no reading order — the reader opens files at random. Rank the two or three to open first.

**Surprising behaviour:**

- The Grep tool skips gitignored files, so "0 matches" says nothing about generated code, build output or installed dependencies. Glob applies no gitignore filtering by default, so it lists files Grep never searches.
- Glob's results are sorted by modification time, not relevance, and capped; a truncation flag means the list is partial.
- A Read of a long file can return only its first page, marked `PARTIAL view` — "the file does not contain X" after that read is unverified.
- Grep patterns are ripgrep regex, so `interface{}` has to be written `interface\{\}`. On older Claude Code builds a pattern ripgrep rejected, or a path the tool could not read, came back as no matches rather than as an error.
- Line numbers describe the file as it was read. A later edit — another agent's included — moves them, which is why the symbol travels with the range.
- Tests can show a pattern production code has moved away from, configuration can override what the source suggests, and each package in a monorepo can follow its own convention. Say which one a finding came from.
- A pattern still in wide use may be marked `@deprecated`; report it as deprecated rather than as the convention to copy.

</red_flags>
