# TanStack Form - Composition Examples

> App-wide form composition, custom hooks, and side effects. See [SKILL.md](../SKILL.md) for concepts and [reference.md](../reference.md) for API tables.

**Related Examples:**

- [core.md](core.md) - Basic form, TypeScript, submission
- [validation.md](validation.md) - Sync/async validation, cross-field
- [arrays.md](arrays.md) - Dynamic array fields

---

## Pattern 1: createFormHook for App-Wide Consistency

Use `createFormHook` to register reusable field and form components once, then use them across all forms via `useAppForm`.

### Step 1: Create the form hook factory

```tsx
import { createFormHookContexts, createFormHook } from "@tanstack/react-form";

// Export useFieldContext for use in custom field components
export const { fieldContext, formContext, useFieldContext } =
  createFormHookContexts();

// Custom field component — uses useFieldContext to access field state
function TextFieldComponent({ label }: { label: string }) {
  const field = useFieldContext<string>();
  return (
    <div>
      <label htmlFor={field.name}>{label}</label>
      <input
        id={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={field.state.meta.errors.length > 0}
      />
      {field.state.meta.errors.map((err) => (
        <em key={err} role="alert">
          {err}
        </em>
      ))}
    </div>
  );
}

function SubmitButtonComponent({ label = "Submit" }: { label?: string }) {
  // formContext provides access to the form instance
  return <button type="submit">{label}</button>;
}

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField: TextFieldComponent,
  },
  formComponents: {
    SubmitButton: SubmitButtonComponent,
  },
});
```

### Step 2: Use useAppForm in forms

```tsx
import { useAppForm } from "./form-hook";

export function ProfileForm() {
  const form = useAppForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
    },
    onSubmit: async ({ value }) => {
      await saveProfile(value);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.AppField
        name="firstName"
        validators={{
          onChange: ({ value }) => (!value ? "First name required" : undefined),
        }}
        children={(field) => <field.TextField label="First Name" />}
      />
      <form.AppField
        name="lastName"
        children={(field) => <field.TextField label="Last Name" />}
      />
      <form.AppField
        name="email"
        children={(field) => <field.TextField label="Email" />}
      />
      <form.AppForm>
        {(AppForm) => <AppForm.SubmitButton label="Save Profile" />}
      </form.AppForm>
    </form>
  );
}
```

**Key points:**

- `useFieldContext<T>()` gives field components access to the field API without props
- `form.AppField` replaces `form.Field` when using registered custom components
- `form.AppForm` gives access to registered form-level components
- Validators still go on `form.AppField` — the custom component handles display

---

## Pattern 2: withForm for Subform Components

Use `withForm` to create typed subform components that receive the form instance.

```tsx
import { useAppForm, withForm } from "./form-hook";

const AddressSection = withForm({
  render: ({ form, prefix }: { form: any; prefix: string }) => (
    <fieldset>
      <legend>Address</legend>
      <form.AppField
        name={`${prefix}.street`}
        children={(field) => <field.TextField label="Street" />}
      />
      <form.AppField
        name={`${prefix}.city`}
        children={(field) => <field.TextField label="City" />}
      />
      <form.AppField
        name={`${prefix}.zip`}
        children={(field) => <field.TextField label="ZIP" />}
      />
    </fieldset>
  ),
});

export function CheckoutForm() {
  const form = useAppForm({
    defaultValues: {
      shippingAddress: { street: "", city: "", zip: "" },
      billingAddress: { street: "", city: "", zip: "" },
    },
    onSubmit: async ({ value }) => {
      await placeOrder(value);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <AddressSection form={form} prefix="shippingAddress" />
      <AddressSection form={form} prefix="billingAddress" />
    </form>
  );
}
```

**When to use:** Reusable form sections that appear in multiple forms (address blocks, contact info, payment details).

---

## Pattern 3: Listeners for Side Effects

Use the `listeners` prop on `form.Field` to perform side effects when a field changes. Listeners do not return validation errors.

```tsx
export function LocationForm() {
  const form = useForm({
    defaultValues: {
      country: "",
      province: "",
      city: "",
    },
    onSubmit: async ({ value }) => {
      await saveLocation(value);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field
        name="country"
        listeners={{
          onChange: ({ value }) => {
            // Reset dependent fields when country changes
            form.setFieldValue("province", "");
            form.setFieldValue("city", "");
          },
        }}
        children={(field) => (
          <div>
            <label htmlFor={field.name}>Country</label>
            <select
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            >
              <option value="">Select country</option>
              <option value="us">United States</option>
              <option value="ca">Canada</option>
            </select>
          </div>
        )}
      />

      <form.Field
        name="province"
        listeners={{
          onChange: ({ value }) => {
            // Reset city when province changes
            form.setFieldValue("city", "");
          },
        }}
        children={(field) => (
          <div>
            <label htmlFor={field.name}>Province/State</label>
            <select
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            >
              <option value="">Select province</option>
              {/* Options would be filtered by country */}
            </select>
          </div>
        )}
      />

      <form.Field
        name="city"
        children={(field) => (
          <div>
            <label htmlFor={field.name}>City</label>
            <input
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      />
    </form>
  );
}
```

**Available listener events:** `onChange`, `onBlur`, `onMount`, `onSubmit`.

**Listeners vs validators:** Listeners are for side effects (resetting fields, loading data). Validators are for returning error strings. Do not mix them.

---

## Pattern 4: form.Subscribe for Conditional UI

Use `form.Subscribe` to show/hide sections, display totals, or toggle UI based on form state without re-rendering the entire form.

```tsx
<form.Subscribe
  selector={(state) => state.values.accountType}
  children={(accountType) =>
    accountType === "business" ? (
      <>
        <form.Field
          name="companyName"
          children={(field) => (
            <div>
              <label htmlFor={field.name}>Company Name</label>
              <input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        />
        <form.Field
          name="taxId"
          children={(field) => (
            <div>
              <label htmlFor={field.name}>Tax ID</label>
              <input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        />
      </>
    ) : null
  }
/>
```

**`selector` function:** Returns the specific slice of form state you care about. The `children` render prop only re-renders when the selected value changes.
