# ESLint & Prettier Reference

> Decision frameworks, red flags, and anti-patterns for ESLint and Prettier configuration.

---

## Decision Framework

### ESLint vs Biome

```
Need linting and formatting?
├─ Large monorepo (1000+ files)?
│   ├─ Speed is critical bottleneck?
│   │   └─ YES → Consider Biome (20x faster)
│   └─ NO → ESLint 9/10 + Prettier
└─ Greenfield project?
    ├─ Want single tool for lint + format?
    │   └─ YES → Consider Biome
    └─ Need mature plugin ecosystem?
        └─ YES → ESLint 9/10 + Prettier ✓
```

**Current recommendation:** ESLint 9/10 + Prettier (mature, stable, extensive plugin ecosystem)

**Future consideration:** Biome when plugin ecosystem matures

---

### Prettier vs Biome Formatting

```
Need code formatting?
├─ Already using ESLint?
│   └─ YES → Prettier (integrates well via eslint-config-prettier)
├─ Want fastest possible formatting?
│   └─ YES → Biome (20x faster)
└─ Need extensive language support?
    └─ YES → Prettier (supports more languages)
```

---

### Prettier Config File Format

```
What Prettier config format to use?
├─ Need type checking in config?
│   ├─ Node.js 22.6.0+?
│   │   └─ YES → .prettierrc.ts or prettier.config.ts
│   └─ NO → Use .mjs with JSDoc types
├─ ESM project ("type": "module")?
│   └─ YES → prettier.config.mjs
└─ CommonJS project?
    └─ YES → prettier.config.cjs
```

**File precedence (highest to lowest):**

1. `"prettier"` key in `package.json`
2. `.prettierrc` (JSON/YAML)
3. `.prettierrc.json`, `.prettierrc.yaml`
4. `.prettierrc.js`, `prettier.config.js`
5. `.prettierrc.mjs`, `prettier.config.mjs`
6. `.prettierrc.cjs`, `prettier.config.cjs`
7. `.prettierrc.ts`, `prettier.config.ts` (v3.5+)
8. `.prettierrc.toml`

---

### Shared Config vs Per-Package Config

```
Setting up linting/formatting?
├─ Monorepo with multiple packages?
│   └─ YES → Shared config (@repo/eslint-config, @repo/prettier-config) ✓
├─ Team project (2+ developers)?
│   └─ YES → Shared config (consistency matters)
└─ Single package / solo project?
    └─ YES → Local config is fine
```

**Shared configs prevent drift and ensure consistency.**

---

### ESLint 9 vs ESLint 10

```
Which ESLint version?
├─ New project?
│   └─ ESLint 10 (latest, cleanest API)
├─ Existing project with flat config?
│   └─ ESLint 10 (straightforward upgrade)
├─ Existing project with .eslintrc?
│   ├─ Can invest time to migrate?
│   │   └─ YES → Migrate to flat config, then ESLint 10
│   └─ NO → ESLint 9.x (still supported, but plan migration)
└─ Node.js < 20.19.0?
    └─ ESLint 9.x (ESLint 10 requires 20.19.0+)
```

---

## RED FLAGS

**High Priority Issues:**

- ❌ Using legacy .eslintrc format instead of ESLint 9+ flat config (**BROKEN in ESLint 10, released February 2026**)
- ❌ Using `tseslint.config()` instead of ESLint's native `defineConfig()` (deprecated)
- ❌ Using bare `ignores` property instead of `globalIgnores()` helper (ambiguous behavior)
- ❌ Missing eslint-plugin-only-warn (errors block developers during development)
- ❌ Missing eslint-config-prettier (ESLint and Prettier formatting rules conflict)
- ❌ Not using shared configs when working with a team (configs drift causing inconsistency)

**Medium Priority Issues:**

- ⚠️ Using manual `project` option instead of `projectService: true` in typescript-eslint
- ⚠️ No editor integration for Prettier/ESLint (manual formatting is forgotten)
- ⚠️ Hardcoded config values in each package instead of shared config
- ⚠️ Using deprecated `jsxBracketSameLine` option (use `bracketSameLine` instead, Prettier 2.4+)
- ⚠️ Explicitly setting `trailingComma: "all"` when it is already the default (Prettier 3.0+)

