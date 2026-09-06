---
name: web-dnd-dnd-kit
description: Drag and drop with @dnd-kit - draggable, droppable, sortable, collision detection, sensors, accessibility
---

# @dnd-kit Drag and Drop Patterns

> **Quick Guide:** `@dnd-kit/core` supplies the primitives — `DndContext`, `useDraggable`, `useDroppable` — and `@dnd-kit/sortable` adds `useSortable`, `SortableContext` and `arrayMove` for reorderable lists. Nothing in the DOM is reordered during a drag: elements are moved by CSS transform and the state update happens on drop. Input arrives through sensors, which are separate plugins, so keyboard support is a sensor you add rather than a behaviour you get. Collision detection is pluggable and the choice depends on the layout. `DragOverlay` is needed whenever the dragged element would be clipped or unmounted mid-drag.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — draggable and droppable components, sortable lists, sensor setup, collision composition, announcements, drag handles
- [examples/advanced.md](examples/advanced.md) — DragOverlay with sortables, multi-container Kanban, modifiers, custom collision detection, disabled items, item metadata
- [reference.md](reference.md) — hook signatures and return values, event handler types, sorting strategies, collision algorithms, modifiers, default key bindings, applied ARIA attributes

---

## Which path applies

- **One list, items stay put.** A single `SortableContext`, `closestCenter`, and the transform on the item itself. Simplest, nothing extra to keep mounted. Follow [examples/core.md](examples/core.md).
- **Items cross containers, or the list scrolls.** Both unmount or clip the dragged element mid-drag, so it needs a `DragOverlay` and an `activeId` in state. Multi-container also wants `closestCorners` and an `onDragOver` handler for the transfer. Follow [examples/advanced.md](examples/advanced.md).
- **Drop zones rather than reordering** — a trash bin, an upload target, category bins. `@dnd-kit/core` alone, no sortable package, and usually `pointerWithin`. Follow [examples/core.md](examples/core.md) Patterns 1 and 4.

---

<critical_requirements>

## Before writing @dnd-kit code

**Wrap every participant in one `<DndContext>`.** The hooks read sensors, collision state and the active drag from its context, and outside it they return inert values rather than throwing — so a missing provider looks like nothing happening.

**Add a `KeyboardSensor`, with `sortableKeyboardCoordinates` where the list is sortable.** Sensors are opt-in, so a context configured with pointer input alone cannot be operated from the keyboard at all. The coordinate getter is what makes arrow keys step between items instead of by fixed pixel offsets.

**Give `PointerSensor` an activation constraint** — a `distance`, or a `delay` with a `tolerance` for touch. Without one, every click begins a drag, and an item that is also a link or a button stops being clickable.

**Keep `DragOverlay` mounted and render its children conditionally.** The drop animation is played by the overlay as it unmounts its child; unmounting the overlay itself removes the thing that would animate.

**Return a new array from the drop handler.** `arrayMove` is pure and returns the reordered copy — it does not touch state, and mutating the existing array in place leaves React with nothing to re-render from.

</critical_requirements>

---

**Auto-detection:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, @dnd-kit/modifiers, DndContext, useDraggable, useDroppable, useSortable, SortableContext, DragOverlay, useSensor, useSensors, PointerSensor, KeyboardSensor, TouchSensor, closestCenter, closestCorners, rectIntersection, pointerWithin, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, setActivatorNodeRef, CSS.Transform, restrictToVerticalAxis

**Applies to:**

- Sortable lists — reorderable todos, playlists, navigation, form field ordering
- Kanban boards and any layout where items move between containers
- Drop zones: trash bins, category bins, in-page upload targets
- Drag handles that restrict which part of an item starts a drag
- Keyboard-operable and screen-reader-announced drag interactions
- Constraining movement to an axis, a parent, or the viewport

**Handled elsewhere:**

- Reordering without a drag interaction — move-up/move-down controls are ordinary buttons over the same array operation
- Files dragged in from the operating system, which is the browser's own drag-and-drop and does not pass through a sensor
- Physics- or gesture-driven motion, where the interesting part is the animation rather than the drop target
- How dragged and hovered items look — every component here takes `style` and `className`, and the visual language is settled by whatever owns it
- Persisting the new order — the drop handler produces an array, and where it is written is not this skill's concern

---

<philosophy>

**Nothing in the DOM moves during a drag.** Items are displaced by CSS transform and the array is reordered once, on drop. That is why `SortableContext`'s `items` must list the same ids in the same order as the rendered children — the strategy computes each item's displacement from its index in that array, and a mismatch computes the wrong offsets.

