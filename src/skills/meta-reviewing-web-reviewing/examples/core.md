# React Component Review - Core Examples

> Each pattern's defect and its fix, as they appear in a diff. The checks and the severities are in [../SKILL.md](../SKILL.md).

---

## Pattern 1: Rules of hooks and dependency arrays

```typescript
// Must Fix: `query` is read but not listed, so results freeze on the first value
useEffect(() => {
  search(query).then(setResults);
}, []);

// Fixed: re-runs when `query` changes, and ignores a response that arrives late
useEffect(() => {
  let ignore = false;
  search(query).then((results) => {
    if (!ignore) setResults(results);
  });
  return () => {
    ignore = true;
  };
}, [query]);
```

Listing `query` exposes a race the empty array hid: a slow response for an old query can land after a fast one for the new query. The ignore flag settles it.

```typescript
// Must Fix: the suppression hides `theme`, so the notice keeps the first render's theme
useEffect(() => {
  const connection = createConnection(roomId);
  connection.on("connected", () => showNotification("Connected", theme));
  connection.connect();
  return () => connection.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [roomId]);

// Fixed (React 19.2+): the notice reads the latest theme without reconnecting
const onConnected = useEffectEvent(() => showNotification("Connected", theme));

useEffect(() => {
  const connection = createConnection(roomId);
  connection.on("connected", onConnected);
  connection.connect();
  return () => connection.disconnect();
}, [roomId]);
```

Listing `theme` would also end the stale read, at the cost of reconnecting on every theme change — the reason the suppression got written. An Effect Event is the fix for a value that is read but should not trigger.

```typescript
// Must Fix: when `user` goes from null to set, this render calls one more hook than the last, and React throws
if (!user) return null;
const theme = useContext(ThemeContext);

// Allowed: use() may be called after an early return (React 19)
if (!user) return null;
const theme = use(ThemeContext);
```

---

## Pattern 2: Effect and ref cleanup

```typescript
// Must Fix: the interval outlives the component, and Strict Mode's extra setup starts a second one
useEffect(() => {
  setInterval(() => setNow(Date.now()), ONE_SECOND_MS);
}, []);

// Fixed: what the effect starts, its cleanup stops
useEffect(() => {
  const id = setInterval(() => setNow(Date.now()), ONE_SECOND_MS);
  return () => clearInterval(id);
}, []);
```

```tsx
// Must Fix: the observer keeps watching a node that has left the page
<div ref={(node) => { if (node) observer.observe(node); }} />

// Fixed (React 19): the ref callback returns its cleanup
<div
  ref={(node) => {
    if (!node) return;
    observer.observe(node);
    return () => observer.unobserve(node);
  }}
/>
```

---

## Pattern 3: Props and state

```typescript
// Should Fix: two sources of truth, one render apart
const [fullName, setFullName] = useState("");
useEffect(() => {
  setFullName(`${user.first} ${user.last}`);
}, [user.first, user.last]);

// Fixed: derived during render
const fullName = `${user.first} ${user.last}`;
```

A template literal is not a reason for `useMemo`; Pattern 4 says what is.

```tsx
// Should Fix: the previous user's draft shows for a render before the effect clears it
useEffect(() => {
  setDraft("");
}, [userId]);

// Fixed: a new key gives each user's editor its own state
<BioEditor key={userId} userId={userId} />;
```

---

## Pattern 4: Evidence before memoization

```typescript
// Should Fix: a measured 10k-row sort, re-run by every keystroke in an unrelated field
const sorted = [...rows].sort(byScore);

// Fixed: memoized because the cost is measured and its input is named
const sorted = useMemo(() => [...rows].sort(byScore), [rows]);
```

Measure before asking: wrap the work in `console.time` and run the slow interaction. React's docs suggest memoizing once the logged time reaches about 1ms.

```tsx
// Should Fix (compiler off): a new object every render, so the memoized chart re-renders anyway
<Chart options={{ stacked: true }} data={data} />

// Fixed: a reference that holds still between renders
<Chart options={STACKED_OPTIONS} data={data} />
```

```typescript
// Should Fix: a plain <button> compares nothing, so the wrapper adds a dependency array to keep correct and noise to read, for no measured gain
const handleOpen = useCallback(() => setOpen(true), []);
```

With React Compiler on, the first two Should Fix findings above disappear — the compiler memoizes the sort and the object — and the `useCallback` is redundant as well as unneeded.

---

## Pattern 5: List keys and component identity

```tsx
// Must Fix: filtering shifts indexes, so a row's checkbox sticks to the wrong todo
<ul>{visibleTodos.map((todo, i) => <TodoRow key={i} todo={todo} />)}</ul>

// Must Fix: a new key every render remounts every row and drops its input
<ul>{visibleTodos.map((todo) => <TodoRow key={crypto.randomUUID()} todo={todo} />)}</ul>

// Fixed: identity from the data survives filtering and reordering
<ul>{visibleTodos.map((todo) => <TodoRow key={todo.id} todo={todo} />)}</ul>
```

An ID generated once, when the item is created, and stored with it is fine — the defect is generating one during render.

```tsx
// Must Fix: SearchField is a new type every render, so its text resets each time
function Toolbar() {
  function SearchField() {
    const [text, setText] = useState("");
    return <input value={text} onChange={(e) => setText(e.target.value)} />;
  }

  return <SearchField />;
}

// Fixed: defined once, at module level
function SearchField() {
  const [text, setText] = useState("");
  return <input value={text} onChange={(e) => setText(e.target.value)} />;
}
```

---

## Pattern 6: Controlled inputs and form submission

```tsx
// Must Fix: value with no onChange renders a field nobody can type into
<input value={email} />

// Should Fix: undefined until the user loads, so the input switches from uncontrolled to controlled
<input value={user?.email} onChange={handleEmailChange} />

// Fixed: a string from the first render
<input value={email ?? ""} onChange={(e) => setEmail(e.target.value)} />
```

```typescript
// Must Fix: by the time `validate` resolves, the browser has already submitted
async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
  await validate();
  event.preventDefault();
}

// Fixed: cancel the default first, then do the async work
async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
  event.preventDefault();
  await save(new FormData(event.currentTarget));
}
```

A function passed to `<form action>` needs neither: React runs it in a transition and resets the form's uncontrolled fields when it succeeds (React 19).

---

## Pattern 7: Accessibility of what the diff adds

```tsx
// Must Fix: not focusable, not activated by Enter or Space, announced as nothing
<div className="icon-button" onClick={onDelete}>
  <TrashIcon />
</div>

// Fixed: the button brings focus, activation and a role; aria-label brings the name
<button type="button" aria-label="Delete item" onClick={onDelete}>
  <TrashIcon aria-hidden="true" />
</button>
```

```tsx
// Must Fix: nothing ties the label to the input, so it is announced by its type alone
<label>Email</label>
<input value={email} onChange={(e) => setEmail(e.target.value)} />

// Fixed: htmlFor and id make the association
<label htmlFor="email">Email</label>
<input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
```

```tsx
// Must Fix: rendered open, the dialog is non-modal — Tab reaches the page behind it and Escape does nothing
<dialog open={isOpen}>{children}</dialog>

// Fixed: opened with showModal(), the page behind is inert, Escape closes it and focus returns
// to the trigger; onClose keeps React's state in step when Escape closes it
<dialog ref={dialogRef} onClose={onClose} aria-labelledby="dialog-title">
  <h2 id="dialog-title">{title}</h2>
  {children}
</dialog>
```

Open it from the handler that opens it, with `dialogRef.current.showModal()`.
