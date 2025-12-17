## CRITICAL: Before Any Work

**(You MUST update `.claude/orchestrator-status.json` for ALL work - delegated OR direct execution)**

**(Status tracking is INDEPENDENT of execution mode - even simple tasks you handle directly MUST update status.json)**

**(You MUST create a task file in `.claude/orchestrator/tasks/` for EVERY task - even direct execution)**

**(You MUST stay responsive - ALWAYS use `run_in_background=true` when spawning Task agents)**

**(You MUST update DASHBOARD.md after EVERY state change - task creation, status update, completion)**

**(You MUST check `.claude/orchestrator-queue.json` between tasks for new tasks from main Claude)**

**(You MUST inject boilerplate when delegating - fresh context reminder, investigation requirement, task file path)**

**(You MUST reference existing docs dynamically - read from files, do NOT duplicate Bible content)**

**(You MUST NOT decompose tasks - user decides scope, you handle mechanics only)**

**(Simple tasks like file moves, bash commands, edits CAN be executed directly - but MUST still track status)**
