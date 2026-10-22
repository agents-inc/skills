# Apollo Client — Testing Examples

> What Apollo contributes to a component test: the provider, the mock shape, and the cache
> assertions. The renderer, the queries and the assertion style come from whatever testing solution
> the project uses — this file writes them as `render` and `screen`.

**Prerequisites**: Pattern 1 (client setup), Pattern 2 (queries) and Pattern 3 (mutations with cache
updates) from [core.md](core.md).

---

## Wrapping a component in MockedProvider

```typescript
// test/apollo-test-utils.tsx
import { MockedProvider } from "@apollo/client/testing/react";
import { MockedResponse } from "@apollo/client/testing";
import type { ReactElement, ReactNode } from "react";

interface ApolloRenderOptions {
  mocks?: MockedResponse[];
}

function renderWithApollo(
  ui: ReactElement,
  { mocks = [], ...renderOptions }: ApolloRenderOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MockedProvider mocks={mocks}>
        {children}
      </MockedProvider>
    );
  }

  // render() is your testing library's renderer
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

export { renderWithApollo };
```

The client adds `__typename` to every selection.
A mock whose `result.data` omits `__typename` therefore fails to match — which is the commonest
reason a mock "does not fire".

---

## The mock shape

A mock matches on the document **and** on deep equality of the variables. Both have to be exactly
what the component sends.

```typescript
const TEST_USER_ID = "user-123";

const mockUserResponse: MockedResponse = {
  request: { query: GET_USER, variables: { id: TEST_USER_ID } },
  result: {
    data: {
      user: {
        __typename: "User", // required: the client adds it to every selection
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
  request: { query: GET_USER, variables: { id: TEST_USER_ID } },
  error: new Error("Failed to load user"),
};
```

A mock is consumed once by default, so a retry needs two entries and the order is the order they are
used:

```typescript
renderWithApollo(<UserProfile userId={TEST_USER_ID} />, {
  mocks: [mockUserError, mockUserResponse], // first render fails, the retry succeeds
});
```

### One test, end to end

```typescript
// components/user-profile.test.tsx
it("displays user data after loading", async () => {
  renderWithApollo(<UserProfile userId={TEST_USER_ID} />, {
    mocks: [mockUserResponse],
  });

  // the first render is always the loading state — the mock resolves a tick later
  expect(screen.getByTestId("user-skeleton")).toBeInTheDocument();

  expect(await screen.findByText("Test User")).toBeInTheDocument();
  expect(screen.getByText("test@example.com")).toBeInTheDocument();
});
```

Every assertion about data has to be awaited. `MockedProvider` resolves its mock asynchronously even
though nothing goes over a network, so a synchronous `getByText` for the loaded content fails while
the component is still in its loading state.

---

## Looser matching

```typescript
const reusableMock: MockedResponse = {
  request: { query: GET_USER, variables: { id: "user-123" } },
  result: {
    data: { user: { __typename: "User", id: "user-123", name: "Test" } },
  },
  maxUsageCount: 3, // survives a refetch and two re-renders; default is 1
};

const dynamicMock: MockedResponse = {
  request: {
    query: SEARCH_USERS,
    variables: (variables) => variables.query?.startsWith("test"),
  },
  result: {
    data: { searchUsers: [{ __typename: "User", id: "1", name: "Test User" }] },
  },
};
```

A `variables` function replaces the deep-equality check, which is what makes a debounced or paginated
component testable without enumerating every variable set it will send.

---

## Asserting a cache update

Pass your own `InMemoryCache` to `MockedProvider`, seed it, then read it back after the interaction.
This is the only way to test that a mutation's `update` callback did what it claims.

```typescript
import { InMemoryCache } from "@apollo/client";

const TEST_POST_ID = "post-123";

const mockDeleteSuccess: MockedResponse = {
  request: { query: DELETE_POST, variables: { id: TEST_POST_ID } },
  result: { data: { deletePost: { __typename: "Post", id: TEST_POST_ID } } },
};

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

render(
  <MockedProvider mocks={[mockDeleteSuccess]} cache={cache}>
    <DeletePostButton postId={TEST_POST_ID} />
  </MockedProvider>
);

// `click` is your testing library's interaction helper
await click(screen.getByRole("button", { name: /delete/i }));

const cachedPosts = cache.readQuery({ query: GET_POSTS });
expect(cachedPosts?.posts).toStrictEqual([
  { __typename: "Post", id: "post-456", title: "Other post" },
]);
```

Assert the remaining members rather than the length — a delete that removed the wrong row leaves the
count right.
