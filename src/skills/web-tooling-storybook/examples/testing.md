# Storybook - Testing Examples

> Play functions, composed flows, keyboard navigation, and the parameters visual and accessibility checks read. See [../SKILL.md](../SKILL.md) for the decisions, and [core.md](core.md) for the story formats these build on.

---

## Play Function Basics

```typescript
// button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { Button } from "./button";

const meta = {
  component: Button,
  tags: ["autodocs"],
  args: { onClick: fn() }, // records calls, so the assertion is about behaviour
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Clicked: Story = {
  args: { children: "Click me" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /click me/i });

    await userEvent.click(button);

    await expect(args.onClick).toHaveBeenCalled();
  },
};
```

**Why good:** `fn()` makes the handler assertable, and every interaction is awaited so the assertion cannot outrun it.

---

## Forms

```typescript
import { expect, fn, userEvent, waitFor, within } from "@storybook/test";

// meta carries args: { onSubmit: fn() }
const TEST_EMAIL = "test@example.com";
const TEST_PASSWORD = "SecurePassword123";

export const FilledAndSubmitted: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText(/email/i), TEST_EMAIL);
    await userEvent.type(canvas.getByLabelText(/password/i), TEST_PASSWORD);
    await userEvent.click(canvas.getByRole("button", { name: /sign in/i }));

    await expect(args.onSubmit).toHaveBeenCalledWith({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
  },
};

export const WithValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(canvas.getByText(/email is required/i)).toBeInTheDocument();
    });
  },
};
```

**Why good:** the queries are the ones a user has available — a label, a button's accessible name — so the test fails when the form becomes unusable, not when its markup changes. `waitFor` covers validation that resolves asynchronously.

---

## Content That Arrives Later

```typescript
export const LoadsUserData: Story = {
  args: { userId: "123" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(
      () => {
        expect(canvas.queryByText(/loading/i)).not.toBeInTheDocument();
      },
      { timeout: 5000 }, // raise the wait only for a state that is genuinely slow
    );

    await expect(canvas.getByText(/john doe/i)).toBeInTheDocument();
  },
};

export const HandlesError: Story = {
  args: { userId: "invalid" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const errorMessage = await canvas.findByRole("alert");
    await expect(errorMessage).toHaveTextContent(/failed to load/i);
  },
};
```

**Why good:** play functions run after the first render, so anything asynchronous needs `waitFor` or a `findBy` query. A `getBy` here fails on the render before the data arrives.

---

## Composing Play Functions

A story's play function is callable from another story, so a multi-step flow is a chain of states rather than one long test.

```typescript
export const ShippingFilled: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText(/address/i), "123 Main St");
    await userEvent.type(canvas.getByLabelText(/city/i), "New York");
    await expect(canvas.getByLabelText(/address/i)).toHaveValue("123 Main St");
  },
};

export const PaymentStep: Story = {
  play: async (context) => {
    await ShippingFilled.play?.(context);

    const canvas = within(context.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /continue/i }));
    await expect(canvas.getByText(/payment information/i)).toBeInTheDocument();
  },
};

export const OrderSubmitted: Story = {
  play: async (context) => {
    await PaymentStep.play?.(context);

    const canvas = within(context.canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /place order/i }));
    await expect(canvas.getByText(/order confirmed/i)).toBeInTheDocument();
  },
};
```

**Why good:** each step is a state someone can open and look at, and the last one is reachable in a click rather than by replaying the flow by hand. The optional call (`play?.`) is because a story is not required to have one.

---

## Keyboard Navigation

```typescript
export const KeyboardNavigation: Story = {
  render: () => (
    <Dropdown trigger="Select option">
      <DropdownItem>Option 1</DropdownItem>
      <DropdownItem>Option 2</DropdownItem>
    </Dropdown>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /select option/i });

    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("menu")).toBeInTheDocument();

    await userEvent.keyboard("{ArrowDown}");
    await expect(canvas.getByText("Option 1")).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("menu")).not.toBeInTheDocument();
    await expect(trigger).toHaveFocus();
  },
};
```

**Why good:** keyboard behaviour and focus return are the parts of a menu that nothing else checks, and they are exactly what a mouse-driven story never exercises.

---

## Visual Regression Parameters

Visual testing tools read the `chromatic` parameter namespace to decide what to capture.

```typescript
const meta = {
  component: Button,
  parameters: {
    chromatic: { viewports: [320, 768, 1200] },
  },
} satisfies Meta<typeof Button>;

// A story that animates produces a different image every run
export const WithAnimation: Story = {
  parameters: { chromatic: { disableSnapshot: true } },
  args: { isAnimating: true },
};

// Content that settles after render
export const WithAsyncContent: Story = {
  parameters: { chromatic: { delay: 500 } },
};
```

**Why good:** `disableSnapshot` and `delay` are what make a capture deterministic — skip a story that cannot be, wait for one that only needs a moment.

---

## Accessibility Parameters

```typescript
const meta = {
  component: Card,
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: "color-contrast", enabled: true },
          // A component in isolation is not a page
          { id: "landmark-one-main", enabled: false },
        ],
      },
    },
  },
} satisfies Meta<typeof Card>;

// Deliberately non-conformant, kept as documentation
export const LowContrast: Story = {
  parameters: { a11y: { disable: true } },
};
```

**Why good:** rules that assume a whole document report failures no component can fix, and leaving them on trains people to ignore the panel.

---

_See also:_ [core.md](core.md) · [docs.md](docs.md) · [addons.md](addons.md), and [../reference.md](../reference.md) for the `@storybook/test` API table.
