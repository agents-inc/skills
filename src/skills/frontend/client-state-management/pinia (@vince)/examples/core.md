# Pinia - Code Examples

All code examples for Pinia state management patterns with good/bad comparisons.

**Extended Examples:**
- [Testing Examples](testing.md) - Unit and component testing patterns
- [Plugins](plugins.md) - Custom Pinia plugins
- [SSR](ssr.md) - Server-side rendering considerations
- [Persistence](persistence.md) - State persistence with pinia-plugin-persistedstate

---

## Pattern 1: Options Store

### Constants Example

```typescript
// stores/constants.ts
// All magic numbers extracted to named constants

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_CART_ITEMS = 100;
export const DEBOUNCE_DELAY_MS = 300;
export const DEFAULT_THEME = 'light' as const;
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
```

---

## Pattern 2: Options Store Definition

### Good Example - Complete Options Store

```typescript
// stores/counter-store.ts
import { defineStore } from 'pinia';

const INITIAL_COUNT = 0;
const DEFAULT_NAME = 'Counter';

interface CounterState {
  count: number;
  name: string;
}

export const useCounterStore = defineStore('counter', {
  state: (): CounterState => ({
    count: INITIAL_COUNT,
    name: DEFAULT_NAME,
  }),

  getters: {
    doubleCount: (state): number => state.count * 2,

    // Getter with parameters
    multiplyBy: (state) => {
      return (multiplier: number): number => state.count * multiplier;
    },
  },

  actions: {
    increment(): void {
      this.count++;
    },

    decrement(): void {
      this.count--;
    },

    setCount(value: number): void {
      this.count = value;
    },

    // Async action
    async fetchInitialCount(): Promise<void> {
      // Use your data fetching solution for actual API calls
      // This is just for demonstration
      await new Promise((resolve) => setTimeout(resolve, 100));
      this.count = INITIAL_COUNT;
    },
  },
});
```

**Why good:** Named constants for initial values, explicit TypeScript types, state function returns typed object, getters use state parameter for type inference, actions use `this` context, named export follows conventions

### Bad Example - Missing Types and Magic Numbers

```typescript
// Bad Example - Missing types and magic numbers
import { defineStore } from 'pinia';

export default defineStore('counter', {
  state: () => ({
    count: 0,  // Magic number
    name: 'Counter',
  }),

  getters: {
    doubleCount() {  // Missing state parameter type
      return this.count * 2;
    },
  },

  actions: {
    increment() {
      this.count++;
    },
  },
});
```

**Why bad:** Default export violates project conventions, magic numbers make values unclear, missing state parameter in getter loses type inference, no TypeScript interfaces

---

## Pattern 3: Setup Store Definition

### Good Example - Setup Store with Composables

```typescript
// stores/filters-store.ts
import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { useRoute, useRouter } from 'vue-router';

const DEFAULT_CATEGORY = '';
const DEFAULT_SORT = 'newest';
const MIN_PRICE = 0;
const MAX_PRICE = 10000;

export const useFiltersStore = defineStore('filters', () => {
  // Router composables - only available in Setup stores
  const route = useRoute();
  const router = useRouter();

  // State (ref)
  const category = ref(DEFAULT_CATEGORY);
  const sortBy = ref(DEFAULT_SORT);
  const priceRange = ref<[number, number]>([MIN_PRICE, MAX_PRICE]);
  const searchQuery = ref('');

  // Getters (computed)
  const hasActiveFilters = computed(() => {
    return (
      category.value !== DEFAULT_CATEGORY ||
      sortBy.value !== DEFAULT_SORT ||
      priceRange.value[0] !== MIN_PRICE ||
      priceRange.value[1] !== MAX_PRICE ||
      searchQuery.value !== ''
    );
  });

  const filterCount = computed(() => {
    let count = 0;
    if (category.value !== DEFAULT_CATEGORY) count++;
    if (sortBy.value !== DEFAULT_SORT) count++;
    if (priceRange.value[0] !== MIN_PRICE || priceRange.value[1] !== MAX_PRICE) count++;
    if (searchQuery.value !== '') count++;
    return count;
  });

  // Actions (functions)
  function setCategory(value: string): void {
    category.value = value;
    syncToUrl();
  }

  function setSortBy(value: string): void {
    sortBy.value = value;
    syncToUrl();
  }

  function resetFilters(): void {
    category.value = DEFAULT_CATEGORY;
    sortBy.value = DEFAULT_SORT;
    priceRange.value = [MIN_PRICE, MAX_PRICE];
    searchQuery.value = '';
    syncToUrl();
  }

  function syncToUrl(): void {
    const query: Record<string, string> = {};
    if (category.value) query.category = category.value;
    if (sortBy.value !== DEFAULT_SORT) query.sort = sortBy.value;
    router.push({ query });
  }

  function syncFromUrl(): void {
    category.value = (route.query.category as string) || DEFAULT_CATEGORY;
    sortBy.value = (route.query.sort as string) || DEFAULT_SORT;
  }

  // Watch route changes
  watch(
    () => route.query,
    () => syncFromUrl(),
    { immediate: true }
  );

  // CRITICAL: Return ALL state properties
  return {
    // State
    category,
    sortBy,
    priceRange,
    searchQuery,
    // Getters
    hasActiveFilters,
    filterCount,
    // Actions
    setCategory,
    setSortBy,
    resetFilters,
    syncToUrl,
    syncFromUrl,
  };
});
```

