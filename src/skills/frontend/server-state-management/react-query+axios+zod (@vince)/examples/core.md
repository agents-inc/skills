# API & Data Fetching - Core Examples

> Essential patterns for API setup and configuration. See [SKILL.md](../SKILL.md) for core concepts.

**Extended Examples:**
- [mutations.md](mutations.md) - useMutation Hooks, Cache Invalidation, User Notifications
- [validation.md](validation.md) - Zod Schema Validation with safeParse
- [mobx-bridge.md](mobx-bridge.md) - MobxQuery Bridge for Store Integration
- [error-handling.md](error-handling.md) - Logger Error Tracking with Sentry

---

## Pattern 1: Static API Class for URL Construction

Use static class methods to construct URLs with type-safe query parameters. URLs are built from `appEnv.photoroom.backendURL` base.

### Implementation

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

## Pattern 2: Axios Instance with Interceptors

Use the configured `djangoBackend` axios instance with auth and header interceptors. Never create custom axios instances.

### Configuration

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

### Usage

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

## Pattern 3: React Query Configuration

React Query is configured with conservative defaults - no automatic refetching.

### QueryClient Setup

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

### Query Key Constants

```typescript
// src/constants/queryKeys.ts
export const teamsQueryIdentifier = "teams";
export const courierTokenQueryIdentifier = "courierToken";
export const templateCategoriesIdentifier = "templateCategories";
export const entitlementsQueryIdentifier = "entitlements";
export const subscriptionQueryIdentifier = "subscription";
export const apiInfoQueryIdentifier = "apiInfo";
```

### Usage with useQuery

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
