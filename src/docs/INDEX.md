# Documentation Index

> **Entry point for all system documentation.** Use this document in prompts to give agents context about where to find architectural, meta, and system documentation.

---

## Quick Navigation

| Need to...                                  | Read This                                                    |
| ------------------------------------------- | ------------------------------------------------------------ |
| Understand how agents/skills compile        | [CLAUDE_ARCHITECTURE_BIBLE.md](#1-claude-architecture-bible) |
| Write effective prompts                     | [PROMPT_BIBLE.md](#2-prompt-bible)                           |
| Create AI-optimized documentation           | [DOCUMENTATION_BIBLE.md](#3-documentation-bible)             |
| Design atomic, portable skills              | [SKILL-ATOMICITY-BIBLE.md](#4-skill-atomicity-bible)         |
| **Build or extend the CLI**                 | [CLI Documentation](#cli-documentation)                      |
| Find core instructions loaded in all agents | [Core Prompts](#core-prompts-loaded-in-all-agents)           |
| See compiled agent prompts                  | [Agent Definitions](#agent-definitions)                      |
| Review architecture research & decisions    | [Research & Findings](#research--findings)                   |

---

## The Four Bibles

### 1. CLAUDE_ARCHITECTURE_BIBLE

**Path:** `src/docs/CLAUDE_ARCHITECTURE_BIBLE.md`

The source of truth for the modular agent & skill compilation system.

**Covers:**

- TypeScript + LiquidJS compilation pipeline
- Stack-switching workflow (`bunx compile -s home` vs `bunx compile -s work`)
- Directory structure (`src/agents.yaml`, `src/agent-sources/{category}/{agent}/`, `src/stacks/`)
- Agent categories (developer, reviewer, researcher, planning, pattern, meta, tester)
- How agents are generic (role + workflow) while skills are stack-specific (implementation patterns)
- Adding new agents and skills
- Template system (`src/templates/agent.liquid`)
- **Skill schema requirements** (metadata.yaml, SKILL.md frontmatter, validation rules)

**Use when:** Creating or modifying agents, understanding the build system, switching stacks, authoring new skills.

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

**Path:** `src/docs/SKILL-ATOMICITY-BIBLE.md`

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

## CLI Documentation

The CLI (`cc`) is the user-facing tool for managing skills, stacks, and agents.

### Core CLI Documents

| Document                           | Path                            | Purpose                                                                |
| ---------------------------------- | ------------------------------- | ---------------------------------------------------------------------- |
| `CLI-DATA-DRIVEN-ARCHITECTURE.md`  | `src/docs/`                     | **Start here** - Data-driven design, skills matrix schema, MVP dataset |
| `CLI-AGENT-INVOCATION-RESEARCH.md` | `src/docs/`                     | **Key Discovery** - Inline agent invocation via `--agents` JSON flag   |
| `CLI-FRAMEWORK-RESEARCH.md`        | `src/docs/`                     | Framework comparison (@clack vs Ink vs Inquirer)                       |
| `CLI-IMPLEMENTATION-PLAN.md`       | `.claude/research/findings/v2/` | Phase 1-5 implementation details                                       |
| `CLI-PHASE-2-PLAN.md`              | `.claude/research/findings/v2/` | Remaining features (list, create, update)                              |

### CLI Architecture Principles

1. **Data-Driven**: CLI reads `skills-matrix.yaml` for all decisions (no hardcoded logic)
2. **Repository Separation**: CLI fetches matrix from content repo via `giget`
3. **Caching**: Matrix cached locally, refreshed via `cc update`
4. **Minimal MVP**: 10-skill test dataset covers all wizard flows
5. **Ephemeral Agent Invocation**: Meta-agents fetched and invoked inline via `--agents` JSON (no files written)

### Key Configuration Files

| File                      | Path                                | Purpose                                                                                                          |
| ------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `skills-matrix.yaml`      | `src/config/skills-matrix.yaml`     | Full production matrix - categories, relationships, suggested stacks, skill aliases (70+ skills, 20+ categories) |
| `skills-matrix-mvp.yaml`  | `src/config/skills-matrix-mvp.yaml` | MVP test dataset - minimal 10-skill dataset for testing all wizard flows                                         |
| `skills/**/metadata.yaml` | `src/skills/`                       | Per-skill metadata (auto-extracted)                                                                              |

### TypeScript Types & Schemas

| File                        | Path                                    | Purpose                                                        |
| --------------------------- | --------------------------------------- | -------------------------------------------------------------- |
| `types-matrix.ts`           | `src/cli/types-matrix.ts`               | TypeScript types for the matrix system (676 lines, 6 sections) |
| `skills-matrix.schema.json` | `src/schemas/skills-matrix.schema.json` | JSON Schema (draft-07) for validating skills-matrix.yaml files |

### Implementation Status

| Phase   | Description         | Status                                                |
| ------- | ------------------- | ----------------------------------------------------- |
| Phase 1 | Configuration Files | **Complete** (skills-matrix.yaml, MVP, types, schema) |
| Phase 2 | Matrix Loader       | Planned (matrix-loader.ts, matrix-resolver.ts)        |
| Phase 3 | Wizard Integration  | Planned                                               |
| Phase 4 | Test All Flows      | Planned                                               |

---

## Core Prompts (Loaded in All Agents)

These foundational instructions are compiled into every agent's context:

| File                                            | Purpose                                                                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core-prompts/core-principles.md`           | The 5 core principles (Investigation First, Follow Patterns, Minimal Changes, Anti-Over-Engineering, Verify Everything) with self-reminder loop |
| `src/core-prompts/investigation-requirement.md` | Never speculate about unread code; read first, then claim                                                                                       |
| `src/core-prompts/write-verification.md`        | Re-read files after editing; never report success without verification                                                                          |
| `src/core-prompts/anti-over-engineering.md`     | Explicit constraints on what NOT to do (no new abstractions, no unrequested features)                                                           |
| `src/core-prompts/context-management.md`        | How to manage long-term context across sessions (`progress.md`, `decisions.md`, `insights.md`)                                                  |
| `src/core-prompts/improvement-protocol.md`      | How to improve agent prompts based on evidence                                                                                                  |
| `src/core-prompts/success-criteria-template.md` | Template for defining and verifying success criteria                                                                                            |

---

## Agent Definitions

Compiled agent prompts live in `.claude/agents/`. Each agent has a specific role.

### Agent Organization

Agents are organized into 7 categories in `src/agent-sources/`:

| Category      | Path                            | Purpose                           |
| ------------- | ------------------------------- | --------------------------------- |
| `developer/`  | `src/agent-sources/developer/`  | Implementation agents             |
| `reviewer/`   | `src/agent-sources/reviewer/`   | Code review agents                |
| `researcher/` | `src/agent-sources/researcher/` | Read-only research agents         |
| `planning/`   | `src/agent-sources/planning/`   | Planning and coordination         |
| `pattern/`    | `src/agent-sources/pattern/`    | Pattern discovery and critique    |
| `meta/`       | `src/agent-sources/meta/`       | Meta-level agents (create agents) |
| `tester/`     | `src/agent-sources/tester/`     | Testing agents                    |

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
| **orchestrator** | `.claude/agents/orchestrator.md` | Manages background agent execution                        |

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

### Architecture Research

Located in `.claude/research/findings/v2/`:

| Document                                   | Purpose                                   |
| ------------------------------------------ | ----------------------------------------- |
| `ARCHITECTURE-IMPROVEMENT-FINDINGS.md`     | System architecture improvement proposals |
| `COMPILATION-PIPELINE-FINDINGS.md`         | Findings on the compilation system        |
| `PROFILE-SYSTEM-FINDINGS.md`               | Stack switching research                  |
| `TEMPLATE-ARCHITECTURE-FINDINGS.md`        | Template system design                    |
| `DRY-PRINCIPLES-AGENT5-FINDINGS.md`        | DRY principles for agents                 |
| `MODEL-SPECIFIC-OPTIMIZATIONS-FINDINGS.md` | Sonnet vs Opus optimizations              |
| `SCALABILITY-ANALYSIS.md`                  | Scalability considerations                |
| `TYPE-SAFETY-DETAILED.md`                  | TypeScript type safety research           |
| `FINAL-DECISION.md`                        | Key architectural decisions               |

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
| `CLI-FRAMEWORK-RESEARCH.md`       | `src/docs/`                     | Framework comparison (@clack vs Ink vs Inquirer) |
| `CLI-DATA-DRIVEN-ARCHITECTURE.md` | `src/docs/`                     | Skills matrix, relationships, MVP dataset        |

### Orchestration Research

Located in `.claude/research/orchestrating/`:

| Document                              | Purpose                            |
| ------------------------------------- | ---------------------------------- |
| `landscape-orchestration-patterns.md` | Survey of orchestration approaches |
| `multi-orchestrator-architecture.md`  | Multi-orchestrator design          |
| `async-orchestrator-analysis.md`      | Async execution patterns           |

---

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
| `SKILLS_ROADMAP.md`             | `src/docs/`                     | Skill development roadmap     |
| `SKILL_INTEGRATION_PROGRESS.md` | `src/docs/`                     | Integration progress tracking |
| `TODO.md`                       | `src/docs/`                     | Current TODO items            |
| `ISSUES-INDEX.md`               | `.claude/research/findings/v2/` | Known issues index            |

---

## Additional Reference

| Document                         | Path        | Purpose                                                              |
| -------------------------------- | ----------- | -------------------------------------------------------------------- |
| `FRONTEND_BIBLE.md`              | `src/docs/` | Frontend patterns and conventions (decision trees, styling, testing) |
| `ARCHITECTURE_AGENT_CREATION.md` | `src/docs/` | How to create architecture agents                                    |
| `ARCHITECTURE_AGENT_PROMPT.md`   | `src/docs/` | Architecture agent prompt structure                                  |
| `REFACTOR-AGENT-ARCHITECTURE.md` | `src/docs/` | Agent architecture refactoring proposals                             |

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
