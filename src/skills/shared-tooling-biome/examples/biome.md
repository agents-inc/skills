# Biome Configuration Examples

> Practical examples for Biome configuration, migration, CI integration, and custom rules. See [SKILL.md](../SKILL.md) for core patterns and [reference.md](../reference.md) for CLI quick reference.

---

## Standard Project Setup

### Step-by-Step Initialization

```bash
# 1. Install Biome (always pin exact version)
npm install --save-dev --save-exact @biomejs/biome

# 2. Create default biome.json
npx @biomejs/biome init

# 3. Add scripts to package.json
```

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
  "devDependencies": {
    "@biomejs/biome": "2.4.7",
  },
}
```

### Production-Ready biome.json

```jsonc
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.4.7/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
    "defaultBranch": "main",
  },
  "files": {
    "ignoreUnknown": true,
    "includes": ["**"],
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
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "warn",
      },
      "style": {
        "noDefaultExport": "warn",
        "useImportType": "error",
      },
      "suspicious": {
        "noExplicitAny": "warn",
      },
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
  "css": {
    "formatter": {
      "enabled": true,
    },
  },
  "overrides": [
    {
      "includes": ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"],
      "linter": {
        "rules": {
          "suspicious": {
            "noExplicitAny": "off",
          },
        },
      },
    },
  ],
}
```

**Why good:** `$schema` enables editor autocompletion, VCS integration skips `.gitignore`d files, explicit formatter settings prevent tab/space surprises, `noUnusedImports` catches dead imports, `useImportType` enforces `import type`, `noDefaultExport` encourages named exports, test file overrides relax strict rules where needed, CSS formatting explicitly enabled

---

## Migration from ESLint + Prettier

### Automated Migration

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

### Manual Migration Checklist

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

### Removing Unnecessary Packages

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

## Custom Import Ordering

### React Project with Company Packages

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
              ["../**", "./**"],
            ],
          },
        },
      },
    },
  },
}
```

**Result:**

```typescript
import { readFileSync } from "node:fs";

import { z } from "zod";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@company/api-client";
import { Button } from "@company/ui";

import { useAuth } from "@/hooks/use-auth";

import { formatDate } from "../utils/date";
import { UserCard } from "./user-card";
```

### Separating Type Imports

```jsonc
{
  "assist": {
    "actions": {
      "source": {
        "organizeImports": {
          "level": "on",
          "options": {
            "groups": [{ "type": false }, ":BLANK_LINE:", { "type": true }],
          },
        },
      },
    },
  },
}
```

**Result:**

```typescript
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "./button";

import type { User } from "../types/user";
import type { ApiResponse } from "@company/api-client";
```

---

## Monorepo Nested Configuration

### Root Configuration

```jsonc
// biome.json (project root)
{
  "$schema": "https://biomejs.dev/schemas/2.4.7/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true,
  },
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf",
  },
  "linter": {
    "rules": {
      "recommended": true,
      "style": {
        "noDefaultExport": "warn",
        "useImportType": "error",
      },
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
    },
  },
}
```

### Next.js App Override

```jsonc
// apps/web/biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.4.7/schema.json",
  "extends": "//",
  "linter": {
    "rules": {
      "style": {
        // Next.js requires default exports for pages and layouts
        "noDefaultExport": "off",
      },
    },
    "domains": {
      "react": "recommended",
    },
  },
  "overrides": [
    {
      "includes": [
        "**/app/**/page.tsx",
        "**/app/**/layout.tsx",
        "**/app/**/loading.tsx",
      ],
      "linter": {
        "rules": {
          "style": {
            "noDefaultExport": "off",
          },
        },
      },
    },
  ],
}
```

### Legacy Package Override

```jsonc
// packages/legacy-lib/biome.json
{
  "$schema": "https://biomejs.dev/schemas/2.4.7/schema.json",
  "root": false,
  "linter": {
    "rules": {
      "suspicious": {
        "noExplicitAny": "off",
      },
      "correctness": {
        "noUnusedVariables": "off",
      },
    },
  },
}
```

**Why good:** Root config establishes team-wide standards, `"extends": "//"` shorthand inherits root config, Next.js app relaxes default export rule where framework requires it, legacy package can disable strict rules while the rest of the monorepo stays strict

---

## CI Integration Examples

### GitHub Actions (Minimal)

```yaml
# .github/workflows/lint.yml
name: Lint & Format
on: [push, pull_request]

jobs:
  biome:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: biomejs/setup-biome@v2
      - run: biome ci .
```

### GitHub Actions (Full Pipeline)

```yaml
# .github/workflows/quality.yml
name: Code Quality
on:
  push:
    branches: [main]
  pull_request:

jobs:
  biome:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Option A: Use setup-biome (no Node.js needed)
      - uses: biomejs/setup-biome@v2
        with:
          version: latest

      # Run Biome CI with strict mode
      - run: biome ci --error-on-warnings --max-diagnostics=100 .

  # If using Biome with other Node.js tools
  biome-with-node:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx biome ci .
```

### GitHub Actions (Changed Files Only)

```yaml
# .github/workflows/lint-changed.yml
name: Lint Changed Files
on: pull_request

jobs:
  biome:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: biomejs/setup-biome@v2
      - run: biome ci --changed --since=origin/main .
```

