# React + MobX - Custom Hooks Examples

> Patterns for custom hooks that integrate with MobX stores. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Related Examples:**
- [core.md](core.md) - Basic component structure, observer wrapper
- [mobx-reactivity.md](mobx-reactivity.md) - Avoiding useEffect/useMemo with MobX
- [i18n.md](i18n.md) - useTranslation patterns
- [patterns.md](patterns.md) - Promise-based modal pattern

---

## Pattern 5: Custom Hooks with Stores

### Good Example - Custom hook accessing stores

```typescript
import { useRef, useState, useCallback } from "react";

import { useTranslation } from "react-i18next";

import { stores } from "stores";

import { createTeamApi } from "lib/APIs";

export const useCreateTeam = () => {
  const { notificationsStore, teamsStore, authStore } = stores;
  const { t } = useTranslation();

  const originRef = useRef<CreateTeamOrigin | null>(null);
  const [teamNameSuggestion, setTeamNameSuggestion] = useState<string>();
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const createTeam = useCallback(async (name: string) => {
    setIsLoading(true);
    try {
      const result = await createTeamApi(name);
      setTeam(result);
      return result;
    } catch {
      notificationsStore.addNotification({
        type: "danger",
        label: t("team.create.error"),
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [notificationsStore, t]);

  return {
    team,
    createTeam,
    isLoading,
    teamNameSuggestion,
    origin: originRef.current,
  };
};
```

**Why good:** stores accessed via singleton maintains MobX reactivity, notifications integrated for user feedback, translation for error messages

### Bad Example - Passing stores as parameters

```typescript
export const useCreateTeam = (notificationsStore, teamsStore) => {
  // ...
};

// In component:
const createTeam = useCreateTeam(stores.notificationsStore, stores.teamsStore);
```

**Why bad:** passing stores as parameters breaks MobX reactive chain, creates unnecessary coupling, harder to test, violates stores singleton pattern
