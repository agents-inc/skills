# React Query — Infinite Query Examples

> `useInfiniteQuery` for cursor-paged lists. See [core.md](core.md) for setup and query options.

**Prerequisites**: [Pattern 3: Consuming and overriding query options](core.md#pattern-3-consuming-and-overriding-query-options).

---

## Pattern 11: Cursor paging with "load more"

```typescript
// projects/projects-options.ts
import { infiniteQueryOptions } from "@tanstack/react-query";

export type Project = { id: number; name: string };
export type ProjectsPage = {
  projects: Project[];
  previousCursor: number | null;
  nextCursor: number | null;
};

export async function fetchProjectsPage(
  cursor: number,
  search: string,
  signal: AbortSignal,
): Promise<ProjectsPage> {
  const params = new URLSearchParams({ cursor: String(cursor), search });
  const response = await fetch(`/api/projects?${params}`, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export const projectsOptions = (search: string) =>
  infiniteQueryOptions({
    // Every page lives in this one entry; the cursor is the page param, not part of the key
    queryKey: ["projects", { search }],
    queryFn: ({ pageParam, signal }) =>
      fetchProjectsPage(pageParam, search, signal),
    initialPageParam: 0,
    // null or undefined means there is no next page, and hasNextPage turns false
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
```

```typescript
// projects/project-list.tsx
import { useInfiniteQuery } from "@tanstack/react-query";
import { projectsOptions } from "./projects-options";

export function ProjectList({ search }: { search: string }) {
  const { data, error, status, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
    useInfiniteQuery(projectsOptions(search));

  if (status === "pending") return <p>Loading...</p>;
  if (status === "error") return <p role="alert">{error.message}</p>;

  return (
    <>
      <ul>
        {data.pages
          .flatMap((page) => page.projects)
          .map((project) => (
            <li key={project.id}>{project.name}</li>
          ))}
      </ul>
      {isFetching && !isFetchingNextPage && <p>Refreshing...</p>}
      <button onClick={() => fetchNextPage()} disabled={!hasNextPage || isFetchingNextPage}>
        {isFetchingNextPage ? "Loading more..." : hasNextPage ? "Load more" : "Nothing more to load"}
      </button>
    </>
  );
}
```

- `data.pages` holds every page fetched so far and `data.pageParams` the cursor each was fetched
  with, aligned by index.
- `isFetchingNextPage` is the "load more" request; `isFetching` is any request, a background
  refetch included.
- A stale infinite query refetches every page it holds, one after another from the first, so a
  long list makes a long refetch.

### Capping the pages kept

`maxPages` caps the pages the entry holds — a next page past the cap drops the first, a previous page
drops the last — which bounds both memory and that refetch. The same factory, capped:

```typescript
// projects/projects-options.ts
const MAX_PAGES_KEPT = 3;

export const projectsOptions = (search: string) =>
  infiniteQueryOptions({
    queryKey: ["projects", { search }],
    queryFn: ({ pageParam, signal }) =>
      fetchProjectsPage(pageParam, search, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    // Fetches a dropped page again on the way back up; drives hasPreviousPage and fetchPreviousPage
    getPreviousPageParam: (firstPage) => firstPage.previousCursor,
    maxPages: MAX_PAGES_KEPT,
  });
```

### Bad example

An infinite query runs one fetch at a time, and by default `fetchNextPage` cancels a refetch that
is already running.

```typescript
// BAD: an end-of-list callback fires mid-refetch too, cancelling the refresh of the pages on screen
const onEndReached = () => fetchNextPage();

// Where code rather than a click starts the fetch, wait for the running one
const onEndReachedGuarded = () => hasNextPage && !isFetching && fetchNextPage();
```

---

_Related: [core.md](core.md)_
