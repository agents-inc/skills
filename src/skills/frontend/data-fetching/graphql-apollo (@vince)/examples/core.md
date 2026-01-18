# Apollo Client GraphQL - Code Examples

> All code examples for Apollo Client patterns. See [SKILL.md](../SKILL.md) for core concepts.

**Extended examples:**
- [pagination.md](pagination.md) - Infinite scroll, type policies
- [error-handling.md](error-handling.md) - Component-level and global error handling
- [fragments.md](fragments.md) - Reusable field selections
- [subscriptions.md](subscriptions.md) - Real-time data with WebSockets
- [testing.md](testing.md) - MockedProvider, component tests, cache testing
- [suspense.md](suspense.md) - v3.9+ Suspense hooks (useSuspenseQuery, useLoadableQuery)

---

## Pattern 1: Complete Client Setup

### GraphQL Codegen Configuration

```typescript
// codegen.ts
import type { CodegenConfig } from "@graphql-codegen/cli";

const SCHEMA_PATH = "./schema.graphql";
const DOCUMENTS_GLOB = "src/**/*.{ts,tsx}";
const OUTPUT_PATH = "./src/generated/graphql.ts";

const config: CodegenConfig = {
  schema: SCHEMA_PATH,
  documents: DOCUMENTS_GLOB,
  generates: {
    [OUTPUT_PATH]: {
      plugins: ["typescript", "typescript-operations", "typed-document-node"],
      config: {
        strictScalars: true,
        immutableTypes: true,
        enumsAsConst: true,
        onlyOperationTypes: true,
      },
    },
  },
  hooks: { afterAllFileWrite: ["prettier --write"] },
};

export { config as default };
```

### Apollo Provider Setup

```typescript
// providers/apollo-provider.tsx
"use client";

import { ApolloClient, ApolloProvider, InMemoryCache, HttpLink, from } from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { setContext } from "@apollo/client/link/context";
import type { ReactNode } from "react";

const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_URL || "";
const TOKEN_STORAGE_KEY = "auth_token";

const authLink = setContext((_, { headers }) => {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
  return { headers: { ...headers, authorization: token ? `Bearer ${token}` : "" } };
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, path, extensions }) => {
      console.error(`[GraphQL error]: ${message}, Path: ${path}`);
      if (extensions?.code === "UNAUTHENTICATED") {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        window.location.href = "/login";
      }
    });
  }
  if (networkError) console.error(`[Network error]: ${networkError.message}`);
});

const httpLink = new HttpLink({ uri: GRAPHQL_ENDPOINT, credentials: "include" });

function createApolloClient() {
  return new ApolloClient({
    link: from([authLink, errorLink, httpLink]),
    cache: new InMemoryCache({
      typePolicies: {
        Query: { fields: { me: { merge: true } } },
        User: { keyFields: ["id"] },
      },
    }),
    defaultOptions: {
      watchQuery: { fetchPolicy: "cache-and-network" },
      query: { fetchPolicy: "cache-first", errorPolicy: "all" },
      mutate: { errorPolicy: "all" },
    },
  });
}

let apolloClient: ApolloClient<object> | null = null;

function getClient() {
  if (typeof window === "undefined") return createApolloClient();
  if (!apolloClient) apolloClient = createApolloClient();
  return apolloClient;
}

function ApolloWrapper({ children }: { children: ReactNode }) {
  return <ApolloProvider client={getClient()}>{children}</ApolloProvider>;
}

export { ApolloWrapper, getClient };
```

**Why good:** Codegen generates types automatically, auth link adds token to requests, error link handles auth globally, singleton prevents multiple clients

---

## Pattern 2: useQuery Basics

### Query with Variables and Loading States

```typescript
// components/user-profile.tsx
import { useQuery, gql } from "@apollo/client";
import type { GetUserQuery, GetUserQueryVariables } from "@/generated/graphql";

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

function UserProfile({ userId }: { userId: string }) {
  const { data, loading, error, refetch } = useQuery<GetUserQuery, GetUserQueryVariables>(
    GET_USER,
    {
      variables: { id: userId },
      skip: !userId,
      fetchPolicy: "cache-and-network",
    }
  );

  if (loading && !data) return <UserProfileSkeleton />;
  if (error && !data) return <ErrorCard message={error.message} onRetry={() => refetch()} />;
  if (!data?.user) return <NotFound message="User not found" />;

  return (
    <article>
      <img src={data.user.avatar || "/default-avatar.png"} alt={data.user.name} />
      <h1>{data.user.name}</h1>
      <p>{data.user.email}</p>
    </article>
  );
}

export { UserProfile, GET_USER };
```

### useLazyQuery for On-Demand Fetching

```typescript
// components/user-search.tsx
import { useLazyQuery, gql } from "@apollo/client";
import { useState } from "react";

const SEARCH_USERS = gql`
  query SearchUsers($query: String!, $limit: Int) {
    searchUsers(query: $query, limit: $limit) { id, name, email }
  }
`;

const DEFAULT_LIMIT = 10;
const MIN_SEARCH_LENGTH = 2;

function UserSearch() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchUsers, { data, loading, error, called }] = useLazyQuery(SEARCH_USERS, {
    fetchPolicy: "network-only",
  });

  const handleSearch = () => {
    if (searchTerm.length >= MIN_SEARCH_LENGTH) {
      searchUsers({ variables: { query: searchTerm, limit: DEFAULT_LIMIT } });
    }
  };

  return (
    <div>
      <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      <button onClick={handleSearch} disabled={loading}>Search</button>
      {error && <p>Error: {error.message}</p>}
      {called && !loading && (
        <ul>{data?.searchUsers?.map((u) => <li key={u.id}>{u.name}</li>)}</ul>
      )}
    </div>
  );
}

export { UserSearch };
```

