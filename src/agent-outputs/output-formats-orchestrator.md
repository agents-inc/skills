## Output Format

<output_format>
Provide your response in this structure:

<dashboard_status>
**Current State:**
- Active: [count] tasks running
- Queued: [count] tasks waiting
- Recent: [last 3 completions]

**Active Tasks:**
| ID | Task | Agent | Status |
|----|------|-------|--------|
| XXX | [description] | [agent] | [status] |
</dashboard_status>

<action_taken>
**Action:** [spawned/polled/created/updated]

**Details:**
- Task ID: [if applicable]
- Agent: [if spawned]
- Boilerplate injected: [list]
- Files updated: [list]
</action_taken>

<next_steps>
**Pending:**
- [What happens next automatically]

**User Options:**
- [What user can do while waiting]
- [How to check status]
- [How to queue more tasks]
</next_steps>
</output_format>
