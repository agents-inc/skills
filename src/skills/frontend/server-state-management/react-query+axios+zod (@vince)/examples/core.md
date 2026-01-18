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

> **Axios v1.x Note:** Request interceptors must use `InternalAxiosRequestConfig` type (not `AxiosRequestConfig`). This is a TypeScript change in Axios v1.x where the internal config has required `headers` property.

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

## Pattern 4: Request Cancellation with AbortController

Use AbortController to cancel in-flight requests when components unmount or when user navigates away. This replaces the deprecated CancelToken API (deprecated since Axios v0.22.0).

### Basic Cancellation

```typescript
import { useEffect, useState } from "react";
import { djangoBackend } from "lib/apiServices";
import { ContentAPI } from "lib/APIs";

export const useTemplate = (templateId: string) => {
  const [template, setTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const fetchTemplate = async () => {
      try {
        setIsLoading(true);
        const response = await djangoBackend.get(
          ContentAPI.templateURL(templateId),
          { signal: controller.signal }
        );
        setTemplate(response.data);
      } catch (error) {
        // Check if request was cancelled - don't treat as error
        if (axios.isCancel(error)) {
          return; // Component unmounted, ignore
        }
        throw error;
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplate();

    // Cleanup: abort request on unmount or templateId change
    return () => {
      controller.abort();
    };
  }, [templateId]);

  return { template, isLoading };
};
```

**Why good:** Prevents state updates on unmounted components, avoids memory leaks, uses modern AbortController API (native browser support), cleanup runs automatically on dependency change or unmount

### With Timeout Using AbortSignal.timeout()

```typescript
// For Node.js 17.3+ and modern browsers
const fetchWithTimeout = async (templateId: string) => {
  const TIMEOUT_MS = 10000;

  const response = await djangoBackend.get(
    ContentAPI.templateURL(templateId),
    { signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  return response.data;
};
```

**Why good:** Native timeout API is simpler than manual AbortController + setTimeout, automatically aborts after timeout

### React Query Integration

React Query v5 automatically handles cancellation via AbortController when using the signal from queryFn context:

```typescript
import { useQuery } from "@tanstack/react-query";
import { djangoBackend } from "lib/apiServices";
import { ContentAPI } from "lib/APIs";

export const useTemplate = (templateId: string) => {
  return useQuery({
    queryKey: ["template", templateId],
    queryFn: async ({ signal }) => {
      // React Query passes AbortSignal automatically
      const response = await djangoBackend.get(
        ContentAPI.templateURL(templateId),
        { signal }
      );
      return response.data;
    },
  });
};
```

**Why good:** React Query handles cancellation automatically, no manual cleanup needed, query is cancelled when component unmounts or queryKey changes

```typescript
// BAD Example - Using deprecated CancelToken
import axios from "axios";

const source = axios.CancelToken.source();
const response = await djangoBackend.get(url, {
  cancelToken: source.token, // DEPRECATED since v0.22.0
});
source.cancel("Operation cancelled");

// BAD Example - Ignoring cancellation in useEffect
useEffect(() => {
  const fetchData = async () => {
    const response = await djangoBackend.get(url);
    setData(response.data); // May update unmounted component!
  };
  fetchData();
  // Missing cleanup - request continues even after unmount
}, []);
```

**Why bad:** CancelToken is deprecated and will be removed in future Axios versions, missing cleanup causes "Can't perform state update on unmounted component" warnings and memory leaks

---
