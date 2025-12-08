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

#### Implementation

```typescript
// src/lib/APIs.ts
import { appEnv } from "lib/appEnv";

export class ContentAPI {
  // Static URL for simple endpoints
  static readonly lastOpenedProjectsURL = `${appEnv.photoroom.backendURL}/v3/projects/virtual-folders/last-opened/`;

  // Method with query parameter handling
  static userTemplatesURL(options?: {
    page?: number;
    pageSize?: number;
    favorite?: boolean;
    teamID?: string;
  }) {
    const url = new URL(`${appEnv.photoroom.backendURL}/v2/templates/`);

    if (options?.page !== undefined) {
      url.searchParams.set("page", options.page.toString());
    }
    if (options?.pageSize !== undefined) {
      url.searchParams.set("page_size", options.pageSize.toString());
    }
    if (options?.favorite !== undefined) {
      url.searchParams.set("favorite", options.favorite.toString());
    }
    if (options?.teamID !== undefined) {
      url.searchParams.set("team_id", options.teamID);
    }

    return url.toString();
  }

  // Simple dynamic URL
  static templateURL(templateID: string) {
    return `${appEnv.photoroom.backendURL}/v2/templates/${templateID}/`;
  }
}

export class TeamAPI {
  static apiInfoURL(teamId: string) {
    return `${appEnv.photoroom.backendURL}/v2/teams/${teamId}/api-info/`;
  }

  static membersURL(teamId: string) {
    return `${appEnv.photoroom.backendURL}/v2/teams/${teamId}/members/`;
  }
}
```

**Why good:** Centralized URL construction prevents typos, URL class handles encoding automatically, type-safe options prevent invalid parameters, easy to update when API versions change

```typescript
// BAD Example - Hardcoded URLs
const fetchTemplates = async (page: number) => {
  // Hardcoded URL - breaks when base URL changes
  const response = await djangoBackend.get(
    `https://api.photoroom.com/v2/templates/?page=${page}`
  );
  return response.data;
};

// BAD Example - String concatenation
const url = appEnv.photoroom.backendURL + "/v2/templates/?page=" + page + "&favorite=" + favorite;
```

**Why bad:** Hardcoded URLs break across environments, string concatenation doesn't encode special characters properly, scattered URLs make version upgrades painful

---

### Pattern 2: Axios Instance with Interceptors

Use the configured `djangoBackend` axios instance with auth and header interceptors. Never create custom axios instances.

#### Configuration

```typescript
// src/lib/apiServices.ts
import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { appEnv } from "lib/appEnv";

export const djangoBackend = axios.create({
  baseURL: appEnv.photoroom.backendURL,
});

// Auth interceptor injects Firebase token
const authInterceptor = async (config: InternalAxiosRequestConfig) => {
  const firebaseToken = await getIdToken();
  if (config.headers && firebaseToken) {
    config.headers.authorization = firebaseToken;
  }
  return config;
};

// Headers interceptor adds common headers
const headersInterceptor = (config: InternalAxiosRequestConfig) => {
  if (config.headers) {
    config.headers["X-Client-Version"] = appEnv.clientVersion;
    config.headers["X-Platform"] = "webapp";
  }
  return config;
};

djangoBackend.interceptors.request.use(authInterceptor);
djangoBackend.interceptors.request.use(headersInterceptor);
```

#### Usage

```typescript
// In a fetch function
import { djangoBackend } from "lib/apiServices";
import { ContentAPI } from "lib/APIs";

export const fetchUserTemplates = async (options: { page: number; teamID?: string }) => {
  const response = await djangoBackend.get(ContentAPI.userTemplatesURL(options));
  return response.data;
};
```

**Why good:** Single axios instance means auth is always attached, interceptors handle cross-cutting concerns, consistent headers across all requests

```typescript
// BAD Example - Custom axios instance
const myApi = axios.create({
  baseURL: "https://api.photoroom.com",
});
// Missing auth token! Missing headers!
const response = await myApi.get("/v2/templates/");

