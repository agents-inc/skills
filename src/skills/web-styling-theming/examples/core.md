# Runtime Theming - Core Examples

> Essential patterns for applying a theme system to a live app. See [SKILL.md](../SKILL.md) for decision guidance and [reference.md](../reference.md) for the provider contract and the specificity table.

**Additional Examples:**

- [Advanced Patterns](advanced.md) - Multi-brand axis, nested theme scopes, switch ergonomics, reduced motion

---

## Pattern 1: The Dual Signal

Two independent inputs decide the rendered theme: the OS preference (`prefers-color-scheme`) and the user's explicit choice (an attribute on `<html>`). The OS preference is the **default**; the attribute is the **override**, and it must win in _both_ directions -- explicit light on a dark OS, explicit dark on a light OS.

### Good Example - Guarded Media Query Plus Attribute Override

```css
/* ✅ Good Example - OS preference is the default, the attribute is the override */
:root {
  color-scheme: light;
  --app-canvas: #ffffff;
  --app-ink: #14161a;
  --app-border: #d8dce3;
}

/* Applies only while the user has expressed no explicit choice.
   :root:not([data-theme]) scores (0,2,0) and beats the (0,1,0) override
   rules below regardless of source order. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    color-scheme: dark;
    --app-canvas: #0d0f12;
    --app-ink: #e8eaed;
    --app-border: #2a2f38;
  }
}

/* Explicit override - wins in BOTH directions */
:root[data-theme="light"] {
  color-scheme: light;
  --app-canvas: #ffffff;
  --app-ink: #14161a;
  --app-border: #d8dce3;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --app-canvas: #0d0f12;
  --app-ink: #e8eaed;
  --app-border: #2a2f38;
}
```

**Why good:** first-time visitors get their OS preference with no JavaScript at all, an explicit choice beats the OS in either direction, `:not([data-theme])` removes the specificity tie so the rules cannot be reordered into a bug, absence of the attribute is a meaningful state ("follow the system") rather than a missing value

### Good Example - Collapsing the Duplication with light-dark()

```css
/* ✅ Good Example - token values declared once, color-scheme is the only switch */
:root {
  /* Required: light-dark() resolves against the used color-scheme.
     With `normal` (the initial value) it does not work. */
  color-scheme: light dark;

  --app-canvas: light-dark(#ffffff, #0d0f12);
  --app-ink: light-dark(#14161a, #e8eaed);
  --app-border: light-dark(#d8dce3, #2a2f38);
}

/* The override is now one declaration instead of a whole palette */
:root[data-theme="light"] {
  color-scheme: light;
}

:root[data-theme="dark"] {
  color-scheme: dark;
}
```

**Why good:** every token value lives in exactly one place so a light/dark pair cannot drift apart, the system default is implicit in `color-scheme: light dark`, the override rules shrink to a single property, `light-dark()` for colors is Baseline 2024

**When not to use:** the axis has more than two values (a third named theme still needs its own block), or you need the raw values readable by JavaScript per mode -- `getComputedStyle` returns the _resolved_ color, not the pair

### Bad Example - Unguarded Media Query

```css
/* ❌ Bad Example - the OS preference silently overrides the user's choice */
:root[data-theme="dark"] {
  --app-canvas: #0d0f12;
}

@media (prefers-color-scheme: dark) {
  :root {
    --app-canvas: #0d0f12;
  }
}
```

**Why bad:** `:root` and `[data-theme="dark"]` both score (0,1,0), so source order decides and the later media block wins -- a user on a dark OS who explicitly picks light stays dark forever, the toggle appears broken and the bug moves whenever the stylesheets are reordered or concatenated differently

### Bad Example - Class-Only, No System Default

```css
/* ❌ Bad Example - the OS preference is never consulted */
:root {
  --app-canvas: #ffffff;
}

.dark {
  --app-canvas: #0d0f12;
}
```

**Why bad:** every first-time visitor on a dark OS gets a white flash of a light app until they find the toggle, the app ignores a preference the browser already reported for free, and dark rendering now depends entirely on JavaScript having run

---

## Pattern 2: FOUC-Free Boot

The attribute must be on `<html>` **before the first paint**. Only a synchronous inline script in `<head>` runs early enough. A React effect is structurally too late: effects run after commit, and commit happens after the browser has already painted the initial markup -- so the page paints light, then flips. `useLayoutEffect` does not help either; on a server-rendered page it runs after hydration, and hydration happens after the streamed HTML has painted.

### Good Example - Minimal Pre-Paint Script

