# View Transitions - Same-Document Examples

> Client-side transition patterns, continuing the numbering from [core.md](core.md).

**Prerequisites:** feature detection from [core.md](core.md) Pattern 1 — every function below
branches on it.

---

## Pattern 7: Theme Switch with a Circular Reveal

### Good Example - Reveal from the Click Point

```typescript
// theme-transition.ts

interface ClickPosition {
  x: number;
  y: number;
}

let lastClickPosition: ClickPosition = { x: 0, y: 0 };

document.addEventListener("click", (e: MouseEvent) => {
  lastClickPosition = { x: e.clientX, y: e.clientY };
});

const REVEAL_DURATION_MS = 400;
const REVEAL_EASING = "ease-in-out";

export async function toggleThemeWithReveal(): Promise<void> {
  if (!document.startViewTransition) {
    toggleThemeClass();
    return;
  }

  const { x, y } = lastClickPosition;

  // Radius from the click to the furthest corner, so the circle covers the viewport
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  const transition = document.startViewTransition(() => {
    toggleThemeClass();
  });

  await transition.ready;

  const isDark = document.documentElement.classList.contains("dark");
  const clipPath = [
    `circle(0 at ${x}px ${y}px)`,
    `circle(${endRadius}px at ${x}px ${y}px)`,
  ];

  document.documentElement.animate(
    { clipPath: isDark ? clipPath : [...clipPath].reverse() },
    {
      duration: REVEAL_DURATION_MS,
      easing: REVEAL_EASING,
      pseudoElement: "::view-transition-new(root)",
    },
  );
}

function toggleThemeClass(): void {
  document.documentElement.classList.toggle("dark");
}
```

**Supporting CSS:**

```css
::view-transition-image-pair(root) {
  isolation: auto;
}

::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
  display: block;
}
```

**Why good:** The default cross-fade has to be cancelled or the two snapshots blend under the clip
and the reveal reads as a smear. Reversing the clip for one direction means the outgoing theme wipes
away rather than the incoming one wiping in, which keeps the motion pointing the same way for both
toggles.

---

## Pattern 8: Multi-Step Form

### Good Example - Direction-Aware Step Navigation

```typescript
// form-transitions.ts

const TOTAL_STEPS = 4;

type FormStep = 1 | 2 | 3 | 4;

interface FormState {
  currentStep: FormStep;
  direction: "forwards" | "backwards";
}

let formState: FormState = {
  currentStep: 1,
  direction: "forwards",
};

function getStepElement(step: FormStep): HTMLElement | null {
  return document.querySelector(`[data-form-step="${step}"]`);
}

function showStep(step: FormStep): void {
  document.querySelectorAll("[data-form-step]").forEach((el) => {
    (el as HTMLElement).hidden = true;
  });

  const stepElement = getStepElement(step);
  if (stepElement) {
    stepElement.hidden = false;
  }
}

export async function goToStep(step: FormStep): Promise<void> {
  if (step < 1 || step > TOTAL_STEPS) return;
  if (step === formState.currentStep) return;

  formState.direction = step > formState.currentStep ? "forwards" : "backwards";

  const updateFn = () => {
    formState.currentStep = step;
    showStep(step);
  };

  if (!document.startViewTransition) {
    updateFn();
    return;
  }

  const transition = document.startViewTransition({
    update: updateFn,
    types: [formState.direction],
  });

  await transition.finished;
}

export function nextStep(): void {
  if (formState.currentStep < TOTAL_STEPS) {
    goToStep((formState.currentStep + 1) as FormStep);
  }
}

export function prevStep(): void {
  if (formState.currentStep > 1) {
    goToStep((formState.currentStep - 1) as FormStep);
  }
}
```

**CSS:**

```css
:root {
  --form-slide-distance: 20px;
  --form-slide-duration: 250ms;
}

[data-form-step] {
  view-transition-name: form-step;
}

html:active-view-transition-type(forwards) {
  &::view-transition-old(form-step) {
    animation: slide-out-left var(--form-slide-duration) ease-in;
  }
  &::view-transition-new(form-step) {
    animation: slide-in-right var(--form-slide-duration) ease-out;
  }
}

html:active-view-transition-type(backwards) {
  &::view-transition-old(form-step) {
    animation: slide-out-right var(--form-slide-duration) ease-in;
  }
  &::view-transition-new(form-step) {
    animation: slide-in-left var(--form-slide-duration) ease-out;
  }
}

@keyframes slide-out-left {
  to {
    transform: translateX(calc(-1 * var(--form-slide-distance)));
    opacity: 0;
  }
}

@keyframes slide-in-right {
  from {
    transform: translateX(var(--form-slide-distance));
    opacity: 0;
  }
}

@keyframes slide-out-right {
  to {
    transform: translateX(var(--form-slide-distance));
    opacity: 0;
  }
}

@keyframes slide-in-left {
  from {
    transform: translateX(calc(-1 * var(--form-slide-distance)));
    opacity: 0;
  }
}
```

**Why good:** One name on every step is safe because only one is ever visible — the hidden steps do
not participate. The direction is passed as a type, so the JavaScript knows nothing about which
keyframes exist and the CSS owns the whole animation.

---

## Pattern 9: Tab Panels

### Good Example - Panel Cross-Fade

