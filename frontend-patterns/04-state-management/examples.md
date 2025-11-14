# 04. State Management - Examples

## 4.1 Server State vs Client State

### ❌ BAD: Server Data in Zustand

```typescript
const useUserStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
```

### ✅ GOOD: Server Data in React Query

```typescript
const useUser = (id) => {
  return useQuery({
    queryKey: ["users", id],
    queryFn: () => fetchUser(id),
  });
};
```

### ❌ BAD: UI State in React Query

```typescript
const useModalState = () => {
  return useQuery({
    queryKey: ["modal"],
    queryFn: () => ({ isOpen: false }),
  });
};
```

### ✅ GOOD: UI State in Zustand

```typescript
const useModalStore = create((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
```

## 4.2 React Query Patterns

### Query Key Factories (Hierarchical Structure)

```typescript
export const postsQueryKeys = {
  all: ["posts"] as const,
  lists: () => [...postsQueryKeys.all, "list"] as const,
  list: (filters: Filters) => [...postsQueryKeys.lists(), { filters }] as const,
  details: () => [...postsQueryKeys.all, "detail"] as const,
  detail: (id: number) => [...postsQueryKeys.details(), id] as const,
};
```

## 4.3 Zustand Patterns

### ❌ BAD: Without Shallow (Causes Unnecessary Re-renders)

```typescript
const { user, settings, theme } = useStore();
```

### ✅ GOOD: With Shallow

```typescript
import { shallow } from "zustand/shallow";
const { user, settings, theme } = useStore(
  (state) => ({
    user: state.user,
    settings: state.settings,
    theme: state.theme,
  }),
  shallow,
);
```

### ✅ ALTERNATIVE: Select Only What You Need

```typescript
const user = useStore((state) => state.user);
const theme = useStore((state) => state.theme);
```

## 4.4 Context API Usage

_Examples coming soon_

## 4.5 Cache Invalidation

_Examples coming soon_
