# Open Source Strategy Research Tracker

> **Purpose**: Track parallel research agents exploring how to best open-source this project

---

## Research Question

How should we present and structure this project for open source, given:
- Personal skills/agents that may not be relevant to others
- Profile system (home/work) is personal
- Users will inevitably customize/delete/extend agents and skills
- Want CLI-based onboarding for personalization
- Must remain simple

---

## Active Research Agents

| Agent | Focus Area | Status | Started |
|-------|------------|--------|---------|
| Agent 1 | CLI Onboarding Patterns | **Complete** | 2026-01-08 |
| Agent 2 | "Starter Kit" vs "Framework" Positioning | **Complete** | 2026-01-08 |
| Agent 3 | Profile/Template Architecture for OSS | **Complete** | 2026-01-08 |
| Agent 4 | Community Examples (dotfiles, scaffolding tools) | **Complete** | 2026-01-08 |

---

## Agent 1: CLI Onboarding Patterns

**Focus**: Research CLI onboarding patterns from popular tools. How do they handle initial setup, selective feature installation, personalization?

**Status**: **Complete**

**Completed**: 2026-01-08

### Findings

#### 1. Patterns from Popular CLI Tools

**create-next-app (2025)**
- Offers 3-way initial choice:
  1. "Yes, use recommended defaults" (TypeScript, ESLint, Tailwind CSS, App Router, Turbopack)
  2. "No, reuse previous settings"
  3. "No, customize settings"
