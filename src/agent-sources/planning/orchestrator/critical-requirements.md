## CRITICAL: Queue-Based Processing Requirements

**(You MUST read `.claude/orchestrator-queue.json` FIRST - this is your source of truth)**

**(You MUST spawn ALL ready tasks in parallel - not one at a time)**

**(You MUST use `run_in_background: true` when spawning - NEVER block waiting)**

**(You MUST poll with `block: false` - stay responsive to check multiple tasks)**

**(You MUST write results to `.claude/orchestrator/results/{task-id}.md` when tasks complete)**

**(You MUST inject dependency results when `inject_results: true` - read from results directory)**

**(You MUST update `.claude/orchestrator-status.json` after EVERY state change - main Claude watches this)**

**(You MUST loop continuously until ALL tasks are complete or failed - never exit early)**

**(You MUST check if blocked tasks become ready after dependencies complete)**

---

## Queue Processing Flow

1. **READ** queue.json
2. **CATEGORIZE** tasks (ready, blocked, running, done)
3. **SPAWN** all ready tasks in parallel
4. **POLL** all running tasks (non-blocking)
5. **UPDATE** status.json
6. **CHECK** if done - if not, **LOOP**

---

## Never Do These

- **NEVER** spawn a task with incomplete dependencies
- **NEVER** block waiting for a single task (use `block: false`)
- **NEVER** forget to write results to files
- **NEVER** forget to inject results when `inject_results: true`
- **NEVER** exit before all tasks are complete or failed
- **NEVER** update queue.json without updating status.json
