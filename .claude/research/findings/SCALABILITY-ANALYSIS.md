# Scalability Analysis - Agent #4 Findings

> **Research Agent:** #4 (Scalability)
> **Analysis Date:** 2026-01-08
> **Status:** Complete

---

## Executive Summary

The modular agent/skill architecture has **critical scalability issues** that will impact usability as the system grows. The most severe is **context window consumption**: compiled agents range from 90-138KB, consuming 30-35% of Claude's 100K context just for the agent definition.

---

## Measured Metrics

| Metric                 | Current Value    | At Scale (50 agents) | Impact                     |
| ---------------------- | ---------------- | -------------------- | -------------------------- |
| Compiled agent sizes   | 32-138KB         | Same per-agent       | 30-35% context consumed    |
| Profile config lines   | 231-625          | ~2500 lines          | Config unmaintainable      |
| Skill file sizes       | 25-43KB each     | Same                 | Skills dominate agent size |
| File reads per compile | ~140 (10 agents) | ~700 (50 agents)     | No caching, redundant      |

### Actual Compiled Agent Sizes

| Agent                   | Size      | Precompiled Skills |
| ----------------------- | --------- | ------------------ |
| `frontend-developer.md` | **120KB** | 3 skills           |
| `frontend-reviewer.md`  | **138KB** | 4 skills           |
| `tester.md`             | **109KB** | 2 skills           |
| `skill-summoner.md`     | **90KB**  | 0 skills           |
| `pm.md`                 | **39KB**  | 0 skills           |
| `orchestrator.md`       | **32KB**  | 0 skills           |

### Skill File Sizes (Home Profile)

| Skill                       | Size |
| --------------------------- | ---- |
| `frontend/performance.md`   | 43KB |
| `frontend/accessibility.md` | 42KB |
| `frontend/styling.md`       | 39KB |
| `frontend/testing.md`       | 38KB |
| `frontend/api.md`           | 37KB |
| `frontend/react.md`         | 33KB |
| `frontend/client-state.md`  | 26KB |
| `frontend/mocking.md`       | 25KB |

---

## Critical Issue: Context Window Consumption

### The Problem

Precompiled skills are embedded directly into agents. With skills averaging 25-43KB each, an agent with 3-4 precompiled skills reaches 100-140KB.

### Token Math

- 138KB agent = ~34,500 tokens (at 4 chars/token)
- Claude 100K context = 100,000 tokens
- Agent alone consumes **34.5%** of context
- Remaining for conversation + code: 65.5K tokens

### Projected Impact

Adding 2 more skills (~70KB) would push agents to 200KB+ (~50K tokens), leaving only 50% context for actual work.

---

## Complexity Analysis

| Operation         | Current Complexity      | Issue                                                |
| ----------------- | ----------------------- | ---------------------------------------------------- |
| Agent compilation | O(A \* (5 + P + C + E)) | A=agents, P=prompts, C=skills; all sequential        |
| File reading      | O(files), no caching    | Same core-principles.md read 17 times                |
| Validation        | O(A \* S)               | A=agents, S=skills per agent; acceptable             |
| Config size       | O(A \* S)               | Each agent lists all skills; home config = 625 lines |

### No O(n^2) Operations Found

The architecture avoids quadratic complexity, but has significant inefficiencies:

1. **Redundant file I/O:** `core-principles.md` is read once per agent instead of once total
2. **Sequential processing:** All agents compiled one-by-one in for-loop
3. **No caching layer:** Every compile starts fresh, reads all files again

---

## Code Issues in compile.ts

### 1. Redundant File I/O (lines 271-278)

```typescript
async function readCorePrompts(promptNames: string[]): Promise<string> {
  const contents: string[] = []
  for (const name of promptNames) {
    const content = await readFile(`${ROOT}/core-prompts/${name}.md`) // No cache!
    contents.push(content)
  }
  return contents.join('\n\n---\n\n')
}
```

**Impact:** With 10 agents x 4 core prompts = 40 reads for ~6 unique files.

### 2. Sequential Processing (lines 366-381)

```typescript
for (const [name, agent] of Object.entries(resolvedAgents)) {
  const output = await compileAgent(name, agent, config) // Sequential
  await Bun.write(`${OUT}/agents/${name}.md`, output)
}
```

**Fix:** Agents are independent - could use `Promise.all()` for parallel compilation.

### 3. No Incremental Compilation (line 557)

```typescript
await Bun.$`rm -rf ${OUT}/agents ${OUT}/skills ${OUT}/commands`
```

Always deletes everything, even if only one agent changed. No file timestamp checking.

---

## Scalability Projections

### At 50+ Agents

| Aspect           | Impact                          | Severity |
| ---------------- | ------------------------------- | -------- |
| agents.yaml      | ~100KB file (manageable)        | Low      |
| Profile configs  | ~2500 lines, hard to maintain   | **High** |
| Compilation time | 700+ file reads, all sequential | Medium   |
| Output directory | 50 agent files + skill files    | Low      |

