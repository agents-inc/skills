# Stack Detection - Core Examples

> One monorepo walked end to end: traversal, catalog acquisition, mapping, sub-agent assignment, an exclusive-category near-miss surfaced as a conflict, and the two artifacts that come out. Then the other way in, with no repository and no library named: intent, candidates, the user's pick, and the gap the pick leaves. See [SKILL.md](../SKILL.md) for the rules being applied.

**Navigation:** [Back to SKILL.md](../SKILL.md)

---

## The fixture

A three-workspace monorepo with shared root tooling. Everything below is derived from these files and nothing else.

```
acme/
├── package.json              workspaces: ["apps/*", "services/*"]; devDeps: turbo,
│                             typescript, eslint, prettier, @changesets/cli
├── turbo.json
├── pnpm-lock.yaml
├── tsconfig.json
├── eslint.config.js
├── .prettierrc
├── apps/
│   ├── web/
│   │   ├── package.json      react, react-dom, @tanstack/react-router,
│   │   │                     @tanstack/react-query, tailwindcss ^3.4, dayjs
│   │   ├── vite.config.ts
│   │   ├── vitest.config.ts
│   │   └── src/routes/       (12 route files)
│   └── admin/
│       ├── package.json      vue, @vitejs/plugin-vue, sass
│       ├── vite.config.ts
│       └── src/              (4 single-file components, 1 stylesheet)
└── services/
    └── api/
        ├── package.json      hono, drizzle-orm, @cloudflare/workers-types
        ├── wrangler.toml
        └── drizzle.config.ts
```

---

## Step 1: Traversal

One pass per workspace, plus one for the root. Read the manifest, confirm against a config file, then read the lockfile once for resolved majors.

```
Root
  package.json → workspaces: ["apps/*", "services/*"]   → monorepo, 3 workspaces
  turbo.json present + `turbo` in devDependencies       → orchestrator, STRONG
  tsconfig.json + typescript in devDependencies         → STRONG
  eslint.config.js + .prettierrc + both in devDeps      → STRONG
  @changesets/cli in devDependencies, no .changeset/    → manifest-only, WEAK

apps/web
  react + react-dom, vite.config.ts wires the React plugin   → STRONG
  @tanstack/react-router + 12 files under src/routes/        → STRONG
  @tanstack/react-query, used in src/                        → STRONG
  tailwindcss, referenced from the Vite config               → STRONG (lockfile: 3.4.17)
  vitest.config.ts + vitest in devDependencies               → STRONG
  dayjs, imported in 3 files                                 → STRONG

apps/admin
  vue + @vitejs/plugin-vue, vite.config.ts wires it     → STRONG
  sass + one stylesheet imported per component          → STRONG
  no test config, no test files                         → nothing to record

services/api
  hono, imported by the worker entry                    → STRONG
  drizzle-orm + drizzle.config.ts                       → STRONG
  wrangler.toml + @cloudflare/workers-types             → STRONG
```

### What was deliberately not read

| Skipped                                           | Why                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| Everything under `node_modules/`                  | Not evidence about this repository                                       |
| `@types/react`, `@types/node`                     | They mirror a runtime dependency; counting them double-counts one signal |
| Framework packages appearing only in the lockfile | Transitive dependencies of tooling, not choices this repo made           |
| `apps/web/src/**` beyond the route count          | Directory layout corroborates; it never originates a finding             |

**Why this stops here:** every question the proposal needs answered is answered. Reading further adds confidence to findings that were already STRONG.

---

## Step 2: Catalog Acquisition

Local repository, so route 1 is unavailable. Try route 2, verify before using it.

```
$ agents-inc search --help
...
USAGE
  $ agents-inc search QUERY

ARGUMENTS
  QUERY  Search query (matches id, displayName, slug, description, category)
```

No JSON flag listed, so route 2 is unavailable in this installation. Fall through to route 3: read `metadata.yaml` from each skill directory in the fetched source cache.

```
Route used:            3 (per-skill metadata.yaml)
Ids and categories:    available
exclusive/required:    NOT available from this route
Matrix version:        NOT available from this route
```

Both gaps go in the report rather than being papered over. Category exclusivity is then taken from the product model's own documented rule — one selection per exclusive category per sub-agent — and the report says which categories were treated as exclusive so the user can correct a wrong call.

---

## Step 3: Mapping Judgment

Each STRONG finding is matched against the acquired catalog: slug first, then id, then category plus display name.

