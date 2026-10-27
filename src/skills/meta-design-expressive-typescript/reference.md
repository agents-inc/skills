# Expressive TypeScript Reference

> Refactoring moves at a glance, and what each compiler check needs. Decisions and red flags are in [SKILL.md](SKILL.md); full code is in [examples/](examples/).

---

## Common Refactoring Moves

| Before (requires simulation)                                                | After (reads like prose)                           |
| --------------------------------------------------------------------------- | -------------------------------------------------- |
| `x.filter(i => i.a && !i.b && i.c > 5)`                                     | `x.filter(isEligible)`                             |
| `x.map(i => ({ ...i, name: i.f + " " + i.l }))`                             | `x.map(toDisplayRecord)`                           |
| `Object.entries(x).reduce((acc, [k,v]) => ...)`                             | `Object.groupBy(Object.entries(x), fn)`            |
| `a.filter(x => !b.includes(x))`                                             | `difference(a, b)`                                 |
| `const t = []; for (const i of x) { if (p(i)) t.push(i); else o.push(i); }` | `partition(x, p)`                                  |
| Long function mixing validation + transform + assembly                      | Orchestrator + pure functions                      |
| `if (a) { if (b) { if (c) { ... } else { ... } } }`                         | Guard clauses: `if (!a) return; if (!b) return;`   |
| `if (status === "a") ... else if (status === "b") ...`                      | Discriminated union + exhaustive `switch`          |
| Sequential `await` on independent operations                                | `Promise.all([op1(), op2()])`                      |
| `const config: Config = { ... }` whose literal types are needed             | `const config = { ... } as const satisfies Config` |

---

## What Each Compiler Check Needs

- **A `never` default in a `switch`** — an unhandled variant fails at the default with TS2322, "Type '…' is not assignable to type 'never'", which names the variant. It holds whatever each case does — returns, assigns or only calls.
- **An annotated return type, no `never` default** — a missed case fails with TS2366, "Function lacks ending return statement and return type does not include 'undefined'", only when every case returns and the switch ends the function. Needs `strictNullChecks`, and does not name the case.
- **No annotated return type, `noImplicitReturns` on** — a missed case fails with TS7030, "Not all code paths return a value".
- **`as const satisfies Shape`** — a value that does not match `Shape` fails, and the literal types survive. `satisfies` needs TypeScript 4.9 or later.
- **`Object.groupBy` and `Map.groupBy`** — declared under `lib: es2024` from TypeScript 5.7, and under `esnext` from 5.4.
