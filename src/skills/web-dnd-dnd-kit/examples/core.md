# @dnd-kit - Core Examples

> Core drag-and-drop patterns for @dnd-kit. See [SKILL.md](../SKILL.md) for concepts and decision frameworks, [advanced.md](advanced.md) for multi-container and DragOverlay patterns, [reference.md](../reference.md) for API quick reference.

---

## Pattern 1: Basic Drag and Drop

### useDraggable Component

```tsx
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

interface DraggableProps {
  id: string;
  children: React.ReactNode;
}

export function Draggable({ id, children }: DraggableProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}
```

**Why good:** `attributes` provides ARIA roles (`role="button"`, `aria-roledescription="draggable"`), `listeners` attaches sensor event handlers, `CSS.Transform.toString` handles null safely, opacity feedback signals drag state

### useDroppable Component

```tsx
import { useDroppable } from "@dnd-kit/core";

interface DroppableProps {
  id: string;
  children: React.ReactNode;
}

export function Droppable({ id, children }: DroppableProps) {
  const { isOver, setNodeRef } = useDroppable({ id });

  const style: React.CSSProperties = {
    backgroundColor: isOver ? "var(--color-drop-target)" : undefined,
    border: "2px dashed var(--color-border)",
    padding: "1rem",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children}
    </div>
  );
}
```

**Why good:** `isOver` provides visual feedback when a draggable hovers, `setNodeRef` registers the DOM node for collision detection, styling uses CSS custom properties (not hardcoded colors)

### Wiring DndContext

```tsx
import { DndContext, type DragEndEvent } from "@dnd-kit/core";

function App() {
  const [droppedIn, setDroppedIn] = useState<string | null>(null);

  function handleDragEnd(event: DragEndEvent) {
    const { over } = event;
    setDroppedIn(over ? String(over.id) : null);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      {!droppedIn && <Draggable id="item-1">Drag me</Draggable>}
      <Droppable id="zone-a">
        {droppedIn === "zone-a" ? "Item dropped here" : "Drop zone A"}
      </Droppable>
      <Droppable id="zone-b">
        {droppedIn === "zone-b" ? "Item dropped here" : "Drop zone B"}
      </Droppable>
    </DndContext>
  );
}
```

### Bad Example - Missing DndContext

```tsx
// BAD: useDraggable/useDroppable without DndContext wrapper
function BrokenApp() {
  return (
    <div>
      <Draggable id="item-1">Drag me</Draggable>
      <Droppable id="zone-a">Drop here</Droppable>
    </div>
  );
}
```

**Why bad:** Hooks require DndContext to function -- they read sensor and collision data from React context. Without the provider, drag events never fire.

---

## Pattern 2: Sortable List

### SortableItem Component

```tsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

export function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}
```

**Why good:** `useSortable` composes useDraggable + useDroppable into one hook, `transition` provides smooth CSS transitions between positions (default 250ms ease), `transform` positions the element without DOM reordering

### Sortable List Container

```tsx
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

interface Item {
  id: string;
  label: string;
}

function TaskList() {
  const [items, setItems] = useState<Item[]>([
    { id: "task-1", label: "Design mockups" },
    { id: "task-2", label: "Write tests" },
    { id: "task-3", label: "Deploy to staging" },
  ]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item) => (
          <SortableItem key={item.id} id={item.id}>
            {item.label}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

**Why good:** `SortableContext items` receives an array of IDs matching the rendered order, `closestCenter` is forgiving for vertical lists, `arrayMove` returns a new array (immutable update), `verticalListSortingStrategy` optimizes animations for vertical layout

### Bad Example - SortableContext items Mismatch

```tsx
// BAD: items prop doesn't match rendered children's IDs
<SortableContext items={["a", "b", "c"]}>
  {data.map((item) => (
    <SortableItem key={item.id} id={item.id}>
      {item.label}
    </SortableItem>
  ))}
</SortableContext>
```

**Why bad:** `SortableContext items` must contain the exact same IDs in the same order as the rendered `useSortable` children. Mismatches cause animation glitches and incorrect drop positions.

---

## Pattern 3: Sensor Configuration

### Standard Sensor Setup

```tsx
import {
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

const ACTIVATION_DISTANCE_PX = 8;

function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: ACTIVATION_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
}

