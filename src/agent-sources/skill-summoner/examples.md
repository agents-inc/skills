## Example: Complete PROMPT_BIBLE-Compliant Skill

Here's what a complete, high-quality single-file skill looks like with **PROMPT_BIBLE compliance**:

**File: `mobx.md`**

````markdown
# MobX State Management Patterns

> **Quick Guide:** Use MobX for complex client state that needs computed values and automatic dependency tracking. Choose over Zustand when you need class-based stores or extensive derived state.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST call `makeAutoObservable(this)` in EVERY store constructor)**

**(You MUST wrap ALL async state updates in `runInAction()`)**

**(You MUST use React Query for server state - NOT MobX)**

**(You MUST use `observer()` HOC on ALL React components that read observables)**

</critical_requirements>

---

**Auto-detection:** MobX observable, makeAutoObservable, runInAction, computed values, MobX store patterns

**When to use:**

- Managing complex client state with computed values and reactions
- Building stores that need automatic dependency tracking
- Synchronizing derived state without manual effects
- Working with class-based state management (OOP approach)

**Key patterns covered:**

- Store architecture (RootStore pattern, domain stores)
- Observable state with makeAutoObservable
- Actions and async actions (runInAction)
- Computed values for derived state
- React integration (observer HOC, useLocalObservable)

---

<philosophy>

## Philosophy

MobX follows the principle that "anything that can be derived from the application state, should be derived automatically." It uses observables and reactions to automatically track dependencies and update only what changed.

**When to use MobX:**

- Complex client state with lots of computed values
- Class-based architecture preference
- Need automatic dependency tracking
- Extensive derived state calculations

**When NOT to use MobX:**

- Server state (use React Query)
- Simple UI state (use Zustand or useState)
- Functional programming preference (use Zustand)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Store with makeAutoObservable

Use `makeAutoObservable` in the constructor to automatically make all properties observable and all methods actions.

#### Constants

```typescript
import { makeAutoObservable, runInAction } from "mobx";

const ACTIVE_STATUS = "active";
const MAX_USERS_PER_PAGE = 50;
```

#### Store Implementation

```typescript
// ✅ Good Example
class UserStore {
  users: User[] = [];
  isLoading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  // Computed value - automatically recalculates
  get activeUsers() {
    return this.users.filter((u) => u.status === ACTIVE_STATUS);
  }

  // Action for sync updates
  setUsers(users: User[]) {
    this.users = users;
  }

  // Async action with runInAction
  async fetchUsers() {
    this.isLoading = true;
    this.error = null;

    try {
      const response = await apiClient.getUsers();
      runInAction(() => {
        this.users = response.data;
        this.isLoading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err.message;
        this.isLoading = false;
      });
    }
  }
}

// Named export (project convention)
export { UserStore };
```

**Why good:** makeAutoObservable enables automatic tracking without manual decorators, runInAction prevents "state modified outside action" warnings after await, named constants prevent magic string bugs when refactoring

```typescript
// ❌ Bad Example - Missing runInAction for async
class UserStore {
  users: User[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  async fetchUsers() {
    const response = await apiClient.getUsers();
    // BAD: Mutating state outside of action after await
    this.users = response.data;
  }
}

export default UserStore; // BAD: Default export
```

**Why bad:** State mutation after await is outside action context = MobX warns and reactivity may break, default export prevents tree-shaking and violates project conventions

**When to use:** Most MobX stores where automatic observable/action inference is desired.

**When not to use:** When you need fine-grained control over which specific properties are observable (use makeObservable with explicit annotations instead).

</patterns>

---

<performance>

## Performance Optimization

**Computed Value Caching:**

- MobX caches computed values automatically
- Only recalculates when dependencies change
- Avoid creating new objects/arrays in computeds without memoization

**Reaction Optimization:**

- Use `reaction()` instead of `autorun()` for fine-grained control
- Specify exact dependencies to avoid unnecessary re-runs

</performance>

---

<decision_framework>

## Decision Framework

```
Need client state management?
├─ Is it server/remote data?
│   └─ YES → React Query (not MobX)
└─ NO → Is it simple UI state?
    ├─ YES → useState or Zustand
    └─ NO → Do you need computed values?
        ├─ YES → MobX ✓
        └─ NO → Zustand (simpler)
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ Mutating observables outside actions (breaks reactivity)
- ❌ Not using runInAction for async updates (causes warnings)
- ❌ Using MobX for server state (use React Query)

**Medium Priority Issues:**

- ⚠️ Over-using computed values (performance cost for simple derivations)
- ⚠️ Not using observer HOC on React components

**Common Mistakes:**

- Forgetting to wrap async state updates in runInAction
- Creating new objects/arrays in computed values without memoization

**Gotchas & Edge Cases:**

- Code after `await` is NOT part of the action - always wrap post-await mutations in `runInAction()`
- `observer()` must wrap the component, not be called inside
- Destructuring observables breaks reactivity

</red_flags>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST call `makeAutoObservable(this)` in EVERY store constructor)**

**(You MUST wrap ALL async state updates in `runInAction()`)**

**(You MUST use React Query for server state - NOT MobX)**

**(You MUST use `observer()` HOC on ALL React components that read observables)**

**Failure to follow these rules will break MobX reactivity and cause silent bugs.**

</critical_reminders>
````

This example shows:

- ✅ Single file with all content
- ✅ **PROMPT_BIBLE compliant**: `<critical_requirements>` at TOP, `<critical_reminders>` at BOTTOM
- ✅ **References CLAUDE.md** for generic conventions (kebab-case, named exports, etc.)
- ✅ **Domain-specific critical rules** only (not generic project conventions)
- ✅ **Emphatic formatting**: `**(bold + parentheses)**` for must-do rules
- ✅ **Semantic XML tags**: `<critical_requirements>`, `<philosophy>`, `<patterns>`, `<performance>` (optional), `<decision_framework>`, `<integration>` (optional), `<red_flags>`, `<critical_reminders>`
- ✅ **Markdown headers** (`#### SubsectionName`) within patterns as needed
- ✅ **Horizontal rules** (`---`) between major patterns
- ✅ Embedded good/bad examples within patterns
- ✅ Complete, production-ready code
- ✅ Clear decision frameworks
- ✅ `<red_flags>` section with "Gotchas & Edge Cases" subsection
- ✅ `<performance>` section for optimization patterns (optional - included when relevant)
