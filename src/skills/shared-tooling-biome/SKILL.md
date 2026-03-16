---
name: shared-tooling-biome
description: Biome v2 unified linter, formatter, and import organizer — single Rust-powered tool replacing ESLint + Prettier with 97% Prettier compatibility and 20x faster performance
---

# Biome

> **Quick Guide:** Biome is a unified linter, formatter, and import organizer for JavaScript, TypeScript, JSX, TSX, JSON, CSS, and GraphQL. Single Rust binary replaces ESLint + Prettier with 97% Prettier compatibility. Use `biome.json` for all configuration. Run `biome check --write` to lint, format, and organize imports in one pass. Use `biome ci` in pipelines.
>
> **Current stable version:** Biome v2.4.x (March 2026). Biome v2 introduced type-aware linting, nested configs, and a revamped import organizer.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `biome.json` or `biome.jsonc` for ALL configuration — Biome does not use JavaScript config files)**

**(You MUST pin Biome to an exact version with `--save-exact` — Biome formatting can change between versions)**

**(You MUST use `biome ci` in CI pipelines, NOT `biome check` — `ci` is read-only with no `--write` flag)**

**(You MUST use `biome check --write` for local development — runs linter, formatter, and import organizer in one pass)**

**(You MUST include `$schema` in biome.json for editor autocompletion and validation)**

</critical_requirements>

---

**Auto-detection:** Biome, biome.json, biome.jsonc, @biomejs/biome, biome check, biome lint, biome format, biome ci, biome-ignore, organizeImports, biome migrate

**When to use:**

- Setting up a unified linter + formatter for JavaScript/TypeScript projects
- Replacing ESLint + Prettier with a single, faster tool
- Configuring import organizing with custom group ordering
- Migrating from ESLint and/or Prettier to Biome
- Setting up CI pipelines with `biome ci`
- Configuring pre-commit hooks with Biome's `--staged` flag

**When NOT to use:**

- Projects requiring ESLint plugins with no Biome equivalent (e.g., custom framework-specific plugins)
- Projects needing Markdown, YAML, or TOML formatting (Biome does not support these yet)
- Runtime code (this is build-time tooling only)
- Git hooks setup details (see `shared-tooling-git-hooks` for Husky/Lefthook patterns)
- TypeScript compiler configuration (see `shared-tooling-typescript-config`)

**Key patterns covered:**

- biome.json configuration with formatter, linter, and assist settings
- Linter rule groups (recommended, all, nursery) and severity levels
- Formatter configuration (indent style, line width, quotes, semicolons)
- Import organizer with custom group ordering
- CLI commands: check, format, lint, ci, migrate
- Migration from ESLint + Prettier
- Git hooks integration (Husky, Lefthook, `--staged` flag)
- CI integration with GitHub Actions and GitLab CI
- Editor integration (VS Code, JetBrains)
- Suppression comments (`biome-ignore`, `biome-ignore-all`, range suppressions)
- Nested configuration for monorepos
- Overrides for file-specific settings

**Detailed resources:**

- For practical examples and migration guides, see [examples/biome.md](examples/biome.md)
- For CLI quick reference and configuration options, see [reference.md](reference.md)

**Related skills:**

- For ESLint + Prettier configuration (alternative approach), see `shared-tooling-eslint-prettier`
- For git hooks and lint-staged, see `shared-tooling-git-hooks`
- For TypeScript compiler configuration, see `shared-tooling-typescript-config`
- For daily coding conventions (naming, imports, constants), see CLAUDE.md

---

<philosophy>

## Philosophy

Biome unifies linting, formatting, and import organizing into a **single tool with a single configuration file**. Built in Rust, it delivers 20x faster performance than ESLint + Prettier while maintaining 97% Prettier compatibility.

**Core principles:**

1. **One tool, one config** — biome.json replaces .eslintrc, prettier.config, and import sorting plugins
2. **Sensible defaults** — Biome works out of the box with recommended rules enabled; zero-config is a valid setup
3. **Speed as a feature** — Rust-powered binary processes large codebases in milliseconds, not seconds
4. **Unified commands** — `biome check --write` runs everything in one pass (lint + format + organize imports)
5. **Safe by default** — Safe fixes apply automatically; unsafe fixes require explicit `--unsafe` flag

