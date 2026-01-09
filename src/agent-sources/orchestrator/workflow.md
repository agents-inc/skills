## Queue-Based Orchestration Workflow

**ALWAYS follow this main loop. Stay responsive - never block waiting for agents.**

**CRITICAL: The queue file is your source of truth. Process it continuously until all tasks are complete.**

```xml
<orchestration_loop>

**MAIN LOOP - Execute continuously until all tasks complete or fail:**

**Step 1: READ QUEUE**
- Read `.claude/orchestrator-queue.json`
- Parse all tasks and their current states

**Step 2: CATEGORIZE TASKS**
For each task, determine its category:

| Condition | Category | Action |
|-----------|----------|--------|
| status="pending", depends_on=[] OR all deps complete | **READY** | Spawn immediately |
| status="pending", has incomplete deps | **BLOCKED** | Wait for deps |
| status="running" | **RUNNING** | Poll for completion |
| status="complete" or "failed" | **DONE** | No action needed |

**Step 3: SPAWN READY TASKS (in parallel)**
For EACH task categorized as READY:

1. **Build the prompt:**
   - If `inject_results: true`:
     - For each dependency ID in `depends_on`:
       - Read `.claude/orchestrator/results/{dep-id}.md`
       - Build injected context (see Result Injection Format below)
     - Prompt = task description + injected results
   - Else:
     - Prompt = task description only

2. **Spawn the agent:**
   ```
   Task(
     prompt: built_prompt,
     subagent_type: task.agent,
     run_in_background: true
   )
   ```

3. **Record the agent_id** returned from Task tool

4. **Update task in queue:**
   - Set `status: "running"`
   - Set `agent_id: {returned_id}`
   - Set `started: {current ISO timestamp}`

5. **Write updated queue.json** after ALL ready tasks are spawned

**Step 4: POLL RUNNING TASKS**
For EACH task with `status: "running"`:

1. **Check status:**
   ```
   TaskOutput(task_id: task.agent_id, block: false)
   ```

2. **Handle result:**
   - If `retrieval_status: "completed"`:
     - Write agent output to `.claude/orchestrator/results/{task.id}.md`
     - Set `task.status: "complete"`
     - Set `task.completed: {current ISO timestamp}`
     - Set `task.result_summary: {brief summary}`
   - If `retrieval_status` shows error/failure:
     - Set `task.status: "failed"`
     - Set `task.error: {error message}`
   - If still running:
     - Continue (don't block)

3. **Write updated queue.json** after ALL polls complete

**Step 5: UPDATE STATUS FILE**
Write to `.claude/orchestrator-status.json`:

```json
{
  "version": 2,
  "updated": "{current ISO timestamp}",
  "state": "running" | "complete" | "failed",
  "summary": "{N running}, {N blocked}, {N pending}, {N complete}, {N failed}",
  "running": [
    {
      "id": "{task.id}",
      "task": "{task.description (truncated)}",
      "agent": "{task.agent}",
      "agent_id": "{task.agent_id}",
      "started": "{task.started}"
    }
  ],
  "blocked": [
    {
      "id": "{task.id}",
      "task": "{task.description (truncated)}",
      "waiting_on": ["{incomplete dep IDs}"]
    }
  ],
  "completed": [
    {
      "id": "{task.id}",
      "task": "{task.description (truncated)}",
      "agent": "{task.agent}",
      "completed": "{task.completed}",
      "result_summary": "{task.result_summary}"
    }
  ],
  "failed": [
    {
      "id": "{task.id}",
      "task": "{task.description (truncated)}",
      "error": "{task.error}"
    }
  ]
}
```

**Step 6: CHECK IF DONE**
- If ANY tasks have status "pending", "blocked", or "running": **CONTINUE LOOP** (go to Step 1)
- If ALL tasks have status "complete" or "failed":
  - Update status.json with `state: "complete"` (or "failed" if any failed)
  - Report final summary
  - **EXIT LOOP**

**Step 7: CONTINUE**
- Brief pause if needed (don't spam polls)
- Go back to Step 1

</orchestration_loop>
```

---

## Result Injection Format

When spawning a task with `inject_results: true`, build the prompt like this:

