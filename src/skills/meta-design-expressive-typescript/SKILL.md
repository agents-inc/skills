---
name: meta-design-expressive-typescript
description: Readable TypeScript functions — orchestrators over pure helpers, named predicates and transforms, guard clauses, exhaustive unions. Load when writing or refactoring a function that mixes validation, transformation and assembly, or when deciding whether an expression should be extracted.
---

# Expressive TypeScript Patterns

> **Quick Guide:** One test decides every change: can a reader follow the flow without simulating any part of it? Where they cannot, the part they would simulate gets a name, and the function becomes an orchestrator — guards, named calls, assembly — over small pure helpers; where they can, the code stays inline. Two compiler checks carry the shape: a `never` default fails compilation when a union grows past its `switch`, and `as const satisfies` checks a config without widening its literals.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — orchestrator before/after, named predicates, transforms and constants, guard clauses, exhaustive unions, async orchestrators, `as const satisfies`
- [examples/data-transforms.md](examples/data-transforms.md) — grouping, counting, partitioning and indexing by name; when `pipe` helps and when it hurts
- [reference.md](reference.md) — refactoring moves at a glance, and what each compiler check needs

---

<critical_requirements>

## Before writing expressive TypeScript

**Write each orchestrator as guard clauses, then named calls, then the assembly of their results.** A reader learns what every step produces from its name; a transformation written inline has to be run in their head before the next line means anything.

**Extract what a reader would have to simulate, and leave what reads in one scan.** A name is the only thing extraction adds, so a helper whose name restates its single line adds a jump and nothing else.

**Name a function for the fact it establishes — `isContentAddition(line)`, not `startsWithPlusButNotTriplePlus(line)`.** A name that describes the mechanism has to change whenever the mechanism does, and tells the reader nothing the body did not.

**Pass every value an extracted helper reads as a parameter, or return the helper from a factory — `skills.filter(isRelevantTo(selection))`.** A helper that closes over its caller's locals cannot sit at the bottom of the file or be tested on its own, which is what extracting it was for.

**Use the plain array method where one call reads clearly, and an operation named for the concept where the manual version needs an accumulator.** `Object.groupBy(skills, (skill) => skill.category)` states what a loop over a mutable record makes the reader reconstruct; wrapping a single `.filter()` in a library call states nothing the method did not.

</critical_requirements>

---

**Auto-detection:** orchestrator function, two-tier function, extract function, named predicate, named transform, guard clause, early return, arrow anti-pattern, nested if/else, discriminated union, exhaustive switch, `never` default, `as const satisfies`, sequential await, `Promise.all`, `Object.groupBy`, `pipe`, readability refactor, mental simulation

**Applies to:**

- Splitting a function that validates, transforms and assembles into an orchestrator over pure helpers
- Deciding whether an expression earns a name or stays inline
- Flattening nested conditionals into guard clauses
- Modelling a fixed set of states so the compiler checks every handler
- Typing static configuration so its shape is checked and its literals kept
- Ordering the awaits in an async orchestrator
- Choosing between a plain array method, an operation named for the concept, and `pipe`
- Reviewing code for blocks a reader would have to simulate

**Handled elsewhere:**

- Failure as a return value — encoding a function's errors in its return type is a decision of its own; this skill shapes the code around whatever a function returns.
- Where a collection operation comes from — which native method or library supplies `groupBy` or `partition`, and which runtimes have it, is settled by whatever owns the project's utilities; this skill asks only that the call site name the operation.
- Formatting, import order and file naming — the project's formatter and lint configuration settle those.

---

<philosophy>

Expressive TypeScript is readability-first, practical functional programming. Two ideas carry it:

1. **Orchestrators read like pseudocode** — guards, named calls, assembly. Side effects belong here, where the reader can see them.
2. **Helpers do one thing and are pure** — each named for its purpose, each testable with nothing but its arguments.

What it is not: category theory (monads, functors, effect systems); composition with no named data, such as `compose(map(prop("name")), filter(isActive))` — passing a named function to `filter` is fine, a chain with no visible argument is not; or extraction for its own sake. Three similar lines beat a premature abstraction.

</philosophy>

---

<decision_framework>

## Extract, or leave inline

