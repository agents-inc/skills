# Agent Hooks Research

> **Purpose**: Research findings for implementing hooks in agent frontmatter (Task A5)
> **Status**: Complete
> **Created**: 2026-01-25
> **Updated**: 2026-01-25

---

## Overview

This document consolidates research findings from multiple agents investigating how to implement hooks support in our agent compilation system.

---

## 1. Available Hook Events

From Claude Code documentation, the following hook events are available:

| Hook Event           | When It Fires                   | Supported in Agent Frontmatter |
| -------------------- | ------------------------------- | ------------------------------ |
| `PreToolUse`         | Before tool execution           | ✅ Yes                         |
| `PostToolUse`        | After tool succeeds             | ✅ Yes                         |
| `PostToolUseFailure` | After tool fails                | ❌ No                          |
| `PermissionRequest`  | When permission dialog appears  | ❌ No                          |
| `UserPromptSubmit`   | User submits a prompt           | ❌ No                          |
| `Stop`               | Claude finishes responding      | ✅ Yes                         |
| `SubagentStart`      | When spawning a subagent        | ❌ No                          |
| `SubagentStop`       | When subagent finishes          | ❌ No                          |
| `PreCompact`         | Before context compaction       | ❌ No                          |
| `Setup`              | On --init/--maintenance         | ❌ No                          |
| `SessionStart`       | Session begins                  | ❌ No                          |
| `SessionEnd`         | Session terminates              | ❌ No                          |
| `Notification`       | Claude Code sends notifications | ❌ No                          |

**Key limitation**: Agent/skill frontmatter only supports `PreToolUse`, `PostToolUse`, and `Stop` events.

---

## 2. Hook Configuration Format

### In Agent Frontmatter (YAML)

```yaml
---
name: code-reviewer
description: Review code changes
hooks:
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/run-linter.sh"
---
```

### Hook Types

| Type      | Description                 | Best For                               |
| --------- | --------------------------- | -------------------------------------- |
| `command` | Execute bash script         | Deterministic rules, fast validation   |
| `prompt`  | LLM evaluation (Haiku)      | Context-aware decisions, complex logic |
| `agent`   | Agentic verifier with tools | Complex verification tasks             |

### Additional Options

- `matcher`: Pattern to match tool names (supports regex)
- `timeout`: Execution timeout in seconds
- `once`: (Skills only) Run hook only once per session

---

## 3. Research Areas

### 3.1 Hooks by Agent Category

#### Developer Agents (frontend-developer, backend-developer, architecture, tester)

**Primary Tools**: Write, Edit, Bash

| Agent                  | Recommended Hooks                                                                 |
| ---------------------- | --------------------------------------------------------------------------------- |
| **frontend-developer** | PostToolUse: auto-format, lint, type-check after Write/Edit                       |
| **backend-developer**  | PreToolUse: security validation; PostToolUse: type-check, DB schema validation    |
| **architecture**       | PostToolUse: validate generated files, format; Stop: verify scaffold completeness |
| **tester**             | PostToolUse: run tests immediately after writing test files                       |

**Recommended PreToolUse Hooks for Developers:**

- Security validation (no hardcoded secrets in written files)
- Block dangerous bash commands (rm -rf, force push to main)

**Recommended PostToolUse Hooks for Developers:**

- Auto-format with prettier after Write/Edit (matcher: `Write|Edit`)
- Type checking for TypeScript files (matcher: `Write|Edit`)
- Run tests after test file writes (tester agent only, not all developers)

**Recommended Stop Hooks for Developers:**

- **Lightweight only** - avoid running full test suites on every Stop
- Check for uncommitted console.logs (fast grep)
- Verify no TODO markers left in new code (fast grep)
- Verify scaffolding completeness (architecture agent only)

**What NOT to implement as Stop hooks:**

- Full test suite runs (too slow, blocks workflow)
- Lint/format checks (should be PostToolUse, not Stop)
- Anything that takes more than a few seconds

