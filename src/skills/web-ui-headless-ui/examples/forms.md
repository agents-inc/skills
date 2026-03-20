# Headless UI - Form Components Examples

> Complete code examples for Headless UI's form primitives (Field, Input, Label, Description, Fieldset, Legend, Select, Textarea). See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Switch & RadioGroup](switch-radio.md) - Toggle and option selection patterns
- [Listbox & Combobox](listbox-combobox.md) - Custom select/autocomplete
- [Dialog & Modal](dialog.md) - Forms inside dialogs

---

## Shipping Form with Fieldset

A complete form using Headless UI's form primitives with auto-generated ARIA associations and cascading disabled state.

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

**Why good:** Field auto-generates unique IDs and wires `aria-labelledby`/`aria-describedby`, Fieldset groups related fields, disabled Field cascades to all children via `data-[disabled]`, Label/Description automatically associated without manual `htmlFor`/`id` wiring, Legend provides accessible fieldset title

---

## Profile Form with Switch, Checkbox, and Multiple Fieldsets

A complete profile form combining form primitives with Switch and Checkbox controls.

```tsx
import { useState } from "react";
import {
  Field,
  Fieldset,
  Input,
  Label,
  Legend,
  Description,
  Select,
  Textarea,
  Switch,
  Checkbox,
} from "@headlessui/react";

export function ProfileForm() {
  const [marketingEnabled, setMarketingEnabled] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        // Handle form data submission
      }}
      className="max-w-lg space-y-8"
    >
      <Fieldset className="space-y-4">
        <Legend className="text-lg font-semibold text-gray-900">
          Personal Information
        </Legend>

        <Field>
          <Label className="text-sm font-medium text-gray-700">Full name</Label>
          <Input
            name="fullName"
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm data-[focus]:border-blue-500 data-[focus]:ring-1 data-[focus]:ring-blue-500"
          />
        </Field>

        <Field>
          <Label className="text-sm font-medium text-gray-700">Email</Label>
          <Description className="text-xs text-gray-500">
            We will never share your email with anyone.
          </Description>
          <Input
            name="email"
            type="email"
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm data-[focus]:border-blue-500 data-[focus]:ring-1 data-[focus]:ring-blue-500"
          />
        </Field>

        <Field>
          <Label className="text-sm font-medium text-gray-700">Role</Label>
          <Select
            name="role"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm data-[focus]:border-blue-500 data-[focus]:ring-1 data-[focus]:ring-blue-500"
          >
            <option value="developer">Developer</option>
            <option value="designer">Designer</option>
            <option value="manager">Manager</option>
          </Select>
        </Field>

        <Field>
          <Label className="text-sm font-medium text-gray-700">Bio</Label>
          <Textarea
            name="bio"
            rows={3}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm data-[focus]:border-blue-500 data-[focus]:ring-1 data-[focus]:ring-blue-500"
          />
        </Field>
      </Fieldset>

      <Fieldset className="space-y-4">
        <Legend className="text-lg font-semibold text-gray-900">
          Preferences
        </Legend>

        <Field className="flex items-center justify-between">
          <span>
            <Label className="text-sm font-medium text-gray-700" passive>
              Marketing emails
            </Label>
            <Description className="text-xs text-gray-500">
              Receive emails about new features and updates.
            </Description>
          </span>
          <Switch
            checked={marketingEnabled}
            onChange={setMarketingEnabled}
            name="marketing"
            className="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 data-[checked]:bg-blue-600 data-[focus]:ring-2 data-[focus]:ring-blue-500 data-[focus]:ring-offset-2"
          >
            <span className="pointer-events-none inline-block size-5 translate-x-0 rounded-full bg-white shadow ring-0 transition duration-200 group-data-[checked]:translate-x-5" />
          </Switch>
        </Field>

        <Field className="flex items-center gap-3">
          <Checkbox
            checked={termsAccepted}
            onChange={setTermsAccepted}
            name="terms"
            className="group size-5 cursor-pointer rounded border border-gray-300 bg-white data-[checked]:border-blue-500 data-[checked]:bg-blue-500 data-[focus]:ring-2 data-[focus]:ring-blue-500 data-[focus]:ring-offset-2"
          >
            <svg
              className="size-4 text-white opacity-0 group-data-[checked]:opacity-100"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
            </svg>
          </Checkbox>
          <Label className="text-sm text-gray-700">
            I agree to the terms and conditions
          </Label>
        </Field>
      </Fieldset>

      <button
        type="submit"
        disabled={!termsAccepted}
        className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        Save Profile
      </button>
    </form>
  );
}
```

**Why good:** Field auto-generates IDs and wires aria-labelledby/aria-describedby (no manual `htmlFor`/`id`), Fieldset groups related fields with Legend, Description provides helper text, Switch and Checkbox use `name` for form submission, `passive` on Label prevents toggle on click when label is separate from control, `data-[checked]`/`group-data-[checked]` style toggle states
