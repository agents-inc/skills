---
name: web-animation-view-transitions
description: View Transitions API patterns - same-document transitions, cross-document navigation, shared element animations, pseudo-element styling, transition types, reduced-motion handling
---

# View Transitions API Patterns

> **Quick Guide:** The browser screenshots the old state, holds the new one live, and animates
> between them as a tree of pseudo-elements. `document.startViewTransition()` drives a same-document
> change; `@view-transition { navigation: auto }` on both pages drives a cross-document one.
> `view-transition-name` pulls an element out of the root snapshot so it can travel on its own, and
> the whole animation is customised in CSS rather than in script.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — feature detection, state transitions, the three promises, skipping, CSS overrides
- [examples/spa.md](examples/spa.md) — theme reveal, form steps, tab panels, accordions, list reordering, reduced motion
- [examples/shared-elements.md](examples/shared-elements.md) — hero animations, multi-element cards, cross-document pairs, modals
- [reference.md](reference.md) — naming rules, pseudo-element tree, browser support, API tables

---

## Which path applies

- **Client routing or in-page state, with the DOM updated by script** — `startViewTransition()` takes
  the update as a callback and captures around it; follow [examples/spa.md](examples/spa.md).
- **Server-rendered pages navigating to each other** — no script at all: both documents opt in with
  `@view-transition { navigation: auto }`, and names are set through the `pageswap` and `pagereveal`
  events; follow [examples/shared-elements.md](examples/shared-elements.md).
- **One element has to travel between the two states rather than cross-fade with everything else** —
  it needs a `view-transition-name` matched on both sides; follow
  [examples/shared-elements.md](examples/shared-elements.md).

---

<critical_requirements>

## Before writing View Transitions code

**Guard `startViewTransition` behind a support check, and run the update either way.** The call is
absent rather than inert where the API is unimplemented, so an unguarded call throws and the DOM
change never happens at all.

**Give each participating element a name no other visible element carries.** The name identifies one
snapshot; two visible elements claiming the same one abort the whole transition, not just their own
part of it.

**Clear a dynamically assigned `view-transition-name` once `transition.finished` resolves.** A name
left on an element collides with the next transition that assigns it, which is why the failure shows
up on the second navigation rather than the first.

**Give every customised transition a `prefers-reduced-motion` branch.** A page-level transition moves
the entire viewport, which is the class of motion the preference exists for; collapse the duration or
skip the transition and apply the update directly.

</critical_requirements>

---

**Auto-detection:** startViewTransition, view-transition-name, view-transition-class,
@view-transition, ::view-transition-old, ::view-transition-new, ::view-transition-group,
::view-transition-image-pair, :active-view-transition-type, pageswap, pagereveal, updateCallbackDone,
skipTransition, match-element

**Applies to:**

- State changes large enough that the whole view, or a large region of it, is replaced
- Page-to-page navigation in server-rendered sites
- Hero animations where one element persists across two views
- Direction-aware navigation, where forward and back need opposite motion
- Reordering, where elements move rather than change

**Handled elsewhere:**

- Hover, focus and pressed feedback on a single control — nothing is being replaced, so there is no
  before-and-after pair to capture
- Motion whose velocity carries across an interruption, such as a spring picked up mid-gesture
- Frame-level timeline authoring, where the deliverable is a scrubbable timeline

---

<philosophy>

A view transition is a screenshot and a live view, animated against each other. Everything follows
from that: the old side is inert pixels, so anything moving inside it freezes; naming an element
lifts it into its own snapshot pair with its own animation; and the whole tree is styled with CSS
because it is a tree of pseudo-elements, not a script-driven animation.

The DOM update itself stays ordinary. `startViewTransition` wraps a change that would have happened
anyway, which is why the fallback for an unsupported browser is simply making the change.

</philosophy>

---

<decision_framework>

## Which snapshot the element belongs to

```
Does an element exist on both sides and represent the same thing?
├─ YES -> give it one view-transition-name on both sides; it gets its own group and travels
└─ NO  -> leave it in the root snapshot; it cross-fades with everything else around it
```

Each named element adds a group, an image pair and two snapshots to the tree, so naming everything
costs more than it buys — name what a reader would follow with their eyes.

## Default or custom animation

```
Cross-fade at a different duration    -> set animation-duration on ::view-transition-old/new(root)
Slide, scale, wipe                    -> keyframes on the old and new pseudo-elements
Direction-dependent motion            -> a transition type, selected with :active-view-transition-type()
Geometry computed at the moment of the transition (a reveal from a click point)
                                      -> await transition.ready, then animate the pseudo-element
```

## Where the name is set

CSS is right for an element that is unique on the page — a header, a hero, a single panel. Script is
right for anything appearing more than once, because a static rule over a list gives every row the
same name and breaks the transition; assign per element before the transition and clear after it, or
use `view-transition-name: match-element` where support allows.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Feature Detection with Fallback

```typescript
const SUPPORTS_VIEW_TRANSITIONS =
  typeof document !== "undefined" && "startViewTransition" in document;

function updateWithTransition(updateFn: () => void | Promise<void>): void {
  if (!SUPPORTS_VIEW_TRANSITIONS) {
    updateFn();
    return;
  }
  document.startViewTransition(() => updateFn());
}
```

The `typeof document` guard matters during server rendering, where there is no `document` to probe.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Same-Document Transitions

The callback performs the DOM update; the browser captures before calling it and again after it
resolves.

```typescript
const transition = document.startViewTransition(async () => {
  await updateFn();
});

// Options form: classify the transition for CSS to select on
const transition = document.startViewTransition({
  update: () => updateDOM(),
  types: ["slide-forward"],
});

await transition.finished;
```

