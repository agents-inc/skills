# Modular Agent & Skill Architecture

> **Source of Truth** for creating agents and skills with the new TypeScript + LiquidJS compilation system.

## Overview

This system compiles modular source files into standalone agent/skill markdown files using:

- **TypeScript compiler**: `src/compile.ts`
- **LiquidJS templates**: `src/agents/_templates/agent.liquid`
- **Agent definitions**: `src/agents.yaml` (single source of truth)
- **Stack configuration**: `src/stacks/{stack}/config.yaml` (skill assignments)

## Core Architecture Principle

**Agents are GENERIC. Skills are STACK-SPECIFIC.**

| Layer      | Location                         | Purpose                             | Changes Per Stack        |
| ---------- | -------------------------------- | ----------------------------------- | ------------------------ |
| **Agents** | `src/agents/{category}/{agent}/` | Define _role_ + _workflow_          | NO - single source       |
| **Skills** | `src/stacks/{stack}/skills/`     | Define _implementation patterns_    | YES - vary by tech stack |
| **Config** | `src/stacks/{stack}/config.yaml` | Control which agents/skills compile | YES - stack-specific     |

**Example:**

- `frontend-developer` agent (generic): "You implement React components following patterns"
- `frontend/react` skill (home-stack): "Use Zustand, SCSS Modules, React Query"
- `frontend/react` skill (work-stack): "Use MobX, Tailwind, observer() pattern"

## Stack Switching Workflow

Switching stacks is a two-step process. The compiler **clears all output** and regenerates:

```bash
# Switch to work stack (Photoroom - MobX, Tailwind)
cc switch work-stack && cc compile

# Switch to home stack (Personal - Zustand, SCSS)
cc switch home-stack && cc compile
```

**What happens:**

1. `.claude/agents/` is **cleared completely**
2. `.claude/skills/` is **cleared completely**
3. Only agents defined in the stack's `config.yaml` are compiled
4. Each agent gets bundled with that stack's skills
5. `CLAUDE.md` is copied from the stack

**Result:** Only the active stack's agents are visible to Claude Code.

## Directory Structure

```
src/
├── agents.yaml                # Single source of truth for ALL agent definitions
│                              # Contains: title, description, model, tools, output_format
│
├── agents/                    # Agent source files (GENERIC - shared across stacks)
│   ├── _templates/            # LiquidJS templates
│   │   └── agent.liquid       # Main agent template (includes core principles inline)
│   │
│   ├── developer/             # Developer category
│   │   ├── frontend-developer/
│   │   │   ├── intro.md
│   │   │   ├── workflow.md
│   │   │   └── ...
│   │   └── backend-developer/
│   ├── reviewer/              # Reviewer category
│   │   ├── frontend-reviewer/
│   │   └── backend-reviewer/
│   ├── researcher/            # Researcher category
│   │   ├── frontend-researcher/
│   │   └── backend-researcher/
│   ├── planning/              # Planning category
│   │   ├── pm/
│   │   └── architecture/
│   ├── pattern/               # Pattern category
│   │   ├── pattern-scout/
│   │   └── pattern-critique/
│   ├── meta/                  # Meta category (creates other agents/skills)
│   │   ├── agent-summoner/
│   │   ├── skill-summoner/
│   │   └── documentor/
│   └── tester/                # Tester category
│       └── tester-agent/
│
├── stacks/                    # Stack-specific configuration
│   └── {stack}/
│       ├── config.yaml        # agent_skills (keys determine which agents compile)
│       ├── CLAUDE.md          # Stack-specific project instructions
│       └── skills/            # Stack-specific implementation patterns
│           └── {category}/
│               └── {skill}.md
│
├── cli/                       # CLI implementation
│   └── lib/compiler.ts        # Compiler (loads agents.yaml + merges with stack skills)
│
├── types.ts                   # TypeScript type definitions
│
└── docs/
    └── CLAUDE_ARCHITECTURE_BIBLE.md  # This file

.claude/                       # Compiled output (gitignored or committed)
├── agents/                    # Compiled agents (CLEARED on each compile)
│   └── {agent-name}.md        # No stack suffix - clean names
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

| Avoid         | Use Instead                 |
| ------------- | --------------------------- |
| think         | consider, evaluate, analyze |
| think about   | reflect on, assess          |
| think through | work through, examine       |
| thinking      | reasoning, analysis         |

**Example:**

```markdown
# ❌ Bad

