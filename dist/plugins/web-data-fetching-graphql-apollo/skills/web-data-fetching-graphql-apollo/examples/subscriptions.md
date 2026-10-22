# Apollo Client — Subscription Examples

> Real-time data over a websocket link. See [core.md](core.md) for client setup.

---

## The split link

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

`wsLink` is `null` where there is no `window`, and the split collapses to `httpLink` — a server
render then issues queries normally instead of trying to open a socket. `connectionParams` is a
function so the token is read at connect time rather than at module load.

---

## useSubscription writing to the cache

```typescript
// components/live-comments.tsx
import { gql, type TypedDocumentNode } from "@apollo/client";
import { useQuery, useSubscription } from "@apollo/client/react";
import type {
  GetCommentsQuery,
  GetCommentsQueryVariables,
  OnCommentAddedSubscription,
  OnCommentAddedSubscriptionVariables,
} from "../generated/graphql";

const GET_COMMENTS: TypedDocumentNode<GetCommentsQuery, GetCommentsQueryVariables> = gql`
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

const COMMENT_ADDED: TypedDocumentNode<
  OnCommentAddedSubscription,
  OnCommentAddedSubscriptionVariables
> = gql`
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

The list is rendered from the query, never from the subscription — `onData` writes the new comment
into the cache and the query re-renders from there. A component that renders subscription payloads
directly holds two sources of truth, and they disagree after the first refetch.