### GitLab CI

```yaml
# .gitlab-ci.yml
biome:
  image:
    name: ghcr.io/biomejs/biome:latest
    entrypoint: [""]
  stage: lint
  script:
    - biome ci --reporter=gitlab --colors=off > /tmp/code-quality.json
  artifacts:
    reports:
      codequality:
        - code-quality.json
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
```

---

## Git Hooks Configuration

### Husky with --staged (Simplest)

```bash
# Install and configure Husky
npm install --save-dev husky
npx husky init
```

```bash
# .husky/pre-commit
npx biome check --write --staged --files-ignore-unknown=true --no-errors-on-unmatched
```

**Why good:** The `--staged` flag (Biome v1.7.0+) eliminates the need for lint-staged entirely — Biome handles staged file filtering natively

### Lefthook

```yaml
# lefthook.yml
pre-commit:
  commands:
    biome-check:
      glob: "*.{js,ts,cjs,mjs,jsx,tsx,json,jsonc,css}"
      run: >
        npx @biomejs/biome check --write
        --no-errors-on-unmatched
        --files-ignore-unknown=true
        --colors=off
        {staged_files}
      stage_fixed: true
```

### pre-commit Framework

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/biomejs/pre-commit
    rev: "v2.0.6"
    hooks:
      - id: biome-check
        additional_dependencies: ["@biomejs/biome@2.4.7"]
```

---

## Framework-Specific Configurations

### React/Next.js

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.7/schema.json",
  "linter": {
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "error",
        "useExhaustiveDependencies": "warn",
      },
      "style": {
        "useImportType": "error",
      },
    },
    "domains": {
      "react": "recommended",
    },
  },
  "javascript": {
    "jsxRuntime": "transparent",
  },
}
```

### Node.js/Server

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.7/schema.json",
  "linter": {
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "warn",
      },
      "style": {
        "noDefaultExport": "error",
        "useImportType": "error",
        "useNodejsImportProtocol": "error",
      },
      "suspicious": {
        "noExplicitAny": "error",
      },
    },
  },
}
```

### Project with CSS Support

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.4.7/schema.json",
  "css": {
    "formatter": {
      "enabled": true,
      "indentStyle": "space",
      "indentWidth": 2,
    },
    "linter": {
      "enabled": true,
    },
    "parser": {
      "cssModules": true,
    },
  },
}
```

---

## Suppression Examples

### Inline Suppressions

```typescript
// Suppress a specific rule
// biome-ignore lint/suspicious/noDebugger: needed during local development
debugger;

// Suppress formatter for a complex expression
// biome-ignore format: manual alignment is clearer here
const matrix = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

// Suppress an entire group
// biome-ignore lint/style: legacy code, will refactor later
var x = 1;
```

### File-Level Suppressions

```typescript
// biome-ignore-all lint/style/noDefaultExport: Next.js page requires default export
// biome-ignore-all lint/correctness/noUnusedVariables: template file with example vars

export default function Page() {
  const example = "placeholder";
  return <div>{example}</div>;
}
```

### Range Suppressions

```typescript
// biome-ignore-start lint/suspicious/noDoubleEquals: legacy null checks
function processLegacyData(input: unknown) {
  if (input == null) return;
  if (input == undefined) return;
}
// biome-ignore-end lint/suspicious/noDoubleEquals: legacy null checks

// Modern code below uses strict equality
function processData(input: unknown) {
  if (input === null || input === undefined) return;
}
```

---

## Overrides for Mixed Projects

### Test Files, Config Files, and Generated Code

```jsonc
{
  "linter": {
    "rules": {
      "recommended": true,
      "style": {
        "noDefaultExport": "warn",
        "useImportType": "error",
      },
    },
  },
  "overrides": [
    {
      // Test files: relax strictness
      "includes": [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/__tests__/**",
      ],
      "linter": {
        "rules": {
          "suspicious": {
            "noExplicitAny": "off",
          },
          "style": {
            "noDefaultExport": "off",
          },
        },
        "domains": {
          "test": "recommended",
        },
      },
    },
    {
      // Config files: allow default exports (Vite, etc.)
      "includes": ["*.config.ts", "*.config.mjs", "*.config.js"],
      "linter": {
        "rules": {
          "style": {
            "noDefaultExport": "off",
          },
        },
      },
    },
    {
      // Generated files: disable linting and formatting
      "includes": ["**/generated/**", "**/*.generated.ts"],
      "linter": {
        "enabled": false,
      },
      "formatter": {
        "enabled": false,
      },
    },
  ],
}
```

**Why good:** Production code stays strict, test files get appropriate relaxations, config files allow framework-required default exports, generated code is completely excluded from processing

---

## See Also

- [reference.md](../reference.md) for CLI quick reference and configuration options
- [SKILL.md](../SKILL.md) for core patterns and philosophy

**Official Documentation:**

- [Biome Getting Started](https://biomejs.dev/guides/getting-started/)
- [Biome Configuration](https://biomejs.dev/guides/configure-biome/)
- [Biome Migration Guide](https://biomejs.dev/guides/migrate-eslint-prettier/)
- [Biome Git Hooks](https://biomejs.dev/recipes/git-hooks/)
- [Biome CI Integration](https://biomejs.dev/recipes/continuous-integration/)
