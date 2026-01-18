# API & Data Fetching - Reference

> Decision frameworks, anti-patterns, and integration guides. See [SKILL.md](SKILL.md) for core concepts.

---

<decision_framework>

## Decision Framework

### Data Fetching Strategy

```
Need to fetch server data?
|
+-- Is it needed in MobX stores?
|   |
|   +-- YES --> Use MobxQuery bridge
|   |           (Stores that need reactive server data)
|   |
|   +-- NO --> Use useQuery directly in component
|              (Simple component-level data)
|
+-- Is it a mutation (POST/PUT/DELETE)?
    |
    +-- YES --> Use useMutation in custom hook
    |           with notifications and cache invalidation
    |
    +-- NO --> Use useQuery with query key constants
```

### URL Construction

```
Need to make API call?
|
+-- Does API class exist for this endpoint?
|   |
|   +-- YES --> Use static method (ContentAPI.templateURL(id))
|   |
|   +-- NO --> Add method to appropriate API class
|              (ContentAPI, TeamAPI, UserAPI, etc.)
|
+-- Does URL have query parameters?
    |
    +-- YES --> Use URL class with searchParams.set()
    |
    +-- NO --> Use template literal with base URL
```

### Response Validation

```
Processing API response?
|
+-- Is response structure critical?
|   |
|   +-- YES --> Use Zod schema with safeParse
|   |           Log errors, return null on failure
|   |
|   +-- NO --> Still use Zod schema
|              (All responses should be validated)
```

### Store vs Hook

```
Where to put data fetching logic?
|
+-- Is data needed by multiple stores?
|   |
|   +-- YES --> Use MobxQuery in store
|   |
|   +-- NO --> Is data needed in store computeds?
|       |
|       +-- YES --> Use MobxQuery in store
|       |
|       +-- NO --> Use useQuery in custom hook
```

</decision_framework>

---

<integration>

## Integration Guide

**Works with:**

- **MobX Stores**: MobxQuery bridges React Query to MobX reactivity; stores must use runInAction after await
- **NotificationsStore (@photoroom/ui)**: Show success/error toasts via addNotification
- **Firebase Auth**: djangoBackend interceptor injects Firebase token automatically
- **i18next**: All user-facing messages use t() for translation
- **Sentry**: makeLogger sends errors to Sentry with module context
- **appEnv**: Base URLs come from environment configuration

**Replaces / Conflicts with:**

- **Custom axios instances**: Always use djangoBackend, never create new axios.create()
- **Direct fetch()**: Use djangoBackend for auth token injection
- **Manual cache management**: React Query handles caching; don't store server data in MobX unless using MobxQuery
- **console.log for errors**: Use makeLogger for structured error tracking

</integration>

---

<anti_patterns>

## Anti-Patterns

### ❌ Creating Custom Axios Instances

Custom axios instances bypass the configured `djangoBackend` interceptors, causing authentication failures and missing headers.

```typescript
// ❌ Anti-pattern
const myApi = axios.create({ baseURL: "https://api.photoroom.com" });
const response = await myApi.get("/v2/templates/"); // No auth token!

// ✅ Correct approach
import { djangoBackend } from "lib/apiServices";
const response = await djangoBackend.get(ContentAPI.templatesURL());
```

**Why this matters:** The auth interceptor injects Firebase tokens automatically. Custom instances require manual token handling which is error-prone and duplicates logic.

---

### ❌ Hardcoding API URLs

Hardcoded URLs break across environments and make API version upgrades painful.

```typescript
// ❌ Anti-pattern
await djangoBackend.get("https://api.photoroom.com/v2/templates/?page=1");
await djangoBackend.get(`${baseUrl}/v2/templates/?page=${page}&favorite=${favorite}`);

// ✅ Correct approach
await djangoBackend.get(ContentAPI.userTemplatesURL({ page: 1 }));
```

**Why this matters:** Static API classes centralize URL construction, handle query parameter encoding automatically, and make version migrations a single-point change.

---

### ❌ Using parse() Instead of safeParse()

Zod's `parse()` throws exceptions on invalid data, crashing the application.

```typescript
// ❌ Anti-pattern
const data = ApiInfoSchema.parse(response.data); // Throws on invalid data!

// ✅ Correct approach
const result = ApiInfoSchema.safeParse(response.data);
if (!result.success) {
  logger.error("Validation failed", { errors: result.error.issues });
  return null;
}
return result.data;
```

**Why this matters:** Backend contract changes happen. `safeParse()` handles failures gracefully while `parse()` crashes the entire component tree.

---

### ❌ Missing runInAction in MobxQuery Callbacks

