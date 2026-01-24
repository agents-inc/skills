# Outstanding Tasks

> **Generated**: 2026-01-21
> **Updated**: 2026-01-24
> **Purpose**: Single source of truth for all outstanding work
>
> **Architecture Status**: Implementation complete. See [plugins/INDEX.md](./plugins/INDEX.md) for complete documentation.
> **Migration Status**: Agent Plugin Migration complete. See [AGENT-PLUGIN-MIGRATION.md](./plugins/AGENT-PLUGIN-MIGRATION.md).

---

## Related Files (Do Not Delete)

These files contain detailed research referenced by this document:

| File                                            | Purpose                                                   | Location                        |
| ----------------------------------------------- | --------------------------------------------------------- | ------------------------------- |
| `CLI-REVIEW-FINDINGS.md`                        | **Active** - 12-agent code review findings                | Root                            |
| `CLAUDE-COLLECTIVE-DIRECTORY-IMPLEMENTATION.md` | **Critical** - `.claude-collective/` separation research  | `.claude/research/findings/v2/` |
| `CONFIGURABLE-SOURCE-EDGE-CASES.md`             | Private repo support research, giget limits               | `.claude/research/`             |
| `SKILLS-RESEARCH-TRACKING.md`                   | New skills backlog (42 skills identified)                 | `.claude/research/`             |
| `VERSIONING-PROPOSALS.md`                       | Versioning decision rationale                             | `.claude/research/`             |
| `CLI-TEST-PROGRESS.md`                          | Wizard testing results, stack validation                  | Root                            |
| `CLI-DATA-DRIVEN-ARCHITECTURE.md`               | Matrix schema, data flow, repository separation           | `.claude/research/findings/v2/` |
| `CLI-AGENT-INVOCATION-RESEARCH.md`              | **Key** - Inline `--agents` JSON invocation               | `src/docs/cli/`                 |
| `CLI-FRAMEWORK-RESEARCH.md`                     | @clack vs Ink vs Inquirer comparison                      | `src/docs/cli/`                 |
| `CLI-SIMPLIFIED-ARCHITECTURE.md`                | While-loop wizard design                                  | `.claude/research/findings/v2/` |
| `SKILLS-MATRIX-STRUCTURE-RESEARCH.md`           | Why relationship-centric beats skill-centric              | `.claude/research/findings/v2/` |
| `RULES-TASKS-INTEGRATION-PLAN.md`               | **New** - Claude Rules, Tasks, v2.1.x feature integration | `.claude/research/findings/v2/` |

---

## Outstanding by Category

### 0. Plugin Distribution - Production Readiness

> **Goal:** Make plugin system work end-to-end for ALL stacks and skills, not just prototype

| Priority | Task                         | Description                                                                                          | Status                                                                       |
| -------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| CRITICAL | Compile ALL stacks           | Test `cc compile-stack` for all stacks (fullstack-react, work-stack)                                 | **DONE** (orphaned mobx-tailwind removed)                                    |
| CRITICAL | Implement hooks generation   | stack-plugin-compiler.ts needs to generate hooks/hooks.json                                          | **DONE**                                                                     |
| CRITICAL | Validate stack plugins load  | Manual test: load compiled stack plugin in Claude Code, verify agents work                           | Not Started                                                                  |
| HIGH     | Improve error messages       | Better errors for: missing skill references, agent compilation failures, invalid config              | **DONE**                                                                     |
| HIGH     | Integration test suite       | Full pipeline test: compile-plugins -> validate -> compile-stack -> validate -> generate-marketplace | **DONE** (18 tests)                                                          |
| MEDIUM   | Verify skill refs in agents  | Compiled agents should have correct `skills:` array in frontmatter                                   | **DONE** (verified 4 agents in fullstack-react/work-stack)                   |
| MEDIUM   | Test compile-plugins --skill | Verify single-skill compilation works correctly                                                      | **DONE** (requires full path with author suffix; --all validation bug fixed) |
| LOW      | Document .prototype/ purpose | Clarify it's educational example, not production code                                                | **DONE**                                                                     |

**Integration Test Design (Review Before Implementation):**

```
Test 1: Full Skill Pipeline
  - Input: All 83 skills in src/skills/
  - Steps: compile-plugins -> validate all -> generate-marketplace
  - Assert: All plugins valid, marketplace has 83 entries, no errors

Test 2: Full Stack Pipeline
  - Input: All stacks (fullstack-react, mobx-tailwind, work-stack)
  - Steps: For each stack: compile-stack -> validate -> check agent frontmatter
  - Assert: All stacks compile, agents have skills array, README generated

Test 3: Marketplace Integrity
  - Input: Generated marketplace.json
  - Steps: Parse JSON, verify structure, check all pluginRoot paths resolve
  - Assert: All paths exist, schema valid, no duplicate names

Test 4: Roundtrip (Manual)
  - Steps: Install compiled plugin in ~/.claude/plugins/, run Claude Code
  - Assert: Agents appear in /agents, skills load when agent invoked
```

**Notes:**

- Tests 1-3 can be automated
- Test 4 requires manual verification (Claude Code runtime)
- Tests should be maintainable: use file counts, not hardcoded names
- Tests should fail fast with clear error messages

---

### 1. CLI Implementation

#### Phase A: Before Repo Split (Do Now)

> Complete these while skills and CLI live in same repo. Focus on making CLI work end-to-end.