// BAD Example - Manual token handling
const response = await fetch(url, {
  headers: {
    authorization: await getIdToken(), // Easy to forget
  },
});
```

**Why bad:** Custom instances bypass auth interceptor causing 401 errors, manual token handling is error-prone and duplicates logic everywhere

---

### Pattern 3: React Query Configuration

React Query is configured with conservative defaults - no automatic refetching.

#### QueryClient Setup

```typescript
// src/lib/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      throwOnError: true, // Let error boundaries handle errors
      refetchOnWindowFocus: false, // No automatic refetch
      refetchOnMount: false, // No automatic refetch
      refetchOnReconnect: false, // No automatic refetch
    },
  },
});
```

#### Query Key Constants

```typescript
// src/constants/queryKeys.ts
export const teamsQueryIdentifier = "teams";
export const courierTokenQueryIdentifier = "courierToken";
export const templateCategoriesIdentifier = "templateCategories";
export const entitlementsQueryIdentifier = "entitlements";
export const subscriptionQueryIdentifier = "subscription";
export const apiInfoQueryIdentifier = "apiInfo";
```

#### Usage with useQuery

```typescript
import { useQuery } from "@tanstack/react-query";
import { teamsQueryIdentifier } from "constants/queryKeys";

export const useTeams = () => {
  return useQuery({
    queryKey: [teamsQueryIdentifier],
    queryFn: fetchTeams,
    staleTime: Infinity, // Teams rarely change
  });
};
```

**Why good:** Conservative defaults prevent unexpected refetches that confuse users, string constants prevent typo bugs in cache keys, explicit staleTime makes caching policy clear

```typescript
// BAD Example - Magic string query keys
useQuery({
  queryKey: ["teams"], // Typo risk: "team" vs "teams"
  queryFn: fetchTeams,
});

// BAD Example - Aggressive refetching
new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true, // Causes UI flicker on tab switch
    },
  },
});
```

**Why bad:** String literals cause cache key mismatches when typos occur, aggressive refetching causes jarring UI updates when users switch tabs

---

### Pattern 4: useMutation in Custom Hooks

Wrap useMutation in custom hooks that handle notifications and state coordination.

#### Implementation

```typescript
// src/hooks/useCreateTeam.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { stores } from "stores";
import { teamsQueryIdentifier } from "constants/queryKeys";
import { createTeamApi } from "lib/teamApi";

export const useCreateTeam = () => {
  const { notificationsStore, teamsStore, authStore } = stores;
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    data: team,
    mutateAsync: createTeam,
    isPending: createTeamIsLoading,
    reset: resetCreateTeamMutation,
  } = useMutation({
    mutationFn: async (name: string) => createTeamApi(name),
    onSuccess: () => {
      // Invalidate teams cache to refetch
      queryClient.invalidateQueries({ queryKey: [teamsQueryIdentifier] });
    },
    onError: () => {
      notificationsStore.addNotification({
        type: "danger",
        label: t("team.create.error"),
      });
    },
  });

  return {
    team,
    createTeam,
    createTeamIsLoading,
    resetCreateTeamMutation,
  };
};
```

#### Usage in Component

```typescript
import { observer } from "mobx-react-lite";
import { useCreateTeam } from "hooks/useCreateTeam";

export const CreateTeamButton = observer(() => {
  const { createTeam, createTeamIsLoading } = useCreateTeam();

  const handleClick = async () => {
    await createTeam("My New Team");
  };

  return (
    <button onClick={handleClick} disabled={createTeamIsLoading}>
      {createTeamIsLoading ? t("common.loading") : t("team.create.button")}
    </button>
  );
});
```

**Why good:** Custom hooks encapsulate mutation logic with error handling, cache invalidation keeps UI in sync, notifications inform users of success/failure, clear loading states

```typescript
// BAD Example - Inline mutation without error handling
const Component = () => {
  const mutation = useMutation({
    mutationFn: createTeamApi,
    // No onError - user gets no feedback!
    // No cache invalidation - stale data!
  });

  return <button onClick={() => mutation.mutate("Team")}>Create</button>;
};

// BAD Example - Hardcoded error message
onError: () => {
  notificationsStore.addNotification({
    type: "danger",
    label: "Failed to create team", // Should use t() for translation
  });
};
```

**Why bad:** Missing error handlers leave users confused when mutations fail, skipping cache invalidation shows stale data, hardcoded strings break i18n

---

### Pattern 5: Zod Schema Validation

Validate ALL API responses with Zod schemas using safeParse to catch contract changes.

#### Schema Definition

```typescript
// src/lib/schemas/apiInfoSchema.ts
import { z } from "zod";

