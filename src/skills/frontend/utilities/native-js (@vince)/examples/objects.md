# Native JavaScript Object Examples

> Object manipulation patterns using native ES2022-ES2025 JavaScript. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pick (Select Properties)

### Good Example - Native Pick Implementation

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
  role: "admin" | "user";
}

// Type-safe pick function
function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  return Object.fromEntries(
    keys.filter((key) => key in obj).map((key) => [key, obj[key]])
  ) as Pick<T, K>;
}

const user: User = {
  id: "123",
  name: "John Doe",
  email: "john@example.com",
  password: "hashed_secret",
  createdAt: new Date(),
  role: "user",
};

// Pick only safe fields for API response
const publicUser = pick(user, ["id", "name", "email", "role"]);
// { id: "123", name: "John Doe", email: "john@example.com", role: "user" }
// TypeScript knows: Pick<User, "id" | "name" | "email" | "role">

// Pick for form initial values
const formDefaults = pick(user, ["name", "email"]);
// { name: "John Doe", email: "john@example.com" }

// Alternative: Destructuring for static keys (simpler when keys are known)
function getPublicUser(user: User) {
  const { id, name, email, role } = user;
  return { id, name, email, role };
}
```

**Why good:** type-safe with TypeScript, works with any object, filter handles missing keys

### Bad Example - Lodash Import

```typescript
import { pick } from "lodash"; // Adds ~3KB

const publicUser = pick(user, ["id", "name", "email", "role"]);
// Works but adds bundle weight for a simple operation
```

**Why bad:** lodash pick adds unnecessary bytes for something native does easily

---

## Omit (Exclude Properties)

### Good Example - Native Omit Implementation

```typescript
interface UserWithSecrets {
  id: string;
  name: string;
  email: string;
  password: string;
  apiKey: string;
  createdAt: Date;
}

// Type-safe omit function
function omit<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const keysSet = new Set<string | number | symbol>(keys);
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keysSet.has(key))
  ) as Omit<T, K>;
}

const userWithSecrets: UserWithSecrets = {
  id: "123",
  name: "John",
  email: "john@example.com",
  password: "secret123",
  apiKey: "api_key_xyz",
  createdAt: new Date(),
};

// Omit sensitive fields
const safeUser = omit(userWithSecrets, ["password", "apiKey"]);
// { id: "123", name: "John", email: "john@example.com", createdAt: Date }
// TypeScript knows: Omit<UserWithSecrets, "password" | "apiKey">

// Simpler for static keys: Destructuring with rest
function removeSensitive(user: UserWithSecrets) {
  const { password, apiKey, ...safe } = user;
  return safe;
}

const safeUser2 = removeSensitive(userWithSecrets);
// Same result, more concise for known keys
```

**Why good:** type-safe, Set lookup is O(1), destructuring is cleaner for static keys

---

## Map Keys and Values

### Good Example - Native Object Transformation

```typescript
// Map values - transform each value
function mapValues<T extends object, R>(
  obj: T,
  fn: (value: T[keyof T], key: keyof T) => R
): Record<keyof T, R> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key,
      fn(value as T[keyof T], key as keyof T),
    ])
  ) as Record<keyof T, R>;
}

const prices = {
  apple: 1.5,
  banana: 0.75,
  orange: 2.0,
};

const TAX_RATE = 0.1;
const DECIMAL_PLACES = 2;

const withTax = mapValues(prices, (price) =>
  Number((price * (1 + TAX_RATE)).toFixed(DECIMAL_PLACES))
);
// { apple: 1.65, banana: 0.83, orange: 2.2 }

// Map keys - transform each key
function mapKeys<T extends object>(
  obj: T,
  fn: (key: keyof T) => string
): Record<string, T[keyof T]> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [fn(key as keyof T), value])
  );
}

const data = {
  firstName: "John",
  lastName: "Doe",
};

const snakeCased = mapKeys(data, (key) =>
  String(key).replace(/([A-Z])/g, "_$1").toLowerCase()
);
// { first_name: "John", last_name: "Doe" }

// Prefix keys
const prefixed = mapKeys(data, (key) => `user_${String(key)}`);
// { user_firstName: "John", user_lastName: "Doe" }
```

**Why good:** functional approach, works with any object, composable transformations

---

## Object Merging

### Good Example - Shallow Merge with Spread

```typescript
interface Config {
  theme: "light" | "dark";
  fontSize: number;
  notifications: boolean;
  language: string;
}

const DEFAULT_CONFIG: Config = {
  theme: "light",
  fontSize: 14,
  notifications: true,
  language: "en",
};

// Shallow merge - spread operator
function mergeConfig(partial: Partial<Config>): Config {
  return { ...DEFAULT_CONFIG, ...partial };
}

const userConfig = mergeConfig({ theme: "dark", fontSize: 16 });
// { theme: "dark", fontSize: 16, notifications: true, language: "en" }

