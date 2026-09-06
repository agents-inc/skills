---
name: web-tooling-storybook
description: Storybook patterns - CSF 3.0, args, controls, autodocs, play functions, interaction testing, visual testing, addons configuration
---

# Storybook Patterns

> **Quick Guide:** A story is a component in one state, written as a plain object in CSF 3.0: a default `meta` export describing the component, then one named export per state. Props come from `args` so the controls panel can edit them, `argTypes` shapes those controls, `tags: ["autodocs"]` turns the file into a documentation page, and a `play` function drives interactions with `@storybook/test` so the same story doubles as a test.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — CSF 3.0 files, args inheritance, argTypes, decorators, render functions, story organisation
- [examples/testing.md](examples/testing.md) — play functions, composed flows, keyboard navigation, visual and accessibility parameters
- [examples/docs.md](examples/docs.md) — autodocs, custom docs pages, MDX, source display, descriptions
- [examples/addons.md](examples/addons.md) — addon setup, viewports, backgrounds, the test addon, configuration decisions
- [reference.md](reference.md) — control types, parameters, addon list, `@storybook/test` API, file naming, migration notes

---

## Which path applies

A story file usually serves both, but the two make different demands on how it is written.

- **Documenting a component** — every meaningful state is an export, props are args so they can be edited, and `tags: ["autodocs"]` generates the page. Follow [examples/docs.md](examples/docs.md).
- **Testing a component** — the story is a fixture, `fn()` args record calls, and a `play` function performs the interaction and asserts. Follow [examples/testing.md](examples/testing.md).

---

<critical_requirements>

## Before writing stories

**Write CSF 3.0 with `satisfies Meta<typeof Component>`.** The `satisfies` clause type-checks `meta` against the component's props while keeping the inference `StoryObj<typeof meta>` needs, so every story's args are checked against the real prop types.

**Give `meta` a `component`.** Controls are inferred from its props and autodocs documents it, so a meta without one produces a page with no props table and stories that may not render.

**Express state through `args`, not through JSX.** The controls panel edits args; props hardcoded in a `render` are invisible to it, and the story stops being explorable.

**Drive interactions from a `play` function using `@storybook/test`.** Its `userEvent` reproduces the event sequence a real input produces, and `fn()` args record calls so the assertion can be about behaviour rather than markup.

**Export stories as named exports.** The default export is the meta, and a file can only have one.

</critical_requirements>

---

**Auto-detection:** Storybook, .stories.tsx, .stories.ts, CSF, Meta, StoryObj, satisfies Meta, args, argTypes, play function, canvasElement, within, autodocs, decorators, parameters, @storybook/test, .storybook/main.ts, .storybook/preview.ts

**Applies to:**

- Building a component in isolation, without the app's routing, data or auth
- Documenting a component API so the documentation cannot drift from the code
- Interaction tests that run against the rendered component in a browser
- Exposing every state of a component — loading, empty, error, disabled — as something reviewable

**Handled elsewhere:**

- Full user journeys across pages, which need the whole application running
- Unit tests of logic with no rendered output
- The actual styling of components; stories render whatever the component already produces
- Baseline custody and diff review for screenshots — this skill settles which stories are captured and with what parameters, not what happens to the images
- Network responses the component depends on, which reach it through whatever mocking the project uses

---

<philosophy>

Storybook is component-driven development made concrete: build from the bottom up, and let each component exist before the screen that uses it does.

A story is a documented example rather than a test case. It captures one meaningful state — primary, disabled, loading, error — and its value is that a person can look at it. A `play` function then turns that same example into a test without changing what it documents, which is why the assertion belongs to the story rather than the story being written for the assertion.

</philosophy>

---

<decision_framework>

## Args or a render function

```
Do all the variations come from props?
├─ YES → args only
└─ NO  → Children or composition?
    ├─ Simple (text, one element) → args.children
    └─ Complex (several elements) → render: (args) => …
        └─ Needs state to demonstrate? → render: function Render(args) { … }
              (a named function, so hooks are legal)
```

A `render` that keeps growing is usually the component's API asking for the composition the render is faking.

## What to add to a story

```
Interaction to verify?      → play function with @storybook/test
Appearance to lock down?    → visual regression parameters on the story
Accessibility to check?     → a11y parameters; the addon runs axe on every story
Nothing to verify yet?      → leave it as a documented state
```

## Which components get stories

Primitives document every variant; composed components show the compositions that are actually used; page-level components show the states that are hard to reach by hand — loading, empty, error. A component with no visual output gets none.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: CSF 3.0 Story Format

A typed `meta` default export, then one named export per state.

```typescript
const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: "primary", children: "Save" },
};
```

