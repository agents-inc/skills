# Composable Components - Accessibility Structure

> The accessibility work that is an API decision: generated ids wired across parts, focus ownership with consumer escape hatches, roving tabindex, and typeahead. See [SKILL.md](../SKILL.md) for the alignment checklist and [core.md](core.md) for the context and registry these build on.

**Prerequisites**: Understand context scoping and the descendant registry from [core.md](core.md) -- every pattern here is a `Root` publishing behavior that individual parts subscribe to.

> **Scope:** this file covers accessibility that determines _what parts exist and what they share_. Conformance testing, contrast, alt text and audit workflows are a different domain.

---

## Id Wiring Through Context

A relationship between two parts cannot be expressed by the consumer, because the consumer does not know the ids and should not have to. The `Root` owns them; the parts register and consume.

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
```

```tsx
const DialogDescription = forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<"p">
>(function DialogDescription(props, forwardedRef) {
  const { registerDescriptionId } = useDialogContext("Description");
  const id = useRegisteredId(registerDescriptionId, props.id);

  return <p {...props} ref={forwardedRef} id={id} />;
});
```

**Why good:** The relationship survives every rearrangement, because it travels through context rather than through the JSX tree the consumer wrote. The attribute is `undefined` when the part is not rendered, so `aria-describedby` never points at an id that does not exist. A consumer-supplied `id` wins, which is what makes external `aria-controls` and form-label wiring possible.

**Why generating the id in the popup is bad:**

```tsx
// BAD: the popup assumes a title exists and guesses its id
const titleId = `${dialogId}-title`;
<div role="dialog" aria-labelledby={titleId}>
```

If no `Dialog.Title` is rendered, `aria-labelledby` points at nothing. Assistive technology follows the reference, finds no element, and reports no accessible name -- a strictly worse outcome than omitting the attribute, which would at least fall back to other naming sources.

### Require a Name, Don't Invent One

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

**Why good:** The component knows the requirement and the two ways to satisfy it, so it states both. Development-only, so the check costs nothing in production. A component that silently ships unnamed dialogs has moved a requirement it understands onto a consumer who does not.

---

## Focus Ownership

A component that takes over the screen owns focus: where it goes on open, where it returns on close, and what happens to Tab in between. Consumers override through hooks, not by forking.

```tsx
const FOCUS_RESTORE_FRAME_DELAY = 0;

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

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const openEvent = new Event("openAutoFocus", { cancelable: true });
    onOpenAutoFocus?.(openEvent);
    if (!openEvent.defaultPrevented) {
      focusFirstTabbable(popupRef.current);
    }

    return () => {
      const closeEvent = new Event("closeAutoFocus", { cancelable: true });
      onCloseAutoFocus?.(closeEvent);
      if (closeEvent.defaultPrevented) return;

      const target = previouslyFocusedRef.current;
      window.setTimeout(
        () => target?.focus({ preventScroll: true }),
        FOCUS_RESTORE_FRAME_DELAY,
      );
    };
  }, [open, popupRef, onOpenAutoFocus, onCloseAutoFocus]);
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
  const matches = [
    ...container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR),
  ];
  return matches.filter(
    (element) => element.offsetParent !== null && !element.closest("[inert]"),
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

**The visibility filter is not optional:** the selector matches elements inside `display: none` subtrees, inside `inert` regions and inside collapsed `<details>`, none of which are tabbable. A trap built on the unfiltered list sends focus to an invisible element and looks, to the user, like focus disappeared.

**Why good:** The cancelable-event escape hatch matches the escape hatch used everywhere else in a composable API -- `preventDefault()` on an event the component hands you. A consumer who wants focus on the second field, or wants focus to land on a newly created row instead of the trigger, does it in four lines and keeps every other behavior. The container fallback guarantees focus never escapes to `<body>`, which would strand the keyboard user at the top of the document.

**Why the deferred restore:** focusing synchronously during unmount competes with the browser's own focus handling and with any exit animation still holding the element. Deferring by a frame lets the DOM settle so the trigger actually receives focus.

**Why "restore to `document.activeElement` at open" beats "restore to the trigger":** the component may have been opened programmatically from a menu item, a keyboard shortcut or a toast. Whatever had focus is what the user expects to return to.

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

**Why good:** The list is recomputed on every Tab, so content that appears while the dialog is open is included. Trapping only at the boundaries leaves normal Tab behavior -- including the browser's own ordering rules -- untouched in between.

**Why a trap is only for modal surfaces:** trapping focus in a non-modal popover strands the user, who legitimately expects Tab to move on to the page. Gate the trap on the `modal` prop, and make that prop's default match the role.

---

## Roving Tabindex

In a composite widget -- listbox, menu, toolbar, tab list -- the whole widget is one tab stop, and arrow keys move within it.

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
      const nextIndex = resolveIndex(
        direction,
        currentIndex,
        items.length,
        loop,
      );
      const next = items[nextIndex];
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

  return { activeId, onKeyDown };
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

Each item is tabbable only when it is the active one:

```tsx
<div
  role="option"
  tabIndex={isActive ? 0 : -1}
  data-highlighted={isActive ? "" : undefined}
/>
```

**Why good:** Tab enters and leaves the widget in one press regardless of item count. Disabled items are filtered before indexing, so they are skipped without a gap in the sequence. `preventDefault` runs only for keys that were handled, so unhandled keys still reach the consumer and the browser. `scrollIntoView({ block: "nearest" })` keeps the active item visible without yanking the viewport when it already is.

**Why every-item-tabbable is bad:** a forty-option listbox becomes forty tab stops. Keyboard users cannot get past the widget, and screen reader users lose the "one control" mental model the role promises.

**Why index state is bad:** storing the active _index_ rather than the active _id_ breaks the moment the list is filtered or reordered -- the index still points somewhere, just not at the item the user was on. Ids survive reordering.

### Focus Versus `aria-activedescendant`

| Approach                | Focus lives on  | Use when                                                          |
| ----------------------- | --------------- | ----------------------------------------------------------------- |
| Roving tabindex         | The active item | Items are the interactive elements (menu, toolbar, tab list)      |
| `aria-activedescendant` | The container   | A text input must keep focus while a list is navigated (combobox) |

Pick per widget role. Mixing them -- moving DOM focus _and_ setting `aria-activedescendant` -- makes screen readers announce twice.

---

## Typeahead

Any list a user can navigate by arrow keys should also be navigable by typing.

```tsx
const TYPEAHEAD_RESET_MS = 500;

interface TypeaheadItem extends Descendant {
  /** Registered by the ItemText part -- never read from element.textContent. */
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

**Why good:** The buffer accumulates within the reset window, so "se" finds "Settings" rather than jumping to the first item starting with "e". Modifier combinations are excluded so `Ctrl+S` is not swallowed. The scan starts from the active item and wraps, so repeatedly typing "s" cycles through every item starting with "s" instead of pinning the first one. `preventDefault` fires only on a match, so a space that matched nothing still activates the focused item.

**Where the text comes from:** the item's rendered content may include badges, icons and descriptions, so `element.textContent` is the wrong source. This is exactly why an `ItemText` part exists -- the consumer marks which text is the label, and typeahead reads that. Falling back to `textContent` makes typeahead match a badge.

---

## Escape and Dismissal Ownership

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

**Why good:** The listener is on `document`, so Escape works even when focus is inside a portaled child or a nested iframe-free subtree. The change is routed through the same `setOpen` as every other dismissal, so it carries a reason and honors `cancel()`.

**The nesting problem:** two open layers both listening on `document` both close on one Escape. The fix is an ownership stack -- each layer registers on open, and only the top of the stack handles the key. Nesting is the normal case for dialogs containing selects, so a component that owns Escape must also own the stack.
