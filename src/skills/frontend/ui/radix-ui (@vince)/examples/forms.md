# Radix UI - Form Examples

> Select and other form-related Radix primitives.

---

## Pattern 1: Custom Select Component

### Good Example - Custom Styled Select

```typescript
import { Select } from "radix-ui";

const OFFSET_PX = 5;

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type CustomSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
};

export function CustomSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select an option",
}: CustomSelectProps) {
  return (
    <Select.Root value={value} onValueChange={onValueChange}>
      <Select.Trigger className="select-trigger">
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="select-icon">
          <span aria-hidden="true">&#9660;</span>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="select-content" position="popper" sideOffset={OFFSET_PX}>
          <Select.ScrollUpButton className="select-scroll-button">
            <span aria-hidden="true">&#9650;</span>
          </Select.ScrollUpButton>
          <Select.Viewport className="select-viewport">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="select-item"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="select-indicator">
                  <span aria-hidden="true">&#10003;</span>
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="select-scroll-button">
            <span aria-hidden="true">&#9660;</span>
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

// Usage
const OPTIONS = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry", disabled: true },
];

<CustomSelect
  value={selectedFruit}
  onValueChange={setSelectedFruit}
  options={OPTIONS}
  placeholder="Choose a fruit"
/>
```

**Why good:** ScrollUpButton and ScrollDownButton handle long lists, ItemIndicator shows selected state, position="popper" enables flexible positioning, disabled state supported per item

---

## Pattern 2: Select with CSP Nonce (v1.4.3+)

For sites with Content Security Policy, use the `nonce` prop for inline styles.

```typescript
import { Select } from "radix-ui";

// Nonce provided by your server framework (Next.js, etc.)
type SelectWithCSPProps = {
  nonce?: string;
  options: Array<{ value: string; label: string }>;
};

export function SelectWithCSP({ nonce, options }: SelectWithCSPProps) {
  return (
    <Select.Root>
      <Select.Trigger className="select-trigger">
        <Select.Value placeholder="Select option" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Content nonce={nonce} className="select-content">
          <Select.Viewport>
            {options.map((option) => (
              <Select.Item key={option.value} value={option.value}>
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
```

**When to use:** Sites with strict Content Security Policy that blocks inline styles without nonce

---

## Pattern 3: Progress with Indeterminate State

Progress supports `value={undefined}` for indeterminate/loading states.

```typescript
import { Progress } from "radix-ui";

const MAX_PROGRESS = 100;

type ProgressBarProps = {
  value?: number;
  label: string;
};

export function ProgressBar({ value, label }: ProgressBarProps) {
  const isIndeterminate = value === undefined;

  return (
    <Progress.Root
      className="progress-root"
      value={value}
      max={MAX_PROGRESS}
      aria-label={label}
    >
      <Progress.Indicator
        className="progress-indicator"
        data-state={isIndeterminate ? "indeterminate" : "determinate"}
        style={{
          transform: isIndeterminate
            ? undefined
            : `translateX(-${MAX_PROGRESS - (value ?? 0)}%)`,
        }}
      />
    </Progress.Root>
  );
}
```

```css
.progress-root {
  width: 100%;
  height: 8px;
  background: var(--muted-color);
  border-radius: 4px;
  overflow: hidden;
}

.progress-indicator {
  width: 100%;
  height: 100%;
  background: var(--primary-color);
  transition: transform 200ms ease;
}

/* Indeterminate animation */
.progress-indicator[data-state="indeterminate"] {
  width: 50%;
  animation: indeterminate 1.5s ease-in-out infinite;
}

@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
```

**Why good:** Named constant for max value, `value={undefined}` signals indeterminate state, data-state attribute enables CSS animation for loading state, aria-label for accessibility