// Usage:
const sensors = useDndSensors();
<DndContext sensors={sensors}>{/* ... */}</DndContext>;
```

**Why good:** Distance constraint prevents accidental drags when clicking, KeyboardSensor with sortableKeyboardCoordinates moves items to next position on arrow key (not by fixed pixels), extracted as custom hook for reuse

### Touch Sensor with Delay

```tsx
import {
  useSensor,
  useSensors,
  TouchSensor,
  MouseSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

const TOUCH_DELAY_MS = 250;
const TOUCH_TOLERANCE_PX = 5;
const MOUSE_DISTANCE_PX = 10;

const sensors = useSensors(
  useSensor(MouseSensor, {
    activationConstraint: { distance: MOUSE_DISTANCE_PX },
  }),
  useSensor(TouchSensor, {
    activationConstraint: {
      delay: TOUCH_DELAY_MS,
      tolerance: TOUCH_TOLERANCE_PX,
    },
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  }),
);
```

**Why good:** Touch delay prevents accidental drag while scrolling, tolerance allows slight finger movement during the delay, separate mouse/touch sensors instead of PointerSensor for different constraints per input type

### Bad Example - No Activation Constraint

```tsx
// BAD: PointerSensor without distance constraint
const sensors = useSensors(useSensor(PointerSensor));
```

**Why bad:** Every click immediately starts a drag operation. Users who click items to select or navigate trigger unintended drags. Always add a distance or delay constraint.

---

## Pattern 4: Collision Detection

### Composing Collision Detection for Mixed Layouts

```tsx
import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core";

// Use pointerWithin for precision zones, fall back to closestCenter for keyboard
const composedCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return closestCenter(args);
};

<DndContext collisionDetection={composedCollision}>{/* ... */}</DndContext>;
```

**Why good:** pointerWithin gives precise "pointer must be inside" behavior for pointer users, closestCenter provides a fallback for keyboard users (since pointerWithin requires pointer position), composition pattern avoids building custom collision algorithms from scratch

### When to Use Each Algorithm

```tsx
// Sortable list: closestCenter (forgiving, works without overlap)
<DndContext collisionDetection={closestCenter}>{/* vertical/horizontal lists */}</DndContext>

// Kanban/stacked containers: closestCorners (better for overlapping regions)
<DndContext collisionDetection={closestCorners}>{/* columns with nested sortables */}</DndContext>

// Precision targets (trash, category bins): pointerWithin
<DndContext collisionDetection={pointerWithin}>{/* distinct drop zones */}</DndContext>

// Default/general: rectIntersection (bounding box overlap)
<DndContext collisionDetection={rectIntersection}>{/* general purpose */}</DndContext>
```

---

## Pattern 5: Keyboard and Screen Reader Accessibility

### Position-Based Announcements

```tsx
import type { UniqueIdentifier } from "@dnd-kit/core";

function createAnnouncements(items: string[]) {
  function getPosition(id: UniqueIdentifier) {
    const index = items.indexOf(String(id));
    return `position ${index + 1} of ${items.length}`;
  }

  return {
    onDragStart({ active }: { active: { id: UniqueIdentifier } }) {
      return `Picked up item at ${getPosition(active.id)}`;
    },
    onDragOver({
      active,
      over,
    }: {
      active: { id: UniqueIdentifier };
      over: { id: UniqueIdentifier } | null;
    }) {
      if (over) {
        return `Item moved to ${getPosition(over.id)}`;
      }
      return `Item is no longer over a drop target`;
    },
    onDragEnd({
      active,
      over,
    }: {
      active: { id: UniqueIdentifier };
      over: { id: UniqueIdentifier } | null;
    }) {
      if (over) {
        return `Item dropped at ${getPosition(over.id)}`;
      }
      return `Item dropped outside of a valid target`;
    },
    onDragCancel({ active }: { active: { id: UniqueIdentifier } }) {
      return `Dragging cancelled. Item returned to ${getPosition(active.id)}`;
    },
  };
}

// Usage:
const announcements = createAnnouncements(items);
<DndContext announcements={announcements}>{/* ... */}</DndContext>;
```

**Why good:** Position-based messages ("position 2 of 5") are meaningful to screen reader users, dynamic announcements update as items list changes, factory function makes announcements reusable across lists

### Custom Screen Reader Instructions

```tsx
<DndContext
  screenReaderInstructions={{
    draggable:
      "To pick up a sortable item, press Space or Enter. " +
      "Use arrow keys to move the item. " +
      "Press Space or Enter again to drop the item in its new position. " +
      "Press Escape to cancel.",
  }}
>
  {/* ... */}
</DndContext>
```

**Why good:** Custom instructions match actual keyboard behavior, critical for localization (defaults are English only)

### Drag Handle with Separate Activator

```tsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export function SortableItemWithHandle({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Drag handle: only this element activates drag */}
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        aria-label={`Reorder ${id}`}
      >
        &#x2630;
      </button>
      {children}
    </div>
  );
}
```

**Why good:** `setActivatorNodeRef` separates the drag handle from the sortable container, ARIA attributes and listeners attach to the handle (not the whole item), the handle is a `button` for keyboard accessibility, `aria-label` describes the action
