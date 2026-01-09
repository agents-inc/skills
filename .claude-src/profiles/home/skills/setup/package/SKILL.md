---
name: package
description: Internal package conventions, exports, @repo/* naming, workspace dependencies, tree-shaking configuration
---

# Internal Package Conventions

> **Quick Guide:** Internal packages live in `packages/`. Use `@repo/*` naming convention. Define explicit exports in `package.json`. Named exports only (no default exports). kebab-case for all files and directories. Use `workspace:*` for internal dependencies.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use `@repo/*` naming convention for ALL internal packages)**

**(You MUST define explicit `exports` field in package.json - never allow importing internal paths)**

**(You MUST use `workspace:*` protocol for ALL internal package dependencies)**

**(You MUST mark React as `peerDependencies` NOT `dependencies` in component packages)**

</critical_requirements>

---

**Auto-detection:** Internal packages, @repo/* packages, package.json exports, workspace dependencies, shared configurations

**When to use:**

- Creating new internal packages in `packages/`
- Configuring package.json exports for tree-shaking
- Setting up shared configuration packages (@repo/eslint-config, @repo/typescript-config)
- Understanding import/export conventions

**When NOT to use:**

- For app-specific code that won't be shared (keep in app directory)
- When a single file would suffice (don't over-abstract)
- For external dependencies (use npm packages instead)
- When the overhead of package management exceeds benefits

**Key patterns covered:**

- Package structure and naming conventions
- package.json configuration (exports, main, types, sideEffects)
- Named exports and barrel file patterns
- Internal dependencies with workspace protocol
- Shared configuration package patterns

**Detailed Resources:**
- For code examples, see [examples.md](examples.md)
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

**Related skills:**

- For Turborepo orchestration and workspaces, see `setup/monorepo`
- For ESLint, Prettier, TypeScript shared configs, see `setup/tooling`

---

<philosophy>

## Philosophy

Internal packages in a monorepo enable code sharing without duplication while maintaining strict boundaries and explicit APIs. The `@repo/*` namespace makes internal packages immediately recognizable, and explicit `exports` fields prevent coupling to internal implementation details.

**When to use internal packages:**

- Sharing UI components across multiple apps
- Centralizing API client logic
- Distributing shared configuration (ESLint, TypeScript, Prettier)
- Reusing utility functions across projects
- Creating domain-specific libraries (auth, analytics, etc.)

**When NOT to use:**

- For app-specific code that won't be shared
- When a single file would suffice (don't over-abstract)
- For external dependencies (use npm packages instead)
- When the overhead of package management exceeds benefits

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Package Structure and Naming

Standard internal package structure with `@repo/*` naming and kebab-case files.

#### Directory Layout

```
packages/
├── ui/                           # Shared UI components
│   ├── src/
│   │   ├── components/
│   │   │   ├── button/
│   │   │   │   ├── button.tsx
│   │   │   │   ├── button.module.scss
│   │   │   │   └── button.stories.tsx
│   │   │   └── switch/
│   │   │       ├── switch.tsx
│   │   │       └── switch.module.scss
│   │   ├── hooks/
│   │   │   └── index.ts
│   │   └── styles/
│   │       └── global.scss
│   ├── package.json
│   └── tsconfig.json
│
├── api/                          # API client package
├── eslint-config/                # Shared ESLint config
├── prettier-config/              # Shared Prettier config
└── typescript-config/            # Shared TypeScript config
```

**Why good:** `@repo/*` namespace makes internal packages instantly recognizable, kebab-case ensures cross-platform compatibility, consistent structure reduces cognitive load when navigating monorepo

For detailed naming examples, see [examples.md](examples.md#naming-conventions).

---

### Pattern 2: package.json Configuration

Complete package.json setup with exports, workspace dependencies, and tree-shaking configuration.

#### Essential Fields

```json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./button": "./src/components/button/button.tsx",
    "./switch": "./src/components/switch/switch.tsx",
    "./hooks": "./src/hooks/index.ts",
    "./styles/*": "./src/styles/*"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "typescript": "^5.7.0"
  }
}
```

**Why good:** Explicit exports enable tree-shaking, workspace protocol ensures local versions always used, peerDependencies prevent React version conflicts, private true prevents accidental publishing

For complete good/bad examples, see [examples.md](examples.md#packagejson-configuration).

---

### Pattern 3: Tree-Shaking Configuration

Mark packages as side-effect-free for aggressive tree-shaking.

```json
{
  "sideEffects": false
}
```

**Why good:** Tells bundlers they can safely remove unused exports, enables aggressive dead code elimination, reduces bundle size significantly

#### With CSS/SCSS Files

```json
{
  "sideEffects": ["*.css", "*.scss"]
}
```

**Why good:** CSS imports must always execute, bundler knows to keep CSS files while still tree-shaking JS exports

For anti-patterns, see [reference.md](reference.md#anti-patterns).

</patterns>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use `@repo/*` naming convention for ALL internal packages)**

**(You MUST define explicit `exports` field in package.json - never allow importing internal paths)**

**(You MUST use `workspace:*` protocol for ALL internal package dependencies)**

**(You MUST mark React as `peerDependencies` NOT `dependencies` in component packages)**

**Failure to follow these rules will break tree-shaking, cause version conflicts, and create coupling to internal implementation details.**

</critical_reminders>
