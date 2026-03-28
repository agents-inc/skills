# TanStack Form - Array Field Examples

> Dynamic array field patterns for TanStack Form. See [SKILL.md](../SKILL.md) for concepts and [reference.md](../reference.md) for the array field API table.

**Related Examples:**

- [core.md](core.md) - Basic form, TypeScript, submission
- [validation.md](validation.md) - Sync/async validation, cross-field
- [composition.md](composition.md) - createFormHook, listeners

---

## Pattern 1: Basic Dynamic List

Use `mode="array"` on `form.Field` to enable array operations. Render nested fields with `form.Field` using bracket notation for array access.

```tsx
import { useForm } from "@tanstack/react-form";

interface TodoFormData {
  title: string;
  items: Array<{ text: string; done: boolean }>;
}

export function TodoForm() {
  const form = useForm({
    defaultValues: {
      title: "",
      items: [{ text: "", done: false }],
    } satisfies TodoFormData,
    onSubmit: async ({ value }) => {
      await saveTodos(value);
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
        name="title"
        children={(field) => (
          <div>
            <label htmlFor={field.name}>List Title</label>
            <input
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      />

      <form.Field
        name="items"
        mode="array"
        children={(itemsField) => (
          <div>
            <h3>Items</h3>
            {itemsField.state.value.map((_, i) => (
              <div key={i}>
                <form.Field
                  name={`items[${i}].text`}
                  validators={{
                    onChange: ({ value }) =>
                      !value ? "Item text is required" : undefined,
                  }}
                  children={(field) => (
                    <div>
                      <input
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder={`Item ${i + 1}`}
                      />
                      {field.state.meta.errors.map((err) => (
                        <em key={err} role="alert">
                          {err}
                        </em>
                      ))}
                    </div>
                  )}
                />
                <form.Field
                  name={`items[${i}].done`}
                  children={(field) => (
                    <label>
                      <input
                        type="checkbox"
                        checked={field.state.value}
                        onChange={(e) => field.handleChange(e.target.checked)}
                      />
                      Done
                    </label>
                  )}
                />
                <button
                  type="button"
                  onClick={() => itemsField.removeValue(i)}
                  disabled={itemsField.state.value.length <= 1}
                >
                  Remove
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => itemsField.pushValue({ text: "", done: false })}
            >
              Add Item
            </button>
          </div>
        )}
      />

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        children={([canSubmit, isSubmitting]) => (
          <button type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Saving..." : "Save"}
          </button>
        )}
      />
    </form>
  );
}
```

**Key points:**

- `pushValue` requires a complete object — `{ text: "", done: false }`, not `{ text: "" }`
- Array access uses bracket notation: `items[${i}].text`
- Use `removeValue(i)` to remove by index
- Disable remove when only one item remains to prevent empty arrays

---

## Pattern 2: Reordering Array Items

Use `swapValues` and `moveValue` for reordering.

```tsx
<form.Field
  name="steps"
  mode="array"
  children={(stepsField) => (
    <div>
      {stepsField.state.value.map((_, i) => (
        <div key={i}>
          <form.Field
            name={`steps[${i}].label`}
            children={(field) => (
              <input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            )}
          />
          <button
            type="button"
            disabled={i === 0}
            onClick={() => stepsField.moveValue(i, i - 1)}
          >
            Move Up
          </button>
          <button
            type="button"
            disabled={i === stepsField.state.value.length - 1}
            onClick={() => stepsField.moveValue(i, i + 1)}
          >
            Move Down
          </button>
          <button type="button" onClick={() => stepsField.removeValue(i)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => stepsField.pushValue({ label: "" })}>
        Add Step
      </button>
    </div>
  )}
/>
```

**`moveValue(from, to)` vs `swapValues(a, b)`:** `moveValue` shifts items to fill the gap (like drag-and-drop). `swapValues` exchanges two items in place.

---

## Pattern 3: Nested Array with Validation

Arrays of complex objects with per-item validation.

```tsx
interface InvoiceFormData {
  customerName: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

const MIN_QUANTITY = 1;

export function InvoiceForm() {
  const form = useForm({
    defaultValues: {
      customerName: "",
      lineItems: [{ description: "", quantity: 1, unitPrice: 0 }],
    } satisfies InvoiceFormData,
    onSubmit: async ({ value }) => {
      await createInvoice(value);
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
        name="lineItems"
        mode="array"
        children={(lineItemsField) => (
          <div>
            {lineItemsField.state.value.map((_, i) => (
              <div key={i}>
                <form.Field
                  name={`lineItems[${i}].description`}
                  validators={{
                    onChange: ({ value }) =>
                      !value ? "Description is required" : undefined,
                  }}
                  children={(field) => (
                    <div>
                      <input
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Description"
                      />
                      {field.state.meta.errors.map((err) => (
                        <em key={err} role="alert">
                          {err}
                        </em>
                      ))}
                    </div>
                  )}
                />
                <form.Field
                  name={`lineItems[${i}].quantity`}
                  validators={{
                    onChange: ({ value }) =>
                      value < MIN_QUANTITY
                        ? `Quantity must be at least ${MIN_QUANTITY}`
                        : undefined,
                  }}
                  children={(field) => (
                    <input
                      type="number"
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(e.target.valueAsNumber)
                      }
                      min={MIN_QUANTITY}
                    />
                  )}
                />
                <form.Field
                  name={`lineItems[${i}].unitPrice`}
                  validators={{
                    onChange: ({ value }) =>
                      value < 0 ? "Price cannot be negative" : undefined,
                  }}
                  children={(field) => (
                    <input
                      type="number"
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(e.target.valueAsNumber)
                      }
                      step="0.01"
                      min="0"
                    />
                  )}
                />
                <button
                  type="button"
                  onClick={() => lineItemsField.removeValue(i)}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                lineItemsField.pushValue({
                  description: "",
                  quantity: 1,
                  unitPrice: 0,
                })
              }
            >
              Add Line Item
            </button>
          </div>
        )}
      />
    </form>
  );
}
```

**Key points:** Each nested field gets its own `validators` prop. Validation errors are scoped to individual fields within each array item. `pushValue` must receive a complete `{ description, quantity, unitPrice }` object.