---

#### Read-Only Agents (Reviewers/Researchers)

**Primary Tools**: Read, Grep, Glob (100% read-only)

| Agent               | PreToolUse | PostToolUse             | Stop                     |
| ------------------- | ---------- | ----------------------- | ------------------------ |
| frontend-researcher | ❌ Skip    | ⚠️ Progress tracking    | ✅ **Format validation** |
| backend-researcher  | ❌ Skip    | ⚠️ Progress tracking    | ✅ **Format validation** |
| pattern-scout       | ❌ Skip    | ⚠️ Coverage tracking    | ✅ **Format validation** |
| pattern-critique    | ❌ Skip    | ⚠️ Reference validation | ✅ **Format validation** |
| frontend-reviewer   | ❌ Skip    | ⚠️ Reference validation | ✅ **Format validation** |
| backend-reviewer    | ❌ Skip    | ⚠️ Reference validation | ✅ **Format validation** |

**Key Insight**: Read-only agents benefit most from **Stop hooks that enforce structured output**.

**Recommended Stop Hooks for Read-Only Agents:**

- Output structure validation (check required XML/markdown sections)
- Evidence & reference validation (verify all claims have file:line references)
- Finding completeness (verify all referenced files exist)

**What NOT to implement:**

- PreToolUse hooks for read-only agents (unnecessary complexity)
- Permission-based hooks (agents are inherently sandboxed)
- Granular per-tool hooks (aggregate validation is more effective)

---

#### Meta Agents (agent-summoner, skill-summoner, documentor)

**Primary Tools**: Write, Edit, Read, Grep, Glob

**Recommended Hooks:**

- PostToolUse: auto-format written files
- Stop: verify manifest/schema compliance

---

#### Planning Agents (pm, orchestrator)

**Primary Tools**: Task, Read

**Recommended Hooks:**

- Stop: requirements validation, summary generation
- PostToolUse: issue tracking (for orchestrator)

---

### 3.2 Shared Hooks Architecture

#### Recommended: Category-Level hooks.yaml Files (Option A)

**Rationale:** Single source of truth per category, clear visual hierarchy, backward compatible.

**File Structure:**

```
src/agents/
├── developer/
│   ├── hooks.yaml                    # NEW: category-level hooks
│   ├── frontend-developer/
│   │   └── agent.yaml                # agent-specific overrides only
│   └── backend-developer/
│       └── agent.yaml
├── reviewer/
│   ├── hooks.yaml                    # NEW: category-level hooks
│   └── ...
├── researcher/
│   ├── hooks.yaml                    # NEW
│   └── ...
├── planning/
│   ├── hooks.yaml                    # NEW
│   └── ...
├── pattern/
│   ├── hooks.yaml                    # NEW
│   └── ...
├── meta/
│   ├── hooks.yaml                    # NEW
│   └── ...
└── tester/
    ├── hooks.yaml                    # NEW
    └── ...
```

**Example Category-Level hooks.yaml:**

`src/agents/developer/hooks.yaml`:

```yaml
# Shared hooks for all developer agents
PostToolUse:
  - matcher: "Write|Edit"
    hooks:
      - type: command
        command: "${CLAUDE_PLUGIN_ROOT}/scripts/format-code.sh"
        timeout: 30
  - matcher: "Bash"
    hooks:
      - type: command
        command: "${CLAUDE_PLUGIN_ROOT}/scripts/lint-check.sh"
        timeout: 60
```

**Hook Inheritance Rules:**

1. Agent-level hooks **extend** category-level hooks (appended, not replaced)
2. Category hooks execute first, then agent-specific hooks
3. Empty category hooks.yaml = no category-level hooks (graceful fallback)

**Alternatives Considered:**