Think about the implications before proceeding.

# ✅ Good

Consider the implications before proceeding.
```

**Note (January 2026):** The trigger keywords (`think`, `megathink`, `ultrathink`) have been **deprecated**. Claude Code now enables extended thinking by default (31,999 tokens max). Use `MAX_THINKING_TOKENS` environment variable to adjust.

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

| Format                   | When to Use                | Example                                  |
| ------------------------ | -------------------------- | ---------------------------------------- |
| **Bold**                 | Important rules            | **Always verify changes**                |
| **(Bold + parentheses)** | Ultra-critical MUST rules  | **(You MUST read files before editing)** |
| ALL CAPS                 | Section headers only       | ## CRITICAL REMINDERS                    |
| `code`                   | File names, commands, tags | `intro.md`, `<role>`                     |

---

## Template Structure (agent.liquid)

The template assembles agents in this order:

```
1. Frontmatter (name, description, model, tools, preloaded skills)
2. Title
3. <role>{{ intro }}</role>
4. <core_principles>...</core_principles>  (hardcoded in template - 5 principles + self-reminder)
5. <critical_requirements>{{ criticalRequirementsTop }}</critical_requirements>
6. <skill_activation_protocol>...</skill_activation_protocol>  (three-step activation with emphatic warnings)
7. {{ workflow }}
8. ## Standards and Conventions
9. {{ examples }}
10. {{ outputFormat }}
11. <critical_reminders>{{ criticalReminders }}</critical_reminders>
12. Final reminder lines (self-reminder + write verification)
```

## Core Principles (Embedded in Template)

The 5 core principles are **hardcoded directly in the agent.liquid template**. This ensures every agent has consistent foundational instructions without requiring external files or skill loading.

### The 5 Core Principles

```markdown
<core_principles>
**1. Investigation First**
Never speculate. Read the actual code before making claims. Base all work strictly on what you find in the files.

**2. Follow Existing Patterns**
Use what's already there. Match the style, structure, and conventions of similar code. Don't introduce new patterns.

**3. Minimal Necessary Changes**
Make surgical edits. Change only what's required to meet the specification. Leave everything else untouched.

**4. Anti-Over-Engineering**
Simple solutions. Use existing utilities. Avoid abstractions. If it's not explicitly required, don't add it.

**5. Verify Everything**
Test your work. Run the tests. Check the success criteria. Provide evidence that requirements are met.

**DISPLAY ALL 5 CORE PRINCIPLES AT THE START OF EVERY RESPONSE TO MAINTAIN INSTRUCTION CONTINUITY.**
</core_principles>
```

### Why Embedded vs. Skill

Core principles are fundamental to every agent - they define the base behavioral contract. Unlike technology-specific skills (which vary by stack), these principles are universal and must appear in every agent prompt. Embedding them in the template ensures:

1. **Consistency** - Every agent gets identical principles
2. **Reliability** - No risk of skill loading failures
3. **Simplicity** - No extraction or compilation complexity

### Skills Are Loaded Dynamically

Technology-specific patterns (React, Zustand, testing, etc.) are loaded via the Skill tool. See the **Skill Activation Protocol** section below for details.

---

## Skill Activation Protocol

The `<skill_activation_protocol>` section is placed immediately after `<critical_requirements>` in every compiled agent. This positioning ensures context proximity to the skill invocation instructions.

### Why This Exists

**Problem**: Research showed that description-based skill activation has only a **20% baseline success rate**. Skills were being ignored 80% of the time without intervention.

**Solution**: A forced evaluation hook with emphatic language achieves **84% activation rate** - a 4x improvement.

### Three-Step Protocol

The protocol enforces explicit skill evaluation before implementation:

```markdown
### Step 1 - EVALUATE

For EACH skill, explicitly state YES/NO with reason in a table format.

### Step 2 - ACTIVATE

For EVERY skill marked YES, invoke the Skill tool IMMEDIATELY.

