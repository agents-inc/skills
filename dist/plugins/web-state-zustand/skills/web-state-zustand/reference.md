# Zustand - Reference

> Lookup only. Decisions and red flags are in [SKILL.md](SKILL.md); full code is in [examples/core.md](examples/core.md).

---

## Import paths

| Symbol                 | Import from             | Used for                                                |
| ---------------------- | ----------------------- | ------------------------------------------------------- |
| `create`               | `zustand`               | building a store                                        |
| `devtools`, `persist`  | `zustand/middleware`    | inspection, and storage that outlives the tab           |
| `useShallow`           | `zustand/react/shallow` | one subscription covering several fields                |
| `createWithEqualityFn` | `zustand/traditional`   | the v4 equality-function call shape, kept for migration |

---

## v5 migration notes

| What changed                         | v4                                      | v5                                                                           |
| ------------------------------------ | --------------------------------------- | ---------------------------------------------------------------------------- |
| Comparing several fields in one read | `create(fn, shallow)` — equality fn arg | `useShallow(selector)`, or `createWithEqualityFn` from `zustand/traditional` |
| Selector return values               | unstable references tolerated           | must be stable, or the render loops                                          |
| `persist` and initial state          | captured at creation                    | not captured; set it afterwards with `setState`                              |

The v4 equality-function argument is not deprecated in v5 — it is gone. A call still passing it type-checks against nothing and compares nothing, so the symptom is extra renders rather than an error.

---

## Requirements

- React 18 or later, TypeScript 4.5 or later
- `use-sync-external-store` is a peer dependency only for `zustand/traditional`; the main entry point does not need it
