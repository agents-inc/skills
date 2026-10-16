# Expressive TypeScript — Collection Operations

> Full code for Pattern 7 in [SKILL.md](../SKILL.md). Orchestrators, predicates and guard clauses are in [core.md](core.md); what each compiler check needs is in [reference.md](../reference.md).

Operations without a native method are imported below from `./collections`, a stand-in for whichever utility library or helper module the project already depends on. Names vary between libraries; the rule does not.

---

## Pattern 7: Collection Operations Named for the Concept

### When one method already reads

```typescript
// Already clear -- no utility needed
const names = users.map((user) => user.displayName);
const activeUsers = users.filter((user) => user.isActive);
const totalPrice = items.reduce((sum, item) => sum + item.price, 0);
const firstAdmin = users.find((user) => user.role === "admin");
```

```typescript
// Two chained operations -- still clear without pipe()
const activeNames = users
  .filter((user) => user.isActive)
  .map((user) => user.displayName);
```

**Why plain JS:** A reader fluent in JavaScript reads these in one scan. `pipe(users, filter(isActive), map(getName))` says the same thing in a calling convention the reader also has to know.

### Grouping

```typescript
// Before: the loop has to be traced to see that it groups
const byCategory: Record<string, Skill[]> = {};
for (const skill of skills) {
  const category = skill.category;
  if (!byCategory[category]) byCategory[category] = [];
  byCategory[category].push(skill);
}

// After: the operation is the name
const byCategory = Object.groupBy(skills, (skill) => skill.category);
```

**Why better:** `Object.groupBy` names the operation and is native, so it adds no dependency.

### Counting

```typescript
// Before: a counting loop
const statusCounts: Record<string, number> = {};
for (const task of tasks) {
  const status = task.status;
  statusCounts[status] = (statusCounts[status] ?? 0) + 1;
}

// After
import { countBy } from "./collections";

const statusCounts = countBy(tasks, (task) => task.status);
// => { active: 5, completed: 12, pending: 3 }
```

**Why better:** `countBy` says "occurrences per status" at once, where the loop asks the reader to decode the `?? 0` initialisation first.

### Difference

```typescript
// Before: the reader inverts the condition to see "in A, not in B"
const newSkills = allSkills.filter((skill) => !installedSkills.includes(skill));

// After
import { difference } from "./collections";

const newSkills = difference(allSkills, installedSkills);
```

**Why better:** `difference(a, b)` is the standard name for "items in A that are not in B". For two `Set`s the method is native: `allIds.difference(installedIds)`.

### Partitioning

```typescript
// Before: two arrays and an if/else to say "split by a predicate"
const valid: Item[] = [];
const invalid: Item[] = [];
for (const item of items) {
  if (isValid(item)) {
    valid.push(item);
  } else {
    invalid.push(item);
  }
}

// After
import { partition } from "./collections";

const [valid, invalid] = partition(items, isValid);
```

### Indexing

```typescript
// Before: a reduce to build a lookup
const skillById = skills.reduce<Record<string, Skill>>((acc, skill) => {
  acc[skill.id] = skill;
  return acc;
}, {});

// After
import { indexBy } from "./collections";

const skillById = indexBy(skills, (skill) => skill.id);
```

**Why better:** The reduce asks the reader to follow the accumulator, the explicit type argument and the mutate-then-return; `indexBy` says "a lookup keyed by id".

### Mapping object values

```typescript
// Before: the Object.entries / fromEntries round trip
const uppercased = Object.fromEntries(
  Object.entries(config).map(([key, value]) => [key, value.toUpperCase()]),
);

// After
import { mapValues } from "./collections";

const uppercased = mapValues(config, (value) => value.toUpperCase());
```

### Multi-key sorting

```typescript
// Before: a comparator with a fallback key
const sorted = [...skills].sort((a, b) => {
  const catCompare = a.category.localeCompare(b.category);
  if (catCompare !== 0) return catCompare;
  return a.name.localeCompare(b.name);
});

// After: the keys as a list
import { sortBy } from "./collections";

const sorted = sortBy(
  skills,
  (skill) => skill.category,
  (skill) => skill.name,
);
```

### When `pipe` helps

Three or more steps whose intermediate values nothing else reads:

```typescript
// Before: five names that only carry data to the next line
const active = skills.filter(isActive);
const withDisplayNames = active.map(addDisplayName);
const sorted = withDisplayNames.sort(byCategory);
const grouped = groupByCategory(sorted);
const counts = Object.entries(grouped).map(([cat, items]) => ({
  category: cat,
  count: items.length,
}));
```

```typescript
// After: the data flow, top to bottom
import { pipe, filter, map, sortBy, groupBy, mapValues } from "./collections";

const categoryCounts = pipe(
  skills,
  filter(isActive),
  map(addDisplayName),
  sortBy((skill) => skill.category),
  groupBy((skill) => skill.category),
  mapValues((group) => group.length),
);
```

**Why better:** No variable exists only to hand data to the next line. Where a later line reads an intermediate again — an orchestrator's assembly counting `validUsers`, say — the named variable is the better form, because the name gets used.

### When `pipe` hurts

```typescript
// One or two operations: pipe adds an import and a calling convention
import { pipe, filter, map } from "./collections";

const names = pipe(
  items,
  filter((item) => item.isActive),
  map((item) => item.name),
);

// Plain JS reads in one scan
const names = items.filter((item) => item.isActive).map((item) => item.name);
```

**Rule of thumb:** if the plain version reads in one scan, it stays plain.
