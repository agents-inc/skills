# Storybook Reference

> Decision frameworks, anti-patterns, and configuration reference. See [SKILL.md](SKILL.md) for core patterns.

---

## Decision Framework

### When to Write a Story

```
Does this component need documentation?
├─ YES → Write stories
│   └─ Is it a primitive/atom (button, input)?
│       ├─ YES → Document all variants with autodocs
│       └─ NO → Is it a composed component?
│           ├─ YES → Show composition examples
│           └─ NO → Is it page-level?
│               └─ YES → Show key states (loading, error, empty)
│
└─ NO → Skip stories
    └─ Pure utility components with no visual output
```

### Story Complexity Decision Tree

```
How should this story be written?
├─ Component accepts props and renders them?
│   └─ Use args only (simplest)
│       └─ export const Default: Story = { args: { label: "Click" } }
│
├─ Component needs multiple instances shown?
│   └─ Use render function
│       └─ render: (args) => <><Button {...args} /><Button {...args} /></>
│
├─ Component needs state management for demo?
│   └─ Use render with hooks
│       └─ render: function Render(args) { const [open, setOpen] = useState(false); ... }
│
└─ Component needs interaction verification?
    └─ Add play function
        └─ play: async ({ canvasElement }) => { ... }
```

### Args vs Render Decision Tree

```
How should I define story content?
├─ All variations come from props?
│   └─ Use args
│       args: { variant: "primary", size: "lg" }
│
├─ Need to show component with children/composition?
│   ├─ Children are simple (text, single element)?
│   │   └─ Use args.children
│   │       args: { children: "Button Text" }
│   │
│   └─ Children are complex (multiple elements)?
│       └─ Use render function
│           render: (args) => <Card {...args}><Header /><Body /></Card>
│
└─ Need to demonstrate stateful behavior?
    └─ Use render with useState
```

### Testing Decision Tree

```
What type of testing should this story have?
├─ Visual appearance testing?
│   └─ Use Chromatic/Percy (visual regression)
│       parameters: { chromatic: { viewports: [320, 768, 1200] } }
│
├─ Interaction testing (click, type, etc.)?
│   └─ Use play function with @storybook/test
│       play: async ({ canvasElement }) => { await userEvent.click(...) }
│
├─ Accessibility testing?
│   └─ Enable a11y addon (automatic)
│       parameters: { a11y: { config: { rules: [...] } } }
│
└─ Behavior testing with assertions?
    └─ Use play function with expect
        play: async () => { await expect(...).toBeInTheDocument() }
```

---

## Configuration Reference

### Main Configuration (.storybook/main.ts)

```typescript
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  // Story file patterns
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],

  // Addons to load
  addons: [
    "@storybook/addon-essentials",     // Includes: docs, controls, actions, viewport, backgrounds
    "@storybook/addon-interactions",   // Play function panel
    "@storybook/addon-a11y",           // Accessibility testing
    "@storybook/addon-links",          // Story linking
  ],

  // Framework configuration
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },

  // TypeScript configuration
  // NOTE: Storybook 8 uses react-docgen by default (faster, ~50% startup improvement)
  // Only use react-docgen-typescript if you need imported types from other files
  typescript: {
    reactDocgen: "react-docgen",  // Default in Storybook 8
    // Uncomment below to use react-docgen-typescript (slower but handles imported types)
    // reactDocgen: "react-docgen-typescript",
    // reactDocgenTypescriptOptions: {
    //   shouldExtractLiteralValuesFromEnum: true,
    //   propFilter: (prop) =>
    //     prop.parent ? !/node_modules/.test(prop.parent.fileName) : true,
    // },
  },

  // NOTE: docs.autodocs in main.ts is deprecated in Storybook 8
  // Use tags: ["autodocs"] in preview.ts instead (see Preview Configuration below)

  // Static files
  staticDirs: ["../public"],
};

export default config;
```

### Preview Configuration (.storybook/preview.tsx)

