# @dnd-kit Reference

> Hook signatures, event types, strategy and algorithm tables, key bindings, applied ARIA. See [SKILL.md](SKILL.md) for decisions and red flags, [examples/](examples/) for code.

---

## Packages

| Package              | Depends on                   |
| -------------------- | ---------------------------- |
| `@dnd-kit/core`      | React 16.8+                  |
| `@dnd-kit/sortable`  | `@dnd-kit/core`, React 16.8+ |
| `@dnd-kit/utilities` | React 16.8+                  |
| `@dnd-kit/modifiers` | `@dnd-kit/core`, React 16.8+ |

---

## Core hooks

### useDraggable

```typescript
import { useDraggable } from "@dnd-kit/core";

const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging, over, node, active } =
  useDraggable({
    id: string | number,         // Unique among draggables
    data?: Record<string, any>,  // Metadata for event handlers
    disabled?: boolean,          // Disable without conditional hook
    attributes?: {
      role?: string,             // Default: "button"
      roleDescription?: string,  // Default: "draggable"
      tabIndex?: number,         // Default: 0
    },
  });
```

**Return values:**

| Property              | Type                                | Purpose                                   |
| --------------------- | ----------------------------------- | ----------------------------------------- |
| `attributes`          | `object`                            | ARIA attributes (role, tabIndex, aria-\*) |
| `listeners`           | `Record<string, Function>`          | Sensor event handlers                     |
| `setNodeRef`          | `(el: HTMLElement \| null) => void` | Ref for draggable DOM node                |
| `setActivatorNodeRef` | `(el: HTMLElement \| null) => void` | Ref for drag handle                       |
| `transform`           | `{x, y, scaleX, scaleY} \| null`    | Position delta                            |
| `isDragging`          | `boolean`                           | True during active drag                   |
| `over`                | `{id} \| null`                      | Current droppable target                  |

### useDroppable

```typescript
import { useDroppable } from "@dnd-kit/core";

const { setNodeRef, isOver, node, rect, over } = useDroppable({
  id: string | number,         // Unique among droppables
  data?: Record<string, any>,  // Metadata for event handlers
  disabled?: boolean,
});
```

### useSortable

```typescript
import { useSortable } from "@dnd-kit/sortable";

const {
  attributes, listeners, setNodeRef, setActivatorNodeRef,
  setDraggableNodeRef, setDroppableNodeRef,
  transform, transition, isDragging, isSorting, over,
} = useSortable({
  id: string | number,              // Must match SortableContext items entry
  data?: Record<string, any>,
  disabled?: boolean,
  transition?: {                     // Default: 250ms ease
    duration: number,
    easing: string,
  } | null,                          // null disables transitions
});
```

---

## DndContext props and event types

```typescript
interface DndContextProps {
  onDragStart?(event: DragStartEvent): void;
  onDragMove?(event: DragMoveEvent): void;
  onDragOver?(event: DragOverEvent): void;
  onDragEnd?(event: DragEndEvent): void;
  onDragCancel?(event: DragCancelEvent): void;
  collisionDetection?: CollisionDetection;
  sensors?: SensorDescriptor[];
  modifiers?: Modifier[];
  announcements?: Announcements;
  screenReaderInstructions?: { draggable: string };
}

// All events contain:
interface DragEvent {
  active: { id: UniqueIdentifier; data: DataRef; rect: ViewRect };
  over: { id: UniqueIdentifier; data: DataRef; rect: ViewRect } | null;
}
```

---

## CSS transform utilities

```typescript
import { CSS } from "@dnd-kit/utilities";

// Full transform (includes scaleX/scaleY)
CSS.Transform.toString(transform); // "translate3d(10px, 20px, 0) scaleX(1) scaleY(1)"

// Translation only (no scaling) -- use when you don't want scale distortion
CSS.Translate.toString(transform); // "translate3d(10px, 20px, 0)"
```

**Key distinction:** `CSS.Transform` applies `scaleX`/`scaleY` from the transform object, which stretches an item whose neighbours are a different size. `CSS.Translate` moves without scaling and is usually what a sortable list wants.

---

## Sorting strategies

| Strategy                        | Import from         | Virtualization | Best for               |
| ------------------------------- | ------------------- | -------------- | ---------------------- |
| `rectSortingStrategy`           | `@dnd-kit/sortable` | No             | Grids (default)        |
| `verticalListSortingStrategy`   | `@dnd-kit/sortable` | Yes            | Vertical lists         |
| `horizontalListSortingStrategy` | `@dnd-kit/sortable` | Yes            | Horizontal lists       |
| `rectSwappingStrategy`          | `@dnd-kit/sortable` | No             | Swap (trade positions) |

---

## Collision detection algorithms

| Algorithm          | Import from     | Mechanism                | Best for                        |
| ------------------ | --------------- | ------------------------ | ------------------------------- |
| `rectIntersection` | `@dnd-kit/core` | Bounding box overlap     | Default / general purpose       |
| `closestCenter`    | `@dnd-kit/core` | Nearest center-to-center | Sortable lists                  |
| `closestCorners`   | `@dnd-kit/core` | Nearest corners (all 4)  | Stacked containers (Kanban)     |
| `pointerWithin`    | `@dnd-kit/core` | Pointer inside bounds    | Precision targets (trash, bins) |

---

## Modifiers

| Modifier                            | Import from          | Effect                        |
| ----------------------------------- | -------------------- | ----------------------------- |
| `restrictToVerticalAxis`            | `@dnd-kit/modifiers` | Y-axis only movement          |
| `restrictToHorizontalAxis`          | `@dnd-kit/modifiers` | X-axis only movement          |
| `restrictToParentElement`           | `@dnd-kit/modifiers` | Constrain to parent bounds    |
| `restrictToWindowEdges`             | `@dnd-kit/modifiers` | Constrain to viewport         |
| `restrictToFirstScrollableAncestor` | `@dnd-kit/modifiers` | Constrain to scroll container |
| `snapCenterToCursor`                | `@dnd-kit/modifiers` | Snap element center to cursor |

---

## Default key bindings

| Action       | Key(s)         |
| ------------ | -------------- |
| Pick up item | Space or Enter |
| Move item    | Arrow keys     |
| Drop item    | Space or Enter |
| Cancel drag  | Escape         |

---

## ARIA attributes applied by useDraggable

| Attribute              | Default Value | Purpose                        |
| ---------------------- | ------------- | ------------------------------ |
| `role`                 | `"button"`    | Identifies as interactive      |
| `aria-roledescription` | `"draggable"` | Contextual role label          |
| `aria-describedby`     | Unique ID     | Links to keyboard instructions |
| `tabindex`             | `0`           | Enables keyboard focus         |
