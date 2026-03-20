# Biome -- Migration from ESLint + Prettier

> Step-by-step migration guide, rule mapping, and package cleanup. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Installation, biome.json config, editor integration
- [linting.md](linting.md) -- Lint rules, domains, suppressions, overrides
- [formatting.md](formatting.md) -- Formatter config, Prettier compatibility
- [ci.md](ci.md) -- CI pipelines, git hooks, staged files

---

## Automated Migration

```bash
# Step 1: Migrate Prettier settings (indent, quotes, line width)
npx @biomejs/biome migrate prettier --write

# Step 2: Migrate ESLint rules (maps to Biome equivalents)
npx @biomejs/biome migrate eslint --write

# Step 3: Include rules that are "inspired by" ESLint (not exact matches)
npx @biomejs/biome migrate eslint --write --include-inspired

# Step 4: Enable VCS integration (ESLint respects .gitignore by default)
# Add to biome.json manually:
# "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true }

# Step 5: Verify migration
npx @biomejs/biome check .

# Step 6: Remove old tooling
npm uninstall eslint prettier eslint-config-prettier eslint-plugin-only-warn \
  @eslint/js typescript-eslint eslint-plugin-react eslint-plugin-jsx-a11y

# Step 7: Remove old config files
rm -f .eslintrc* eslint.config.* .prettierrc* prettier.config.* .eslintignore .prettierignore
```

---

## Manual Migration Checklist

| ESLint + Prettier                            | Biome Equivalent                              |
| -------------------------------------------- | --------------------------------------------- |
| `.eslintrc.json` / `eslint.config.ts`        | `biome.json`                                  |
| `.prettierrc` / `prettier.config.mjs`        | `biome.json` (formatter section)              |
| `.eslintignore`                              | `biome.json` files.includes with `!` patterns |
| `.prettierignore`                            | `biome.json` files.includes with `!` patterns |
| `eslint-config-prettier`                     | Not needed (no formatter/linter conflicts)    |
| `eslint-plugin-only-warn`                    | Set rule severity to `"warn"`                 |
| `eslint-plugin-import`                       | `assist.actions.source.organizeImports`       |
| `@typescript-eslint/parser`                  | Built-in TypeScript support                   |
| `@typescript-eslint/consistent-type-imports` | `style/useImportType`                         |
| `@typescript-eslint/no-unused-vars`          | `correctness/noUnusedVariables`               |
| `import/no-default-export`                   | `style/noDefaultExport`                       |
| `no-console`                                 | `nursery/noConsole`                           |

---

## Removing Unnecessary Packages

After migration, these packages are no longer needed:

```bash
# Core tools (replaced by Biome)
npm uninstall eslint prettier

# ESLint plugins (handled by Biome rules)
npm uninstall @eslint/js typescript-eslint eslint-config-prettier
npm uninstall eslint-plugin-only-warn eslint-plugin-react
npm uninstall eslint-plugin-jsx-a11y eslint-plugin-unicorn
npm uninstall eslint-plugin-import eslint-plugin-simple-import-sort

# Prettier plugins
npm uninstall @prettier/sync prettier-plugin-tailwindcss
```

---

## Full Migration vs Hybrid Approach

```
Migrating from ESLint + Prettier?
|-- Standard rules only (recommended + typescript-eslint)?
|   +-- Full migration to Biome (Biome covers these)
|-- Using framework-specific ESLint plugins?
|   |-- React/JSX-a11y/Unicorn?
|   |   +-- Full migration (Biome has equivalent rules)
|   |-- Custom/niche plugins?
|   |   +-- Hybrid: Biome format + ESLint for custom rules
|   +-- Many custom rules with specific options?
|       +-- Hybrid approach (migrate incrementally)
+-- Just want faster formatting?
    +-- Replace Prettier with Biome format, keep ESLint
```

---

## See Also

- [SKILL.md](../SKILL.md) for core patterns and philosophy
- [formatting.md](formatting.md) for Prettier option name mapping

**Official Documentation:**

- [Biome Migration Guide](https://biomejs.dev/guides/migrate-eslint-prettier/)
- [Biome Upgrade to v2 Guide](https://biomejs.dev/guides/upgrade-to-biome-v2/)
