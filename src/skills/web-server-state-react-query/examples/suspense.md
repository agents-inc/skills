# React Query — Suspense Examples

> `useSuspenseQuery` and `useSuspenseQueries`. See [core.md](core.md) for setup and query options.

**Prerequisites**: [Pattern 8: Resetting after a thrown error](error-handling.md#pattern-8-resetting-after-a-thrown-error) — the error boundary these render inside.

---

## Pattern 12: Suspense queries

`data` is typed as defined: the nearest `<Suspense>` renders while the first load runs, and the
nearest error boundary renders if it fails.

```typescript
// projects/project-queries.ts
import { queryOptions } from "@tanstack/react-query";

export type Project = { id: string; name: string; ownerId: string };
export type Person = { id: string; name: string };

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export const projectOptions = (id: string) =>
  queryOptions({
    queryKey: ["projects", id],
    queryFn: ({ signal }) => getJson<Project>(`/api/projects/${id}`, signal),
  });

export const membersOptions = (projectId: string) =>
  queryOptions({
    queryKey: ["projects", projectId, "members"],
    queryFn: ({ signal }) =>
      getJson<Person[]>(`/api/projects/${projectId}/members`, signal),
  });

export const personOptions = (id: string) =>
  queryOptions({
    queryKey: ["people", id],
    queryFn: ({ signal }) => getJson<Person>(`/api/people/${id}`, signal),
  });
```

```typescript
// projects/project-page.tsx
import { Suspense, startTransition, useState } from "react";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import { QueryErrorBoundaryWrapper } from "../query-error-boundary"; // error-handling.md, Pattern 8
import { membersOptions, personOptions, projectOptions } from "./project-queries";

function ProjectOverview({ id }: { id: string }) {
  // Two useSuspenseQuery calls would fetch one after the other: the first suspends before the
  // second is reached. useSuspenseQueries starts both together.
  const [{ data: project }, { data: members }] = useSuspenseQueries({
    queries: [projectOptions(id), membersOptions(id)],
  });

  return (
    <section>
      <h1>{project.name}</h1>
      <ul>
        {members.map((member) => (
          <li key={member.id}>{member.name}</li>
        ))}
      </ul>
      <Suspense fallback={<p>Loading owner...</p>}>
        <ProjectOwner projectId={id} />
      </Suspense>
    </section>
  );
}

// That same ordering is what a dependent query wants: the second reads the first's data
// directly, with no `enabled` to set
function ProjectOwner({ projectId }: { projectId: string }) {
  const { data: project } = useSuspenseQuery(projectOptions(projectId));
  const { data: owner } = useSuspenseQuery(personOptions(project.ownerId));
  return <p>Owner: {owner.name}</p>;
}

export function ProjectPage({ projectIds, initialId }: { projectIds: string[]; initialId: string }) {
  const [projectId, setProjectId] = useState(initialId);

  return (
    <QueryErrorBoundaryWrapper>
      <nav>
        {projectIds.map((id) => (
          // In a transition the current project stays on screen while the next one loads,
          // rather than the fallback replacing it
          <button key={id} onClick={() => startTransition(() => setProjectId(id))}>
            {id}
          </button>
        ))}
      </nav>
      <Suspense fallback={<p>Loading project...</p>}>
        <ProjectOverview id={projectId} />
      </Suspense>
    </QueryErrorBoundaryWrapper>
  );
}
```

- An error reaches the boundary only when there is no data to show. A failed background refetch
  keeps the cached data on screen and sets `error` on the result.
- Under suspense, a `staleTime` or numeric `gcTime` below one second is raised to one second.
- `useSuspenseInfiniteQuery` is the infinite counterpart: `useInfiniteQuery`'s options, less the
  ones refused below.

### Bad example

```typescript
// BAD: enabled is not an option on a suspense query — a type error. Render the component only
// once the id exists instead.
const { data } = useSuspenseQuery({
  ...projectOptions(id),
  enabled: Boolean(id),
});
```

`placeholderData` and `throwOnError` are refused the same way.

---

_Related: [error-handling.md](error-handling.md), [core.md](core.md)_
