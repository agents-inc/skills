# Modular Agent & Skill Architecture

> **Source of Truth** for creating agents and skills with the new TypeScript + LiquidJS compilation system.

## Overview

This system compiles modular source files into standalone agent/skill markdown files using:
- **TypeScript compiler**: `.claude-src/compile.ts`
- **LiquidJS templates**: `.claude-src/templates/agent.liquid`
- **Agent definitions**: `.claude-src/agents.yaml` (single source of truth)
- **Profile configuration**: `.claude-src/profiles/{profile}/config.yaml` (skill assignments)

## Core Architecture Principle

**Agents are GENERIC. Skills are PROFILE-SPECIFIC.**

| Layer | Location | Purpose | Changes Per Profile |
|-------|----------|---------|---------------------|
| **Agents** | `.claude-src/agent-sources/` | Define *role* + *workflow* | NO - single source |
| **Skills** | `.claude-src/profiles/{profile}/skills/` | Define *implementation patterns* | YES - vary by tech stack |
| **Config** | `.claude-src/profiles/{profile}/config.yaml` | Control which agents/skills compile | YES - profile-specific |

**Example:**
- `frontend-developer` agent (generic): "You implement React components following patterns"
- `frontend/react` skill (home): "Use Zustand, SCSS Modules, React Query"
- `frontend/react` skill (work): "Use MobX, Tailwind, observer() pattern"

## Profile Switching Workflow

Switching profiles is a single command. The compiler **clears all output** and regenerates:

```bash
# Switch to work profile (Photoroom - MobX, Tailwind)
npm run compile:work

# Switch to home profile (Personal - Zustand, SCSS)
npm run compile:home
```

**What happens:**
1. `.claude/agents/` is **cleared completely**
2. `.claude/skills/` is **cleared completely**
3. Only agents defined in the profile's `config.yaml` are compiled
4. Each agent gets bundled with that profile's skills
5. `CLAUDE.md` is copied from the profile

**Result:** Only the active profile's agents are visible to Claude Code.

## Directory Structure

```
.claude-src/
├── agents.yaml                # Single source of truth for ALL agent definitions
│                              # Contains: title, description, model, tools, core_prompts, output_format
│
├── agent-sources/             # Agent source files (GENERIC - shared across profiles)
│   └── {agent-name}/          # Named "agent-sources" to avoid Claude Code auto-detection
│       ├── intro.md           # REQUIRED: Role definition (NO <role> tags - template adds them)
│       ├── workflow.md        # REQUIRED: Agent-specific workflow and processes
│       ├── critical-requirements.md  # OPTIONAL: Top-of-file MUST rules
│       ├── critical-reminders.md     # OPTIONAL: Bottom-of-file MUST reminders
│       └── examples.md        # OPTIONAL: Example outputs
│
├── core-prompts/              # Shared prompts included in all agents
│   ├── core-principles.md     # 5 core principles with self-reminder loop
│   ├── investigation-requirement.md
│   ├── write-verification.md
│   ├── anti-over-engineering.md
│   ├── context-management.md
│   ├── improvement-protocol.md
│   └── output-formats-{type}.md  # Role-specific output formats
│
├── profiles/                  # Profile-specific configuration
│   └── {profile}/
│       ├── config.yaml        # agent_skills (keys determine which agents compile)
│       ├── CLAUDE.md          # Profile-specific project instructions
│       └── skills/            # Profile-specific implementation patterns
│           └── {category}/
│               └── {skill}.md
│
├── templates/
│   └── agent.liquid           # Main agent template
│
├── types.ts                   # TypeScript type definitions
│
├── compile.ts                 # Compiler (loads agents.yaml + merges with profile skills)
│
└── docs/
    └── CLAUDE_ARCHITECTURE_BIBLE.md  # This file

.claude/                       # Compiled output (gitignored or committed)
├── agents/                    # Compiled agents (CLEARED on each compile)
│   └── {agent-name}.md        # No profile suffix - clean names
└── skills/                    # Compiled skills (CLEARED on each compile)
    └── {skill-id}/
        └── SKILL.md
```

## Agent Source File Structure

### 1. intro.md

The agent's role definition. **Do NOT include `<role>` tags** - the template adds them.

