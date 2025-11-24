# Environment Management

**Auto-detection:** Environment variables, .env files, Zod validation, secrets management, NEXT*PUBLIC* prefix, VITE\_ prefix, feature flags

**When to use:**

- Setting up Zod validation for type-safe environment variables at startup
- Managing per-app .env files with framework-specific prefixes
- Securing secrets (never commit, use .env.local and CI secrets)
- Implementing environment-based feature flags

**Key patterns covered:**

- Per-app .env files (not root-level, prevents conflicts)
- Zod validation at startup for type safety and early failure
- Framework-specific prefixes (NEXT*PUBLIC*\_ for client, VITE\_\_ for Vite client)
- .env.example templates for documentation and onboarding

---

@include(./docs.md)

---

@include(./examples.md)
