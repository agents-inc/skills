# Template Architecture Findings (Agent #6)

**Analysis Date:** 2026-01-08
**Files Analyzed:**

- `src/templates/agent.liquid` (95 lines)
- `src/compile.ts` (579 lines)
- `src/types.ts` (155 lines)
- Compiled outputs in `.claude/agents/`

---

## Overall Assessment

The template architecture is **functional but needs refinement**. The current design prioritizes simplicity over flexibility.

**Template Size:** 95 lines (manageable)
**Complexity:** Low-Medium
**Maintainability Score:** 7/10

---

## Strengths

### S1. Clean Separation of Concerns

- Template handles structure/layout only
- TypeScript handles file reading, validation, and data preparation
- This hybrid approach is well-designed

### S2. Appropriate Liquid Feature Usage

```liquid
{{ agent.tools | join: ", " }}  <!-- Good use of join filter -->
{% for skill in skills.precompiled %}  <!-- Appropriate iteration -->
{% if criticalRequirementsTop != "" %}  <!-- Conditional content -->
```

### S3. Semantic XML Tag Wrapping

- Template correctly wraps content in semantic tags (`<role>`, `<critical_requirements>`, etc.)
- This follows the PROMPT_BIBLE XML tag strategy

### S4. Template Variables Are Well-Typed

- `CompiledAgentData` interface in `types.ts` clearly documents all template variables
- Type safety prevents runtime template errors

---

## Issues Identified

### ISSUE-T1: Excessive Whitespace in Output (HIGH PRIORITY)

**Problem:** Compiled agents have inconsistent whitespace with extra blank lines.

**Evidence from `orchestrator.md` lines 48-72:**

```markdown
**Core Prompts (loaded at beginning):**

- Core Principles

- Investigation Requirement <-- Extra blank line between items
```

**Root Cause in `agent.liquid`:**

```liquid
{% for prompt in corePromptNames %}
- {{ prompt }}
{% endfor %}
```

The `{% for %}` tag preserves the newline after the closing `%}`, causing double-spacing.

**Fix - Use Liquid whitespace control:**

```liquid
{%- for prompt in corePromptNames -%}
- {{ prompt }}
{% endfor -%}
```

---

### ISSUE-T2: No Partials/Includes Used (MEDIUM PRIORITY)

**Problem:** The template is monolithic despite having reusable patterns.

**Candidates for extraction:**

| Partial                     | Reuse Potential                      |
| --------------------------- | ------------------------------------ |
| `_preloaded_content.liquid` | Could be shared with skill templates |
| `_skill_block.liquid`       | Used once but complex                |
| `_divider.liquid`           | Appears 10+ times as `---`           |

**Benefit:** If you later need different agent types (e.g., `researcher.liquid`, `reviewer.liquid`), partials allow shared components.

**Implementation:**

```liquid
<!-- agent.liquid -->
{% render '_preloaded_content', skills: skills, prompts: corePromptNames %}

<!-- _preloaded_content.liquid -->
<preloaded_content>
...
</preloaded_content>
```

---

### ISSUE-T3: Empty Content Not Gracefully Handled (MEDIUM PRIORITY)

**Problem:** Some sections render awkwardly when empty.

**Evidence - Empty skills list renders as:**

```markdown
**Pre-compiled Skills (already loaded below):**

**Dynamic Skills (invoke when needed):**
```

**Fix - Add conditional wrapper:**

```liquid
{% if skills.precompiled.size > 0 %}
**Pre-compiled Skills (already loaded below):**
{% for skill in skills.precompiled %}
- {{ skill.name }}
{% endfor %}
{% else %}
_No pre-compiled skills for this agent._
{% endif %}
```

---

### ISSUE-T4: Hardcoded Instructional Text (LOW PRIORITY)

**Problem:** User-facing text is embedded directly in template.

**Example:**

```liquid
**IMPORTANT: The following content is already in your context. DO NOT read these files from the filesystem:**
```

**Impact:** Cannot customize or translate without modifying template.

**Fix - Use variables:**

```typescript
// compile.ts
const data = {
  ...existingData,
  strings: {
    preloadedContentHeader: 'IMPORTANT: The following content is already in your context...',
  },
}
```

---

### ISSUE-T5: Inconsistent Section Dividers (LOW PRIORITY)

**Problem:** The `---` divider after `critical_requirements` is inside the `{% if %}` block, so when content is empty, no divider appears. Inconsistent spacing behavior.

**Fix - Consistent pattern:**

```liquid
---
{% if criticalRequirementsTop != "" %}
<critical_requirements>
{{ criticalRequirementsTop }}
</critical_requirements>
{% endif %}
---
```

---

### ISSUE-T6: Missing Liquid Filters (LOW PRIORITY)

**Unused filters that could improve the template:**

