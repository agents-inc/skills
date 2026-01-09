# Async Orchestrator Agent: Research & Analysis

## Quick Reference

| Aspect             | Current State                                   | Proposed State                                      |
| ------------------ | ----------------------------------------------- | --------------------------------------------------- |
| Orchestration      | Synchronous (blocked during agent execution)    | Async (responsive during background work)           |
| Task Queueing      | Manual (user triggers each agent)               | Automated (orchestrator manages queue)              |
| Progress Tracking  | Per-agent markdown files                        | Centralized dashboard file with quick-glance status |
| Context Management | Full context in each agent                      | Fresh context per task + lightweight handoffs       |
| Boilerplate        | User must specify (ultrathink, read docs, etc.) | Orchestrator injects automatically                  |

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Industry Research](#industry-research)
4. [Options Analysis](#options-analysis)
5. [Recommendation](#recommendation)
6. [Implementation Considerations](#implementation-considerations)
7. [Feasibility Assessment](#feasibility-assessment)

---

## Problem Statement

### Core Pain Points

**1. Synchronous Blocking**
When the main Claude instance (orchestrator) spawns a Task agent, it blocks waiting for completion. During this time:

- User cannot interact with the orchestrator
- Cannot queue additional tasks
- Cannot adjust priorities or add context
- Cannot ask clarifying questions

**2. Markdown File Readability**
Current agent output files are:

- Dense and difficult to scan
- Missing quick-reference summaries
- Status updates buried in content
- No standardized "dashboard" format

**3. Boilerplate Burden**
Every task delegation requires the user to specify:

- "Use fresh context"
- "Use ultrathink/extended thinking"
- "Read the docs first"
- "Create/update progress file"
- "Follow patterns from X"

This cognitive overhead should be handled automatically by an intelligent orchestrator.

**4. Complex Task Decomposition**
For unclear, complex tasks:

- Decomposition into subtasks is manual
- Dependencies aren't tracked systematically
- No parallel execution of independent subtasks

---

## Current Architecture Analysis

### What Exists Today

```
Your Agent System (14 agents):
├── Specialists (execute work)
│   ├── frontend-developer
│   ├── backend-developer
│   ├── tester
│   ├── frontend-reviewer
│   ├── backend-reviewer
│   └── architecture
├── Planning (define work)
│   ├── pm (creates specs)
│   ├── documentor
│   ├── pattern-scout
│   └── pattern-critique
└── Meta (create/improve system)
    ├── agent-summoner
    ├── skill-summoner
```

### Current Orchestration Pattern

```
User → Claude (Orchestrator) → Task(agent) → Wait... → Return → User
                                    ↑
                              [BLOCKED HERE]
```

The main Claude instance acts as orchestrator but:

- Cannot process additional requests while waiting
- Context accumulates (eventually needs summarization)
- Each agent starts with inherited context (may be stale/irrelevant)

### Existing Progress Tracking

The `architecture` agent uses `SCAFFOLD-PROGRESS.md`:

- Phase-based progress tracking
- Files created per phase
- Verification gate results
- Resume instructions

This pattern works but isn't standardized across agents or centralized.

---

## Industry Research

### Anthropic's Multi-Agent Research System

From [Anthropic's Engineering Blog](https://www.anthropic.com/engineering/multi-agent-research-system):

**Key Architecture Decisions:**

1. **Currently Synchronous**: "Our lead agents execute subagents synchronously, waiting for each set of subagents to complete before proceeding."

2. **Acknowledges Async Benefits**: "Asynchronous execution would enable additional parallelism... But this asynchronicity adds challenges in result coordination, state consistency, and error propagation."

3. **Context Management**:

   - Memory persistence before context limits
   - Fresh subagents with clean contexts
   - Lightweight reference handoffs (not full artifacts)

4. **Parallelization**:

   - Lead agent spawns 3-5 subagents in parallel
   - Subagents use 3+ tools in parallel
   - Result: 90% reduction in research time

5. **Delegation Best Practices**:
   > "Each subagent needs an objective, an output format, guidance on the tools and sources to use, and clear task boundaries."

### Claude Flow Framework

From [Claude Flow Orchestration](https://github.com/ruvnet/claude-flow/wiki/Workflow-Orchestration):

**Execution Strategies:**

- Parallel: Up to 8 concurrent operations
- Sequential: Dependency checkpoints
- Adaptive: Dynamic based on resources
- Stream-Chained: Real-time output piping between agents

**Key Features:**

- Task dependency tracking
- Dynamic agent allocation (spawn based on workload)
- Checkpoint persistence (restore after failures)
- Real-time monitoring (progress %, performance, errors)

### Microsoft Azure AI Agent Patterns

From [Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns):

**Orchestration Patterns:**

- Sequential: A → B → C
- Concurrent: A, B, C in parallel
- Group Chat: Agents discuss/collaborate
- Handoff: Transfer control between specialists
- Magentic: Dynamic routing based on task

### Common Themes Across Sources

| Theme                  | Consensus                                                      |
| ---------------------- | -------------------------------------------------------------- |
| Fresh Context          | Subagents should start clean, receive only relevant context    |
| Parallel When Possible | Independent tasks should execute concurrently                  |
| Structured Handoffs    | Pass objectives, constraints, output format - not full history |
| Progress Persistence   | External storage for state across sessions                     |
| Observability          | Monitor agent decisions, not just outputs                      |

---

## Options Analysis

### Option 1: Enhanced Main Orchestrator (Incremental)

**Approach**: Keep current architecture but add:

- Standardized progress file format with dashboard section
- Template injection for common boilerplate
- Better task decomposition prompts

**Pros:**

- Minimal change to existing system
- No new agent type needed
- Can iterate quickly

**Cons:**

- Still synchronous/blocking
- Doesn't solve the core UX problem
- User still can't interact during agent execution

**Complexity**: Low
**Value**: Medium

---

### Option 2: Background Task Queue (Technical Solution)

**Approach**: Use Claude Code's `run_in_background` parameter:

```
Task(
  prompt="...",
  subagent_type="developer",
  run_in_background=true
)
```

Then poll with `TaskOutput(task_id, block=false)`.

**Pros:**

- Uses existing capability
- Enables true async
- No new agent architecture

**Cons:**

- Still requires orchestrator to manage queue manually
- Polling model is clunky
- Doesn't solve decomposition/delegation intelligence

**Complexity**: Low-Medium
**Value**: Medium

---

### Option 3: Dedicated Orchestrator Agent (Your Proposal)

**Approach**: Create `orchestrator` agent whose responsibilities are:

1. **Stay Responsive**: Never blocks on long-running tasks
2. **Task Decomposition**: Break complex requests into atomic subtasks
3. **Queue Management**: Maintain pending/active/completed task states
4. **Delegation Intelligence**: Auto-inject boilerplate (fresh context, ultrathink, patterns)
5. **Progress Dashboard**: Maintain centralized, scannable status file
6. **User Interface**: Handle back-and-forth while work proceeds

**Architecture:**

```
User ←→ Orchestrator Agent (always responsive)
              ↓
         Background Task Queue
              ↓
    ┌─────────┼─────────┐
    ↓         ↓         ↓
 Agent A   Agent B   Agent C  (parallel execution)
    ↓         ↓         ↓
    └─────────┴─────────┘
              ↓
      Progress Dashboard
      (ORCHESTRATOR-STATUS.md)
```

**Progress Dashboard Format:**

```markdown
# Orchestrator Dashboard

## Quick Status

| Task           | Agent             | Status      | Progress        |
| -------------- | ----------------- | ----------- | --------------- |
| Implement auth | backend-developer | IN_PROGRESS | 3/5 steps       |
| Add tests      | tester            | QUEUED      | -               |
| Review API     | backend-reviewer  | WAITING     | blocked on auth |

## Active Task: Implement auth

**Agent**: backend-developer (task_id: abc123)
**Started**: 2 min ago
**Current Step**: Creating middleware
**Recent Output**: "Added JWT validation to auth.ts:45-67"

## Pending Queue

1. Add tests (depends on: auth)
2. Review API (depends on: auth)
3. Frontend login form (independent)

## Completed Today

- [x] Database schema (backend-developer) - 10 min ago
- [x] Project scaffold (architecture) - 25 min ago

## User Notes

(Space for user to add context/priorities)
```

**Pros:**

- Solves core UX problem (responsiveness)
- Centralizes orchestration intelligence
- Standardizes progress tracking
- Enables parallel execution
- Reduces user cognitive load

**Cons:**

- Most complex to implement
- New agent type to maintain
- Coordination complexity
- Potential for orchestrator to become bottleneck

**Complexity**: High
**Value**: High

---

### Option 4: Hybrid Approach (Recommended)

**Approach**: Combine Options 2 and 3:

1. **Phase 1**: Create standardized dashboard format + templates
2. **Phase 2**: Build orchestrator agent using `run_in_background`
3. **Phase 3**: Add intelligent decomposition and dependency tracking

**Implementation:**

**Phase 1 - Foundation (1-2 sessions)**

- Create `ORCHESTRATOR-DASHBOARD.md` template
- Create boilerplate injection templates
- Update existing agents to write to dashboard format

**Phase 2 - Core Orchestrator (2-3 sessions)**

- New `orchestrator` agent definition
- Background task spawning via `run_in_background: true`
- Polling loop for task completion
- Dashboard maintenance logic

**Phase 3 - Intelligence (2-3 sessions)**

- Task decomposition heuristics
- Dependency graph management
- Parallel execution optimization
- User interaction patterns

**Pros:**

- Incremental value delivery
- Can stop at any phase with value gained
- Tests assumptions before full investment
- Builds on existing patterns

**Cons:**

- Still significant investment
- Coordination between phases needed

**Complexity**: Medium-High (but incremental)
**Value**: Very High

---

## Recommendation

**I recommend Option 4: Hybrid Approach** for these reasons:

### 1. Validated by Industry Leaders

Anthropic's own multi-agent system uses:

- Fresh context for subagents
- Structured delegation (objective, output format, tool guidance, boundaries)
- Memory persistence for state
- Parallel tool calling

These patterns map directly to your proposal.

### 2. Solves Real Pain Points

| Pain Point                 | How Hybrid Addresses                         |
| -------------------------- | -------------------------------------------- |
| Blocking during agent work | Background execution + polling               |
| Hard-to-read markdown      | Standardized dashboard with quick status     |
| Boilerplate burden         | Template injection by orchestrator           |
| Complex task decomposition | Intelligent task breakdown with dependencies |

### 3. Incremental Value

You get value at each phase:

- Phase 1: Better visibility, standardized format
- Phase 2: True async, responsiveness
- Phase 3: Full automation, intelligent delegation

### 4. Fits Your Architecture

Your system already has:

- Well-defined specialist agents
- Skill system for domain knowledge
- Profile-based configuration
- Compilation pipeline

The orchestrator slots in as a new agent type coordinating existing specialists.

---

## Implementation Considerations

### Technical Approach

**Orchestrator Agent Core Loop:**

```
1. Receive user request
2. Decompose into subtasks (with dependencies)
3. For each ready task:
   a. Select appropriate agent
   b. Inject boilerplate (fresh context, patterns, output format)
   c. Spawn via Task(run_in_background=true)
   d. Update dashboard
4. Poll for completions (non-blocking)
5. On completion:
   a. Update dashboard
   b. Check dependent tasks
   c. Spawn newly-ready tasks
6. Remain available for user interaction
7. Loop
```

**Dashboard File Structure:**

```
.claude/orchestrator/
├── DASHBOARD.md          # Quick status view
├── queue.json            # Task queue state
├── history.json          # Completed task log
└── tasks/
    ├── task-001.md       # Individual task details
    └── task-002.md
```

**Boilerplate Templates:**

```yaml
# src/orchestrator-templates/delegation.yaml
developer:
  preamble: |
    You have FRESH CONTEXT. Do not assume knowledge from previous sessions.
    Use ultrathink for complex decisions.

  investigation: |
    BEFORE writing any code:
    1. Read the relevant files mentioned in this task
    2. Identify existing patterns in the codebase
    3. Plan your approach

  output: |
    After completing work:
    1. Update DASHBOARD.md with your progress
    2. List files created/modified
    3. Note any blockers or questions
```

### Key Design Decisions

**1. How much to decompose?**

- Default: Let user specify granularity
- Auto-decompose only when tasks are clearly multi-agent
- Err toward fewer, larger tasks to reduce coordination overhead

**2. How to handle failures?**

- Retry once automatically
- On second failure, surface to user with context
- Don't block dependent tasks until user decides

**3. How often to poll?**

- Start with 30-second intervals
- Adaptive: more frequent for short tasks, less for long ones
- Always check before responding to user

**4. How to manage context?**

- Each spawned task gets minimal, relevant context
- Use dashboard as shared state (not full conversation history)
- Pass references to files, not file contents

---

## Feasibility Assessment

### Is This Achievable?

**Short Answer: Yes, with caveats.**

### Technical Feasibility: HIGH

- `run_in_background` and `TaskOutput` exist and work
- Your compilation pipeline can create orchestrator agent
- Markdown dashboard is straightforward
- No external dependencies required

### Design Feasibility: MEDIUM-HIGH

The main challenges are:

1. **Task Decomposition Quality**: Determining how to break complex requests into subtasks requires sophisticated prompting. Solution: Start manual, add heuristics over time.

2. **Dependency Tracking**: Knowing which tasks depend on which requires either explicit user specification or intelligent inference. Solution: Default to user-specified dependencies, add inference later.

3. **Error Coordination**: When a task fails, deciding what to do with dependents is non-trivial. Solution: Conservative approach - surface to user, don't auto-recover.

4. **Context Freshness**: Ensuring spawned agents have relevant but not stale context requires careful prompt engineering. Solution: Use your existing pattern of referencing files by path, not content.

### Operational Feasibility: MEDIUM

Concerns:

- **Token Usage**: Multi-agent systems use ~15x more tokens than chat (per Anthropic). Solution: Design for efficiency, batch where possible.
- **Debugging**: When things go wrong, tracing through multiple agents is hard. Solution: Robust logging in dashboard, clear task boundaries.
- **Maintenance**: Another agent to maintain. Solution: Keep orchestrator focused - delegation logic only, not domain expertise.

### Timeline Estimate

| Phase                          | Effort    | Value             |
| ------------------------------ | --------- | ----------------- |
| Phase 1: Dashboard + Templates | 2-4 hours | Quick wins        |
| Phase 2: Core Orchestrator     | 4-8 hours | Major improvement |
| Phase 3: Intelligence          | 4-8 hours | Full vision       |

**Total: 10-20 hours of focused work** to reach full functionality.

This is achievable incrementally - you can stop at any phase with value gained.

---

## Next Steps

If you want to proceed:

1. **Validate the dashboard format**: Let me create a sample `ORCHESTRATOR-DASHBOARD.md` for your review

2. **Define orchestrator agent**: Create the agent definition in your existing system

3. **Create delegation templates**: Build the boilerplate injection system

4. **Test with simple workflow**: Try orchestrating 2-3 tasks with background execution

5. **Iterate on intelligence**: Add decomposition heuristics based on real usage

---

## Sources

- [Anthropic: How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Microsoft Azure: AI Agent Design Patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)
- [Claude Flow: Workflow Orchestration](https://github.com/ruvnet/claude-flow/wiki/Workflow-Orchestration)
- [DEV: Multi-Agent Orchestration with Claude](https://dev.to/bredmond1019/multi-agent-orchestration-running-10-claude-instances-in-parallel-part-3-29da)
- [Kubiya: Top AI Agent Orchestration Frameworks 2025](https://www.kubiya.ai/blog/ai-agent-orchestration-frameworks)
- [n8n Blog: AI Agent Orchestration Frameworks](https://blog.n8n.io/ai-agent-orchestration-frameworks/)