```typescript
// tab-transitions.ts

let activeTabId: string = "";

function setActiveTab(tabId: string): void {
  activeTabId = tabId;

  document.querySelectorAll('[role="tab"]').forEach((tab) => {
    const isActive = tab.getAttribute("data-tab-id") === tabId;
    tab.setAttribute("aria-selected", String(isActive));
  });

  document.querySelectorAll('[role="tabpanel"]').forEach((panel) => {
    const isActive = panel.getAttribute("data-tab-id") === tabId;
    (panel as HTMLElement).hidden = !isActive;
  });
}

export function switchTab(tabId: string): void {
  if (tabId === activeTabId) return;

  if (!document.startViewTransition) {
    setActiveTab(tabId);
    return;
  }

  document.startViewTransition(() => {
    setActiveTab(tabId);
  });
}
```

**CSS:**

```css
:root {
  --tab-duration: 200ms;
}

[role="tabpanel"] {
  view-transition-name: tab-content;
}

::view-transition-old(tab-content) {
  animation: fade-out var(--tab-duration) ease-out;
}

::view-transition-new(tab-content) {
  animation: fade-in var(--tab-duration) ease-in;
}

@keyframes fade-out {
  to {
    opacity: 0;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
}
```

**Why good:** `aria-selected` and `hidden` are updated inside the callback, so the accessible state
and the animation cannot disagree. The early return on the active tab avoids a transition that would
animate nothing.

---

## Pattern 10: Accordion Sections

### Good Example - A Name Assigned Only While Animating

```typescript
// accordion-transitions.ts

function toggleAccordionSection(triggerId: string): void {
  const trigger = document.getElementById(triggerId);
  const panelId = trigger?.getAttribute("aria-controls");
  const panel = panelId ? document.getElementById(panelId) : null;

  if (!trigger || !panel) return;

  const isExpanded = trigger.getAttribute("aria-expanded") === "true";

  const updateFn = () => {
    trigger.setAttribute("aria-expanded", String(!isExpanded));
    panel.hidden = isExpanded;
  };

  if (!document.startViewTransition) {
    updateFn();
    return;
  }

  panel.style.viewTransitionName = `accordion-${panelId}`;

  const transition = document.startViewTransition(updateFn);

  transition.finished.then(() => {
    panel.style.viewTransitionName = "";
  });
}
```

**CSS:**

```css
:root {
  --accordion-duration: 300ms;
}

[id^="accordion-panel-"] {
  overflow: hidden;
}

::view-transition-old(*),
::view-transition-new(*) {
  animation-duration: var(--accordion-duration);
}
```

**Why good:** The name derives from the panel's own id, so several accordions on one page never
collide; clearing it in the `finished` handler is what keeps the next section's transition from
inheriting it.

---

## Pattern 11: List Reordering

### Good Example - Rows That Move Rather Than Redraw

```typescript
// list-transitions.ts

interface ListItem {
  id: string;
  label: string;
  order: number;
}

let items: ListItem[] = [];

function renderList(): void {
  const container = document.getElementById("sortable-list");
  if (!container) return;

  const sortedItems = [...items].sort((a, b) => a.order - b.order);

  container.replaceChildren(
    ...sortedItems.map((item) => {
      const li = document.createElement("li");
      li.dataset.itemId = item.id;
      li.style.viewTransitionName = `item-${item.id}`;
      li.textContent = item.label;
      return li;
    }),
  );
}

export function sortListBy(
  compareFn: (a: ListItem, b: ListItem) => number,
): void {
  const updateFn = () => {
    items = [...items].sort(compareFn);
    items.forEach((item, index) => {
      item.order = index;
    });
    renderList();
  };

  if (!document.startViewTransition) {
    updateFn();
    return;
  }

  document.startViewTransition(updateFn);
}

export function sortAlphabetically(): void {
  sortListBy((a, b) => a.label.localeCompare(b.label));
}

export function sortById(): void {
  sortListBy((a, b) => a.id.localeCompare(b.id));
}
```

**CSS:**

```css
:root {
  --list-reorder-duration: 300ms;
}

::view-transition-group(*) {
  animation-duration: var(--list-reorder-duration);
  animation-timing-function: ease-out;
}
```

**Why good:** A per-item name derived from the item id is what turns a full re-render into rows
sliding to their new positions — the browser matches the two snapshots by name, so it does not matter
that the elements themselves were replaced.

---

## Pattern 12: Reduced Motion

### Good Example - Both Layers Handled

```typescript
// accessible-transitions.ts

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export async function accessibleTransition(
  updateFn: () => void,
): Promise<void> {
  if (prefersReducedMotion() || !document.startViewTransition) {
    updateFn();
    return;
  }

  const transition = document.startViewTransition(updateFn);
  await transition.finished;
}

/** Subscribe to preference changes; returns an unsubscribe function. */
export function onReducedMotionChange(
  callback: (prefers: boolean) => void,
): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  const handler = (e: MediaQueryListEvent) => callback(e.matches);

  query.addEventListener("change", handler);
  return () => query.removeEventListener("change", handler);
}
```

**CSS:**

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation-duration: 0.01ms !important;
  }
}
```

**Why good:** The preference is read at call time rather than captured once, so a user changing it
mid-session is respected without a reload. The CSS layer is a backstop for any transition that starts
without going through this function.