| Detected               | Workspace            | Catalog skill id                    | Outcome                  |
| ---------------------- | -------------------- | ----------------------------------- | ------------------------ |
| react                  | apps/web             | `web-framework-react`               | MAPPED                   |
| @tanstack/react-router | apps/web             | `web-routing-tanstack-router`       | MAPPED                   |
| @tanstack/react-query  | apps/web             | `web-server-state-react-query`      | MAPPED                   |
| tailwindcss            | apps/web             | `web-styling-tailwind`              | MAPPED                   |
| vite                   | apps/web, apps/admin | `web-tooling-vite`                  | MAPPED                   |
| vitest                 | apps/web             | `web-testing-vitest`                | MAPPED                   |
| dayjs                  | apps/web             | —                                   | ABSENT                   |
| vue                    | apps/admin           | `web-framework-vue-composition-api` | MAPPED                   |
| sass                   | apps/admin           | `web-styling-scss-modules`          | MAPPED                   |
| hono                   | services/api         | `api-framework-hono`                | MAPPED                   |
| drizzle-orm            | services/api         | `api-database-drizzle`              | MAPPED                   |
| wrangler / workers     | services/api         | `infra-platform-cloudflare-workers` | MAPPED                   |
| turbo                  | root                 | `shared-monorepo-turborepo`         | MAPPED                   |
| typescript             | root                 | `shared-tooling-typescript-config`  | MAPPED                   |
| eslint + prettier      | root                 | `shared-tooling-eslint-prettier`    | MAPPED                   |
| @changesets/cli (WEAK) | root                 | `shared-tooling-changesets`         | Not proposed — see below |

### The ABSENT finding

```
dayjs
  Evidence:  apps/web/package.json dependencies, imported in 3 files
  Catalog:   no skill with slug "dayjs" in any category
  Result:    ABSENT → report row, no payload entry
```

The temptation is to write `web-utilities-dayjs` because it looks like the ids around it. That id is not in the acquired catalog, and consumers _skip_ unknown ids rather than rejecting them — the proposal would arrive one skill smaller with no error anywhere to explain it. Report the gap instead.

### The WEAK finding

`@changesets/cli` is declared at the root but there is no `.changeset/` directory and no release script referencing it. Its category (`shared-tooling`) already carries two proposed skills, so the rule leaves it out of the payload and records it in the report as manifest-only. Had `shared-tooling` been empty, it would have been proposed with the same note.

---

## Step 4: Workspace to Sub-Agent Mapping

| Workspace    | Shape                                   | Domain   | Sub-agents informed                       |
| ------------ | --------------------------------------- | -------- | ----------------------------------------- |
| apps/web     | Browser application, UI framework wired | `web`    | `web-developer`, `web-tester`, `reviewer` |
| apps/admin   | Browser application, UI framework wired | `web`    | same three                                |
| services/api | Worker with an HTTP framework           | `api`    | `api-developer`, `api-tester`, `reviewer` |
| root         | Orchestrator, type config, lint/format  | `shared` | The five agents above                     |

**Five, not six.** `reviewer` is one agent, not one per domain: both the `web` and the `api` workspaces inform the same id, so it is counted once. That is a fact about the roster rather than a judgment made here — read the agents the run acquired and assign the ids they actually have, exactly as Pattern 2 says to do with skill ids.

**Considered and left off:** the `cli-*` agents. No workspace declares a `bin` entry, so nothing here is a terminal package, and an agent with no workspace behind it is noise the user has to clear. The deploy target is not a counter-example: `services/api`'s `wrangler.toml` maps to a skill (`infra-platform-cloudflare-workers`) that rides `api-developer`, because the roster carries no infrastructure agent for it to justify. A skill mapping and an agent being justified are separate questions, and only the second one is asked here.

**Root tooling created no domain.** `turbo`, `typescript` and `eslint`/`prettier` decorate the five agents that `apps/*` and `services/*` justified. Had this repository contained root tooling and nothing else, the proposal would have been empty — and would have said so.

---

## Step 5: Conflicts, Versions, and Load States

### The exclusive-category near-miss

Two workspaces, two UI frameworks, one exclusive category:

```
web-framework  (exclusive: one selection per sub-agent)
  apps/web    → react, react-dom + vite.config.ts wires the React plugin
                12 route files, react-query, react-router
  apps/admin  → vue + @vitejs/plugin-vue, 4 single-file components
```

