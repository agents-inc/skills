# Vitest — What Not to Test

> Cases where a passing test buys nothing. Referenced from [SKILL.md](../SKILL.md). See
> [core.md](core.md) for the patterns that do.

---

## A dependency's own behaviour

```typescript
// Asserts that the library caches — which is the library's own test suite's job.
it("caches the second call", async () => {
  const cache = new LruCache({ max: 10 });
  cache.set("a", 1);
  expect(cache.get("a")).toBe(1);
});
```

```typescript
// Asserts what YOUR code does with the library.
it("looks a rate up once per currency", async () => {
  const fetchRate = vi.fn().mockResolvedValue(1.1);
  const convert = createConverter({ fetchRate });

  await convert(10, "EUR");
  await convert(20, "EUR");

  expect(fetchRate).toHaveBeenCalledOnce();
});
```

**Why the first is wasted:** it fails only when the dependency is upgraded, and then it reports a
break in a file that owns none of the behaviour.

---

## What the type system already refuses

```typescript
it("rejects a missing argument", () => {
  // @ts-expect-error
  expect(() => formatCurrency()).toThrow();
});
```

**Why it is wasted:** the call is a compile error, so the only way to reach the assertion is to
switch type checking off for that line. The test costs run time and asserts nothing about any code
path a caller can reach.

**The exception:** a boundary that genuinely receives unvalidated input — parsed JSON, argv,
a request body — where a runtime guard is real behaviour and worth a test.

---

## A private detail rather than the result

```typescript
// Pins the internal shape: renaming `items` reddens a test about totals.
it("stores items on the instance", () => {
  const cart = new Cart();
  cart.add({ price: 10, quantity: 1 });
  expect(cart.items).toHaveLength(1);
});
```

```typescript
// Pins the observable outcome.
it("includes the added item in the total", () => {
  const cart = new Cart();
  cart.add({ price: 10, quantity: 1 });
  expect(cart.total()).toBe(10);
});
```

**Why the first is worse:** it reddens on every refactor that preserves behaviour, which trains
everyone to update assertions without reading them.

---

## A test that is mostly mocks

Where the file under test needs four `vi.mock()` calls before it can run, the test is asserting that
the mocks were wired correctly. Move the assertion down to the pure function the module wraps, or up
to a level where the collaborators are real — see the boundary discussion in
[integration.md](integration.md).

---

## A snapshot of everything

`toMatchSnapshot()` over a large structure records the current behaviour, correct or not, and its
diffs are approved unread. Prefer `toMatchInlineSnapshot()` on a small value, or an explicit
`toStrictEqual` against the fields the test is actually about.