MobX requires state mutations to occur within actions. Callbacks from async operations run outside the action context.

```typescript
// ❌ Anti-pattern
this.#teamsQuery = new MobxQuery(
  { queryKey: [teamsQueryIdentifier], queryFn: fetchTeams },
  (result) => {
    this.teams = result.data ?? []; // MobX warning! Outside action
  }
);

// ✅ Correct approach
this.#teamsQuery = new MobxQuery(
  { queryKey: [teamsQueryIdentifier], queryFn: fetchTeams },
  (result) => {
    runInAction(() => {
      this.teams = result.data ?? [];
    });
  }
);
```

**Why this matters:** MobX cannot track mutations that happen outside actions, breaking reactivity and causing stale UI.

---

### ❌ Missing MobxQuery Dispose

MobxQuery subscriptions create memory leaks if not properly cleaned up when stores are destroyed.

```typescript
// ❌ Anti-pattern
class Store {
  #query = new MobxQuery({ queryKey: ["data"], queryFn: fetchData });
  // No dispose method - subscription lives forever!
}

// ✅ Correct approach
class Store {
  #query = new MobxQuery({ queryKey: ["data"], queryFn: fetchData });

  dispose = () => {
    this.#query.dispose();
  };
}
```

**Why this matters:** Undisposed queries continue running, causing memory leaks and stale data updates to unmounted components.

---

### ❌ Using Deprecated CancelToken Instead of AbortController

CancelToken was deprecated in Axios v0.22.0 and will be removed in future versions. Use the native AbortController API instead.

```typescript
// ❌ Anti-pattern - Deprecated CancelToken
import axios from "axios";

const source = axios.CancelToken.source();
const response = await djangoBackend.get(url, {
  cancelToken: source.token,
});
source.cancel("Operation cancelled");

// ✅ Correct approach - AbortController
const controller = new AbortController();
const response = await djangoBackend.get(url, {
  signal: controller.signal,
});
controller.abort();
```

**Why this matters:** CancelToken is deprecated and based on a withdrawn ECMAScript proposal. AbortController is the native browser API with better support and will be the only cancellation method in future Axios versions.

---

### ❌ Using useEffect to Sync React Query with MobX

Syncing React Query data to MobX via useEffect creates unnecessary rerenders and race conditions.

```typescript
// ❌ Anti-pattern
const { data } = useQuery({ queryKey: ["teams"], queryFn: fetchTeams });
useEffect(() => {
  if (data) {
    teamsStore.setTeams(data); // Race condition! Extra rerenders!
  }
}, [data]);

// ✅ Correct approach
// Use MobxQuery in the store instead
class TeamsStore {
  #query = new MobxQuery(
    { queryKey: ["teams"], queryFn: fetchTeams },
    (result) => runInAction(() => { this.teams = result.data ?? []; })
  );
}
```

**Why this matters:** MobxQuery bridges React Query to MobX properly, avoiding the component render cycle entirely.

</anti_patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Creating custom axios instances (use djangoBackend for auth injection)
- Hardcoding API URLs (use static API classes)
- Missing runInAction after await in MobX stores (breaks reactivity)
- Missing Zod validation on API responses (causes cryptic runtime errors)
- Using parse instead of safeParse (throws on invalid data)
- Missing MobxQuery dispose (memory leak)
- Regular methods instead of arrow functions in stores (loses this binding)

**Medium Priority Issues:**

- Missing onError in useMutation (user gets no feedback)
- Missing cache invalidation after mutations (stale data)
- Hardcoded notification messages (use t() for i18n)
- Using alert() instead of NotificationsStore
- Missing logger context in error handling

**Common Mistakes:**

- Forgetting to add new query key constants (use existing pattern)
- Using useEffect to sync React Query data to MobX (use MobxQuery instead)
- Not re-throwing errors after logging (breaks React Query error handling)
- Passing stores as props instead of using stores singleton

**Gotchas & Edge Cases:**

- djangoBackend.get() returns { data: ... } - access response.data not response
- API classes use trailing slashes on URLs (Django requires them)
- Zod safeParse returns { success, data } or { success, error } - check success first
- MobxQuery callback runs on every query state change (loading, success, error)
- Query key arrays must be stable (use constants, not inline arrays)
- authInterceptor is async - token may not be immediately available
- CancelToken is deprecated since Axios v0.22.0 - use AbortController instead
- `InternalAxiosRequestConfig` (not `AxiosRequestConfig`) must be used in request interceptors (Axios v1.x TypeScript change)
- React Query v5 passes `signal` in queryFn context for automatic cancellation - use it!

</red_flags>