| Option                       | Pros                           | Cons                          | Verdict            |
| ---------------------------- | ------------------------------ | ----------------------------- | ------------------ |
| A. Category-level hooks.yaml | Single source, clear hierarchy | New file format               | ✅ **Recommended** |
| B. Stack config hooks        | All in one place               | Mixes concerns, stack-centric | ❌ Rejected        |
| C. Liquid conditionals       | Uses existing system           | Fragile, hard to maintain     | ❌ Rejected        |
| D. Stack agent_overrides     | Some flexibility               | Confusing merge behavior      | ❌ Rejected        |

---

### 3.3 Implementation Approach

#### 1. Agent.yaml Schema Addition

```yaml
# src/agents/{category}/{name}/agent.yaml
id: frontend-developer
title: Frontend Developer Agent
description: Implements frontend features from detailed specs
model: opus
tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash

# NEW: Lifecycle hooks for this agent
hooks:
  PreToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "echo 'About to edit/write'"
          timeout: 30

  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "bun run lint --fix"
        - type: command
          command: "bun run prettier --write"

  Stop:
    - hooks:
        - type: command
          command: "echo 'Frontend developer completed'"
```

#### 2. TypeScript Type Status

**Good news**: Types already exist and are correct in `src/types.ts`:

```typescript
// AgentYamlConfig already has:
hooks?: Record<string, AgentHookDefinition[]>;

// AgentConfig already has:
hooks?: Record<string, AgentHookDefinition[]>;
```

**No TypeScript changes needed!**

#### 3. Compilation Pipeline Changes

**Files to modify:**

1. **`src/cli/lib/loader.ts`** - Add `loadCategoryHooks()` function:

   ```typescript
   async function loadCategoryHooks(
     categoryDir: string,
   ): Promise<Record<string, AgentHookDefinition[]>> {
     const hooksPath = path.join(categoryDir, "hooks.yaml");
     if (!(await fileExists(hooksPath))) {
       return {};
     }
     const content = await readFile(hooksPath);
     return parseYaml(content);
   }
   ```

2. **`src/cli/lib/resolver.ts`** - Add `mergeHooks()` function:

   ```typescript
   function mergeHooks(
     categoryHooks: Record<string, AgentHookDefinition[]>,
     agentHooks?: Record<string, AgentHookDefinition[]>,
   ): Record<string, AgentHookDefinition[]> {
     if (!agentHooks) return categoryHooks;
     const merged = { ...categoryHooks };
     for (const [eventName, hooks] of Object.entries(agentHooks)) {
       merged[eventName] = [...(merged[eventName] || []), ...hooks];
     }
     return merged;
   }
   ```

3. **`src/cli/lib/stack-plugin-compiler.ts`** - Merge agent hooks into hooks.json:

   ```typescript
   function mergeAgentHooks(
     agents: Record<string, AgentConfig>,
   ): Record<string, AgentHookDefinition[]> {
     const merged: Record<string, AgentHookDefinition[]> = {};
     for (const [name, agent] of Object.entries(agents)) {
       if (agent.hooks) {
         for (const [event, hooks] of Object.entries(agent.hooks)) {
           merged[event] = [...(merged[event] || []), ...hooks];
         }
       }
     }
     return merged;
   }
   ```

4. **`src/agents/_templates/agent.liquid`** - Add hooks to frontmatter:
   ```liquid
   {% if agent.hooks %}hooks:
   {% for eventType in agent.hooks %}  {{ eventType[0] }}:
   {% for hookDef in eventType[1] %}    - {% if hookDef.matcher %}matcher: {{ hookDef.matcher }}
         {% endif %}hooks:
   {% for hook in hookDef.hooks %}        - type: {{ hook.type }}
             {% if hook.command %}command: {{ hook.command }}{% endif %}
             {% if hook.prompt %}prompt: {{ hook.prompt }}{% endif %}
   {% endfor %}{% endfor %}{% endfor %}{% endif %}
   ```

#### 4. Output Format