- If customizing: series of Yes/No binary prompts for each feature
- `--yes` flag skips all prompts using saved/default preferences
- Key insight: **Establishes "recommended" as the happy path** - most users just hit enter
- Source: [Next.js CLI docs](https://nextjs.org/docs/app/api-reference/cli/create-next-app)

**Vite create**
- Ultra-minimal: just 3 prompts (project name, framework, variant JS/TS)
- Non-interactive mode: `--template vue` bypasses all prompts
- Philosophy: **"Fast to first value"** - get users coding immediately
- Source: [Vite Getting Started](https://vite.dev/guide/)

**Vue CLI**
- Presets are saveable and reusable (stored in `~/.vuerc`)
- Manual mode: feature checkboxes with "More info" links explaining each option
- Presets can specify `"prompts": true` to still ask certain questions
- Key insight: **Separation of "what features" from "how to configure them"**
- Source: [Vue CLI docs](https://cli.vuejs.org/guide/creating-a-project.html)

**Yeoman**
- Uses Inquirer.js library for rich prompt types:
  - `input` - text input
  - `confirm` - yes/no
  - `list` - single selection from list
  - `checkbox` - multi-selection
  - `expand` - abbreviated list
- Lifecycle: initializing → prompting → configuring → writing → install
- Sub-generators for scaffolding parts of a project
- Source: [Yeoman docs](https://yeoman.io/learning/)

**degit/tiged**
- Zero prompts - just `degit user/repo` and done
- Post-clone actions via `degit.json` can `clone` or `remove` files
- Philosophy: **"Just give me the code"** - customization happens after
- Source: [degit GitHub](https://github.com/Rich-Harris/degit)

**Cookiecutter**
- Template variables in `cookiecutter.json` become prompts
- Pre/post-generate hooks (Python/Shell) for complex logic
- `{% if %}` blocks in templates for conditional file content
- Global config (`~/.cookiecutterrc`) saves user defaults
- Source: [Cookiecutter docs](https://cookiecutter.readthedocs.io/)

**Dotfiles tools (chezmoi, yadm, dotdrop)**
- Support templates with system-specific alternate files
- Install scripts for bootstrap automation
- Encourage "custom-configs" directories for personal overrides
- Source: [dotfiles.github.io](https://dotfiles.github.io/utilities/)

---

#### 2. The Additive vs Subtractive Question

This is the **central design decision** for this project.

**Subtractive (Start Full, Remove What You Do Not Need)**
- Feels like "getting less" - loss aversion makes this psychologically negative
- Requires understanding the whole system before knowing what to remove
- Scales poorly: O(n squared) cognitive load (must understand all interactions)
- Risk: Users keep things they do not understand "just in case"

**Additive (Start Empty, Add What You Want)**
- Feels like "building something" - positive psychological framing
- Only need to understand what you are adding
- Scales better: O(n) cognitive load
- Risk: Users might miss useful features they do not know about

**The "Preset" Middle Ground**
- Presets are curated bundles that feel additive ("I am choosing a full-stack preset")
- But internally they work subtractively (preset = "everything minus X")
- Key insight from Monday.com/Notion: **"Shorten time to relevance"** - presets get users to a good starting point faster

---

#### 3. Analysis of the User's Proposed Approach

**User's idea**: "CLI asks which agents to keep, shows which skills are kept as consequence, removes the rest"

**Assessment**: This is **directionally correct** but needs reframing.

**Problem with literal implementation**:
- "Which agents to keep" implies starting with all and removing - subtractive framing
- "Skills kept as consequence" is passive/unclear causality
- "Removes the rest" reinforces loss

**Better reframing**:
Agents ARE user roles. Users should think "what work do I do?" not "what to delete."

---

#### 4. Five Concrete CLI Onboarding Approaches

---

### Approach 1: Role-Based Selection (Recommended)

**Philosophy**: "What kind of work do you do?"

```
$ npx claude-agents init

Welcome to Claude Agents!

What kind of work do you do? (Select all that apply)
  [x] Frontend Development (React, styling, accessibility)
  [x] Backend Development (APIs, database, auth)
  [ ] Code Review (frontend and backend reviewing)
  [x] Testing (writing tests, mocking)
  [ ] Architecture (scaffolding new apps)
  [ ] Documentation (AI-focused docs)
  [ ] Research (investigating patterns)
  [ ] PM/Planning (creating implementation specs)

Based on your selections:
  Agents: frontend-developer, backend-developer, tester (3 agents)
  Skills: 18 skills across frontend, backend, testing

Proceed? [Y/n]
```

**Why this works**:
- Additive framing: "What do you do?" not "What to remove?"
- Maps to user's mental model (their job roles)
- Skills follow automatically - no cognitive overhead
- Clear causality: roles → agents → skills

---

### Approach 2: Preset + Custom

**Philosophy**: Mirror create-next-app's 3-way choice

```
$ npx claude-agents init

Welcome to Claude Agents!

How would you like to set up?
  > Use recommended defaults (Full-stack: all 16 agents, 28 skills)
    Frontend only (6 agents, 12 skills)
    Backend only (5 agents, 14 skills)
    Minimal (PM, developers, testers - 5 agents)
    Custom (choose your own)

[Enter to confirm]
```

**Why this works**:
- Fast happy path for most users (just hit enter)
- Presets have curated names that feel additive ("Full-stack" not "everything")
- Custom option for power users
- Clear value proposition for each preset

---

### Approach 3: Progressive Disclosure

**Philosophy**: Start minimal, offer to add more

```
$ npx claude-agents init

Welcome to Claude Agents!

Starting with the essentials:
  - frontend-developer (builds features)
  - backend-developer (builds features)
  - pm (creates specs)

Would you like to add more agents? [y/N]

> Yes

Additional agents available:
  [x] Code Reviewers (frontend-reviewer, backend-reviewer)
  [ ] Specialized (tester, documentor, orchestrator)
  [ ] Meta (pattern-scout, agent-summoner, skill-summoner)
  [ ] Research (frontend-researcher, backend-researcher)

[Space to toggle, Enter to confirm]
```

**Why this works**:
- Very fast default path (N = done)
- Progressive: complexity only for those who want it
- Categories make large lists manageable
- Users feel they are "adding value" not "losing features"

---

### Approach 4: Tech Stack Detection

**Philosophy**: Infer from existing project

```
$ npx claude-agents init

Detected in your project:
  - React (package.json)
  - TypeScript (tsconfig.json)
  - Drizzle ORM (drizzle.config.ts)
  - No test framework detected

Recommended setup for your stack:
  Agents: frontend-developer, backend-developer, pm, tester
  Skills: React, TypeScript, Drizzle, Vitest (to be configured)

Accept recommendations? [Y/n]

Would you like to add reviewers? [y/N]
```

**Why this works**:
- Zero cognitive load for initial setup
- Personalized to actual project
- Feels intelligent and helpful
- Can suggest missing things (testing)

---

### Approach 5: Template Gallery

**Philosophy**: Show, do not tell

```
$ npx claude-agents init

Choose a starting template:

  full-stack
  All 16 agents, all 28 skills. For teams doing everything.

  frontend-focused
  Frontend + PM + Testing. React, styling, state management.

  backend-focused
  Backend + PM + Testing. APIs, database, auth, observability.

  solo-dev
  Developer + PM + Tester. Lean setup for indie developers.

  custom
  Build your own configuration interactively.

[up/down to navigate, Enter to select]
```

**Why this works**:
- Visual preview of what you are getting
- Names/descriptions frame options positively
- Easy to understand without reading docs
- Mirrors successful patterns (VS Code themes, IDE templates)

---

### Primary Recommendation

**Combine Approach 1 (Role-Based Selection) with Approach 2 (Preset + Custom)**

```
$ npx claude-agents init

Welcome to Claude Agents!

Quick start or customize?
  > Quick start (Full-stack: 16 agents, 28 skills)
    Customize my setup

[If "Customize my setup":]

What kind of work do you do? (Select all that apply)
  [x] Frontend Development
  [x] Backend Development
  ...
```

**Rationale**:
1. Fastest path for most users (just hit enter)
2. Custom path uses positive "what do you do?" framing
3. Agents map to roles users already identify with
4. Skills are automatic consequences, not separate decisions
5. No "removal" language anywhere

---

### Implementation Notes

**Inquirer.js Prompt Types to Use**:
- `list` for preset selection
- `checkbox` for role/agent selection
- `confirm` for "Proceed?" steps

**Key UX Principles**:
1. **Default to Enter key** - most common action should be just hitting enter
2. **Show consequences before confirming** - "X agents, Y skills"
3. **No jargon in prompts** - "Frontend Development" not "frontend-developer agent"
4. **Reversible** - mention that users can always edit config.yaml later

**Reframing Language**:

| Avoid | Prefer |
|-------|--------|
| "Remove agents" | "Select your workflow" |
| "Delete skills" | "Choose your tech stack" |
| "Keep only" | "Include" |
| "The rest will be removed" | "Your setup will include X" |

---

### Integration with Agent 3 Findings

Agent 3 proposed a `_templates/` and `local/` directory structure. The CLI onboarding should:

1. **List available templates** from `_templates/` as preset options
2. **Create profiles** in `local/` (gitignored)
3. **Copy from templates** based on user's preset/role selection
4. **Support "customize from template"** option

Example integration:
```
$ npx claude-agents init

Welcome to Claude Agents!

Choose how to start:
  > Use a template (recommended)
    Start from scratch

[If "Use a template":]

Available templates:
  react-zustand  - React + Zustand + SCSS + Vitest (16 agents)
  react-mobx     - React + MobX + Tailwind (6 agents)
  fullstack      - Full stack with Hono, Drizzle, auth (16 agents)
  minimal        - Just the essentials (5 agents)

What would you like to name your stack? (e.g., "home-stack", "work-stack")
> home-stack

Creating stack "home-stack" from template "react-zustand"...
  - Created src/stacks/home-stack/
  - Copied 16 agent configs
  - Copied 28 skills
  - Generated CLAUDE.md

Ready! Run "bun run compile --stack=home-stack" to compile your agents.
```

---

### Answers to Agent 3's Questions

**Q: Should CLI use Inquirer.js or Commander.js?**

**A: Use both for different purposes:**
- **Inquirer.js** for interactive prompts (what the user sees)
- **Commander.js** or **yargs** for CLI argument parsing (`--preset`, `--stack`, etc.)
- This is the standard pattern used by create-next-app, Vue CLI, and Yeoman

**Q: What's the best UX for stack creation?**

**A:** The hybrid approach recommended above:
1. Single-question fast path ("Quick start or customize?")
2. Template-based selection for most users
3. Role-based customization for power users
4. No subtractive language anywhere

---

### Sources

- [Next.js CLI docs](https://nextjs.org/docs/app/api-reference/cli/create-next-app)
- [Vite Getting Started](https://vite.dev/guide/)
- [Vue CLI Creating a Project](https://cli.vuejs.org/guide/creating-a-project.html)
- [Yeoman Learning](https://yeoman.io/learning/)
- [degit GitHub](https://github.com/Rich-Harris/degit)
- [Cookiecutter docs](https://cookiecutter.readthedocs.io/)
- [dotfiles.github.io utilities](https://dotfiles.github.io/utilities/)
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js)
- [Smart Interface Design Patterns - Onboarding UX](https://smart-interface-design-patterns.com/articles/onboarding-ux/)

---

## Agent 2: "Starter Kit" vs "Framework" Positioning

**Focus**: Should this be positioned as a "starter template you clone and own" or a "framework you extend"? Explore implications of each approach.

**Status**: Complete

**Completed**: 2026-01-08

---

### Critical Context: Claude Code Native Subagent System

Before analyzing positioning, it's essential to understand what this project IS relative to Claude Code's native capabilities:

**Claude Code natively supports:**
- Subagents as Markdown files with YAML frontmatter in `.claude/agents/`
- Skills in `.claude/skills/`
- Project-level and user-level agent directories
- The `/agents` command for management
- Plugin system for sharing agents/skills/commands

**This project adds:**
- A TypeScript compilation system with validation
- LiquidJS templates for DRY agent authoring
- Profile switching (home/work tech stacks)
- Shared prompts and modular content assembly
- Schema validation and type safety
- Skill registry with precompiled vs dynamic assignment

**Key insight:** This project is an **authoring/compilation framework** that outputs to Claude Code's native format. It's not replacing Claude Code's agent system - it's a development toolchain for creating sophisticated agents.

---

### Analysis of Each Positioning Approach

#### **Option A: Starter Kit/Template ("Clone and Own")**

| Aspect | Assessment |
|--------|------------|
| **Setup friction** | Low - git clone, done |
| **User experience** | Simple mental model, full control |
| **Maintenance burden** | HIGH - user responsible for all updates |
| **Contribution model** | Fork-based, PRs rare, ideas shared informally |
| **Update story** | Manual cherry-picking from upstream |
| **Divergence handling** | Expected and embraced |

**Examples researched:**
- create-react-app ejected - Once ejected, you own everything
- Turborepo starters - Starting points, not maintained dependencies
- [LangChain retrieval-agent-template](https://github.com/langchain-ai/retrieval-agent-template) - One-time scaffold

**Pros for this project:**
- Perfect match for "users will 100% customize it"
- No dependency management complexity
- Clear ownership boundary
- Easy to understand

**Cons for this project:**
- Compiler improvements don't propagate
- Schema updates require manual migration
- Community can't easily share improvements
- Users maintain complexity they don't understand

---

#### **Option B: Framework/Library ("Install and Extend")**

| Aspect | Assessment |
|--------|------------|
| **Setup friction** | Medium - npm install, config files |
| **User experience** | More complex, abstraction layers |
| **Maintenance burden** | LOW - framework maintainer handles updates |
| **Contribution model** | Standard PRs to core repo |
| **Update story** | npm update (or git pull if submodule) |
| **Divergence handling** | Limited to extension points |

**Examples researched:**
- [ESLint shareable configs](https://eslint.org/docs/latest/extend/shareable-configs) - Install, extend, override
- [Tailwind CSS presets](https://v3.tailwindcss.com/docs/presets) - Composable configuration
- [LangChain/LangGraph](https://www.langchain.com/) - Full framework, templates separate

**Pros for this project:**
- Compiler/schema updates are automatic
- Clear separation: framework vs content
- Better maintainability long-term
- Encourages best practices

**Cons for this project:**
- The "content" (agents/skills) is inherently personal
- Profile system is specific to individual workflows
- Extension points hard to design upfront
- Adds complexity for minimal benefit (agents are simple Markdown)

---

#### **Option C: Dotfiles Pattern ("Fork Your Config")**

| Aspect | Assessment |
|--------|------------|
| **Setup friction** | Low - fork, clone |
| **User experience** | Familiar to developers |
| **Maintenance burden** | Medium - selective upstream pulls |
| **Contribution model** | Share via forks, cherry-pick ideas |
| **Update story** | git remote add upstream, selective merge |
| **Divergence handling** | Core value proposition |

**Examples researched:**
- [holman/dotfiles](https://github.com/holman/dotfiles) - Famous fork-and-customize pattern
- [chezmoi](https://www.chezmoi.io/) - Templates for machine differences
- oh-my-zsh - Framework with plugins/themes

**Pros for this project:**
- Perfect fit for personal configuration
- Community shares patterns via visible forks
- Selective upstream sync when desired
- Battle-tested model for config repos

**Cons for this project:**
- Discovery is harder (scattered across forks)
- "Good" patterns may not bubble up
- More git expertise required

---

#### **Option D: Hybrid - "Agent Authoring Development Kit"**

This is a **novel positioning** that combines aspects of A, B, and C:

| Component | Positioning | Reasoning |
|-----------|-------------|-----------|
| **Compilation system** (compile.ts, templates, schemas) | Framework-like | Stable, should receive updates |
| **Example agents/skills** | Starter Kit | Delete and replace with your own |
| **Profiles** | Dotfiles-style | Inherently personal, fork-and-own |
| **Core prompts** | Shareable components | Community can contribute good prompts |

**Examples that use this pattern:**
- [AutoGPT Forge](https://github.com/Significant-Gravitas/AutoGPT) - Toolkit + templates, dual-licensed
- [Claude Code Plugins](https://www.anthropic.com/news/claude-code-plugins) - Framework for sharing agents/skills
- Next.js (framework) + create-next-app (starter)

---

### Trade-off Matrix

| Criterion | Starter Kit (A) | Framework (B) | Dotfiles (C) | Hybrid (D) |
|-----------|-----------------|---------------|--------------|------------|
| Initial setup | Easy | Medium | Easy | Easy |
| Customization freedom | Full | Limited | Full | Full |
| Upstream updates | Manual | Auto | Selective | Selective core |
| Community sharing | Low | High | Medium | High |
| Maintenance burden | High | Low | Medium | Medium |
| Complexity | Low | High | Low | Medium |
| Fits personal content | Yes | No | Yes | Yes |
| Fits reusable infra | No | Yes | No | Yes |

---

### Recommendation: **Option D - "Agent Authoring Development Kit"**

**Positioning statement:**
> "A development kit for creating sophisticated Claude Code agents. Fork it, customize the agents for your workflow, benefit from compiler improvements."

**Why this is the right choice:**

1. **The project has TWO distinct value propositions:**
   - The compilation system (universal, reusable, improvable)
   - The agent content (personal, deletable, inspiring)

2. **Users will customize agents regardless** - Fighting this with framework constraints would create friction without benefit.

3. **The compiler IS the framework** - It provides structure, validation, and DRY benefits. Updates to this should propagate.

4. **Claude Code plugin ecosystem alignment** - The output format is already Claude Code native. Users can share individual agents via the plugin system while keeping their authoring setup private.

5. **Dotfiles communities work** - Developers are comfortable with "fork it, it's yours now" for personal config.

---

### Implementation Recommendations

#### Suggested Directory Structure (Two-Tier Separation)

```
claude-agent-kit/                  # Main repo name suggestion
├── core/                          # THE FRAMEWORK - rarely touch this
│   ├── compile.ts                 # Compiler
│   ├── templates/                 # LiquidJS templates
│   ├── schemas/                   # JSON schemas for validation
│   └── types.ts                   # TypeScript types
│
├── examples/                      # STARTER CONTENT - delete freely
│   ├── agents/                    # Example agent sources
│   ├── skills/                    # Example skills
│   ├── profiles/                  # Example profiles (per Agent 3's template system)
│   └── core-prompts/              # Example shared prompts
│
└── .claude/                       # COMPILED OUTPUT (gitignored)
    ├── agents/                    # Claude Code native format
    └── skills/
```

**Note:** This aligns with Agent 3's recommendation for `_templates/` and `local/` separation within profiles.

#### Update Story

1. **User forks repo** - Full ownership
2. **User deletes `examples/`** - Or keeps as reference
3. **User creates content in their own directories** - Their actual workflow
4. **User can pull upstream `core/` changes** - Compiler improvements
5. **User shares individual agents via gists/plugins** - Not full repo

#### Documentation Strategy

| Document | Purpose |
|----------|---------|
| README.md | Quick start, philosophy, "this is a dev kit not a library" |
| CUSTOMIZING.md | How to delete examples, create your own agents |
| UPSTREAM.md | How to pull compiler updates without conflicts |
| examples/README.md | "These are examples, not prescriptions" |
| CONTRIBUTING.md | Focus on core/ contributions, agent sharing via forks |

#### Community Model

- **Core contributions**: PRs to improve compiler, templates, schemas
- **Agent sharing**: Via GitHub forks (visible to community) or Claude Code plugins
- **Pattern catalog**: Optional wiki/discussions for "interesting agent patterns"
- **Not a monorepo of agents**: Avoid accumulating everyone's personal agents

---

### Implications for Documentation

1. **Lead with the problem**: "Managing sophisticated Claude Code agents is complex. This kit provides compilation, validation, and DRY authoring."

2. **Set expectations early**: "You will delete most of the example content. That's intentional."

3. **Separate concerns clearly**: "The `core/` directory is the stable toolkit. Everything else is meant to be customized."

4. **Acknowledge the personal nature**: "Your agents reflect YOUR workflow. We provide tools and examples, not prescriptions."

5. **Show the output**: Demonstrate that this compiles to native Claude Code format - demystify the value add.

---

### Implications for Project Structure

Based on this recommendation and Agent 3's findings:

1. **Rename `src/` to something clearer** - Perhaps `agent-kit/` or keep cleaner separation between `core/` and user content

2. **Clearly mark "framework" vs "content"** - Users should instantly know what to keep vs delete

3. **Make the compiler self-contained** - Minimal dependencies, single entry point

4. **Align with Claude Code conventions** - Output to `.claude/agents/` and `.claude/skills/` as expected

---

### Sources Consulted

- [LangChain Agent Templates](https://github.com/langchain-ai/retrieval-agent-template)
- [AutoGPT Forge](https://github.com/Significant-Gravitas/AutoGPT)
- [ESLint Shareable Configs](https://eslint.org/docs/latest/extend/shareable-configs)
- [Tailwind CSS Presets](https://v3.tailwindcss.com/docs/presets)
- [chezmoi Dotfile Manager](https://www.chezmoi.io/)
- [holman/dotfiles](https://github.com/holman/dotfiles)
- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Plugins Announcement](https://www.anthropic.com/news/claude-code-plugins)

---

### Answers to Agent 3's Questions

**Q: Is this a "starter kit" (fork and own) or "framework" (extend)?**

**A: Both.** The recommended hybrid approach treats the compilation system as a framework (stable, updatable) and the agent content as a starter kit (deletable, customizable). This means:

- Agent 3's template system (`_templates/`, `local/`) is appropriate for the "starter kit" portion
- Templates should be clearly labeled as examples, not requirements
- The CLI should emphasize "creating YOUR profile" not "configuring THE profile"

---

## Agent 3: Profile/Template Architecture for OSS

**Focus**: How to structure the profile system for OSS. Should there be example profiles? Empty templates? How do other config-heavy projects handle personal vs example configs?

**Status**: Complete

**Findings**:

### Research Summary

Analyzed patterns from multiple ecosystems:

1. **Dotfiles Management (chezmoi, thoughtbot/dotfiles)**
   - chezmoi: Templates with Go text/template for machine-specific differences, private config in local files (not committed), password manager integration for secrets
   - thoughtbot: `.local` suffix pattern for personal overrides (e.g., `psqlrc.local`), ships blank examples, `~/dotfiles-local/` directory for user-specific configs
   - Key insight: Public repos with private data handled separately (password managers, `.local` files)

2. **Terraform/Kubernetes**
   - `.tfvars` files gitignored, `.tfvars.example` committed as templates
   - Remote state files (never committed locally)
   - Clear modularity: separate configs for provisioning vs resources
   - Pattern: Files containing "gitignore" in name are auto-ignored

3. **Turborepo/Monorepo Tools**
   - `create-turbo` CLI for scaffolding with interactive prompts
   - Templates from local or remote sources (GitHub URLs)
   - Examples serve as reference implementations users can clone
   - Code generation using existing workspaces as templates

4. **Yeoman Generators**
   - Interactive prompts via Inquirer.js for user customization
   - Priority lifecycle: initializing → prompting → configuring → writing
   - Templates copied and processed with ejs templating
   - `.yo-rc.json` marks project root

5. **Starter Kit vs Framework Philosophy (Laravel, kickstartDS)**
   - Starter kit: "own all code from day one" - users fork and customize
   - Full customization without worrying about upstream package updates
   - Clear separation between starter kit scaffolding and application code

### Analysis of Current Profile Structure

**Key Observation**: The current `home/` and `work/` profiles are fundamentally different tech stacks:
- Home: Zustand + SCSS Modules + Vitest + MSW (813-line client-state skill)
- Work: MobX + Tailwind + Karma/Mocha/Chai + Sinon (1159-line client-state skill)

These are NOT different configurations of the same stack - they are completely different technologies. The skill files share almost no content. This makes profile inheritance/layering impractical.

### Options Evaluated

| Option | Description | Verdict |
|--------|-------------|---------|
| A | Ship example profiles (`example-frontend/`, `example-backend/`) | Rejected - "example" feels second-class, confusing naming |
| B | Minimal "default" profile, document how to create more | Rejected - default still needs tech stack, users copy without understanding |
| C | Empty profile templates, CLI populates | Rejected - empty profiles not useful as examples |
| D | `.example` suffix pattern (`home.example/`) | Rejected - awkward with directories, not idiomatic |
| E | Personal profiles in `.gitignore`d location | Partial - good for privacy but needs examples |
| **F** | **Hybrid: Templates committed, local/ gitignored** | **Recommended** |

### Recommended Approach: Hybrid (Option F)

Combine template profiles (committed) with a user profiles directory (gitignored):

```
src/
├── profiles/
│   ├── _templates/              # Example profiles (committed, public)
│   │   ├── react-zustand/       # React + Zustand + SCSS + Vitest
│   │   │   ├── config.yaml
│   │   │   ├── CLAUDE.md
│   │   │   └── skills/
│   │   ├── react-mobx/          # React + MobX + Tailwind + Karma
│   │   │   ├── config.yaml
│   │   │   ├── CLAUDE.md
│   │   │   └── skills/
│   │   ├── fullstack/           # Full stack (Hono, Drizzle, Better Auth)
│   │   │   ├── config.yaml
│   │   │   ├── CLAUDE.md
│   │   │   └── skills/
│   │   └── minimal/             # Agents only, no tech stack opinions
│   │       ├── config.yaml
│   │       ├── CLAUDE.md
│   │       └── skills/
│   └── local/                   # User profiles (gitignored, private)
│       ├── home/                # User's personal profile
│       └── work-stack/          # User's work stack
├── registry.yaml
└── compile.ts

# In .gitignore:
src/stacks/local/
```

### Design Decisions

1. **`_templates/` prefix**: Leading underscore signals "internal/meta" content (common Node.js convention). Sorts first in directory listings.

2. **`local/` directory**: Well-understood term for user-specific, non-committed content. Similar to thoughtbot's `~/dotfiles-local/`.

3. **Descriptive template names**: `react-zustand`, `react-mobx`, `fullstack` describe the tech stack, not the user context. Users understand what they're getting.

4. **Complete working templates**: Templates are fully functional stacks that compile and work out-of-box, not empty stubs. Users can reference them even after creating their own.

5. **CLI-assisted stack creation**: Interactive prompts guide users through creating stacks based on templates.

### CLI Onboarding Flow

```bash
$ bun run setup

Welcome to Claude Agents!

? What would you like to name your stack? (e.g., "home-stack", "work-stack", "project-x")
> home-stack

? Choose a base template:
  > react-zustand (React, Zustand, SCSS Modules, Vitest, MSW)
    react-mobx (React, MobX, Tailwind, Karma/Mocha, Sinon)
    fullstack (Full stack: Hono, Drizzle, Better Auth, PostHog)
    minimal (Core agents only, no tech stack)

? What's your state management preference? [if minimal selected]
  > Zustand
    MobX
    Redux Toolkit
    None (useState only)

Creating stack at src/stacks/home-stack/...
  ✓ Copied template: react-zustand
  ✓ Created config.yaml
  ✓ Created CLAUDE.md
  ✓ Copied 28 skill files

? Would you like to compile now? (Y/n)
> Y

Compiling with profile: home
  ✓ Compiled 16 agents
  ✓ Compiled 28 skills
  ✓ Copied CLAUDE.md

Done! Run "bun run compile home" anytime to recompile.
```

### Template Profile Contents

**react-zustand/** (based on current `home/`):
- 16 agents (full set)
- 28 skills covering frontend + backend + setup + research
- Tech: Zustand, SCSS Modules + cva, Vitest, MSW, React Query
- CLAUDE.md with decision trees for this stack

**react-mobx/** (based on current `work/`):
- 6 agents (frontend-focused)
- 8 skills (frontend only)
- Tech: MobX, Tailwind + clsx, Karma/Mocha/Chai, Sinon
- CLAUDE.md with MobX-specific patterns

**fullstack/**:
- Same as react-zustand but emphasizes backend
- Includes setup skills for PostHog, Resend, observability

**minimal/**:
- All 16 agents with basic configs
- No precompiled skills (all dynamic)
- Generic CLAUDE.md with placeholder patterns
- Users customize from scratch

### Stack Naming Conventions

| Context | Naming Pattern | Examples |
|---------|---------------|----------|
| **Template stacks** | Tech stack descriptors | `react-zustand`, `react-mobx`, `fullstack`, `minimal` |
| **User stacks** | Personal context names | `home-stack`, `work-stack`, `project-x`, `client-acme` |

### What Goes in `.gitignore`

```gitignore
# User-specific stack configurations (contains personal tech stack choices)
src/stacks/local/

# Compiled output (regenerated on compile)
.claude/agents/
.claude/skills/
.claude/commands/
```

### Migration Path for Current Users

One-time migration script:

```bash
# migration.sh
mkdir -p src/stacks/local
mv src/stacks/home-stack src/stacks/local/
mv src/stacks/work-stack src/stacks/local/

# Add to .gitignore if not already present
echo "src/stacks/local/" >> .gitignore

echo "Migration complete! Your personal stacks are now in local/"
```

### Skill Bundle Considerations

Current skill organization by domain (frontend/, backend/, setup/, security/, shared/, research/) is good for OSS:

1. **Templates include appropriate bundles**: `react-zustand` includes all bundles; `react-mobx` includes frontend only
2. **Users can mix and match**: Copy skills from templates to local stack
3. **Bundle documentation**: Each template's CLAUDE.md explains which skills are included and why
4. **Future: Bundle presets**: CLI could offer "Add backend bundle to existing stack" functionality

### Recommendations Summary

| Recommendation | Priority | Rationale |
|----------------|----------|-----------|
| Create `_templates/` and `local/` structure | High | Clean separation of public vs private |
| Implement CLI setup wizard | High | Guides users through profile creation |
| Ship 4 template profiles | High | Covers common use cases |
| Add `.gitignore` entries | High | Protects user privacy |
| Create migration script | Medium | Helps existing users transition |
| Document profile system in README | Medium | Explains architecture to new users |
| Add "customize template" CLI option | Low | Advanced feature for later |

### Open Questions for Other Agents

1. **Agent 1 (CLI Onboarding)**: Should CLI use Inquirer.js or Commander.js? What's the best UX for profile creation?
2. **Agent 2 (Positioning)**: Is this a "starter kit" (fork and own) or "framework" (extend)? Affects how templates are presented.
3. **Agent 4 (Community Examples)**: How do popular dotfiles repos handle README/documentation for forked projects?

---

## Agent 4: Community Examples Research

**Focus**: Research how dotfiles repos, yeoman generators, create-* tools, and similar projects handle the "personal config that others fork" problem.

**Status**: Complete

**Completed**: 2026-01-08

---

### 1. Neovim Configuration Distributions

#### NvChad Approach
- **Philosophy**: "Not a framework, a base config" - explicitly designed to be customized
- **Custom Directory Pattern**: User config lives in `~/.config/nvim/lua/custom/` completely separate from core
- **Key Files**: `chadrc.lua` (overrides), `plugins.lua` (additions), `mappings.lua` (keybinds)
- **Update Safety**: `git pull` on core never touches user's custom folder
- **Starter Config**: Provides `example_config` repo users clone into custom directory
- **Source**: [NvChad GitHub](https://github.com/NvChad/NvChad), [NvChad Docs](https://nvchad.com/)

#### LunarVim Approach
- **Philosophy**: "IDE layer for Neovim" - more opinionated, feature-rich
- **Configuration**: Single `config.lua` file for all customization
- **Plugin Addition**: `lvim.plugins = { ... }` in config file
- **Trade-off**: Simpler for users but less modular than NvChad
- **Source**: [LunarVim](https://www.lunarvim.org/)

#### SpaceVim Approach
- **Philosophy**: Modular via "layers" (inspired by Spacemacs)
- **Configuration**: TOML-based, simpler but less flexible than Lua
- **Layer System**: Enable/disable feature bundles in config
- **Target Users**: Beginners who want pre-configured setup
- **Source**: [SpaceVim](https://best-of-web.builder.io/library/SpaceVim/SpaceVim)

#### AstroNvim + AstroCommunity (HIGHLY RELEVANT)
- **Community Repository Pattern**: Separate repo for community contributions
- **AstroCommunity**: Acts as "marketplace" for additional configs
- **Import System**: `import` statements pull in community specs
- **Load Order**: Core -> Community imports -> User plugins (ensures user can override)
- **Maintenance Model**: Core team doesn't actively maintain community specs
- **Language Packs**: Bundled configurations for programming languages
- **Source**: [AstroCommunity GitHub](https://github.com/AstroNvim/astrocommunity), [AstroNvim Docs](https://docs.astronvim.com/astrocommunity/)

#### LazyVim Approach
- **Middle Ground**: Between "starter template" and "distribution"
- **Extras System**: Modular optional features
- **Transparency**: Underlying config remains visible and modifiable
- **Philosophy**: "Convenience of distribution, flexibility of personal config"

### 2. Shell Frameworks

#### Oh My Zsh (HIGHLY RELEVANT)
- **Custom Directory**: `$ZSH_CUSTOM` (~/.oh-my-zsh/custom/) for all user additions
- **Override Pattern**: Put same-named file in custom folder to replace built-in
- **Partial Customization**: "Patch plugins" that load after base plugins
- **Git Ignored**: Custom directory ignored by default - can be its own repo
- **Plugin Installation**: Clone external plugins into custom/plugins/
- **Theme Policy**: "More than enough themes" - new ones go to external wiki
- **Contribution Model**: PRs need testers (+1), extensive guidelines
- **Scale**: 2,400+ contributors, 300+ plugins, 140+ themes
- **Source**: [Oh My Zsh Customization Wiki](https://github.com/ohmyzsh/ohmyzsh/wiki/Customization), [ohmyz.sh](https://ohmyz.sh/)

#### Prezto Approach
- **Fork-First Philosophy**: "Fork this project to preserve your changes"
- **Modular Loading**: Custom `pmodload` function, `zstyle` for config
- **Contrib Repo**: Separate `prezto-contrib` for community modules
- **Source**: [Prezto GitHub](https://github.com/sorin-ionescu/prezto)

#### Plugin Manager Abstraction (Zgen, Zinit, Zplug)
- **Cross-Framework Loading**: Load plugins from both OMZ and Prezto
- **Snippet Support**: Load individual files without full frameworks
- **Static Loading**: Generate init scripts for performance

### 3. Emacs Distributions

#### Doom Emacs
- **Module System**: ~160 modules organized by functionality
- **Private Config**: `$DOOMDIR` (~/.doom.d/ or ~/.config/doom/)
- **Key Files**: `init.el` (module selection), `config.el` (customization), `packages.el` (packages)
- **Load Order**: Modules load first, then config.el (user gets last word)
- **Anti-Customize**: Explicitly discourages M-x customize, prefers programmatic config
- **Philosophy**: Thinner abstraction than Spacemacs, faster startup (~3s vs ~12s)
- **Source**: [Doom Emacs Docs](https://docs.doomemacs.org/latest/)

#### Spacemacs
- **Layer System**: Bundles of packages + config organized by purpose
- **Private Layers**: Create in `.emacs.d/private/` for custom functionality
- **Shared Config**: Team configs via custom private layers
- **Trade-off**: More features, slower startup, thicker abstraction
- **Source**: [Spacemacs Shared Config](https://cultivatehq.com/posts/spacemacs-shared-config/)

### 4. Dotfiles Management Tools

#### Chezmoi (HIGHLY RELEVANT for templating)
- **Templating Power**: Go text/template for machine-specific variations
- **Single Source**: One dotfile generates different outputs per machine
- **Machine Config**: `~/.config/chezmoi/chezmoi.toml` defines variables
- **Work/Personal Separation**: Template conditionals for different environments
- **Secrets Handling**: Password manager integration, encrypted files
- **Shared Templates**: Same content in different locations via templates
- **Source**: [chezmoi](https://www.chezmoi.io/), [chezmoi templating](https://www.chezmoi.io/user-guide/templating/)

#### Yadm
- **Git-Native**: "If you know Git, you know yadm"
- **Alternate Files**: System-specific file variants
- **External Templating**: Requires external tools (j2cli, envtpl)
- **Source**: [yadm](https://yadm.io/)

#### Thoughtbot Dotfiles
- **rcm Tool**: Custom symlink manager
- **Local Overrides**: `.local` files for personal settings
- **Clean Separation**: Fork stays pristine, overrides in local files

### 5. Anti-Patterns Identified

#### Fork Divergence Problem
> "Both your fork and the upstream have been independently gorging on dotfiles tidbits... the divergent commit history means it's non-trivial to pull those sorts of improvements downstream."
- Forks can diverge so badly "they may as well be completely separate repos"
- From first commit, "encumbered with stuff you don't necessarily care for"
- **Source**: [Are dotfiles meant to be forked?](https://www.jmsbrdy.com/blog/are-dotfiles-meant-to-be-forked)

#### The "Forked for Years" Problem
- Zach Holman "forked Ryan Bates' dotfiles for a couple years before the weight of my changes and tweaks inspired me to finally roll my own"
- Long alias files, everything strewn about
- Led to topic-centric organization
- **Source**: [Dotfiles Are Meant to Be Forked](https://zachholman.com/2010/08/dotfiles-are-meant-to-be-forked/)

#### Manual Commands Anti-Pattern
- Commands like `ln -s mcp/mcp.json .mcp.json` typed directly instead of scripted
- Makes you "the bottleneck hero"
- "Spilled coffee principle": Anyone should be operational again same afternoon
- **Source**: [atxtechbro/dotfiles](https://github.com/atxtechbro/dotfiles)

#### Tooling vs Content Distinction
> "Our dotfiles should be a wildly heterogeneous grab bag of snippets... Let's use code-sharing where it makes sense - for the tooling - and just copy-paste snippets for the rest."
- Share tooling (compiler, CLI, structure)
- Don't expect content (agents, skills) to be identical across users

### 6. Successful Patterns Summary

| Pattern | Used By | Key Benefit |
|---------|---------|-------------|
| **Custom Directory** | Oh My Zsh, NvChad | Updates never touch user config |
| **Override by Name** | Oh My Zsh | Replace any built-in by matching filename |
| **Community Repo** | AstroCommunity | Separate quality bar, easy contributions |
| **Import System** | AstroNvim, LazyVim | User imports what they want |
| **Load Order Priority** | Doom, AstroNvim | User config loads last (wins) |
| **Templating** | chezmoi | One source, multiple outputs |
| **Local Overrides** | thoughtbot, OMZ | `.local` files never committed |
| **Starter Config** | NvChad | Example config to clone and modify |
| **Layer/Module System** | Spacemacs, Doom | Organize by functionality |
| **Bundles/Packs** | AstroNvim | Pre-configured language setups |

---

### Creative Ideas for This Project

#### 1. "Custom" Directory Pattern
```
src/
├── registry.yaml           # Core agents/skills (updatable)
├── custom/                  # User's personal additions (git-ignored)
│   ├── registry.yaml        # User's agents/skills (merged with core)
│   ├── profiles/            # User's profiles
│   └── skills/              # User's custom skills
```
- Core updates via `git pull` never touch custom/
- User can version control custom/ as separate repo

#### 2. Community Repository Model (AstroCommunity-inspired)
```
Separate repo: claude-subagents-community
├── agents/
│   ├── python-specialist/
│   ├── rust-developer/
│   └── devops-engineer/
└── skills/
    ├── kubernetes.md
    ├── terraform.md
    └── graphql.md
```
- Lower quality bar than core
- Easy contribution via PR
- Import via: `community: [python-specialist, kubernetes]` in user config

#### 3. Skill Bundles (Language Packs)
```yaml
bundles:
  frontend-essentials:
    - frontend/react
    - frontend/styling
    - frontend/accessibility
    - frontend/testing
  backend-essentials:
    - backend/api
    - backend/database
    - backend/authentication
  python-stack:
    - backend/python-fastapi
    - backend/sqlalchemy
    - backend/pytest
```
- One-line enablement of common combinations
- Community can contribute bundles

#### 4. Layered Configuration
```
Load order:
1. Core defaults (registry.yaml)
2. Profile template (if extends: specified)
3. User overrides (custom/registry.yaml)
4. Local overrides (.local.yaml, gitignored)
```
- Each layer can add, remove, or override
- User always wins (loads last)

---

### Contribution Model Recommendations

**Tier 1: Core Repository**
- Maintained agents: pm, frontend-developer, backend-developer, reviewer, tester
- Generic skills that work for any stack
- High quality bar, careful review
- Semantic versioning

**Tier 2: Community Repository**
- Technology-specific skills (Kubernetes, GraphQL, specific frameworks)
- Specialized agents (DevOps, ML Engineer, Security Auditor)
- Lower quality bar - "think AUR or VS Code extensions"
- Community maintains, core team reviews occasionally
- Contribution via PR with basic template

**Tier 3: User Custom**
- Personal profiles
- Work-specific skills
- Experimental agents
- Never shared upstream (gitignored)

#### Contribution Workflow
```
1. Fork community repo
2. Add skill/agent following template
3. Open PR with:
   - Description of what it does
   - Example usage
   - Testing notes
4. Community review (not core team)
5. Merge to community repo
6. Users import via community registry
```

---

### What Does NOT Work (Anti-Patterns to Avoid)

1. **"Fork and own everything"** - Leads to divergence, hard to get updates
2. **Modifying core files directly** - Lost on update
3. **No separation between personal and shareable** - Can't contribute back
4. **Single monolithic config** - Hard to understand, harder to share pieces
5. **No starter examples** - Users don't know where to begin
6. **Too many required files** - Barrier to contribution
7. **No clear load order** - Confusing when overrides don't work
8. **Manual setup steps** - Not reproducible, error-prone

---

### Answers to Agent 3's Questions

**Q: How do popular dotfiles repos handle README/documentation for forked projects?**

**A:** Most successful dotfiles repos follow these documentation patterns:

1. **"This is MY setup" disclaimer** - Holman, Mathias Bynens, and others clearly state these are personal configs not universal recommendations
2. **Installation one-liner** - Clone + script, not manual steps
3. **Section-by-section explanations** - What each directory/file does
4. **"Fork this!" encouragement** - Explicitly tell users to fork, not clone
5. **Update instructions** - How to pull upstream changes for tooling
6. **Customization guide** - Where to put personal overrides

For this project specifically:
- Lead with "fork and customize" message
- Clearly label `core/` as "don't touch, receives updates"
- Clearly label `examples/` as "delete or modify freely"
- Include CUSTOMIZING.md for override patterns
- Include CONTRIBUTING.md focused on core contributions

---

### Research Sources

**Neovim Configs:**
- [NvChad GitHub](https://github.com/NvChad/NvChad)
- [LunarVim](https://www.lunarvim.org/)
- [AstroCommunity](https://github.com/AstroNvim/astrocommunity)
- [Lazyman Config Distributions](https://lazyman.dev/posts/Configuration-Distributions/)

**Shell Frameworks:**
- [Oh My Zsh Customization](https://github.com/ohmyzsh/ohmyzsh/wiki/Customization)
- [Prezto GitHub](https://github.com/sorin-ionescu/prezto)
- [ZSH Framework Comparison](https://gist.github.com/laggardkernel/4a4c4986ccdcaf47b91e8227f9868ded)

**Emacs:**
- [Doom Emacs Docs](https://docs.doomemacs.org/latest/)
- [Doom Emacs Config Example](https://zzamboni.org/post/my-doom-emacs-configuration-with-commentary/)

**Dotfiles:**
- [chezmoi](https://www.chezmoi.io/)
- [chezmoi Templating](https://www.chezmoi.io/user-guide/templating/)
- [yadm](https://yadm.io/)
- [Are dotfiles meant to be forked?](https://www.jmsbrdy.com/blog/are-dotfiles-meant-to-be-forked)
- [Dotfiles Are Meant to Be Forked](https://zachholman.com/2010/08/dotfiles-are-meant-to-be-forked/)

**Git Strategies:**
- [GitHub Fork Syncing](https://docs.github.com/articles/syncing-a-fork)
- [Atlassian Git Forks](https://www.atlassian.com/git/tutorials/git-forks-and-upstreams)

---

## Synthesis

All four research agents have completed. Here is the combined synthesis:

### Recommended Approach

Based on combined findings from all agents, the recommended approach is a **"Configurable Base Config"** model (Agent 2's "Option D: Agent Authoring Development Kit") that combines:

1. **Custom Directory Pattern** (Agent 4 - Oh My Zsh/NvChad model)
   - Separate user additions from core in `custom/` or `local/` directory
   - Core updates via `git pull` never touch user config

2. **Template Profiles** (Agent 3 - Hybrid Option F)
   - `_templates/` directory with complete working starter profiles
   - `local/` directory for user's personal profiles (gitignored)
   - Templates named by tech stack: `react-zustand`, `react-mobx`, `fullstack`

3. **Community Repository** (Agent 4 - AstroCommunity model)
   - Separate `claude-subagents-community` repo for contributions
   - Lower quality bar than core, community-maintained
   - Import syntax to pull in community agents/skills

4. **Layered Configuration** (Agent 4 - Doom Emacs model)
   - Load order: Core -> Template -> User -> Local
   - Each layer can add, remove, or override
   - User config always loads last (wins)

5. **Clear Two-Tier Separation** (Agent 2)
   - `core/` = Framework (compiler, templates, schemas) - stable, updatable
   - `examples/` = Starter content (agents, skills, profiles) - delete freely

6. **Role-Based CLI Onboarding** (Agent 1)
   - Quick start with presets OR customize your setup
   - Additive framing ("what do you do?") not subtractive ("what to remove?")
   - Templates integrate with CLI for profile creation

### CLI Tool Requirements

Based on Agent 1's recommendation (combined Approach 1 + 2):

```bash
$ npx claude-agents init

Quick start or customize?
  > Quick start (Full-stack: 16 agents, 28 skills)
    Customize my setup

[If "Customize":]
What kind of work do you do? (Select all that apply)
  [x] Frontend Development
  [x] Backend Development
  [ ] Code Review
  ...

Based on your selections:
  Agents: frontend-developer, backend-developer (2 agents)
  Skills: 14 skills across frontend, backend
```

**Implementation:**
- Use Inquirer.js for interactive prompts
- Use Commander.js for CLI argument parsing
- Support `--yes` flag for non-interactive defaults
- Create profiles in `local/` (gitignored)

### Directory Structure Changes

Combined recommendation from all agents:

```
claude-agent-kit/                  # Suggested repo name (Agent 2)
├── core/                          # THE FRAMEWORK - rarely touch (Agent 2)
│   ├── compile.ts
│   ├── templates/
│   ├── schemas/
│   └── types.ts
│
├── examples/                      # STARTER CONTENT - delete freely (Agent 2)
│   ├── agents/                    # Example agent sources
│   ├── skills/                    # Example skills
│   ├── profiles/
│   │   └── _templates/            # Tech-stack templates (Agent 3)
│   │       ├── react-zustand/
│   │       ├── react-mobx/
│   │       ├── fullstack/
│   │       └── minimal/
│   └── core-prompts/
│
├── local/                         # USER CONTENT - gitignored (Agents 3+4)
│   ├── profiles/                  # User's profiles
│   │   ├── home/
│   │   └── work/
│   ├── agents/                    # User's custom agents
│   └── skills/                    # User's custom skills
│
└── .claude/                       # COMPILED OUTPUT - gitignored
    ├── agents/
    └── skills/

# Separate repository: claude-subagents-community (Agent 4)
├── agents/
├── skills/
└── bundles/
```

### Documentation Strategy

| Document | Purpose |
|----------|---------|
| README.md | Quick start, philosophy, "fork and customize" message |
| CUSTOMIZING.md | How to delete examples, create your own agents, override patterns |
| UPSTREAM.md | How to pull compiler updates without conflicts |
| CONTRIBUTING.md | Focus on core/ contributions, community repo for agents |
| examples/README.md | "These are examples, not prescriptions" |

### Key Reframing Language (Agent 1)

| Avoid | Prefer |
|-------|--------|
| "Remove agents" | "Select your workflow" |
| "Delete skills" | "Choose your tech stack" |
| "Keep only" | "Include" |
| "The rest will be removed" | "Your setup will include X" |

### Next Steps

1. [ ] Restructure directories to match recommended approach
2. [ ] Create CLI tool with setup wizard (Inquirer.js + Commander.js)
3. [ ] Create template profiles from current home/work
4. [ ] Set up community repository
5. [ ] Write documentation (README, CUSTOMIZING, CONTRIBUTING, UPSTREAM)
6. [ ] Add .gitignore entries for local/

---

_Last updated: 2026-01-08 (All agents complete)_