```html
<!-- In <head>, as early as possible, before stylesheets that depend on it -->
<!-- ✅ Good Example - synchronous, inline, dependency-free -->
<script nonce="%CSP_NONCE%">
  (function () {
    try {
      var stored = localStorage.getItem("theme-preference");
      /* Only explicit choices are stamped. "system" and "unset" stamp nothing,
         which lets the prefers-color-scheme rules from Pattern 1 own that case. */
      if (stored === "light" || stored === "dark") {
        document.documentElement.setAttribute("data-theme", stored);
      }
    } catch (error) {
      /* localStorage throws in some privacy modes and in sandboxed iframes.
         An uncaught throw here happens before first paint and blanks the page. */
    }
  })();
</script>
```

**Why good:** runs before paint so there is no flash, `try`/`catch` keeps a storage failure from taking down the whole document, stamping nothing for "system" means live OS tracking comes free from CSS with no listener and no re-render, the script has no imports so it cannot be delayed by the bundle

### Good Example - SSR Markup That Matches

```tsx
// ✅ Good Example - the root element React renders is also the element the script mutates
export function Document({ children, nonce }: DocumentProps) {
  return (
    // suppressHydrationWarning silences the attribute mismatch on THIS element only.
    // It is one level deep - it does not disable checking for the subtree.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**Why good:** the warning is suppressed exactly where the intentional mismatch is, the nonce satisfies a strict CSP that would otherwise block the inline script, no component in the tree branches on theme so nothing else can mismatch

### Good Example - Cookie-Backed Server Render

```tsx
// ✅ Good Example - when the SERVER-rendered HTML itself must carry the theme
const THEME_COOKIE = "theme-preference";
const EXPLICIT_THEMES = ["light", "dark"] as const;

function readThemeAttribute(cookieValue: string | undefined) {
  // Cookies are untrusted input - validate against the known set, never interpolate raw
  return EXPLICIT_THEMES.find((theme) => theme === cookieValue);
}

export function renderDocument(cookieValue: string | undefined) {
  const dataTheme = readThemeAttribute(cookieValue);

  return (
    <html lang="en" data-theme={dataTheme}>
      {/* ... */}
    </html>
  );
}
```

**Why good:** the server emits the correct attribute so server and client markup agree with no client script at all, validating against a known list stops a hostile cookie from injecting an attribute value

**Key limitation:** a cookie carries the _preference_, not the OS state. The server cannot know what `prefers-color-scheme` resolves to. This is fine precisely because Pattern 1 lets CSS handle "system" -- the cookie only ever needs to carry explicit overrides.

### Bad Example - Applying the Theme in an Effect

```tsx
// ❌ Bad Example - guarantees a flash on every single page load
export function ThemeApplier() {
  const [theme, setTheme] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("theme-preference");
    setTheme(stored);
    document.documentElement.setAttribute("data-theme", stored ?? "light");
  }, []);

  return null;
}
```

**Why bad:** the effect runs after the first paint, so a dark-mode user sees a white page then a flip on every navigation and every reload, the flash gets longer as the bundle grows, and it is worst on slow devices where it reads as a broken app rather than a loading app

---

## Pattern 3: Three-State Preference

Persist the **preference** (`light | dark | system`), never the resolved value. `system` is a live subscription to the OS, not a value resolved once at load.

### Good Example - Preference Module

```ts
// theme-preference.ts
const THEME_STORAGE_KEY = "theme-preference";
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";
const THEME_ATTRIBUTE = "data-theme";

type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const THEME_PREFERENCES: readonly ThemePreference[] = [
  "light",
  "dark",
  "system",
];

function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.some((preference) => preference === value);
}

// ✅ Good Example - the stored preference is the single source of truth
function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function writeThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* Private browsing - the in-memory preference still applies for this session */
  }
}

// "system" stamps nothing, leaving the media query in charge (see Pattern 1)
function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;

  if (preference === "system") {
    root.removeAttribute(THEME_ATTRIBUTE);
    return;
  }

  root.setAttribute(THEME_ATTRIBUTE, preference);
}

export {
  applyThemePreference,
  readThemePreference,
  writeThemePreference,
  THEME_STORAGE_KEY,
};
export type { ResolvedTheme, ThemePreference };
```

**Why good:** the preference and the rendered result stay separate so "system" survives a reload, `removeAttribute` restores CSS control rather than freezing a value, both storage calls are guarded so a privacy-mode browser degrades to session-only instead of throwing

### Good Example - Live OS Tracking When JavaScript Needs the Resolved Value

```ts
// ✅ Good Example - only needed when JS itself must know the rendered mode
// (canvas, charts, map tiles, an <iframe> you postMessage into)
function subscribeToSystemTheme(
  onChange: (resolved: ResolvedTheme) => void,
): () => void {
  const query = window.matchMedia(DARK_MEDIA_QUERY);
  const handleChange = (event: MediaQueryListEvent) => {
    onChange(event.matches ? "dark" : "light");
  };

  query.addEventListener("change", handleChange);
  return () => query.removeEventListener("change", handleChange);
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? "dark" : "light";
}

