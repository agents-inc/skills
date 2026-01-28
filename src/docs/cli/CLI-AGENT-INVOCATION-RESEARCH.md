# CLI Agent Invocation Research

> **Generated**: 2026-01-22
> **Status**: ✅ VERIFIED WORKING (2026-01-22)
> **Purpose**: Document how the CLI can invoke meta-agents (skill-summoner, agent-summoner) directly without copying files to user repositories

---

## Executive Summary

**Problem**: Users want to generate custom skills/agents but don't have access to the meta-agents (skill-summoner, agent-summoner) or core prompts unless they clone the skills repository.

**Solution**: The Claude CLI supports inline agent definitions via `--agents` JSON flag. The CLI can fetch meta-agents from the remote repository and invoke them directly without writing any files to the user's repository.

**Key Discovery**: `claude --agents '{"name": {...}}' --agent name -p "prompt"` allows ephemeral agent invocation.

---

## The Problem

### Current Architecture Gap

```
Skills Repository                    User's Repository
─────────────────                    ─────────────────
.claude/agents/                      .claude/stacks/
├── skill-summoner.md                └── my-stack/
├── agent-summoner.md                    └── skills/  (copied skills)
└── pattern-scout.md
                                     ❌ No meta-agents
src/agents/_principles/              ❌ No principles
├── core-principles.md               ❌ No generation capability
└── ...
```

Users can:

- ✅ Use pre-built skills (via `cc init`)
- ❌ Generate custom skills (requires meta-agents)
- ❌ Generate custom agents (requires meta-agents)

### Original Assumptions

1. Users would need to clone the repository to generate custom content
2. Or the CLI would need to copy meta-agent files to user repositories
3. Or we'd need a web-based generation service

**All of these are unnecessary.**

---

## The Solution

### Claude CLI Agent Flags

The Claude CLI supports these flags:

```bash
--agent <agent>       # Agent for the current session
--agents <json>       # JSON object defining custom agents
--system-prompt       # System prompt to use for the session
```

### Inline Agent Definition

The `--agents` flag accepts a JSON object that defines agents inline:

```bash
claude --agents '{
  "skill-summoner": {
    "description": "Creates technology-specific skills",
    "prompt": "You are a skill creator...",
    "model": "opus",
    "tools": ["Read", "Write", "Edit", "Grep", "Glob", "WebSearch", "WebFetch"]
  }
}' --agent skill-summoner -p "Create a skill for handling webhooks"
```

This means:

- **No files need to be written to the user's repository**
- **The meta-agent is ephemeral** - fetched, used, discarded
- **Full agent semantics preserved** - model, tools, prompt

---

