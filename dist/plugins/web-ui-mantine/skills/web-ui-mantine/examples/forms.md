# Mantine v7 - Form Examples

> Form management with @mantine/form — validation, nested fields, dynamic lists, and schema resolvers. See [core.md](core.md) for setup patterns.

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

**Why good:** `mode: "uncontrolled"` avoids re-renders on every keystroke, `form.key()` provides React key stability, `getInputProps` auto-binds value/onChange/error, `{ type: "checkbox" }` binds checked instead of value

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

**Why good:** Validator receives full form values for cross-field checks, conditional validation based on other field values, `validateInputOnBlur` provides UX-friendly timing

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

**Why good:** Dot notation works for both getInputProps and setFieldValue, validation mirrors the nested structure, entire objects can be set at once

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

**Why good:** `insertListItem` and `removeListItem` handle array mutations, validation applies to each list item individually, index-based dot notation for field access

---

## Pattern 5: Zod Schema Validation

```bash
npm install zod mantine-form-zod-resolver
```

```tsx
// Zod v3
import { zodResolver } from "mantine-form-zod-resolver";
import { z } from "zod";
// Zod v4: use zod4Resolver and import from "zod/v4"
// import { zod4Resolver } from "mantine-form-zod-resolver";
// import { z } from "zod/v4";

import { useForm } from "@mantine/form";
import { TextInput, NumberInput, Button, Box } from "@mantine/core";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  age: z.number().min(18, "Must be at least 18").max(120, "Invalid age"),
});

type FormValues = z.infer<typeof schema>;

export function ValidatedForm() {
  const form = useForm<FormValues>({
    mode: "uncontrolled",
    initialValues: {
      name: "",
      email: "",
      age: 18,
    },
    validate: zodResolver(schema),
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

**Why good:** Zod schema provides type inference and reusable validation, `zodResolver` adapts Zod errors to Mantine's error format, same `getInputProps` pattern works regardless of validation approach

> **Zod v4:** Use `zod4Resolver` from `mantine-form-zod-resolver` v1.2.0+ and import `z` from `"zod/v4"`. Error message syntax changes from `{ message: '...' }` to `{ error: '...' }`.
