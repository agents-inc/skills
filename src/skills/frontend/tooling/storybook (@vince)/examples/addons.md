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
    "@storybook/addon-interactions",  // Add interactions panel
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
    "@storybook/addon-a11y",  // Accessibility panel
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
        rules: [
          { id: "color-contrast", enabled: false },
        ],
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
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-links",
  ],
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

## Chromatic Addon (Visual Testing)

### Installation

```bash
npm install -D @chromatic-com/storybook
```

### Configuration

```typescript
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  addons: [
    "@storybook/addon-essentials",
    "@chromatic-com/storybook",  // Chromatic integration
  ],
  // ...
};

export default config;
```

### Story Configuration

```typescript
// button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta = {
  title: "Components/Button",
  component: Button,
  parameters: {
    chromatic: {
      // Capture at multiple viewports
      viewports: [320, 768, 1200],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Story captured for visual testing
export const Primary: Story = {
  args: { variant: "primary", children: "Primary" },
};

// Skip this story (animations cause flaky snapshots)
export const Animated: Story = {
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  args: { animated: true },
};

// Delay snapshot for async content
export const WithAsyncData: Story = {
  parameters: {
    chromatic: {
      delay: 300,  // Wait 300ms
    },
  },
};

// Different modes for theme testing
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

### CI Integration

```yaml
# .github/workflows/chromatic.yml
name: Chromatic

on:
  push:
    branches: [main]
  pull_request:

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Publish to Chromatic
        uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          buildScriptName: build-storybook
```

**Why good:** Automated visual regression testing, catches unintended UI changes, integrates with PR workflow

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
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-designs",
  ],
  // ...
};

export default config;
```

### Usage

```typescript
// button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const FIGMA_BUTTON_URL = "https://www.figma.com/file/xxx/Design-System?node-id=123";

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

## Test Runner Addon

### Installation

```bash
npm install -D @storybook/test-runner
```

### Configuration

```typescript
// .storybook/test-runner.ts
import type { TestRunnerConfig } from "@storybook/test-runner";
import { getStoryContext } from "@storybook/test-runner";

const config: TestRunnerConfig = {
  // Setup before all tests
  async preVisit(page) {
    await page.setViewportSize({ width: 1280, height: 720 });
  },

  // After each story visit
  async postVisit(page, context) {
    // Access story context
    const storyContext = await getStoryContext(page, context);

    // Example: Take accessibility snapshot
    if (storyContext.parameters.a11y?.disable !== true) {
      // Run accessibility checks
    }
  },

  // Custom test timeout
  testTimeout: 15000,
};

export default config;
```

### Package Scripts

```json
{
  "scripts": {
    "test-storybook": "test-storybook",
    "test-storybook:ci": "test-storybook --ci",
    "test-storybook:coverage": "test-storybook --coverage"
  }
}
```

### Running Tests

```bash
# Start Storybook first
npm run storybook

# In another terminal, run tests
npm run test-storybook

# Or run against built Storybook
npm run build-storybook
npx http-server storybook-static --port 6006
npm run test-storybook -- --url http://localhost:6006
```

**Why good:** Runs all play functions as tests, integrates with CI, generates coverage reports

---

## Complete Configuration Example

```typescript
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-a11y",
    "@storybook/addon-links",
    "@chromatic-com/storybook",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  staticDirs: ["../public"],
  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
};

export default config;
```

```typescript
// .storybook/preview.tsx
import type { Preview } from "@storybook/react";
import "../src/styles/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "centered",
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#ffffff" },
        { name: "dark", value: "#1a1a1a" },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div style={{ margin: "1rem" }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
```

**Why good:** Complete setup for professional component development, covers documentation, testing, accessibility, and visual regression

---

_For more patterns, see:_
- [core.md](core.md) - CSF 3.0 format, args, controls
- [docs.md](docs.md) - Autodocs and MDX documentation
- [testing.md](testing.md) - Play functions and interaction testing
