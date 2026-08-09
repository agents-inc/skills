# @dnd-kit - Advanced Examples

> Multi-container sorting, DragOverlay patterns, modifiers, and custom collision detection. See [SKILL.md](../SKILL.md) for concepts and decision frameworks, [core.md](core.md) for basic drag/drop and sortable patterns.

---

## Pattern 1: DragOverlay with Sortable List

When using DragOverlay with a sortable list, the original item can be hidden or styled differently while the overlay provides the drag preview.

```tsx
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

const DROP_ANIMATION_DURATION_MS = 200;
const DROP_ANIMATION_EASING = "ease";

interface Item {
  id: string;
  label: string;
}

function SortableListWithOverlay() {
  const [items, setItems] = useState<Item[]>([
    { id: "1", label: "First item" },
    { id: "2", label: "Second item" },
    { id: "3", label: "Third item" },
  ]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useDndSensors(); // See core.md Pattern 3

  const activeItem = activeId
    ? items.find((item) => item.id === activeId)
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    setItems((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item) => (
          <SortableItem
            key={item.id}
            id={item.id}
            isDragOverlay={activeId === item.id}
          >
            {item.label}
          </SortableItem>
        ))}
      </SortableContext>

      {/* CRITICAL: DragOverlay always mounted, children conditionally rendered */}
      <DragOverlay
        dropAnimation={{
          duration: DROP_ANIMATION_DURATION_MS,
          easing: DROP_ANIMATION_EASING,
        }}
      >
        {activeItem ? <ItemPreview label={activeItem.label} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// Presentational preview (NOT a draggable -- no useDraggable inside DragOverlay)
function ItemPreview({ label }: { label: string }) {
  return (
    <div
      style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.15)", padding: "0.5rem" }}
    >
      {label}
    </div>
  );
}
```

**Why good:** DragOverlay stays mounted and only renders children when activeItem exists, the preview component is purely presentational (no hooks), drop animation is configured with named constants, `onDragCancel` resets state for Escape key handling

---

## Pattern 2: Multi-Container Kanban Board

Items move between columns using `onDragOver` (real-time transfer) and `onDragEnd` (final placement). Each column wraps its items in a separate `SortableContext`.

```tsx
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

interface KanbanItem {
  id: string;
  content: string;
}

type Columns = Record<string, KanbanItem[]>;

function KanbanBoard() {
  const [columns, setColumns] = useState<Columns>({
    todo: [
      { id: "task-1", content: "Design wireframes" },
      { id: "task-2", content: "Write API spec" },
    ],
    inProgress: [{ id: "task-3", content: "Build UI" }],
    done: [{ id: "task-4", content: "Setup CI" }],
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useDndSensors();

  // Find which column contains a given item ID
  function findContainer(id: UniqueIdentifier): string | undefined {
    // Check if id is a column key
    if (id in columns) return id as string;
    // Otherwise find which column contains the item
    return Object.keys(columns).find((key) =>
      columns[key].some((item) => item.id === id),
    );
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over.id);
    if (!activeContainer || !overContainer || activeContainer === overContainer)
      return;

    // Move item from one container to another
    setColumns((prev) => {
      const activeItems = [...prev[activeContainer]];
      const overItems = [...prev[overContainer]];
      const activeIndex = activeItems.findIndex(
        (item) => item.id === active.id,
      );
      const overIndex = overItems.findIndex((item) => item.id === over.id);

      const [movedItem] = activeItems.splice(activeIndex, 1);
      const insertIndex = overIndex >= 0 ? overIndex : overItems.length;
      overItems.splice(insertIndex, 0, movedItem);

      return {
        ...prev,
        [activeContainer]: activeItems,
        [overContainer]: overItems,
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over.id);
    if (!activeContainer || !overContainer || activeContainer !== overContainer)
      return;

    // Reorder within the same container
    const items = columns[overContainer];
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex !== newIndex) {
      setColumns((prev) => ({
        ...prev,
        [overContainer]: arrayMove(prev[overContainer], oldIndex, newIndex),
      }));
    }
  }

  const activeItem = activeId
    ? Object.values(columns)
        .flat()
        .find((item) => item.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div style={{ display: "flex", gap: "1rem" }}>
        {Object.entries(columns).map(([columnId, items]) => (
          <KanbanColumn key={columnId} id={columnId} items={items} />
        ))}
      </div>

      <DragOverlay>
        {activeItem ? (
          <KanbanCard content={activeItem.content} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
```

### Kanban Column Component

