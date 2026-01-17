# Storybook - Core Story Examples

> CSF 3.0 format, args, controls, and story organization. Reference from [SKILL.md](../SKILL.md).

---

## CSF 3.0 Basic Structure

### Complete Story File Template

```typescript
// button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

// Constants for story args
const BUTTON_TEXT_PRIMARY = "Primary Button";
const BUTTON_TEXT_SECONDARY = "Secondary Button";
const BUTTON_TEXT_DISABLED = "Disabled Button";

// Meta object - default export
const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  // Default args for all stories
  args: {
    children: "Button",
  },
  // Configure controls
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["primary", "secondary", "outline", "ghost"],
      description: "Visual style variant",
    },
    size: {
      control: { type: "radio" },
      options: ["sm", "md", "lg"],
      description: "Button size",
    },
    disabled: {
      control: { type: "boolean" },
      description: "Disables the button",
    },
    onClick: {
      action: "clicked",
      description: "Click handler",
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Stories - named exports
export const Default: Story = {};

export const Primary: Story = {
  args: {
    variant: "primary",
    children: BUTTON_TEXT_PRIMARY,
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: BUTTON_TEXT_SECONDARY,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: BUTTON_TEXT_DISABLED,
  },
};
```

**Why good:** Complete type safety with `satisfies Meta`, default args reduce duplication, argTypes provide documentation and controls, named constants for test data

---

## Args Patterns

### Inheriting and Overriding Args

```typescript
// card.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./card";

const DEFAULT_TITLE = "Card Title";
const DEFAULT_DESCRIPTION = "This is a description of the card content.";

const meta = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
  // Default args applied to all stories
  args: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    variant: "default",
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

// Inherits all default args
export const Default: Story = {};

// Overrides only what changes
export const Highlighted: Story = {
  args: {
    variant: "highlighted",
    // title and description inherited from defaults
  },
};

// Multiple overrides
export const Compact: Story = {
  args: {
    variant: "compact",
    title: "Compact Card",
    showDescription: false,
  },
};

// Spread and extend
export const WithIcon: Story = {
  args: {
    ...Default.args,
    icon: "star",
    title: "Featured Card",
  },
};
```

**Why good:** DRY principle applied to stories, easy to see what makes each story unique, defaults documented once

---

### Children as Args

```typescript
// alert.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Alert, AlertTitle, AlertDescription } from "./alert";

const meta = {
  title: "Components/Alert",
  component: Alert,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["default", "destructive", "success", "warning"],
    },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

// Simple children
export const Default: Story = {
  args: {
    children: "This is an alert message.",
  },
};

// Complex children with JSX
export const WithTitleAndDescription: Story = {
  args: {
    variant: "default",
    children: (
      <>
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription>
          You can add components to your app using the CLI.
        </AlertDescription>
      </>
    ),
  },
};

// Destructive variant
export const Destructive: Story = {
  args: {
    variant: "destructive",
    children: (
      <>
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Your session has expired. Please log in again.
        </AlertDescription>
      </>
    ),
  },
};
```

**Why good:** Children prop works naturally with args, JSX allowed for complex compositions

---

## ArgTypes Configuration

### Control Type Examples

```typescript
// form-field.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { FormField } from "./form-field";

const meta = {
  title: "Components/FormField",
  component: FormField,
  tags: ["autodocs"],
  argTypes: {
    // Text input
    label: {
      control: { type: "text" },
      description: "Field label",
      table: {
        type: { summary: "string" },
        defaultValue: { summary: "Label" },
      },
    },

    // Select dropdown
    type: {
      control: { type: "select" },
      options: ["text", "email", "password", "number", "tel"],
      description: "Input type",
    },

    // Radio buttons (inline)
    size: {
      control: { type: "inline-radio" },
      options: ["sm", "md", "lg"],
      description: "Field size",
    },

    // Boolean checkbox
    required: {
      control: { type: "boolean" },
      description: "Whether the field is required",
    },

    // Number with range
    maxLength: {
      control: { type: "range", min: 1, max: 500, step: 10 },
      description: "Maximum character length",
    },

    // Color picker
    borderColor: {
      control: { type: "color" },
      description: "Border color on focus",
    },

    // Object editor
    validation: {
      control: { type: "object" },
      description: "Validation rules object",
    },

    // Disable control (still shows in docs)
    internalId: {
      control: false,
      description: "Internal identifier (read-only)",
    },

    // Hide from both controls and docs
    __internal: {
      table: { disable: true },
    },

    // Action handler
    onChange: {
      action: "changed",
      description: "Called when value changes",
    },
  },
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Email Address",
    type: "email",
    size: "md",
    required: true,
    maxLength: 100,
  },
};
```

**Why good:** Each control type matches the data type, descriptions serve as documentation, table configuration controls display

---

### Mapping Values to Labels

```typescript
// icon-button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { IconButton } from "./icon-button";
import { Home, Settings, User, Mail, Bell, Search } from "lucide-react";

const meta = {
  title: "Components/IconButton",
  component: IconButton,
  tags: ["autodocs"],
  argTypes: {
    icon: {
      control: { type: "select" },
      options: ["home", "settings", "user", "mail", "bell", "search"],
      mapping: {
        home: <Home />,
        settings: <Settings />,
        user: <User />,
        mail: <Mail />,
        bell: <Bell />,
        search: <Search />,
      },
      description: "Icon to display",
    },
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: "home",
    "aria-label": "Home",
  },
};
```

