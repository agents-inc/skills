# Pinia - Plugin Examples

> Extended examples for custom Pinia plugins. See [core.md](core.md) for core patterns.

**Prerequisites**: Understand Pattern 2 (Options Store), Pattern 3 (Setup Store) from core examples first.

---

## Logger Plugin

> **Note:** This pattern builds on [Pattern 2: Options Store Definition](core.md#pattern-2-options-store-definition).

### Good Example - Logger Plugin

```typescript
// plugins/pinia-logger.ts
import type { PiniaPluginContext } from 'pinia';

const LOG_PREFIX = '[Pinia]';

export function piniaLoggerPlugin({ store }: PiniaPluginContext): void {
  // Log state changes
  store.$subscribe((mutation, state) => {
    console.log(`${LOG_PREFIX} ${store.$id} state changed:`, {
      type: mutation.type,
      storeId: mutation.storeId,
      events: mutation.events,
      payload: mutation.payload,
    });
  });

  // Log actions
  store.$onAction(({ name, store: actionStore, args, after, onError }) => {
    const startTime = Date.now();

    console.log(`${LOG_PREFIX} ${actionStore.$id}.${name}() called with:`, args);

    after((result) => {
      const duration = Date.now() - startTime;
      console.log(
        `${LOG_PREFIX} ${actionStore.$id}.${name}() completed in ${duration}ms:`,
        result
      );
    });

    onError((error) => {
      const duration = Date.now() - startTime;
      console.error(
        `${LOG_PREFIX} ${actionStore.$id}.${name}() failed after ${duration}ms:`,
        error
      );
    });
  });
}

// Usage in main.ts
// pinia.use(piniaLoggerPlugin);
```

**Why good:** Named constant for log prefix, logs both state changes and actions, measures action duration, handles errors

---

## Reset Plugin for Setup Stores

### Good Example - Custom Reset for Setup Stores

```typescript
// plugins/pinia-reset.ts
import type { PiniaPluginContext } from 'pinia';
import { toRaw } from 'vue';

export function piniaResetPlugin({ store }: PiniaPluginContext): {
  $reset: () => void;
} {
  // Save initial state
  const initialState = JSON.parse(JSON.stringify(toRaw(store.$state)));

  return {
    $reset(): void {
      store.$patch(initialState);
    },
  };
}
```

**Why good:** Provides `$reset()` for setup stores (which don't have it built-in), uses `toRaw` to get non-reactive copy
