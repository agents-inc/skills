## Output Format

<output_format>
Provide your skill definition in this structure:

<skill_definition>

## Skill: [category]/[name] (@[author])

### metadata.yaml

```yaml
# yaml-language-server: $schema=../../schemas/metadata.schema.json
category: [category]
author: [@author]
version: 1
cli_name: [Display Name]
cli_description: [5-6 words max]
usage_guidance: >-
  [When AI agent should invoke this skill - be specific about triggers]
requires: []
compatible_with: []
conflicts_with: []
tags:
  - [tag1]
  - [tag2]
```

### SKILL.md

````markdown
---
name: [Name]
description: [One-line description]
---

# [Name] Patterns

## When to Use This Skill

[Clear criteria for when this skill applies]

## Core Patterns

### Pattern 1: [Name]

[Description and rationale]

```typescript
// Example code
```
````

### Pattern 2: [Name]

[Continue with all patterns...]

## Anti-Patterns

### [Anti-pattern name]

**Problem:**
[What's wrong]

**Instead:**
[What to do]

## Decision Trees

[If applicable - flowcharts for decision-making]

## Quick Reference

[Cheat sheet of key patterns]

````

### reference.md (optional)
```markdown
# [Name] Quick Reference

[Condensed reference for quick lookups]
````

### examples/ (optional)

[List any example files needed]
</skill_definition>

<research_sources>

## Sources Used

| Source              | URL/Location  | What Was Used             |
| ------------------- | ------------- | ------------------------- |
| Official docs       | [url]         | [specific section]        |
| Codebase pattern    | [/path:lines] | [what pattern]            |
| Best practice guide | [url]         | [specific recommendation] |

</research_sources>

<skill_relationships>

## Relationship Analysis

**Requires (hard dependencies):**

- [skill-id] - [why required]

**Compatible with (works well together):**

- [skill-id] - [why compatible]

**Conflicts with (mutually exclusive):**

- [skill-id] - [why conflicts]

**Category:** [category]
**Category exclusive:** [true/false] - [reasoning]
</skill_relationships>

<validation>
## Skill Quality Checks

- [ ] All code examples are syntactically correct
- [ ] Examples follow the patterns described (no contradictions)
- [ ] Usage guidance is specific (not vague "use when needed")
- [ ] Follows existing skill structure in codebase
- [ ] No overlap with existing skills (checked against: [list])
- [ ] Tags are lowercase kebab-case
- [ ] Author handle starts with @
- [ ] cli_description is 5-6 words max
      </validation>
      </output_format>
