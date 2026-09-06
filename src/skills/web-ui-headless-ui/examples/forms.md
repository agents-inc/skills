# Headless UI - Form Components Examples

> Complete code examples for Headless UI's form primitives (Field, Input, Label, Description, Fieldset, Legend, Select, Textarea). See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for API reference.

**Related examples:** [switch-radio.md](switch-radio.md), [listbox-combobox.md](listbox-combobox.md), [dialog.md](dialog.md)

---

## Shipping Form with Fieldset

Auto-generated ARIA associations and a disabled state that cascades from the `Field` to its children.

```tsx
import {
  Field,
  Fieldset,
  Input,
  Label,
  Legend,
  Description,
  Select,
  Textarea,
} from "@headlessui/react";

export function ShippingForm() {
  return (
    <Fieldset className="space-y-6">
      <Legend className="text-lg font-semibold">Shipping Details</Legend>

      <Field>
        <Label className="text-sm font-medium">Full name</Label>
        <Input
          name="name"
          className="mt-1 block w-full rounded-lg border px-3 py-2 data-[focus]:outline-2 data-[focus]:outline-blue-500"
        />
      </Field>

      <Field>
        <Label className="text-sm font-medium">Country</Label>
        <Description className="text-sm text-gray-500">
          We currently ship to these countries.
        </Description>
        <Select
          name="country"
          className="mt-1 block w-full rounded-lg border px-3 py-2 data-[focus]:outline-2 data-[focus]:outline-blue-500"
        >
          <option>United States</option>
          <option>Canada</option>
          <option>Mexico</option>
        </Select>
      </Field>

      <Field>
        <Label className="text-sm font-medium">Notes</Label>
        <Textarea
          name="notes"
          className="mt-1 block w-full rounded-lg border px-3 py-2 data-[focus]:outline-2 data-[focus]:outline-blue-500"
          rows={3}
        />
      </Field>

      <Field disabled>
        <Label className="text-sm font-medium data-[disabled]:opacity-50">
          Promo code
        </Label>
        <Input
          name="promo"
          className="mt-1 block w-full rounded-lg border px-3 py-2 data-[disabled]:bg-gray-100 data-[disabled]:opacity-50"
        />
        <Description className="text-sm text-gray-500 data-[disabled]:opacity-50">
          Promo codes are not available during this sale.
        </Description>
      </Field>
    </Fieldset>
  );
}
```

**Why good:** `Field` generates the ids and the `aria-labelledby` / `aria-describedby` links, so no
`htmlFor` appears anywhere. `Fieldset` + `Legend` name the group, and `disabled` on a `Field` reaches
every child as `data-disabled`.

**In a larger form:** `Switch`, `Checkbox`, `Listbox` and `Combobox` sit inside a `Field` the same
way, and each one's `name` prop renders the hidden input that puts it in the submitted `FormData` —
see [switch-radio.md](switch-radio.md) and [listbox-combobox.md](listbox-combobox.md).
