# Headless UI - Switch, RadioGroup & Checkbox Examples

> Complete code examples for Switch (toggle), RadioGroup (option selection), and Checkbox patterns. See [SKILL.md](../SKILL.md) for core concepts and [reference.md](../reference.md) for API reference.

**Related examples:**

- [Form Components](forms.md) - Field, Input, Label, Fieldset patterns
- [Listbox & Combobox](listbox-combobox.md) - Select/autocomplete patterns
- [Tabs](tabs.md) - Tabbed content navigation

---

## Switch Toggle with Field

An accessible toggle with label, description, and form integration.

```tsx
import { useState } from "react";
import { Field, Label, Description, Switch } from "@headlessui/react";

export function NotificationToggle() {
  const [enabled, setEnabled] = useState(false);

  return (
    <Field className="flex items-center justify-between">
      <span className="flex flex-grow flex-col">
        <Label className="text-sm font-medium" passive>
          Email notifications
        </Label>
        <Description className="text-sm text-gray-500">
          Receive notifications about account activity
        </Description>
      </span>
      <Switch
        checked={enabled}
        onChange={setEnabled}
        name="notifications"
        className="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 ease-in-out data-[checked]:bg-blue-600"
      >
        <span className="pointer-events-none inline-block size-5 translate-x-0 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out group-data-[checked]:translate-x-5" />
      </Switch>
    </Field>
  );
}
```

**Why good:** Field groups Label, Description, and Switch with automatic ARIA association, `passive` on Label prevents toggle on label click (appropriate when label is far from switch), `name` enables form submission, `data-[checked]` styles on state, `group-data-[checked]` styles child elements

---

## RadioGroup with Card Layout

Custom radio buttons displayed as selectable cards with full keyboard navigation.

```tsx
import { useState } from "react";
import {
  Radio,
  RadioGroup,
  Label,
  Description,
  Field,
} from "@headlessui/react";
import { CheckCircleIcon } from "@heroicons/react/20/solid";

type Plan = {
  name: string;
  ram: string;
  cpus: string;
  disk: string;
  price: string;
};

const PLANS: Plan[] = [
  {
    name: "Hobby",
    ram: "8GB",
    cpus: "4 CPUs",
    disk: "160 GB SSD",
    price: "$40/mo",
  },
  {
    name: "Startup",
    ram: "12GB",
    cpus: "6 CPUs",
    disk: "256 GB SSD",
    price: "$80/mo",
  },
  {
    name: "Business",
    ram: "16GB",
    cpus: "8 CPUs",
    disk: "512 GB SSD",
    price: "$160/mo",
  },
];

export function PlanSelector() {
  const [selected, setSelected] = useState(PLANS[0]);

  return (
    <RadioGroup value={selected} onChange={setSelected} className="space-y-2">
      {PLANS.map((plan) => (
        <Radio
          key={plan.name}
          value={plan}
          className="group relative flex cursor-pointer rounded-lg border px-5 py-4 shadow-md data-[checked]:border-blue-500 data-[checked]:bg-blue-50 data-[focus]:ring-2 data-[focus]:ring-blue-500"
        >
          <div className="flex w-full items-center justify-between">
            <div>
              <Label as="p" className="font-semibold">
                {plan.name}
              </Label>
              <Description as="span" className="text-sm text-gray-500">
                {plan.ram} / {plan.cpus} / {plan.disk}
              </Description>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{plan.price}</span>
              <CheckCircleIcon className="size-5 text-blue-600 opacity-0 group-data-[checked]:opacity-100" />
            </div>
          </div>
        </Radio>
      ))}
    </RadioGroup>
  );
}
```

**Why good:** `data-[checked]` styles selected card, `data-[focus]` shows keyboard focus ring, `group-data-[checked]` shows checkmark on parent checked state, Label and Description inside Radio provide accessibility, arrow keys navigate between options

---

## Checkbox with Field

An accessible checkbox with label, description, and indeterminate state support.

```tsx
import { useState } from "react";
import { Checkbox, Field, Label, Description } from "@headlessui/react";
import { CheckIcon } from "@heroicons/react/20/solid";

export function TermsCheckbox() {
  const [agreed, setAgreed] = useState(false);

  return (
    <Field className="flex items-center gap-3">
      <Checkbox
        checked={agreed}
        onChange={setAgreed}
        name="terms"
        className="group size-5 cursor-pointer rounded border bg-white data-[checked]:border-blue-500 data-[checked]:bg-blue-500 data-[focus]:ring-2 data-[focus]:ring-blue-500 data-[focus]:ring-offset-2"
      >
        <CheckIcon className="size-4 text-white opacity-0 group-data-[checked]:opacity-100" />
      </Checkbox>
      <div>
        <Label className="text-sm font-medium">Accept terms</Label>
        <Description className="text-sm text-gray-500">
          By checking this box you agree to our terms of service.
        </Description>
      </div>
    </Field>
  );
}
```

**Why good:** Field auto-associates Label and Description via ARIA, `data-[checked]` styles checked state, `group-data-[checked]` reveals checkmark icon, `name` enables form submission
