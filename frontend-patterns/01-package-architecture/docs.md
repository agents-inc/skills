# 01. Package Architecture

> **Quick Guide:** Setting up a monorepo? See §1.1. Need package naming standards? See §1.2. Enforcing boundaries? See §1.3.

## 1.1 Workspace Structure

- Workspace organization (packages/, apps/, tools/)
- Directory naming conventions
- Monorepo tool identification (Turborepo/Nx/Lerna)

## 1.2 Package Naming Conventions

- Internal package prefixes (@repo/, @app/, etc.)
- Naming patterns (kebab-case, PascalCase)
- Scoping strategies

## 1.3 Dependency Boundaries

- Package dependency rules
- ESLint enforcement (@nx/enforce-module-boundaries)
- Circular dependency prevention
- Type tags (type:ui, type:util, type:data-access, type:feature)

## 1.4 Import Conventions

- Package names vs path aliases
- Import path standards
- Barrel exports (index.ts usage)

## 1.5 Versioning Strategy

- Changesets, Lerna, or manual versioning
- Version bumping workflow
- Changelog generation
