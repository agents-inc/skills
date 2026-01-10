---
name: setup/tooling (@vince)
description: ESLint 9 flat config, Prettier, TypeScript configuration, Vite, Husky + lint-staged, commitlint - build tooling for monorepos
---

# Build & Tooling

> **Quick Guide:** ESLint 9 flat config with `only-warn` plugin. Prettier shared config. Shared TypeScript configs. Bun 1.2.2 package manager. Vite build configuration. Husky + lint-staged for git hooks.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use ESLint 9 flat config format - NOT legacy .eslintrc)**

**(You MUST include eslint-plugin-only-warn to convert errors to warnings for better DX)**

**(You MUST use shared config pattern - @repo/eslint-config, @repo/prettier-config, @repo/typescript-config)**

**(You MUST enable TypeScript strict mode in ALL tsconfig.json files)**

</critical_requirements>

---

**Auto-detection:** ESLint 9 flat config, Prettier, Bun, Vite configuration, Husky pre-commit hooks, lint-staged, commitlint

**When to use:**

- Setting up ESLint 9 flat config with shared configurations
- Configuring Prettier with shared config
- Setting up Vite build configuration
- Configuring TypeScript with shared configs
- Setting up pre-commit hooks with lint-staged
- Configuring commit message validation (commitlint)

**When NOT to use:**

- Runtime code (this is build-time tooling only)
- CI/CD pipelines (see backend/ci-cd skill instead)
- Production deployment configuration
- Server-side build processes (e.g., Docker builds)

**Key patterns covered:**

- ESLint 9 flat config with only-warn plugin (errors become warnings for better DX)
- Shared configurations (@repo/eslint-config, @repo/prettier-config, @repo/typescript-config)
- Vite configuration (path aliases, environment-specific builds)
- Husky + lint-staged for pre-commit quality gates (fast, staged files only)
- Commitlint for conventional commit messages

**Detailed Resources:**
- For code examples, see [examples.md](examples.md)
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

**Related skills:**

- For Turborepo task pipelines, caching, and workspaces, see `setup/monorepo`
- For internal package structure and conventions, see `setup/package`
- For daily coding conventions (naming, imports, constants), see CLAUDE.md

---

<philosophy>

## Philosophy

Build tooling should be **fast, consistent, and non-blocking**. Developers shouldn't fight with tools - tools should help catch issues early while staying out of the way during development.

**When to use this skill:**

- Setting up new apps or packages in the monorepo
- Configuring linting, formatting, or type-checking
- Adding git hooks for pre-commit quality gates
- Creating shared configurations for consistency
- Optimizing build performance with Vite

**When NOT to use:**

- Runtime code (this is build-time tooling only)
- CI/CD pipelines (see separate CI/CD skill)
- Production deployment configuration
- Server-side build processes

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Vite Configuration

Vite is the build tool for frontend apps. Key features: path aliases, vendor chunk splitting, environment-specific builds.

**Path Aliases:**
- Configure in both `vite.config.ts` and `tsconfig.json`
- Common aliases: `@/`, `@components/`, `@features/`, `@lib/`, `@hooks/`, `@types/`
- Vendor chunk splitting reduces main bundle size

**Environment-Specific Builds:**
- Use `loadEnv(mode, ...)` for environment-aware config
- Conditional sourcemaps (dev only) and minification (prod only)
- Build-time constants with `define` option

See [examples.md](examples.md) for complete Vite configuration examples.

---

### Pattern 2: ESLint 9 Flat Config

ESLint 9 uses flat config format (replaces legacy `.eslintrc`). Shared configs live in `packages/eslint-config/`.

**Key Requirements:**
- Use array export syntax: `export default [...]`
- Include `eslint-plugin-only-warn` to convert errors to warnings
- Use `eslint-config-prettier` to disable conflicting rules
- Ignore build outputs: `dist/**`, `generated/**`, `.next/**`

**Custom Rules for Monorepo:**
- `import/no-default-export`: Enforce named exports
- `no-restricted-imports`: Prevent importing from internal package paths
- `@typescript-eslint/consistent-type-imports`: Use `import type` for types

See [examples.md](examples.md) for complete ESLint configuration examples.

---

### Pattern 3: Prettier Configuration

Prettier configuration lives in `packages/prettier-config/` and is shared across all packages.

**Standard Config:**
- `printWidth: 100` - Balance readability with screen space
- `trailingComma: "all"` - Cleaner git diffs
- `singleQuote: false` - Match JSON format, reduce JSX escaping
- `endOfLine: "lf"` - Consistent line endings

**Usage:**
- Reference in package.json: `"prettier": "@repo/prettier-config"`
- Single source of truth prevents formatting inconsistencies

See [examples.md](examples.md) for complete Prettier configuration examples.

---

### Pattern 4: TypeScript Configuration

TypeScript configurations live in `packages/typescript-config/` with base settings extended by apps and packages.

**Strict Mode (Required):**
- `strict: true` - Enables all strict checks
- `noUncheckedIndexedAccess: true` - Prevents undefined access bugs
- `exactOptionalPropertyTypes: true` - Strict optional handling
- `noUnusedLocals: true` / `noUnusedParameters: true` - Catch dead code

**Path Aliases:**
- Configure in tsconfig.json to match Vite aliases
- Use `moduleResolution: "bundler"` for modern tooling

For daily TypeScript enforcement rules (no unjustified `any`, explicit types), see CLAUDE.md.

See [examples.md](examples.md) for complete TypeScript configuration examples.

---

### Pattern 5: Git Hooks with Husky + lint-staged

Pre-commit hooks run linting on staged files only for fast feedback.

**Setup:**
- Husky hook calls `bunx lint-staged`
- lint-staged config specifies file patterns and commands
- Only lint staged files - NOT entire codebase

**VS Code Integration:**
- Format on save with Prettier
- Auto-fix ESLint on save
- Recommended extensions for team consistency

**Rule of thumb:** Pre-commit should take < 10 seconds. Anything slower goes to pre-push or CI.

See [examples.md](examples.md) for complete Husky + lint-staged examples.

</patterns>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use ESLint 9 flat config format - NOT legacy .eslintrc)**

**(You MUST include eslint-plugin-only-warn to convert errors to warnings for better DX)**

**(You MUST use shared config pattern - @repo/eslint-config, @repo/prettier-config, @repo/typescript-config)**

**(You MUST enable TypeScript strict mode in ALL tsconfig.json files)**

**Failure to follow these rules will cause inconsistent tooling, implicit any types, and blocked developers.**

</critical_reminders>
