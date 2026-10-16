# Composable Components — Accessibility Structure Examples

> Full code for Pattern 8 in [SKILL.md](../SKILL.md): the accessibility work that is an API decision — generated ids wired across parts, focus ownership with consumer escape hatches, roving tabindex, typeahead and Escape. The ARIA and keyboard contracts per widget are tables in [reference.md](../reference.md#aria-wiring-by-widget).

**Prerequisites:** context scoping and the descendant registry from [core.md](core.md) — every pattern here is a `Root` publishing behaviour that parts subscribe to. `useLatest` and `createChangeEventDetails` are in [state-contract.md](state-contract.md).

---

## Pattern 8: Structural Accessibility

### Id wiring through context

A relationship between two parts cannot be expressed by the consumer, who does not know the ids and should not have to. The `Root` owns them; parts register and consume.

```tsx
interface RegisteredIds {
  readonly labelId: string | undefined;
  readonly descriptionId: string | undefined;
  readonly registerLabelId: (id: string | undefined) => void;
  readonly registerDescriptionId: (id: string | undefined) => void;
}

function useRegisteredId(
  register: (id: string | undefined) => void,
  suppliedId: string | undefined,
): string {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;

  useEffect(() => {
    register(id);
    return () => register(undefined);
  }, [register, id]);

  return id;
}

function DialogDescription({ ref, ...props }: React.ComponentProps<"p">) {
  const { registerDescriptionId } = useDialogContext("Description");
  const id = useRegisteredId(registerDescriptionId, props.id);

  return <p {...props} ref={ref} id={id} />;
}
```

**Why good:** The relationship survives every rearrangement, because it travels through context rather than through the JSX the consumer wrote. The attribute is `undefined` while the part is not rendered, so `aria-describedby` never points at a missing id. A consumer-supplied `id` wins, which is what makes external `aria-controls` and form-label wiring possible.

**Why guessing the id in the popup is bad:**

```tsx
// BAD: the popup assumes a title exists and derives its id
const titleId = `${dialogId}-title`;
<div role="dialog" aria-labelledby={titleId}>
```

With no `Dialog.Title` rendered, `aria-labelledby` points at nothing and the dialog has no accessible name — worse than omitting the attribute, which would at least let other naming sources apply.

### Require a name, don't invent one

```tsx
useEffect(() => {
  if (process.env.NODE_ENV === "production") return;
  const hasName =
    labelId !== undefined ||
    ariaLabel !== undefined ||
    ariaLabelledBy !== undefined;
  if (!hasName) {
    console.error(
      "<Dialog.Popup> has no accessible name. Render a <Dialog.Title>, or pass aria-label to <Dialog.Popup>.",
    );
  }
}, [labelId, ariaLabel, ariaLabelledBy]);
```

**Why good:** The component knows the requirement and both ways to satisfy it, so it states both — in development only. A component that silently ships unnamed dialogs has moved a requirement it understands onto a consumer who does not.

### Focus ownership

A component that takes over the screen owns focus: where it goes on open, where it returns on close, and what Tab does in between. Consumers redirect it through hooks, not by forking.

```tsx
const FOCUS_RESTORE_DELAY_MS = 0;

interface UseFocusManagementParams {
  readonly open: boolean;
  readonly popupRef: React.RefObject<HTMLElement | null>;
  readonly onOpenAutoFocus?: (event: Event) => void;
  readonly onCloseAutoFocus?: (event: Event) => void;
}

function useFocusManagement({
  open,
  popupRef,
  onOpenAutoFocus,
  onCloseAutoFocus,
}: UseFocusManagementParams): void {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // Read through refs: a consumer's inline callback must not re-run the effect,
  // which would hand focus back and take it again on every render.
  const onOpenAutoFocusRef = useLatest(onOpenAutoFocus);
  const onCloseAutoFocusRef = useLatest(onCloseAutoFocus);

  useEffect(() => {
    if (!open) return;

    const active = document.activeElement;
    previouslyFocusedRef.current =
      active instanceof HTMLElement ? active : null;

    const openEvent = new Event("openAutoFocus", { cancelable: true });
    onOpenAutoFocusRef.current?.(openEvent);
    if (!openEvent.defaultPrevented) focusFirstTabbable(popupRef.current);

    return () => {
      const closeEvent = new Event("closeAutoFocus", { cancelable: true });
      onCloseAutoFocusRef.current?.(closeEvent);
      if (closeEvent.defaultPrevented) return;

      const target = previouslyFocusedRef.current;
      window.setTimeout(
        () => target?.focus({ preventScroll: true }),
        FOCUS_RESTORE_DELAY_MS,
      );
    };
  }, [open, popupRef, onOpenAutoFocusRef, onCloseAutoFocusRef]);
}

const TABBABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

function getTabbables(container: HTMLElement | null): readonly HTMLElement[] {
  if (container === null) return [];
  return [...container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)].filter(
    isTabbableNow,
  );
}

function isTabbableNow(element: HTMLElement): boolean {
  return (
    element.checkVisibility({ visibilityProperty: true }) &&
    element.closest("[inert]") === null
  );
}

function focusFirstTabbable(container: HTMLElement | null): void {
  const [first] = getTabbables(container);
  if (first !== undefined) {
    first.focus({ preventScroll: true });
    return;
  }
  if (container === null) return;
  container.setAttribute("tabindex", "-1");
  container.focus({ preventScroll: true });
}
```

**The visibility filter is not optional.** The selector matches elements inside `display: none` subtrees, a closed `<details>`, `visibility: hidden` regions and `inert` regions, none of which are tabbable; a trap built on the raw list sends focus to an invisible element, which looks to the user like focus disappeared. `checkVisibility()` is false for an element with no box or under a `content-visibility: hidden` ancestor, and `visibilityProperty` adds `visibility: hidden`. An `offsetParent !== null` check is the common substitute and is wrong here: it is also `null` for a visible `position: fixed` element.

**Why good:** The cancelable event is the same escape hatch the rest of a composable API uses — `preventDefault()` on an event the component hands you — so a consumer who wants focus on the second field, or on a newly created row instead of the trigger, does it in a few lines and keeps every other behaviour. The container fallback guarantees focus never escapes to `<body>`, which would strand the keyboard user at the top of the document.

**Why the deferred restore:** focusing synchronously during unmount competes with the browser's own focus handling and with an exit animation still holding the element; deferring to the next task lets the DOM settle so the target actually receives focus.

**Why restore to `document.activeElement` captured at open:** the component may have been opened from a menu item, a keyboard shortcut or a toast rather than its trigger, and whatever had focus is what the user expects to return to.

### Trapping Tab

```tsx
function handleKeyDown(event: React.KeyboardEvent): void {
  if (event.key !== "Tab") return;

  const tabbables = getTabbables(popupRef.current);
  if (tabbables.length === 0) {
    event.preventDefault();
    return;
  }

  const first = tabbables[0];
  const last = tabbables[tabbables.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
```

**Why good:** The list is recomputed on every Tab, so content that appears while open is included, and trapping only at the boundaries leaves the browser's own ordering untouched in between. Gate the trap on the `modal` prop and default that prop to match the role.

### Roving tabindex

In a composite widget — listbox, menu, toolbar, tab list — the whole widget is one tab stop and arrow keys move within it.

```tsx
type Orientation = "horizontal" | "vertical";
type MoveDirection = "next" | "previous" | "first" | "last";

const ORIENTATION_KEYS = {
  horizontal: { next: "ArrowRight", previous: "ArrowLeft" },
  vertical: { next: "ArrowDown", previous: "ArrowUp" },
} as const satisfies Record<Orientation, { next: string; previous: string }>;

interface UseRovingFocusParams {
  readonly orientation: Orientation;
  readonly loop: boolean;
  readonly getOrderedItems: () => readonly Descendant[];
}

function useRovingFocus({
  orientation,
  loop,
  getOrderedItems,
}: UseRovingFocusParams) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const moveFocus = useCallback(
    (direction: MoveDirection) => {
      const items = getOrderedItems().filter((item) => !item.disabled);
      if (items.length === 0) return;

      const currentIndex = items.findIndex((item) => item.id === activeId);
      const next =
        items[resolveIndex(direction, currentIndex, items.length, loop)];
      if (next === undefined) return;

      setActiveId(next.id);
      next.element.focus({ preventScroll: true });
      next.element.scrollIntoView({ block: "nearest" });
    },
    [activeId, getOrderedItems, loop],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const keys = ORIENTATION_KEYS[orientation];
      if (event.key === keys.next) moveFocus("next");
      else if (event.key === keys.previous) moveFocus("previous");
      else if (event.key === "Home") moveFocus("first");
      else if (event.key === "End") moveFocus("last");
      else return;

      event.preventDefault();
    },
    [orientation, moveFocus],
  );

  return { activeId, setActiveId, onKeyDown };
}

function resolveIndex(
  direction: MoveDirection,
  currentIndex: number,
  count: number,
  loop: boolean,
): number {
  if (direction === "first") return 0;
  if (direction === "last") return count - 1;

  const nextIndex = currentIndex + (direction === "next" ? 1 : -1);
  if (nextIndex < 0) return loop ? count - 1 : 0;
  if (nextIndex >= count) return loop ? 0 : count - 1;
  return nextIndex;
}
```

Each item is tabbable only while it is the active one, and a pointer press makes it active too:

```tsx
<div
  role="option"
  tabIndex={isActive ? 0 : -1}
  data-highlighted={isActive ? "" : undefined}
  onPointerDown={() => setActiveId(id)}
/>
```

**Why good:** Tab enters and leaves the widget in one press regardless of item count. Disabled items are filtered before indexing, so they are skipped without a gap. `preventDefault` runs only for handled keys, so the rest reach the consumer and the browser. `scrollIntoView({ block: "nearest" })` keeps the active item visible without yanking the viewport when it already is. Pointer and keyboard set the same state, so the next arrow key starts from the item the user clicked.

**Why every-item-tabbable is bad:** a forty-option listbox becomes forty tab stops; keyboard users cannot get past it, and screen-reader users lose the "one control" model the role promises.

**Why an active index is bad:** an index still points somewhere after the list is filtered or reordered, just not at the item the user was on. Ids survive reordering.

### Focus versus `aria-activedescendant`

| Approach                | DOM focus lives on | Use when                                                          |
| ----------------------- | ------------------ | ----------------------------------------------------------------- |
| Roving tabindex         | The active item    | Items are the interactive elements (menu, toolbar, tab list)      |
| `aria-activedescendant` | The container      | A text input must keep focus while a list is navigated (combobox) |

Pick one per widget. With `aria-activedescendant`, DOM focus stays on the container and assistive technology treats the referenced item as focused, so moving DOM focus to the item as well contradicts the reference. Focusing an item can scroll it into view, but how far is the browser's choice — which is why the code above passes `preventScroll` and scrolls with `block: "nearest"` itself; with `aria-activedescendant` focus never moves, so the component always does the scrolling.

### Typeahead

Any list navigable by arrow keys should also be navigable by typing.

```tsx
const TYPEAHEAD_RESET_MS = 500;

interface TypeaheadItem extends Descendant {
  /** Registered by the ItemText part — never read from element.textContent. */
  readonly textValue: string;
}

function useTypeahead(
  getOrderedItems: () => readonly TypeaheadItem[],
  activeId: string | null,
  onMatch: (item: TypeaheadItem) => void,
) {
  const searchRef = useRef("");
  const timeoutRef = useRef<number | undefined>(undefined);

  return useCallback(
    (event: React.KeyboardEvent) => {
      if (!isPrintableCharacter(event)) return;

      searchRef.current += event.key.toLowerCase();
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        searchRef.current = "";
      }, TYPEAHEAD_RESET_MS);

      const items = getOrderedItems().filter((item) => !item.disabled);
      const match = findByPrefix(items, searchRef.current, activeId);
      if (match === undefined) return;

      onMatch(match);
      event.preventDefault();
    },
    [getOrderedItems, activeId, onMatch],
  );
}

function findByPrefix(
  items: readonly TypeaheadItem[],
  search: string,
  activeId: string | null,
): TypeaheadItem | undefined {
  // A repeated character cycles through items starting with it, as native listboxes do.
  const isCycling = isRepeatedCharacter(search);
  const prefix = isCycling ? search.slice(0, 1) : search;

  // Refining a multi-character search may stay on the current item; a fresh
  // single character or a cycle must advance past it. Both wrap.
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const startIndex =
    isCycling || search.length === 1
      ? activeIndex + 1
      : Math.max(activeIndex, 0);

  for (let offset = 0; offset < items.length; offset += 1) {
    const item = items[(startIndex + offset) % items.length];
    if (item !== undefined && item.textValue.toLowerCase().startsWith(prefix))
      return item;
  }
  return undefined;
}

function isRepeatedCharacter(search: string): boolean {
  return (
    search.length > 1 &&
    [...search].every((character) => character === search[0])
  );
}

function isPrintableCharacter(event: React.KeyboardEvent): boolean {
  return (
    event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
  );
}
```

**Why good:** The buffer accumulates within the reset window, so "se" finds "Settings" rather than jumping to the first item starting with "e". Modifier combinations are excluded, so `Ctrl+S` is not swallowed. The scan starts after the active item and wraps, so typing "s" repeatedly cycles through every item starting with "s". `preventDefault` fires only on a match, so a space that matched nothing still activates the focused item.

**Where the text comes from:** an item's content may include badges, icons and descriptions, so `element.textContent` would make typeahead match a badge. That is why an `ItemText` part exists — the consumer marks the label, and typeahead reads that.

### Escape and dismissal ownership

```tsx
useEffect(() => {
  if (!open) return;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    setOpen(false, createChangeEventDetails("escape-key", event));
  };

  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [open, setOpen]);
```

**Why good:** The listener is on `document`, so Escape works while focus is inside portaled content. The change goes through the same `setOpen` as every other dismissal, so it carries a reason and honours `cancel()`.

**The nesting problem:** two open layers listening on `document` both close on one Escape. The fix is an ownership stack — each layer registers on open, and only the top of the stack handles the key. Dialogs containing selects make nesting the normal case, so a component that owns Escape owns the stack too.
