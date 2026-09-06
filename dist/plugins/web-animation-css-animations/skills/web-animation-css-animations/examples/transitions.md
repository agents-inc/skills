# CSS Animations - Transition Examples

> State-triggered transition patterns, continuing the numbering from
> [core.md](core.md).

**Prerequisites:** the token set from [core.md](core.md) Pattern 1 — every rule below reads
`--duration-*` and `--ease-*` from it.

---

## Pattern 11: Multi-Property Transitions

### Good Example - Explicit Property List

```css
.card {
  transition:
    transform var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out),
    filter var(--duration-normal) var(--ease-default);
}

.card:hover {
  transform: translateY(var(--lift-md));
  opacity: 0.95;
  filter: brightness(1.05);
}
```

**Why good:** Each property gets the timing that suits it — the filter runs slower so the brightness
shift is felt rather than seen.

### Bad Example - `all`

```css
.card {
  transition: all 0.3s ease;
}
```

**Why bad:** Transitions every property including layout-triggering ones, and silently picks up
whatever is added to the rule next.

---

## Pattern 12: Different Timing Per Property

### Good Example - Opacity Ahead of Movement

```css
.dropdown {
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-normal) var(--ease-out);
}

.dropdown[data-state="closed"] {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
  pointer-events: none;
}

.dropdown[data-state="open"] {
  opacity: 1;
  transform: translateY(0) scale(1);
}
```

**Why good:** Finishing the fade before the movement makes the menu feel faster than its slowest
property; `pointer-events: none` on the closed state keeps the invisible panel from swallowing
clicks.

---

## Pattern 13: Transition Delay for Sequencing

### Good Example - Menu Item Reveal

```css
.menu-item {
  opacity: 0;
  transform: translateX(-10px);
  transition:
    opacity var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.menu[data-state="open"] .menu-item {
  opacity: 1;
  transform: translateX(0);
}

.menu[data-state="open"] .menu-item:nth-child(1) {
  transition-delay: 0ms;
}
.menu[data-state="open"] .menu-item:nth-child(2) {
  transition-delay: 50ms;
}
.menu[data-state="open"] .menu-item:nth-child(3) {
  transition-delay: 100ms;
}
.menu[data-state="open"] .menu-item:nth-child(4) {
  transition-delay: 150ms;
}
```

**Why good:** The delays hang off the open state only, so closing collapses everything at once rather
than unwinding in slow motion.

---

## Pattern 14: Transform Origin Control

### Good Example - Scale from the Anchor

```css
.tooltip {
  --tooltip-scale-hidden: 0.9;

  transform-origin: bottom center;
  transform: scale(var(--tooltip-scale-hidden));
  opacity: 0;
  transition:
    transform var(--duration-fast) var(--ease-spring),
    opacity var(--duration-fast) var(--ease-out);
}

.tooltip[data-state="visible"] {
  transform: scale(1);
  opacity: 1;
}

.tooltip[data-position="top"] {
  transform-origin: bottom center;
}
.tooltip[data-position="bottom"] {
  transform-origin: top center;
}
.tooltip[data-position="left"] {
  transform-origin: right center;
}
.tooltip[data-position="right"] {
  transform-origin: left center;
}
```

**Why good:** The origin follows the placement attribute, so the tooltip always grows out of the
element it describes rather than out of its own centre.

---

## Pattern 15: Colour Transitions

### Good Example - Token-Driven Hover

```css
.button {
  --button-bg: var(--color-primary);
  --button-bg-hover: var(--color-primary-dark);

  background-color: var(--button-bg);
  color: var(--color-on-primary);
  transition: background-color var(--duration-fast) var(--ease-default);
}

.button:hover {
  background-color: var(--button-bg-hover);
}

.button:focus-visible {
  background-color: var(--button-bg);
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

**Why good:** Colour costs a repaint but no layout, so it is the one non-composited property worth
transitioning; focus resets the background so the ring is read against a known colour.

---

## Pattern 16: Accordion Expand and Collapse

### Good Example - Grid Row Animation

```css
.accordion-content {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--duration-normal) var(--ease-default);
}

.accordion-content > .inner {
  overflow: hidden;
}

.accordion[data-state="open"] .accordion-content {
  grid-template-rows: 1fr;
}
```

**Why good:** `0fr` to `1fr` animates to the content's real height, so nothing has to be measured and
no height is hard-coded. The inner wrapper's `overflow: hidden` is required — without it the content
spills out of the collapsing row.

### Alternative - Max-Height

```css
.accordion-content {
  --max-content-height: 500px;

  max-height: 0;
  overflow: hidden;
  transition: max-height var(--duration-normal) var(--ease-default);
}

.accordion[data-state="open"] .accordion-content {
  max-height: var(--max-content-height);
}
```

**Why acceptable:** Works everywhere, but the duration applies to the estimated height rather than
the real one, so an over-estimate leaves a visible pause at the end of the open.

---

## Pattern 17: Transition on Enter Only

### Good Example - Animated In, Instant Out

```css
.notification {
  opacity: 0;
  transform: translateY(var(--distance-sm));
}

.notification[data-state="visible"] {
  transition:
    opacity var(--duration-normal) var(--ease-out),
    transform var(--duration-normal) var(--ease-out);
  opacity: 1;
  transform: translateY(0);
}
```

**Why good:** Declaring the transition on the visible state rather than the base rule is what makes
the exit instant — dismissal should feel like the click landed, not like a wait.

---

## Pattern 18: Input Field States

### Good Example - Hover, Focus and Invalid

```css
.input-field {
  border: 1px solid var(--color-border);
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

.input-field:hover {
  border-color: var(--color-border-hover);
}

.input-field:focus {
  border-color: var(--color-focus);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
  outline: none;
}

.input-field[data-invalid="true"] {
  border-color: var(--color-error);
}

.input-field[data-invalid="true"]:focus {
  box-shadow: 0 0 0 3px var(--color-error-ring);
}
```

**Why good:** The invalid state survives focus, so a field being corrected still reads as the one in
error.

---

## Pattern 19: Link Underline

### Good Example - Expanding Rule

```css
.link {
  position: relative;
  text-decoration: none;
}

.link::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: -2px;
  width: 100%;
  height: 2px;
  background-color: currentColor;
  transform: scaleX(0);
  transform-origin: left;
  transition: transform var(--duration-fast) var(--ease-out);
}

.link:hover::after {
  transform: scaleX(1);
}

.link--center::after {
  transform-origin: center;
}
```

**Why good:** A full-width rule scaled from 0 animates on the compositor, where animating `width`
would relayout; the origin is the only thing a variant needs to change.

---

## Pattern 20: Disabled State

### Good Example - Both Disabled Spellings

```css
.button {
  opacity: 1;
  transition:
    transform var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
}

.button:disabled,
.button[aria-disabled="true"] {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.button:disabled:hover,
.button[aria-disabled="true"]:hover {
  transform: none;
}
```

**Why good:** `aria-disabled` covers controls that stay focusable so a screen reader can still reach
them, and the explicit hover reset stops a latched hover state from surviving the disable.