### Step 3 - IMPLEMENT

ONLY after evaluation and activation are complete, begin implementation.
```

### Emphatic Language

The protocol uses strong language to create a commitment mechanism:

- "Your evaluation is **COMPLETELY WORTHLESS** unless you actually **ACTIVATE** the skills"
- "The skill content **DOES NOT EXIST** in your context until you explicitly load it"
- "You are **LYING TO YOURSELF** if you claim a skill is relevant but don't load it"

This language follows research (Scott Spence, 200+ tests) showing that once Claude writes "YES - need this skill" in its response, it's psychologically committed to activating that skill.

### Skill Listing Format

Skills are listed with simplified formatting:

```markdown
### {{ skill.id }}

- Description: {{ skill.description }}
- Invoke: `skill: "{{ skill.id }}"`
- Use when: {{ skill.usage }}
```

### Configuration

In `config.yaml`, skills use a unified array structure:

```yaml
agents:
  frontend-developer:
    skills:
      - id: frontend/react
        usage: when implementing React components
      - id: frontend/styling
        usage: when implementing styles
      - id: frontend/api
        usage: when implementing data fetching, API calls, or React Query integrations
```

**Note**: There is no `precompiled` vs `dynamic` distinction. All skills are loaded via the Skill tool when needed.

---

## Required XML Tags

These tags MUST appear in compiled agents:

| Tag                           | Source                                  | Purpose                                            |
| ----------------------------- | --------------------------------------- | -------------------------------------------------- |
| `<role>`                      | Template wraps intro.md                 | Agent identity                                     |
| `<core_principles>`           | Template (hardcoded)                    | 5 principles + self-reminder                       |
| `<critical_requirements>`     | Template wraps critical-requirements.md | Top MUST rules                                     |
| `<skill_activation_protocol>` | Template                                | Three-step skill activation with emphatic warnings |
| `<critical_reminders>`        | Template wraps critical-reminders.md    | Bottom MUST reminders                              |
| `<self_correction_triggers>`  | workflow.md                             | Mid-task corrections                               |
| `<post_action_reflection>`    | workflow.md                             | After-step evaluation                              |
| `<output_format>`             | Template variable                       | Response structure                                 |

**Note:** Additional methodology content (investigation requirements, write verification, anti-over-engineering, context management, improvement protocol) can be loaded via methodology skills when needed.

## Output Format System

Output formats define the structure of agent responses. They are **contracts between agents** - designed for the consumer's needs, not the producer's convenience.

### Cascading Resolution

The compiler resolves output formats using cascading resolution:

1. **Agent-level**: `src/agents/{category}/{agent-name}/output-format.md` (preferred)
2. **Category fallback**: `src/agents/{category}/output-format.md` (if agent-level doesn't exist)

Each agent should have its own `output-format.md` tailored to its specific output needs and consumers.

### Design Principle: Consumer-First

When designing output formats, ask: **"Who consumes this output and what do they need to act?"**

| Agent               | Consumer              | Key Needs                                             |
| ------------------- | --------------------- | ----------------------------------------------------- |
| frontend-developer  | frontend-reviewer     | Files changed, patterns followed, a11y/perf checks    |
| backend-developer   | backend-reviewer      | API docs, security checks, DB changes, error handling |
| frontend-reviewer   | developer             | Issues with severity, code fixes, checklist results   |
| backend-reviewer    | developer             | Security audit, issues with fixes, convention check   |
| frontend-researcher | frontend-developer    | Component props, state patterns, styling tokens       |
| backend-researcher  | backend-developer     | Route handlers, DB schemas, middleware chains         |
| architecture        | developer/user        | Scaffolding complete, pattern refs, setup guide       |
| pm                  | developer/tester      | Spec with patterns, success criteria, constraints     |
| tester              | developer             | Failing tests, expected behaviors, mocking setup      |
| pattern-scout       | pattern-critique/docs | Exhaustive catalog, not recommendations               |
| pattern-critique    | developer/user        | Issues by severity, refactoring strategies            |
| documentor          | other agents          | File paths, patterns, relationships for navigation    |
| agent-summoner      | user/system           | Complete agent definition structure                   |
| skill-summoner      | user/system           | Complete skill definition structure                   |

### Creating an Output Format

Create `output-format.md` in the agent directory with this structure:

```markdown
## Output Format

