# Documentation Index

> **Entry point for all system documentation.** Use this document in prompts to give agents context about where to find architectural, meta, and system documentation.

---

## Quick Navigation

| Need to...                                 | Read This                                                    |
| ------------------------------------------ | ------------------------------------------------------------ |
| **Understand new simplified architecture** | [SIMPLIFIED-PLUGIN-ARCHITECTURE.md](#architecture-research)  |
| Understand how agents/skills compile       | [CLAUDE_ARCHITECTURE_BIBLE.md](#1-claude-architecture-bible) |
| Write effective prompts                    | [PROMPT_BIBLE.md](#2-prompt-bible)                           |
| Create AI-optimized documentation          | [DOCUMENTATION_BIBLE.md](#3-documentation-bible)             |
| Design atomic, portable skills             | [SKILL-ATOMICITY-BIBLE.md](#4-skill-atomicity-bible)         |
| **Build or extend the CLI**                | [CLI Documentation](#cli-documentation)                      |
| Create or distribute plugins               | [PLUGIN-DEVELOPMENT.md](#5-plugin-development)               |
| See all CLI commands                       | [CLI-REFERENCE.md](#cli-reference)                           |
| Find core principles used by all agents    | [Core Principles](#core-principles-embedded-in-all-agents)   |
| See compiled agent prompts                 | [Agent Definitions](#agent-definitions)                      |
| Review architecture research & decisions   | [Research & Findings](#research--findings)                   |

---

## The Four Bibles

### 1. CLAUDE_ARCHITECTURE_BIBLE

**Path:** `src/docs/CLAUDE_ARCHITECTURE_BIBLE.md`

The source of truth for the modular agent & skill compilation system.

**Covers:**

- TypeScript + LiquidJS compilation pipeline
- Stack-switching workflow (`cc switch <stack>` then `cc compile`)
- Directory structure (`src/agents.yaml`, `src/agents/{category}/{agent}/`, `src/stacks/`)
- Agent categories (developer, reviewer, researcher, planning, pattern, meta, tester)
- How agents are generic (role + workflow) while skills are stack-specific (implementation patterns)
- Adding new agents and skills
- Template system (`agent.liquid` + partials bundled in CLI, not public skills repo)
- **Skill schema requirements** (metadata.yaml, SKILL.md frontmatter, validation rules)

**Use when:** Creating or modifying agents, understanding the build system, switching stacks, authoring new skills.

**Note:** CLI-DATA-DRIVEN-ARCHITECTURE.md (skills matrix, relationships, eject design) has been moved to `.claude/research/findings/v2/` as it contains architectural research and unimplemented features.

---

### 2. PROMPT_BIBLE

**Path:** `src/docs/PROMPT_BIBLE.md`

Universal prompt engineering techniques validated by Anthropic research and production systems.

**Covers:**

- **Self-Reminder Loop** (60-70% reduction in off-task behavior)
- **Investigation-First Protocol** (80%+ reduction in hallucination)
- **Emphatic Repetition** (70%+ reduction in scope creep)
- XML tag standards and usage
- Sonnet 4.5 / Opus 4.5 specific optimizations
- Performance metrics with evidence sources
- Why certain patterns work (backed by 72.7%+ SWE-bench systems)

**Use when:** Writing or improving any agent prompt, troubleshooting agent behavior.

---

### 3. DOCUMENTATION_BIBLE

**Path:** `src/docs/DOCUMENTATION_BIBLE.md`

Standards for creating AI-optimized documentation (NOT human documentation).

**Covers:**

- Document hierarchy (`llms.txt` -> `CONCEPTS.md` -> features/)
- Loading decision trees for AI agents
- Progressive loading strategy
- Why AI agents need different documentation than humans
- File types and standards for AI consumption
- Cross-referencing skills
- Session workflows
- Hash verification standards

**Use when:** Creating documentation for a codebase that AI agents will consume.

---

### 4. SKILL-ATOMICITY-BIBLE

**Path:** `src/docs/skills/SKILL-ATOMICITY-BIBLE.md`

The core principle: A skill should ONLY discuss its own domain.

**Covers:**

- Why atomicity matters (portability, composability, maintenance)
- Violation categories (import coupling, code examples, tooling recommendations)
- Transformation framework for fixing violations
- Quality gate checklist
- Keywords to watch for cross-domain leakage
- Bridge pattern exception (when cross-domain is allowed)

**Use when:** Creating or reviewing skills, ensuring portability across tech stacks.

---

## Plugin System

### 5. PLUGIN-DEVELOPMENT

**Path:** `src/docs/plugins/PLUGIN-DEVELOPMENT.md`

Guide for creating and distributing Claude Code plugins.

**Covers:**

- Plugin directory structure
- SKILL.md frontmatter (official format)
- plugin.json manifest schema
- Stack plugin compilation
- Publishing to marketplace

**Use when:** Creating skill plugins, stack plugins, or contributing to the marketplace.

---

### CLI-REFERENCE

**Path:** `src/docs/plugins/CLI-REFERENCE.md`

Complete reference for all CLI commands.

**Covers:**

- `cc init` - Initialize with plugin support
- `cc compile-plugins` - Compile skills to plugins
- `cc compile-stack` - Compile stacks to plugins
- `cc generate-marketplace` - Generate marketplace.json
- `cc validate` - Validate plugins
- `cc version` - Manage plugin versions

**Use when:** Running CLI commands or understanding available options.

---

## Dual-Repo Architecture

> **Status**: Implemented (2026-01-29)
> **Source of Truth**: `.claude/research/findings/v2/DUAL-REPO-ARCHITECTURE.md`

This repository is now part of a **dual-repo architecture**:

| Repository             | Purpose                               | Location                   |
| ---------------------- | ------------------------------------- | -------------------------- |
| **CLI Repo**           | CLI tool (`cc`) for managing skills   | Separate repo              |
| **Skills Repo** (this) | Skills, stacks, agents, documentation | `claude-collective/skills` |

### What Lives Where

| Content                             | Repository         |
| ----------------------------------- | ------------------ |
| Skills (`src/skills/`)              | Skills Repo (this) |
| Stacks (`src/stacks/`)              | Skills Repo (this) |
| Agent definitions (`src/agents/`)   | Skills Repo (this) |
| Compiled agents (`.claude/agents/`) | Skills Repo (this) |
| CLI code (`src/cli/`)               | CLI Repo           |
| Templates (`agent.liquid`)          | CLI Repo (bundled) |
| Skills matrix                       | CLI Repo           |
| JSON Schemas                        | CLI Repo           |

### Key Documents

| Document                           | Path                            | Purpose                                                    |
| ---------------------------------- | ------------------------------- | ---------------------------------------------------------- |
| `DUAL-REPO-ARCHITECTURE.md`        | `.claude/research/findings/v2/` | **Architecture spec** - Plugin vs Local mode, eject system |
| `CLI-AGENT-INVOCATION-RESEARCH.md` | `src/docs/cli/`                 | Inline agent invocation via `--agents` JSON                |
| `PLUGIN-DEVELOPMENT.md`            | `src/docs/plugins/`             | How to create and publish plugins                          |
| `CLI-REFERENCE.md`                 | `src/docs/plugins/`             | CLI command reference                                      |

### Architecture Principles

1. **Templates bundled in CLI**: `agent.liquid` and partials are bundled, not in this repo
2. **Two installation modes**: Plugin Mode (native `claude plugin install`) or Local Mode (copy to `.claude/skills/`)
3. **Unified compilation**: `cc compile` discovers from both `.claude/plugins/` and `.claude/skills/`
4. **Eject for customization**: `cc eject templates` copies bundled templates for local modification
5. **Skills are source of truth**: `src/skills/` has full metadata, agents are compiled output

### Implementation Status

All 6 phases of DUAL-REPO-ARCHITECTURE.md are complete:

| Phase   | Description                | Status       |
| ------- | -------------------------- | ------------ |
| Phase 1 | Bundle templates in CLI    | **Complete** |
| Phase 2 | Wizard mode selection      | **Complete** |
| Phase 3 | Plugin Mode implementation | **Complete** |
| Phase 4 | Local Mode implementation  | **Complete** |
| Phase 5 | Unified compilation        | **Complete** |
| Phase 6 | Eject command              | **Complete** |

---

## Core Principles (Embedded in All Agents)

The 5 core principles are **hardcoded directly in the agent template** (`agent.liquid`, bundled in CLI). This ensures every agent has consistent foundational instructions:

| Principle                        | Purpose                                                      |
| -------------------------------- | ------------------------------------------------------------ |
| **1. Investigation First**       | Never speculate about unread code; read first, then claim    |
| **2. Follow Existing Patterns**  | Use what's already there; match codebase conventions         |
| **3. Minimal Necessary Changes** | Surgical edits only; change only what's required             |
| **4. Anti-Over-Engineering**     | Simple solutions; use existing utilities; avoid abstractions |
| **5. Verify Everything**         | Test work; check success criteria; provide evidence          |

Additional methodology guidance (context management, improvement protocols, etc.) is available via **methodology skills** in `src/skills/methodology/`.

---

## Agent Definitions

Compiled agent prompts live in `.claude/agents/`. Each agent has a specific role.

### Agent Organization

Agents are organized into 7 categories in `src/agents/`:

| Category      | Path                     | Purpose                           |
| ------------- | ------------------------ | --------------------------------- |
| `developer/`  | `src/agents/developer/`  | Implementation agents             |
| `reviewer/`   | `src/agents/reviewer/`   | Code review agents                |
| `researcher/` | `src/agents/researcher/` | Read-only research agents         |
| `planning/`   | `src/agents/planning/`   | Planning and coordination         |
| `pattern/`    | `src/agents/pattern/`    | Pattern discovery and critique    |
| `meta/`       | `src/agents/meta/`       | Meta-level agents (create agents) |
| `tester/`     | `src/agents/tester/`     | Testing agents                    |

### Development Agents

| Agent                   | Path                                    | Role                                    |
| ----------------------- | --------------------------------------- | --------------------------------------- |
| **frontend-developer**  | `.claude/agents/frontend-developer.md`  | Implements frontend features from specs |
| **backend-developer**   | `.claude/agents/backend-developer.md`   | Implements backend features from specs  |
| **frontend-researcher** | `.claude/agents/frontend-researcher.md` | Read-only frontend pattern discovery    |
| **backend-researcher**  | `.claude/agents/backend-researcher.md`  | Read-only backend pattern discovery     |
| **tester**              | `.claude/agents/tester.md`              | Writes tests BEFORE implementation      |

### Review Agents

| Agent                 | Path                                  | Role                                                |
| --------------------- | ------------------------------------- | --------------------------------------------------- |
| **frontend-reviewer** | `.claude/agents/frontend-reviewer.md` | Reviews React components (`.tsx`/`.jsx`)            |
| **backend-reviewer**  | `.claude/agents/backend-reviewer.md`  | Reviews non-React code (API routes, configs, CI/CD) |

### Architecture & Planning Agents

| Agent            | Path                             | Role                                                      |
| ---------------- | -------------------------------- | --------------------------------------------------------- |
| **architecture** | `.claude/agents/architecture.md` | Scaffolds new applications with all foundational patterns |
| **pm**           | `.claude/agents/pm.md`           | Creates detailed implementation specs                     |

### Meta Agents (Create Other Agents/Skills)

| Agent              | Path                               | Role                             |
| ------------------ | ---------------------------------- | -------------------------------- |
| **agent-summoner** | `.claude/agents/agent-summoner.md` | Creates new agents               |
| **skill-summoner** | `.claude/agents/skill-summoner.md` | Creates new skills               |
| **documentor**     | `.claude/agents/documentor.md`     | Creates AI-focused documentation |

### Pattern Agents

| Agent                | Path                                 | Role                                              |
| -------------------- | ------------------------------------ | ------------------------------------------------- |
| **pattern-scout**    | `.claude/agents/pattern-scout.md`    | Extracts patterns from monorepos (15+ categories) |
| **pattern-critique** | `.claude/agents/pattern-critique.md` | Critiques patterns against industry standards     |

---

## Research & Findings

### Claude Code Improvements

Located in `.claude/research/claude-improvements/`:

| Document                    | Feature                              | Priority |
| --------------------------- | ------------------------------------ | -------- |
| `INDEX.md`                  | Overview and implementation priority | -        |
| `rules-directory.md`        | Path-scoped `.claude/rules/`         | HIGH     |
| `thinking-budget.md`        | Configurable thinking tokens         | MEDIUM   |
| `context-forking.md`        | Isolated skill execution             | HIGH     |
| `hooks-frontmatter.md`      | Agent-scoped hooks                   | HIGH     |
| `permission-generation.md`  | Auto-generate from tools             | MEDIUM   |
| `progressive-disclosure.md` | Tiered skill loading                 | MEDIUM   |
| `hot-reload.md`             | Skills hot reload                    | LOW      |

### Architecture Research

Located in `.claude/research/findings/v2/`:

| Document                                   | Purpose                                                          |
| ------------------------------------------ | ---------------------------------------------------------------- |
| **`DUAL-REPO-ARCHITECTURE.md`**            | **IMPLEMENTED**: Public marketplace + private work repo pattern  |
| **`SIMPLIFIED-PLUGIN-ARCHITECTURE.md`**    | One plugin per project architecture (superseded by dual-repo)    |
| `ARCHITECTURE-IMPROVEMENT-FINDINGS.md`     | System architecture improvement proposals                        |
| `COMPILATION-PIPELINE-FINDINGS.md`         | Findings on the compilation system                               |
| `PROFILE-SYSTEM-FINDINGS.md`               | Stack switching research (partially obsolete)                    |
| `TEMPLATE-ARCHITECTURE-FINDINGS.md`        | Template system design                                           |
| `DRY-PRINCIPLES-AGENT5-FINDINGS.md`        | DRY principles for agents                                        |
| `MODEL-SPECIFIC-OPTIMIZATIONS-FINDINGS.md` | Sonnet vs Opus optimizations                                     |
| `SCALABILITY-ANALYSIS.md`                  | Scalability considerations                                       |
| `TYPE-SAFETY-DETAILED.md`                  | TypeScript type safety research                                  |
| `FINAL-DECISION.md`                        | Key architectural decisions                                      |
| `CLI-DATA-DRIVEN-ARCHITECTURE.md`          | Skills matrix, relationships, eject design (partially obsolete)  |
| `RULES-TASKS-INTEGRATION-PLAN.md`          | Claude Rules, Tasks, v2.1.x integration                          |
| `AGENT-HOOKS-PORTABILITY.md`               | Project-level agent-hook mappings via `.claude/agent-hooks.yaml` |

### Skill Architecture Research

| Document                         | Path                                    |
| -------------------------------- | --------------------------------------- |
| `SKILL-ARCHITECTURE-RESEARCH.md` | `.claude/research/findings/v2/`         |
| `SKILL-VERSIONING-RESEARCH.md`   | `.claude/research/findings/v2/`         |
| `SKILL-FORKING-RESEARCH.md`      | `.claude/research/findings/v2/`         |
| `SKILL-EXTRACTION-CRITERIA.md`   | `.claude/research/findings/new skills/` |
| `NEW-SKILLS-LIST.md`             | `.claude/research/findings/new skills/` |

### Marketplace & Registry Research

| Document                                   | Path                            |
| ------------------------------------------ | ------------------------------- |
| `STACK-MARKETPLACE-ARCHITECTURE.md`        | `.claude/research/findings/v2/` |
| `STACK-MARKETPLACE-PROPOSAL-RESEARCH.md`   | `.claude/research/findings/v2/` |
| `STACK-MARKETPLACE-IMPLEMENTATION-PLAN.md` | `.claude/research/findings/v2/` |
| `COMMUNITY-REGISTRY-PROPOSAL-RESEARCH.md`  | `.claude/research/findings/v2/` |
| `STACK-COMPILE-COMPATIBILITY.md`           | `.claude/research/findings/v2/` |
| `VOTING-SYSTEM-RESEARCH.md`                | `.claude/research/findings/v2/` |

### CLI Development

| Document                          | Path                            | Purpose                                          |
| --------------------------------- | ------------------------------- | ------------------------------------------------ |
| `CLI-IMPLEMENTATION-PLAN.md`      | `.claude/research/findings/v2/` | Phase 1-5 implementation (core compile/init)     |
| `CLI-PHASE-2-PLAN.md`             | `.claude/research/findings/v2/` | Phase 6+ features (list, create, update)         |
| `CLI-FRAMEWORK-RESEARCH.md`       | `src/docs/cli/`                 | Framework comparison (@clack vs Ink vs Inquirer) |
| `CLI-DATA-DRIVEN-ARCHITECTURE.md` | `.claude/research/findings/v2/` | Skills matrix, relationships, MVP dataset        |

## Competitive & Landscape Research

Located in `.claude/research/`:

### Competitor Analysis

| Document                        | Purpose                         |
| ------------------------------- | ------------------------------- |
| `competitor-claude-flow.md`     | Analysis of claude-flow project |
| `competitor-superclaude.md`     | Analysis of superclaude project |
| `competitor-voltagent.md`       | Analysis of voltagent project   |
| `competitor-wshobson-agents.md` | Analysis of wshobson/agents     |

### Landscape Surveys

| Document                              | Purpose                            |
| ------------------------------------- | ---------------------------------- |
| `landscape-skill-systems.md`          | How others implement skill systems |
| `landscape-subagent-systems.md`       | Survey of subagent architectures   |
| `landscape-profile-configurations.md` | Stack/config patterns              |
| `landscape-agent-compilation.md`      | Agent compilation approaches       |
| `landscape-context-management.md`     | Context management strategies      |
| `landscape-custom-commands.md`        | Custom command implementations     |
| `landscape-hooks-automation.md`       | Hook and automation patterns       |
| `landscape-parallel-execution.md`     | Parallel execution patterns        |
| `landscape-claude-md-patterns.md`     | CLAUDE.md patterns in the wild     |
| `landscape-gaps-opportunities.md`     | Gaps and opportunities identified  |

### Community & Resources

| Document                                 | Purpose                       |
| ---------------------------------------- | ----------------------------- |
| `awesome-lists-comprehensive.md`         | Curated awesome lists         |
| `resource-awesome-claude-code.md`        | Awesome Claude Code resources |
| `community-agent-collections.md`         | Community agent collections   |
| `community-reddit-discussions.md`        | Reddit community insights     |
| `claude-code-mcp-plugins-ecosystem.md`   | MCP plugin ecosystem          |
| `company-org-claude-setups.md`           | Company/org Claude setups     |
| `github-trending-claude.md`              | Trending Claude repos         |
| `newest-claude-code-agent-repos-2025.md` | Latest agent repos            |
| `recent-claude-code-updates.md`          | Recent Claude Code updates    |
| `official-agent-skills-standard.md`      | Official standards reference  |
| `social-media-resources.md`              | Social media resources        |

---

## Planning & Roadmap

| Document                        | Path                            | Purpose                       |
| ------------------------------- | ------------------------------- | ----------------------------- |
| `SKILLS_ROADMAP.md`             | `src/docs/skills/`              | Skill development roadmap     |
| `SKILL_INTEGRATION_PROGRESS.md` | `src/docs/skills/`              | Integration progress tracking |
| `TODO.md`                       | `src/docs/`                     | Current TODO items            |
| `ISSUES-INDEX.md`               | `.claude/research/findings/v2/` | Known issues index            |

---

## Additional Reference

| Document                         | Path               | Purpose                                                              |
| -------------------------------- | ------------------ | -------------------------------------------------------------------- |
| `FRONTEND_BIBLE.md`              | `src/docs/`        | Frontend patterns and conventions (decision trees, styling, testing) |
| `ARCHITECTURE_AGENT_CREATION.md` | `src/docs/agents/` | How to create architecture agents                                    |
| `ARCHITECTURE_AGENT_PROMPT.md`   | `src/docs/agents/` | Architecture agent prompt structure                                  |
| `REFACTOR-AGENT-ARCHITECTURE.md` | `src/docs/agents/` | Agent architecture refactoring proposals                             |

---

## Project Configuration

| Document      | Path                  | Purpose                                                  |
| ------------- | --------------------- | -------------------------------------------------------- |
| `CLAUDE.md`   | Root                  | Project memory - decision trees, conventions, checklists |
| `agents.yaml` | `src/`                | Single source of truth for all agent definitions         |
| `config.yaml` | `src/stacks/{stack}/` | Stack-specific agent/skill assignments                   |

---

## Document Loading Strategy

When working with this system, follow this priority:

1. **Start here** - This INDEX.md for orientation
2. **Architecture questions** - CLAUDE_ARCHITECTURE_BIBLE.md
3. **Prompt engineering** - PROMPT_BIBLE.md
4. **Creating documentation** - DOCUMENTATION_BIBLE.md
5. **Skill design** - SKILL-ATOMICITY-BIBLE.md
6. **Research/decisions** - Browse `.claude/research/findings/v2/`
7. **Competitive context** - Browse `.claude/research/`
