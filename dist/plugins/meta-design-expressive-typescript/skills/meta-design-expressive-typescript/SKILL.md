---
name: meta-design-expressive-typescript
description: Readable functional patterns — orchestrators, pure functions, named abstractions
---

# Expressive TypeScript

> **Quick Guide:** Write code that communicates its intent without requiring the reader to mentally simulate any of its parts. Apply the two-tier pattern: orchestrators at the top that read like pseudocode, pure functions at the bottom that each do one thing. Extract until the code reads like prose. Use utility libraries only when they genuinely improve readability over plain JS.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST structure every non-trivial function as a two-tier orchestrator: guard clauses at the top, named function calls in the middle, assembly at the bottom -- NO inline data transformations in orchestrators)**

**(You MUST extract any expression that requires mental simulation to understand into a named function or named constant)**

**(You MUST name functions for WHAT they do, not HOW they do it -- `isContentAddition(line)` not `checkLineStartsWithPlusButNotTriplePlus(line)`)**

**(You MUST read the existing code before refactoring -- understand the current structure, then improve it)**

**(You MUST prefer plain JS methods (`.map()`, `.filter()`, `.reduce()`) over utility libraries when they already read clearly)**

</critical_requirements>

---

**Auto-detection:** orchestrator pattern, two-tier function, extract function, named predicate, named constant, readability refactor, expressive code, function decomposition, pure function extraction, readable TypeScript, guard clause, early return, flatten conditionals, discriminated union, exhaustive switch, as const satisfies, async orchestrator

**When to use:**

- Writing any function that mixes validation, transformation, and assembly logic
- Refactoring a function where you need to mentally simulate steps to understand the flow
- Naming predicates, constants, or transforms to communicate intent
- Deciding whether to use a utility library function or plain JS
- Decomposing a large function into orchestrator + pure helpers
- Reviewing code and finding blocks that require mental simulation
- Flattening deeply nested if/else blocks into guard clauses
- Writing async functions that orchestrate multiple independent operations
- Modeling state or events with discriminated unions for exhaustive handling

**When NOT to use:**

- Writing simple one-liner functions that are already clear
- Academic functional programming (monads, functors, Either/Option types)
- Point-free style where arguments are implicit
- Over-extracting trivially simple expressions into named functions
- Performance-critical hot paths where function call overhead matters

**Key patterns covered:**

- The two-tier pattern (orchestrator + pure functions)
- The readability test ("can you understand without simulating?")
- Named predicates, constants, and transforms
- Guard clauses: flattening nested conditionals with early returns
- Discriminated unions + exhaustive switch for type-safe control flow
- Async orchestrators with `Promise.all` for independent operations
- `as const satisfies` for intent-revealing configuration
- The extraction decision framework
- Utility library usage: the 80/20 rule

---

## Detailed Resources

- [examples/core.md](examples/core.md) - Two-tier pattern, guard clauses, named predicates, named constants, discriminated unions, async orchestrators
- [examples/data-transforms.md](examples/data-transforms.md) - Data transformation patterns, when plain JS is enough, when utility libraries help
- [reference.md](reference.md) - Quick-reference cheat sheet with decision tables

---

<philosophy>

## Philosophy

Expressive TypeScript is **practical, 80/20 functional programming focused on readability**. The core test for any block of code:

> **"Can someone understand the code's flow without simulating any of its parts?"**

If the answer is no, extract the part that requires simulation into a named function or constant. If the answer is yes, leave it alone -- even if it could theoretically be "cleaner."

This is NOT:

- **Monads, functors, or Either/Option types** -- those belong in a different skill
- **Point-free style** -- implicit arguments obscure intent for most readers
- **Religious functional purity** -- side effects in orchestrators are fine; the pure functions underneath are what matter
- **Over-extraction** -- three similar lines of code is better than a premature abstraction

**The two core ideas:**

