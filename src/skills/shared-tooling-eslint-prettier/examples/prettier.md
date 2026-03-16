# Prettier - Advanced Examples

> TypeScript config files, experimental options, shared config usage, and ignore patterns. See [core.md](core.md) for the standard Prettier config.

**Prerequisites**: Understand Pattern 4 (Prettier Standard Config) from [core.md](core.md) first.

---

## Pattern 9: Shared Config Usage

Reference a shared Prettier config from `package.json` to prevent per-package config drift:

```json
// apps/my-app/package.json
{
  "name": "my-app",
  "prettier": "@repo/prettier-config",
  "devDependencies": {
    "@repo/prettier-config": "*"
  }
}
```

**Why good:** Single source of truth, no per-package formatting inconsistencies, zero config in each app

```json
// BAD: Duplicated config in each package
// apps/client-react/.prettierrc
{ "printWidth": 80, "semi": true, "singleQuote": true }

// apps/client-next/.prettierrc
{ "printWidth": 120, "semi": false, "singleQuote": true }
```

**Why bad:** Different configs per package creates inconsistent formatting, developers switching between packages see formatting churn, code reviews show formatting noise

---

## Pattern 10: TypeScript Config (v3.5+)

Prettier 3.5+ supports TypeScript configuration files for type-safe config. Requires Node.js 22.6.0+.

```typescript
// packages/prettier-config/prettier.config.ts
import type { Config } from "prettier";

const config: Config = {
  printWidth: 100,
  useTabs: false,
  tabWidth: 2,
  semi: true,
  singleQuote: false,
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
  bracketSameLine: false,
};

export default config;
```

**Requirements:**

- Node.js 22.6.0 or later
- Before Node.js v24.3.0, run with: `NODE_OPTIONS="--experimental-strip-types" prettier . --write`

**Supported file names:** `.prettierrc.ts`, `.prettierrc.mts`, `.prettierrc.cts`, `prettier.config.ts`, `prettier.config.mts`, `prettier.config.cts`

---

## Pattern 11: Experimental Options (v3.1+)

Experimental options address long-standing formatting debates. These may be removed or changed in future versions.

```javascript
// prettier.config.mjs
const config = {
  printWidth: 100,
  semi: true,
  singleQuote: false,
  bracketSpacing: true,

  // Experimental: ternary formatting (v3.1+)
  experimentalTernaries: true,

  // Experimental: object wrapping (v3.5+)
  // "preserve" (default): keeps multi-line objects as-is
  // "collapse": collapses objects that fit on one line
  objectWrap: "preserve",

  // Experimental: operator position (v3.5+)
  // "end" (default): operators at end of line
  // "start": operators at start of new lines
  experimentalOperatorPosition: "end",
};

export default config;
```

---

## Pattern 12: Prettier Ignore Patterns

```
# .prettierignore
dist/
build/
coverage/
node_modules/
*.min.js
*.min.css
pnpm-lock.yaml
package-lock.json
bun.lockb
```

**Why good:** Prevents Prettier from touching generated files, lock files, and minified assets where formatting is irrelevant or harmful

---

## Common Prettier Options

| Option                         | Default (v3.0+) | Notes                          |
| ------------------------------ | --------------- | ------------------------------ |
| `printWidth`                   | `80`            | Consider 100 for wider screens |
| `tabWidth`                     | `2`             |                                |
| `useTabs`                      | `false`         |                                |
| `semi`                         | `true`          |                                |
| `singleQuote`                  | `false`         |                                |
| `trailingComma`                | `"all"`         | Changed from `"es5"` in v3.0   |
| `bracketSpacing`               | `true`          |                                |
| `bracketSameLine`              | `false`         | Replaces `jsxBracketSameLine`  |
| `arrowParens`                  | `"always"`      |                                |
| `endOfLine`                    | `"lf"`          |                                |
| `objectWrap`                   | `"preserve"`    | v3.5+ experimental             |
| `experimentalTernaries`        | `false`         | v3.1+ experimental             |
| `experimentalOperatorPosition` | `"end"`         | v3.5+ experimental             |
