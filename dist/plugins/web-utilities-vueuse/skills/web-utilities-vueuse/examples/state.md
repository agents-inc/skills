# VueUse State Examples

> `createGlobalState`, ref history and `syncRef`. See [SKILL.md](../SKILL.md) for the decisions and
> [core.md](core.md) for storage.

---

## createGlobalState

The factory runs once, on first call, and every caller after that receives the same refs.

```typescript
// app-state.ts
import { createGlobalState, useLocalStorage } from "@vueuse/core";
import { computed, shallowRef } from "vue";

type Language = "en" | "fr" | "de" | "ja";

const RTL_LANGUAGES = ["ar", "he"];

export const useAppState = createGlobalState(() => {
  // Survives a reload
  const language = useLocalStorage<Language>("app-lang", "en");
  const sidebarCollapsed = useLocalStorage("sidebar-collapsed", false);

  // Does not
  const isLoading = shallowRef(false);
  const activeModal = shallowRef<string | null>(null);

  const isRtl = computed(() => RTL_LANGUAGES.includes(language.value));

  function setLanguage(next: Language): void {
    language.value = next;
  }

  function openModal(id: string): void {
    activeModal.value = id;
  }

  function closeModal(): void {
    activeModal.value = null;
  }

  return {
    language,
    sidebarCollapsed,
    isRtl,
    isLoading,
    activeModal,
    setLanguage,
    openModal,
    closeModal,
  };
});
```

```vue
<script setup lang="ts">
import { useAppState } from "./app-state";

const { language, isRtl, setLanguage } = useAppState();
</script>
```

Returning actions alongside the refs is what keeps the write points countable. Return the writable
ref itself and every component becomes a mutation site, which is fine for a toggle and painful for
anything with an invariant — expose `readonly(ref)` plus a setter where the invariant matters.

Two limits worth knowing. The state is a module-lifetime singleton: it outlives every component and
is cleared only by a reload, so anything user-scoped needs an explicit reset on sign-out. And the
factory runs inside no component's scope, so a composable called in it that registers teardown has
nothing to attach to — keep the factory to refs, computeds and functions.

---

## Undo and Redo

```vue
<script setup lang="ts">
import { useRefHistory } from "@vueuse/core";
import { ref } from "vue";

interface Draft {
  title: string;
  content: string;
  tags: string[];
}

const draft = ref<Draft>({ title: "", content: "", tags: [] });

const { undo, redo, canUndo, canRedo, history, clear } = useRefHistory(draft, {
  deep: true, // without this, nested edits are not recorded
  capacity: 50, // without this, the log grows for the session
  dump: (value) => JSON.parse(JSON.stringify(value)), // snapshot, not a reference
  parse: (value) => value,
});
</script>

<template>
  <button :disabled="!canUndo" @click="undo()">Undo</button>
  <button :disabled="!canRedo" @click="redo()">Redo</button>
</template>
```

Every change is a snapshot, so bound to a text input this records one entry per keystroke. Either
debounce the source, or take explicit save points instead:

```vue
<script setup lang="ts">
import { useManualRefHistory } from "@vueuse/core";
import { ref } from "vue";

const content = ref("");
const { commit, undo, redo, canUndo } = useManualRefHistory(content);

function save(): void {
  commit(); // one history entry per save, not per keystroke
  persist(content.value);
}
</script>
```

`useRefHistory` snapshots by reference for objects unless a `dump`/`parse` pair is given — with
`deep: true` and a mutable object, the recorded entries otherwise all point at the same object and
undo appears to do nothing.

---

## syncRef

```typescript
import { syncRef } from "@vueuse/core";
import { ref } from "vue";

const source = ref("hello");
const target = ref("");

const stop = syncRef(source, target); // two-way

source.value = "world"; // target is "world"
target.value = "foo"; // source is "foo"

// Both directions, with a transform on each edge — "ltr" or "rtl" limits it to one
syncRef(celsius, fahrenheit, {
  direction: "both",
  transform: {
    ltr: (c) => c * 1.8 + 32,
    rtl: (f) => (f - 32) / 1.8,
  },
});
```

Reach for it when two refs are genuinely owned by different pieces of code — a prop mirrored into
local state, or a value shared with a third-party widget. Where one value is derived from another,
`computed` is the honest shape, because it cannot drift.
