# Code Review & Anti-Patterns

**Auto-detection:** Code review, PR review, anti-patterns, code quality checks, best practices enforcement, refactoring guidance

**When to use:**

- Reviewing pull requests for common anti-patterns
- Identifying state management mistakes (server data in Zustand, Context for state)
- Catching performance anti-patterns (memoize everything, no lazy loading)
- Ensuring accessibility and security best practices

**Key patterns covered:**

- State management anti-patterns (server data in Zustand/Context, Context for state management)
- Component anti-patterns (God components >300 lines, missing ref forwarding, no className prop)
- Performance anti-patterns (premature memoization, importing entire libraries, no code splitting)
- Security anti-patterns (committed secrets, dangerouslySetInnerHTML with user input, no validation)

---

@include(./docs.md)

---

@include(./examples.md)
