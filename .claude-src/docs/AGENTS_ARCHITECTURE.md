# Agents Architecture

> **DEPRECATED** - This document is superseded by [CLAUDE_ARCHITECTURE_BIBLE.md](./CLAUDE_ARCHITECTURE_BIBLE.md).
>
> **Redirect:** For the current source of truth on creating and maintaining agents, see **CLAUDE_ARCHITECTURE_BIBLE.md** which combines:
> - All content from this document (HOW the system works)
> - Technique compliance from PROMPT_BIBLE.md (WHY techniques work)
> - Model-specific guidance for Opus/Sonnet 4.5
> - Runnable validation commands
>
> This file is preserved for historical reference only. Do not update this file.

---

> How the agent system is built, organized, and extended.

**Purpose:** This document covers the mechanical/plumbing aspects of this specific agent system. For universal prompt engineering techniques (the WHY), see [PROMPT_BIBLE.md](./PROMPT_BIBLE.md). For skill definitions and agent-to-skill mappings (the WHAT), see [SKILLS_ARCHITECTURE.md](./SKILLS_ARCHITECTURE.md).

**Target Model:** Claude Opus 4.5

> **Model Parity Note:** All techniques described in PROMPT_BIBLE.md as "Sonnet 4.5 Specific" also apply to Opus 4.5. The primary differences for Opus are:
>
> 1. **"Think" sensitivity** - In agent prompts, replace "think" with alternatives (consider, evaluate, analyze). However, when making requests to Claude Code, you CAN use "think"/"megathink"/"ultrathink" to explicitly allocate thinking budget (see PROMPT_BIBLE.md Technique #11).
> 2. **Over-engineering tendency** - Opus benefits from explicit anti-over-engineering guards
> 3. **System prompt responsiveness** - Opus responds more strongly to directives, so use clear direct language over excessive emphasis
>
> All agents in this system use `model: opus` in their frontmatter.
>
> **Extended Thinking Triggers (Claude Code only):**
>
> - `think` (~4K tokens) → routine tasks
> - `megathink` (~10K tokens) → intermediate problems
> - `ultrathink` (~32K tokens) → major architectural challenges, when stuck in loops

---

## Table of Contents

1. [Overview](#1-overview)
2. [Directory Structure](#2-directory-structure)
3. [File Conventions](#3-file-conventions)
4. [The Compilation System](#4-the-compilation-system)
5. [Canonical Structure](#5-canonical-structure)
6. [Technique Compliance Mapping](#6-technique-compliance-mapping)
7. [Pre-compiled vs Dynamic Skills](#7-pre-compiled-vs-dynamic-skills)
8. [The Preloaded Content Pattern](#8-the-preloaded-content-pattern)
9. [Adding a New Agent](#9-adding-a-new-agent)
10. [Adding a New Skill](#10-adding-a-new-skill)
11. [Build & Deployment Workflow](#11-build--deployment-workflow)
12. [Relationship to Other Docs](#12-relationship-to-other-docs)

---

## 1. Overview

This system uses a **compilation-based architecture** for AI agents:

- **Source files** (`.src.md`) contain `@include()` directives that reference shared partials
- A **build step** resolves all includes and produces standalone agent files
- **Agents** are deployed as compiled `.md` files that Claude Code loads

This approach enables:

- **Consistency** - All agents share core prompts via includes
- **Maintainability** - Update a partial once, all agents benefit
- **Scalability** - Easy to add new agents that inherit proven patterns
- **Quality** - Enforces the Essential Techniques from PROMPT_BIBLE.md

---

## 2. Directory Structure

```
.claude-src/                    # Source files (human-edited)
├── agents/                     # Agent .src.md files
│   ├── agent-summoner.src.md
│   ├── frontend-developer.src.md
│   ├── pm.src.md
│   ├── tester.src.md
│   └── ...
├── skills/                     # Skill .md files by category
│   ├── frontend/
│   │   ├── react.md
│   │   ├── api.md
│   │   ├── styling.md
│   │   └── ...
│   ├── backend/
│   │   ├── api.md
│   │   ├── database.md
│   │   └── ...
│   ├── security/
│   │   └── security.md
│   ├── setup/
│   │   ├── monorepo.md
│   │   ├── package.md
│   │   └── ...
│   └── shared/
│       └── reviewing.md
├── core prompts/               # Shared partials (@include targets)
│   ├── core-principles.md
│   ├── investigation-requirement.md
│   ├── write-verification.md
│   ├── anti-over-engineering.md
│   ├── improvement-protocol.md
│   ├── output-formats-developer.md
│   ├── output-formats-pm.md
│   ├── output-formats-reviewer.md
│   └── output-formats-tester.md
├── docs/                       # Documentation
│   ├── PROMPT_BIBLE.md
│   ├── SKILLS_ARCHITECTURE.md
│   └── AGENTS_ARCHITECTURE.md  # This file
└── compile.mjs                 # Build script

.claude/                        # Compiled output (auto-generated)
├── agents/                     # Compiled agent .md files
│   ├── agent-summoner.md
│   ├── developer.md
│   └── ...
└── skills/                     # Compiled skill directories
    ├── frontend-react/
    │   └── SKILL.md
    ├── frontend-api/
    │   └── SKILL.md
    └── ...
```

---

## 3. File Conventions

### Naming

| Type           | Location                            | Naming Pattern  | Example                     |
| -------------- | ----------------------------------- | --------------- | --------------------------- |
| Agent source   | `.claude-src/agents/`               | `[name].src.md` | `frontend-developer.src.md` |
| Agent compiled | `.claude/agents/`                   | `[name].md`     | `frontend-developer.md`     |
| Skill source   | `.claude-src/skills/[category]/`    | `[name].md`     | `react.md`                  |
| Skill compiled | `.claude/skills/[category]-[name]/` | `SKILL.md`      | `frontend-react/SKILL.md`   |
| Core prompt    | `.claude-src/core prompts/`         | `[name].md`     | `core-principles.md`        |

### Rules

- **All files use kebab-case naming** (lowercase with hyphens)
- **Never edit files in `.claude/` directly** - they are auto-generated
- **Agent source files must have `.src.md` extension** - this triggers compilation
- **Skill source files use `.md` extension** - no `.src.md` needed

---

## 4. The Compilation System

### The @include Directive

The build system resolves `@include()` directives to inline file contents:

```markdown
@include(../core prompts/core-principles.md)
```

This directive is replaced with the entire contents of `core-principles.md`.

### Escaping for Examples

To show `@include()` as text (not expand it), prefix with a backtick:

```markdown
To include core principles, add:
`@include(../core prompts/core-principles.md)`
```

The backtick prevents expansion, keeping the text as-is in compiled output.

### compile.mjs Behavior

The build script (`node .claude-src/compile.mjs`):

1. **Finds source files**
   - Scans `.claude-src/agents/` for `*.src.md` files
   - Scans `.claude-src/skills/[category]/` for `*.md` files

2. **Resolves @include directives**
   - Recursively expands all `@include()` references
   - Uses negative lookbehind to skip backtick-prefixed includes
   - Detects and warns about circular includes

3. **Outputs compiled files**
   - Agents → `.claude/agents/[name].md`
   - Skills → `.claude/skills/[category]-[name]/SKILL.md`

4. **Error handling**
   - Reports missing include files
   - Leaves directive in place if file not found
   - Exits with error code on compilation failure

### Running Compilation

```bash
# Compile everything (agents and skills)
node .claude-src/compile.mjs

# Compile a specific agent
node .claude-src/compile.mjs .claude-src/agents/developer.src.md
```

---

## 5. Canonical Structure

Every agent follows this exact section order. This structure is validated by the Essential Techniques from PROMPT_BIBLE.md.

| #   | Section                      | Required?              | Purpose                                                          |
| --- | ---------------------------- | ---------------------- | ---------------------------------------------------------------- |
| 1   | Frontmatter                  | YES                    | Metadata (name, description, model, tools)                       |
| 2   | Title & Introduction         | YES                    | `<role>` wrapper with expansion modifiers                        |
| 3   | Preloaded Content            | YES                    | Lists all @includes to prevent re-reading                        |
| 4   | Critical Requirements        | YES                    | `<critical_requirements>` at TOP with `**(You MUST ...)**`       |
| 5   | Core Principles              | YES                    | `@include(../core prompts/core-principles.md)`                   |
| 6   | Investigation Requirement    | YES                    | `@include(../core prompts/investigation-requirement.md)`         |
| 7   | Write Verification           | YES                    | `@include(../core prompts/write-verification.md)`                |
| 8   | Self-Correction Triggers     | YES                    | `<self_correction_triggers>` with "If you notice yourself..."    |
| 9   | Agent-Specific Investigation | YES                    | Customized investigation steps for domain                        |
| 10  | Post-Action Reflection       | YES                    | `<post_action_reflection>`                                       |
| 11  | Progress Tracking            | YES                    | `<progress_tracking>`                                            |
| 12  | Main Workflow                | YES                    | Core "how to work" section                                       |
| 13  | Retrieval Strategy           | Recommended            | `<retrieval_strategy>` for just-in-time loading                  |
| 14  | Anti-Over-Engineering        | For implementers       | `@include(../core prompts/anti-over-engineering.md)`             |
| 15  | Domain-Specific Sections     | YES                    | Patterns, checklists, examples                                   |
| 16  | Permission Scope             | For improvement agents | `<permission_scope>`                                             |
| 17  | Domain Scope                 | YES                    | `<domain_scope>` with handles/doesn't handle                     |
| 18  | Output Formats               | YES                    | Role-appropriate `@include(../core prompts/output-formats-*.md)` |
| 19  | Pre-compiled Skills          | As needed              | Skill @includes per SKILLS_ARCHITECTURE.md                       |
| 20  | Example Output               | Recommended            | Complete example of agent's work                                 |
| 21  | Self-Improvement Protocol    | YES                    | `@include(../core prompts/improvement-protocol.md)`              |
| 22  | Critical Reminders           | YES                    | `<critical_reminders>` at BOTTOM (repeats from #4)               |
| 23  | Final Reminder               | YES                    | Both lines that close the self-reminder loop                     |

### The Final Reminder (Section 23)

Every agent MUST end with both lines:

```markdown
**DISPLAY ALL 5 CORE PRINCIPLES AT THE START OF EVERY RESPONSE TO MAINTAIN INSTRUCTION CONTINUITY.**

**ALWAYS RE-READ FILES AFTER EDITING TO VERIFY CHANGES WERE WRITTEN. NEVER REPORT SUCCESS WITHOUT VERIFICATION.**
```

This closes two essential loops:

- The **self-reminder loop** (60-70% reduction in off-task behavior)
- The **write verification loop** (prevents false-success reports)

---

## 6. Technique Compliance Mapping

This section maps the **Essential Techniques from PROMPT_BIBLE.md** to their structural implementation in the Canonical Structure. An agent that follows the Canonical Structure correctly is automatically compliant with all Essential Techniques.

> **Single-Reference Compliance:** You can validate agent compliance by checking against this document alone. The mapping below ensures PROMPT_BIBLE technique compliance is encoded into the structural requirements.

### Technique-to-Section Mapping

| #   | PROMPT_BIBLE Technique          | Impact                   | Implemented In Section(s)                                        | Structural Requirement                                                                             |
| --- | ------------------------------- | ------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | **Self-Reminder Loop**          | 60-70% ↓ off-task        | 5 (Core Principles) + 24 (Final Reminder)                        | `@include(core-principles.md)` + both final reminder lines                                         |
| 2   | **Investigation-First**         | 80% ↓ hallucination      | 6 (Investigation Requirement) + 9 (Agent-Specific Investigation) | `@include(investigation-requirement.md)` + custom investigation steps                              |
| 3   | **Emphatic Repetition**         | 70% ↓ scope creep        | 4 (Critical Requirements) + 23 (Critical Reminders)              | `<critical_requirements>` at TOP, `<critical_reminders>` at BOTTOM, both with `**(You MUST ...)**` |
| 4   | **XML Semantic Tags**           | 30% ↑ accuracy           | All sections                                                     | Use semantic tag names (`<role>`, `<workflow>`, `<domain_scope>`) not generic (`<section1>`)       |
| 5   | **Documents First, Query Last** | 30% ↑ performance        | N/A (only for 20K+ tokens)                                       | For long agents: place reference content before instructions                                       |
| 6   | **Expansion Modifiers**         | Unlocks full capability  | 2 (Title & Introduction)                                         | `<role>` must include: "be comprehensive and thorough" or similar                                  |
| 7   | **Self-Correction Triggers**    | 74.4% SWE-bench          | 8 (Self-Correction Triggers)                                     | `<self_correction_triggers>` with "If you notice yourself..." patterns                             |
| 8   | **Post-Action Reflection**      | ↑ long-horizon reasoning | 10 (Post-Action Reflection)                                      | `<post_action_reflection>` with "After each major action, evaluate..."                             |
| 9   | **Progress Tracking**           | 30+ hour focus           | 11 (Progress Tracking)                                           | `<progress_tracking>` with structured note-taking guidance                                         |
| 10  | **Positive Framing**            | Better adherence         | Throughout                                                       | "Use named exports" not "Don't use default exports"                                                |
| 11  | **"Think" Alternatives**        | Prevents Opus confusion  | Throughout                                                       | Use "consider, evaluate, analyze" instead of "think"                                               |
| 12  | **Just-in-Time Loading**        | Preserves context        | 13 (Retrieval Strategy)                                          | `<retrieval_strategy>` with Glob → Grep → Read pattern                                             |
| 13  | **Write Verification**          | Prevents false-success   | 7 (Write Verification) + 24 (Final Reminder)                     | `@include(write-verification.md)` + second final reminder line                                     |

### Compliance Checklist

Use this checklist to verify an agent is 100% compliant with both AGENTS_ARCHITECTURE and PROMPT_BIBLE:

```markdown
## Technique Compliance (from PROMPT_BIBLE via structural requirements)

- [ ] **T1 Self-Reminder Loop:** Has `@include(core-principles.md)` AND both final reminder lines
- [ ] **T2 Investigation-First:** Has `@include(investigation-requirement.md)` AND agent-specific investigation section
- [ ] **T3 Emphatic Repetition:** Has `<critical_requirements>` at TOP AND `<critical_reminders>` at BOTTOM with matching rules
- [ ] **T4 XML Semantic Tags:** All major sections use semantic XML tag names
- [ ] **T5 Documents First:** (N/A for most agents, only 20K+ token agents)
- [ ] **T6 Expansion Modifiers:** `<role>` section includes "comprehensive and thorough" or equivalent
- [ ] **T7 Self-Correction Triggers:** Has `<self_correction_triggers>` with 4+ "If you notice yourself..." patterns
- [ ] **T8 Post-Action Reflection:** Has `<post_action_reflection>` section
- [ ] **T9 Progress Tracking:** Has `<progress_tracking>` section
- [ ] **T10 Positive Framing:** Constraints stated positively (what TO do, not just what NOT to do)
- [ ] **T11 "Think" Alternatives:** No bare "think" usage (use consider/evaluate/analyze)
- [ ] **T12 Just-in-Time Loading:** Has `<retrieval_strategy>` section (for agents that explore codebases)
- [ ] **T13 Write Verification:** Has `@include(write-verification.md)` AND second final reminder line
```

### Non-Structural Techniques

Techniques #4, #10, and #11 are applied **throughout** the agent rather than in specific sections:

| Technique                    | How to Verify                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **#4 XML Semantic Tags**     | Grep for `<section` or `<part` - should find 0 matches. All tags should be semantic.                                                                         |
| **#10 Positive Framing**     | Review constraints/rules sections. "Use X" should appear more than "Don't do Y".                                                                             |
| **#11 "Think" Alternatives** | Grep for `\bthink\b` (regex: `\b` = word boundary, matches whole word "think" only) - replace with consider/evaluate/analyze where found. Critical for Opus. |

---

## 7. Pre-compiled vs Dynamic Skills

Skills can be loaded two ways:

| Type         | Symbol | Mechanism              | When to Use                         |
| ------------ | ------ | ---------------------- | ----------------------------------- |
| Pre-compiled | 📦     | `@include()` directive | Agent needs skill for 80%+ of tasks |
| Dynamic      | ⚡     | Skill tool invocation  | Agent needs skill for <20% of tasks |

### Pre-compiled Skills

Bundled into the agent at compile time:

```markdown
@include(../skills/frontend/react.md)
```

- Always in the agent's context
- No tool invocation needed
- Increases agent size but ensures instant access

### Dynamic Skills

Loaded at runtime via the Skill tool:

```markdown
skill: "frontend-react"
```

- Loaded only when needed
- Preserves context window
- Listed in `<preloaded_content>` with "when to use" descriptions

### Source of Truth

**SKILLS_ARCHITECTURE.md** is the authoritative reference for:

- Which skills are pre-compiled vs dynamic for each agent
- Complete agent-to-skill mapping tables
- Rationale for each mapping decision

---

## 8. The Preloaded Content Pattern

Every agent includes a `<preloaded_content>` section that prevents wasteful re-reading of already-loaded content.

### Purpose

Without this section, agents may:

- Attempt to read files already in their context (wastes tokens)
- Get confused about what's available vs what needs loading
- Invoke skills that are already bundled

### Structure

```markdown
<preloaded_content>
**IMPORTANT: The following content is already in your context. DO NOT read these files from the filesystem:**

**Core Prompts (already loaded below via @include):**

- ✅ Core Principles (see section below)
- ✅ Investigation Requirement (see section below)
- ✅ Write Verification (see section below)

**Pre-compiled Skills (already loaded below via @include):**

- ✅ React patterns (see section below)
- ✅ Styling patterns (see section below)

**Dynamic Skills (invoke when needed):**

- Use `skill: "frontend-api"` when integrating with REST APIs
- Use `skill: "frontend-accessibility"` when implementing accessible components

</preloaded_content>
```

### Rules

1. List every `@include` that appears in the agent
2. Mark bundled content with ✅ and "(see section below)"
3. List dynamic skills with their invocation trigger
4. Place this section early (after Title & Introduction)

---

## 9. Adding a New Agent

Follow this step-by-step process:

### Step 1: Create Source File

```bash
# Create the source file
touch .claude-src/agents/[agent-name].src.md
```

### Step 2: Add Frontmatter

```markdown
---
name: agent-name
description: One-line description for Task tool
model: opus
tools: Read, Write, Edit, Grep, Glob, Bash
---
```

### Step 3: Add Required Sections

1. **Title with `<role>` wrapper**

   ```markdown
   # Agent Name

   <role>
   You are an expert in [domain]. Your mission: [concise mission statement].

   **When working on [domain tasks], be comprehensive and thorough.**
   </role>
   ```

2. **`<preloaded_content>` section** - List all @includes

3. **`<critical_requirements>` section**

   ```markdown
   <critical_requirements>

   ## ⚠️ CRITICAL: Before Any Work

   **(You MUST [critical rule 1])**
   **(You MUST [critical rule 2])**
   </critical_requirements>
   ```

4. **Required @includes**

   ```markdown
   @include(../core prompts/core-principles.md)
   @include(../core prompts/investigation-requirement.md)
   @include(../core prompts/write-verification.md)
   ```

5. **Agent-specific sections** (workflow, domain content, etc.)

6. **`<critical_reminders>` section** (repeat rules from #3)

7. **Final reminder** (both lines)

### Step 4: Consult SKILLS_ARCHITECTURE.md

Determine which skills to:

- Bundle via `@include` (📦 Pre-compiled)
- List for dynamic invocation (⚡ Dynamic)

### Step 5: Compile

```bash
node .claude-src/compile.mjs
```

### Step 6: Verify

Check that `.claude/agents/[agent-name].md` exists and contains all resolved includes.

---

## 10. Adding a New Skill

### Step 1: Determine Category

| Category    | Content                                           |
| ----------- | ------------------------------------------------- |
| `frontend/` | React, styling, state, testing, a11y, performance |
| `backend/`  | API routes, database, CI/CD                       |
| `security/` | Auth, OWASP, secrets                              |
| `setup/`    | Monorepo, packages, env, tooling                  |
| `shared/`   | Cross-cutting concerns (reviewing)                |

### Step 2: Create Skill File

```bash
touch .claude-src/skills/[category]/[skill-name].md
```

### Step 3: Follow Skill Structure

```markdown
# [Skill Name] Patterns

> **Quick Guide:** [1-2 sentence summary of key patterns]

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

**(You MUST [domain-specific rule 1])**
**(You MUST [domain-specific rule 2])**
</critical_requirements>

---

**Auto-detection:** [keywords that trigger this skill]
**When to use:** [bullet list of scenarios]
**Key patterns covered:** [summary of patterns]

---

<philosophy>
## Philosophy
[When to use / When NOT to use this skill]
</philosophy>

---

<patterns>
## Core Patterns

### Pattern 1: [Name]

[Explanation with embedded ✅ Good / ❌ Bad examples]
</patterns>

---

<decision_framework>

## Decision Framework

[Decision tree or flowchart]
</decision_framework>

---

<red_flags>

## RED FLAGS

[High/Medium priority issues, Common mistakes]
</red_flags>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

**(You MUST [rule 1])** (repeat from top)
</critical_reminders>
```

### Step 4: Update SKILLS_ARCHITECTURE.md

Add the new skill to:

- The directory structure section
- The skills status table
- Relevant agent-to-skill mapping tables

### Step 5: Update Agent Preloaded Content

For each agent that should use this skill:

- If pre-compiled: Add `@include` and update `<preloaded_content>`
- If dynamic: Add to dynamic skills list in `<preloaded_content>`

### Step 6: Compile

```bash
node .claude-src/compile.mjs
```

### Step 7: Verify

Check that `.claude/skills/[category]-[skill-name]/SKILL.md` exists.

---

## 11. Build & Deployment Workflow

### Development Flow

```
1. Edit source files in .claude-src/
   ├── agents/*.src.md
   ├── skills/[category]/*.md
   └── core prompts/*.md

2. Run build
   $ node .claude-src/compile.mjs

3. Verify output in .claude/
   ├── agents/*.md (compiled agents)
   └── skills/[category]-[name]/SKILL.md (compiled skills)

4. Test with Claude Code
   - Agents load from .claude/agents/
   - Skills invoke from .claude/skills/

5. Commit both source and compiled files
   - Source files for future edits
   - Compiled files for deployment
```

### Pre-commit Checklist

- [ ] All @includes resolve (no error messages during compile)
- [ ] Agent has all Canonical Structure sections in correct order
- [ ] Final reminder has both lines
- [ ] Preloaded content lists all @includes
- [ ] Skills are correctly mapped per SKILLS_ARCHITECTURE.md

---

## 12. Relationship to Other Docs

| Document                   | Purpose                                   | When to Consult                                     |
| -------------------------- | ----------------------------------------- | --------------------------------------------------- |
| **PROMPT_BIBLE.md**        | WHY techniques work (universal, portable) | Understanding prompt engineering principles         |
| **AGENTS_ARCHITECTURE.md** | HOW this system is built (this doc)       | Adding/modifying agents, understanding build system |
| **SKILLS_ARCHITECTURE.md** | WHAT skills exist and agent mappings      | Determining which skills an agent needs             |

### Cross-Reference Guide

**Creating a new agent?**

1. Read PROMPT_BIBLE.md for the Essential Techniques
2. Read this doc for the Canonical Structure
3. Read SKILLS_ARCHITECTURE.md for skill mappings

**Creating a new skill?**

1. Read SKILLS_ARCHITECTURE.md for skill structure
2. Read this doc for build process
3. Update SKILLS_ARCHITECTURE.md with new skill

**Improving an agent?**

1. Read PROMPT_BIBLE.md for technique compliance
2. Read this doc for structure compliance
3. Check SKILLS_ARCHITECTURE.md for correct skill usage

---

## Quick Reference

### Essential Commands

```bash
# Compile everything
node .claude-src/compile.mjs

# Compile single agent
node .claude-src/compile.mjs .claude-src/agents/[name].src.md
```

### Essential Files

| Purpose         | Location                             |
| --------------- | ------------------------------------ |
| Agent sources   | `.claude-src/agents/*.src.md`        |
| Skill sources   | `.claude-src/skills/[category]/*.md` |
| Core prompts    | `.claude-src/core prompts/*.md`      |
| Build script    | `.claude-src/compile.mjs`            |
| Compiled agents | `.claude/agents/*.md`                |
| Compiled skills | `.claude/skills/*/SKILL.md`          |

### Essential Patterns

**Include a core prompt:**

```markdown
@include(../core prompts/core-principles.md)
```

**Show include as example (don't expand):**

```markdown
`@include(../core prompts/core-principles.md)`
```

**Invoke a dynamic skill:**

```markdown
skill: "frontend-react"
```
