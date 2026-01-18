# Storybook - Testing Examples

> Play functions, interaction testing, visual testing. Reference from [SKILL.md](../SKILL.md).

---

## Play Function Basics

### Simple Interaction Test

```typescript
// button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "@storybook/test";
import { Button } from "./button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  args: {
    onClick: fn(),  // Mock function to track calls
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Click me",
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Find the button
    const button = canvas.getByRole("button", { name: /click me/i });

    // Assert it's rendered
    await expect(button).toBeInTheDocument();

    // Click it
    await userEvent.click(button);

    // Assert the handler was called
    await expect(args.onClick).toHaveBeenCalled();
  },
};
```

**Why good:** Tests run in actual browser, uses Testing Library queries for consistency, `fn()` tracks function calls

---

### Form Interaction Test

```typescript
// login-form.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within, waitFor } from "@storybook/test";
import { LoginForm } from "./login-form";

const TEST_EMAIL = "test@example.com";
const TEST_PASSWORD = "SecurePassword123";

const meta = {
  title: "Forms/LoginForm",
  component: LoginForm,
  tags: ["autodocs"],
  args: {
    onSubmit: fn(),
  },
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FilledAndSubmitted: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Find form elements
    const emailInput = canvas.getByLabelText(/email/i);
    const passwordInput = canvas.getByLabelText(/password/i);
    const submitButton = canvas.getByRole("button", { name: /sign in/i });

    // Fill the form
    await userEvent.type(emailInput, TEST_EMAIL);
    await userEvent.type(passwordInput, TEST_PASSWORD);

    // Submit
    await userEvent.click(submitButton);

    // Verify submission
    await expect(args.onSubmit).toHaveBeenCalledWith({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
  },
};

export const WithValidationErrors: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Submit without filling
    const submitButton = canvas.getByRole("button", { name: /sign in/i });
    await userEvent.click(submitButton);

    // Wait for validation errors
    await waitFor(() => {
      expect(canvas.getByText(/email is required/i)).toBeInTheDocument();
      expect(canvas.getByText(/password is required/i)).toBeInTheDocument();
    });
  },
};
```

**Why good:** Tests actual user flow, validation errors verified, waitFor handles async validation

---

## Advanced Play Functions

### Testing Async Content

```typescript
// user-profile.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within, waitFor } from "@storybook/test";
import { UserProfile } from "./user-profile";

const LOADING_TIMEOUT_MS = 5000;

const meta = {
  title: "Features/UserProfile",
  component: UserProfile,
  tags: ["autodocs"],
} satisfies Meta<typeof UserProfile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoadsUserData: Story = {
  args: {
    userId: "123",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for loading to complete
    await waitFor(
      () => {
        expect(canvas.queryByText(/loading/i)).not.toBeInTheDocument();
      },
      { timeout: LOADING_TIMEOUT_MS }
    );

    // Verify user data appears
    await expect(canvas.getByText(/john doe/i)).toBeInTheDocument();
    await expect(canvas.getByText(/john@example.com/i)).toBeInTheDocument();
  },
};

export const HandlesError: Story = {
  args: {
    userId: "invalid",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for error state
    const errorMessage = await canvas.findByRole("alert");
    await expect(errorMessage).toHaveTextContent(/failed to load/i);
  },
};
```

**Why good:** `waitFor` handles async state changes, `findBy` queries handle appearing elements

---

### Composing Play Functions

```typescript
// checkout-flow.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { CheckoutForm } from "./checkout-form";

const meta = {
  title: "Features/CheckoutForm",
  component: CheckoutForm,
  tags: ["autodocs"],
} satisfies Meta<typeof CheckoutForm>;

export default meta;
type Story = StoryObj<typeof meta>;

// Base story - just renders
export const Default: Story = {};

// Step 1: Fill shipping
export const ShippingFilled: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText(/address/i), "123 Main St");
    await userEvent.type(canvas.getByLabelText(/city/i), "New York");
    await userEvent.type(canvas.getByLabelText(/zip/i), "10001");

    await expect(canvas.getByLabelText(/address/i)).toHaveValue("123 Main St");
  },
};

// Step 2: Continue to payment (builds on Step 1)
export const PaymentStep: Story = {
  play: async (context) => {
    // Run shipping step first
    await ShippingFilled.play?.(context);

    const canvas = within(context.canvasElement);

    // Click next to go to payment
    await userEvent.click(canvas.getByRole("button", { name: /continue/i }));

    // Verify we're on payment step
    await expect(canvas.getByText(/payment information/i)).toBeInTheDocument();
  },
};

// Step 3: Complete payment (builds on Step 2)
export const PaymentFilled: Story = {
  play: async (context) => {
    // Run through to payment step
    await PaymentStep.play?.(context);

    const canvas = within(context.canvasElement);

    // Fill payment details
    await userEvent.type(canvas.getByLabelText(/card number/i), "4242424242424242");
    await userEvent.type(canvas.getByLabelText(/expiry/i), "12/25");
    await userEvent.type(canvas.getByLabelText(/cvc/i), "123");
  },
};

// Final step: Submit order
export const OrderSubmitted: Story = {
  play: async (context) => {
    // Run through payment
    await PaymentFilled.play?.(context);

    const canvas = within(context.canvasElement);

    // Submit order
    await userEvent.click(canvas.getByRole("button", { name: /place order/i }));

    // Verify confirmation
    await expect(canvas.getByText(/order confirmed/i)).toBeInTheDocument();
  },
};
```

