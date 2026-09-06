# VueUse Core Examples

> Storage, event listeners, media queries and the small state utilities. See [SKILL.md](../SKILL.md)
> for the decisions, [sensors.md](sensors.md) for DOM measurement, [state.md](state.md) for shared
> state, [component.md](component.md) for component helpers.

---

## Reactive Storage

```vue
<script setup lang="ts">
import { useLocalStorage, useSessionStorage } from "@vueuse/core";

interface AppSettings {
  theme: "light" | "dark" | "auto";
  language: string;
  recentSearches: string[];
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "auto",
  language: "en",
  recentSearches: [],
};

const settings = useLocalStorage<AppSettings>(
  "app-settings",
  DEFAULT_SETTINGS,
  {
    // Without this, a stored object written before `language` existed
    // replaces the default wholesale and the new field is undefined
    mergeDefaults: true,
  },
);

const sessionToken = useSessionStorage("session-token", "");

function addRecentSearch(query: string): void {
  settings.value.recentSearches = [
    query,
    ...settings.value.recentSearches.filter((s) => s !== query),
  ].slice(0, 10);
}
</script>
```

What the composable does that a `ref` plus a `watch` does not: serialise and revive, listen for the
`storage` event so other tabs stay in step, and return the default rather than throwing when there
is no `localStorage` — during server rendering, or in a browser with storage disabled.

`settings.value = null` removes the key. To reset without removing it, assign the default:
`settings.value = { ...DEFAULT_SETTINGS }`.

A custom `serializer` is the escape hatch for values JSON cannot round-trip — `Date`, `Map`, `Set`:

```typescript
const lastSeen = useLocalStorage("last-seen", new Date(), {
  serializer: {
    read: (raw) => new Date(raw),
    write: (value) => value.toISOString(),
  },
});
```

---

## Event Listeners

```vue
<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import { useTemplateRef, ref } from "vue";

const dropZone = useTemplateRef("drop-zone");
const isDragging = ref(false);
const files = ref<File[]>([]);

// Passing the ref rather than the element: the composable attaches once the
// element exists and re-attaches if it is replaced
useEventListener(dropZone, "dragenter", (event: DragEvent) => {
  event.preventDefault();
  isDragging.value = true;
});

useEventListener(dropZone, "dragover", (event: DragEvent) => {
  event.preventDefault(); // without this the drop event never fires
});

useEventListener(dropZone, "dragleave", () => {
  isDragging.value = false;
});

useEventListener(dropZone, "drop", (event: DragEvent) => {
  event.preventDefault();
  isDragging.value = false;
  files.value = [...(event.dataTransfer?.files ?? [])];
});

useEventListener(window, "keydown", (event: KeyboardEvent) => {
  if (event.key === "Escape") isDragging.value = false;
});
</script>

<template>
  <div ref="drop-zone" :class="{ 'drop-zone--active': isDragging }">
    Drop files here
  </div>
</template>
```

Every listener is removed when the scope ends. The return value is a `stop` function for the cases
where a listener should end earlier than its component.

---

## Media Queries and Preferences

```vue
<script setup lang="ts">
import {
  useMediaQuery,
  usePreferredColorScheme,
  usePreferredLanguages,
  useDark,
  useToggle,
} from "@vueuse/core";
import { computed } from "vue";

const BREAKPOINTS = {
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
} as const;

const isSmUp = useMediaQuery(BREAKPOINTS.sm);
const isMdUp = useMediaQuery(BREAKPOINTS.md);
const isLgUp = useMediaQuery(BREAKPOINTS.lg);
const isXlUp = useMediaQuery(BREAKPOINTS.xl);

const breakpoint = computed(() => {
  if (isXlUp.value) return "xl";
  if (isLgUp.value) return "lg";
  if (isMdUp.value) return "md";
  if (isSmUp.value) return "sm";
  return "xs";
});

const colorScheme = usePreferredColorScheme(); // "dark" | "light" | "no-preference"
const languages = usePreferredLanguages();

// useDark reads the preference, persists an override and toggles a class
const isDark = useDark();
const toggleDark = useToggle(isDark);
</script>
```

Each `useMediaQuery` registers its own `MediaQueryList` listener; the browser evaluates these, so a
handful is cheap and there is no resize handler involved.

During server rendering a media query has no answer, so it resolves `false` and corrects on
hydration — which means a layout switched purely on `isMobile` renders its desktop branch first.

---

## Toggles, Counters and Debounced Work

```vue
<script setup lang="ts">
import {
  useToggle,
  useCounter,
  useDebounceFn,
  useCycleList,
} from "@vueuse/core";
import { watch } from "vue";

const [isModalOpen, toggleModal] = useToggle(false);

// The clamp lives in the composable, so no call site can push past the bounds
const { count: quantity, inc, dec } = useCounter(1, { min: 1, max: 99 });

const updateCart = useDebounceFn(async (value: number) => {
  await fetch("/api/cart", {
    method: "PATCH",
    body: JSON.stringify({ quantity: value }),
  });
}, 500);

watch(quantity, updateCart);

const { state: theme, next: nextTheme } = useCycleList([
  "light",
  "dark",
  "auto",
]);
</script>
```

`useDebounceFn` wraps a function; `watchDebounced` debounces a source directly and is the shorter
form when the only consumer is one watcher.
