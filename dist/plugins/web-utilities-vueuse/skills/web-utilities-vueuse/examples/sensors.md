# VueUse Sensor Examples

> Mouse, scroll, intersection, resize, and visibility composables. See [core.md](core.md) for basics.

**Prerequisites**: Understand VueUse composable calling conventions from core examples first.

---

## useMouse - Mouse Position Tracking

### Good Example - Reactive Mouse Coordinates

```vue
<script setup lang="ts">
import { useMouse, useMouseInElement } from "@vueuse/core";
import { useTemplateRef } from "vue";

// Global mouse position
const { x, y, sourceType } = useMouse();
// sourceType: "mouse" | "touch" | null

// Mouse position relative to element
const targetEl = useTemplateRef("target");
const { elementX, elementY, isOutside, elementWidth, elementHeight } =
  useMouseInElement(targetEl);
</script>

<template>
  <div>
    <p>Global: {{ x }}, {{ y }} ({{ sourceType }})</p>
    <div ref="target" style="width: 300px; height: 200px; background: #eee;">
      <p v-if="!isOutside">Element: {{ elementX }}, {{ elementY }}</p>
    </div>
  </div>
</template>
```

**Why good:** reactive coordinates update automatically, `useMouseInElement` provides element-relative positioning, `isOutside` for hover detection

---

## useScroll - Scroll Position and Direction

### Good Example - Scroll-Aware Header

```vue
<script setup lang="ts">
import { useScroll } from "@vueuse/core";
import { computed, useTemplateRef } from "vue";

const HEADER_HIDE_THRESHOLD = 100;

// Track window scroll
const { y: scrollY, isScrolling, directions } = useScroll(window);

const isHeaderHidden = computed(
  () => scrollY.value > HEADER_HIDE_THRESHOLD && directions.bottom,
);

// Track scrollable container
const scrollContainer = useTemplateRef("container");
const {
  x: containerX,
  y: containerY,
  arrivedState,
} = useScroll(scrollContainer);

// arrivedState: { top, bottom, left, right } - true when scrolled to edge
const isAtBottom = computed(() => arrivedState.bottom);
</script>

<template>
  <header :class="{ 'header--hidden': isHeaderHidden }">Navigation</header>
  <div ref="container" style="overflow-y: auto; height: 400px;">
    <!-- content -->
    <p v-if="isAtBottom">You've reached the bottom!</p>
  </div>
</template>
```

**Why good:** `directions` tracks scroll direction for show/hide patterns, `arrivedState` detects scroll edges without manual calculation

---

## useIntersectionObserver - Visibility Detection

### Good Example - Lazy Loading and Infinite Scroll

```vue
<script setup lang="ts">
import { useIntersectionObserver } from "@vueuse/core";
import { shallowRef, useTemplateRef } from "vue";

// Pattern 1: Element visibility detection
const target = useTemplateRef("observed");
const targetIsVisible = shallowRef(false);

const { stop } = useIntersectionObserver(
  target,
  ([entry]) => {
    targetIsVisible.value = entry?.isIntersecting ?? false;
  },
  { threshold: 0.5 }, // 50% visible triggers callback
);

// Pattern 2: Infinite scroll sentinel
const sentinel = useTemplateRef("sentinel");
const isLoadingMore = shallowRef(false);

useIntersectionObserver(
  sentinel,
  ([entry]) => {
    if (entry?.isIntersecting && !isLoadingMore.value) {
      loadMoreItems();
    }
  },
  { rootMargin: "200px" }, // trigger 200px before visible
);

async function loadMoreItems(): Promise<void> {
  isLoadingMore.value = true;
  await fetchNextPage();
  isLoadingMore.value = false;
}
</script>

<template>
  <div ref="observed" :class="{ 'fade-in': targetIsVisible }">
    Animated content
  </div>

  <div ref="sentinel" style="height: 1px;" />
</template>
```

**Why good:** `rootMargin` pre-fetches data before the sentinel is visible, `stop()` allows manual cleanup, `threshold` controls sensitivity

---

## useResizeObserver - Element Size Tracking

### Good Example - Responsive Component

```vue
<script setup lang="ts">
import { useResizeObserver } from "@vueuse/core";
import { shallowRef, useTemplateRef, computed } from "vue";

const containerRef = useTemplateRef("container");
const containerWidth = shallowRef(0);
const containerHeight = shallowRef(0);

const COMPACT_THRESHOLD = 400;

useResizeObserver(containerRef, (entries) => {
  const entry = entries[0];
  if (entry) {
    containerWidth.value = entry.contentRect.width;
    containerHeight.value = entry.contentRect.height;
  }
});

const isCompact = computed(() => containerWidth.value < COMPACT_THRESHOLD);
</script>

<template>
  <div ref="container" :class="{ compact: isCompact }">
    <span>{{ containerWidth }}px x {{ containerHeight }}px</span>
  </div>
</template>
```

**Why good:** reactive element dimensions without polling, `shallowRef` for performance, named threshold constant

---

## useElementVisibility - Simple Visibility Check

### Good Example - Animation Trigger

```vue
<script setup lang="ts">
import { useElementVisibility } from "@vueuse/core";
import { shallowRef, useTemplateRef, watch } from "vue";

const sectionRef = useTemplateRef("section");
const isVisible = useElementVisibility(sectionRef);

// Trigger animation once when element becomes visible
const hasAnimated = shallowRef(false);

watch(isVisible, (visible) => {
  if (visible && !hasAnimated.value) {
    hasAnimated.value = true;
    // trigger one-time animation
  }
});
</script>

<template>
  <section ref="section" :class="{ 'animate-in': hasAnimated }">
    Content that animates when scrolled into view
  </section>
</template>
```

**Why good:** simpler API than `useIntersectionObserver` for basic visibility, one-time animation guard prevents re-triggering
