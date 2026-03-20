# VueUse Core Examples

> Core utilities, browser APIs, and event listeners. See [SKILL.md](../SKILL.md) for concepts.

---

## useLocalStorage with Custom Serializer

### Good Example - Complex Object Storage

```vue
<script setup lang="ts">
import { useLocalStorage } from "@vueuse/core";

interface AppSettings {
  theme: "light" | "dark" | "auto";
  language: string;
  notifications: boolean;
  recentSearches: string[];
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: "auto",
  language: "en",
  notifications: true,
  recentSearches: [],
};

const MAX_RECENT_SEARCHES = 10;

const settings = useLocalStorage<AppSettings>(
  "app-settings",
  DEFAULT_SETTINGS,
  {
    mergeDefaults: true, // merges stored data with defaults (handles new fields)
  },
);

function addRecentSearch(query: string): void {
  const searches = settings.value.recentSearches.filter((s) => s !== query);
  searches.unshift(query);
  settings.value.recentSearches = searches.slice(0, MAX_RECENT_SEARCHES);
}

function resetSettings(): void {
  settings.value = { ...DEFAULT_SETTINGS };
}
</script>
```

**Why good:** `mergeDefaults: true` handles schema evolution (new fields added without losing existing data), named constants for limits, typed generics

### Bad Example - Manual JSON Storage

```typescript
// BAD: manual serialization, no tab sync, no SSR safety
const settings = ref<AppSettings>(
  JSON.parse(localStorage.getItem("app-settings") || "null") ??
    DEFAULT_SETTINGS,
);

watch(
  settings,
  (val) => {
    localStorage.setItem("app-settings", JSON.stringify(val));
  },
  { deep: true },
);
```

**Why bad:** no cross-tab synchronization, crashes in SSR, deep watcher fires on every nested change, manual JSON handling

---

## useEventListener Patterns

### Good Example - Multiple Events with Cleanup

```vue
<script setup lang="ts">
import { useEventListener } from "@vueuse/core";
import { useTemplateRef, ref } from "vue";

const dropZone = useTemplateRef("drop-zone");
const isDragging = ref(false);
const droppedFiles = ref<File[]>([]);

// All listeners auto-cleaned on unmount
useEventListener(dropZone, "dragenter", (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = true;
});

useEventListener(dropZone, "dragleave", () => {
  isDragging.value = false;
});

useEventListener(dropZone, "dragover", (e: DragEvent) => {
  e.preventDefault(); // required to allow drop
});

useEventListener(dropZone, "drop", (e: DragEvent) => {
  e.preventDefault();
  isDragging.value = false;
  if (e.dataTransfer?.files) {
    droppedFiles.value = [...e.dataTransfer.files];
  }
});

// Keyboard shortcut
useEventListener(window, "keydown", (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    isDragging.value = false;
  }
});
</script>

<template>
  <div ref="drop-zone" :class="{ 'drop-zone--active': isDragging }">
    Drop files here
  </div>
</template>
```

**Why good:** all event listeners automatically removed on unmount, template ref handling built-in, no manual cleanup code needed

---

## useMediaQuery Responsive Patterns

### Good Example - Breakpoint System

```vue
<script setup lang="ts">
import {
  useMediaQuery,
  usePreferredColorScheme,
  usePreferredLanguages,
} from "@vueuse/core";
import { computed } from "vue";

// Named breakpoint constants
const BREAKPOINT_SM = "(min-width: 640px)";
const BREAKPOINT_MD = "(min-width: 768px)";
const BREAKPOINT_LG = "(min-width: 1024px)";
const BREAKPOINT_XL = "(min-width: 1280px)";

const isSmUp = useMediaQuery(BREAKPOINT_SM);
const isMdUp = useMediaQuery(BREAKPOINT_MD);
const isLgUp = useMediaQuery(BREAKPOINT_LG);
const isXlUp = useMediaQuery(BREAKPOINT_XL);

const currentBreakpoint = computed(() => {
  if (isXlUp.value) return "xl";
  if (isLgUp.value) return "lg";
  if (isMdUp.value) return "md";
  if (isSmUp.value) return "sm";
  return "xs";
});

// System preferences
const colorScheme = usePreferredColorScheme(); // "dark" | "light" | "no-preference"
const languages = usePreferredLanguages(); // readonly Ref<string[]>
</script>
```

**Why good:** named constants for breakpoints, composable breakpoint detection, system preference integration

---

## useToggle and Composable Composition

### Good Example - Composing Multiple Utilities

```vue
<script setup lang="ts">
import { useToggle, useCounter, useDebounceFn } from "@vueuse/core";
import { ref } from "vue";

// Modal with toggle
const [isModalOpen, toggleModal] = useToggle(false);

// Counter with debounced API call
const DEBOUNCE_MS = 500;
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99;

const {
  count: quantity,
  inc,
  dec,
  set: setQuantity,
} = useCounter(1, {
  min: MIN_QUANTITY,
  max: MAX_QUANTITY,
});

const updateCartItem = useDebounceFn(async (qty: number) => {
  await fetch("/api/cart", {
    method: "PATCH",
    body: JSON.stringify({ quantity: qty }),
  });
}, DEBOUNCE_MS);

// Watch quantity and debounce API update
watch(quantity, (newQty) => {
  updateCartItem(newQty);
});
</script>
```

**Why good:** composing multiple VueUse utilities together, debounced API call prevents rapid-fire requests, counter enforces bounds