**Input is plugins, not behaviour.** A `DndContext` with no sensors responds to nothing. This is what makes keyboard support a deliberate addition rather than something that comes free, and it is the most common thing left out.

**Accessibility is built in but not automatic.** `useDraggable` applies `role`, `aria-roledescription`, `tabindex` and `aria-describedby` on its own; the announcements it makes default to the item's id, which tells a screen reader user nothing. Supplying `announcements` that describe position is the work.

</philosophy>

---

<decision_framework>

## Which packages

```
Reorderable lists    -> @dnd-kit/core + @dnd-kit/sortable + @dnd-kit/utilities
Drop zones only      -> @dnd-kit/core
Constrained movement -> add @dnd-kit/modifiers
```

## Transform or DragOverlay

```
Items move between containers?        -> DragOverlay (source unmounts mid-drag)
Draggable inside a scrolling or
  virtualized container?              -> DragOverlay (transform is clipped by overflow)
Preview should differ from the item?  -> DragOverlay
None of these                         -> transform on the item; simpler, less state
```

## Which collision algorithm

```
Single sortable list            -> closestCenter    forgiving, needs no overlap
Stacked containers (Kanban)     -> closestCorners   resolves nested targets
Precise zones (trash, bins)     -> pointerWithin    pointer must be inside
General drop targets            -> rectIntersection the default
```

`pointerWithin` has no pointer to test during a keyboard drag, so it returns nothing — compose it with `closestCenter` as a fallback rather than using it alone.

Sorting strategies, modifiers and the full algorithm table are in [reference.md](reference.md).

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Basic drag and drop

`DndContext` connects the two hooks. `useDraggable` gives the element its listeners and ARIA attributes; `useDroppable` registers a target and reports when something is over it.

```tsx
function Draggable({ id, children }: DraggableProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform) }}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

<DndContext
  onDragEnd={({ over }) => setDroppedIn(over ? String(over.id) : null)}
>
  <Draggable id="item-1">Drag me</Draggable>
  <Droppable id="zone-a">Drop zone</Droppable>
</DndContext>;
```

`over` is `null` when the drag ended outside every target, which is the cancel case.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Sortable lists

`useSortable` is `useDraggable` and `useDroppable` combined, so its id must be unique across both. `arrayMove` produces the reordered array on drop.

```tsx
function handleDragEnd({ active, over }: DragEndEvent) {
  if (!over || active.id === over.id) return;
  setItems((prev) => {
    const oldIndex = prev.findIndex((i) => i.id === active.id);
    const newIndex = prev.findIndex((i) => i.id === over.id);
    return arrayMove(prev, oldIndex, newIndex);
  });
}

<DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext
    items={items.map((i) => i.id)} // same ids, same order as the children below
    strategy={verticalListSortingStrategy}
  >
    {items.map((item) => (
      <SortableItem key={item.id} id={item.id}>
        {item.label}
      </SortableItem>
    ))}
  </SortableContext>
</DndContext>;
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Sensors and activation constraints

Sensors decide what starts a drag. Compose them with `useSensors`.

```tsx
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: ACTIVATION_DISTANCE_PX }, // click stays a click
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates, // arrow keys step item to item
  }),
);

<DndContext sensors={sensors}>{/* ... */}</DndContext>;
```

Separate `MouseSensor` and `TouchSensor` in place of `PointerSensor` where the two need different constraints — touch usually wants a `delay` and a `tolerance`, so that a scroll gesture is not read as a drag.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Collision detection

Pass one of the built-in algorithms, or compose them into a function when different targets need different behaviour.

```tsx
const composedCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return closestCenter(args); // fallback: pointerWithin returns nothing for keyboard drags
};

<DndContext collisionDetection={composedCollision}>{/* ... */}</DndContext>;
```

Filtering `args.droppableContainers` before delegating is how one algorithm is applied to a trash zone and another to the list around it.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 5: DragOverlay

The overlay renders the drag preview in its own layer, outside the list's overflow and independent of whether the source item still exists.

```tsx
<DndContext
  onDragStart={({ active }) => setActiveId(String(active.id))}
  onDragEnd={(event) => {
    handleDragEnd(event);
    setActiveId(null);
  }}
  onDragCancel={() => setActiveId(null)} // Escape ends the drag too
>
  {/* containers and sortable items */}
  <DragOverlay>
    {activeItem ? <ItemPreview item={activeItem} /> : null}
  </DragOverlay>
