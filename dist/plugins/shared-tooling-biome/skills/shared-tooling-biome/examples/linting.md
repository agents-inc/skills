# Biome -- Linting Examples

> Lint rules configuration, domains, suppression comments, and file-specific overrides. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [core.md](core.md) -- Installation, biome.json config, editor integration
- [formatting.md](formatting.md) -- Formatter config, Prettier compatibility
- [ci.md](ci.md) -- CI pipelines, git hooks, staged files
- [migration.md](migration.md) -- Migrating from ESLint + Prettier

---

## Rule Configuration

### Recommended Baseline with Customizations

```jsonc
// biome.json
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      // Enable all style rules, then configure individual ones
      "style": {
        "all": true,
        "useNamingConvention": {
          "level": "warn",
          "options": {
            "strictCase": false,
          },
        },
      },
      // Disable specific rules
      "complexity": {
        "noForEach": "off",
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

---

## Domains (Technology-Specific Rules)

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

| Domain    | Detected From               | Purpose                      |
| --------- | --------------------------- | ---------------------------- |
| `react`   | react in package.json       | React-specific rules         |
| `solid`   | solid-js in package.json    | SolidJS-specific rules       |
| `test`    | vitest/jest in package.json | Test-specific rules          |
| `project` | Manual opt-in               | Cross-file analysis rules    |
| `types`   | Manual opt-in               | Type inference rules (v2.4+) |

---

## Suppression Comments

### Inline Suppression (Next Line)

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

### File-Level Suppression (Top of File)

```typescript
// biome-ignore-all lint/style/noDefaultExport: Next.js page requires default export
// biome-ignore-all lint/correctness/noUnusedVariables: template file with example vars

export default function Page() {
  const example = "placeholder";
  return <div>{example}</div>;
}
```

**Important:** `biome-ignore-all` must be placed at the top of the file. Placing it mid-file triggers an unused suppression warning.

### Range Suppression

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

Suppressions can target a category (`lint`), group (`lint/suspicious`), or individual rule (`lint/suspicious/noDebugger`). See [reference.md](../reference.md#suppression-comment-syntax) for the full specifier table.

**Important:** Explanations are mandatory. `// biome-ignore lint:` without a reason after the colon will be flagged.

---

## Overrides (File-Specific Rules)

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
      // Config files: allow default exports (bundler configs, etc.)
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
              ":PATH:",
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
import { clsx } from "clsx";
import { Button } from "./button";

import type { User } from "../types/user";
import type { Config } from "@company/shared";
```

---

## See Also

- [SKILL.md](../SKILL.md) for core patterns and philosophy
- [reference.md](../reference.md) for rule groups and severity values

**Official Documentation:**

- [Biome Linter Rules](https://biomejs.dev/linter/)
- [Biome Suppressions](https://biomejs.dev/analyzer/suppressions/)
- [Biome Import Organizer](https://biomejs.dev/assist/actions/organize-imports/)