**CRITICAL: Include Expansion Modifiers** (See PROMPT_BIBLE Technique #6)

Sonnet/Opus 4.5 are conservative by default. Without expansion modifiers, they produce minimal implementations. Every intro.md MUST include phrases like:
- "be comprehensive and thorough"
- "include all necessary edge cases"
- "go beyond the basics"

```markdown
You are an expert [role description].

**When [doing X], be comprehensive and thorough. Include all necessary edge cases and error handling.**

**Your mission:** [Clear mission statement]

**Your focus:**
- [Focus area 1]
- [Focus area 2]

**Defer to specialists for:**
- [Area] -> [Other Agent]
```

> **Why this matters:** Without expansion modifiers, Claude 4.x produces bare-minimum implementations that technically meet requirements but miss obvious features. This single addition unlocks full model capability.

### 2. workflow.md

Agent-specific processes. Include XML tags for semantic sections:

```markdown
## Your Investigation Process

**BEFORE [action], you MUST:**

\`\`\`xml
<mandatory_investigation>
1. [Step 1]
2. [Step 2]
</mandatory_investigation>
\`\`\`

---

## Your Development Workflow

\`\`\`xml
<development_workflow>
**Step 1: [Name]**
- [Details]

<post_action_reflection>
After each step, evaluate:
1. Did this achieve the goal?
2. What gaps remain?
</post_action_reflection>
</development_workflow>
\`\`\`

---

## Self-Correction Checkpoints

<self_correction_triggers>
**If you notice yourself:**
- **[Bad behavior]** → STOP. [Correction]
</self_correction_triggers>
```

### 3. critical-requirements.md

Top-of-file MUST rules. **Do NOT include `<critical_requirements>` tags** - template adds them.

```markdown
## CRITICAL: Before Any Work

**(You MUST [requirement 1])**

**(You MUST [requirement 2])**

**(You MUST [requirement 3])**
```

### 4. critical-reminders.md

Bottom-of-file reminders (emphatic repetition). **Do NOT include `<critical_reminders>` tags** - template adds them.

```markdown
## ⚠️ CRITICAL REMINDERS

**(You MUST [reminder 1])**

**(You MUST [reminder 2])**

**Failure to follow these rules will [consequence].**
```

### 5. examples.md (Optional)

Example outputs showing ideal agent behavior:

```markdown
## Example [Type] Output

Here's what a complete, high-quality output looks like:

\`\`\`markdown
# [Example Title]

## [Section 1]
[Content]

## Verification Checklist
✅ [Criterion 1]
✅ [Criterion 2]
\`\`\`
```

## Writing Style Guidelines

These guidelines apply to ALL agent source files. Following them ensures optimal Claude 4.x behavior.

### "Think" Alternatives (PROMPT_BIBLE Technique #11)

**CRITICAL for Opus 4.5:** The word "think" and its variants can cause confusion when extended thinking is disabled. Replace with alternatives:

| Avoid | Use Instead |
|-------|-------------|
| think | consider, evaluate, analyze |
| think about | reflect on, assess |
| think through | work through, examine |
| thinking | reasoning, analysis |

**Example:**
```markdown
# ❌ Bad
Think about the implications before proceeding.

# ✅ Good
Consider the implications before proceeding.
```

**Exception - Claude Code Triggers:** When making requests TO Claude Code (not in agent prompts), you CAN use these trigger words to allocate thinking budget:
- `think` (~4K tokens) - routine tasks
- `megathink` (~10K tokens) - intermediate problems
- `ultrathink` (~32K tokens) - major architectural challenges

### Positive Framing (PROMPT_BIBLE Technique #10)

Frame constraints positively (what TO do) rather than negatively (what NOT to do):

```markdown
# ❌ Bad
Do NOT use default exports.
Never create magic numbers.

# ✅ Good
Use named exports for all public APIs.
Define all numeric values as named constants.
```

**Why this matters:** Positive instructions are easier to follow and reduce cognitive load. The agent doesn't have to invert the instruction mentally.

### Emphatic Formatting

Use these formatting patterns for emphasis:

| Format | When to Use | Example |
|--------|-------------|---------|
| **Bold** | Important rules | **Always verify changes** |
| **(Bold + parentheses)** | Ultra-critical MUST rules | **(You MUST read files before editing)** |
| ALL CAPS | Section headers only | ## CRITICAL REMINDERS |
| `code` | File names, commands, tags | `intro.md`, `<role>` |

---

## Template Structure (agent.liquid)

The template assembles agents in this order:

```
1. Frontmatter (name, description, model, tools)
2. Title
3. <role>{{ intro }}</role>
4. <preloaded_content>...</preloaded_content>
5. <critical_requirements>{{ criticalRequirementsTop }}</critical_requirements>
6. {{ corePromptsContent }}  (core-principles, investigation, write-verification, anti-over-engineering)
7. {{ workflow }}
8. ## Standards and Conventions
9. Pre-compiled Skills
10. {{ examples }}
11. {{ outputFormat }}
12. {{ endingPromptsContent }}  (context-management, improvement-protocol)
13. <critical_reminders>{{ criticalReminders }}</critical_reminders>
14. Final reminder lines
```

## The Preloaded Content Pattern

Every compiled agent includes a `<preloaded_content>` section (added by template at position 4). This pattern prevents wasteful re-reading of content already in the agent's context.

### Purpose

Without this section, agents may:
- Attempt to read files already bundled into their context (wastes tokens)
- Get confused about what's available vs. what needs loading
- Invoke skills that are already pre-compiled

### Structure

The template generates this section automatically based on `config.yaml`:

```markdown
<preloaded_content>
**IMPORTANT: The following content is already in your context. DO NOT read these files:**

**Core Prompts (loaded via template):**
- ✅ Core Principles (see `<core_principles>` section)
- ✅ Investigation Requirement (see `<investigation_requirement>` section)
- ✅ Write Verification (see `<write_verification_protocol>` section)

**Pre-compiled Skills (bundled into this agent):**
- ✅ React patterns (see Standards section)
- ✅ Styling patterns (see Standards section)

**Dynamic Skills (invoke when needed):**
- Use `skill: "frontend-api"` when integrating with REST APIs
- Use `skill: "frontend-accessibility"` for accessible component patterns
</preloaded_content>
```

### How It Works

1. **Pre-compiled skills** (📦) are listed with ✅ - already in context
2. **Dynamic skills** (⚡) are listed with invocation syntax - load when needed
3. The agent sees what's bundled and knows not to re-read those files

### Configuration

In `config.yaml`, skills are marked as precompiled or dynamic:

```yaml
skills:
  precompiled:
    - frontend/react      # Bundled into agent
    - frontend/styling    # Bundled into agent
  dynamic:
    - id: frontend/api
      description: "REST API integration patterns"
      usage: "When implementing API calls"
```

---

## Required XML Tags

These tags MUST appear in compiled agents:

| Tag | Source | Purpose |
|-----|--------|---------|
| `<role>` | Template wraps intro.md | Agent identity |
| `<preloaded_content>` | Template | Lists what's already loaded |
| `<critical_requirements>` | Template wraps critical-requirements.md | Top MUST rules |
| `<critical_reminders>` | Template wraps critical-reminders.md | Bottom MUST reminders |
| `<core_principles>` | core-prompts/core-principles.md | 5 principles + self-reminder |
| `<investigation_requirement>` | core-prompts/investigation-requirement.md | Investigation-first |
| `<write_verification_protocol>` | core-prompts/write-verification.md | Verify writes |
| `<anti_over_engineering>` | core-prompts/anti-over-engineering.md | Minimal changes |
| `<self_correction_triggers>` | workflow.md | Mid-task corrections |
| `<post_action_reflection>` | workflow.md | After-step evaluation |
| `<output_format>` | core-prompts/output-formats-*.md | Response structure |
| `<context_management>` | core-prompts/context-management.md | Token management |
| `<improvement_protocol>` | core-prompts/improvement-protocol.md | Self-improvement |

## Technique Compliance Mapping

This section maps the 13 Essential Techniques from `PROMPT_BIBLE.md` to their implementation in this architecture. An agent built correctly with this system is automatically compliant with all proven techniques.

> **Reference:** See `PROMPT_BIBLE.md` for detailed rationale and performance metrics for each technique.

### Technique-to-Implementation Mapping

| # | Technique | Impact | Implemented In | How |
|---|-----------|--------|----------------|-----|
| 1 | **Self-Reminder Loop** | 60-70% ↓ off-task | `core-prompts/core-principles.md` + template final lines | Core principles displayed every response + dual closing reminder |
| 2 | **Investigation-First** | 80% ↓ hallucination | `core-prompts/investigation-requirement.md` + `workflow.md` | Investigation requirement + agent-specific investigation steps |
| 3 | **Emphatic Repetition** | 70% ↓ scope creep | `critical-requirements.md` + `critical-reminders.md` | Template wraps both with XML tags, rules repeated top AND bottom |
| 4 | **XML Semantic Tags** | 30% ↑ accuracy | All files | Template adds semantic tags; source files use semantic XML |
| 5 | **Documents First, Query Last** | 30% ↑ performance | Template ordering | Template places content before instructions (for 20K+ agents) |
| 6 | **Expansion Modifiers** | Unlocks capability | `intro.md` | MUST include "comprehensive and thorough" (see intro.md section) |
| 7 | **Self-Correction Triggers** | 74.4% SWE-bench | `workflow.md` | `<self_correction_triggers>` with "If you notice yourself..." |
| 8 | **Post-Action Reflection** | ↑ long-horizon | `workflow.md` | `<post_action_reflection>` after major workflow steps |
| 9 | **Progress Tracking** | 30+ hour focus | `workflow.md` | `<progress_tracking>` section for extended sessions |
| 10 | **Positive Framing** | Better adherence | All files | Writing Style Guidelines: "Use X" not "Don't do Y" |
| 11 | **"Think" Alternatives** | Prevents Opus confusion | All files | Writing Style Guidelines: consider/evaluate/analyze |
| 12 | **Just-in-Time Loading** | Preserves context | `workflow.md` | `<retrieval_strategy>` with Glob → Grep → Read pattern |
| 13 | **Write Verification** | Prevents false-success | `core-prompts/write-verification.md` + template | Write verification protocol + second closing reminder |

### Validation Checklist

Use this checklist to verify an agent is 100% compliant:

```markdown
## Structural Compliance
- [ ] Has REQUIRED source files: intro.md, workflow.md
- [ ] Has OPTIONAL source files (recommended): critical-requirements.md, critical-reminders.md, examples.md
- [ ] intro.md includes expansion modifiers ("comprehensive and thorough")
- [ ] workflow.md includes <self_correction_triggers>
- [ ] workflow.md includes <post_action_reflection>
- [ ] If present: critical-requirements.md uses **(You MUST ...)** format
- [ ] If present: critical-reminders.md repeats rules from critical-requirements.md

## Template Output Compliance (verify after compilation)
- [ ] Compiled agent has all 13 Required XML Tags
- [ ] Ends with both final reminder lines
- [ ] <preloaded_content> lists all bundled content

## Writing Style Compliance
- [ ] No bare "think" usage (use consider/evaluate/analyze)
- [ ] Constraints stated positively (what TO do first)
- [ ] Critical rules use emphatic formatting
```

### Runnable Verification Commands

After compiling an agent, run these commands to verify compliance. Replace `{agent}` with the agent name.

**1. Verify Required XML Tags (13 total):**

```bash
# Check for all required XML tags in compiled agent
AGENT="{agent}"
echo "=== Required XML Tags Check for $AGENT ==="
grep -c "<role>" .claude/agents/$AGENT.md && echo "✅ <role>" || echo "❌ <role> MISSING"
grep -c "<preloaded_content>" .claude/agents/$AGENT.md && echo "✅ <preloaded_content>" || echo "❌ <preloaded_content> MISSING"
grep -c "<critical_requirements>" .claude/agents/$AGENT.md && echo "✅ <critical_requirements>" || echo "❌ <critical_requirements> MISSING"
grep -c "<critical_reminders>" .claude/agents/$AGENT.md && echo "✅ <critical_reminders>" || echo "❌ <critical_reminders> MISSING"
grep -c "<core_principles>" .claude/agents/$AGENT.md && echo "✅ <core_principles>" || echo "❌ <core_principles> MISSING"
grep -c "<investigation_requirement>" .claude/agents/$AGENT.md && echo "✅ <investigation_requirement>" || echo "❌ <investigation_requirement> MISSING"
grep -c "<write_verification_protocol>" .claude/agents/$AGENT.md && echo "✅ <write_verification_protocol>" || echo "❌ <write_verification_protocol> MISSING"
grep -c "<anti_over_engineering>" .claude/agents/$AGENT.md && echo "✅ <anti_over_engineering>" || echo "❌ <anti_over_engineering> (optional for non-implementers)"
grep -c "<self_correction_triggers>" .claude/agents/$AGENT.md && echo "✅ <self_correction_triggers>" || echo "❌ <self_correction_triggers> MISSING"
grep -c "<post_action_reflection>" .claude/agents/$AGENT.md && echo "✅ <post_action_reflection>" || echo "❌ <post_action_reflection> MISSING"
grep -c "<output_format>" .claude/agents/$AGENT.md && echo "✅ <output_format>" || echo "❌ <output_format> MISSING"
grep -c "<context_management>" .claude/agents/$AGENT.md && echo "✅ <context_management>" || echo "❌ <context_management> MISSING"
grep -c "<improvement_protocol>" .claude/agents/$AGENT.md && echo "✅ <improvement_protocol>" || echo "❌ <improvement_protocol> MISSING"
```

**2. Verify Final Reminder Lines:**

```bash
# Check both final reminder lines exist
AGENT="{agent}"
echo "=== Final Reminder Check for $AGENT ==="
grep -q "DISPLAY ALL 5 CORE PRINCIPLES" .claude/agents/$AGENT.md && echo "✅ Self-reminder loop line present" || echo "❌ Self-reminder loop line MISSING"
grep -q "ALWAYS RE-READ FILES AFTER EDITING" .claude/agents/$AGENT.md && echo "✅ Write verification line present" || echo "❌ Write verification line MISSING"
```

**3. Check for Forbidden "Think" Usage (Opus 4.5):**

```bash
# Find bare "think" usage in source files (should be 0 for Opus agents)
AGENT="{agent}"
echo "=== 'Think' Usage Check for $AGENT ==="
grep -n -w "think" .claude-src/agent-sources/$AGENT/*.md | grep -v "ultrathink\|megathink" | wc -l
# If count > 0, review matches and replace with consider/evaluate/analyze
```

**4. Verify Expansion Modifiers in intro.md:**

```bash
# Check intro.md has expansion modifiers
AGENT="{agent}"
echo "=== Expansion Modifier Check for $AGENT ==="
grep -q "comprehensive\|thorough" .claude-src/agent-sources/$AGENT/intro.md && echo "✅ Expansion modifiers found" || echo "❌ Add 'comprehensive and thorough' to intro.md"
```

**5. Verify Critical Rules Repetition (if optional files exist):**

```bash
# Check that critical-reminders repeats rules from critical-requirements
AGENT="{agent}"
echo "=== Critical Rules Repetition Check for $AGENT ==="
REQ_COUNT=$(grep -c "You MUST" .claude-src/agent-sources/$AGENT/critical-requirements.md 2>/dev/null || echo 0)
REM_COUNT=$(grep -c "You MUST" .claude-src/agent-sources/$AGENT/critical-reminders.md 2>/dev/null || echo 0)
echo "critical-requirements.md: $REQ_COUNT rules"
echo "critical-reminders.md: $REM_COUNT rules"
[ "$REQ_COUNT" -eq "$REM_COUNT" ] && echo "✅ Rule counts match" || echo "⚠️ Rule counts differ - ensure key rules are repeated"
```

**6. Full Compliance Script:**

```bash
#!/bin/bash
# Save as verify-agent.sh and run: ./verify-agent.sh {agent-name}
AGENT="$1"
if [ -z "$AGENT" ]; then echo "Usage: ./verify-agent.sh agent-name"; exit 1; fi

echo "========================================"
echo "Verifying agent: $AGENT"
echo "========================================"

# REQUIRED source files check
echo -e "\n--- Required Source Files ---"
for f in intro.md workflow.md; do
  [ -f ".claude-src/agent-sources/$AGENT/$f" ] && echo "✅ $f" || echo "❌ $f MISSING (REQUIRED)"
done

# OPTIONAL source files check
echo -e "\n--- Optional Source Files ---"
for f in critical-requirements.md critical-reminders.md examples.md; do
  [ -f ".claude-src/agent-sources/$AGENT/$f" ] && echo "✅ $f" || echo "⚠️ $f (optional, recommended)"
done

# Expansion modifiers
echo -e "\n--- Expansion Modifiers ---"
grep -q "comprehensive\|thorough" .claude-src/agent-sources/$AGENT/intro.md 2>/dev/null && echo "✅ Found" || echo "❌ MISSING in intro.md"

# Think usage
echo -e "\n--- 'Think' Usage (should be 0) ---"
THINK_COUNT=$(grep -rw "think" .claude-src/agent-sources/$AGENT/*.md 2>/dev/null | grep -v "ultrathink\|megathink" | wc -l)
echo "Count: $THINK_COUNT"

# Compiled agent checks (only if compiled file exists)
if [ -f ".claude/agents/$AGENT.md" ]; then
  echo -e "\n--- Compiled Agent ---"
  grep -q "DISPLAY ALL 5 CORE PRINCIPLES" .claude/agents/$AGENT.md && echo "✅ Self-reminder line" || echo "❌ Self-reminder line MISSING"
  grep -q "ALWAYS RE-READ FILES AFTER EDITING" .claude/agents/$AGENT.md && echo "✅ Write verification line" || echo "❌ Write verification line MISSING"
else
  echo -e "\n⚠️ Compiled agent not found at .claude/agents/$AGENT.md - run compilation first"
fi

echo -e "\n========================================"
echo "Verification complete"
echo "========================================"
```

---

## Model-Specific Considerations

This section documents behavioral differences and optimization strategies for Claude 4.x models. Reference `PROMPT_BIBLE.md` for detailed rationale and performance metrics.

### Sonnet 4.5 vs Opus 4.5 Comparison

| Characteristic | Sonnet 4.5 | Opus 4.5 |
|----------------|------------|----------|
| Default behavior | Conservative, minimal | Over-engineering tendency |
| Instruction following | Very literal | More interpretive |
| Expansion modifiers | **Required** to unlock capability | Helpful but less critical |
| "Think" sensitivity | Low | **High** (avoid in prompts) |
| System prompt responsiveness | Standard | **More responsive** |
| Parallel tool execution | Standard | **Excels** at parallel ops |

### Sonnet 4.5 Optimizations

**1. Conservative Defaults**

Sonnet 4.5 is more conservative than Claude 3.5 despite higher capability. Without expansion modifiers, it produces minimal implementations.

**Required in every intro.md:**
```markdown
**When implementing features, be comprehensive and thorough. Include all necessary edge cases and error handling.**
```

**2. Explicit Permission for Changes**

Sonnet 4.5 needs explicit permission for substantial changes:
```markdown
Feel free to refactor architecture if needed to achieve the goal.
You have permission to make substantial changes within [scope].
```

**3. Stricter Instruction Following**

Sonnet interprets constraints literally. Be precise:
```markdown
# ❌ Vague (Sonnet may under-deliver)
Add a user profile feature

# ✅ Explicit (Sonnet delivers fully)
Add a user profile feature with:
- Avatar upload with preview
- Bio field (markdown supported)
- Social links section
- Form validation with inline errors
```

### Opus 4.5 Optimizations

**1. "Think" Sensitivity (CRITICAL)**

When extended thinking is disabled, Opus 4.5 is particularly sensitive to "think" and variants. This causes confusion or errors.

**In agent prompts:** Always use alternatives (see Writing Style Guidelines)

**2. Over-Engineering Tendency**

Opus tends to add unnecessary abstractions and features. Counter with explicit guidance:
```markdown
<anti_over_engineering>
Avoid over-engineering. Only make changes that are directly requested or clearly necessary. Keep solutions simple and focused. Don't add features, refactor code, or make "improvements" beyond what was asked.
</anti_over_engineering>
```

**3. System Prompt Responsiveness**

Opus is more responsive to system prompts than previous models:
- Aggressive directives (CRITICAL, MUST) may cause over-caution
- Use clear, direct language without excessive emphasis
- Positive framing works better than prohibitions

**4. Parallel Tool Execution**

Opus excels at parallel tool execution. Structure prompts to allow simultaneous operations:
```markdown
# Good - Opus can parallelize
Read these 3 files and compare their patterns: file1.ts, file2.ts, file3.ts

# Less optimal - forces sequential
Read file1.ts. Then read file2.ts. Then read file3.ts.
```

### Extended Thinking Triggers (Claude Code Only)

When making requests TO Claude Code (not in agent prompts), use these trigger words to allocate thinking budget:

| Trigger | Token Budget | When to Use |
|---------|--------------|-------------|
| `think` | ~4K tokens | Routine debugging, simple features |
| `megathink` | ~10K tokens | API integration, performance optimization, refactoring |
| `ultrathink` | ~32K tokens | Major architecture, critical migrations, complex debugging |

**Ultrathink trigger phrases:** "think harder", "think intensely", "think longer", "think really hard", "think super hard", "think very hard", "ultrathink"

**Key distinction:**
- **In agent prompts** (static text): Avoid "think" → use consider/evaluate/analyze
- **In user requests to Claude Code**: Use "think"/"megathink"/"ultrathink" to explicitly allocate thinking budget

**When to escalate to ultrathink:**
- Claude gets stuck in repetitive loops
- Complex architectural decisions needed
- Critical migration or systemic problem resolution
- New pattern design requiring deep analysis

---

## agents.yaml Structure

The `agents.yaml` file is the **single source of truth** for all agent definitions. It lives at `.claude-src/agents.yaml` and contains agent metadata that is shared across all profiles.

```yaml
# .claude-src/agents.yaml
agents:
  frontend-developer:
    title: Frontend Developer Agent
    description: Implements frontend features from detailed specs - React components, TypeScript, styling, client state - surgical execution following existing patterns - invoke AFTER pm creates spec
    model: opus
    tools:
      - Read
      - Write
      - Edit
      - Grep
      - Glob
      - Bash
    core_prompts: developer      # References core_prompt_sets in profile config
    ending_prompts: developer    # References ending_prompt_sets in profile config
    output_format: output-formats-developer

  backend-developer:
    title: Backend Developer Agent
    description: Implements backend features from detailed specs - API routes, database operations, server utilities
    model: opus
    tools: [Read, Write, Edit, Grep, Glob, Bash]
    core_prompts: developer
    ending_prompts: developer
    output_format: output-formats-developer

  # ... more agent definitions
```

**Key points:**
- Agent definitions do NOT include skills - skills are profile-specific
- All agents available across all profiles are defined here
- Profile configs reference these agents by name

## Config.yaml Structure (Simplified)

Each profile's `config.yaml` specifies:
1. **Profile metadata** (name, description, CLAUDE.md path)
2. **Prompt sets** (core and ending prompts for each agent type)
3. **Agent skills** (`agent_skills`) — **keys determine which agents to compile**

**Important:** There is no `use_agents` list. Which agents to compile is derived automatically from the keys of `agent_skills`. If an agent has an entry in `agent_skills`, it gets compiled for that profile.

```yaml
# .claude-src/profiles/work/config.yaml

# Profile metadata
name: work
description: Photoroom webapp (MobX, Tailwind, React Query, Karma+Chai)
claude_md: ./CLAUDE.md

# Core prompt sets (shared logic, referenced by agents)
core_prompt_sets:
  developer:
    - core-principles
    - investigation-requirement
    - write-verification
    - anti-over-engineering
  reviewer:
    - core-principles
    - investigation-requirement
    - write-verification

# Ending prompt sets (appended after skills/examples)
ending_prompt_sets:
  developer:
    - context-management
    - improvement-protocol
  reviewer:
    - context-management
    - improvement-protocol

# Agent skill assignments (keys determine which agents are compiled!)
# If an agent is listed here, it will be compiled for this profile
agent_skills:
  frontend-developer:          # This agent WILL be compiled
    precompiled:               # Bundled directly into agent
      - id: frontend/react
        path: skills/frontend/react.md
        name: React
        description: Component architecture, MobX observer, hooks
        usage: when implementing React components
      - id: frontend/styling
        path: skills/frontend/styling.md
        name: Styling
        description: Tailwind, clsx, design tokens
        usage: when implementing styles
    dynamic:                   # Available via skill invocation
      - id: frontend/api
        path: skills/frontend/api.md
        name: API Integration
        description: REST APIs, React Query, Zod validation
        usage: when implementing data fetching or API calls

  frontend-reviewer:           # This agent WILL be compiled
    precompiled:
      - id: frontend/react
        path: skills/frontend/react.md
        # ...
    dynamic: []

  # Agents NOT listed here will NOT be compiled for this profile
```

### Profile Differences

The same agent can have different skill configurations per profile:

| Agent | Home Profile | Work Profile |
|-------|--------------|--------------|
| `frontend-developer` | Zustand, SCSS Modules | MobX, Tailwind |
| `tester` | Vitest, MSW | Karma, Mocha, Chai, Sinon |
| `backend-developer` | ✅ In agent_skills | ❌ Not in agent_skills |

## Skill File Structure

Skills are single markdown files with this structure:

```markdown
# [Skill Name]

> **Quick Guide:** [One-line summary]

---

<critical_requirements>
## ⚠️ CRITICAL: Before Using This Skill

**(You MUST [requirement])**
</critical_requirements>

---

**Auto-detection:** [Triggers for when to use]

**When to use:**
- [Use case 1]
- [Use case 2]

**When NOT to use:**
- [Anti-pattern 1]

---

<philosophy>
## Philosophy

[Why this approach matters]
</philosophy>

---

<patterns>
## Core Patterns

### Pattern 1: [Name]

[Explanation]

\`\`\`typescript
// ✅ Good Example
[code]
\`\`\`

**Why good:** [Explanation]

\`\`\`typescript
// ❌ Bad Example
[code]
\`\`\`

**Why bad:** [Explanation]
</patterns>

---

<anti_patterns>
## Anti-Patterns

### ❌ [Anti-pattern Name]

[What to avoid and why]
</anti_patterns>
```

## Compilation Commands

```bash
# Compile for specific profile
npm run compile:home
npm run compile:work

# Or directly
bun .claude-src/compile.ts --profile=home
```

## Final Reminder Pattern

Every agent MUST end with these two lines (added by template):

```markdown
**DISPLAY ALL 5 CORE PRINCIPLES AT THE START OF EVERY RESPONSE TO MAINTAIN INSTRUCTION CONTINUITY.**

**ALWAYS RE-READ FILES AFTER EDITING TO VERIFY CHANGES WERE WRITTEN. NEVER REPORT SUCCESS WITHOUT VERIFICATION.**
```

This closes:
1. **Self-reminder loop** - 60-70% reduction in off-task behavior
2. **Write verification loop** - Prevents false-success reports

## Creating a New Agent

Agents are **generic** - define them once in `agents.yaml`, then enable them in whichever profiles need them.

### Step 1: Create Agent Source Files

Create directory: `.claude-src/agent-sources/{agent-name}/`

```
.claude-src/agent-sources/my-new-agent/
├── intro.md                  # REQUIRED: Role definition (no <role> tags)
├── workflow.md               # REQUIRED: Agent-specific processes with XML tags
├── critical-requirements.md  # OPTIONAL: Top MUST rules (no XML wrapper)
├── critical-reminders.md     # OPTIONAL: Bottom reminders (no XML wrapper)
└── examples.md               # OPTIONAL: Example outputs
```

**Note:** Only `intro.md` and `workflow.md` are required. The optional files enhance agent behavior but compilation will succeed without them.

### Step 2: Add Agent Definition to agents.yaml

Add the agent to `.claude-src/agents.yaml` (single source of truth):

```yaml
# .claude-src/agents.yaml
agents:
  # ... existing agents ...

  my-new-agent:
    title: My New Agent
    description: "What this agent does - one-line for Claude Code"
    model: opus  # or sonnet, haiku
    tools:
      - Read
      - Write
      - Edit
      - Grep
      - Glob
      - Bash
    core_prompts: developer      # References core_prompt_sets in profile config
    ending_prompts: developer    # References ending_prompt_sets in profile config
    output_format: output-formats-developer
```

### Step 3: Enable Agent in Profile Config(s)

Add the agent to each profile's `agent_skills`. **The agent will be compiled because it has an entry in `agent_skills`** — no separate list needed:

```yaml
# .claude-src/profiles/work/config.yaml

# Add skill assignments for your new agent
# Adding it here automatically includes it in compilation
agent_skills:
  # ... existing agents ...

  my-new-agent:                          # Adding this key enables the agent
    precompiled:
      - id: frontend/react
        path: skills/frontend/react.md   # Uses WORK profile's skill
        name: React
        description: MobX patterns
        usage: when implementing components
    dynamic: []
```

### Step 4: Compile and Verify

```bash
npm run compile:work
# Output: .claude/agents/my-new-agent.md
```

### Key Points

- **Agent definitions** live in `.claude-src/agents.yaml` (single source of truth)
- **Agent source files** live in `.claude-src/agent-sources/` (shared across all profiles)
- **Skill assignments** live in each profile's `config.yaml` under `agent_skills`
- **Which agents compile** is determined by the keys in `agent_skills` (no separate list)
- Same agent can have **different skill bundles** per profile
- Agents **not listed** in a profile's `agent_skills` won't be compiled for that profile

## Creating a New Skill

Skills are **profile-specific** - they contain implementation patterns that vary by tech stack.

### Step 1: Create Skill File

Create in the appropriate profile: `.claude-src/profiles/{profile}/skills/{category}/{skill}.md`

```
# For work profile (MobX, Tailwind)
.claude-src/profiles/work/skills/frontend/react.md

# For home profile (Zustand, SCSS)
.claude-src/profiles/home/skills/frontend/react.md
```

### Step 2: Follow Skill Structure

```markdown
# [Skill Name]

> **Quick Guide:** [One-line summary]

---

<critical_requirements>
## ⚠️ CRITICAL: Before Using This Skill

**(You MUST [requirement])**
</critical_requirements>

---

<philosophy>
## Philosophy
[Why this approach matters]
</philosophy>

---

<patterns>
## Core Patterns

### Pattern 1: [Name]
[Good/bad examples with explanations]
</patterns>

---

<anti_patterns>
## Anti-Patterns
[What to avoid]
</anti_patterns>
```

### Step 3: Assign to Agents in Config

```yaml
# In profile's config.yaml
agents:
  frontend-developer:
    skills:
      precompiled:
        - id: frontend/react
          path: skills/frontend/react.md
          name: React
          description: Component patterns
          usage: when implementing React components
```

### Key Points

- **Same skill ID** can exist in multiple profiles with different content
- `frontend/react` in work profile → MobX patterns
- `frontend/react` in home profile → Zustand patterns
- Skills are bundled from the **active profile's** `skills/` directory
