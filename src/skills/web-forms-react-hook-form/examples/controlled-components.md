# React Hook Form - Components That Own Their Value

> `Controller` for inputs that expose no usable ref. See [core.md](core.md) for the basic form.

**Prerequisites:** Pattern 1 from [core.md](core.md).

---

## Pattern 2: Controller for Controlled Components

### Good Example - Controller with Select component

```typescript
import { useForm, Controller } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

interface EmployeeFormData {
  name: string;
  department: string;
  startDate: Date | null;
  skills: string[];
}

const DEPARTMENTS = [
  { value: "engineering", label: "Engineering" },
  { value: "design", label: "Design" },
  { value: "product", label: "Product" },
  { value: "marketing", label: "Marketing" },
] as const;

const SKILLS = [
  { value: "react", label: "React" },
  { value: "typescript", label: "TypeScript" },
  { value: "node", label: "Node.js" },
  { value: "python", label: "Python" },
] as const;

export function EmployeeForm() {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmployeeFormData>({
    mode: "onBlur",
    defaultValues: {
      name: "",
      department: "",
      startDate: null,
      skills: [],
    },
  });

  const onSubmit: SubmitHandler<EmployeeFormData> = async (data) => {
    await createEmployee(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Native input - use register */}
      <input
        {...register("name", { required: "Name is required" })}
        placeholder="Full name"
      />
      {errors.name && <span role="alert">{errors.name.message}</span>}

      {/* Single select - use Controller */}
      <Controller
        name="department"
        control={control}
        rules={{ required: "Department is required" }}
        render={({ field, fieldState: { error } }) => (
          <div>
            <select {...field}>
              <option value="">Select department</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept.value} value={dept.value}>
                  {dept.label}
                </option>
              ))}
            </select>
            {error && <span role="alert">{error.message}</span>}
          </div>
        )}
      />

      {/* Date picker - use Controller */}
      <Controller
        name="startDate"
        control={control}
        rules={{ required: "Start date is required" }}
        render={({ field, fieldState: { error } }) => (
          <div>
            <input
              type="date"
              value={field.value ? field.value.toISOString().split("T")[0] : ""}
              onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
              onBlur={field.onBlur}
            />
            {error && <span role="alert">{error.message}</span>}
          </div>
        )}
      />

      {/* Multi-select - use Controller */}
      <Controller
        name="skills"
        control={control}
        render={({ field }) => (
          <div>
            <label>Skills</label>
            {SKILLS.map((skill) => (
              <label key={skill.value}>
                <input
                  type="checkbox"
                  value={skill.value}
                  checked={field.value.includes(skill.value)}
                  onChange={(e) => {
                    const newValue = e.target.checked
                      ? [...field.value, skill.value]
                      : field.value.filter((v) => v !== skill.value);
                    field.onChange(newValue);
                  }}
                />
                {skill.label}
              </label>
            ))}
          </div>
        )}
      />

      <button type="submit">Create Employee</button>
    </form>
  );
}
```

**Why good:** each `Controller` confines its re-render to one field, `fieldState.error` gives that
field's error without reading the form-wide `errors` object, and the checkbox group shows the shape
for an array-valued field — `field.onChange` receives the whole next array.

### Bad Example - Using register for controlled components

```typescript
// WRONG: Using register with controlled components
export function EmployeeForm() {
  const { register, handleSubmit } = useForm();
  const [skills, setSkills] = useState([]); // Separate state!

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Wrong: Custom select won't work with register */}
      <CustomSelect {...register("department")} options={departments} />

      {/* Wrong: Managing state separately from form */}
      <MultiSelect
        value={skills}
        onChange={setSkills} // This state is disconnected from form!
      />
    </form>
  );
}
```

**Why bad:** `register` spreads a `ref` the custom select never forwards, so the field never
registers. The separate `useState` compounds it — `skills` is absent from the submit payload and no
validation ever runs against it.

---