**Recommended: Single `hooks/hooks.json` with all hooks merged**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/format-code.sh"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/validate-bash.py"
          }
        ]
      }
    ]
  }
}
```

---

### 3.4 Use Cases & Examples

#### Code Quality Hooks

**1. Auto-Format Code After Write/Edit**

```yaml
# Category: developer/
PostToolUse:
  - matcher: "Write|Edit"
    hooks:
      - type: command
        command: "${CLAUDE_PLUGIN_ROOT}/scripts/format-code.sh"
        timeout: 30
```

**Script** (`scripts/format-code.sh`):

```bash
#!/bin/bash
set -euo pipefail
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path')

case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.md)
    npx prettier --write "$file_path" 2>/dev/null || true
    ;;
esac
exit 0
```

**2. Type Checking After TypeScript Changes**

```yaml
PostToolUse:
  - matcher: "Write|Edit"
    hooks:
      - type: command
        command: "bun tsc --noEmit"
        timeout: 60
```

---

#### Safety/Security Hooks

**1. Block Dangerous Bash Commands**

```yaml
# Category: All (critical)
PreToolUse:
  - matcher: "Bash"
    hooks:
      - type: command
        command: "${CLAUDE_PLUGIN_ROOT}/scripts/validate-bash.py"
```

**Script** (`scripts/validate-bash.py`):

```python
#!/usr/bin/env python3
import json, sys, re

DANGEROUS_PATTERNS = [
    (r'rm\s+-rf\s+/', 'Recursive delete from root'),
    (r'sudo\s+rm\s+-rf', 'Sudo recursive delete'),
    (r'git\s+push.*--force.*main|master', 'Force push to main'),
]

data = json.load(sys.stdin)
if data.get("tool_name") != "Bash":
    sys.exit(0)

command = data.get("tool_input", {}).get("command", "")
for pattern, desc in DANGEROUS_PATTERNS:
    if re.search(pattern, command, re.IGNORECASE):
        print(f"BLOCKED: {desc}", file=sys.stderr)
        sys.exit(2)
sys.exit(0)
```

**2. Protect Sensitive Files**

```yaml
PreToolUse:
  - matcher: "Write|Edit"
    hooks:
      - type: command
        command: "${CLAUDE_PLUGIN_ROOT}/scripts/protect-sensitive.py"
```

---

#### Testing Hooks

**1. Auto-Run Tests After Writing Test Files**

```yaml
# Category: tester/
PostToolUse:
  - matcher: "Write|Edit"
    hooks:
      - type: command
        command: "${CLAUDE_PLUGIN_ROOT}/scripts/run-tests.sh"
        timeout: 120
```

**2. Check for Leftover Console.logs**

```yaml
Stop:
  - hooks:
      - type: command
        command: "${CLAUDE_PLUGIN_ROOT}/scripts/check-console-logs.sh"
        timeout: 10
```

> **Note**: Avoid running full test suites on Stop - it's too slow and blocks workflow. Tests should run as PostToolUse hooks on test files only, or be triggered manually.

---

#### Smart Stop Hooks (Prompt-Based)

**1. Verify All Tasks Complete**

```yaml
Stop:
  - hooks:
      - type: prompt
        prompt: |
          Review the conversation and check if all requested changes were made.
          Did Claude complete all requested tasks?
          Respond with {"ok": true} or {"ok": false, "reason": "explanation"}.
        timeout: 30
```

**2. Check for Leftover TODOs**

```yaml
Stop:
  - hooks:
      - type: command
        command: "${CLAUDE_PLUGIN_ROOT}/scripts/check-todos.sh"
