# Stack Detection - Reference

> Lookup material for a run whose approach is settled: the payload's exact shape, what each catalog
> route yields, and the report's sections. The rules that decide what goes in them are in
> [SKILL.md](SKILL.md).

---

## The `SeedPayload` contract

A snapshot of `packages/matrix/src/seed.ts` in the agents-inc CLI repository, at `SEED_VERSION = 6`.
`v` is a `z.literal`, so a payload built to any other version is refused outright — by
`share --stdin`, by `init --from` and by the editor — rather than read in a degraded form. The
refusal names the field and the version it expected (`v: … expected 6`): rebuild to that version,
and bring this snapshot up to date from `seed.ts`.

```typescript
type SeedLoadState = "lazy" | "preloaded";
type SeedScope = "project" | "global";

type SeedSkill = {
  install: "plugin" | "eject";
  scope: SeedScope;
  assignments: Record<string, SeedLoadState>; // sub-agent id → load state; presence is the assignment
};

type SeedAgent = {
  on?: boolean; // the only way a sub-agent holding no skills travels
  model?: "opus" | "fable" | "sonnet" | "haiku";
  codexModel?: string; // added in v6
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  scope?: SeedScope; // absent means "global", the product default
};

type SeedPayload = {
  v: 6;
  matrixVersion: string; // diagnostics only — a mismatch never fails a decode
  stackId: string | null;
  description?: string; // replaced on install by a loaded stack's own description
  marketplace?: string; // in the form `--marketplace` takes; absent is the default public catalogue
  skills: Record<string, SeedSkill>; // sparse — presence is selection
  agents: Record<string, SeedAgent>; // sparse — an agent with nothing to say has no entry
  // `external?` carries whole skill directories for ids no catalogue resolves. Detection maps to
  // catalog ids and never mints one, so it never writes this field.
};
```

`share --stdin` validates with the schema the store writes with, which adds one rule the type
cannot show: a `"project"`-scoped skill assigned to a sub-agent resting at `"global"` has nowhere to
be written, and the whole payload is refused.

---

## What each catalog route yields

| Fact needed                    | Host-supplied | `catalog.json`                                        | Per-skill `metadata.yaml`             |
| ------------------------------ | ------------- | ----------------------------------------------------- | ------------------------------------- |
| Skill ids and categories       | Yes           | `skills.<id>.category`                                | Yes — the id is the directory name    |
| `displayName`, `usageGuidance` | Yes           | Yes                                                   | Yes                                   |
| Category `exclusive`           | Yes           | `categories.<id>.exclusive`                           | **No** — say so in the report         |
| `matrixVersion`                | Yes           | Top-level `version`                                   | **No** — derive it, record the origin |
| Stacks offered                 | Yes           | `suggestedStacks`                                     | Its own stacks file, if it ships one  |
| Sub-agent ids                  | When supplied | Those a stack staffs: `suggestedStacks[].skills` keys | **No**                                |
| Preload mapping                | When supplied | **No**                                                | **No**                                |

`catalog.json` sits at `.claude-plugin/catalog.json` in a marketplace repository. `build marketplace`
writes it beside `marketplace.json` on every build, so a marketplace without one is broken rather
than old. Glob for a local copy — a checkout, the CLI's fetched source cache
(`~/.cache/agents-inc/sources/`, which also holds each skill's `metadata.yaml` for route 3), or the
copy Claude Code keeps of a marketplace it has added — before fetching it from the repository; the
editor reads the same file over the GitHub contents API.

An unbuilt checkout's stacks file is `config/stacks.ts`, or the `stacksFile` its source config
names. A source that ships stacks offers those in place of the built-ins, never alongside them; only
the public catalogue falls back to the built-ins, and only when it ships none.

A `suggestedStacks` entry carries `id`, `name`, `description`, `philosophy`, `allSkillIds`, and
`skills` as sub-agent → category → skill ids. It carries no load states.

The CLI is not a route: `search` prints a table for people and has no machine-readable output.

---

## Payload fields that are not findings

| Field           | Value                                    | Origin                                                                 |
| --------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| `install`       | `"plugin"`                               | The product default                                                    |
| `scope`         | `"global"`                               | The product default; `"project"` needs every assigned sub-agent pinned |
| `matrixVersion` | The catalog's `version`                  | On route 3, the checkout's `package.json` `version`, and said so       |
| `stackId`       | `null`, or the user's pick               | A pick exists in intent mode only                                      |
| `description`   | Omitted                                  | A configuration's sentence about itself; detection has none            |
| `marketplace`   | Omitted for the default public catalogue | Otherwise the marketplace the catalog was read from                    |
| Load states     | The preload mapping's answer, or `lazy`  | Never chosen by the run                                                |

Each one appears in the report's assumptions, so the user can see which values evidence produced
and which were defaults.

---

## The proposal report

| Section                  | Contents                                                                        |
| ------------------------ | ------------------------------------------------------------------------------- |
| What was detected        | Per workspace: the signals found, and the strength of each                      |
| Candidates and the pick  | Intent mode: what was offered, the one line for each, and which the user picked |
| What mapped              | Detected library → catalog skill id, with the sub-agents it was assigned to     |
| Detected, not in catalog | Every ABSENT finding, with its evidence                                         |
| Intent not covered       | Intent mode: what the user asked for that no candidate stack carries            |
| Conflicts                | Exclusive-category disagreements, both candidates, unresolved                   |
| Warnings                 | Version mismatches, manifest-only findings, facts the catalog route lacked      |
| Assumptions              | The fields above that are not findings, and the catalog route used              |
| Load states              | What the preload mapping answered, or that it could not be read                 |
| Next                     | The publish command, and which install command fits this directory              |