**When to use Biome:**

- Greenfield projects wanting a single, fast tool
- Projects where ESLint + Prettier configuration complexity is a burden
- Large codebases where linting/formatting speed matters
- Teams wanting zero-config or minimal-config setup
- Projects needing JS/TS/JSX/TSX/JSON/CSS/GraphQL support

**When NOT to use Biome:**

- Projects requiring niche ESLint plugins with no Biome equivalent
- Projects needing Markdown, YAML, or TOML formatting
- Projects heavily invested in custom ESLint rules that cannot be replicated
- Teams requiring ESLint's mature plugin ecosystem (accessibility plugins, framework-specific rules)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Basic biome.json Configuration

Every Biome project starts with a `biome.json` at the project root. Use `biome init` to scaffold one, then customize.

#### Initialization

```bash
# Install Biome (always pin exact version)
npm install --save-dev --save-exact @biomejs/biome

# Create default biome.json
npx @biomejs/biome init
```

#### Standard Configuration

```jsonc
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.4.7/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf",
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
    },
  },
  "assist": {
    "enabled": true,
    "actions": {
      "source": {
        "organizeImports": "on",
      },
    },
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all",
      "arrowParentheses": "always",
      "bracketSameLine": false,
    },
  },
  "json": {
    "formatter": {
      "trailingCommas": "none",
    },
  },
}
```

**Why good:** `$schema` enables editor autocompletion and validation, VCS integration respects `.gitignore`, explicit formatter settings match team preferences, recommended linter rules provide a strong baseline, import organizer enabled via assist, language-specific overrides keep JSON strict while JS uses trailing commas

```jsonc
// BAD: No schema, no VCS, relying on Biome defaults that differ from Prettier
{
  "linter": {
    "enabled": true,
  },
}
```

**Why bad:** Missing `$schema` loses editor autocompletion, no VCS integration means linting/formatting node_modules or dist, Biome defaults to tabs (not spaces) which may surprise teams migrating from Prettier, no explicit formatter config leads to unexpected formatting differences

---

### Pattern 2: Linter Rules Configuration

Biome provides 459+ rules across 8 groups. Rules default to `recommended` which is a curated subset of safe, stable rules.

#### Rule Groups

| Group           | Purpose                              | Default            |
| --------------- | ------------------------------------ | ------------------ |
| `accessibility` | Prevents a11y problems               | recommended        |
| `complexity`    | Simplifies overly complex code       | recommended        |
| `correctness`   | Detects guaranteed errors            | recommended        |
| `nursery`       | Experimental rules (opt-in required) | off                |
| `performance`   | Catches inefficient patterns         | recommended        |
| `security`      | Identifies security flaws            | recommended        |
| `style`         | Enforces consistent code style       | recommended (warn) |
| `suspicious`    | Flags likely incorrect patterns      | recommended        |

#### Severity Levels

| Level     | Behavior                           |
| --------- | ---------------------------------- |
| `"off"`   | Rule disabled                      |
| `"on"`    | Default severity for that rule     |
| `"info"`  | Informational, no CLI exit impact  |
| `"warn"`  | Non-blocking diagnostic            |
| `"error"` | Blocks CLI with non-zero exit code |

#### Configuring Rules

```jsonc
// biome.json
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      // Enable all style rules (not just recommended)
      "style": {
        "all": true,
      },
      // Disable specific rules
      "complexity": {
        "noForEach": "off",
      },
      // Configure rule with options
      "style": {
        "useNamingConvention": {
          "level": "warn",
          "options": {
            "strictCase": false,
          },
        },
      },
      // Enable nursery rules explicitly
      "nursery": {
        "noConsole": "warn",
      },
    },
  },
}
```

**Why good:** `recommended: true` provides a strong baseline without per-rule config, group-level overrides (`"all": true`) enable entire categories, individual rules can be tuned with options, nursery rules opted into explicitly for experimental features

