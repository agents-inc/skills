---
name: meta-config-stack-detect
description: Inspect a codebase, a stack the user describes, or a description of what they want to build; map what is there to agents-inc catalog skills — or intent to candidate built-in stacks the user picks from — and emit a SeedPayload plus a human-readable proposal report. Use when seeding a configuration for a project that has none.
---

# Stack Detection

> **Quick Guide:** Traverse what is in front of you — manifests, lockfiles, framework configs, one pass per workspace — or, where the user names nothing but the thing they want to build, offer candidate built-in stacks and wait for them to pick. Acquire the catalog and the stacks at run time, map signals to catalog skill ids, mark how each assignment loads per the product's preload mapping, surface exclusive-category conflicts instead of resolving them, and emit a `SeedPayload` plus a proposal report. The skill proposes. The machinery downstream validates. Nothing is written unattended.

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - A three-workspace monorepo walked end to end: traversal, mapping, an exclusive-category near-miss, the complete `SeedPayload`, and the proposal report — then the same output reached the other way, from intent alone: candidates, the user's pick, and the gap the pick leaves

---

<critical_requirements>

## CRITICAL: Before Proposing Anything

> **All output must follow project conventions in CLAUDE.md**

**(You MUST acquire the catalog at run time and map only to ids it contains — never propose a skill id from memory, and never inline a copy of the catalog into your reasoning as if it were current)**

**(You MUST acquire the built-in stacks the same way when intent is all the user has given you, offer candidates with the reason each is one, and wait for the USER to pick before any mapping runs — recommending is still proposing, never deciding)**

**(You MUST emit the proposal as a `SeedPayload` and OFFER the command that publishes it — `agents-inc share --stdin` — for the user to run; never write config files, never run install commands, never POST the payload yourself, never report a configuration as applied)**

**(You MUST mark each assignment's load state as the product's preload mapping has it, and `lazy` where you cannot read the mapping — never allocate slots, count preloads, or hold a budget of your own)**

**(You MUST surface exclusive-category disagreement as an unresolved conflict naming both candidates and their evidence — never resolve one silently)**

**(You MUST report every detected library that has no catalog skill, every part of the intent no candidate stack covers, and every major-version mismatch, in the human-readable report — the `SeedPayload` stays schema-pure and carries none of them)**

</critical_requirements>

---

**Auto-detection:** stack detection, propose a config, seed a configuration, what skills does this project need, detect my stack, onboard this repo, what stack should I use, recommend a stack for what I am building, SeedPayload proposal

**When to use:**

- A project has no configuration yet and the user wants one proposed from the code
- A user describes their stack in conversation and wants a starting configuration
- A user describes only what they want to build, names no libraries, and needs candidate stacks to choose between
- A monorepo needs a per-workspace read before anyone picks skills by hand
- An existing proposal needs re-running after the repo's dependencies changed

**Key patterns covered:**

- Traversal: which signals settle a question and which only corroborate
- Catalog acquisition in priority order, with verification rather than assumption
- Intent to candidate built-in stacks, offered for the user to pick between
- Mapping judgment, including the audited-vs-absent distinction
- Workspace to domain and sub-agent mapping
- Load state, deferred to the product's preload mapping
- Conflict surfacing for exclusive categories
- Version awareness (configure-and-warn)
- Output assembly: `SeedPayload` plus proposal report

**When NOT to use:**

- The project already has a configuration — that is a deterministic mapping from existing config, not detection
- The user names the skills they want — take them at their word and skip detection
- The user names the built-in stack they want — apply it; there is nothing left to recommend
- The task is authoring skill content rather than selecting skills

---

<philosophy>

## Philosophy

**The skill proposes; the existing machinery validates.** Detection is deliberately judgment-shaped. A deterministic detector accumulates an unbounded edge-case matrix — every monorepo flavor, every module-federation layout, every exotic directory convention — and each new architecture becomes something to test. Judgment absorbs that long tail instead. Determinism is recovered at the boundary rather than in the detector: a proposal is only accepted if it survives the validation that already exists downstream — schema decoding, skill-existence checks, `requires` relations, conflict relations, and one-selection-per-exclusive-category. Nothing anywhere tests "does detection handle this build system"; the only guarantee that has to hold is that an invalid configuration cannot get through, and that guarantee is already built and already tested.

This is why there is no deterministic detector to imitate, and why the output shape matters more than the traversal. Get the payload right and a wrong guess is a checkbox the user unticks. Get the payload wrong and a right guess is unusable.