<output_format>
Provide your [type] in this structure:

<section_name>
[Content description and template]
</section_name>

<!-- More sections as needed -->

</output_format>
```

**Guidelines:**

- Use semantic XML tags for each section
- Include tables for structured data (files changed, issues found, etc.)
- Add checklists where verification is needed
- Keep sections focused on what the consumer needs to act

## Technique Compliance Mapping

This section maps the 13 Essential Techniques from `PROMPT_BIBLE.md` to their implementation in this architecture. An agent built correctly with this system is automatically compliant with all proven techniques.

> **Reference:** See `PROMPT_BIBLE.md` for detailed rationale and performance metrics for each technique.

### Technique-to-Implementation Mapping

| #   | Technique                       | Impact                  | Implemented In                                       | How                                                                   |
| --- | ------------------------------- | ----------------------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | **Self-Reminder Loop**          | 60-70% ↓ off-task       | Template (hardcoded core principles + final lines)   | Core principles displayed every response + dual closing reminder      |
| 2   | **Investigation-First**         | 80% ↓ hallucination     | Core principles (#1) + `workflow.md`                 | Principle enforces investigation + agent-specific investigation steps |
| 3   | **Emphatic Repetition**         | 70% ↓ scope creep       | `critical-requirements.md` + `critical-reminders.md` | Template wraps both with XML tags, rules repeated top AND bottom      |
| 4   | **XML Semantic Tags**           | 30% ↑ accuracy          | All files                                            | Template adds semantic tags; source files use semantic XML            |
| 5   | **Documents First, Query Last** | 30% ↑ performance       | Template ordering                                    | Template places content before instructions (for 20K+ agents)         |
| 6   | **Expansion Modifiers**         | Unlocks capability      | `intro.md`                                           | MUST include "comprehensive and thorough" (see intro.md section)      |
| 7   | **Self-Correction Triggers**    | 74.4% SWE-bench         | `workflow.md`                                        | `<self_correction_triggers>` with "If you notice yourself..."         |
| 8   | **Post-Action Reflection**      | ↑ long-horizon          | `workflow.md`                                        | `<post_action_reflection>` after major workflow steps                 |
| 9   | **Progress Tracking**           | 30+ hour focus          | `workflow.md`                                        | `<progress_tracking>` section for extended sessions                   |
| 10  | **Positive Framing**            | Better adherence        | All files                                            | Writing Style Guidelines: "Use X" not "Don't do Y"                    |
| 11  | **"Think" Alternatives**        | Prevents Opus confusion | All files                                            | Writing Style Guidelines: consider/evaluate/analyze                   |
| 12  | **Just-in-Time Loading**        | Preserves context       | `workflow.md`                                        | `<retrieval_strategy>` with Glob → Grep → Read pattern                |
| 13  | **Write Verification**          | Prevents false-success  | Template (hardcoded final line)                      | Write verification instruction + second closing reminder              |

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
CATEGORY=$(find src/agents -type d -name "$AGENT" -printf "%P\n" | head -1 | cut -d/ -f1)
echo "=== 'Think' Usage Check for $AGENT ==="
grep -n -w "think" src/agents/$CATEGORY/$AGENT/*.md | wc -l
# If count > 0, review matches and replace with consider/evaluate/analyze
```

**4. Verify Expansion Modifiers in intro.md:**

```bash
# Check intro.md has expansion modifiers
AGENT="{agent}"
CATEGORY=$(find src/agents -type d -name "$AGENT" -printf "%P\n" | head -1 | cut -d/ -f1)
echo "=== Expansion Modifier Check for $AGENT ==="
grep -q "comprehensive\|thorough" src/agents/$CATEGORY/$AGENT/intro.md && echo "✅ Expansion modifiers found" || echo "❌ Add 'comprehensive and thorough' to intro.md"
```

**5. Verify Critical Rules Repetition (if optional files exist):**

