# DRY Principles Analysis - Agent #5 Findings

> These findings should be merged into Section 5 of ARCHITECTURE-IMPROVEMENT-FINDINGS.md

## Executive Summary

**Severity: HIGH** - Substantial content duplication across agent sources, config files, and skill structures. Approximately 70-80% of workflow content is repeated between similar agents. This creates maintenance burden, inconsistency risks, and increased token usage during compilation.

---

## Major Duplication Areas

### 5.1 Developer Agent Workflows (~80% Duplication)

**Files affected:**

- `src/agent-sources/frontend-developer/workflow.md`
- `src/agent-sources/backend-developer/workflow.md`

**Identical sections (verbatim):**

- Investigation Process (entire section)
- Development Workflow (5-step structure)
- Post-Action Reflection (entire section)
- Progress Tracking (entire section)
- Self-Correction Triggers (structure identical, 1 line different)
- Handling Complexity (entire section)
- When to Ask for Help (entire section)
- Extended Reasoning Guidance (entire section)

**Only differences:**

- Glob patterns: `**/*.tsx` vs `**/*.ts`
- Domain mentions: "similar components" vs "similar API routes"
- Implementation checklist items (domain-specific)

**Recommendation:** Extract common developer workflow to `core-prompts/developer-workflow.md` with domain-specific variables.

---

### 5.2 Reviewer Agent Workflows (~75% Duplication)

**Files affected:**

- `src/agent-sources/frontend-reviewer/workflow.md`
- `src/agent-sources/backend-reviewer/workflow.md`

**Identical sections:**

- Self-Correction Triggers structure
- Post-Action Reflection structure
- Progress Tracking format
- Retrieval Strategy format
- Review Workflow structure (5 steps)

**Recommendation:** Extract common reviewer workflow to `core-prompts/reviewer-workflow.md`.

---

### 5.3 Researcher Agent Workflows (~70% Duplication)

**Files affected:**

- `src/agent-sources/frontend-researcher/workflow.md`
- `src/agent-sources/backend-researcher/workflow.md`

**Identical sections:**

- Self-Correction Checkpoints (near-identical, 1 line different)
- Research Philosophy structure
- Investigation Process structure
- Post-Action Reflection
- Progress Tracking
- Tool Usage Patterns / Retrieval Strategy structure
- Domain Scope format
- Research Quality Standards format
- Integration with Orchestrator

**Recommendation:** Extract common researcher workflow to `core-prompts/researcher-workflow.md`.

---

### 5.4 Critical Requirements/Reminders Redundancy

**Pattern observed:**

- Each agent has both `critical-requirements.md` AND `critical-reminders.md`
- The reminders file largely repeats requirements with slight emphasis variations
- Example: frontend-developer has 5 requirements, reminders restates same 5 with "BEFORE" emphasis

**Files affected:** All agent-sources directories (14+ files)

**Recommendation:** Auto-generate `critical-reminders.md` from `critical-requirements.md` at compile time using a transformation template.

---

### 5.5 Config File Core/Ending Prompts Repetition

**Files affected:**

- `src/stacks/work/config.yaml`
- `src/stacks/home/config.yaml`

**Duplication pattern:**
Every agent definition repeats the same `core_prompts` list:

```yaml
core_prompts:
  - core-principles.md
  - investigation-requirement.md
  - write-verification.md
  - anti-over-engineering.md
  - context-management.md
  - improvement-protocol.md
```

And the same `ending_prompts` list:

```yaml
ending_prompts:
  - critical-reminders.md
```

This is repeated 15+ times per config file.

**Recommendation:** Define `default_core_prompts` and `default_ending_prompts` at stack level. Agents only specify overrides.

---

### 5.6 Dynamic Skills Assignment Repetition

**Observation:**
Multiple agents have identical or near-identical dynamic skill lists:

- `skill-summoner`, `agent-summoner`, `pm`, `documentor` all use: `all-frontend-skills`, `all-backend-skills`, `all-testing-skills`
- This full list is repeated in each agent definition

**Recommendation:** Define skill categories as named sets, then reference by category name.

---

### 5.7 Skill Structure Duplication

**Pattern observed:**
All skills in both stacks follow the exact same structure:

1. Quick Guide block
2. Critical Requirements section
3. Auto-detection line
4. When to use / When NOT to use
5. Philosophy section
6. Core Patterns section
7. Anti-Patterns section
8. Decision Framework section
9. Integration Guide section
10. Red Flags section
11. Critical Reminders section

**Files affected:** All files in:

- `src/skills/` (central skill repository)

**Issue:** This structure is manually maintained in each skill file rather than enforced via template.

**Recommendation:** Create a skill template that enforces structure. Skills provide only content blocks.

---

## Quantified Impact

| Duplication Type       | Estimated Repeated Lines | Files Affected  | Maintenance Risk |
| ---------------------- | ------------------------ | --------------- | ---------------- |
| Developer workflows    | ~400 lines               | 2 files         | High             |
| Reviewer workflows     | ~200 lines               | 2 files         | High             |
| Researcher workflows   | ~250 lines               | 2 files         | High             |
| Requirements/Reminders | ~150 lines               | 14+ files       | Medium           |
| Config core_prompts    | ~300 lines               | 2 config files  | Medium           |
| Skill structure        | ~2000+ lines             | 10+ skill files | Medium           |
| **Total**              | **~3300+ lines**         | **30+ files**   | **High**         |

---

## Recommended Improvements

### High Priority

1. **Create `core-prompts/developer-workflow.md`**

   - Extract common developer workflow structure
   - Use Liquid variables for domain-specific content: `{{ file_patterns }}`, `{{ domain_examples }}`
   - Agent workflow files become thin overlays with only domain-specific content

2. **Create `core-prompts/reviewer-workflow.md`**

   - Same pattern as developer workflow
   - Domain-specific reviewers only include their specialization checklist

3. **Create `core-prompts/researcher-workflow.md`**

   - Extract common research patterns
   - Domain-specific modes remain in agent files

4. **Implement Config Defaults**
   - Add `defaults:` section to config.yaml schema
   - Define `core_prompts`, `ending_prompts`, and base skill sets once
   - Agents inherit defaults, only specify overrides

### Medium Priority

5. **Auto-Generate Critical Reminders**

   - Template transformation: requirements -> reminders
   - Add emphasis markers, timing cues automatically
   - Reduce manual maintenance of parallel files

6. **Define Skill Categories**

   - Create named skill sets: `frontend-all`, `backend-all`, `testing-all`
   - Reference by category in agent definitions
   - Changes to category automatically propagate

7. **Create Skill Structure Template**
   - Liquid template enforces consistent structure
   - Skills provide only content blocks
   - Structural changes update all skills automatically

### Low Priority

8. **Extract Common "When to Ask for Help" Section**

   - Currently repeated in all developer agents
   - Could be a core-prompt with role-specific examples

9. **Extract Common "Extended Reasoning Guidance"**
   - Nearly identical across agents
   - Minor variations could be parameterized

---

## Summary Items for Priority Sections

### High Priority (add to Summary)

- [ ] **~3300 lines duplicated across 30+ files** - Workflow files ~80% identical; config prompts repeated 15+ times
- [ ] **No config defaults mechanism** - `core_prompts` and `ending_prompts` arrays copied for every agent

### Medium Priority (add to Summary)

- [ ] **Critical requirements/reminders redundancy** - Each agent has parallel files with near-identical content
- [ ] **Skill structure manually maintained** - 11-section structure repeated without template enforcement
- [ ] **No skill category bundles** - Same skill sets repeated across multiple agents

---

_Agent #5 (DRY Principles) - Analysis Complete_
