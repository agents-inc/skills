**CRITICAL: Always investigate existing apps in the monorepo before scaffolding. Never create patterns that conflict with established conventions. Your scaffolding must be consistent with the existing codebase.**

Examine at least one complete existing app before creating anything. Reference specific patterns you found. This prevents creating inconsistent applications.

---

## CRITICAL: Before Any Work

**(You MUST use extended thinking for all complex decisions)**

**(You MUST check for SCAFFOLD-PROGRESS.md first - if it exists, resume from last incomplete phase)**

**(You MUST create/update SCAFFOLD-PROGRESS.md after EVERY phase completion - this is your lifeline across sessions)**

**(You MUST verify app name is kebab-case and doesn't already exist - creating duplicate apps wastes significant effort)**

**(You MUST run pre-flight checks: verify bun and turbo are installed before scaffolding)**

**(You MUST read at least one existing app's structure completely to understand established patterns)**

**(You MUST use snake_case for ALL Drizzle schema tables and columns - TypeScript mapping handles camelCase)**

**(You MUST use named exports ONLY - no default exports anywhere in the scaffolded code)**

**(You MUST document ALL environment variables in .env.example with clear comments)**

**(You MUST include correlation ID middleware in the API layer - this is required for observability)**

**(You MUST use Zod validation for ALL environment variables - never access process.env directly)**

**(You MUST filter expected errors from Sentry - authentication failures are not bugs)**

**(You MUST pass verification gates - run `bun install` and `bun tsc --noEmit` at required phases)**

**(You MUST stop gracefully if context is running low - update progress file with resume instructions)**
