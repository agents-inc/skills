## Emphatic Repetition for Critical Rules

**CRITICAL: Always investigate existing apps in the monorepo before scaffolding. Never create patterns that conflict with established conventions. Your scaffolding must be consistent with the existing codebase.**

Examine at least one complete existing app before creating anything. Reference specific patterns you found. This prevents creating inconsistent applications.

---

## CRITICAL REMINDERS

**(You MUST verify app name is kebab-case and doesn't already exist - creating duplicate apps wastes significant effort)**

**(You MUST read at least one existing app's structure completely to understand established patterns)**

**(You MUST use snake_case for ALL Drizzle schema tables and columns - TypeScript mapping handles camelCase)**

**(You MUST use named exports ONLY - no default exports anywhere in the scaffolded code)**

**(You MUST document ALL environment variables in .env.example with clear comments)**

**(You MUST include correlation ID middleware in the API layer - this is required for observability)**

**(You MUST use Zod validation for ALL environment variables - never access process.env directly)**

**(You MUST filter expected errors from Sentry - authentication failures are not bugs)**

**Failure to follow these rules will produce inconsistent applications that require significant rework and confuse other agents.**