**Common Mistakes:**

- Not ignoring build outputs in ESLint config (linting dist/ is slow and pointless)
- Using different Prettier configs per package (creates formatting inconsistency)
- Using spread operators with `defineConfig()` (unnecessary - auto-flattens arrays)

**Gotchas & Edge Cases:**

- ESLint 9 flat config uses different plugin syntax than legacy .eslintrc
- only-warn plugin must be loaded AFTER other plugins to convert their errors
- Prettier and ESLint can conflict - must use eslint-config-prettier to disable conflicting rules
- `defineConfig()` auto-flattens arrays - no spread operators needed
- `projectService` requires typescript-eslint v8+ (was experimental in v6-v7 as `EXPERIMENTAL_useProjectService`)
- ESLint 10 requires Node.js 20.19.0+ (upgrade Node before upgrading ESLint)
- ESLint 10 config lookup starts from linted file directory (not cwd) - enables monorepo multi-config
- Prettier TypeScript config files (`.prettierrc.ts`) require Node.js 22.6.0+ and `--experimental-strip-types` flag before Node v24.3.0
- Prettier 3.0+ APIs are async - plugins using sync APIs need migration (use `@prettier/sync` for sync wrappers)
- **ESLint 9.15+**: `defineConfig()` auto-flattens arrays - no spread operators needed
- **ESLint 9.15+**: `eslint.config.ts` TypeScript config files supported natively
- **ESLint 9.15+**: `extends` property reintroduced for plugin composition
- **ESLint 9.34+**: Multithreaded linting (30-300% perf boost on large projects)
- **ESLint 10**: `/* eslint-env */` comments now trigger errors
- **ESLint 10**: Deprecated `Linter` methods (`defineParser()`, `defineRule()`, `getRules()`) removed
- **typescript-eslint v8**: `tseslint.config()` deprecated in favor of ESLint's `defineConfig()`

---

## Anti-Patterns to Avoid

### Legacy .eslintrc Format

```javascript
// ❌ ANTI-PATTERN: Legacy .eslintrc.json (BROKEN in ESLint 10)
{
  "extends": ["eslint:recommended", "prettier"],
  "plugins": ["@typescript-eslint"],
  "rules": {}
}
```

**Why it's wrong:** Legacy .eslintrc format is deprecated in ESLint 9 and **completely removed in ESLint 10** (February 2026).

**What to do instead:** Use ESLint 9+ flat config with `defineConfig()`:

```typescript
// ✅ Modern flat config with defineConfig()
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["dist/**", ".next/**"]),
  tseslint.configs.recommended,
);
```

---

### Deprecated tseslint.config() Wrapper

```javascript
// ❌ ANTI-PATTERN: Using deprecated tseslint.config()
import tseslint from "typescript-eslint";

export default tseslint.config(tseslint.configs.recommended);
```

**Why it's wrong:** `tseslint.config()` is deprecated in favor of ESLint's native `defineConfig()`.

**What to do instead:** Use ESLint's `defineConfig()` from `eslint/config`:

```typescript
// ✅ Use ESLint's native defineConfig
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(tseslint.configs.recommended);
```

---

### Bare ignores Property

```javascript
// ❌ ANTI-PATTERN: Ambiguous ignores behavior
export default [
  {
    ignores: ["dist/**", ".next/**"], // Is this global or local?
  },
  // ...other config
];
```

**Why it's wrong:** The bare `ignores` property has ambiguous behavior - it acts as global ignores when alone, but as local excludes when paired with other properties.

**What to do instead:** Use `globalIgnores()` for clarity:

```typescript
// ✅ Explicit global ignores
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
  globalIgnores(["dist/**", ".next/**"]), // Clearly global
  {
    files: ["src/**/*.ts"],
    ignores: ["**/*.test.ts"], // Clearly local to this config object
    // ...rules
  },
);
```

