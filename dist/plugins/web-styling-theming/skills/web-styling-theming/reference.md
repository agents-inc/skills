# Runtime Theming Reference

> Provider contract, specificity lookup, and platform feature support. Decision guidance and red flags are in [SKILL.md](SKILL.md).

---

## Specificity of the Theme Selectors

| Selector                     | Specificity | Applies                                                                          |
| ---------------------------- | ----------- | -------------------------------------------------------------------------------- |
| `:root`                      | (0,1,0)     | Always — the light default                                                       |
| `:root[data-theme="dark"]`   | (0,2,0)     | While the attribute is stamped                                                   |
| `:root:not([data-theme])`    | (0,2,0)     | While no explicit choice exists                                                  |
| `:root` inside a media block | (0,1,0)     | Whenever the query matches — **ties with the default, and source order decides** |

The tie in the last row is the whole reason the media block is guarded with `:not([data-theme])`. Guarded, it scores (0,2,0) against an override that also scores (0,2,0) but is more specific in intent — and because the guard is mutually exclusive with the override, the two can never both apply.

---

## `next-themes` — Props

| Prop                        | Default                             | Notes                                                                                |
| --------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| `attribute`                 | `"data-theme"`                      | `"class"`, any `data-*`, or an **array** of them                                     |
| `defaultTheme`              | `enableSystem ? "system" : "light"` | Conditional — not literally `"system"`                                               |
| `enableSystem`              | `true`                              | `false` removes `"system"` and makes `systemTheme` `undefined`                       |
| `enableColorScheme`         | `true`                              | Sets `documentElement.style.colorScheme`                                             |
| `disableTransitionOnChange` | `false`                             | Performs the inject / reflow / swap / release sequence                               |
| `storageKey`                | `"theme"`                           | localStorage only — **there is no cookie mode**                                      |
| `themes`                    | `["light", "dark"]`                 | Any list; this is what enables named themes                                          |
| `value`                     | —                                   | Maps a theme name to the attribute value written                                     |
| `forcedTheme`               | —                                   | Locks a page without touching the saved preference; hide the switcher when it is set |
| `nonce`                     | —                                   | Applied to the injected script **and** to style elements                             |
| `scriptProps`               | —                                   | Extra attributes on the injected script                                              |

## `next-themes` — `useTheme()` Return Values

| Value           | Meaning                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------- |
| `theme`         | The stored preference — can be `"system"`                                                 |
| `resolvedTheme` | What `"system"` resolved to; **identical to `theme`** for any non-system theme            |
| `systemTheme`   | The OS preference regardless of the active theme; `undefined` when `enableSystem={false}` |
| `themes`        | The configured list                                                                       |
| `setTheme`      | Accepts a value **or an updater function**                                                |

All three theme values are `undefined` on the server and during the first client render, because the preference lives in localStorage.

---

## Platform Features and Their Support

| Feature                     | State                                                                 |
| --------------------------- | --------------------------------------------------------------------- |
| `prefers-color-scheme`      | Baseline since 2022                                                   |
| `color-scheme`              | Baseline since 2022                                                   |
| `light-dark()` for colours  | Baseline 2024; image support is only now arriving — do not rely on it |
| `prefers-reduced-motion`    | Baseline                                                              |
| `forced-colors`             | Widely available; replaces the palette wholesale when active          |
| `<meta name="theme-color">` | **Not** Baseline — treat as progressive enhancement                   |

---

## Storage Choices

| Store           | Readable by the server | Live OS tracking | Use when                                       |
| --------------- | ---------------------- | ---------------- | ---------------------------------------------- |
| CSS media query | n/a                    | Automatic, free  | "system" — always, for the default             |
| `localStorage`  | No                     | Needs a listener | Client-rendered, or a pre-paint script is fine |
| Cookie          | Yes                    | Needs a listener | The server-rendered HTML must carry the theme  |
| Account data    | Yes                    | Needs a listener | The preference follows the user across devices |

Every row after the first carries the _preference_ only. No store can know what `prefers-color-scheme` currently resolves to on the device, which is exactly why CSS keeps ownership of "system".
