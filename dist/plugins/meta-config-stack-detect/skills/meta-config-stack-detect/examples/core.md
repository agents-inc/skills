# Stack Detection - Core Examples

> One monorepo walked end to end, a section per pattern it exercises. The intent-only entry point is
> in [intent.md](intent.md); the payload's exact shape is in [reference.md](../reference.md).

**Navigation:** [Back to SKILL.md](../SKILL.md)

---

## The fixture

Three workspaces and shared root tooling. Everything below is derived from these files and nothing
else.

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

## Pattern 1: Detection Traversal

One pass per workspace plus one for the root: the manifest, a config file to corroborate it, then
the lockfile once for resolved majors.

```
Root
  package.json → workspaces: ["apps/*", "services/*"]   → monorepo, 3 workspaces
  turbo.json + turbo in devDependencies                 → STRONG
  tsconfig.json + typescript in devDependencies         → STRONG
  eslint.config.js + .prettierrc + both in devDeps      → STRONG
  @changesets/cli in devDependencies, no .changeset/    → manifest-only, WEAK

apps/web
  react + react-dom, vite.config.ts wires the React plugin   → STRONG
  @tanstack/react-router + 12 files under src/routes/        → STRONG
  @tanstack/react-query, imported in src/                    → STRONG
  tailwindcss, referenced from the Vite config               → STRONG (lockfile: 3.4.17)
  vitest.config.ts + vitest in devDependencies               → STRONG
  dayjs, imported in 3 files                                 → STRONG

apps/admin
  vue + @vitejs/plugin-vue, vite.config.ts wires it     → STRONG
  sass + a stylesheet imported per component            → STRONG
  no test config, no test files                         → nothing to record

services/api
  hono, imported by the worker entry                    → STRONG
  drizzle-orm + drizzle.config.ts                       → STRONG
  wrangler.toml + @cloudflare/workers-types             → STRONG
```

| Not read                                          | Why                                                     |
| ------------------------------------------------- | ------------------------------------------------------- |
| `node_modules/`                                   | Not evidence about this repository                      |
| `@types/react`, `@types/node`                     | Each mirrors a runtime dependency — one signal, not two |
| Framework packages appearing only in the lockfile | Transitive dependencies of tooling                      |
| `apps/web/src/**` beyond the route count          | Layout corroborates; it never originates a finding      |

Every question the proposal needs is answered, so the traversal stops.

---

## Pattern 2: Catalog Acquisition

A local repository, so no host supplied anything. A Glob for `.claude-plugin/catalog.json` finds the
marketplace's catalog, and route 2 answers:

```
Route used:          2 (catalog.json)
Ids and categories:  skills, categories
Exclusivity:         categories.<id>.exclusive
matrixVersion:       "1.0.0", the catalog's version
Sub-agent ids:       only the ones its stacks staff
Preload mapping:     not carried
```

The last two gaps both go in the report. The second decides every load state below.

---

## Pattern 3: Mapping Judgment

Each STRONG finding matched against the acquired catalog — slug, then id, then category plus display
name.

| Detected               | Workspace            | Catalog skill id                    | Outcome      |
| ---------------------- | -------------------- | ----------------------------------- | ------------ |
| react                  | apps/web             | `web-framework-react`               | MAPPED       |
| @tanstack/react-router | apps/web             | `web-routing-tanstack-router`       | MAPPED       |
| @tanstack/react-query  | apps/web             | `web-server-state-react-query`      | MAPPED       |
| tailwindcss            | apps/web             | `web-styling-tailwind`              | MAPPED       |
| vite                   | apps/web, apps/admin | `web-tooling-vite`                  | MAPPED       |
| vitest                 | apps/web             | `web-testing-vitest`                | MAPPED       |
| dayjs                  | apps/web             | —                                   | ABSENT       |
| vue                    | apps/admin           | `web-framework-vue-composition-api` | MAPPED       |
| sass                   | apps/admin           | `web-styling-scss-modules`          | MAPPED       |
| hono                   | services/api         | `api-framework-hono`                | MAPPED       |
| drizzle-orm            | services/api         | `api-database-drizzle`              | MAPPED       |
| wrangler / workers     | services/api         | `infra-platform-cloudflare-workers` | MAPPED       |
| turbo                  | root                 | `shared-monorepo-turborepo`         | MAPPED       |
| typescript             | root                 | `shared-tooling-typescript-config`  | MAPPED       |
| eslint + prettier      | root                 | `shared-tooling-eslint-prettier`    | MAPPED       |
| @changesets/cli (WEAK) | root                 | `shared-tooling-changesets`         | Not proposed |

