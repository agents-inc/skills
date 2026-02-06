## Output Format

<output_format>
Provide your skill definition in this structure:

<skill_definition>

## Skill: {domain}-{subcategory}-{technology}

### Directory Location

`.claude/skills/{domain}-{subcategory}-{technology}/`

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

## Table of Contents

<!-- Include for documents > 100 lines -->

- [When to Use This Skill](#when-to-use-this-skill)
- [Core Patterns](#core-patterns)
- [Anti-Patterns](#anti-patterns)

## When to Use This Skill

[Clear criteria for when this skill applies]

## Core Patterns

### Pattern 1: [Name]

[Description and rationale]

```typescript
// Example code
```

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
```

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
</skill_relationships>

<validation>
## Skill Quality Checks

- [ ] Skill directory follows 3-part naming: `{domain}-{subcategory}-{technology}`
- [ ] SKILL.md exists with complete structure
- [ ] metadata.yaml exists with required fields
- [ ] All code examples are syntactically correct
- [ ] Examples follow the patterns described (no contradictions)
- [ ] Usage guidance is specific (not vague "use when needed")
- [ ] SKILL.md has TOC if > 100 lines
- [ ] No overlap with existing skills (checked against: [list])
- [ ] Tags are lowercase kebab-case
      </validation>
      </output_format>

---

## Create Mode Output

**Phase 1: Research Summary**

<research_summary>
**Technology:** [Name and version]
**Use Case:** [Primary problem it solves]
**Sources Consulted:**

- [Official docs URL]
- [Industry blog URL]
- [Code example repo URL]

**Key Findings:**

- [Finding 1]
- [Finding 2]
  </research_summary>

**Phase 2: Comparison (if standards provided)**

<comparison_analysis>
**Alignment Points:**

- [Pattern where they match]

**Differences:**

- **[Pattern Name]**
  - External: [Approach]
  - Codebase: [Approach]
  - Recommendation: [Which to adopt]

**User Decision Required:** [What needs approval]
</comparison_analysis>

**Phase 3: Generated Skill**

<skill_output>
**Skill Created:**

- `.claude/skills/{domain}-{subcategory}-{technology}/`

**Files:**

- SKILL.md
- metadata.yaml
- [optional files]

**Usage:**
Agents will auto-detect this skill with keywords: [list]
</skill_output>

---

## Improve Mode Output

<improvement_analysis>
**Skill:** [Technology name]
**Location:** `.claude/skills/{domain}-{subcategory}-{technology}/`
**Current State:** [Brief assessment]
</improvement_analysis>

<difference_analysis>
**Differences Found:** [N]

### Auto-Merge Changes

[Bug fixes, typos, dead links]

### User Decision Required

**Difference 1: [Pattern Name]**

- **Current:** [What skill says]
- **Research:** [What modern practice says]
- **Option A:** Keep current - [pros/cons]
- **Option B:** Adopt research - [pros/cons]
- **Recommendation:** [Your choice with rationale]
  </difference_analysis>

<summary>
**Total Changes:**
- Auto-merge: [N] changes
- User decisions: [N] differences
- Additions: [N] new patterns

**Next Steps:**

1. [User reviews differences]
2. [Apply approved updates]
3. [Validate final skill]
</summary>
