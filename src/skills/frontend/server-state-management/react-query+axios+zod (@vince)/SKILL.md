---
name: frontend/server-state-react-query+axios+zod (@vince)
description: React Query, Axios, API classes for Photoroom webapp
---

# API & Data Fetching Patterns (Photoroom Webapp)

> **Quick Guide:** Use React Query for server state, djangoBackend axios instance for HTTP calls, static API classes for URL construction, and Zod for response validation. Bridge to MobX stores with MobxQuery when needed.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (PascalCase for components/stores, camelCase for hooks/utilities, named exports, import ordering, `import type`)

**(You MUST use djangoBackend axios instance for ALL API calls - NEVER create custom axios instances)**

**(You MUST use static API classes (ContentAPI, TeamAPI, UserAPI) for URL construction - NEVER hardcode URLs)**

**(You MUST use Zod schemas with safeParse for ALL API response validation)**

**(You MUST wrap ALL async state mutations after await in runInAction())**

**(You MUST dispose MobxQuery instances when stores are destroyed)**

</critical_requirements>

---

**Auto-detection:** djangoBackend, React Query, useMutation, useQuery, Zod schema, API classes, MobxQuery, queryClient, axios interceptor

**When to use:**

- Fetching data from Django backend (v2/v3 endpoints)
- Creating mutations with React Query in custom hooks
- Validating API responses with Zod schemas
- Bridging React Query with MobX stores via MobxQuery
- Constructing URLs with static API classes

**When NOT to use:**

- Engine WASM operations (use EngineStore)
- Firebase authentication (use AuthStore)
- Local UI state (use useState or MobX)
- WebSocket connections (not covered here)

**Key patterns covered:**

- Axios instance configuration with interceptors (djangoBackend)
- Static API class URL construction (ContentAPI, TeamAPI, UserAPI)
- Query key string constants for cache management
- useMutation in custom hooks with notifications
- Zod schema validation with safeParse
- MobxQuery bridge for store integration
- React Query conservative defaults

**Detailed Resources:**
- For code examples, see [examples.md](examples.md)
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

---

<philosophy>

## Philosophy

The Photoroom webapp uses a **layered API architecture** that separates concerns:

1. **Transport Layer**: `djangoBackend` axios instance handles all HTTP communication with configured interceptors for authentication and headers
2. **URL Layer**: Static API classes (ContentAPI, TeamAPI, UserAPI) construct type-safe URLs with query parameters
3. **Validation Layer**: Zod schemas validate API responses at runtime, catching contract changes early
4. **State Layer**: React Query manages server state caching; MobxQuery bridges to MobX stores when needed

**Why this approach:**

- Centralized auth token injection via interceptors
- Type-safe URL construction prevents typos
- Runtime validation catches backend contract changes
- React Query handles caching, retries, and deduplication
- MobxQuery enables reactive store updates from server data

**When to use React Query directly:**

- Simple data fetching in components with useQuery
- Mutations in custom hooks with useMutation
- When data is only needed in React component tree

**When to use MobxQuery:**

- Data needs to be reactive in MobX stores
- Multiple stores need to observe the same data
- Complex state derivations depend on server data

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Static API Class for URL Construction

Use static class methods to construct URLs with type-safe query parameters. URLs are built from `appEnv.photoroom.backendURL` base.

See [examples.md](examples.md#pattern-1-static-api-class-for-url-construction) for implementation.

---

### Pattern 2: Axios Instance with Interceptors

Use the configured `djangoBackend` axios instance with auth and header interceptors. Never create custom axios instances.

See [examples.md](examples.md#pattern-2-axios-instance-with-interceptors) for implementation.

---

### Pattern 3: React Query Configuration

React Query is configured with conservative defaults - no automatic refetching. Use query key string constants.

See [examples.md](examples.md#pattern-3-react-query-configuration) for implementation.

---

### Pattern 4: useMutation in Custom Hooks

Wrap useMutation in custom hooks that handle notifications and state coordination.

See [examples.md](examples.md#pattern-4-usemutation-in-custom-hooks) for implementation.

---

### Pattern 5: Zod Schema Validation

Validate ALL API responses with Zod schemas using safeParse to catch contract changes.

See [examples.md](examples.md#pattern-5-zod-schema-validation) for implementation.

---

### Pattern 6: MobxQuery Bridge for Store Integration

Use MobxQuery to bridge React Query data into MobX stores for reactive updates.

See [examples.md](examples.md#pattern-6-mobxquery-bridge-for-store-integration) for implementation.

---

### Pattern 7: Error Handling with Logger

Use module-specific loggers for API error tracking with structured context.

See [examples.md](examples.md#pattern-7-error-handling-with-logger) for implementation.

---

### Pattern 8: User Notifications for Mutations

Show user feedback via NotificationsStore for mutation success/failure.

See [examples.md](examples.md#pattern-8-user-notifications-for-mutations) for implementation.

</patterns>

---

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use djangoBackend axios instance for ALL API calls - NEVER create custom axios instances)**

**(You MUST use static API classes (ContentAPI, TeamAPI, UserAPI) for URL construction - NEVER hardcode URLs)**

**(You MUST use Zod schemas with safeParse for ALL API response validation)**

**(You MUST wrap ALL async state mutations after await in runInAction())**

**(You MUST dispose MobxQuery instances when stores are destroyed)**

**Failure to follow these rules will cause auth failures, runtime crashes, and memory leaks.**

</critical_reminders>
