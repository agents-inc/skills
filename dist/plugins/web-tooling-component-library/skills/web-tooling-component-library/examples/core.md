# Component Library Packaging - Core Examples

> Complete artifacts for the five packaging contracts. See [SKILL.md](../SKILL.md) for the decisions behind them, the decision frameworks and the red flags.

---

## Pattern 1: Style Delivery Contract

### Good Example - Compiled stylesheet, published as a manifest

```json
{
  "name": "your-lib",
  "version": "2.0.0",
  "type": "module",
  "files": ["dist"],
  "exports": {
    ".": "./dist/index.js",
    "./styles.css": "./dist/styles.css"
  },
  "sideEffects": ["**/*.css", "./dist/register-icons.js"]
}
```

**Why good:** the two side-effectful things in the package are named — the stylesheet, which binds no exports, and the registration module, which is only ever imported for what it does. Everything else stays prunable, so a consumer importing one component does not pull the rest.

### Bad Example - The pure-utility template

```json
{
  "name": "your-lib",
  "files": ["dist"],
  "exports": { ".": "./dist/index.js", "./styles.css": "./dist/styles.css" },
  "sideEffects": false
}
```

**Why bad:** `import "your-lib/styles.css"` binds no names, so a production bundler drops it and the consumer ships unstyled components. Their dev server does not tree-shake, so nobody sees it until release.

### Good Example - Utility-native delivery, both halves of the contract

```tsx
// src/badge.tsx — complete, statically analyzable class strings
const BADGE_TONE_CLASSES = {
  neutral: "bg-slate-100 text-slate-900",
  danger: "bg-red-100 text-red-900",
} as const;

interface BadgeProps {
  readonly tone: keyof typeof BADGE_TONE_CLASSES;
  readonly children: React.ReactNode;
}

export function Badge({ tone, children }: BadgeProps) {
  return <span className={BADGE_TONE_CLASSES[tone]}>{children}</span>;
}
```

```js
// The consumer's scanning config — documented in your README, because you cannot ship it
export const sources = [
  "./src/**/*.{ts,tsx}",
  "./node_modules/your-lib/dist/**/*.js",
];
```

**Why good:** every class exists verbatim in `dist`, so the consumer's scanner finds it; the published path (not `src`) is what they scan, because `src` is not in the package.

### Bad Example - Classes assembled at runtime

```tsx
export function Badge({ tone }: { readonly tone: string }) {
  return <span className={`bg-${tone}-100 text-${tone}-900`} />;
}
```

**Why bad:** the scanner reads text, not semantics. Neither class is ever generated, the component renders unstyled, and nothing in either build reports a problem.

---

## Pattern 2: The `@layer` Contract

### Good Example - The published stylesheet

```css
/* dist/styles.css — declare internal order first, then fill the layers */
@layer your-lib.base, your-lib.components;

@layer your-lib.base {
  :where(.btn, .card) {
    box-sizing: border-box;
    font: inherit;
  }
}

@layer your-lib.components {
  .btn {
    padding: var(--btn-padding, 0.5rem 1rem);
    background: var(--btn-bg, #1f2937);
    color: var(--btn-fg, #ffffff);
  }

  .btn[data-variant="ghost"] {
    background: transparent;
    color: var(--btn-bg, #1f2937);
  }
}
```

**Why good:** one name enters the consumer's layer namespace, sub-layers order your own rules, and the consumer's ordinary unlayered `.btn { background: red }` wins with no `!important` — because unlayered beats layered regardless of specificity. Custom properties give a second override path that does not touch the cascade at all.

```css
/* The consumer's entry stylesheet, when they want explicit control */
@layer vendor, app;
@import "your-lib/styles.css" layer(vendor);
```

**Why good:** the layer statement is one of the few rules allowed before `@import`, so the order is fixed before the first byte of library CSS arrives.

### Bad Example - Unlayered, escalating

```css
.btn.btn.btn-primary {
  background: var(--btn-bg) !important;
}
```

**Why bad:** unlayered CSS competes on specificity against code you cannot see, so you escalate and the consumer escalates further. Note the trap in the good direction too: `!important` **inside** a layer inverts layer order, so an important declaration in your earlier layer beats the consumer's in a later one and defeats the override path you documented.

---

## Pattern 3: `"use client"` Through the Pipeline

### Good Example - Directive on the leaf, not the barrel

```tsx
// src/client/disclosure.tsx
"use client";

import { useState } from "react";

interface DisclosureProps {
  readonly summary: string;
  readonly children: React.ReactNode;
}

export function Disclosure({ summary, children }: DisclosureProps) {
  const [open, setOpen] = useState(false);
  return (
    <div data-open={open || undefined}>
      <button onClick={() => setOpen((value) => !value)}>{summary}</button>
      {open ? children : null}
    </div>
  );
}
```

