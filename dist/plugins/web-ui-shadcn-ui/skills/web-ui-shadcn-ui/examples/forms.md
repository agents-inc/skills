# shadcn/ui - Form Examples

> `Field` and its siblings: layout, labelling and error presentation, with no form state of their
> own. See [core.md](core.md) for project setup.

**Sub-components:** `Field`, `FieldContent`, `FieldLabel`, `FieldDescription`, `FieldError`,
`FieldTitle`, `FieldGroup`, `FieldSet`, `FieldLegend`, `FieldSeparator`

**`orientation`:** `"vertical"` (default), `"horizontal"`, `"responsive"` — the last switches on
container queries, so it follows the field's own width rather than the viewport's.

---

## Field Basics

```tsx
import {
  Field,
  FieldContent,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// No form library involved — this works with a plain form or a server action
<Field>
  <FieldLabel htmlFor="name">Name</FieldLabel>
  <Input id="name" />
  <FieldDescription>Your public display name.</FieldDescription>
</Field>

// The error state, in full
<Field data-invalid={!!error}>
  <FieldLabel htmlFor="email">Email</FieldLabel>
  <Input id="email" aria-invalid={!!error} />
  {error && <FieldError errors={[error]} />}
</Field>

// Label and control side by side, description under the label
<Field orientation="horizontal">
  <FieldContent>
    <FieldLabel htmlFor="theme">Theme</FieldLabel>
    <FieldDescription>Select your preferred theme.</FieldDescription>
  </FieldContent>
  <Select id="theme" />
</Field>
```

**Why good:** three separate things carry the error, and each does a different job. `data-invalid` on
`Field` is the styling hook the whole row reads. `aria-invalid` on the control is what a screen
reader announces. `FieldError` is the visible message, and rendering it conditionally is what keeps
an empty error region out of the layout. Setting only one of the three gives a field that looks
wrong, or announces wrong, or both.

`FieldError` accepts the error objects a Standard Schema validator produces directly, so a validation
result usually needs no reshaping on the way in.

---

## Field with a Form Library

`Field` holds no value, so binding it is the same three points wherever the state comes from. Write
one adapter against your library's field API and the rest of the form is declarative.

```tsx
type FieldBinding = {
  name: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  error?: { message: string };
};

function TextField({
  binding,
  label,
  description,
}: {
  binding: FieldBinding;
  label: string;
  description?: string;
}) {
  return (
    <Field data-invalid={binding.invalid}>
      <FieldLabel htmlFor={binding.name}>{label}</FieldLabel>
      <Input
        id={binding.name}
        name={binding.name}
        value={binding.value}
        onChange={(event) => binding.onChange(event.target.value)}
        aria-invalid={binding.invalid}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {binding.invalid && binding.error && (
        <FieldError errors={[binding.error]} />
      )}
    </Field>
  );
}
```

**Why good:** the shape a form library hands a field — a value, a change handler, a validity flag and
an error — is the same shape everywhere, so this adapter survives changing libraries. `id` and `name`
both come from one source, which is what keeps `htmlFor` pointing at something real.

---

## Field with Select

`Select` reports through `onValueChange` and takes a `value`; it is not an input, so a field binding
cannot simply be spread onto it.

```tsx
<Field data-invalid={binding.invalid}>
  <FieldLabel htmlFor={binding.name}>Role</FieldLabel>
  <Select value={binding.value} onValueChange={binding.onChange}>
    <SelectTrigger id={binding.name} aria-invalid={binding.invalid}>
      <SelectValue placeholder="Select a role" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="admin">Admin</SelectItem>
      <SelectItem value="user">User</SelectItem>
      <SelectItem value="guest">Guest</SelectItem>
    </SelectContent>
  </Select>
  {binding.invalid && <FieldError errors={[binding.error]} />}
</Field>
```

**Why good:** `id` and `aria-invalid` go on `SelectTrigger` rather than on `Select`, because the
trigger is the focusable element the label must point at and the one a screen reader reads.

---

## FieldGroup, FieldSet and FieldLegend

```tsx
import { FieldSet, FieldLegend, FieldGroup } from "@/components/ui/field";

// FieldSet renders a real <fieldset>; the legend names the group to a screen reader
<FieldSet>
  <FieldLegend>Contact Information</FieldLegend>
  <FieldGroup>
    <Field>
      <FieldLabel htmlFor="email">Email</FieldLabel>
      <Input id="email" type="email" />
    </Field>
    <Field>
      <FieldLabel htmlFor="phone">Phone</FieldLabel>
      <Input id="phone" type="tel" />
    </Field>
  </FieldGroup>
</FieldSet>

// FieldGroup alone is layout, with no grouping semantics
<FieldGroup orientation="horizontal">
  <Field>
    <FieldLabel htmlFor="first">First Name</FieldLabel>
    <Input id="first" />
  </Field>
  <Field>
    <FieldLabel htmlFor="last">Last Name</FieldLabel>
    <Input id="last" />
  </Field>
</FieldGroup>
```

**Why good:** the two are not interchangeable. `FieldSet` plus `FieldLegend` is what makes a screen
reader announce "Contact Information" before each field in the group — needed wherever the fields
only make sense together, such as a radio group or an address. `FieldGroup` on its own arranges
fields and says nothing about them, which is right for two halves of a name.

---

## The Legacy Form Pattern

`Form`/`FormField`/`FormItem`/`FormControl`/`FormMessage` still ship and still work. They read the
field state from a form library's context rather than from props, which is why `FormMessage` needs no
arguments — and also why the set only works with that one library.

```tsx
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormDescription>Your email address.</FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Why legacy:** the coupling is the whole difference. `Field` takes the same three signals as props,
so the layout outlives any decision about form state. Existing `FormField` code does not need
rewriting; new fields go through `Field`.