</DndContext>
```

The child is presentational — calling `useDraggable` inside the overlay registers a second draggable for the item already being dragged.

Full code: [examples/advanced.md](examples/advanced.md)

---

### Pattern 6: Multi-container sortable (Kanban)

Each column is a droppable that also wraps its own `SortableContext`. `onDragOver` performs the transfer as the item crosses a boundary; `onDragEnd` settles the order within a column.

```tsx
function handleDragOver({ active, over }: DragOverEvent) {
  if (!over) return;
  const from = findContainer(active.id);
  const to = findContainer(over.id);
  if (!from || !to || from === to) return; // same column: onDragEnd handles it
  setColumns((prev) => moveBetweenColumns(prev, active.id, over.id, from, to));
}

<DndContext
  collisionDetection={closestCorners}
  onDragOver={handleDragOver}
  onDragEnd={handleDragEnd}
>
  {Object.entries(columns).map(([id, items]) => (
    <KanbanColumn key={id} id={id} items={items} />
  ))}
  <DragOverlay>
    {activeItem ? <KanbanCard item={activeItem} /> : null}
  </DragOverlay>
</DndContext>;
```

`findContainer` has to answer for both a column id and an item id, since `over.id` is whichever the collision resolved to.

Full code: [examples/advanced.md](examples/advanced.md)

---

### Pattern 7: Keyboard and screen reader announcements

The built-in announcements name the item by id. Replace them with position, which is what a screen reader user needs to track a move.

```tsx
function createAnnouncements(items: string[]) {
  const at = (id: UniqueIdentifier) =>
    `position ${items.indexOf(String(id)) + 1} of ${items.length}`;

  return {
    onDragStart: ({ active }) => `Picked up item at ${at(active.id)}`,
    onDragOver: ({ over }) =>
      over ? `Moved to ${at(over.id)}` : "No longer over a drop target",
    onDragEnd: ({ over }) =>
      over ? `Dropped at ${at(over.id)}` : "Dropped outside a valid target",
    onDragCancel: ({ active }) => `Cancelled. Returned to ${at(active.id)}`,
  };
}

<DndContext announcements={createAnnouncements(itemIds)}>
  {/* ... */}
</DndContext>;
```

`screenReaderInstructions` covers the other half — the instructions read when a draggable is focused, which default to English.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 8: Drag handles

`setActivatorNodeRef` marks the element that starts the drag, separately from the element that moves.

```tsx
<div ref={setNodeRef} style={style}>
  <button
    ref={setActivatorNodeRef}
    {...listeners}
    {...attributes}
    aria-label={`Reorder ${label}`}
  >
    ☰
  </button>
  {children}
</div>
```

The listeners and attributes go on the handle rather than the container, which is what leaves the rest of the item clickable and selectable.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 9: Modifiers

Modifiers transform the drag position before it is applied. `DndContext` and `DragOverlay` take their own, independently.

```tsx
<DndContext modifiers={[restrictToParentElement]}>
  <DragOverlay modifiers={[restrictToWindowEdges]}>
    {activeItem ? <ItemPreview item={activeItem} /> : null}
  </DragOverlay>
</DndContext>
```

`restrictToVerticalAxis` on a vertical list removes the sideways drift that makes a reorder feel imprecise.

Full code: [examples/advanced.md](examples/advanced.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `useDraggable` on a `DragOverlay` child — registers a second draggable for the item already being dragged
- `SortableContext`'s `items` not matching the rendered children in id and order — displacement is computed from index in that array, so the animations and drop positions come out wrong
- `useSortable` sharing an id with another draggable or droppable — it registers as both, so its id must be unique across both sets, where a plain `useDraggable` and `useDroppable` may share one id because they register in separate stores
- `pointerWithin` used alone — a keyboard drag has no pointer, so it resolves no target and dropping does nothing

**Surprising behaviour:**

- `closestCenter` on stacked containers resolves to the column rather than the card inside it; `closestCorners` measures all four corners and resolves the nested target
- `rectSortingStrategy` is the default and does not support virtualization — the vertical and horizontal list strategies do
- `CSS.Transform.toString()` includes `scaleX`/`scaleY`; `CSS.Translate.toString()` is the position-only form, which is usually what a list wants
- `CSS.Transform.toString(null)` returns `undefined`, which is safe to assign to `style.transform`
- `DragOverlay` is not portalled by default, so it is still subject to an ancestor's `overflow` and stacking context — wrap it in `createPortal` to escape them
- `active.data.current` and `over.data.current` carry whatever was passed as `data`, which is how one handler tells a card from a column without looking either up
- Screen reader instructions and announcements default to English, and are replaced rather than translated
- Default keys are Space or Enter to pick up and drop, arrows to move, Escape to cancel — `onDragCancel` is the Escape path and has to reset the same state `onDragEnd` does

</red_flags>
