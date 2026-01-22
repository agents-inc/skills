# VeeValidate - Dynamic Arrays

> useFieldArray pattern for dynamic form fields. See [core.md](core.md) for basic form patterns.

**Prerequisites:** Understand Basic Forms and Schema Validation from [core.md](core.md) and [validation.md](validation.md) first.

---

## Pattern 1: Basic useFieldArray

### Good Example - Dynamic user list

```vue
<script setup lang="ts">
import { useForm, useFieldArray } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";

const MIN_USERS = 1;
const DEFAULT_USERS: User[] = [{ name: "", email: "" }];

interface User {
  name: string;
  email: string;
}

interface FormData {
  teamName: string;
  users: User[];
}

const schema = toTypedSchema(
  z.object({
    teamName: z.string().min(1, "Team name required"),
    users: z
      .array(
        z.object({
          name: z.string().min(1, "Name required"),
          email: z.string().email("Invalid email"),
        }),
      )
      .min(MIN_USERS, `At least ${MIN_USERS} user required`),
  }),
);

const { handleSubmit, errors, defineField } = useForm<FormData>({
  validationSchema: schema,
  // CRITICAL: Initialize array with at least one item
  initialValues: {
    teamName: "",
    users: DEFAULT_USERS,
  },
});

const [teamName] = defineField("teamName");

// useFieldArray provides array operations
const { fields, push, remove, swap, move } = useFieldArray<User>("users");

const addUser = () => {
  push({ name: "", email: "" });
};

const removeUser = (index: number) => {
  if (fields.value.length > MIN_USERS) {
    remove(index);
  }
};

const onSubmit = handleSubmit(async (values) => {
  await createTeam(values);
});
</script>

<template>
  <form @submit="onSubmit">
    <div>
      <label for="teamName">Team Name</label>
      <input id="teamName" v-model="teamName" />
      <span v-if="errors.teamName" role="alert">{{ errors.teamName }}</span>
    </div>

    <h3>Team Members</h3>

    <div v-for="(field, index) in fields" :key="field.key" class="user-row">
      <!-- CRITICAL: Use field.key as iteration key, NOT index -->
      <input
        v-model="field.value.name"
        :name="`users[${index}].name`"
        placeholder="Name"
        :aria-label="`User ${index + 1} name`"
      />
      <span v-if="errors[`users[${index}].name`]" role="alert">
        {{ errors[`users[${index}].name`] }}
      </span>

      <input
        v-model="field.value.email"
        :name="`users[${index}].email`"
        placeholder="Email"
        type="email"
        :aria-label="`User ${index + 1} email`"
      />
      <span v-if="errors[`users[${index}].email`]" role="alert">
        {{ errors[`users[${index}].email`] }}
      </span>

      <button
        type="button"
        :disabled="fields.length <= MIN_USERS"
        @click="removeUser(index)"
      >
        Remove
      </button>
    </div>

    <!-- Array-level errors -->
    <span v-if="errors.users" role="alert">{{ errors.users }}</span>

    <button type="button" @click="addUser">Add User</button>

    <button type="submit">Create Team</button>
  </form>
</template>
```

**Why good:** field.key ensures React-like correct reconciliation on add/remove, schema validates both individual items and array length, initialValues prevents undefined array errors, named constants for MIN_USERS and DEFAULT_USERS, error paths match nested structure `users[${index}].name`

### Bad Example - Using index as key

```vue
<script setup lang="ts">
import { useForm, useFieldArray } from "vee-validate";

const { defineField } = useForm({
  // WRONG: No initialValues for array
  initialValues: { users: undefined },
});

const { fields, remove } = useFieldArray("users");
</script>

<template>
  <div>
    <!-- WRONG: Using index as key! -->
    <div v-for="(field, index) in fields" :key="index">
      <input v-model="field.value.name" />
      <button @click="remove(index)">Remove</button>
    </div>
  </div>
</template>
```

**Why bad:** using index as key causes Vue to incorrectly match elements when items are removed, form state gets corrupted because Vue reuses wrong DOM nodes, undefined initialValues causes errors when accessing fields

---

## Pattern 2: Nested Field Arrays

Arrays within arrays.