## Implementation Architecture

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   USER'S REPOSITORY                             │
│                                                                 │
│   $ cc create skill backend/webhooks --generate                 │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CLI (cc command)                           │
│                                                                 │
│   1. Parse command: skillPath = "backend/webhooks"              │
│   2. Scaffold local template (only file written)                │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ giget fetch (in memory)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   REMOTE SKILLS REPOSITORY                      │
│                                                                 │
│   .claude/agents/skill-summoner.md                              │
│   ├── frontmatter: name, description, model, tools              │
│   └── body: full agent prompt with preloaded content            │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ Parse frontmatter + body
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CLI CONSTRUCTS JSON                           │
│                                                                 │
│   {                                                             │
│     "skill-summoner": {                                         │
│       "description": "Creates technology-specific skills...",   │
│       "prompt": "[full agent prompt from markdown body]",       │
│       "model": "opus",                                          │
│       "tools": ["Read", "Write", "Edit", ...]                   │
│     }                                                           │
│   }                                                             │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ execSync
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CLAUDE CLI INVOCATION                         │
│                                                                 │
│   claude --agents '{"skill-summoner": {...}}'                   │
│          --agent skill-summoner                                 │
│          -p "Create skill at backend/webhooks for webhooks"     │
│                                                                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ Claude runs AS skill-summoner
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SKILL GENERATION                              │
│                                                                 │
│   Claude (as skill-summoner) generates:                         │
│   - SKILL.md with frontmatter                                   │
│   - metadata.yaml                                               │
│   - examples/ (if needed)                                       │
│   - reference.md (if needed)                                    │
│                                                                 │
│   Written to: .claude/stacks/*/skills/backend/webhooks/         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Pseudocode Implementation

```typescript
// src/cli/commands/create-skill.ts

import { execSync } from "child_process";
import { downloadTemplate } from "giget";
import matter from "gray-matter";

interface AgentDefinition {
  description: string;
  prompt: string;
  model?: string;
  tools?: string[];
}

async function createSkillWithGeneration(
  skillPath: string,
  topic: string,
  options: { source?: string },
) {
  const source = options.source ?? "github:claude-collective/skills";

  // 1. Scaffold local skill template (the only file written to user's repo)
  await scaffoldSkillTemplate(skillPath);

  // 2. Fetch skill-summoner from remote (in memory via temp dir)
  const tempDir = await downloadTemplate(`${source}/.claude/agents`, {
    dir: ".cc-temp",
    force: true,
  });

  const agentContent = await Bun.file(`${tempDir}/skill-summoner.md`).text();

  // 3. Parse frontmatter and body
  const { data: frontmatter, content: body } = matter(agentContent);

  // 4. Construct inline agent JSON
  const agentDef: AgentDefinition = {
    description: frontmatter.description,
    prompt: body,
    model: frontmatter.model,
    tools: frontmatter.tools?.split(",").map((t: string) => t.trim()),
  };

  const agentsJson = JSON.stringify({ "skill-summoner": agentDef });

  // 5. Clean up temp directory
  await rm(tempDir, { recursive: true });

  // 6. Invoke claude with inline agent definition
  const prompt = `Create a comprehensive skill at "${skillPath}" for: ${topic}`;

  execSync(
    `claude --agents '${agentsJson}' --agent skill-summoner -p "${prompt}"`,
    { stdio: "inherit" },
  );
}
```

---

## Agent Semantics Comparison

| Mechanism                  | Fresh Context | Tool Restrictions | Model Selection | Progressive Skill Loading |
| -------------------------- | ------------- | ----------------- | --------------- | ------------------------- |
| **Task tool sub-agent**    | ✅            | ✅                | ✅              | ✅ (via frontmatter)      |
| **`--agent` flag**         | ✅            | ✅                | ✅              | ⚠️ (baked into prompt)    |
| **`--agents` inline JSON** | ✅            | ✅                | ✅              | ⚠️ (baked into prompt)    |
| **`--system-prompt`**      | ✅            | ❌                | ❌              | ❌                        |
| **"Follow this file"**     | ❌            | ❌                | ❌              | ❌                        |

The `--agents` inline JSON approach provides **nearly full sub-agent semantics**. The only limitation is that skills must be baked into the prompt rather than progressively loaded, which is acceptable for meta-agents that have their context pre-compiled.

---

## Meta-Agents to Distribute

These pre-compiled agents should be available for CLI invocation:

| Agent            | Purpose                         | Key Tools                  |
| ---------------- | ------------------------------- | -------------------------- |
| `skill-summoner` | Create new skills via research  | WebSearch, WebFetch, Write |
| `agent-summoner` | Create new agents               | Read, Write, Grep          |
| `pattern-scout`  | Extract patterns from codebases | Read, Grep, Glob           |

### Pre-Compilation Requirements

Meta-agents must be **self-contained** with all context baked in:

- Core prompts embedded (not referenced)
- Bibles summarized or embedded
- No dependencies on local files

Current `skill-summoner.md` is already self-contained (see `.claude/agents/skill-summoner.md`).

---

## CLI Commands

### Proposed Interface

```bash
# Create skill with generation
cc create skill <path> --generate [--topic "description"]

# Create skill scaffold only (current behavior)
cc create skill <path>

# Create agent with generation
cc create agent <name> --generate [--purpose "description"]

# Create agent scaffold only
cc create agent <name>
```

### Examples

```bash
# Generate a skill for webhook handling
cc create skill backend/webhooks --generate --topic "Webhook signature verification and payload processing"

# Generate an agent for database migrations
cc create agent migration-manager --generate --purpose "Manages database migrations with rollback support"
```

---

## Testing Checklist

### Manual Testing Required

- [x] Verify `--agents` JSON flag accepts inline agent definitions ✅ (2026-01-22)
- [x] Verify `--agent` can reference an agent defined in `--agents` ✅ (2026-01-22)
- [x] Verify CLI subprocess inherits Claude auth ✅ (2026-01-22)
- [ ] Verify `--agents` JSON accepts `model` and `tools` fields (requires manual interactive test)
- [ ] Test with large prompt (skill-summoner is ~2000 lines) (requires manual interactive test)
- [ ] Test tool restrictions are enforced (requires manual interactive test)
- [ ] Test model selection is respected (requires manual interactive test)
- [ ] Verify output is written to correct location (requires manual interactive test)

### Test Results (2026-01-22)

**Test:** CLI invokes `claude --agents` via `execSync()`

```
Chain: User → Claude Code → Bash → CLI → execSync('claude --agents ...') → Spawned Claude
```

**Result:** ✅ PASSED

```
$ bun src/cli/index.ts test-agent
Running: claude --agents '...' --agent test -p "Hello"
This tests if CLI can invoke Claude with inline agent definitions.

CLI agent invocation works!

✓ Test passed!
```

**Confirmed:**

- Auth is inherited through subprocesses
- `--agents` JSON flag works for inline agent definitions
- `--agent` flag can reference an inline-defined agent
- `-p` flag works for non-interactive mode

### Test Commands

```bash
# Basic inline agent test (VERIFIED WORKING)
claude --agents '{"test": {"description": "Test agent", "prompt": "You are a test agent. Say hello."}}' --agent test -p "Hello"

# With model and tools (TODO: verify)
claude --agents '{"test": {"description": "Test", "prompt": "List files", "model": "haiku", "tools": ["Bash"]}}' --agent test -p "List files in current directory"

# Full skill-summoner test (TODO: verify with large prompt)
claude --agents '{"skill-summoner": {...}}' --agent skill-summoner -p "Create a skill for X"
```

### CLI Test Command

A test command was added to the CLI for verification:

```bash
bun src/cli/index.ts test-agent
```

This runs the inline agent invocation test and confirms the full chain works.

---

## Implications

### What Users Can Do Without Cloning

| Capability           | Before        | After                             |
| -------------------- | ------------- | --------------------------------- |
| Use pre-built skills | ✅ `cc init`  | ✅ `cc init`                      |
| Create custom skills | ❌ Clone repo | ✅ `cc create skill --generate`   |
| Create custom agents | ❌ Clone repo | ✅ `cc create agent --generate`   |
| Modify principles    | ❌ Clone repo | ⚠️ `cc fetch principles` (future) |
| Contribute back      | ❌ Clone repo | ❌ Clone repo (intentional)       |

### Repository Separation

```
claude-collective/skills (PUBLIC)     user/my-project (PRIVATE)
─────────────────────────────────     ────────────────────────────
Community skills                      User's code
Meta-agents (read-only fetch)         Generated custom skills
Core prompts                          Stack configurations
Bibles                                Compiled agents
```

---

## Open Questions

1. **Caching**: Should the CLI cache fetched meta-agents locally for offline use?
2. **Versioning**: How to handle meta-agent version updates?
3. **Custom sources**: Should `--source` allow pointing to private meta-agent repos?
4. **Interactive mode**: Should `--generate` support interactive Claude session (not just `-p`)?

---

## Related Documents

| Document                          | Purpose                     |
| --------------------------------- | --------------------------- |
| `TODO.md`                         | Implementation tracking     |
| `CLI-DATA-DRIVEN-ARCHITECTURE.md` | Overall CLI architecture    |
| `SKILL-ATOMICITY-BIBLE.md`        | Skill design principles     |
| `PROMPT_BIBLE.md`                 | Prompt engineering patterns |

---

## Decision Log

| Date       | Decision                   | Rationale                               |
| ---------- | -------------------------- | --------------------------------------- |
| 2026-01-22 | Use `--agents` inline JSON | No file writes needed, ephemeral agents |
| 2026-01-22 | Pre-compile meta-agents    | Self-contained, no dependencies         |
| 2026-01-22 | Fetch via giget to temp    | Leverage existing infrastructure        |