**Config verbosity is the main pain point.** Each agent entry requires:

- `core_prompts` list (3-4 items)
- `ending_prompts` list (2 items)
- `precompiled` list with full skill metadata
- `dynamic` list with usage descriptions

Average 30-40 lines per agent. At 50 agents = 1500-2000 lines just for agent configs.

### At 100+ Skills

| Aspect           | Impact                                   | Severity |
| ---------------- | ---------------------------------------- | -------- |
| skills.yaml      | ~600 lines (manageable)                  | Low      |
| Skill files      | 100 files, 25-43KB each                  | Medium   |
| Skill assignment | Each agent references many skills by ID  | **High** |
| Deduplication    | `compileAllSkills()` uses Map, efficient | Low      |

**Issue:** Skill metadata is repeated across configs. Same skill like `frontend/react` is defined with different `usage` strings for frontend-developer, frontend-reviewer, tester, pm, skill-summoner, etc.

### At 10+ Profiles

| Aspect                | Impact                                   | Severity |
| --------------------- | ---------------------------------------- | -------- |
| Profile directories   | 10 directories with skills/ subdirs      | Low      |
| Skill duplication     | Same skill content in multiple profiles  | **High** |
| CLAUDE.md duplication | Profile-specific, acceptable             | Low      |
| No inheritance        | Cannot share base skills across profiles | **High** |

**Skill duplication is critical.** If `frontend/react.md` needs updating:

- Work profile: Update `profiles/work/skills/frontend/react.md`
- Home profile: Update `profiles/home/skills/frontend/react.md`
- Future profiles: Update each one separately

No mechanism to share skills across profiles or inherit from a base.

---

## Recommendations

### Critical Priority

1. **Reduce agent context consumption**

   - Limit precompiled skills to 2-3 max per agent
   - Add compiler warning if agent exceeds 50KB
   - Consider skill summarization for precompiled content

2. **Add file caching layer**
   ```typescript
   const cache = new Map<string, string>()
   async function readFileCached(path: string): Promise<string> {
     if (!cache.has(path)) {
       cache.set(path, await readFile(path))
     }
     return cache.get(path)!
   }
   ```

### High Priority

3. **Parallelize agent compilation**

   ```typescript
   await Promise.all(
     Object.entries(resolvedAgents).map(async ([name, agent]) => {
       const output = await compileAgent(name, agent, config)
       await Bun.write(`${OUT}/agents/${name}.md`, output)
     }),
   )
   ```

4. **Add skill inheritance system**

   - Shared skills in `profiles/_shared/skills/`
   - Profile-specific overrides in `profiles/{profile}/skills/`
   - Compiler checks profile first, falls back to shared

5. **Implement incremental compilation**
   - Track source file timestamps
   - Only recompile agents whose sources changed
   - `--force` flag for full rebuild

### Medium Priority

6. **Reduce config verbosity with skill sets**

   ```yaml
   skill_sets:
     frontend_core: [frontend/react, frontend/styling]
   agents:
     frontend-developer:
       precompiled: use frontend_core
   ```

7. **Add context budget to agent definitions**
   ```yaml
   frontend-developer:
     context_budget: 40000 # tokens
     # Compiler warns if compiled agent exceeds budget
   ```

### Low Priority

8. **Profile composition/layering**

   - Base profile with common settings
   - Child profiles inherit and override

9. **Skill versioning**
   - Version field in skills.yaml
   - Compiler can warn on mismatched versions

---

## Summary Table

| Issue                              | Severity     | Fix Complexity |
| ---------------------------------- | ------------ | -------------- |
| Agent context consumption (30-35%) | **Critical** | Medium         |
| No file caching                    | High         | Low            |
| Sequential compilation             | Medium       | Low            |
| Config verbosity O(A\*S)           | High         | Medium         |
| No incremental rebuild             | Medium       | Medium         |
| Skill duplication across profiles  | High         | Medium         |

---

## Files Analyzed

- `/home/vince/dev/claude-subagents/src/docs/CLAUDE_ARCHITECTURE_BIBLE.md`
- `/home/vince/dev/claude-subagents/src/compile.ts`
- `/home/vince/dev/claude-subagents/src/agents.yaml`
- `/home/vince/dev/claude-subagents/src/skills.yaml`
- `/home/vince/dev/claude-subagents/src/templates/agent.liquid`
- `/home/vince/dev/claude-subagents/src/types.ts`
- `/home/vince/dev/claude-subagents/src/profiles/home/config.yaml`
- `/home/vince/dev/claude-subagents/src/profiles/work/config.yaml`
- All skill files in both profiles

---

_Analysis complete. Ready for synthesis in Phase 2._