```vue
<script setup lang="ts">
import { useForm, useFieldArray } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";

interface Contact {
  type: "email" | "phone";
  value: string;
}

interface Person {
  name: string;
  contacts: Contact[];
}

const DEFAULT_CONTACT: Contact = { type: "email", value: "" };
const DEFAULT_PERSON: Person = { name: "", contacts: [DEFAULT_CONTACT] };

const schema = toTypedSchema(
  z.object({
    people: z
      .array(
        z.object({
          name: z.string().min(1, "Name required"),
          contacts: z
            .array(
              z.object({
                type: z.enum(["email", "phone"]),
                value: z.string().min(1, "Value required"),
              }),
            )
            .min(1, "At least one contact"),
        }),
      )
      .min(1, "At least one person"),
  }),
);

const { handleSubmit, errors } = useForm({
  validationSchema: schema,
  initialValues: {
    people: [DEFAULT_PERSON],
  },
});

const {
  fields: people,
  push: addPerson,
  remove: removePerson,
} = useFieldArray<Person>("people");

const onSubmit = handleSubmit((values) => {
  console.log(values);
});
</script>

<template>
  <form @submit="onSubmit">
    <div
      v-for="(person, personIdx) in people"
      :key="person.key"
      class="person-card"
    >
      <input
        v-model="person.value.name"
        :name="`people[${personIdx}].name`"
        placeholder="Person name"
      />

      <!-- Nested contacts array -->
      <div
        v-for="(contact, contactIdx) in person.value.contacts"
        :key="`${person.key}-contact-${contactIdx}`"
        class="contact-row"
      >
        <select v-model="contact.type">
          <option value="email">Email</option>
          <option value="phone">Phone</option>
        </select>

        <input
          v-model="contact.value"
          :name="`people[${personIdx}].contacts[${contactIdx}].value`"
          :type="contact.type === 'email' ? 'email' : 'tel'"
        />

        <button
          type="button"
          :disabled="person.value.contacts.length <= 1"
          @click="person.value.contacts.splice(contactIdx, 1)"
        >
          Remove Contact
        </button>
      </div>

      <button
        type="button"
        @click="person.value.contacts.push({ ...DEFAULT_CONTACT })"
      >
        Add Contact
      </button>

      <button
        type="button"
        :disabled="people.length <= 1"
        @click="removePerson(personIdx)"
      >
        Remove Person
      </button>
    </div>

    <button
      type="button"
      @click="
        addPerson({ ...DEFAULT_PERSON, contacts: [{ ...DEFAULT_CONTACT }] })
      "
    >
      Add Person
    </button>

    <button type="submit">Submit</button>
  </form>
</template>
```

**Why good:** nested arrays handled with v-model directly on nested properties, unique keys combine parent key with child index, spread operator creates fresh objects for add operations preventing reference issues

---

## Pattern 3: Reorderable Field Array

Drag-and-drop style reordering.

```vue
<script setup lang="ts">
import { useForm, useFieldArray } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";

interface Task {
  title: string;
  priority: number;
}

const MIN_TASKS = 1;

const schema = toTypedSchema(
  z.object({
    tasks: z
      .array(
        z.object({
          title: z.string().min(1, "Title required"),
          priority: z.number().min(1).max(5),
        }),
      )
      .min(MIN_TASKS),
  }),
);

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: schema,
  initialValues: {
    tasks: [{ title: "", priority: 3 }],
  },
});

const { fields, push, remove, swap, move } = useFieldArray<Task>("tasks");

const moveUp = (index: number) => {
  if (index > 0) {
    swap(index, index - 1);
  }
};

const moveDown = (index: number) => {
  if (index < fields.value.length - 1) {
    swap(index, index + 1);
  }
};

const moveToPosition = (fromIndex: number, toIndex: number) => {
  move(fromIndex, toIndex);
};

const onSubmit = handleSubmit((values) => {
  console.log("Tasks in order:", values.tasks);
});
</script>

<template>
  <form @submit="onSubmit">
    <ol>
      <li v-for="(field, index) in fields" :key="field.key">
        <input
          v-model="field.value.title"
          :name="`tasks[${index}].title`"
          placeholder="Task title"
        />

        <select v-model.number="field.value.priority">
          <option v-for="n in 5" :key="n" :value="n">Priority {{ n }}</option>
        </select>

        <div class="reorder-controls">
          <button type="button" :disabled="index === 0" @click="moveUp(index)">
            <span aria-hidden="true">^</span>
            <span class="sr-only">Move up</span>
          </button>
          <button
            type="button"
            :disabled="index === fields.length - 1"
            @click="moveDown(index)"
          >
            <span aria-hidden="true">v</span>
            <span class="sr-only">Move down</span>
          </button>
        </div>

        <button
          type="button"
          :disabled="fields.length <= MIN_TASKS"
          @click="remove(index)"
        >
          Remove
        </button>
      </li>
    </ol>

    <button type="button" @click="push({ title: '', priority: 3 })">
      Add Task
    </button>

    <button type="submit">Save Tasks</button>
  </form>
</template>
```

**Why good:** swap() for adjacent moves is simpler than move(), move() for arbitrary position changes, v-model.number converts select to number, sr-only class for screen reader accessibility