`title` decides where the component sits in the sidebar; nested segments (`"Components/Forms/Input"`) create the hierarchy.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Args and ArgTypes

`args` are the props a story renders with; `argTypes` describe the control that edits them. Defaults on `meta` are inherited, so each story states only what makes it different.

```typescript
const meta = {
  component: Card,
  args: { title: "Card title" },
  argTypes: {
    variant: { control: { type: "select" }, options: ["default", "outline"] },
    padding: { control: { type: "range", min: 0, max: 64, step: 4 } },
    internalId: { table: { disable: true } },
  },
} satisfies Meta<typeof Card>;
```

Args must be serializable — a function arg is `fn()` from `@storybook/test`, and a non-serializable value such as a React element reaches a control through `mapping`.

Full code, and the control type per prop type: [examples/core.md](examples/core.md) · [reference.md](reference.md)

---

### Pattern 3: Decorators for Context

A decorator wraps the story: providers a component needs, or layout it needs to be visible.

```typescript
const meta = {
  component: Modal,
  decorators: [
    (Story) => (
      <div style={{ padding: "3rem" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Modal>;
```

Global decorators go in `.storybook/preview`, component decorators on `meta`, and story decorators on the story. They run outermost to innermost, so order matters wherever one provider depends on another.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Parameters

Parameters configure Storybook and its addons, at whichever level the setting belongs to — global, component or story.

```typescript
parameters: {
  layout: "centered",
  viewport: { defaultViewport: "mobile1" },
  docs: { description: { component: "A modal dialog for confirmations." } },
},
```

A story-level parameter overrides the component's, which overrides the global one.

Full list: [reference.md](reference.md)

---

### Pattern 5: Play Functions

A `play` function runs after render, inside the rendered canvas.

```typescript
export const Submitted: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText(/email/i), "user@example.com");
    await userEvent.click(canvas.getByRole("button", { name: /sign in/i }));
    await expect(args.onSubmit).toHaveBeenCalled();
  },
};
```

`within(canvasElement)` scopes queries to this story rather than the whole page. Every `userEvent` call is awaited, and a story's play function can be called from another's to build a multi-step flow.

Full code: [examples/testing.md](examples/testing.md)

---

### Pattern 6: Render Functions

Use `render` when a story needs more than one element, or state to demonstrate the component.

```typescript
export const WithItems: Story = {
  render: (args) => (
    <List {...args}>
      {ITEMS.map((item) => (
        <ListItem key={item}>{item}</ListItem>
      ))}
    </List>
  ),
  args: { variant: "default" },
};
```

Spread `args` into the component so the controls still work. A render function needing hooks is written as a named function (`render: function Render(args) { … }`), since hooks are only legal inside a component.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 7: Tags

Tags decide where a story appears and what runs against it — `autodocs` generates the page, `dev` shows it in the sidebar, `test` includes it in test runs. Inherited tags are removed with a `!` prefix.

```typescript
export const Experimental: Story = {
  tags: ["!test", "experimental"],
};
```

Full code: [examples/addons.md](examples/addons.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A second default export for a story — a module has one default export, which the meta already is
- `meta` without `component` — controls have no props to infer from, autodocs has nothing to document, and the story may not render at all
- `userEvent` calls that are not awaited — the assertion runs before the interaction finishes, so the story fails or passes depending on timing
- A `render` function using hooks while written as an arrow expression — hooks need a named function that Storybook can treat as a component
- A non-serializable arg passed directly — functions need `fn()`, and elements need `mapping`, or the control panel cannot round-trip the value

**Surprising behaviour:**

- Props hardcoded in a `render` instead of passed as args — controls silently do nothing, and the docs page shows a component nobody can experiment with
- `fireEvent` in a play function — it dispatches one event where a real interaction produces a sequence, so focus, hover and keyboard behaviour go untested
- Actions inferred by pattern (`argTypesRegex`) rather than declared with `fn()` — an implicit action cannot be asserted on inside a play function
- Assertions in a story body rather than in `play` — they run at module evaluation, before anything is rendered
- Play functions run after render, so content that arrives asynchronously needs `waitFor` or a `findBy` query rather than a `getBy`
- Decorators run outermost to innermost — a provider that depends on another has to be listed after it
- Args edited in the controls panel survive a hot reload, so a change to the story's own `args` can appear to have no effect until the page is refreshed
- Missing `tags: ["autodocs"]` produces a story with no documentation page and no warning that one was expected
- Business logic inside a play function tests the logic through the DOM, where a unit test would say more and run faster

Version-specific behaviour — deprecated fields, renamed globals, removed packages — is in [reference.md](reference.md) rather than here, because which of them applies depends on the major you are on.

</red_flags>
