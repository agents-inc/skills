# VueUse Component Examples

> useVModel, useVirtualList, onClickOutside, onKeyStroke patterns. See [core.md](core.md) for basics.

**Prerequisites**: Understand VueUse composable calling conventions from core examples first.

---

## useVModel - Simplified v-model

### Good Example - Two-Way Binding Helper

```vue
<!-- ChildComponent.vue -->
<script setup lang="ts">
import { useVModel } from "@vueuse/core";

const props = defineProps<{
  modelValue: string;
  count: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:count": [value: number];
}>();

// ✅ useVModel creates a writable ref synced with the prop
const value = useVModel(props, "modelValue", emit);
const countRef = useVModel(props, "count", emit);

// Use like a normal ref -- emits update events automatically
function handleInput(newValue: string): void {
  value.value = newValue; // automatically emits "update:modelValue"
}
</script>

<template>
  <input
    :value="value"
    @input="handleInput(($event.target as HTMLInputElement).value)"
  />
  <button @click="countRef++">Count: {{ countRef }}</button>
</template>
```

```vue
<!-- ParentComponent.vue -->
<script setup lang="ts">
import { ref } from "vue";
import ChildComponent from "./ChildComponent.vue";

const name = ref("Alice");
const count = ref(0);
</script>

<template>
  <ChildComponent v-model="name" v-model:count="count" />
</template>
```

**Why good:** `useVModel` eliminates boilerplate for computed get/set pattern, works with named v-models, type-safe emit

### Bad Example - Manual v-model Handling

```vue
<script setup lang="ts">
// BAD: verbose computed get/set for every v-model prop
const value = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const countRef = computed({
  get: () => props.count,
  set: (val) => emit("update:count", val),
});
</script>
```

**Why bad:** repetitive boilerplate for every v-model prop, easy to mistype emit event names

---

## useVirtualList - Efficient Large Lists

### Good Example - Virtualized List

```vue
<script setup lang="ts">
import { useVirtualList } from "@vueuse/core";
import { ref, computed } from "vue";

interface ListItem {
  id: number;
  name: string;
  description: string;
}

const ITEM_HEIGHT = 60;

// Generate large dataset
const allItems = ref<ListItem[]>(
  Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    description: `Description for item ${i}`,
  })),
);

const { list, containerProps, wrapperProps } = useVirtualList(allItems, {
  itemHeight: ITEM_HEIGHT,
  overscan: 5, // render 5 extra items above/below viewport
});
</script>

<template>
  <div v-bind="containerProps" style="height: 400px; overflow-y: auto;">
    <div v-bind="wrapperProps">
      <div
        v-for="{ data: item, index } in list"
        :key="item.id"
        :style="{ height: `${ITEM_HEIGHT}px` }"
      >
        <strong>{{ item.name }}</strong>
        <p>{{ item.description }}</p>
      </div>
    </div>
  </div>
</template>
```

**Why good:** renders only visible items (10-20 DOM nodes instead of 10,000), smooth scrolling with overscan, `containerProps`/`wrapperProps` handle positioning

---

## onClickOutside - Click Outside Detection

### Good Example - Dropdown with Click Outside

```vue
<script setup lang="ts">
import { onClickOutside } from "@vueuse/core";
import { useTemplateRef, ref } from "vue";

const dropdownRef = useTemplateRef("dropdown");
const isOpen = ref(false);

onClickOutside(
  dropdownRef,
  () => {
    isOpen.value = false;
  },
  {
    ignore: [".dropdown-trigger"], // don't close when clicking the trigger
  },
);
</script>

<template>
  <div>
    <button class="dropdown-trigger" @click="isOpen = !isOpen">
      Toggle Menu
    </button>
    <div v-if="isOpen" ref="dropdown" class="dropdown-panel">
      <ul>
        <li>Option 1</li>
        <li>Option 2</li>
        <li>Option 3</li>
      </ul>
    </div>
  </div>
</template>
```

**Why good:** `ignore` option prevents the trigger button from closing the dropdown, auto-cleanup on unmount

---

## onKeyStroke - Keyboard Shortcuts

### Good Example - Keyboard Navigation

```vue
<script setup lang="ts">
import { onKeyStroke } from "@vueuse/core";
import { ref } from "vue";

const items = ref(["Apple", "Banana", "Cherry", "Date"]);
const selectedIndex = ref(0);
const LAST_INDEX_OFFSET = 1;

// Single key
onKeyStroke("Escape", () => {
  selectedIndex.value = 0;
});

// Arrow navigation
onKeyStroke("ArrowDown", (e) => {
  e.preventDefault();
  selectedIndex.value = Math.min(
    selectedIndex.value + 1,
    items.value.length - LAST_INDEX_OFFSET,
  );
});

onKeyStroke("ArrowUp", (e) => {
  e.preventDefault();
  selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
});

// Enter to select
onKeyStroke("Enter", () => {
  const selected = items.value[selectedIndex.value];
  if (selected) {
    console.log("Selected:", selected);
  }
});

// Modifier keys
onKeyStroke("s", (e) => {
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault();
    save();
  }
});
</script>

<template>
  <ul>
    <li
      v-for="(item, index) in items"
      :key="item"
      :class="{ active: index === selectedIndex }"
    >
      {{ item }}
    </li>
  </ul>
</template>
```

**Why good:** auto-cleanup on unmount, `e.preventDefault()` prevents default browser behavior, modifier key detection

---

## useTransition - Animated Values

### Good Example - Animated Counter

```vue
<script setup lang="ts">
import { useTransition, TransitionPresets } from "@vueuse/core";
import { ref } from "vue";

const TRANSITION_DURATION_MS = 800;

const sourceValue = ref(0);

const animatedValue = useTransition(sourceValue, {
  duration: TRANSITION_DURATION_MS,
  transition: TransitionPresets.easeOutCubic,
});

function setTarget(value: number): void {
  sourceValue.value = value;
  // animatedValue smoothly transitions from current to target
}
</script>

<template>
  <div>
    <p>{{ Math.round(animatedValue) }}</p>
    <button @click="setTarget(100)">Set to 100</button>
    <button @click="setTarget(0)">Reset</button>
  </div>
</template>
```

**Why good:** declarative value animation, built-in easing presets, reactive source triggers animation automatically

---

## useRafFn - RequestAnimationFrame Loop

### Good Example - Animation Loop

```vue
<script setup lang="ts">
import { useRafFn } from "@vueuse/core";
import { ref } from "vue";

const ROTATION_SPEED = 0.02;

const rotation = ref(0);

const { pause, resume, isActive } = useRafFn(({ delta }) => {
  rotation.value += ROTATION_SPEED * delta;
});
</script>

<template>
  <div :style="{ transform: `rotate(${rotation}rad)` }">Spinning element</div>
  <button @click="isActive ? pause() : resume()">
    {{ isActive ? "Pause" : "Resume" }}
  </button>
</template>
```

**Why good:** auto-cleanup on unmount, `delta` for frame-rate independent animation, pause/resume controls