| Order | Task                          | Description                                                                                                    | Status      |
| ----- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------- |
| A1    | Complete stack plugin on init | `cc init` creates complete plugin with skills folder + compiled agents. See "Stack Plugin Architecture" below. | **DONE**    |
| A2    | Implement recompileAgents     | `cc add` should automatically recompile agents after adding skill (TODO at add.ts:129)                         | **DONE**    |
| A3    | Manual testing                | Test all flows end-to-end (Phase 3 checklist)                                                                  | Not Started |
| A4    | Phase 4: Versioning           | Integer version + content hash on compile                                                                      | Not Started |
| A5    | Hooks in agent frontmatter    | Support PreToolUse/PostToolUse/Stop hooks in agent.yaml, generate hooks.json                                   | Not Started |
| A6    | `cc create skill`             | Scaffold new skill + `--generate` flag for inline agent invocation                                             | Not Started |
| A7    | `cc create agent`             | Scaffold new agent + `--generate` flag for inline agent invocation                                             | Not Started |
| A8    | Inline agent invocation       | Test `--agents` JSON flag with model/tools (see cli/CLI-AGENT-INVOCATION-RESEARCH.md)                          | Partial     |

#### Phase B: Repo Split (Milestone)

> Split into two repos: `claude-collective-cli` and `claude-collective-skills`

| Order | Task                     | Description                                                          | Status                      |
| ----- | ------------------------ | -------------------------------------------------------------------- | --------------------------- |
| B1    | CLI Repository Migration | Move CLI to `claude-collective-cli` repo (created 2026-01-22)        | Blocked (awaiting refactor) |
| B2    | Rename Repository        | Rename `claude-subagents` -> `claude-collective-skills`              | Not Started                 |
| B3    | Remote fetching refactor | Refactor compile scripts to use giget/source-fetcher for all content | Not Started                 |

**Note on B3:** Currently compile scripts use direct filesystem paths. After split, they must fetch agents/principles/templates from remote marketplace via giget. This is a medium refactor - needs `ContentProvider` abstraction. Wait until split to avoid premature abstraction.

#### Phase C: After Repo Split

> These require the CLI to fetch from remote marketplace.

| Order | Task                      | Description                                                             | Status                |
| ----- | ------------------------- | ----------------------------------------------------------------------- | --------------------- |
| C1    | Phase 6: Schema Dist      | GitHub raw URLs, SchemaStore PR                                         | Not Started           |
| C2    | Phase 7: Private Repos    | Configurable source, auth, pre-flight checks                            | Partial (config done) |
| C3    | Phase 8: Multi-Source     | Community + private skills composition                                  | Not Started           |
| C4    | Phase 9: Skill Reorg      | Separate PhotoRoom from community skills                                | Not Started           |
| C5    | Custom principles support | `cc customize --principles` for user-added principles merged on compile | Not Started           |
| C6    | `cc doctor`               | Diagnose connectivity/auth issues                                       | Not Started           |
| C7    | `cc eject`                | Local export or GitHub fork for full independence                       | Not Started           |

#### Lower Priority (Any Phase)

| Priority | Task                       | Description                                                                                                                  | Status                                     |
| -------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| High     | Investigate Claude tasks   | Research Claude Code's task system                                                                                           | **DONE** (RULES-TASKS-INTEGRATION-PLAN.md) |
| High     | Claude simplifier hook     | Add hook that simplifies/improves Claude's responses or workflow                                                             | Not Started                                |
| High     | Context forking for skills | Add `context: fork` + `agent:` frontmatter for isolated skill execution                                                      | Not Started                                |
| High     | Path-scoped rules          | Compile skills with `paths:` to `.claude/rules/` for intelligent context loading                                             | Not Started                                |
| Medium   | Stack-specific CLAUDE.md   | Handle per-stack CLAUDE.md files. Options: embed in config.yaml, use rules instead, or copy from stack folder during compile | Not Started                                |
| Medium   | Permission generation      | Generate permission rules from agent `tools:` definitions with wildcard support                                              | Not Started                                |
| Medium   | Progressive disclosure     | Restructure skills into Tier 1/2/3 for token-efficient loading                                                               | Not Started                                |
| Medium   | CLI branding               | ASCII art logo + animated mascot on startup                                                                                  | Not Started                                |
| Low      | Thinking budget per agent  | Add `recommended_thinking:` to agent.yaml, CLI sets MAX_THINKING_TOKENS on invoke                                            | Not Started                                |

### 2. Testing & CI/CD

| Priority | Task                           | Description                                                         | Status      |
| -------- | ------------------------------ | ------------------------------------------------------------------- | ----------- |
| High     | Manual skill/stack testing     | Manually test all 76 skills and 11 stacks for correctness           | Not Started |
| Medium   | Re-add schema to copied skills | Post-migration: inject schema path once CLI repo bundles the schema | Not Started |
| Medium   | Private repo blockers          | Bitbucket, Azure DevOps unsupported                                 | Document    |

### 3. Skills & Content

