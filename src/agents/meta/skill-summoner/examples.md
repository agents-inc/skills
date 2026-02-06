## Example: Complete Skill Package

Here's what a complete, high-quality skill directory looks like:

### Directory Structure

```
.claude/skills/web-state-mobx/
├── SKILL.md
├── metadata.yaml
├── reference.md
└── examples/
    └── async-actions.md
```

### metadata.yaml

```yaml
category: web-state
author: "@skill-summoner"
version: 1
cli_name: MobX State
cli_description: Observable state management patterns
usage_guidance: >-
  Use when implementing client-side state with MobX observables,
  computed values, or reactions. Not for server state (use React Query).
requires: []
compatible_with:
  - web-framework-react
conflicts_with:
  - web-state-redux-toolkit
tags:
  - state-management
  - observables
  - computed-values
```

### SKILL.md

````markdown
---
name: MobX State Management
description: Patterns for MobX observable state management in React
---

# MobX State Management Patterns

> **Quick Guide:** Use MobX for complex client state that needs computed values and automatic dependency tracking.

## Table of Contents

- [When to Use This Skill](#when-to-use-this-skill)
- [Core Patterns](#core-patterns)
  - [Store with makeAutoObservable](#pattern-1-store-with-makeautoobservable)
  - [Async Actions](#pattern-2-async-actions)
- [Anti-Patterns](#anti-patterns)
- [Decision Trees](#decision-trees)

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md**

**(You MUST call `makeAutoObservable(this)` in EVERY store constructor)**

**(You MUST wrap ALL async state updates in `runInAction()`)**

**(You MUST use React Query for server state - NOT MobX)**

</critical_requirements>

---

## When to Use This Skill

- Managing complex client state with computed values
- Building stores that need automatic dependency tracking
- Working with class-based state management

---

<patterns>

## Core Patterns

### Pattern 1: Store with makeAutoObservable

```typescript
// Good Example
import { makeAutoObservable, runInAction } from "mobx";

const ACTIVE_STATUS = "active";

class UserStore {
  users: User[] = [];
  isLoading = false;

  constructor() {
    makeAutoObservable(this);
  }

  get activeUsers() {
    return this.users.filter((u) => u.status === ACTIVE_STATUS);
  }

  setUsers(users: User[]) {
    this.users = users;
  }
}

export { UserStore };
```

**Why good:** makeAutoObservable enables automatic tracking, named constants prevent magic strings, named exports follow conventions

```typescript
// Bad Example
class UserStore {
  users = [];

  async fetchUsers() {
    const response = await apiClient.getUsers();
    this.users = response.data; // BAD: Outside action after await
  }
}

export default UserStore; // BAD: Default export
```

**Why bad:** State mutation after await breaks reactivity, default export violates conventions

### Pattern 2: Async Actions

```typescript
// Good Example
async fetchUsers() {
  this.isLoading = true;
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
```

</patterns>

---

<decision_framework>

## Decision Trees

```
Need client state management?
├─ Is it server/remote data?
│   └─ YES -> React Query (not MobX)
└─ NO -> Do you need computed values?
    ├─ YES -> MobX
    └─ NO -> Zustand (simpler)
```

</decision_framework>

---

<red_flags>

## Anti-Patterns

- Mutating observables outside actions (breaks reactivity)
- Not using runInAction for async updates
- Using MobX for server state (use React Query)

**Gotchas:**

- Code after `await` is NOT part of the action
- Destructuring observables breaks reactivity

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

**(You MUST call `makeAutoObservable(this)` in EVERY store constructor)**

**(You MUST wrap ALL async state updates in `runInAction()`)**

**(You MUST use React Query for server state - NOT MobX)**

</critical_reminders>
````

---

## Example: Compliance Mode Output

```markdown
<compliance_skill_creation>
**Mode:** Compliance Mode
**Documentation Source:** .ai-docs/stores/

**Documentation Files Read:**

- [x] llms.txt
- [x] CONCEPTS.md
- [x] features/user-store/README.md
- [x] features/user-store/STORE-API.md
- [x] features/user-store/flows/\*.md
- [x] features/user-store/PITFALLS.md

**Patterns Extracted:**

- UserStore initialization pattern
- Async action wrapping with runInAction
- Computed value caching

**Skills to Create:**

- `.claude/skills/web-state-mobx/` - MobX state management

**Note:** All patterns faithfully reproduced from documentation. No external research performed.
</compliance_skill_creation>
```

---

## Common Mistakes

**1. Wrong Directory Location**

- Correct: `.claude/skills/web-state-mobx/`
- Wrong: `src/skills/state/mobx.md`

**2. Missing 3-Part Name**

- Correct: `web-state-mobx`, `api-database-drizzle`
- Wrong: `mobx`, `state-mobx`, `web-mobx`

**3. Single File Instead of Directory**

- Correct: Directory with SKILL.md + metadata.yaml
- Wrong: Single `mobx.md` file

**4. Missing TOC for Long Documents**

- Add Table of Contents for SKILL.md > 100 lines
- Section headers must match TOC entries exactly

**5. Generic Auto-Detection Keywords**

- Correct: "MobX observable, makeAutoObservable, runInAction"
- Wrong: "state management, stores"

**6. Missing Examples in Core Patterns**

- Every Core Pattern needs embedded good/bad examples
- Examples must be complete and runnable