| Promise                         | Resolves when                                        |
| ------------------------------- | ---------------------------------------------------- |
| `transition.updateCallbackDone` | The DOM update callback has finished                 |
| `transition.ready`              | The pseudo-element tree exists and animation is next |
| `transition.finished`           | The animation is over and the new view is live       |

An `async` callback holds the page frozen until it resolves, so anything slow inside it is a visible
stall — update to a loading state rather than awaiting a network round trip.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Cross-Document Transitions

```css
/* on both the source and the destination document */
@view-transition {
  navigation: auto;
}
```

No script and no router involvement; it covers push, replace and traverse navigations within one
origin. Only one side opting in yields no transition at all.

Full code: [examples/shared-elements.md](examples/shared-elements.md)

---

### Pattern 4: Shared Element Transitions

Matching names on either side of the change make one element travel instead of cross-fading.

```css
.product-thumbnail {
  view-transition-name: product-hero;
}
.product-image {
  view-transition-name: product-hero;
}

::view-transition-group(product-hero) {
  animation-duration: var(--hero-duration);
  animation-timing-function: var(--hero-easing);
}
```

The group animates position and size; the image pair cross-fades the two snapshots inside it. Where
the two sides differ in aspect ratio, `object-fit` on the old and new pseudo-elements stops the
snapshot squashing.

Full code: [examples/shared-elements.md](examples/shared-elements.md)

---

### Pattern 5: Custom CSS Animations

The default cross-fade is a UA stylesheet animation on the old and new pseudo-elements; overriding it
is ordinary CSS.

```css
::view-transition-old(root) {
  animation: slide-out-left var(--transition-duration) var(--transition-easing);
}
::view-transition-new(root) {
  animation: slide-in-right var(--transition-duration) var(--transition-easing);
}
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 6: Direction-Aware Transitions

A transition type is a label the CSS can select on, so forward and back share one set of keyframes
and differ only in which pair is applied.

```css
html:active-view-transition-type(forwards) {
  &::view-transition-old(content) {
    animation-name: slide-out-left;
  }
  &::view-transition-new(content) {
    animation-name: slide-in-right;
  }
}

html:active-view-transition-type(backwards) {
  &::view-transition-old(content) {
    animation-name: slide-out-right;
  }
  &::view-transition-new(content) {
    animation-name: slide-in-left;
  }
}
```

```typescript
document.startViewTransition({
  update: () => navigateForward(),
  types: ["forwards"],
});
```

`transition.types` is a mutable set on an existing transition, for the case where the direction is
only known after the update has started.

Full code: [examples/spa.md](examples/spa.md)

---

### Pattern 7: Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation-duration: 0.01ms !important;
  }
}
```

```typescript
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function shouldEnableTransitions(): boolean {
  if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return false;
  return "startViewTransition" in document;
}
```

The CSS form collapses the animation while keeping the transition machinery, which is enough for a
cross-fade. The script form skips the transition entirely, which is the honest answer for a
full-viewport slide or a reveal. Between them sits a third: cancel the animation on
`::view-transition-group(*)`, which is what carries the size and position change, and leave the old
and new pseudo-elements cross-fading. That drops the travel without dropping the feedback.

Full code: [examples/spa.md](examples/spa.md)

---

### Pattern 8: Geometry Computed at Transition Time

Where the animation depends on something known only at the moment of the click, await
`transition.ready` and animate the pseudo-element directly.

```typescript
const transition = document.startViewTransition(updateFn);
await transition.ready;

document.documentElement.animate(
  {
    clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`],
  },
  {
    duration: REVEAL_DURATION_MS,
    easing: REVEAL_EASING,
    pseudoElement: "::view-transition-new(root)",
  },
);
```

The animation targets the document element with a `pseudoElement` option, because the pseudo-element
has no node of its own to address.

Full code: [examples/spa.md](examples/spa.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `document.startViewTransition(...)` with no support check — throws where the API is absent, so the
  DOM update is lost along with the animation — branch on `"startViewTransition" in document`
- Two visible elements carrying the same `view-transition-name` — the whole transition is abandoned,
  including the parts that were correct — assign per element from script, or use `match-element`
- A `view-transition-name` set in CSS on a list selector — every row claims the same name — set it
  from script before the transition and clear it after
- A name left assigned after `transition.finished` — collides on the next transition, so the failure
  appears one navigation later than the cause — clear it in the `finished` handler
- `@view-transition` on only one of the two documents — cross-document transitions need both sides to
  opt in — add the at-rule to the destination as well
- Animating a pseudo-element before `transition.ready` resolves — the tree does not exist yet and the
  animation silently targets nothing — await the promise first
- No `prefers-reduced-motion` branch — a full-viewport slide reaches users who asked for none — add
  the media query, or skip the transition in script
- `<meta name="view-transition" content="same-origin">` — obsolete and ignored — use the
  `@view-transition` at-rule

**Surprising behaviour:**

- The old side is a screenshot, so video, GIFs and running animations freeze in it; the new side is
  live and keeps playing
- Names are document-global, so the same name on two unrelated sections conflicts even when they are
  far apart
- The page is inert for the duration of the transition, which puts a long animation directly into
  interaction latency — under 300ms for anything on a navigation path
- Cross-document transitions require same-origin navigation
- `match-element` needs Chrome 137+ or Safari 18.4+ and is unavailable in Firefox
- A `pagereveal` handler registered late misses the event — put it in `<head>`, or mark the script
  `blocking="render"`
- `auto`, `inherit`, `none` and `unset` are CSS-wide keywords rather than custom identifiers, so they
  cannot be used as names

</red_flags>
