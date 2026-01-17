# API & Data Fetching - Mutations

> useMutation hooks with notifications and cache invalidation. See [SKILL.md](../SKILL.md) for core concepts.

**Prerequisites**: Understand Patterns 1-3 from [core.md](core.md) first (URL construction, axios instance, React Query config).

**Related Examples:**
- [validation.md](validation.md) - Zod schema validation
- [mobx-bridge.md](mobx-bridge.md) - MobxQuery for store integration
- [error-handling.md](error-handling.md) - Logger error tracking

---

## Pattern 4: useMutation in Custom Hooks

Wrap useMutation in custom hooks that handle notifications and state coordination.

### Implementation

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

### Usage in Component

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

## Pattern 8: User Notifications for Mutations

Show user feedback via NotificationsStore for mutation success/failure.

### Implementation

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

---
