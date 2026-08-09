---
name: web-tooling-component-library
description: Packaging React components as a consumable library — style delivery contracts, sideEffects, cascade layers, "use client" preservation, peer dependency ranges, server-safe vs client entries
---

# Component Library Packaging

> **Quick Guide:** This is the package boundary for UI code — everything that changes when styled, client-interactive React components stop being app files and become something another project installs. Five contracts have to be explicit: how styles reach the consumer, what cascade layer they land in, whether `"use client"` survives your build, what you demand of the consumer's React, and how many entries you expose. Every one of them fails silently in your own repo and loudly in someone else's.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST list every stylesheet in `sideEffects` — `"sideEffects": false` on a package that ships CSS deletes the CSS from the consumer's production build)**

**(You MUST put `"use client"` on leaf client modules only, and VERIFY it is still the first line of the matching `dist/` files — bundlers drop module-level directives unless the output is one file per module)**

**(You MUST declare `react` and `react-dom` as `peerDependencies` with a range covering every major you support — `react` in `dependencies` gives the consumer two Reacts)**

**(You MUST publish library CSS inside a named cascade layer — unlayered library styles beat the consumer's unlayered app styles only by specificity, which starts a war you cannot win)**

**(You MUST expose a server-safe entry separately from client entries — one barrel with any client directive in its graph makes the whole library client-only)**

</critical_requirements>

---

**Auto-detection:** component library packaging, publishing a UI package, sideEffects, "use client" stripped, directive not preserved, preserveModules, unbundle, cascade layer for library styles, `@layer`, peerDependencies react, invalid hook call, two copies of React, server-safe entry, client entry, styles missing in production, consumer cannot override styles

**When to use:**

- Turning a folder of components into a package another project installs
- Deciding whether to ship compiled CSS, inject styles at runtime, or ship class names only
- A consumer reports missing styles, unoverridable styles, duplicate React, or a server-component crash
- Adding a client-interactive component to a package that a server-components app consumes
- Deciding whether an internal package is consumed as source or as build output

**When NOT to use — these are owned elsewhere:**

| Topic                                                                                                     | Owner                               |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `exports` map mechanics, conditions, subpath patterns, tsconfig, tree-shaking mechanics, workspace naming | `shared-monorepo-turborepo`         |
| Versioning, changelogs, release and publish workflow                                                      | `shared-tooling-changesets`         |
| Bundler configuration at large (aliases, chunking, targets)                                               | `web-tooling-vite`                  |
| Component API design, props, composition                                                                  | `meta-design-composable-components` |

**Key patterns covered:**

- Style delivery: compiled stylesheet vs runtime injection vs utility-native
- The `@layer` contract that makes consumer overrides win by design
- `"use client"` placement, preservation through bundling, and dist verification
- The consumption contract: peers vs dependencies, source-consumed vs built packages
- Entry granularity: server-safe entries vs client entries

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Complete manifests, the layered stylesheet, a directive-preserving build with its verification script, peer ranges, and the server/client entry split

---

<philosophy>

## Philosophy

An app owns its whole pipeline. A package owns none of it. Everything a component relied on implicitly — that the bundler would see the CSS import, that the file boundaries would survive, that there is exactly one React — becomes a **contract you have to state in `package.json` and in your build output**.

The defining property of these five contracts is that **they all pass in the repo that builds them**. Your demo app imports source, so the directive is there. Your dev server does not tree-shake, so the CSS is there. Your repo has one React, so hooks work. Every failure is deferred to a stranger's build, which is why the verification step is part of the pattern rather than an afterthought.

**When to reach for this skill:**

- The code is about to cross a package boundary, published or workspace-internal
- Someone consuming your package sees behavior you cannot reproduce

**When NOT to:**

- Application code that is only ever imported by its own app — none of these contracts apply
- Pure, style-free, server-safe utilities — those are ordinary packages, not UI packages

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Pick One Style Delivery Contract and Publish It

There are exactly three ways styles reach a consumer, and the choice is a public API decision: it dictates what the consumer must do at install time and can only be changed in a major.

#### Compiled stylesheet the consumer imports

You ship a `.css` file; the consumer imports it once. The failure mode is tree-shaking: a CSS import binds no names, so a bundler told the package is side-effect-free prunes it and ships unstyled components — **in production only**, because dev builds do not tree-shake.

```json
{
  "sideEffects": ["**/*.css", "./dist/register-icons.js"]
}
```

**Why good:** the array marks exactly the modules whose evaluation matters, so the stylesheet survives production tree-shaking while the rest of the package stays prunable. Patterns without a `/` are expanded (`*.css` behaves as `**/*.css`), and a JS module that only registers something globally has to be listed too — it has no exports for the bundler to keep it alive by.

```json
{
  "sideEffects": false
}
```

**Why bad:** copied from a pure-utility package template, this states the package can be dropped wholesale when nothing is imported by name — the stylesheet is exactly that. Consumer's dev build looks right, consumer's production build renders unstyled components, and nothing warns.

#### Runtime injection

The JS inserts a `<style>` element when the module evaluates. No import step for the consumer, at the cost of three things: **SSR** — markup is streamed before the style element exists, so unstyled content flashes unless the runtime supports extraction; **CSP** — injected style elements need `style-src 'unsafe-inline'` or nonce plumbing the consumer must wire; **ordering** — insertion order is module evaluation order, which code splitting reorders, so the cascade can differ between dev and production for identical source. Injection is itself a side effect, so `sideEffects` still has to cover the injecting modules.

#### Utility-CSS-framework-native

You ship class names and no CSS at all; the consumer's utility framework generates the rules. Zero CSS payload and the consumer's tokens apply automatically — in exchange you inherit their configuration:

- The consumer must add your **published** path (`node_modules/your-lib/dist/**/*.js`) to their content/source scanning, or none of your classes are generated.
- Your dist must contain complete, statically analyzable class strings. Runtime concatenation (`` `p-${size}` ``) produces nothing, because the scanner reads text, not semantics.
- If you ship a preset or plugin, its major must match the consumer's framework major — you have coupled your release cadence to theirs.

---

### Pattern 2: The `@layer` Contract

Consumer overrides should win because of where your styles sit in the cascade, not because the consumer out-specified you. Cascade layers make that structural.

Three facts drive the whole pattern: **unlayered styles always beat layered styles, whatever the specificity**; layer precedence follows the order in which layers are first declared, last wins; and `!important` reverses that order.

```css
/* your-lib/styles.css — the library declares its own internal order first */
@layer your-lib.base, your-lib.components;

@layer your-lib.components {
  .btn {
    padding: var(--btn-padding);
    background: var(--btn-bg);
  }
}
```

**Why good:** the consumer's ordinary app CSS is unlayered, so `.btn { background: red }` in their stylesheet wins over your `.btn` without a single `!important` — that is the cascade doing the work. Sub-layers give you internal ordering (base before components) without leaking more than one name into the consumer's namespace.

A consumer who wants explicit control assigns the layer at import time, which is why documenting the layer order you expect is part of the deliverable:

```css
/* consumer's entry stylesheet */
@layer vendor, app;
@import "your-lib/styles.css" layer(vendor);
```

A layer statement is one of the only rules allowed **before** `@import` (alongside `@charset`), which is what makes declaring the order up front possible at all.

```css
/* published library CSS, unlayered, escalating to win */
.btn.btn.btn-primary {
  background: var(--btn-bg) !important;
}
```

**Why bad:** with no layer you are competing on specificity against code you cannot see, so you escalate; the consumer escalates further; the package ends up with `!important` on every declaration and consumers fork it to restyle a button. Note the second trap: `!important` **inside** a layer is inverted — an important declaration in your earlier layer beats the consumer's important declaration in a later one, so the escape hatch you left them does not work either.

---

### Pattern 3: `"use client"` Through the Pipeline

`"use client"` must be the first thing in the file, above imports, in single or double quotes. It marks that module **and its transitive imports** as client code, drawing the boundary on the module dependency tree — not the render tree.

That transitivity is why the directive goes on leaf modules that genuinely need client features (state, effects, event handlers, browser APIs) and never on a root barrel: a directive on the barrel pulls every module the barrel touches across the boundary.

The second half is survival. A directive is a property of a _module_; a bundler that merges modules into one chunk can only drop it or apply it to the entire chunk. So the mechanism for preserving it is always the same — **one output file per source module**:

| Build tool                                  | Directive when bundling         | Per-file output                                                |
| ------------------------------------------- | ------------------------------- | -------------------------------------------------------------- |
| Rollup-family (including library-mode Vite) | Stripped, with a warning        | `output.preserveModules` **plus** a preserve-directives plugin |
| Rolldown                                    | Emitted only from entry modules | `output.preserveModules`                                       |
| tsdown                                      | Follows Rolldown                | `unbundle: true`                                               |
| esbuild / tsup                              | Stripped                        | A preserve-directives esbuild plugin                           |

```js
// rollup.config.js
export default {
  output: { dir: "dist", format: "es", preserveModules: true },
  plugins: [preserveDirectives()],
  onwarn(warning, warn) {
    if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
    warn(warning);
  },
};
```

**Why good:** per-file output keeps each module's directive attached to its own file, the plugin stops the strip, and the `onwarn` filter silences the warning the setup deliberately provokes instead of training you to ignore all warnings.

```js
// "fixing" it with a banner
export default {
  output: { dir: "dist", format: "es", banner: '"use client";' },
};
```

**Why bad:** the banner applies to every emitted file, so your pure helpers and presentational components are all client modules now. The consumer's server components silently become client components — nothing errors, the bundle just gets bigger and the server rendering benefit disappears.

Because stripping is silent, **verification is part of the pattern**. Compare source to output before publishing, in CI:

```bash
# source modules that declare the directive
grep -rl "^[\"']use client" src | wc -l

# dist files whose FIRST line is the directive — the two counts must match
find dist -name "*.js" -exec head -1 {} + | grep -c "use client"
```

Minification can undo the work after your bundler got it right — a minifier that treats directives as dead string statements removes them, so disable that (in terser, `compress.directives: false`) and re-run the check on the minified output, not the intermediate.

---

### Pattern 4: The Consumption Contract

#### Peers vs dependencies

```json
{
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "react": "19.2.8",
    "react-dom": "19.2.8"
  }
}
```

**Why good:** hooks only work when the app's `react` import and the `react` import inside `react-dom` resolve to the same module. A peer says "the host supplies this", so one copy is installed and shared; a `devDependency` pins what you actually build and test against without imposing it. The range spans both majors in real deployment (React 19.x is current, React 18 is still widely installed). Since npm 7, peers are _installed_ rather than merely warned about, so a range narrower than the truth is an `ERESOLVE` install failure in the consumer's project, not a warning they can ignore.

```json
{
  "dependencies": {
    "react": "^19.2.8"
  }
}
```

**Why bad:** the consumer now gets a second React nested under your package. Every hook your components call throws "Invalid hook call", context created by one copy is invisible to the other, and the error message points at their code. `npm ls react` showing more than one entry is the diagnosis. The same duplication appears temporarily under `npm link` during local development even when the manifest is correct — check the manifest before rewriting components.

**The rule:** anything that must be a singleton because it carries identity — the renderer, context providers, a plugin registry — is a peer. A leaf utility with no identity, that is safe to duplicate, is a dependency. Use `peerDependenciesMeta` `optional` for peers only needed by a specific entry, so consumers who never import that entry are not forced to install it.

#### Source-consumed vs built packages

| Consumed as                                   | Right when                                                                                                                                             | Wrong when                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Source** (`exports` points at `.ts`/`.tsx`) | Every consumer lives in the same repo and shares one build and TS config — no build step, no stale dist, types are the real types, one place to change | Anything published to a registry, any consumer that does not transpile `node_modules`, any consumer on a different TS version or JSX runtime |
| **Built** (`exports` points at `dist/`)       | The package is published, or consumers have independent builds                                                                                         | Never wrong, but it costs a build step, a dist-staleness failure mode, and the directive/sideEffects verification above                      |

The trap is drifting between them: a package consumed as source in-repo and published from the same manifest ships whichever the `exports` map names, and the mismatch surfaces as syntax errors in someone else's build. Pick one per package. Field mechanics for the map itself — conditions, ordering, subpath patterns — are `shared-monorepo-turborepo`.

---

### Pattern 5: Entry Granularity

One barrel is the cheapest thing to publish and the most expensive thing to consume. Anything client-only anywhere in its graph makes the entire entry client-only for everyone who imports it, because the boundary follows module imports.

```jsonc
{
  "exports": {
    ".": "./dist/index.js", // server-safe: types, pure helpers, presentational components
    "./client": "./dist/client/index.js", // carries the "use client" leaves
    "./styles.css": "./dist/styles.css",
  },
}
```

**Why good:** the split is visible in the specifier the consumer writes, so the boundary is enforced by their import rather than by a comment in your source. A server component can import from `your-lib` and stay on the server; only the interactive parts opt in.

**Why a single barrel is bad:** re-exporting everything from `.` means one interactive component drags your entire library into the client bundle of every consumer, and there is no way for them to opt out short of deep-importing paths you did not publish. The same barrel also defeats tree-shaking the moment `sideEffects` marks anything in its graph as side-effectful — which Pattern 1 requires it to.

Keep the split honest: a "server-safe" entry that transitively imports a client leaf is not server-safe. The verification in Pattern 3 catches this — if a directive appears in a `dist` file reachable from `.`, the entry is mislabeled.

</patterns>

---

<decision_framework>

## Decision Framework

### Which style delivery contract

```
Does the consumer already run a utility CSS framework you can target?
├─ YES → Do you control (or can you document) their content/source scanning config?
│   ├─ YES → Utility-native: ship class names, no CSS ✓
│   └─ NO  → Compiled stylesheet (do not depend on config you cannot see)
└─ NO  → Must styles work without any consumer import step?
    ├─ YES → Is the consumer server-rendering, or running a strict CSP?
    │   ├─ YES → Compiled stylesheet (injection flashes and needs nonces) ✓
    │   └─ NO  → Runtime injection (accept non-deterministic ordering)
    └─ NO  → Compiled stylesheet + sideEffects + a named layer ✓ (the default)
```

### Peer or dependency

```
Would two copies of this package in one app be a bug?
├─ YES (carries identity: renderer, context, registry) → peerDependencies
│   └─ Only needed by one entry? → add peerDependenciesMeta optional
└─ NO (leaf utility, safe to duplicate) → dependencies
```

### Source-consumed or built

```
Is the package published to a registry?
├─ YES → Built. Verify directives and sideEffects in dist ✓
└─ NO  → Do all consumers share this repo's build and TS config?
    ├─ YES → Source-consumed (no build step, no staleness) ✓
    └─ NO  → Built
```

### Entry split

```
Does any module in this entry's graph need client features?
├─ NO  → Single entry is fine
└─ YES → Is the library consumed by a server-components app?
    ├─ YES → Split: server-safe "." + "./client" ✓
    └─ NO  → Split anyway if the client part is a minority of the bundle
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- `"sideEffects": false` on a package that ships or injects styles — production builds prune the stylesheet and consumers get unstyled components; dev builds look fine, so this ships
- A directive that works in the repo's demo app but not in the published package — the demo imports source, the consumer imports `dist`. The consumer's server-components build throws on the first hook, in code they did not write
- `react` or `react-dom` in `dependencies` — the consumer installs a second React, every hook throws "Invalid hook call", and context stops crossing the boundary
- Library CSS published unlayered — consumers cannot override without out-specifying you, so the package accumulates `!important` and gets forked
- One barrel entry containing a client leaf — the whole library becomes client-only for every consumer, silently inflating their bundle
- Pinning a peer to an exact version (`"react": "19.2.8"`) — since npm 7 that is an install-blocking `ERESOLVE` for anyone on a different patch, not a warning

**Medium Priority Issues:**

- `output.banner` used to add `"use client"` — every emitted file becomes a client module; it looks like the directive was preserved and it was not
- Runtime injection shipped to a consumer with a strict CSP or SSR, without saying so in the README
- Utility-native delivery whose classes are built at runtime (`` `p-${size}` ``) — the scanner reads text, so nothing is generated
- A "server-safe" entry that transitively imports a client leaf — mislabeled, and only the dist check catches it
- Drifting between source-consumed and built for the same package — consumers get whichever `exports` names, and the mismatch surfaces as syntax errors elsewhere

**Gotchas & Edge Cases:**

- `!important` inside a cascade layer inverts precedence: your important declaration in an earlier layer beats the consumer's in a later one, so it defeats the override path you documented
- Minification can strip directives _after_ the bundler preserved them — verify the minified output, not the intermediate (in terser, `compress.directives: false`)
- `sideEffects` glob patterns without a `/` are expanded, so `"*.css"` and `"**/*.css"` behave identically — the common failure is omitting the entry, not writing the wrong glob
- Side-effectful JS (global registration, polyfills, injection) needs listing in `sideEffects` too — it has no named exports to keep it alive
- A layer statement (`@layer a, b;`) is one of the few rules allowed before `@import`; anything else before `@import` makes the import silently ignored
- `@import "lib.css" layer(vendor)` lets the consumer assign the layer without the library layering itself — document it, but self-layer anyway, since only self-layering is guaranteed
- Duplicate React under `npm link` is a linking artifact, not a manifest bug — check `npm ls react` and the manifest before changing component code
- A directive must be the first statement, above imports, in single or double quotes — backticks do not count and fail silently
- The published path, not the source path, goes in a consumer's content/source scanning config — pointing at `src` works locally and generates nothing after install

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST list every stylesheet in `sideEffects` — `"sideEffects": false` on a package that ships CSS deletes the CSS from the consumer's production build)**

**(You MUST put `"use client"` on leaf client modules only, and VERIFY it is still the first line of the matching `dist/` files — bundlers drop module-level directives unless the output is one file per module)**

**(You MUST declare `react` and `react-dom` as `peerDependencies` with a range covering every major you support — `react` in `dependencies` gives the consumer two Reacts)**

**(You MUST publish library CSS inside a named cascade layer — unlayered library styles beat the consumer's unlayered app styles only by specificity, which starts a war you cannot win)**

**(You MUST expose a server-safe entry separately from client entries — one barrel with any client directive in its graph makes the whole library client-only)**

**Failure to follow these rules ships a package that works in your repo and breaks in every consumer's: unstyled in production, crashing on the first hook, or client-only from end to end.**

</critical_reminders>
