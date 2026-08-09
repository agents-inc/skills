---
name: web-styling-theming
description: Runtime theming - applying a theme system to a live app without flash
---

# Runtime Theming Patterns

> **Quick Guide:** A theme is decided by two independent signals -- the OS preference (`prefers-color-scheme`) as the default and an explicit attribute on `<html>` as the override that wins in both directions. The attribute must be stamped by a synchronous inline script in `<head>` before first paint; anything running in an effect flashes on every load. Persist the _preference_ (`light | dark | system`), never the resolved value, so "system" stays a live subscription to the OS. Themes swap token _values_ under stable role names, one complete block per scope, with `color-scheme` declared in each so native UI follows. `next-themes` automates the script, the persistence, the live tracking, the attribute and the transition suppression -- but it cannot make server-rendered markup match, so `theme`, `resolvedTheme` and `systemTheme` are `undefined` until mount.

**Detailed Resources:**

- For code examples, see [examples/](examples/) folder:
  - [core.md](examples/core.md) - Dual signal CSS, pre-paint boot script, SSR and cookie theming, three-state preference module, `next-themes` contract, semantic token switching
  - [advanced.md](examples/advanced.md) - Multi-brand axis, nested theme scopes, portal caveats, transition suppression, reduced motion, browser chrome

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST stamp the theme attribute from a synchronous inline script in `<head>` before first paint - NEVER from `useEffect`, `useLayoutEffect`, or any code that runs after hydration)**

**(You MUST persist the preference - `light | dark | system` - NEVER the resolved value, because storing the resolved value permanently freezes every "system" user)**

**(You MUST make the OS preference the default and the explicit attribute the override, with the media query guarded by `:root:not([data-theme])` so the override wins in BOTH directions)**

**(You MUST declare `color-scheme` in every theme scope - it is the only thing that makes scrollbars, form controls and the overscroll canvas follow the theme, and it is never applied automatically to theme names outside `light`/`dark`)**

