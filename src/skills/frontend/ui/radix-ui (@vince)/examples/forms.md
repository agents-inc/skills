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