| Priority | Task                           | Description                                                                                                                                                                   | Status      |
| -------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| HIGH     | Rename skills remove brackets  | Remove parentheses from skill folder names: `react (@vince)` → `react @vince`. Update all stack configs and skills-matrix.yaml accordingly                                    | Not Started |
| HIGH     | Move reviewing skill category  | Move `shared/reviewing` to `meta/reviewing` or standalone `reviewing` category                                                                                                | Not Started |
| LOW      | Remove shared category         | Remove `shared` category from skills-matrix.yaml once reviewing is moved. Added as workaround.                                                                                | Not Started |
| Medium   | Skill ID: use frontmatter name | Currently using directory path as skill ID (workaround). Refactor to use `frontmatter.name` as canonical ID, update stack configs and skill_aliases to match. See note below. | Not Started |
| Medium   | `backend/ci-cd/github-actions` | Remove React Query, Zustand references (frontend libs in backend skill)                                                                                                       | Not Started |
| Medium   | `backend/analytics/posthog`    | Review Better Auth, Email references (non-`+` skill with cross-tech refs)                                                                                                     | Not Started |
| Low      | New skills (Critical)          | nx, docker, kubernetes, vite, svelte, supabase, AI SDKs                                                                                                                       | Backlog     |
| Low      | New skills (High)              | astro, firebase, clerk, cloudflare, terraform, etc.                                                                                                                           | Backlog     |
| Low      | Roadmap Phase 3-5              | background-jobs, caching, i18n, payments, etc.                                                                                                                                | Backlog     |

**Note on `+` skills:** Skills with `+` in the name (e.g., `backend/observability+axiom+pino+sentry`) are intentionally integrated "bridge" skills. Cross-tech references between the named technologies are expected and correct. Only **frontend** library references (React, React Query, Zustand) in backend skills are problematic.

**Note on skill ID workaround (2026-01-24):** Currently, skill IDs use the directory path (e.g., `frontend/framework/react (@vince)`) instead of `frontmatter.name` (e.g., `frontend/react (@vince)`). A `frontmatterToPath` mapping is built during matrix loading to resolve references in metadata.yaml files that use frontmatter names. The proper fix would be to use `frontmatter.name` as the canonical ID everywhere and update stack configs and skill_aliases to match. Files affected: `loader.ts` (`loadStackSkills`, `loadPluginSkills`) and `matrix-loader.ts` (`extractAllSkills`, `buildFrontmatterToPathMap`).

### 4. Versioning

> **IMPORTANT**: Skills, agents, and stacks are ALL plugins. Version goes in `plugin.json`, NOT `metadata.yaml`.
> The existing `versioning.ts` was built before the plugin-based architecture and needs refactoring.

| Priority | Task                         | Description                                                           | Status      |
| -------- | ---------------------------- | --------------------------------------------------------------------- | ----------- |
| High     | Refactor versioning.ts       | Output version to `plugin.json` instead of `metadata.yaml`            | Not Started |
| High     | Display version              | Show plugin version in CLI listings (`cc list`, marketplace)          | Not Started |
| High     | Pre-flight checks            | Token validation before download                                      | Not Started |
| Medium   | Unified plugin versioning    | Same versioning logic for skills, agents, and stacks                  | Not Started |
| Low      | Archive outdated schemas     | skills.schema.json, registry.schema.json                              | Not Started |
| Low      | Remove metadata.yaml version | Once plugin.json versioning is complete, remove version from metadata | Not Started |

### 5. Agent Output Formats

| Priority | Task                           | Description                                                                   | Status      |
| -------- | ------------------------------ | ----------------------------------------------------------------------------- | ----------- |
| High     | Agent-specific output formats  | Create tailored output formats for each agent instead of sharing generic ones | In Progress |
| High     | Claude rules                   | Add Claude rules configuration for agents                                     | Not Started |
| Medium   | Standardize output format tags | Ensure all output formats use consistent `<output_format>` XML tags           | Not Started |
| Medium   | Document output format system  | Document the cascading resolution (agent-level -> category-level)             | Not Started |

### 6. Documentation

| Priority | Task                      | Description                                 | Status      |
| -------- | ------------------------- | ------------------------------------------- | ----------- |
| Medium   | GitHub raw URLs           | Update `yaml-language-server` references    | Not Started |
| Medium   | SchemaStore PR            | Automatic IDE detection                     | Not Started |
| Medium   | Platform support docs     | GitHub, GitLab, GitHub Enterprise           | Not Started |
| Medium   | Unsupported platforms     | Bitbucket private, Azure DevOps, CodeCommit | Not Started |
| Low      | Generalize MobX skill     | Remove PhotoRoom-specific patterns          | Deferred    |
| Low      | Generalize Tailwind skill | Remove PhotoRoom-specific patterns          | Deferred    |
| Low      | Contribution guidelines   | For community skills                        | Not Started |
| Low      | Private skill guidelines  | For company-specific skills                 | Not Started |

**Note on skill generalization:** MobX and Tailwind (and other PhotoRoom-specific skills) cannot be generalized until: (1) private plugin infrastructure is set up, (2) existing PhotoRoom-specific skills are stored in a private plugin. Then we can create generalized community versions.

---

## Deferred / Won't Do

