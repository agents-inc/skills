# URQL GraphQL Client - Core Examples

> All core code examples for URQL patterns. See [SKILL.md](../SKILL.md) for concepts.

**Extended examples:**

- [exchanges.md](exchanges.md) - Exchange architecture, custom exchanges, auth
- [subscriptions.md](subscriptions.md) - Real-time data with WebSockets

---

## Pattern 1: Complete Client Setup

### Basic Client

```typescript
// lib/urql-client.ts
import { Client, cacheExchange, fetchExchange } from "urql";

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_URL || "";

const client = new Client({
  url: GRAPHQL_ENDPOINT,
  exchanges: [cacheExchange, fetchExchange],
  // Default request policy for all queries
  requestPolicy: "cache-first",
});

export { client };
```

### Provider Setup

```typescript
// providers/urql-provider.tsx
"use client";

import { Provider } from "urql";
import { client } from "@/lib/urql-client";
import type { ReactNode } from "react";

interface UrqlProviderProps {
  children: ReactNode;
}

function UrqlProvider({ children }: UrqlProviderProps) {
  return <Provider value={client}>{children}</Provider>;
}

export { UrqlProvider };
```

**Why good:** Clean separation of client creation and provider, typed props, named exports

---

## Pattern 2: useQuery Basics

### Query with Variables and Loading States

```typescript
// components/user-profile.tsx
import { useQuery, gql } from "urql";

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
      avatar
    }
  }
`;

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface GetUserData {
  user: User | null;
}

interface GetUserVariables {
  id: string;
}

function UserProfile({ userId }: { userId: string }) {
  const [result, reexecuteQuery] = useQuery<GetUserData, GetUserVariables>({
    query: GET_USER,
    variables: { id: userId },
    pause: !userId,
    requestPolicy: "cache-and-network",
  });

  const { data, fetching, error, stale } = result;

  if (fetching && !data) return <UserProfileSkeleton />;
  if (error && !data) return <ErrorCard message={error.message} onRetry={() => reexecuteQuery({ requestPolicy: "network-only" })} />;
  if (!data?.user) return <NotFound message="User not found" />;

  return (
    <article>
      {stale && <span className="updating-badge">Refreshing...</span>}
      <img src={data.user.avatar || "/default-avatar.png"} alt={data.user.name} />
      <h1>{data.user.name}</h1>
      <p>{data.user.email}</p>
    </article>
  );
}

export { UserProfile, GET_USER };
```

### Conditional Query with Pause

```typescript
// components/user-details.tsx
import { useQuery, gql } from "urql";

const USER_DETAILS_QUERY = gql`
  query GetUserDetails($id: ID!) {
    user(id: $id) {
      id
      name
      email
      posts {
        id
        title
      }
    }
  }
`;

function UserDetails({ userId }: { userId: string | null }) {
  const [result] = useQuery({
    query: USER_DETAILS_QUERY,
    variables: { id: userId },
    // Query pauses when userId is falsy
    pause: !userId,
  });

  if (!userId) {
    return <div>Select a user to view details</div>;
  }

  const { data, fetching, error } = result;

  if (fetching) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;
  if (!data?.user) return <NotFound />;

  return (
    <div>
      <h2>{data.user.name}</h2>
      <ul>
        {data.user.posts.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
    </div>
  );
}

export { UserDetails };
```

**Why good:** pause prevents requests when userId is null, proper null state handling

---

## Pattern 3: Mutations with Cache Updates

### Create with Manual Cache Update

```typescript
// components/create-post-form.tsx
import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, gql } from "urql";

const CREATE_POST = gql`
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      id
      title
      content
      createdAt
    }
  }
`;

interface CreatePostInput {
  title: string;
  content: string;
}

interface CreatePostData {
  createPost: {
    id: string;
    title: string;
    content: string;
    createdAt: string;
  };
}

function CreatePostForm({ onSuccess }: { onSuccess?: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [result, executeMutation] = useMutation<CreatePostData>(CREATE_POST);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const input: CreatePostInput = { title: title.trim(), content: content.trim() };
    const response = await executeMutation({ input });

    if (response.error) {
      console.error("Failed to create post:", response.error);
      return;
    }

    // Reset form
    setTitle("");
    setContent("");
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit}>
      {result.error && <p className="error">{result.error.message}</p>}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Post title"
        disabled={result.fetching}
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Post content"
        disabled={result.fetching}
      />
      <button type="submit" disabled={result.fetching || !title.trim()}>
        {result.fetching ? "Creating..." : "Create Post"}
      </button>
    </form>
  );
}

export { CreatePostForm, CREATE_POST };
```

### Update Mutation

```typescript
// components/edit-post-form.tsx
import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, gql } from "urql";

const UPDATE_POST = gql`
  mutation UpdatePost($id: ID!, $input: UpdatePostInput!) {
    updatePost(id: $id, input: $input) {
      id
      title
      content
      updatedAt
    }
  }
`;

interface Post {
  id: string;
  title: string;
  content: string;
}

interface UpdatePostInput {
  title?: string;
  content?: string;
}

interface EditPostFormProps {
  post: Post;
  onSuccess?: () => void;
}

