# RxJS Interop Examples

> Converting between signals and observables in Angular 17+ standalone components. See [core.md](core.md) for signal basics.

---

## Pattern: toSignal and toObservable

### Good Example - Converting between signals and observables

```typescript
// search.component.ts
import { Component, signal, computed, inject } from "@angular/core";
import { toSignal, toObservable } from "@angular/core/rxjs-interop";
import { of } from "rxjs";
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  tap,
} from "rxjs/operators";
import { SearchService } from "./search.service";

const DEBOUNCE_MS = 300;

@Component({
  selector: "app-search",
  standalone: true,
  template: `
    <div class="search">
      <input
        type="text"
        [value]="query()"
        (input)="onQueryChange($event)"
        placeholder="Search..."
      />

      @if (isSearching()) {
        <div class="searching">Searching...</div>
      }

      @for (result of results(); track result.id) {
        <div class="result">{{ result.name }}</div>
      } @empty {
        @if (query() && !isSearching()) {
          <p>No results found</p>
        }
      }
    </div>
  `,
})
export class SearchComponent {
  private searchService = inject(SearchService);

  // Signal for query input
  query = signal("");
  isSearching = signal(false);

  // Convert signal to observable for RxJS operators
  private query$ = toObservable(this.query);

  // Debounced search results as signal
  results = toSignal(
    this.query$.pipe(
      debounceTime(DEBOUNCE_MS),
      distinctUntilChanged(),
      switchMap((query) => {
        // of([]) emits once; a bare [] emits nothing and leaves stale results
        if (!query) return of([]);
        this.isSearching.set(true);
        return this.searchService.search(query);
      }),
      tap(() => this.isSearching.set(false)),
    ),
    { initialValue: [] },
  );

  onQueryChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.query.set(target.value);
  }
}
```

**Why good:** `toObservable` hands the query to RxJS where `debounceTime` and `switchMap` live, `toSignal` hands the results back for template reactivity, and `initialValue` keeps the signal's type free of `undefined` so a read before the first emission cannot throw.

---

## RxJS Interop Reference

| Function                | Purpose                                                   |
| ----------------------- | --------------------------------------------------------- |
| `toSignal(obs$)`        | Convert Observable to Signal (requires injection context) |
| `toObservable(signal)`  | Convert Signal to Observable                              |
| `{ initialValue: X }`   | Required for synchronous signal initialization            |
| `{ requireSync: true }` | Error if observable doesn't emit synchronously            |

### When to use RxJS vs Signals

| Use Case                      | Approach                                  |
| ----------------------------- | ----------------------------------------- |
| Template binding              | Signals (automatic tracking)              |
| debounce, throttle, switchMap | RxJS operators via toObservable           |
| HTTP requests                 | Keep as Observable, convert with toSignal |
| Complex async flows           | RxJS, then convert final result to signal |
| Simple derived state          | computed() signal                         |
