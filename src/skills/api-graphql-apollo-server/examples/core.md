# Apollo Server - Core Examples

> Server setup, resolvers, context, and error handling. See [SKILL.md](../SKILL.md) for concepts and [reference.md](../reference.md) for decision frameworks.

**Additional Examples:**

- [data-sources.md](data-sources.md) - RESTDataSource, DataLoader, caching
- [advanced.md](advanced.md) - Subscriptions, federation, custom plugins

---

## Pattern 1: Standalone Server Setup

### Good Example - Typed standalone server

```typescript
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

// Schema definition using SDL
const typeDefs = `#graphql
  type Book {
    id: ID!
    title: String!
    author: Author!
  }

  type Author {
    id: ID!
    name: String!
    books: [Book!]!
  }

  type Query {
    books: [Book!]!
    book(id: ID!): Book
    authors: [Author!]!
  }

  type Mutation {
    addBook(title: String!, authorId: ID!): Book!
  }
`;

// Context type shared across all resolvers
interface MyContext {
  token: string | undefined;
  dataSources: {
    booksAPI: BooksAPI;
    authorsAPI: AuthorsAPI;
  };
}

// Pass context type as generic for type safety
const server = new ApolloServer<MyContext>({ typeDefs, resolvers });

const DEFAULT_PORT = 4000;

const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => {
    const token = req.headers.authorization;
    const { cache } = server;
    return {
      token,
      dataSources: {
        booksAPI: new BooksAPI({ cache, token }),
        authorsAPI: new AuthorsAPI({ cache }),
      },
    };
  },
  listen: { port: DEFAULT_PORT },
});

console.log(`Server ready at ${url}`);
```

**Why good:** generic type parameter ensures context type safety across resolvers, new data source instances per request prevent data leaks, named constant for port

### Bad Example - Shared instances and no types

```typescript
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

// BAD: data sources created once and shared across all requests
const booksAPI = new BooksAPI();
const authorsAPI = new AuthorsAPI();

const server = new ApolloServer({ typeDefs, resolvers }); // No context type

const { url } = await startStandaloneServer(server, {
  context: async () => ({
    dataSources: { booksAPI, authorsAPI }, // BAD: shared instances
  }),
  listen: { port: 4000 }, // BAD: magic number
});
```

**Why bad:** shared data source instances leak cached data between requests and users, missing generic type means resolver context is `any`, magic port number

---

## Pattern 2: Framework Middleware Integration

### Good Example - Express integration with graceful shutdown

```typescript
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
// v5: import from integration package (not @apollo/server/express4)
import { expressMiddleware } from "@as-integrations/express4";
import express from "express";
import http from "http";
import cors from "cors";

interface MyContext {
  token: string | undefined;
  dataSources: { booksAPI: BooksAPI };
}

const app = express();
const httpServer = http.createServer(app);

const server = new ApolloServer<MyContext>({
  typeDefs,
  resolvers,
  plugins: [
    // REQUIRED: enables graceful shutdown
    ApolloServerPluginDrainHttpServer({ httpServer }),
  ],
});

// MUST call start() before using expressMiddleware
await server.start();

const GRAPHQL_PATH = "/graphql";
const ALLOWED_ORIGINS = ["https://app.example.com"];

app.use(
  GRAPHQL_PATH,
  cors<cors.CorsRequest>({ origin: ALLOWED_ORIGINS }),
  express.json(),
  expressMiddleware(server, {
    context: async ({ req }) => {
      const token = req.headers.authorization;
      const { cache } = server;
      return {
        token,
        dataSources: {
          booksAPI: new BooksAPI({ cache, token }),
        },
      };
    },
  }),
);

const DEFAULT_PORT = 4000;

await new Promise<void>((resolve) => {
  httpServer.listen({ port: DEFAULT_PORT }, resolve);
});

console.log(`Server ready at http://localhost:${DEFAULT_PORT}${GRAPHQL_PATH}`);
```

**Why good:** drain plugin enables graceful shutdown, `server.start()` called before middleware, CORS configured with specific origins, new data source per request

### Bad Example - Missing drain plugin and calling start too late

```typescript
// BAD: no drain plugin
const server = new ApolloServer({ typeDefs, resolvers });