| Category      | Task                       | Description                                                         | Status     |
| ------------- | -------------------------- | ------------------------------------------------------------------- | ---------- |
| CLI           | `cc cache`                 | Cache management commands                                           | Won't Do   |
| CLI           | Config redundancy          | `frontend/react` appears 9x (CLI-generated, not user-facing)        | Won't Fix  |
| CLI           | Template refactoring       | Split agent.liquid into partials (moved to src/agents/\_templates/) | Deferred   |
| CLI           | Marketplace foundation     | Stack Marketplace Phase 1-2                                         | Deferred   |
| CLI           | Community submission       | `cc submit` flow                                                    | Deferred   |
| Testing       | Directory check bug        | False positive - CLI uses `fs-extra` correctly                      | Not a Bug  |
| Testing       | Path sanitization          | `.replace("/", "-")` works for current 1-slash IDs                  | Won't Fix  |
| Testing       | Verification scripts       | Superseded by `output-validator.ts`                                 | Superseded |
| Testing       | Content linting            | Skills can omit sections                                            | Deferred   |
| Testing       | Skill structure validation | Missing required sections undetected                                | Deferred   |
| Skills        | Skill ID inconsistency     | `frontend/react` vs `frontend-react`                                | Deferred   |
| Skills        | Skill bundles              | Issue #7 - not implemented                                          | Deferred   |
| Documentation | Voting system              | GitHub Discussions integration                                      | Deferred   |

---

## Totals

| Status          | Count |
| --------------- | ----- |
| **Outstanding** | 36    |
| **Deferred**    | 13    |
| **Completed**   | 36    |

---

## Decision Log

| Date       | Decision                         | Rationale                                                                                                                                                                |
| ---------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-01-24 | Plugin-based versioning          | Skills, agents, and stacks are ALL plugins. Version goes in `plugin.json`, NOT `metadata.yaml`. Single versioning model for all artifacts.                               |
| 2026-01-24 | Stack-based architecture         | Skills stored in `.claude-collective/stacks/` (project-local), single plugin at `.claude/plugins/claude-collective/` (project-local). `cc switch` for instant switching. |
| 2026-01-24 | Dual marketplace model           | Public marketplace (community, latest) + private/company marketplaces (pinned versions). Enables reproducibility and guardrails.                                         |
| 2026-01-24 | Agents as standalone plugins     | Agents don't embed skills; they reference them. One documentor for all stacks. `cc switch` recompiles with active stack's skills.                                        |
| 2026-01-24 | Version pinning via marketplace  | No `plugin@version` install syntax. Marketplace controls versions via `ref`/`sha` in marketplace.json. Maintainer is gatekeeper.                                         |
| 2026-01-24 | Skills/Agents/Stacks independent | Each versioned independently. No cascading bumps. Binding happens at switch/compile time, not publish time.                                                              |
| 2026-01-23 | Remote fetching after repo split | Compile scripts use local paths now; refactor to giget/source-fetcher AFTER repos split. Avoids premature abstraction.                                                   |
| 2026-01-23 | Phased task ordering             | Phase A (before split), B (split milestone), C (after split). Clear sequencing prevents blocked work.                                                                    |
| 2026-01-23 | Architecture finalized           | Marketplace is single source of truth; CLI is thin (no bundled content); `cc init` produces complete plugin with skills + agents                                         |
| 2026-01-23 | `.claude-collective/` deprecated | Removed - plugins output directly to `.claude/plugins/` (project-local); no intermediate source directory needed                                                         |
| 2026-01-23 | Lowest priority commands         | `cc remove`, `cc swap`, `cc outdated`, `cc customize` marked as lowest priority; focus on `cc init` and `cc add` first                                                   |
| 2026-01-23 | Network-based compilation        | All compilation fetches agents/principles/templates from marketplace; no bundled content in CLI                                                                          |
| 2026-01-23 | Plugin implementation complete   | 6 phases: Schema, Skill-as-Plugin, Marketplace, Stack, CLI, Testing, Docs                                                                                                |
| 2026-01-23 | Plugin as output format          | CLI compiles to plugin (not .claude/); same flow, output is distributable, versioned, installable                                                                        |
| 2026-01-23 | Eject for full independence      | `cc eject` (local) or `cc eject --fork` (GitHub) - (decided to implement, not yet built); no lock-in, fork preserves upstream connection                                 |
| 2026-01-22 | Pre-populate wizard for update   | `cc update` now starts with existing skills pre-selected, skips approach step                                                                                            |
| 2026-01-22 | Project-level config commands    | Added `cc config set-project` and `unset-project` for per-project source config                                                                                          |
| 2026-01-22 | Agent category organization      | Improved discoverability; 7 categories: developer, reviewer, researcher, planning, pattern, meta, tester                                                                 |
| 2026-01-22 | No `cc cache` command            | giget handles caching internally; `--refresh` flag for edge cases                                                                                                        |
| 2026-01-22 | Inline agent invocation via CLI  | `--agents` JSON flag verified working; no file writes needed                                                                                                             |
| 2026-01-21 | Keep relationship-centric matrix | Authoring is easier; skill-centric view computed at runtime                                                                                                              |
| 2026-01-21 | While-loop wizard                | Simpler than action/reducer; better for MVP                                                                                                                              |
| 2026-01-21 | Integer versioning               | Zero friction; semver overkill for markdown skills                                                                                                                       |
| 2026-01-21 | Document giget limitations       | Bitbucket private, Azure DevOps unsupported                                                                                                                              |

---

## Quick Reference

### Run CLI

```bash
bun src/cli/index.ts init
bun src/cli/index.ts add
bun src/cli/index.ts update
```

### Compile Plugins

