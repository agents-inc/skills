# Biome Quick Reference

> CLI commands, configuration options, and rule groups for Biome v2.4.x. See [SKILL.md](SKILL.md) for core patterns and [examples/](examples/) for practical examples.

---

## CLI Commands

### Primary Commands

| Command                  | Purpose                                          | Key Flags                                      |
| ------------------------ | ------------------------------------------------ | ---------------------------------------------- |
| `biome check .`          | Run lint + format + organize imports (read-only) | `--write`, `--unsafe`, `--staged`, `--changed` |
| `biome check --write .`  | Run everything with auto-fix                     | `--unsafe` (include unsafe fixes)              |
| `biome format .`         | Format only (read-only)                          | `--write`                                      |
| `biome format --write .` | Format with auto-fix                             |                                                |
| `biome lint .`           | Lint only (read-only)                            | `--write`, `--only`, `--skip`                  |
| `biome lint --write .`   | Lint with safe fixes                             | `--unsafe`                                     |
| `biome ci .`             | CI mode (read-only, no `--write`)                | `--reporter`, `--error-on-warnings`            |

### Setup and Migration

| Command                                           | Purpose                                 |
| ------------------------------------------------- | --------------------------------------- |
| `biome init`                                      | Create default biome.json               |
| `biome migrate --write`                           | Upgrade config between major versions   |
| `biome migrate eslint --write`                    | Convert ESLint config to biome.json     |
| `biome migrate prettier --write`                  | Convert Prettier config to biome.json   |
| `biome migrate eslint --write --include-inspired` | Include inspired (non-equivalent) rules |

### Utility Commands

| Command                  | Purpose                                       |
| ------------------------ | --------------------------------------------- |
| `biome explain <rule>`   | Show documentation for a rule                 |
| `biome rage`             | Output debugging information                  |
| `biome search <pattern>` | Search code with Grit patterns (experimental) |
| `biome clean`            | Remove daemon logs                            |
| `biome start`            | Start daemon server                           |
| `biome stop`             | Stop daemon server                            |

---

## Common Flags

| Flag                          | Commands                | Purpose                                                    |
| ----------------------------- | ----------------------- | ---------------------------------------------------------- |
| `--write`                     | check, format, lint     | Apply fixes to files                                       |
| `--unsafe`                    | check, lint             | Include unsafe (behavior-changing) fixes                   |
| `--staged`                    | check, format, lint     | Process only git staged files                              |
| `--changed`                   | check, format, lint, ci | Process files changed since default branch                 |
| `--since=<branch>`            | check, format, lint, ci | Process files changed since specified branch               |
| `--only=<group>`              | check, lint, ci         | Run only specific rule group(s)                            |
| `--skip=<rule>`               | check, lint, ci         | Skip specific rule(s)                                      |
| `--reporter=<fmt>`            | all                     | Output format: default, json, github, gitlab, junit, sarif |
| `--error-on-warnings`         | all                     | Exit non-zero on warnings                                  |
| `--max-diagnostics=<n>`       | all                     | Limit number of diagnostics shown                          |
| `--verbose`                   | all                     | Verbose output                                             |
| `--no-errors-on-unmatched`    | all                     | Suppress errors when no files match                        |
| `--files-ignore-unknown=true` | all                     | Skip unsupported file types                                |
| `--config-path=<path>`        | all                     | Specify config file location                               |
| `--colors=off`                | all                     | Disable colored output                                     |
| `--profile-rules`             | check, lint             | Profile rule execution time (v2.4+)                        |

---

## Formatter Configuration Options

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

## Linter Rule Groups

| Group           | Purpose                         | Default Severity      |
| --------------- | ------------------------------- | --------------------- |
| `accessibility` | Prevents a11y problems          | error (recommended)   |
| `complexity`    | Simplifies complex code         | error (recommended)   |
| `correctness`   | Detects guaranteed errors       | error (recommended)   |
| `nursery`       | Experimental rules              | off (opt-in required) |
| `performance`   | Catches inefficient patterns    | error (recommended)   |
| `security`      | Identifies security flaws       | error (recommended)   |
| `style`         | Enforces consistent code style  | warn (recommended)    |
| `suspicious`    | Flags likely incorrect patterns | error (recommended)   |

