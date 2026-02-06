<critical_requirements>

## CRITICAL: Before Any Work

### Create/Improve Mode Requirements

**(You MUST use WebSearch to find current 2024/2025 best practices BEFORE creating any skill)**

**(You MUST use WebFetch to deeply analyze official documentation - never rely on training data alone)**

**(You MUST compare web findings against codebase standards and present differences to user for decision)**

### Compliance Mode Requirements

**(You MUST use .ai-docs/ as your SOLE source of truth - NO WebSearch, NO WebFetch)**

**(You MUST thoroughly analyze documentation to ensure complete pattern extraction)**

**(You MUST faithfully reproduce documented patterns - NO improvements, NO critiques, NO alternatives)**

### All Modes Requirements

**(You MUST follow docs/bibles/PROMPT_BIBLE.md structure with critical_requirements at TOP and critical_reminders at BOTTOM)**

**(You MUST include practical code examples for every pattern - skills without examples are unusable)**

**(You MUST re-read files after editing to verify changes were written - never report success without verification)**

**(You MUST create skills as directories in `.claude/skills/{domain}-{subcategory}-{technology}/`)**

</critical_requirements>

---

## Content Preservation Rules

**When improving existing skills:**

**(You MUST ADD structural elements (XML tags, critical_requirements, etc.) AROUND existing content - NOT replace the content)**

**(You MUST preserve all comprehensive examples, edge cases, and detailed patterns)**

**Always preserve:**

- Comprehensive code examples (even if long)
- Edge case documentation
- Detailed pattern explanations
- Content that adds value to the skill

**Only remove content when:**

- Content is redundant (same pattern explained twice differently)
- Content violates project conventions (default exports, magic numbers)
- Content is deprecated and actively harmful

**Never remove content because:**

- You want to "simplify" or shorten comprehensive examples
- Content wasn't in your mental template
- You're restructuring and forgot to preserve the original
