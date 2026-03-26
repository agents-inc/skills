# Expressive TypeScript Quick Reference

> Quick-reference cheat sheet for expressive, readable TypeScript patterns. See [SKILL.md](SKILL.md) for core patterns and [examples/](examples/) for full before/after examples.

---

## The Readability Test

> **"Can someone understand the code's flow without mentally simulating any of its parts?"**
>
> **YES** -> Leave it alone. **NO** -> Extract to a named function or constant.

---

## The Two-Tier Pattern

```
Orchestrator (Top Tier)          Pure Functions (Bottom Tier)
---------------------------      ---------------------------
1. Guard clauses / early exits   Each does ONE thing
2. Named function calls          Named for PURPOSE, not mechanism
3. Assembly / return             Independently testable
NO inline transformations        Placed at bottom of file or shared module
```

---

## Extraction Decision Table

| Situation                                   | Extract? | Reason                    |
| ------------------------------------------- | -------- | ------------------------- |
| Block requires mental simulation            | YES      | Name communicates intent  |
| Same logic in 2+ places                     | YES      | DRY + readability         |
| Named function adds clarity over expression | YES      | Name IS the documentation |
| Deeply nested if/else (3+ levels)           | YES      | Flatten to guard clauses  |
| Sequential await on independent operations  | YES      | Group into `Promise.all`  |
| Single clear expression (`.map(x => x.id)`) | NO       | Already readable          |
| Name would be as complex as implementation  | NO       | Indirection without value |
| Trivially simple boolean check              | NO       | Over-extraction           |

---

## Named Abstraction Types

| Type                    | When to Use                                       | Example                                                                |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| **Named predicate**     | Filter/conditional logic requires simulation      | `isContentAddition(line)`                                              |
| **Named constant**      | Setup value needs context to understand           | `REACT_WITH_CONFLICTS`                                                 |
| **Named transform**     | Map/formatting logic is multi-line                | `formatInstallResult(r)`                                               |
| **Named grouping**      | Reduce builds a lookup structure                  | `groupSkillsByCategory(skills)`                                        |
| **Guard clause**        | Nested if/else with 3+ levels                     | `if (!user.isActive) return;`                                          |
| **Discriminated union** | Value has fixed set of states with different data | `type Result = { status: "ok"; data } \| { status: "error"; message }` |

---

## Utility Library: Use vs Don't Use

### USE a utility function when the name IS the documentation

| Function                  | Intent                         | Clearer than                                       |
| ------------------------- | ------------------------------ | -------------------------------------------------- |
| `groupBy(items, fn)`      | Group array into keyed object  | Manual reduce with accumulator                     |
| `countBy(items, fn)`      | Count occurrences per category | Manual for-loop with counter                       |
| `difference(a, b)`        | Items in A not in B            | `.filter(x => !b.includes(x))`                     |
| `partition(items, fn)`    | Split into [match, noMatch]    | Two separate filters or manual push                |
| `indexBy(items, fn)`      | Array to keyed lookup          | Manual reduce to build Record                      |
| `mapValues(obj, fn)`      | Transform all values in object | `Object.fromEntries(Object.entries(...).map(...))` |
| `sortBy(items, ...rules)` | Multi-key sorting              | Chained comparators in `.sort()`                   |
| `pipe(data, ...fns)`      | 3+ chained transforms          | Deeply nested calls or many intermediates          |

### DON'T USE a utility function when plain JS is already clear

| Plain JS              | Already Clear           | Don't Replace With             |
| --------------------- | ----------------------- | ------------------------------ |
| `items.map(fn)`       | Single transform        | `pipe(items, map(fn))`         |
| `items.filter(fn)`    | Single filter           | `pipe(items, filter(fn))`      |
| `items.find(fn)`      | Single lookup           | Utility library find           |
| `items.some(fn)`      | Existence check         | Utility library some           |
| `items.reduce(fn, 0)` | Simple sum/accumulation | `sumBy` for trivial cases      |
| `a.filter().map()`    | Two-step chain          | `pipe(a, filter(fn), map(fn))` |

---

## Orchestrator Anatomy

```typescript
function processItems(input: Input): Output {
  // 1. GUARDS: validate and exit early
  if (!input.items.length) return EMPTY_RESULT;

  // 2. STEPS: named function calls
  const validated = input.items.filter(isValid);
  const transformed = validated.map(toOutputFormat);
  const grouped = groupByCategory(transformed);

  // 3. ASSEMBLY: combine results
  return {
    groups: grouped,
    total: transformed.length,
    skipped: input.items.length - validated.length,
  };
}

// Pure functions

function isValid(item: Item): boolean {
  /* ... */
}
function toOutputFormat(item: Item): OutputItem {
  /* ... */
}
function groupByCategory(items: OutputItem[]): Record<string, OutputItem[]> {
  /* ... */
}
```

---

## Common Refactoring Moves

| Before (requires simulation)                                                | After (reads like prose)                           |
| --------------------------------------------------------------------------- | -------------------------------------------------- |
| `x.filter(i => i.a && !i.b && i.c > 5)`                                     | `x.filter(isEligible)`                             |
| `x.map(i => ({ ...i, name: i.f + " " + i.l }))`                             | `x.map(toDisplayRecord)`                           |
| `Object.entries(x).reduce((acc, [k,v]) => ...)`                             | `groupBy(x, fn)` or `groupItemsByKey(x)`           |
| `a.filter(x => !b.includes(x))`                                             | `difference(a, b)`                                 |
| `const t = []; for (const i of x) { if (p(i)) t.push(i); else o.push(i); }` | `partition(x, p)`                                  |
| Long function mixing validation + transform + assembly                      | Orchestrator + pure functions                      |
| `if (a) { if (b) { if (c) { ... } else { ... } } }`                         | Guard clauses: `if (!a) return; if (!b) return;`   |
| `if (status === "a") ... else if (status === "b") ...`                      | Discriminated union + exhaustive `switch`          |
| Sequential `await` on independent operations                                | `Promise.all([op1(), op2()])`                      |
| `const config: Config = { ... }`                                            | `const config = { ... } as const satisfies Config` |
