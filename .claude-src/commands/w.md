Start or resume watching the orchestrator status file with live polling.

## Instructions

1. Read `.claude/orchestrator-status.json` to see current state
2. Check if there are any active tasks by looking at the `active` array
3. If there's an active orchestrator agent (check for running Task agents), start polling:
   - Use `TaskOutput(task_id, block=false)` to check progress
   - Parse the agent's tool calls from output to determine current activity
   - Update `.claude/orchestrator-status.json` with current state
   - Repeat every few seconds until complete or user interrupts (Ctrl+C)
4. If no orchestrator is running, just report the current status and offer to start one

## Status File Location
`.claude/orchestrator-status.json`

## Polling Loop
```
while agent_running:
    output = TaskOutput(agent_id, block=false)
    status = parse_progress(output)
    Write(status.json)
    continue polling
```

When user Ctrl+C interrupts, stop gracefully and await further instructions.
