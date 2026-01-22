# React Hook Form - Performance Optimization

> Performance patterns for large forms. See [core.md](core.md) for basic form patterns.

**Prerequisites:** Understand Basic Forms and Controller patterns from [core.md](core.md) and [controlled-components.md](controlled-components.md) first.

---

## Pattern 5: Performance Optimization

### Good Example - Optimized form with isolated subscriptions

```typescript
import { useForm, useFormState, useWatch } from "react-hook-form";
import type { Control, FieldPath, FieldValues, SubmitHandler } from "react-hook-form";

interface LargeFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  notes: string;
}

// Isolated error component - only re-renders when its field's error changes
function FieldError<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: FieldPath<T>;
}) {
  const { errors } = useFormState({ control, name });
  const error = errors[name];

  if (!error) return null;
  return <span role="alert">{error.message as string}</span>;
}

// Isolated character counter - only re-renders when notes changes
function NotesCounter({ control }: { control: Control<LargeFormData> }) {
  const notes = useWatch({ control, name: "notes" });
  const MAX_NOTES_LENGTH = 500;

  return (
    <span>
      {notes?.length || 0} / {MAX_NOTES_LENGTH}
    </span>
  );
}

export function LargeForm() {
  const {
    control,
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LargeFormData>({
    mode: "onBlur", // Not onChange - reduces validation runs
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      country: "",
      notes: "",
    },
  });

  const onSubmit: SubmitHandler<LargeFormData> = async (data) => {
    await saveForm(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Each field with isolated error display */}
      <div>
        <input {...register("firstName", { required: "Required" })} />
        <FieldError control={control} name="firstName" />
      </div>

      <div>
        <input {...register("lastName", { required: "Required" })} />
        <FieldError control={control} name="lastName" />
      </div>

      <div>
        <input {...register("email", { required: "Required" })} type="email" />
        <FieldError control={control} name="email" />
      </div>

      <div>
        <input {...register("phone")} type="tel" />
        <FieldError control={control} name="phone" />
      </div>

      <div>
        <input {...register("address")} />
        <FieldError control={control} name="address" />
      </div>

      <div>
        <input {...register("city")} />
        <FieldError control={control} name="city" />
      </div>

      <div>
        <input {...register("country")} />
        <FieldError control={control} name="country" />
      </div>

      <div>
        <textarea {...register("notes")} />
        <NotesCounter control={control} />
        <FieldError control={control} name="notes" />
      </div>

      <button type="submit" disabled={isSubmitting}>
        Submit
      </button>
    </form>
  );
}
```

**Why good:** useFormState with name prop subscribes to only that field's state, useWatch isolates character counter from other field changes, mode: "onBlur" prevents validation on every keystroke, each FieldError component re-renders independently

### Bad Example - Subscribing to entire form state

```typescript
// WRONG: Subscribes to entire form state
export function LargeForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isDirty, touchedFields, dirtyFields },
  } = useForm();

  // Every field change triggers re-render of entire form
  // because we're destructuring many formState properties

  return (
    <form>
      <input {...register("field1")} />
      {/* Entire form re-renders when any error changes */}
      {errors.field1 && <span>{errors.field1.message}</span>}

      {/* Character counter causes re-render on every keystroke */}
      <textarea {...register("notes")} />
      <span>{watch("notes")?.length} characters</span>
    </form>
  );
}
```

**Why bad:** destructuring multiple formState properties subscribes to all of them, any field change triggers full form re-render, watch() in render body causes re-render on every value change, no isolation of error display components

---