export const ApiKeySchema = z.object({
  id: z.number(),
  key: z.string(),
  name: z.string(),
});

export const ApiInfoSchema = z.object({
  apiKeys: z.array(ApiKeySchema),
  availableCredits: z.number(),
  isOnCustomPlan: z.boolean(),
});

export type ApiInfoResponse = z.infer<typeof ApiInfoSchema>;
```

#### Fetch Function with Validation

```typescript
// src/lib/teamApi.ts
import { djangoBackend } from "lib/apiServices";
import { TeamAPI } from "lib/APIs";
import { ApiInfoSchema } from "lib/schemas/apiInfoSchema";
import type { ApiInfoResponse } from "lib/schemas/apiInfoSchema";
import { makeLogger } from "lib/logger";

const logger = makeLogger("TeamAPI");

export const fetchApiInfo = async (teamId: string): Promise<ApiInfoResponse | null> => {
  const response = await djangoBackend.get(TeamAPI.apiInfoURL(teamId));
  const result = ApiInfoSchema.safeParse(response.data);

  if (!result.success) {
    logger.error("Failed to parse API info", { teamId, errors: result.error.issues });
    return null;
  }

  return result.data;
};
```

**Why good:** Zod catches backend contract changes at runtime before they cause UI errors, safeParse prevents crashes on invalid data, logger provides debugging context, type inference from schema ensures consistency

```typescript
// BAD Example - No validation
export const fetchApiInfo = async (teamId: string) => {
  const response = await djangoBackend.get(TeamAPI.apiInfoURL(teamId));
  return response.data; // Could be anything! May crash component
};

// BAD Example - Manual type assertion
const data = response.data as ApiInfoResponse; // Lies to TypeScript, crashes at runtime

// BAD Example - Using parse instead of safeParse
const data = ApiInfoSchema.parse(response.data); // Throws on invalid data!
```

**Why bad:** Unvalidated responses cause cryptic "undefined is not an object" errors deep in components, type assertions bypass TypeScript safety, parse throws exceptions breaking the app

---

### Pattern 6: MobxQuery Bridge for Store Integration

Use MobxQuery to bridge React Query data into MobX stores for reactive updates.

#### MobxQuery Setup

```typescript
// src/stores/utils/mobx-query.ts
import { QueryObserver } from "@tanstack/react-query";
import type { QueryObserverOptions, QueryObserverResult, QueryKey } from "@tanstack/react-query";
import { queryClient } from "lib/queryClient";

export class MobxQuery<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> {
  private observer?: QueryObserver<TQueryFnData, TError, TData, TQueryData, TQueryKey>;
  private unsubscribe?: () => void;

  constructor(
    private options: QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
    private onResultChange?: (result: QueryObserverResult<TData, TError>) => void
  ) {}

  query = () => {
    if (this.observer) return;

    this.observer = new QueryObserver(queryClient, this.options);
    this.unsubscribe = this.observer.subscribe((result) => {
      this.onResultChange?.(result);
    });
  };

  dispose = () => {
    this.unsubscribe?.();
    this.observer = undefined;
    this.unsubscribe = undefined;
  };
}
```

#### Usage in Store

```typescript
// src/stores/TeamsStore.ts
import { makeAutoObservable, runInAction } from "mobx";
import { MobxQuery } from "stores/utils/mobx-query";
import { teamsQueryIdentifier } from "constants/queryKeys";
import { fetchTeams } from "lib/teamApi";
import type { Team } from "@customTypes/team";

export class TeamsStore {
  teams: Team[] = [];
  isLoading = true;

  #teamsQuery: MobxQuery<Team[]>;