**Why good:** Stories build on each other, tests multi-step flows, each story represents a meaningful state

---

### Testing Keyboard Navigation

```typescript
// dropdown.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Dropdown, DropdownItem } from "./dropdown";

const meta = {
  title: "Components/Dropdown",
  component: Dropdown,
  tags: ["autodocs"],
} satisfies Meta<typeof Dropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const KeyboardNavigation: Story = {
  render: () => (
    <Dropdown trigger="Select option">
      <DropdownItem>Option 1</DropdownItem>
      <DropdownItem>Option 2</DropdownItem>
      <DropdownItem>Option 3</DropdownItem>
    </Dropdown>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /select option/i });

    // Open with Enter
    trigger.focus();
    await userEvent.keyboard("{Enter}");

    // Menu should be open
    await expect(canvas.getByRole("menu")).toBeInTheDocument();

    // Navigate with arrow keys
    await userEvent.keyboard("{ArrowDown}");
    await expect(canvas.getByText("Option 1")).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}");
    await expect(canvas.getByText("Option 2")).toHaveFocus();

    // Select with Enter
    await userEvent.keyboard("{Enter}");

    // Menu should close
    await expect(canvas.queryByRole("menu")).not.toBeInTheDocument();
  },
};

export const EscapeToClose: Story = {
  render: () => (
    <Dropdown trigger="Select option">
      <DropdownItem>Option 1</DropdownItem>
    </Dropdown>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button");

    // Open
    await userEvent.click(trigger);
    await expect(canvas.getByRole("menu")).toBeInTheDocument();

    // Close with Escape
    await userEvent.keyboard("{Escape}");
    await expect(canvas.queryByRole("menu")).not.toBeInTheDocument();

    // Focus should return to trigger
    await expect(trigger).toHaveFocus();
  },
};
```

**Why good:** Tests keyboard accessibility, verifies focus management, ensures ARIA patterns work

---

## Visual Testing Configuration

### Chromatic Integration

```typescript
// button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    // Chromatic capture configuration
    chromatic: {
      viewports: [320, 768, 1200],  // Capture at multiple widths
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
  ),
};

// Skip this story in Chromatic (animations cause flaky tests)
export const WithAnimation: Story = {
  parameters: {
    chromatic: { disableSnapshot: true },
  },
  args: {
    children: "Animated Button",
    isAnimating: true,
  },
};

// Delay snapshot for async content
export const WithAsyncContent: Story = {
  parameters: {
    chromatic: {
      delay: 500,  // Wait 500ms before snapshot
    },
  },
  args: {
    children: "Async Button",
    loadContent: true,
  },
};
```

**Why good:** Multiple viewports catch responsive issues, disableSnapshot skips problematic stories, delay handles async content

---

### Accessibility Testing

```typescript
// card.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./card";

const meta = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    // a11y addon configuration
    a11y: {
      config: {
        rules: [
          // Customize rules
          { id: "color-contrast", enabled: true },
          { id: "landmark-one-main", enabled: false },  // Disable for component stories
        ],
      },
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Card Title",
    description: "Card description",
  },
};

// Story with known a11y issues (for demonstration)
export const LowContrast: Story = {
  parameters: {
    a11y: {
      // Disable for this story only
      disable: true,
    },
  },
  args: {
    title: "Low Contrast",
    className: "text-gray-300 bg-gray-200",  // Bad contrast
  },
};
```

**Why good:** a11y addon runs axe-core automatically, rules can be customized per-story

