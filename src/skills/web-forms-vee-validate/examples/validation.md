# VeeValidate - Schema Validation

> Getting a schema into `validationSchema` and reading what comes back. See [core.md](core.md) for
> the basic form and for inline validator functions.

**Prerequisites:** Pattern 1 from [core.md](core.md).

---

## Pattern 6: Schema Through toTypedSchema

The schema is authored in its own module. This file shows the adapter and what the form does with
the result.

```vue
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
// Authored separately — see whichever skill owns your schema library
import { registrationSchema } from "./schemas/registration";

const schema = toTypedSchema(registrationSchema);

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: schema,
  initialValues: {
    username: "",
    email: "",
    password: "",
    confirmPassword: "", // needed for the cross-field rule to run at all
    age: 18, // a starting value — the schema states the actual minimum
  },
});

const [username, usernameAttrs] = defineField("username");
const [email, emailAttrs] = defineField("email");
const [password, passwordAttrs] = defineField("password");
const [confirmPassword, confirmPasswordAttrs] = defineField("confirmPassword");
const [age, ageAttrs] = defineField("age");

const onSubmit = handleSubmit(async (values) => {
  // values is typed from the schema
  await registerUser(values);
});
</script>

<template>
  <form @submit="onSubmit">
    <div>
      <label for="username">Username</label>
      <input id="username" v-model="username" v-bind="usernameAttrs" />
      <span v-if="errors.username" role="alert">{{ errors.username }}</span>
    </div>

    <div>
      <label for="email">Email</label>
      <input id="email" v-model="email" v-bind="emailAttrs" type="email" />
      <span v-if="errors.email" role="alert">{{ errors.email }}</span>
    </div>

    <div>
      <label for="password">Password</label>
      <input
        id="password"
        v-model="password"
        v-bind="passwordAttrs"
        type="password"
      />
      <span v-if="errors.password" role="alert">{{ errors.password }}</span>
    </div>

    <div>
      <label for="confirmPassword">Confirm Password</label>
      <input
        id="confirmPassword"
        v-model="confirmPassword"
        v-bind="confirmPasswordAttrs"
        type="password"
      />
      <span v-if="errors.confirmPassword" role="alert">
        {{ errors.confirmPassword }}
      </span>
    </div>

    <div>
      <label for="age">Age</label>
      <input id="age" v-model="age" v-bind="ageAttrs" type="number" />
      <span v-if="errors.age" role="alert">{{ errors.age }}</span>
    </div>

    <button type="submit">Register</button>
  </form>
</template>
```

**Why good:** the schema's messages arrive as `errors.<field>` with no mapping code, the cross-field
message lands on `confirmPassword` because the schema points its error at that path, and `values` in
the submit handler is typed from the schema rather than declared a second time.

### Two Things the Adapter Boundary Changes

**A cross-field rule needs every key it reads present in `initialValues`.** Zod is the case to
watch: its object-level refinements are skipped rather than failed when a key they read is missing
from the object handed to them, so a rule comparing `password` with `confirmPassword` lets a
mismatched pair through as valid. Initialise every key whichever adapter you are on — the failure is
silent either way.

```typescript
// PROBLEMATIC — the rule never executes
const { defineField } = useForm({
  validationSchema: toTypedSchema(passwordSchema),
  initialValues: { password: "" }, // confirmPassword absent
});

// CORRECT — every key the rule compares is present
const { defineField } = useForm({
  validationSchema: toTypedSchema(passwordSchema),
  initialValues: { password: "", confirmPassword: "" },
});
```

**A number input delivers a string.** `v-model` on `type="number"` yields a string unless it carries
`.number`, so either the template uses `v-model.number` or the schema coerces. Pick one — doing both
is harmless, doing neither fails a numeric rule against a value that looks correct on screen.

---

## Pattern 7: Conditional Validation

Two shapes, and which applies depends on whether the condition is part of the data or outside it.

### Approach A: A schema that branches on a field's own value

