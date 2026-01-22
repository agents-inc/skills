# VeeValidate - Schema Validation

> Schema validation patterns with Zod, Yup, and Valibot. See [core.md](core.md) for basic form patterns.

**Prerequisites:** Understand Basic Forms from [core.md](core.md) first.

---

## Pattern 1: Zod Schema Validation

### Good Example - Full typed schema integration

```vue
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";

const MIN_PASSWORD_LENGTH = 8;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 20;

// CRITICAL: Wrap schema with toTypedSchema
const userSchema = toTypedSchema(
  z
    .object({
      username: z
        .string()
        .min(MIN_USERNAME_LENGTH, `At least ${MIN_USERNAME_LENGTH} characters`)
        .max(MAX_USERNAME_LENGTH, `Max ${MAX_USERNAME_LENGTH} characters`)
        .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores"),
      email: z.string().email("Invalid email format"),
      password: z
        .string()
        .min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`)
        .regex(/[A-Z]/, "Must contain uppercase letter")
        .regex(/[0-9]/, "Must contain number"),
      confirmPassword: z.string(),
      age: z.coerce.number().min(18, "Must be 18 or older"),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    }),
);

// CRITICAL: Initialize ALL fields used in refine
const { handleSubmit, errors, defineField } = useForm({
  validationSchema: userSchema,
  initialValues: {
    username: "",
    email: "",
    password: "",
    confirmPassword: "", // Required for refine to work
    age: 18,
  },
});

const [username] = defineField("username");
const [email] = defineField("email");
const [password] = defineField("password");
const [confirmPassword] = defineField("confirmPassword");
const [age] = defineField("age");

const onSubmit = handleSubmit(async (values) => {
  // values is fully typed from schema
  await registerUser(values);
});
</script>

<template>
  <form @submit="onSubmit">
    <div>
      <label for="username">Username</label>
      <input id="username" v-model="username" />
      <span v-if="errors.username" role="alert">{{ errors.username }}</span>
    </div>

    <div>
      <label for="email">Email</label>
      <input id="email" v-model="email" type="email" />
      <span v-if="errors.email" role="alert">{{ errors.email }}</span>
    </div>

    <div>
      <label for="password">Password</label>
      <input id="password" v-model="password" type="password" />
      <span v-if="errors.password" role="alert">{{ errors.password }}</span>
    </div>

    <div>
      <label for="confirmPassword">Confirm Password</label>
      <input id="confirmPassword" v-model="confirmPassword" type="password" />
      <span v-if="errors.confirmPassword" role="alert">{{
        errors.confirmPassword
      }}</span>
    </div>

    <div>
      <label for="age">Age</label>
      <input id="age" v-model="age" type="number" />
      <span v-if="errors.age" role="alert">{{ errors.age }}</span>
    </div>

    <button type="submit">Register</button>
  </form>
</template>
```

**Why good:** toTypedSchema enables full TypeScript inference, z.coerce.number() handles string-to-number conversion from input, refine enables cross-field validation (password confirmation), path option targets specific field for cross-field errors, ALL refine-dependent fields initialized to avoid undefined issues

### Important: Zod refine/superRefine Gotcha

Zod's `refine` and `superRefine` do NOT execute when object keys are missing.

```typescript
// PROBLEMATIC: refine won't run if confirmPassword is undefined
const schema = z
  .object({
    password: z.string(),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
  });

// SOLUTION: Always initialize all fields
const { defineField } = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: {
    password: "",
    confirmPassword: "", // CRITICAL: Must be initialized
  },
});
```

---

## Pattern 2: Yup Schema Validation

```vue
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/yup";
import * as yup from "yup";

const MIN_PASSWORD_LENGTH = 8;

const schema = toTypedSchema(
  yup.object({
    email: yup.string().required("Email is required").email("Invalid email"),
    password: yup
      .string()
      .required("Password is required")
      .min(MIN_PASSWORD_LENGTH, `Min ${MIN_PASSWORD_LENGTH} characters`),
    role: yup.string().oneOf(["admin", "user"], "Invalid role").required(),
  }),
);

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: schema,
  initialValues: {
    email: "",
    password: "",
    role: "user",
  },
});

const [email] = defineField("email");
const [password] = defineField("password");
const [role] = defineField("role");

const onSubmit = handleSubmit(async (values) => {
  await createUser(values);
});
</script>

<template>
  <form @submit="onSubmit">
    <div>
      <input v-model="email" type="email" placeholder="Email" />
      <span v-if="errors.email" role="alert">{{ errors.email }}</span>
    </div>

    <div>
      <input v-model="password" type="password" placeholder="Password" />
      <span v-if="errors.password" role="alert">{{ errors.password }}</span>
    </div>

    <div>
      <select v-model="role">
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>
      <span v-if="errors.role" role="alert">{{ errors.role }}</span>
    </div>

    <button type="submit">Create</button>
  </form>
