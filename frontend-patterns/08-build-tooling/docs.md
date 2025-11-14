# 08. Build & Tooling

> **Quick Guide:** Turborepo setup? See §8.1. Linting config? See §8.2. Formatting? See §8.3. Pre-commit hooks? See §8.4.

## 8.1 Turborepo/Nx Configuration

- Task pipeline (dependsOn, outputs, inputs)
- Caching strategies (what gets cached)
- Remote caching setup
- Parallel execution optimization
- Environment variables (env, passThroughEnv, globalEnv)

## 8.2 Linting Configuration

- ESLint vs Biome (2025 trend: Biome for speed)
- Rule sets (recommended, strict)
- Plugin configuration
- Shared configs across packages
- Custom rules for project-specific patterns

## 8.3 Formatting

- Prettier vs Biome
- Format settings:
  - Line width (100/120)
  - Semi/no-semi
  - Single/double quotes
  - Trailing commas
- Editor integration (.editorconfig)

## 8.4 Pre-commit Hooks

- Husky configuration
- lint-staged setup
- What runs pre-commit:
  - Linting
  - Formatting
  - Type checking (fast with --noEmit)
  - Running affected tests
- Preventing commits with issues
