# NgRx SignalStore - Entity Examples

Entity management examples using withEntities for collections with CRUD operations.

**Prerequisites:** Understand [core.md](core.md) (signalStore basics) first.

**Related examples:**
- [effects.md](effects.md) - rxMethod, side effects
- [features.md](features.md) - signalStoreFeature, custom features
- [testing.md](testing.md) - Unit tests, mocking strategies

---

## Pattern 1: Basic Entity Store

### Good Example - withEntities for Todo Collection

```typescript
// stores/todo.store.ts
import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import {
  withEntities,
  setAllEntities,
  addEntity,
  updateEntity,
  removeEntity,
  setEntity,
} from '@ngrx/signals/entities';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
}

interface TodoMeta {
  filter: 'all' | 'active' | 'completed';
  isLoading: boolean;
}

export const TodoStore = signalStore(
  { providedIn: 'root' },
  // withEntities creates: ids, entityMap, entities (signal array)
  withEntities<Todo>(),
  // Additional state alongside entities
  withState<TodoMeta>({
    filter: 'all',
    isLoading: false,
  }),
  withComputed(({ entities, filter }) => ({
    filteredTodos: computed(() => {
      const todos = entities();
      const currentFilter = filter();

      switch (currentFilter) {
        case 'active':
          return todos.filter((t) => !t.completed);
        case 'completed':
          return todos.filter((t) => t.completed);
        default:
          return todos;
      }
    }),
    completedCount: computed(() =>
      entities().filter((t) => t.completed).length
    ),
    activeCount: computed(() =>
      entities().filter((t) => !t.completed).length
    ),
    totalCount: computed(() => entities().length),
  })),
  withMethods((store) => ({
    // Set all entities (replace entire collection)
    setTodos(todos: Todo[]) {
      patchState(store, setAllEntities(todos));
    },

    // Add single entity
    addTodo(title: string, priority: Todo['priority'] = 'medium') {
      const newTodo: Todo = {
        id: crypto.randomUUID(),
        title,
        completed: false,
        priority,
        createdAt: new Date(),
      };
      patchState(store, addEntity(newTodo));
    },

    // Update single entity
    toggleTodo(id: string) {
      patchState(
        store,
        updateEntity({
          id,
          changes: (todo) => ({ completed: !todo.completed }),
        })
      );
    },

    // Update with partial object
    updateTodoPriority(id: string, priority: Todo['priority']) {
      patchState(
        store,
        updateEntity({ id, changes: { priority } })
      );
    },

    // Remove entity
    removeTodo(id: string) {
      patchState(store, removeEntity(id));
    },

    // Upsert - add or update
    upsertTodo(todo: Todo) {
      patchState(store, setEntity(todo));
    },

    // Set filter
    setFilter(filter: TodoMeta['filter']) {
      patchState(store, { filter });
    },

    // Clear completed
    clearCompleted() {
      const completedIds = store
        .entities()
        .filter((t) => t.completed)
        .map((t) => t.id);

      completedIds.forEach((id) => {
        patchState(store, removeEntity(id));
      });
    },
  }))
);
```

**Why good:** withEntities provides normalized state, entity updaters (setAllEntities, addEntity, etc.), computed for filtered views, additional state with withState, type-safe entity operations

### Bad Example - Array Instead of withEntities

```typescript
// WRONG - Using array for entities
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export const TodoStore = signalStore(
  // WRONG: Array in state - should use withEntities
  withState({
    todos: [] as Todo[],
    filter: 'all' as 'all' | 'active' | 'completed',
  }),
  withMethods((store) => ({
    // WRONG: O(n) lookups, manual spread operators
    toggleTodo(id: string) {
      patchState(store, (state) => ({
        todos: state.todos.map((t) =>
          t.id === id ? { ...t, completed: !t.completed } : t
        ),
      }));
    },

    removeTodo(id: string) {
      // WRONG: Filter creates new array every time
      patchState(store, (state) => ({
        todos: state.todos.filter((t) => t.id !== id),
      }));
    },
  }))
);
```

**Why bad:** No normalized state structure (no entityMap), O(n) lookups for updates, manual immutable operations, loses withEntities benefits like selectId

---