```tsx
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

interface KanbanColumnProps {
  id: string;
  items: KanbanItem[];
}

function KanbanColumn({ id, items }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: "250px",
        padding: "0.5rem",
        backgroundColor: isOver
          ? "var(--color-drop-highlight)"
          : "var(--color-surface)",
        borderRadius: "8px",
      }}
    >
      <h3>{id}</h3>
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        {items.map((item) => (
          <SortableKanbanCard
            key={item.id}
            id={item.id}
            content={item.content}
          />
        ))}
      </SortableContext>
    </div>
  );
}
```

**Why good:** `closestCorners` handles stacked columns better than closestCenter, each column registers as a droppable AND wraps its items in SortableContext, `onDragOver` handles cross-container transfer in real time, `onDragEnd` handles within-container reordering, `findContainer` helper locates items across all columns, DragOverlay renders the active item's preview

### Bad Example - Using closestCenter for Kanban

```tsx
// BAD: closestCenter picks the column center instead of items within columns
<DndContext collisionDetection={closestCenter}>
  {/* Kanban columns stacked horizontally */}
</DndContext>
```

**Why bad:** When droppable containers are stacked (columns side-by-side with items inside), closestCenter often returns the column droppable instead of the specific item droppable within. closestCorners measures all four corners and correctly resolves nested targets.

---

## Pattern 3: Modifiers for Constrained Drag

### Vertical-Only Sortable List

```tsx
import {
  restrictToVerticalAxis,
  restrictToWindowEdges,
} from "@dnd-kit/modifiers";

<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  modifiers={[restrictToVerticalAxis]}
  onDragEnd={handleDragEnd}
>
  {/* Vertical sortable list -- items can only move up/down */}
</DndContext>;
```

### Constrained to Parent with DragOverlay

```tsx
import {
  restrictToParentElement,
  restrictToWindowEdges,
} from "@dnd-kit/modifiers";

<DndContext modifiers={[restrictToParentElement]}>
  {/* Items constrained to parent container */}
  <DragOverlay modifiers={[restrictToWindowEdges]}>
    {/* Overlay constrained to window (different modifier) */}
    {activeItem ? <ItemPreview item={activeItem} /> : null}
  </DragOverlay>
</DndContext>;
```

**Why good:** DndContext and DragOverlay can have different modifiers -- constrain source items to parent but let the overlay move freely within the viewport, restrictToVerticalAxis eliminates horizontal jitter in vertical-only lists

---

## Pattern 4: Custom Collision Detection

### Trash Zone with Sortable List

Compose collision algorithms: use closestCenter for the sortable list, but pointerWithin for a "trash" drop zone.

```tsx
import {
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  type DroppableContainer,
} from "@dnd-kit/core";

const TRASH_ZONE_ID = "trash";

const trashAwarCollision: CollisionDetection = (args) => {
  // First check if pointer is within the trash zone
  const pointerCollisions = pointerWithin({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (container: DroppableContainer) => container.id === TRASH_ZONE_ID,
    ),
  });

  if (pointerCollisions.length > 0) return pointerCollisions;

  // Otherwise use closestCenter for sortable items
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (container: DroppableContainer) => container.id !== TRASH_ZONE_ID,
    ),
  });
};
```

**Why good:** Trash zone requires precise "pointer inside" targeting (pointerWithin), sortable items benefit from forgiving closestCenter, filtering droppableContainers prevents the trash zone from interfering with sort detection

---

## Pattern 5: Disabled Sortable Items

```tsx
interface SortableItemProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export function SortableItem({
  id,
  children,
  disabled = false,
}: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id,
      disabled,
    });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? "not-allowed" : "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(disabled ? {} : listeners)}
    >
      {children}
    </div>
  );
}
```

**Why good:** `disabled` prop on useSortable prevents the item from being dragged, listeners are conditionally spread so disabled items don't attach sensor handlers, visual feedback via opacity and cursor communicates disabled state

---

## Pattern 6: Using data for Item Metadata

The `data` property on useDraggable/useDroppable/useSortable lets you attach metadata accessible in event handlers.

```tsx
// In draggable component
const { attributes, listeners, setNodeRef } = useSortable({
  id: item.id,
  data: { type: "task", columnId: "todo", priority: item.priority },
});

// In event handler
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over) return;

  const activeData = active.data.current;
  const overData = over.data.current;

  // Use metadata to determine behavior
  if (activeData?.type === "task" && overData?.type === "column") {
    moveTaskToColumn(String(active.id), String(over.id));
  }
}
```

**Why good:** `data.current` provides typed metadata without needing to look up items by ID in event handlers, useful for distinguishing between different kinds of draggables/droppables (tasks vs columns, items vs trash zones)
