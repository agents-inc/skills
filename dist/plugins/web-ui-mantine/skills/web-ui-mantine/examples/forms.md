# Mantine v7 - Form Examples

> `@mantine/form` — validation, nested fields, dynamic lists, schema resolvers. See
> [core.md](core.md) for setup and [components.md](components.md) for the surrounding components.

**Prerequisites**: `npm install @mantine/form`

---

## Pattern 1: Basic Form with Validation

```tsx
import { useForm } from "@mantine/form";
import {
  TextInput,
  PasswordInput,
  Checkbox,
  Button,
  Group,
  Box,
} from "@mantine/core";

export function LoginForm() {
  const form = useForm({
    mode: "uncontrolled",
    initialValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : "Invalid email"),
      password: (value) =>
        value.length < 8 ? "Password must be at least 8 characters" : null,
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    // values is typed: { email: string; password: string; rememberMe: boolean }
    console.log(values);
  };

  return (
    <Box component="form" onSubmit={form.onSubmit(handleSubmit)} maw={400}>
      <TextInput
        label="Email"
        placeholder="you@example.com"
        withAsterisk
        key={form.key("email")}
        {...form.getInputProps("email")}
      />
      <PasswordInput
        label="Password"
        placeholder="Your password"
        withAsterisk
        mt="md"
        key={form.key("password")}
        {...form.getInputProps("password")}
      />
      <Checkbox
        label="Remember me"
        mt="md"
        key={form.key("rememberMe")}
        {...form.getInputProps("rememberMe", { type: "checkbox" })}
      />
      <Group justify="flex-end" mt="md">
        <Button type="submit">Log in</Button>
      </Group>
    </Box>
  );
}
```

**Why good:** `mode: "uncontrolled"` keeps keystrokes out of React's render path, which is why
`form.key()` goes with it — it gives React a key that survives values changing outside its
knowledge. `getInputProps` binds value, change handler and error in one spread, and
`{ type: "checkbox" }` switches it to `checked`.

---

## Pattern 2: Cross-Field and Conditional Validation

```tsx
const form = useForm({
  mode: "uncontrolled",
  initialValues: {
    password: "",
    confirmPassword: "",
    accountType: "personal",
    companyName: "",
  },
  validate: {
    password: (value) =>
      value.length < 8 ? "Password must be at least 8 characters" : null,
    // Cross-field: compare password fields
    confirmPassword: (value, values) =>
      value !== values.password ? "Passwords do not match" : null,
    // Conditional: only required for business accounts
    companyName: (value, values) =>
      values.accountType === "business" && value.length === 0
        ? "Company name required for business accounts"
        : null,
  },
  // Validate on blur (not on every change)
  validateInputOnBlur: true,
});
```

**Why good:** the second argument is the whole values object, so one field's rule can read another's
value — which is what makes "matches the password" and "required only for business accounts"
expressible without lifting state. `validateInputOnBlur` moves the feedback off every keystroke.

---

## Pattern 3: Nested Object Fields

```tsx
const form = useForm({
  mode: "uncontrolled",
  initialValues: {
    name: "",
    address: {
      street: "",
      city: "",
      state: "",
      zip: "",
    },
  },
  validate: {
    name: (value) => (value.length < 2 ? "Name too short" : null),
    address: {
      city: (value) => (value.length === 0 ? "City required" : null),
      zip: (value) => (/^\d{5}$/.test(value) ? null : "Invalid ZIP"),
    },
  },
});

// Access nested fields with dot notation
<TextInput
  label="Street"
  key={form.key("address.street")}
  {...form.getInputProps("address.street")}
/>
<TextInput
  label="City"
  key={form.key("address.city")}
  {...form.getInputProps("address.city")}
/>

// Set nested values programmatically
form.setFieldValue("address.city", "New York");
form.setFieldValue("address", { street: "123 Main St", city: "NYC", state: "NY", zip: "10001" });
```

**Why good:** one dot-notation path works for `getInputProps`, `form.key()` and `setFieldValue`
alike, and the `validate` object mirrors the shape of `initialValues` rather than flattening it.