// Object.assign for mutable merge (when needed)
const target = { a: 1, b: 2 };
const source = { b: 3, c: 4 };
Object.assign(target, source);
// target is now { a: 1, b: 3, c: 4 }

// Multiple sources
const merged = { ...defaults, ...userSettings, ...overrides };
```

**Why good:** spread is clear and concise, Object.assign for explicit mutation cases

### Good Example - Deep Merge Implementation

```typescript
// Deep merge for nested objects (not arrays)
function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T {
  const result = { ...target };

  for (const source of sources) {
    if (!source) continue;

    for (const key of Object.keys(source) as (keyof T)[]) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue !== null &&
        typeof sourceValue === "object" &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === "object" &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(
          targetValue as object,
          sourceValue as object
        ) as T[keyof T];
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue as T[keyof T];
      }
    }
  }

  return result;
}

interface NestedConfig {
  ui: {
    theme: string;
    sidebar: {
      width: number;
      collapsed: boolean;
    };
  };
  features: {
    darkMode: boolean;
    notifications: boolean;
  };
}

const base: NestedConfig = {
  ui: {
    theme: "light",
    sidebar: {
      width: 250,
      collapsed: false,
    },
  },
  features: {
    darkMode: false,
    notifications: true,
  },
};

const overrides: Partial<NestedConfig> = {
  ui: {
    theme: "dark",
    sidebar: {
      width: 200,
      collapsed: false,
    },
  },
};

const merged = deepMerge(base, overrides);
// {
//   ui: { theme: "dark", sidebar: { width: 200, collapsed: false } },
//   features: { darkMode: false, notifications: true }
// }
```

**Why good:** handles nested objects, preserves non-overridden nested values, clear logic

---

## Object to Array Conversions

### Good Example - Object.entries, Object.keys, Object.values

```typescript
interface Scores {
  math: number;
  science: number;
  english: number;
  history: number;
}

const scores: Scores = {
  math: 95,
  science: 88,
  english: 92,
  history: 85,
};

// Get keys
const subjects = Object.keys(scores);
// ["math", "science", "english", "history"]

// Get values
const allScores = Object.values(scores);
// [95, 88, 92, 85]

// Get entries (key-value pairs)
const entries = Object.entries(scores);
// [["math", 95], ["science", 88], ["english", 92], ["history", 85]]

// Transform with entries
const BONUS_POINTS = 5;
const withBonus = Object.fromEntries(
  Object.entries(scores).map(([subject, score]) => [subject, score + BONUS_POINTS])
);
// { math: 100, science: 93, english: 97, history: 90 }

// Filter object by value
const PASSING_SCORE = 90;
const passing = Object.fromEntries(
  Object.entries(scores).filter(([, score]) => score >= PASSING_SCORE)
);
// { math: 95, english: 92 }

// Object to Map
const scoresMap = new Map(Object.entries(scores));
scoresMap.get("math"); // 95

// Map to Object
const backToObject = Object.fromEntries(scoresMap);

// URLSearchParams to Object
const params = new URLSearchParams("name=John&age=30&city=NYC");
const paramsObject = Object.fromEntries(params);
// { name: "John", age: "30", city: "NYC" }
```

**Why good:** Object.entries/fromEntries enable functional transformations, Map interop is easy

---

## Invert Object (Swap Keys and Values)

### Good Example - Native Invert

```typescript
// Invert simple object (values become keys)
function invert<T extends Record<string, string>>(
  obj: T
): Record<T[keyof T], keyof T> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [value, key])
  ) as Record<T[keyof T], keyof T>;
}

const statusCodes = {
  success: "200",
  notFound: "404",
  serverError: "500",
};

const codeToStatus = invert(statusCodes);
// { "200": "success", "404": "notFound", "500": "serverError" }

// Lookup by code
const status = codeToStatus["404"]; // "notFound"

// Practical: Bidirectional mapping
const keyMap = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const directionToKey = invert(keyMap);
// { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" }
```

**Why good:** simple one-liner with Object.entries/fromEntries, creates bidirectional lookup

---

## Check Object Emptiness

### Good Example - Native Empty Checks

```typescript
// Check if object is empty
function isEmpty(obj: object): boolean {
  return Object.keys(obj).length === 0;
}

// Check if object has own properties (not inherited)
function hasOwnProperties(obj: object): boolean {
  return Object.keys(obj).length > 0;
}

// Usage
const empty = {};
const notEmpty = { key: "value" };

console.log(isEmpty(empty));      // true
console.log(isEmpty(notEmpty));   // false

// Check for specific structure
interface FormErrors {
  [field: string]: string[];
}

function hasErrors(errors: FormErrors): boolean {
  return Object.values(errors).some((fieldErrors) => fieldErrors.length > 0);
}