1. **Orchestrators read like pseudocode.** Guard clauses, named function calls, assembly. No inline logic that requires simulation.
2. **Pure functions do one thing.** Each has a name that communicates its purpose. Each is independently testable.

**When to apply this skill:**

- Any function longer than ~15 lines that mixes concerns
- Any expression where a reader would need to trace through logic to understand intent
- Any repeated logic pattern that lacks a descriptive name

**When NOT to apply:**

- A single `.map()` or `.filter()` that already reads clearly
- Functions that are already one level of abstraction
- Trivially simple code where extraction would add noise

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: The Two-Tier Pattern

Every non-trivial function follows the same structure: an **orchestrator** at the top that reads like pseudocode, calling **pure functions** at the bottom that each do one thing.

#### The Orchestrator (Top Tier)

```typescript
// Orchestrator: reads like a step-by-step plan
function processUserImport(rawData: RawImportData): ImportResult {
  // 1. Guard clauses
  if (!rawData.users.length) {
    return { imported: 0, skipped: 0, errors: [] };
  }

  // 2. Named function calls for each step
  const validated = rawData.users.filter(isValidUser);
  const normalized = validated.map(normalizeUserRecord);
  const deduped = removeDuplicatesByEmail(normalized);
  const { existing, newUsers } = separateExistingUsers(deduped);

  // 3. Assembly
  return {
    imported: newUsers.length,
    skipped: existing.length,
    errors: rawData.users.length - validated.length,
  };
}
```

**Why good:** Each line communicates intent through its function name. A reader knows WHAT happens at each step without reading HOW any step works. Guard clauses are at the top. No inline lambdas obscure the flow.

#### The Pure Functions (Bottom Tier)

```typescript
// Pure function: one job, named for purpose
function isValidUser(user: RawUser): boolean {
  return user.email.includes("@") && user.name.trim().length > 0;
}

function normalizeUserRecord(user: RawUser): NormalizedUser {
  return {
    email: user.email.toLowerCase().trim(),
    name: user.name.trim(),
    role: user.role ?? DEFAULT_ROLE,
  };
}

function removeDuplicatesByEmail(users: NormalizedUser[]): NormalizedUser[] {
  const seen = new Set<string>();
  return users.filter((user) => {
    if (seen.has(user.email)) return false;
    seen.add(user.email);
    return true;
  });
}
```

**Why good:** Each function does one thing, has a descriptive name, and is testable in isolation without mocks or state setup.

> **Full before/after examples:** See [examples/core.md](examples/core.md) for complete orchestrator transformations.

---

### Pattern 2: The Readability Test

Before extracting or refactoring, apply this test to any block of code:

> **"Can someone understand the code's flow without mentally simulating any of its parts?"**

```typescript
// Fails the readability test -- requires simulation
const result = items
  .filter(
    (item) =>
      item.status === "active" &&
      item.createdAt > cutoffDate &&
      !excludedIds.has(item.id),
  )
  .map((item) => ({
    ...item,
    displayName: item.firstName + " " + item.lastName,
    age: Math.floor((Date.now() - item.birthDate.getTime()) / MS_PER_YEAR),
  }));
```

**Why bad:** A reader must mentally execute the filter predicate and the map transform to understand what this produces. The intent is buried in implementation.

```typescript
// Passes the readability test -- intent is clear from names
const activeItems = items.filter(isActiveAfterCutoff);
const displayRecords = activeItems.map(toDisplayRecord);
```

**Why good:** Each step communicates intent. A reader knows the filter selects active items after a cutoff and the map creates display records -- without reading either function's body.

#### When the Test Says "Leave It Alone"

```typescript
// Already passes -- don't over-extract
const names = users.map((user) => user.name);
const activeUsers = users.filter((user) => user.isActive);
const total = prices.reduce((sum, price) => sum + price, 0);
```

**Why good:** These are already clear single-expression operations. Extracting `getName`, `isActive`, or `sumPrices` would add indirection without improving clarity.

---

### Pattern 3: Named Abstractions