**Three ways in, one concern.** Files on disk, a stack the user names, and a description of what they want to build are three qualities of evidence for the same question — which skills should this configuration carry. The third is the weakest by a wide margin: intent names no library, so answering it means choosing among the stacks the product already ships, and choosing is the user's to do. Offer the candidates, say in one line why each is one, and wait. A recommendation the user never asked for and cannot see is a decision wearing a proposal's clothes.

**Run-to-run variance is acceptable.** Two runs over the same repository may propose slightly different sets. That is fine, and it is not a defect to engineer away. The output seeds a session the user confirms; it never writes configuration unattended. Variance that would be alarming in a build step is merely a different opening offer here.

**Two artifacts, always.** The machine-readable payload cannot hold everything worth saying — a library with no catalog skill, a version mismatch, an unresolved conflict, an assumption you defaulted. Those go in the human-readable report. Emitting one without the other loses either the automation or the honesty.

**Naming third-party libraries is this skill's domain.** Detection is the act of recognizing a framework, a test runner, a styling approach in someone else's repository. Those names appear here as _signals to recognize_, never as prescriptions — this skill never tells anyone which library to adopt. Intent mode holds the same line from the other end: the candidates are the product's own built-in stacks, quoted as they ship rather than composed here. Surfacing an option the product already offers is not prescribing a library; assembling a stack of your own would be.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Detection Traversal

Traverse for evidence, not for coverage. Read the few files that settle questions and stop.

#### Signals that settle a question

| Signal                | Where                                                                               | What it settles                                                |
| --------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Declared dependencies | `package.json` `dependencies` / `devDependencies` (per workspace)                   | Which libraries this workspace actually claims                 |
| Resolved versions     | The lockfile (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, ...)              | The real MAJOR version — a manifest range does not settle this |
| Workspace declaration | `pnpm-workspace.yaml`, `workspaces` in the root manifest, build-orchestrator config | Whether this is a monorepo, and where the workspaces are       |
| Framework wiring      | The framework's own config file at the workspace root                               | Which framework is _wired_, not merely installed               |
| Deploy/runtime target | The platform config file at the workspace root                                      | Whether a workspace is a service, a worker, or a browser app   |

#### Signals that only corroborate

Scripts in the manifest, directory layout, entry-point conventions, and the presence of a test directory. Use them to break a tie between two settled readings. Never let them originate a finding on their own — a `test/` directory does not name a test runner.

#### What to ignore

- **Transitive dependencies no manifest names.** A framework appearing in the lockfile under a tool's own subtree does not make the workspace a consumer of it.
- **`@types/*` packages.** They mirror a runtime dependency; counting both double-counts one signal.
- **`node_modules`, build output, coverage output, and generated directories.**
- **Fixture, example, and template directories.** They exist to demonstrate something the project does not necessarily use.
- **Commented-out or clearly dead configuration.**

#### The two-signal rule

A library earns a MAPPED finding when it is named in a manifest **and** corroborated by a config file or real import. Manifest-only presence is a WEAK finding: record it, propose it if the category would otherwise be empty, and say in the report that it was manifest-only.

#### When there is no repository

In a hosted conversation there is nothing to traverse. The user's description is the evidence, and its weaknesses are different: people name what they like rather than what they use, omit tooling entirely, and describe intentions as facts. Ask for the manifest if the user can paste one. Otherwise treat every finding as WEAK, propose conservatively, and say in the report that the proposal came from description rather than code.

**When the user names nothing at all** — no repository, no libraries, only the thing they want to build — there is no signal to weigh and traversal has nothing to do. Do not go looking for one in the phrasing: "a SaaS with billing" names an outcome, not a payments library, and reading a library out of it is invention with a detection's face on. That entry point is Pattern 3, and it starts by offering candidates rather than by mapping.