When a field in the form decides which rules apply, the schema can express that itself and stay
static — no recomputation, and the submit handler's type narrows per branch.

```vue
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { contactSchema } from "./schemas/contact";

const schema = toTypedSchema(contactSchema);

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: schema,
  initialValues: {
    contactMethod: "email" as "email" | "phone",
    email: "",
    phone: "",
  },
});

const [contactMethod] = defineField("contactMethod");
const [email, emailAttrs] = defineField("email");
const [phone, phoneAttrs] = defineField("phone");

const onSubmit = handleSubmit(async (data) => {
  await saveContact(data);
});
</script>

<template>
  <form @submit="onSubmit">
    <label>
      <input v-model="contactMethod" type="radio" value="email" /> Email
    </label>
    <label>
      <input v-model="contactMethod" type="radio" value="phone" /> Phone
    </label>

    <div v-if="contactMethod === 'email'">
      <input
        v-model="email"
        v-bind="emailAttrs"
        type="email"
        placeholder="Email"
      />
      <span v-if="errors.email" role="alert">{{ errors.email }}</span>
    </div>

    <div v-if="contactMethod === 'phone'">
      <input
        v-model="phone"
        v-bind="phoneAttrs"
        type="tel"
        placeholder="Phone"
      />
      <span v-if="errors.phone" role="alert">{{ errors.phone }}</span>
    </div>

    <button type="submit">Save</button>
  </form>
</template>
```

**Why good:** the schema never changes identity, so nothing re-validates on a branch switch beyond
what the new rules require, and `contactMethod` is a form field so its value is submitted with the
rest.

### Approach B: A computed schema, for a condition outside the form

When the deciding state is not a form field — a permission, a route, a feature flag — the schema is
computed from it and passed as the computed itself.

```vue
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { computed } from "vue";
import { strictProfileSchema, basicProfileSchema } from "./schemas/profile";

const props = defineProps<{ requiresVerification: boolean }>();

// Pass the computed itself — .value here would bind one snapshot forever
const schema = computed(() =>
  toTypedSchema(
    props.requiresVerification ? strictProfileSchema : basicProfileSchema,
  ),
);

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: schema,
  initialValues: { email: "", taxId: "" },
});
</script>
```

**Why good:** the computed is passed unwrapped, so the form tracks it and re-validates the touched
fields when the schema changes. Deriving it from a prop rather than from a form value keeps it out
of a cycle with `useForm`'s own state.

---

## Pattern 8: Every Error for a Field

`errors` carries the first message per field. `errorBag` carries all of them, which is what a
requirements checklist needs.

```vue
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { passwordSchema } from "./schemas/password";

const { handleSubmit, errorBag, defineField } = useForm({
  validationSchema: toTypedSchema(passwordSchema),
  initialValues: { password: "" },
});

const [password, passwordAttrs] = defineField("password");

const onSubmit = handleSubmit(async (values) => {
  await updatePassword(values);
});
</script>

<template>
  <form @submit="onSubmit">
    <label for="password">Password</label>
    <input
      id="password"
      v-model="password"
      v-bind="passwordAttrs"
      type="password"
    />

    <ul v-if="errorBag.password?.length" role="alert">
      <li v-for="error in errorBag.password" :key="error">{{ error }}</li>
    </ul>

    <button type="submit">Submit</button>
  </form>
</template>
```

**Why good:** every unmet requirement is listed at once, so the user fixes them in one pass rather
than discovering them one submit at a time.

---

## Adapter Packages

One adapter per schema library, each exporting `toTypedSchema`. The form code above is identical
whichever is installed. Install the adapter alongside the library it adapts — the adapter does not
bring it.

| Schema library | Adapter package         | Install                               |
| -------------- | ----------------------- | ------------------------------------- |
| Zod            | `@vee-validate/zod`     | `npm i @vee-validate/zod zod`         |
| Yup            | `@vee-validate/yup`     | `npm i @vee-validate/yup yup`         |
| Valibot        | `@vee-validate/valibot` | `npm i @vee-validate/valibot valibot` |

---
