# VueUse Reference

> The composable index, the server-rendering table, gotchas and deprecations. See
> [SKILL.md](SKILL.md) for the decisions and red flags, and [examples/](examples/) for full code.

Everything below is exported from `@vueuse/core`. `@vueuse/integrations` carries the wrappers around
third-party libraries and is a separate install.

---

## Composable Index

| Need                                | Reach for                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| Persist across reloads              | `useLocalStorage`, `useSessionStorage`                                                              |
| Share between components            | `createGlobalState`                                                                                 |
| Read a system preference            | `usePreferredDark`, `usePreferredColorScheme`, `usePreferredLanguages`, `usePreferredReducedMotion` |
| Dark mode with an override          | `useDark` plus `useToggle`                                                                          |
| Respond to a breakpoint             | `useMediaQuery`                                                                                     |
| Copy, share, or read the clipboard  | `useClipboard`, `useShare`                                                                          |
| Set the document title or favicon   | `useTitle`, `useFavicon`                                                                            |
| Pointer position                    | `useMouse`, `useMouseInElement`, `usePointer`                                                       |
| Scroll position, direction or edges | `useScroll`, `useWindowScroll`, `useInfiniteScroll`                                                 |
| Whether an element is on screen     | `useElementVisibility`, `useIntersectionObserver`                                                   |
| Element dimensions                  | `useElementSize`, `useElementBounding`, `useResizeObserver`                                         |
| Window dimensions                   | `useWindowSize`                                                                                     |
| HTTP with reactive state            | `useFetch`, `createFetch`                                                                           |
| A socket or an event stream         | `useWebSocket`, `useEventSource`                                                                    |
| Undo and redo                       | `useRefHistory`, `useManualRefHistory`                                                              |
| Keep two refs in step               | `syncRef`, `syncRefs`                                                                               |
| A listener that cleans itself up    | `useEventListener`                                                                                  |
| Outside clicks or key strokes       | `onClickOutside`, `onKeyStroke`, `onLongPress`                                                      |
| Two-way binding on a prop           | `useVModel`, `useVModels`                                                                           |
| Render a very long list             | `useVirtualList`                                                                                    |
| Animate a number                    | `useTransition`, `useRafFn`                                                                         |
| Debounce or throttle                | `useDebounceFn`, `useThrottleFn`, `watchDebounced`, `watchThrottled`                                |
| Timers                              | `useInterval`, `useIntervalFn`, `useTimeout`, `useTimeoutFn`                                        |
| Toggles, counters, cycling          | `useToggle`, `useCounter`, `useCycleList`                                                           |
| Watch, but only when truthy         | `whenever`                                                                                          |

---

## Server Rendering

**Return their declared default on the server, then correct on hydration:**
`useLocalStorage`, `useSessionStorage`, `useDark`, `usePreferredDark`, `useMediaQuery`, `useFetch`.

A layout branched purely on one of these renders the default branch first, so the correction is
visible as a flash. Where that matters, render both branches with CSS, or gate on a
mounted flag and render neither until hydration.

**Need a DOM, so belong inside a client-only boundary:**
`useMouse`, `useScroll`, `useIntersectionObserver`, `useResizeObserver`, `useElementSize`,
`useElementVisibility`, `useWebSocket`, `useEventSource`, `useClipboard`, `useVirtualList`.

The guard is the framework's own client-only wrapper, or a mounted hook — both work because a
mounted hook does not run on the server.

---

## Gotchas

| Behaviour                                | Why it surprises                                              | What to do                                          |
| ---------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| `useLocalStorage(...).value = null`      | Removes the key rather than storing `null`                    | Assign an explicit empty value or the default       |
| `createGlobalState` outlives components  | Module-lifetime singleton, cleared only by a reload           | Reset it explicitly on sign-out                     |
| `useIntersectionObserver` fires at once  | The first callback reports current state, not a change        | Compare against the previous value                  |
| `useFetch` fires on mount                | `immediate` defaults to true; `refetch` only adds re-firing   | `immediate: false` for fully manual                 |
| `useWebSocket` retries forever           | `autoReconnect: true` has no retry bound                      | Give it `retries` and an `onFailed`                 |
| `useRefHistory` records every change     | One entry per keystroke on a text input                       | Set `capacity`, or use `useManualRefHistory`        |
| A composable in an async callback        | Teardown binds to the effect scope current at call time       | Call it synchronously during setup                  |
| `shallowRef` on a persisted object       | Nested writes are invisible to the watcher that persists them | Deep tracking where nested changes must be observed |
| `useMediaQuery` is `false` on the server | There is no viewport to measure                               | Treat the default branch as what renders first      |

---

## Version Notes

- `@vueuse/core` v14 requires Vue 3.5 or later, and is written in TypeScript with full inference.
- Retired in v14: `watchPausable` (Vue's own `watch` covers it), `computedEager` (superseded by
  Vue's `computed`), and VueUse's `templateRef` (superseded by Vue's `useTemplateRef`).
- Behaviour changes in v14: `computedAsync` defaults to `flush: "sync"`, `useThrottleFn` follows
  conventional throttle semantics, and `useClipboard` returns readonly refs.
- Every composable is tree-shakeable — the package size is irrelevant to what ships, provided the
  imports are named.