```

---

## 4. Summary: Recommended Hooks by Category

| Category        | PreToolUse                  | PostToolUse              | Stop               |
| --------------- | --------------------------- | ------------------------ | ------------------ |
| **developer/**  | Naming validation, security | Format, lint, type-check | Test suite         |
| **reviewer/**   | ❌ Skip                     | Reference validation     | Format validation  |
| **researcher/** | ❌ Skip                     | Progress tracking        | Format validation  |
| **planning/**   | ❌ Skip                     | Issue tracking           | Requirements check |
| **pattern/**    | ❌ Skip                     | Coverage tracking        | Format validation  |
| **meta/**       | ❌ Skip                     | Format files             | Schema compliance  |
| **tester/**     | ❌ Skip                     | Run tests after writes   | Test summary       |

---

## 5. Implementation Checklist

```
Phase 1: Category-Level Hooks Infrastructure
[ ] Create hooks.yaml files in each category directory
[ ] Add loadCategoryHooks() to loader.ts
[ ] Add mergeHooks() to resolver.ts
[ ] Update stack-plugin-compiler.ts to collect all hooks

Phase 2: Agent.yaml Support
[ ] Update agent.liquid template for hooks frontmatter
[ ] Test agent-level hooks override category hooks

Phase 3: Scripts & Validation
[ ] Create scripts/ directory in plugin output
[ ] Add format-code.sh, validate-bash.py, etc.
[ ] Test hook execution end-to-end

Phase 4: Documentation
[ ] Update CLAUDE_ARCHITECTURE_BIBLE.md
[ ] Add hooks examples to agent.yaml documentation
[ ] Document category-level vs agent-level hooks
```

---

## 6. Key Decisions

| Decision                  | Choice                    | Rationale                                     |
| ------------------------- | ------------------------- | --------------------------------------------- |
| Shared hooks architecture | Category-level hooks.yaml | DRY, clear hierarchy, backward compatible     |
| Hook merge strategy       | Append (category first)   | Both sets execute, agent can extend           |
| Output format             | Single hooks/hooks.json   | Simpler for Claude Code to load               |
| Hook types priority       | command > prompt          | Deterministic, fast execution                 |
| Read-only agents          | Stop hooks only           | Minimize overhead, focus on output validation |

---

## Related Files

- `src/cli/lib/stack-plugin-compiler.ts` - Current hooks generation
- `src/cli/lib/loader.ts` - Agent loading (needs loadCategoryHooks)
- `src/cli/lib/resolver.ts` - Agent resolution (needs mergeHooks)
- `src/types.ts` - Type definitions including `AgentHookDefinition`
- `src/schemas/plugin.schema.json` - Plugin manifest schema
- `src/agents/_templates/agent.liquid` - Agent compilation template
- `src/agents/**/agent.yaml` - Agent definition files

---

## References

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
- [Plugin Components Reference](https://code.claude.com/docs/en/plugins-reference)
- [Official Claude Plugins - code-simplifier](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/code-simplifier)

---

## 7. Automatic Code Simplification for Developer Agents

> **Goal**: Developer agents automatically self-review for over-engineering before completing responses.
> **Research Date**: 2026-01-25
> **Source**: Official Anthropic `code-simplifier` plugin analysis

### 7.1 Official code-simplifier Plugin Analysis

**Plugin Structure:**

```
plugins/code-simplifier/
├── .claude-plugin/
│   └── plugin.json
└── agents/
    └── code-simplifier.md
```

**plugin.json:**

```json
{
  "name": "code-simplifier",
  "version": "1.0.0",
  "description": "Agent that simplifies and refines code for clarity, consistency, and maintainability while preserving functionality",
  "author": {
    "name": "Anthropic",
    "email": "support@anthropic.com"
  }
}
```

**Full Agent Prompt (code-simplifier.md):**

```yaml
---
name: code-simplifier
description: Simplifies and refines code for clarity, consistency, and maintainability while preserving all functionality. Focuses on recently modified code unless instructed otherwise.
model: opus
---
```

```markdown
You are an expert code simplification specialist focused on enhancing code clarity, consistency, and maintainability while preserving exact functionality. Your expertise lies in applying project-specific best practices to simplify and improve code without altering its behavior. You prioritize readable, explicit code over overly compact solutions. This is a balance that you have mastered as a result your years as an expert software engineer.

You will analyze recently modified code and apply refinements that:

1. **Preserve Functionality**: Never change what the code does - only how it does it. All original features, outputs, and behaviors must remain intact.

