# Web Reviewing - Core Examples

> Good/bad component patterns to look for during web code reviews. See [../SKILL.md](../SKILL.md) for checklists and the severity framework.

---

## Stale Closure vs Complete Dependencies

```typescript
// Must Fix: `query` is read but not declared - results freeze on the first value
useEffect(() => {
  search(query).then(setResults);
}, []);

// Good: effect re-runs when its input changes, and aborts stale requests
useEffect(() => {
  const controller = new AbortController();
  search(query, { signal: controller.signal }).then(setResults);
  return () => controller.abort();
}, [query]);
```

The abort in cleanup solves two review findings at once: the stale closure and the race where a slow early response overwrites a fast later one.

---

## Effect Cleanup Symmetry

```typescript
// Must Fix: interval survives unmount; setState fires on a dead component
useEffect(() => {
  setInterval(() => setNow(Date.now()), 1000);
}, []);

// Good: what the effect starts, its cleanup stops
useEffect(() => {
  const id = setInterval(() => setNow(Date.now()), 1000);
  return () => clearInterval(id);
}, []);
```

---

## Derived Value vs Mirrored State

```typescript
// Should Fix: two sources of truth, synced by an effect - drifts and double-renders
const [fullName, setFullName] = useState("");
useEffect(() => {
  setFullName(`${user.first} ${user.last}`);
}, [user.first, user.last]);

// Good: derive during render - one source of truth, no effect
const fullName = `${user.first} ${user.last}`;
```

Reserve `useMemo` for the rare derivation that is demonstrably expensive; a template literal is not one.

---

## Evidence-Based Memoization

```typescript
// Should Fix: 10k-row sort re-runs on every keystroke of an unrelated field
const sorted = [...rows].sort(byScore);

// Good: memoized because the cost is real and its inputs are named
const sorted = useMemo(() => [...rows].sort(byScore), [rows]);
```

```typescript
// Don't Mention: wrapping a cheap handler in useCallback for a plain <button>
const onClick = useCallback(() => setOpen(true), []);
```

The second example is the inverse finding: speculative wrapping adds a dependency array to maintain and no measurable win. Flagging its absence would be a review failure too.

---

## List Keys Under Reordering

```tsx
// Must Fix: filtering shifts indexes - row state (checkbox, input) sticks to the wrong item
{
  visibleTodos.map((todo, i) => <TodoRow key={i} todo={todo} />);
}

// Good: identity survives filtering and reordering
{
  visibleTodos.map((todo) => <TodoRow key={todo.id} todo={todo} />);
}
```

---

## Keyboard-Operable Interactive Elements

```tsx
// Must Fix: not focusable, not activatable by keyboard, no accessible name
<div className="icon-button" onClick={onDelete}>
  <TrashIcon />
</div>

// Good: button semantics deliver focus, Enter/Space activation, and a name
<button type="button" aria-label="Delete item" onClick={onDelete}>
  <TrashIcon />
</button>
```

```tsx
// Must Fix: input with no association - screen readers announce nothing
<label>Email</label>
<input value={email} onChange={(e) => setEmail(e.target.value)} />

// Good: explicit association
<label htmlFor="email">Email</label>
<input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
```