```typescript
import type { Preview } from "@storybook/react";
import "../src/styles/globals.css";

const preview: Preview = {
  // Global parameters
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
        { name: "dark", value: "#0a0a0a" },
      ],
    },
  },

  // Global decorators
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],

  // Global args
  args: {
    // Applied to all stories
  },

  // Arg types for all stories
  argTypes: {
    // Global arg type definitions
  },

  // Tags configuration - replaces deprecated docs.autodocs in main.ts
  tags: ["autodocs"],

  // Initial globals (renamed from 'globals' in Storybook 8.2+)
  // Use for global state like theme, locale
  initialGlobals: {
    theme: "light",
  },

  // Global types for toolbar controls
  globalTypes: {
    theme: {
      description: "Global theme",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: ["light", "dark"],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
```

> **Note:** In Storybook 8.2+, `globals` was renamed to `initialGlobals`. The old `globals` field is deprecated and will be removed in Storybook 9.

---

## Control Types Reference

| Prop Type | Control Type | Configuration |
|-----------|--------------|---------------|
| `boolean` | checkbox | `{ control: "boolean" }` |
| `string` | text | `{ control: "text" }` |
| `number` | number | `{ control: "number" }` or `{ control: { type: "range", min, max, step } }` |
| `enum/union` | select | `{ control: "select", options: ["a", "b"] }` |
| `enum/union` | radio | `{ control: "radio", options: ["a", "b"] }` |
| `enum/union` | inline-radio | `{ control: "inline-radio", options: ["a", "b"] }` |
| `array` | object | `{ control: "object" }` |
| `object` | object | `{ control: "object" }` |
| `Date` | date | `{ control: "date" }` |
| color string | color | `{ control: "color" }` |
| file | file | `{ control: { type: "file", accept: ".png" } }` |

### Disabling Controls

```typescript
argTypes: {
  // Hide from controls panel
  internalProp: {
    table: { disable: true },
  },
  // Read-only in docs
  readOnlyProp: {
    control: false,
  },
}
```

---

## Parameters Reference

### Layout Parameters

```typescript
parameters: {
  layout: "centered",    // Center component in canvas
  layout: "fullscreen",  // No padding, full viewport
  layout: "padded",      // Default, adds padding
}
```

### Background Parameters

```typescript
parameters: {
  backgrounds: {
    default: "dark",
    values: [
      { name: "light", value: "#ffffff" },
      { name: "dark", value: "#333333" },
      { name: "twitter", value: "#00aced" },
    ],
  },
}
```

### Viewport Parameters

```typescript
parameters: {
  viewport: {
    defaultViewport: "mobile1",
    viewports: {
      mobile1: {
        name: "Small mobile",
        styles: { width: "320px", height: "568px" },
      },
      tablet: {
        name: "Tablet",
        styles: { width: "768px", height: "1024px" },
      },
    },
  },
}
```

### Docs Parameters

```typescript
parameters: {
  docs: {
    description: {
      component: "Primary button for user actions.",
      story: "The default button state.",
    },
    source: {
      type: "code",  // Show actual source
      type: "dynamic",  // Show rendered args
    },
    canvas: {
      sourceState: "shown",  // Show source by default
    },
  },
}
```

### Actions Parameters

```typescript
// DEPRECATED in Storybook 8: argTypesRegex implicit actions
// Implicit actions can no longer be used during rendering (play functions)
// Use explicit fn() instead:

import { fn } from "@storybook/test";

const meta = {
  component: Button,
  args: {
    onClick: fn(),  // Explicit mock function
    onHover: fn(),
  },
} satisfies Meta<typeof Button>;
```

> **Note:** In Storybook 8, `argTypesRegex` for auto-detecting action handlers is deprecated. Actions created via `argTypesRegex` cannot be used in play functions. Always use explicit `fn()` from `@storybook/test` for testable handlers.

---

## Anti-Patterns to Avoid

### Hardcoding Props in JSX

```typescript
// ANTI-PATTERN
export const Primary: Story = {
  render: () => <Button variant="primary">Click me</Button>,
};
```

**Why it's wrong:** Controls panel won't work. Viewers can't experiment with props. Documentation is static.

**What to do instead:**

