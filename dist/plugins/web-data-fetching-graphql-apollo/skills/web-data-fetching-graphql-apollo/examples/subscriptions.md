# Apollo Client GraphQL - Subscription Patterns

> Real-time data with WebSocket subscriptions. See [core.md](core.md) for basic patterns.

---

## Setting Up WebSocket Link

```typescript
// lib/apollo-subscriptions.ts
import { ApolloClient, InMemoryCache, HttpLink, split } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-ws";

const GRAPHQL_HTTP_URL = process.env.GRAPHQL_URL || "";
const GRAPHQL_WS_URL = process.env.GRAPHQL_WS_URL || "";

const httpLink = new HttpLink({
  uri: GRAPHQL_HTTP_URL,
});

const wsLink =
  typeof window !== "undefined"
    ? new GraphQLWsLink(
        createClient({
          url: GRAPHQL_WS_URL,
          connectionParams: () => ({
            authToken: localStorage.getItem("auth_token"),
          }),
          retryAttempts: 5,
          shouldRetry: () => true,
        }),
      )
    : null;

// Split link based on operation type
const splitLink = wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === "OperationDefinition" &&
          definition.operation === "subscription"
        );
      },
      wsLink,
      httpLink,
    )
  : httpLink;

const subscriptionClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});

export { subscriptionClient };
```

---

## Using useSubscription Hook

```typescript
// components/live-comments.tsx
import { useQuery, useSubscription, gql } from "@apollo/client";

const GET_COMMENTS = gql`
  query GetComments($postId: ID!) {
    comments(postId: $postId) {
      id
      content
      author {
        id
        name
      }
      createdAt
    }
  }
`;

const COMMENT_ADDED = gql`
  subscription OnCommentAdded($postId: ID!) {
    commentAdded(postId: $postId) {
      id
      content
      author {
        id
        name
      }
      createdAt
    }
  }
`;

function LiveComments({ postId }: { postId: string }) {
  const { data, loading } = useQuery(GET_COMMENTS, {
    variables: { postId },
  });

  // Subscribe to new comments
  useSubscription(COMMENT_ADDED, {
    variables: { postId },
    onData: ({ client, data: subscriptionData }) => {
      if (!subscriptionData.data?.commentAdded) return;

      const newComment = subscriptionData.data.commentAdded;

      // Update cache with new comment
      client.cache.modify({
        fields: {
          comments(existingComments = [], { toReference }) {
            const newCommentRef = toReference(newComment);
            return [...existingComments, newCommentRef];
          },
        },
      });
    },
  });

  if (loading) return <CommentsSkeleton />;

  return (
    <ul className="comments">
      {data?.comments.map((comment) => (
        <li key={comment.id}>
          <strong>{comment.author.name}</strong>
          <p>{comment.content}</p>
          <time>{new Date(comment.createdAt).toLocaleString()}</time>
        </li>
      ))}
    </ul>
  );
}

export { LiveComments };
```

**Why good:** Split link routes subscriptions to WebSocket while queries/mutations use HTTP. Cache updates on subscription data keep UI in sync. Connection params handle auth for WebSocket.