</template>
```

**Why good:** Yup's fluent API familiar to many developers, oneOf validates against allowed values, toTypedSchema from @vee-validate/yup provides type inference

---

## Pattern 3: Valibot Schema Validation (Bundle Optimized)

```vue
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/valibot";
import * as v from "valibot";

const MIN_AGE = 18;

const schema = toTypedSchema(
  v.object({
    email: v.pipe(
      v.string(),
      v.nonEmpty("Email is required"),
      v.email("Invalid email"),
    ),
    age: v.pipe(v.number(), v.minValue(MIN_AGE, `Must be ${MIN_AGE}+`)),
  }),
);

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: schema,
  initialValues: {
    email: "",
    age: MIN_AGE,
  },
});

const [email] = defineField("email");
const [age] = defineField("age");

const onSubmit = handleSubmit((values) => {
  console.log(values);
});
</script>

<template>
  <form @submit="onSubmit">
    <input v-model="email" type="email" />
    <span v-if="errors.email" role="alert">{{ errors.email }}</span>

    <input v-model.number="age" type="number" />
    <span v-if="errors.age" role="alert">{{ errors.age }}</span>

    <button type="submit">Submit</button>
  </form>
</template>
```

**Why good:** Valibot has smallest bundle size due to tree-shaking, pipe-based API is fully modular, same toTypedSchema pattern as other libraries

---

## Pattern 4: Conditional Schema Validation

Schema changes based on form state.

```vue
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";
import { computed } from "vue";

const { handleSubmit, errors, defineField, values } = useForm({
  initialValues: {
    contactMethod: "email" as "email" | "phone",
    email: "",
    phone: "",
  },
});

const [contactMethod] = defineField("contactMethod");
const [email] = defineField("email");
const [phone] = defineField("phone");

// Dynamic schema based on contactMethod
const schema = computed(() =>
  toTypedSchema(
    z.object({
      contactMethod: z.enum(["email", "phone"]),
      email:
        values.contactMethod === "email"
          ? z.string().email("Invalid email")
          : z.string().optional(),
      phone:
        values.contactMethod === "phone"
          ? z.string().min(10, "Invalid phone number")
          : z.string().optional(),
    }),
  ),
);

const onSubmit = handleSubmit(async (data) => {
  await saveContact(data);
});
</script>

<template>
  <form @submit="onSubmit">
    <div>
      <label>
        <input v-model="contactMethod" type="radio" value="email" />
        Email
      </label>
      <label>
        <input v-model="contactMethod" type="radio" value="phone" />
        Phone
      </label>
    </div>

    <div v-if="contactMethod === 'email'">
      <input v-model="email" type="email" placeholder="Email" />
      <span v-if="errors.email" role="alert">{{ errors.email }}</span>
    </div>

    <div v-if="contactMethod === 'phone'">
      <input v-model="phone" type="tel" placeholder="Phone" />
      <span v-if="errors.phone" role="alert">{{ errors.phone }}</span>
    </div>

    <button type="submit">Save</button>
  </form>
</template>
```

**Why good:** computed schema reacts to form value changes, optional fields skip validation when not required, z.enum validates contactMethod selection

---

## Pattern 5: Multiple Errors Per Field

Display all validation errors, not just the first.

```vue
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";

const MIN_PASSWORD_LENGTH = 8;

const schema = toTypedSchema(
  z.object({
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`)
      .regex(/[A-Z]/, "Must contain uppercase")
      .regex(/[a-z]/, "Must contain lowercase")
      .regex(/[0-9]/, "Must contain number")
      .regex(/[^A-Za-z0-9]/, "Must contain special character"),
  }),
);

const { handleSubmit, errorBag, defineField } = useForm({
  validationSchema: schema,
  initialValues: { password: "" },
});

const [password] = defineField("password");

const onSubmit = handleSubmit((values) => {
  console.log("Valid:", values);
});
</script>

<template>
  <form @submit="onSubmit">
    <div>
      <label for="password">Password</label>
      <input id="password" v-model="password" type="password" />

      <!-- Show ALL errors, not just first -->
      <ul v-if="errorBag.password?.length" class="error-list" role="alert">
        <li v-for="error in errorBag.password" :key="error">
          {{ error }}
        </li>
      </ul>
    </div>

    <button type="submit">Submit</button>
  </form>
</template>
```

**Why good:** errorBag contains ALL errors per field (not just first), useful for password requirements showing all unmet criteria, v-for displays complete validation feedback

---

## Schema Validation Package Reference

| Library | Package                 | Install                               |
| ------- | ----------------------- | ------------------------------------- |
| Zod     | `@vee-validate/zod`     | `npm i @vee-validate/zod zod`         |
| Yup     | `@vee-validate/yup`     | `npm i @vee-validate/yup yup`         |
| Valibot | `@vee-validate/valibot` | `npm i @vee-validate/valibot valibot` |

**Import pattern:**

```typescript
import { toTypedSchema } from "@vee-validate/zod";
import { toTypedSchema } from "@vee-validate/yup";
import { toTypedSchema } from "@vee-validate/valibot";
```

---
