# VueUse Component Examples

> Two-way binding, virtual lists, outside clicks, key strokes and value animation. See
> [SKILL.md](../SKILL.md) for the decisions and [core.md](core.md) for the calling conventions.

---

## useVModel

```vue
<script setup lang="ts">
import { useVModel } from "@vueuse/core";

const props = defineProps<{ modelValue: string; count: number }>();
const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:count": [value: number];
}>();

// Writable refs that emit on assignment
const value = useVModel(props, "modelValue", emit);
const count = useVModel(props, "count", emit);
</script>

<template>
  <input
    :value="value"
    @input="value = ($event.target as HTMLInputElement).value"
  />
  <button @click="count++">Count: {{ count }}</button>
</template>
```

The event name is derived from the prop name, which removes the one thing the hand-written
`computed({ get, set })` pair gets wrong silently — a mistyped `update:` string emits an event
nobody listens for, and the binding simply does nothing.

`{ passive: true }` keeps a local copy when the parent does not listen, so the component still
works when used without a `v-model`.

---

## useVirtualList

```vue
<script setup lang="ts">
import { useVirtualList } from "@vueuse/core";
import { ref } from "vue";

interface ListItem {
  id: number;
  name: string;
}

const ITEM_HEIGHT = 60;

const allItems = ref<ListItem[]>(loadItems()); // tens of thousands

const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(
  allItems,
  {
    itemHeight: ITEM_HEIGHT,
    overscan: 5, // rendered above and below the viewport, to cover fast scrolling
  },
);
</script>

<template>
  <div v-bind="containerProps" style="height: 400px">
    <div v-bind="wrapperProps">
      <div
        v-for="{ data: item, index } in list"
        :key="item.id"
        :style="{ height: `${ITEM_HEIGHT}px` }"
      >
        {{ item.name }}
      </div>
    </div>
  </div>
</template>
```

`containerProps` carries the scroll handler and `wrapperProps` the spacer height — both must be
bound, and the container needs a fixed height for the maths to work.

The declared `itemHeight` has to match the rendered height, so the row style is set from the same
constant. For rows that genuinely vary, `itemHeight` accepts a function of the index; a fixed
number that disagrees with the DOM produces drifting scroll positions.

---

## onClickOutside

```vue
<script setup lang="ts">
import { onClickOutside } from "@vueuse/core";
import { ref, useTemplateRef } from "vue";

const dropdown = useTemplateRef("dropdown");
const isOpen = ref(false);

onClickOutside(
  dropdown,
  () => {
    isOpen.value = false;
  },
  // Without this, the trigger's own click closes the panel and the
  // click handler immediately reopens it — the dropdown never opens
  { ignore: [".dropdown-trigger"] },
);
</script>

<template>
  <button class="dropdown-trigger" @click="isOpen = !isOpen">Menu</button>
  <div v-if="isOpen" ref="dropdown" class="dropdown-panel">…</div>
</template>
```

`ignore` accepts selectors and refs. Content rendered outside the element's DOM subtree — a
teleported submenu — counts as outside, so it needs listing too.

---

## onKeyStroke

```vue
<script setup lang="ts">
import { onKeyStroke } from "@vueuse/core";
import { ref } from "vue";

const items = ref(["Apple", "Banana", "Cherry"]);
const selected = ref(0);

onKeyStroke("ArrowDown", (event) => {
  event.preventDefault(); // stop the page scrolling with the selection
  selected.value = Math.min(selected.value + 1, items.value.length - 1);
});

onKeyStroke("ArrowUp", (event) => {
  event.preventDefault();
  selected.value = Math.max(selected.value - 1, 0);
});

onKeyStroke("Enter", () => choose(items.value[selected.value]));

onKeyStroke("s", (event) => {
  if (event.metaKey || event.ctrlKey) {
    event.preventDefault();
    save();
  }
});
</script>
```

Listeners default to `window`, so a component with key handlers responds while focus is anywhere on
the page — pass a target element, or gate on an `isActive` ref, where more than one such component
can be mounted.

`onKeyStroke` matches `event.key`, which is layout-dependent for letters and affected by modifiers;
`event.code` is the physical key where that distinction matters.

---

## useTransition

```vue
<script setup lang="ts">
import { useTransition, TransitionPresets } from "@vueuse/core";
import { ref } from "vue";

const target = ref(0);

const displayed = useTransition(target, {
  duration: 800,
  transition: TransitionPresets.easeOutCubic,
});
</script>

<template>
  <p>{{ Math.round(displayed) }}</p>
  <button @click="target = 100">Set to 100</button>
</template>
```

Animates a number rather than a style, which is what makes it work for counters, gauges and any
value fed into a chart. It interpolates from wherever the animation currently is, so retargeting
mid-flight does not jump.

---

## useRafFn

```vue
<script setup lang="ts">
import { useRafFn } from "@vueuse/core";
import { ref } from "vue";

const RADIANS_PER_MS = 0.002;

const rotation = ref(0);

const { pause, resume, isActive } = useRafFn(({ delta }) => {
  rotation.value += RADIANS_PER_MS * delta;
});
</script>
```

`delta` is milliseconds since the previous frame, so multiplying by it makes the motion
frame-rate independent — the same rotation on a 60 Hz and a 144 Hz display. Incrementing by a fixed
amount per call ties the speed to the refresh rate instead.

The loop stops when the scope ends, and the browser suspends it on a hidden tab, which produces a
large `delta` on the first frame back. Clamp it where a big step would be visible.
