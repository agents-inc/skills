# Completed Tasks

> **Purpose**: Archive of all completed work. Moved from TODO.md for cleaner tracking.
> **Last Updated**: 2026-01-26

---

## Plugin Distribution - Production Readiness

| Task                         | Description                                                                                          | Completed |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | --------- |
| Compile ALL stacks           | Test `cc compile-stack` for all stacks (fullstack-react, work-stack)                                 | Done      |
| Implement hooks generation   | stack-plugin-compiler.ts needs to generate hooks/hooks.json                                          | Done      |
| Validate stack plugins load  | Manual test: load compiled stack plugin in Claude Code, verify agents work                           | Done      |
| Improve error messages       | Better errors for: missing skill references, agent compilation failures, invalid config              | Done      |
| Integration test suite       | Full pipeline test: compile-plugins -> validate -> compile-stack -> validate -> generate-marketplace | Done      |
| Verify skill refs in agents  | Compiled agents should have correct `skills:` array in frontmatter                                   | Done      |
| Test compile-plugins --skill | Verify single-skill compilation works correctly                                                      | Done      |
| Document .prototype/ purpose | Clarify it's educational example, not production code                                                | Done      |

---

## CLI Implementation

| Task                      | Description                                          | Completed  |
| ------------------------- | ---------------------------------------------------- | ---------- |
| Fix doc inconsistencies   | pluginRoot paths (./plugins vs ./dist/plugins) fixed | 2026-01-23 |
| Plugin Output Format      | CLI outputs plugins instead of .claude/              | 2026-01-23 |
| Skill Plugin Compiler     | 83 skills compiled to individual plugins             | 2026-01-23 |
| Stack Plugin Compiler     | Stacks compile as plugins with agent references      | 2026-01-23 |
| Marketplace Generator     | marketplace.json with all 83 skill plugins           | 2026-01-23 |
| Plugin Validator          | Validates plugin structure, manifest, frontmatter    | 2026-01-23 |
| Version Command           | cc version patch/minor/major/set                     | 2026-01-23 |
| CLI Refactor              | Apply findings from 12-agent code review             | 2026-01-22 |
| `.claude-collective/` Dir | Separate source stacks from `.claude/` output        | 2026-01-22 |
| Phase 5: Validation       | Comprehensive metadata.yaml validation               | Done       |
| `cc validate`             | Validate selections against matrix                   | Done       |
| Agent categories          | Organize agents by category                          | 2026-01-22 |
| SIGINT handler            | Graceful Ctrl+C                                      | Done       |
| `--dry-run` flag          | Preview without executing                            | Done       |
| Exit codes                | Define 4 codes (currently only 0/1)                  | Done       |
| Pre-populate wizard       | `cc update` shows current selections                 | Done       |
| Parity verification       | Old compile.ts vs new CLI                            | Done       |
| Configuration system      | Global + project config files                        | Done       |
| Phase 4: Versioning       | Integer version + content hash on compile            | Done       |

---

## CLI Implementation (Phase 1-3)

- [x] `cc init` - Creates .claude/, copies skills
- [x] `cc compile` - Compiles agents with skills
- [x] `cc edit` - Edit skills in active stack (replaced `cc add`)
- [x] `cc update` - Update existing stack's skill selection
- [x] `cc switch` - Switch between stacks (with optional interactive selector)
- [x] `cc list` - List all stacks with active marker and skill counts
- [x] `src/cli/lib/hash.ts` - content hashing utility
- [x] `src/cli/lib/skill-copier.ts` - copy skills to local stack
- [x] `src/cli/lib/stack-config.ts` - stack config handling
- [x] `src/cli/lib/stack-creator.ts` - shared stack creation logic
- [x] `src/cli/lib/stack-list.ts` - shared stack listing utility
- [x] `src/cli/lib/stack-skills.ts` - map installed skills to IDs

---

## Phase A

| Task                          | Description                                                   | Completed  |
| ----------------------------- | ------------------------------------------------------------- | ---------- |
| A1: Stack plugin on init      | `cc init` creates complete plugin with skills + agents        | 2026-01-24 |
| A2: Implement recompileAgents | `cc edit` automatically recompiles agents after skill changes | 2026-01-24 |
| A3: Manual testing            | All 18 tests pass (MANUAL-TESTING-GUIDE.md)                   | 2026-01-24 |

---

## Skills Matrix Verification

| Task                          | Description                                                     | Completed  |
| ----------------------------- | --------------------------------------------------------------- | ---------- |
| Round 1: Initial Verification | 9 agents verified 60+ relationships across all categories       | 2026-01-25 |
| Round 2: Adversarial Review   | 9 role-assigned agents challenged claims with different sources | 2026-01-25 |
| Apply Round 1 Changes         | Updated conflicts, discourages, requires, recommends sections   | 2026-01-25 |
| Apply Round 2 Changes         | Fixed Apollo/Svelte/Solid, SWR+RN, MobX, Jotai, Vitest+RN       | 2026-01-25 |

**Key fixes applied:**

- Removed stale svelte/solidjs from `graphql-apollo` requires (bindings from 2020-2022)
- Added SWR React Native wrapper caveat
- Added MobX Vue/Angular bindings note
- Added Jotai to React state alternatives
- Added Vitest/Jest React Native caveat
- Updated reason texts to acknowledge framework-agnostic cores

---

## Testing & CI/CD

