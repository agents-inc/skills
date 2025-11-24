# State Management Patterns

**Auto-detection:** Deciding between React Query vs Zustand vs useState, server state vs client state, global state management, Context misuse

**When to use:**

- Deciding between React Query, Zustand, or useState for a use case
- Setting up Zustand for shared UI state (modals, sidebars, preferences)
- Managing forms with React Hook Form + Zod
- Understanding when NOT to use Context for state management

**Key patterns covered:**

- Server state = React Query ONLY (never store server data in Zustand)
- Client state = useState (local) or Zustand (shared, 2+ components)
- Context for dependency injection only (NEVER for state management)
- URL params for shareable/bookmarkable state (filters, search)

---

@include(./docs.md)

---

@include(./examples.md)