---

## Pattern 4: Field Array with Validation Per Item

```vue
<script setup lang="ts">
import { useForm, useFieldArray, useField } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { z } from "zod";

const MIN_PRICE = 0;
const DEFAULT_PRICE = 0;
const DEFAULT_QUANTITY = 1;

interface LineItem {
  productId: string;
  quantity: number;
  price: number;
}

const schema = toTypedSchema(
  z.object({
    items: z
      .array(
        z.object({
          productId: z.string().min(1, "Select a product"),
          quantity: z.number().min(1, "At least 1"),
          price: z.number().min(MIN_PRICE, `Min ${MIN_PRICE}`),
        }),
      )
      .min(1, "Add at least one item"),
  }),
);

const { handleSubmit, errors, values } = useForm({
  validationSchema: schema,
  initialValues: {
    items: [
      { productId: "", quantity: DEFAULT_QUANTITY, price: DEFAULT_PRICE },
    ],
  },
});

const { fields, push, remove } = useFieldArray<LineItem>("items");

// Computed total with null safety
const total = computed(() => {
  return (
    values.items?.reduce((sum, item) => {
      return sum + (item.quantity || 0) * (item.price || 0);
    }, 0) ?? 0
  );
});

const onSubmit = handleSubmit((data) => {
  console.log("Order total:", total.value);
  console.log("Items:", data.items);
});
</script>

<template>
  <form @submit="onSubmit">
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Quantity</th>
          <th>Price</th>
          <th>Subtotal</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(field, index) in fields" :key="field.key">
          <td>
            <select v-model="field.value.productId">
              <option value="">Select product</option>
              <option value="prod-1">Product 1</option>
              <option value="prod-2">Product 2</option>
            </select>
            <div v-if="errors[`items[${index}].productId`]" class="error">
              {{ errors[`items[${index}].productId`] }}
            </div>
          </td>
          <td>
            <input
              v-model.number="field.value.quantity"
              type="number"
              min="1"
            />
            <div v-if="errors[`items[${index}].quantity`]" class="error">
              {{ errors[`items[${index}].quantity`] }}
            </div>
          </td>
          <td>
            <input
              v-model.number="field.value.price"
              type="number"
              step="0.01"
              :min="MIN_PRICE"
            />
            <div v-if="errors[`items[${index}].price`]" class="error">
              {{ errors[`items[${index}].price`] }}
            </div>
          </td>
          <td>
            ${{
              ((field.value.quantity || 0) * (field.value.price || 0)).toFixed(
                2,
              )
            }}
          </td>
          <td>
            <button
              type="button"
              :disabled="fields.length <= 1"
              @click="remove(index)"
            >
              Remove
            </button>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3">Total</td>
          <td>${{ total.toFixed(2) }}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>

    <!-- Array-level error -->
    <div v-if="errors.items" class="error" role="alert">
      {{ errors.items }}
    </div>

    <button
      type="button"
      @click="
        push({
          productId: '',
          quantity: DEFAULT_QUANTITY,
          price: DEFAULT_PRICE,
        })
      "
    >
      Add Item
    </button>

    <button type="submit">Place Order</button>
  </form>
</template>
```

**Why good:** individual field errors accessed via bracket notation `errors[\`items[${index}].field\`]`, array-level errors at `errors.items`, computed total reacts to value changes, v-model.number converts string inputs to numbers

---

## useFieldArray Methods Reference

| Method               | Description                    | Example                      |
| -------------------- | ------------------------------ | ---------------------------- |
| `push(obj)`          | Add to end                     | `push({ name: '' })`         |
| `prepend(obj)`       | Add to start                   | `prepend({ name: '' })`      |
| `insert(index, obj)` | Add at index                   | `insert(1, { name: '' })`    |
| `remove(index)`      | Remove at index                | `remove(2)`                  |
| `swap(from, to)`     | Swap positions                 | `swap(0, 1)`                 |
| `move(from, to)`     | Move to position               | `move(2, 0)`                 |
| `replace(arr)`       | Replace entire array           | `replace([{ name: '' }])`    |
| `update(index, obj)` | Replace at index (non-merging) | `update(0, { name: 'new' })` |

### Field Entry Properties

Each entry in `fields` array contains:

| Property  | Type               | Description                                       |
| --------- | ------------------ | ------------------------------------------------- |
| `key`     | `string \| number` | Stable identifier for v-for :key (auto-generated) |
| `value`   | `T`                | The actual field data object                      |
| `isFirst` | `boolean`          | True if this is the first item in array           |
| `isLast`  | `boolean`          | True if this is the last item in array            |

**Note:** `update()` does NOT merge objects - it completely replaces the value at the given index.

---
