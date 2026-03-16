# Storybook - Addon Configuration Examples

> Popular addons setup and configuration. Reference from [SKILL.md](../SKILL.md).

---

## Essential Addons (Included by Default)

### Main Configuration

```typescript
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    // Essentials bundle includes: docs, controls, actions, viewport, backgrounds, toolbars, measure, outline
    "@storybook/addon-essentials",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
};

export default config;
```

**Why good:** Single bundle provides most commonly needed addons, reduces configuration overhead

---

## Interactions Addon

### Installation

```bash
npm install -D @storybook/addon-interactions
```

### Configuration

```typescript
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions", // Add interactions panel
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
};

export default config;
```

### Usage

```typescript
// button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Button } from "./button";

const meta = {
  title: "Components/Button",
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Clicked: Story = {
  args: {
    children: "Click me",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");

    await userEvent.click(button);

    // Interactions panel shows each step
    await expect(button).toHaveAttribute("data-clicked", "true");
  },
};
```

**Why good:** Shows step-by-step interaction playback, useful for debugging play functions

---

## Accessibility Addon

### Installation

```bash
npm install -D @storybook/addon-a11y
```

### Configuration

```typescript
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-a11y", // Accessibility panel
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
};

export default config;
```

### Global Configuration

```typescript
// .storybook/preview.tsx
import type { Preview } from "@storybook/react";

const preview: Preview = {
  parameters: {
    a11y: {
      // Run axe-core on all stories by default
      config: {
        rules: [
          // Customize rules globally
          {
            id: "color-contrast",
            enabled: true,
          },
          // Disable rules that don't apply to isolated components
          {
            id: "landmark-one-main",
            enabled: false,
          },
          {
            id: "page-has-heading-one",
            enabled: false,
          },
        ],
      },
      // Element to check (default is #storybook-root)
      element: "#storybook-root",
    },
  },
};

export default preview;
```

### Per-Story Configuration

```typescript
// alert.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Alert } from "./alert";

const meta = {
  title: "Components/Alert",
  component: Alert,
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    message: "This is an alert",
  },
};

// Disable a11y for story with intentionally bad contrast (for demo)
export const BadContrast: Story = {
  parameters: {
    a11y: {
      disable: true,
    },
  },
  args: {
    message: "Low contrast text",
    className: "text-gray-400 bg-gray-300",
  },
};

// Custom rules for specific story
export const CustomRules: Story = {
  parameters: {
    a11y: {
      config: {
        rules: [{ id: "color-contrast", enabled: false }],
      },
    },
  },
};
```

**Why good:** Catches accessibility issues during development, integrates axe-core automatically

---

## Links Addon

### Installation

```bash
npm install -D @storybook/addon-links
```

### Configuration

```typescript
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  addons: ["@storybook/addon-essentials", "@storybook/addon-links"],
  // ...
};

export default config;
```

### Usage in Stories

```typescript
// button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { linkTo } from "@storybook/addon-links";
import { Button } from "./button";

const meta = {
  title: "Components/Button",
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Navigate to another story on click
export const LinksToDialog: Story = {
  args: {
    children: "Open Dialog",
    onClick: linkTo("Components/Dialog", "Open"),
  },
};

// Navigate based on event data
export const DynamicLink: Story = {
  args: {
    children: "Next Step",
    onClick: linkTo("Features/Wizard", (event) => {
      // Return story name based on condition
      return "Step2";
    }),
  },
};
```

### Usage in MDX

```mdx
{/* button.mdx */}
import { linkTo } from "@storybook/addon-links";

# Button

Click here to see the <a onClick={linkTo("Components/Dialog", "Open")}>Dialog component</a>.
```

**Why good:** Creates navigation between related stories, useful for multi-step flows

---

## Viewport Addon (Part of Essentials)

### Custom Viewports

```typescript
// .storybook/preview.tsx
import type { Preview } from "@storybook/react";

const CUSTOM_VIEWPORTS = {
  iphone14: {
    name: "iPhone 14",
    styles: {
      width: "390px",
      height: "844px",
    },
  },
  iphone14ProMax: {
    name: "iPhone 14 Pro Max",
    styles: {
      width: "430px",
      height: "932px",
    },
  },
  pixel7: {
    name: "Pixel 7",
    styles: {
      width: "412px",
      height: "915px",
    },
  },
  ipadAir: {
    name: "iPad Air",
    styles: {
      width: "820px",
      height: "1180px",
    },
  },
  desktop: {
    name: "Desktop",
    styles: {
      width: "1440px",
      height: "900px",
    },
  },
};

const preview: Preview = {
  parameters: {
    viewport: {
      viewports: CUSTOM_VIEWPORTS,
      defaultViewport: "desktop",
    },
  },
};

export default preview;
```

### Per-Story Viewport

```typescript
// responsive-nav.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { ResponsiveNav } from "./responsive-nav";

const meta = {
  title: "Components/ResponsiveNav",
  component: ResponsiveNav,
} satisfies Meta<typeof ResponsiveNav>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  parameters: {
    viewport: {
      defaultViewport: "desktop",
    },
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "iphone14",
    },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: {
      defaultViewport: "ipadAir",
    },
  },
};
```

**Why good:** Test responsive designs at specific breakpoints, custom viewports match real devices

---

## Backgrounds Addon (Part of Essentials)

### Custom Backgrounds

```typescript
// .storybook/preview.tsx
import type { Preview } from "@storybook/react";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#ffffff" },
        { name: "dark", value: "#1a1a1a" },
        { name: "gray", value: "#f5f5f5" },
        { name: "brand", value: "#0066ff" },
        { name: "gradient", value: "linear-gradient(45deg, #0066ff, #00ff66)" },
      ],
    },
  },
};

export default preview;
```

