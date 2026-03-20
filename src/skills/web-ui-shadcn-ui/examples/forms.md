# shadcn/ui - Form Examples

> Field component patterns for form-library-agnostic field layout. See [core.md](core.md) for setup basics.

---

## Field Component Basics

The `Field` component provides accessible form field layout (labels, descriptions, errors) without coupling to any specific form library.

**Sub-components:** `Field`, `FieldContent`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldTitle`, `FieldGroup`, `FieldSet`, `FieldLegend`, `FieldSeparator`

**Orientation prop:** `"vertical"` (default), `"horizontal"`, `"responsive"` (auto-switches via container queries)

```tsx
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// Basic field - works with any form library or server actions
<Field>
  <FieldLabel htmlFor="name">Name</FieldLabel>
  <Input id="name" />
  <FieldDescription>Your public display name.</FieldDescription>
</Field>

// Field with error state
<Field data-invalid={!!error}>
  <FieldLabel htmlFor="email">Email</FieldLabel>
  <Input id="email" aria-invalid={!!error} />
  {error && <FieldError errors={[error]} />}
</Field>

// Horizontal field (label and control side-by-side)
<Field orientation="horizontal">
  <FieldContent>
    <FieldLabel htmlFor="theme">Theme</FieldLabel>
    <FieldDescription>Select your preferred theme.</FieldDescription>
  </FieldContent>
  <Select id="theme" />
</Field>
```

**Why good:** Form-library-agnostic, consistent accessibility attributes, replaces the old tightly-coupled Form/FormField/FormItem pattern, `FieldError` supports Standard Schema validators (Zod, Valibot, ArkType) directly

---

## Field with Form Library Integration

The Field component works with any form library via its Controller or equivalent. The key pattern: pass `data-invalid` to Field, `aria-invalid` to the control, and render `FieldError` conditionally.

```tsx
// Generic pattern - adapt to your form library's controller
<Controller
  name="email"
  control={form.control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={field.name}>Email</FieldLabel>
      <Input {...field} id={field.name} aria-invalid={fieldState.invalid} />
      <FieldDescription>We will never share your email.</FieldDescription>
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

---

## Field with Select

```tsx
<Controller
  name="role"
  control={form.control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={field.name}>Role</FieldLabel>
      <Select value={field.value} onValueChange={field.onChange}>
        <SelectTrigger id={field.name} aria-invalid={fieldState.invalid}>
          <SelectValue placeholder="Select a role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="user">User</SelectItem>
          <SelectItem value="guest">Guest</SelectItem>
        </SelectContent>
      </Select>
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )}
/>
```

**Why good:** Select binds via `value` + `onValueChange` (not spread), Field handles error display

---

## FieldGroup and FieldSet

Group related fields for visual and semantic coherence.

```tsx
import { FieldSet, FieldLegend, FieldGroup } from "@/components/ui/field";

// FieldSet for semantic grouping (renders <fieldset>)
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

// FieldGroup for visual grouping without semantics
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

**Why good:** Semantic HTML via fieldset/legend for accessibility, responsive orientation support, no coupling to form state

---

## Legacy Form Pattern (Pre-October 2025)

> **Note:** The `Form/FormField/FormItem/FormControl/FormMessage` components are still available but are tightly coupled to React Hook Form. Prefer the Field component for new code.

```tsx
// Legacy pattern - still works but coupled to specific form library
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

**Why legacy:** Tightly coupled to one form library, harder to switch form solutions, Field component provides same layout with any form library