```bash
# Compile all skills to plugins
bun src/cli/index.ts compile-plugins

# Compile specific stack to plugin
bun src/cli/index.ts compile-stack -s fullstack-react

# Generate marketplace
bun src/cli/index.ts generate-marketplace

# Validate plugins
bun src/cli/index.ts validate dist/plugins --all

# Bump version
bun src/cli/index.ts version patch
```

### Compile Agents

```bash
cc switch home-stack && cc compile
cc switch work-stack && cc compile
```

### Test Matrix Loading

```bash
bun src/cli/index.ts init  # Loads 76 skills, 11 stacks
```

### Test Inline Agent Invocation (2026-01-22 Discovery)

See `CLI-AGENT-INVOCATION-RESEARCH.md` for full details.

```bash
# VERIFIED WORKING - Basic test via CLI
bun src/cli/index.ts test-agent

# VERIFIED WORKING - Direct invocation
claude --agents '{"test": {"description": "Test agent", "prompt": "You are a test agent. Say hello."}}' --agent test -p "Hello"

# TODO: Test with model and tools restrictions
claude --agents '{"test": {"description": "Test", "prompt": "List files in current directory", "model": "haiku", "tools": ["Bash"]}}' --agent test -p "List files"

# TODO: Test with full skill-summoner content (~2000 lines)
```

**Verified (2026-01-22):**

- CLI subprocess inherits Claude auth
- `--agents` JSON flag works for inline agent definitions
- `--agent` flag can reference inline-defined agents
- `-p` flag works for non-interactive mode

**Remaining questions:**

1. Does `--agents` JSON accept `model` and `tools` fields?
2. Are tool restrictions enforced?
3. Does it work with large prompts (~2000 lines)?

---

# Completed Tasks

## CLI Implementation (Completed)

| Task                      | Description                                          | Completed           |
| ------------------------- | ---------------------------------------------------- | ------------------- |
| Fix doc inconsistencies   | pluginRoot paths (./plugins vs ./dist/plugins) fixed | 2026-01-23          |
| Plugin Output Format      | CLI outputs plugins instead of .claude/              | 2026-01-23          |
| Skill Plugin Compiler     | 83 skills compiled to individual plugins             | 2026-01-23          |
| Stack Plugin Compiler     | Stacks compile as plugins with agent references      | 2026-01-23          |
| Marketplace Generator     | marketplace.json with all 83 skill plugins           | 2026-01-23          |
| Plugin Validator          | Validates plugin structure, manifest, frontmatter    | 2026-01-23          |
| Version Command           | cc version patch/minor/major/set                     | 2026-01-23          |
| CLI Refactor              | Apply findings from 12-agent code review             | 2026-01-22          |
| `.claude-collective/` Dir | Separate source stacks from `.claude/` output        | 2026-01-22          |
| Phase 5: Validation       | Comprehensive metadata.yaml validation               | `cc validate`       |
| `cc validate`             | Validate selections against matrix                   | metadata validation |
| Agent categories          | Organize agents by category                          | 2026-01-22          |
| SIGINT handler            | Graceful Ctrl+C                                      | Done                |
| `--dry-run` flag          | Preview without executing                            | Done                |
| Exit codes                | Define 4 codes (currently only 0/1)                  | Done                |
| Pre-populate wizard       | `cc update` shows current selections                 | Done                |
| Parity verification       | Old compile.ts vs new CLI                            | Done                |
| Configuration system      | Global + project config files                        | Done                |

## Testing & CI/CD (Completed)

| Task                          | Description                                         | Completed        |
| ----------------------------- | --------------------------------------------------- | ---------------- |
| Test suite                    | 10 test files, 138 tests (Vitest)                   | Done             |
| CI/CD pipeline                | GitHub Actions + Husky pre-commit                   | Done             |
| Schema paths in copied skills | `skill-copier.ts` removes schema comment on copy    | Done             |
| Pre-commit hooks              | Husky runs lint-staged (Prettier) + `bun test`      | Done             |
| Compiled output validation    | Validates XML tags, frontmatter, template artifacts | Done             |
| Schema validation             | IDE-only, no runtime Zod                            | Done (AJV added) |

## Versioning (Partially Complete - Needs Refactor)

> **Note (2026-01-24)**: The versioning implementation below predates the plugin-based architecture.
> Skills, agents, and stacks are ALL plugins now. Version should be in `plugin.json`, NOT `metadata.yaml`.
> The `versioning.ts` file needs refactoring to output to `plugin.json` instead.

| Task                            | Description                              | Status                                                      |
| ------------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `skill-frontmatter.schema.json` | Validate SKILL.md frontmatter            | Done                                                        |
| `agent.schema.json`             | Validate compiled agent frontmatter      | Done (EXISTS at `src/schemas/`)                             |
| Update schema                   | `metadata.yaml` integer version          | Done but **OUTDATED** - version should be in plugin.json    |
| Compiler auto-increment         | Version bump on hash change              | Done but **NEEDS REFACTOR** (`versioning.ts` → plugin.json) |
| Plugin-based versioning         | Version in `plugin.json` for all plugins | **NOT STARTED**                                             |

## CLI Implementation (Phase 1-3) - Complete

- [x] `cc init` - Creates .claude/, copies skills
- [x] `cc compile` - Compiles agents with skills
- [x] `cc add` - Add additional stacks after init
- [x] `cc update` - Update existing stack's skill selection
- [x] `src/cli/lib/hash.ts` - content hashing utility
- [x] `src/cli/lib/skill-copier.ts` - copy skills to local stack
- [x] `src/cli/lib/stack-config.ts` - stack config handling
- [x] `src/cli/lib/stack-creator.ts` - shared stack creation logic

