# Storybook - Documentation Examples

> Autodocs, custom docs pages, MDX, source display and descriptions. See [../SKILL.md](../SKILL.md) for the decisions, and [../reference.md](../reference.md) for the fields that changed between majors.

---

## Autodocs

```typescript
// button.stories.tsx — this component gets a docs page
const meta = {
  component: Button,
  tags: ["autodocs"],
} satisfies Meta<typeof Button>;
```

```typescript
// .storybook/preview.tsx — every component gets one
const preview: Preview = {
  tags: ["autodocs"],
};

export default preview;
```

**Why good:** one tag produces a page carrying the props table, the source and the controls. Setting it globally and removing it per component (`tags: ["!autodocs"]`) is less repetition than adding it in every file.

JSDoc on the component and its props feeds that props table directly — `@default` shows the default value, and the component's own doc comment becomes the page description. Nothing Storybook-specific is involved; it reads what the docgen step extracts.

---

## Custom Docs Pages

### Choosing what appears, and in what order

```typescript
import { Title, Subtitle, Description, Primary, Controls, Stories } from "@storybook/blocks";

const meta = {
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
```

**Why good:** the default page is a fixed composition of these blocks, so replacing it is a matter of listing the ones you want.

### Adding prose to the generated page

```typescript
import { Markdown } from "@storybook/blocks";

const USAGE_GUIDELINES = `
## Usage

- To represent a user in the interface
- In comment threads to identify authors

Not for decorative images, logos, or anywhere the size varies dramatically.

Always provide meaningful alt text. Where the avatar is decorative and the
name is visible elsewhere, use \`aria-hidden="true"\`.
`;

const meta = {
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
```

**Why good:** guidance about when to use a component lives beside the component, so it is updated by whoever changes it.

---

## MDX

### A component page

```mdx
{/* button.mdx */}
import { Meta, Canvas, Controls, ArgTypes } from "@storybook/blocks";
import \* as ButtonStories from "./button.stories";

<Meta of={ButtonStories} />

# Button

Buttons trigger actions. The variant communicates intent.

<Canvas of={ButtonStories.Primary} />

<Controls />

## Variants

Use primary for the main action on a page, secondary for everything else, and
destructive for anything irreversible.

<Canvas of={ButtonStories.Destructive} />

## Props

<ArgTypes of={ButtonStories} />
```

**Why good:** the examples are the real stories rather than copies of them, so the page cannot document a component that no longer exists.

### A page with no component

```mdx
{/* docs/getting-started.mdx */}
import { Meta } from "@storybook/blocks";

<Meta title="Getting Started/Introduction" />

# Welcome
```

**Why good:** `<Meta title="…" />` with no `of` puts a documentation-only page in the sidebar, which is how introductions and conventions pages get in.

### Design tokens

```mdx
{/* docs/tokens/colors.mdx */}
import { Meta, ColorPalette, ColorItem } from "@storybook/blocks";

<Meta title="Design Tokens/Colors" />

<ColorPalette>
  <ColorItem
    title="Primary"
    subtitle="--color-primary"
    colors={{ 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8" }}
  />
</ColorPalette>
```

**Why good:** `ColorPalette` renders the swatches and their names together, so the documented token and the value it holds cannot disagree.

---

## Source Display

```typescript
const meta = {
  component: Card,
  tags: ["autodocs"],
  parameters: {
    docs: {
      source: { type: "code" }, // the source as written; "dynamic" renders current args
    },
  },
} satisfies Meta<typeof Card>;

// Show something cleaner than the story's own body
export const CustomSource: Story = {
  parameters: {
    docs: {
      source: {
        code: `<Card>
  <CardHeader>
    <CardTitle>Custom Title</CardTitle>
  </CardHeader>
</Card>`,
        language: "tsx",
      },
    },
  },
};
```

```typescript
// .storybook/preview.tsx — drop the args spread from every snippet
const preview: Preview = {
  parameters: {
    docs: {
      source: {
        transform: (src: string) => src.replace(/\{\.\.\.args\}/g, "").trim(),
      },
    },
  },
};
```

**Why good:** the generated snippet contains the machinery that makes controls work, which a reader copying the example does not want. `transform` removes it once for every story.

---

## Descriptions

```typescript
const meta = {
  component: Form,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Forms collect user input, with validation and submission states.",
      },
    },
  },
} satisfies Meta<typeof Form>;

export const WithValidationErrors: Story = {
  parameters: {
    docs: {
      description: {
        story: "Errors appear inline below each field.",
      },
    },
  },
  args: { initialErrors: { email: "Please enter a valid email" } },
};
```

**Why good:** `description.component` and `description.story` land in different places on the page, so the state's explanation sits with the state rather than in a preamble nobody reads twice.

---

_See also:_ [core.md](core.md) · [testing.md](testing.md) · [addons.md](addons.md)