Both are STRONG. `web-framework` is exclusive, so one `web-developer` cannot hold both — and that constraint is not permission to pick quietly.

```
Resolution:  UNRESOLVED CONFLICT, surfaced.
Payload:     web-framework-react   (better evidenced: 12 routes + router + server state
                                    vs 4 components)
Report:      Both candidates named, both evidence sets given, stated explicitly as
             awaiting the user rather than decided.
```

Had the two been evenly evidenced, the payload would carry **neither** and leave `web-framework` empty. An empty required category is visible in the confirmation surface; a coin flip is not.

### The union, for contrast

```
web-styling  (NOT exclusive)
  apps/web    → tailwindcss
  apps/admin  → sass

Resolution:  union. Both go in the payload. One report line noting the split.
```

Same shape of disagreement, opposite handling — the category's exclusivity is the whole difference.

### Version awareness

```
tailwindcss
  Lockfile resolves:  3.4.17          → major 3
  Catalog skill:      web-styling-tailwind, "Utility-first CSS framework v4"

Result:  still proposed. Warning in the report. Payload unchanged.
```

The manifest range `^3.4` would not have settled this; the lockfile did. Note that the payload gains no `warnings` field for it — the schema strips what it does not declare, so a bolted-on warning would vanish in transit while the decode still succeeded, handing the user the skill and none of the caveat.

### Load states

Nothing is allocated here. "Does this arrive preloaded?" is the product's preload mapping's question, and this run cannot reach it: the installation whose `search --help` listed no JSON flag offers no command that reads the table either.

| The question           | This run's answer                                               |
| ---------------------- | --------------------------------------------------------------- |
| The preload mapping    | Not readable from here                                          |
| What the payload marks | `lazy`, on every (sub-agent, skill) pair                        |
| Where that is recorded | The report's assumptions — as an assumption, never as a finding |

`lazy` is not a guess wearing a default's clothes: it is what the mapping itself answers for a pair it does not carry, and it is the only direction that cannot spend context the user never agreed to. Every one of them is one click from preloaded in the confirmation surface.

Had this been a hosted run with the mapping supplied alongside the catalog, each pair would carry the mapping's own answer instead — per (sub-agent, skill), so the same skill can arrive preloaded on one agent and lazy on another. What would not change is that no line of this walkthrough decides it.

---

## Step 6: Output Assembly

### Artifact 1 — the `SeedPayload`

```json
{
  "v": 3,
  "matrixVersion": "1.0.0",
  "stackId": null,
  "skills": {
    "web-framework-react": {
      "install": "plugin",
      "scope": "project",
      "assignments": {
        "web-developer": "lazy",
        "web-tester": "lazy",
        "reviewer": "lazy"
      }
    },
    "web-routing-tanstack-router": {
      "install": "plugin",
      "scope": "project",
      "assignments": { "web-developer": "lazy" }
    },
    "web-server-state-react-query": {
      "install": "plugin",
      "scope": "project",
      "assignments": { "web-developer": "lazy" }
    },
    "web-styling-tailwind": {
      "install": "plugin",
      "scope": "project",
      "assignments": { "web-developer": "lazy", "reviewer": "lazy" }
    },
    "web-styling-scss-modules": {
      "install": "plugin",
      "scope": "project",
      "assignments": { "web-developer": "lazy", "reviewer": "lazy" }
    },
    "web-tooling-vite": {
      "install": "plugin",
      "scope": "project",
      "assignments": { "web-developer": "lazy" }
    },
    "web-testing-vitest": {
      "install": "plugin",
      "scope": "project",
      "assignments": {
        "web-developer": "lazy",
        "web-tester": "lazy",
        "api-tester": "lazy"
      }
    },
    "api-framework-hono": {
      "install": "plugin",
      "scope": "project",
      "assignments": {
        "api-developer": "lazy",
        "api-tester": "lazy",
        "reviewer": "lazy"
      }
    },
    "api-database-drizzle": {
      "install": "plugin",
      "scope": "project",
      "assignments": { "api-developer": "lazy", "reviewer": "lazy" }
    },
    "infra-platform-cloudflare-workers": {
      "install": "plugin",
      "scope": "project",
      "assignments": { "api-developer": "lazy" }
    },
    "shared-monorepo-turborepo": {
      "install": "plugin",
      "scope": "project",
      "assignments": { "web-developer": "lazy", "api-developer": "lazy" }
    },
    "shared-tooling-typescript-config": {
      "install": "plugin",
      "scope": "project",
      "assignments": { "web-developer": "lazy", "api-developer": "lazy" }
    },
    "shared-tooling-eslint-prettier": {
      "install": "plugin",
      "scope": "project",
      "assignments": { "web-developer": "lazy", "api-developer": "lazy" }
    }
  },
  "agents": {}
}
```