function EditPostForm({ post, onSuccess }: EditPostFormProps) {
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);

  const [result, executeMutation] = useMutation(UPDATE_POST);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const input: UpdatePostInput = { title, content };
    const response = await executeMutation({ id: post.id, input });

    if (response.error) {
      console.error("Failed to update post:", response.error);
      return;
    }

    onSuccess?.();
  };

  const hasChanges = title !== post.title || content !== post.content;

  return (
    <form onSubmit={handleSubmit}>
      {result.error && <p className="error">{result.error.message}</p>}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={result.fetching}
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={result.fetching}
      />
      <button type="submit" disabled={result.fetching || !hasChanges}>
        {result.fetching ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}

export { EditPostForm };
```

### Delete Mutation

```typescript
// components/delete-post-button.tsx
import { useMutation, gql } from "urql";

const DELETE_POST = gql`
  mutation DeletePost($id: ID!) {
    deletePost(id: $id) {
      id
    }
  }
`;

interface DeletePostButtonProps {
  postId: string;
  onDeleted?: () => void;
}

function DeletePostButton({ postId, onDeleted }: DeletePostButtonProps) {
  const [result, executeMutation] = useMutation(DELETE_POST);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) {
      return;
    }

    const response = await executeMutation({ id: postId });

    if (response.error) {
      console.error("Failed to delete post:", response.error);
      return;
    }

    onDeleted?.();
  };

  return (
    <button onClick={handleDelete} disabled={result.fetching}>
      {result.fetching ? "Deleting..." : "Delete"}
    </button>
  );
}

export { DeletePostButton, DELETE_POST };
```

**Why good:** Confirmation dialog prevents accidental deletion, disabled during mutation, error handling

---

## Pattern 4: Error Handling

### Component-Level Error Handling

```typescript
// components/users-with-error-handling.tsx
import { useQuery, gql } from "urql";

const USERS_QUERY = gql`
  query GetUsers {
    users {
      id
      name
      email
    }
  }
`;

function UsersWithErrorHandling() {
  const [result, reexecuteQuery] = useQuery({ query: USERS_QUERY });

  const { data, error, fetching } = result;

  // Network error (no connection, timeout, etc.)
  if (error?.networkError) {
    return (
      <ErrorBanner
        type="network"
        message="Unable to connect. Please check your internet connection."
        onRetry={() => reexecuteQuery({ requestPolicy: "network-only" })}
      />
    );
  }

  // GraphQL errors (validation, authorization, etc.)
  if (error?.graphQLErrors.length) {
    const notFound = error.graphQLErrors.some(
      (e) => e.extensions?.code === "NOT_FOUND"
    );
    if (notFound) {
      return <NotFoundPage />;
    }
    return <ErrorBanner message={error.message} />;
  }

  // Partial data with errors (GraphQL allows this)
  if (data && error) {
    return (
      <>
        <WarningBanner message="Some data could not be loaded" />
        <UsersList users={data.users} />
      </>
    );
  }

  if (fetching) return <Skeleton />;
  if (!data?.users?.length) return <EmptyState message="No users found" />;

  return <UsersList users={data.users} />;
}

export { UsersWithErrorHandling };
```

**Why good:** Handles network vs GraphQL errors differently, supports partial data with errors, provides retry action

---

## Pattern 5: Context Options

### Custom Fetch Options Per Query

```typescript
import { useQuery, gql } from "urql";

const ADMIN_DATA_QUERY = gql`
  query GetAdminData {
    adminData {
      sensitiveField
    }
  }
`;

function AdminPanel() {
  const [result] = useQuery({
    query: ADMIN_DATA_QUERY,
    context: {
      // Custom fetch options for this query
      fetchOptions: {
        headers: {
          "X-Admin-Token": process.env.ADMIN_TOKEN || "",
        },
      },
      // Override URL for this specific query
      url: process.env.ADMIN_GRAPHQL_URL || "",
      // Force network request
      requestPolicy: "network-only",
    },
  });

  // ... render
}

export { AdminPanel };
```

**Why good:** Per-query customization without affecting global client, headers for specific endpoints

---

## Anti-Pattern Examples

```typescript
// BAD: Wrong exchange order (async before sync)
const client = new Client({
  url: "/graphql",
  exchanges: [fetchExchange, cacheExchange], // WRONG ORDER!
});

// BAD: Magic numbers
const POLL_INTERVAL = 5000; // What is 5000?

// BAD: Not handling all states
function BadUserList() {
  const [result] = useQuery({ query: USERS_QUERY });
  // Crashes if data is undefined!
  return result.data.users.map((u) => <li key={u.id}>{u.name}</li>);
}

// BAD: Default export
export default function UserList() { /* ... */ }

// BAD: Missing Provider (v4+ requires Provider)
function App() {
  // Error: No urql Client found!
  return <UserList />;
}
```

```typescript
// GOOD: Correct exchange order (sync before async)
const client = new Client({
  url: "/graphql",
  exchanges: [cacheExchange, fetchExchange], // Correct!
});

// GOOD: Named constant with unit
const POLL_INTERVAL_MS = 5 * 1000; // 5 seconds

// GOOD: Handle all states
function GoodUserList() {
  const [result] = useQuery({ query: USERS_QUERY });
  const { data, fetching, error } = result;

  if (fetching && !data) return <Skeleton />;
  if (error && !data) return <Error message={error.message} />;
  if (!data?.users?.length) return <EmptyState />;

  return data.users.map((u) => <li key={u.id}>{u.name}</li>);
}

// GOOD: Named export
export { UserList };

// GOOD: Always wrap with Provider
function App() {
  return (
    <Provider value={client}>
      <UserList />
    </Provider>
  );
}
```

**Why bad examples fail:** Wrong exchange order breaks caching, magic numbers hide intent, missing state handling causes crashes, default exports prevent tree-shaking, missing Provider causes runtime errors
