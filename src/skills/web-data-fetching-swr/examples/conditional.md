# SWR — Conditional Fetching Examples

> The null key, and what it makes possible. See [core.md](core.md) for key shapes.

---

## The null key

The hook is always called; the key decides whether a request happens. This is what replaces the
conditional hook call that the rules of hooks forbid.

```typescript
// components/user-profile.tsx
import useSWR from "swr";
import { fetcher } from "../lib/fetcher";

interface User {
  id: string;
  name: string;
  email: string;
}

function UserProfile({ userId }: { userId: string | null }) {
  const { data, isLoading, error } = useSWR<User>(
    userId ? `/api/users/${userId}` : null,
    fetcher
  );

  if (!userId) return <p>Please select a user</p>;
  if (isLoading) return <Skeleton />;
  if (error) return <Error message={error.message} />;

  return (
    <div>
      <h1>{data?.name}</h1>
      <p>{data?.email}</p>
    </div>
  );
}
```

The `!userId` branch is not redundant with the null key: the key stops the request, and the branch
decides what the user sees instead. With a null key `isLoading` is `false`, so without that branch
the component falls through to rendering `undefined`.

Use `null` rather than letting `undefined` reach the template — `` `/api/users/${undefined}` `` is a
valid string, and SWR will happily fetch `/api/users/undefined`.

---

## Dependent queries

Each key is built from the previous query's data, so a query with a `null` key waits until the one
above it resolves. No orchestration, no effects.

```typescript
// components/organization-team-members.tsx
interface Organization {
  id: string;
  name: string;
  defaultTeamId: string;
}

interface Team {
  id: string;
  name: string;
}

interface Member {
  id: string;
  name: string;
  role: string;
}

function OrganizationTeamMembers({ orgSlug }: { orgSlug: string }) {
  const { data: org } = useSWR<Organization>(`/api/orgs/${orgSlug}`, fetcher);

  const { data: team } = useSWR<Team>(
    org ? `/api/teams/${org.defaultTeamId}` : null,
    fetcher
  );

  const { data: members, isLoading } = useSWR<Member[]>(
    team ? `/api/teams/${team.id}/members` : null,
    fetcher
  );

  if (!org) return <OrgSkeleton />;
  if (!team) return <TeamSkeleton />;
  if (isLoading) return <MembersSkeleton />;

  return (
    <div>
      <h1>{org.name}</h1>
      <h2>{team.name}</h2>
      <MemberList members={members} />
    </div>
  );
}
```

Each level renders its own skeleton as it resolves, so the page fills in rather than appearing at
once — which is the trade a chain makes: three round trips in sequence, in exchange for no endpoint
that has to join them.

---

## Gating on something other than data

The condition is ordinary JavaScript, so the same pattern covers a minimum input length, an auth
check, a feature flag, or a panel the user has not opened.

```typescript
interface SearchResult {
  id: string;
  title: string;
  description: string;
}

const MIN_SEARCH_LENGTH = 3;

// Search: wait for enough input, and never keep the previous query's results
const deferredSearch = useDeferredValue(searchTerm);
const { data } = useSWR<SearchResult[]>(
  deferredSearch.length >= MIN_SEARCH_LENGTH
    ? `/api/search?q=${encodeURIComponent(deferredSearch)}`
    : null,
  fetcher,
  { keepPreviousData: false },
);

// Auth: no request until there is a session to make it with
const { isAuthenticated } = useAuth();
const { data: protectedData } = useSWR(
  isAuthenticated ? "/api/protected-data" : null,
  fetcher,
);

// Disclosure: nothing fetched until the panel is opened, and cached once it has been
const [showDetails, setShowDetails] = useState(false);
const { data: details } = useSWR(
  showDetails ? `/api/products/${productId}/details` : null,
  fetcher,
);
```

`useDeferredValue` keeps the input responsive while a slow render is in flight; it does not debounce
the request, so a search hitting an expensive endpoint still wants its own debounce.

---

## A function key for several conditions

Where the key depends on more than one thing, or on which of several endpoints applies, a function
keeps that logic out of the JSX.

```typescript
function FunctionKeyConditional({ userId, filter }: { userId: string | null; filter: string }) {
  const { data } = useSWR(() => {
    if (!userId) return null;
    if (filter.length < 2) return null;
    return `/api/users/${userId}/items?filter=${filter}`;
  }, fetcher);

  return <ItemList items={data} />;
}
```

The same shape chooses between endpoints:

```typescript
const { data } = useSWR(() => {
  if (!userId || !selectedOrg) return null;
  return isAdmin
    ? `/api/admin/orgs/${selectedOrg}/dashboard`
    : `/api/users/${userId}/orgs/${selectedOrg}/dashboard`;
}, fetcher);
```

Because the key differs per branch, an admin's view and a member's view are separate cache entries —
switching roles cannot show one under the other.
