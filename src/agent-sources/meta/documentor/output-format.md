# Output Format: Documentor

**Purpose:** Structured output format for AI-focused documentation creation

---

## Session Start Response

```xml
<documentation_session>
**Mode:** [new | validate | update]
**Target Area:** [what you're documenting this session]
**Progress:** [X of Y areas documented]

<map_status>
**Documentation Map:** `.claude/docs/DOCUMENTATION_MAP.md`
**Last Updated:** [date or "not exists"]

**Documented Areas:**
- [Area 1] - [status: complete | partial | needs-validation]
- [Area 2] - [status]

**Undocumented Areas:**
- [Area 1]
- [Area 2]

**Next Priority:** [what should be documented next]
</map_status>
</documentation_session>
```

---

## Documentation Creation Response

```xml
<documentation_created>
**Area:** [what was documented]
**File:** [path to doc file created/updated]
**Type:** [store-map | anti-patterns | module-map | component-patterns | user-flows | component-relationships]

<investigation_summary>
**Files Examined:** [count]
**Patterns Found:** [count]
**Anti-Patterns Found:** [count]
**Relationships Mapped:** [count]
</investigation_summary>

<documentation_content>
[Show key sections of what was documented]
</documentation_content>

<map_update>
**Updated:** `.claude/docs/DOCUMENTATION_MAP.md`
**Status:** [area] marked as [complete | partial]
**Next:** [suggestion for next documentation task]
</map_update>

<validation>
**Accuracy Check:**
- [ ] All file paths verified to exist
- [ ] All patterns confirmed in actual code
- [ ] All relationships validated
- [ ] Examples are concrete (not abstract)

**Completeness:**
- [ ] All major files in area covered
- [ ] Edge cases documented
- [ ] Anti-patterns noted
- [ ] Related areas cross-referenced
</validation>
</documentation_created>
```

---

## Validation Response

```xml
<validation_report>
**Documentation File:** [path]
**Last Updated:** [date from file]
**Current Date:** [today]

<findings>
| Section | Status | Issue | Action Needed |
|---------|--------|-------|---------------|
| Store Map | ✅ Valid | None | None |
| Actions List | ⚠️ Drift | New action `resetState()` not documented | Add to docs |
| File Paths | ❌ Invalid | `EditorStore.ts` moved to `stores/` | Update path |
</findings>

<drift_summary>
**Valid:** [count] sections
**Drifted:** [count] sections (documented but code changed)
**Invalid:** [count] sections (documented but no longer exists)
**Missing:** [count] new patterns not yet documented
</drift_summary>

<updates_applied>
- Updated [section] in [file]
- Added [new pattern] to [file]
- Removed [obsolete section] from [file]
</updates_applied>

<map_update>
**Status:** [area] validation complete
**Next Validation:** [suggestion for what to validate next]
</map_update>
</validation_report>
```

---

## Session End Summary

```xml
<session_summary>
**Work Completed:**
- [Action 1: e.g., "Documented EditorStore in store-map.md"]
- [Action 2: e.g., "Validated component-patterns.md"]
- [Action 3: e.g., "Updated DOCUMENTATION_MAP.md"]

**Files Created/Modified:**
- [file path 1]
- [file path 2]

**Documentation Coverage:**
- Before: [X]% of codebase documented
- After: [Y]% of codebase documented
- Progress: +[Z]%

**Recommended Next Session:**
[What should be documented or validated next, and why]

**Notes for Future Sessions:**
[Any observations, patterns noticed, or things to investigate further]
</session_summary>
```

---

## Error/Issue Response

```xml
<documentation_issue>
**Problem:** [brief description]
**Impact:** [what can't be documented or validated]

<details>
**Attempted:** [what you tried to do]
**Blocker:** [what prevented it]
**Examples:** [specific cases]
</details>

<recommendation>
**Option 1:** [possible solution]
**Option 2:** [alternative approach]
**Preferred:** [which and why]
</recommendation>
</documentation_issue>
```

---

## Key Principles

**Be Explicit:**

- Always include absolute file paths
- Use concrete examples from actual code
- Avoid abstract descriptions

**Be Structured:**

- Use tables for easy AI parsing
- Group related information
- Cross-reference related docs

**Be Validated:**

- Every claim must be verifiable
- Every file path must exist
- Every pattern must have examples

**Be Progressive:**

- Track what's done vs not done
- Build documentation incrementally
- Update the map after every session
