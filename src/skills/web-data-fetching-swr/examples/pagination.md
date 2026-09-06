# SWR — Pagination Examples

> `useSWRInfinite` for lists that accumulate, and `useSWR` for numbered pages. See
> [core.md](core.md) for keys and the fetcher.

---

## Cursor pagination

`getKey` is called with the page index and the previous page's data. Returning `null` is the only
signal that the list has ended.

```typescript
// components/infinite-post-list.tsx
import useSWRInfinite from "swr/infinite";
import { fetcher } from "../lib/fetcher";

interface Post {
  id: string;
  title: string;
  excerpt: string;
}

interface PostsResponse {
  posts: Post[];
  nextCursor: string | null;
}

const PAGE_SIZE = 20;

const getKey = (pageIndex: number, previousPageData: PostsResponse | null) => {
  if (previousPageData && !previousPageData.nextCursor) return null;
  if (pageIndex === 0) return `/api/posts?limit=${PAGE_SIZE}`;
  return `/api/posts?limit=${PAGE_SIZE}&cursor=${previousPageData?.nextCursor}`;
};

function InfinitePostList() {
  const { data, error, size, setSize, isLoading } = useSWRInfinite<PostsResponse>(getKey, fetcher);

  const posts = data?.flatMap((page) => page.posts) ?? [];
  const isEmpty = data?.[0]?.posts.length === 0;
  const isReachingEnd = data?.[data.length - 1]?.nextCursor === null;
  // a page that has been requested but not yet arrived is `undefined` in `data`
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === "undefined");

  if (isLoading) return <PostSkeleton count={PAGE_SIZE} />;
  if (error) return <Error message={error.message} />;
  if (isEmpty) return <EmptyState message="No posts found" />;

  return (
    <div>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <h3>{post.title}</h3>
            <p>{post.excerpt}</p>
          </li>
        ))}
      </ul>

      {!isReachingEnd && (
        <button onClick={() => setSize(size + 1)} disabled={isLoadingMore}>
          {isLoadingMore ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  );
}
```

`data` is an array of pages rather than of items, so combining takes `flatMap` — `map` returns an
array of arrays and renders nothing useful.

---

## Infinite scroll

The same hook with a sentinel element instead of a button.

```typescript
// components/infinite-scroll-list.tsx
import useSWRInfinite from "swr/infinite";
import { useCallback, useRef, useEffect } from "react";

interface Item {
  id: string;
  name: string;
}

interface ItemsResponse {
  items: Item[];
  hasMore: boolean;
}

const PAGE_SIZE = 20;
const INTERSECTION_THRESHOLD = 0.5;
const ROOT_MARGIN = "100px";

const getKey = (pageIndex: number, previousPageData: ItemsResponse | null) => {
  if (previousPageData && !previousPageData.hasMore) return null;
  return `/api/items?page=${pageIndex + 1}&limit=${PAGE_SIZE}`;
};

function InfiniteScrollList() {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const { data, size, setSize, isLoading, isValidating } = useSWRInfinite<ItemsResponse>(
    getKey,
    fetcher,
    // a focus event otherwise refetches page one, which is rarely what changed
    { revalidateFirstPage: false }
  );

  const items = data?.flatMap((page) => page.items) ?? [];
  const isReachingEnd = data?.[data.length - 1]?.hasMore === false;

  const loadMore = useCallback(() => {
    if (!isReachingEnd && !isValidating) setSize(size + 1);
  }, [isReachingEnd, isValidating, setSize, size]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: INTERSECTION_THRESHOLD, rootMargin: ROOT_MARGIN }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) observer.observe(currentRef);
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [loadMore]);

  if (isLoading) return <ItemSkeleton count={PAGE_SIZE} />;

  return (
    <div>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>

      <div ref={loadMoreRef}>
        {isValidating && <Spinner />}
        {isReachingEnd && items.length > 0 && <p>No more items</p>}
      </div>
    </div>
  );
}
```

`rootMargin` starts the fetch before the sentinel is on screen, so the next page usually arrives
before the user reaches the end of the current one.