#### Domains (Technology-Specific Rules)

Biome v2 introduces domains that group rules by technology:

```jsonc
{
  "linter": {
    "domains": {
      "react": "recommended",
      "test": "recommended",
      "solid": "off",
    },
  },
}
```

Domains auto-detect from `package.json` dependencies when not explicitly configured.

---

### Pattern 3: Formatter Configuration

Biome's formatter achieves 97% Prettier compatibility. Global settings apply to all languages; language-specific settings override globals.

#### Global vs Language-Specific Settings

```jsonc
{
  // Global formatter settings (all languages)
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf",
    "bracketSpacing": true,
  },
  // JavaScript/TypeScript-specific overrides
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "jsxQuoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all",
      "arrowParentheses": "always",
      "bracketSameLine": false,
    },
  },
  // JSON-specific settings
  "json": {
    "formatter": {
      "trailingCommas": "none",
    },
  },
  // CSS formatting (disabled by default, opt-in)
  "css": {
    "formatter": {
      "enabled": true,
    },
  },
}
```

**Why good:** Global settings provide a baseline for all languages, language-specific settings override without repetition, CSS/GraphQL formatting explicitly opted into since they are disabled by default

#### Key Differences from Prettier Defaults

| Setting          | Biome Default | Prettier Default | Notes                  |
| ---------------- | ------------- | ---------------- | ---------------------- |
| `indentStyle`    | `"tab"`       | spaces           | Biome defaults to tabs |
| `indentWidth`    | `2`           | `2`              | Same                   |
| `lineWidth`      | `80`          | `80`             | Same                   |
| `quoteStyle`     | `"double"`    | `"double"`       | Same                   |
| `semicolons`     | `"always"`    | `true`           | Different naming       |
| `trailingCommas` | `"all"`       | `"all"`          | Same (Prettier 3.0+)   |

**Important:** When migrating from Prettier, explicitly set `indentStyle: "space"` if your project uses spaces — Biome defaults to tabs.

---

### Pattern 4: Import Organizer

Biome v2 revamped the import organizer with custom group ordering, export organizing, and import merging.

#### Default Sorting Order

Imports are sorted by "distance" from the current module:

1. URLs (`https://`, `http://`)
2. Packages with protocols (`node:`, `bun:`, `jsr:`, `npm:`)
3. Regular packages (`@scoped/lib`, `lib`)
4. Aliases (`@/`, `#`, `~`, `$`, `%`)
5. Relative/absolute paths

#### Enabling the Organizer

```jsonc
{
  "assist": {
    "enabled": true,
    "actions": {
      "source": {
        "organizeImports": "on",
      },
    },
  },
}
```

#### Custom Group Ordering

```jsonc
{
  "assist": {
    "actions": {
      "source": {
        "organizeImports": {
          "level": "on",
          "options": {
            "groups": [
              ":NODE:",
              ":PACKAGE:",
              ":BLANK_LINE:",
              ["@company/**"],
              ":BLANK_LINE:",
              ":ALIAS:",
              { "type": true },
            ],
          },
        },
      },
    },
  },
}
```

**Why good:** Predefined groups (`:NODE:`, `:PACKAGE:`, `:ALIAS:`) handle common patterns, `:BLANK_LINE:` creates visual separation between groups, custom glob patterns group company packages together, `{ "type": true }` separates type-only imports

#### Predefined Groups

| Group          | Matches                                    |
| -------------- | ------------------------------------------ |
| `:NODE:`       | Node.js built-ins and `node:` protocol     |
| `:PACKAGE:`    | Regular npm packages                       |
| `:ALIAS:`      | Aliased imports (`@/`, `#`, `~`, `$`, `%`) |
| `:URL:`        | HTTP/HTTPS imports                         |
| `:BUN:`        | Bun-specific modules                       |
| `:BLANK_LINE:` | Visual separator between groups            |

---

### Pattern 5: CLI Commands

Biome provides focused commands for different workflows. Use `check` locally, `ci` in pipelines.

