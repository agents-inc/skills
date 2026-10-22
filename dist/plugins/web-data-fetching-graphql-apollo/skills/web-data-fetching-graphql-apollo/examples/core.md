# Apollo Client — Core Examples

> Full code for the core patterns. See [SKILL.md](../SKILL.md) for the decisions.

**Extended examples:**

- [pagination.md](pagination.md) — infinite scroll, type policies
- [error-handling.md](error-handling.md) — component-level and global error handling
- [fragments.md](fragments.md) — reusable field selections
- [subscriptions.md](subscriptions.md) — real-time data over websockets
- [testing.md](testing.md) — MockedProvider, mock shapes, cache assertions
- [suspense.md](suspense.md) — Suspense hooks (v3.9+)

---

## Pattern 1: Client setup

### Code generation

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

// codegen CLI requires default export
export { config as default };
```

### Apollo Provider Setup

```typescript
// providers/apollo-provider.tsx
import { ApolloClient, CombinedGraphQLErrors, InMemoryCache, HttpLink, from } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { onError } from "@apollo/client/link/error";
import { setContext } from "@apollo/client/link/context";
import type { ReactNode } from "react";

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_URL || "";
const TOKEN_STORAGE_KEY = "auth_token";

const authLink = setContext((_, { headers }) => {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
  return { headers: { ...headers, authorization: token ? `Bearer ${token}` : "" } };
});

const errorLink = onError(({ error }) => {
  if (CombinedGraphQLErrors.is(error)) {
    error.errors.forEach(({ message, path, extensions }) => {
      console.error(`[GraphQL error]: ${message}, Path: ${path}`);
      if (extensions?.code === "UNAUTHENTICATED") {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        window.location.href = "/login";
      }
    });
  } else {
    console.error(`[Network error]: ${error.message}`);
  }
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
      query: { fetchPolicy: "cache-first" },
    },
  });
}

let apolloClient: ApolloClient | null = null;

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

The link order matters: `authLink` runs before `errorLink`, so a 401 caught by the error link is
already carrying the token that failed. The singleton keeps one cache per browser session while
returning a fresh client per server render.

---

## Pattern 2: Queries

### With variables and loading states

```typescript
// components/user-profile.tsx
import { gql, type TypedDocumentNode } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import type { GetUserQuery, GetUserQueryVariables } from "../generated/graphql";

const GET_USER: TypedDocumentNode<GetUserQuery, GetUserQueryVariables> = gql`
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
  const { data, loading, error, refetch } = useQuery(GET_USER, {
    variables: { id: userId },
    skip: !userId,
    fetchPolicy: "cache-and-network",
  });

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

### useLazyQuery, for a fetch the user triggers

```typescript
// components/user-search.tsx
import { gql, type TypedDocumentNode } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";
import { useState } from "react";
import type { SearchUsersQuery, SearchUsersQueryVariables } from "../generated/graphql";

const SEARCH_USERS: TypedDocumentNode<SearchUsersQuery, SearchUsersQueryVariables> = gql`
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

`called` distinguishes "no results" from "not searched yet", which are the same empty `data`.

---

## Pattern 3: Mutations with cache updates

### Create

```typescript
// components/create-post-form.tsx
import { gql, type Reference, type TypedDocumentNode } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { useState } from "react";
import type { CreatePostMutation, CreatePostMutationVariables } from "../generated/graphql";

const CREATE_POST: TypedDocumentNode<CreatePostMutation, CreatePostMutationVariables> = gql`
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
      const created = data?.createPost;
      if (!created) return;
      cache.modify({
        fields: {
          posts(existing: readonly Reference[] = [], { toReference }) {
            const newRef = toReference(created);
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

### Update, with an optimistic response

```typescript
// components/edit-post-form.tsx
import { useState } from "react";
import type { FormEvent } from "react";
import { gql, type TypedDocumentNode } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import type { Post, UpdatePostMutation, UpdatePostMutationVariables } from "../generated/graphql";

const UPDATE_POST: TypedDocumentNode<UpdatePostMutation, UpdatePostMutationVariables> = gql`
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

### Delete, evicting the entity

```typescript
// components/delete-post-button.tsx
import { gql, type Reference, type TypedDocumentNode } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import type { DeletePostMutation, DeletePostMutationVariables } from "../generated/graphql";

const DELETE_POST: TypedDocumentNode<DeletePostMutation, DeletePostMutationVariables> = gql`
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

The delete does three things and needs all three: `cache.modify` takes the reference out of the list,
`cache.evict` removes the entity, and `cache.gc` collects what now points at nothing.

The mistakes these patterns guard against are in [SKILL.md](../SKILL.md)'s red flags.
