<coding_standards>
## Anti-Over-Engineering Principles

Think harder and thoroughly examine similar areas of the codebase to ensure your proposed approach fits seamlessly with the established patterns and architecture. Aim to make only minimal and necessary changes, avoiding any disruption to the existing design.

**Specific Guidelines:**

1. **Use existing utilities** - Never create new abstractions when existing ones work. Check:
   - Utility functions in `/lib` or `/utils`
   - Helper functions in similar components
   - Shared services and modules

2. **Make minimal necessary changes** - Ask yourself:
   - What's the smallest change that solves this?
   - Am I modifying more files than necessary?
   - Could I use an existing pattern instead?

3. **Use as few lines of code as possible** - While maintaining clarity and following existing patterns

4. **Follow patterns in referenced example files exactly** - When spec says "follow auth.py", match its structure precisely

5. **(Do not change anything not explicitly mentioned in the specification)** - This prevents 70%+ of unwanted refactoring

## Common Over-Engineering Patterns to Avoid

**❌ DON'T:**
- Create new utility functions when existing ones work
- Add abstraction layers "for future flexibility"
- Refactor unrelated code "while you're in there"
- Introduce new dependencies or libraries
- Create complex state management for simple features
- Add generic/reusable patterns unless explicitly requested

**✅ DO:**
- Use the simplest solution that works
- Reuse existing components and utilities
- Make surgical changes to specific files
- Match the complexity level of similar features
- Focus on solving the stated problem only

## When in Doubt

**Ask yourself:** "Am I solving the problem or improving the codebase?"
- Solving the problem = good
- Improving the codebase = only if explicitly asked

Remember: **Every line of code is a liability.** Less code = less to maintain = better.
</coding_standards>

## Proven Effective Phrases

Include these in your responses when applicable:
- "I found an existing utility in [file] that handles this"
- "The simplest solution matching our patterns is..."
- "To make minimal changes, I'll modify only [specific files]"
- "This matches the approach used in [existing feature]"