```bash
# Check that critical-reminders repeats rules from critical-requirements
AGENT="{agent}"
CATEGORY=$(find src/agents -type d -name "$AGENT" -printf "%P\n" | head -1 | cut -d/ -f1)
echo "=== Critical Rules Repetition Check for $AGENT ==="
REQ_COUNT=$(grep -c "You MUST" src/agents/$CATEGORY/$AGENT/critical-requirements.md 2>/dev/null || echo 0)
REM_COUNT=$(grep -c "You MUST" src/agents/$CATEGORY/$AGENT/critical-reminders.md 2>/dev/null || echo 0)
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

# Find agent category
CATEGORY=$(find src/agents -type d -name "$AGENT" -printf "%P\n" | head -1 | cut -d/ -f1)
if [ -z "$CATEGORY" ]; then echo "Agent not found: $AGENT"; exit 1; fi

echo "========================================"
echo "Verifying agent: $AGENT (category: $CATEGORY)"
echo "========================================"

# REQUIRED source files check
echo -e "\n--- Required Source Files ---"
for f in intro.md workflow.md; do
  [ -f "src/agents/$CATEGORY/$AGENT/$f" ] && echo "✅ $f" || echo "❌ $f MISSING (REQUIRED)"
done

# OPTIONAL source files check
echo -e "\n--- Optional Source Files ---"
for f in critical-requirements.md critical-reminders.md examples.md; do
  [ -f "src/agents/$CATEGORY/$AGENT/$f" ] && echo "✅ $f" || echo "⚠️ $f (optional, recommended)"
done

# Expansion modifiers
echo -e "\n--- Expansion Modifiers ---"
grep -q "comprehensive\|thorough" src/agents/$CATEGORY/$AGENT/intro.md 2>/dev/null && echo "✅ Found" || echo "❌ MISSING in intro.md"

# Think usage
echo -e "\n--- 'Think' Usage (should be 0) ---"
THINK_COUNT=$(grep -rw "think" src/agents/$CATEGORY/$AGENT/*.md 2>/dev/null | wc -l)
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

| Characteristic               | Sonnet 4.5                        | Opus 4.5                    |
| ---------------------------- | --------------------------------- | --------------------------- |
| Default behavior             | Conservative, minimal             | Over-engineering tendency   |
| Instruction following        | Very literal                      | More interpretive           |
| Expansion modifiers          | **Required** to unlock capability | Helpful but less critical   |
| "Think" sensitivity          | Low                               | **High** (avoid in prompts) |
| System prompt responsiveness | Standard                          | **More responsive**         |
| Parallel tool execution      | Standard                          | **Excels** at parallel ops  |

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

### Extended Thinking (January 2026 Update)

As of January 2026, Claude Code **enables extended thinking by default** with a maximum budget of 31,999 tokens. The trigger keywords (`think`, `megathink`, `ultrathink`) have been **deprecated** and no longer have any effect.

**Current system:**

| Configuration    | Method                                 |
| ---------------- | -------------------------------------- |
| Limit budget     | `export MAX_THINKING_TOKENS=10000`     |
| Disable thinking | `export MAX_THINKING_TOKENS=0`         |
| Toggle (session) | `Alt+T`                                |
| Toggle (global)  | `/config` or `~/.claude/settings.json` |
| View thinking    | `Ctrl+O` (verbose mode)                |

**In agent prompts:** Still avoid the word "think" → use consider/evaluate/analyze (prevents confusion with Opus 4.5's thinking system).

---

## agents.yaml Structure

The `agents.yaml` file is the **single source of truth** for all agent definitions. It lives at `src/agents.yaml` and contains agent metadata that is shared across all stacks.

```yaml
# src/agents.yaml
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
    # Output format is determined by file system (agent-level output-format.md → category fallback)

  backend-developer:
    title: Backend Developer Agent
    description: Implements backend features from detailed specs - API routes, database operations, server utilities
    model: opus
    tools: [Read, Write, Edit, Grep, Glob, Bash]
    # Output format is determined by file system (agent-level output-format.md → category fallback)

  # ... more agent definitions