#### Primary Commands

```bash
# Run everything: lint + format + organize imports (read-only)
npx biome check .

# Run everything with auto-fix
npx biome check --write .

# Format only
npx biome format --write .

# Lint only
npx biome lint --write .

# CI mode (read-only, optimized for pipelines)
npx biome ci .
```

#### Filtering and Targeting

```bash
# Run only specific rule groups
npx biome lint --only=correctness .

# Skip specific rules
npx biome lint --skip=style/useNamingConvention .

# Check only staged files (pre-commit hooks)
npx biome check --staged --write .

# Check only changed files (compared to main branch)
npx biome check --changed --since=main .

# Apply unsafe fixes (requires review)
npx biome check --write --unsafe .
```

#### Output and Reporting

```bash
# Verbose output
npx biome check --verbose .

# JSON reporter
npx biome ci --reporter=json .

# GitHub annotations (auto-detected in GitHub Actions)
npx biome ci --reporter=github .

# GitLab code quality report
npx biome ci --reporter=gitlab --colors=off > code-quality.json

# Error on warnings (strict mode)
npx biome ci --error-on-warnings .

# Limit diagnostics output
npx biome check --max-diagnostics=50 .
```

**Why good:** `check --write` handles everything in one command, `ci` is purpose-built for pipelines (no `--write` flag, better runner integration), `--staged` eliminates the need for lint-staged, `--changed` enables incremental CI checks

---

### Pattern 6: Suppression Comments

Biome uses `biome-ignore` comments with required explanations for suppressing diagnostics.

#### Inline Suppression (Next Line)

```typescript
// biome-ignore lint/suspicious/noDebugger: needed for local debugging
debugger;

// biome-ignore lint/complexity/noForEach: readability preference
items.forEach((item) => process(item));

// biome-ignore format: complex ternary reads better manually formatted
const value = condition ? longExpressionA : longExpressionB;
```

#### File-Level Suppression (Top of File)

```typescript
// biome-ignore-all lint/style/noDefaultExport: framework requires default export
// biome-ignore-all lint/suspicious/noExplicitAny: legacy module without types

export default function Page() {
  // ...
}
```

#### Range Suppression

```typescript
// biome-ignore-start lint/suspicious/noDoubleEquals: legacy comparison section
if (a == null) {
  /* ... */
}
if (b == undefined) {
  /* ... */
}
// biome-ignore-end lint/suspicious/noDoubleEquals: legacy comparison section
```

#### Suppression Levels

| Level    | Example                                    | Scope                |
| -------- | ------------------------------------------ | -------------------- |
| Category | `biome-ignore lint:`                       | All lint rules       |
| Group    | `biome-ignore lint/suspicious:`            | All suspicious rules |
| Rule     | `biome-ignore lint/suspicious/noDebugger:` | Single rule          |

**Important:** Explanations are mandatory. `// biome-ignore lint:` without a reason after the colon will be flagged.

---

### Pattern 7: Nested Configuration (Monorepos)

Biome v2 supports nested `biome.json` files for monorepo setups. Each subdirectory can override the root config.

#### Root Configuration

```jsonc
// biome.json (project root)
{
  "$schema": "https://biomejs.dev/schemas/2.4.7/schema.json",
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
  },
  "linter": {
    "rules": {
      "recommended": true,
    },
  },
}
```

#### Package-Level Override

```jsonc
// packages/legacy-app/biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.4.7/schema.json",
  "root": false,
  "linter": {
    "rules": {
      "suspicious": {
        "noExplicitAny": "off",
      },
    },
  },
}
```

#### Shorthand Extend Syntax

```jsonc
// packages/my-app/biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.4.7/schema.json",
  "extends": "//",
}
```

**Why good:** `"root": false` explicitly marks as child config that inherits from parent, `"extends": "//"` is a shorthand for both setting `root: false` and extending the root config, each package can relax or tighten rules without affecting others

---

### Pattern 8: Overrides (File-Specific Rules)