## Pattern 2: Named Entity Collections

### Good Example - Multiple Collections with Named Entities

```typescript
// stores/project.store.ts
import { computed } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
  type,
} from '@ngrx/signals';
import {
  withEntities,
  setAllEntities,
  addEntity,
  updateEntity,
  removeEntity,
} from '@ngrx/signals/entities';

interface Task {
  id: string;
  title: string;
  projectId: string;
  status: 'todo' | 'in-progress' | 'done';
}

interface Project {
  id: string;
  name: string;
  color: string;
}

export const ProjectStore = signalStore(
  { providedIn: 'root' },
  // Multiple named collections using 'collection' option
  withEntities({ entity: type<Project>(), collection: 'project' }),
  withEntities({ entity: type<Task>(), collection: 'task' }),
  withState({
    selectedProjectId: null as string | null,
    isLoading: false,
  }),
  withComputed((store) => ({
    // Named collections create prefixed signals
    // projectEntities, projectIds, projectEntityMap
    // taskEntities, taskIds, taskEntityMap
    selectedProject: computed(() => {
      const id = store.selectedProjectId();
      return id ? store.projectEntityMap()[id] ?? null : null;
    }),
    tasksForSelectedProject: computed(() => {
      const projectId = store.selectedProjectId();
      if (!projectId) return [];
      return store.taskEntities().filter((t) => t.projectId === projectId);
    }),
    taskCountByProject: computed(() => {
      const counts = new Map<string, number>();
      store.taskEntities().forEach((task) => {
        const current = counts.get(task.projectId) ?? 0;
        counts.set(task.projectId, current + 1);
      });
      return counts;
    }),
  })),
  withMethods((store) => ({
    // Project operations - use { collection: 'project' }
    setProjects(projects: Project[]) {
      patchState(store, setAllEntities(projects, { collection: 'project' }));
    },

    addProject(name: string, color: string) {
      const project: Project = {
        id: crypto.randomUUID(),
        name,
        color,
      };
      patchState(store, addEntity(project, { collection: 'project' }));
    },

    removeProject(id: string) {
      // Remove project and all its tasks
      const tasksToRemove = store
        .taskEntities()
        .filter((t) => t.projectId === id)
        .map((t) => t.id);

      tasksToRemove.forEach((taskId) => {
        patchState(store, removeEntity(taskId, { collection: 'task' }));
      });
      patchState(store, removeEntity(id, { collection: 'project' }));
    },

    // Task operations - use { collection: 'task' }
    setTasks(tasks: Task[]) {
      patchState(store, setAllEntities(tasks, { collection: 'task' }));
    },

    addTask(projectId: string, title: string) {
      const task: Task = {
        id: crypto.randomUUID(),
        title,
        projectId,
        status: 'todo',
      };
      patchState(store, addEntity(task, { collection: 'task' }));
    },

    updateTaskStatus(id: string, status: Task['status']) {
      patchState(
        store,
        updateEntity({ id, changes: { status } }, { collection: 'task' })
      );
    },

    selectProject(projectId: string | null) {
      patchState(store, { selectedProjectId: projectId });
    },
  }))
);
```

**Why good:** Multiple entity collections in one store, named collections with `collection` option, computed signals for cross-collection queries, cascade delete pattern

---

## Pattern 3: Custom Entity ID

### Good Example - entityConfig for Non-Standard IDs (v18+)

```typescript
// stores/user.store.ts
import { computed } from '@angular/core';
import {
  signalStore,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import {
  withEntities,
  setAllEntities,
  updateEntity,
  entityConfig,
} from '@ngrx/signals/entities';

interface User {
  odataId: string; // Non-standard ID field
  email: string;
  displayName: string;
  isActive: boolean;
}

// entityConfig for custom ID selector (v18+)
const userConfig = entityConfig({
  entity: {} as User,
  selectId: (user) => user.odataId, // Custom ID selector
});

export const UserStore = signalStore(
  { providedIn: 'root' },
  withEntities(userConfig),
  withComputed(({ entities }) => ({
    activeUsers: computed(() => entities().filter((u) => u.isActive)),
    inactiveUsers: computed(() => entities().filter((u) => !u.isActive)),
    userCount: computed(() => entities().length),
  })),
  withMethods((store) => ({
    setUsers(users: User[]) {
      patchState(store, setAllEntities(users, userConfig));
    },

    toggleUserActive(odataId: string) {
      patchState(
        store,
        updateEntity(
          {
            id: odataId, // Uses custom ID
            changes: (user) => ({ isActive: !user.isActive }),
          },
          userConfig
        )
      );
    },

    updateUserEmail(odataId: string, email: string) {
      patchState(
        store,
        updateEntity({ id: odataId, changes: { email } }, userConfig)
      );
    },
  }))
);
```