### Per-Story Background

```typescript
// card.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./card";

const meta = {
  title: "Components/Card",
  component: Card,
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnLightBackground: Story = {
  parameters: {
    backgrounds: { default: "light" },
  },
};

export const OnDarkBackground: Story = {
  parameters: {
    backgrounds: { default: "dark" },
  },
};

// Disable background switching for this story
export const TransparentCard: Story = {
  parameters: {
    backgrounds: { disable: true },
  },
};
```

**Why good:** Test components on different backgrounds, verify contrast and visibility

---

## Visual Testing Addon

Visual testing tools integrate with Storybook to capture snapshots of stories for regression detection. See [testing.md](testing.md) for story-level visual testing parameters (`chromatic.viewports`, `chromatic.disableSnapshot`, `chromatic.delay`).

### Modes for Theme Testing

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

**Why good:** Modes capture the same story under different global configurations, catches theme-specific regressions

---

## Designs Addon (Figma Integration)

### Installation

```bash
npm install -D @storybook/addon-designs
```

### Configuration

```typescript
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  addons: ["@storybook/addon-essentials", "@storybook/addon-designs"],
  // ...
};

export default config;
```

### Usage

```typescript
// button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const FIGMA_BUTTON_URL =
  "https://www.figma.com/file/xxx/Design-System?node-id=123";

const meta = {
  title: "Components/Button",
  component: Button,
  parameters: {
    design: {
      type: "figma",
      url: FIGMA_BUTTON_URL,
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: "primary", children: "Primary" },
};

// Different Figma frame for this variant
export const Secondary: Story = {
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/file/xxx/Design-System?node-id=456",
    },
  },
  args: { variant: "secondary", children: "Secondary" },
};

// Multiple design references
export const WithMultipleDesigns: Story = {
  parameters: {
    design: [
      {
        name: "Light Mode",
        type: "figma",
        url: "https://www.figma.com/file/xxx?node-id=123",
      },
      {
        name: "Dark Mode",
        type: "figma",
        url: "https://www.figma.com/file/xxx?node-id=789",
      },
    ],
  },
};
```

**Why good:** Side-by-side comparison with designs, helps verify implementation matches specs

---

## Storybook Test Addon (Recommended for Storybook 8.4+)

The Storybook test addon transforms stories into component tests running in a real browser. It supersedes the legacy test runner with better performance and Storybook UI integration.

### Installation

```bash
# Automatic setup (recommended - configures everything)
npx storybook add @storybook/addon-vitest
```

### Configuration

The automatic setup creates the necessary config files. Key pieces:

```typescript
// vitest.config.ts
import { defineConfig, mergeConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    plugins: [
      storybookTest({
        configDir: ".storybook",
        // Optional: clickable story links in CI output
        storybookUrl: "https://your-storybook.com",
        // Tag filtering
        tags: {
          include: ["test"],
          exclude: ["experimental"],
        },
      }),
    ],
    test: {
      browser: {
        enabled: true,
        provider: "playwright",
        name: "chromium",
        headless: true,
      },
      // Required: setup file for portable stories
      setupFiles: ["./.storybook/vitest.setup.ts"],
    },
  }),
);
```

```typescript
// .storybook/vitest.setup.ts
// Required: connects Storybook preview config to Vitest
import { beforeAll } from "vitest";
import { setProjectAnnotations } from "@storybook/react";
import * as previewAnnotations from "./preview";

const annotations = setProjectAnnotations([previewAnnotations]);

beforeAll(annotations.beforeAll);
```

### Tag-Based Test Control

```typescript
// button.stories.tsx
const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["stable"],
} satisfies Meta<typeof Button>;

// Skip this story from tests
export const Experimental: Story = {
  tags: ["!test", "experimental"],
  args: { children: "Experimental" },
};

// Docs-only story (hidden from sidebar)
export const DocsOnly: Story = {
  tags: ["autodocs", "!dev"],
  args: { children: "Docs Only" },
};
```

**Why good:** Runs in real browser via Vitest browser mode, integrates with Storybook UI, supports IDE test extensions, faster than legacy test runner

---

## Legacy Test Runner (For Non-Vite Projects)

> **Note:** For Vite-based projects, use the Storybook test addon above instead. The test runner is for Webpack-based projects only.

The legacy test runner (`@storybook/test-runner`) requires a running Storybook instance and visits each story in a headless browser. Configure via `.storybook/test-runner.ts` with `preVisit`/`postVisit` hooks for setup and assertions. Run with `test-storybook --ci` in CI environments.

---

## Key Configuration Decisions

Non-obvious choices when setting up `.storybook/main.ts`:

- **`react-docgen` vs `react-docgen-typescript`**: Default `react-docgen` is ~50% faster but cannot extract types imported from other files. Switch to `react-docgen-typescript` only if your props reference external type definitions.
- **`docs.autodocs` in main.ts is deprecated**: Use `tags: ["autodocs"]` in `preview.ts` instead.
- **`globals` renamed to `initialGlobals`** in Storybook 8.2+. The old field is deprecated.
- **`argTypesRegex` for actions is deprecated**: Use explicit `fn()` from `@storybook/test` for testable handlers.

---

_For more patterns, see:_

- [core.md](core.md) - CSF 3.0 format, args, controls
- [docs.md](docs.md) - Autodocs and MDX documentation
- [testing.md](testing.md) - Play functions and interaction testing
