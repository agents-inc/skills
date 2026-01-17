# Storybook - Documentation Examples

> Autodocs, MDX documentation, and docs customization. Reference from [SKILL.md](../SKILL.md).

---

## Autodocs Configuration

### Enabling Autodocs

```typescript
// button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],  // Enables automatic documentation
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;
```

**Why good:** Single tag generates complete documentation page with props table, source code, and controls

---

### Global Autodocs

```typescript
// .storybook/preview.tsx
import type { Preview } from "@storybook/react";

const preview: Preview = {
  // Enable autodocs for ALL components
  tags: ["autodocs"],
};

export default preview;
```

```typescript
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  // Other config...
  docs: {
    autodocs: "tag",  // Only generate for components with autodocs tag
    // autodocs: true,  // Generate for ALL components
  },
};

export default config;
```

**Why good:** Global configuration reduces per-file boilerplate, tag-based allows selective generation

---

## JSDoc for Props Documentation

### Component Props Documentation

```typescript
// button.tsx
interface ButtonProps {
  /**
   * The visual style variant of the button
   * @default "primary"
   */
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";

  /**
   * The size of the button
   * @default "md"
   */
  size?: "sm" | "md" | "lg";

  /**
   * Whether the button is disabled
   * @default false
   */
  disabled?: boolean;

  /**
   * Shows a loading spinner and disables interaction
   * @default false
   */
  isLoading?: boolean;

  /**
   * Icon to display before the button text
   */
  leftIcon?: React.ReactNode;

  /**
   * Icon to display after the button text
   */
  rightIcon?: React.ReactNode;

  /**
   * Handler called when the button is clicked
   */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;

  /**
   * The button content
   */
  children: React.ReactNode;
}

/**
 * Primary UI component for user interaction.
 *
 * Use buttons for actions in forms, dialogs, and more.
 * Buttons communicate the action that will occur when clicked.
 *
 * @example
 * ```tsx
 * <Button variant="primary" onClick={handleClick}>
 *   Click me
 * </Button>
 * ```
 */
export function Button({ variant = "primary", size = "md", ...props }: ButtonProps) {
  // Implementation
}
```

**Why good:** JSDoc comments appear in autodocs props table, @default shows default values, component description shows in docs header

---

## Custom Docs Page

### Customizing Docs Layout

```typescript
// button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import {
  Title,
  Subtitle,
  Description,
  Primary,
  Controls,
  Stories,
  Source,
} from "@storybook/blocks";
import { Button } from "./button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    docs: {
      page: () => (
        <>
          <Title />
          <Subtitle />
          <Description />
          <Primary />
          <Controls />
          <Stories includePrimary={false} />
        </>
      ),
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;
```

**Why good:** Custom docs page controls what appears and in what order, blocks are composable

---

### Adding Custom Content to Docs

```typescript
// avatar.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Title, Description, Primary, Controls, Stories, Markdown } from "@storybook/blocks";
import { Avatar } from "./avatar";

const USAGE_GUIDELINES = `
## Usage Guidelines

### When to use

- To represent a user in the interface
- In comment threads to identify authors
- In navigation to show logged-in user

### When not to use

