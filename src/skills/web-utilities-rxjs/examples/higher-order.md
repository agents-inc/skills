# RxJS Higher-Order Mapping Examples

> switchMap, mergeMap, concatMap, exhaustMap patterns. See [core.md](core.md) for basics.

**Prerequisites**: Understand Observable creation and pipe operators from core examples first.

---

## switchMap - Cancel Previous

Use when only the latest inner Observable matters. Previous inner subscriptions are cancelled.

### Good Example - Type-Ahead Search

```typescript
import { fromEvent } from "rxjs";
import {
  switchMap,
  debounceTime,
  distinctUntilChanged,
  map,
  filter,
  catchError,
} from "rxjs/operators";
import { from, of } from "rxjs";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

const searchResults$ = fromEvent<InputEvent>(searchInput, "input").pipe(
  map((e) => (e.target as HTMLInputElement).value.trim()),
  debounceTime(DEBOUNCE_MS),
  distinctUntilChanged(),
  filter((query) => query.length >= MIN_QUERY_LENGTH),
  switchMap((query) =>
    from(
      fetch(`/api/search?q=${encodeURIComponent(query)}`).then((r) => r.json()),
    ).pipe(catchError(() => of({ results: [] }))),
  ),
);
```

**Why good:** `switchMap` cancels the previous HTTP request when the user types a new character, preventing stale results from overwriting fresh ones

### Bad Example - mergeMap for Search

```typescript
// BAD: mergeMap doesn't cancel previous requests
const searchResults$ = searchInput$.pipe(
  mergeMap((query) => from(fetch(`/api/search?q=${query}`))),
);
// User types "a", then "ab" -- both requests run in parallel
// If "a" response returns AFTER "ab", stale results overwrite correct ones
```

**Why bad:** `mergeMap` runs all requests in parallel, race conditions cause stale data to appear

---

## mergeMap - Parallel Processing

Use when all inner Observables should run concurrently.

### Good Example - Parallel File Uploads with Concurrency Limit

```typescript
import { from } from "rxjs";
import { mergeMap, map, catchError, toArray } from "rxjs/operators";

const MAX_CONCURRENT_UPLOADS = 3;

interface UploadResult {
  fileName: string;
  success: boolean;
  url?: string;
  error?: string;
}

const uploadResults$ = from(selectedFiles).pipe(
  mergeMap(
    (file) =>
      from(uploadToServer(file)).pipe(
        map(
          (response): UploadResult => ({
            fileName: file.name,
            success: true,
            url: response.url,
          }),
        ),
        catchError(
          (error): Observable<UploadResult> =>
            of({
              fileName: file.name,
              success: false,
              error: error.message,
            }),
        ),
      ),
    MAX_CONCURRENT_UPLOADS, // second argument: concurrency limit
  ),
  toArray(), // collect all results when all uploads complete
);
```

**Why good:** concurrency limit prevents overwhelming the server, per-file `catchError` ensures one failure doesn't abort all uploads, `toArray` collects final results

---

## concatMap - Sequential Processing

Use when order matters and each operation must complete before the next starts.

### Good Example - Sequential API Calls

```typescript
import { from, of } from "rxjs";
import { concatMap, delay, tap } from "rxjs/operators";

interface Step {
  name: string;
  execute: () => Promise<void>;
}

const steps: Step[] = [
  { name: "validate", execute: () => validateData() },
  { name: "transform", execute: () => transformData() },
  { name: "save", execute: () => saveData() },
  { name: "notify", execute: () => sendNotification() },
];

// Process steps one at a time, in order
const pipeline$ = from(steps).pipe(
  concatMap((step) =>
    from(step.execute()).pipe(
      tap(() => console.log(`Completed: ${step.name}`)),
    ),
  ),
);
```

**Why good:** `concatMap` ensures each step completes before the next begins, maintains execution order

---

## exhaustMap - Ignore While Busy

Use when new requests should be ignored while one is in progress.

### Good Example - Form Submission / Login Button

```typescript
import { fromEvent, from } from "rxjs";
import { exhaustMap, tap, finalize, catchError, of } from "rxjs";

const submitButton = document.getElementById("submit");

const submission$ = fromEvent(submitButton!, "click").pipe(
  tap(() => {
    submitButton!.setAttribute("disabled", "true");
  }),
  exhaustMap(() =>
    from(submitForm(formData)).pipe(
      catchError((error) => {
        console.error("Submission failed:", error);
        return of({ success: false, error });
      }),
      finalize(() => {
        submitButton!.removeAttribute("disabled");
      }),
    ),
  ),
);
```

**Why good:** `exhaustMap` prevents double-submission -- rapid clicks are ignored while the first request is in flight

---

## Decision Framework

```
Need to make an async call for each emission?
│
├── Should previous call be cancelled?
│   └── YES → switchMap (search, route navigation, autocomplete)
│
├── Should all calls run in parallel?
│   └── YES → mergeMap (file uploads, batch operations, logging)
│          └── Need concurrency limit? Pass second arg: mergeMap(fn, 3)
│
├── Must calls execute one at a time in order?
│   └── YES → concatMap (sequential saves, ordered operations, queues)
│
└── Should new emissions be ignored while busy?
    └── YES → exhaustMap (form submit, login, refresh button)
```