  constructor() {
    makeAutoObservable(this);

    this.#teamsQuery = new MobxQuery(
      {
        queryKey: [teamsQueryIdentifier],
        queryFn: fetchTeams,
      },
      (result) => {
        runInAction(() => {
          this.isLoading = result.isLoading;
          if (result.data) {
            this.teams = result.data;
          }
        });
      }
    );
  }

  initialize = () => {
    this.#teamsQuery.query();
  };

  // CRITICAL: Dispose on cleanup
  dispose = () => {
    this.#teamsQuery.dispose();
  };

  get activeTeam() {
    return this.teams.find((team) => team.isActive);
  }
}
```

**Why good:** MobxQuery enables MobX reactivity for server data, runInAction ensures MobX tracks mutations correctly, dispose prevents memory leaks, computed getters derive state automatically

```typescript
// BAD Example - Missing runInAction after subscribe callback
this.#teamsQuery = new MobxQuery(
  { queryKey: [teamsQueryIdentifier], queryFn: fetchTeams },
  (result) => {
    // MobX warning! Mutating outside action
    this.teams = result.data ?? [];
  }
);

// BAD Example - Missing dispose
class Store {
  #query = new MobxQuery(...);
  // No dispose method - memory leak!
}

// BAD Example - Using regular method instead of arrow function
dispose() {
  this.#teamsQuery.dispose(); // `this` is undefined when called externally
}
```

**Why bad:** Missing runInAction causes MobX warnings and broken reactivity, undisposed queries leak memory and cause stale updates, regular methods lose `this` binding when destructured

---

### Pattern 7: Error Handling with Logger

Use module-specific loggers for API error tracking with structured context.

#### Logger Creation

```typescript
// src/lib/logger.ts
import * as Sentry from "@sentry/browser";

export const makeLogger = (moduleName: string) => ({
  error: (message: string, context: Record<string, unknown> = {}, error?: Error) => {
    console.error(`[${moduleName}] ${message}`, context, error);
    Sentry.captureException(error ?? new Error(message), {
      tags: { module: moduleName },
      extra: context,
    });
  },
  info: (message: string, context: Record<string, unknown> = {}) => {
    console.info(`[${moduleName}] ${message}`, context);
  },
  warn: (message: string, context: Record<string, unknown> = {}) => {
    console.warn(`[${moduleName}] ${message}`, context);
  },
});
```

#### Usage in API Functions

```typescript
import { makeLogger } from "lib/logger";
import { djangoBackend } from "lib/apiServices";
import { ContentAPI } from "lib/APIs";

const logger = makeLogger("ContentAPI");

export const fetchTemplate = async (templateId: string) => {
  try {
    const response = await djangoBackend.get(ContentAPI.templateURL(templateId));
    return response.data;
  } catch (error) {
    logger.error("Failed to fetch template", { templateId }, error as Error);
    throw error; // Re-throw for React Query to handle
  }
};
```

**Why good:** Module name provides context for debugging, structured logging enables filtering in Sentry, Sentry integration catches errors in production, consistent pattern across codebase

```typescript
// BAD Example - No error context
catch (error) {
  console.error(error); // What operation failed? What ID?
}

// BAD Example - Swallowing errors
catch (error) {
  return null; // Caller doesn't know something went wrong!
}
```

**Why bad:** Generic logs make debugging impossible in production, swallowed errors hide failures and cause silent bugs

---

### Pattern 8: User Notifications for Mutations

Show user feedback via NotificationsStore for mutation success/failure.

#### Implementation

```typescript
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { stores } from "stores";

export const useDeleteTemplate = () => {
  const { notificationsStore } = stores;
  const { t } = useTranslation();

  return useMutation({
    mutationFn: deleteTemplateApi,
    onSuccess: () => {
      notificationsStore.addNotification({
        type: "success",
        label: t("template.delete.success"),
      });
    },
    onError: () => {
      notificationsStore.addNotification({
        type: "danger",
        label: t("template.delete.error"),
      });
    },
  });
};
```

**Why good:** Users get immediate feedback on actions, translated messages support i18n, consistent notification pattern across app

```typescript
// BAD Example - No user feedback
useMutation({
  mutationFn: deleteTemplateApi,
  // User wonders: did it work?
});

// BAD Example - Alert instead of notification
onSuccess: () => {
  alert("Template deleted!"); // Blocks UI, not translatable
};
```

**Why bad:** Silent mutations confuse users, alerts block the UI and aren't translated

</patterns>

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

</red_flags>

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
