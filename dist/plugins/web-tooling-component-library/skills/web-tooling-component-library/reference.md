# Component Library Packaging Reference

> Lookup tables behind the five contracts. See [SKILL.md](SKILL.md) for the decisions and red flags, and [examples/core.md](examples/core.md) for the complete artifacts.

---

## Directive preservation by build tool

A module-level directive can only survive when the output keeps one file per source module — a bundler that merges modules can either drop the directive or apply it to the whole chunk, and nothing else.

| Build tool                                    | Directive when bundling         | Per-file output                                                |
| --------------------------------------------- | ------------------------------- | -------------------------------------------------------------- |
| Rollup-family, including library builds on it | Stripped, with a warning        | `output.preserveModules` **plus** a preserve-directives plugin |
| Rolldown                                      | Emitted only from entry modules | `output.preserveModules`                                       |
| tsdown                                        | Follows Rolldown                | `unbundle: true`                                               |
| esbuild and wrappers over it                  | Stripped                        | A preserve-directives esbuild plugin                           |

---

## Source-consumed vs built

| Consumed as                                   | Right when                                                                                                                                             | Wrong when                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Source** (`exports` points at `.ts`/`.tsx`) | Every consumer lives in the same repo and shares one build and TS config — no build step, no stale dist, types are the real types, one place to change | Anything published to a registry, any consumer that does not transpile `node_modules`, any consumer on a different TS version or JSX runtime |
| **Built** (`exports` points at `dist/`)       | The package is published, or consumers have independent builds                                                                                         | Never wrong, but it costs a build step, a dist-staleness failure mode, and the directive and `sideEffects` verification                      |

Pick one per package. A package consumed as source in-repo and published from the same manifest ships whichever the `exports` map names, and the mismatch surfaces as syntax errors in someone else's build.

---

## `sideEffects` glob semantics

- A pattern without a `/` is expanded, so `"*.css"` and `"**/*.css"` behave identically — the usual defect is an omitted entry rather than a wrong glob
- The JS that needs listing alongside the stylesheets: global registration, polyfills, and style injection
