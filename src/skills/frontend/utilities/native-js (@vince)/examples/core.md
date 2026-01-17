# Native JavaScript Core Examples

> Essential utility patterns using native ES2022-ES2025 JavaScript. See [SKILL.md](../SKILL.md) for core concepts.

---

## Safe Property Access

### Good Example - Optional Chaining with Defaults

```typescript
interface ApiResponse {
  data?: {
    user?: {
      profile?: {
        name?: string;
        email?: string;
        preferences?: {
          notifications?: boolean;
          theme?: "light" | "dark";
        };
      };
    };
    meta?: {
      page?: number;
      total?: number;
    };
  };
  error?: {
    code?: string;
    message?: string;
  };
}

// Default values as named constants
const DEFAULT_NAME = "Anonymous";
const DEFAULT_THEME = "light";
const DEFAULT_NOTIFICATIONS = true;
const DEFAULT_PAGE = 1;

function extractUserData(response: ApiResponse | null) {
  return {
    name: response?.data?.user?.profile?.name ?? DEFAULT_NAME,
    email: response?.data?.user?.profile?.email ?? null,
    theme: response?.data?.user?.profile?.preferences?.theme ?? DEFAULT_THEME,
    notifications: response?.data?.user?.profile?.preferences?.notifications ?? DEFAULT_NOTIFICATIONS,
    currentPage: response?.data?.meta?.page ?? DEFAULT_PAGE,
    errorMessage: response?.error?.message ?? null,
  };
}

// Method calls with optional chaining
interface Service {
  logger?: {
    log?: (msg: string) => void;
    error?: (msg: string) => void;
  };
}

function safeLog(service: Service | null, message: string): void {
  service?.logger?.log?.(message);
}

// Array element access
function getFirstItemName(data: ApiResponse | null): string | null {
  // Safe array access with optional chaining
  const items = data?.data?.user?.profile as { items?: { name: string }[] } | undefined;
  return items?.items?.[0]?.name ?? null;
}
```

**Why good:** handles all null/undefined cases without throwing, type-safe, zero runtime cost

### Bad Example - Manual Null Checking

```typescript
function extractUserDataManual(response: ApiResponse | null) {
  let name = "Anonymous";
  let theme = "light";

  if (response && response.data && response.data.user &&
      response.data.user.profile && response.data.user.profile.name) {
    name = response.data.user.profile.name;
  }

  if (response && response.data && response.data.user &&
      response.data.user.profile && response.data.user.profile.preferences &&
      response.data.user.profile.preferences.theme) {
    theme = response.data.user.profile.preferences.theme;
  }

  return { name, theme };
}
```

**Why bad:** verbose, repetitive, easy to miss a null check, hard to maintain

---

## Deep Cloning

### Good Example - structuredClone for Complex Objects

```typescript
interface FormState {
  values: {
    personal: {
      name: string;
      email: string;
      birthDate: Date;
    };
    preferences: Map<string, boolean>;
    selectedOptions: Set<string>;
  };
  errors: Map<string, string[]>;
  history: {
    timestamp: Date;
    action: string;
  }[];
}

const initialState: FormState = {
  values: {
    personal: {
      name: "John",
      email: "john@example.com",
      birthDate: new Date("1990-01-15"),
    },
    preferences: new Map([
      ["newsletter", true],
      ["notifications", false],
    ]),
    selectedOptions: new Set(["option1", "option2"]),
  },
  errors: new Map(),
  history: [
    { timestamp: new Date(), action: "initialized" },
  ],
};

// Deep clone preserves all types
function resetForm(state: FormState): FormState {
  const cloned = structuredClone(state);

  // Modify cloned state
  cloned.values.personal.name = "";
  cloned.values.personal.email = "";
  cloned.errors.clear();
  cloned.history.push({ timestamp: new Date(), action: "reset" });

  return cloned;
}

// Original is completely unaffected
const resetState = resetForm(initialState);
console.log(initialState.values.personal.name); // "John" - unchanged
console.log(initialState.history.length); // 1 - unchanged

// Clone for undo functionality
function saveSnapshot(state: FormState): FormState {
  return structuredClone(state);
}

const snapshots: FormState[] = [];
snapshots.push(saveSnapshot(initialState));
```

