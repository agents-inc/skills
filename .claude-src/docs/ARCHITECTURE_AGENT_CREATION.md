# Architecture Agent Creation

## How to Create This Agent

**IMPORTANT: Use the `agent-summoner` agent to create the Architecture Agent.**

Do NOT manually create agent source files. Instead:

1. Complete the research phase (read all required skills)
2. Create a detailed prompt document (ARCHITECTURE_AGENT_PROMPT.md)
3. Invoke the agent-summoner with the prompt document

```
Invoke the agent-summoner agent to create the "architecture" agent using the spec in .claude-src/docs/ARCHITECTURE_AGENT_PROMPT.md
```

The agent-summoner knows:
- All agent file structure conventions
- Required XML tags and formatting
- How to update agents.yaml and config.yaml
- How to compile and validate agents

---

## Research Phase (Complete Before Invoking agent-summoner)

### Required Reading
- [x] PROMPT_BIBLE.md - Prompting techniques
- [x] CLAUDE_ARCHITECTURE_BIBLE.md - Agent structure
- [x] agents.yaml - Configuration patterns
- [x] config.yaml - Skill assignments
- [x] Key agents (backend-developer, agent-summoner, pm)
- [x] Setup skills (monorepo, package, env, tooling, etc.)
- [x] Backend skills (api, database, authentication, etc.)
- [x] Security skill

### Tech Stack Summary
See ARCHITECTURE_AGENT_PROMPT.md for the complete tech stack that the architecture agent will scaffold.

---

## Files to Create

1. **ARCHITECTURE_AGENT_PROMPT.md** - Detailed spec for agent-summoner
2. Agent source files (created by agent-summoner):
   - intro.md
   - workflow.md
   - critical-requirements.md
   - critical-reminders.md
   - examples.md

---

## Cleanup Before Fresh Start

If partial files were created manually, remove them:

```bash
rm -rf .claude-src/agent-sources/architecture/
```

Then invoke agent-summoner with the prompt document.
