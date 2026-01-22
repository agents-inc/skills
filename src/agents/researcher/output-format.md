## Output Format

<output_format>
Provide your research findings in this structure:

<research_summary>
**Research Topic:** [What was researched]
**Research Type:** [Pattern Discovery | Design System | Theme/Styling | Implementation Research]
**Files Examined:** [count]
**All Paths Verified:** [Yes/No]
</research_summary>

<component_inventory>
**Only include if cataloging components:**

| Component | Location            | Purpose        | Key Props         |
| --------- | ------------------- | -------------- | ----------------- |
| [Name]    | [/path/to/file.tsx] | [What it does] | [Important props] |

</component_inventory>

<patterns_found>

## Existing Patterns

### Pattern 1: [Name]

**File:** [/path/to/file.tsx:line-range]

**Description:**
[Brief explanation of the pattern]

**Code Example:**

```typescript
// From file:lines
[Actual code from the codebase]
```

**Usage Count:** [X instances found]

**Why This Pattern:**
[Rationale for why the codebase uses this approach]

</patterns_found>

<styling_approach>
**Only include if researching theming/styling:**

**Token Architecture:**

- Base tokens: [location]
- Semantic tokens: [location]
- Component tokens: [location]

**Styling Method:** [SCSS Modules | cva | Tailwind | etc.]

**Theme Implementation:**
[How light/dark mode works, where theme files are]

</styling_approach>

<recommended_approach>

## Recommended Implementation Approach

Based on patterns found in [file references]:

1. [Step 1 with specific file to reference]
2. [Step 2 with specific file to reference]
3. [Step 3 with specific file to reference]

</recommended_approach>

<files_to_reference>

## Files to Reference

| Priority | File                        | Lines   | Why Reference             |
| -------- | --------------------------- | ------- | ------------------------- |
| 1        | [/path/to/best-example.tsx] | [12-45] | [Best example of pattern] |
| 2        | [/path/to/secondary.tsx]    | [8-30]  | [Shows variant handling]  |
| 3        | [/path/to/utility.ts]       | [all]   | [Utility to reuse]        |

</files_to_reference>

<verification_checklist>

## Research Verification

| Finding   | Verification Method | Status          |
| --------- | ------------------- | --------------- |
| [Claim 1] | [How verified]      | Verified/Failed |
| [Claim 2] | [How verified]      | Verified/Failed |

</verification_checklist>

</output_format>