```

**Key points:**

- Agent definitions do NOT include skills - skills are stack-specific
- All agents available across all stacks are defined here
- Stack configs reference these agents by name
- Core principles are embedded directly in the template (not configurable per agent)

## Config.yaml Structure (Unified Skills)

Each stack's `config.yaml` specifies:

1. **Stack metadata** (name, description, CLAUDE.md path)
2. **Agent configurations** (skills only - core principles are embedded in template)

**Important:** There is no `use_agents` list. Which agents to compile is derived automatically from the `agents` key. If an agent is listed there, it gets compiled for that stack.

**Unified Skills**: All skills are listed in a single `skills` array per agent. There is no distinction between precompiled and dynamic skills - all skills are loaded via the Skill tool when the agent evaluates them as relevant.

**Core Principles**: The 5 core principles are embedded directly in the template and apply to all agents. No configuration needed.

```yaml
# src/stacks/home-stack/config.yaml

# Stack metadata
name: home-stack
description: Personal projects (SCSS/cva, Zustand, React Query)
claude_md: ./CLAUDE.md

# Agent configurations (keys determine which agents are compiled!)
agents:
  frontend-developer: # This agent WILL be compiled
    skills: # Unified skills array - all loaded via Skill tool
      - id: frontend/react
        usage: when implementing React components
      - id: frontend/styling
        usage: when implementing styles
      - id: frontend/api
        usage: when implementing data fetching, API calls, or React Query integrations
      - id: frontend/accessibility
        usage: when implementing accessible components or ARIA patterns

  frontend-reviewer: # This agent WILL be compiled
    skills:
      - id: reviewing/reviewing
        usage: when reviewing code
      - id: frontend/react
        usage: when reviewing React components

  # Agents NOT listed here will NOT be compiled for this stack
```

### Stack Differences

The same agent can have different skill configurations per stack:

| Agent                | Home Stack            | Work Stack                |
| -------------------- | --------------------- | ------------------------- |
| `frontend-developer` | Zustand, SCSS Modules | MobX, Tailwind            |
| `tester`             | Vitest, MSW           | Karma, Mocha, Chai, Sinon |
| `backend-developer`  | In agent_skills       | Not in agent_skills       |

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
# Switch to specific stack and compile
cc switch home-stack && cc compile
cc switch work-stack && cc compile
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

Agents are **generic** - define them once in `agents.yaml`, then enable them in whichever stacks need them.

### Step 1: Create Agent Source Files

Create directory: `src/agents/{category}/{agent-name}/`

```
src/agents/{category}/my-new-agent/
├── intro.md                  # REQUIRED: Role definition (no <role> tags)
├── workflow.md               # REQUIRED: Agent-specific processes with XML tags
├── critical-requirements.md  # OPTIONAL: Top MUST rules (no XML wrapper)
├── critical-reminders.md     # OPTIONAL: Bottom reminders (no XML wrapper)
└── examples.md               # OPTIONAL: Example outputs
```

**Categories available:**

- `developer/` - Implementation agents (frontend-developer, backend-developer, architecture)
- `reviewer/` - Code review agents (frontend-reviewer, backend-reviewer)
- `researcher/` - Read-only research agents (frontend-researcher, backend-researcher)
- `planning/` - Planning agents (pm, architecture)
- `pattern/` - Pattern discovery agents (pattern-scout, pattern-critique)
- `meta/` - Meta-level agents (agent-summoner, skill-summoner, documentor)
- `tester/` - Testing agents (tester-agent)

**Note:** Only `intro.md` and `workflow.md` are required. The optional files enhance agent behavior but compilation will succeed without them.

### Step 2: Add Agent Definition to agents.yaml

Add the agent to `src/agents.yaml` (single source of truth):

```yaml
# src/agents.yaml
agents:
  # ... existing agents ...

  my-new-agent:
    title: My New Agent
    description: "What this agent does - one-line for Claude Code"
    model: opus # or sonnet, haiku
    tools:
      - Read
      - Write
      - Edit
      - Grep
      - Glob
      - Bash
    # Output format: create output-format.md in agent directory
```

**Note:** Core principles are embedded directly in the template. Output format is determined by file system - create `output-format.md` in the agent directory, or it falls back to category-level format.

### Step 3: Enable Agent in Stack Config(s)

Add the agent to each stack's `agents` section. **The agent will be compiled because it has an entry in `agents`** - no separate list needed:

```yaml
# src/stacks/work-stack/config.yaml