---

## Vitest Addon Integration (Recommended for Storybook 8.4+)

The Vitest addon is the recommended approach for running story tests in Vite-based projects. It supersedes the test runner with better performance and Storybook UI integration.

### Installation

```bash
# Automatic setup (recommended)
npx storybook add @storybook/addon-vitest
```

### Configuration

```typescript
// vitest.config.ts
import { defineConfig, mergeConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          plugins: [storybookTest({ configDir: ".storybook" })],
          browser: {
            enabled: true,
            provider: "playwright",
            name: "chromium",
          },
        },
      ],
    },
  })
);
```

### Tag-Based Test Control

```typescript
// button.stories.tsx
const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["stable"],  // Custom tag
} satisfies Meta<typeof Button>;

// Skip this story from tests
export const Experimental: Story = {
  tags: ["!test", "experimental"],  // Remove test tag, add experimental
  args: { children: "Experimental" },
};

// Docs-only story (hidden from sidebar)
export const DocsOnly: Story = {
  tags: ["autodocs", "!dev"],  // Show in docs, hide from sidebar
  args: { children: "Docs Only" },
};
```

### Package.json Scripts

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "test-storybook": "vitest --project=storybook",
    "test-storybook:watch": "vitest --project=storybook --watch"
  }
}
```

**Why good:** Uses Vitest browser mode for real browser testing, integrates with Storybook UI, supports IDE extensions, faster than test runner

---

## Legacy Test Runner (For Non-Vite Projects)

> **Note:** For Vite-based projects, use the Vitest addon instead. The test runner is still available for Webpack-based Storybook projects.

### Running Tests in CI

```typescript
// .storybook/test-runner.ts
import type { TestRunnerConfig } from "@storybook/test-runner";

const config: TestRunnerConfig = {
  // Run setup before all tests
  async preVisit(page) {
    // Set viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  },

  // Run after each test
  async postVisit(page, context) {
    // Take accessibility snapshot
    const element = await page.locator("#storybook-root");
    await element.evaluate((el) => {
      // Custom assertions can go here
    });
  },
};

export default config;
```

### Package.json Scripts (Test Runner)

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "test-storybook": "test-storybook",
    "test-storybook:ci": "test-storybook --ci --maxWorkers=2"
  }
}
```

**Why good:** Works with any Storybook framework, executes play functions in CI, catches interaction regressions

---

## Assertions Reference

### Common Assertions

```typescript
import { expect, within } from "@storybook/test";

export const AssertionExamples: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Element presence
    await expect(canvas.getByRole("button")).toBeInTheDocument();
    await expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();

    // Element visibility
    await expect(canvas.getByRole("tooltip")).toBeVisible();
    await expect(canvas.getByTestId("hidden")).not.toBeVisible();

    // Element state
    await expect(canvas.getByRole("button")).toBeEnabled();
    await expect(canvas.getByRole("textbox")).toBeDisabled();
    await expect(canvas.getByRole("checkbox")).toBeChecked();

    // Element content
    await expect(canvas.getByRole("heading")).toHaveTextContent("Title");
    await expect(canvas.getByRole("textbox")).toHaveValue("input value");
    await expect(canvas.getByRole("button")).toHaveAttribute("type", "submit");

    // Element styling (use sparingly)
    await expect(canvas.getByRole("alert")).toHaveClass("error");

    // Focus
    await expect(canvas.getByRole("textbox")).toHaveFocus();
  },
};
```

**Why good:** Testing Library matchers work seamlessly, assertions match user expectations

---

### Mock Function Assertions

```typescript
import { expect, fn } from "@storybook/test";

const meta = {
  // ...
  args: {
    onClick: fn(),
    onSubmit: fn(),
  },
};

export const MockAssertions: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button"));

    // Call count
    await expect(args.onClick).toHaveBeenCalled();
    await expect(args.onClick).toHaveBeenCalledTimes(1);

    // Call arguments
    await expect(args.onSubmit).toHaveBeenCalledWith({ name: "test" });
    await expect(args.onSubmit).toHaveBeenLastCalledWith({ name: "test" });

    // Not called
    await expect(args.onCancel).not.toHaveBeenCalled();
  },
};
```

**Why good:** `fn()` creates spy functions, assertions verify handler behavior

---

_For more patterns, see:_
- [core.md](core.md) - CSF 3.0 format, args, controls
- [docs.md](docs.md) - Autodocs and MDX documentation
- [addons.md](addons.md) - Addon configuration
