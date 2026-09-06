# React Hook Form - Repeatable Rows

> `useFieldArray` for field groups the user adds and removes. See [core.md](core.md) for the basic form.

**Prerequisites:** Pattern 1 from [core.md](core.md).

---

## Pattern 4: useFieldArray for Dynamic Forms

### Good Example - Dynamic invoice line items

```typescript
import { useForm, useFieldArray } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceFormData {
  invoiceNumber: string;
  customerEmail: string;
  lineItems: LineItem[];
}

const MIN_QUANTITY = 1;
const MIN_PRICE = 0;
const DEFAULT_QUANTITY = 1;
const DEFAULT_PRICE = 0;

export function InvoiceForm() {
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    mode: "onBlur",
    defaultValues: {
      invoiceNumber: "",
      customerEmail: "",
      lineItems: [
        { description: "", quantity: DEFAULT_QUANTITY, unitPrice: DEFAULT_PRICE },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
    rules: {
      minLength: { value: 1, message: "At least one line item is required" },
    },
  });

  const watchedLineItems = watch("lineItems");

  const calculateTotal = () => {
    return watchedLineItems.reduce((sum, item) => {
      return sum + (item.quantity || 0) * (item.unitPrice || 0);
    }, 0);
  };

  const onSubmit: SubmitHandler<InvoiceFormData> = async (data) => {
    await createInvoice(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register("invoiceNumber", { required: "Invoice number required" })}
        placeholder="Invoice #"
      />
      {errors.invoiceNumber && <span>{errors.invoiceNumber.message}</span>}

      <input
        {...register("customerEmail", { required: "Email required" })}
        placeholder="Customer email"
      />
      {errors.customerEmail && <span>{errors.customerEmail.message}</span>}

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => {
            const itemTotal =
              (watchedLineItems[index]?.quantity || 0) *
              (watchedLineItems[index]?.unitPrice || 0);

            return (
              // field.id, not index — the bad example below shows why
              <tr key={field.id}>
                <td>
                  <input
                    {...register(`lineItems.${index}.description`, {
                      required: "Description required",
                    })}
                  />
                  {errors.lineItems?.[index]?.description && (
                    <span>{errors.lineItems[index]?.description?.message}</span>
                  )}
                </td>
                <td>
                  <input
                    type="number"
                    {...register(`lineItems.${index}.quantity`, {
                      valueAsNumber: true,
                      min: {
                        value: MIN_QUANTITY,
                        message: `Min ${MIN_QUANTITY}`,
                      },
                      required: "Required",
                    })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    {...register(`lineItems.${index}.unitPrice`, {
                      valueAsNumber: true,
                      min: {
                        value: MIN_PRICE,
                        message: `Min ${MIN_PRICE}`,
                      },
                      required: "Required",
                    })}
                  />
                </td>
                <td>${itemTotal.toFixed(2)}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>Total</td>
            <td>${calculateTotal().toFixed(2)}</td>
            <td />
          </tr>
        </tfoot>
      </table>

      {errors.lineItems?.root && (
        <span role="alert">{errors.lineItems.root.message}</span>
      )}

      <button
        type="button"
        onClick={() =>
          append({ description: "", quantity: DEFAULT_QUANTITY, unitPrice: DEFAULT_PRICE })
        }
      >
        Add Line Item
      </button>

      <button type="submit">Create Invoice</button>
    </form>
  );
}
```

**Why good:** `field.id` keeps each row matched to its own inputs across add and remove,
`rules.minLength` on the hook validates the array itself and reports at `errors.lineItems.root`, and
`valueAsNumber` means the total arithmetic runs on numbers rather than on strings.

### Bad Example - Using index as key

```typescript
// WRONG: Using index as key breaks form state
export function InvoiceForm() {
  const { control, register } = useForm();
  const { fields, remove } = useFieldArray({ control, name: "items" });

  return (
    <div>
      {fields.map((field, index) => (
        // WRONG: Using index as key!
        <div key={index}>
          <input {...register(`items.${index}.name`)} />
          <button onClick={() => remove(index)}>Remove</button>
        </div>
      ))}
    </div>
  );
}
```

**Why bad:** React matches rows by key, so removing item 2 of 5 leaves keys `0..3` pointing at
different data than before — every value below the removed row shifts up one input.

---
