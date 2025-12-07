# Modular Agent & Skill Architecture

> **Source of Truth** for creating agents and skills with the new TypeScript + LiquidJS compilation system.

## Overview

This system compiles modular source files into standalone agent/skill markdown files using:
- **TypeScript compiler**: `.claude-src/compile.ts`
- **LiquidJS templates**: `.claude-src/templates/agent.liquid`
- **YAML configuration**: `.claude-src/profiles/{profile}/config.yaml`

## Directory Structure

```
.claude-src/
├── agents/                    # Agent source files (modular)
│   └── {agent-name}/
│       ├── intro.md           # Role definition (NO <role> tags - template adds them)
│       ├── workflow.md        # Agent-specific workflow and processes
│       ├── critical-requirements.md  # Top-of-file MUST rules
│       ├── critical-reminders.md     # Bottom-of-file MUST reminders
│       └── examples.md        # Example outputs (optional)
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
│       ├── config.yaml        # Agent and skill configuration
│       └── skills/            # Profile-specific skills
│           └── {category}/
│               └── {skill}.md
│
├── templates/
│   └── agent.liquid           # Main agent template
│
└── docs/
    └── MODULAR_ARCHITECTURE.md  # This file
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
- [ ] Has all 5 required source files in agents/{name}/ directory
- [ ] intro.md includes expansion modifiers ("comprehensive and thorough")
- [ ] workflow.md includes <self_correction_triggers>
- [ ] workflow.md includes <post_action_reflection>
- [ ] critical-requirements.md uses **(You MUST ...)** format
- [ ] critical-reminders.md repeats rules from critical-requirements.md

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
grep -n -w "think" .claude-src/agents/$AGENT/*.md | grep -v "ultrathink\|megathink" | wc -l
# If count > 0, review matches and replace with consider/evaluate/analyze
```

**4. Verify Expansion Modifiers in intro.md:**

```bash
# Check intro.md has expansion modifiers
AGENT="{agent}"
echo "=== Expansion Modifier Check for $AGENT ==="
grep -q "comprehensive\|thorough" .claude-src/agents/$AGENT/intro.md && echo "✅ Expansion modifiers found" || echo "❌ Add 'comprehensive and thorough' to intro.md"
```

**5. Verify Critical Rules Repetition:**

```bash
# Check that critical-reminders repeats rules from critical-requirements
AGENT="{agent}"
echo "=== Critical Rules Repetition Check for $AGENT ==="
REQ_COUNT=$(grep -c "You MUST" .claude-src/agents/$AGENT/critical-requirements.md)
REM_COUNT=$(grep -c "You MUST" .claude-src/agents/$AGENT/critical-reminders.md)
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

# Source files check
echo -e "\n--- Source Files ---"
for f in intro.md workflow.md critical-requirements.md critical-reminders.md; do
  [ -f ".claude-src/agents/$AGENT/$f" ] && echo "✅ $f" || echo "❌ $f MISSING"
done

# Expansion modifiers
echo -e "\n--- Expansion Modifiers ---"
grep -q "comprehensive\|thorough" .claude-src/agents/$AGENT/intro.md 2>/dev/null && echo "✅ Found" || echo "❌ MISSING in intro.md"

# Think usage
echo -e "\n--- 'Think' Usage (should be 0) ---"
THINK_COUNT=$(grep -rw "think" .claude-src/agents/$AGENT/*.md 2>/dev/null | grep -v "ultrathink\|megathink" | wc -l)
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

## Config.yaml Structure

```yaml
agents:
  - name: agent-name
    title: "Agent Title"
    description: "One-line description for Claude Code"
    model: opus  # or sonnet, haiku
    tools:
      - Read
      - Write
      - Edit
      - Grep
      - Glob
      - Bash
    core_prompts: developer  # References core_prompt_sets below
    output_format: output-formats-developer  # File in core-prompts/
    ending_prompts:
      - context-management
      - improvement-protocol
    skills:
      precompiled:
        - category/skill-name  # Bundled into agent
      dynamic:
        - id: category/skill-name
          description: "Short description"
          usage: "When to invoke"

core_prompt_sets:
  developer:
    - core-principles
    - investigation-requirement
    - write-verification
    - anti-over-engineering

skills:
  - id: category/skill-name
    name: "Skill Display Name"
    path: skills/category/skill-name.md
```

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

1. Create directory: `.claude-src/agents/{agent-name}/`
2. Create required files:
   - `intro.md` - Role definition (no `<role>` tags)
   - `workflow.md` - Agent-specific processes with XML tags
   - `critical-requirements.md` - Top MUST rules (no XML wrapper)
   - `critical-reminders.md` - Bottom reminders (no XML wrapper)
   - `examples.md` - Optional example outputs
3. Add to `config.yaml`:
   - Agent definition with name, title, description, model, tools
   - Assign core_prompts set
   - Assign output_format
   - Configure precompiled and dynamic skills
4. Run `npm run compile:{profile}`
5. Verify compiled output has all required XML tags

## Creating a New Skill

1. Create file: `.claude-src/profiles/{profile}/skills/{category}/{skill}.md`
2. Follow skill file structure with:
   - Quick guide summary
   - `<critical_requirements>` section
   - `<philosophy>` section
   - `<patterns>` with good/bad examples
   - `<anti_patterns>` section
3. Add to `config.yaml` skills list
4. Assign to agents as precompiled or dynamic
5. Run compilation and verify