| Task                          | Description                                         | Completed |
| ----------------------------- | --------------------------------------------------- | --------- |
| Test suite                    | 10 test files, 138 tests (Vitest)                   | Done      |
| CI/CD pipeline                | GitHub Actions + Husky pre-commit                   | Done      |
| Schema paths in copied skills | `skill-copier.ts` removes schema comment on copy    | Done      |
| Pre-commit hooks              | Husky runs lint-staged (Prettier) + `bun test`      | Done      |
| Compiled output validation    | Validates XML tags, frontmatter, template artifacts | Done      |
| Schema validation             | IDE-only, no runtime Zod                            | Done      |

---

## Versioning

| Task                            | Description                                    | Completed |
| ------------------------------- | ---------------------------------------------- | --------- |
| `skill-frontmatter.schema.json` | Validate SKILL.md frontmatter                  | Done      |
| `agent.schema.json`             | Validate compiled agent frontmatter            | Done      |
| Update plugin.schema.json       | Integer version, content_hash, updated fields  | Done      |
| Compiler auto-increment         | Version bump on hash change in plugin.json     | Done      |
| Plugin-based versioning         | Version in `plugin.json` for skills AND stacks | Done      |
| Refactor versioning.ts          | Output version to `plugin.json`                | Done      |
| Display version                 | Show plugin version in CLI listings            | Done      |
| Unified plugin versioning       | Same versioning logic for skills/agents/stacks | Done      |

---

## Configuration System (2026-01-22)

Full configuration system for CLI-skills communication:

- `cc config show` - Show effective configuration with precedence chain
- `cc config set <key> <value>` - Set project config
- `cc config set-project <key> <value>` - Set project config
- `cc config get <key>` - Get resolved config value
- `cc config unset <key>` - Remove global config value
- `cc config unset-project <key>` - Remove project config value
- `cc config path` - Show config file paths
- `--source` flag on `init`, `add`, `update` commands
- `CC_SOURCE` environment variable support
- Precedence: flag > env > project > global > default
- Default source: `github:claude-collective/skills`

---

## Agent Category Reorganization (2026-01-22)

Completed the reorganization of agents into semantic categories:

```
src/agents/
├── _templates/            # LiquidJS templates (includes embedded core principles)
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
│   └── architecture/
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

---

## Versioning & Provenance (2026-01-22)

- [x] `forked_from` provenance tracking - Added to metadata.schema.json
- [x] `skill-copier.ts` - Injects forked_from when copying skills
- [x] All 35 existing stack skills updated with forked_from metadata

---

## Skills Research

- [x] All 76 skills researched and aliases verified
- [x] Matrix loader connected - uses full skill extraction
- [x] 11 pre-built stacks validate correctly
- [x] 99.5% of automated tests pass

---

## Architecture Decisions

- [x] Versioning: Content-hash + date hybrid (decided)
- [x] Skills-matrix structure: Keep relationship-centric (decided)
- [x] CLI architecture: While-loop wizard beats action/reducer (decided)

---

## Skills & Content

| Task                           | Description                                        | Completed  |
| ------------------------------ | -------------------------------------------------- | ---------- |
| Move reviewing skill category  | Move `shared/reviewing` to `meta/reviewing`        | Done       |
| Remove shared category         | Remove `shared` category from skills-matrix.yaml   | Done       |
| Skill ID: use frontmatter name | Refactor to use `frontmatter.name` as canonical ID | 2026-01-25 |
| `backend/ci-cd/github-actions` | Remove React Query, Zustand references             | Done       |
| `backend/analytics/posthog`    | Review Better Auth, Email references               | Done       |

---

## Agent Output Formats

| Task                           | Description                                                       | Completed |
| ------------------------------ | ----------------------------------------------------------------- | --------- |
| Agent-specific output formats  | Create tailored output formats for each agent                     | Done      |
| Standardize output format tags | Ensure all output formats use consistent `<output_format>` tags   | Done      |
| Document output format system  | Document the cascading resolution (agent-level -> category-level) | Done      |

---

## Lower Priority (Resolved)

| Task                        | Description                                               | Resolution                       |
| --------------------------- | --------------------------------------------------------- | -------------------------------- |
| Investigate Claude tasks    | Research Claude Code's task system                        | Done (RULES-TASKS-INTEGRATION)   |
| Permission generation       | Generate permission rules from agent `tools:` definitions | Done (informational only)        |
| Progressive disclosure      | Restructure skills into Tier 1/2/3                        | Done (Claude Code handles this)  |
| Thinking budget per agent   | Add `recommended_thinking:` to agent.yaml                 | Done (default is max)            |
| Agent frontmatter skills    | Fix skill ID resolution in compiled agents                | Done (2026-01-25)                |
| Edit wizard deselection bug | Cannot deselect skills with dependents                    | Done (cascade with confirmation) |

---

## Won't Do

| Task                          | Description                                | Reason                                             |
| ----------------------------- | ------------------------------------------ | -------------------------------------------------- |
| `cc create skill/agent`       | Network-fetch summoners on demand          | Users install summoners as optional agents instead |
| `cc cache`                    | Cache management commands                  | giget handles caching internally                   |
| Config redundancy             | `frontend/react` appears 9x                | CLI-generated, not user-facing                     |
| Stack-specific CLAUDE.md      | Handle per-stack CLAUDE.md files           | CLAUDE.md is for universal conventions             |
| Rename skills remove brackets | Remove parentheses from skill folder names | `(@author)` conflicts with npm scopes/decorators   |