2. **Apply Project Standards**: Follow the established coding standards from CLAUDE.md including:
   - Use ES modules with proper import sorting and extensions
   - Prefer `function` keyword over arrow functions
   - Use explicit return type annotations for top-level functions
   - Follow proper React component patterns with explicit Props types
   - Use proper error handling patterns (avoid try/catch when possible)
   - Maintain consistent naming conventions

3. **Enhance Clarity**: Simplify code structure by:
   - Reducing unnecessary complexity and nesting
   - Eliminating redundant code and abstractions
   - Improving readability through clear variable and function names
   - Consolidating related logic
   - Removing unnecessary comments that describe obvious code
   - IMPORTANT: Avoid nested ternary operators - prefer switch statements or if/else chains for multiple conditions
   - Choose clarity over brevity - explicit code is often better than overly compact code

4. **Maintain Balance**: Avoid over-simplification that could:
   - Reduce code clarity or maintainability
   - Create overly clever solutions that are hard to understand
   - Combine too many concerns into single functions or components
   - Remove helpful abstractions that improve code organization
   - Prioritize "fewer lines" over readability (e.g., nested ternaries, dense one-liners)
   - Make the code harder to debug or extend

5. **Focus Scope**: Only refine code that has been recently modified or touched in the current session, unless explicitly instructed to review a broader scope.

Your refinement process:

1. Identify the recently modified code sections
2. Analyze for opportunities to improve elegance and consistency
3. Apply project-specific best practices and coding standards
4. Ensure all functionality remains unchanged
5. Verify the refined code is simpler and more maintainable
6. Document only significant changes that affect understanding

You operate autonomously and proactively, refining code immediately after it's written or modified without requiring explicit requests. Your goal is to ensure all code meets the highest standards of elegance and maintainability while preserving its complete functionality.
```

---

### 7.2 Key Insight: Manual vs Automatic

The official `code-simplifier` is a **separate agent** invoked manually after coding sessions:

```bash
claude --agent code-simplifier -p "Clean up the code I just wrote"
```

For **automatic simplification**, we need a different approach: **Stop hooks on developer agents** that enforce simplification principles before the agent completes.

---

### 7.3 Extracted Simplification Principles

From the official prompt, these are the core principles to embed in developer Stop hooks:

| Principle                   | What It Means                    | Hook Check                             |
| --------------------------- | -------------------------------- | -------------------------------------- |
| **Preserve Functionality**  | Never change behavior            | N/A (implicit)                         |
| **Apply Project Standards** | Follow CLAUDE.md conventions     | Reference CLAUDE.md in prompt          |
| **Reduce Complexity**       | Less nesting, fewer abstractions | Check for premature abstractions       |
| **Avoid Nested Ternaries**  | Use switch/if-else instead       | Flag nested `? :` patterns             |
| **Clarity Over Brevity**    | Explicit > compact               | Check for dense one-liners             |
| **Maintain Balance**        | Don't over-simplify              | Check for removed helpful abstractions |
| **Focus Scope**             | Only recently modified code      | Already scoped by agent response       |

---

### 7.4 Automatic Simplification via Stop Hooks

#### Recommended Implementation for Developer Agents

Add to `src/agents/developer/hooks.yaml`:

```yaml
# Automatic simplification for all developer agents
Stop:
  - hooks:
      - type: prompt
        prompt: |
          Review your response for over-engineering. Check if you:

          1. Created unnecessary abstractions (helpers, utilities for one-time use)
          2. Added features or handling not explicitly requested
          3. Used nested ternary operators (prefer switch/if-else)
          4. Wrote "clever" code that prioritizes brevity over clarity
          5. Added premature optimization or error handling for impossible cases
          6. Created new files when editing existing ones would suffice

          If ANY violation found, revise your response to be simpler.

          Reference: The project's anti-over-engineering principles from CLAUDE.md.
        timeout: 30
