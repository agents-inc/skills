---
name: web-tooling-component-library
description: Packaging React components as a consumable library — style delivery contracts, sideEffects, cascade layers, "use client" preservation, peer dependency ranges, server-safe vs client entries
---

# Component Library Packaging

> **Quick Guide:** This is the package boundary for UI code — what changes when styled, client-interactive React components stop being app files and become something another project installs. Five contracts have to be stated rather than assumed: how styles reach the consumer, what cascade layer they land in, whether `"use client"` survives the build, what you demand of the consumer's React, and how many entries you expose. Each of them passes in the repo that builds it and fails in someone else's.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — complete manifests, the layered stylesheet, a directive-preserving build with its verification script, peer ranges, and the server/client entry split
- [reference.md](reference.md) — directive preservation by build tool, source-consumed vs built comparison, `sideEffects` glob semantics

---

## Which path applies

- **Published to a registry, or consumed by a build you do not control** — all five contracts apply, and the verification steps are the only thing standing between a green local build and a consumer's broken one.
- **Consumed as source inside one repository**, where every consumer shares this build and TS config — the style, layer, peer and entry contracts still apply; the directive and `sideEffects` contracts are about build output and have nothing to act on yet. Drifting from here to publication is what ships a manifest whose `exports` names files the package does not contain.

---

<critical_requirements>

## Before packaging a component library

**List every stylesheet in `sideEffects`.** A CSS import binds no names, so `"sideEffects": false` on a package that ships CSS lets a production bundler prune it — and dev builds do not tree-shake, so the consumer sees this only after release.

**Put `"use client"` on leaf client modules and verify it survived into `dist/`.** The directive is a property of a module, so a bundler that merges modules can only drop it or apply it to everything; stripping is silent.

**Declare `react` and `react-dom` as `peerDependencies`, with a range covering every major you support.** A peer is supplied by the host, so one copy is installed; in `dependencies` the consumer gets a second React and every hook throws.

**Publish library CSS inside a named cascade layer.** Unlayered styles beat layered ones regardless of specificity, so a consumer's ordinary CSS wins by design instead of by out-specifying you.

**Expose a server-safe entry separately from client entries.** The boundary follows the module graph, so one client leaf in a single barrel makes the whole library client-only for everyone who imports it.

</critical_requirements>

---

**Auto-detection:** sideEffects, "use client" stripped, preserveModules, preserve-directives, unbundle, MODULE_LEVEL_DIRECTIVE, cascade layer for library styles, `@layer`, peerDependencies react, peerDependenciesMeta, "Invalid hook call", two copies of React, server-safe entry, client entry, styles missing in production, consumer cannot override styles, publishing a UI package

**Applies to:**

- Turning a folder of components into a package another project installs
- Choosing between a compiled stylesheet, runtime injection, and shipping class names only
- A consumer reporting missing styles, unoverridable styles, duplicate React, or a server-component crash
- Adding a client-interactive component to a package a server-components app consumes
- Deciding whether an internal package is consumed as source or as build output

**Handled elsewhere:**

- `exports` map mechanics — conditions, ordering, subpath patterns — and workspace layout
- Version ranges, changelogs and the release itself; this skill decides what the manifest must say, not when it is published
- Bundler configuration at large: aliases, chunking, targets, dev server
- Component API design — props, composition, and what the components do

---

<philosophy>

An app owns its whole pipeline. A package owns none of it. Everything a component relied on implicitly — that the bundler would see the CSS import, that module boundaries would survive, that there is exactly one React — becomes a contract stated in `package.json` and in the build output.

What makes these five hard is that they all pass in the repo that builds them. The demo app imports source, so the directive is there. The dev server does not tree-shake, so the CSS is there. The repo has one React, so hooks work. Every failure is deferred to a stranger's build, which is why verification is part of each pattern rather than a step after them.

</philosophy>

---

<decision_framework>

## Style delivery

```
Does the consumer already run a utility CSS framework you can target?
├─ YES → Can you document the content/source scanning they must add?
│   ├─ YES → Ship class names, no CSS ✓
│   └─ NO  → Compiled stylesheet — never depend on config you cannot see
└─ NO  → Must styles apply with no import step from the consumer?
    ├─ YES → Server-rendered, or a strict CSP?
    │   ├─ YES → Compiled stylesheet — injection flashes and needs nonces ✓
    │   └─ NO  → Runtime injection, accepting non-deterministic order
    └─ NO  → Compiled stylesheet + sideEffects + a named layer ✓ (the default)
```

## Peer or dependency

```
Would two copies of this package in one app be a bug?
├─ YES (carries identity: the renderer, a context, a registry) → peerDependencies
│   └─ Needed only by one entry? → add peerDependenciesMeta optional
└─ NO (leaf utility, safe to duplicate) → dependencies
```

## Entry split

```
Does any module in this entry's graph need client features?
├─ NO  → One entry is fine
└─ YES → Consumed by a server-components app?
    ├─ YES → Split: server-safe "." plus "./client" ✓
    └─ NO  → Split anyway where the client part is a minority of the bundle
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Pick One Style Delivery Contract and Publish It

Three ways styles reach a consumer, and the choice is public API: it dictates what they do at install time and can only change in a major.

**Compiled stylesheet** — you ship `.css`, they import it once. The failure mode is tree-shaking, which `sideEffects` answers:

```json
{
  "sideEffects": ["**/*.css", "./dist/register-icons.js"]
}
```

The array names exactly the modules whose evaluation matters, so the stylesheet survives while the rest stays prunable. A JS module that only registers something globally belongs in the list too — it has no exports to keep it alive.

**Runtime injection** — the JS inserts a `<style>` element on evaluation. No import step, at the cost of three things: a flash of unstyled content under SSR, `style-src` plumbing under a strict CSP, and cascade order that follows module evaluation order, which code splitting reorders between dev and production. Injection is itself a side effect, so the injecting modules go in `sideEffects` as well.

**Class names only** — you ship no CSS and the consumer's utility framework generates the rules. Zero payload and their tokens apply automatically, in exchange for inheriting their configuration: they must scan your _published_ path, your `dist` must contain complete statically analyzable class strings, and any preset you ship couples your release cadence to their framework's major.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: The `@layer` Contract

Consumer overrides should win because of where your styles sit in the cascade, not because the consumer out-specified you.

```css
/* your-lib/styles.css — declare the internal order, then fill the layers */
@layer your-lib.base, your-lib.components;

