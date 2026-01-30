# Completed Tasks

> **Purpose**: Archive of all completed work. Moved from TODO.md for cleaner tracking.
> **Last Updated**: 2026-01-30

---

## Triad & Agent Renaming (2026-01-30)

> Human + AI collaboration tasks and domain prefix migration completed.

### Triad Tasks

| Task                             | Description                                           | Completed  |
| -------------------------------- | ----------------------------------------------------- | ---------- |
| Finish CLI skills & subagents    | Complete setup of CLI skills and subagent definitions | 2026-01-30 |
| Meta-review CLI skills & agents  | Review CLI skills/agents with meta agents before use  | 2026-01-30 |
| Audit CLI repo with CLI reviewer | Run CLI reviewer subagent on `/home/vince/dev/cli`    | 2026-01-30 |
| Implement refactors via CLI dev  | Execute approved refactors using CLI developer agent  | 2026-01-30 |

### Agent Domain Prefix Migration

| Task                        | Description                                        | Completed  |
| --------------------------- | -------------------------------------------------- | ---------- |
| Rename agents domain prefix | `frontend-developer` → `web-frontend-developer`   | 2026-01-30 |
| Update stack agent refs     | Update all stack configs with new agent names      | 2026-01-30 |
| Update agent compilation    | Ensure compiler uses domain-prefixed agent names   | 2026-01-30 |
| Update agent partials       | Update partials to reference new agent names       | 2026-01-30 |
| CLI skill name refs         | Update CLI TypeScript refs to new skill paths      | 2026-01-30 |

---

## Dual-Repo Architecture & CLI Migration (2026-01-29)

> **Tracking file**: `.claude/research/findings/v2/DUAL-REPO-ARCHITECTURE.md`

All 6 phases of dual-repo architecture complete. CLI at `/home/vince/dev/cli`, skills in this repo.

| Task                                  | Description                                                                             | Completed  |
| ------------------------------------- | --------------------------------------------------------------------------------------- | ---------- |
| B1 CLI Repository                     | CLI moved to separate repo at `/home/vince/dev/cli`, all phases implemented             | 2026-01-29 |
| B2 Rename Repository                  | Repository renamed to `claude-collective/skills` via `gh repo rename`                   | 2026-01-29 |
| B3 Remote fetching                    | giget integration in source-fetcher.ts, tested locally                                  | 2026-01-29 |
| C7 `cc eject`                         | `cc eject templates`, `cc eject skills`, `cc eject config`, `cc eject all` implemented  | 2026-01-29 |
| Dual-repo architecture                | Phases 1-6 complete. See `DUAL-REPO-ARCHITECTURE.md` and knowledge base                 | 2026-01-29 |
| Bundle templates in CLI               | Templates bundled at `src/agents/_templates/agent.liquid` in CLI repo                   | 2026-01-29 |
| `cc eject` command                    | Full eject system: templates, skills, config, all                                       | 2026-01-29 |
| Update stacks with methodology skills | Added methodology skills to fullstack-react, modern-react, enterprise-react, work-stack | 2026-01-29 |

**Removed tasks (no longer applicable):**

| Task                      | Reason                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| C8 Agent plugins          | Agents are compiled output, not marketplace plugins. Only Skills and Stacks distributable. |
| C9 `cc add <agent>`       | Agents compiled from templates + skills, not installed individually.                       |
| C10 Essential vs optional | All agents compiled locally from bundled templates.                                        |

---

## Additional Completions (2026-01-29)

| Task                                | Description                                                           | Completed  |
| ----------------------------------- | --------------------------------------------------------------------- | ---------- |
| Add marketplace for this repository | `/.claude-plugin/marketplace.json` with 83 skills + README            | 2026-01-29 |
| C11 Hooks in frontmatter            | Full PreToolUse/PostToolUse/Stop hook support in schemas and compiler | 2026-01-29 |

**Note:** C11 Hooks was verified by research agent - full implementation exists in:

- `/home/vince/dev/cli/src/schemas/stack.schema.json` (10 hook event types)
- `/home/vince/dev/cli/src/cli/lib/stack-plugin-compiler.ts` (hooks.json generation)
- Comprehensive test coverage in `stack-plugin-compiler.test.ts`

---

## Simplified Plugin Architecture Migration (2026-01-25)

> **Tracking file**: `.claude/tasks/SIMPLIFIED-PLUGIN-MIGRATION.md`

Eliminated multi-stack architecture (`.claude-collective/stacks/`) in favor of single-plugin-per-project model.

| Task                      | Description                                                       | Completed  |
| ------------------------- | ----------------------------------------------------------------- | ---------- |
| A5.1 Research migration   | Identified all files referencing stacks/`.claude-collective/`     | 2026-01-25 |
| A5.2 Remove `cc switch`   | Eliminated stack switching entirely                               | 2026-01-25 |
| A5.3 Simplify `cc init`   | Creates plugin directly, uses "templates" instead of "stacks"     | 2026-01-25 |
| A5.4 Update `cc edit/add` | Modifies plugin directly, not stack                               | 2026-01-25 |
| A5.5 Remove stack files   | Deleted stack-list.ts, stack-config.ts, stack-creator.ts          | 2026-01-25 |
| A5.6 Update `cc list`     | Shows plugin info (version, skills, agents) instead of stack list | 2026-01-25 |
| A5.7 User migration       | `.claude-collective/` still used for config only (stacks removed) | 2026-01-25 |

**8 Phases completed:**

1. Phase 1: Removed switch command
2. Phase 2: Removed stack config infrastructure
3. Phase 3: Removed COLLECTIVE\_\* constants
4. Phase 4: Refactored init.ts, edit.ts, list.ts
5. Phase 5: Refactored library files
6. Phase 6: Updated types
7. Phase 7: Updated tests
8. Phase 8: Documentation & cleanup

All 323 tests pass.

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
