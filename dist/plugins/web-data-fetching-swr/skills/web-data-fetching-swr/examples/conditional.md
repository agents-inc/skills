# SWR - Conditional Fetching Examples

> Dependent queries and enabled patterns. See [core.md](core.md) for basic patterns.

---

## Null Key Pattern

### Basic Conditional Fetch

```typescript
// components/conditional-user.tsx
import useSWR from "swr";

interface User {
  id: string;
  name: string;
  email: string;
}

function UserProfile({ userId }: { userId: string | null }) {
  // Won't fetch when userId is null
  const { data, isLoading, error } = useSWR<User>(
    userId ? `/api/users/${userId}` : null,
    fetcher
  );

  if (!userId) {
    return <p>Please select a user</p>;
  }

  if (isLoading) {
    return <Skeleton />;
  }

  if (error) {
    return <Error message={error.message} />;
  }

  return (
    <div>
      <h1>{data?.name}</h1>
      <p>{data?.email}</p>
    </div>
  );
}

export { UserProfile };
```

**Why good:** Null key is idiomatic SWR pattern, hook is always called (no conditional hook violation), clean loading/error states

---

## Dependent Queries

### Sequential Data Loading

```typescript
// components/user-with-posts.tsx
import useSWR from "swr";

interface User {
  id: string;
  name: string;
}

interface Post {
  id: string;
  title: string;
  userId: string;
}

function UserWithPosts({ userId }: { userId: string }) {
  // First query
  const { data: user, isLoading: isLoadingUser } = useSWR<User>(
    `/api/users/${userId}`,
    fetcher
  );

  // Dependent query - only runs when user is loaded
  const { data: posts, isLoading: isLoadingPosts } = useSWR<Post[]>(
    user ? `/api/users/${user.id}/posts` : null,
    fetcher
  );

  if (isLoadingUser) {
    return <UserSkeleton />;
  }

  return (
    <div>
      <h1>{user?.name}</h1>

      <section>
        <h2>Posts</h2>
        {isLoadingPosts ? (
          <PostsSkeleton />
        ) : (
          <ul>
            {posts?.map((post) => (
              <li key={post.id}>{post.title}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export { UserWithPosts };
```

### Chained Dependencies

```typescript
// components/organization-team-members.tsx
import useSWR from "swr";

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
  // Step 1: Get organization
  const { data: org } = useSWR<Organization>(
    `/api/orgs/${orgSlug}`,
    fetcher
  );

  // Step 2: Get default team (depends on org)
  const { data: team } = useSWR<Team>(
    org ? `/api/teams/${org.defaultTeamId}` : null,
    fetcher
  );

  // Step 3: Get team members (depends on team)
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
      <ul>
        {members?.map((member) => (
          <li key={member.id}>
            {member.name} - {member.role}
          </li>
        ))}
      </ul>
    </div>
  );
}

export { OrganizationTeamMembers };
```

**Why good:** Each query waits for dependencies, null key prevents premature requests, progressive loading improves perceived performance

---

## Conditional Based on State

### Search with Minimum Length

```typescript
// components/search-results.tsx
import useSWR from "swr";
import { useState, useDeferredValue } from "react";

interface SearchResult {
  id: string;
  title: string;
  description: string;
}

const MIN_SEARCH_LENGTH = 3;
const DEBOUNCE_MS = 300;

function SearchResults() {
  const [searchTerm, setSearchTerm] = useState("");
  // Use deferred value for smoother typing
  const deferredSearch = useDeferredValue(searchTerm);

  const { data, isLoading, error } = useSWR<SearchResult[]>(
    deferredSearch.length >= MIN_SEARCH_LENGTH
      ? `/api/search?q=${encodeURIComponent(deferredSearch)}`
      : null,
    fetcher,
    {
      // Don't keep previous search results
      keepPreviousData: false,
    }
  );

  return (
    <div>
      <input
        type="search"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder={`Search (min ${MIN_SEARCH_LENGTH} characters)...`}
      />

      {searchTerm.length > 0 && searchTerm.length < MIN_SEARCH_LENGTH && (
        <p className="hint">Enter at least {MIN_SEARCH_LENGTH} characters</p>
      )}

      {isLoading && <Spinner />}

      {error && <Error message={error.message} />}

      {data && data.length === 0 && (
        <p>No results found for "{deferredSearch}"</p>
      )}

      {data && data.length > 0 && (
        <ul>
          {data.map((result) => (
            <li key={result.id}>
              <h3>{result.title}</h3>
              <p>{result.description}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { SearchResults };
```