**Why good:** preserves Date, Map, Set types correctly, handles nested objects, true deep copy

### Bad Example - JSON Round-Trip

```typescript
// This BREAKS with Date, Map, Set, undefined, functions
const badClone = JSON.parse(JSON.stringify(initialState));

// badClone.values.personal.birthDate is now a STRING, not Date
// badClone.values.preferences is now {} empty object
// badClone.values.selectedOptions is now {} empty object
// badClone.errors is now {} empty object

// This fails at runtime
badClone.values.preferences.get("newsletter"); // TypeError: .get is not a function
badClone.values.personal.birthDate.getTime(); // TypeError: .getTime is not a function
```

**Why bad:** JSON cannot serialize Date, Map, Set, undefined, functions - data is corrupted

---

## Immutable Array Updates

### Good Example - ES2023 Methods for React State

```typescript
interface Todo {
  id: string;
  text: string;
  completed: boolean;
  priority: number;
}

// Simulating React state
let todos: Todo[] = [
  { id: "1", text: "Learn TypeScript", completed: true, priority: 2 },
  { id: "2", text: "Build app", completed: false, priority: 1 },
  { id: "3", text: "Deploy", completed: false, priority: 3 },
];

// Sort without mutating - toSorted
function sortByPriority(items: Todo[]): Todo[] {
  return items.toSorted((a, b) => a.priority - b.priority);
}

// Reverse without mutating - toReversed
function reverseOrder(items: Todo[]): Todo[] {
  return items.toReversed();
}

// Update single item - with
function toggleComplete(items: Todo[], index: number): Todo[] {
  const item = items[index];
  return items.with(index, { ...item, completed: !item.completed });
}

// Remove item - toSpliced
const DELETE_COUNT = 1;
function removeAt(items: Todo[], index: number): Todo[] {
  return items.toSpliced(index, DELETE_COUNT);
}

// Insert item - toSpliced with 0 delete count
const INSERT_DELETE_COUNT = 0;
function insertAt(items: Todo[], index: number, newItem: Todo): Todo[] {
  return items.toSpliced(index, INSERT_DELETE_COUNT, newItem);
}

// Usage - original never changes
const sorted = sortByPriority(todos);
const withToggle = toggleComplete(todos, 0);
const withRemoval = removeAt(todos, 1);

console.log(todos[0].completed); // true - unchanged
console.log(sorted === todos); // false - new array
```

**Why good:** immutable operations work with React state updates, original preserved for diffing

### Bad Example - Mutating Methods

```typescript
// These ALL mutate the original array
function sortByPriorityBad(items: Todo[]): Todo[] {
  return items.sort((a, b) => a.priority - b.priority);
  // items is now sorted - mutation!
}

function reverseOrderBad(items: Todo[]): Todo[] {
  return items.reverse();
  // items is now reversed - mutation!
}

function toggleCompleteBad(items: Todo[], index: number): Todo[] {
  items[index].completed = !items[index].completed;
  return items;
  // Direct mutation - React won't detect this change!
}

function removeAtBad(items: Todo[], index: number): Todo[] {
  items.splice(index, 1);
  return items;
  // items is mutated - same reference returned
}
```

**Why bad:** mutations cause React to miss updates, shared references cause bugs across components

---

## Negative Indexing

### Good Example - at() for Clean Access

