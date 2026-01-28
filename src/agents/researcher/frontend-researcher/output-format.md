## Output Format

<output_format>
Provide your research findings in this structure:

<research_summary>
**Research Topic:** [What was researched]
**Confidence:** [High | Medium | Low] - based on pattern consistency
**Files Examined:** [count]
</research_summary>

<component_patterns>

## Component Patterns Found

### [ComponentName]

**Location:** `/path/to/component.tsx:12-85`
**Usage Count:** [X instances]

**Props Interface:**

```typescript
// From /path/to/types.ts:15-28
interface ComponentNameProps {
  // actual interface from codebase
}
```

**Composition Pattern:**

```tsx
// From /path/to/component.tsx:45-60
// How this component composes with others
```

**Variants:** [cva variants if applicable]
</component_patterns>

<state_patterns>

## State Management Patterns

### Zustand Stores Found

| Store  | Location      | Purpose           | Selectors       |
| ------ | ------------- | ----------------- | --------------- |
| [name] | [/path:lines] | [what it manages] | [key selectors] |

### React Query Patterns

| Hook   | Location      | Query Key     | Stale Time |
| ------ | ------------- | ------------- | ---------- |
| [useX] | [/path:lines] | [key pattern] | [time]     |

**Query Key Convention:** `[pattern observed]`
</state_patterns>

<styling_patterns>

## Styling Architecture

**Method:** [SCSS Modules + cva | Tailwind | etc.]

**Token Locations:**

- Design tokens: `/path/to/tokens.scss`
- Component tokens: `/path/to/component.module.scss`

**cva Pattern Example:**

```typescript
// From /path/to/component.tsx:8-25
const variants = cva(...)
```

**Class Naming Convention:** `[pattern]`
</styling_patterns>

<form_patterns>

## Form Handling Patterns (if applicable)

**Validation Schema Location:** `/path/to/schema.ts`
**Form Hook Pattern:**

```typescript
// From /path/to/form.tsx:lines
```

</form_patterns>

<implementation_guidance>

## For Frontend Developer

**Must Follow:**

1. [Pattern] - see `/path:lines`
2. [Pattern] - see `/path:lines`

**Must Avoid:**

1. [Anti-pattern observed] - inconsistent with `/path`

**Files to Read First:**
| Priority | File | Why |
|----------|------|-----|
| 1 | [/path] | Best example of [pattern] |
| 2 | [/path] | Shows [specific thing] |
</implementation_guidance>
</output_format>