**Why good:** Uses router composables (only possible in Setup stores), named constants for defaults, watchers for URL sync, explicit return of ALL state properties, TypeScript types throughout

### Bad Example - Private State in Setup Store

```typescript
// Bad Example - Private state breaks SSR and DevTools
import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

export const useBrokenStore = defineStore('broken', () => {
  const count = ref(0);
  const privateValue = ref('secret');  // NOT RETURNED - breaks SSR!

  const doubled = computed(() => count.value * 2);

  function increment() {
    count.value++;
    privateValue.value = `updated-${count.value}`;  // Uses private state
  }

  // Missing privateValue in return - SSR hydration will fail!
  return {
    count,
    doubled,
    increment,
  };
});
```

**Why bad:** `privateValue` is not returned, causing SSR hydration mismatches, DevTools won't show the value, state won't be serialized properly

---

## Pattern 4: Accessing Store State

### Good Example - Using storeToRefs

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/user-store';

const userStore = useUserStore();

// State and getters - use storeToRefs to preserve reactivity
const { user, isLoggedIn, displayName } = storeToRefs(userStore);

// Actions - destructure directly (they don't need reactivity)
const { login, logout, updateProfile } = userStore;
</script>

<template>
  <div v-if="isLoggedIn">
    <p>Welcome, {{ displayName }}</p>
    <button @click="logout">Logout</button>
  </div>
  <div v-else>
    <button @click="login">Login</button>
  </div>
</template>
```

**Why good:** `storeToRefs` preserves reactivity for state/getters, actions destructured directly, template uses reactive values correctly

### Bad Example - Direct Destructuring

```vue
<script setup lang="ts">
import { useUserStore } from '@/stores/user-store';

const userStore = useUserStore();

// BAD: Direct destructuring loses reactivity!
const { user, isLoggedIn, login, logout } = userStore;

// isLoggedIn will NOT update when store changes!
</script>

<template>
  <!-- This will show stale data -->
  <div v-if="isLoggedIn">Welcome!</div>
</template>
```

**Why bad:** Direct destructuring breaks reactivity, `isLoggedIn` becomes a static snapshot, template won't update when store state changes

### Good Example - Direct Store Access Without Destructuring

```vue
<script setup lang="ts">
import { useUserStore } from '@/stores/user-store';

const userStore = useUserStore();

// Alternative: Access store directly without destructuring
// Reactivity preserved because we access through store object
</script>

<template>
  <div v-if="userStore.isLoggedIn">
    <p>Welcome, {{ userStore.displayName }}</p>
    <button @click="userStore.logout">Logout</button>
  </div>
</template>
```

**Why good:** Direct store access preserves reactivity without needing storeToRefs, works well for simpler components

---

## Pattern 5: Composing Stores

### Good Example - Store Using Another Store

```typescript
// stores/cart-store.ts
import { defineStore } from 'pinia';
import { useProductStore } from './product-store';
import { useUserStore } from './user-store';

const MAX_CART_ITEMS = 100;
const EMPTY_CART: CartItem[] = [];

interface CartItem {
  productId: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
}

export const useCartStore = defineStore('cart', {
  state: (): CartState => ({
    items: [...EMPTY_CART],
  }),

  getters: {
    // Use other stores in getters
    cartWithDetails(): Array<CartItem & { product: Product | undefined }> {
      const productStore = useProductStore();
      return this.items.map((item) => ({
        ...item,
        product: productStore.getProductById(item.productId),
      }));
    },

    cartTotal(): number {
      const productStore = useProductStore();
      return this.items.reduce((total, item) => {
        const product = productStore.getProductById(item.productId);
        return total + (product?.price ?? 0) * item.quantity;
      }, 0);
    },

    itemCount(): number {
      return this.items.reduce((count, item) => count + item.quantity, 0);
    },
  },

  actions: {
    addItem(productId: string, quantity: number = 1): void {
      if (this.itemCount >= MAX_CART_ITEMS) {
        throw new Error(`Cart cannot exceed ${MAX_CART_ITEMS} items`);
      }

      const existingItem = this.items.find((item) => item.productId === productId);

      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        this.items.push({ productId, quantity });
      }
    },

    removeItem(productId: string): void {
      const index = this.items.findIndex((item) => item.productId === productId);
      if (index > -1) {
        this.items.splice(index, 1);
      }
    },

    async checkout(): Promise<void> {
      const userStore = useUserStore();

      if (!userStore.isLoggedIn) {
        throw new Error('Must be logged in to checkout');
      }

      // Checkout logic here...
      // Use your data fetching solution for the API call

      this.items = [...EMPTY_CART];
    },
  },
});
```

**Why good:** Imports other stores at module level, uses them inside getters/actions, named constants for limits, explicit types, validates user state before checkout

### Bad Example - Circular Store Dependency

```typescript
// Bad Example - Circular dependency in getters
// stores/store-a.ts
export const useStoreA = defineStore('storeA', {
  getters: {
    combined() {
      const storeB = useStoreB();
      return this.value + storeB.computed;  // storeB.computed calls storeA!
    },
  },
});

// stores/store-b.ts
export const useStoreB = defineStore('storeB', {
  getters: {
    computed() {
      const storeA = useStoreA();
      return storeA.combined;  // INFINITE LOOP!
    },
  },
});
```

**Why bad:** Creates infinite loop through mutual getter dependencies, will crash the application
