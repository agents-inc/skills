# Apollo Server - Data Sources

> RESTDataSource, DataLoader, and caching patterns. See [SKILL.md](../SKILL.md) for concepts and [core.md](core.md) for server setup.

**Additional Examples:**

- [core.md](core.md) - Server setup, resolvers, context, error handling
- [advanced.md](advanced.md) - Subscriptions, federation, custom plugins

---

## Pattern 1: RESTDataSource

### Good Example - Typed REST API wrapper with caching

```typescript
import { RESTDataSource, type AugmentedRequest } from "@apollo/datasource-rest";
import type { KeyValueCache } from "@apollo/utils.keyvaluecache";

interface Movie {
  id: string;
  title: string;
  releaseYear: number;
}

interface MoviesResponse {
  results: Movie[];
  total: number;
}

const DEFAULT_PAGE_SIZE = 20;

class MoviesAPI extends RESTDataSource {
  override baseURL = "https://movies-api.example.com/v1/";

  // Add auth headers to all outgoing requests
  override willSendRequest(_path: string, request: AugmentedRequest) {
    request.headers.authorization = this.token;
  }

  private token: string;

  constructor(options: { cache: KeyValueCache; token: string }) {
    super(options); // passes cache to parent
    this.token = options.token;
  }

  // GET with query params
  async getMovies(
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Promise<MoviesResponse> {
    return this.get<MoviesResponse>("movies", {
      params: {
        page: page.toString(),
        page_size: pageSize.toString(),
      },
    });
  }

  // GET with dynamic path segment -- ALWAYS encode user input
  async getMovie(id: string): Promise<Movie> {
    return this.get<Movie>(`movies/${encodeURIComponent(id)}`);
  }

  // POST with JSON body
  async createMovie(input: {
    title: string;
    releaseYear: number;
  }): Promise<Movie> {
    return this.post<Movie>("movies", {
      body: input,
    });
  }

  // PUT replaces entire resource
  async updateMovie(id: string, input: Partial<Movie>): Promise<Movie> {
    return this.put<Movie>(`movies/${encodeURIComponent(id)}`, {
      body: input,
    });
  }

  // PATCH for partial updates
  async patchMovie(id: string, input: Partial<Movie>): Promise<Movie> {
    return this.patch<Movie>(`movies/${encodeURIComponent(id)}`, {
      body: input,
    });
  }

  // DELETE
  async deleteMovie(id: string): Promise<void> {
    await this.delete(`movies/${encodeURIComponent(id)}`);
  }
}
```

**Why good:** typed return values, `willSendRequest` adds auth to every request, `encodeURIComponent` prevents path traversal, cache passed through constructor, named constant for page size

### Bad Example - Missing security and no types

```typescript
class MoviesAPI extends RESTDataSource {
  override baseURL = "https://movies-api.example.com/v1/";

  // BAD: no encodeURIComponent -- path traversal vulnerability
  async getMovie(id: string) {
    return this.get(`movies/${id}`);
  }

  // BAD: no type parameter -- return type is unknown
  async getMovies() {
    return this.get("movies");
  }
}
```

**Why bad:** unencoded user input enables path traversal attacks, untyped responses require unsafe casts downstream

---

## Pattern 2: RESTDataSource Caching Control

### Good Example - Custom cache TTL and deduplication

```typescript
import { RESTDataSource } from "@apollo/datasource-rest";
import type { RequestDeduplicationPolicy } from "@apollo/datasource-rest";

const CACHE_TTL_SECONDS = 300; // 5 minutes

class CatalogAPI extends RESTDataSource {
  override baseURL = "https://catalog-api.example.com/";

  // Override HTTP cache TTL (ignores response cache-control headers)
  override cacheOptionsFor() {
    return { ttl: CACHE_TTL_SECONDS };
  }

  // Override cache key (default is method + URL)
  override cacheKeyFor(url: URL, request: RequestInit) {
    // Include auth header in cache key so different users get different results
    const auth =
      (request.headers as Record<string, string>)?.authorization ?? "anonymous";
    return `${request.method}:${url.toString()}:${auth}`;
  }

  // Control request deduplication behavior
  override requestDeduplicationPolicyFor(
    url: URL,
    request: RequestInit,
  ): RequestDeduplicationPolicy {
    if (request.method === "GET") {
      // Default: deduplicate concurrent GET requests
      return {
        policy: "deduplicate-during-request-lifetime",
        deduplicationKey: url.toString(),
      };
    }
    // Don't deduplicate mutations
    return { policy: "do-not-deduplicate" };
  }

  async getProductById(id: string): Promise<Product> {
    return this.get<Product>(`products/${encodeURIComponent(id)}`);
  }

  async getCategories(): Promise<Category[]> {
    return this.get<Category[]>("categories");
  }
}
```

**Why good:** explicit cache TTL, cache key includes auth for user-specific data, deduplication policy documented, named constant for TTL

