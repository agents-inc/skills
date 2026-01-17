# Performance Examples - Resource Cleanup

> WebGL and MobxQuery resource cleanup patterns to prevent memory leaks. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for decision frameworks.

**Related patterns**: See other files in this folder:
- [core.md](core.md) - Essential MobX computed and observer patterns
- [routing.md](routing.md) - Lazy route loading for code-splitting
- [optimization.md](optimization.md) - Virtualization, shallow observables, avoiding premature optimization

---

## Pattern 4: WebGL Resource Cleanup

### Good: WebGL cleanup in useEffect

```typescript
import { useEffect, useRef } from "react";

import { Stage } from "lib/editor/rendering/Stage";

export const EditorCanvas = observer(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stage = new Stage({ canvas });

    // Setup stage...

    return () => {
      stage.destroy(); // Free WebGL resources
    };
  }, []);

  return <canvas ref={canvasRef} />;
});

EditorCanvas.displayName = "EditorCanvas";
```

**Why good:** `stage.destroy()` frees WebGL resources on unmount, prevents GPU memory leaks, cleanup function runs when component unmounts or deps change

### Bad: Missing WebGL cleanup

```typescript
import { useEffect, useRef } from "react";

import { Stage } from "lib/editor/rendering/Stage";

export const EditorCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const stage = new Stage({ canvas });
    // Missing cleanup - memory leak!
  }, []);

  return <canvas ref={canvasRef} />;
};
```

**Why bad:** WebGL context never freed, GPU memory accumulates on each mount/unmount cycle, eventually causes browser to crash or become unresponsive

**When to use:** Any component that creates Stage or other WebGL resources.

---

## Pattern 5: MobxQuery Disposal

### Good: MobxQuery with disposal

```typescript
import { makeAutoObservable, runInAction } from "mobx";

import { MobxQuery } from "./utils/mobx-query";
import { teamsQueryIdentifier } from "lib/query-keys";

export class TeamsStore {
  #dependencies: TeamsStoreDependencies;

  allTeams: Team[] = [];
  teamsAreLoading = false;

  // MobxQuery instance
  #teamsQuery: MobxQuery;

  constructor(dependencies: TeamsStoreDependencies) {
    this.#dependencies = dependencies;
    makeAutoObservable(this);

    this.#teamsQuery = new MobxQuery(
      {
        queryKey: [teamsQueryIdentifier],
        queryFn: this.#dependencies.fetchTeams,
      },
      ({ isLoading, data }) => {
        runInAction(() => {
          this.teamsAreLoading = isLoading;
          if (data) {
            this.allTeams = data;
          }
        });
      }
    );
  }

  startQuery = () => {
    this.#teamsQuery.query();
  };

  // MUST call dispose when store is disposed
  dispose = () => {
    this.#teamsQuery.dispose();
  };
}
```

**Why good:** `dispose()` method cleans up React Query subscription, prevents memory leaks and stale callbacks, callback uses `runInAction` for MobX state mutations

### Bad: MobxQuery without disposal

```typescript
export class TeamsStore {
  #teamsQuery = new MobxQuery({
    queryKey: [teamsQueryIdentifier],
    queryFn: fetchTeams,
  });

  // Missing dispose method - subscription leaks!
}
```

**Why bad:** Query subscription never cleaned up, callbacks continue firing after store should be disposed, memory leak and potential errors from stale references

**When to use:** Every store that creates MobxQuery instances.
