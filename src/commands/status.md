Show current orchestrator status (quick check, no polling loop).

## Instructions

1. Read `.claude/orchestrator-status.json`
2. Display a formatted summary:
   - How many active/queued/completed tasks
   - What's currently running (if anything)
   - Last event message
3. Do NOT start a polling loop - this is a one-time status check

## Output Format

```
## Orchestrator Status

**Summary:** {summary}

**Active:** {count}
{list active tasks with status}

**Queued:** {count}
{list queued tasks}

**Recent:** {count}
{list recent completions}

**Last Event:** {last_event.message}
```

If the status file doesn't exist, report that no orchestrator session is active.
