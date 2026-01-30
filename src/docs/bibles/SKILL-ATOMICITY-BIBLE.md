# The Skill Atomicity Bible

> **The Core Principle**: A skill should ONLY discuss its own domain.

A React skill shouldn't mention SCSS, Zustand, or MSW. A styling skill shouldn't mention lucide-react. This creates portable, composable, stack-agnostic skills that can be mixed and matched freely.

---

## Why Atomicity Matters

**Portability**: A React skill that doesn't mention SCSS works for teams using Tailwind, CSS-in-JS, or plain CSS.

**Composability**: Skills can be combined freely without conflicts or redundancy.

**Maintenance**: Updating one skill doesn't require updating others.

**Clarity**: Each skill teaches ONE thing well, without cross-domain noise.

**Flexibility**: Stacks can evolve tool-by-tool without rewriting skills.

---

## Table of Contents

1. [The Core Principle](#1-the-core-principle)
2. [Violation Categories](#2-violation-categories)
3. [Transformation Framework](#3-transformation-framework)
4. [Keywords to Watch](#4-keywords-to-watch)
5. [Content Relocation Protocol](#5-content-relocation-protocol)
6. [Quality Gate Checklist](#6-quality-gate-checklist)
7. [Complexity Tiers](#7-complexity-tiers)
8. [Examples: Before vs After](#8-examples-before-vs-after)
9. [Pitfalls to Avoid](#9-pitfalls-to-avoid)
10. [Troubleshooting Common Issues](#10-troubleshooting-common-issues)
11. [Verification Commands](#11-verification-commands)

---

## 1. The Core Principle

**A skill should ONLY discuss its own domain.**

This is the single most important rule for skill atomicity. Every other guideline derives from this principle.

### What This Means

| Domain               | Should Discuss                                   | Should NOT Discuss                        |
| -------------------- | ------------------------------------------------ | ----------------------------------------- |
| **React**            | Components, hooks, props, lifecycle, composition | SCSS, Zustand, React Query, MSW           |
| **Styling**          | CSS patterns, design tokens, selectors, layout   | lucide-react, React Query, form libraries |
| **State Management** | Store patterns, selectors, subscriptions         | Styling approaches, API libraries         |
| **Testing**          | Test structure, assertions, coverage             | Specific mock libraries, styling          |
| **Data Fetching**    | Caching, mutations, optimistic updates           | State management tools, styling           |

### Why This Matters

1. **Portability**: A React skill that doesn't mention SCSS works for teams using Tailwind, CSS-in-JS, or plain CSS
2. **Composability**: Skills can be mixed freely without conflicts
3. **Maintenance**: Updating one skill doesn't require updating others
4. **Clarity**: Each skill teaches ONE thing well
5. **Flexibility**: Stacks can evolve tool-by-tool without rewriting skills

### The Exception: Bridge Patterns

When a skill defines its own bridge/adapter utility (like MobxQuery that bridges MobX and React Query), implementation-specific imports CAN be preserved because they teach "how to bridge" not "what tool to use."

```typescript
// ALLOWED in MobX skill - defines the bridge pattern itself
import { MobxQuery } from "./mobx-query";

// NOT ALLOWED in MobX skill - prescribes external tool
import { useQuery } from "@tanstack/react-query"; // VIOLATION
```

---

## 2. Violation Categories

### Category 1: Import Coupling (HIGH Severity)

Examples that import from other domains.

```typescript
// VIOLATION - React skill importing styling
import styles from "./button.module.scss";
import { cva } from "class-variance-authority";

// VIOLATION - Testing skill importing specific mock library
import { server } from "msw/node";
import { rest } from "msw";

// FIXED - Generic comment
// Apply your styling solution via className prop
// Use your mocking solution's server setup
```

**Why High Severity:** Creates hard dependency on external tool. Skill becomes unusable without that specific tool.

---

### Category 2: Explicit Tool Recommendations (HIGH Severity)

"Use X for this" where X is another skill's tool.

```markdown
// VIOLATION
"Use React Query for server data"
"Use Zustand for global client state"
"Use MSW for API mocking"

// FIXED
"Use your data fetching solution"
"Use your client state management approach"
"Use your API mocking solution"
(or remove entirely - let the relevant skill handle it)
```

**Why High Severity:** Prescribes specific tools, defeating the purpose of separate skills.

---

### Category 3: Integration Guides (HIGH Severity)

Sections that list specific tools from other skills.

```markdown
// VIOLATION
**Works with:**

- SCSS Modules: All components use SCSS Modules
- React Query: State management for server data
- Zustand: Global client state management
- MSW: API mocking in tests

// FIXED
**Integrates with your chosen solutions:**
Components are styling-agnostic. Apply styles via className prop.
State management decisions are separate from component architecture.
Testing approaches integrate through standard patterns.
```

**Why High Severity:** Creates expectation of specific stack, reduces portability.

---

### Category 4: Decision Tree Exits (MEDIUM Severity)

Decision trees that exit to another domain's tool.

```markdown
// VIOLATION
Is it server data?
├─ YES → Use React Query
└─ NO → Is it global state?
├─ YES → Use Zustand
└─ NO → useState

// FIXED
Is it server data?
├─ YES → Use your data fetching solution (not this skill's scope)
└─ NO → Is it global state?
├─ YES → Use your state management solution
└─ NO → useState (this skill's scope)
```

**Why Medium Severity:** Less direct than imports, but still prescribes tools.

---

### Category 5: Pattern Titles with External Tools (MEDIUM Severity)

Pattern names that include other domain's libraries.

```markdown
// VIOLATION
Pattern 11: Icon Styling with lucide-react
Pattern 3: Integration Testing with MSW
Pattern 7: State Hydration with React Query

// FIXED
Pattern 11: Icon Styling
Pattern 3: Integration Testing with Network-Level Mocking
Pattern 7: State Hydration
```

**Why Medium Severity:** Suggests requirement for specific tool in the title itself.

---

### Category 6: Library Reference Sections (LOW Severity)

Sections that prescribe specific libraries.

```markdown
// VIOLATION

### Library

`lucide-react` (installed in `packages/ui`)

### Dependencies

- React Query v5+
- MSW v2+

// FIXED
(Remove section entirely - let respective skills handle their dependencies)
```

**Why Low Severity:** Informational, but still creates coupling expectation.

---

### Category 7: Codebase-Specific Imports (MEDIUM Severity)

Imports from workspace packages that assume specific structure.

```typescript
// VIOLATION
import { handlers } from "@repo/api-mocks";
import { Button } from "@repo/ui";
import { apiClient } from "@repo/api";

// FIXED
import { handlers } from "./handlers"; // Generic relative import
// Use your component library's Button
// Use your API client
```

**Why Medium Severity:** Assumes specific monorepo structure, not portable.

---

### Category 8: Framework-Specific Names (MEDIUM Severity)

References to specific frameworks where architecture category works.

```markdown
// VIOLATION

## App Integration (Vite/React)

## App Integration (Next.js App Router)

// FIXED

## App Integration (SPA/Client-Side)

## App Integration (SSR Framework)
```

**Why Medium Severity:** Excludes users of other frameworks in same category.

---

## 3. Transformation Framework

### The Decision Tree

For each external domain reference found:

```
1. Is it in a title?
   └─ YES → Genericize the title

2. Is it in a "Library" section?
   └─ YES → Remove the section entirely

3. Is it in an import statement?
   └─ YES → Replace with generic comment or relative import

4. Is it in an example?
   ├─ Is the example still valid without it?
   │   └─ YES → Remove the reference, keep the example
   └─ NO → Rewrite with generic approach

5. Is it in a decision tree?
   ├─ Does tree exit to another domain?
   │   └─ YES → Rewrite to end within own domain
   └─ NO → Keep as-is

6. Is it valuable content that should live elsewhere?
   ├─ YES → Relocate to appropriate skill (see Protocol)
   └─ NO → Remove or genericize

7. Is it a codebase-specific import (@repo/*)?
   └─ YES → Replace with generic relative import pattern

8. Is it a framework name (Next.js, Vite)?
   └─ YES → Replace with architecture category (SPA/SSR)
```

### The Four Phases

#### Phase 1: Audit

```bash
# Find all violations
grep -rn "SCSS\|scss-modules\|cva\|zustand\|react-query\|MSW\|msw\|Hono\|Drizzle" "src/skills/path/to/skill/"

# Check specific files
grep -n "import" skill/examples.md           # Import violations
grep -n "Works with\|Integrates" skill/*.md  # Integration guide violations
grep -n "Use.*for" skill/*.md                # Tool recommendation violations
```

#### Phase 2: Categorize

For each violation found:

| Category       | Description                               | Action                          |
| -------------- | ----------------------------------------- | ------------------------------- |
| **Remove**     | Content belongs in another skill entirely | Delete (check relocation first) |
| **Relocate**   | Valuable content for another skill        | Copy to target, then delete     |
| **Genericize** | Can stay with domain-agnostic wording     | Rewrite to be generic           |
| **Keep**       | Already pure to this domain               | No changes needed               |

#### Phase 3: Transform

Apply changes based on categorization:

**For imports:**

```typescript
// Before
import styles from "./button.module.scss";

// After
// Apply your styling solution via className
```

**For tool recommendations:**

```markdown
// Before
"Use React Query for server data"

// After
"Use your data fetching solution" OR (remove entirely)
```

**For Integration Guides:**

```markdown
// Before
**Works with:** SCSS Modules, React Query, Zustand

// After
**Integrates with your chosen solutions:**
Components accept className for styling flexibility.
```

**For icons in examples:**

```typescript
// Before
import { ChevronUp, ChevronDown } from "lucide-react";

// After
<span aria-hidden="true">▲</span>  // Unicode with aria-hidden
<span aria-hidden="true">▼</span>
```

#### Phase 4: Validate

```bash
# 1. Grep verification - should return 0 results
grep -rn "SCSS\|cva\|zustand\|react-query\|MSW" skill/

# 2. Read transformed skill front-to-back
# - Does philosophy still make sense?
# - Are patterns still actionable?
# - Are examples complete enough?
# - Do critical requirements still apply?

# 3. Check pattern numbering
# - No gaps in sequence
# - All cross-references valid
```

---

## 4. Keywords to Watch

When auditing skills, grep for these patterns:

### Styling Domain

```
SCSS, scss, scss-modules, module.scss, module.css
cva, class-variance-authority
clsx (when used with styles.*)
design tokens (when prescribing specific approach)
lucide-react, lucide, ChevronUp, ChevronDown
styles. (CSS module object access)
Tailwind, tailwind (in non-Tailwind skills)
```

### State Management Domain

```
Zustand, zustand, create (zustand)
Redux, redux, useSelector, useDispatch
MobX, mobx, observable, makeAutoObservable
Jotai, jotai, atom
```

### Data Fetching Domain

```
React Query, react-query, @tanstack/react-query, TanStack
useQuery, useMutation (when imported from React Query)
SWR, swr, useSWR
```

### Testing Domain

```
MSW, msw, Mock Service Worker
Vitest, vitest
Jest, jest
Playwright, playwright
@testing-library/react, RTL, render, screen
```

### Form Libraries

```
react-hook-form, useForm
@hookform/resolvers
zod (when used with forms)
Formik, formik
```

### Framework Names

```
Next.js, Vite, Remix, Gatsby
(replace with SPA/SSR/Static categories)
```

### Codebase-Specific

```
@repo/ (workspace package imports)
../../../packages/ (deep relative imports)
```

### General Patterns

```
import.*from.*other-domain
see [X] skill (cross-skill references)
use [Tool] for (explicit recommendations)
```

---

## 5. Content Relocation Protocol

When removing valuable content that belongs in another skill:

### Step 1: Identify Target

- Where does this content logically belong?
- Which skill owns this domain?

### Step 2: Check for Duplicates

- Does target skill already have similar content?
- Would this be redundant?

### Step 3: Copy to Target

- Match target's formatting style
- Add as new pattern or enhance existing
- Ensure examples compile conceptually

### Step 4: Document the Move

- Add entry to transformation log
- Note source file, line numbers, destination

### Step 5: Delete from Source

- Only after copy is verified
- Update any internal references

### Historical Relocations Reference

| Content                       | Source            | Destination              | Rationale                       |
| ----------------------------- | ----------------- | ------------------------ | ------------------------------- |
| cva Alert component variants  | React/examples.md | SCSS Modules/examples.md | cva is a styling utility        |
| Button SCSS with states       | React/examples.md | SCSS Modules/examples.md | Pure SCSS patterns              |
| Hardcoded values anti-pattern | React/examples.md | SCSS Modules/examples.md | Magic numbers = styling concern |
| useDebounce with React Query  | React/examples.md | React Query/examples.md  | Data fetching integration       |

---

## 6. Quality Gate Checklist

**A skill transformation is NOT complete until ALL boxes are checked:**

### Schema Compliance (REQUIRED)

- [ ] `SKILL.md` has frontmatter with `name` and `description`
- [ ] `metadata.yaml` has all required fields (category, author, version, cli_name, cli_description, usage_guidance)
- [ ] Tags use kebab-case only (`^[a-z][a-z0-9-]*$`) - NO camelCase or dots
- [ ] Author uses `@` prefix (`@vince`, not `vince`)
- [ ] Category is from allowed enum (see CLAUDE_ARCHITECTURE_BIBLE.md)
- [ ] Version is an integer (1, 2, 3) - NOT semantic versioning
- [ ] `bun cc:validate` passes with no errors

### Import Purity

- [ ] No imports from other domains in any code example
- [ ] No codebase-specific imports (@repo/\*)
- [ ] All imports are either from own domain or generic patterns

### Language Purity

- [ ] No tool names from other skills anywhere in text
- [ ] No framework names where architecture categories work
- [ ] No "use X for Y" where X is another domain's tool

### Structure Purity

- [ ] Integration Guide removed or made completely generic
- [ ] All decision trees end within this skill's domain
- [ ] All anti-patterns are domain-specific
- [ ] Pattern titles don't include external tool names

### Coherence

- [ ] Examples still compile conceptually
- [ ] Patterns are actionable without other skill knowledge
- [ ] Critical requirements unchanged and enforceable
- [ ] Philosophy section coherent after changes
- [ ] Quick Guide focused on this domain only

### Integrity

- [ ] Pattern numbering consistent (no gaps)
- [ ] Cross-references within skill still valid
- [ ] No orphaned references to removed content
- [ ] Valuable content relocated before deletion

### Verification

- [ ] Grep verification shows 0 violation matches
- [ ] Full read-through confirms no violations missed
- [ ] Transformation documented in log
- [ ] Schema validation passes (`bun cc:validate`)

---

## 7. Complexity Tiers

### Tier 0: None (0 violations)

- Skill is already atomic
- No changes needed
- Example: React Query (@vince) - 0 violations

### Tier 1: Simple (1-9 violations)

- Title/library reference fixes only
- No content relocation needed
- Quick genericization of a few terms
- **Time estimate**: 15-30 minutes
- Examples: SCSS Modules (3), Performance (3), Tailwind (@vince) (1)

### Tier 2: Medium (10-20 violations)

- Some example rewrites required
- Possible content relocation
- Integration Guide updates
- Decision tree adjustments
- **Time estimate**: 1-2 hours
- Examples: Zustand (16), MSW (16), Accessibility (15+)

### Tier 3: Complex (20+ violations)

- Major example rewrites
- Content relocation required
- Pattern replacements
- Significant restructuring
- **Time estimate**: 2-4 hours
- Examples: React (43+), Vitest (33+)

---

## 8. Examples: Before vs After

### Example 1: Import Coupling (React Skill)

**Before (VIOLATION):**

```typescript
// Pattern 1: Component with Variants
import { cva, type VariantProps } from 'class-variance-authority'
import styles from './button.module.scss'
import clsx from 'clsx'

const buttonVariants = cva(styles.button, {
  variants: {
    variant: {
      primary: styles.primary,
      secondary: styles.secondary,
    },
    size: {
      sm: styles.sm,
      md: styles.md,
      lg: styles.lg,
    },
  },
})

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={clsx(buttonVariants({ variant, size }), className)} {...props} />
}
```

**After (ATOMIC):**

```typescript
// Pattern 1: Component with Variants
// Apply your styling solution - components are style-agnostic

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return <button className={className} data-variant={variant} data-size={size} {...props} />
}

// Styling handled externally via className or data-attribute selectors
```

---

### Example 2: Integration Guide (React Skill)

**Before (VIOLATION):**

```markdown
## Integration Guide

**Works with:**

- **SCSS Modules**: All components use SCSS Modules with cva for variants
- **React Query**: Server state management via TanStack Query
- **Zustand**: Client state management for UI state
- **MSW**: API mocking in Vitest tests

**Commands:**

- `bun test` - Run Vitest tests with MSW handlers
- `bun build` - Build with Vite
```

**After (ATOMIC):**

```markdown
## Integration Guide

**Styling Integration:**
Components accept `className` prop for styling flexibility.
Use `data-*` attributes for state-based styling.
Variant types are defined - apply styles externally.

**State Integration:**
Server state and client state are separate concerns.
Components receive data via props - source is irrelevant.

**Testing Integration:**
Components can be tested in isolation.
Mock data at the network boundary, not component level.
```

---

### Example 3: Decision Tree (Zustand Skill)

**Before (VIOLATION):**

```markdown
## When to Use Zustand

Is it server data (from API)?
├─ YES → Use React Query, not Zustand
└─ NO → Is it needed across multiple components?
├─ YES → Use Zustand
└─ NO → useState in component
```

**After (ATOMIC):**

```markdown
## When to Use Zustand

Is it server data (from API)?
├─ YES → Use your data fetching solution (not Zustand's scope)
└─ NO → Is it needed across multiple components?
├─ YES → Use Zustand
└─ NO → useState in component (React's built-in state)
```

---

### Example 4: Pattern Title (SCSS Modules Skill)

**Before (VIOLATION):**

````markdown
## Pattern 11: Icon Styling with lucide-react

### Library

`lucide-react` (installed in `packages/ui`)

### Usage

```tsx
import { ChevronUp } from "lucide-react";
<ChevronUp className={styles.icon} size={16} />;
```
````

````

**After (ATOMIC):**
```markdown
## Pattern 11: Icon Styling

Icons need consistent sizing and color inheritance.

### Pattern
```scss
.icon {
  width: var(--icon-size-md);
  height: var(--icon-size-md);
  color: currentColor;  // Inherits from parent
}

.iconSm { --icon-size: var(--icon-size-sm); }
.iconMd { --icon-size: var(--icon-size-md); }
.iconLg { --icon-size: var(--icon-size-lg); }
````

Apply via className to any icon component or SVG element.

````

---

### Example 5: Test Setup (Vitest Skill)

**Before (VIOLATION):**
```typescript
// test/setup.ts
import { server } from "@repo/api-mocks";
import { beforeAll, afterEach, afterAll } from "vitest";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
````

**After (ATOMIC):**

```typescript
// test/setup.ts
// Use your test runner's lifecycle hooks
// Use your mocking solution's server setup

beforeAll(() => {
  // Initialize mock server
  mockServer.listen();
});

afterEach(() => {
  // Reset handlers between tests
  mockServer.resetHandlers();
});

afterAll(() => {
  // Cleanup
  mockServer.close();
});
```

---

## 9. Pitfalls to Avoid

### Pitfall 1: Over-Genericizing Examples

**Bad:**

```typescript
// Apply your styling solution here
// Use your state management here
// Do the thing with your tool
```

**Good:**

```typescript
// Apply styles via className prop
className = { className };

// Pass state via props - source doesn't matter
interface Props {
  data: User[];
  isLoading: boolean;
}
```

**Rule:** Generic comments should still be actionable.

---

### Pitfall 2: Breaking Example Logic

**Bad:**

```typescript
// Removed import, left broken code
const buttonClass = styles.button; // styles is undefined!
```

**Good:**

```typescript
// Rewrite to work without the import
const buttonClass = className; // Passed in via props
```

**Rule:** Examples must compile conceptually after transformation.

---

### Pitfall 3: Losing Actionability

**Bad:**

```markdown
// Before
Use React Query for server data

// After (too generic)
Handle server data appropriately
```

**Good:**

```markdown
// After (still actionable)
Server data should be:

- Cached to avoid redundant fetches
- Invalidated when mutations occur
- Handled with loading/error states

(Use your data fetching solution to achieve this)
```

**Rule:** After removing tool recommendations, remaining guidance must still be useful.

---

### Pitfall 4: Forgetting Companion Files

**Incomplete audit:**

```
✓ SKILL.md - checked
✗ reference.md - forgot to check
✗ examples.md - forgot to check
```

**Rule:** Always check ALL files: `SKILL.md`, `reference.md`, `examples.md`, `metadata.yaml`

Violations are often concentrated in `examples.md` because that's where imports live.

---

### Pitfall 5: Leaving Orphaned References

**Bad:**

```markdown
// Removed Pattern 2 (cva variants)
// But left reference in Pattern 5:
"See Pattern 2 for variant implementation" // Now broken!
```

**Good:**

```markdown
// After removing Pattern 2:
// Update Pattern 5:
"Use data-\* attributes for variant styling" // Self-contained
```

**Rule:** After removing content, search for all references to it.

---

### Pitfall 6: Deleting Valuable Content Without Relocation

**Bad:**

```markdown
// Valuable cva example deleted from React skill
// Now no skill has this example!
```

**Good:**

```markdown
// Step 1: Copy to SCSS Modules skill (cva is styling)
// Step 2: Document the relocation
// Step 3: Then delete from React skill
```

**Rule:** Check if content should move to another skill before deleting.

---

## 10. Troubleshooting Common Issues

### Issue: "But users need to know which tools work together!"

**Symptom:** Resistance to removing Integration Guides

**Solution:** Integration guidance belongs at the STACK level, not skill level. Skills teach how to use ONE tool well. Stacks teach how tools combine.

```markdown
// Skill level - NO tool combinations
// Stack level - YES tool combinations
```

---

### Issue: "My examples don't make sense without the imports"

**Symptom:** Examples seem incomplete after removing imports

**Solution:** Rewrite examples to be conceptually complete:

```typescript
// Before: Depends on external import
import { useQuery } from "@tanstack/react-query";
const { data } = useQuery({ queryKey: ["users"] });

// After: Conceptually complete
// Assume data comes from your data fetching solution
interface Props {
  data: User[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

function UserList({ data, isLoading, error }: Props) {
  // Component logic doesn't care where data comes from
}
```

---

### Issue: "The decision tree doesn't help without tool recommendations"

**Symptom:** Decision trees feel empty after removing tool exits

**Solution:** End trees with domain-appropriate guidance, not tool recommendations:

```markdown
// Before
Is it server data? → Use React Query

// After
Is it server data? → Not this skill's scope. Use your data fetching solution.
This skill handles [X], [Y], [Z] instead.
```

---

### Issue: "Grep finds too many false positives"

**Symptom:** Keywords appear in valid contexts

**Solution:** Use context-aware grep and manual review:

```bash
# Bad - catches valid uses
grep -n "SCSS"

# Better - show context
grep -n -B2 -A2 "SCSS"

# Best - specific patterns
grep -n "import.*scss\|Use SCSS\|with SCSS"
```

Valid uses to KEEP:

- File extensions in sideEffects: `"*.scss"` (pattern, not prescription)
- Architecture categories: "CSS Modules" (generic term)
- Own domain references: SCSS skill can say "SCSS"

---

### Issue: "Content relocation is complex"

**Symptom:** Unsure where content belongs

**Solution:** Follow the domain ownership principle:

| Content Type                | Owner Skill            |
| --------------------------- | ---------------------- |
| Styling patterns (cva, CSS) | Styling skill          |
| Data fetching patterns      | Data fetching skill    |
| State patterns              | State management skill |
| Testing patterns            | Testing skill          |
| Component patterns          | React/Vue/etc. skill   |

If content involves TWO domains, it probably belongs in neither and should be removed.

---

## 11. Verification Commands

### Full Audit Command

```bash
# Comprehensive violation check for a skill
grep -rn \
  "SCSS\|scss-modules\|module\.scss\|module\.css\|cva\|class-variance-authority\|" \
  "zustand\|Zustand\|react-query\|React Query\|@tanstack\|useQuery\|useMutation\|" \
  "MSW\|msw\|Mock Service Worker\|" \
  "Vitest\|vitest\|Jest\|jest\|" \
  "Hono\|hono\|Drizzle\|drizzle\|" \
  "lucide-react\|lucide\|@repo/\|" \
  "Next\.js\|Vite\|Remix" \
  "src/skills/path/to/skill/"
```

### Quick Check Commands

```bash
# Check specific domain violations
grep -rn "import.*from.*scss\|import.*from.*zustand" skill/

# Check Integration Guides
grep -n "Works with\|Integrates with" skill/*.md

# Check tool recommendations
grep -n "Use.*for\|use.*for" skill/*.md

# Check decision trees
grep -n "→.*Use\|-> Use" skill/*.md

# Check pattern titles
grep -n "^##.*with\|^###.*with" skill/*.md
```

### Post-Transformation Verification

```bash
# Should return 0 results
grep -rn "VIOLATION_KEYWORDS" skill/

# Visual review
cat skill/SKILL.md | head -100  # Check Quick Guide
cat skill/examples.md | grep "import"  # Check imports
cat skill/reference.md | grep -i "integration"  # Check guides
```

---

## Conclusion

Skill atomicity is not optional—it's the foundation of a composable, portable, maintainable skill system.

**Key Principles:**

1. **A skill discusses ONLY its own domain**
2. **Integration guidance belongs at stack level, not skill level**
3. **Remove, genericize, or relocate—never leave violations**
4. **Examples must compile conceptually after transformation**
5. **Verify with grep AND manual review**

**The Payoff:**

- Skills work across different tech stacks
- Maintenance is isolated to one skill at a time
- Users learn one thing well without confusion
- Stacks can evolve tool-by-tool
- New skills compose freely with existing ones

**When in doubt, ask:** "Would this skill work for someone using a different tool for [other domain]?" If no, there's a violation.
