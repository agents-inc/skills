# Svelte 5 Snippets Examples

> Complete code examples for Svelte 5 snippets (replacing slots). See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Children Snippet (Default Content)

Content placed between a component's tags automatically becomes the `children` snippet.

### Good Example — Component with Children

```svelte
<!-- panel.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    children: Snippet;
  }

  let { title, children }: Props = $props();
</script>

<div class="panel">
  <h3 class="panel-title">{title}</h3>
  <div class="panel-body">
    {@render children()}
  </div>
</div>
```

```svelte
<!-- usage -->
<Panel title="Settings">
  <p>Content between tags becomes the children snippet.</p>
  <button>Save</button>
</Panel>
```

**Why good:** `children` is implicit (no declaration needed in parent), type-safe with `Snippet`, rendered with `{@render}`

### Bad Example — Svelte 4 Slot Syntax

```svelte
<!-- BAD: Deprecated slot -->
<div class="panel">
  <slot /> <!-- Deprecated in Svelte 5 -->
</div>
```

**Why bad:** `<slot>` is deprecated in Svelte 5, no type safety, cannot parameterize content

---

## Pattern 2: Named Snippets as Props

Named snippets replace Svelte 4's named slots. Declare them inside the component tags or pass explicitly.

### Good Example — Table with Header and Row Snippets

```svelte
<!-- data-table.svelte -->
<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';

  interface Props {
    data: T[];
    header: Snippet;
    row: Snippet<[T, number]>;
    empty?: Snippet;
  }

  let { data, header, row, empty }: Props = $props();
</script>

<table>
  <thead>
    <tr>
      {@render header()}
    </tr>
  </thead>
  <tbody>
    {#if data.length === 0}
      {#if empty}
        <tr><td colspan="999">{@render empty()}</td></tr>
      {:else}
        <tr><td colspan="999">No data</td></tr>
      {/if}
    {:else}
      {#each data as item, index (index)}
        <tr>
          {@render row(item, index)}
        </tr>
      {/each}
    {/if}
  </tbody>
</table>
```

```svelte
<!-- usage -->
<script lang="ts">
  import DataTable from './data-table.svelte';

  interface User {
    name: string;
    email: string;
    role: string;
  }

  let users = $state<User[]>([
    { name: 'Alice', email: 'alice@example.com', role: 'Admin' },
    { name: 'Bob', email: 'bob@example.com', role: 'User' },
  ]);
</script>

<DataTable data={users}>
  {#snippet header()}
    <th>Name</th>
    <th>Email</th>
    <th>Role</th>
  {/snippet}

  {#snippet row(user, index)}
    <td>{user.name}</td>
    <td>{user.email}</td>
    <td>{user.role}</td>
  {/snippet}

  {#snippet empty()}
    <p>No users found.</p>
  {/snippet}
</DataTable>
```

**Why good:** Generic type `T` flows through to row snippet, typed parameters with `Snippet<[T, number]>`, optional empty snippet with fallback

---

## Pattern 3: Snippet Parameters

Snippets can accept parameters, enabling dynamic content rendering.

### Good Example — List with Render Snippet

```svelte
<!-- filterable-list.svelte -->
<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';

  interface Props {
    items: T[];
    filterFn?: (item: T, query: string) => boolean;
    renderItem: Snippet<[T]>;
    children?: Snippet;
  }

  let { items, filterFn, renderItem, children }: Props = $props();

  let query = $state('');

  let filtered = $derived(
    filterFn && query
      ? items.filter(item => filterFn(item, query))
      : items
  );
</script>

<div class="filterable-list">
  {#if children}
    {@render children()}
  {/if}

  <input bind:value={query} placeholder="Filter..." />

  <ul>
    {#each filtered as item}
      <li>{@render renderItem(item)}</li>
    {/each}
  </ul>
</div>
```

```svelte
<!-- usage -->
<FilterableList
  items={users}
  filterFn={(user, q) => user.name.toLowerCase().includes(q.toLowerCase())}
>
  <h2>Team Members</h2>

  {#snippet renderItem(user)}
    <strong>{user.name}</strong> — {user.email}
  {/snippet}
</FilterableList>
```

**Why good:** Generic type flows from items to renderItem snippet, filter function is optional, children snippet for header content

---

## Pattern 4: Optional Snippets

Snippets can be optional — check before rendering.

### Good Example — Card with Optional Sections

```svelte
<!-- card.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
    header?: Snippet;
    footer?: Snippet;
    actions?: Snippet;
  }

  let { children, header, footer, actions }: Props = $props();
</script>

<div class="card">
  {#if header}
    <div class="card-header">
      {@render header()}
    </div>
  {/if}

  <div class="card-body">
    {@render children()}
  </div>

  {#if actions || footer}
    <div class="card-footer">
      {#if actions}
        <div class="card-actions">
          {@render actions()}
        </div>
      {/if}
      {#if footer}
        {@render footer()}
      {/if}
    </div>
  {/if}
</div>
```

```svelte
<!-- minimal usage -->
<Card>
  <p>Just content, no header or footer.</p>
</Card>

<!-- full usage -->
<Card>
  {#snippet header()}
    <h3>Settings</h3>
  {/snippet}

  <form>
    <label>Name: <input name="name" /></label>
  </form>

  {#snippet actions()}
    <button>Cancel</button>
    <button>Save</button>
  {/snippet}
</Card>
```

**Why good:** All snippets except children are optional, conditional rendering avoids empty containers, flexible composition

---

## Pattern 5: Recursive Snippets

Snippets can reference themselves for recursive structures.

### Good Example — Tree View

```svelte
<!-- tree-view.svelte -->
<script lang="ts">
  interface TreeNode {
    label: string;
    children?: TreeNode[];
  }

  interface Props {
    nodes: TreeNode[];
  }

  let { nodes }: Props = $props();
</script>

{#snippet renderNode(node: TreeNode, depth: number)}
  <li style:padding-left="{depth * 16}px">
    <span>{node.label}</span>
    {#if node.children && node.children.length > 0}
      <ul>
        {#each node.children as child}
          {@render renderNode(child, depth + 1)}
        {/each}
      </ul>
    {/if}
  </li>
{/snippet}

<ul class="tree-view">
  {#each nodes as node}
    {@render renderNode(node, 0)}
  {/each}
</ul>
```

**Why good:** Snippet references itself for recursion, depth parameter controls indentation, typed parameters

---

_For event patterns, see [events.md](events.md). For advanced patterns, see [advanced.md](advanced.md)._