```typescript
const RECENT_ITEMS_COUNT = 5;

interface Notification {
  id: string;
  message: string;
  read: boolean;
}

const notifications: Notification[] = [
  { id: "1", message: "Welcome!", read: true },
  { id: "2", message: "New feature available", read: true },
  { id: "3", message: "Update required", read: false },
  { id: "4", message: "Security alert", read: false },
  { id: "5", message: "Subscription expiring", read: false },
];

// Get last notification
const latest = notifications.at(-1);
// { id: "5", message: "Subscription expiring", read: false }

// Get second to last
const previous = notifications.at(-2);
// { id: "4", message: "Security alert", read: false }

// Get last N unread notifications
function getLastUnread(items: Notification[], count: number): Notification[] {
  const unread = items.filter((n) => !n.read);
  const result: Notification[] = [];

  for (let i = 1; i <= Math.min(count, unread.length); i++) {
    const item = unread.at(-i);
    if (item) {
      result.unshift(item);
    }
  }

  return result;
}

const lastTwoUnread = getLastUnread(notifications, 2);

// Works with strings
const filename = "document.backup.txt";
const extension = filename.split(".").at(-1); // "txt"

// Safe - returns undefined for out of bounds
const outOfBounds = notifications.at(-100); // undefined, not error
```

**Why good:** clean syntax for end access, bounds-safe (returns undefined), works with strings

### Bad Example - Manual Length Calculation

```typescript
// Verbose and error-prone
const latest = notifications[notifications.length - 1];
const previous = notifications[notifications.length - 2];

// Easy to make off-by-one errors
function getLastN(items: Notification[], n: number): Notification[] {
  return items.slice(items.length - n); // Works but verbose
}

// Not bounds-safe - can return undefined without type knowing
const item = notifications[notifications.length - 100];
// TypeScript thinks this is Notification, but it's undefined!
```

**Why bad:** repetitive length calculations, off-by-one errors common, type safety issues

---

## Finding from End

### Good Example - findLast and findLastIndex

```typescript
interface Transaction {
  id: string;
  type: "credit" | "debit";
  amount: number;
  date: Date;
  status: "pending" | "completed" | "failed";
}

const transactions: Transaction[] = [
  { id: "1", type: "credit", amount: 100, date: new Date("2026-01-01"), status: "completed" },
  { id: "2", type: "debit", amount: 50, date: new Date("2026-01-02"), status: "completed" },
  { id: "3", type: "credit", amount: 200, date: new Date("2026-01-03"), status: "failed" },
  { id: "4", type: "debit", amount: 75, date: new Date("2026-01-04"), status: "pending" },
  { id: "5", type: "credit", amount: 150, date: new Date("2026-01-05"), status: "completed" },
];

// Find most recent completed credit
const lastCompletedCredit = transactions.findLast(
  (t) => t.type === "credit" && t.status === "completed"
);
// { id: "5", type: "credit", amount: 150, ... }

// Find index of last failed transaction
const lastFailedIndex = transactions.findLastIndex(
  (t) => t.status === "failed"
);
// 2

// Find last transaction before a failed one
function getLastSuccessBeforeFailure(items: Transaction[]): Transaction | undefined {
  const failedIndex = items.findLastIndex((t) => t.status === "failed");
  if (failedIndex === -1) return undefined;

  return items.findLast(
    (t, index) => t.status === "completed" && index < failedIndex
  );
}

// Useful for logs - find last error
interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
}

function getLastError(logs: LogEntry[]): LogEntry | undefined {
  return logs.findLast((log) => log.level === "error");
}
```

**Why good:** single pass from end, no array reversal needed, matches familiar find/findIndex API

### Bad Example - Reverse and Find

```typescript
// Wasteful - creates a copy just to search from end
const lastCompletedCredit = [...transactions]
  .reverse()
  .find((t) => t.type === "credit" && t.status === "completed");

// Manual loop - verbose
function findLastCompletedCredit(items: Transaction[]): Transaction | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    const t = items[i];
    if (t.type === "credit" && t.status === "completed") {
      return t;
    }
  }
  return undefined;
}
```

**Why bad:** reverse creates unnecessary copy (O(n) memory), manual loops are verbose and error-prone