When an expression requires simulation, give it a name that communicates intent.

#### Named Predicates

```typescript
// Before: requires simulation to understand filter criteria
const lines = diff.filter(
  (line) => line.startsWith("+") && !line.startsWith("+++"),
);

// After: name communicates intent
const lines = diff.filter(isContentAddition);

function isContentAddition(line: string): boolean {
  return line.startsWith("+") && !line.startsWith("+++");
}
```

**Why good:** `isContentAddition` tells the reader WHAT is being checked. The implementation (startsWith logic) is available but not required to understand the flow.

#### Named Constants

```typescript
// Before: magic setup with no context
const skill = createMockSkill("react", {
  conflictsWith: ["vue", "angular"],
  requires: ["typescript"],
});

// After: name communicates purpose
const REACT_WITH_FRAMEWORK_CONFLICTS = createMockSkill("react", {
  conflictsWith: ["vue", "angular"],
  requires: ["typescript"],
});
```

**Why good:** When this constant appears in a test, the reader knows its purpose without scrolling to its definition. The name encodes the relevant characteristics.

#### Named Transforms

```typescript
// Before: inline formatting logic obscures orchestrator flow
const message = results
  .map((r) =>
    r.success ? `  Installed ${r.name}` : `  Failed ${r.name}: ${r.error}`,
  )
  .join("\n");

// After: name communicates intent
const message = results.map(formatInstallResult).join("\n");

function formatInstallResult(result: InstallResult): string {
  if (result.success) return `  Installed ${result.name}`;
  return `  Failed ${result.name}: ${result.error}`;
}
```

**Why good:** The orchestrator reads as "format each result, join with newlines." The formatting details are available but not in the way.

> **More examples:** See [examples/core.md](examples/core.md) for before/after named abstraction patterns.

---

### Pattern 4: The Extraction Decision Framework

Not every expression should be extracted. Use this decision tree:

```
Does this block require mental simulation to understand?
|-- NO -> Leave it inline. Don't over-extract.
+-- YES -> Does the same logic appear in 2+ places?
    |-- YES -> Extract to shared function (DRY + readability).
    +-- NO -> Would a named function communicate intent the expression doesn't?
        |-- YES -> Extract. The name adds value.
        +-- NO -> Leave it. Extraction would just move code without adding clarity.
```

#### Extract: Block Requires Simulation

```typescript
// Before: simulation required to understand what this produces
const categories = Object.entries(skills).reduce<Record<string, Skill[]>>(
  (acc, [id, skill]) => {
    const cat = skill.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(skill);
    return acc;
  },
  {},
);

// After: intent is clear from the name
const categories = groupSkillsByCategory(skills);
```

#### Don't Extract: Already Clear

```typescript
// Already clear -- extracting would just move one line
const ids = skills.map((skill) => skill.id);
const hasConflicts = conflicts.length > 0;
const displayName = `${firstName} ${lastName}`;
```

**Why good:** These are trivially understandable. A function named `getIds`, `checkHasConflicts`, or `buildDisplayName` would add indirection without improving readability.

#### Don't Extract: Name Would Be As Complex As Implementation

```typescript
// Don't extract this:
const isSelected = selectedIds.has(item.id);

// Because the extraction would be:
function isItemSelected(item: Item, selectedIds: Set<string>): boolean {
  return selectedIds.has(item.id);
}
// The name doesn't communicate more than the expression itself
```

---

### Pattern 5: Guard Clauses (Flatten Nested Conditionals)

Deeply nested if/else blocks force a reader to maintain a mental stack of conditions. Guard clauses invert conditions and return early, keeping the happy path un-nested.

```typescript
// Flat: each guard exits early, happy path has zero nesting
function getDiscount(user: User, cart: Cart): number {
  if (!user.isActive) return 0;
  if (cart.items.length === 0) return 0;
  if (!user.membership) return STANDARD_DISCOUNT;

  return calculateMemberDiscount(user.membership, cart.total);
}
```

