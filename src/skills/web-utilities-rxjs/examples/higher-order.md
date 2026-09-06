# RxJS Higher-Order Mapping Examples

> `switchMap`, `mergeMap`, `concatMap` and `exhaustMap` worked through. See [SKILL.md](../SKILL.md)
> for the choice between them and [core.md](core.md) for creation and error recovery.

All four subscribe to an inner Observable per outer value. They differ only in what happens when a
new outer value arrives while an inner one is still running.

---

## switchMap — cancel the previous

```typescript
import {
  fromEvent,
  from,
  of,
  map,
  debounceTime,
  distinctUntilChanged,
  filter,
  switchMap,
  catchError,
} from "rxjs";

const searchResults$ = fromEvent<InputEvent>(searchInput, "input").pipe(
  map((event) => (event.target as HTMLInputElement).value.trim()),
  debounceTime(300),
  distinctUntilChanged(),
  filter((query) => query.length >= 2),
  switchMap((query) =>
    from(
      fetch(`/api/search?q=${encodeURIComponent(query)}`).then((r) => r.json()),
    ).pipe(catchError(() => of({ results: [] }))),
  ),
);
```

`mergeMap` here is a race: typing `a` then `ab` issues both requests, and if `a` returns second its
results overwrite the correct ones. The bug appears only under latency, which is why it reaches
production.

`switchMap` cancels by unsubscribing, so an inner Observable that ignores unsubscription — a bare
promise, for instance — keeps running even though its result is discarded. Only an inner source
that honours teardown is genuinely cancelled.

---

## mergeMap — run in parallel

```typescript
import { from, of, mergeMap, map, catchError, toArray } from "rxjs";

interface UploadResult {
  fileName: string;
  success: boolean;
  url?: string;
}

const uploads$ = from(selectedFiles).pipe(
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
        // Per-file recovery: one failure must not abandon the rest
        catchError(() => of({ fileName: file.name, success: false })),
      ),
    3, // concurrency limit
  ),
  toArray(),
);
```

Two details carry this pattern. The concurrency limit is the second argument and defaults to
`Infinity`, so without it a thousand files open a thousand connections. And the `catchError` is
inside the inner pipe: outside it, the first failed upload would end the whole stream and
`toArray` would never emit.

Output order follows completion, not input order — attach the identity to the result, as
`fileName` does above, rather than relying on position.

---

## concatMap — queue, in order

```typescript
import { from, concatMap, tap } from "rxjs";

interface Step {
  name: string;
  execute: () => Promise<void>;
}

const steps: Step[] = [
  { name: "validate", execute: () => validateData() },
  { name: "transform", execute: () => transformData() },
  { name: "save", execute: () => saveData() },
];

const pipeline$ = from(steps).pipe(
  concatMap((step) =>
    from(step.execute()).pipe(tap(() => console.log(`done: ${step.name}`))),
  ),
);
```

Each inner Observable must complete before the next begins, so `concatMap` over a source that
emits faster than the inner work completes builds an unbounded queue. That is the trade against
`mergeMap`: order for backpressure.

---

## exhaustMap — ignore while busy

```typescript
import {
  fromEvent,
  from,
  of,
  exhaustMap,
  tap,
  catchError,
  finalize,
} from "rxjs";

const submission$ = fromEvent(submitButton, "click").pipe(
  tap(() => submitButton.setAttribute("disabled", "true")),
  exhaustMap(() =>
    from(submitForm(formData)).pipe(
      catchError((error) => of({ success: false, error })),
      finalize(() => submitButton.removeAttribute("disabled")),
    ),
  ),
);
```

Clicks arriving during the request are dropped, not queued — which is the point for a submit
button and wrong for anything the user expects to be honoured. The `disabled` attribute makes the
behaviour visible; `exhaustMap` is what makes it correct even when the attribute is bypassed.
