# Skill Example File Extraction Criteria

> Guidelines for splitting large `examples.md` files into core + extracted modules.

---

## Overview

This document establishes criteria for extracting patterns from skill example files (examples.md) into smaller, focused modules. The goal is to:

1. Keep core patterns (200-400 lines) in the main `examples.md`
2. Extract advanced/optional patterns to separate files loaded on-demand
3. Maintain consistency across all 52+ skill files

---

## 1. Criteria for Core vs Extractable

### Core Patterns (KEEP in examples.md)

A pattern is **core** if it meets ANY of these criteria:

| Criterion                | Description                                   | Example                                        |
| ------------------------ | --------------------------------------------- | ---------------------------------------------- |
| **First-time setup**     | Required for initial implementation           | Store configuration, client setup, basic hooks |
| **Primary API**          | The main API users interact with 80%+ of time | `useQuery`, `register()`, `createSlice`        |
| **Essential types**      | TypeScript types needed for basic usage       | Generic type parameters, hook return types     |
| **Fundamental good/bad** | The most common mistake to avoid              | Using `index` as key in field arrays           |
| **Minimum viable**       | Simplest complete working example             | Basic form with validation, simple query       |

**Rule of thumb**: If a developer cannot use the library at all without this pattern, it is core.

### Extractable Patterns (MOVE to separate files)

A pattern is **extractable** if it meets ALL of these criteria:

| Criterion          | Description                            | Example                             |
| ------------------ | -------------------------------------- | ----------------------------------- |
| **Optional**       | Not required for basic usage           | Redux Persist, custom middleware    |
| **Advanced**       | Requires understanding of core first   | Entity adapters, optimistic updates |
| **Situational**    | Only needed in specific use cases      | Multi-step forms, offline support   |
| **Self-contained** | Can be understood without core context | Testing patterns, performance tips  |

**Rule of thumb**: If a developer can ship a working feature without this pattern, it is extractable.

---

## 2. Standard Categories for Extracted Files

Use these standardized file names based on pattern type:

### `examples-testing.md`

Testing patterns specific to the skill's features.

**Include**:

- Unit tests for the skill's core concepts
- Integration test patterns
- Mock setup patterns
- Test utility helpers

**Extract when**: File has 100+ lines of testing-specific examples.

### `examples-advanced.md`

Advanced usage patterns beyond basics.

**Include**:

- Performance optimizations
- Complex state patterns
- Edge case handling
- Normalization patterns
- Middleware/interceptors

**Extract when**: File has 150+ lines of advanced patterns.

### `examples-integrations.md`

Integration with other libraries/tools.

**Include**:

- Persistence (localStorage, IndexedDB)
- Third-party library integration
- Framework-specific patterns (Next.js, Remix)
- Cross-tool patterns (RTK + React Query)

**Extract when**: File has 100+ lines of integration patterns.

### `examples-patterns.md`

Design patterns and architectural examples.

**Include**:

- Multi-step/wizard patterns
- Factory patterns
- Composition patterns
- Error boundary integration

**Extract when**: Pattern is a complete architectural solution (150+ lines).

---

## 3. File Structure for Extracted Files

### Header Format

Each extracted file MUST start with:

```markdown
# [Skill Name] - [Category] Examples

> Extended examples for [category]. See [examples.md](examples.md) for core patterns.

**Prerequisites**: Understand [Pattern 1], [Pattern 2] from core examples first.

---
```

### Pattern Format

Maintain the same format as core examples:

```markdown
## Pattern N: [Title]

### Good Example - [Descriptor]

\`\`\`typescript
// Code with comments
\`\`\`

**Why good:** [Explanation]

### Bad Example - [Anti-pattern]

\`\`\`typescript
// BAD code with comments
\`\`\`

**Why bad:** [Explanation]

---
```

### Cross-References

Add cross-references to core patterns:

```markdown
> **Note:** This pattern builds on [Pattern 2: Basic Setup](examples.md#pattern-2-basic-setup).
```

---

## 4. Size Guidelines

### Target Line Counts

| File                       | Target Lines | Maximum Lines |
| -------------------------- | ------------ | ------------- |
| `examples.md` (core)       | 200-400      | 500           |
| `examples-testing.md`      | 100-250      | 300           |
| `examples-advanced.md`     | 150-300      | 400           |
| `examples-integrations.md` | 100-200      | 300           |
| `examples-patterns.md`     | 100-250      | 350           |

### Extraction Triggers

Extract patterns when `examples.md` exceeds:

- **600 lines**: Extract 1 category
- **800 lines**: Extract 2 categories
- **1000+ lines**: Extract 3+ categories

### Maximum Files Per Skill

- **Maximum**: 4 extracted files (core + 3 extracted)
- **Typical**: 2-3 total files (core + 1-2 extracted)
- **Minimum viable**: Just `examples.md` if under 500 lines

---

## 5. Decision Framework

Use this flowchart to decide where a pattern belongs:

