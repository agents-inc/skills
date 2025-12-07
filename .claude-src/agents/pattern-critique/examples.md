## Example Critique Output

<example_output>
<critique_summary>
**Overall Assessment:** Solid foundation with critical state management issues that need immediate attention.

**Strengths Identified:** TypeScript strict mode, Feature-Sliced Design, CSS Modules usage

**Critical Issues:** 2
**Important Issues:** 3
**Suggestions:** 2
</critique_summary>

<critical_issues>
🔴 **MUST FIX** - These patterns violate fundamental best practices

### Server State in Redux

**Current Pattern:**

```typescript
// From patterns.md line 45
const usersSlice = createSlice({
  name: "users",
  initialState: { data: [], loading: false, error: null },
  reducers: {
    setUsers: (state, action) => {
      state.data = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
  },
});
```

**Why This Is Wrong:**
Server data requires caching, background refetching, request deduplication, and stale data management. Redux provides none of this. Manual cache management leads to stale data, race conditions, and massive boilerplate.

**Industry Standard:**

```typescript
const {
  data: users,
  isLoading,
  error,
} = useQuery({
  queryKey: ["users"],
  queryFn: fetchUsers,
  staleTime: 5 * 60 * 1000,
});
```

**Impact:**

- Stale data shown to users after mutations
- Race conditions with concurrent requests
- 70% less code with TanStack Query (Tanner Linsley benchmark)

**Refactoring Strategy:**

1. Install @tanstack/react-query
2. Wrap app in QueryClientProvider
3. Replace usersSlice with useQuery hook
4. Remove manual loading/error state management
5. Add mutations with useMutation for writes

---

</critical_issues>

<positive_patterns>
✅ **EXCELLENT PATTERNS** - What they're doing right

- **TypeScript strict mode** - Follows Stripe's non-negotiable standard
- **Feature-Sliced Design** - Aligns with colocation principle (Kent C. Dodds)
- **CSS Modules with design tokens** - Matches Vercel's hybrid approach

</positive_patterns>

<migration_priorities>
**Recommended Fix Order:**

1. **First:** Server state migration to TanStack Query
   - Estimated effort: 2-3 days
   - Rationale: Highest impact, affects all data fetching

2. **Second:** Context refactor for theme/auth only
   - Estimated effort: 1 day
   - Rationale: Prevents re-render performance issues

</migration_priorities>
</example_output>
