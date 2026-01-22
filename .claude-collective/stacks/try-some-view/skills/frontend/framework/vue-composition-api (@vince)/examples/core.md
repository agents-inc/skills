# Vue 3 Composition API - Core Examples

> Essential script setup patterns and template refs. See [SKILL.md](../SKILL.md) for concepts.

---

## Script Setup - Complete Component

### Good Example - Complete component with script setup

```vue
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import type { User } from "@/types";

// Props with TypeScript
const props = defineProps<{
  userId: string;
  showDetails?: boolean;
}>();

// Emits with typed payload
const emit = defineEmits<{
  select: [user: User];
  close: [];
}>();

// Reactive state
const user = ref<User | null>(null);
const isLoading = ref(false);
const error = ref<Error | null>(null);

// Named constants
const FETCH_TIMEOUT_MS = 5000;

// Computed
const displayName = computed(() => {
  if (!user.value) return "Loading...";
  return `${user.value.firstName} ${user.value.lastName}`;
});

// Methods
async function fetchUser() {
  isLoading.value = true;
  error.value = null;

  try {
    const response = await fetch(`/api/users/${props.userId}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    user.value = await response.json();
  } catch (e) {
    error.value = e instanceof Error ? e : new Error(String(e));
  } finally {
    isLoading.value = false;
  }
}

function handleSelect() {
  if (user.value) {
    emit("select", user.value);
  }
}

// Watch for userId changes
watch(
  () => props.userId,
  () => {
    fetchUser();
  },
  { immediate: true },
);

// Lifecycle
onMounted(() => {
  console.log("UserCard mounted");
});
</script>

<template>
  <div class="user-card" @click="handleSelect">
    <template v-if="isLoading">
      <span>Loading...</span>
    </template>
    <template v-else-if="error">
      <span class="error">{{ error.message }}</span>
    </template>
    <template v-else-if="user">
      <h3>{{ displayName }}</h3>
      <p v-if="props.showDetails">{{ user.email }}</p>
    </template>
  </div>
</template>
```

**Why good:** Type-safe props/emits, clear reactive state management, proper loading/error handling, watch with immediate for initial fetch, named constants for magic numbers

### Bad Example - Missing TypeScript and poor organization

```vue
<script setup>
import { ref } from "vue";

const props = defineProps(["userId"]); // No types
const emit = defineEmits(["select"]); // No payload types

const user = ref(null);

// Magic timeout number
setTimeout(() => {
  fetch(`/api/users/${props.userId}`)
    .then((r) => r.json())
    .then((data) => (user.value = data));
}, 5000);

function select() {
  // Generic name
  emit("select", user.value);
}
</script>

<template>
  <div @click="select">{{ user?.name }}</div>
</template>
```

**Why bad:** No TypeScript types lose compile-time safety, magic number 5000 is unmaintainable, generic function name 'select' doesn't describe the action, no loading/error handling, setTimeout without cleanup causes memory leak

---

## Template Refs - Focus Management

### Good Example - Focus management with refs

```vue
<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";

const inputRef = ref<HTMLInputElement | null>(null);
const isEditing = ref(false);

async function startEditing() {
  isEditing.value = true;
  // Wait for DOM update before focusing
  await nextTick();
  inputRef.value?.focus();
}

function stopEditing() {
  isEditing.value = false;
}

function selectAll() {
  inputRef.value?.select();
}

onMounted(() => {
  // Focus on mount if editing
  if (isEditing.value) {
    inputRef.value?.focus();
  }
});
</script>

<template>
  <div>
    <input
      v-if="isEditing"
      ref="inputRef"
      type="text"
      @blur="stopEditing"
      @keydown.enter="stopEditing"
    />
    <span v-else @click="startEditing"> Click to edit </span>
    <button @click="selectAll" :disabled="!isEditing">Select All</button>
  </div>
</template>
```

**Why good:** nextTick ensures DOM is updated before focus, optional chaining for null safety, clear focus management pattern, keyboard support

---

## See Also

- [reactivity.md](reactivity.md) - ref() vs reactive() patterns
- [composables.md](composables.md) - Creating reusable composables
- [define-expose.md](define-expose.md) - Component refs with defineExpose