| Filter     | Use Case                                       |
| ---------- | ---------------------------------------------- |
| `strip`    | Remove leading/trailing whitespace             |
| `truncate` | Limit long descriptions                        |
| `default`  | Provide fallback for empty values              |
| `escape`   | Ensure special characters don't break markdown |

**Example improvement:**

```liquid
{{ skill.description | default: "No description" | truncate: 100 }}
```

---

## Section Ordering Analysis

Current ordering follows PROMPT_BIBLE "documents first, query last" principle:

| Position | Section                                                   | Placement Rationale        |
| -------- | --------------------------------------------------------- | -------------------------- |
| 1-2      | Frontmatter + Title                                       | Required at top            |
| 3-4      | `<role>` + `<preloaded_content>`                          | Early for context          |
| 5        | `<critical_requirements>`                                 | Prime attention position   |
| 6-7      | Core prompts + Workflow                                   | Foundation + main content  |
| 8-10     | Skills + Examples + Output format                         | Reference material         |
| 11-13    | Ending prompts + `<critical_reminders>` + Final reminders | Emphatic repetition at end |

**Assessment:** Ordering is correct per research. No changes recommended.

---

## Variable Naming Analysis

| Variable                  | Type            | Clarity | Issue              |
| ------------------------- | --------------- | ------- | ------------------ |
| `agent`                   | AgentConfig     | Good    | -                  |
| `intro`                   | string          | Good    | -                  |
| `workflow`                | string          | Good    | -                  |
| `examples`                | string          | Good    | -                  |
| `criticalRequirementsTop` | string          | OK      | `Top` is redundant |
| `criticalReminders`       | string          | Good    | -                  |
| `corePromptNames`         | string[]        | Good    | -                  |
| `corePromptsContent`      | string          | Good    | -                  |
| `skills`                  | SkillAssignment | Good    | -                  |
| `outputFormat`            | string          | Good    | -                  |

**Minor inconsistency:** `criticalRequirementsTop` vs `criticalReminders` - one has position suffix, other doesn't. Consider renaming for consistency.

---

## Recommended Improvements

### Priority 1 (Should Fix)

1. Fix whitespace issues with Liquid whitespace control tags (`{%-` and `-%}`)
2. Add empty content handling for skill arrays

### Priority 2 (Nice to Have)

3. Extract `_preloaded_content.liquid` partial
4. Add `default` filters for optional content

### Priority 3 (Future Consideration)

5. Extract instructional text to configurable strings
6. Create a `_skill_block.liquid` partial for consistency

---

## Template Optimization Metrics

| Metric            | Current               | After Fixes     |
| ----------------- | --------------------- | --------------- |
| Lines of code     | 95                    | ~85             |
| Partials          | 0                     | 2-3 recommended |
| Conditionals      | 1                     | 3-4             |
| Filters used      | 2 (`join`, `replace`) | 5+              |
| Whitespace issues | 4+ locations          | 0               |

---

## Recommended Template Improvement

**Current template snippet (preloaded_content section):**

```liquid
<preloaded_content>
**IMPORTANT: The following content is already in your context. DO NOT read these files from the filesystem:**

**Core Prompts (loaded at beginning):**
{% for prompt in corePromptNames %}
- {{ prompt }}
{% endfor %}

**Pre-compiled Skills (already loaded below):**
{% for skill in skills.precompiled %}
- {{ skill.name }}
{% endfor %}

**Dynamic Skills (invoke when needed):**
{% for skill in skills.dynamic %}
- Use `skill: "{{ skill.id | replace: "/", "-" }}"` for {{ skill.description }}
  Usage: {{ skill.usage }}
{% endfor %}
</preloaded_content>
```

**Improved version:**

```liquid
<preloaded_content>
**IMPORTANT: The following content is already in your context. DO NOT read these files from the filesystem:**

**Core Prompts (loaded at beginning):**
{%- for prompt in corePromptNames %}
- {{ prompt }}
{%- endfor %}

{%- if skills.precompiled.size > 0 %}
**Pre-compiled Skills (already loaded below):**
{%- for skill in skills.precompiled %}
- {{ skill.name }}
{%- endfor %}
{%- endif %}

{%- if skills.dynamic.size > 0 %}
**Dynamic Skills (invoke when needed):**
{%- for skill in skills.dynamic %}
- Use `skill: "{{ skill.id | replace: "/", "-" }}"` for {{ skill.description | default: "No description" }}
  Usage: {{ skill.usage }}
{%- endfor %}
{%- else %}
_No dynamic skills configured._
{%- endif %}
</preloaded_content>
```

---

## Summary

The template architecture is **solid but needs refinement**. The most impactful improvements are:

1. **Whitespace control** - Immediate quality improvement for compiled output
2. **Empty content handling** - Prevents awkward empty sections
3. **Partials** - Future-proofs for multiple agent types

The TypeScript compiler does most of the heavy lifting correctly. The template's job is presentation, and it does this adequately but could be more polished.