Use `overrides` for file-pattern-specific configuration without nested config files.

```jsonc
{
  "linter": {
    "rules": {
      "recommended": true,
    },
  },
  "overrides": [
    {
      // Relax rules for test files
      "includes": ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"],
      "linter": {
        "rules": {
          "suspicious": {
            "noExplicitAny": "off",
          },
        },
      },
    },
    {
      // Allow default exports for Next.js pages/layouts
      "includes": ["**/app/**/page.tsx", "**/app/**/layout.tsx"],
      "linter": {
        "rules": {
          "style": {
            "noDefaultExport": "off",
          },
        },
      },
    },
    {
      // Different formatting for config files
      "includes": ["*.config.ts", "*.config.mjs"],
      "formatter": {
        "lineWidth": 120,
      },
    },
  ],
}
```

**Why good:** Overrides eliminate the need for suppression comments in every file, test files get relaxed rules without compromising production code, framework conventions (default exports in Next.js) handled declaratively

</patterns>

---

<performance>

## Performance

Biome is written in Rust and processes files in parallel, making it significantly faster than JavaScript-based alternatives.

### Benchmark Comparison

| Tool              | Format Time (1000 files) | Lint Time (1000 files) |
| ----------------- | ------------------------ | ---------------------- |
| Biome             | ~100ms                   | ~200ms                 |
| Prettier          | ~2000ms                  | N/A                    |
| ESLint            | N/A                      | ~3000ms                |
| ESLint + Prettier | ~5000ms                  | ~5000ms                |

_Approximate benchmarks. Actual performance varies by project size and rule configuration._

### Performance Tips

- **Use `biome check`** instead of running `biome format` and `biome lint` separately — single pass is faster
- **Enable VCS integration** to automatically skip ignored files (`.gitignore`)
- **Use `--staged` or `--changed`** in hooks and CI to process only affected files
- **Be selective with nursery rules** — some experimental rules may impact performance
- **Use `--profile-rules`** (v2.4+) to identify slow lint rules in your configuration

### Type-Aware Linting Performance

Biome v2 introduced type-aware linting without the TypeScript compiler. Rules in the `project` and `types` domains trigger file scanning:

- **Default scan** discovers nested configs only (fast)
- **Project domain scan** indexes the full module graph (slower, but still faster than tsc)
- **Types domain scan** adds type inference (most comprehensive, most expensive)

Enable selectively based on your needs — not all projects need type-aware rules.

</performance>

---

<decision_framework>

## Decision Framework

### Biome vs ESLint + Prettier

```
Need linting and formatting?
├─ Greenfield project?
│   ├─ Want simplest possible setup?
│   │   └─ YES -> Biome (one tool, one config, zero-config works)
│   ├─ Need niche ESLint plugins?
│   │   └─ YES -> ESLint + Prettier
│   └─ Speed is important?
│       └─ YES -> Biome (20x faster)
├─ Existing ESLint + Prettier project?
│   ├─ Happy with current setup?
│   │   └─ YES -> Stay with ESLint + Prettier
│   ├─ Config complexity is a pain?
│   │   └─ YES -> Migrate to Biome
│   ├─ Need ESLint plugins without Biome equivalents?
│   │   └─ YES -> Stay with ESLint + Prettier
│   └─ Want faster CI/pre-commit hooks?
│       └─ YES -> Biome (or hybrid: Biome format + ESLint lint)
└─ Monorepo?
    ├─ Need per-package lint configs?
    │   └─ YES -> Biome v2 nested configs or ESLint 10
    └─ Speed bottleneck in CI?
        └─ YES -> Biome
```

### Biome Configuration Complexity

```
How to configure Biome?
├─ Just starting out?
│   └─ Run `biome init` -> use defaults with `recommended: true`
├─ Migrating from ESLint?
│   └─ Run `biome migrate eslint --write`
├─ Migrating from Prettier?
│   └─ Run `biome migrate prettier --write`
├─ Need per-file rules?
│   ├─ Different rules for test files?
│   │   └─ Use `overrides` in biome.json
│   └─ Different rules per package?
│       └─ Use nested biome.json with `"root": false`
└─ Need custom import ordering?
    └─ Configure `organizeImports.options.groups`
```

