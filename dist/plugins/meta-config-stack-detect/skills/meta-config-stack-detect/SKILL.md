---
name: meta-config-stack-detect
description: Proposes an agents-inc configuration — a SeedPayload plus a report — from a repository, a stack the user describes, or a description of what they want to build. Load when seeding a configuration for a project that has none, or re-running one after its dependencies changed.
---

# Stack Detection

> **Quick Guide:** Read the evidence in front of you — manifests, lockfiles and framework configs, one pass per workspace — and map each library to an id from a catalog acquired at run time. Where the user names only what they want to build, offer candidate built-in stacks and wait for the pick. Load states come from the product's preload mapping, or `lazy`; an exclusive-category disagreement is surfaced, never resolved; whatever the payload cannot carry goes in the report. The output is a `SeedPayload` plus a report, published by the user through `npx agents-inc share --stdin` — the run writes, installs and posts nothing.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — a three-workspace monorepo walked end to end: traversal, mapping, an exclusive-category conflict, the payload and the report
- [examples/intent.md](examples/intent.md) — the same output reached from intent alone: candidates, the user's pick, and the gap the pick leaves
- [reference.md](reference.md) — the `SeedPayload` contract, what each catalog route yields, payload defaults, report sections

---

## Which path applies

- **A repository to read** — traverse it (Pattern 1); its signals settle the proposal. Follow
  [examples/core.md](examples/core.md).
- **A stack the user describes, with no repository** — ask for a pasted manifest first. Without one
  the description is the evidence, and people name what they like rather than what they use and leave
  out tooling, so every finding is WEAK and the report says the proposal came from description.
  Patterns 2–8 apply as written.
- **Only an outcome — no repository, no library named** — there is no signal to map. Offer candidate
  built-in stacks (Pattern 9) and wait for the pick; nothing else runs until the user answers. Follow
  [examples/intent.md](examples/intent.md).

---

<critical_requirements>

## Before proposing a configuration

**Acquire the catalog at run time and map only to ids it contains.** Consumers skip an unknown skill or sub-agent id rather than rejecting it, so a remembered id makes the proposal silently smaller, with nothing anywhere to explain the gap.

**When intent is all you have, offer candidate stacks and wait for the user to pick before mapping anything.** A payload is what a decision looks like, and one that arrives with the choice already made is a decision the user has to notice in order to undo.

**Emit a `SeedPayload` and a report, and offer `npx agents-inc share --stdin` for the user to run.** The CLI validates against the schema the store writes with and owns the wire version, the API address and the user-agent; writing config, running an install or POSTing the payload yourself removes the validation the whole design rests on. Never report the configuration as applied either: the user runs the command, and nothing is configured until they do.

**Mark each assignment's load state as the product's preload mapping has it, and `lazy` where the run cannot read the mapping.** A payload's load state lands as the user's explicit choice and overrides the mapping on install, so a hand-made allocation silently disagrees with every other surface.

**Surface an exclusive-category disagreement as an unresolved conflict naming both candidates and their evidence.** The payload holds one per sub-agent, and carrying the better-evidenced one without saying so turns an architectural question into a checkbox nobody re-reads.

**Put every ABSENT library, every uncovered part of the intent and every major-version mismatch in the report, never in the payload.** The schema strips keys it does not declare, so a warning added to the payload vanishes in transit while the decode still succeeds.

</critical_requirements>

---

**Auto-detection:** detect my stack, propose a config, seed a configuration, what skills does this project need, onboard this repo, recommend a stack for what I am building, `SeedPayload`, `share --stdin`, `init --from`, `catalog.json`, `suggestedStacks`, `stackId`, `matrixVersion`

**Applies to:**

- Proposing a configuration for a project that has none, from its manifests, lockfiles and configs
- Turning a stack the user describes into a starting configuration
- Offering candidate built-in stacks when the user names only what they want to build
- Reading a monorepo per workspace before anyone picks skills by hand
- Re-running a proposal after the repository's dependencies changed

**Handled elsewhere:**

- Publishing an installation that already exists — `share` maps the installed configuration deterministically, with no detection in it
- Skills or a stack the user names outright — apply them; there is nothing left to detect or recommend
- Validating the proposal — schema decoding, skill existence, `requires` and conflict relations belong to the CLI and the store, which judge what this skill emits
- Writing skill content — authoring a skill is a different job from selecting one

