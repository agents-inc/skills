# Model-Specific Optimizations Findings (Agent #11)

> This content should be merged into ARCHITECTURE-IMPROVEMENT-FINDINGS.md section 11

## Current State Assessment

**Model Assignment Analysis:**

- All 16 agents in `agents.yaml` use `model: opus`
- No model tiering strategy implemented
- No Sonnet or Haiku agents defined

**Agents using Opus (all 16):**
| Agent | Use Case | Potential Alternative |
|-------|----------|----------------------|
| frontend-developer | Implementation | Opus (appropriate - complex reasoning) |
| backend-developer | Implementation | Opus (appropriate - complex reasoning) |
| frontend-reviewer | Code review | Opus (appropriate - quality critical) |
| backend-reviewer | Code review | Opus (appropriate - quality critical) |
| tester | Test writing | Opus (appropriate - coverage critical) |
| pm | Spec writing | Opus (appropriate - architecture decisions) |
| skill-summoner | Skill creation | Opus (appropriate - pattern synthesis) |
| agent-summoner | Agent creation | Opus (appropriate - meta-architecture) |
| pattern-scout | Pattern extraction | Could be Sonnet (read-only research) |
| pattern-critique | Pattern review | Opus (appropriate - judgment calls) |
| documentor | Documentation | Could be Sonnet or Haiku (deterministic) |
| architecture | Scaffolding | Could be Sonnet (template-based) |
| orchestrator | Coordination | Opus (appropriate - complex coordination) |
| frontend-researcher | Research | Could be Sonnet (read-only) |
| backend-researcher | Research | Could be Sonnet (read-only) |

## Compliance Assessment

**"Think" Word Usage (CRITICAL for Opus):**

- **Status: EXCELLENT COMPLIANCE**
- Grep search found only 4 occurrences of "think" in agent sources
- All 4 are in `agent-summoner` agent, **instructing** to avoid "think" (rule documentation, not violations)
- No inappropriate "think" usage that could confuse Opus 4.5 with extended thinking disabled

**Expansion Modifiers (CRITICAL for Sonnet/Opus 4.5):**

- **Status: EXCELLENT COMPLIANCE**
- All 16 agents include expansion modifiers in `intro.md`
- Common phrases: "be comprehensive and thorough", "include all necessary edge cases"
- Example: `frontend-developer/intro.md` line 3: "When implementing features, be comprehensive and thorough"

**Anti-Over-Engineering (CRITICAL for Opus):**

- **Status: WELL IMPLEMENTED**
- Comprehensive `anti-over-engineering.md` core prompt (116 lines)
- Applied to implementation agents via `core_prompts: developer` set
- Includes decision framework, explicit prohibitions, and positive alternatives

**Parallel Execution Hints (Opus excels at this):**

- **Status: LIMITED IMPLEMENTATION**
- Only `orchestrator` agent explicitly mentions parallel execution
- Other agents could benefit from parallel reading hints per PROMPT_BIBLE guidance

## Issues Identified

**1. No Model Tiering (HIGH PRIORITY)**

- Competitor analysis (wshobson/agents) shows 3-tier strategy:
  - Opus: 42 agents (critical architecture, security, code review)
  - Sonnet: 39 agents (complex reasoning tasks)
  - Haiku: 18 agents (fast operational tasks, deterministic execution)
- Potential cost savings: 60-80% on routine tasks per research
- Research claim: "Opus's 65% token reduction on complex work often offsets higher rates"

**2. Missing Parallel Execution Hints (MEDIUM PRIORITY)**

- PROMPT_BIBLE Technique: Opus excels at parallel tool execution
- Current state: Only orchestrator mentions parallelization
- Recommendation: Add parallel reading hints to researcher agents

**3. No Model-Specific Prompt Variations (LOW PRIORITY)**

- Same prompts used regardless of model
- Research shows Sonnet needs more explicit instructions
- Sonnet interprets constraints more literally

**4. Missing Model Selection Documentation (LOW PRIORITY)**

- No documentation on when to use which model
- No cost/quality tradeoff guidance for users

## Competitor Insights

**wshobson/agents Model Tiering Strategy:**

```
Planning Phase (Sonnet) -> Execution Phase (Haiku) -> Review Phase (Opus)
```

**Example assignments from wshobson:**

- Backend architect (Opus) - Critical API design decisions
- Test automator (Sonnet) - Test strategy requires reasoning
- Deployment engineer (Haiku) - Deterministic infrastructure tasks
- Security auditor (Opus) - Critical vulnerability assessment

**SuperClaude Approach:**

- Uses `--think-hard` flag for extended analysis depth
- Token efficiency mode achieves 30-70% reduction
- Confidence checking before work (25-250x ROI claimed)

## Recommendations

**HIGH PRIORITY:**

1. **Implement Model Tiering** - Add Sonnet/Haiku options for appropriate agents

   - Candidates for Sonnet: `pattern-scout`, `documentor`, `architecture`, `frontend-researcher`, `backend-researcher`
   - Candidates for Haiku: Simple document generation, formatting tasks

2. **Add Parallel Execution Hints** - Especially for researcher agents
   ```markdown
   # Good - Opus can parallelize

   Read these files and compare patterns: file1.ts, file2.ts, file3.ts
   ```

**MEDIUM PRIORITY:** 3. **Document Model Selection Criteria** - Add to CLAUDE_ARCHITECTURE_BIBLE.md

- When to use Opus (critical reasoning, security, architecture)
- When to use Sonnet (complex but non-critical, medium reasoning)
- When to use Haiku (deterministic, fast operations)

4. **Add Model-Aware Prompt Variations** - Consider template conditionals
   - More explicit instructions for Sonnet
   - Permission statements for substantial changes

**LOW PRIORITY:** 5. **Dynamic Model Selection** - Future enhancement

- Auto-select model based on task complexity
- User override capability

## Files Examined

- `/home/vince/dev/claude-subagents/src/docs/CLAUDE_ARCHITECTURE_BIBLE.md` - Model-Specific Considerations section (lines 542-648)
- `/home/vince/dev/claude-subagents/src/agents.yaml` - All 16 agent definitions
- `/home/vince/dev/claude-subagents/src/core-prompts/anti-over-engineering.md` - Full content (126 lines)
- `/home/vince/dev/claude-subagents/src/docs/PROMPT_BIBLE.md` - Sonnet/Opus comparison (lines 846-976)
- `/home/vince/dev/claude-subagents/.claude/research/unconventional-patterns-wshobson-agents.md` - Model tiering analysis
- `/home/vince/dev/claude-subagents/.claude/research/landscape-gaps-opportunities.md` - Cost optimization research
- All agent `intro.md` files for expansion modifier verification

## Summary for Main Findings File

**Key Findings:**

- All 16 agents use Opus (no model tiering)
- Excellent "think" word compliance
- Expansion modifiers present in all agents
- Missing Sonnet/Haiku cost optimization opportunities
- Limited parallel execution hints (only in orchestrator)

**Priority Items to Add to Summary:**

HIGH PRIORITY:

- [ ] **No model tiering** - All 16 agents use Opus; could save 60-80% on routine tasks by using Sonnet/Haiku for appropriate agents

MEDIUM PRIORITY:

- [ ] **Missing parallel execution hints** - Only orchestrator uses parallel reading; researcher agents should benefit
- [ ] **No model selection documentation** - Users have no guidance on cost/quality tradeoffs

LOW PRIORITY:

- [ ] **No model-specific prompt variations** - Same prompts regardless of model; Sonnet needs more explicit instructions
- [ ] **No dynamic model selection** - Cannot auto-select model based on task complexity
