# Prettier Configuration Examples

> Prettier v3.0+ configuration patterns with shared configs and TypeScript support. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

---

## Shared Config Pattern

```javascript
// prettier.config.mjs (standalone project)
// OR packages/prettier-config/prettier.config.mjs (shared config)
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
// apps/my-app/package.json (referencing shared config)
{
  "name": "my-app",
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

**Why bad:** Different configs per package creates inconsistent formatting across the project, manually syncing changes is error-prone, developers switching between packages see formatting churn, code reviews show formatting noise instead of logic changes

---

## TypeScript Configuration Files (v3.5+)

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

## Experimental Options (v3.1+)

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

## eslint-config-prettier Integration

eslint-config-prettier disables all ESLint rules that conflict with Prettier formatting. It must be included in your ESLint config.

```typescript
// eslint.config.ts - correct integration
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default defineConfig(
  tseslint.configs.recommended,
  // eslint-config-prettier AFTER other configs to disable conflicting rules
  eslintConfigPrettier,
);
```

**Why good:** Prevents ESLint from reporting formatting issues that Prettier will handle, eliminates "fix one, break the other" cycles between ESLint and Prettier

```typescript
// BAD: Missing eslint-config-prettier
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  tseslint.configs.recommended,
  // No eslint-config-prettier - ESLint and Prettier will fight over formatting
);
```

**Why bad:** ESLint rules like `indent`, `quotes`, `semi` will conflict with Prettier's formatting, creating an endless cycle of conflicting auto-fixes

---

## Prettier Ignore Patterns

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

## Quick Reference

### Shared Config Packages

| Package                 | Purpose    | Usage                                              |
| ----------------------- | ---------- | -------------------------------------------------- |
| `@repo/prettier-config` | Formatting | `"prettier": "@repo/prettier-config"`              |
| `@repo/eslint-config`   | Linting    | `import { baseConfig } from "@repo/eslint-config"` |

### Key Files to Create

```
# Standalone project
prettier.config.mjs      # Prettier config
eslint.config.ts          # ESLint flat config
.prettierignore           # Prettier ignore patterns

# Shared config (monorepo)
packages/
├── eslint-config/
│   ├── base.ts           # ESLint 9 flat config
│   └── custom-rules.ts   # Project-specific rules
└── prettier-config/
    └── prettier.config.mjs
```

### Common Prettier Options

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

---

## See Also

- [eslint.md](eslint.md) for ESLint configuration
- [reference.md](../reference.md) for Prettier vs Biome decision framework

**Official Documentation:**

- [Prettier Options](https://prettier.io/docs/en/options.html)
- [Prettier Configuration](https://prettier.io/docs/en/configuration.html)
- [eslint-config-prettier](https://github.com/prettier/eslint-config-prettier)
