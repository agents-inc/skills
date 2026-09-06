# @dnd-kit — Advanced Examples

> DragOverlay with sortables, multi-container Kanban, modifiers, custom collision detection, disabled items, item metadata. See [SKILL.md](../SKILL.md) for decisions, [reference.md](../reference.md) for signatures and tables, [core.md](core.md) for the basic hooks and sensors.

---

## Pattern 1: DragOverlay with a Sortable List

The overlay carries the preview, which leaves the item in the list free to be dimmed, hidden or left as a placeholder gap.

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

      {/* Mounted unconditionally; only its child is conditional */}
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

// Presentational only — no useDraggable or useSortable inside a DragOverlay child
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

**Why good:** the drop animation is the overlay unmounting its child, so the overlay itself has to survive that moment — mounting it conditionally removes the element that would animate. `onDragCancel` clears `activeId` on the Escape path, which `onDragEnd` never sees; without it the preview is left on screen.

`dropAnimation` defaults to 250ms `ease`, so it can be left off entirely; `dropAnimation={null}` turns it off, which is what a list that reorders instantly wants.

---

## Pattern 2: Multi-Container Kanban Board

Two handlers split the work: `onDragOver` moves the item between columns as it crosses a boundary, and `onDragEnd` settles its index within whichever column it finished in.

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
      const activeIndex = activeItems.findIndex(
        (item) => item.id === active.id,
      );
      // An earlier onDragOver in this batch already moved it
      if (activeIndex === -1) return prev;

      const overItems = [...prev[overContainer]];
      const overIndex = overItems.findIndex((item) => item.id === over.id);

      const [movedItem] = activeItems.splice(activeIndex, 1);
      // over.id is the column itself when the pointer is over empty space
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
    setColumns((prev) => {
      const items = prev[overContainer];
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      if (oldIndex === -1) return prev;
      // over.id is the column itself when dropped on empty space: send it to the end
      const target = newIndex === -1 ? items.length - 1 : newIndex;
      if (oldIndex === target) return prev;
      return { ...prev, [overContainer]: arrayMove(items, oldIndex, target) };
    });
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

### The column component

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

**Why good:** each column is a droppable in its own right _and_ wraps a `SortableContext`, which is what lets an item be dropped into an empty column as well as between two cards. `findContainer` has to answer for a column id and an item id alike, because `over.id` is whichever of the two the collision resolved to — and that is why both handlers check their indexes for `-1`. A `-1` for `over` means the pointer resolved to the column rather than a card, and a `-1` for `active` means an earlier `onDragOver` already performed the transfer, since `findContainer` reads the state of the last render while the updater sees the newest.

`SortableKanbanCard` is the card's own `useSortable` component — `SortableItem` from [core.md](core.md) with the card's markup — and `KanbanCard` is its presentational twin, with no hook, for the overlay to render.

The announcements in [core.md](core.md) index into one flat list, so a board needs its own: on a Kanban, "position 2 of 5" is ambiguous until it names the column.

### Bad — closestCenter on a Kanban board

```tsx
<DndContext collisionDetection={closestCenter}>
  {/* columns side by side, cards inside them */}
</DndContext>
```

**Why bad:** a column's centre is usually nearer the pointer than any individual card's, so the collision resolves to the column and the drop lands at the end of it rather than at the position shown. `closestCorners` measures all four corners, which resolves the nested card instead.

---

## Pattern 3: Modifiers for Constrained Drag

### Vertical-only sortable list

```tsx
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";

<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  modifiers={[restrictToVerticalAxis]}
  onDragEnd={handleDragEnd}
>
  {/* items move up and down only */}
</DndContext>;
```

### Different constraints on the context and the overlay

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

**Why good:** the two `modifiers` props are independent, so the items stay inside their container while the preview follows the cursor anywhere in the viewport. Locking a vertical list to its axis also removes the sideways drift that makes the target row ambiguous.

---

## Pattern 4: Custom Collision Detection

### A trash zone beside a sortable list

Partition the droppables and give each group the algorithm that suits it — precision for the bin, forgiveness for the list.

```tsx
import {
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  type DroppableContainer,
} from "@dnd-kit/core";

const TRASH_ZONE_ID = "trash";

const trashAwareCollision: CollisionDetection = (args) => {
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

**Why good:** filtering `droppableContainers` before delegating is what keeps the two algorithms from competing — the trash zone never appears in the list's collision set, so it cannot win a nearest-centre contest against the row the user is actually over. Deletion needs the pointer genuinely inside the bin; reordering does not.

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

**Why good:** `disabled` is a hook option rather than a conditional call, so the hook order stays stable as items become draggable and undraggable. Withholding `listeners` while keeping `attributes` leaves the item focusable and still announced — which is what a screen reader user needs to learn that it cannot be moved.

---

## Pattern 6: Carrying Metadata on `data`

`data` is passed through to `active.data.current` and `over.data.current` in every handler.

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

**Why good:** the handler learns what it is holding without searching the state for it — which matters most where ids alone are ambiguous, since a Kanban `over.id` may be a card or a column and a `type` discriminator settles it in one read.