**Why good:** Each guard clause handles one concern and exits. The reader never needs to track which `else` branch they are in. The final line is the happy path, visible at a glance.

> **Full before/after transformation:** See [examples/core.md](examples/core.md) for deeply nested code flattened to guard clauses.

---

### Pattern 6: Discriminated Unions + Exhaustive Switch

When a value can be one of several states, a discriminated union with an exhaustive switch makes the type system enforce that every case is handled. Adding a new variant causes a compile error wherever handling is missing.

```typescript
type TaskStatus = "pending" | "running" | "completed" | "failed";

function getStatusMessage(status: TaskStatus): string {
  switch (status) {
    case "pending":
      return "Waiting to start";
    case "running":
      return "In progress...";
    case "completed":
      return "Done";
    case "failed":
      return "Something went wrong";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
```

**Why good:** The `never` default guarantees compile-time exhaustiveness. If a fifth status is added to the union, this switch will error until the new case is handled.

> **Full pattern with discriminated object unions:** See [examples/core.md](examples/core.md) for the complete discriminated union pattern.

---

### Pattern 7: Async Orchestrators

The two-tier pattern applies equally to async code. Async orchestrators `await` named functions in sequence for dependent steps and use `Promise.all` for independent steps.

```typescript
async function onboardNewUser(input: OnboardInput): Promise<OnboardResult> {
  const user = await createUserRecord(input);

  // Independent operations -- run in parallel
  const [profile, settings] = await Promise.all([
    initializeProfile(user.id, input.preferences),
    applyDefaultSettings(user.id),
  ]);

  await sendWelcomeEmail(user.email, profile.displayName);

  return { user, profile, settings };
}
```

**Why good:** The orchestrator reads as a step-by-step plan. Independent operations are grouped in `Promise.all` -- signaling to the reader that they don't depend on each other. Each called function is a pure async operation named for its purpose.

> **Full before/after example:** See [examples/core.md](examples/core.md) for an async function decomposed from mixed-concern code.

---

### Pattern 8: `as const satisfies` for Configuration

When defining static configuration objects, `as const satisfies Shape` preserves literal types (for autocompletion and `typeof`/`keyof` usage) while validating the shape at compile time.

```typescript
interface RouteConfig {
  path: string;
  auth: boolean;
}

const ROUTES = {
  home: { path: "/", auth: false },
  dashboard: { path: "/dashboard", auth: true },
  settings: { path: "/settings", auth: true },
} as const satisfies Record<string, RouteConfig>;

// Type of ROUTES.home.path is "/", not string
// typeof ROUTES gives you the full literal structure for keyof usage
```

**Why good:** The `satisfies` operator catches typos and missing fields at compile time. The `as const` preserves exact literal types so downstream code benefits from precise inference. Without `satisfies`, a typo like `{ pth: "/" }` would silently pass.

</patterns>

---

<decision_framework>

## Decision Framework

### When to Apply the Two-Tier Pattern

```
Is this function > ~15 lines?
|-- NO -> Is it mixing multiple concerns (validate + transform + assemble)?
|   |-- YES -> Apply two-tier pattern
|   +-- NO -> Leave it. Short single-concern functions are fine as-is.
+-- YES -> Does it have clear logical steps?
    |-- YES -> Apply two-tier pattern: orchestrator calls named functions
    +-- NO -> Consider breaking into separate functions by responsibility first
```

### When to Use a Utility Library vs Plain JS

```
Is this a single .map(), .filter(), or .reduce()?
|-- YES -> Use plain JS. A utility library adds dependency without clarity.
+-- NO -> Is the operation a known concept (group-by, count-by, set-difference)?
    |-- YES -> Does the utility library name match the concept?
    |   |-- YES -> Use the library. groupBy(skills, s => s.category) is
    |   |          clearer than a manual reduce.
    |   +-- NO -> Use plain JS with a named function.
    +-- NO -> Are there 3+ chained transformations?
        |-- YES -> Consider pipe() if intermediate variables would obscure flow.
        +-- NO -> Use plain JS with named intermediate variables.
```