```

#### Agent-Specific Stop Hooks

For more tailored checks, add to individual agent.yaml files:

**frontend-developer/agent.yaml:**

```yaml
hooks:
  Stop:
    - hooks:
        - type: prompt
          prompt: |
            Review your React code for simplicity:

            1. Did you use Zustand when useState would suffice?
            2. Did you create custom hooks for one-time logic?
            3. Did you add memoization without measured performance need?
            4. Did you create wrapper components instead of composition?
            5. Did you add prop-drilling prevention for 2-level depth?

            If any violation, suggest the simpler alternative.
          timeout: 30
```

**backend-developer/agent.yaml:**

```yaml
hooks:
  Stop:
    - hooks:
        - type: prompt
          prompt: |
            Review your backend code for simplicity:

            1. Did you add middleware when inline logic would work?
            2. Did you create service layers for single-use functions?
            3. Did you add caching without measured performance need?
            4. Did you create abstractions for database access beyond Drizzle?
            5. Did you add retry logic or circuit breakers not requested?

            If any violation, suggest the simpler alternative.
          timeout: 30
```

---

### 7.5 Alternative: PostToolUse Hook for Immediate Feedback

For code-level checks (not response-level), use PostToolUse:

```yaml
# In developer/hooks.yaml
PostToolUse:
  - matcher: "Write|Edit"
    hooks:
      - type: prompt
        prompt: |
          Analyze the code just written/edited. Flag if:
          - More than 2 levels of nesting
          - Functions > 50 lines
          - Nested ternary operators
          - New files created when edit would work

          Return JSON: {"simple": true} or {"simple": false, "issue": "..."}
        timeout: 15
```

---

### 7.6 Comparison: Manual Plugin vs Automatic Hooks

| Aspect       | Official code-simplifier | Stop Hooks                         |
| ------------ | ------------------------ | ---------------------------------- |
| **Trigger**  | Manual invocation        | Automatic on every response        |
| **Scope**    | Entire codebase          | Agent's current response           |
| **Model**    | Opus (expensive)         | Haiku (cheap) or inherited         |
| **Depth**    | Deep refactoring         | Quick self-review                  |
| **Use Case** | Post-session cleanup     | Prevent over-engineering in-flight |
| **Latency**  | Separate step            | Adds ~2-5s to each response        |

**Recommendation**: Use **both**:

1. Stop hooks prevent over-engineering in real-time
2. Official plugin for periodic deep cleanup sessions

---

### 7.7 Implementation Checklist

```
Phase 1: Category-Level Simplification Hook
[ ] Create src/agents/developer/hooks.yaml with Stop hook
[ ] Add simplification prompt based on extracted principles
[ ] Test with frontend-developer and backend-developer

Phase 2: Agent-Specific Refinements
[ ] Add frontend-specific checks to frontend-developer/agent.yaml
[ ] Add backend-specific checks to backend-developer/agent.yaml
[ ] Add architecture-specific checks to architecture/agent.yaml

Phase 3: Integration with CLAUDE.md
[ ] Ensure Stop hook prompts reference project's CLAUDE.md
[ ] Extract anti-over-engineering checklist from CLAUDE.md
[ ] Test that hooks enforce CLAUDE.md principles

Phase 4: Measurement (Optional)
[ ] Track response length before/after hooks
[ ] Track revision rate (how often hook triggers changes)
[ ] Gather feedback on code quality improvements
```

---

### 7.8 Key Decisions

| Decision     | Choice                   | Rationale                               |
| ------------ | ------------------------ | --------------------------------------- |
| Hook type    | `prompt` (not `command`) | Need LLM to evaluate code complexity    |
| Hook event   | `Stop` (not PostToolUse) | Review entire response, not per-file    |
| Model        | Haiku (inherited)        | Fast, cheap, sufficient for self-review |
| Scope        | Developer agents only    | Reviewers/researchers don't write code  |
| Prompt style | Checklist of violations  | Concrete, actionable checks             |