```typescript
export const Primary: Story = {
  args: {
    variant: "primary",
    children: "Click me",
  },
};
```

---

### Using Default Export for Stories

```typescript
// ANTI-PATTERN
export default {
  title: "Components/Button",
  component: Button,
};

export default Primary = {  // ERROR: Two default exports
  args: { children: "Button" },
};
```

**Why it's wrong:** JavaScript only allows one default export. Stories must be named exports.

**What to do instead:**

```typescript
const meta = { ... } satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { ... };  // Named export
```

---

### Missing Component in Meta

```typescript
// ANTI-PATTERN
const meta = {
  title: "Components/Button",
  // component: Button,  <- MISSING
} satisfies Meta<typeof Button>;
```

**Why it's wrong:** Autodocs won't generate. Controls won't infer from props. Stories may not render.

**What to do instead:**

```typescript
const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
} satisfies Meta<typeof Button>;
```

---

### Using fireEvent Instead of userEvent

```typescript
// ANTI-PATTERN
import { fireEvent } from "@testing-library/react";

export const Clicked: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    fireEvent.click(canvas.getByRole("button"));  // DON'T
  },
};
```

**Why it's wrong:** `fireEvent` doesn't simulate real user behavior. Misses focus, hover, keyboard events.

**What to do instead:**

```typescript
import { userEvent, within } from "@storybook/test";

export const Clicked: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button"));
  },
};
```

---

### Skipping Type Annotations

```typescript
// ANTI-PATTERN
const meta = {
  title: "Components/Button",
  component: Button,
};

export default meta;

export const Primary = {  // No type annotation
  args: {
    children: "Button",
    unknownProp: true,  // Won't be caught
  },
};
```

**Why it's wrong:** No type checking on args. Invalid props won't be caught.

**What to do instead:**

```typescript
const meta = { ... } satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    children: "Button",
    unknownProp: true,  // TypeScript error!
  },
};
```

---

### Complex Logic in Play Functions

```typescript
// ANTI-PATTERN
export const ComplexTest: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // DON'T: Business logic in play function
    const calculateDiscount = (price: number) => price * 0.9;
    const finalPrice = calculateDiscount(100);

    await userEvent.type(canvas.getByRole("textbox"), String(finalPrice));
  },
};
```

**Why it's wrong:** Play functions are for interaction testing, not business logic testing. Mixes concerns.

**What to do instead:**

```typescript
// Test business logic in unit tests
// Play functions focus on UI interaction

export const WithDiscount: Story = {
  args: {
    price: 90,  // Pre-calculated or use real component logic
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("$90")).toBeInTheDocument();
  },
};
```

---

## Addon Reference

### Essential Addons (Included by Default)

| Addon | Purpose |
|-------|---------|
| `@storybook/addon-docs` | Documentation generation |
| `@storybook/addon-controls` | Interactive prop editing |
| `@storybook/addon-actions` | Event logging |
| `@storybook/addon-viewport` | Responsive testing |
| `@storybook/addon-backgrounds` | Background switching |
| `@storybook/addon-toolbars` | Global toolbar controls |
| `@storybook/addon-measure` | Layout measurement |
| `@storybook/addon-outline` | CSS outline visualization |

### Recommended Additional Addons

| Addon | Purpose | Installation |
|-------|---------|--------------|
| `@storybook/addon-a11y` | Accessibility testing | `npm i -D @storybook/addon-a11y` |
| `@storybook/addon-interactions` | Play function panel | `npm i -D @storybook/addon-interactions` |
| `@storybook/addon-vitest` | Vitest integration (replaces test-runner) | `npx storybook add @storybook/addon-vitest` |
| `@storybook/addon-links` | Story cross-linking | `npm i -D @storybook/addon-links` |
| `@storybook/addon-designs` | Figma embed | `npm i -D @storybook/addon-designs` |
| `@chromatic-com/storybook` | Visual testing | `npm i -D @chromatic-com/storybook` |

> **Note:** `@storybook/test-runner` has been superseded by `@storybook/addon-vitest` for Vite-based projects. The Vitest addon provides the same functionality powered by Vitest's browser mode and includes Storybook UI integration.

