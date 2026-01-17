# CSS Transitions Examples

> State-triggered transition patterns. See [core.md](core.md) for basic examples.

---

## Pattern 1: Multi-Property Transitions

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

**Why good:** Each property explicitly listed with appropriate timing, filter uses slower duration for subtlety

### Bad Example - Using "all"

```css
.card {
  transition: all 0.3s ease;
}
```

**Why bad:** Transitions ALL properties including layout-triggering ones, unexpected behavior when new properties added, magic number

---

## Pattern 2: Different Timing Per Property

### Good Example - Staggered Property Timing

```css
.dropdown {
  /* Opacity fades faster than movement */
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

**Why good:** Opacity completes before movement for perception of speed, uses data attributes for state

---

## Pattern 3: Transition Delay for Sequencing

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

/* Stagger delays */
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

**Why good:** Creates staggered reveal effect, delays only apply on open (not close)

---

## Pattern 4: Transition Origin Control

### Good Example - Scale from Corner

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

/* Adjust origin based on position */
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

**Why good:** Scale animates from tooltip anchor point, spring easing adds polish, uses data attributes for positioning

---

## Pattern 5: Color Transitions

### Good Example - Theme-Aware Color Transition

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

/* Focus uses different color */
.button:focus-visible {
  background-color: var(--button-bg);
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

**Why good:** Color transitions are acceptable (repaint only), uses design tokens, maintains focus visibility

---

## Pattern 6: Accordion Expand/Collapse

### Good Example - Height Animation with Grid

```css
/* Modern approach using grid */
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

**Why good:** Grid-based height animation is more performant than animating height directly, no fixed heights needed

### Alternative - Max-Height Approach

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

**Why acceptable:** max-height approach works but requires estimating content height, timing can feel off if estimate is wrong

---

## Pattern 7: Transition on Enter Only

### Good Example - Appear Animation Without Exit

```css
.notification {
  /* No transition by default (instant exit) */
  opacity: 0;
  transform: translateY(var(--distance-sm));
}

.notification[data-state="visible"] {
  /* Transition only applies when entering */
  transition:
    opacity var(--duration-normal) var(--ease-out),
    transform var(--duration-normal) var(--ease-out);
  opacity: 1;
  transform: translateY(0);
}
```

**Why good:** Enter has animation, exit is instant (often desired for dismissing notifications)

---

## Pattern 8: Interactive States with Transitions

### Good Example - Complete Input Field

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

**Why good:** All states have smooth transitions, error state maintained through focus, uses data attribute for validation state

---

## Pattern 9: Link Underline Animation

### Good Example - Expanding Underline

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

/* Alternative: expand from center */
.link--center::after {
  transform-origin: center;
}
```

**Why good:** Uses transform: scaleX (GPU-accelerated), respects currentColor, configurable origin

---

## Pattern 10: Disabled State Transition

### Good Example - Smooth Disable/Enable

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

/* Prevent hover animation while disabled */
.button:disabled:hover,
.button[aria-disabled="true"]:hover {
  transform: none;
}
```

**Why good:** Smooth transition to disabled state, supports both disabled attribute and aria-disabled, prevents hover effects when disabled