export { resolveTheme, subscribeToSystemTheme };
```

**Why good:** the subscription keeps "system" live when the OS flips at sunset while the tab is open, the returned cleanup prevents a listener leak across mounts, and this cost is paid only by the surfaces that genuinely cannot be driven by CSS

### Bad Example - Persisting the Resolved Value

```ts
// ❌ Bad Example - resolves once, stores the answer, loses the question
const resolved = window.matchMedia(DARK_MEDIA_QUERY).matches ? "dark" : "light";
localStorage.setItem("theme-preference", resolved);
document.documentElement.setAttribute("data-theme", resolved);
```

**Why bad:** the fact that the user wanted to follow the OS is destroyed on first load, so every "system" user is permanently frozen at whatever the OS happened to be that moment, the app stops responding to the OS day/night switch entirely, and there is no way to distinguish "chose dark" from "was dark once"

### Bad Example - Toggle Reading the DOM

```ts
// ❌ Bad Example - reads the output instead of the input
const isDark = document.documentElement.getAttribute("data-theme") === "dark";
applyThemePreference(isDark ? "light" : "dark");
```

**Why bad:** the attribute is absent for "system" users, so `isDark` is `false` even on a dark-rendered page and the first click "switches" them to the dark they were already seeing, the two-state read cannot represent three states, and it desyncs from the stored value after a cross-tab change

---

## Pattern 4: next-themes

`next-themes` automates the whole of Patterns 2 and 3 for React apps: it injects the pre-paint script itself, persists the preference, tracks the system query live, stamps the attribute, sets `color-scheme`, and syncs across tabs via the `storage` event.

### Good Example - Provider Configuration

```tsx
import { ThemeProvider } from "next-themes";

// ✅ Good Example - explicit about every contract that matters
export function AppThemeProvider({ children, nonce }: AppThemeProviderProps) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      disableTransitionOnChange
      storageKey="theme-preference"
      nonce={nonce}
    >
      {children}
    </ThemeProvider>
  );
}
```

Every prop above is chosen rather than defaulted, because four of the defaults are not what a reader would guess — the full table is in [reference.md](../reference.md).

### Good Example - Three-Way Switcher

```tsx
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const THEME_OPTIONS = ["light", "system", "dark"] as const;

// ✅ Good Example - `theme` drives the control, `resolvedTheme` drives the preview
export function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Before mount, theme/resolvedTheme/systemTheme are all undefined - render a
  // placeholder that reserves the switcher's exact size rather than guessing a value
  if (!mounted)
    return <div aria-hidden className="theme-switcher-placeholder" />;

  return (
    <fieldset>
      <legend>Colour theme</legend>
      {THEME_OPTIONS.map((option) => (
        <label key={option}>
          <input
            type="radio"
            name="theme"
            value={option}
            checked={theme === option}
            onChange={() => setTheme(option)}
          />
          {option}
        </label>
      ))}
      <span aria-live="polite">Currently showing {resolvedTheme}</span>
    </fieldset>
  );
}
```

**Why good:** `theme` reflects the stored preference so "system" stays selectable, `resolvedTheme` reports what is actually on screen, the placeholder reserves layout so the switcher does not shift content in when it mounts, radios express three mutually exclusive states honestly

### Bad Example - Branching on Theme During Render

```tsx
// ❌ Bad Example - undefined on the server and on the first client render
export function Logo() {
  const { resolvedTheme } = useTheme();
  return (
    <img
      src={resolvedTheme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"}
    />
  );
}
```

**Why bad:** `resolvedTheme` is `undefined` until mount, so a dark-mode user is served the light logo in the server HTML and it visibly swaps after hydration -- the exact flash the pre-paint script exists to prevent. Drive the swap in CSS (Pattern 5) so it is correct on the very first paint, or gate the component behind a `mounted` flag if a JS branch is unavoidable.

### Bad Example - Switcher Outside the Provider

```tsx
// ❌ Bad Example - fails silently
export function Header() {
  return <ThemeSwitcher />; // rendered above <ThemeProvider> in the tree
}
```

**Why bad:** the default context is `{ setTheme: () => {}, themes: [] }`, so nothing throws and nothing warns -- clicks just do nothing, which is far harder to diagnose than a crash

---

## Pattern 5: Semantic Token Switching

A theme swaps token **values** under **stable names**. Components reference roles (`--color-surface`), never modes (`--color-white`). One selector block per scope, and every block declares the **same complete key set**.

### Good Example - One Complete Block per Scope

```css
/* ✅ Good Example - stable names, complete blocks, color-scheme per scope */
:root {
  color-scheme: light;

  --color-canvas: #ffffff;
  --color-surface: #f5f6f8;
  --color-surface-raised: #ffffff;
  --color-ink: #14161a;
  --color-ink-muted: #5b6371;
  --color-border: #d8dce3;
  --color-accent: #2563eb;
  --color-accent-ink: #ffffff;
  --shadow-raised: 0 1px 3px rgb(0 0 0 / 0.12);
}

:root[data-theme="dark"] {
  color-scheme: dark;

  --color-canvas: #0d0f12;
  --color-surface: #15181d;
  --color-surface-raised: #1c2027;
  --color-ink: #e8eaed;
  --color-ink-muted: #9aa3b2;
  --color-border: #2a2f38;
  --color-accent: #6ea8ff;
  --color-accent-ink: #0d0f12;
  /* Shadows read as noise on dark surfaces - the dark theme leans on a raised
     surface colour instead, but the token still exists so nothing inherits */
  --shadow-raised: 0 1px 3px rgb(0 0 0 / 0.6);
}

.card {
  background: var(--color-surface-raised);
  color: var(--color-ink);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-raised);
}
```

**Why good:** the component CSS is theme-agnostic and never grows a second rule per theme, identical key sets mean no token can silently inherit a light value into a dark page, `color-scheme` per block makes scrollbars, date pickers, checkboxes, spellcheck underlines and the overscroll canvas follow the theme without any extra styling

### Good Example - Indirection for Generated Token Layers

```css
/* ✅ Good Example - the swappable variables and the consumed variables are different layers */

