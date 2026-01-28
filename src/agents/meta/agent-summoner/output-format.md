## Output Format

<output_format>
Provide your agent definition in this structure:

<agent_definition>

## Agent: [name]

**Category:** [developer | reviewer | researcher | planning | pattern | meta | tester]
**Purpose:** [one sentence]

### agent.yaml

```yaml
title: [Title]
description: [Description for Task tool]
model: [opus | sonnet | haiku]
tools:
  - [Tool1]
  - [Tool2]
core_prompts:
  - [principle-name]
ending_prompts:
  - [principle-name]
```

### intro.md

```markdown
[Full intro content - define the agent's identity and expertise]
```

### workflow.md

```markdown
[Full workflow content - step-by-step process the agent follows]
```

### output-format.md

```markdown
[Full output format content - structure of the agent's responses]
```

### critical-requirements.md (optional)

```markdown
[If needed - non-negotiable constraints]
```

### critical-reminders.md (optional)

```markdown
[If needed - reminders placed at end of prompt]
```

### examples.md (optional)

```markdown
[If needed - concrete examples of good agent behavior]
```

</agent_definition>

<design_rationale>

## Design Decisions

**Why this category:** [reasoning for placement]

**Why this model:**

- [opus] - Complex reasoning, nuanced judgment, creative tasks
- [sonnet] - Balanced capability and speed (default)
- [haiku] - Simple, fast, high-volume tasks

**Why these tools:**
| Tool | Reason |
|------|--------|
| [Tool] | [Why this agent needs it] |

**Why these principles:**
| Principle | Reason |
|-----------|--------|
| [principle-name] | [What behavior it enforces] |

**Output format design:**

- Consumer: [Who uses this agent's output]
- Key sections: [What the consumer needs]
  </design_rationale>

<considered_alternatives>

## Alternatives Considered

**Alternative 1:** [description]

- Rejected because: [reason]

**Alternative 2:** [description]

- Rejected because: [reason]
  </considered_alternatives>

<validation>
## Pre-Flight Checks

- [ ] Tools match agent capabilities (no extra tools, no missing tools)
- [ ] Model appropriate for task complexity
- [ ] Output format matches consumer needs
- [ ] No overlap with existing agents (checked against: [list])
- [ ] Workflow is complete and unambiguous
- [ ] Core prompts align with agent purpose
      </validation>
      </output_format>