```ts
// src/client/index.ts — no directive here; it would pull every transitive import across
export { Disclosure } from "./disclosure.js";
```

**Why good:** the boundary follows the module graph, so the directive belongs on the module that actually needs client features. The barrel re-exports without widening the boundary.

### Good Example - A build that preserves it

```js
// rollup.config.js
import { preserveDirectives } from "rollup-plugin-preserve-directives";
import typescript from "@rollup/plugin-typescript";

const EXTERNAL = [/^react($|\/)/, /^react-dom($|\/)/];

export default {
  input: { index: "src/index.ts", "client/index": "src/client/index.ts" },
  external: EXTERNAL,
  output: {
    dir: "dist",
    format: "es",
    preserveModules: true,
    preserveModulesRoot: "src",
  },
  plugins: [typescript(), preserveDirectives()],
  onwarn(warning, warn) {
    if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
    warn(warning);
  },
};
```

**Why good:** one output file per source module is the only shape that can carry a per-module directive; the plugin stops the strip; `onwarn` silences exactly the warning this setup provokes, rather than training the team to ignore all of them.

### Good Example - The verification that makes it real

```bash
#!/usr/bin/env bash
# scripts/verify-directives.sh — run after build, before publish
set -euo pipefail

src_count=$(grep -rl '^["'"'"']use client' src | wc -l | tr -d ' ')
dist_count=$(find dist -name '*.js' -exec head -1 {} + | grep -c 'use client' || true)

if [ "$src_count" != "$dist_count" ]; then
  echo "use client: $src_count in src, $dist_count in dist — directives were stripped" >&2
  exit 1
fi
```

```yaml
- name: Build and verify the published shape
  run: |
    npm run build
    ./scripts/verify-directives.sh
```

**Why good:** stripping is silent, so the check is the only thing standing between a green local build and a consumer's server-components crash. Run it on the **minified** output, since a minifier that treats directives as dead string statements removes them after the bundler got it right (in terser, `compress.directives: false`).

### Bad Example - A banner

```js
export default {
  output: { dir: "dist", format: "es", banner: '"use client";' },
};
```

**Why bad:** the banner lands on every emitted file, so pure helpers and presentational components become client modules. Nothing errors — the consumer's bundle just grows and their server rendering stops happening.

---

## Pattern 4: The Consumption Contract

### Good Example - Peers, optional peers, and what you build against

```json
{
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0",
    "react-router": "^7.0.0"
  },
  "peerDependenciesMeta": {
    "react-router": { "optional": true }
  },
  "devDependencies": {
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "dependencies": {
    "clsx": "^2.1.1"
  }
}
```

**Why good:** anything carrying identity — the renderer, a router's context — is a peer, so exactly one copy is installed and shared. The optional peer belongs to a single entry, so consumers who never import it are not forced to install it. The pinned devDependency states what you test against without imposing it, and the leaf utility stays an ordinary dependency because two copies of it are harmless.

### Bad Example - React as a dependency

```json
{
  "dependencies": {
    "react": "^19.2.8"
  }
}
```

**Why bad:** the consumer gets a second React nested under your package. Every hook throws "Invalid hook call", context created by one copy is invisible to the other, and the stack trace points at their code.

```bash
npm ls react   # more than one entry is the diagnosis
```

Duplication that appears only under `npm link` is a linking artifact — check the manifest before touching component code.

---

## Pattern 5: Entry Granularity

### Good Example - A split that the import specifier enforces

```
src/
├── index.ts          # server-safe barrel: types, pure helpers, presentational components
├── badge.tsx         # no client features
├── format-date.ts    # no client features
└── client/
    ├── index.ts      # client barrel
    └── disclosure.tsx  # "use client"
```

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./client": "./dist/client/index.js",
    "./styles.css": "./dist/styles.css"
  }
}
```

```ts
// src/index.ts — nothing here may transitively reach src/client
export { Badge } from "./badge.js";
export { formatDate } from "./format-date.js";
export type { BadgeProps } from "./badge.js";
```

**Why good:** the boundary is visible in the specifier the consumer writes, so it is enforced by their import rather than by a comment in your source. A server component importing `your-lib` stays on the server; only `your-lib/client` opts in.

### Bad Example - One barrel

```ts
// src/index.ts
export { Badge } from "./badge.js";
export { Disclosure } from "./client/disclosure.js"; // drags the whole entry client-side
```

**Why bad:** one interactive component makes the entire library client-only for every consumer, and their only escape is deep-importing paths you never published. Verify the split the same way you verify the directives — if a `"use client"` appears in any `dist` file reachable from `.`, the "server-safe" entry is mislabeled.