**Why good:** useLazyQuery for user-triggered fetches, skip prevents unnecessary requests, network-only for fresh search results

---

## Pattern 3: Mutations with Cache Updates

### Create with Cache Update

```typescript
// components/create-post-form.tsx
import { useMutation, gql, Reference } from "@apollo/client";
import { useState } from "react";

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

function CreatePostForm({ authorId, onSuccess }: { authorId: string; onSuccess?: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [createPost, { loading, error }] = useMutation(CREATE_POST, {
    variables: { input: { title, content, authorId } },
    update(cache, { data }) {
      if (!data?.createPost) return;
      cache.modify({
        fields: {
          posts(existing: readonly Reference[] = [], { toReference }) {
            const newRef = toReference(data.createPost);
            return newRef ? [newRef, ...existing] : existing;
          },
        },
      });
    },
    onCompleted() {
      setTitle("");
      setContent("");
      onSuccess?.();
    },
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); createPost(); }}>
      {error && <p className="error">{error.message}</p>}
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} />
      <button type="submit" disabled={loading}>{loading ? "Creating..." : "Create"}</button>
    </form>
  );
}

export { CreatePostForm, CREATE_POST };
```

### Update with Optimistic Response

```typescript
// components/edit-post-form.tsx
import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, gql } from "@apollo/client";
import type { Post } from "@/generated/graphql";

const UPDATE_POST = gql`
  mutation UpdatePost($id: ID!, $input: UpdatePostInput!) {
    updatePost(id: $id, input: $input) { id, title, content, updatedAt }
  }
`;

function EditPostForm({ post, onSuccess }: { post: Post; onSuccess?: () => void }) {
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);

  const [updatePost, { loading, error }] = useMutation(UPDATE_POST, {
    optimisticResponse: {
      updatePost: {
        __typename: "Post",
        id: post.id,
        title,
        content,
        updatedAt: new Date().toISOString(),
      },
    },
    onCompleted: onSuccess,
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updatePost({ variables: { id: post.id, input: { title, content } } });
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="error">{error.message}</p>}
      <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={loading} />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} disabled={loading} />
      <button type="submit" disabled={loading}>{loading ? "Saving..." : "Save"}</button>
    </form>
  );
}

export { EditPostForm };
```

### Delete with Cache Eviction

```typescript
// components/delete-post-button.tsx
import { useMutation, gql, Reference } from "@apollo/client";

const DELETE_POST = gql`
  mutation DeletePost($id: ID!) { deletePost(id: $id) { id } }
`;

function DeletePostButton({ postId, onDeleted }: { postId: string; onDeleted?: () => void }) {
  const [deletePost, { loading }] = useMutation(DELETE_POST, {
    variables: { id: postId },
    update(cache, { data }) {
      if (!data?.deletePost) return;
      cache.modify({
        fields: {
          posts(existing: readonly Reference[], { readField }) {
            return existing.filter((ref) => readField("id", ref) !== postId);
          },
        },
      });
      cache.evict({ id: cache.identify({ __typename: "Post", id: postId }) });
      cache.gc();
    },
    optimisticResponse: { deletePost: { __typename: "Post", id: postId } },
    onCompleted: onDeleted,
  });

  return (
    <button onClick={() => window.confirm("Delete?") && deletePost()} disabled={loading}>
      {loading ? "Deleting..." : "Delete"}
    </button>
  );
}

export { DeletePostButton, DELETE_POST };
```

**Why good:** cache.modify updates lists without refetching, cache.evict removes data, optimisticResponse provides instant feedback

---

## Anti-Pattern Examples

```typescript
// BAD: Manual type definitions (drift from schema)
interface User { id: string; name: string; }

// BAD: Missing __typename in optimistic response
const [createUser] = useMutation(CREATE_USER, {
  optimisticResponse: { createUser: { id: "temp-123", name: "New User" } }, // Cache fails!
});

// BAD: Magic numbers
const { data } = useQuery(GET_USERS, { pollInterval: 30000 }); // What is 30000?

// BAD: Missing keyArgs - cache collisions
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        users: { // All filtered queries share same cache!
          merge(existing = [], incoming) { return [...existing, ...incoming]; },
        },
      },
    },
  },
});
```

```typescript
// GOOD: Generated types from Codegen
import type { User, GetUsersQuery } from "@/generated/graphql";

// GOOD: Complete optimistic response with __typename
const [createUser] = useMutation(CREATE_USER, {
  optimisticResponse: {
    createUser: { __typename: "User", id: "temp-123", name: "New User", email: "new@example.com" },
  },
});

// GOOD: Named constants
const POLL_INTERVAL_MS = 30 * 1000;
const { data } = useQuery(GET_USERS, { pollInterval: POLL_INTERVAL_MS });

// GOOD: keyArgs separates caches per filter
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        users: {
          keyArgs: ["filter", "sortBy"],
          merge(existing = [], incoming) { return [...existing, ...incoming]; },
        },
      },
    },
  },
});
```

**Why bad examples fail:** Manual types drift from schema, missing __typename breaks cache, magic numbers hide intent, missing keyArgs shows wrong data
