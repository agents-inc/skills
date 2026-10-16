# Stack Detection - Intent Examples

> The intent-only entry point, walked end to end: no repository, no library named. Candidates, the
> user's pick, and the gap the pick leaves. See [core.md](core.md) for the repository run and
> [reference.md](../reference.md) for the payload's exact shape.

**Prerequisites**: Pattern 2 (Catalog Acquisition) and Pattern 8 (Output Assembly) from
[core.md](core.md).

**Navigation:** [Back to SKILL.md](../SKILL.md)

---

## Pattern 9: Intent to Candidate Stacks

### The ask

> "I want to build a SaaS — people sign in, they pay a monthly subscription, there's a live activity
> feed, and it has to work in English and German."

There is no signal in that sentence to traverse or map.

### What the intent says

| Read for     | From the ask                                                 | Settles                                   |
| ------------ | ------------------------------------------------------------ | ----------------------------------------- |
| **Surfaces** | "a SaaS" — a browser app with a service behind it            | `web` and `api`; nothing said about a CLI |
| **Concerns** | sign-in, monthly subscription, live feed, English and German | auth, payments, real-time, i18n           |

"SaaS" is not a framework and "pay a monthly subscription" is not a payments package; reading either
as a library would be invention.

### Stack acquisition

A hosted conversation, so route 1 answers and the others are never tried:

```
Route used:  1 (host-supplied)
Supplied:    the catalog, the built-in stacks, the sub-agent roster, the preload mapping
```

### The offer

Matched against what each stack declares about itself — name, description, philosophy, the skills
it names — never against an impression of what "the Next.js one" contains:

```
Three of the built-in stacks come close to what you described. Which is nearest?

  1. nextjs-saas-starter — the only one naming both sign-in and payments
  2. nextjs-fullstack    — same frontend, brings auth, names nothing for payments
  3. nextjs-t3-stack     — end-to-end type safety with auth; payments by hand

None of the three carries the live feed or the translations — that gap is the
same whichever you pick. Nothing is proposed until you answer.
```

The user picks 1. Everything below happened after that, and none of it before.

### After the pick

```
nextjs-saas-starter names 25 skills across 12 sub-agents.
  Ids verified against the acquired catalog:  25/25 present, none retired
  Sub-agent staffing:  the stack's own — there are no workspaces to derive one from
  Load states:         the preload mapping's answer for each pair
  Conflicts:           none — nothing the user named disagrees with the stack
```

The pick carries what the intent never asked for: `cli-framework-oclif-ink` and
`meta-reviewing-cli-reviewing`, the `cli-developer` and `cli-tester` sub-agents, and three meta
sub-agents — `agent-summoner`, `skill-summoner`, `codex-keeper`. They stay, and the report names them — trimming the stack to
fit the sentence would make the pick mean something the user did not agree to, where an untick in
the surface is theirs to make.

### The payload (abridged)

```json
{
  "v": 6,
  "matrixVersion": "1.0.0",
  "stackId": "nextjs-saas-starter",
  "skills": {
    "web-framework-react": {
      "install": "plugin",
      "scope": "global",
      "assignments": {
        "web-developer": "preloaded",
        "web-researcher": "preloaded",
        "pm": "preloaded",
        "reviewer": "preloaded",
        "agent-summoner": "lazy"
      }
    },
    "api-auth-better-auth-drizzle-hono": {
      "install": "plugin",
      "scope": "global",
      "assignments": {
        "api-developer": "preloaded",
        "api-researcher": "preloaded",
        "reviewer": "lazy"
      }
    },
    "api-commerce-stripe": {
      "install": "plugin",
      "scope": "global",
      "assignments": { "api-developer": "lazy", "reviewer": "lazy" }
    },
    "web-testing-playwright-e2e": {
      "install": "plugin",
      "scope": "global",
      "assignments": { "web-tester": "preloaded" }
    }
  },
  "agents": { "cli-tester": { "on": true } }
}
```

Four of the twenty-five, each with some of its assignments. `stackId` names the pick, but nothing
expands it, so the other twenty-one skills must be in `skills` too or they never arrive.

- **`agents` is not empty this time.** The stack names `cli-tester` and gives it no skills, and an
  assignment cannot carry a sub-agent that holds nothing, so `on: true` is the only way it travels.
- **The same skill loads differently per sub-agent.** `web-framework-react` is preloaded for the
  roles that work in it all session and lazy for an authoring agent that reaches for it occasionally
  — the mapping's answer per pair, not a choice made here.
- **`api-commerce-stripe` is lazy** although payments are half the reason this stack was picked: the
  mapping carries no preload for it, because a payments integration is reached for in some sessions
  rather than most. "It matters here, so preload it" is the second opinion that would override the
  product, and the payload would carry it as the user's own choice.

### The report (abridged)

```markdown
## Configuration proposal — from intent, no repository

Built from: a description of what you want to build
Catalog route: 1 (host-supplied, with the stacks, the roster and the preload mapping)

### Candidates and your pick

| Stack                             | Why it was a candidate                           |
| --------------------------------- | ------------------------------------------------ |
| nextjs-saas-starter _(you chose)_ | The only one naming both sign-in and payments    |
| nextjs-fullstack                  | Same frontend, brings auth, nothing for payments |
| nextjs-t3-stack                   | End-to-end types with auth; payments by hand     |

### What the pick carries — 25 skills across 12 sub-agents

Applied as the stack ships it. Nothing was added, removed or swapped.

### Your intent, not covered — needs a decision

| You asked for        | Category  | Status                                                                       |
| -------------------- | --------- | ---------------------------------------------------------------------------- |
| A live activity feed | real-time | No built-in stack carries one; the catalog has options — pick in the surface |
| English and German   | i18n      | The same: no stack carries one, and the catalog does                         |

Neither is proposed here. Choosing between the options is yours, exactly as the choice between the
three stacks was.

### Carried beyond what you described

| Item                                               | Why it is here                                                |
| -------------------------------------------------- | ------------------------------------------------------------- |
| cli-framework-oclif-ink, cli-developer, cli-tester | The stack ships them. Untick them if you are building no CLI. |
| agent-summoner, skill-summoner, codex-keeper       | The stack ships them. Untick any you will not use.            |

### Assumptions — not findings; flip any of them

| Field       | Value                 | Why                                                |
| ----------- | --------------------- | -------------------------------------------------- |
| install     | `plugin`              | The product default; the description says nothing  |
| scope       | `global`              | The product default; the description says nothing  |
| stackId     | `nextjs-saas-starter` | The stack you picked                               |
| load states | per the mapping       | Route 1 supplied it; no load state was chosen here |

### Next

Nothing has been written. Publish it with `npx agents-inc share --stdin`, then open the editor link
it prints to add a real-time and an i18n skill if you still want them, and confirm.
```

### What made this a proposal rather than a decision

One thing: the user answered before any of it existed. Skip the candidate list and the same run
produces the same twenty-five skills, the same load states and the same two gaps — and every one of
them arrives as something to undo rather than something to choose.