## Configuration System (2026-01-22)

Full configuration system for CLI-skills communication:

- `cc config show` - Show effective configuration with precedence chain
- `cc config set <key> <value>` - Set project config (`.claude-collective/config.yaml`)
- `cc config set-project <key> <value>` - Set project config (`.claude-collective/config.yaml`)
- `cc config get <key>` - Get resolved config value
- `cc config unset <key>` - Remove global config value
- `cc config unset-project <key>` - Remove project config value
- `cc config path` - Show config file paths
- `--source` flag on `init`, `add`, `update` commands
- `CC_SOURCE` environment variable support
- Precedence: flag > env > project > global > default
- Default source: `github:claude-collective/skills`

## Agent Category Reorganization (2026-01-22)

Completed the reorganization of agents into semantic categories:

**Before:**

```
src/agents/
├── frontend-developer/
├── backend-developer/
├── pm/
└── ...
```

**After:**

```
src/agents/
├── _principles/           # Shared principles (formerly core-prompts)
├── _templates/            # LiquidJS templates
├── developer/
│   ├── frontend-developer/
│   └── backend-developer/
├── reviewer/
│   ├── frontend-reviewer/
│   └── backend-reviewer/
├── researcher/
│   ├── frontend-researcher/
│   └── backend-researcher/
├── planning/
│   ├── pm/
│   ├── architecture/
│   └── orchestrator/
├── pattern/
│   ├── pattern-scout/
│   └── pattern-critique/
├── meta/
│   ├── agent-summoner/
│   ├── skill-summoner/
│   └── documentor/
└── tester/
    └── tester-agent/
```

**Changes made:**

- Moved all 15 agents into 7 category directories
- Moved `core-prompts/` to `agents/_principles/`
- Moved `templates/` to `agents/_templates/`
- Updated compiler to handle nested category structure
- Updated all documentation references
- Validated compilation still works

## Versioning & Provenance (2026-01-22)

- [x] `forked_from` provenance tracking - Added to metadata.schema.json
- [x] `skill-copier.ts` - Injects forked_from when copying skills
- [x] All 35 existing stack skills updated with forked_from metadata

## Skills Research

- [x] All 76 skills researched and aliases verified
- [x] Matrix loader connected - uses full skill extraction
- [x] 11 pre-built stacks validate correctly
- [x] 99.5% of automated tests pass

## Architecture Decisions

- [x] Versioning: Content-hash + date hybrid (decided)
- [x] Skills-matrix structure: Keep relationship-centric (decided)
- [x] CLI architecture: While-loop wizard beats action/reducer (decided)

---

# Reference Documentation

> The sections below contain implementation details, specifications, and architectural context.

---

## Versioning System Specification

> **Architecture Update (2026-01-24)**: Skills, agents, and stacks are ALL plugins.
> Version lives in `plugin.json`, NOT in `metadata.yaml` or SKILL.md frontmatter.
> The existing `versioning.ts` predates this architecture and needs refactoring.

### Target Format (Plugin-Based)

```json
// In plugin.json (all plugins: skills, agents, stacks)
{
  "name": "skill-react",
  "version": "1.0.4",
  "description": "Component architecture, hooks, patterns",
  "content_hash": "a1b2c3d"
}
```

### Key Principles

1. **Skills are plugins** - Each skill compiles to a plugin with its own `plugin.json`
2. **Agents are plugins** - Each compiled agent is a plugin with its own `plugin.json`
3. **Stacks are plugins** - Each stack is a plugin that references skill/agent plugins
4. **Version in one place** - `plugin.json` is the single source of truth for version
5. **Content hash for change detection** - Hash detects actual content changes

### Implementation Status

- Hash utility: **DONE** (`src/cli/lib/hash.ts`)
- Versioning logic: **NEEDS REFACTOR** (`src/cli/lib/versioning.ts` outputs to `metadata.yaml`)
- Target: Versioning should update `plugin.json` during `cc compile-plugins`, `cc compile-stack`

### Migration Path

1. During `compile-plugins`: Generate `plugin.json` with version, bump on content change
2. During `compile-stack`: Generate `plugin.json` for the stack plugin
3. Remove version field from `metadata.yaml` (keep for backward compatibility initially)
4. Update CLI display to read version from `plugin.json`

---

## Directory Structure (User's Project)

After running `cc init --name home-stack` + `cc init --name work-stack`:

```
my-project/
├── .claude-collective/              # SOURCE (our domain, project-local)
│   ├── config.yaml                  # active_stack, source
│   └── stacks/
│       ├── home-stack/
│       │   └── skills/
│       │       ├── react/SKILL.md
│       │       └── zustand/SKILL.md
│       └── work-stack/
│           └── skills/
│               ├── react/SKILL.md
│               └── hono/SKILL.md
│
├── .claude/
│   └── plugins/
│       └── claude-collective/       # OUTPUT (Claude Code's domain, project-local)
│           ├── .claude-plugin/plugin.json
│           ├── agents/              # Compiled agents
│           │   ├── frontend-developer.md
│           │   └── backend-developer.md
│           └── skills/              # Active stack's skills (copied on switch)
│               ├── react/SKILL.md
│               └── zustand/SKILL.md
│
├── src/
└── package.json
```

