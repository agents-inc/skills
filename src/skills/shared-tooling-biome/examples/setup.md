# Biome -- Setup & Configuration Examples

> Installation, biome.json configuration, editor integration, and package.json scripts. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [linting.md](linting.md) -- Lint rules, domains, suppressions, overrides
- [formatting.md](formatting.md) -- Formatter config, Prettier compatibility
- [ci.md](ci.md) -- CI pipelines, git hooks, staged files
- [migration.md](migration.md) -- Migrating from ESLint + Prettier

---

## Step-by-Step Initialization

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

---

## Production-Ready biome.json

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

## VS Code Integration

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

---

## JetBrains (IntelliJ, WebStorm)

Install the [Biome plugin](https://plugins.jetbrains.com/plugin/22761-biome) from the JetBrains Marketplace.

The plugin auto-discovers Biome from `node_modules/.bin/biome`. Add Biome as a project dependency to ensure the plugin and CLI use the same version.

---

## Framework-Specific Configurations

### React / Next.js

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

### Node.js / Server

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

### CSS Support

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

## See Also

- [SKILL.md](../SKILL.md) for core patterns and philosophy
- [reference.md](../reference.md) for CLI quick reference and configuration options

**Official Documentation:**

- [Biome Getting Started](https://biomejs.dev/guides/getting-started/)
- [Biome Configuration](https://biomejs.dev/guides/configure-biome/)
- [Biome VS Code Extension](https://biomejs.dev/reference/vscode/)
