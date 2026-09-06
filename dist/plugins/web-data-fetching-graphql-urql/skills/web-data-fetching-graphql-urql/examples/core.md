# URQL — Core Examples

> Full code for the core patterns. See [SKILL.md](../SKILL.md) for the decisions.

**Extended examples:**

- [exchanges.md](exchanges.md) — the pipeline, Graphcache, auth, retry, custom exchanges
- [subscriptions.md](subscriptions.md) — real-time data over websockets
- [v6-features.md](v6-features.md) — the GET default and the migration steps

---

## Pattern 1: Client and provider

### The client

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

### The provider

```typescript
// providers/urql-provider.tsx
import { Provider } from "urql";
import { client } from "../lib/urql-client";
import type { ReactNode } from "react";

interface UrqlProviderProps {
  children: ReactNode;
}

function UrqlProvider({ children }: UrqlProviderProps) {
  return <Provider value={client}>{children}</Provider>;
}

export { UrqlProvider };
```

The client is created once at module scope, not inside the provider component — a client rebuilt on
re-render brings a fresh empty cache with it.

---

## Pattern 2: Queries

### With variables and loading states

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

`stale` gets its own affordance: the data on screen is real and a refresh is in flight behind it, so
a badge is right and a skeleton would be a regression.

### Pausing a conditional query

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

Without `pause`, the query fires with `id: null` and the server answers with an error the component
then has to distinguish from a real one.

---

## Pattern 3: Mutations

### Create

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

### Update

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

### Delete

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

All three read the error off the awaited response rather than from a callback, so the success path
and the failure path stay in one function. With the document cache these need no cache code at all:
the mutation's result carries a `__typename` and every query holding that type is invalidated.

---

## Pattern 4: Error handling

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

The order of the branches is the point: the network branch offers a retry because retrying might
work, the GraphQL branch inspects `extensions.code` because a 404 and a validation failure need
different screens, and the partial branch runs before the empty check so a page that mostly loaded
still renders.

---

## Pattern 5: Per-query context

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

`context` is per-operation and leaves the client untouched, which is what makes a second endpoint or
a one-off header safe to add without a second `Client`.

The mistakes these patterns guard against are in [SKILL.md](../SKILL.md)'s red flags.