// BAD: using removed v4 import path
import { expressMiddleware } from "@apollo/server/express4";

// BAD: missing server.start() before middleware
app.use("/graphql", expressMiddleware(server)); // Throws!

// BAD: wildcard CORS with no configuration
app.use(cors()); // Allows all origins
```

**Why bad:** no drain plugin means connections hang on shutdown, v4 import path removed in v5, missing `start()` throws at runtime, wildcard CORS is a security risk

---

## Pattern 3: Resolver Patterns

### Good Example - Typed resolvers with parent chaining

```typescript
import { GraphQLError } from "graphql";

const resolvers = {
  Query: {
    // Top-level resolver: parent is undefined
    books: async (
      _parent: undefined,
      _args: Record<string, never>,
      contextValue: MyContext,
    ) => {
      return contextValue.dataSources.booksAPI.getAllBooks();
    },

    // Args typed from schema
    book: async (
      _parent: undefined,
      args: { id: string },
      contextValue: MyContext,
    ) => {
      const book = await contextValue.dataSources.booksAPI.getBook(args.id);
      if (!book) {
        throw new GraphQLError(`Book with id "${args.id}" not found`, {
          extensions: { code: "NOT_FOUND" },
        });
      }
      return book;
    },
  },

  // Field resolver: parent is the Book returned by Query.book
  Book: {
    author: async (
      parent: Book,
      _args: Record<string, never>,
      contextValue: MyContext,
    ) => {
      return contextValue.dataSources.authorsAPI.getAuthor(parent.authorId);
    },
  },

  // Field resolver: parent is the Author
  Author: {
    books: async (
      parent: Author,
      _args: Record<string, never>,
      contextValue: MyContext,
    ) => {
      return contextValue.dataSources.booksAPI.getBooksByAuthor(parent.id);
    },
  },

  Mutation: {
    addBook: async (
      _parent: undefined,
      args: { title: string; authorId: string },
      contextValue: MyContext,
    ) => {
      if (!contextValue.token) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      return contextValue.dataSources.booksAPI.addBook(
        args.title,
        args.authorId,
      );
    },
  },
};
```

**Why good:** parent type matches return type of parent resolver, data access delegated to data sources, auth check before mutation, `GraphQLError` with codes for client-facing errors

### Bad Example - Fat resolvers with direct data access

```typescript
const resolvers = {
  Query: {
    books: async () => {
      // BAD: direct DB call in resolver -- not testable, not reusable
      const result = await db.query("SELECT * FROM books");
      return result.rows;
    },
    book: async (_parent, args) => {
      const result = await db.query("SELECT * FROM books WHERE id = $1", [
        args.id,
      ]);
      if (!result.rows[0]) {
        // BAD: generic Error exposes stack trace
        throw new Error("Not found");
      }
      return result.rows[0];
    },
  },
};
```

**Why bad:** direct database calls make resolvers untestable and non-reusable, generic `Error` exposes internals to client, no context usage means no per-request isolation

---

## Pattern 4: Error Handling

### Good Example - Custom error codes and formatError

```typescript
import { GraphQLError } from "graphql";
import { ApolloServerErrorCode } from "@apollo/server/errors";
import { unwrapResolverError } from "@apollo/server/errors";

// Custom error codes for your domain
const ErrorCode = {
  NOT_FOUND: "NOT_FOUND",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
} as const;

// Reusable error factory
function notFoundError(resource: string, id: string): GraphQLError {
  return new GraphQLError(`${resource} with id "${id}" not found`, {
    extensions: {
      code: ErrorCode.NOT_FOUND,
      resource,
      id,
    },
  });
}

function authError(message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: ErrorCode.UNAUTHENTICATED },
  });
}