**Why `agents` is empty:** the map is sparse, and every one of the five agents in this proposal is already implied by its assignments. An entry appears only to say something the assignments cannot — `on: true` for a bare agent carrying no skills, or a model / effort / scope override. Detection derives none of those, so it writes none.

**Why `stackId` is `null`:** detection proposed skills, which is the normal case. A suggested stack id belongs here only when the findings genuinely matched one, never because a stack resembled them.

**Why `web-framework-vue-composition-api` is absent from the payload** even though it was MAPPED: it lost an exclusive-category conflict that the report leaves open. It is one click away in the confirmation surface, which is where an unresolved question belongs.

### Artifact 2 — the proposal report

```markdown
## Configuration proposal — acme (3 workspaces)

Built from: repository traversal
Catalog route: 3 (per-skill metadata.yaml from the fetched source cache)

### Detected

| Workspace    | Findings                                                                               |
| ------------ | -------------------------------------------------------------------------------------- |
| apps/web     | react, @tanstack/react-router, @tanstack/react-query, tailwindcss, vite, vitest, dayjs |
| apps/admin   | vue, sass, vite                                                                        |
| services/api | hono, drizzle-orm, cloudflare workers (wrangler.toml)                                  |
| root         | turbo, typescript, eslint + prettier, @changesets/cli (manifest-only)                  |

### Mapped — 13 skills across 5 sub-agents

| Skill                             | Assigned to                           |
| --------------------------------- | ------------------------------------- |
| web-framework-react               | web-developer, web-tester, reviewer   |
| web-routing-tanstack-router       | web-developer                         |
| web-server-state-react-query      | web-developer                         |
| web-styling-tailwind              | web-developer, reviewer               |
| web-styling-scss-modules          | web-developer, reviewer               |
| web-tooling-vite                  | web-developer                         |
| web-testing-vitest                | web-developer, web-tester, api-tester |
| api-framework-hono                | api-developer, api-tester, reviewer   |
| api-database-drizzle              | api-developer, reviewer               |
| infra-platform-cloudflare-workers | api-developer                         |
| shared-monorepo-turborepo         | web-developer, api-developer          |
| shared-tooling-typescript-config  | web-developer, api-developer          |
| shared-tooling-eslint-prettier    | web-developer, api-developer          |

### Detected, not in catalog

| Library | Evidence                                   | Note                                         |
| ------- | ------------------------------------------ | -------------------------------------------- |
| dayjs   | apps/web dependencies, imported in 3 files | No skill for it in the catalog acquired here |

### Conflicts — 1, UNRESOLVED, needs your decision

**Framework (exclusive — one selection per sub-agent)**

| Candidate                          | Workspace  | Evidence                                                               |
| ---------------------------------- | ---------- | ---------------------------------------------------------------------- |
| web-framework-react _(in payload)_ | apps/web   | react + react-dom, Vite plugin wired, 12 routes, router + server state |
| web-framework-vue-composition-api  | apps/admin | vue + @vitejs/plugin-vue, Vite plugin wired, 4 components              |

React carries in the payload because it is better evidenced. **This is not a decision** —
both workspaces are real and the product model holds one framework per sub-agent. Swap it,
or split the work, before confirming.

### Warnings

| Item                     | Detail                                                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tailwindcss version      | Repository resolves to v3 (3.4.17); the skill teaches v4. Proposed anyway — configuration model and utility syntax differ.                                                                                                                  |
| @changesets/cli          | Manifest-only: declared at the root with no `.changeset/` directory. Not proposed.                                                                                                                                                          |
| Styling split            | apps/web uses Tailwind, apps/admin uses Sass. Styling is not exclusive, so both are proposed.                                                                                                                                               |
| Catalog route limitation | Route 3 supplies no category `exclusive` flags and no matrix version. Exclusivity below was taken from the product model, not from the catalog: web-framework, web-routing, web-server-state, api-framework, api-database, shared-monorepo. |

### Assumptions (not findings — flip any of them)

| Field         | Value     | Why                                                                                        |
| ------------- | --------- | ------------------------------------------------------------------------------------------ |
| install       | `plugin`  | Default install mode; detection says nothing about it                                      |
| scope         | `project` | Default scope; detection says nothing about it                                             |
| matrixVersion | `1.0.0`   | Derived from the marketplace checkout's `package.json` version, not from a catalog command |
| stackId       | `null`    | Skills were proposed individually; the user picked no stack                                |
| load states   | `lazy`    | The product's preload mapping was not readable from this run — see below                   |

### Load states

Every assignment travels `lazy`. That is not a recommendation to keep them lazy: the
preload mapping owns the question and no route here could read it, so the payload carries
the answer the mapping gives for a row it does not hold. Preload what you reach for every
session — the surface lists each one per sub-agent.

### Next

Nothing has been written. Load this proposal into the wizard or the editor, resolve the
framework conflict, and confirm.
```

