# Testing - Anti-Patterns

> What NOT to test. Reference from [SKILL.md](../SKILL.md).

---

## Don't Test Third-Party Libraries

```typescript
// Bad Example - Testing data fetching library behavior
test("data fetching hook returns data", () => {
  const { result } = renderHook(() => useDataFetchingHook(["key"], fetchFn));
  // Testing the library, not your code
});
```

```typescript
// Good Example - Test YOUR behavior
test('displays user data when loaded', async () => {
  render(<UserProfile />);
  expect(await screen.findByText('John Doe')).toBeInTheDocument();
});
```

**Why bad (first example):** Testing library code wastes time, library already has tests, doesn't verify your application logic

**Why good (second example):** Tests your component's behavior with the library, verifies actual user-facing outcome, focuses on application logic not library internals

---

## Don't Test TypeScript Guarantees

```typescript
// Bad Example - TypeScript already prevents this
test('Button requires children prop', () => {
  // @ts-expect-error
  render(<Button />);
});
```

**Why bad:** TypeScript already enforces this at compile time, test adds no value, wastes execution time

---

## Don't Test Implementation Details

```typescript
// Bad Example - Testing internal state
test("counter state increments", () => {
  const { result } = renderHook(() => useCounter());
  expect(result.current.count).toBe(1); // Internal detail
});
```

```typescript
// Good Example - Test observable behavior
test('displays incremented count', () => {
  render(<Counter />);
  fireEvent.click(screen.getByRole('button', { name: /increment/i }));
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

**Why bad (first example):** Testing internal state breaks when refactoring, not testing what users see, fragile and coupled to implementation

**Why good (second example):** Tests what users observe and interact with, resilient to refactoring, verifies actual behavior not implementation

---

_For more patterns, see:_

- [core.md](core.md) - E2E and Unit testing essentials
- [integration.md](integration.md) - Integration tests with network mocking
- [ladle-stories.md](ladle-stories.md) - Component documentation stories
