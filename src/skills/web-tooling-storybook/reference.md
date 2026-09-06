# Storybook Reference

> Lookup tables and per-version notes. See [SKILL.md](SKILL.md) for the decisions and red flags, and the files under `examples/` for the code.

---

## Control types

| Prop type    | Control      | Configuration                                                               |
| ------------ | ------------ | --------------------------------------------------------------------------- |
| `boolean`    | checkbox     | `{ control: "boolean" }`                                                    |
| `string`     | text         | `{ control: "text" }`                                                       |
| `number`     | number       | `{ control: "number" }` or `{ control: { type: "range", min, max, step } }` |
| enum / union | select       | `{ control: "select", options: ["a", "b"] }`                                |
| enum / union | radio        | `{ control: "radio", options: ["a", "b"] }`                                 |
| enum / union | inline-radio | `{ control: "inline-radio", options: ["a", "b"] }`                          |
| array        | object       | `{ control: "object" }`                                                     |
| object       | object       | `{ control: "object" }`                                                     |
| `Date`       | date         | `{ control: "date" }`                                                       |
| color string | color        | `{ control: "color" }`                                                      |
| file         | file         | `{ control: { type: "file", accept: ".png" } }`                             |

`control: false` documents a prop without letting it be edited; `table: { disable: true }` removes it from the docs as well.

---

## Parameters

| Namespace     | Key fields                                                                           | Set at             |
| ------------- | ------------------------------------------------------------------------------------ | ------------------ |
| `layout`      | `"centered"`, `"fullscreen"`, `"padded"` (default)                                   | any level          |
| `backgrounds` | `default`, `values[]`, `disable`                                                     | any level          |
| `viewport`    | `viewports`, `defaultViewport`                                                       | any level          |
| `controls`    | `expanded`, `sort`, `matchers`                                                       | usually global     |
| `docs`        | `description.component`, `description.story`, `source`, `page`, `canvas.sourceState` | any level          |
| `a11y`        | `config.rules[]`, `element`, `disable`                                               | any level          |
| `chromatic`   | `viewports`, `modes`, `delay`, `disableSnapshot`                                     | component or story |

A story's parameters override its component's, which override the global ones.

---

## `@storybook/test`

| Export      | Purpose                     | Example                                |
| ----------- | --------------------------- | -------------------------------------- |
| `within`    | Scope queries to an element | `const canvas = within(canvasElement)` |
| `userEvent` | User interaction sequences  | `await userEvent.click(button)`        |
| `expect`    | Assertions                  | `await expect(el).toBeVisible()`       |
| `fn`        | Recording mock              | `args: { onClick: fn() }`              |
| `waitFor`   | Retry until it passes       | `await waitFor(() => expect(…))`       |
| `fireEvent` | A single raw event          | `fireEvent.scroll(element)`            |

`expect` carries the DOM matchers: presence (`toBeInTheDocument`), visibility (`toBeVisible`), state (`toBeEnabled`, `toBeDisabled`, `toBeChecked`), content (`toHaveTextContent`, `toHaveValue`, `toHaveAttribute`) and focus (`toHaveFocus`). `toHaveClass` asserts on styling and is the one to reach for last, since it fails on a class rename that changes nothing a user sees.

An `fn()` arg carries the call matchers: `toHaveBeenCalled`, `toHaveBeenCalledTimes(n)`, `toHaveBeenCalledWith(…)`, `toHaveBeenLastCalledWith(…)`, and `not.toHaveBeenCalled` for the handler that should stay untouched.

---

## Addons

Included in the essentials bundle: docs, controls, actions, viewport, backgrounds, toolbars, measure, outline.

| Addon                           | Purpose             | Installation                                |
| ------------------------------- | ------------------- | ------------------------------------------- |
| `@storybook/addon-a11y`         | axe on every story  | `npm i -D @storybook/addon-a11y`            |
| `@storybook/addon-interactions` | Play function panel | `npm i -D @storybook/addon-interactions`    |
| `@storybook/addon-vitest`       | Stories as tests    | `npx storybook add @storybook/addon-vitest` |
| `@storybook/addon-links`        | Story cross-linking | `npm i -D @storybook/addon-links`           |
| `@storybook/addon-designs`      | Design file embeds  | `npm i -D @storybook/addon-designs`         |
| `@chromatic-com/storybook`      | Visual testing      | `npm i -D @chromatic-com/storybook`         |

---

## File naming

| File type         | Pattern                   | Example                          |
| ----------------- | ------------------------- | -------------------------------- |
| Component stories | `[component].stories.tsx` | `button.stories.tsx`             |
| Component docs    | `[component].mdx`         | `button.mdx`                     |
| Docs-only page    | `[name].mdx`              | `getting-started.mdx`            |
| Interaction tests | same file                 | play functions in `.stories.tsx` |

```
src/
├── components/
│   └── button/
│       ├── button.tsx
│       ├── button.stories.tsx
│       ├── button.mdx            # optional custom docs
│       └── button.test.tsx       # unit tests, separate
├── stories/
│   └── introduction.mdx          # docs-only pages
└── .storybook/
    ├── main.ts
    ├── preview.tsx
    └── manager.ts                # UI customisation, optional
```

---

## Migration notes

### Removed and deprecated in Storybook 8

| Feature                      | Status            | Migration                                             |
| ---------------------------- | ----------------- | ----------------------------------------------------- |
| `storiesOf` API              | Removed           | CSF 3.0                                               |
| `.stories.mdx`               | Removed           | Split into `.stories.tsx` plus `.mdx`                 |
| Storyshots addon             | Removed           | Test addon, or a visual testing tool                  |
| `@storybook/testing-library` | Deprecated        | `@storybook/test`                                     |
| `@storybook/jest`            | Deprecated        | `@storybook/test`                                     |
| `docs.autodocs` in main.ts   | Deprecated        | `tags: ["autodocs"]` in preview                       |
| `globals` in preview         | Deprecated (8.2+) | `initialGlobals`                                      |
| `globalTypes.defaultValue`   | Deprecated (8.2+) | `initialGlobals`                                      |
| `argTypesRegex` for actions  | Limited           | Cannot be used in play functions; use explicit `fn()` |
| `@storybook/test-runner`     | Superseded (8.4+) | Test addon, for builders it supports                  |

### Package consolidations

| Old                              | New                                                  |
| -------------------------------- | ---------------------------------------------------- |
| `@storybook/addons`              | `@storybook/manager-api` or `@storybook/preview-api` |
| `@storybook/client-api`          | `@storybook/preview-api`                             |
| `@storybook/channel-postmessage` | `@storybook/channels`                                |
| `@storybook/testing-library`     | `@storybook/test`                                    |
| `@storybook/jest`                | `@storybook/test`                                    |

### Defaults changed in Storybook 8

`react-docgen` replaced `react-docgen-typescript` for React prop analysis — roughly 50% faster startup, and unable to extract types imported from other files.

### Storybook 10

| Change               | Impact                       | Migration                                                |
| -------------------- | ---------------------------- | -------------------------------------------------------- |
| ESM-only             | CommonJS no longer supported | `"type": "module"` in package.json, or `.mjs` extensions |
| Node 20.16+ required | Older Node unsupported       | Upgrade to 20.16+, 22.19+ or 24+                         |

**CSF Factories** are at preview status and React-only. CSF 3.0 remains supported and is not deprecated; migration is optional and incremental via `npx storybook automigrate csf-factories`.

```typescript
import preview from "#.storybook/preview";

const meta = preview.meta({ component: Button });

export const Primary = meta.story({ args: { primary: true } });
```

No default export is needed in this form. It is expected to become the default in Storybook 11.