### The 80/20 Rule for Utility Libraries

Use utility functions when the **function name IS the documentation**:

| Use utility library                         | Use plain JS                               |
| ------------------------------------------- | ------------------------------------------ |
| `groupBy(items, fn)` -- groups by key       | `items.map(fn)` -- single transform        |
| `countBy(items, fn)` -- counts per category | `items.filter(fn)` -- single filter        |
| `difference(a, b)` -- set subtraction       | `items.find(fn)` -- single lookup          |
| `partition(items, fn)` -- split into two    | `items.some(fn)` / `items.every(fn)`       |
| `indexBy(items, fn)` -- array to lookup map | `items.reduce(fn, init)` -- simple sum     |
| `pipe(data, ...fns)` -- 3+ chained ops      | One or two chained `.map().filter()` calls |

> **Full data transformation examples:** See [examples/data-transforms.md](examples/data-transforms.md)

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- An orchestrator function contains inline lambdas longer than a single expression -- extract to named functions
- A function mixes guard clauses, data transformation, side effects, and return assembly without clear separation
- Variable names describe implementation (`filteredMappedItems`) instead of intent (`activeDisplayRecords`)
- Code uses `.reduce()` to build a lookup object when `groupBy` or `indexBy` communicates intent directly
- Deeply nested if/else blocks (3+ levels) instead of guard clauses with early returns
- A switch on a union type is missing the `default: never` exhaustiveness check -- adding a new variant will silently fall through

**Medium Priority Issues:**

- Using a utility library for a single `.map()` or `.filter()` that already reads clearly
- Extracting trivially simple expressions into named functions (over-extraction)
- Using `pipe()` for one or two operations where a variable would be clearer
- Named constants that are as complex as what they replace

**Common Mistakes:**

- Applying point-free style (`items.filter(isActive)`) when the predicate needs context that point-free obscures -- use an explicit lambda if the predicate needs closure variables
- Extracting a function that is used exactly once and whose name is just a restatement of the single line it contains
- Creating a "utils" file that becomes a dumping ground -- group extracted functions by domain, near their callers

**Gotchas & Edge Cases:**

- A well-named inline lambda IS a named abstraction: `.filter((user) => user.isActive)` is already clear because `isActive` is self-documenting. Don't extract this to a separate function.
- Utility library `pipe()` can HURT readability when the reader doesn't know the library -- consider your team's familiarity
- Guard clauses should return early, not wrap the entire function body in an `if` block
- When extracting pure functions, place them at the bottom of the file or in a shared module -- not interspersed with the orchestrators they serve
- `as const satisfies Shape` -- order matters. `satisfies Shape as const` does not work. Lock literals first, then validate shape.
- In async orchestrators, sequential `await` on independent operations is a hidden performance bug -- use `Promise.all` when steps don't depend on each other's results
- The `never` exhaustiveness trick requires `noUnusedLocals` to not flag the variable -- use `return _exhaustive` instead of just assigning to avoid lint warnings

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST structure every non-trivial function as a two-tier orchestrator: guard clauses at the top, named function calls in the middle, assembly at the bottom -- NO inline data transformations in orchestrators)**

**(You MUST extract any expression that requires mental simulation to understand into a named function or named constant)**

**(You MUST name functions for WHAT they do, not HOW they do it -- `isContentAddition(line)` not `checkLineStartsWithPlusButNotTriplePlus(line)`)**

**(You MUST read the existing code before refactoring -- understand the current structure, then improve it)**

**(You MUST prefer plain JS methods (`.map()`, `.filter()`, `.reduce()`) over utility libraries when they already read clearly)**

**Failure to follow these rules will produce code that requires mental simulation to understand -- the exact opposite of expressive TypeScript.**

</critical_reminders>
