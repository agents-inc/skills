# @dnd-kit — Core Examples

> Draggable and droppable components, sortable lists, sensor setup, collision composition, announcements, drag handles. See [SKILL.md](../SKILL.md) for decisions, [reference.md](../reference.md) for signatures and tables, [advanced.md](advanced.md) for DragOverlay, Kanban and modifiers.

---

## Pattern 1: Basic Drag and Drop

### The draggable

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

**Why good:** three things have to be spread or attached and each does one job — `setNodeRef` registers the node for measurement, `listeners` carries the sensor handlers, and `attributes` carries the ARIA and `tabindex` that make it keyboard-reachable. Dropping `attributes` is the usual way a draggable becomes mouse-only.

### The droppable

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

**Why good:** `isOver` is the only feedback a drop target gets, and without it the user cannot tell a valid target from an invalid one mid-drag. `setNodeRef` is what gives collision detection a rectangle to measure.

### Wiring the context

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

### Bad — no DndContext

```tsx
function BrokenApp() {
  return (
    <div>
      <Draggable id="item-1">Drag me</Draggable>
      <Droppable id="zone-a">Drop here</Droppable>
    </div>
  );
}
```

**Why bad:** the hooks read sensors and collision state from context, and with no provider they return inert values instead of throwing. Nothing drags, nothing logs, and there is no error to search for.

---

## Pattern 2: Sortable List

### The sortable item

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

**Why good:** `useSortable` registers the item as both draggable and droppable, so it is a target for its neighbours as well as a thing to drag. `transition` is what animates the _other_ items as they displace — omit it and they jump.

### The list container

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

**Why good:** the early return covers both non-drops (`over` is null) and no-op drops, so `arrayMove` is only called when the order actually changes. `closestCenter` needs no overlap between the dragged item and its target, which is what makes a list forgiving to drag in.

### Bad — items out of step with the children

```tsx
<SortableContext items={["a", "b", "c"]}>
  {data.map((item) => (
    <SortableItem key={item.id} id={item.id}>
      {item.label}
    </SortableItem>
  ))}
</SortableContext>
```

**Why bad:** the strategy computes each item's displacement from its index in `items`, so ids that are not the rendered ones — or are in a different order — produce offsets for a list that is not on screen. Items slide the wrong way and drop into the wrong slot.

---

## Pattern 3: Sensor Configuration

### Pointer plus keyboard

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

**Why good:** the distance threshold is what keeps a click a click — without it an item that is also a link cannot be followed. `sortableKeyboardCoordinates` translates an arrow key into the coordinates of the next item rather than a fixed pixel step, which is the difference between reordering and nudging.

### Touch, with a delay

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

**Why good:** touch needs a different constraint from mouse, which is the reason to split `PointerSensor` into its two halves. A distance threshold on touch would fight scrolling — a swipe travels far immediately — so touch uses a hold delay instead, with a tolerance so that a slightly unsteady finger during the hold does not cancel it.

### Bad — no activation constraint

```tsx
const sensors = useSensors(useSensor(PointerSensor));
```

**Why bad:** the drag begins on pointerdown, so any item that is also clickable stops being clickable — the click is consumed as the start of a drag that ends in the same place.

---

## Pattern 4: Collision Detection

### Composing algorithms for a mixed layout

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

**Why good:** a collision function is just `(args) => Collision[]`, so the built-ins compose rather than needing to be replaced. The fallback is load-bearing: a keyboard drag has no pointer, so `pointerWithin` alone returns an empty array and dropping resolves to nothing.

Which algorithm suits which layout is tabulated in [reference.md](../reference.md).

---

## Pattern 5: Keyboard and Screen Reader Accessibility

### Position-based announcements

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

**Why good:** the defaults announce the item's id, which for `task-3` tells a screen reader user nothing about where the item went. "Position 2 of 5" is the information a sighted user gets from seeing the list. Building the object from the current `items` is what keeps the total correct as the list grows.

### Custom screen reader instructions

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

**Why good:** these are read when a draggable receives focus, before the user has committed to anything. They ship in English only, so this prop is the localization point — and it is where a non-default key binding has to be described, since the text is static.

### Drag handle with a separate activator

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

**Why good:** `setNodeRef` marks what moves and `setActivatorNodeRef` marks what starts the drag, so the rest of the item stays clickable and its text selectable. The handle is a real `button`, which is what makes it focusable and what `attributes` expects — a `div` handle would need the role and tabindex supplying by hand.