/* Layer 1: raw values, swapped per scope */
:root {
  --app-canvas: #ffffff;
}
:root[data-theme="dark"] {
  --app-canvas: #0d0f12;
}

/* Layer 2: the token the rest of the app consumes REFERENCES layer 1.
   The reference is resolved where it is used, so it re-resolves per scope. */
.themed {
  --color-canvas: var(--app-canvas);
}
```

**Why good:** any generated or tooling-owned token layer that copies a value at definition time captures the light value once and never changes again; a one-hop `var()` reference defers resolution to use time, which is what makes the swap reach through the generated layer

**Note:** any layer that mirrors design tokens into its own variable namespace to generate classes requires exactly this indirection, and each provides its own directive for it. What to check in its documentation is whether an aliased entry is _resolved into_ each generated class or _emitted as a chained reference_ — only the first follows a runtime scope reassignment.

### Good Example - Per-Theme Images

```css
/* ✅ Good Example - the image is a token, so it follows data-theme like every other token */
:root {
  --image-hero: url("/hero-light.avif");
}
:root[data-theme="dark"] {
  --image-hero: url("/hero-dark.avif");
}

.hero {
  background-image: var(--image-hero);
}

/* For content <img> pairs, toggle visibility from the same signal */
[data-theme="dark"] .logo--light,
:root:not([data-theme]) .logo--dark {
  display: none;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) .logo--light {
    display: none;
  }
  :root:not([data-theme]) .logo--dark {
    display: revert;
  }
}
```

**Why good:** both approaches read the same dual signal as the rest of the theme, so an explicit override switches the imagery too

### Bad Example - Media-Query-Only Images

```html
<!-- ❌ Bad Example - blind to the explicit override -->
<picture>
  <source srcset="/hero-dark.avif" media="(prefers-color-scheme: dark)" />
  <img src="/hero-light.avif" alt="Product dashboard" />
</picture>
```

**Why bad:** `media` on `<source>` only ever evaluates the OS preference, so a user on a dark OS who chose light gets a dark hero on a light page -- and the failure is invisible in testing unless the tester's OS disagrees with their in-app choice

### Bad Example - Mode-Named Tokens in Components

```css
/* ❌ Bad Example - the component now encodes a mode */
.card {
  background: var(--color-white);
  color: var(--color-gray-900);
  border: 1px solid var(--color-gray-200);
}

/* ...which forces a second rule per theme, forever */
[data-theme="dark"] .card {
  background: var(--color-gray-900);
  color: var(--color-white);
}
```

**Why bad:** every new theme means auditing and duplicating every component rule instead of adding one token block, `--color-white` becoming dark grey in the dark theme makes the name a lie, and mode-specific component rules drift out of sync with the token blocks over time
