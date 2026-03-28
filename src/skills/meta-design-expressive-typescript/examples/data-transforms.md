# Expressive TypeScript - Data Transformation Patterns

> When to use plain JS, when utility libraries help, and how to keep data transformations readable. See [SKILL.md](../SKILL.md) for decision frameworks and [reference.md](../reference.md) for the use/don't-use table.

**Prerequisites**: Understand the two-tier pattern, named abstractions, and the extraction decision framework from [core.md](core.md) first.

---

## When Plain JS Is Enough

For single operations or two-step chains, plain JS array methods are already expressive. Adding a utility library adds dependency without improving clarity.

### Single Transform

```typescript
// Already clear -- no utility needed
const names = users.map((user) => user.displayName);
const activeUsers = users.filter((user) => user.isActive);
const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
const firstAdmin = users.find((user) => user.role === "admin");
```

### Two-Step Chain

```typescript
// Two chained operations -- still clear without pipe()
const activeNames = users
  .filter((user) => user.isActive)
  .map((user) => user.displayName);
```

**Why plain JS:** A reader fluent in JavaScript instantly understands these. Wrapping them in `pipe(users, filter(isActive), map(getName))` adds indirection and requires familiarity with the utility library's calling conventions.

---

## When Utility Libraries Help

Use utility functions when the **function name IS the documentation** -- when the utility name communicates intent more clearly than the equivalent manual implementation.

### groupBy: Array to Keyed Groups

```typescript
// Before: manual reduce requires simulation
const byCategory: Record<string, Skill[]> = {};
for (const skill of skills) {
  const cat = skill.category;
  if (!byCategory[cat]) byCategory[cat] = [];
  byCategory[cat].push(skill);
}

// After: intent is clear from the function name
import { groupBy } from "remeda";

const byCategory = groupBy(skills, (skill) => skill.category);
```

**Why better:** `groupBy` is a universally understood concept. The manual version requires tracing the loop, the conditional initialization, and the push. The utility version reads as: "group skills by category."

---

### countBy: Count Occurrences Per Category

```typescript
// Before: manual counting loop
const statusCounts: Record<string, number> = {};
for (const task of tasks) {
  const status = task.status;
  statusCounts[status] = (statusCounts[status] ?? 0) + 1;
}

// After: intent is clear
import { countBy } from "remeda";

const statusCounts = countBy(tasks, (task) => task.status);
// => { active: 5, completed: 12, pending: 3 }
```

**Why better:** `countBy` communicates "count occurrences per category" instantly. The manual loop requires understanding the null-coalescing initialization pattern.

---

### difference: Set Subtraction

```typescript
// Before: requires understanding the negation pattern
const newSkills = allSkills.filter((skill) => !installedSkills.includes(skill));

// After: mathematical set operation, immediately understood
import { difference } from "remeda";

const newSkills = difference(allSkills, installedSkills);
```

**Why better:** `difference(a, b)` is the standard name for "items in A not in B." The filter-with-negated-includes pattern requires the reader to mentally invert the condition.

---

### partition: Split Into Two Groups

```typescript
// Before: two separate filter passes or manual push-to-two-arrays
const valid: Item[] = [];
const invalid: Item[] = [];
for (const item of items) {
  if (isValid(item)) {
    valid.push(item);
  } else {
    invalid.push(item);
  }
}

// After: single pass, intent is clear
import { partition } from "remeda";

const [valid, invalid] = partition(items, isValid);
```

**Why better:** `partition` communicates "split into two groups based on a predicate" as a single concept. The manual version requires reading the loop, both arrays, and the if/else to understand the same thing.

---

### indexBy: Array to Keyed Lookup

```typescript
// Before: manual reduce to build lookup
const skillById = skills.reduce<Record<string, Skill>>((acc, skill) => {
  acc[skill.id] = skill;
  return acc;
}, {});

// After: intent is clear
import { indexBy } from "remeda";

const skillById = indexBy(skills, (skill) => skill.id);
```

**Why better:** `indexBy` communicates "create a lookup keyed by this field." The reduce version requires understanding the accumulator pattern, the explicit type annotation, and the mutation-then-return.