const noErrors: FormErrors = { name: [], email: [] };
const withErrors: FormErrors = { name: ["Required"], email: [] };

console.log(hasErrors(noErrors));    // false
console.log(hasErrors(withErrors));  // true

// Count properties
function propertyCount(obj: object): number {
  return Object.keys(obj).length;
}
```

**Why good:** Object.keys is the standard way, works with any object

---

## Safe Object Access with Defaults

### Good Example - Object.hasOwn and Defaults

```typescript
// Object.hasOwn - safer than obj.hasOwnProperty
function safeGet<T extends object, K extends keyof T>(
  obj: T,
  key: K,
  defaultValue: T[K]
): T[K] {
  return Object.hasOwn(obj, key as string) ? obj[key] : defaultValue;
}

const config = {
  timeout: 5000,
  retries: 3,
};

const DEFAULT_TIMEOUT = 3000;
const DEFAULT_RETRIES = 1;

const timeout = safeGet(config, "timeout", DEFAULT_TIMEOUT); // 5000
// Note: For optional keys, use optional chaining instead

// Object.hasOwn is safer than hasOwnProperty
const obj = Object.create(null); // No prototype
obj.key = "value";

// obj.hasOwnProperty("key"); // TypeError: obj.hasOwnProperty is not a function
Object.hasOwn(obj, "key"); // true - works!

// Default object values with spread
interface Options {
  debug?: boolean;
  verbose?: boolean;
  timeout?: number;
}

const DEFAULT_OPTIONS: Required<Options> = {
  debug: false,
  verbose: false,
  timeout: 5000,
};

function processWithOptions(options: Options = {}) {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  // resolved has all properties guaranteed
  console.log(resolved.debug, resolved.timeout);
}
```

**Why good:** Object.hasOwn works on all objects (even null-prototype), spread with defaults is idiomatic

---

## Freeze and Seal

### Good Example - Immutable Objects

```typescript
// Object.freeze - no modifications allowed
const FROZEN_CONFIG = Object.freeze({
  apiUrl: "https://api.example.com",
  timeout: 5000,
  maxRetries: 3,
});

// FROZEN_CONFIG.timeout = 10000; // TypeError in strict mode, silently fails otherwise
// FROZEN_CONFIG.newProp = "value"; // TypeError in strict mode

// Deep freeze for nested objects
function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.keys(obj).forEach((key) => {
    const value = (obj as Record<string, unknown>)[key];
    if (value !== null && typeof value === "object") {
      deepFreeze(value as object);
    }
  });
  return Object.freeze(obj);
}

const DEEP_FROZEN = deepFreeze({
  level1: {
    level2: {
      value: "immutable",
    },
  },
});

// Object.seal - can modify existing properties, but not add/remove
const sealedUser = Object.seal({
  name: "John",
  age: 30,
});

sealedUser.name = "Jane"; // OK - can modify existing
// sealedUser.email = "jane@example.com"; // TypeError - can't add
// delete sealedUser.age; // TypeError - can't remove

// Check states
Object.isFrozen(FROZEN_CONFIG); // true
Object.isSealed(sealedUser); // true
Object.isExtensible(sealedUser); // false
```

**Why good:** Object.freeze/seal provide runtime immutability, deepFreeze handles nested objects

---

## Create Object from Array

### Good Example - Array to Object Transformations

```typescript
interface Item {
  id: string;
  name: string;
  price: number;
}

const items: Item[] = [
  { id: "1", name: "Apple", price: 1.5 },
  { id: "2", name: "Banana", price: 0.75 },
  { id: "3", name: "Orange", price: 2.0 },
];

// Array to object by key (lookup map)
function keyBy<T extends { id: string }>(
  array: T[],
  key: keyof T
): Record<string, T> {
  return Object.fromEntries(array.map((item) => [item[key], item]));
}

const itemsById = keyBy(items, "id");
// { "1": { id: "1", ... }, "2": { id: "2", ... }, "3": { id: "3", ... } }

// Quick lookup
const item = itemsById["2"]; // { id: "2", name: "Banana", price: 0.75 }

// Array to object with transformed values
function arrayToObject<T, R>(
  array: T[],
  keyFn: (item: T) => string,
  valueFn: (item: T) => R
): Record<string, R> {
  return Object.fromEntries(
    array.map((item) => [keyFn(item), valueFn(item)])
  );
}

const pricesById = arrayToObject(
  items,
  (item) => item.id,
  (item) => item.price
);
// { "1": 1.5, "2": 0.75, "3": 2.0 }

// Simple key-value array to object
const pairs: [string, number][] = [
  ["a", 1],
  ["b", 2],
  ["c", 3],
];
const fromPairs = Object.fromEntries(pairs);
// { a: 1, b: 2, c: 3 }
```

**Why good:** Object.fromEntries handles array-to-object conversion, keyBy pattern is common for lookups