**Why good:** entityConfig for custom ID field, selectId function extracts non-standard ID, consistent config passed to all entity operations

---

## Pattern 4: Entity with Sorting

### Good Example - Sorted Entity Collection

```typescript
// stores/notification.store.ts
import { computed } from '@angular/core';
import {
  signalStore,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import {
  withEntities,
  addEntity,
  removeEntity,
  updateAllEntities,
} from '@ngrx/signals/entities';

const MAX_NOTIFICATIONS = 100;

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
}

export const NotificationStore = signalStore(
  { providedIn: 'root' },
  withEntities<Notification>(),
  withComputed(({ entities }) => ({
    // Sort in computed for consistent order
    sortedNotifications: computed(() =>
      [...entities()].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      )
    ),
    unreadCount: computed(() =>
      entities().filter((n) => !n.read).length
    ),
    hasUnread: computed(() =>
      entities().some((n) => !n.read)
    ),
    errorNotifications: computed(() =>
      entities().filter((n) => n.type === 'error' && !n.read)
    ),
  })),
  withMethods((store) => ({
    addNotification(message: string, type: Notification['type'] = 'info') {
      const notification: Notification = {
        id: crypto.randomUUID(),
        message,
        type,
        timestamp: new Date(),
        read: false,
      };

      patchState(store, addEntity(notification));

      // Trim old notifications if over limit
      const allNotifications = store.entities();
      if (allNotifications.length > MAX_NOTIFICATIONS) {
        const sorted = [...allNotifications].sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );
        const toRemove = sorted.slice(0, allNotifications.length - MAX_NOTIFICATIONS);
        toRemove.forEach((n) => {
          patchState(store, removeEntity(n.id));
        });
      }
    },

    markAsRead(id: string) {
      patchState(
        store,
        updateEntity({ id, changes: { read: true } })
      );
    },

    markAllAsRead() {
      patchState(
        store,
        updateAllEntities({ read: true })
      );
    },

    removeNotification(id: string) {
      patchState(store, removeEntity(id));
    },

    clearAll() {
      const ids = store.ids();
      ids.forEach((id) => {
        patchState(store, removeEntity(id));
      });
    },
  }))
);
```

**Why good:** Sorting in computed (not stored), MAX_NOTIFICATIONS named constant, updateAllEntities for batch updates, efficient entity operations

---

## Pattern 5: Bulk Entity Operations

### Good Example - addEntities, updateEntities, removeEntities

