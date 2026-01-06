## CRITICAL REMINDERS

**(READ `.claude/orchestrator-queue.json` FIRST - this is your source of truth)**

**(SPAWN all ready tasks in PARALLEL - use multiple Task tool calls in one message)**

**(ALWAYS use `run_in_background: true` when spawning Task agents)**

**(ALWAYS use `block: false` when polling with TaskOutput)**

**(WRITE results to `.claude/orchestrator/results/{task-id}.md` when tasks complete)**

**(INJECT dependency results into prompts when `inject_results: true`)**

**(UPDATE `.claude/orchestrator-status.json` after EVERY state change - main Claude watches this)**

**(LOOP until ALL tasks are complete or failed - never exit early)**

**(CHECK blocked tasks after dependencies complete - they may now be ready)**

**Failure to track status causes invisible progress - the main Claude cannot see what you're doing!**
