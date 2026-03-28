# Apollo Client GraphQL - Fragment Patterns

> Reusable field selections with fragments. See [core.md](core.md) for basic patterns.

---

## Defining and Using Fragments

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

---

## Using Fragments in Queries

```typescript
// components/post-detail.tsx
import { useQuery, gql } from "@apollo/client";
import { POST_WITH_AUTHOR } from "../graphql/fragments";

const GET_POST = gql`
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

**Why good:** Fragments ensure consistent field selection across queries, reduce duplication, and make cache normalization reliable. Compose fragments for nested selections.