```markdown
## Task
{task.description}

## Research Context

### From {dep.id}: {dep.description}
{contents of .claude/orchestrator/results/{dep.id}.md}

### From {dep2.id}: {dep2.description}
{contents of .claude/orchestrator/results/{dep2.id}.md}

## Instructions
Complete the task above using the research context provided.
```

---

## Queue Task Schema

Each task in `.claude/orchestrator-queue.json` has this structure:

```typescript
interface QueueTask {
  id: string;                    // e.g., "res-001", "impl-001"
  type: "research" | "implement" | "test" | "review" | "refactor";
  description: string;           // What to do (becomes the prompt)
  agent: string;                 // Agent type (e.g., "Explore", "frontend-developer")
  status: "pending" | "blocked" | "running" | "complete" | "failed";
  depends_on: string[];          // Task IDs that must complete first
  inject_results?: boolean;      // Inject dependency results into prompt
  created: string;               // ISO timestamp
  started?: string;              // ISO timestamp when spawned
  completed?: string;            // ISO timestamp when finished
  agent_id?: string;             // From Task tool response
  result_summary?: string;       // Brief summary of output
  error?: string;                // Error message if failed
}
```

---

## Status File Format (v2)

Location: `.claude/orchestrator-status.json`

**CRITICAL: Update this file after EVERY state change. The main Claude uses `watch` to display this.**

```json
{
  "version": 2,
  "updated": "2025-12-17T10:30:00Z",
  "state": "running",
  "summary": "2 running, 1 blocked, 0 pending, 1 complete",
  "running": [
    {
      "id": "res-001",
      "task": "Research auth patterns",
      "agent": "frontend-researcher",
      "agent_id": "abc123",
      "started": "2025-12-17T10:25:00Z"
    }
  ],
  "blocked": [
    {
      "id": "impl-001",
      "task": "Build login form",
      "waiting_on": ["res-001", "res-002"]
    }
  ],
  "completed": [],
  "failed": []
}
```

---

## Files Used by Orchestrator

| File | Purpose |
|------|---------|
| `.claude/orchestrator-queue.json` | Task queue (read/write) |
| `.claude/orchestrator-status.json` | Status for watch command (write) |
| `.claude/orchestrator/results/{task-id}.md` | Task outputs (write) |

---

## Self-Correction Checkpoints

**If you notice yourself:**

- **Not reading the queue file first** -> STOP. Always start by reading queue.json.
- **Blocking on a single task** -> STOP. Use `run_in_background=true` and poll with `block=false`.
- **Spawning blocked tasks** -> STOP. Check that ALL dependencies are complete first.
- **Not writing results to files** -> STOP. Write to `.claude/orchestrator/results/{task-id}.md`.
- **Not updating status.json** -> STOP. Main Claude is watching! Update after every change.
- **Not injecting results when inject_results=true** -> STOP. Read dependency results and include in prompt.
- **Exiting before all tasks complete** -> STOP. Loop until ALL tasks are complete or failed.

---

## Post-Action Reflection

**After spawning tasks:**
1. Did I spawn ALL ready tasks (not just one)?
2. Did I record the agent_id for each?
3. Did I update queue.json with running status?

**After polling:**
1. Did I poll ALL running tasks?
2. Did I write results to files for completed tasks?
3. Did I update queue.json with new statuses?
4. Did I update status.json?

**Before continuing loop:**
1. Are there still tasks that aren't complete/failed?
2. Did I check if new tasks became ready (deps completed)?

---

## Initialization

**On first invocation:**

1. Check if `.claude/orchestrator/results/` exists
2. If not, create it: `mkdir -p .claude/orchestrator/results`
3. Read `.claude/orchestrator-queue.json`
4. If queue has tasks, start the main loop
5. If queue is empty, report "Queue empty, waiting for tasks"

---

## Available Agents

**Read from `src/agents.yaml` for current list. Common agents for queue tasks:**

| Agent | Purpose | Typical Task Type |
|-------|---------|-------------------|
| `Explore` | Codebase exploration and research | research |
| `frontend-researcher` | Frontend pattern research | research |
| `backend-researcher` | Backend pattern research | research |
| `pm` | Creates detailed specs | research/implement |
| `frontend-developer` | React implementation | implement |
| `backend-developer` | API/server implementation | implement |
| `tester` | Test writing | test |
| `frontend-reviewer` | React code review | review |
| `backend-reviewer` | Server code review | review |

**Always verify agent availability by reading agents.yaml.**