---

## Pattern 3: DataLoader for N+1 Prevention

### Good Example - Batched loading in context

```typescript
import DataLoader from "dataloader";

// Batch function: receives array of keys, returns array of results in same order
async function batchUsers(ids: readonly string[]): Promise<(User | Error)[]> {
  // Single query fetches all requested users
  const users = await db.users.findMany({
    where: { id: { in: [...ids] } },
  });

  // Map results to match input order -- DataLoader requires 1:1 correspondence
  const userMap = new Map(users.map((u) => [u.id, u]));
  return ids.map((id) => userMap.get(id) ?? new Error(`User ${id} not found`));
}

// Context factory -- new DataLoader per request
interface MyContext {
  loaders: {
    userLoader: DataLoader<string, User>;
    postLoader: DataLoader<string, Post[]>;
  };
}

const server = new ApolloServer<MyContext>({ typeDefs, resolvers });

const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => ({
    loaders: {
      // CRITICAL: new instances per request -- DataLoader caches for request lifetime
      userLoader: new DataLoader<string, User>(batchUsers),
      postLoader: new DataLoader<string, Post[]>(batchPostsByAuthor),
    },
  }),
});

// In resolvers: use loader instead of direct calls
const resolvers = {
  Post: {
    author: async (
      parent: Post,
      _args: Record<string, never>,
      contextValue: MyContext,
    ) => {
      // If 50 posts reference 10 unique authors, this makes 1 batch call, not 50
      return contextValue.loaders.userLoader.load(parent.authorId);
    },
  },
  Author: {
    posts: async (
      parent: Author,
      _args: Record<string, never>,
      contextValue: MyContext,
    ) => {
      return contextValue.loaders.postLoader.load(parent.id);
    },
  },
};
```

**Why good:** batch function fetches all users in one query, result mapping preserves DataLoader's required order, new loaders per request prevent stale data, type parameters ensure key/value types match

### Bad Example - Direct calls causing N+1

```typescript
const resolvers = {
  Post: {
    // BAD: called once per post in the list -- N+1 queries
    author: async (parent, _args, contextValue) => {
      return contextValue.dataSources.usersAPI.getUser(parent.authorId);
    },
  },
};
// If query returns 50 posts, this makes 50 separate getUser calls
```

**Why bad:** each post triggers a separate database/API call, query with 50 posts makes 51 total calls (1 for posts + 50 for authors)

---

## Pattern 4: Combining RESTDataSource with DataLoader

### Good Example - DataLoader inside RESTDataSource

```typescript
import { RESTDataSource } from "@apollo/datasource-rest";
import DataLoader from "dataloader";

class UsersAPI extends RESTDataSource {
  override baseURL = "https://users-api.example.com/";

  // Private DataLoader as implementation detail
  private batchLoader = new DataLoader<string, User>(async (ids) => {
    // Single batch request for multiple IDs
    const users = await this.get<User[]>("users", {
      params: { ids: [...ids].join(",") },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return ids.map(
      (id) => userMap.get(id) ?? new Error(`User ${id} not found`),
    );
  });

  // Public API uses DataLoader internally
  async getUser(id: string): Promise<User> {
    return this.batchLoader.load(id);
  }

  // Non-batched operations bypass DataLoader
  async searchUsers(query: string): Promise<User[]> {
    return this.get<User[]>("users/search", {
      params: { q: query },
    });
  }
}
```

**Why good:** DataLoader is an internal optimization detail, callers use simple `getUser(id)` API, batch requests combine multiple IDs into one HTTP call, RESTDataSource's deduplication layer still applies

---

## Pattern 5: Database Data Source Pattern

### Good Example - Typed database data source

```typescript
// Custom data source class (no base class needed for databases)
class BooksDataSource {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  async getAll(limit: number, offset: number): Promise<Book[]> {
    return this.db.query<Book>(
      "SELECT * FROM books ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset],
    );
  }

  async getById(id: string): Promise<Book | null> {
    const [book] = await this.db.query<Book>(
      "SELECT * FROM books WHERE id = $1",
      [id],
    );
    return book ?? null;
  }

  async getByAuthorId(authorId: string): Promise<Book[]> {
    return this.db.query<Book>("SELECT * FROM books WHERE author_id = $1", [
      authorId,
    ]);
  }

  async create(input: { title: string; authorId: string }): Promise<Book> {
    const [book] = await this.db.query<Book>(
      "INSERT INTO books (title, author_id) VALUES ($1, $2) RETURNING *",
      [input.title, input.authorId],
    );
    return book;
  }
}

// In context function
const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => {
    const db = await getDbConnection();
    return {
      dataSources: {
        books: new BooksDataSource(db),
      },
    };
  },
});
```

**Why good:** data source encapsulates all SQL, resolver only calls `dataSources.books.getById(id)`, new instance per request with dedicated connection, typed return values
