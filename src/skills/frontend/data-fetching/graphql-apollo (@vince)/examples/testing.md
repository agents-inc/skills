# Apollo Client GraphQL - Testing Examples

> Extended examples for testing. See [core.md](core.md) for core patterns.

**Prerequisites**: Understand Pattern 1 (Client Setup), Pattern 2 (useQuery), Pattern 3 (Mutations) from core examples first.

---

## Mock Provider Setup

```typescript
// test/apollo-test-utils.tsx
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { render, RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

interface ApolloRenderOptions extends Omit<RenderOptions, "wrapper"> {
  mocks?: MockedResponse[];
  addTypename?: boolean;
}

function renderWithApollo(
  ui: ReactElement,
  { mocks = [], addTypename = true, ...renderOptions }: ApolloRenderOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MockedProvider mocks={mocks} addTypename={addTypename}>
        {children}
      </MockedProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

export { renderWithApollo };
export type { ApolloRenderOptions };
```

---

## Component Test Example

```typescript
// components/user-profile.test.tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApollo } from "@/test/apollo-test-utils";
import { UserProfile, GET_USER } from "./user-profile";
import type { MockedResponse } from "@apollo/client/testing";

const TEST_USER_ID = "user-123";

const mockUserResponse: MockedResponse = {
  request: {
    query: GET_USER,
    variables: { id: TEST_USER_ID },
  },
  result: {
    data: {
      user: {
        __typename: "User",
        id: TEST_USER_ID,
        name: "Test User",
        email: "test@example.com",
        avatar: "https://example.com/avatar.jpg",
        bio: "Test bio",
      },
    },
  },
};

const mockUserError: MockedResponse = {
  request: {
    query: GET_USER,
    variables: { id: TEST_USER_ID },
  },
  error: new Error("Failed to load user"),
};

describe("UserProfile", () => {
  it("displays loading state initially", () => {
    renderWithApollo(<UserProfile userId={TEST_USER_ID} />, {
      mocks: [mockUserResponse],
    });

    expect(screen.getByTestId("user-skeleton")).toBeInTheDocument();
  });

  it("displays user data after loading", async () => {
    renderWithApollo(<UserProfile userId={TEST_USER_ID} />, {
      mocks: [mockUserResponse],
    });

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("Test bio")).toBeInTheDocument();
  });

  it("displays error state on failure", async () => {
    renderWithApollo(<UserProfile userId={TEST_USER_ID} />, {
      mocks: [mockUserError],
    });

    await waitFor(() => {
      expect(screen.getByText(/failed to load user/i)).toBeInTheDocument();
    });
  });

  it("allows retry on error", async () => {
    const user = userEvent.setup();

    // First request fails, second succeeds
    renderWithApollo(<UserProfile userId={TEST_USER_ID} />, {
      mocks: [mockUserError, mockUserResponse],
    });

    await waitFor(() => {
      expect(screen.getByText(/failed to load user/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });
  });
});
```

**Why good:** MockedProvider enables isolated testing without network, separate mocks for success and error cases, userEvent for realistic user interactions, waitFor handles async Apollo operations

---

## Testing Mutation Components

```typescript
// components/create-post-form.test.tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithApollo } from "@/test/apollo-test-utils";
import { CreatePostForm, CREATE_POST } from "./create-post-form";
import type { MockedResponse } from "@apollo/client/testing";

const TEST_AUTHOR_ID = "author-123";

const mockCreatePostSuccess: MockedResponse = {
  request: {
    query: CREATE_POST,
    variables: {
      input: {
        title: "Test Post",
        content: "Test content",
        authorId: TEST_AUTHOR_ID,
      },
    },
  },
  result: {
    data: {
      createPost: {
        __typename: "Post",
        id: "new-post-123",
        title: "Test Post",
        content: "Test content",
        author: {
          __typename: "User",
          id: TEST_AUTHOR_ID,
          name: "Test Author",
        },
        createdAt: "2024-01-15T00:00:00Z",
      },
    },
  },
};

const mockCreatePostError: MockedResponse = {
  request: {
    query: CREATE_POST,
    variables: {
      input: {
        title: "Test Post",
        content: "Test content",
        authorId: TEST_AUTHOR_ID,
      },
    },
  },
  error: new Error("Failed to create post"),
};

describe("CreatePostForm", () => {
  it("submits form and calls onSuccess", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    renderWithApollo(
      <CreatePostForm authorId={TEST_AUTHOR_ID} onSuccess={onSuccess} />,
      { mocks: [mockCreatePostSuccess] }
    );

    await user.type(screen.getByPlaceholderText("Post title"), "Test Post");
    await user.type(screen.getByPlaceholderText("Write your post..."), "Test content");
    await user.click(screen.getByRole("button", { name: /create post/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("displays error on mutation failure", async () => {
    const user = userEvent.setup();

    renderWithApollo(
      <CreatePostForm authorId={TEST_AUTHOR_ID} />,
      { mocks: [mockCreatePostError] }
    );

    await user.type(screen.getByPlaceholderText("Post title"), "Test Post");
    await user.type(screen.getByPlaceholderText("Write your post..."), "Test content");
    await user.click(screen.getByRole("button", { name: /create post/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to create post/i)).toBeInTheDocument();
    });
  });

  it("disables submit button while loading", async () => {
    const user = userEvent.setup();

    renderWithApollo(
      <CreatePostForm authorId={TEST_AUTHOR_ID} />,
      { mocks: [mockCreatePostSuccess] }
    );

    await user.type(screen.getByPlaceholderText("Post title"), "Test Post");
    await user.type(screen.getByPlaceholderText("Write your post..."), "Test content");

    const submitButton = screen.getByRole("button", { name: /create post/i });
    await user.click(submitButton);

    // Button should show loading state
    expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
  });
});
```

