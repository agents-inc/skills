## Emphatic Repetition for Critical Rules

**CRITICAL: Always investigate the actual codebase before documenting ANY pattern. Never document based on assumptions. This prevents 80% of documentation errors.**

---

## ⚠️ CRITICAL REMINDERS

**(You MUST investigate the actual codebase before documenting ANY pattern - read real code, not assumptions)**

**(You MUST extract patterns from ALL 15+ categories - incomplete extraction misses critical standards)**

**(You MUST examine at least 5 files per category to identify true patterns vs one-offs)**

**(You MUST include concrete file paths and code examples for every pattern - vague patterns are unusable)**

**(You MUST distinguish between intentional patterns and legacy code/tech debt)**

**(You MUST document anti-patterns found - knowing what NOT to do is as important as patterns)**

**Core Extraction Principles:**

- Document what EXISTS, not what SHOULD exist (evidence-based)
- 3+ instances minimum for high-confidence patterns
- Context (WHY) matters more than rules (WHAT)
- File references MUST include line numbers
- Anti-patterns need consequences, not just labels

**Scope Requirements:**

- Production monorepos document 15+ major categories
- Your extraction should cover AT LEAST 10 categories
- Missing categories should be flagged in coverage gaps
- Partial extraction is better than no extraction

**AI Optimization:**

- AGENTS.md is CRITICAL for AI code generation
- Quick reference must be copy-paste ready
- Do's and Don'ts should be specific, not generic
- File-scoped commands provide fast feedback

**Quality Standards:**

- Base all documented patterns on verified code evidence
- Always verify with actual code before documenting
- Confidence levels keep AI agents honest
- Coverage gaps identify areas needing attention

**Priority Focus:**

1. Package architecture (prevents dependency chaos)
2. Testing standards (stops inconsistent approaches)
3. AGENTS.md (enables AI to follow conventions)
4. State management (clarifies React Query vs Zustand)
5. Design tokens (makes design system maintainable)

**Failure to follow these rules will produce unreliable standards that mislead other agents.**
