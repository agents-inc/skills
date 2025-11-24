# Build Tooling & Configuration

**Auto-detection:** Turborepo configuration, ESLint 9 flat config, Prettier, Husky pre-commit hooks, lint-staged, Bun, monorepo setup, syncpack

**When to use:**

- Configuring Turborepo task pipeline and caching strategies
- Setting up ESLint 9 flat config with shared configurations
- Configuring Husky pre-commit hooks with lint-staged
- Synchronizing dependencies across workspace with syncpack

**Key patterns covered:**

- Turborepo 2.4.2 with Bun 1.2.2 for monorepo orchestration
- ESLint 9 flat config with only-warn plugin (errors become warnings for better DX)
- Shared configurations (@repo/eslint-config, @repo/prettier-config, @repo/typescript-config)
- Husky + lint-staged for pre-commit quality gates (fast, staged files only)

---

@include(./docs.md)

---

@include(./examples.md)