# Add skill assignments for your new agent
# Adding it here automatically includes it in compilation
agents:
  # ... existing agents ...

  my-new-agent: # Adding this key enables the agent
    skills:
      - id: frontend/react
        usage: when implementing components # Uses WORK stack's skill
```

**Note:** Core principles are automatically included via the template - no `core_prompts` or `ending_prompts` configuration needed.

### Step 4: Compile and Verify

```bash
cc switch work-stack && cc compile
# Output: .claude/agents/my-new-agent.md
```

### Key Points

- **Agent definitions** live in `src/agents.yaml` (single source of truth)
- **Agent source files** live in `src/agents/{category}/{agent}/` (organized by category, shared across all stacks)
- **Skill assignments** live in each stack's `config.yaml` under `agents`
- **Which agents compile** is determined by the keys in `agents` (no separate list)
- Same agent can have **different skill bundles** per stack
- Agents **not listed** in a stack's `agents` section won't be compiled for that stack

## Creating a New Skill

Skills are **stack-specific** - they contain implementation patterns that vary by tech stack.

### Step 1: Create Skill File

Create in the appropriate stack: `src/stacks/{stack}/skills/{category}/{skill}.md`

```
# For work stack (MobX, Tailwind)
src/stacks/work-stack/skills/frontend/react.md

# For home stack (Zustand, SCSS)
src/stacks/home-stack/skills/frontend/react.md
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
# In stack's config.yaml
agents:
  frontend-developer:
    core_prompts: [...]
    ending_prompts: [...]
    skills:
      - id: frontend/react
        usage: when implementing React components
```

### Key Points

- **Same skill ID** can exist in multiple stacks with different content
- `frontend/react` in work-stack -> MobX patterns
- `frontend/react` in home-stack -> Zustand patterns
- Skills are resolved from the **active stack's** `skills/` directory via registry.yaml
- All skills are loaded via the Skill tool (no precompiled embedding)

---

## Skill Schema Requirements

Every skill consists of two required files: `SKILL.md` and `metadata.yaml`. Both have strict schema requirements that are validated by `cc validate`.

### SKILL.md Frontmatter (REQUIRED)

Every `SKILL.md` file **MUST** start with YAML frontmatter containing `name` and `description`:

```markdown
---
name: frontend/react (@vince)
description: Component architecture, hooks, patterns
---

# React Components

> **Quick Guide:** ...
```

**Required frontmatter fields:**

| Field         | Description                    | Example                                   |
| ------------- | ------------------------------ | ----------------------------------------- |
| `name`        | Skill identifier with author   | `frontend/react (@vince)`                 |
| `description` | Short description (5-10 words) | `Component architecture, hooks, patterns` |

**Validation:** Files without valid frontmatter will fail `cc validate` with "Failed to extract content (no valid frontmatter found)".

---

### metadata.yaml Schema (REQUIRED)

Every skill must have a `metadata.yaml` file. The schema is defined in `src/schemas/metadata.schema.json`.

**Required fields:**

| Field             | Type          | Description                       | Example                                 |
| ----------------- | ------------- | --------------------------------- | --------------------------------------- |
| `category`        | string (enum) | Skill category                    | `framework`, `client-state`, `testing`  |
| `author`          | string        | Author handle with @ prefix       | `@vince`, `@photoroom`                  |
| `version`         | integer       | Skill version (1, 2, 3...)        | `1`                                     |
| `cli_name`        | string        | Display name for CLI              | `React`, `Zustand`                      |
| `cli_description` | string        | Brief description (5-6 words max) | `React component patterns`              |
| `usage_guidance`  | string        | When AI should invoke this skill  | `Use when building React components...` |

**Optional fields:**

| Field                | Type    | Description                                                              |
| -------------------- | ------- | ------------------------------------------------------------------------ |
| `category_exclusive` | boolean | If true, only one skill from this category can be active (default: true) |
| `requires`           | array   | Hard dependencies - skill IDs that must be present                       |
| `compatible_with`    | array   | Soft recommendations - skills this works well with                       |
| `conflicts_with`     | array   | Mutual exclusions - skills that cannot coexist                           |
| `tags`               | array   | Tags for discoverability                                                 |
| `requires_setup`     | array   | Setup skills that must be completed first                                |
| `provides_setup_for` | array   | Usage skills this setup skill provides for                               |
| `forked_from`        | object  | Provenance tracking for forked skills                                    |

---

### Strict Validation Rules

**⚠️ CRITICAL: These patterns are enforced by schema validation**

#### 1. Tags MUST be kebab-case

Tags follow the pattern `^[a-z][a-z0-9-]*$` - lowercase letters, numbers, and hyphens only.

```yaml
# ✅ GOOD - kebab-case tags
tags:
  - react-19
  - use-action-state
  - use-form-status
  - react-query
  - state-management