---

## File Naming Conventions

| File Type | Pattern | Example |
|-----------|---------|---------|
| Component story | `[component].stories.tsx` | `button.stories.tsx` |
| MDX documentation | `[component].mdx` | `button.mdx` |
| Docs-only MDX | `[name].mdx` | `getting-started.mdx` |
| Story with tests | Same file | Play functions in `.stories.tsx` |

### Directory Structure

```
src/
├── components/
│   └── button/
│       ├── button.tsx
│       ├── button.stories.tsx     # Stories
│       ├── button.mdx             # Optional: Custom docs
│       └── button.test.tsx        # Unit tests (separate)
├── stories/
│   └── introduction.mdx           # Docs-only pages
└── .storybook/
    ├── main.ts                    # Configuration
    ├── preview.tsx                # Global decorators/parameters
    └── manager.ts                 # UI customization (optional)
```

---

## @storybook/test API Reference

| Export | Purpose | Example |
|--------|---------|---------|
| `within` | Scope queries to element | `const canvas = within(canvasElement)` |
| `userEvent` | User interaction simulation | `await userEvent.click(button)` |
| `expect` | Assertions | `await expect(element).toBeVisible()` |
| `fn` | Mock function | `args: { onClick: fn() }` |
| `waitFor` | Async waiting | `await waitFor(() => expect(...))` |
| `fireEvent` | Direct events (rarely needed) | `fireEvent.scroll(element)` |

### Query Priority (Same as Testing Library)

```typescript
// Priority 1: Accessible to everyone
canvas.getByRole("button", { name: /submit/i });
canvas.getByLabelText(/email/i);

// Priority 2: Semantic queries
canvas.getByText(/welcome/i);
canvas.getByAltText(/profile/i);

// Priority 3: Test IDs (last resort)
canvas.getByTestId("custom-element");
```

---

## Storybook 8 Migration Notes

### Removed Features

| Feature | Status | Migration |
|---------|--------|-----------|
| `storiesOf` API | Removed | Use CSF 3.0 format |
| `.stories.mdx` format | Removed | Split into separate `.stories.tsx` and `.mdx` files |
| Storyshots addon | Removed | Use `@storybook/addon-vitest` or Chromatic |
| `@storybook/testing-library` | Deprecated | Use `@storybook/test` |
| `@storybook/jest` | Deprecated | Use `@storybook/test` |
| `docs.autodocs` in main.ts | Deprecated | Use `tags: ["autodocs"]` in preview.ts |
| `globals` in preview.ts | Deprecated (8.2+) | Use `initialGlobals` |
| `globalTypes.defaultValue` | Deprecated (8.2+) | Use `initialGlobals` to set default values |
| `argTypesRegex` for actions | Limited | Cannot be used in play functions; use explicit `fn()` |
| `@storybook/test-runner` | Superseded (8.4+) | Use `@storybook/addon-vitest` for Vite projects |

### Package Consolidations

| Old Package | New Package |
|-------------|-------------|
| `@storybook/addons` | `@storybook/manager-api` or `@storybook/preview-api` |
| `@storybook/client-api` | `@storybook/preview-api` |
| `@storybook/channel-postmessage` | `@storybook/channels` |
| `@storybook/testing-library` | `@storybook/test` |
| `@storybook/jest` | `@storybook/test` |

### Default Changes in Storybook 8

- **react-docgen** is now the default for React component analysis (was `react-docgen-typescript`)
  - Faster (~50% startup improvement)
  - Limitation: Cannot extract types imported from other files
  - Use `react-docgen-typescript` if you need imported type support

### CSF Factories (Future)

CSF Factories is the next evolution of CSF, providing better TypeScript ergonomics. However, CSF 3.0 remains fully supported. Migration is optional and can be done incrementally.

```typescript
// CSF Factories preview (Storybook 10+)
import preview from '#.storybook/preview';

const meta = preview.meta({
  component: Button,
});

export const Primary = meta.story({
  args: { primary: true },
});
```
