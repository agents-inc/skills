# Agent Architecture Refactor

> **Status:** In Progress
> **Goal:** Single source of truth for agents, profiles only select which agents to use

## Summary

Restructure so that:
1. **Agent definitions** live in ONE file (`agents.yaml`) - single source of truth
2. **Profile configs** just reference which agents they want + assign skills
3. **Agent source files** (intro.md, workflow.md) remain generic in `agent-sources/`

## Current State (Before Refactor)

```
src/
├── agent-sources/           # ✅ DONE - renamed from agents/ to avoid Claude Code detection
│   └── {agent-name}/
│       ├── intro.md
│       ├── workflow.md
│       └── ...
├── profiles/
│   ├── work/
│   │   ├── config.yaml      # ❌ Contains FULL agent definitions (duplicated)
│   │   └── skills/
│   └── home/
│       ├── config.yaml      # ❌ Contains FULL agent definitions (duplicated)
│       └── skills/
```

**Problem:** Agent definitions (title, description, model, tools, core_prompts, output_format) are duplicated in each profile's config.yaml.

## Target State (After Refactor)

```
src/
├── agent-sources/           # Generic agent content (unchanged)
│   └── {agent-name}/
│       ├── intro.md
│       ├── workflow.md
│       └── ...
├── agents.yaml              # NEW: Single source of truth for ALL agent definitions
├── profiles/
│   ├── work/
│   │   ├── config.yaml      # SIMPLIFIED: Just lists agents + skill assignments
│   │   └── skills/
│   └── home/
│       ├── config.yaml      # SIMPLIFIED: Just lists agents + skill assignments
│       └── skills/
```

## File Structures

### NEW: src/agents.yaml

```yaml
# Single source of truth for all agent definitions
agents:
  frontend-developer:
    title: Frontend Developer Agent
    description: "Implements frontend features from detailed specs - React components, TypeScript, styling, client state - surgical execution following existing patterns - invoke AFTER pm creates spec"
    model: opus
    tools:
      - Read
      - Write
      - Edit
      - Grep
      - Glob
      - Bash
    core_prompts: developer
    ending_prompts: developer
    output_format: output-formats-developer

  backend-developer:
    title: Backend Developer Agent
    description: "Implements backend features from detailed specs - API routes, database operations, server utilities, authentication, middleware - surgical execution following existing patterns - invoke AFTER pm creates spec"
    model: opus
    tools:
      - Read
      - Write
      - Edit
      - Grep
      - Glob
      - Bash
    core_prompts: developer
    ending_prompts: developer
    output_format: output-formats-developer

  # ... all other agents
```

### SIMPLIFIED: profiles/{profile}/config.yaml

```yaml
name: work
description: Photoroom webapp (MobX, Tailwind, React Query, Karma+Chai)
claude_md: ./CLAUDE.md

# Core prompt sets (unchanged)
core_prompt_sets:
  developer:
    - core-principles
    - investigation-requirement
    - write-verification
    - anti-over-engineering
  # ...

ending_prompt_sets:
  developer:
    - context-management
    - improvement-protocol
  # ...

# NEW: Just list which agents this profile uses
use_agents:
  - frontend-developer
  - frontend-reviewer
  - tester
  - pm
  - skill-summoner

# NEW: Profile-specific skill assignments per agent
agent_skills:
  frontend-developer:
    precompiled:
      - id: frontend/react
        path: skills/frontend/react.md
        name: React
        description: Component architecture, MobX observer, hooks, patterns
        usage: when implementing React components
      - id: frontend/styling
        path: skills/frontend/styling.md
        name: Styling
        description: Tailwind, clsx, design tokens
        usage: when implementing styles
    dynamic:
      - id: frontend/api
        path: skills/frontend/api.md
        name: API Integration
        description: REST APIs, React Query, Zod validation
        usage: when implementing data fetching or API calls

  frontend-reviewer:
    precompiled:
      - id: frontend/react
        path: skills/frontend/react.md
        # ...
    dynamic: []

  # ... other agents
```

## Implementation Checklist

### Completed
- [x] Renamed `src/agents/` to `src/agent-sources/` to avoid Claude Code auto-detection
- [x] Updated `compile.ts` to use new path
- [x] Updated `CLAUDE_ARCHITECTURE_BIBLE.md` with new directory structure
- [x] Verified compilation still works
- [x] Create `src/agents.yaml` with all agent definitions extracted from current configs
- [x] Update `src/types.ts` with new type definitions
- [x] Update `src/compile.ts` to:
  - [x] Load agents from `agents.yaml`
  - [x] Load profile config with `use_agents` and `agent_skills`
  - [x] Merge agent definition + profile skill assignments at compile time
- [x] Simplify `src/profiles/work/config.yaml` (remove agent definitions, keep only `use_agents` + `agent_skills`)
- [x] Simplify `src/profiles/home/config.yaml` (same)
- [x] Test compilation for both profiles
- [x] Verify Claude Code only sees active profile's agents

### To Do
- [x] Update `CLAUDE_ARCHITECTURE_BIBLE.md` documentation to reflect new structure

## Refactor Complete

All checklist items have been implemented. The system now has:
1. **Single source of truth** for agent definitions in `agents.yaml`
2. **Simplified profile configs** with `use_agents` and `agent_skills`
3. **Updated types** in `types.ts` with `AgentDefinition`, `AgentsConfig`, and `SkillAssignment`
4. **Updated compiler** that loads agents from `agents.yaml` and merges with profile skills

## Files Modified

| File | Action | Status |
|------|--------|--------|
| `src/agents.yaml` | CREATED - all agent definitions | ✅ Done |
| `src/types.ts` | UPDATED - new types (AgentDefinition, AgentsConfig, SkillAssignment) | ✅ Done |
| `src/compile.ts` | UPDATED - loads agents.yaml, merges with profile skills | ✅ Done |
| `src/profiles/work/config.yaml` | SIMPLIFIED - uses use_agents + agent_skills | ✅ Done |
| `src/profiles/home/config.yaml` | SIMPLIFIED - uses use_agents + agent_skills | ✅ Done |
| `src/docs/CLAUDE_ARCHITECTURE_BIBLE.md` | UPDATED - documented new structure | ✅ Done |

---

## Continuation Prompt

Use this prompt in a clean Claude Code context to continue:

```
Continue the agent architecture refactor documented in src/docs/REFACTOR-AGENT-ARCHITECTURE.md

The goal is to create a single source of truth for agent definitions:
1. Create src/agents.yaml with all agent definitions extracted from the current profile configs
2. Update types.ts with new type definitions
3. Update compile.ts to load agents from agents.yaml and merge with profile-specific skill assignments
4. Simplify both profile config.yaml files to only contain use_agents and agent_skills

Read the REFACTOR-AGENT-ARCHITECTURE.md file first to understand the current state and target state, then implement the remaining checklist items. Use ultrathink for this task.
```