**(You MUST define the COMPLETE token key set in every theme block and reference role-named tokens from components - a token missing from one block silently inherits the other theme's value)**

</critical_requirements>

---

**Auto-detection:** prefers-color-scheme, color-scheme, data-theme, light-dark(), dark mode, theme toggle, theme switcher, theme flash, FOUC, flash of incorrect theme, next-themes, ThemeProvider, useTheme, resolvedTheme, systemTheme, forcedTheme, disableTransitionOnChange, enableColorScheme, suppressHydrationWarning, matchMedia prefers-color-scheme, theme-color meta, multi-brand theming, nested theme scope

**When to use:**

- Wiring OS preference and an explicit user override together so both are honoured
- Eliminating the flash of the wrong theme on first paint or on hydration
- Persisting a light/dark/system preference and keeping "system" live
- Swapping semantic token values per theme scope at runtime
- Adding a second axis (brand, tenant, contrast level) alongside light/dark
- Applying a theme scope to a subtree rather than the whole document
- Deciding what a theme provider library must own versus what CSS should own

**Key patterns covered:**

- The dual signal: guarded media query plus attribute override, and the `light-dark()` collapse
- FOUC-free boot: the pre-paint inline script, SSR markup matching, cookie-backed server render
- Three-state preference: storing intent rather than outcome, live OS subscription
- `next-themes`: verified prop and return-value contract, the mounted caveat, silent-failure modes
- Semantic token switching: stable role names, complete scope blocks, `color-scheme`, per-theme images
- Multi-brand as an orthogonal axis and nested scopes with their portal caveat
- Switch ergonomics: transition suppression with the required reflow, reduced motion, browser chrome

**When NOT to use:**

- The app has exactly one appearance and no plans for a second (no theme system needed)
- Only the OS preference matters and no in-app control is offered (a plain `prefers-color-scheme` block is the whole job)
- The change is per-user _content_ density or layout rather than appearance values

**Explicitly out of scope:**

| Concern                                                      | Belongs to                  |
| ------------------------------------------------------------ | --------------------------- |
| Authoring the token system - naming, scales, tiers, contrast | `web-styling-design-tokens` |
| Utility class usage and framework-level token configuration  | `web-styling-tailwind`      |
| Component variant APIs and variant-to-class mapping          | `web-styling-cva`           |

This skill assumes tokens already exist. It covers only what happens when a theme is applied to a running application.

---

<philosophy>

## Philosophy

Runtime theming is a **signal problem before it is a styling problem**. Two sources of truth arrive at different times: the OS preference is available to CSS on the very first byte, and the user's stored choice is available only once script or server has read storage. Every classic theming bug is a failure to order those two correctly.

**The three rules that follow from that:**

1. **CSS owns whatever CSS can own.** `prefers-color-scheme` is evaluated before first paint, tracks the OS live with no listener, works with JavaScript disabled, and costs nothing. Push "system" into CSS and the JavaScript layer shrinks to a single job: recording an explicit override.
2. **Absence is a state.** No attribute means "follow the system". That makes the default free, makes `removeAttribute` a meaningful action, and makes the stored preference and the DOM attribute distinct on purpose rather than by accident.
3. **Store intent, derive appearance.** The preference is input; the rendered theme is output. Storing the output destroys the input, and every "my dark mode stopped following my OS" bug traces back to that one substitution.

**What a theme actually is:** a set of values bound to stable role names within a scope. Adding a theme should be adding a block of values, never editing a component. The moment a component names a mode, the theme system has stopped being data and become branching logic.

**Ordering of concerns:**

| Question                         | Answer                                                         |
| -------------------------------- | -------------------------------------------------------------- |
| What theme is rendered?          | Attribute if present, otherwise the OS media query             |
| What did the user choose?        | The persisted preference - the only source of truth for the UI |
| What is the OS currently saying? | The media query, at all times, regardless of the active theme  |
| What do components reference?    | Role tokens only - never a mode, never a raw value             |

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: The Dual Signal

The OS preference is the default; the attribute on `<html>` is the override. The override must beat the OS in **both** directions -- explicit light on a dark OS and explicit dark on a light OS.

#### The Specificity Trap

`:root` and `[data-theme="dark"]` both score (0,1,0). With equal specificity, source order decides -- so an unguarded `@media (prefers-color-scheme: dark) { :root { ... } }` placed after the override rules silently defeats them. Guarding the media block raises it out of the tie and removes the ordering dependency entirely:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    /* (0,2,0) - applies only while no explicit choice exists */
    color-scheme: dark;
    --color-canvas: #0d0f12;
  }
}
```

#### The light-dark() Collapse

When the axis is exactly light/dark, `color-scheme` can be the only switch and every token value can be declared once (Baseline 2024; requires `color-scheme` to be `light dark`, and does nothing under the initial `normal`):

```css
:root {
  color-scheme: light dark;
  --color-canvas: light-dark(#ffffff, #0d0f12);
}
:root[data-theme="dark"] {
  color-scheme: dark;
}
```

For implementation examples, see [examples/core.md](examples/core.md#pattern-1-the-dual-signal).

---

### Pattern 2: FOUC-Free Boot

The attribute must exist before the first paint. Only a **synchronous inline script in `<head>`** runs early enough.

#### Why an Effect Is Structurally Too Late

Effects run after commit, and commit runs after the browser has painted the initial markup. On a server-rendered page the streamed HTML paints, _then_ hydration runs, _then_ effects fire -- so the flash is not a race that fast code can win, it is the defined order of operations. `useLayoutEffect` moves nothing: it still runs after hydration. In a client-only app the shell paints before the bundle even executes.

```html
<script>
  (function () {
    try {
      var stored = localStorage.getItem("theme-preference");
      if (stored === "light" || stored === "dark") {
        document.documentElement.setAttribute("data-theme", stored);
      }
    } catch (error) {}
  })();
</script>
```

The script stamps **only explicit choices**. "system" stamps nothing, which hands that case back to the media query -- free, live, and correct with no listener.

#### SSR Specifics

- `suppressHydrationWarning` on `<html>` -- the script mutates the element React also renders. It suppresses one level only, so it does not weaken checking for the subtree.
- Inline scripts need a **CSP nonce** (or hash) under a strict policy.
- When the server-rendered markup itself must carry the theme, persist to a **cookie** and emit the attribute during the server render. A cookie carries preference, not OS state -- which is fine, because CSS already owns "system".

For implementation examples, see [examples/core.md](examples/core.md#pattern-2-fouc-free-boot).

---

### Pattern 3: Three-State Preference

Persist `light | dark | system`. `system` means a **live subscription** to the OS, not a value resolved once at load.

#### Why the Third State Cannot Be Collapsed

Two states cannot express "follow the system", so a two-state toggle has to invent a value at first click, and whatever it writes freezes the user out of OS tracking permanently. Resolving `system` to `dark` at load and storing that is the same bug wearing a different hat: the OS switching at sunset now does nothing, and the fact that the user wanted tracking is unrecoverable.

#### Where Live Tracking Comes From

| Owner of "system" | How it stays live                         | Cost                          |
| ----------------- | ----------------------------------------- | ----------------------------- |
| CSS media query   | Automatic, re-evaluated by the browser    | Zero - no listener, no render |
| JavaScript        | `matchMedia().addEventListener("change")` | A listener and a re-render    |

Let CSS own it. Add the listener only for surfaces that genuinely cannot read CSS -- canvas, chart libraries, map tiles, an embedded document.

```ts
const query = window.matchMedia("(prefers-color-scheme: dark)");
query.addEventListener("change", (event) =>
  onChange(event.matches ? "dark" : "light"),
);
```

For implementation examples, see [examples/core.md](examples/core.md#pattern-3-three-state-preference).

---

### Pattern 4: next-themes

`next-themes` automates Patterns 2 and 3 for React: it injects the pre-paint script, persists the preference, tracks the system query live, stamps the attribute, sets `color-scheme`, syncs across tabs via the `storage` event, and can suppress transitions during the swap.

#### Contract Highlights

| Prop / value           | Verified behaviour                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `attribute`            | Defaults to `"data-theme"`; accepts `"class"`, any `data-*`, **or an array** of them    |
| `defaultTheme`         | Defaults to `enableSystem ? "system" : "light"` - conditional, not literally `"system"` |
| `enableSystem={false}` | Removes `"system"` from the list and makes `systemTheme` `undefined`                    |
| `enableColorScheme`    | On by default; sets `documentElement.style.colorScheme`                                 |
| `storageKey`           | Defaults to `"theme"`; **localStorage only - there is no cookie mode**                  |
| `themes` / `value`     | Arbitrary theme lists; `value` maps a theme name to the attribute value written         |
| `forcedTheme`          | Locks the page without touching the saved preference - hide the switcher when it is set |
| `nonce`                | Applied to the injected script **and** style elements                                   |
| `theme`                | The stored preference - can be `"system"`                                               |
| `resolvedTheme`        | What `"system"` resolved to; **identical to `theme`** for any non-system theme          |
| `systemTheme`          | The OS preference regardless of the active theme                                        |
| `setTheme`             | Accepts a value **or an updater function**                                              |

#### The Contract It Cannot Fulfil

Because the preference lives in localStorage, the **server cannot read it**: `theme`, `resolvedTheme` and `systemTheme` are all `undefined` on the server and during the first client render. Either drive the visual difference from CSS so it is correct on the first paint, or gate the component behind a `mounted` flag and reserve its layout. Note also that `color-scheme` is applied **only** for the theme names `light` and `dark` -- any custom theme name must declare it in CSS.

For implementation examples, see [examples/core.md](examples/core.md#pattern-4-next-themes).

---

### Pattern 5: Semantic Token Switching

A theme swaps token **values** under **stable role names**. One selector block per scope, each declaring the same complete key set.

#### Completeness Is the Invariant

A token present in the light block and missing from the dark block does not fail loudly -- it inherits the light value into the dark page. That is how near-white borders end up on near-black canvases. Keep the key sets identical; a token that genuinely should not change is still declared, with the same value.

#### color-scheme Is Not Optional

`color-scheme` in each scope is what makes the browser's own rendering follow the theme: scrollbars, form controls, date and colour pickers, spellcheck underlines, and the canvas behind the page (visible on overscroll). Without it a "dark" app keeps white scrollbars and blinding date pickers.

#### The Indirection Rule

Any generated or tooling-owned token layer that copies a value at definition time captures one theme's value forever. A one-hop `var()` reference defers resolution to use time, so the swap reaches through the generated layer:

```css
:root {
  --app-canvas: #ffffff;
}
:root[data-theme="dark"] {
  --app-canvas: #0d0f12;
}
.themed {
  --color-canvas: var(--app-canvas);
} /* referenced, not copied */
```

#### Per-Theme Images

`media` on `<source>` and on `<meta name="theme-color">` evaluates **only** the OS preference and is blind to the explicit override. Drive imagery from a token (`background-image: var(--image-hero)`) or from CSS visibility rules that read the same dual signal.

For implementation examples, see [examples/core.md](examples/core.md#pattern-5-semantic-token-switching).

---

### Pattern 6: Multi-Brand and Nested Scopes

Brand and mode are **orthogonal axes**: brand is chosen by the deployment, tenant or route; mode is chosen by the user and the OS. Two attributes (`data-brand` and `data-theme`) keep them independent, so adding a brand is one block of brand inputs rather than a duplicate of every mode.

#### Nested Scopes

The same attribute lower in the tree themes a subtree, because custom properties inherit through the DOM. Three implications:

- The nested block must declare the **complete** token set -- a partial scope produces mixed-mode UI.
- It must set its own `color-scheme` **and paint its own background**; it does not inherit the root canvas.
- **Portals escape it.** A modal or toast rendered into `document.body` resolves page tokens wherever it appears on screen. Render overlays inside the scope or copy the attribute onto the portal container. (`position: fixed` is fine -- inheritance follows the DOM, not the visual box.)

For implementation examples, see [examples/advanced.md](examples/advanced.md#pattern-6-multi-brand-and-nested-scopes).

---

### Pattern 7: Switch Ergonomics

The swap must be instant and silent. Any element with a `transition` on a colour property animates during the swap, and mismatched durations make the page tear through the change in waves.

#### The Reflow Is Load-Bearing

Inject a `* { transition: none !important }` style, **force a synchronous style recalculation**, apply the theme, then remove the style on the next tick. Without the forced read the injection and the swap coalesce into one recalculation and the transitions run anyway:

```ts
document.head.append(style);
applyTheme();
window.getComputedStyle(document.body); // forces the recalc - do not remove
setTimeout(() => style.remove(), 1);
```

This is exactly what `disableTransitionOnChange` does; enable it rather than reimplementing it.

#### Reduced Motion

An instant swap is the correct default for everyone, not a concession -- suppressing it is never an accessibility regression. If the switcher control itself animates, gate that behind `@media (prefers-reduced-motion: no-preference)`. Never animate a full-page colour crossfade for a reduced-motion user.

For implementation examples, see [examples/advanced.md](examples/advanced.md#pattern-7-switch-ergonomics).

</patterns>

---

<decision_framework>

## Decision Framework

### Who Owns "System"?

```
Does anything outside CSS need to know the rendered mode?
|-- NO --> CSS owns it: media query + no attribute for "system"
|          (live tracking is free, works without JS, correct on first paint)
|-- YES --> Which surfaces?
    |-- Canvas / charts / map tiles / embedded documents
    |   --> Add a matchMedia listener for THOSE surfaces only
    |-- Whole app "because it is easier"
        --> Reconsider - this reintroduces the flash and the render cost
```

### Where Does the Preference Live?

```
Must the SERVER-rendered HTML already carry the theme?
|-- NO --> localStorage + pre-paint inline script
|-- YES --> Cookie, read during the server render
    |-- Still need "system"? --> Yes, and CSS handles it; the cookie
                                 only carries explicit overrides
```

### Hand-Rolled or Provider Library?

```
React app, light/dark (+ named themes), localStorage is acceptable?
|-- YES --> Provider library - it already solves the script, persistence,
|           live tracking, cross-tab sync and transition suppression
|-- NO --> Hand-roll when:
    |-- The preference must be a cookie for server rendering
    |-- The framework is not React
    |-- Theme is derived from account data rather than device storage
```

### How Many Axes?

```
Is the second dimension chosen by the USER, like the mode is?
|-- YES --> A second user-facing axis: separate attribute, separate control
|-- NO --> Chosen by deployment / tenant / route?
    |-- YES --> Stamp it server-side as its own attribute; keep the mode
    |           axis untouched so the switcher stays brand-agnostic
    |-- NO --> It is not an axis - it is a token value; put it in the tokens
```

### Should This Difference Be a Theme at All?

```
Does it change VALUES bound to existing role names?
|-- YES --> A theme block
|-- NO --> Does it change which elements exist or how they are laid out?
    |-- YES --> Not a theme - that is a feature flag or a layout decision
    |-- NO --> Does it change one component's appearance only?
        |-- YES --> Not a theme - that is a component variant
                    (not this skill's scope)
```

</decision_framework>

---

<integration>

## Integration Notes

**Theme controller libraries:**

- `next-themes` - injects the pre-paint script, persists to localStorage, tracks the system query, stamps one or more attributes, sets `color-scheme`, syncs across tabs, suppresses transitions. Its boundary is the client: it cannot make server-rendered markup match, so anything that branches on theme during render must either be CSS-driven or gated behind a mounted flag.

**What this skill deliberately does not own:**

- **Token authoring** - naming, scales, tiers, contrast ratios and the token pipeline are a separate concern (`web-styling-design-tokens`). This skill starts from the assumption that role-named tokens exist.
- **Utility class usage and framework token configuration** - each utility framework has its own directive for referencing external variables; see that framework's skill (`web-styling-tailwind`). The framework-agnostic requirement is Pattern 5's indirection rule: the generated layer must **reference** the swappable variables, not copy their values.
- **Component variant APIs** (`web-styling-cva`). A variant is a choice within one theme; a theme is a set of values across all variants. If adding a theme requires touching a variant definition, the token layer is incomplete.

**Platform features this skill relies on:**

- `prefers-color-scheme`, `color-scheme` (Baseline since 2022), `light-dark()` for colours (Baseline 2024 -- image support is only now landing, so do not depend on it yet), `prefers-reduced-motion`, `forced-colors`, and `<meta name="theme-color">` (**not** Baseline; treat it as progressive enhancement).

</integration>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Applying the theme in `useEffect` / `useLayoutEffect` -- the page paints with the default theme and flips afterwards, producing a flash on **every** load that grows with bundle size
- Persisting `resolvedTheme` instead of the preference -- every "system" user is frozen at whatever the OS was at first load and never tracks the OS again
- A `.dark` class (or any attribute) with no `prefers-color-scheme` default -- first-time visitors on a dark OS get a white flash of a light app until they find the toggle
- Media-query-only theming with no override -- the user is told what their theme is and cannot choose otherwise
- An unguarded `@media (prefers-color-scheme: dark) { :root { ... } }` after the override rules -- equal specificity means source order wins, so explicit light on a dark OS silently fails
- Mode-named tokens (`--color-white`, `--gray-900`) referenced by components -- each new theme then requires editing every component, and the names become lies
- A theme scope that overrides only some tokens -- the rest inherit the other theme and produce contrast failures no single rule looks wrong enough to reveal
- Omitting `color-scheme` -- white scrollbars, blinding date pickers and a light overscroll canvas on a "dark" app
- Reading `localStorage` in the boot script without `try`/`catch` -- it throws in privacy modes and sandboxed iframes, and because it runs before paint an uncaught throw blanks the page

**Medium Priority Issues:**

- A toggle that reads `document.documentElement.dataset.theme` instead of the stored preference -- the attribute is absent for "system" users, so the first click appears to do nothing and cross-tab changes desync it
- A two-state toggle in a three-state system -- "system" becomes unreachable after the first click
- `transition` on colour properties applied to `*` -- turns every swap into a full-page repaint and makes every hover feel sluggish for the life of the app
- Missing `suppressHydrationWarning` on `<html>` -- a hydration warning on every SSR page load, which trains the team to ignore hydration warnings
- `<picture>` / `<source media="(prefers-color-scheme: dark)">` for theme imagery -- blind to the explicit override, so the hero contradicts the page
- Custom theme names without an explicit `color-scheme` -- no theme controller applies one outside `light`/`dark`
- Rendering portalled overlays outside the theme scope that opened them -- the modal resolves page tokens instead of the scope's
- Branding baked into component rules instead of the token layer -- brand count multiplies component rules and bypasses per-mode contrast adjustment

**Common Mistakes:**

- Putting the theme attribute or `color-scheme` on `<body>` instead of `<html>` -- the area outside the body (visible on overscroll) keeps the old canvas
- Stamping `data-theme="light"` for the "system" case -- absence is the state that means "follow the OS"; writing a value opts out of live tracking
- Storing the preference under a generic key such as `theme` on a shared origin, where another app on the same host overwrites it
- Suppressing transitions without forcing a reflow -- the injection and the swap batch into one recalculation and the transitions run anyway
- Reserving no layout for a switcher gated behind a mounted flag -- the page shifts as it appears
- Rendering a theme switcher outside its provider -- the default context is a no-op, so nothing throws and clicks silently do nothing

**Gotchas and Edge Cases:**

- `:root` and `[data-theme="x"]` have identical (0,1,0) specificity -- ordering, not intent, decides which wins unless `:not()` breaks the tie
- `resolvedTheme` equals `theme` for every non-system theme; it is not "the dark/light resolution" of an arbitrary theme name
- `systemTheme` reports the OS preference **regardless** of the active theme, which is what a "follows your system (currently dark)" label should read
- `light-dark()` silently does nothing when `color-scheme` is `normal`; colours are Baseline 2024 but image support is only now arriving
- A dark theme prints as a page of black ink -- add `@media print { :root { color-scheme: light; /* light token values */ } }`
- An `<iframe>` gets neither your custom properties nor your `color-scheme`; embedded documents need their own signal passed in
- Back/forward-cache restores do **not** re-run the boot script; if JavaScript owns the resolution, handle `pageshow` with `event.persisted`. CSS-owned "system" is immune
- Forced-colors mode (Windows High Contrast) replaces your palette wholesale. Do not fight it -- inside `@media (forced-colors: active)` use system colour keywords and reserve `forced-color-adjust: none` for the rare element that loses meaning
- `<meta name="theme-color">` is not supported everywhere and its `media` attribute cannot see the override, so an explicit choice must update the tag imperatively
- Cross-tab sync arrives through the `storage` event, which fires in **other** tabs only -- a tab never receives its own write

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST stamp the theme attribute from a synchronous inline script in `<head>` before first paint - NEVER from `useEffect`, `useLayoutEffect`, or any code that runs after hydration)**

**(You MUST persist the preference - `light | dark | system` - NEVER the resolved value, because storing the resolved value permanently freezes every "system" user)**

**(You MUST make the OS preference the default and the explicit attribute the override, with the media query guarded by `:root:not([data-theme])` so the override wins in BOTH directions)**

**(You MUST declare `color-scheme` in every theme scope - it is the only thing that makes scrollbars, form controls and the overscroll canvas follow the theme, and it is never applied automatically to theme names outside `light`/`dark`)**

**(You MUST define the COMPLETE token key set in every theme block and reference role-named tokens from components - a token missing from one block silently inherits the other theme's value)**

**Failure to follow these rules produces a theme that flashes on every load, ignores the user's explicit choice, or renders half in one theme and half in the other.**

</critical_reminders>