@layer your-lib.components {
  .btn {
    padding: var(--btn-padding);
    background: var(--btn-bg);
  }
}
```

Three facts drive it: unlayered styles beat layered ones whatever the specificity; layer precedence follows the order layers are first declared, last winning; and `!important` reverses that order. One name enters the consumer's namespace, sub-layers order your own rules, and their ordinary `.btn { background: red }` wins without `!important`.

A consumer wanting explicit control assigns the layer at import time — `@import "your-lib/styles.css" layer(vendor)` — so the order you expect is part of the deliverable. Self-layer anyway; only self-layering is guaranteed.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: `"use client"` Through the Pipeline

The directive must be the first thing in the file, above imports, in single or double quotes. It marks that module **and its transitive imports** as client code, drawing the boundary on the module graph rather than the render tree — which is why it goes on leaves that genuinely need client features and never on a root barrel.

Surviving the build is the other half, and the mechanism is always one output file per source module:

```js
// a Rollup-family config; see reference.md for the equivalent knob per tool
export default {
  output: { dir: "dist", format: "es", preserveModules: true },
  plugins: [preserveDirectives()],
  onwarn(warning, warn) {
    if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
    warn(warning);
  },
};
```

Because stripping is silent, verification is part of the pattern: count source modules declaring the directive, count `dist` files whose first line is the directive, and fail the build when they differ.

Full code, with the CI check: [examples/core.md](examples/core.md) · Per-tool behaviour: [reference.md](reference.md)

---

### Pattern 4: The Consumption Contract

```json
{
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": { "react": "19.2.8", "react-dom": "19.2.8" }
}
```

Hooks work only when the app's `react` and the `react` inside `react-dom` resolve to the same module. A peer says the host supplies it; the pinned devDependency states what you build and test against without imposing it. Since npm 7 peers are installed rather than warned about, so a range narrower than the truth is an `ERESOLVE` failure in the consumer's install.

The rule: anything that carries identity — the renderer, context providers, a plugin registry — is a peer; a leaf utility that is safe to duplicate is a dependency. `peerDependenciesMeta` `optional` covers a peer only one entry needs.

Whether `exports` points at source or at `dist` is the other half of this contract: [reference.md](reference.md)

Full code: [examples/core.md](examples/core.md)

---

### Pattern 5: Entry Granularity

One barrel is the cheapest thing to publish and the most expensive thing to consume.

```jsonc
{
  "exports": {
    ".": "./dist/index.js", // server-safe: types, pure helpers, presentational components
    "./client": "./dist/client/index.js", // the "use client" leaves
    "./styles.css": "./dist/styles.css",
  },
}
```

The split is visible in the specifier the consumer writes, so their import enforces it rather than a comment in your source. Keep it honest: a server-safe entry that transitively imports a client leaf is mislabeled, and Pattern 3's dist check is what catches it — a directive in any file reachable from `.` means the boundary moved.

The two contracts pull against each other here: a single barrel also stops tree-shaking as soon as `sideEffects` marks anything in its graph side-effectful, which Pattern 1 requires it to. Splitting the entries is what lets both hold.

Full code: [examples/core.md](examples/core.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `"sideEffects": false` on a package that ships or injects styles — production prunes the stylesheet and the consumer gets unstyled components, while dev builds look right
- `react` or `react-dom` in `dependencies` — a second React is installed under your package, every hook throws "Invalid hook call", and context stops crossing the boundary; `npm ls react` showing two entries is the diagnosis
- A directive that works in the repo's demo app and not in the published package — the demo imports source, the consumer imports `dist`, and their server-components build throws on the first hook in code they did not write
- One barrel entry containing a client leaf — the whole library becomes client-only for every consumer, with no escape short of deep-importing paths you never published
- Pinning a peer to an exact version (`"react": "19.2.8"`) — since npm 7 that is an install-blocking `ERESOLVE` for anyone on a different patch
- A "server-safe" entry that transitively imports a client leaf — mislabeled, and only the dist check finds it
- A class name assembled at runtime (`` `p-${size}` ``) under class-names-only delivery — the scanner reads text, so nothing is generated

**Surprising behaviour:**

- `output.banner` used to add `"use client"` — every emitted file becomes a client module, so it looks preserved and is not; pure helpers and presentational components cross the boundary and only the bundle size says so
- `!important` inside a cascade layer inverts precedence, so your important declaration in an earlier layer beats the consumer's in a later one and defeats the override path you documented
- Minification can strip directives after the bundler preserved them — verify the minified output, and in terser set `compress.directives: false`
- Library CSS published unlayered forces consumers to out-specify you, so the package accumulates `!important` and gets forked
- Duplicate React under `npm link` is a linking artifact rather than a manifest bug — check `npm ls react` and the manifest before touching component code
- A directive in backticks is not a directive; it fails silently, as does anything before `@import` other than a layer statement or `@charset`
- The published path, not the source path, is what a consumer's scanning config needs — pointing at `src` works locally and generates nothing after install

</red_flags>