---

<philosophy>

## Philosophy

**The skill proposes; the existing machinery validates.** A deterministic detector accumulates an unbounded edge-case matrix — every monorepo flavour, every exotic layout — and each new architecture becomes something to test. Judgment absorbs that long tail, and determinism is recovered at the boundary instead: a proposal is accepted only if it survives the validation already built downstream. So the output shape matters more than the traversal. With the payload right, a wrong guess is a checkbox the user unticks; with it wrong, a right guess is unusable.

**Run-to-run variance is acceptable.** The output opens a session the user confirms and never writes configuration unattended, so two runs proposing slightly different sets are two opening offers, not a defect. Load states sit outside that variance: they are the mapping's answer.

**Two artifacts, always.** The payload has no room for a library with no catalog skill, a version mismatch, an unresolved conflict or a defaulted assumption. Emitting one artifact without the other loses either the automation or the honesty.

**Naming third-party libraries is this skill's domain.** Recognising a framework or a test runner in someone else's repository is the job, so library names appear here as signals to recognise, never as recommendations. Intent mode holds the same line: its candidates are the stacks the product already ships, quoted as they ship.

</philosophy>

---

<decision_framework>

## Does this signal earn a place in the payload?

```
Is the library named in a workspace manifest?
├─ NO  → Not a finding. A lockfile-only entry is someone else's dependency.
└─ YES → Corroborated by a config file or a real import?
    ├─ NO  → WEAK. Propose only if its category is otherwise empty; report "manifest-only".
    └─ YES → Does the acquired catalog hold a skill for it?
        ├─ NO  → ABSENT. A report row, no payload entry.
        └─ YES → Is it a frontend? Resolve it to its base framework first.
            ├─ YES, and another workspace resolves to a different frontend
            │      → Conflict. Stop here — different categories is not a union.
            └─ Otherwise → Does another workspace disagree in the same category?
                ├─ NO  → MAPPED. Add it to the payload.
                └─ YES → Is the category exclusive?
                    ├─ NO  → Union both; note it in the report.
                    └─ YES → Conflict. Better-evidenced one in the payload (neither,
                             if even); both named in the report as unresolved.
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Detection Traversal

Traverse for evidence, not coverage: read the few files that settle each question, then stop.

| Signal                | Where                                                                              | Settles                                                     |
| --------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Declared dependencies | `package.json` `dependencies` / `devDependencies`, per workspace                   | Which libraries this workspace claims                       |
| Resolved versions     | The lockfile — `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`      | The real major; a manifest range does not settle it         |
| Workspace declaration | `pnpm-workspace.yaml`, `workspaces` in the root manifest, the task runner's config | Whether this is a monorepo, and where its workspaces are    |
| Framework wiring      | The framework's own config file at the workspace root                              | Which framework is wired, not merely installed              |
| Deploy target         | The platform's config file at the workspace root                                   | Whether a workspace is a service, a worker or a browser app |

Scripts, directory layout, entry-point conventions and test directories **only corroborate**: they break a tie between two settled readings and never originate a finding — a `test/` directory names no test runner.

**Ignore** transitive dependencies no manifest names; `@types/*` packages, which mirror a runtime dependency and would count one signal twice; `node_modules` and build, coverage or generated output; fixture, example and template directories; and commented-out or dead configuration.

**The two-signal rule.** A library is a STRONG finding when a manifest names it **and** a config file or a real import corroborates it. Manifest-only is WEAK: record it, propose it only if its category would otherwise be empty, and say "manifest-only" in the report.

Full walkthrough: [examples/core.md](examples/core.md#pattern-1-detection-traversal)

### Pattern 2: Catalog Acquisition

Never inline the catalog: ids written into reasoning are stale by the next marketplace commit. Acquire it every run, in this order, verifying each route rather than assuming it.

| Route                        | Where                                                                                                               | What it lacks                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1. Host-supplied             | Supplied with the invocation on a hosted surface — check the invocation first                                       | Whatever the host leaves out                        |
| 2. `catalog.json`            | `.claude-plugin/catalog.json` in the marketplace repository — a local copy if a Glob finds one, else the repository | The preload mapping, and sub-agents no stack staffs |
| 3. Per-skill `metadata.yaml` | Each skill directory of a marketplace checkout that was never built                                                 | Exclusivity, `matrixVersion`, stacks unless shipped |

The CLI is not a route: `search` prints a table for people and has no machine-readable output.

**`matrixVersion`** is the catalog's own `version` on routes 1 and 2. Route 3 has none: derive it from the checkout's `package.json` `version` and record that origin in the report's assumptions. The field is diagnostics only, so a derived value is honest as long as its origin travels with it — never invent one or leave it empty.

Record which route answered and what it lacked. A route-3 proposal knows nothing of exclusivity, and its report says so rather than treating every category as non-exclusive. **If no route answers, stop** and report that the catalog could not be acquired: a proposal of remembered ids looks like a proposal, which makes it worse than none.

Route by route: [reference.md](reference.md#what-each-catalog-route-yields)

### Pattern 3: Mapping Judgment

Every detected library resolves to exactly one outcome, and all three appear in the report.

| Outcome       | Meaning                                      | Goes to                                                                |
| ------------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| **MAPPED**    | A catalog skill covers it                    | The payload and the report                                             |
| **ABSENT**    | Checked against the catalog; no skill exists | The report only, under "Detected, not in catalog"                      |
| **AMBIGUOUS** | Several skills plausibly cover it            | The best-evidenced one in the payload; the report names the alternates |

**An audited absence is information; a dropped finding is not.** "Checked, and the catalog has nothing" tells the user where the gap is. A finding that silently disappears looks like an oversight and hides a real marketplace gap.

**Match on slug first** — it is usually the library's own name — then on skill id, then on category plus display name. Nothing matching is ABSENT; a plausible-looking id is never the answer.

**A library filed under one category and used for another still maps.** A schema library the catalog files under forms, used here for environment validation, is that catalog skill all the same: propose it and note the observed use. Where a skill is filed is the catalog's concern.

**A category with no signal stays empty.** An empty category is visible in the surface the user confirms, which is the nudge wanted; a guess is not.

Full code: [examples/core.md](examples/core.md#pattern-3-mapping-judgment)

### Pattern 4: Workspace to Sub-Agent Mapping

Report per workspace, then merge by judgment. Take every sub-agent id from the roster the run acquired, exactly as skill ids come from the catalog: an id remembered from an earlier roster is skipped like a retired skill id, and its assignments quietly never arrive.

| Workspace shape                                     | Domain   | Informs                                          |
| --------------------------------------------------- | -------- | ------------------------------------------------ |
| Browser application — UI framework wired, DOM entry | `web`    | The roster's `web-*` agents                      |
| HTTP service, API or worker                         | `api`    | The roster's `api-*` agents                      |
| Terminal package — a `bin` entry                    | `cli`    | The roster's `cli-*` agents                      |
| Model provider SDK or orchestration framework wired | `ai`     | The roster's `ai-*` agents                       |
| Root tooling — formatter, type config, task runner  | `shared` | Only the agents the workspaces already justified |

The reviewing and planning roles carry no domain prefix and serve every domain, so workspaces in different domains inform the same single id. A skill whose domain has no agents of its own — a deploy platform, a mobile framework — rides the agent of the workspace it was found in.

1. **Root tooling never creates a domain.** A repository whose only evidence is root tooling has no agents to propose; say so.
2. **A workspace may inform several domains.** A full-stack application with server routes informs `web` and `api`; union them.
3. **Only agents with evidence.** An agent switched on because the roster has it is noise the user has to clear.

Assignment is per (sub-agent, skill): one skill can sit on several agents, each with its own load state.

Full code: [examples/core.md](examples/core.md#pattern-4-workspace-to-sub-agent-mapping)

### Pattern 5: Load State Comes From the Preload Mapping

The product ships one **preload mapping** — skill → the roles that carry it preloaded, read by the editor and the CLI alike — and it answers "does this arrive preloaded?" for every pair. Mark what it says. Where the run cannot read it, mark `lazy`, which is the mapping's own answer for a row it does not carry. There is no budget to hold, no slot to fill and no count to keep.

```
mapping readable   → each (sub-agent, skill) pair marked as the mapping has it
mapping unreadable → every pair `lazy`, recorded in the report as an assumption
```

`lazy` everywhere can only err toward less resident context, and each pair is one click from preloaded in the confirmation surface. A framework usually comes back preloaded for the roles that work in it all session — an observation about what the mapping says, not a rule to apply on its behalf.

Full code: [examples/core.md](examples/core.md#pattern-5-load-state-comes-from-the-preload-mapping)

### Pattern 6: Conflict Surfacing

| Category is   | Workspaces disagree                      | Do this                                                      |
| ------------- | ---------------------------------------- | ------------------------------------------------------------ |
| Non-exclusive | Two test runners, two styling approaches | **Union them** — both in the payload, one line in the report |
| Exclusive     | Two workspaces on different frameworks   | **Surface a conflict** — never resolve it silently           |

**Resolve every frontend to its base framework before comparing.** A meta-framework and a base framework sit in different categories, so the same-category test finds nothing and two incompatible frontends union into one payload. A meta-framework implies its base — a Next.js workspace is a React frontend, a Nuxt one a Vue frontend — while one with its own component model, Astro being the common case, resolves to itself. Two workspaces resolving to different frontends is a conflict whatever categories their skills sit in.

**To surface one,** name both candidates — and, for a frontend, the base each resolved to, which is the only thing that shows why two skills in different categories conflict — with the workspace and evidence behind each, carry the better-evidenced one in the payload, and state that it awaits the user. Where the evidence is even, carry neither and leave the category empty.

**Two frameworks inside one workspace** is usually a migration in flight: report it as one, name both, and propose what the config file wires. **In intent mode** the disagreement is between the pick and something the user said — surface it the same way, with the stack's choice and the user's words as the two candidates, and leave the picked stack as it ships.

Full code: [examples/core.md](examples/core.md#pattern-6-conflict-surfacing)

### Pattern 7: Version Awareness

Read the resolved major from the lockfile, then configure and warn — a major mismatch is where a skill's guidance stops matching the code.

1. A mismatch between the repository's major and the one the skill teaches **still proposes the skill**.
2. The warning goes in the **report**: repository major, skill major, and what is likely to diverge.
3. The payload stays schema-pure; it has no field for a warning.
4. Where the skill states no version, the report says "skill states no version" rather than inferring one.

```
| Skill     | Repo major | Skill teaches | Note                                                |
| --------- | ---------- | ------------- | --------------------------------------------------- |
| <styling> | v3         | v4            | Configuration model differs; guidance may not apply |
```

Full code: [examples/core.md](examples/core.md#pattern-7-version-awareness)

### Pattern 8: Output Assembly

Two artifacts, always both. The payload's exact shape is in [reference.md](reference.md#the-seedpayload-contract).

- **Ids are full catalog ids** — never indices, never abbreviations.
- **`v` is the snapshot's version.** It is a literal, so a payload built to any other is refused whole; rebuild to the version the refusal names.
- **`install: "plugin"` and `scope: "global"`** are the product's defaults, not findings, and the report lists them as defaults the user can flip. `"project"` composes a payload the store refuses unless every assigned sub-agent is pinned with `{ "scope": "project" }`: a project skill has nowhere to be written on a sub-agent resting at global, and with `agents` sparse, every one of them rests there.
- **`stackId` is `null`** unless the user picked a stack in intent mode. Nothing expands it into skills, so every skill the pick names must also be in `skills`; and `init --from` refuses a `stackId` the marketplace does not offer.
- **`marketplace`** is omitted for the default public catalogue, and set in the form `--marketplace` takes when the catalog came from another.
- **`agents` is sparse.** An entry says only what the assignments cannot — `on: true` for a sub-agent carrying no skills, or a model, effort or scope the user asked for. Model and effort belong to the sub-agent, never the skill.

**Where it goes.** Show the report, then offer the command that publishes the payload:

```
cat <<'PAYLOAD' | npx agents-inc share --stdin
{ … the SeedPayload … }
PAYLOAD
```

It prints an id, `npx agents-inc init --from <id>` to install it, and an editor link to adjust it first. In a directory that already holds an installation `init --from` refuses and `edit --from <id>` applies the id, so name the command that fits.

**Offering the command is not running it.** The user does that, and the payload then loads exactly as if a shared link had arrived — so the run never reports a configuration as applied.

Full code: [examples/core.md](examples/core.md#pattern-8-output-assembly)

### Pattern 9: Intent to Candidate Stacks

The entry point with no signals in it. The run narrows the choice and explains it; the user makes it.

**Acquire the stacks the way you acquire the catalog** — through the Pattern 2 routes, with the same verification. Stacks are added, retired and re-pointed between releases, so a remembered stack comes with remembered contents. An unbuilt marketplace checkout carries its own stacks file — `config/stacks.ts`, or the `stacksFile` its source config names — and a source's stacks replace the built-ins rather than extending them. If no route yields stacks, stop and say so.

**Read the intent for two things only:**

| Read for     | Sounds like                                                      | Settles                                         |
| ------------ | ---------------------------------------------------------------- | ----------------------------------------------- |
| **Surfaces** | "a web app", "an API my mobile app calls", "a command-line tool" | Which domains the proposal can touch            |
| **Concerns** | "with auth", "and billing", "a live feed", "in three languages"  | What each candidate covers, or visibly does not |

Team size, deadlines and language preferences are context, not evidence. "With billing" names a concern rather than a payments package, and reading a library out of an outcome is invention.

**Match against what each stack declares about itself** — its name, description, philosophy and the skills it names — so every match is explainable in one line.

**Offer two to four candidates, best first, one line each, then stop.** No payload before a pick, no default, no assumed first choice; silence is not a pick. If none fits, that is an answer too: report the distance between the intent and everything the product ships, and let the user assemble by hand in the surface — a stack assembled here can be checked against nothing.

```
# Good — candidates, reasons, and the question left open
  1. <stack-id-a> — declares auth, payments and analytics as what it is for
  2. <stack-id-b> — same frontend, brings auth; names nothing for payments
  Which is closest? Nothing is proposed until you say.

# Bad — the recommendation that arrived as a decision
  → SeedPayload for <stack-id-a>, 25 skills, ready to confirm
```

**After the pick,** verify each id the stack names against the catalog — a skill retired since is ABSENT, never carried — take the stack's own sub-agent staffing as given, and run Patterns 5–8; `stackId` names the pick. Carry the stack as it ships, including what the intent never asked for, and name the surplus in the report: trimming a pick to fit the sentence makes it mean something the user did not agree to. A concern no candidate covers — a real-time feed, translations, background jobs — goes in the report: name what the user asked for, name that no candidate covers it, and stop there. Never invent a skill id to fill it, and even where the catalog has skills for it, never pick one on the user's behalf: the confirmation surface lists that category's options, and choosing among them is the same decision the candidate list was. A gap is no reason to withhold the pick — a stack that answers four concerns of five and says which it missed beats one assembled here that answers all five and can be checked against nothing.

Full walkthrough: [examples/intent.md](examples/intent.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A payload built to a remembered `v` — the literal refuses the whole payload at `share --stdin`. Rebuild to the version the refusal names.
- `scope: "project"` on a skill whose assigned sub-agents have no `agents` entry pinning them to `"project"` — every pair is unwritable and `share --stdin` refuses the payload.
- A sub-agent id from an earlier roster — skipped like an unknown skill id, so its assignments never arrive. The roster changes between releases.
- A picked stack's skills left out of `skills` on the strength of `stackId` — nothing expands it, so they never arrive.
- A `stackId` the marketplace does not offer — `init --from` refuses the install.
- A base framework in one workspace and a meta-framework on a different base in another, unioned — they sit in different categories, so the same-category check passes and two incompatible frontends land in one payload.
- A `warnings` field added to the payload — stripped in transit, so the user gets the skill and never the caveat.

**Surprising behaviour:**

- An unknown id fails quietly: the install prints a skip line, and the proposal arrives smaller than it looked.
- A payload's `lazy` lands as the user's explicit choice, so it outranks a preload the mapping would otherwise have given.
- `matrixVersion` gates nothing; a mismatch only explains which ids were skipped.
- A loaded stack's `description` replaces the payload's own on install.
- A stack names ids from whichever release shipped it, so verify each one like any other id.
- ABSENT means absent from the catalog this run acquired; another marketplace may carry it, and the report row says so.
- `bun.lockb` is binary and cannot be read as text — record the major as unread rather than falling back to the manifest range.
- Per-skill `metadata.yaml` carries no exclusivity, so a route-3 proposal cannot tell a conflict from a union; the report names the categories it treated as exclusive.

</red_flags>