```
Does a reader have to simulate this block to know what it produces?
├─ NO → Leave it inline. A one-expression lambda reading a named field is already named.
└─ YES → Does the same logic appear in two or more places?
    ├─ YES → Extract once, and call it from each.
    └─ NO → Would a name say something the expression does not?
        ├─ YES → Extract. The name is the documentation.
        └─ NO → Leave it. selectedIds.has(item.id) needs no isItemSelected.
```

## Orchestrator, or leave the function alone

A function earns the two-tier shape when it mixes concerns — validating, transforming, assembling — or when it runs past about fifteen lines in clear steps. Past that length with no clear steps, split it by responsibility first; under it, with one concern, leave it alone. A hot path where a profile shows the extra calls matter is the one place readability yields.

## Array method, named operation, or `pipe`

```
One map, filter, find or some, or a simple sum?
├─ YES → The array method. It already reads in one scan.
└─ NO → Is the manual version a loop or reduce building groups, counts, a lookup or two partitions?
    ├─ YES → A function named for the operation: native where the platform has one
    │        (Object.groupBy), otherwise from the project's existing utilities.
    └─ NO → Three or more steps whose intermediate values only feed the next step?
        ├─ YES → pipe, if the project already uses one; otherwise named intermediates.
        └─ NO → Named intermediates.
```

Named intermediates earn their place when a later line reads them again — Pattern 1's `validUsers` feeds the `rejected` count. Read once, by the next line, they are plumbing.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Orchestrator Over Pure Functions

Guards, named calls, and the assembly of their results; anything a reader would have to simulate lives in a helper below, named for what it produces. An orchestrator that keeps growing is doing transformation work inline — push it down until each line is one named step.

```typescript
function processUserImport(rawData: RawImportData): ImportResult {
  if (rawData.users.length === 0) return EMPTY_IMPORT_RESULT;

  const validUsers = rawData.users.filter(isValidUser);
  const uniqueUsers = removeDuplicatesByEmail(validUsers.map(toUserRecord));
  const { existing, newUsers } = separateExistingUsers(uniqueUsers);

  return {
    imported: newUsers.length,
    skipped: existing.length,
    rejected: rawData.users.length - validUsers.length,
  };
}
```

