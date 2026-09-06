# Native JavaScript Object Examples

> Typed pick and omit, key/value transformation, merging, lookup maps and freezing. See
> [SKILL.md](../SKILL.md) for the decisions and [arrays.md](arrays.md) for collection operations.

Almost everything here is `Object.entries → map/filter → Object.fromEntries`. The work is in the
types, not the logic.

---

## Pick and Omit

For a fixed key list, destructuring says it in one line and needs no helper:

```typescript
const { id, name, email, role } = user; // pick
const { password, apiKey, ...safe } = user; // omit
```

A helper earns its place only when the keys are a runtime value. Both of these need one cast,
because `fromEntries` types its result as `Record<string, unknown>`:

```typescript
function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Pick<T, K> {
  return Object.fromEntries(
    keys.filter((key) => key in obj).map((key) => [key, obj[key]]),
  ) as Pick<T, K>;
}

function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Omit<T, K> {
  const excluded = new Set<PropertyKey>(keys);
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !excluded.has(key)),
  ) as Omit<T, K>;
}
```

`omit` is the safer of the two for anything leaving the process: it is subtractive, so a field added
to `T` later is excluded from a `pick` list and _included_ by `omit` unless someone updates it — which
is the direction you want when the list is "secrets".

---

## Mapping Keys and Values

```typescript
function mapValues<T extends object, R>(
  obj: T,
  fn: (value: T[keyof T], key: keyof T) => R,
): Record<keyof T, R> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      fn(value as T[keyof T], key as keyof T),
    ]),
  ) as Record<keyof T, R>;
}

function mapKeys<T extends object>(
  obj: T,
  fn: (key: keyof T) => string,
): Record<string, T[keyof T]> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [fn(key as keyof T), value]),
  );
}

const data = { firstName: "John", lastName: "Doe" };

const snakeCased = mapKeys(data, (key) =>
  String(key)
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase(),
);
// { first_name: "John", last_name: "Doe" }
```

`mapKeys` can collide — two source keys mapping to one target key leaves the last one. Where that
matters, build a `Map` instead and assert its `size`.

---

## Merging

```typescript
const config = { ...DEFAULTS, ...userSettings, ...overrides };
```

Spread is shallow, and that is the whole trap: a nested object in `userSettings` replaces the
default's nested object wholesale rather than merging into it. Where the shape is nested, recurse:

```typescript
function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T {
  const isPlainObject = (value: unknown): value is object =>
    typeof value === "object" && value !== null && !Array.isArray(value);

  return sources.reduce<T>(
    (result, source) => {
      for (const key of Object.keys(source) as (keyof T)[]) {
        const incoming = source[key];
        const existing = result[key];

        if (isPlainObject(incoming) && isPlainObject(existing)) {
          result[key] = deepMerge(
            existing,
            incoming as Partial<typeof existing>,
          );
        } else if (incoming !== undefined) {
          result[key] = incoming as T[keyof T];
        }
      }
      return result;
    },
    { ...target },
  );
}
```

Arrays are replaced, not concatenated — the deliberate choice, since "merging" two arrays has at
least three reasonable answers (replace, concatenate, merge by index) and the caller is the only
one who knows which. A dependency is the right call once you need more than one of them.

---

## Lookup Maps

```typescript
// Object keyed by a field — for string ids and JSON-shaped output
const byId = Object.fromEntries(items.map((item) => [item.id, item]));

// Map — for non-string keys, guaranteed insertion order, and a real .size
const mapById = new Map(items.map((item) => [item.id, item]));

// Projecting while indexing
const priceById = Object.fromEntries(
  items.map((item) => [item.id, item.price]),
);
```

`Object.fromEntries` also takes anything iterable of pairs, which covers `Map` and
`URLSearchParams` directly:

```typescript
Object.fromEntries(new URLSearchParams("name=John&city=NYC"));
// { name: "John", city: "NYC" } — repeated keys collapse to the last value
```

---

## Own-Property Checks

```typescript
Object.hasOwn(obj, "key"); // works on every object
obj.hasOwnProperty("key"); // throws on a null-prototype object
"key" in obj; // true for inherited keys too
```

`Object.create(null)` objects and the result of `Object.groupBy` both have no prototype, so
`Object.hasOwn` is the form that always works.

---

## Freezing

```typescript
const CONFIG = Object.freeze({ apiUrl: "…", timeout: 5000 });
CONFIG.timeout = 10_000; // throws in strict mode, silent no-op outside it

function deepFreeze<T extends object>(obj: T): Readonly<T> {
  for (const value of Object.values(obj)) {
    if (typeof value === "object" && value !== null) deepFreeze(value);
  }
  return Object.freeze(obj);
}
```

`Object.freeze` is shallow and runtime-only — TypeScript's `Readonly<T>` is compile-time-only, and
the two do not know about each other. `Object.seal` is the middle setting: existing properties stay
writable, adding and deleting do not.