---

### mapValues: Transform Object Values

```typescript
// Before: verbose Object.entries/fromEntries dance
const uppercased = Object.fromEntries(
  Object.entries(config).map(([key, value]) => [key, value.toUpperCase()]),
);

// After: intent is clear
import { mapValues } from "remeda";

const uppercased = mapValues(config, (value) => value.toUpperCase());
```

**Why better:** `mapValues` communicates "apply a transform to every value in this object." The `Object.fromEntries(Object.entries(...).map(...))` pattern is a well-known JS idiom, but it requires parsing three levels of nesting.

---

### sortBy: Multi-Key Sorting

```typescript
// Before: manual comparator with multiple sort keys
const sorted = [...skills].sort((a, b) => {
  const catCompare = a.category.localeCompare(b.category);
  if (catCompare !== 0) return catCompare;
  return a.name.localeCompare(b.name);
});

// After: sort keys as a readable list
import { sortBy } from "remeda";

const sorted = sortBy(
  skills,
  (skill) => skill.category,
  (skill) => skill.name,
);
```

**Why better:** `sortBy` with multiple key extractors reads as "sort by category, then by name." The manual comparator requires understanding the comparison-then-fallback pattern.

---

## When pipe() Helps

Use `pipe()` when you have **3 or more chained transformations** and intermediate variables would obscure the data flow.

### Before: Intermediate Variables Obscure Flow

```typescript
const active = skills.filter(isActive);
const withDisplayNames = active.map(addDisplayName);
const sorted = withDisplayNames.sort(byCategory);
const grouped = groupByCategory(sorted);
const counts = Object.entries(grouped).map(([cat, items]) => ({
  category: cat,
  count: items.length,
}));
```

**Why mediocre:** Five intermediate variables that exist only to pass data to the next step. The variables don't add semantic meaning -- they are plumbing.

### After: pipe() Shows the Data Flow

```typescript
import { pipe, filter, map, sortBy, groupBy, mapValues } from "remeda";

const categoryCounts = pipe(
  skills,
  filter(isActive),
  map(addDisplayName),
  sortBy((skill) => skill.category),
  groupBy((skill) => skill.category),
  mapValues((group) => group.length),
);
```

**Why better:** The data flow reads top-to-bottom: start with skills, filter active, add display names, sort, group, count. No intermediate variables that add noise without adding meaning.

### When pipe() Hurts

```typescript
// DON'T: pipe for 1-2 operations
import { pipe, filter } from "remeda";
const active = pipe(skills, filter(isActive));

// DO: plain JS is clearer
const active = skills.filter(isActive);
```

**Why plain JS is better here:** For one or two operations, `pipe()` adds import overhead and library-specific syntax without improving readability.

---

## Combining Transforms Readably

When a transformation has multiple stages, use the orchestrator pattern even for data transforms:

```typescript
// Orchestrator: clear stage names
function buildCategoryReport(skills: Skill[]): CategoryReport[] {
  const active = skills.filter(isActive);
  const grouped = groupBy(active, (s) => s.category);
  return Object.entries(grouped).map(buildReportEntry);
}

// Pure function: formatting isolated
function buildReportEntry([category, skills]: [
  string,
  Skill[],
]): CategoryReport {
  return {
    category,
    count: skills.length,
    names: skills.map((s) => s.displayName).join(", "),
  };
}
```

**Why good:** The orchestrator names each stage. The formatting logic is extracted to a pure function. A reader sees the flow without needing to understand the formatting details.

---

## Anti-Pattern: Forcing Utility Libraries

```typescript
// DON'T: using pipe/map/filter when plain JS is clearer
import { pipe, map, filter } from "remeda";
const result = pipe(
  items,
  filter((item) => item.isActive),
  map((item) => item.name),
);

// DO: plain JS
const result = items.filter((item) => item.isActive).map((item) => item.name);
```

**Why plain JS wins:** The two-step chain is already perfectly readable. The `pipe` version requires familiarity with Remeda's calling convention and adds an import for zero readability gain.

**Rule of thumb:** If you can fluently read the plain JS version in one scan, don't add a utility library.