**Why good:** Mapping allows non-serializable values (React elements) in controls, user sees friendly names

---

## Decorators

### Styling Decorators

```typescript
// tooltip.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Tooltip } from "./tooltip";

const meta = {
  title: "Components/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  decorators: [
    // Add spacing for tooltip visibility
    (Story) => (
      <div style={{ padding: "4rem", display: "flex", justifyContent: "center" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: "This is a helpful tooltip",
    children: <button>Hover me</button>,
  },
};

// Story-specific decorator for dark background
export const OnDarkBackground: Story = {
  decorators: [
    (Story) => (
      <div style={{ background: "#1a1a1a", padding: "2rem", borderRadius: "8px" }}>
        <Story />
      </div>
    ),
  ],
  args: {
    content: "Tooltip on dark background",
    children: <button style={{ color: "white" }}>Hover me</button>,
  },
};
```

**Why good:** Decorators provide necessary context without modifying component, story-level decorators allow variations

---

### Provider Decorators

```typescript
// themed-button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { ThemeProvider } from "../theme-provider";

const meta = {
  title: "Components/ThemedButton",
  component: Button,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="light">
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light: Story = {
  args: {
    children: "Light Theme Button",
  },
};

export const Dark: Story = {
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="dark">
        <div className="dark bg-slate-900 p-8 rounded">
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  args: {
    children: "Dark Theme Button",
  },
};
```

**Why good:** Provider wrapping allows context-dependent components to work, theme variations are explicit

---

## Render Functions

### Custom Composition

```typescript
// list.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { List, ListItem } from "./list";

const SAMPLE_ITEMS = ["First Item", "Second Item", "Third Item", "Fourth Item"];

const meta = {
  title: "Components/List",
  component: List,
  tags: ["autodocs"],
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

// Args-only for simple case
export const Empty: Story = {
  args: {
    children: null,
  },
};

// Render function for composition
export const WithItems: Story = {
  render: (args) => (
    <List {...args}>
      {SAMPLE_ITEMS.map((item) => (
        <ListItem key={item}>{item}</ListItem>
      ))}
    </List>
  ),
  args: {
    variant: "default",
  },
};

// Render function with interactive items
export const WithSelectableItems: Story = {
  render: (args) => (
    <List {...args}>
      {SAMPLE_ITEMS.map((item) => (
        <ListItem key={item} selectable>
          {item}
        </ListItem>
      ))}
    </List>
  ),
  args: {
    variant: "selectable",
  },
};
```

**Why good:** Render functions enable compositions that args can't express, args still control the wrapper component

---

### Render with Hooks

```typescript
// dialog.stories.tsx
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./dialog";
import { Button } from "./button";

const meta = {
  title: "Components/Dialog",
  component: Dialog,
  tags: ["autodocs"],
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// Uncontrolled dialog (default behavior)
export const Default: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog Title</DialogTitle>
        </DialogHeader>
        <p>This is the dialog content.</p>
      </DialogContent>
    </Dialog>
  ),
};

// Controlled dialog with hooks
// NOTE: Named function enables hooks
export const Controlled: Story = {
  render: function Render(args) {
    const [open, setOpen] = useState(false);

    return (
      <div>
        <Button onClick={() => setOpen(true)}>Open Controlled Dialog</Button>
        <Dialog {...args} open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Controlled Dialog</DialogTitle>
            </DialogHeader>
            <p>This dialog is controlled by React state.</p>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
};
```

**Why good:** Named render functions allow hooks, demonstrates both controlled and uncontrolled patterns

---

## Story Organization

### Grouped Stories

```typescript
// button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta = {
  title: "Design System/Atoms/Button",
  component: Button,
  tags: ["autodocs"],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Variants group
export const Primary: Story = {
  args: { variant: "primary", children: "Primary" },
};

export const Secondary: Story = {
  args: { variant: "secondary", children: "Secondary" },
};

export const Outline: Story = {
  args: { variant: "outline", children: "Outline" },
};

export const Ghost: Story = {
  args: { variant: "ghost", children: "Ghost" },
};

// Sizes group
export const Small: Story = {
  args: { size: "sm", children: "Small" },
};

export const Medium: Story = {
  args: { size: "md", children: "Medium" },
};

export const Large: Story = {
  args: { size: "lg", children: "Large" },
};

// States group
export const Disabled: Story = {
  args: { disabled: true, children: "Disabled" },
};

export const Loading: Story = {
  args: { isLoading: true, children: "Loading" },
};

// With icon
export const WithLeftIcon: Story = {
  args: {
    children: "Settings",
    leftIcon: "settings",
  },
};

export const WithRightIcon: Story = {
  args: {
    children: "Next",
    rightIcon: "arrow-right",
  },
};
```

**Why good:** Stories grouped by concern (variants, sizes, states), title hierarchy creates navigation structure

---

_For more patterns, see:_
- [docs.md](docs.md) - Autodocs and MDX documentation
- [testing.md](testing.md) - Play functions and interaction testing
- [addons.md](addons.md) - Addon configuration