### Full Migration vs Hybrid Approach

```
Migrating from ESLint + Prettier?
├─ Standard rules only (recommended + typescript-eslint)?
│   └─ Full migration to Biome (Biome covers these)
├─ Using framework-specific ESLint plugins?
│   ├─ React/JSX-a11y/Unicorn?
│   │   └─ Full migration (Biome has equivalent rules)
│   ├─ Custom/niche plugins?
│   │   └─ Hybrid: Biome format + ESLint for custom rules
│   └─ Many custom rules with specific options?
│       └─ Hybrid approach (migrate incrementally)
└─ Just want faster formatting?
    └─ Replace Prettier with Biome format, keep ESLint
```

</decision_framework>

---

<integration>

## Integration Guide

### Editor Integration

#### VS Code

Install the [Biome extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) from the VS Code Marketplace.

```jsonc
// .vscode/settings.json
{
  // Set Biome as default formatter
  "editor.defaultFormatter": "biomejs.biome",
  // Format on save
  "editor.formatOnSave": true,
  // Organize imports on save
  "editor.codeActionsOnSave": {
    "source.organizeImports.biome": "explicit",
  },
  // Language-specific overrides (if needed)
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome",
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome",
  },
  "[json]": {
    "editor.defaultFormatter": "biomejs.biome",
  },
}
```

**VS Code Extension v3 features:**

- Multi-root workspace support (each folder runs its own Biome instance)
- Single-file mode for files outside projects
- Automatic `biome.json` discovery

#### JetBrains (IntelliJ, WebStorm)

