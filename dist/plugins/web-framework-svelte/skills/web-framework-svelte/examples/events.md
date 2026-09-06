# Svelte 5 Event Handling Examples

> Complete code examples for Svelte 5 event patterns. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Element Event Attributes

Svelte 5 uses native event attributes (`onclick`, `oninput`, `onsubmit`) instead of Svelte 4's `on:click` directive.

### Good Example — Event Handlers

```svelte
<script lang="ts">
  let count = $state(0);
  let message = $state('');

  function handleClick(event: MouseEvent) {
    count += 1;
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    // Process form
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      // Handle enter
    }
  }
</script>

<!-- Named handler -->
<button onclick={handleClick}>
  Clicked {count} times
</button>

<!-- Inline handler (fine for simple logic) -->
<button onclick={() => count = 0}>
  Reset
</button>

<!-- Form with preventDefault -->
<form onsubmit={handleSubmit}>
  <input name="query" onkeydown={handleKeydown} />
  <button type="submit">Search</button>
</form>

<!-- Input binding (prefer bind: for two-way) -->
<input bind:value={message} />
```

**Why good:** Native event attributes, typed event parameters, explicit `preventDefault()` in handler (not via modifier)

### Bad Example — Svelte 4 Event Directive

```svelte
<!-- BAD: Svelte 4 syntax -->
<button on:click={handleClick}>Click</button>
<button on:click|preventDefault={handleSubmit}>Submit</button>
<button on:click|stopPropagation={handler}>Stop</button>
```

**Why bad:** `on:click` is Svelte 4 syntax — it still compiles, but it is deprecated. Modifiers belong to `on:` and do nothing on an event attribute, so `preventDefault` and `stopPropagation` move into the handler.

### Good Example — Replacing Event Modifiers

```svelte
<script lang="ts">
  function handleSubmit(event: SubmitEvent) {
    event.preventDefault(); // Replaces |preventDefault
    // form logic
  }

  function handleClick(event: MouseEvent) {
    event.stopPropagation(); // Replaces |stopPropagation
    // click logic
  }

  // Replaces |once — a wrapper that drops the handler after the first call
  function once(fn: (event: MouseEvent) => void) {
    let pending: ((event: MouseEvent) => void) | null = fn;
    return (event: MouseEvent) => {
      pending?.(event);
      pending = null;
    };
  }
</script>

<form onsubmit={handleSubmit}>
  <!-- ... -->
</form>

<div onclick={handleClick}>
  <!-- ... -->
</div>

<button onclick={once(handleClick)}>Runs once</button>
```

**Why good:** all the logic lives in one place and works through standard DOM APIs. `capture`, `passive` and `nonpassive` are the three that cannot be wrapped, because they apply when the listener is bound rather than when it fires — capture has its own attribute (`onclickcapture`), and the other two need an action.

---

## Pattern 2: Component Events via Callback Props

Svelte 5 replaces `createEventDispatcher` with callback props. Components accept `onsomething` callback props and call them directly.

### Good Example — Notification Component

```svelte
<!-- notification.svelte -->
<script lang="ts">
  interface Props {
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    ondismiss?: () => void;
    onaction?: (action: string) => void;
  }

  let {
    message,
    type = 'info',
    ondismiss,
    onaction,
  }: Props = $props();
</script>

<div class="notification notification-{type}" role="alert">
  <p>{message}</p>

  <div class="notification-actions">
    {#if onaction}
      <button onclick={() => onaction('retry')}>
        Retry
      </button>
    {/if}
    {#if ondismiss}
      <button onclick={ondismiss} aria-label="Dismiss">
        x
      </button>
    {/if}
  </div>
</div>
```

```svelte
<!-- usage -->
<script lang="ts">
  import Notification from './notification.svelte';

  let notifications = $state<Array<{ id: number; message: string; type: string }>>([]);
  let nextId = $state(1);

  function addNotification(message: string, type: string) {
    notifications.push({ id: nextId, message, type });
    nextId += 1;
  }

  function removeNotification(id: number) {
    const index = notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      notifications.splice(index, 1);
    }
  }
</script>

{#each notifications as notification (notification.id)}
  <Notification
    message={notification.message}
    type={notification.type}
    ondismiss={() => removeNotification(notification.id)}
    onaction={(action) => {
      if (action === 'retry') {
        // Retry logic
      }
    }}
  />
{/each}
```

**Why good:** Type-safe callback props with TypeScript, optional callbacks with conditional rendering, parent controls all behavior

### Bad Example — Svelte 4 Event Dispatcher

```svelte
<!-- BAD: Deprecated pattern -->
<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  function handleDismiss() {
    dispatch('dismiss'); // Deprecated in Svelte 5
  }

  function handleAction(action) {
    dispatch('action', { action }); // No type safety
  }
</script>
```

**Why bad:** `createEventDispatcher` is deprecated in Svelte 5, no type safety for event payloads, requires `on:eventname` syntax in parent

---

## Pattern 3: Forwarding Events

Since events are just props, forwarding is trivial — pass the callback through.

### Good Example — Wrapper Component

```svelte
<!-- icon-button.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    icon: string;
    children: Snippet;
  }

  let { icon, children, ...rest }: Props = $props();
</script>

<button class="icon-button" {...rest}>
  <span class="icon">{icon}</span>
  {@render children()}
</button>
```

```svelte
<!-- usage — onclick passes through via rest props -->
<IconButton icon="trash" onclick={() => deleteItem(item.id)}>
  Delete
</IconButton>

<IconButton icon="edit" onclick={() => editItem(item.id)} disabled={!canEdit}>
  Edit
</IconButton>
```

**Why good:** `...rest` forwards every event handler with no manual wiring, and extending `HTMLButtonAttributes` types the whole button surface

---

## Pattern 4: Window and Document Events

Use `<svelte:window>` and `<svelte:document>` for global event listeners.

### Good Example — Keyboard Shortcuts

```svelte
<script lang="ts">
  interface Props {
    onclose?: () => void;
  }

  let { onclose }: Props = $props();

  let isOpen = $state(false);

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen) {
      isOpen = false;
      onclose?.();
    }

    if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      isOpen = !isOpen;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div class="modal" role="dialog">
    <p>Command palette</p>
    <button onclick={() => { isOpen = false; onclose?.(); }}>
      Close
    </button>
  </div>
{/if}
```

**Why good:** `<svelte:window>` adds/removes listener automatically with component lifecycle, keyboard shortcuts centralized in one handler, optional callback for parent notification

---

## Pattern 5: Multiple Event Handlers

Spread props can apply multiple handlers, or use explicit multiple handlers.

### Good Example — Composing Behaviors

```svelte
<script lang="ts">
  let isHovered = $state(false);
  let isFocused = $state(false);
  let isActive = $derived(isHovered || isFocused);
</script>

<button
  onmouseenter={() => isHovered = true}
  onmouseleave={() => isHovered = false}
  onfocus={() => isFocused = true}
  onblur={() => isFocused = false}
  class={{ active: isActive }}
>
  Interactive Button
</button>
```

**Why good:** Derived state combines multiple interaction states, inline handlers for simple state toggles, accessible (handles both mouse and keyboard)

---

_For snippet patterns, see [snippets.md](snippets.md). For advanced patterns, see [advanced.md](advanced.md)._