// formatError to sanitize errors before sending to clients
const server = new ApolloServer<MyContext>({
  typeDefs,
  resolvers,
  formatError: (formattedError, error) => {
    // Unwrap resolver errors to access the original error
    const originalError = unwrapResolverError(error);

    // Log internal errors for debugging
    if (
      formattedError.extensions?.code ===
      ApolloServerErrorCode.INTERNAL_SERVER_ERROR
    ) {
      console.error("Internal error:", originalError);
    }

    // Never send stack traces to clients in production
    // (Apollo Server already strips them when NODE_ENV=production)
    return {
      message: formattedError.message,
      extensions: {
        code: formattedError.extensions?.code,
      },
    };
  },
});
```

**Why good:** named error code constants, reusable error factories, `formatError` sanitizes internal details, `unwrapResolverError` accesses original error for logging

### Bad Example - Leaking internal details

```typescript
const resolvers = {
  Query: {
    user: async (_parent, args, contextValue) => {
      try {
        return await contextValue.dataSources.usersAPI.getUser(args.id);
      } catch (error) {
        // BAD: leaks database error message to client
        throw new Error(`Database query failed: ${error.message}`);
      }
    },
  },
};
```

**Why bad:** database error messages leak to clients, no error code for client-side handling, no structured extensions

---

## Pattern 5: Schema Organization

### Good Example - Modular schema with type composition

```typescript
// types/book.ts - Schema fragment for books
export const bookTypeDefs = `#graphql
  type Book {
    id: ID!
    title: String!
    publishedYear: Int!
    author: Author!
  }

  input CreateBookInput {
    title: String!
    publishedYear: Int!
    authorId: ID!
  }

  extend type Query {
    books(limit: Int, offset: Int): [Book!]!
    book(id: ID!): Book
  }

  extend type Mutation {
    createBook(input: CreateBookInput!): Book!
    deleteBook(id: ID!): Boolean!
  }
`;

// types/author.ts - Schema fragment for authors
export const authorTypeDefs = `#graphql
  type Author {
    id: ID!
    name: String!
    books: [Book!]!
  }

  extend type Query {
    authors: [Author!]!
    author(id: ID!): Author
  }
`;

// schema.ts - Root schema assembles fragments
const rootTypeDefs = `#graphql
  type Query
  type Mutation
`;

const server = new ApolloServer<MyContext>({
  // typeDefs accepts an array -- fragments are merged
  typeDefs: [rootTypeDefs, bookTypeDefs, authorTypeDefs],
  resolvers: [bookResolvers, authorResolvers],
});
```

**Why good:** each domain owns its schema fragment, `extend type` adds fields without modifying root types, `typeDefs` array merges fragments automatically, resolvers also merge from arrays

### Bad Example - Monolithic schema

```typescript
// BAD: 500+ line SDL in a single string
const typeDefs = `#graphql
  type Book { ... }
  type Author { ... }
  type Publisher { ... }
  type Review { ... }
  # ... 50 more types
  type Query {
    # ... 30 query fields
  }
  type Mutation {
    # ... 20 mutation fields
  }
`;
```

**Why bad:** single-file schema becomes unmaintainable, can't tell which team/module owns which types, merge conflicts in version control

---

## Pattern 6: Authentication in Context

### Good Example - Auth verification in context function

```typescript
interface MyContext {
  user: User | null;
  dataSources: { usersAPI: UsersAPI };
}

const server = new ApolloServer<MyContext>({ typeDefs, resolvers });

const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => {
    const token = req.headers.authorization?.replace("Bearer ", "");

    // Verify token and get user (null if invalid/missing)
    let user: User | null = null;
    if (token) {
      try {
        user = await verifyAndDecodeToken(token);
      } catch {
        // Invalid token -- user stays null, resolvers decide what to allow
      }
    }

    return {
      user,
      dataSources: {
        usersAPI: new UsersAPI({ cache: server.cache }),
      },
    };
  },
});

// In resolvers: check auth where needed
const resolvers = {
  Mutation: {
    deleteBook: async (
      _parent: undefined,
      args: { id: string },
      contextValue: MyContext,
    ) => {
      if (!contextValue.user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      if (contextValue.user.role !== "admin") {
        throw new GraphQLError("Admin access required", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      return contextValue.dataSources.booksAPI.deleteBook(args.id);
    },
  },
};
```

**Why good:** context function handles token verification once per request, resolvers check `contextValue.user` for auth, invalid tokens don't crash the context function, role-based authorization at the resolver level
