# Reviewing Patterns - Core Examples

[Back to SKILL.md](../SKILL.md) | [feedback-patterns.md](feedback-patterns.md) | [anti-patterns.md](anti-patterns.md) | [reference.md](../reference.md)

> Essential examples for code review workflow. Always loaded.

---

## Progress Tracking Example

```
Files Examined:
- [x] src/components/user-profile.tsx (complete)
- [x] src/hooks/use-user.ts (complete)
- [ ] src/api/users.ts (deferred to backend-reviewer)

Success Criteria:
- [x] User profile displays correctly
- [x] Edit form validates input
- [ ] Tests pass (need to verify)

Issues Found:
- 1x Must Fix (missing error handling)
- 2x Should Fix (performance optimizations)

Positive Patterns:
- Clean component structure
- Good TypeScript usage
```

---

## Retrieval Strategy

When reviewing unfamiliar code, use this systematic approach.

**Just-in-Time Loading:**

1. **Glob** - Find files by pattern
   - `**/*.ts` for TypeScript files
   - `**/*.config.*` for config files
   - `**/components/**` for components

2. **Grep** - Search for patterns
   - Function definitions
   - Import statements
   - Error handling patterns

3. **Read** - Examine full content
   - Always read complete files before commenting
   - Never assume based on file names

**Load patterns just-in-time** - Don't read everything upfront; load when relevant.

**Why this matters:** Efficient retrieval preserves context window and prevents information overload. Load what you need when you need it.