**dayjs is ABSENT.** No skill carries that slug in any category. The tempting move is
`web-utilities-dayjs`, which looks like the ids around it, but the catalog does not hold it, and a
consumer skips an unknown id rather than rejecting it — the proposal would arrive one skill smaller
with no error to explain it. The gap goes in the report.

**@changesets/cli is WEAK.** It is declared at the root with no `.changeset/` directory and no
release script using it. Its category, `shared-tooling`, already carries `typescript-config`, so it
stays out of the payload and goes in the report as manifest-only. Had the category been empty, it
would have been proposed with the same note.

---

## Pattern 4: Workspace to Sub-Agent Mapping

| Workspace    | Shape                                   | Domain   | Sub-agents informed                       |
| ------------ | --------------------------------------- | -------- | ----------------------------------------- |
| apps/web     | Browser application, UI framework wired | `web`    | `web-developer`, `web-tester`, `reviewer` |
| apps/admin   | Browser application, UI framework wired | `web`    | the same three                            |
| services/api | Worker with an HTTP framework           | `api`    | `api-developer`, `reviewer`               |
| root         | Task runner, type config, lint/format   | `shared` | the agents above, and no new ones         |

**Four sub-agents.** `reviewer` carries no domain prefix, so the web and api workspaces inform the
same one id.

**`api-tester` is left off,** and not for lack of evidence about the worker: no stack in this
catalog staffs it, so route 2's roster does not name it, and an id the run did not acquire is an id
it does not write. The report says so, and the user adds it in the confirmation surface if they have
it.

**The `cli-*` agents are left off** because no workspace declares a `bin` entry. `wrangler.toml` maps
to a skill, `infra-platform-cloudflare-workers`, which rides `api-developer` — the roster carries no
infrastructure agent for it to justify. Mapping a skill and justifying an agent are separate
questions.

---

## Pattern 5: Load State Comes From the Preload Mapping

Route 2 carries no preload mapping, so every (sub-agent, skill) pair is marked `lazy` and the report
records that as an assumption. Nothing is allocated here.

Had a host supplied the mapping, each pair would carry its answer instead — the same skill preloaded
on one agent and lazy on another. [intent.md](intent.md) shows that run.

---

## Pattern 6: Conflict Surfacing

```
web-framework  (exclusive)
  apps/web    → react, react-dom; vite.config.ts wires the React plugin;
                12 route files, a router, server state
  apps/admin  → vue + @vitejs/plugin-vue; 4 single-file components

Resolution:  UNRESOLVED CONFLICT, surfaced
Payload:     web-framework-react — better evidenced, and named as awaiting the user
```

Had the evidence been even, the payload would carry neither and leave `web-framework` empty — an
empty category is visible in the confirmation surface, and a coin flip is not.

```
web-styling  (not exclusive)
  apps/web    → tailwindcss
  apps/admin  → sass

Resolution:  union — both in the payload, one report line on the split
```

The same shape of disagreement handled the opposite way: the category's exclusivity is the whole
difference, and route 2 is what supplied it.

---

## Pattern 7: Version Awareness

```
tailwindcss
  Lockfile resolves:  3.4.17                → major 3
  Catalog skill:      web-styling-tailwind, which teaches v4

Result:  proposed; warning in the report; payload unchanged
```

The manifest's `^3.4` would not have settled this, and the lockfile did.

---

## Pattern 8: Output Assembly

### The payload (abridged)

```json
{
  "v": 6,
  "matrixVersion": "1.0.0",
  "stackId": null,
  "skills": {
    "web-framework-react": {
      "install": "plugin",
      "scope": "global",
      "assignments": {
        "web-developer": "lazy",
        "web-tester": "lazy",
        "reviewer": "lazy"
      }
    },
    "web-styling-tailwind": {
      "install": "plugin",
      "scope": "global",
      "assignments": { "web-developer": "lazy", "reviewer": "lazy" }
    },
    "infra-platform-cloudflare-workers": {
      "install": "plugin",
      "scope": "global",
      "assignments": { "api-developer": "lazy" }
    },
    "shared-tooling-typescript-config": {
      "install": "plugin",
      "scope": "global",
      "assignments": { "web-developer": "lazy", "api-developer": "lazy" }
    }
  },
  "agents": {}
}
```

