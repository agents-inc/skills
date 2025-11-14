# 14. Quick Reference for AI

> **Quick Guide:** Essential patterns, critical do's and don'ts, and file-scoped commands for fast feedback.

## 14.1 Essential Patterns

- Most common code patterns
- Copy-paste ready examples
- Component boilerplate
- Hook patterns

## 14.2 Critical Do's

✅ Use hey-api for API client generation
✅ Enforce strict TypeScript
✅ Use MSW for API mocking
✅ Keep server state in React Query
✅ Keep client state in Zustand
✅ Use `shallow` when selecting multiple Zustand values
✅ Forward refs on interactive components
✅ Expose className on all components
✅ Use named constants (no magic numbers)
✅ Three-tier design token system

## 14.3 Critical Don'ts

❌ Never store server data in Zustand
❌ Never use `any` without justification
❌ Never hardcode API URLs
❌ Never skip MSW setup for tests
❌ Never use magic numbers
❌ Never skip ref forwarding
❌ Never skip className prop
❌ Never commit secrets
❌ Never skip `shallow` for multiple Zustand selects

## 14.4 File-Scoped Commands

> See [examples.md](./examples.md#144-file-scoped-commands) for fast feedback commands
