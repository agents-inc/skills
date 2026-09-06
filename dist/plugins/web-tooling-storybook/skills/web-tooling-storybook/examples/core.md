# Storybook - Core Story Examples

> CSF 3.0 files, args, argTypes, decorators, render functions and organisation. See [../SKILL.md](../SKILL.md) for the decisions, and [testing.md](testing.md), [docs.md](docs.md) and [addons.md](addons.md) for the other halves.

---

## A Complete Story File

```typescript
// button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { children: "Button" },
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["primary", "secondary", "outline", "ghost"],
      description: "Visual style variant",
    },
    size: { control: { type: "radio" }, options: ["sm", "md", "lg"] },
    disabled: { control: { type: "boolean" } },
    onClick: { action: "clicked" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Primary: Story = {
  args: { variant: "primary", children: "Primary Button" },
};

export const Disabled: Story = {
  args: { disabled: true, children: "Disabled Button" },
};
```

**Why good:** `satisfies Meta<typeof Button>` checks the meta against the component's props while leaving `StoryObj<typeof meta>` enough inference to check each story's args. Defaults on `meta` mean `Default` needs no body at all.

---

## Args

### Inheriting, overriding and spreading

```typescript
const meta = {
  component: Card,
  args: {
    title: "Card Title",
    description: "This is a description of the card content.",
    variant: "default",
  },
} satisfies Meta<typeof Card>;

// Inherits everything
export const Default: Story = {};

// States only what differs
export const Highlighted: Story = {
  args: { variant: "highlighted" },
};

// Builds on another story's args
export const WithIcon: Story = {
  args: { ...Default.args, icon: "star", title: "Featured Card" },
};
```

**Why good:** the diff between stories is the story. A reader sees what makes each state different without comparing four near-identical objects.

### Children as args

```typescript
export const Default: Story = {
  args: { children: "This is an alert message." },
};

export const WithTitleAndDescription: Story = {
  args: {
    variant: "destructive",
    children: (
      <>
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Your session has expired.</AlertDescription>
      </>
    ),
  },
};
```

**Why good:** `children` is an ordinary prop, so composition stays in args and the controls panel still edits the rest.

---

## ArgTypes

### The control per prop

```typescript
argTypes: {
  label: {
    control: { type: "text" },
    table: { type: { summary: "string" }, defaultValue: { summary: "Label" } },
  },
  type: {
    control: { type: "select" },
    options: ["text", "email", "password", "number", "tel"],
  },
  size: { control: { type: "inline-radio" }, options: ["sm", "md", "lg"] },
  maxLength: { control: { type: "range", min: 1, max: 500, step: 10 } },
  borderColor: { control: { type: "color" } },
  validation: { control: { type: "object" } },

  // Documented but not editable
  internalId: { control: false, description: "Internal identifier" },

  // Hidden from controls and from the docs table
  __internal: { table: { disable: true } },

  onChange: { action: "changed" },
},
```

**Why good:** `control: false` and `table: { disable: true }` are different intentions — read-only in the docs, versus absent from them. The full prop-type-to-control mapping is in [../reference.md](../reference.md).

### Non-serializable values through `mapping`

```typescript
argTypes: {
  icon: {
    control: { type: "select" },
    options: ["home", "settings", "user"],
    mapping: {
      home: <HomeIcon />,
      settings: <SettingsIcon />,
      user: <UserIcon />,
    },
  },
},
```

**Why good:** args have to be serializable, so the control offers the string keys and `mapping` exchanges the selection for the element the component actually receives.

---

## Decorators

The same mechanism at three levels — global in `.storybook/preview`, component on `meta`, story on the story itself.

```typescript
// .storybook/preview.tsx — every story gets the provider
const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
};

export default preview;
```

```typescript
// tooltip.stories.tsx — this component needs room to be visible at all
const meta = {
  component: Tooltip,
  decorators: [
    (Story) => (
      <div style={{ padding: "4rem", display: "flex", justifyContent: "center" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Tooltip>;

// One story needs a different surface
export const OnDarkBackground: Story = {
  decorators: [
    (Story) => (
      <div style={{ background: "#1a1a1a", padding: "2rem" }}>
        <Story />
      </div>
    ),
  ],
  args: { content: "Tooltip on a dark surface" },
};
```

**Why good:** context that every story needs is declared once, and the component never learns it is being rendered by Storybook. Decorators run outermost to innermost, so a provider depending on another is listed after it.

---

## Render Functions

### Composition args cannot express

```typescript
const SAMPLE_ITEMS = ["First Item", "Second Item", "Third Item"];

export const WithItems: Story = {
  render: (args) => (
    <List {...args}>
      {SAMPLE_ITEMS.map((item) => (
        <ListItem key={item}>{item}</ListItem>
      ))}
    </List>
  ),
  args: { variant: "default" },
};
```

**Why good:** spreading `args` into the wrapper keeps the controls live for the props the story is actually about, while the children come from the render.

### State, through a named function

```typescript
export const Controlled: Story = {
  render: function Render(args) {
    const [open, setOpen] = useState(false);

    return (
      <>
        <Button onClick={() => setOpen(true)}>Open dialog</Button>
        <Dialog {...args} open={open} onOpenChange={setOpen}>
          <DialogTitle>Controlled dialog</DialogTitle>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </Dialog>
      </>
    );
  },
};
```

**Why good:** hooks are only legal inside a component, and a named function is what Storybook can treat as one. An arrow expression here throws at render.

---

## Organisation

```typescript
const meta = {
  // Nested segments become the sidebar hierarchy
  title: "Design System/Atoms/Button",
  component: Button,
  tags: ["autodocs"],
} satisfies Meta<typeof Button>;

// Names are read by people: say what the state is
export const Primary: Story = { args: { variant: "primary" } };
export const Loading: Story = { args: { isLoading: true } };
export const WithValidationError: Story = { args: { error: "Required" } };

// Not: Story1, Test, New2
```

**Why good:** the export name is what appears in the sidebar and in the docs page, so it is documentation whether or not it was written as any.

---

_See also:_ [testing.md](testing.md) · [docs.md](docs.md) · [addons.md](addons.md)