### Toggle-Based Fetch

```typescript
// components/optional-details.tsx
import useSWR from "swr";
import { useState } from "react";

interface ProductDetails {
  specifications: Record<string, string>;
  reviews: Array<{ id: string; rating: number; text: string }>;
}

function ProductWithDetails({ productId }: { productId: string }) {
  const [showDetails, setShowDetails] = useState(false);

  // Only fetch when details are requested
  const { data: details, isLoading } = useSWR<ProductDetails>(
    showDetails ? `/api/products/${productId}/details` : null,
    fetcher
  );

  return (
    <div>
      <button onClick={() => setShowDetails(!showDetails)}>
        {showDetails ? "Hide Details" : "Show Details"}
      </button>

      {showDetails && (
        <div className="details">
          {isLoading ? (
            <Spinner />
          ) : (
            <>
              <h3>Specifications</h3>
              <dl>
                {Object.entries(details?.specifications ?? {}).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>

              <h3>Reviews</h3>
              <ul>
                {details?.reviews.map((review) => (
                  <li key={review.id}>
                    {"⭐".repeat(review.rating)} {review.text}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export { ProductWithDetails };
```

**Why good:** Search waits for minimum input, useDeferredValue improves typing responsiveness, toggle prevents unnecessary initial request

---

## Authentication-Based Fetch

### Only Fetch When Authenticated

```typescript
// components/protected-data.tsx
import useSWR from "swr";
import { useAuth } from "../hooks/use-auth";

interface ProtectedData {
  sensitiveInfo: string;
}

function ProtectedDataView() {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();

  // Only fetch when authenticated
  const { data, isLoading, error } = useSWR<ProtectedData>(
    isAuthenticated ? "/api/protected-data" : null,
    fetcher
  );

  if (isAuthLoading) {
    return <AuthCheckingSkeleton />;
  }

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  if (isLoading) {
    return <DataSkeleton />;
  }

  if (error) {
    if (error.status === 401) {
      return <SessionExpired />;
    }
    return <Error message={error.message} />;
  }

  return (
    <div>
      <h1>Protected Data</h1>
      <p>{data?.sensitiveInfo}</p>
    </div>
  );
}

export { ProtectedDataView };
```

### Fetch with User ID from Auth

```typescript
// components/my-profile.tsx
import useSWR from "swr";
import { useAuth } from "../hooks/use-auth";

interface UserProfile {
  name: string;
  email: string;
  avatar: string;
}

function MyProfile() {
  const { user } = useAuth();

  // Fetch user's own profile when logged in
  const { data: profile, isLoading } = useSWR<UserProfile>(
    user?.id ? `/api/users/${user.id}/profile` : null,
    fetcher
  );

  if (!user) {
    return <p>Please log in to view your profile</p>;
  }

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="profile">
      <img src={profile?.avatar} alt={profile?.name} />
      <h1>{profile?.name}</h1>
      <p>{profile?.email}</p>
    </div>
  );
}

export { MyProfile };
```

**Why good:** Auth check prevents unauthorized requests, auth context provides user info, clean handling of unauthenticated state

---

## Feature Flag Based Fetch

### Conditional Feature Data

```typescript
// components/feature-gated-data.tsx
import useSWR from "swr";
import { useFeatureFlag } from "../hooks/use-feature-flags";

interface BetaFeatureData {
  newDashboard: unknown;
}

function FeatureGatedComponent() {
  const isBetaEnabled = useFeatureFlag("beta-dashboard");

  // Only fetch beta data when feature is enabled
  const { data: betaData } = useSWR<BetaFeatureData>(
    isBetaEnabled ? "/api/beta/dashboard" : null,
    fetcher
  );

  if (!isBetaEnabled) {
    return <LegacyDashboard />;
  }

  return <BetaDashboard data={betaData} />;
}

export { FeatureGatedComponent };
```