Four of the thirteen; the rest take the same shape, with the assignments the report lists.

- **`agents` is empty** because every sub-agent here is implied by its assignments. Detection derives
  no `on: true`, model, effort or scope override, so it writes none.
- **`stackId` is `null`** because detection proposed skills; a stack resembling the findings is not
  a pick.
- **`marketplace` is absent** because the catalog was the default public one.
- **`web-framework-vue-composition-api` is not in `skills`** even though it was MAPPED: it lost an
  exclusive-category conflict the report leaves open, and it is one click away in the surface.

### The report (abridged)

```markdown
## Configuration proposal — acme (3 workspaces)

Built from: repository traversal
Catalog route: 2 (catalog.json)

### Mapped — 13 skills across 4 sub-agents

| Skill                             | Assigned to                         |
| --------------------------------- | ----------------------------------- |
| web-framework-react               | web-developer, web-tester, reviewer |
| web-routing-tanstack-router       | web-developer                       |
| web-server-state-react-query      | web-developer                       |
| web-styling-tailwind              | web-developer, reviewer             |
| web-styling-scss-modules          | web-developer, reviewer             |
| web-tooling-vite                  | web-developer                       |
| web-testing-vitest                | web-developer, web-tester           |
| api-framework-hono                | api-developer, reviewer             |
| api-database-drizzle              | api-developer, reviewer             |
| infra-platform-cloudflare-workers | api-developer                       |
| shared-monorepo-turborepo         | web-developer, api-developer        |
| shared-tooling-typescript-config  | web-developer, api-developer        |
| shared-tooling-eslint-prettier    | web-developer, api-developer        |

### Detected, not in catalog

| Library | Evidence                                   | Note                                         |
| ------- | ------------------------------------------ | -------------------------------------------- |
| dayjs   | apps/web dependencies, imported in 3 files | No skill for it in the catalog acquired here |

### Conflicts — 1, unresolved, needs your decision

| Candidate                          | Workspace  | Evidence                                              |
| ---------------------------------- | ---------- | ----------------------------------------------------- |
| web-framework-react _(in payload)_ | apps/web   | Vite plugin wired, 12 routes, router and server state |
| web-framework-vue-composition-api  | apps/admin | Vite plugin wired, 4 components                       |

React is in the payload because it is better evidenced. **This is not a decision** — both
workspaces are real, and a sub-agent holds one framework. Swap it, or split the work, before
confirming.

### Warnings

| Item                | Detail                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| tailwindcss version | The repository resolves v3 (3.4.17); the skill teaches v4. Proposed anyway.                        |
| @changesets/cli     | Manifest-only: declared at the root with no `.changeset/` directory. Not proposed.                 |
| Styling split       | apps/web uses Tailwind and apps/admin uses Sass; styling is not exclusive.                         |
| api-tester          | No catalog stack staffs it, so it was not proposed for services/api. Add it if your roster has it. |

### Assumptions — not findings; flip any of them

| Field         | Value    | Why                                                    |
| ------------- | -------- | ------------------------------------------------------ |
| install       | `plugin` | The product default; detection says nothing about it   |
| scope         | `global` | The product default; detection says nothing about it   |
| matrixVersion | `1.0.0`  | The catalog's own version                              |
| stackId       | `null`   | Skills were proposed individually; no stack was picked |
| load states   | `lazy`   | The preload mapping was not readable from this run     |

### Next

Nothing has been written. Publish it with `cat proposal.json | npx agents-inc share --stdin`, then
install it with `npx agents-inc init --from <id>` — or open the editor link it prints to resolve the
framework conflict first.
```

---

## What a second run might do differently

The same repository, run again, might also assign `web-tooling-vite` to `web-tester`, or leave
`@changesets/cli` out of the warnings. Both are defensible readings of the same evidence, and that
variance is not a defect. What must hold on every run is the payload's shape and the conflict's
visibility — a run that quietly picked a framework, or wrote an id the catalog does not hold, is
broken in a way a different assignment set is not.