- For decorative images (use regular \`<img>\`)
- For logos or brand marks
- When the image size will vary dramatically

### Accessibility

Always provide meaningful alt text. If the avatar is purely decorative
and the user's name is visible elsewhere, use \`aria-hidden="true"\`.
`;

const meta = {
  title: "Components/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  parameters: {
    docs: {
      page: () => (
        <>
          <Title />
          <Description />
          <Primary />
          <Controls />
          <Markdown>{USAGE_GUIDELINES}</Markdown>
          <Stories />
        </>
      ),
    },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;
```

**Why good:** Markdown block allows rich custom content, usage guidelines live with component

---

## MDX Documentation

### Component Documentation with MDX

```mdx
{/* button.mdx */}
import { Meta, Canvas, Controls, Story, Source, ArgTypes } from "@storybook/blocks";
import * as ButtonStories from "./button.stories";

<Meta of={ButtonStories} />

# Button

Buttons trigger actions when clicked. Use the appropriate variant to communicate intent.

## Overview

<Canvas of={ButtonStories.Primary} />

## Interactive Controls

<Controls />

## Variants

Buttons come in several variants for different use cases:

### Primary

Use for the main action on a page.

<Canvas of={ButtonStories.Primary} />

### Secondary

Use for less prominent actions.

<Canvas of={ButtonStories.Secondary} />

### Destructive

Use for dangerous or irreversible actions.

<Canvas of={ButtonStories.Destructive} />

## Sizes

<Canvas>
  <Story of={ButtonStories.Small} />
  <Story of={ButtonStories.Medium} />
  <Story of={ButtonStories.Large} />
</Canvas>

## Props

<ArgTypes of={ButtonStories} />

## Best Practices

- Use only one primary button per section
- Keep button text short and action-oriented
- Use icons to clarify meaning, not replace text
- Consider loading states for async actions

## Related Components

- [IconButton](?path=/docs/components-iconbutton--docs) - Button with only an icon
- [ButtonGroup](?path=/docs/components-buttongroup--docs) - Group of related buttons
```

**Why good:** MDX allows mixing documentation and live examples, Canvas shows interactive stories, ArgTypes generates props table

---

### Standalone Documentation Pages

```mdx
{/* docs/getting-started.mdx */}
import { Meta } from "@storybook/blocks";

<Meta title="Getting Started/Introduction" />

# Welcome to Our Design System

This Storybook documents the components and patterns used in our application.

## Quick Start

Install the component library:

```bash
npm install @company/ui
```

Import and use components:

```tsx
import { Button } from "@company/ui";

function App() {
  return <Button variant="primary">Click me</Button>;
}
```

## Principles

### Consistency

All components share common patterns for props, styling, and behavior.

### Accessibility

Every component is designed with accessibility in mind, following WCAG 2.1 guidelines.

### Composability

Components are designed to work together and can be combined in various ways.

## Navigation

- **Components** - Individual UI components
- **Patterns** - Common usage patterns and compositions
- **Tokens** - Design tokens (colors, spacing, typography)
```

**Why good:** Pure documentation pages without components, provides context and getting-started guides

---

### Design Token Documentation

```mdx
{/* docs/tokens/colors.mdx */}
import { Meta, ColorPalette, ColorItem } from "@storybook/blocks";

<Meta title="Design Tokens/Colors" />

# Colors

Our color palette is designed for accessibility and consistency.

## Primary Colors

<ColorPalette>
  <ColorItem
    title="Primary"
    subtitle="--color-primary"
    colors={{
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a",
    }}
  />
</ColorPalette>

## Semantic Colors

<ColorPalette>
  <ColorItem
    title="Success"
    subtitle="--color-success"
    colors={{ Default: "#10b981", Dark: "#059669" }}
  />
  <ColorItem
    title="Warning"
    subtitle="--color-warning"
    colors={{ Default: "#f59e0b", Dark: "#d97706" }}
  />
  <ColorItem
    title="Error"
    subtitle="--color-error"
    colors={{ Default: "#ef4444", Dark: "#dc2626" }}
  />
</ColorPalette>

## Usage

```css
.button-primary {
  background-color: var(--color-primary-500);
  color: white;
}

.button-primary:hover {
  background-color: var(--color-primary-600);
}
```
```

**Why good:** ColorPalette provides visual documentation, design tokens are documented alongside components

---

## Source Code Display

### Showing Source Code

```typescript
// card.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./card";

const meta = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    docs: {
      source: {
        type: "code",  // Shows actual source code
        // type: "dynamic",  // Shows rendered with current args
        // type: "auto",  // Storybook chooses (default)
      },
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Card Title",
    description: "Card description text",
  },
};

// Custom source code for a story
export const CustomSource: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<Card>
  <CardHeader>
    <CardTitle>Custom Title</CardTitle>
  </CardHeader>
  <CardContent>
    Content goes here
  </CardContent>
</Card>
        `,
        language: "tsx",
      },
    },
  },
  args: {
    title: "Custom Title",
  },
};
```

**Why good:** Source code helps developers copy-paste examples, custom source shows cleaner examples

---

### Transforming Source Code

```typescript
// .storybook/preview.tsx
import type { Preview } from "@storybook/react";

const preview: Preview = {
  parameters: {
    docs: {
      source: {
        // Remove args spread for cleaner examples
        transform: (src: string) => {
          return src.replace(/\{\.\.\.args\}/g, "").trim();
        },
      },
    },
  },
};

export default preview;
```

**Why good:** Source transforms can clean up generated code for better readability

---

## Story Descriptions

### Adding Story Descriptions

```typescript
// form.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Form } from "./form";

const meta = {
  title: "Components/Form",
  component: Form,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Forms collect user input. They include validation, error handling, and submission states.",
      },
    },
  },
} satisfies Meta<typeof Form>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: "The default form state, ready for user input.",
      },
    },
  },
};

export const WithValidationErrors: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Shows how validation errors are displayed. Errors appear inline below each field.",
      },
    },
  },
  args: {
    initialErrors: {
      email: "Please enter a valid email",
      password: "Password must be at least 8 characters",
    },
  },
};

export const Submitting: Story = {
  parameters: {
    docs: {
      description: {
        story: "Form in submission state. All fields are disabled and a loading indicator shows.",
      },
    },
  },
  args: {
    isSubmitting: true,
  },
};
```

**Why good:** Descriptions provide context without cluttering story code, appear in both canvas and docs

---

_For more patterns, see:_
- [core.md](core.md) - CSF 3.0 format, args, controls
- [testing.md](testing.md) - Play functions and interaction testing
- [addons.md](addons.md) - Addon configuration