---

## Pattern 4: Dynamic List Fields

```tsx
import { useForm } from "@mantine/form";
import { TextInput, Button, Group, ActionIcon, Box } from "@mantine/core";

export function TeamForm() {
  const form = useForm({
    mode: "uncontrolled",
    initialValues: {
      teamName: "",
      members: [{ name: "", email: "" }],
    },
    validate: {
      teamName: (value) => (value.length < 2 ? "Team name required" : null),
      members: {
        name: (value) => (value.length === 0 ? "Name required" : null),
        email: (value) => (/^\S+@\S+$/.test(value) ? null : "Invalid email"),
      },
    },
  });

  const memberFields = form.getValues().members.map((_, index) => (
    <Group key={form.key(`members.${index}`)} mt="xs">
      <TextInput
        placeholder="Name"
        style={{ flex: 1 }}
        key={form.key(`members.${index}.name`)}
        {...form.getInputProps(`members.${index}.name`)}
      />
      <TextInput
        placeholder="Email"
        style={{ flex: 1 }}
        key={form.key(`members.${index}.email`)}
        {...form.getInputProps(`members.${index}.email`)}
      />
      <ActionIcon
        color="red"
        variant="light"
        onClick={() => form.removeListItem("members", index)}
        disabled={form.getValues().members.length === 1}
      >
        X
      </ActionIcon>
    </Group>
  ));

  return (
    <Box component="form" onSubmit={form.onSubmit(handleSubmit)}>
      <TextInput
        label="Team Name"
        key={form.key("teamName")}
        {...form.getInputProps("teamName")}
      />
      {memberFields}
      <Button
        variant="light"
        mt="md"
        onClick={() => form.insertListItem("members", { name: "", email: "" })}
      >
        Add Member
      </Button>
      <Group justify="flex-end" mt="xl">
        <Button type="submit">Create Team</Button>
      </Group>
    </Box>
  );
}
```

**Why good:** `insertListItem` / `removeListItem` reindex the paths and the errors together, which
is the part that goes wrong when an array is spliced by hand. The `members` validator is written
once and applies to every item.

---

## Pattern 5: Validating from a Schema

`validate` accepts either the object of per-field functions shown above **or** a single resolver
function. A resolver takes the form values, runs them through a schema, and returns Mantine's error
shape — an object keyed by field path. Mantine publishes one adapter per schema library under the
`mantine-form-*-resolver` name; the schema itself is written however that library writes schemas,
which is not this skill's concern.

```tsx
import { useForm } from "@mantine/form";
import { TextInput, NumberInput, Button, Box } from "@mantine/core";
import { zodResolver } from "mantine-form-zod-resolver";

import { schema, type FormValues } from "./form-schema";

export function ValidatedForm() {
  const form = useForm<FormValues>({
    mode: "uncontrolled",
    initialValues: { name: "", email: "", age: 18 },
    validate: zodResolver(schema), // replaces the per-field validate object entirely
  });

  return (
    <Box component="form" onSubmit={form.onSubmit(handleSubmit)}>
      <TextInput
        label="Name"
        key={form.key("name")}
        {...form.getInputProps("name")}
      />
      <TextInput
        label="Email"
        mt="md"
        key={form.key("email")}
        {...form.getInputProps("email")}
      />
      <NumberInput
        label="Age"
        mt="md"
        key={form.key("age")}
        {...form.getInputProps("age")}
      />
      <Button type="submit" mt="xl">
        Submit
      </Button>
    </Box>
  );
}
```

**Why good:** everything downstream is unchanged — `getInputProps`, `form.key()` and the error
rendering behave identically whichever route produced the errors, so a form can move from inline
functions to a schema without touching a single field.

**Two things to check:** the resolver package tracks the schema library's **major** version and
exports a differently-named function per major — `mantine-form-zod-resolver` ships both
`zodResolver` and `zod4Resolver` — so a mismatched pair fails at the import; and
`useForm<FormValues>` should be parameterised with the type the schema infers, or the values and the
validation can drift apart with nothing to catch it.