Full code: [examples/core.md](examples/core.md#pattern-1-orchestrator-over-pure-functions)

### Pattern 2: Named Predicates, Transforms and Constants

Where an expression has to be simulated, a name replaces the simulation. A lambda whose body is one self-describing field is already named, and stays.

```typescript
// Simulated: the reader runs the predicate to learn what it selects
const additions = diff.filter(
  (line) => line.startsWith("+") && !line.startsWith("+++"),
);

// Named: the reader is told
const contentAdditions = diff.filter(isContentAddition);

// Already named by the field it reads: leave it inline
const activeUsers = users.filter((user) => user.isActive);
```

Full code: [examples/core.md](examples/core.md#pattern-2-named-predicates-transforms-and-constants)

### Pattern 3: Guard Clauses

Invert each precondition and return early. The happy path then runs at zero nesting, and every line below the guards can assume them.

```typescript
function getDiscount(user: User, cart: Cart): number {
  if (!user.isActive) return 0;
  if (cart.items.length === 0) return 0;
  if (!user.membership) return STANDARD_DISCOUNT;

  return calculateMemberDiscount(user.membership, cart.total);
}
```

Full code: [examples/core.md](examples/core.md#pattern-3-guard-clauses)

### Pattern 4: Discriminated Unions With an Exhaustive Switch

Give each state its own variant carrying only its own fields, and end the `switch` with a `never` default. A new variant then fails compilation at every switch that does not handle it, and the error names the variant.

```typescript
function handleTaskEvent(event: TaskEvent): void {
  switch (event.kind) {
    case "started":
      return markRunning(event.startedAt);
    case "failed":
      return reportFailure(event.error);
    default: {
      const unhandled: never = event;
      return unhandled;
    }
  }
}
```

Full code: [examples/core.md](examples/core.md#pattern-4-discriminated-unions-with-an-exhaustive-switch)

### Pattern 5: Async Orchestrators

Await in sequence only where a step reads the previous step's result, and start independent steps together with `Promise.all`. The code then says which steps depend on which, and the wait is the longest step rather than the sum of them.

```typescript
async function onboardNewUser(input: OnboardInput): Promise<OnboardResult> {
  const user = await createUserRecord(input);

  const [profile, settings] = await Promise.all([
    initializeProfile(user.id, input.preferences),
    applyDefaultSettings(user.id),
  ]);

  await sendWelcomeEmail(user.email, profile.displayName);
  return { user, profile, settings };
}
```

Full code: [examples/core.md](examples/core.md#pattern-5-async-orchestrators)

### Pattern 6: `as const satisfies` for Configuration

`as const` keeps every literal; `satisfies` then checks the shape without widening it. A misspelled field fails compilation, and `ROUTES.home.path` types as `"/"` rather than `string`.

Under mutation testing it costs the constant all its mutants: StrykerJS (as of 10.1.1) makes none inside `as const`, and its report does not say so. Keep the pattern for constants whose literal types are read, as `keyof typeof ROUTES` reads them below; elsewhere a type annotation or `satisfies` alone checks the same shape and is still mutated.

```typescript
const ROUTES = {
  home: { path: "/", auth: false },
  dashboard: { path: "/dashboard", auth: true },
} as const satisfies Record<string, RouteConfig>;

type RouteName = keyof typeof ROUTES; // "home" | "dashboard"
```

Full code: [examples/core.md](examples/core.md#pattern-6-as-const-satisfies-for-configuration)

### Pattern 7: Collection Operations Named for the Concept

Where the manual version is a loop with an accumulator, call a function whose name is the operation. Where one array method already reads, keep the method.

```typescript
// Named for the operation a manual loop would hide
const byCategory = Object.groupBy(skills, (skill) => skill.category);

// One method, already clear: no helper and no library
const names = skills.map((skill) => skill.name);
```

Full code: [examples/data-transforms.md](examples/data-transforms.md#pattern-7-collection-operations-named-for-the-concept)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- Passing a function reference to `map`, `filter` or `forEach` when the function takes an optional second parameter — the array method calls it with `(element, index, array)`, so `["1", "2", "3"].map(parseInt)` is `[1, NaN, NaN]`, and TypeScript accepts it. Pass a reference only to a helper written for that array; wrap anything else: `.map((value) => parseInt(value, 10))`.
- Helpers below their caller written as `const` arrow functions, with the orchestrator called while the module is still loading — a `const` cannot be read before its line has run, so the call throws `ReferenceError`. `function` declarations are hoisted, which is what lets them sit at the bottom of the file.
- `Promise.all` where every outcome matters — it rejects with the first rejection, the other operations keep running, and their later failures are dropped. Use `Promise.allSettled` when the caller needs each result.
- A `never` default that returns the value, on data that was asserted into its type rather than validated — the compiler's guarantee stops at the assertion, so at runtime the unexpected value is handed back to the caller. Throw from the default there.
- A `switch` over a union with no `never` default — a new variant falls through silently. The compiler reports it only when every case returns from a function with an annotated return type (TS2366, which names the missing return rather than the variant); a `void` handler, a switch that assigns or calls before the function returns, and an unannotated function without `noImplicitReturns` all compile. End every such switch with the `never` default.

**Surprising behaviour:**

- A `default` that returns a fallback in place of the `never` check — every new variant lands in the fallback, so the compiler has nothing to report.
- `satisfies Shape as const` does not compile — a const assertion applies only to a literal, and a `satisfies` expression is not one. Write `as const satisfies Shape`.
- Assigning the `never` value without reading it — `noUnusedLocals` and unused-variable lint rules report it. Returning it is a read.
- `Object.groupBy` returns a null-prototype object whose keys are all optional, so each group types as `T[] | undefined`.

**Costs the reader:**

- A variable named for how it was made (`filteredMappedItems`) rather than what it holds (`activeDisplayRecords`) — the reader re-derives the meaning the name could have stated.
- A function body wrapped in one `if` — invert it into a guard that returns, and the body loses a level.
- A shared `utils` file — it becomes the place nothing belongs. Put a helper at the bottom of the file whose orchestrator it serves or, when several files call it, in a module named for its domain beside those callers — never interspersed with the orchestrators it serves.
- A named constant as complex as the expression it replaces.

</red_flags>