---

## What a second run might do differently

The same repository, run again, might assign `web-tooling-vite` to `web-tester` as well, or leave `@changesets/cli` out of the report's warnings because its category filled up differently. Both are defensible readings of the same evidence.

This variance is expected and is not a defect to engineer away. The output opens a conversation the user confirms; it never writes configuration unattended. What must be stable is the payload's _shape_ and the conflict's _visibility_ — a run that quietly picked a framework, or emitted an id the catalog does not contain, is broken in a way that a slightly different assignment set is not. Load states are outside the variance entirely: they are the preload mapping's to answer, so two runs that reach it agree, and two that cannot both mark `lazy`.

---

## A second entry: intent, with nothing to traverse

Same skill, same two artifacts, opposite starting point. Nobody has a repository and nobody has named a library.

### The ask

> "I want to build a SaaS — people sign in, they pay a monthly subscription, there's a live activity feed, and it has to work in English and German."

Traversal has nothing to do here, and neither does mapping: there is no signal in that sentence to map. Pattern 3 runs instead.

### What the intent actually says

| Read for     | From the ask                                                 | What it settles                                 |
| ------------ | ------------------------------------------------------------ | ----------------------------------------------- |
| **Surfaces** | "a SaaS" — a browser app with a service behind it            | `web` and `api`. Nothing said about a CLI.      |
| **Concerns** | sign-in, monthly subscription, live feed, English and German | auth, payments, real-time, internationalisation |

And nothing else. "SaaS" is not a framework, "pay a monthly subscription" is not a payments package, and reading either one as a library would be invention with a finding's face on.

### Stack acquisition

Same routes as the catalog, same order, same verification. This is a hosted conversation, so route 1 answers and the rest are never tried.

```
Route used:  1 (host-supplied — catalog and built-in stacks together)
Stacks:      each with its name, description, philosophy, and the skill ids it names
Mapping:     the product's preload mapping came with them
```

### The candidates

Matched against what each stack declares about itself and the categories its skills fill — never against an impression of what "the Next.js one" contains. Three came close enough to be worth the user's attention:

| #   | Stack                 | Why it is a candidate                                                      |
| --- | --------------------- | -------------------------------------------------------------------------- |
| 1   | `nextjs-saas-starter` | The only candidate naming skills for both sign-in and payments             |
| 2   | `nextjs-fullstack`    | Same frontend and database, brings auth, names nothing for payments        |
| 3   | `nextjs-t3-stack`     | End-to-end type safety with auth included; payments would be added by hand |

What was said, and then nothing else:

```
Three of the built-in stacks come close to what you described. Which is nearest?

  1. nextjs-saas-starter — the only one naming both sign-in and payments
  2. nextjs-fullstack    — same frontend, brings auth, nothing for payments
  3. nextjs-t3-stack     — end-to-end types with auth; payments by hand

None of the three carries the live feed or the translations — that gap is the
same whichever you pick. Nothing is proposed until you answer.
```

The user picks 1. Everything below happened after that, and none of it before.

### After the pick

```
nextjs-saas-starter names 25 skills across 11 sub-agents.
  Ids verified against the acquired catalog:  25/25 present, none retired
  Sub-agent assignment: the stack's own — there are no workspaces here to derive one from
  Load states: route 1 supplied the mapping, so every pair carries its answer
  Conflicts: none. Nothing the user named disagrees with what the stack carries.
```

Two things the pick carries that the intent never asked for: `cli-framework-oclif-ink`, and the `cli-developer` and `cli-tester` sub-agents that hold it. They stay. Trimming a stack to fit the sentence makes the user's pick mean something they did not agree to — so the payload carries the stack as it ships and the report names the surplus, which is one untick in the surface rather than a decision made here.

