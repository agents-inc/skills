# VueUse Quick Reference

> Decision frameworks, SSR guide, and composable lookup. See [SKILL.md](SKILL.md) for core concepts.

---

## Composable Categories

| Category      | Key Composables                                                                      | Import From    |
| ------------- | ------------------------------------------------------------------------------------ | -------------- |
| **Browser**   | `useLocalStorage`, `useClipboard`, `useMediaQuery`, `useDark`, `useTitle`            | `@vueuse/core` |
| **Sensors**   | `useMouse`, `useScroll`, `useIntersectionObserver`, `useResizeObserver`              | `@vueuse/core` |
| **Network**   | `useFetch`, `useWebSocket`, `useEventSource`                                         | `@vueuse/core` |
| **State**     | `createGlobalState`, `useRefHistory`, `syncRef`, `useLastChanged`                    | `@vueuse/core` |
| **Animation** | `useTransition`, `useRafFn`, `useInterval`, `useTimeout`                             | `@vueuse/core` |
| **Component** | `useVModel`, `useVirtualList`, `onClickOutside`, `onKeyStroke`                       | `@vueuse/core` |
| **Elements**  | `useElementVisibility`, `useElementSize`, `useElementBounding`                       | `@vueuse/core` |
| **Watch**     | `watchDebounced`, `watchThrottled`, ~~`watchPausable`~~ (deprecated v14), `whenever` | `@vueuse/core` |
| **Utilities** | `useToggle`, `useCounter`, `useCycleList`, `useDebounceFn`, `useThrottleFn`          | `@vueuse/core` |

---

## Composable Decision Framework

```
Need to store data persistently?
├── In localStorage? → useLocalStorage
├── In sessionStorage? → useSessionStorage
└── Across components only (no persistence)? → createGlobalState

Need to track DOM/browser state?
├── Mouse position? → useMouse / useMouseInElement
├── Scroll position? → useScroll
├── Element visibility? → useElementVisibility / useIntersectionObserver
├── Element dimensions? → useResizeObserver / useElementSize
├── Window size? → useWindowSize
├── Media query? → useMediaQuery
└── Dark mode? → useDark / usePreferredDark

Need to fetch data?
├── Simple reactive fetch? → useFetch
├── Reusable API client? → createFetch
├── Real-time WebSocket? → useWebSocket
└── Server-sent events? → useEventSource

Need component utilities?
├── v-model helper? → useVModel
├── Click outside detection? → onClickOutside
├── Keyboard shortcuts? → onKeyStroke
├── Virtual scrolling? → useVirtualList
└── Event listener with auto-cleanup? → useEventListener

Need state utilities?
├── Undo/redo? → useRefHistory / useManualRefHistory
├── Sync two refs? → syncRef
├── Debounced watch? → watchDebounced
└── Throttled watch? → watchThrottled
```

---

## SSR Safety Guide

VueUse composables that access browser APIs will crash during server-side rendering. Handling strategies:

### Strategy 1: Built-in SSR Support

Many VueUse composables handle SSR internally and return safe defaults:

```typescript
// These return their default values during SSR:
const storage = useLocalStorage("key", "default"); // returns "default" on server
const isDark = useDark(); // returns false on server
const media = useMediaQuery("(min-width: 768px)"); // returns false on server
```

### Strategy 2: Client-Only Components

```vue
<template>
  <!-- Only render on client -->
  <ClientOnly>
    <MouseTracker />
  </ClientOnly>
</template>
```

### Strategy 3: Manual Guard

```typescript
import { ref, onMounted } from "vue";

const mouseX = ref(0);

onMounted(() => {
  // Safe: onMounted only runs on client
  const { x } = useMouse();
  watchEffect(() => {
    mouseX.value = x.value;
  });
});
```

**Composables safe for SSR (return defaults):**
`useLocalStorage`, `useSessionStorage`, `useDark`, `useMediaQuery`, `usePreferredDark`, `useFetch`

**Composables that need client-only rendering:**
`useMouse`, `useScroll`, `useIntersectionObserver`, `useResizeObserver`, `useElementVisibility`, `useWebSocket`, `useEventSource`, `useClipboard`

---

## Common Gotchas

| Gotcha                                     | Explanation                                                                 | Fix                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------ |
| `useLocalStorage` setting null             | `null` removes the key from storage                                         | Use empty string or explicit default                   |
| `createGlobalState` persistence            | State survives component unmount but NOT page reload                        | Combine with `useLocalStorage` for persistence         |
| `useIntersectionObserver` initial callback | Fires immediately with current visibility state                             | Check `isIntersecting` in callback, don't assume entry |
| `useFetch` auto-fires                      | Default `immediate: true` fires on mount                                    | Use `immediate: false` for manual-only                 |
| `useWebSocket` auto-reconnect              | Default behavior is to reconnect automatically                              | Pass `autoReconnect: false` to disable                 |
| Composables in async contexts              | Calling composables inside `await` or `setTimeout` breaks lifecycle binding | Always call in synchronous `setup()`                   |
| `useRefHistory` memory                     | Tracks every change with `deep: true` by default                            | Set `capacity` limit or use `useManualRefHistory`      |
| `shallowRef` vs `ref`                      | `ref` creates deep reactive proxy for objects                               | Use `shallowRef` for large objects/arrays              |

---

## Version Notes

- **VueUse v14.x** (current v14.2.1): Vue 3.5+ required, configurable schedulers for timed composables
- **Deprecated in v14**: `watchPausable` (use Vue's `watch`), `computedEager` (use Vue 3.4+ `computed`), VueUse's `templateRef` (use Vue 3.5's native `useTemplateRef`)
- **Breaking in v14**: `computedAsync` defaults to `flush: sync`, `useThrottleFn` aligns with traditional throttle behavior, `useClipboard` returns `readonly` refs
- All composables are tree-shakeable -- import only what you need
- TypeScript-first with full type inference
- SSR-safe by default for most composables (returns safe defaults)
- `@vueuse/core` is the primary package; `@vueuse/integrations` for third-party library integrations