Install the [Biome plugin](https://plugins.jetbrains.com/plugin/22761-biome) from the JetBrains Marketplace.

The plugin auto-discovers Biome from `node_modules/.bin/biome`. Add Biome as a project dependency to ensure the plugin and CLI use the same version.

### Git Hooks Integration

#### Option A: Husky (No lint-staged Needed)

Biome's `--staged` flag eliminates the need for lint-staged:

```bash
# .husky/pre-commit
npx biome check --write --staged --files-ignore-unknown=true --no-errors-on-unmatched
```

#### Option B: Husky + lint-staged

If using lint-staged for multiple tools:

```jsonc
// package.json
{
  "lint-staged": {
    "*.{js,ts,jsx,tsx,json,jsonc,css}": [
      "biome check --write --no-errors-on-unmatched",
    ],
  },
}
```

#### Option C: Lefthook

```yaml
# lefthook.yml
pre-commit:
  commands:
    biome:
      glob: "*.{js,ts,cjs,mjs,d.cts,d.mts,jsx,tsx,json,jsonc}"
      run: npx @biomejs/biome check --write --no-errors-on-unmatched --files-ignore-unknown=true --colors=off {staged_files}
      stage_fixed: true
```

#### Option D: pre-commit Framework

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/biomejs/pre-commit
    rev: "v2.0.6"
    hooks:
      - id: biome-check
        additional_dependencies: ["@biomejs/biome@2.4.7"]
```

### CI Integration

#### GitHub Actions

```yaml
# .github/workflows/lint.yml
name: Lint & Format
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  biome:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: biomejs/setup-biome@v2
        with:
          version: latest
      - run: biome ci .
```

**Key:** The `biomejs/setup-biome` action installs the Biome binary directly — no Node.js or npm required.

#### GitLab CI

```yaml
# .gitlab-ci.yml
lint:
  image:
    name: ghcr.io/biomejs/biome:latest
    entrypoint: [""]
  script:
    - biome ci --reporter=gitlab --colors=off > /tmp/code-quality.json
  artifacts:
    reports:
      codequality:
        - code-quality.json
```

### Package.json Scripts

```jsonc
// package.json
{
  "scripts": {
    "check": "biome check .",
    "check:fix": "biome check --write .",
    "format": "biome format --write .",
    "lint": "biome lint .",
    "lint:fix": "biome lint --write .",
    "ci": "biome ci .",
  },
}
```

**Works with:**

- **React/Next.js/Remix**: Full JSX/TSX support, domain-specific rules for React
- **TypeScript**: Type-aware linting without tsc dependency (Biome v2+)
- **CSS**: Linting enabled by default, formatting opt-in
- **JSON/JSONC**: Full support including tsconfig.json, package.json
- **GraphQL**: Linting enabled by default, formatting opt-in
- **Vue/Svelte/Astro**: Experimental support via `html.experimentalFullSupportEnabled` (v2.4+)

**Replaces / Conflicts with:**

- **ESLint**: Biome replaces ESLint for linting (or use hybrid approach)
- **Prettier**: Biome replaces Prettier for formatting
- **eslint-plugin-import**: Biome's import organizer replaces import sorting plugins
- **eslint-config-prettier**: Not needed — Biome has no formatter/linter conflicts

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ Using `biome check` in CI instead of `biome ci` (`check` allows `--write` which is dangerous in pipelines; `ci` is read-only)
- ❌ Not pinning Biome version with `--save-exact` (formatting can change between minor versions, causing diff noise)
- ❌ Missing `$schema` in biome.json (loses editor autocompletion, validation, and discoverability)
- ❌ Using JavaScript config files instead of biome.json (Biome only supports JSON/JSONC configuration)
- ❌ Running `biome format` and `biome lint` separately when `biome check` does both (wastes time, parses files twice)

**Medium Priority Issues:**

- ⚠️ Forgetting to set `indentStyle: "space"` when migrating from Prettier (Biome defaults to tabs)
- ⚠️ Not enabling VCS integration (without it, Biome may process node_modules and dist)
- ⚠️ Using `--unsafe` without reviewing changes (unsafe fixes can alter program behavior)
- ⚠️ Not including `--no-errors-on-unmatched` in git hooks (causes failures when no matching files are staged)
- ⚠️ Enabling all nursery rules (they are experimental and may have bugs or performance issues)

**Common Mistakes:**

- Using `"root": true` in a nested config (this is the default; use `"root": false` for child configs)
- Expecting Markdown/YAML formatting support (Biome does not support these languages yet)
- Not running `biome migrate --write` when upgrading major versions (config schema changes between v1 and v2)
- Suppression comments without explanations (`biome-ignore lint:` requires text after the colon)

**Gotchas & Edge Cases:**

- Biome defaults to tabs, not spaces — always set `indentStyle` explicitly when migrating from Prettier
- CSS and GraphQL formatting is disabled by default — must opt in with `"formatter": { "enabled": true }`
- `biome-ignore-all` must be at the top of the file — placing it mid-file triggers an unused suppression warning
- Import organizer is part of `assist`, not `linter` — configure under `assist.actions.source.organizeImports`
- The `--staged` flag makes lint-staged unnecessary for Biome-only setups (since Biome v1.7.0+)
- Type-aware linting (project/types domains) triggers file scanning which can slow down first runs on large projects
- `biome migrate eslint --write` does not migrate inspired rules by default — use `--include-inspired` to include them
- Range suppressions (`biome-ignore-start`/`biome-ignore-end`) must have matching rule specifiers
- Biome treats all JS/TS/JSX/TSX under the `javascript` config key — there is no separate `typescript` section
- Configuration files named `.biome.json` (with leading dot) are also discovered (v2.4+)

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `biome.json` or `biome.jsonc` for ALL configuration — Biome does not use JavaScript config files)**

**(You MUST pin Biome to an exact version with `--save-exact` — Biome formatting can change between versions)**

**(You MUST use `biome ci` in CI pipelines, NOT `biome check` — `ci` is read-only with no `--write` flag)**

**(You MUST use `biome check --write` for local development — runs linter, formatter, and import organizer in one pass)**

**(You MUST include `$schema` in biome.json for editor autocompletion and validation)**

**Failure to follow these rules will cause inconsistent formatting, broken CI pipelines, and missed lint errors.**

</critical_reminders>