**Key principles:**

- `.claude-collective/` and `.claude/plugins/claude-collective/` are both project-local (siblings)
- Skills are namespaced by stack: `.claude-collective/stacks/{name}/skills/`
- `cc switch` copies skills from stack to plugin
- No global paths (`~/`) - everything is in the project directory

See `.claude/research/findings/v2/CLAUDE-COLLECTIVE-DIRECTORY-IMPLEMENTATION.md` for full implementation plan.

---

## Phase 7: Private Repository Support (Detailed)

### 7.1 Configuration

```yaml
# .claude-collective/config.yaml (project-local)
source: github.com/mycompany/private-skills

# .claude/cc-config.yaml (project - overrides global)
source: github.com/team/team-skills
```

**Precedence**: CLI flag > Project config > Global config > Env var > Default

### 7.2 CLI Changes

- `--source <url>` flag on `cc init`, `cc add`, `cc update`
- `cc config set source <url>` - set source URL
- `cc config get source` - show current source
- `cc config show` - show all effective configuration

### 7.3 Authentication

| Method            | Environment Variable    | Notes                   |
| ----------------- | ----------------------- | ----------------------- |
| giget native      | `GIGET_AUTH`            | Primary method          |
| GitHub fallback   | `GITHUB_TOKEN`          | Auto-detected           |
| Corporate proxy   | `FORCE_NODE_FETCH=true` | Node 20+ bug workaround |
| Self-signed certs | `NODE_EXTRA_CA_CERTS`   | Path to CA bundle       |

### 7.4 Error Mapping

| HTTP Code | User Message                                               |
| --------- | ---------------------------------------------------------- |
| 401       | "Authentication required. Set GIGET_AUTH or GITHUB_TOKEN"  |
| 403       | "Access denied. Check token permissions (needs repo read)" |
| 404       | "Repository not found or private. Check URL and auth"      |

---

## Phase 8: Multi-Source Composition (Detailed)

### 8.1 Configuration

```yaml
# .claude-collective/config.yaml (project-local)
sources:
  - url: github.com/claude-collective/skills
    name: Community
  - url: github.com/company/private-skills
    name: Company
    auth_env: GITHUB_TOKEN
```

### 8.2 Matrix Merging Rules

1. Fetch `skills-matrix.yaml` from each source
2. Merge categories (private extends/overrides public)
3. Merge `skill_aliases` with source tagging
4. Merge relationships (`conflicts`, `recommends`, `requires`)
5. Handle naming conflicts (prefix with source name)

### 8.3 Wizard Visual Separation

```
-- Framework ----------------------------------------
|  Community                                     |
|  * React @vince                                |
|  * Vue @vince                                  |
|                                                |
|  -----------------------------------------     |
|                                                |
|  Company (Private)                             |
|  * React + Company Patterns @company           |
-------------------------------------------------
```

### 8.4 Edge Cases to Resolve

- Same skill in both sources - Namespace with source prefix or error?
- Private source unreachable - Graceful degradation or hard fail?
- Schema version mismatch - Version check before merge?

---

## Phase 9: Skill Repository Reorganization (Detailed)

### 9.1 PhotoRoom Skills to Migrate

**Criteria for private repo:**

- Skills with `@photoroom` author
- Company-specific patterns, conventions, internal tooling
- References to internal APIs or services

### 9.2 Community Skills Criteria

**Must be:**

- No company-specific conventions
- Follows official library documentation
- Useful to broader developer community
- Author tagged as `@vince` or community contributor

**Skills to generalize:**

- MobX - General patterns (remove PhotoRoom conventions)
- Tailwind - General patterns (remove PhotoRoom conventions)

---

## Stack Plugin Architecture (NEW)

> **Goal:** `cc init` creates a complete stack plugin with skills embedded and agents compiled

### Target Structure

When user runs `cc init` and selects skills/stack:

```
.claude/plugins/claude-collective/    # Project-local
├── .claude-plugin/
│   └── plugin.json               # Stack manifest
├── agents/                       # Compiled agents
│   ├── frontend-developer.md
│   ├── backend-developer.md
│   └── ...
└── skills/                       # Skills from active stack (copied on switch)
    ├── react/
    │   └── SKILL.md
    ├── zustand/
    └── ...
```

### Key Points

1. **Skills live inside the stack** - copied to `skills/` folder, not external references
2. **Skills can evolve together** - become cohesive, reference each other within the stack
3. **Versioning** - follows Claude Code's plugin versioning system
4. **Independent updates** - `cc update skill-react` updates that skill within the stack

### `cc init` Flow

1. User selects skills or pre-built stack
2. Create stack folder at `.claude-collective/stacks/{stack-name}/`
3. Copy selected skills to stack's `skills/` folder
4. Create plugin folder at `.claude/plugins/claude-collective/`
5. Copy skills to plugin's `skills/` folder
6. Compile agents to plugin's `agents/` folder
7. Generate `.claude-plugin/plugin.json` manifest

### New Commands

