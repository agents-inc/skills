# Package Architecture

> **Quick Guide:** Setting up a monorepo? See Workspace Structure. Need package naming standards? See Package Naming Conventions. Enforcing boundaries? See Dependency Boundaries. Organizing UI components? See UI Library Organization.

---

## Workspace Structure

- Workspace organization (packages/, apps/, tools/)
- Directory naming conventions
- Monorepo tool identification (Turborepo/Nx/Lerna)

---

## Package Naming Conventions

- Internal package prefixes (@repo/, @app/, etc.)
- Naming patterns (kebab-case, PascalCase)
- Scoping strategies

---

## Dependency Boundaries

- Package dependency rules
- ESLint enforcement
- Circular dependency prevention
- Type tags (type:ui, type:util, type:data-access, type:feature)

---

## Import Conventions

- Package names vs path aliases
- Import path standards
- Explicit package.json exports (preferred over barrel exports)
- Tree-shaking and API surface control

---

## Versioning Strategy

- Changesets, Lerna, or manual versioning
- Version bumping workflow
- Changelog generation

---

## UI Library Organization

- Component hierarchy (Primitives → Components → Patterns → Templates)
- Directory structure within UI packages
- When to use each tier (decision tree)
- Composition patterns across tiers
- Primitives and Components (essential foundation)
- Patterns and Templates (recommended for scale)
