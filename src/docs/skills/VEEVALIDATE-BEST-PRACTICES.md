# VeeValidate v4 Best Practices Research (2025/2026)

> **Research Date:** January 2025
> **VeeValidate Version:** v4.x
> **Vue Version:** Vue 3.x with Composition API
> **Focus:** TypeScript patterns, schema validation, performance optimization

---

## Table of Contents

1. [Core Concepts and Philosophy](#core-concepts-and-philosophy)
2. [Essential Composition API Patterns](#essential-composition-api-patterns)
3. [Schema Validation Integration](#schema-validation-integration)
4. [Custom Input Components](#custom-input-components)
5. [Field Arrays and Dynamic Forms](#field-arrays-and-dynamic-forms)
6. [Multi-Step Wizard Forms](#multi-step-wizard-forms)
7. [Error Handling and Display](#error-handling-and-display)
8. [Internationalization (i18n)](#internationalization-i18n)
9. [Performance Optimization](#performance-optimization)
10. [Testing Approaches](#testing-approaches)
11. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
12. [Sources](#sources)

---

## Core Concepts and Philosophy

### What is VeeValidate?

VeeValidate is a form validation library for Vue.js that provides:

- **Composition API functions** (`useForm`, `useField`, `defineField`) for seamless integration
- **First-class TypeScript support** with full type inference
- **Schema library integrations** (Yup, Zod, Valibot) for declarative validation
- **Framework-agnostic validation logic** that works with any UI library

### Philosophy

VeeValidate v4 embraces Vue 3's Composition API as the **recommended approach**:

> "Composition API: This is the best way to use vee-validate as it allows seamless integrations with your existing UI, or any 3rd party component library."

**Key principles:**

1. **Decoupled validation** - Validation logic is separate from UI rendering
2. **Schema-first** - Prefer declarative schemas (Yup/Zod) over inline rules
3. **Type safety** - Full TypeScript inference for form values
4. **Composability** - Build custom components using primitives

### When to Use VeeValidate

**Best suited for:**

- Complex forms with multiple validation rules
- Forms requiring schema-based validation (Yup/Zod)
- Multi-step wizards and dynamic field arrays
- Applications needing i18n for validation messages
- Custom UI component libraries requiring validation integration

**Consider alternatives for:**

- Simple single-field validation (native HTML5 validation may suffice)
- Forms with only server-side validation

---

## Essential Composition API Patterns

### Pattern 1: Basic Form with `useForm` and `defineField`

The fastest way to create validated forms:

```typescript
<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { z } from 'zod';

// Define schema with Zod
const schema = toTypedSchema(
  z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  })
);

// Initialize form with typed schema
const { handleSubmit, errors, defineField } = useForm({
  validationSchema: schema,
});

// Define fields - returns [model, attrs] tuple
const [email, emailAttrs] = defineField('email');
const [password, passwordAttrs] = defineField('password');

// Type-safe submit handler
const onSubmit = handleSubmit((values) => {
  // values is fully typed: { email: string; password: string }
  console.log('Submitting:', values);
});
</script>

<template>
  <form @submit="onSubmit">
    <div>
      <label for="email">Email</label>
      <input id="email" v-model="email" v-bind="emailAttrs" type="email" />
      <span v-if="errors.email" class="error">{{ errors.email }}</span>
    </div>

    <div>
      <label for="password">Password</label>
      <input id="password" v-model="password" v-bind="passwordAttrs" type="password" />
      <span v-if="errors.password" class="error">{{ errors.password }}</span>
    </div>

    <button type="submit">Submit</button>
  </form>
</template>
```

### Pattern 2: Typed Forms with Generics

For explicit type control:

```typescript
<script setup lang="ts">
import { useForm } from 'vee-validate';

interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

const { handleSubmit, errors, values, defineField } = useForm<LoginForm>({
  initialValues: {
    email: '',
    password: '',
    rememberMe: false,
  },
});

// Fields are now typed based on LoginForm interface
const [email, emailAttrs] = defineField('email');
const [password, passwordAttrs] = defineField('password');
const [rememberMe, rememberMeAttrs] = defineField('rememberMe');
</script>
```

### Pattern 3: Lazy Validation with `defineField`

Control when validation triggers:

```typescript
// Aggressive validation (default) - validates on every change
const [email, emailAttrs] = defineField('email');

// Lazy validation - validates on blur only
const [email, emailAttrs] = defineField('email', {
  validateOnModelUpdate: false, // Don't validate on input
});

// Custom validation trigger
const [email, emailAttrs] = defineField('email', {
  validateOnModelUpdate: true,
  validateOnBlur: true,
  validateOnChange: false,
});
```

### Pattern 4: Form Meta and State

Access aggregated form state:

```typescript
<script setup lang="ts">
import { useForm } from 'vee-validate';

const { handleSubmit, meta, isSubmitting, resetForm } = useForm({
  validationSchema: schema,
  initialValues: {
    email: '',
  },
});

// meta contains:
// - meta.value.valid: boolean - form is valid
// - meta.value.dirty: boolean - any field changed
// - meta.value.touched: boolean - any field touched
// - meta.value.pending: boolean - async validation in progress
// - meta.value.initialValues: object - initial form values
</script>

<template>
  <form @submit="handleSubmit(onSubmit)">
    <!-- ... fields ... -->

    <button
      type="submit"
      :disabled="!meta.valid || isSubmitting"
    >
      {{ isSubmitting ? 'Submitting...' : 'Submit' }}
    </button>

    <button type="button" @click="resetForm()">
      Reset
    </button>

    <p v-if="meta.dirty">You have unsaved changes</p>
  </form>
</template>
```

### Pattern 5: `defineField` vs `useField` - When to Use Each

| Feature | `defineField` | `useField` |
|---------|---------------|------------|
| **Use case** | Quick form setup with native inputs | Building reusable custom input components |
| **Form context** | Always requires form context | Optional form integration |
| **Best for** | Application-level forms | Component library development |

**Use `defineField` when:**

- Building forms directly in your application
- Working with native HTML inputs
- Need quick setup with minimal boilerplate

**Use `useField` when:**

- Building reusable input components
- Creating a UI component library
- Need standalone field validation

---

## Schema Validation Integration

### Zod Integration (Recommended)

```bash
# Install packages
npm install vee-validate zod @vee-validate/zod
```

```typescript
<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { z } from 'zod';

// Complex schema with refinements
const userSchema = toTypedSchema(
  z.object({
    email: z.string().email('Invalid email format'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain uppercase letter')
      .regex(/[0-9]/, 'Must contain number'),
    confirmPassword: z.string(),
    age: z.coerce.number().min(18, 'Must be 18 or older'),
  }).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
);

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: userSchema,
});

// Type inference works automatically
const [email] = defineField('email');
const [password] = defineField('password');
const [confirmPassword] = defineField('confirmPassword');
const [age] = defineField('age');
</script>
```

### Yup Integration

```bash
npm install vee-validate yup @vee-validate/yup
```

```typescript
<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/yup';
import * as yup from 'yup';

const schema = toTypedSchema(
  yup.object({
    email: yup.string().required('Email is required').email('Invalid email'),
    password: yup.string().required().min(8, 'Min 8 characters'),
    role: yup.string().oneOf(['admin', 'user'], 'Invalid role'),
  })
);

const { handleSubmit, defineField } = useForm({
  validationSchema: schema,
});
</script>
```

### Valibot Integration (Bundle Size Optimized)

```bash
npm install vee-validate valibot @vee-validate/valibot
```

```typescript
<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/valibot';
import * as v from 'valibot';

const schema = toTypedSchema(
  v.object({
    email: v.pipe(
      v.string(),
      v.nonEmpty('Email is required'),
      v.email('Invalid email')
    ),
    age: v.pipe(
      v.number(),
      v.minValue(18, 'Must be 18+')
    ),
  })
);

const { handleSubmit, defineField } = useForm({
  validationSchema: schema,
});
</script>
```

### Zod Known Issue: refine/superRefine with Missing Keys

**Problem:** Zod's `refine` and `superRefine` do not execute when object keys are missing - a common scenario in forms.

```typescript
// PROBLEMATIC: refine won't run if confirmPassword is undefined
const schema = z.object({
  password: z.string(),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
});

// SOLUTION: Provide default values or use superRefine with explicit checks
const { defineField } = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: {
    password: '',
    confirmPassword: '', // Ensure fields are initialized
  },
});
```

---

## Custom Input Components

### Building with `useField`

```typescript
<!-- components/text-input.vue -->
<script setup lang="ts">
import { useField } from 'vee-validate';
import { toRef } from 'vue';

interface Props {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
});

// CRITICAL: Use function or toRef to maintain reactivity
const { value, errorMessage, handleBlur, handleChange, meta } = useField<string>(
  () => props.name, // Function form maintains reactivity
  undefined,
  {
    validateOnValueUpdate: false, // Lazy validation
  }
);

// Alternative: toRef approach
// const nameRef = toRef(props, 'name');
// const { value, errorMessage } = useField<string>(nameRef);
</script>

<template>
  <div class="form-field">
    <label :for="name">{{ label }}</label>
    <input
      :id="name"
      :name="name"
      :type="type"
      :value="value"
      :placeholder="placeholder"
      :class="{ 'has-error': meta.touched && errorMessage }"
      @input="handleChange"
      @blur="handleBlur"
    />
    <span v-if="meta.touched && errorMessage" class="error">
      {{ errorMessage }}
    </span>
  </div>
</template>
```

### Custom Validation Trigger Strategy

Implement "eager validation" - lazy initially, then aggressive after error:

```typescript
<script setup lang="ts">
import { useField } from 'vee-validate';
import { computed } from 'vue';

const props = defineProps<{ name: string }>();

const { value, errorMessage, handleBlur, handleChange, meta } = useField<string>(
  () => props.name
);

// Validation listeners with eager strategy
const validationListeners = computed(() => ({
  blur: (evt: Event) => handleBlur(evt, true), // Always validate on blur
  change: handleChange,
  // Validate on input ONLY if there's already an error
  input: (evt: Event) => handleChange(evt, !!errorMessage.value),
}));
</script>

<template>
  <input
    :value="value"
    v-on="validationListeners"
  />
</template>
```

### v-model Synchronization

```typescript
<script setup lang="ts">
import { useField } from 'vee-validate';

const props = defineProps<{
  name: string;
  modelValue?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const { value, errorMessage } = useField<string>(
  () => props.name,
  undefined,
  {
    syncVModel: true, // Auto-sync with v-model
  }
);
</script>
```

---

## Field Arrays and Dynamic Forms

### Using `useFieldArray`

```typescript
<script setup lang="ts">
import { useForm, useFieldArray } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { z } from 'zod';

const schema = toTypedSchema(
  z.object({
    users: z.array(
      z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Invalid email'),
      })
    ).min(1, 'At least one user is required'),
  })
);

const { handleSubmit, defineField } = useForm({
  validationSchema: schema,
  initialValues: {
    users: [{ name: '', email: '' }], // Initialize with one empty user
  },
});

// useFieldArray provides array operations
const { fields, push, remove, swap, insert, update, replace } = useFieldArray<{
  name: string;
  email: string;
}>('users');

const addUser = () => {
  push({ name: '', email: '' });
};

const removeUser = (index: number) => {
  if (fields.value.length > 1) {
    remove(index);
  }
};
</script>

<template>
  <form @submit="handleSubmit(onSubmit)">
    <div v-for="(field, index) in fields" :key="field.key">
      <!-- CRITICAL: Use field.key as iteration key, NOT index -->
      <div class="user-row">
        <input
          v-model="field.value.name"
          :name="`users[${index}].name`"
          placeholder="Name"
        />
        <input
          v-model="field.value.email"
          :name="`users[${index}].email`"
          placeholder="Email"
        />
        <button type="button" @click="removeUser(index)">
          Remove
        </button>
      </div>
    </div>

    <button type="button" @click="addUser">Add User</button>
    <button type="submit">Submit</button>
  </form>
</template>
```

### Field Array Operations

```typescript
const { fields, push, prepend, insert, remove, swap, move, replace, update } = useFieldArray('items');

// Add items
push({ name: '' });           // Add to end
prepend({ name: '' });        // Add to start
insert(2, { name: '' });      // Insert at index 2

// Remove items
remove(0);                    // Remove first item

// Reorder items
swap(0, 1);                   // Swap items at indices 0 and 1
move(2, 0);                   // Move item from index 2 to index 0

// Replace/Update
replace([{ name: 'New' }]);   // Replace entire array
update(0, { name: 'Updated' }); // Update item at index 0
```

### Nested Objects with Dot Notation

```typescript
<script setup lang="ts">
import { useForm } from 'vee-validate';

const { defineField } = useForm({
  initialValues: {
    user: {
      profile: {
        firstName: '',
        lastName: '',
      },
      contacts: [
        { type: 'email', value: '' },
      ],
    },
  },
});

// Dot notation for nested objects
const [firstName] = defineField('user.profile.firstName');
const [lastName] = defineField('user.profile.lastName');

// Bracket notation for arrays
const [contactType] = defineField('user.contacts[0].type');
const [contactValue] = defineField('user.contacts[0].value');
</script>
```

---

## Multi-Step Wizard Forms

### FormWizard Pattern

```typescript
<!-- components/form-wizard.vue -->
<script setup lang="ts">
import { ref, provide, computed, type InjectionKey } from 'vue';
import { useForm } from 'vee-validate';

interface WizardContext {
  currentStep: Ref<number>;
  totalSteps: Ref<number>;
  nextStep: () => Promise<boolean>;
  prevStep: () => void;
  isFirstStep: ComputedRef<boolean>;
  isLastStep: ComputedRef<boolean>;
}

export const WizardKey: InjectionKey<WizardContext> = Symbol('wizard');

const props = defineProps<{
  validationSchema: unknown[];
}>();

const emit = defineEmits<{
  submit: [values: Record<string, unknown>];
}>();

const currentStep = ref(0);
const totalSteps = computed(() => props.validationSchema.length);

const currentSchema = computed(() => props.validationSchema[currentStep.value]);

const { handleSubmit, validate } = useForm({
  validationSchema: currentSchema,
  keepValuesOnUnmount: true, // Preserve values between steps
});

const nextStep = async () => {
  const { valid } = await validate();
  if (valid) {
    if (currentStep.value < totalSteps.value - 1) {
      currentStep.value++;
      return true;
    }
  }
  return false;
};

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--;
  }
};

const isFirstStep = computed(() => currentStep.value === 0);
const isLastStep = computed(() => currentStep.value === totalSteps.value - 1);

const onSubmit = handleSubmit((values) => {
  emit('submit', values);
});

provide(WizardKey, {
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  isFirstStep,
  isLastStep,
});
</script>

<template>
  <form @submit="onSubmit">
    <div class="wizard-progress">
      Step {{ currentStep + 1 }} of {{ totalSteps }}
    </div>

    <slot />

    <div class="wizard-actions">
      <button
        type="button"
        :disabled="isFirstStep"
        @click="prevStep"
      >
        Previous
      </button>

      <button
        v-if="!isLastStep"
        type="button"
        @click="nextStep"
      >
        Next
      </button>

      <button v-else type="submit">
        Submit
      </button>
    </div>
  </form>
</template>
```

### FormStep Component

```typescript
<!-- components/form-step.vue -->
<script setup lang="ts">
import { inject, computed } from 'vue';
import { WizardKey } from './form-wizard.vue';

const props = defineProps<{
  step: number;
}>();

const wizard = inject(WizardKey);

const isActive = computed(() => wizard?.currentStep.value === props.step);
</script>

<template>
  <div v-show="isActive" class="form-step">
    <slot />
  </div>
</template>
```

### Using the Wizard

```typescript
<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod';
import { z } from 'zod';
import FormWizard from './form-wizard.vue';
import FormStep from './form-step.vue';

// Define schema for each step
const step1Schema = toTypedSchema(
  z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
  })
);

const step2Schema = toTypedSchema(
  z.object({
    email: z.string().email(),
    phone: z.string().optional(),
  })
);

const step3Schema = toTypedSchema(
  z.object({
    password: z.string().min(8),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
  })
);

const schemas = [step1Schema, step2Schema, step3Schema];

const handleComplete = (values: Record<string, unknown>) => {
  console.log('Form completed:', values);
};
</script>

<template>
  <FormWizard :validation-schema="schemas" @submit="handleComplete">
    <FormStep :step="0">
      <h2>Personal Information</h2>
      <!-- Step 1 fields -->
    </FormStep>

    <FormStep :step="1">
      <h2>Contact Details</h2>
      <!-- Step 2 fields -->
    </FormStep>

    <FormStep :step="2">
      <h2>Create Password</h2>
      <!-- Step 3 fields -->
    </FormStep>
  </FormWizard>
</template>
```

---

## Error Handling and Display

### Pattern 1: Inline Errors with `useField`

```typescript
<script setup lang="ts">
import { useField } from 'vee-validate';

const { value, errorMessage, meta } = useField<string>('email');
</script>

<template>
  <div class="field">
    <input v-model="value" type="email" />
    <!-- Show error only after field is touched -->
    <span v-if="meta.touched && errorMessage" class="error">
      {{ errorMessage }}
    </span>
  </div>
</template>
```

### Pattern 2: ErrorMessage Component

```typescript
<script setup lang="ts">
import { Form, Field, ErrorMessage } from 'vee-validate';
</script>

<template>
  <Form :validation-schema="schema">
    <Field name="email" type="email" />
    <!-- Default: renders as span -->
    <ErrorMessage name="email" />

    <!-- Custom element -->
    <ErrorMessage name="email" as="p" class="error-text" />

    <!-- Scoped slot for custom rendering -->
    <ErrorMessage name="email" v-slot="{ message }">
      <div class="error-container">
        <icon name="warning" />
        <span>{{ message }}</span>
      </div>
    </ErrorMessage>
  </Form>
</template>
```

### Pattern 3: Aggregate Error Display

```typescript
<script setup lang="ts">
import { useForm } from 'vee-validate';

const { errors, handleSubmit } = useForm({
  validationSchema: schema,
});

// errors is reactive object: { fieldName: 'error message' }
</script>

<template>
  <form @submit="handleSubmit(onSubmit)">
    <!-- Show all errors at top -->
    <div v-if="Object.keys(errors).length" class="error-summary">
      <h3>Please fix the following errors:</h3>
      <ul>
        <li v-for="(error, field) in errors" :key="field">
          {{ field }}: {{ error }}
        </li>
      </ul>
    </div>

    <!-- Form fields... -->
  </form>
</template>
```

### Pattern 4: Multiple Errors per Field

```typescript
<script setup lang="ts">
import { useForm } from 'vee-validate';

const { errorBag } = useForm({
  validationSchema: schema,
});

// errorBag contains ALL errors per field (not just first)
// { email: ['Invalid format', 'Too short'] }
</script>

<template>
  <div class="field">
    <input v-model="email" />
    <ul v-if="errorBag.email?.length">
      <li v-for="error in errorBag.email" :key="error">
        {{ error }}
      </li>
    </ul>
  </div>
</template>
```

### Pattern 5: Server-Side Error Handling

```typescript
<script setup lang="ts">
import { useForm } from 'vee-validate';

const { handleSubmit, setErrors, setFieldError } = useForm({
  validationSchema: schema,
});

const onSubmit = handleSubmit(async (values) => {
  try {
    await api.submitForm(values);
  } catch (error) {
    if (error.response?.data?.errors) {
      // Set multiple field errors from API
      setErrors(error.response.data.errors);
      // { email: 'Email already exists', username: 'Username taken' }
    } else {
      // Set single field error
      setFieldError('apiError', 'Something went wrong');
    }
  }
});
</script>
```

---

## Internationalization (i18n)

### Setup

```bash
npm install @vee-validate/i18n @vee-validate/rules
```

### Basic i18n Configuration

```typescript
// plugins/vee-validate.ts
import { configure, defineRule } from 'vee-validate';
import { localize, setLocale } from '@vee-validate/i18n';
import { required, email, min, max } from '@vee-validate/rules';

// Import locale files
import en from '@vee-validate/i18n/dist/locale/en.json';
import fr from '@vee-validate/i18n/dist/locale/fr.json';
import de from '@vee-validate/i18n/dist/locale/de.json';

// Define rules globally
defineRule('required', required);
defineRule('email', email);
defineRule('min', min);
defineRule('max', max);

// Configure with multiple locales
configure({
  generateMessage: localize({
    en,
    fr,
    de,
  }),
});

// Set default locale
setLocale('en');
```

### Custom Messages

```typescript
configure({
  generateMessage: localize({
    en: {
      messages: {
        required: 'The {field} field is required',
        email: 'Please enter a valid email address',
        min: 'The {field} must be at least 0:{min} characters',
        max: 'The {field} must not exceed 0:{max} characters',
      },
      names: {
        email: 'Email Address',
        firstName: 'First Name',
        lastName: 'Last Name',
      },
      fields: {
        password: {
          min: 'Password is too short, minimum is 0:{min} characters',
        },
      },
    },
  }),
});
```

### Dynamic Locale Switching

```typescript
<script setup lang="ts">
import { setLocale } from '@vee-validate/i18n';

const changeLanguage = (locale: string) => {
  setLocale(locale);
  // Forms will re-validate with new messages
};
</script>

<template>
  <select @change="changeLanguage($event.target.value)">
    <option value="en">English</option>
    <option value="fr">Francais</option>
    <option value="de">Deutsch</option>
  </select>
</template>
```

### i18n with Schema Libraries (Zod/Yup)

**Note:** When using Zod or Yup, messages are defined in the schema, not via `@vee-validate/i18n`:

```typescript
import { z } from 'zod';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// Dynamic messages with vue-i18n
const schema = z.object({
  email: z.string()
    .min(1, t('validation.required', { field: t('fields.email') }))
    .email(t('validation.email')),
});
```

---

## Performance Optimization

### 1. Lazy Validation

Defer validation until user interaction:

```typescript
const [email, emailAttrs] = defineField('email', {
  validateOnModelUpdate: false, // Don't validate on every keystroke
  validateOnBlur: true,         // Validate on blur instead
});
```

### 2. Debounced Validation

For expensive validations (API checks):

```typescript
import { useDebounceFn } from '@vueuse/core';

const { validate } = useField('username');

const debouncedValidate = useDebounceFn(() => {
  validate();
}, 300); // 300ms delay
```

### 3. Conditional Validation

Skip validation for hidden/disabled fields:

```typescript
const schema = z.object({
  hasNewsletter: z.boolean(),
  email: z.string().optional(),
}).refine(
  (data) => !data.hasNewsletter || (data.email && data.email.length > 0),
  { path: ['email'], message: 'Email required for newsletter' }
);
```

### 4. Schema Memoization

Avoid recreating schemas on every render:

```typescript
// BAD: Schema recreated every render
const { handleSubmit } = useForm({
  validationSchema: toTypedSchema(z.object({ ... })), // New schema each time
});

// GOOD: Schema defined once
const schema = toTypedSchema(z.object({ ... }));

const { handleSubmit } = useForm({
  validationSchema: schema,
});
```

### 5. Form-Level vs Field-Level Validation

Form-level validation is more performant for related fields:

```typescript
// GOOD: Form-level validation - runs once
const schema = z.object({
  password: z.string(),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword);

// LESS OPTIMAL: Field-level validation - runs per field
const { value: password } = useField('password', (value) => {
  return confirmPassword.value === value || 'Passwords must match';
});
```

### 6. Preserve Values on Unmount

For dynamic forms/wizards:

```typescript
const { defineField } = useForm({
  keepValuesOnUnmount: true, // Don't lose values when fields unmount
});
```

---

## Testing Approaches

### Testing with Vitest and Vue Test Utils

```typescript
// user-form.test.ts
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import UserForm from './user-form.vue';
import waitForExpect from 'wait-for-expect';

describe('UserForm', () => {
  it('shows validation error for invalid email', async () => {
    const wrapper = mount(UserForm);

    // Find and interact with email input
    const emailInput = wrapper.find('input[name="email"]');
    await emailInput.setValue('invalid');
    await emailInput.trigger('blur');

    // Wait for async validation
    await flushPromises();

    // Use waitForExpect for batch validation
    await waitForExpect(() => {
      expect(wrapper.find('.error').text()).toContain('email');
    });
  });

  it('submits form with valid data', async () => {
    const onSubmit = vi.fn();
    const wrapper = mount(UserForm, {
      props: { onSubmit },
    });

    // Fill in valid data
    await wrapper.find('input[name="email"]').setValue('test@example.com');
    await wrapper.find('input[name="password"]').setValue('password123');

    // Submit form
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('disables submit button when form is invalid', async () => {
    const wrapper = mount(UserForm);

    const submitButton = wrapper.find('button[type="submit"]');
    expect(submitButton.attributes('disabled')).toBeDefined();

    // Fill valid data
    await wrapper.find('input[name="email"]').setValue('test@example.com');
    await wrapper.find('input[name="password"]').setValue('password123');
    await flushPromises();

    await waitForExpect(() => {
      expect(submitButton.attributes('disabled')).toBeUndefined();
    });
  });
});
```

### Testing Error Message Content

```typescript
// Flexible: check error exists
expect(wrapper.find('.error').exists()).toBe(true);

// Partial match: less fragile
expect(wrapper.find('.error').text()).toContain('required');

// Exact match (use sparingly)
expect(wrapper.find('.error').text()).toBe('Email is required');
```

### Mocking Form Context

```typescript
import { provide } from 'vue';
import { FormContextKey, FieldContextKey } from 'vee-validate';

const MockedForm = {
  values: { email: '' },
  errors: {},
  // ... other form context properties
};

const wrapper = mount(MyComponent, {
  global: {
    provide: {
      [FormContextKey]: MockedForm,
    },
  },
});
```

---

## Anti-Patterns to Avoid

### 1. Destructuring Props Directly in useField

```typescript
// BAD: Loses reactivity
const props = defineProps<{ name: string }>();
const { value } = useField(props.name); // Won't track name changes

// GOOD: Use function or toRef
const { value } = useField(() => props.name);
// OR
const { value } = useField(toRef(props, 'name'));
```

### 2. Multiple useForm Calls

```typescript
// BAD: Multiple form contexts
const form1 = useForm({ ... });
const form2 = useForm({ ... }); // Overwrites form1 context

// GOOD: One useForm per logical form
const { handleSubmit, defineField } = useForm({ ... });
```

### 3. Mixing Form-Level and Field-Level Validation

```typescript
// BAD: Duplicate/conflicting validation
const schema = z.object({ email: z.string().email() });
const { value } = useField('email', (v) => v.includes('@') || 'Invalid');

// GOOD: Choose one approach
// Either form-level schema OR field-level rules
```

### 4. Not Handling Async Validation Properly

```typescript
// BAD: No loading state for async validation
const onSubmit = handleSubmit(async (values) => {
  await api.submit(values);
});

// GOOD: Use isSubmitting and handle errors
const { handleSubmit, isSubmitting, setErrors } = useForm({ ... });

const onSubmit = handleSubmit(async (values) => {
  try {
    await api.submit(values);
  } catch (error) {
    setErrors({ apiError: error.message });
  }
});
```

### 5. Recreating Schemas in Setup

```typescript
// BAD: Schema recreated on every component instance
const { handleSubmit } = useForm({
  validationSchema: toTypedSchema(z.object({
    email: z.string().email(),
  })),
});

// GOOD: Define schema outside component or use computed for dynamic
const schema = toTypedSchema(z.object({
  email: z.string().email(),
}));

// In component
const { handleSubmit } = useForm({
  validationSchema: schema,
});
```

### 6. Using Index as Key in Field Arrays

```typescript
// BAD: Using index causes issues with reordering
<div v-for="(field, index) in fields" :key="index">

// GOOD: Use field.key provided by VeeValidate
<div v-for="field in fields" :key="field.key">
```

### 7. Not Initializing Field Array Values

```typescript
// BAD: Undefined array causes errors
const { fields } = useFieldArray('users'); // users undefined initially

// GOOD: Provide initial values
const { defineField } = useForm({
  initialValues: {
    users: [{ name: '', email: '' }],
  },
});
const { fields } = useFieldArray('users');
```

---

## Sources

### Official Documentation
- [VeeValidate Official Documentation](https://vee-validate.logaretm.com/v4/)
- [Composition API Getting Started](https://vee-validate.logaretm.com/v4/guide/composition-api/getting-started/)
- [Caveats and Best Practices](https://vee-validate.logaretm.com/v4/guide/composition-api/caveats/)
- [useForm API Reference](https://vee-validate.logaretm.com/v4/api/use-form/)
- [useField API Reference](https://vee-validate.logaretm.com/v4/api/use-field/)
- [useFieldArray API Reference](https://vee-validate.logaretm.com/v4/api/use-field-array/)
- [Nested Objects and Arrays](https://vee-validate.logaretm.com/v4/guide/composition-api/nested-objects-and-arrays/)
- [Multi-step Form Wizard Example](https://vee-validate.logaretm.com/v4/examples/multistep-form-wizard/)
- [Zod Schema Validation](https://vee-validate.logaretm.com/v4/integrations/zod-schema-validation/)
- [Localization (i18n)](https://vee-validate.logaretm.com/v4/guide/i18n/)
- [Testing Guide](https://vee-validate.logaretm.com/v4/guide/testing/)
- [Custom Inputs Guide](https://vee-validate.logaretm.com/v4/guide/composition-api/custom-inputs/)
- [ErrorMessage Component API](https://vee-validate.logaretm.com/v4/api/error-message/)

### NPM Packages
- [@vee-validate/zod](https://www.npmjs.com/package/@vee-validate/zod)
- [@vee-validate/yup](https://www.npmjs.com/package/@vee-validate/yup)
- [@vee-validate/i18n](https://www.npmjs.com/package/@vee-validate/i18n)

### GitHub
- [VeeValidate GitHub Repository](https://github.com/logaretm/vee-validate)

### Community Resources
- [Form Validation in Vue 3 Using Composition API, VeeValidate and Yup](https://medium.com/@rautbibek47/form-validation-in-vue-3-using-composition-api-veevalidate-and-yup-fad601221ac6)
- [Validate Forms using vee-validate with Vue3 Composition API](https://erdemgonul.medium.com/validate-forms-using-vee-validate-with-vue3-composition-api-33d7b49af807)
- [Vue 3 + VeeValidate Form Validation Example](https://jasonwatmore.com/post/2022/04/12/vue-3-veevalidate-form-validation-example-composition-api)
- [Reducing Validation Overhead - Advanced Form Validation](https://app.studyraid.com/en/read/12372/399461/reducing-validation-overhead)
- [Vue 3 Advanced Form Handling 2025](https://johal.in/vue-3-advanced-form-handling-implementing-veevalidate-yup-schema-validation-and-dynamic-forms-2025/)
