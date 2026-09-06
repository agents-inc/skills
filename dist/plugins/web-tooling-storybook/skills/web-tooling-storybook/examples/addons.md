# Storybook - Addon Configuration Examples

> Project configuration and the addons worth deliberate setup. See [../SKILL.md](../SKILL.md) for the decisions, and [../reference.md](../reference.md) for the addon list and per-version notes.

---

## Project Configuration

`npx storybook init` writes `.storybook/main.ts` and `.storybook/preview.ts` for the framework it detects. What follows is the part worth editing afterwards, rather than a file to paste over it.

```typescript
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-a11y"],
  framework: {
    // The package matching your renderer and builder
    name: "@storybook/react-vite",
    options: {},
  },
  typescript: {
    reactDocgen: "react-docgen",
  },
  staticDirs: ["../public"],
};

export default config;
```

**The one decision here is `reactDocgen`.** The default is roughly twice as fast to start; the alternative is the only one that resolves a prop type declared in another module. A props table with missing rows is the symptom of picking the fast one and needing the other.

Switching brings its own configuration, because the slower analyser reports inherited props too:

```typescript
typescript: {
  reactDocgen: "react-docgen-typescript",
  reactDocgenTypescriptOptions: {
    shouldExtractLiteralValuesFromEnum: true,
    // Without this, every prop inherited from a library type joins the table
    propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
  },
},
```

```typescript
// .storybook/preview.tsx
import type { Preview } from "@storybook/react";
import "../src/styles/globals.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
  tags: ["autodocs"],
  initialGlobals: { theme: "light" },
  globalTypes: {
    theme: {
      description: "Global theme",
      toolbar: { title: "Theme", icon: "circlehollow", items: ["light", "dark"], dynamicTitle: true },
    },
  },
};

export default preview;
```

**Why good:** `globalTypes` puts a control in the toolbar and `initialGlobals` gives it a starting value, so a global concern like theme is switched once rather than through a decorator per story.

---

## Accessibility Addon

```typescript
// .storybook/preview.tsx
const preview: Preview = {
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: "color-contrast", enabled: true },
          // Rules that assume a whole document, which a component is not
          { id: "landmark-one-main", enabled: false },
          { id: "page-has-heading-one", enabled: false },
        ],
      },
      element: "#storybook-root",
    },
  },
};
```

**Why good:** the addon runs axe on every story, so the rules worth turning off are the ones a component in isolation can never satisfy — left on, they bury the findings that matter. Per-story overrides are in [testing.md](testing.md).

---

## Viewports and Backgrounds

```typescript
// .storybook/preview.tsx
const CUSTOM_VIEWPORTS = {
  mobile: { name: "Mobile", styles: { width: "390px", height: "844px" } },
  tablet: { name: "Tablet", styles: { width: "820px", height: "1180px" } },
  desktop: { name: "Desktop", styles: { width: "1440px", height: "900px" } },
};

const preview: Preview = {
  parameters: {
    viewport: { viewports: CUSTOM_VIEWPORTS, defaultViewport: "desktop" },
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#ffffff" },
        { name: "dark", value: "#1a1a1a" },
      ],
    },
  },
};
```

```typescript
// A story that only makes sense at one size, or on one surface
export const MobileNav: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
    backgrounds: { default: "dark" },
  },
};

// A component that supplies its own surface
export const TransparentCard: Story = {
  parameters: { backgrounds: { disable: true } },
};
```

**Why good:** the widths come from the design's own breakpoints rather than from a catalogue of devices, so a story reviewed at "tablet" is being reviewed at the size the layout actually changes.

---

## Story Links

```typescript
import { linkTo } from "@storybook/addon-links";

export const LinksToDialog: Story = {
  args: {
    children: "Open dialog",
    onClick: linkTo("Components/Dialog", "Open"),
  },
};
```

**Why good:** a story in a multi-step flow can hand off to the next one, so a reviewer follows the flow in the sidebar instead of reconstructing it.

---

## Visual Testing Modes

```typescript
export const ThemedButton: Story = {
  parameters: {
    chromatic: {
      modes: {
        light: { theme: "light" },
        dark: { theme: "dark" },
      },
    },
  },
};
```

**Why good:** modes capture one story under several global configurations, which is how a theme regression is caught without writing a story per theme. Story-level capture parameters are in [testing.md](testing.md).

---

## Design References

```typescript
const meta = {
  component: Button,
  parameters: {
    design: { type: "figma", url: FIGMA_BUTTON_URL },
  },
} satisfies Meta<typeof Button>;

// A variant with its own frame, or several references at once
export const Secondary: Story = {
  parameters: {
    design: [
      { name: "Light", type: "figma", url: FIGMA_LIGHT_URL },
      { name: "Dark", type: "figma", url: FIGMA_DARK_URL },
    ],
  },
};
```

**Why good:** the design sits beside the implementation in the same panel, so a mismatch is visible without leaving Storybook.

---

## Running Stories as Tests

```bash
npx storybook add @storybook/addon-vitest
```

The command writes the runner config and the setup file that connects your preview annotations to the test run. Two things it cannot decide:

```typescript
// vitest.config.ts — the options that are yours
storybookTest({
  configDir: ".storybook",
  // Makes failures in CI link back to the story
  storybookUrl: "https://your-storybook.example",
  // Which stories run at all
  tags: { include: ["test"], exclude: ["experimental"] },
});
```

```typescript
// button.stories.tsx — tags decide inclusion per story
export const Experimental: Story = {
  tags: ["!test", "experimental"], // rendered in the sidebar, skipped by the run
};

export const DocsOnly: Story = {
  tags: ["autodocs", "!dev"], // documented, hidden from the sidebar
};
```

**Why good:** stories run in a real browser, so what is asserted is what a person would see, and tag filtering keeps in-progress stories out of the signal without deleting them.

> A Webpack-based project uses `@storybook/test-runner` instead: it visits each story in a headless browser against a running Storybook, and is configured through `.storybook/test-runner.ts` with `preVisit` and `postVisit` hooks.

---

_See also:_ [core.md](core.md) · [testing.md](testing.md) · [docs.md](docs.md)