**Why good:** Feature flags control data loading, no unnecessary requests for disabled features, clean fallback to legacy

---

## Multiple Conditions

### Complex Conditional Logic

```typescript
// components/complex-conditional.tsx
import useSWR from "swr";

interface DashboardData {
  metrics: unknown;
}

interface Props {
  userId: string | null;
  isAdmin: boolean;
  selectedOrg: string | null;
}

function ComplexConditionalData({ userId, isAdmin, selectedOrg }: Props) {
  // Build key based on multiple conditions
  const shouldFetch = userId && selectedOrg;

  const endpoint = shouldFetch
    ? isAdmin
      ? `/api/admin/orgs/${selectedOrg}/dashboard`
      : `/api/users/${userId}/orgs/${selectedOrg}/dashboard`
    : null;

  const { data, isLoading, error } = useSWR<DashboardData>(endpoint, fetcher);

  if (!userId) {
    return <p>Please log in</p>;
  }

  if (!selectedOrg) {
    return <p>Please select an organization</p>;
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <Error message={error.message} />;
  }

  return <Dashboard data={data} isAdmin={isAdmin} />;
}

export { ComplexConditionalData };
```

### Using Function Key

```typescript
// components/function-key-conditional.tsx
import useSWR from "swr";

function FunctionKeyConditional({ userId, filter }: { userId: string | null; filter: string }) {
  // Function that returns key or null
  const { data } = useSWR(
    () => {
      // Skip if no user
      if (!userId) return null;

      // Skip if filter is invalid
      if (filter.length < 2) return null;

      // Return the key
      return `/api/users/${userId}/items?filter=${filter}`;
    },
    fetcher
  );

  return <ItemList items={data} />;
}

export { FunctionKeyConditional };
```

**Why good:** Function key enables complex conditional logic, multiple conditions checked cleanly, admin/user paths handled transparently

---

## Anti-Pattern Examples

```typescript
// BAD: Conditional hook call (breaks Rules of Hooks)
function BadConditional({ userId }) {
  if (!userId) return <p>No user</p>;

  // This hook is called conditionally!
  const { data } = useSWR(`/api/users/${userId}`, fetcher);
  return <div>{data?.name}</div>;
}

// BAD: Using undefined instead of null (fetches "/api/users/undefined")
function BadUndefined({ userId }) {
  const { data } = useSWR(`/api/users/${userId}`, fetcher);
  // If userId is undefined, fetches "/api/users/undefined"!
  return <div>{data?.name}</div>;
}

// BAD: Checking data before null key (still fetches)
function BadCheck({ userId }) {
  const { data } = useSWR(
    userId ? `/api/users/${userId}` : null,
    fetcher
  );

  // This check is redundant - null key already handles this
  if (!userId) return <p>No user</p>;

  return <div>{data?.name}</div>;
}
```

```typescript
// GOOD: Hook always called, key is conditional
function GoodConditional({ userId }) {
  const { data, isLoading } = useSWR(
    userId ? `/api/users/${userId}` : null,
    fetcher
  );

  if (!userId) return <p>No user</p>;
  if (isLoading) return <Skeleton />;
  return <div>{data?.name}</div>;
}

// GOOD: Explicit null check
function GoodNullCheck({ userId }) {
  const { data } = useSWR(
    userId != null ? `/api/users/${userId}` : null,
    fetcher
  );
  return <div>{data?.name}</div>;
}

// GOOD: Handle all states properly
function GoodAllStates({ userId }) {
  const { data, isLoading, error } = useSWR(
    userId ? `/api/users/${userId}` : null,
    fetcher
  );

  if (!userId) return <SelectUser />;
  if (isLoading) return <Skeleton />;
  if (error) return <Error message={error.message} />;
  if (!data) return <NotFound />;

  return <UserProfile user={data} />;
}
```

**Why bad examples fail:** Conditional hooks violate React rules, undefined in template literal creates wrong URL, redundant checks add complexity
