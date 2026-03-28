# Vuetify -- Data Tables

> v-data-table headers, custom column rendering, sorting, filtering, pagination, server-side data, and virtual scrolling. See [SKILL.md](../SKILL.md) for overview.

**Related examples:**

- [core.md](core.md) -- Plugin setup, theming, defaults
- [forms.md](forms.md) -- Input components, validation
- [layout.md](layout.md) -- Grid system, navigation

---

## Client-Side Data Table with Custom Columns

```vue
<script setup>
import { ref } from "vue";

const search = ref("");
const ITEMS_PER_PAGE = 10;

const headers = [
  { title: "Name", key: "name", align: "start" as const },
  { title: "Email", key: "email" },
  { title: "Status", key: "status" },
  { title: "Role", key: "role" },
  { title: "Actions", key: "actions", sortable: false, align: "center" as const },
];

interface User {
  id: number;
  name: string;
  email: string;
  status: "active" | "inactive";
  role: string;
}

const users = ref<User[]>([]);

function getStatusColor(status: string): string {
  return status === "active" ? "success" : "error";
}
</script>

<template>
  <v-data-table
    :headers="headers"
    :items="users"
    :search="search"
    :items-per-page="ITEMS_PER_PAGE"
    item-value="id"
  >
    <template v-slot:top>
      <v-toolbar flat>
        <v-toolbar-title>Users</v-toolbar-title>
        <v-spacer />
        <v-text-field
          v-model="search"
          label="Search"
          prepend-inner-icon="mdi-magnify"
          single-line
          hide-details
          density="compact"
          style="max-width: 300px"
        />
      </v-toolbar>
    </template>

    <template v-slot:item.status="{ item }">
      <v-chip :color="getStatusColor(item.status)" size="small" variant="tonal">
        {{ item.status }}
      </v-chip>
    </template>

    <template v-slot:item.actions="{ item }">
      <v-icon size="small" class="me-2" @click="editUser(item)"
        >mdi-pencil</v-icon
      >
      <v-icon size="small" color="error" @click="deleteUser(item)"
        >mdi-delete</v-icon
      >
    </template>

    <template v-slot:no-data>
      <v-alert type="info" variant="tonal" class="ma-2">
        No users found.
      </v-alert>
    </template>
  </v-data-table>
</template>
```

**Key points:**

- `headers` defined outside the template as a stable reference
- `v-slot:item.<key>` targets a specific column by its header `key`
- `v-slot:top` adds a toolbar with search above the table
- `v-slot:no-data` customizes the empty state
- `item-value` identifies the unique key for selection/expansion

---

## Header Configuration

```typescript
interface DataTableHeader {
  title: string; // Column display name
  key: string; // Property path on data item (supports dot notation)
  align?: "start" | "center" | "end";
  sortable?: boolean; // Default: true
  filterable?: boolean; // Included in search filter (default: true)
  width?: string | number;
  minWidth?: string;
  maxWidth?: string;
  fixed?: boolean; // Sticky column (horizontal scroll)
  value?: string | ((item: any) => string); // Custom value accessor
  sort?: (a: any, b: any) => number; // Custom sort function
}

// Dot notation for nested properties
const headers = [
  { title: "Full Name", key: "name.full" },
  { title: "City", key: "address.city" },
];

// Function-based value for computed columns
const headers = [
  {
    title: "Full Name",
    key: "fullName",
    value: (item: User) => `${item.firstName} ${item.lastName}`,
  },
];
```

---

## Server-Side Data Table

Use `v-data-table-server` when data is fetched from an API. Vuetify emits events for sort/filter/page changes -- you handle the API calls.

```vue
<script setup>
import { ref, watch } from "vue";

const ITEMS_PER_PAGE = 15;

const items = ref([]);
const totalItems = ref(0);
const loading = ref(false);
const page = ref(1);
const itemsPerPage = ref(ITEMS_PER_PAGE);
const sortBy = ref([{ key: "name", order: "asc" as const }]);

const headers = [
  { title: "Name", key: "name" },
  { title: "Email", key: "email" },
  { title: "Created", key: "createdAt" },
];

interface LoadOptions {
  page: number;
  itemsPerPage: number;
  sortBy: Array<{ key: string; order: string }>;
}

async function loadItems(options: LoadOptions) {
  loading.value = true;
  try {
    const response = await fetchFromApi({
      page: options.page,
      limit: options.itemsPerPage,
      sortBy: options.sortBy[0]?.key,
      sortOrder: options.sortBy[0]?.order,
    });
    items.value = response.data;
    totalItems.value = response.total;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <v-data-table-server
    v-model:items-per-page="itemsPerPage"
    v-model:page="page"
    v-model:sort-by="sortBy"
    :headers="headers"
    :items="items"
    :items-length="totalItems"
    :loading="loading"
    @update:options="loadItems"
  />
</template>
```