### Rule Severity Values

| Level     | CLI Exit | Purpose                        |
| --------- | -------- | ------------------------------ |
| `"off"`   | N/A      | Rule disabled                  |
| `"on"`    | varies   | Default severity for that rule |
| `"info"`  | 0        | Informational diagnostic       |
| `"warn"`  | 0        | Non-blocking warning           |
| `"error"` | 1        | Blocking error                 |

### Domains (Technology-Specific)

| Domain    | Detected From               | Purpose                                                        |
| --------- | --------------------------- | -------------------------------------------------------------- |
| `react`   | react in package.json       | React-specific rules                                           |
| `solid`   | solid-js in package.json    | SolidJS-specific rules                                         |
| `test`    | vitest/jest in package.json | Test-specific rules                                            |
| `project` | Manual opt-in               | Cross-file analysis (module graph scanning)                    |
| `types`   | Manual opt-in               | Type inference rules (v2.4+, ~75% tsc coverage for type rules) |

---

## Suppression Comment Syntax

| Type        | Syntax                                 | Scope                        |
| ----------- | -------------------------------------- | ---------------------------- |
| Inline      | `// biome-ignore <spec>: reason`       | Next line                    |
| File-wide   | `// biome-ignore-all <spec>: reason`   | Entire file (must be at top) |
| Range start | `// biome-ignore-start <spec>: reason` | Until matching end           |
| Range end   | `// biome-ignore-end <spec>: reason`   | Ends matching range          |

### Specifier Levels

| Level    | Example                      |
| -------- | ---------------------------- |
| Category | `lint`, `format`, `assist`   |
| Group    | `lint/suspicious`            |
| Rule     | `lint/suspicious/noDebugger` |

---

## Configuration File Resolution

**Search order:** `biome.json` > `biome.jsonc` > `.biome.json` > `.biome.jsonc`

**Search locations:**

1. Current working directory
2. Parent directories (recursively)
3. Home config directory (`$XDG_CONFIG_HOME/biome`, etc.)

**Nested configs:** Files use the nearest `biome.json` in parent hierarchy. Child configs use `"root": false`.

---

## Biome vs Prettier: Option Name Mapping

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

## Version History

| Version | Release  | Key Features                                                         |
| ------- | -------- | -------------------------------------------------------------------- |
| v2.4.x  | Feb 2026 | Embedded snippets, HTML a11y rules, types domain, rule profiler      |
| v2.0    | Jun 2025 | Type-aware linting, nested configs, import organizer revamp, plugins |
| v1.9.x  | 2024     | CSS support, GraphQL support, `--staged` flag                        |
| v1.0    | Aug 2023 | Initial stable release (fork of Rome)                                |

---

## See Also

- [examples/setup.md](examples/setup.md) for installation, biome.json, editor integration
- [examples/linting.md](examples/linting.md) for lint rules, suppressions, overrides
- [examples/formatting.md](examples/formatting.md) for formatter options, Prettier mapping
- [examples/ci.md](examples/ci.md) for CI pipelines, git hooks, staged files
- [examples/migration.md](examples/migration.md) for ESLint/Prettier migration
- [SKILL.md](SKILL.md) for core patterns and philosophy

**Official Documentation:**

- [Biome Configuration Reference](https://biomejs.dev/reference/configuration/)
- [Biome CLI Reference](https://biomejs.dev/reference/cli/)
- [Biome Linter Rules](https://biomejs.dev/linter/)
- [Biome Migration Guide](https://biomejs.dev/guides/migrate-eslint-prettier/)
- [Biome Git Hooks](https://biomejs.dev/recipes/git-hooks/)
- [Biome CI Integration](https://biomejs.dev/recipes/continuous-integration/)
- [Biome VS Code Extension](https://biomejs.dev/reference/vscode/)