---

### Missing only-warn Plugin

```javascript
// ❌ ANTI-PATTERN: Errors block developers
export default [
  js.configs.recommended,
  // Missing only-warn plugin
  // ESLint errors block development
];
```

**Why it's wrong:** Error severity blocks developers during active development, reducing productivity.

**What to do instead:** Include eslint-plugin-only-warn to convert errors to warnings:

```typescript
// ✅ Include only-warn plugin (must be last)
import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import * as onlyWarnPlugin from "eslint-plugin-only-warn";

export default defineConfig(js.configs.recommended, {
  plugins: {
    "only-warn": onlyWarnPlugin,
  },
});
```

---

### Missing eslint-config-prettier

```typescript
// ❌ ANTI-PATTERN: ESLint and Prettier rules conflict
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  tseslint.configs.recommended,
  // No eslint-config-prettier - formatting rules will conflict with Prettier
);
```

**Why it's wrong:** ESLint rules like `indent`, `quotes`, `semi` will conflict with Prettier's formatting, creating an endless cycle of conflicting auto-fixes.

**What to do instead:** Include eslint-config-prettier after all other configs:

```typescript
// ✅ Include eslint-config-prettier
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default defineConfig(tseslint.configs.recommended, eslintConfigPrettier);
```

---

### Duplicated Configs Per Package

```
// ❌ ANTI-PATTERN: Different configs per package
apps/client-react/.prettierrc → printWidth: 80
apps/client-next/.prettierrc → printWidth: 120
packages/ui/.eslintrc → different rules
```

**Why it's wrong:** Inconsistent formatting across the project, code reviews show formatting noise.

**What to do instead:** Use shared config packages (`@repo/eslint-config`, `@repo/prettier-config`) or a single config at the project root.

---

### Deprecated Prettier Options

```javascript
// ❌ ANTI-PATTERN: Deprecated Prettier options
const config = {
  jsxBracketSameLine: true, // DEPRECATED since Prettier 2.4
  trailingComma: "all", // Unnecessary - default since Prettier 3.0
};
```

**Why it's wrong:** `jsxBracketSameLine` was renamed to `bracketSameLine` in Prettier 2.4. Setting `trailingComma: "all"` is redundant since it became the default in Prettier 3.0.

**What to do instead:**

```javascript
// ✅ Use current option names, omit defaults
const config = {
  bracketSameLine: true, // Current name (if you want this behavior)
  // trailingComma not needed - "all" is already the default
};
```

---

## Version Quick Reference

| Tool                    | Latest Stable | Key Feature                                        |
| ----------------------- | ------------- | -------------------------------------------------- |
| ESLint 9                | v9.39.4       | Flat config, defineConfig(), multithreaded linting |
| ESLint 10               | v10.0.3       | .eslintrc removed, file-based config lookup        |
| Prettier                | v3.8.1        | TS config files, experimental fast CLI             |
| typescript-eslint       | v8.57.0       | projectService (stable), defineConfig()            |
| eslint-config-prettier  | latest        | Disables conflicting ESLint rules                  |
| eslint-plugin-only-warn | latest        | Converts errors to warnings                        |

---

## See Also

- [examples/eslint.md](examples/eslint.md) for ESLint configuration examples
- [examples/prettier.md](examples/prettier.md) for Prettier configuration examples
- [SKILL.md](SKILL.md) for core patterns and philosophy

**Official Documentation:**

- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files)
- [ESLint Migration Guide](https://eslint.org/docs/latest/use/configure/migration-guide)
- [ESLint 10 Release](https://eslint.org/blog/2026/02/eslint-v10.0.0-released/)
- [typescript-eslint v8](https://typescript-eslint.io/blog/announcing-typescript-eslint-v8/)
- [Prettier Options](https://prettier.io/docs/en/options.html)
- [Prettier Configuration](https://prettier.io/docs/en/configuration.html)
- [eslint-config-prettier](https://github.com/prettier/eslint-config-prettier)
