# Biome -- Formatting Examples

> Formatter configuration, language-specific settings, and Prettier compatibility. Reference from [SKILL.md](../SKILL.md).

**Related examples:**

- [setup.md](setup.md) -- Installation, biome.json config, editor integration
- [linting.md](linting.md) -- Lint rules, domains, suppressions, overrides
- [ci.md](ci.md) -- CI pipelines, git hooks, staged files
- [migration.md](migration.md) -- Migrating from ESLint + Prettier

---

## Global vs Language-Specific Settings

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

---

## Key Differences from Prettier Defaults

| Setting          | Biome Default | Prettier Default | Notes                  |
| ---------------- | ------------- | ---------------- | ---------------------- |
| `indentStyle`    | `"tab"`       | spaces           | Biome defaults to tabs |
| `indentWidth`    | `2`           | `2`              | Same                   |
| `lineWidth`      | `80`          | `80`             | Same                   |
| `quoteStyle`     | `"double"`    | `"double"`       | Same                   |
| `semicolons`     | `"always"`    | `true`           | Different naming       |
| `trailingCommas` | `"all"`       | `"all"`          | Same (Prettier 3.0+)   |

**Important:** When migrating from Prettier, explicitly set `indentStyle: "space"` if your project uses spaces -- Biome defaults to tabs.

---

## Prettier to Biome Option Name Mapping

| Prettier          | Biome                     | Notes                |
| ----------------- | ------------------------- | -------------------- |
| `printWidth`      | `lineWidth`               |                      |
| `tabWidth`        | `indentWidth`             |                      |
| `useTabs`         | `indentStyle: "tab"`      |                      |
| `semi`            | `semicolons: "always"`    | Different naming     |
| `singleQuote`     | `quoteStyle: "single"`    | Different naming     |
| `trailingComma`   | `trailingCommas`          | Plural in Biome      |
| `bracketSpacing`  | `bracketSpacing`          | Same                 |
| `bracketSameLine` | `bracketSameLine`         | Same                 |
| `arrowParens`     | `arrowParentheses`        | Longer name in Biome |
| `endOfLine`       | `lineEnding`              | Different naming     |
| `jsxSingleQuote`  | `jsxQuoteStyle: "single"` | Different naming     |

---

## All Formatter Configuration Options

### Global Options (All Languages)

| Option              | Type                         | Default  | Notes                           |
| ------------------- | ---------------------------- | -------- | ------------------------------- |
| `enabled`           | boolean                      | `true`   | Enable/disable formatting       |
| `indentStyle`       | `"tab"` \| `"space"`         | `"tab"`  | **Biome defaults to tabs**      |
| `indentWidth`       | number                       | `2`      | Spaces per indent level         |
| `lineWidth`         | number                       | `80`     | Maximum line width              |
| `lineEnding`        | `"lf"` \| `"crlf"` \| `"cr"` | `"lf"`   | Line ending character           |
| `bracketSpacing`    | boolean                      | `true`   | Spaces inside `{ }`             |
| `attributePosition` | `"auto"` \| `"multiline"`    | `"auto"` | HTML/JSX attribute position     |
| `useEditorconfig`   | boolean                      | `false`  | Respect .editorconfig           |
| `formatWithErrors`  | boolean                      | `false`  | Format files with syntax errors |

### JavaScript/TypeScript Options

| Option             | Type                           | Default      | Notes                        |
| ------------------ | ------------------------------ | ------------ | ---------------------------- |
| `quoteStyle`       | `"single"` \| `"double"`       | `"double"`   | String quote style           |
| `jsxQuoteStyle`    | `"single"` \| `"double"`       | `"double"`   | JSX attribute quote style    |
| `quoteProperties`  | `"asNeeded"` \| `"preserve"`   | `"asNeeded"` | Object property quoting      |
| `trailingCommas`   | `"all"` \| `"es5"` \| `"none"` | `"all"`      | Trailing comma behavior      |
| `semicolons`       | `"always"` \| `"asNeeded"`     | `"always"`   | Semicolon insertion          |
| `arrowParentheses` | `"always"` \| `"asNeeded"`     | `"always"`   | Arrow function parens        |
| `bracketSameLine`  | boolean                        | `false`      | JSX closing `>` on same line |

### JSON Options

| Option           | Type                | Default  | Notes                |
| ---------------- | ------------------- | -------- | -------------------- |
| `trailingCommas` | `"none"` \| `"all"` | `"none"` | JSON trailing commas |

---

## See Also

- [SKILL.md](../SKILL.md) for core patterns and philosophy
- [reference.md](../reference.md) for CLI quick reference

**Official Documentation:**

- [Biome Configuration Reference](https://biomejs.dev/reference/configuration/)
- [Biome Migration Guide](https://biomejs.dev/guides/migrate-eslint-prettier/)