### Artifact 1 — the `SeedPayload` (abridged)

```json
{
  "v": 3,
  "matrixVersion": "1.0.0",
  "stackId": "nextjs-saas-starter",
  "skills": {
    "web-framework-react": {
      "install": "plugin",
      "scope": "project",
      "assignments": {
        "web-developer": "preloaded",
        "web-pm": "preloaded",
        "reviewer": "preloaded"
      }
    },
    "web-meta-framework-nextjs": {
      "install": "plugin",
      "scope": "project",
      "assignments": { "web-developer": "preloaded", "reviewer": "preloaded" }
    },
    "api-auth-better-auth-drizzle-hono": {
      "install": "plugin",
      "scope": "project",
      "assignments": {
        "api-developer": "preloaded",
        "api-researcher": "preloaded"
      }
    },
    "api-commerce-stripe": {
      "install": "plugin",
      "scope": "project",
      "assignments": { "api-developer": "lazy", "reviewer": "lazy" }
    },
    "web-testing-playwright-e2e": {
      "install": "plugin",
      "scope": "project",
      "assignments": { "web-tester": "preloaded" }
    },
    "infra-ci-cd-github-actions": {
      "install": "plugin",
      "scope": "project",
      "assignments": { "api-developer": "lazy" }
    }
  },
  "agents": { "cli-tester": { "on": true } }
}
```

Six of the twenty-five, in the shape all of them take. `stackId` names the pick, but it is a label and nothing downstream expands it — the other nineteen skills have to be in `skills` or they never arrive.

**Why `agents` is not empty this time.** The stack names `cli-tester` and gives it no skills. Assignments cannot carry a sub-agent that holds nothing, so `on: true` is the only way it travels — the one thing that map exists to say. Every other sub-agent in the pick is already implied by its assignments and writes no entry.

**Note `api-commerce-stripe`.** Payments are half the reason this stack was picked, and it is still `lazy`, because the mapping carries no eager row for it: a payments integration is reached for in some sessions, not most of them. "It is important here, so preload it" is exactly the second opinion that would override the product rather than defer to it — and the payload would carry it as the user's own word, with nothing anywhere to flag the disagreement.

### Artifact 2 — the proposal report (abridged)

```markdown
## Configuration proposal — from intent, no repository

Built from: a description of what you want to build
Catalog route: 1 (host-supplied, with the built-in stacks and the preload mapping)

### Candidates and your pick

| Stack                             | Why it was a candidate                           |
| --------------------------------- | ------------------------------------------------ |
| nextjs-saas-starter _(you chose)_ | The only one naming both sign-in and payments    |
| nextjs-fullstack                  | Same frontend, brings auth, nothing for payments |
| nextjs-t3-stack                   | End-to-end types with auth; payments by hand     |

### What the pick carries — 25 skills across 11 sub-agents

Applied as the stack ships it. Nothing was added, removed, or swapped.

### Your intent, not covered — needs a decision

| You asked for        | Category  | Status                                                                                                           |
| -------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| A live activity feed | real-time | No built-in stack carries a real-time skill. The catalog has options in that category — pick one in the surface. |
| English and German   | i18n      | Same: no built-in stack carries one, and the catalog does.                                                       |

Neither is proposed here. Choosing between the options is yours, exactly as the
choice between the three stacks was.

### Carried beyond what you described

| Item                                               | Why it is here                                           |
| -------------------------------------------------- | -------------------------------------------------------- |
| cli-framework-oclif-ink, cli-developer, cli-tester | The stack ships them. Untick if you are building no CLI. |

### Assumptions (not findings — flip any of them)

| Field       | Value                 | Why                                                |
| ----------- | --------------------- | -------------------------------------------------- |
| install     | `plugin`              | Default install mode; the description says nothing |
| scope       | `project`             | Default scope; the description says nothing        |
| stackId     | `nextjs-saas-starter` | The stack you picked                               |
| load states | per the mapping       | Route 1 supplied it; no load state was chosen here |

### Next

Nothing has been written. Load this into the wizard or the editor, add a real-time
and an i18n skill if you still want them, and confirm.
```

### What made this a proposal rather than a decision

One thing only: the user answered before any of it existed. The same run with the candidate list skipped produces the same twenty-five skills, the same load states and the same two gaps — and every one of them arrives as something to undo rather than something to choose.