```
Is this pattern required to use the library at all?
├─ YES → Keep in examples.md (core)
└─ NO → Is it about testing this skill's features?
    ├─ YES → examples-testing.md
    └─ NO → Is it integration with another tool?
        ├─ YES → examples-integrations.md
        └─ NO → Is it an advanced/optimization pattern?
            ├─ YES → examples-advanced.md
            └─ NO → Is it a complete architectural pattern?
                ├─ YES → examples-patterns.md
                └─ NO → Keep in examples.md (probably core)
```

---

## 6. Example: Well-Split Skill

### Redux Toolkit (Before: 1,065 lines, 10 patterns)

**After extraction:**

#### `examples.md` (~350 lines, 4 patterns)

- Pattern 1: Store Configuration (core setup)
- Pattern 2: Slice Creation with createSlice (primary API)
- Pattern 3: Typed Hooks for Components (essential types)
- Pattern 4: RTK Query for Data Fetching (common use case)

#### `examples-advanced.md` (~300 lines, 4 patterns)

- Pattern 5: Entity Adapters for Normalized State
- Pattern 6: Async Thunks with createAsyncThunk
- Pattern 7: Selectors and Memoization
- Pattern 8: Middleware Patterns

#### `examples-testing.md` (~150 lines, 1 pattern)

- Pattern 9: Testing Redux Logic

#### `examples-integrations.md` (~100 lines, 1 pattern)

- Pattern 10: Redux Persist Integration

---

### React Testing Library (Before: 1,149 lines, 8 sections)

**After extraction:**

#### `examples.md` (~400 lines, 4 sections)

- Query Hierarchy Examples (fundamental)
- userEvent Examples (primary API)
- Async Utilities Examples (essential for any async component)
- Custom Render Examples (needed for most projects)

#### `examples-advanced.md` (~350 lines, 3 sections)

- renderHook Examples (hook testing)
- Debug Utilities Examples (troubleshooting)
- Snapshot Testing Considerations (advanced topic)

#### `examples-patterns.md` (~200 lines, 1 section)

- Accessibility Testing Examples (complete a11y testing pattern)

---

### React Hook Form (Before: 955 lines, 6 sections)

**After extraction:**

#### `examples.md` (~350 lines, 3 sections)

- Basic Form Examples (core setup and validation)
- Controller Examples (controlled components)
- Resolver Pattern Examples (Zod integration - common)

#### `examples-advanced.md` (~300 lines, 2 sections)

- useFieldArray Examples (dynamic forms)
- Performance Optimization Examples (large forms)

#### `examples-patterns.md` (~200 lines, 1 section)

- Multi-Step Form Example (complete wizard pattern)

---

## 7. Naming Conventions

### File Names

Always use kebab-case with `examples-` prefix:

```
examples.md                 # Core (always present)
examples-testing.md         # Testing patterns
examples-advanced.md        # Advanced patterns
examples-integrations.md    # Integration patterns
examples-patterns.md        # Architectural patterns
```

### Pattern Numbering

- Core patterns: Continue sequential numbering (Pattern 1, 2, 3...)
- Extracted patterns: Restart numbering per file OR continue from core

**Recommended**: Continue numbering to maintain reference stability.

```markdown
# examples.md

## Pattern 1: Store Configuration

## Pattern 2: Slice Creation

## Pattern 3: Typed Hooks

## Pattern 4: RTK Query

# examples-advanced.md

## Pattern 5: Entity Adapters

## Pattern 6: Async Thunks
```

---

## 8. Migration Checklist

When extracting patterns from an existing `examples.md`:

- [ ] Identify total line count and pattern count
- [ ] Categorize each pattern using Section 1 criteria
- [ ] Group extractable patterns by category (Section 2)
- [ ] Verify core patterns remain under 500 lines
- [ ] Add cross-references between files
- [ ] Update SKILL.md to reference new files
- [ ] Verify all code examples still have context
- [ ] Test that examples can be understood standalone

---

## 9. Files NOT Requiring Extraction

Do not extract if:

- File is under 500 lines (leave as single `examples.md`)
- File has fewer than 5 patterns total
- All patterns are interdependent (can't understand one without others)
- Skill is setup/configuration focused (naturally smaller)

**Examples of skills to leave as-is:**

- `setup/env` (415 lines)
- `frontend/mocks/msw` (448 lines)
- `frontend/client-state-management/zustand` (511 lines)
- `research/research-methodology` (257 lines)

---

## 10. Priority Order for Extraction

When multiple skills need extraction, prioritize by:

1. **Line count** - Largest files first (1000+ lines)
2. **Usage frequency** - Commonly used skills
3. **Clear boundaries** - Files with obvious category splits

**High priority targets (1000+ lines):**

1. `frontend/ui/tanstack-table` (1,268 lines)
2. `frontend/data-fetching/graphql-apollo` (1,253 lines)
3. `frontend/styling/scss-modules` (1,196 lines)
4. `frontend/testing/react-testing-library` (1,149 lines)
5. `frontend/client-state-management/redux-toolkit` (1,065 lines)
6. `frontend/framework/remix` (1,017 lines)
7. `frontend/ui/shadcn-ui` (1,018 lines)

---

_Last updated: 2026-01-15_
