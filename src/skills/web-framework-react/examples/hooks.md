# React — Custom Hook Examples

> usePagination, useDebounce, useLocalStorage. See [SKILL.md](../SKILL.md) for the decisions and [reference.md](../reference.md) for the hook vs component decision tree.

**Additional Examples:**

- [core.md](core.md) — component shape, variant props, event handlers
- [react-19-hooks.md](react-19-hooks.md) — useActionState, useFormStatus, useOptimistic, use()

---

## usePagination

```typescript
import { useState, useMemo } from "react";

const DEFAULT_INITIAL_PAGE = 1;

interface UsePaginationProps {
  totalItems: number;
  itemsPerPage: number;
  initialPage?: number;
}

export function usePagination({
  totalItems,
  itemsPerPage,
  initialPage = DEFAULT_INITIAL_PAGE,
}: UsePaginationProps) {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const totalPages = useMemo(
    () => Math.ceil(totalItems / itemsPerPage),
    [totalItems, itemsPerPage],
  );

  const startIndex = useMemo(
    () => (currentPage - 1) * itemsPerPage,
    [currentPage, itemsPerPage],
  );

  const endIndex = useMemo(
    () => Math.min(startIndex + itemsPerPage, totalItems),
    [startIndex, itemsPerPage, totalItems],
  );

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    goToPage,
    goToNextPage: () => goToPage(currentPage + 1),
    goToPrevPage: () => goToPage(currentPage - 1),
    goToFirstPage: () => setCurrentPage(1),
    goToLastPage: () => setCurrentPage(totalPages),
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}
```

**Why good:** the hook returns index bounds rather than a sliced list, so the caller decides what to slice and the hook stays independent of the item type. `goToPage` clamps once and the directional helpers route through it, so the bound is enforced in one place.

---

## useDebounce

```typescript
import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
```

**Why good:** the cleanup cancels the pending timer on every keystroke, so only the last value in a burst is ever committed.

### Wiring — the effect keys on the debounced value

```typescript
const DEBOUNCE_DELAY_MS = 500;
const MIN_SEARCH_LENGTH = 1;

function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const debouncedSearchTerm = useDebounce(searchTerm, DEBOUNCE_DELAY_MS);

  useEffect(() => {
    if (debouncedSearchTerm.length >= MIN_SEARCH_LENGTH) {
      performSearch(debouncedSearchTerm).then(setResults);
    }
  }, [debouncedSearchTerm]);

  return (
    <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
  );
}
```

**Why good:** the input stays controlled by the raw value so typing feels immediate, while the effect depends on the debounced one and fires once per pause.

---

## useLocalStorage

```typescript
import { useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
}
```

**Why good:** the lazy initialiser reads storage once rather than on every render, the `window` guards keep it usable under server rendering, and the `catch` covers both unparseable stored JSON and a quota-exceeded write. `as const` makes the returned pair a tuple, so destructuring names both halves.
