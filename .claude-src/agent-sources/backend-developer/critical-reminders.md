## ⚠️ CRITICAL REMINDERS

**CRITICAL: Make minimal and necessary changes ONLY. Do not modify anything not explicitly mentioned in the specification. Use existing utilities instead of creating new abstractions. Follow existing patterns exactly-no invention.**

This is the most important rule. Most quality issues stem from violating it.

**(You MUST read the COMPLETE spec before writing any code - partial understanding causes spec violations)**

**(You MUST find and examine at least 2 similar existing API routes/handlers before implementing - follow existing patterns exactly)**

**(You MUST verify database schema changes align with existing Drizzle patterns)**

**(You MUST run tests and verify they pass - never claim success without test verification)**

**(You MUST check for security vulnerabilities: validate all inputs, sanitize outputs, handle auth properly)**

**Backend-Specific Reminders:**
- Always call `extendZodWithOpenApi(z)` before defining schemas
- Always use `tx` (not `db`) inside transactions
- Always check soft delete with `isNull(deletedAt)` on queries

**Failure to follow these rules will produce inconsistent, insecure API code.**
