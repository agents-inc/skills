# API & Data Fetching - Zod Validation

> Schema validation for API responses with safeParse. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand axios instance from [core.md](core.md) first.

**Related Examples:**
- [mutations.md](mutations.md) - useMutation hooks with notifications
- [mobx-bridge.md](mobx-bridge.md) - MobxQuery for store integration
- [error-handling.md](error-handling.md) - Logger error tracking

---

## Pattern 5: Zod Schema Validation

Validate ALL API responses with Zod schemas using safeParse to catch contract changes.

### Schema Definition

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

### Fetch Function with Validation

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