See [examples/core.md](examples/core.md#step-1-traversal) for a full traversal walkthrough.

---

### Pattern 2: Catalog Acquisition

**Never inline the catalog.** Hundreds of skill ids written into reasoning are stale by the next marketplace commit, and a stale id produces a proposal that decodes to nothing. Acquire the catalog at run time, every run, in this order — and **verify** each route rather than assuming it.

| Priority | Route                       | How to acquire it                                                                                    | How to verify                                                                          |
| -------- | --------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1        | Provided by the host        | On a hosted surface the catalog is supplied with the invocation                                      | Check the invocation context first. If a catalog is present, use it and stop here.     |
| 2        | Machine-readable CLI output | The installed CLI may expose a JSON catalog flag (`search --json`, or a dedicated `catalog --json`)  | Run the CLI's `--help` and read the flag list. Use the flag only if `--help` lists it. |
| 3        | Per-skill `metadata.yaml`   | Read `metadata.yaml` from each skill directory in the fetched source cache or a marketplace checkout | Glob for `metadata.yaml` under the cache root or the checkout's skills directory.      |

```
# Route 2 — verify, do not assume. The JSON flag is a filed prerequisite
# and may not have shipped in the installed version.
agents-inc search --help
```

**Do not assume route 2 exists.** It is tracked as a prerequisite and the command may still be flagless. A `--help` that does not list it means the route is unavailable; fall through to route 3.

**What each route yields:**

| Fact needed                       | Route 1 | Route 2 | Route 3                                |
| --------------------------------- | ------- | ------- | -------------------------------------- |
| Skill ids and categories          | Yes     | Yes     | Yes (id is the directory name)         |
| `displayName`, `usageGuidance`    | Yes     | Yes     | Yes                                    |
| Category `exclusive` / `required` | Yes     | Yes     | **No** — treat as unknown, say so      |
| Matrix version for the payload    | Yes     | Yes     | **No** — derive it, per the rule below |

**Where `matrixVersion` comes from.** Routes 1 and 2 supply it and it is used as given. Route 3 has none to read, so derive it from the **marketplace checkout's `package.json` `version` field** and record that origin in the report's assumptions. The field is diagnostics only and never gates a decode, so a derived value is honest as long as its origin travels with it — but never invent one and never leave it empty.

Record which route you used and which facts came from it. A proposal built on route 3 knows less about exclusivity than one built on route 1, and the report must not pretend otherwise.

**If all three routes fail, stop.** Report that the catalog could not be acquired. Do not proceed from memory — a proposal of remembered ids is worse than no proposal, because it looks like one.

---

### Pattern 3: Intent to Candidate Stacks

The entry point with no signals in it. The user has said what they want to build, nothing in that sentence is a library, and the answer is not a mapping — it is a choice among the stacks the product already ships. Your part is to narrow that choice and explain it. Their part is to make it.

#### Acquire the stacks, exactly as you acquire the catalog

Stacks are data, not knowledge, and they go stale the same way: stacks are added, retired, and re-pointed at different skills between releases. Acquire them at run time through the Pattern 2 routes, in the same order and with the same verification — the host supplies them alongside the catalog where it supplies anything; the installed CLI is the next place to ask, and its `--help` is the only thing that says whether it can be asked; a source checkout carries its own stacks file, which may extend or override the built-ins. A remembered stack has remembered contents, and both are wrong before the name is.

**If no route yields stacks, stop and say so.** Offering candidates whose contents you cannot name is the same failure as guessing at catalog ids, one level up.

#### Read the intent for outcomes, not libraries

Two things are worth extracting, and only two.

| Read for     | Sounds like                                                      | What it settles                                       |
| ------------ | ---------------------------------------------------------------- | ----------------------------------------------------- |
| **Surfaces** | "a web app", "an API my mobile app calls", "a command-line tool" | Which domains the proposal can touch at all           |
| **Concerns** | "with auth", "and billing", "a live feed", "in three languages"  | What each candidate either covers or visibly does not |

Everything else — team size, a deadline, a preference about a language — is context rather than evidence. It does not become a skill.

#### Match against what the stacks declare about themselves

A stack ships its own name, description, philosophy, and the set of skills it names. That is the whole basis for a match, which is exactly why every match is explainable in one line. Matching against a remembered impression of "the Next.js one" is how a candidate arrives carrying something it does not contain.

#### Offer, then wait

Two to four candidates, best first, one line each saying which part of the intent it answers. Then stop.

- **No `SeedPayload` before a pick.** A payload is what a decision looks like.
- **No default and no assumed first choice.** Silence is not a pick.
- **If none of them fits**, that is an answer as well: report the distance between the intent and everything the product ships, and let the user assemble by hand in the surface.

```
# ✅ Good — candidates, reasons, and the question left open
"a SaaS with auth and payments"
  1. <stack-id-a>  — declares auth, payments and analytics as what it is for
  2. <stack-id-b>  — same frontend, brings auth; names nothing for payments
  3. <stack-id-c>  — end-to-end type safety, auth included; payments by hand
  Which is closest? Nothing is proposed until you say.

# ❌ Bad — the recommendation that arrived as a decision
"a SaaS with auth and payments"
  → SeedPayload for <stack-id-a>, 17 skills, ready to confirm
```

**Why bad:** the user's only remaining move is to notice a choice was made and undo it, and a payload that looks confirmed is precisely what nobody re-reads. The offer is the product of this pattern; the payload is the product of their answer.

#### After the pick

Nothing about the rest is special. The stack names skill ids: verify each one against the acquired catalog, because a stack shipped by a different version may name a skill that has since been retired — a retired id is ABSENT and reported (Pattern 4), never carried. The stack also names which sub-agents carry which skills, and that is its data rather than a judgment to redo: Pattern 5 exists for evidence you gathered, and here there is none. Load states follow Pattern 6, conflicts Pattern 7, assembly Pattern 9. `stackId` in the payload is the stack the user picked — the one case where it is not `null`.

A picked stack routinely carries more than the intent asked for — a sub-agent for a surface the user never mentioned, a skill nobody described. Carry it as the stack ships it and name the surplus in the report. Trimming a pick to fit the sentence makes it mean something the user did not agree to, and an untick in the confirmation surface is cheaper than a silent edit.

A library the user _did_ name that disagrees with the picked stack is not a gap but a conflict, and Pattern 7 has it: surface both, resolve neither.

#### The part of the intent nothing covers

Where the intent implies a category no candidate stack carries — a real-time feed, translations, background jobs — the gap belongs in the report, and it reads exactly like a detected library with no catalog skill: name what the user asked for, name that no candidate covers it, stop there. Do not invent a skill id to fill it, and do not pick one on their behalf. The confirmation surface lists that category's options, and choosing among them is the same decision the candidate list was.

A gap is no reason to withhold the pick. A stack that answers four concerns of five and says which one it missed beats a stack assembled here that answers all five and can be checked against nothing.

See [examples/core.md](examples/core.md#a-second-entry-intent-with-nothing-to-traverse) for a worked intent-mode run.

---

### Pattern 4: Mapping Judgment

Every detected library resolves to exactly one of three outcomes, and all three appear in the report.

| Outcome       | Meaning                                                | Where it goes                                                               |
| ------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| **MAPPED**    | A catalog skill covers this library                    | The `SeedPayload` and the report                                            |
| **ABSENT**    | Detected, audited against the catalog, no skill exists | The report only, under "Detected, not in catalog"                           |
| **AMBIGUOUS** | Several catalog skills plausibly cover it              | The payload carries the best-evidenced one; the report names the alternates |

**The audited-vs-absent distinction is the point.** "This library was checked against the catalog and has no skill" and "this library was never considered" look identical if you drop the finding. The first is information the user needs — it tells them the proposal is complete and where the gap is. Dropping it makes the proposal look like an oversight and hides a real marketplace gap. Report every ABSENT finding with its evidence.

**Matching order:** the slug is usually the library's own name, so match on slug first, then on the skill id, then on category plus display name. When nothing matches, the answer is ABSENT.

**A library filed under one category but used for another still maps.** A general-purpose library often earns its catalog place from one job — a schema library filed under forms — while the repository uses it for another, such as environment and wire-payload validation. Propose the catalog skill and note the observed usage in the report. Which category a skill sits in is the catalog's concern, not detection's: never drop the finding over the mismatch, and never invent an id in the category the usage suggests.

```
# ✅ Good — audited, and the gap is reported
Detected: a CSS framework in the web workspace manifest + its config file
Catalog:  no skill with that slug in any styling category
Result:   ABSENT → report row: "detected, no catalog skill (styling category left empty)"

# ❌ Bad — a plausible-looking id that the catalog does not contain
Result:   web-styling-<guessed-name>   → decodes to nothing, silently
```

**Why bad:** unknown ids are skipped by consumers rather than rejected, so a guessed id produces a proposal that is quietly smaller than it looked, with no error anywhere to explain it.

**A required category with no signal is a gap, not a prompt to guess.** If a domain is present but its required category detected nothing, leave it empty and say so. An empty required category is visible in the surface the user confirms, which is exactly the nudge that is wanted.

---

### Pattern 5: Workspace to Sub-Agent Mapping

Workspaces map onto the sub-agents the roster carries. Report per workspace, then merge by judgment.

| Workspace shape                                     | Domain   | Informs                                            |
| --------------------------------------------------- | -------- | -------------------------------------------------- |
| Browser application (UI framework wired, DOM entry) | `web`    | `web-developer`, `web-tester`, `web-pm`, ...       |
| HTTP service, API, or worker                        | `api`    | `api-developer`, `api-tester`, `api-pm`, ...       |
| Terminal package (a `bin` entry)                    | `cli`    | `cli-developer`, `cli-tester`, `cli-pm`, ...       |
| Root tooling (formatter, type config, orchestrator) | `shared` | The domain agents the workspaces already justified |

**Read the roster before you name an id.** The table above is shaped by domain, but the roster is not uniformly per-domain — some roles are shared across every domain rather than duplicated inside each one, and which ones those are changes between releases. Take the ids from the agents the run acquired, exactly as Pattern 2 takes skill ids from the acquired catalog. An agent id remembered from an earlier roster fails the same way a retired skill id does: it is skipped rather than rejected, so its assignments quietly do not arrive.

**Three rules that carry the weight:**

1. **Root tooling never creates a domain.** It decorates the agents that workspaces already justified. A repository whose only evidence is root tooling has no agents to propose — say so rather than inventing a domain to hang it on.
2. **A workspace may inform more than one domain.** A full-stack application with server routes informs both `web` and `api`. Union them; do not force a single choice.
3. **Only propose agents with evidence.** Never switch on a domain's agents because the roster has them. An agent with no workspace behind it is noise the user has to clear.

Assignment granularity is per (sub-agent, skill), which is what the payload's `assignments` map expresses: one skill can be assigned to several agents, with a different load state for each.

---

### Pattern 6: Load State Is Not Yours to Decide

Every assignment carries a load state, and not one of them is this skill's judgment to make. The product ships a **preload mapping** — one table, keyed by skill and by sub-agent role, read by the editor and the CLI alike — and it is the answer to "does this arrive preloaded?" for every pair nobody has explicitly decided. The proposal marks what that mapping has. Where the run cannot read it, the proposal marks `lazy`, which is the mapping's own word for a row it does not carry.

There is no budget here to hold, no slots to fill, and no count to keep.

The reason eagerness is rationed at all is real: a preloaded skill is paid for on every invocation whether the task touches it or not, so an agent that preloads everything begins every task with its context already spent. That reasoning is the mapping's, and it has already been spent on the user's behalf, per skill and per role. Re-deriving it here produces a second opinion for the machinery to disagree with.

Two things survive the rule that carried them:

- **A framework is usually the eager one**, because the role that works in it works in it all session. That is an observation about what the mapping tends to say, not a rule to apply on its behalf. Ask the mapping.
- **Load state is per (sub-agent, skill).** The same skill can arrive preloaded on one agent and lazy on another, which is exactly what the payload's `assignments` map is shaped to express.

```
# ✅ Good — the mapping's answer, or its default, and the report says which
mapping readable   → each (skill, sub-agent) pair marked as the mapping has it
mapping unreadable → every assignment `lazy`, recorded in the report as an
                     assumption rather than a finding

# ❌ Bad — a rule of one's own, applied over the top
"3-4 per agent, framework always in" → three preloads chosen here by hand
```

**Why bad:** a payload's load states travel as the user's own word, so a hand-made allocation _overrides_ the mapping downstream instead of being corrected by it. Two surfaces that agreed about how a skill loads stop agreeing, and nothing errors. Marking `lazy` can only ever differ from the mapping in the direction of less resident context, and every one of them is visible in the surface for the user to flip.

---

### Pattern 7: Conflict Surfacing

Disagreement between workspaces is normal. What happens next depends entirely on whether the category is exclusive.

| Category is   | Workspaces disagree                      | Do this                                                        |
| ------------- | ---------------------------------------- | -------------------------------------------------------------- |
| Non-exclusive | Two test runners, two styling approaches | **Union them.** Both go in the payload. Note it in the report. |
| Exclusive     | Two workspaces on different frameworks   | **Surface a conflict.** Never resolve it silently.             |

The product model allows one selection per exclusive category per sub-agent, so the payload cannot hold both. That constraint is not permission to pick one quietly.

**Resolve every workspace's frontend to its base framework before you compare.** The category test alone misses this case: a meta-framework and a base framework are filed in different categories, so "do they disagree in the same category?" answers no, and two incompatible frontends union into one payload with nothing surfaced.

- **A meta-framework implies its base.** Resolve it and compare the base, not the filing — a Next.js workspace is a React frontend, a Nuxt workspace is a Vue one.
- **A standalone meta-framework is a frontend in its own right.** One that brings its own component model rather than building on a base — Astro is the common case — resolves to itself.
- **Two workspaces resolving to different frontends IS a conflict**, whatever categories their skills sit in. Surface it by the rules above, naming both the skill and the base it resolved to. Different categories is not a licence to union.

**How to surface it:**

- Name **both** candidates, each with the workspace and evidence behind it.
- Carry the **better-evidenced** candidate in the payload, and state in the report that this is an unresolved conflict awaiting the user, not a decision that was made.
- If the evidence is genuinely even, carry **neither** and leave the category empty. An empty required category is visible in the confirmation surface; a coin-flip is not.

**Two frameworks inside one workspace** is a different finding: usually a migration in flight. Report it as a migration, name both, and propose the one the config file wires.

**In intent mode the disagreement is between the pick and something the user said.** A stack picked after asking for Vue carries a React frontend and the exclusive category holds one of them — that is the same unresolved conflict, surfaced the same way, with the stack's choice and the user's own words as the two candidates. Do not quietly edit the picked stack to match the sentence: the stack is the thing they chose, and swapping a skill inside it makes the pick mean something they did not agree to.

---

### Pattern 8: Version Awareness — Configure and Warn

Read the resolved MAJOR from the lockfile. A manifest range does not settle a version, and a major mismatch is exactly where a skill's guidance stops matching the code.

**The rule is configure-and-warn:**

1. A major mismatch between the repository and what the catalog skill teaches **still proposes the skill**.
2. The warning goes in the **human-readable report**: repository major, skill major, and what is likely to diverge.
3. The `SeedPayload` stays **schema-pure**. It has no field for a warning, and adding one is a schema change.
4. Silent inclusion is forbidden. A skill teaching a different major without a warning is worse than no skill, because the user has no reason to distrust it.
5. If the catalog states no version, say "skill states no version" — do not infer one from the description.

```
# ✅ Good — report row, payload untouched
| Skill      | Repo major | Skill teaches | Note                                            |
| ---------- | ---------- | ------------- | ----------------------------------------------- |
| <styling>  | v3         | v4            | Configuration model differs; guidance may not apply |

# ❌ Bad — a warnings array bolted onto the payload
{ "v": 5, "warnings": ["version mismatch"], ... }
```

**Why bad:** the schema strips what it does not declare, so the warning silently disappears in transit and the decode still succeeds — the user gets the skill and never gets the caveat.

---

### Pattern 9: Output Assembly

Two artifacts, always both.

#### The `SeedPayload` contract

Snapshot of `packages/matrix/src/seed.ts` at `SEED_VERSION = 5`. **`v` is a `z.literal`, so a payload built to an older snapshot is REFUSED rather than degraded** — by the editor's shared-import path, by the CLI's `--from` path, and by `agents-inc share --stdin`. This snapshot sat at `3` while the wire was at `5`, which made every payload this skill emitted unusable; if validation rejects a payload built to this shape, regenerate the snapshot from `seed.ts` rather than working around the rejection.

```typescript
type SeedLoadState = "lazy" | "preloaded";

type SeedSkill = {
  install: "plugin" | "eject";
  scope: "project" | "global";
  // Sub-agent id → load state. Presence IS the assignment.
  assignments: Record<string, SeedLoadState>;
};

type SeedAgent = {
  on?: boolean; // The only way a sub-agent holding no skills can travel.
  model?: "opus" | "fable" | "sonnet" | "haiku";
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  scope?: "project" | "global"; // Absent means "global" — the product default.
};

type SeedPayload = {
  v: 5;
  matrixVersion: string; // Diagnostics only — a mismatch must never fail a decode.
  stackId: string | null; // null when detection proposed skills rather than a stack.
  description?: string; // The sentence a configuration records about itself. Omit it.
  marketplace?: string; // Where the skills come from, in the form `--marketplace` takes.
  skills: Record<string, SeedSkill>; // Sparse — presence is selection.
  agents: Record<string, SeedAgent>; // Sparse — an agent with nothing to say has no entry.
  // `external?` also exists on the wire — whole skill directories carried inline for ids no
  // catalog resolves. Omitted here because a traversal maps to catalog ids and never mints one;
  // if you ever need it, take its shape from `seed.ts` rather than inventing one.
};
```

**Rules for filling it:**

- Ids are full catalog ids, never indices and never abbreviations.
- `stackId` names the built-in stack the user picked in intent mode, and is `null` in every other case — proposing skills from signals is the normal one, and a stack that merely resembles the findings is not a match. It travels as a label: nothing downstream expands it, so every skill a picked stack names must also appear in `skills` or it does not arrive.
- `install` and `scope` are **not detection findings**. Emit `"plugin"` and `"global"` consistently — the product's own defaults — and list them in the report as defaults the user can flip.
- **`scope` is `"global"`, and emitting `"project"` here composes a payload the store refuses.** An `agents` entry is optional and an absent one rests on the same default, `"global"`. A project-scoped skill assigned to a sub-agent resting at global has nowhere to be written — the skill would go under one project's `.claude` while the sub-agent's front matter goes to `~/.claude`, where it names something that does not exist from anywhere else. Since the rule below keeps `agents` sparse, emitting `"project"` makes EVERY assignment unwritable and `share --stdin` refuses the whole payload. If a run genuinely wants project-scoped installs, it must also pin every assigned sub-agent with `{ "scope": "project" }`, which is the one case worth spending an `agents` entry on.
- Load states are the preload mapping's answers, or `lazy` where it could not be read (Pattern 6) — never a per-agent allocation made here.
- `agents` entries are sparse. Include an entry only to say something — `on: true` for an agent that carries no skills of its own, or a model/effort/scope override the user asked for.
- Model and effort belong to the sub-agent, never to the skill.

#### The proposal report

| Section                  | Contents                                                                          |
| ------------------------ | --------------------------------------------------------------------------------- |
| What was detected        | Per workspace: signals found, and the strength of each                            |
| Candidates and the pick  | Intent mode: what was offered, the one line for each, and which the user picked   |
| What mapped              | Detected library → catalog skill id, with the agents it was assigned to           |
| Detected, not in catalog | Every ABSENT finding, with its evidence                                           |
| Intent not covered       | Intent mode: what the user asked for that no candidate stack carries              |
| Conflicts                | Exclusive-category disagreements, both candidates, unresolved                     |
| Warnings                 | Version mismatches, manifest-only findings, route-3 unknowns                      |
| Assumptions              | Defaults not derived from evidence (`install`, `scope`, catalog route)            |
| Load states              | Per agent: what the preload mapping answered, or that it could not be read at all |

#### Where it goes

Show the user the report. Then, if they want to act on it, hand the payload to the CLI:

```
cat <<'PAYLOAD' | agents-inc share --stdin
{ … the SeedPayload … }
PAYLOAD
```

It prints an id and both things anyone can do with it — `agents-inc init --from <id>` to install it, and an `agentsinc.sh/?fromId=<id>` link to open it in the editor and adjust it first. Nothing is written to this machine and no file is left behind.

**Publish through the CLI, never by POSTing yourself.** Four things live in the command and would drift out here: `SEED_VERSION` is a `z.literal`, so a hardcoded wire shape starts being refused the day it moves — which has already happened to this skill once; `AGENTS_INC_API_URL` exists so tests never touch the network, and a hardcoded address ignores it; the caller's user-agent is what separates an install from someone merely looking; and a POST made during traversal has published before the user has confirmed anything.

**The skill itself writes no configuration, runs no install command, and never reports a configuration as applied.** Offering the command above is not running it — the user does that, and the payload then loads exactly as if a shared link had arrived.

See [examples/core.md](examples/core.md#step-6-output-assembly) for a complete payload and report.

</patterns>

---

<decision_framework>

## Decision Framework

**Which way in is this?**

```
Is there a repository to read?
├─ YES → Traverse it. Signals settle the proposal (Pattern 1).
└─ NO  → Did the user name a stack, or libraries?
    ├─ YES → Their description is the evidence. Every finding is WEAK,
    │        and the report says the proposal came from description.
    └─ NO  → They named an outcome, not a stack. Offer candidate built-in
             stacks with one line each (Pattern 3), and wait for the pick.
             Nothing below this line runs before they answer.
```

**Does this signal earn a place in the payload?**

```
Is the library named in a workspace manifest?
├─ NO  → Not a finding. A lockfile-only entry is someone else's dependency.
└─ YES → Is it corroborated by a config file or a real import?
    ├─ NO  → WEAK. Propose only if the category is otherwise empty; say "manifest-only".
    └─ YES → Does the acquired catalog contain a skill for it?
        ├─ NO  → ABSENT. Report row, no payload entry. Never guess an id.
        └─ YES → Is it a frontend (framework OR meta-framework)?
            │    Resolve to the base first: a meta-framework implies its base
            │    (nextjs → react); a standalone one (astro) IS the frontend.
            ├─ YES, and another workspace resolves to a DIFFERENT frontend
            │      → Surface a conflict. Stop here — do NOT ask the category
            │        question. Different categories is not a union.
            └─ Otherwise → Does another workspace disagree in the same category?
                ├─ NO  → MAPPED. Add to the payload.
                └─ YES → Is the category exclusive?
                    ├─ NO  → Union both. Note it in the report.
                    └─ YES → Surface a conflict. Better-evidenced candidate in
                             the payload (or neither, if evidence is even);
                             both named in the report as unresolved.
```

**How does this assignment load?**

```
Can this run read the product's preload mapping?
├─ YES → Mark what it says for this (skill, sub-agent) pair. That is the answer.
└─ NO  → Mark `lazy` — the mapping's own word for a row it does not carry —
         and record in the report that loads were not resolved here.

Never: choose a load state by hand, count preloads per agent, or hold a budget.
       The mapping already spent that judgment, per skill and per role; a second
       one written here overrides it downstream instead of deferring to it.
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Inlining the catalog** — a list of ids written into reasoning is stale by the next marketplace commit, and stale ids are _skipped_ rather than rejected, so the proposal silently shrinks with no error to explain it.
- **Guessing at catalog ids instead of acquiring the catalog** — a plausible-looking id decodes to nothing. The user sees a proposal that appears complete and installs less than it claimed.
- **Silently resolving an exclusive-category conflict** — picking one framework because it had marginally more files hides a genuine architectural question behind a checkbox the user will not scrutinise.
- **Unioning a cross-category frontend disagreement** — a base framework and a meta-framework are filed in different categories, so the same-category test reports no conflict and two incompatible frontends land in one payload. The mechanical path passes; the proposal is wrong. Resolve every frontend to its base before comparing.
- **Recommending a stack from memory** — a remembered stack is a remembered name attached to remembered contents, and both drift with every release. The user picks between candidates whose skills you have actually read, or there is nothing to pick between.
- **Mapping before the user has picked** — a payload that arrives with the choice already made is a decision the user has to _notice_ in order to undo, and a proposal that looks confirmed is the one nobody re-reads.
- **Setting load states by hand** — a payload's load states travel as the user's own word, so an allocation invented here overrides the product's preload mapping downstream rather than being corrected by it. Two surfaces that agreed about how a skill loads stop agreeing, and nothing errors.
- **Emitting a payload that skips downstream validation** — hand-applying a proposal, writing config directly, or bypassing the schema removes the only guarantee the whole design rests on: that an invalid configuration cannot get through.
- **A silent version mismatch** — a skill teaching a different major with no warning is worse than no skill, because nothing signals to the user that the guidance may not apply.

**Medium Priority Issues:**

- Dropping ABSENT findings instead of reporting them — the user cannot distinguish "checked, no skill exists" from "never considered".
- Adding fields to the `SeedPayload` to carry warnings — the schema strips what it does not declare, so the warning vanishes in transit while the decode still succeeds.
- Proposing agents for a domain with no workspace behind it.
- Treating a directory layout or a script name as a primary signal.
- Reading a version from a manifest range instead of the lockfile.
- Dropping the part of the intent no candidate stack covers, rather than reporting it as a gap.
- Reading a library out of an outcome — "with billing" names a concern, not a payments package.

**Common Mistakes:**

- Counting a `@types/*` package as a second signal for the same library.
- Letting root tooling create a domain that no workspace justified.
- Filling a required category with a guess because leaving it empty felt incomplete.
- Emitting the payload without the report, or the report without the payload.
- Setting `stackId` to a suggested stack that merely resembles the findings.

**Gotchas & Edge Cases:**

- **Unknown ids are skipped, not rejected.** Consumers warn and continue. A proposal built on wrong ids never fails loudly — it just arrives smaller.
- **`matrixVersion` is diagnostics only.** A mismatch with the consumer's catalog must not fail the decode; it explains which ids were skipped. Never treat it as a gate.
- **The per-skill `metadata.yaml` route yields no category `exclusive` flags and no matrix version.** A proposal built on it knows less about exclusivity — say so rather than assuming non-exclusive.
- **Two frameworks in one workspace usually means a migration in flight,** not a conflict between workspaces. Report it as a migration and propose what the config file wires.
- **Absent means "absent from the catalog you acquired".** A different source may carry it. Phrase the report row accordingly.
- **A stack names ids from whatever version shipped it.** Verify each one against the acquired catalog like any other id; a skill retired since is ABSENT, not carried.
- **`stackId` is a label, not an instruction.** Nothing downstream expands it into skills, so a picked stack's skills must be enumerated in `skills` as well or they never arrive.
- **Run-to-run variance is expected and acceptable** — the output opens a conversation the user confirms. Do not add determinism the design deliberately declined. Load states are outside that variance: they are the mapping's answer, and two runs that read it disagree about nothing.

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All output must follow project conventions in CLAUDE.md**

**(You MUST acquire the catalog at run time and map only to ids it contains — never propose a skill id from memory, and never inline a copy of the catalog into your reasoning as if it were current)**

**(You MUST acquire the built-in stacks the same way when intent is all the user has given you, offer candidates with the reason each is one, and wait for the USER to pick before any mapping runs — recommending is still proposing, never deciding)**

**(You MUST emit the proposal as a `SeedPayload` and OFFER the command that publishes it — `agents-inc share --stdin` — for the user to run; never write config files, never run install commands, never POST the payload yourself, never report a configuration as applied)**

**(You MUST mark each assignment's load state as the product's preload mapping has it, and `lazy` where you cannot read the mapping — never allocate slots, count preloads, or hold a budget of your own)**

**(You MUST surface exclusive-category disagreement as an unresolved conflict naming both candidates and their evidence — never resolve one silently)**

**(You MUST report every detected library that has no catalog skill, every part of the intent no candidate stack covers, and every major-version mismatch, in the human-readable report — the `SeedPayload` stays schema-pure and carries none of them)**

**Failure to follow these rules produces a proposal that looks complete, installs less than it claimed, decides what was the user's to decide, and gives them no way to notice.**

</critical_reminders>