# ❌ BAD - camelCase or dots (FAILS VALIDATION)
tags:
  - useActionState    # camelCase - INVALID
  - useFormStatus     # camelCase - INVALID
  - wcag-2.2          # dots - INVALID (use wcag-2-2)
  - React19           # PascalCase - INVALID
```

#### 2. Author MUST use @ prefix

Author format follows the pattern `^@[a-z][a-z0-9-]*$`:

```yaml
# ✅ GOOD
author: "@vince"
author: "@photoroom"

# ❌ BAD (FAILS VALIDATION)
author: "vince"       # Missing @ prefix
author: "@Vince"      # Uppercase not allowed
author: "Vincent"     # No @ prefix
```

#### 3. Category MUST be from allowed enum

Valid category values (from `src/schemas/metadata.schema.json`):

```
framework, meta-framework, client-state, server-state, styling, testing,
mocking, api, database, auth, analytics, observability, email, forms,
ui-components, i18n, error-handling, files, file-upload, utilities,
tooling, monorepo, mobile-framework, frontend, backend, security, shared,
setup, research, performance, ci-cd, flags, accessibility,
frontend/realtime, frontend/animation
```

```yaml
# ✅ GOOD
category: client-state    # For Zustand, MobX, Jotai
category: server-state    # For React Query, SWR
category: framework       # For React, Vue, Angular

# ❌ BAD - NOT in allowed enum (FAILS VALIDATION)
category: state           # Use "client-state" or "server-state"
category: data-fetching   # Use "server-state"
category: ui              # Use "ui-components"
```

#### 4. Version MUST be an integer

Version is a simple integer, NOT semantic versioning:

```yaml
# ✅ GOOD
version: 1
version: 2
version: 10

# ❌ BAD (FAILS VALIDATION)
version: "1.0.0"    # Semantic version - INVALID
version: 1.0        # Float - INVALID
version: "1"        # String - INVALID
```

---

### Complete metadata.yaml Example

```yaml
# yaml-language-server: $schema=../../../schemas/metadata.schema.json
category: framework
category_exclusive: true
author: "@vince"
version: 1
cli_name: React
cli_description: React component patterns
usage_guidance: Use when building React components, hooks, or following React 19 patterns.
compatible_with:
  - zustand (@vince)
  - react-query (@vince)
tags:
  - react
  - react-19
  - components
  - hooks
  - use-action-state
  - use-form-status
  - jsx
  - tsx
```

---

### Validation Commands

Run these commands to validate skills:

```bash
# Validate all skills and metadata
bun src/cli/index.ts validate

# Or use the package.json script
bun cc:validate
```

**Common validation errors and fixes:**

| Error                                                    | Cause                                 | Fix                                           |
| -------------------------------------------------------- | ------------------------------------- | --------------------------------------------- |
| `tags.N: must match pattern "^[a-z][a-z0-9-]*$"`         | camelCase or special chars in tag     | Convert to kebab-case                         |
| `Failed to extract content (no valid frontmatter found)` | Missing `---` frontmatter in SKILL.md | Add frontmatter with `name` and `description` |
| `category: must be equal to one of the allowed values`   | Invalid category value                | Use value from enum list                      |
| `author: must match pattern "^@[a-z][a-z0-9-]*$"`        | Missing @ or uppercase                | Use `@lowercase` format                       |
