# VueUse Sensor Examples

> Pointer position, scroll, intersection, resize and visibility. See [SKILL.md](../SKILL.md) for
> the decisions and [core.md](core.md) for storage and listeners.

Every composable here needs a DOM, so all of them belong inside a client-only boundary when the app
is server-rendered.

---

## Pointer Position

```vue
<script setup lang="ts">
import { useMouse, useMouseInElement } from "@vueuse/core";
import { useTemplateRef } from "vue";

const { x, y, sourceType } = useMouse(); // sourceType: "mouse" | "touch" | null

const target = useTemplateRef("target");
const { elementX, elementY, isOutside } = useMouseInElement(target);
</script>

<template>
  <div ref="target">
    <span v-if="!isOutside">{{ elementX }}, {{ elementY }}</span>
  </div>
</template>
```

`useMouse` updates on every pointer move, so anything expensive downstream wants a
`watchThrottled` or an `auditTime`-shaped guard rather than a plain `computed`.

`useMouseInElement` measures against the element's current bounding box, which it re-reads — an
element that moves under a stationary pointer updates correctly.

---

## Scroll

```vue
<script setup lang="ts">
import { useScroll } from "@vueuse/core";
import { computed, useTemplateRef } from "vue";

const HIDE_AFTER_PX = 100;

const { y: pageY, directions } = useScroll(window);

// Hide on the way down, reveal on the way up — the pattern that needs direction,
// not just position
const headerHidden = computed(
  () => pageY.value > HIDE_AFTER_PX && directions.bottom,
);

const container = useTemplateRef("container");
const { arrivedState } = useScroll(container, { offset: { bottom: 100 } });

// arrivedState.bottom becomes true 100px early, thanks to the offset above
const nearEnd = computed(() => arrivedState.bottom);
</script>
```

`arrivedState` replaces the `scrollTop + clientHeight >= scrollHeight` arithmetic, including the
sub-pixel rounding that makes the naive version intermittently miss the bottom.

---

## Intersection

```vue
<script setup lang="ts">
import { useIntersectionObserver } from "@vueuse/core";
import { shallowRef, useTemplateRef } from "vue";

const target = useTemplateRef("observed");
const isVisible = shallowRef(false);

const { stop } = useIntersectionObserver(
  target,
  ([entry]) => {
    isVisible.value = entry?.isIntersecting ?? false;
  },
  { threshold: 0.5 }, // half the element in view
);

const sentinel = useTemplateRef("sentinel");
const isLoading = shallowRef(false);

useIntersectionObserver(
  sentinel,
  ([entry]) => {
    if (entry?.isIntersecting && !isLoading.value) loadMore();
  },
  { rootMargin: "200px" }, // start loading before the sentinel is on screen
);
</script>
```

The callback runs once at registration with the element's current state, so an animation that
should fire on _becoming_ visible needs to compare against the previous value — a bare
`if (isIntersecting)` fires for an element that was already on screen.

`stop()` is for observers that should end before their component does — a one-shot reveal
animation calls it from inside its own callback.

---

## Element Size

```vue
<script setup lang="ts">
import { useElementSize, useResizeObserver } from "@vueuse/core";
import { computed, shallowRef, useTemplateRef } from "vue";

const container = useTemplateRef("container");

// The common case: reactive width and height
const { width, height } = useElementSize(container);
const isCompact = computed(() => width.value < 400);

// The observer itself, when the entry's own fields are needed
const borderBoxWidth = shallowRef(0);
useResizeObserver(container, ([entry]) => {
  borderBoxWidth.value = entry?.borderBoxSize[0]?.inlineSize ?? 0;
});
</script>
```

This is container-relative sizing rather than viewport-relative: a component that lays itself out
from `width` works in a sidebar and in a full-width page without a media query knowing about
either.

A layout that both reads and writes size can loop — the observer fires, the handler resizes the
element, the observer fires again. Write to a different axis, or to a child.

---

## Element Visibility

```vue
<script setup lang="ts">
import { useElementVisibility } from "@vueuse/core";
import { shallowRef, useTemplateRef, watch } from "vue";

const section = useTemplateRef("section");
const isVisible = useElementVisibility(section);

const hasAnimated = shallowRef(false);

watch(isVisible, (visible) => {
  if (visible && !hasAnimated.value) hasAnimated.value = true;
});
</script>
```

A boolean ref where `useIntersectionObserver` gives a callback and entries — reach for this when
the question is "is it on screen" and for the observer when the threshold, the root or the entry
data matter.
