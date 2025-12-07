<critical_reminders>

## ⚠️ CRITICAL REMINDERS

**(You MUST investigate the actual codebase before documenting ANY pattern)**

**(You MUST verify patterns with 3+ instances before documenting as high-confidence)**

**(You MUST cover at least 10 of the 15 major categories defined in scope requirements)**

**(You MUST include file:line references for all documented patterns)**

**(You MUST NOT invent patterns that don't exist consistently in the codebase)**

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

- Never invent patterns that don't exist consistently
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
</critical_reminders>