**Key points:**

- `v-data-table-server` -- a separate component, not a prop on `v-data-table`
- `:items-length` tells Vuetify the total count for pagination controls
- `@update:options` fires on mount, page change, sort change, and items-per-page change
- The options object includes `{ page, itemsPerPage, sortBy, groupBy, search }` -- destructure what you need
- `loading` prop shows a linear progress bar across the table header

---

## Row Selection

```vue
<script setup>
import { ref } from "vue";

const selected = ref<number[]>([]);

function deleteSelected() {
  // selected.value contains item-value keys (IDs)
}
</script>

<template>
  <v-data-table
    v-model="selected"
    :headers="headers"
    :items="items"
    item-value="id"
    show-select
    return-object
  >
    <template v-slot:top>
      <v-toolbar flat>
        <v-btn
          v-if="selected.length > 0"
          color="error"
          variant="tonal"
          @click="deleteSelected"
        >
          Delete {{ selected.length }} items
        </v-btn>
      </v-toolbar>
    </template>
  </v-data-table>
</template>
```

**Key points:**

- `show-select` adds checkboxes
- `v-model` binds to the selected items array
- Without `return-object`, the array contains `item-value` keys (IDs). With `return-object`, it contains full item objects.

---

## Expandable Rows

```vue
<template>
  <v-data-table :headers="headers" :items="items" show-expand item-value="id">
    <template v-slot:expanded-row="{ columns, item }">
      <tr>
        <td :colspan="columns.length">
          <v-card flat class="ma-2">
            <v-card-text>
              <p><strong>Description:</strong> {{ item.description }}</p>
              <p><strong>Notes:</strong> {{ item.notes }}</p>
            </v-card-text>
          </v-card>
        </td>
      </tr>
    </template>
  </v-data-table>
</template>
```

**Key points:**

- `show-expand` adds the expand toggle column
- `columns.length` in `colspan` ensures the expanded content spans the full table width
- The expanded row slot receives the full `item` object

---

## Virtual Data Table (Large Datasets)

For datasets with 1000+ rows where pagination is undesirable, use `v-data-table-virtual`. It renders only visible rows via virtualization.

```vue
<template>
  <v-data-table-virtual
    :headers="headers"
    :items="largeDataset"
    height="600"
    item-value="id"
  >
    <template v-slot:item="{ item, itemRef }">
      <tr :ref="itemRef">
        <td>{{ item.name }}</td>
        <td>{{ item.value }}</td>
      </tr>
    </template>
  </v-data-table-virtual>
</template>
```

**Key points:**

- `height` is required -- the virtual scroller needs a fixed container height
- When using the `#item` slot, you **must** bind `itemRef` to the `<tr>` element for correct scroll measurement
- Does not support pagination -- use `v-data-table-server` if you need paginated large datasets
- Supports sorting and filtering but not grouping

---

## Grouped Data

```vue
<script setup>
const headers = [
  { title: "Name", key: "name" },
  { title: "Category", key: "category" },
  { title: "Price", key: "price" },
];
</script>

<template>
  <v-data-table
    :headers="headers"
    :items="items"
    :group-by="[{ key: 'category', order: 'asc' }]"
  >
    <template v-slot:group-header="{ item, columns, toggleGroup, isGroupOpen }">
      <tr>
        <td :colspan="columns.length">
          <v-btn
            :icon="isGroupOpen(item) ? 'mdi-chevron-up' : 'mdi-chevron-down'"
            size="small"
            variant="text"
            @click="toggleGroup(item)"
          />
          {{ item.value }} ({{ item.items.length }} items)
        </td>
      </tr>
    </template>
  </v-data-table>
</template>
```

**Key points:**

- `group-by` accepts an array of `{ key, order }` objects
- `v-slot:group-header` provides `toggleGroup` and `isGroupOpen` for collapse/expand control
- `item.value` is the group key value, `item.items` contains the grouped rows