---

## Numbered pages

A list the user pages through rather than accumulates is plain `useSWR` with the page in the key.

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

interface PaginatedResponse<T> {
  items: T[];
  currentPage: number;
  totalPages: number;
  total: number;
}

const PAGE_SIZE = 10;

function PaginatedUserList() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useSWR<PaginatedResponse<User>>(
    `/api/users?page=${page}&limit=${PAGE_SIZE}`,
    fetcher,
    // without this the table empties for a moment on every page change
    { keepPreviousData: true }
  );

  if (isLoading && !data) return <Skeleton />;
  if (error) return <Error message={error.message} />;
  if (!data?.items.length) return <EmptyState />;

  return (
    <div>
      <UserTable users={data.items} />
      <Pagination
        currentPage={data.currentPage}
        totalPages={data.totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
```

## Offset pagination that accumulates

`PaginatedResponse` and `Item` are the ones declared above.

```typescript
const getKey = (pageIndex: number) =>
  `/api/items?offset=${pageIndex * PAGE_SIZE}&limit=${PAGE_SIZE}`;

const { data, size, setSize } = useSWRInfinite<PaginatedResponse<Item>>(
  getKey,
  fetcher,
);

const items = data?.flatMap((page) => page.items) ?? [];
const total = data?.[0]?.total ?? 0;
const isReachingEnd = items.length >= total;
```

With no cursor to inspect, the end condition comes from the total instead — which is why this
`getKey` never returns `null` and the guard lives on the button.

---

## Resetting on a filter change

Filters belong in the key, so each combination caches separately. What they also need is a reset:
without it the new filter loads at whatever page count the previous one had reached.

```typescript
interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
}

interface ProductsResponse {
  products: Product[];
  hasMore: boolean;
}

function FilteredProductList() {
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState("name");

  const getKey = (pageIndex: number, previousPageData: ProductsResponse | null) => {
    if (previousPageData && !previousPageData.hasMore) return null;

    const params = new URLSearchParams({
      page: String(pageIndex + 1),
      limit: String(PAGE_SIZE),
      sortBy,
    });
    if (category) params.set("category", category);

    return `/api/products?${params}`;
  };

  const { data, size, setSize, isValidating } = useSWRInfinite<ProductsResponse>(getKey, fetcher, {
    revalidateFirstPage: false,
  });

  useEffect(() => {
    setSize(1);
  }, [category, sortBy, setSize]);

  const products = data?.flatMap((page) => page.products) ?? [];
  const isReachingEnd = data?.[data.length - 1]?.hasMore === false;

  return (
    <div>
      <ProductFilters
        category={category}
        sortBy={sortBy}
        onCategoryChange={setCategory}
        onSortChange={setSortBy}
      />
      <ProductList products={products} />
      {!isReachingEnd && (
        <button onClick={() => setSize(size + 1)} disabled={isValidating}>
          {isValidating ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  );
}
```

## Two directions from one point

A message list scrolling both ways is two `useSWRInfinite` hooks with opposite `getKey` functions,
joined at the render. One hook cannot serve both, because `size` counts in one direction only.

```typescript
interface Message {
  id: string;
  content: string;
  timestamp: string;
}

interface MessagesResponse {
  messages: Message[];
  hasPrevious: boolean;
  cursor: string;
}

const getKeyOlder = (pageIndex: number, previous: MessagesResponse | null) => {
  if (previous && !previous.hasPrevious) return null;
  if (pageIndex === 0)
    return `/api/channels/${channelId}/messages?limit=${PAGE_SIZE}`;
  return `/api/channels/${channelId}/messages?before=${previous?.cursor}&limit=${PAGE_SIZE}`;
};

const {
  data: olderPages,
  size,
  setSize,
} = useSWRInfinite<MessagesResponse>(getKeyOlder, fetcher);
const messages = olderPages?.flatMap((page) => page.messages) ?? [];
```

Cursors rather than offsets matter here: messages arriving while the user scrolls shift every
offset, and an offset-paged chat shows duplicates.
