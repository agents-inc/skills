# Tooling - Core Examples

> Essential patterns for build tooling. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**
- [vite.md](vite.md) - Vite path aliases, vendor chunks, environment builds
- [eslint.md](eslint.md) - ESLint 9 flat config, shared configs, custom rules
- [typescript.md](typescript.md) - Shared TypeScript strict config
- [git-hooks.md](git-hooks.md) - Husky, lint-staged, VS Code integration

---

## Prettier Configuration (v3.0+)

> **Note:** Prettier 3.0+ uses `trailingComma: "all"` as the default. The option is only needed if you want a different value.

### Shared Config Pattern

```javascript
// packages/prettier-config/prettier.config.mjs
const config = {
  printWidth: 100,
  useTabs: false,
  tabWidth: 2,
  semi: true,
  singleQuote: false,
  // trailingComma: "all" is the default in Prettier 3.0+
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
  // bracketSameLine replaces deprecated jsxBracketSameLine (Prettier 2.4+)
  bracketSameLine: false,
};

export default config;
```

```json
// apps/client-react/package.json
{
  "name": "client-react",
  "prettier": "@repo/prettier-config",
  "devDependencies": {
    "@repo/prettier-config": "*"
  }
}
```

**Why good:** Single source of truth prevents formatting inconsistencies across team, 100 char line width balances readability with screen space, double quotes match JSON format reducing escaping in JSX, trailing commas create cleaner git diffs when adding items

```json
// BAD: Duplicated config in each package
// apps/client-react/.prettierrc
{
  "printWidth": 80,
  "semi": true,
  "singleQuote": true
}

// apps/client-next/.prettierrc
{
  "printWidth": 120,
  "semi": false,
  "singleQuote": true
}
```

**Why bad:** Different configs per package creates inconsistent formatting across monorepo, manually syncing changes is error-prone, developers switching between packages see formatting churn, code reviews show formatting noise instead of logic changes

---

### TypeScript Configuration Files (v3.5+)

Prettier 3.5+ supports TypeScript configuration files. Requires Node.js 22.6.0+.

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

**Supported file names:**
- `.prettierrc.ts`, `.prettierrc.mts`, `.prettierrc.cts`
- `prettier.config.ts`, `prettier.config.mts`, `prettier.config.cts`

---

### Experimental Options (v3.1+)

Prettier provides experimental options for specific formatting behaviors. These may be removed or changed in future versions.

```javascript
// prettier.config.mjs - with experimental options
const config = {
  printWidth: 100,
  semi: true,
  singleQuote: false,
  bracketSpacing: true,

  // Experimental: ternary formatting (v3.1+)
  // Changes how ternary expressions are formatted across lines
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

**Why experimental options exist:** These address long-standing formatting debates where no single solution fits all preferences. They follow Prettier's experimental option policy and may be removed or changed.

---

## Quick Reference

### Shared Config Packages

| Package | Purpose | Usage |
|---------|---------|-------|
| `@repo/prettier-config` | Formatting | `"prettier": "@repo/prettier-config"` |
| `@repo/eslint-config` | Linting | `import { baseConfig } from "@repo/eslint-config"` |
| `@repo/typescript-config` | TypeScript | `"extends": "@repo/typescript-config/base.json"` |

### Key Files to Create

```
packages/
├── eslint-config/
│   └── base.js           # ESLint 9 flat config
├── prettier-config/
│   └── prettier.config.mjs
└── typescript-config/
    └── base.json         # Strict TypeScript settings
```

---

## See Also

- [vite.md](vite.md) for build configuration with path aliases
- [eslint.md](eslint.md) for linting configuration
- [typescript.md](typescript.md) for strict type checking
- [git-hooks.md](git-hooks.md) for pre-commit quality gates
