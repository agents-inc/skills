# Runtime Theming - Advanced Examples

> Multi-brand theming, nested theme scopes, and switch ergonomics. See [SKILL.md](../SKILL.md) for concepts and decision frameworks.

**Prerequisites:** Understand [Pattern 1: The Dual Signal](core.md#pattern-1-the-dual-signal) and [Pattern 5: Semantic Token Switching](core.md#pattern-5-semantic-token-switching) first.

**Additional Examples:**

- [Core Patterns](core.md) - Dual signal, FOUC-free boot, three-state preference, provider contract, token switching

---

## Pattern 6: Multi-Brand and Nested Scopes

Brand and mode are **orthogonal axes**. A brand is chosen by the deployment, the tenant, or the route; a mode is chosen by the user and the OS. Flattening them into one list (`acme-light`, `acme-dark`, `umbra-light`, `umbra-dark`) multiplies entries and forces the mode switcher to know which brand it is in.

### Good Example - Two Attributes, Two Axes

```css
/* ✅ Good Example - brand sets the palette, mode sets the rendering of that palette */

/* Axis 1: brand-neutral role tokens, defined once */
:root {
  color-scheme: light;
  --color-canvas: #ffffff;
  --color-ink: #14161a;
  --color-accent: var(--brand-accent-light);
  --color-accent-ink: #ffffff;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --color-canvas: #0d0f12;
  --color-ink: #e8eaed;
  --color-accent: var(--brand-accent-dark);
  --color-accent-ink: #0d0f12;
}

/* Axis 2: brand supplies only the brand-specific inputs */
:root[data-brand="acme"] {
  --brand-accent-light: #2563eb;
  --brand-accent-dark: #6ea8ff;
}

:root[data-brand="umbra"] {
  --brand-accent-light: #b4530a;
  --brand-accent-dark: #ffab6b;
}
```

**Why good:** adding a brand is one block of brand inputs rather than a full duplicate of every mode, the mode switcher never needs to know the brand, and `data-brand` can be stamped server-side from the tenant while `data-theme` stays client-owned

### Good Example - Flattened Names When the Controller Owns One Attribute

```tsx
// ✅ Good Example - when the theme controller manages a single attribute value,
// map names to attribute values instead of encoding the axes in the name
<ThemeProvider
  attribute="data-theme"
  themes={["light", "dark", "high-contrast"]}
  value={{ light: "light", dark: "dark", "high-contrast": "hc" }}
/>
```

```css
/* Custom theme names get NO automatic color-scheme - declare it yourself */
:root[data-theme="hc"] {
  color-scheme: dark;
  --color-canvas: #000000;
  --color-ink: #ffffff;
  --color-border: #ffffff;
}
```

**Why good:** `value` decouples the stored preference name from the attribute value so the CSS selector stays short, and declaring `color-scheme` manually is mandatory here -- theme names outside `light`/`dark` are never given one automatically, which is exactly how a custom dark theme ends up with white scrollbars

### Good Example - Nested Theme Scope

```css
/* ✅ Good Example - a dark section inside a light page */

/* Every scope-capable block declares the COMPLETE token set, not a subset.
   Hoisting the shared blocks into a class lets :root and a section share them. */
:root,
[data-theme="light"] {
  color-scheme: light;
  --color-canvas: #ffffff;
  --color-surface: #f5f6f8;
  --color-ink: #14161a;
  --color-ink-muted: #5b6371;
  --color-border: #d8dce3;
}

[data-theme="dark"] {
  color-scheme: dark;
  --color-canvas: #0d0f12;
  --color-surface: #15181d;
  --color-ink: #e8eaed;
  --color-ink-muted: #9aa3b2;
  --color-border: #2a2f38;
}

/* A scope must paint its own canvas - it does not inherit the root background */
[data-theme] {
  background: var(--color-canvas);
  color: var(--color-ink);
}
```

```html
<body>
  <main><!-- light page --></main>

  <!-- ✅ The same attribute, applied lower in the tree -->
  <section data-theme="dark">
    <h2>Pricing</h2>
    <input
      type="date"
    /><!-- native picker follows because color-scheme is on the section -->
  </section>
</body>
```

**Why good:** custom properties inherit through the DOM so everything inside the section re-resolves against the dark values, `color-scheme` on the section makes native controls inside it match, and the block being complete means no token can fall back to the light value

**Portal caveat:** a modal, tooltip or toast rendered into `document.body` is outside the section in the DOM, so it resolves the page tokens no matter where it appears on screen. Either render the overlay inside the scope, or copy the scope attribute onto the portal container when opening it. (`position: fixed` inside the scope is fine -- custom property inheritance follows the DOM, not the visual box.)

### Bad Example - Partial Scope

```css
/* ❌ Bad Example - overrides two tokens and inherits the rest */
.dark-section {
  --color-canvas: #0d0f12;
  --color-ink: #e8eaed;
}
```

**Why bad:** `--color-surface`, `--color-border` and every other unlisted token keep their light values, producing near-white cards and hairlines on a near-black canvas -- a contrast failure that no single rule looks wrong enough to reveal, and it worsens silently every time a token is added to the root block

### Bad Example - Brand Baked into Component Rules

```css
/* ❌ Bad Example - the component knows the brand */
.button--acme {
  background: #2563eb;
}
.button--umbra {
  background: #b4530a;
}
```

**Why bad:** the brand count now multiplies every component's rule count, the values bypass the token layer so the dark theme cannot adjust them for contrast, and onboarding a brand means editing components instead of adding data

---

## Pattern 7: Switch Ergonomics

The swap itself must be instant and silent. Any element carrying a `transition` on a colour property will animate during the swap, and because durations differ across the tree the page tears through the change in waves.

### Good Example - Suppress Transitions Across the Swap

```ts
const TRANSITION_KILL_CSS =
  "*,*::before,*::after{transition:none!important;animation:none!important}";

// ✅ Good Example - inject, force a reflow, swap, release on the next tick
function applyThemeWithoutTransition(apply: () => void): void {
  const style = document.createElement("style");
  style.append(document.createTextNode(TRANSITION_KILL_CSS));
  document.head.append(style);

  apply();

  // Reading a computed style forces a synchronous style recalculation, which
  // guarantees the browser applies the swap WHILE transitions are still off.
  // Without this the whole block can be batched into one frame and animate anyway.
  window.getComputedStyle(document.body);

  setTimeout(() => style.remove(), 1);
}

export { applyThemeWithoutTransition };
```

**Why good:** the forced reflow is the load-bearing line -- without it the injection and the swap coalesce into a single style recalculation and the transitions still run, `!important` on a universal selector beats any author transition for the one frame it exists, removing the style on the next tick restores normal hover and focus transitions immediately

**Library equivalent:** `disableTransitionOnChange` on `ThemeProvider` performs exactly this sequence. Enable it rather than reimplementing it; write this by hand only when the theme controller is your own.

### Good Example - Motion Only When Motion Is Wanted

```css
/* ✅ Good Example - an instant swap is the correct default, not a compromise */
@media (prefers-reduced-motion: no-preference) {
  .theme-switcher__thumb {
    transition: transform 150ms ease-out;
  }
}
```

**Why good:** the control's own thumb animation is opt-in for users who want motion, while the theme swap itself stays instant for everyone -- suppressing the swap animation is never an accessibility regression, whereas a full-page colour crossfade for a reduced-motion user is

### Good Example - Keeping Browser Chrome in Step

```html
<!-- Declarative pair covers the system case with no JavaScript -->
<meta
  name="theme-color"
  content="#ffffff"
  media="(prefers-color-scheme: light)"
/>
<meta
  name="theme-color"
  content="#0d0f12"
  media="(prefers-color-scheme: dark)"
/>
```

```ts
// ✅ Good Example - the media attribute cannot see data-theme, so an explicit
// override has to update the tag directly (progressive enhancement - the tag is
// honoured by some browsers and ignored by others)
// Call AFTER the theme attribute has been applied, so the token already resolves
// to the active theme's value
function syncBrowserChrome(): void {
  const canvas = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-canvas")
    .trim();
  const tags = document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );

  tags.forEach((tag) => tag.removeAttribute("media"));
  tags.item(0)?.setAttribute("content", canvas);
}

export { syncBrowserChrome };
```

**Why good:** reading the resolved token means the chrome colour cannot drift from the canvas colour, and stripping `media` stops the declarative pair from fighting the explicit override

### Bad Example - A Global Colour Transition

```css
/* ❌ Bad Example - "smooth theming" applied to everything */
* {
  transition:
    background-color 300ms ease,
    color 300ms ease,
    border-color 300ms ease;
}
```

**Why bad:** every theme swap becomes a 300ms repaint of every element on the page, which janks badly on long documents, and the same rule makes every hover, focus and selection change feel sluggish for the entire life of the app -- the cost is paid constantly for an effect seen once per session

### Bad Example - Icon-Only Toggle with No Accessible Name

```tsx
// ❌ Bad Example - the control's purpose and state are invisible to assistive tech
<button onClick={toggle}>
  <MoonIcon />
</button>
```

**Why bad:** the button announces as "button" with no name, and nothing communicates whether the moon means "currently dark" or "switch to dark" -- an ambiguity sighted users resolve from context and screen reader users cannot