```typescript
// stores/inventory.store.ts
import { computed } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import {
  withEntities,
  setAllEntities,
  addEntities,
  updateEntities,
  removeEntities,
  setEntities,
} from '@ngrx/signals/entities';

const LOW_STOCK_THRESHOLD = 10;

interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  category: string;
}

export const InventoryStore = signalStore(
  { providedIn: 'root' },
  withEntities<Product>(),
  withState({
    selectedCategory: null as string | null,
    isLoading: false,
  }),
  withComputed(({ entities, selectedCategory }) => ({
    lowStockProducts: computed(() =>
      entities().filter((p) => p.quantity < LOW_STOCK_THRESHOLD)
    ),
    productsByCategory: computed(() => {
      const category = selectedCategory();
      if (!category) return entities();
      return entities().filter((p) => p.category === category);
    }),
    totalInventoryValue: computed(() =>
      entities().reduce((sum, p) => sum + p.quantity * p.price, 0)
    ),
    categories: computed(() => [
      ...new Set(entities().map((p) => p.category)),
    ]),
  })),
  withMethods((store) => ({
    // Bulk set (replace all)
    setProducts(products: Product[]) {
      patchState(store, setAllEntities(products));
    },

    // Bulk add
    addProducts(products: Product[]) {
      patchState(store, addEntities(products));
    },

    // Bulk upsert
    upsertProducts(products: Product[]) {
      patchState(store, setEntities(products));
    },

    // Bulk update by predicate
    markLowStockProducts() {
      const lowStockIds = store
        .entities()
        .filter((p) => p.quantity < LOW_STOCK_THRESHOLD)
        .map((p) => p.id);

      // Update specific entities
      patchState(
        store,
        updateEntities({
          ids: lowStockIds,
          changes: { category: 'low-stock' },
        })
      );
    },

    // Update all entities matching predicate
    applyDiscount(category: string, discountPercent: number) {
      const discountMultiplier = 1 - discountPercent / 100;
      const idsInCategory = store
        .entities()
        .filter((p) => p.category === category)
        .map((p) => p.id);

      idsInCategory.forEach((id) => {
        patchState(
          store,
          updateEntity({
            id,
            changes: (product) => ({
              price: Math.round(product.price * discountMultiplier * 100) / 100,
            }),
          })
        );
      });
    },

    // Bulk remove
    removeProducts(ids: string[]) {
      patchState(store, removeEntities(ids));
    },

    // Remove by predicate
    removeOutOfStock() {
      const outOfStockIds = store
        .entities()
        .filter((p) => p.quantity === 0)
        .map((p) => p.id);

      patchState(store, removeEntities(outOfStockIds));
    },

    setSelectedCategory(category: string | null) {
      patchState(store, { selectedCategory: category });
    },
  }))
);
```

**Why good:** Bulk operations (addEntities, updateEntities, removeEntities), computed for filtering, predicate-based updates, named constant for threshold

---

## Pattern 6: prependEntity and upsertEntity (v20+)

### Good Example - New Entity Operations

```typescript
// stores/activity-feed.store.ts
import { computed } from '@angular/core';
import {
  signalStore,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import {
  withEntities,
  prependEntity,
  upsertEntity,
  setAllEntities,
} from '@ngrx/signals/entities';

const MAX_FEED_ITEMS = 50;

interface ActivityItem {
  id: string;
  type: 'message' | 'notification' | 'update';
  content: string;
  timestamp: Date;
  read: boolean;
}

export const ActivityFeedStore = signalStore(
  { providedIn: 'root' },
  withEntities<ActivityItem>(),
  withComputed(({ entities }) => ({
    unreadCount: computed(() => entities().filter((a) => !a.read).length),
    recentItems: computed(() => entities().slice(0, 10)),
  })),
  withMethods((store) => ({
    // prependEntity adds to START of collection (v20+)
    // Useful for feeds, logs, chat where newest items appear first
    addNewActivity(type: ActivityItem['type'], content: string) {
      const item: ActivityItem = {
        id: crypto.randomUUID(),
        type,
        content,
        timestamp: new Date(),
        read: false,
      };
      // Item appears at the beginning of entities()
      patchState(store, prependEntity(item));

      // Trim old items if over limit
      const allItems = store.entities();
      if (allItems.length > MAX_FEED_ITEMS) {
        const trimmed = allItems.slice(0, MAX_FEED_ITEMS);
        patchState(store, setAllEntities(trimmed));
      }
    },

    // upsertEntity merges if exists, adds if not (v20+)
    // Only updates provided properties - efficient for partial updates
    updateOrAddActivity(item: Partial<ActivityItem> & { id: string }) {
      // If entity with id exists: merges provided props
      // If not exists: adds as new entity
      patchState(store, upsertEntity(item));
    },

    // Practical use case: mark as read with upsert
    markAsRead(id: string) {
      // Only updates `read` property, preserves everything else
      patchState(store, upsertEntity({ id, read: true }));
    },

    // Batch upsert for sync scenarios
    syncActivities(activities: ActivityItem[]) {
      activities.forEach((activity) => {
        patchState(store, upsertEntity(activity));
      });
    },
  }))
);
```

**Why good:** `prependEntity` adds to start (ideal for feeds/logs), `upsertEntity` handles add-or-update logic automatically, partial updates preserve existing data, MAX_FEED_ITEMS named constant
