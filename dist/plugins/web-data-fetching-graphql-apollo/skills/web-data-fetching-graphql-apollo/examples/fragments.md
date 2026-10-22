# Apollo Client — Fragment Examples

> Reusable field selections. See [core.md](core.md) for client setup and queries.

---

## Defining and composing

```typescript
// graphql/fragments.ts
import { gql } from "@apollo/client";

const USER_FIELDS = gql`
  fragment UserFields on User {
    id
    name
    email
    avatar
  }
`;

const POST_FIELDS = gql`
  fragment PostFields on Post {
    id
    title
    content
    excerpt
    createdAt
    updatedAt
  }
`;

const POST_WITH_AUTHOR = gql`
  fragment PostWithAuthor on Post {
    ...PostFields
    author {
      ...UserFields
    }
  }
  ${POST_FIELDS}
  ${USER_FIELDS}
`;

export { USER_FIELDS, POST_FIELDS, POST_WITH_AUTHOR };
```

A composed fragment interpolates the fragments it spreads. Interpolate each one exactly once per
document — a duplicate definition is a GraphQL validation error at parse time.

---

## Using them in a query

```typescript
// components/post-detail.tsx
import { gql, type TypedDocumentNode } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { POST_WITH_AUTHOR } from "../graphql/fragments";
import type { GetPostQuery, GetPostQueryVariables } from "../generated/graphql";

const GET_POST: TypedDocumentNode<GetPostQuery, GetPostQueryVariables> = gql`
  query GetPost($id: ID!) {
    post(id: $id) {
      ...PostWithAuthor
      comments {
        id
        content
        author {
          ...UserFields
        }
      }
    }
  }
  ${POST_WITH_AUTHOR}
`;

function PostDetail({ postId }: { postId: string }) {
  const { data, loading, error } = useQuery(GET_POST, {
    variables: { id: postId },
  });

  if (loading) return <PostSkeleton />;
  if (error) return <Error message={error.message} />;
  if (!data?.post) return <NotFound />;

  const { post } = data;

  return (
    <article>
      <header>
        <h1>{post.title}</h1>
        <AuthorCard author={post.author} />
        <time>{new Date(post.createdAt).toLocaleDateString()}</time>
      </header>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
      <CommentList comments={post.comments} />
    </article>
  );
}

export { PostDetail, GET_POST };
```

Every query spreading `UserFields` selects the same fields, so the cache holds one complete `User`
rather than several partial ones — which is what keeps a component reading from the cache from
finding a field missing.