| Command                   | Description                                           |
| ------------------------- | ----------------------------------------------------- |
| `cc init`                 | Creates complete stack plugin (skills + agents)       |
| `cc add skill-react`      | Adds skill to stack, recompiles agents                |
| `cc remove skill-zustand` | Removes skill from stack, recompiles agents           |
| `cc swap skill-A skill-B` | Swaps skills, recompiles agents                       |
| `cc update skill-react`   | Updates single skill from upstream, recompiles agents |
| `cc update --all`         | Updates all skills, recompiles agents                 |
| `cc outdated`             | Shows which skills have newer versions available      |

### Skill Changes Require Recompilation

Because skills are embedded in compiled agents, **any skill change triggers recompilation**:

- `cc add` → updates config, copies skill, **recompiles agents**
- `cc remove` → updates config, removes skill, **recompiles agents**
- `cc swap` → updates config, swaps skills, **recompiles agents**
- `cc update` → fetches latest, replaces skill, **recompiles agents**

### Benefits

- Complete plugin created in one step
- Skills can be customized per-stack
- Skills evolve together as cohesive unit
- Agents always have latest embedded skill content

---

## Custom Principles (NEW)

> **Goal:** Allow users to add custom principles without exposing full templating system

### Why Not Full Eject?

Full eject would expose LiquidJS templates and agent configs, making users responsible for:

- Maintaining template syntax
- Merging upstream template changes
- Understanding compilation internals

**Custom principles** gives 80% of the benefit with 20% of the complexity.

### Structure

```
.claude/plugins/claude-collective/    # Project-local
├── .claude-plugin/plugin.json
├── agents/                       # Compiled agents (output)
├── skills/                       # Skills from active stack
├── _principles/                  # CUSTOM: User's principles
│   └── custom/                   # Only this folder is user-editable
│       ├── company-guidelines.md
│       ├── security-rules.md
│       └── code-standards.md
├── CLAUDE.md
└── README.md
```

### Command

```bash
# Enable custom principles for a stack
cc customize --principles

# This creates _principles/custom/ folder
# User adds .md files with their principles
# Next compile merges custom + built-in principles
```

### How It Works

1. **`cc customize --principles`**
   - Creates `_principles/custom/` folder in stack
   - Copies a template `README.md` explaining how to add principles

2. **`cc compile`** (with custom principles)
   - Loads built-in principles (core.md, code-quality.md, etc.)
   - Loads ALL `.md` files from `_principles/custom/`
   - Merges into compiled agents (custom principles injected after built-in)

3. **Principle file format**

   ```markdown
   # Company Security Guidelines

   <critical_requirements>

   - All API calls must use the internal auth wrapper
   - Never expose internal service URLs in client code
   - Use environment variables for all secrets
     </critical_requirements>

   ## Approved Libraries

   - Authentication: @company/auth-sdk
   - HTTP client: @company/fetch-wrapper
   ```

### What Users CAN'T Do (Intentionally)

- Modify built-in principles (they get updated with `cc update`)
- Access or modify LiquidJS templates
- Change agent compilation structure
- Modify agent configs directly

### What Users CAN Do

- Add unlimited custom principle files
- Inject company-specific guidelines
- Add project-specific rules
- Override behavior with `<critical_requirements>` tags

### Benefits

- Simple: just add markdown files
- Safe: can't break compilation
- Updatable: built-in principles still update normally
- Powerful: principles are injected into ALL agents

---

## CLI Command Specifications

### `cc init`

```
cc init
    |
    v
------------------------------
|  Select a stack or build    |
|  > Use pre-built stack      |
|    Build custom stack       |
------------------------------
    | (wizard)
    v
Creates:
  .claude/stacks/{name}/config.yaml
  .claude/stacks/{name}/skills/...
```

**Detection:** If `.claude/stacks/` exists - "Already initialized. Use `cc add` or `cc update`"

### `cc add`

```
cc add
    |
    v
------------------------------
|  Stack name: my-new-stack   |
|  (validates kebab-case)     |
------------------------------
    | (same wizard as init)
    v
Creates new stack in .claude/stacks/
```

### `cc update`

```
cc update
    |
    v
------------------------------
|  Your Stacks                |
|  > home-stack (25 skills)   |
|    work-stack (18 skills)   |
------------------------------
    | (select)
    v
------------------------------
|  Same wizard UI as init     |
|  (Pre-populated with        |
|   current selections)       |
------------------------------
```

### `cc create skill`

```
cc create skill <category>/<name>
    |
    v
Creates:
  src/skills/<category>/<name> (@author)/
    ├── metadata.yaml    # Template with TODOs
    ├── SKILL.md         # Empty template with sections
    ├── reference.md     # Empty
    └── examples/
        └── .gitkeep
    |
    v
Outputs prompt for Claude Code:
  "Use the skill-summoner agent to flesh out <category>/<name>"
```

**Note:** The CLI only scaffolds. AI-generated content requires Claude Code with the `skill-summoner` agent.

### `cc create agent`

```
cc create agent <name>
    |
    v
Creates:
  src/agents/{category}/<name>/
    └── agent.yaml       # Template with TODOs
    |
    v
Outputs prompt for Claude Code:
  "Use the agent-summoner agent to design the <name> agent"
```

**Note:** The CLI only scaffolds. AI-generated content requires Claude Code with the `agent-summoner` agent.

---

## Exit Codes

| Code | Meaning                 |
| ---- | ----------------------- |
| 0    | Success                 |
| 1    | General error           |
| 2    | Invalid arguments       |
| 3    | Network/auth error      |
| 4    | User cancelled (Ctrl+C) |