**Why good:** Tests cover success, error, and loading states. Mocks match exact variables for reliable tests. Uses userEvent for realistic interactions.

---

## Testing Cache Updates

```typescript
// components/delete-post-button.test.tsx
import { InMemoryCache } from "@apollo/client";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { render } from "@testing-library/react";
import { DeletePostButton, DELETE_POST } from "./delete-post-button";
import { GET_POSTS } from "./post-list";

const TEST_POST_ID = "post-123";

const mockDeleteSuccess: MockedResponse = {
  request: {
    query: DELETE_POST,
    variables: { id: TEST_POST_ID },
  },
  result: {
    data: {
      deletePost: {
        __typename: "Post",
        id: TEST_POST_ID,
      },
    },
  },
};

describe("DeletePostButton cache updates", () => {
  it("removes post from cache after deletion", async () => {
    const user = userEvent.setup();

    // Pre-populate cache with posts
    const cache = new InMemoryCache();
    cache.writeQuery({
      query: GET_POSTS,
      data: {
        posts: [
          { __typename: "Post", id: TEST_POST_ID, title: "Post to delete" },
          { __typename: "Post", id: "post-456", title: "Other post" },
        ],
      },
    });

    // Mock window.confirm
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <MockedProvider mocks={[mockDeleteSuccess]} cache={cache}>
        <DeletePostButton postId={TEST_POST_ID} />
      </MockedProvider>
    );

    await user.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      // Verify post was removed from cache
      const cachedPosts = cache.readQuery({ query: GET_POSTS });
      expect(cachedPosts?.posts).toHaveLength(1);
      expect(cachedPosts?.posts[0].id).toBe("post-456");
    });
  });
});
```

**Why good:** Tests cache behavior directly by providing custom cache instance. Verifies mutation correctly updates cache state.

---

## Schema-Based Testing (v3.10+)

Apollo Client v3.10 introduced experimental schema-based testing utilities as an alternative to `MockedProvider`.

```typescript
// test/schema-test-utils.tsx
import { createTestSchema, createSchemaFetch } from "@apollo/client/testing/experimental";
import { buildSchema } from "graphql";

// Define or import your GraphQL schema
const typeDefs = `
  type Query {
    user(id: ID!): User
    users: [User!]!
  }

  type User {
    id: ID!
    name: String!
    email: String!
  }

  type Mutation {
    createUser(name: String!, email: String!): User!
  }
`;

// Default resolvers
const defaultResolvers = {
  Query: {
    user: (_: any, { id }: { id: string }) => ({
      id,
      name: "Test User",
      email: "test@example.com",
    }),
    users: () => [
      { id: "1", name: "User 1", email: "user1@example.com" },
      { id: "2", name: "User 2", email: "user2@example.com" },
    ],
  },
  Mutation: {
    createUser: (_: any, { name, email }: { name: string; email: string }) => ({
      id: `user-${Date.now()}`,
      name,
      email,
    }),
  },
};

// Create test schema with resolvers
const testSchema = createTestSchema(buildSchema(typeDefs), {
  resolvers: defaultResolvers,
  // Optional: Mock scalar types
  scalars: {
    DateTime: () => new Date().toISOString(),
  },
});

// Create fetch function for tests
const schemaFetch = createSchemaFetch(testSchema);

export { testSchema, schemaFetch, createTestSchema };
```

```typescript
// components/user-list.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { ApolloClient, InMemoryCache, ApolloProvider } from "@apollo/client";
import { schemaFetch, testSchema } from "@/test/schema-test-utils";
import { UserList } from "./user-list";

describe("UserList with schema-based testing", () => {
  it("renders users from schema", async () => {
    // Create client with schema fetch
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({
        uri: "/graphql",
        fetch: schemaFetch,
      }),
    });

    render(
      <ApolloProvider client={client}>
        <UserList />
      </ApolloProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("User 1")).toBeInTheDocument();
      expect(screen.getByText("User 2")).toBeInTheDocument();
    });
  });

  it("can override resolvers per test", async () => {
    // Override resolvers for this specific test
    const customSchema = testSchema.fork({
      resolvers: {
        Query: {
          users: () => [{ id: "custom", name: "Custom User", email: "custom@test.com" }],
        },
      },
    });

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({
        uri: "/graphql",
        fetch: createSchemaFetch(customSchema),
      }),
    });

    render(
      <ApolloProvider client={client}>
        <UserList />
      </ApolloProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Custom User")).toBeInTheDocument();
    });
  });
});
```

**Why good:** Schema-based testing mirrors backend implementation, allows overriding resolvers per test, uses real link chain instead of mocked one, supports incremental adoption alongside MockedProvider

---

## MockedProvider Enhancements (v3.9+)

```typescript
// Reusable mock with maxUsageCount
const reusableMock: MockedResponse = {
  request: {
    query: GET_USER,
    variables: { id: "user-123" },
  },
  result: {
    data: { user: { __typename: "User", id: "user-123", name: "Test" } },
  },
  maxUsageCount: 3, // Mock can be used up to 3 times (default: 1)
};

// Dynamic variable matching with variableMatcher
const dynamicMock: MockedResponse = {
  request: {
    query: SEARCH_USERS,
  },
  variableMatcher: (variables) => {
    // Match any search query starting with "test"
    return variables.query?.startsWith("test");
  },
  result: {
    data: { searchUsers: [{ id: "1", name: "Test User" }] },
  },
};
```

**Why good:** `maxUsageCount` allows same mock for multiple renders/refetches, `variableMatcher` enables dynamic matching without exact variable equality
