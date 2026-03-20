# VueUse State Examples

> createGlobalState, useRefHistory, syncRef, and persistence patterns. See [core.md](core.md) for basics.

**Prerequisites**: Understand VueUse composable calling conventions from core examples first.

---

## createGlobalState - Shared Reactive State

### Good Example - Application-Wide State

```typescript
// stores/app-state.ts
import { createGlobalState } from "@vueuse/core";
import { useLocalStorage } from "@vueuse/core";
import { computed, shallowRef } from "vue";

type Language = "en" | "fr" | "de" | "ja";

export const useAppState = createGlobalState(() => {
  // Persistent state
  const language = useLocalStorage<Language>("app-lang", "en");
  const sidebarCollapsed = useLocalStorage("sidebar-collapsed", false);

  // Transient state (lost on refresh)
  const isLoading = shallowRef(false);
  const activeModal = shallowRef<string | null>(null);

  // Computed
  const isRtl = computed(() => ["ar", "he"].includes(language.value));

  // Actions
  function setLanguage(lang: Language): void {
    language.value = lang;
  }

  function openModal(modalId: string): void {
    activeModal.value = modalId;
  }

  function closeModal(): void {
    activeModal.value = null;
  }

  return {
    language,
    sidebarCollapsed,
    isLoading,
    activeModal,
    isRtl,
    setLanguage,
    openModal,
    closeModal,
  };
});
```

**Why good:** mixes persistent (`useLocalStorage`) and transient (`shallowRef`) state, computed derivations, action methods for controlled state changes, singleton pattern via `createGlobalState`

### Bad Example - Direct State Mutation

```typescript
// BAD: exposing raw refs without action methods
export const useAppState = createGlobalState(() => {
  const language = ref("en");
  return { language }; // anyone can mutate directly
});

// In component:
const { language } = useAppState();
language.value = "invalid-lang"; // no validation, no type safety
```

**Why bad:** no validation or constraint enforcement, debugging becomes difficult when any component can mutate state directly

---

## useRefHistory - Undo/Redo

### Good Example - Undo/Redo for Form Data

```vue
<script setup lang="ts">
import { useRefHistory } from "@vueuse/core";
import { ref } from "vue";

interface FormData {
  title: string;
  content: string;
  tags: string[];
}

const MAX_HISTORY = 50;
const AUTO_COMMIT_DELAY_MS = 1000;

const formData = ref<FormData>({
  title: "",
  content: "",
  tags: [],
});

const { undo, redo, canUndo, canRedo, history, clear } = useRefHistory(
  formData,
  {
    deep: true,
    capacity: MAX_HISTORY,
    dump: (v) => JSON.parse(JSON.stringify(v)), // snapshot serialization
    parse: (v) => v,
  },
);
</script>

<template>
  <div>
    <input v-model="formData.title" placeholder="Title" />
    <textarea v-model="formData.content" placeholder="Content" />

    <div>
      <button :disabled="!canUndo" @click="undo()">Undo</button>
      <button :disabled="!canRedo" @click="redo()">Redo</button>
      <span>{{ history.length }} snapshots</span>
    </div>
  </div>
</template>
```

**Why good:** automatic history tracking, capacity limit prevents memory bloat, `canUndo`/`canRedo` for button state, deep tracking for nested objects

---

## useManualRefHistory - Explicit Snapshots

### Good Example - Save Points

```vue
<script setup lang="ts">
import { useManualRefHistory } from "@vueuse/core";
import { ref } from "vue";

const documentContent = ref("Initial content");

const { commit, undo, redo, canUndo, canRedo } =
  useManualRefHistory(documentContent);

function save(): void {
  commit(); // create explicit snapshot
  console.log("Saved!");
}

function handleInput(newContent: string): void {
  documentContent.value = newContent; // no automatic history
}
</script>
```

**Why good:** snapshots only on explicit `commit()`, avoids capturing every keystroke, useful for discrete save points

---

## syncRef - Two-Way Ref Synchronization

### Good Example - Synced Refs

```vue
<script setup lang="ts">
import { syncRef } from "@vueuse/core";
import { ref } from "vue";

const sourceRef = ref("hello");
const targetRef = ref("");

// Two-way sync: changes to either ref update the other
const { stop } = syncRef(sourceRef, targetRef);

sourceRef.value = "world"; // targetRef is now "world"
targetRef.value = "foo"; // sourceRef is now "foo"

// One-way sync
const { stop: stopOneWay } = syncRef(sourceRef, targetRef, {
  direction: "ltr", // left-to-right only
});
</script>
```

**Why good:** automatic synchronization between refs, direction control, `stop()` for cleanup

---

## createGlobalState with Persistence

### Good Example - Theme Store with localStorage

```typescript
// stores/theme.ts
import {
  createGlobalState,
  useLocalStorage,
  usePreferredDark,
} from "@vueuse/core";
import { computed } from "vue";

type ThemeMode = "light" | "dark" | "auto";

export const useThemeStore = createGlobalState(() => {
  const mode = useLocalStorage<ThemeMode>("theme-mode", "auto");
  const systemIsDark = usePreferredDark();

  const isDark = computed(() => {
    if (mode.value === "auto") return systemIsDark.value;
    return mode.value === "dark";
  });

  function setMode(newMode: ThemeMode): void {
    mode.value = newMode;
  }

  function toggleDark(): void {
    mode.value = isDark.value ? "light" : "dark";
  }

  return { mode, isDark, setMode, toggleDark };
});
```

**Why good:** combines `createGlobalState` (singleton), `useLocalStorage` (persistence), and `usePreferredDark` (system detection) into a complete theme solution
