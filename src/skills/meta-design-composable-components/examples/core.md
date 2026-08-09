# Composable Components - Core Patterns

> Compound components over configuration props, children as composition, context scoping with clear out-of-Root errors, and the descendant registry that makes children-as-composition work. See [SKILL.md](../SKILL.md) for decision frameworks and [reference.md](../reference.md) for the translation tables.

**Helpers used here and defined elsewhere:** `useControllableState` and `createChangeEventDetails` in [state-contract.md](state-contract.md); `composeEventHandlers` and `composeRefs` in [polymorphism.md](polymorphism.md).

---

## Compound Components: Before/After

### Before: The Configuration Monolith

```tsx
interface DialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly size?: "sm" | "md" | "lg";
  readonly showCloseButton?: boolean;
  readonly closeButtonLabel?: string;
  readonly hideBackdrop?: boolean;
  readonly renderFooter?: (close: () => void) => React.ReactNode;
  readonly children: React.ReactNode;
}

function Dialog({
  open,
  onClose,
  title,
  description,
  size = "md",
  showCloseButton = true,
  closeButtonLabel = "Close",
  hideBackdrop = false,
  renderFooter,
  children,
}: DialogProps) {
  if (!open) return null;

  return (
    <div className="dialog-layer">
      {!hideBackdrop && <div className="dialog-backdrop" onClick={onClose} />}
      <div className={`dialog dialog--${size}`} role="dialog" aria-modal="true">
        <header className="dialog__header">
          <h2 className="dialog__title">{title}</h2>
          {showCloseButton && (
            <button aria-label={closeButtonLabel} onClick={onClose}>
              x
            </button>
          )}
        </header>
        {description && <p className="dialog__description">{description}</p>}
        <div className="dialog__body">{children}</div>
        {renderFooter && (
          <footer className="dialog__footer">{renderFooter(onClose)}</footer>
        )}
      </div>
    </div>
  );
}
```

**Why bad:** Nine props to render one dialog, and none of them cover the next request. The heading is locked to `h2`. The close button is locked to the header, to that markup, and to that position. `renderFooter` is `children` with a callback bolted on because the footer needs `onClose` -- a hole punched through the API because context was not used. Every class name is a visual decision the consumer cannot undo without out-specifying it. There is no `defaultOpen`, so a dialog that manages itself is impossible. Focus is never moved or restored.

### After: Compound Parts Sharing Context

```tsx
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

type DialogChangeReason =
  | "trigger-press"
  | "close-press"
  | "backdrop-press"
  | "escape-key";
type DialogChangeDetails = ChangeEventDetails<DialogChangeReason>;

interface DialogContextValue {
  readonly open: boolean;
  readonly setOpen: (open: boolean, details: DialogChangeDetails) => void;
  readonly triggerId: string;
  readonly titleId: string | undefined;
  readonly registerTitleId: (id: string | undefined) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(part: string): DialogContextValue {
  const context = useContext(DialogContext);
  if (context === null) {
    throw new Error(`<Dialog.${part}> must be rendered inside <Dialog.Root>.`);
  }
  return context;
}

interface DialogRootProps {
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean, details: DialogChangeDetails) => void;
  readonly children: React.ReactNode;
}

function DialogRoot({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
}: DialogRootProps) {
  const [isOpen, setIsOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
    componentName: "<Dialog.Root>",
  });
  const [titleId, registerTitleId] = useState<string | undefined>(undefined);
  const triggerId = useId();

  const context = useMemo<DialogContextValue>(
    () => ({
      open: isOpen,
      setOpen: setIsOpen,
      triggerId,
      titleId,
      registerTitleId,
    }),
    [isOpen, setIsOpen, triggerId, titleId],
  );

  return (
    <DialogContext.Provider value={context}>{children}</DialogContext.Provider>
  );
}
```

The parts are thin: each reads the context, wires its own element, and forwards everything else.

```tsx
const DialogTrigger = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button">
>(function DialogTrigger(props, forwardedRef) {
  const { open, setOpen, triggerId } = useDialogContext("Trigger");

  return (
    <button
      type="button"
      {...props}
      ref={forwardedRef}
      id={props.id ?? triggerId}
      aria-haspopup="dialog"
      aria-expanded={open}
      data-state={open ? "open" : "closed"}
      onClick={composeEventHandlers(props.onClick, (event) =>
        setOpen(
          true,
          createChangeEventDetails("trigger-press", event.nativeEvent),
        ),
      )}
    />
  );
});

const DialogPopup = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(function DialogPopup(props, forwardedRef) {
  const { open, titleId } = useDialogContext("Popup");
  if (!open) return null;

  return (
    <div
      {...props}
      ref={forwardedRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-state="open"
    />
  );
});

const DialogTitle = forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<"h2">
>(function DialogTitle(props, forwardedRef) {
  const { registerTitleId } = useDialogContext("Title");
  const generatedId = useId();
  const id = props.id ?? generatedId;

  useEffect(() => {
    registerTitleId(id);
    return () => registerTitleId(undefined);
  }, [id, registerTitleId]);

  return <h2 {...props} ref={forwardedRef} id={id} />;
});

const DialogClose = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button">
>(function DialogClose(props, forwardedRef) {
  const { setOpen } = useDialogContext("Close");

  return (
    <button
      type="button"
      {...props}
      ref={forwardedRef}
      onClick={composeEventHandlers(props.onClick, (event) =>
        setOpen(
          false,
          createChangeEventDetails("close-press", event.nativeEvent),
        ),
      )}
    />
  );
});

// DialogPortal and DialogBackdrop follow the same shape: read the context,
// render one element, forward everything else.

const Dialog = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Portal: DialogPortal,
  Backdrop: DialogBackdrop,
  Popup: DialogPopup,
  Title: DialogTitle,
  Close: DialogClose,
};

export { Dialog };
export type { DialogChangeDetails, DialogChangeReason, DialogRootProps };
```

**Why good:** Every prop that disappeared came back as a rearrangement. `showCloseButton` is "render a `Dialog.Close` or don't". `closeButtonLabel` is the consumer's own `aria-label` on their own button. `hideBackdrop` is "render a `Dialog.Backdrop` or don't". `size` is the consumer's class name on `Dialog.Popup`. `renderFooter` is children -- and a `Dialog.Close` inside that footer gets `setOpen` from context, so the callback hole is gone. The heading level, the markup, the order and the wrappers are all the consumer's. The `Root` still owns open state, the id relationship between `Title` and `Popup`, and the `aria-*` wiring, so nothing accessible was traded for the flexibility.

**Note the id registration.** `aria-labelledby` is `undefined` when no `Dialog.Title` is rendered, rather than pointing at an id that does not exist. A dangling `aria-labelledby` leaves the dialog with no accessible name at all -- worse than omitting it, because assistive technology stops looking.

---

## Usage: Two Layouts, No API Change

```tsx
// Self-managing: no state in the consumer at all
<Dialog.Root>
  <Dialog.Trigger>Settings</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Backdrop />
    <Dialog.Popup>
      <Dialog.Title>Settings</Dialog.Title>
      <SettingsForm />
      <Dialog.Close>Done</Dialog.Close>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>

// Controlled, opened from elsewhere, with a form wrapping the popup
<Dialog.Root open={isConfirming} onOpenChange={setIsConfirming}>
  <Dialog.Portal>
    <Dialog.Popup>
      <form onSubmit={handleDelete}>
        <Dialog.Title>Delete project</Dialog.Title>
        <footer>
          <Dialog.Close>Cancel</Dialog.Close>
          <button type="submit">Delete</button>
        </footer>
      </form>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

Neither layout required an API change, and the second one -- a `<form>` between the popup and its content, with the close button in a footer the component never knew about -- is the exact shape that forces a monolith to grow a prop.

---

## Children as Composition, Not `items={[...]}`

### Before: The Items Array

```tsx
interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly icon?: React.ReactNode;
  readonly description?: string;
  readonly disabled?: boolean;
  readonly group?: string;
}

interface SelectProps {
  readonly options: readonly SelectOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly groupBy?: "group";
  readonly renderOption?: (option: SelectOption) => React.ReactNode;
  readonly emptyMessage?: string;
  readonly showIcons?: boolean;
}
```

**Why bad:** `SelectOption` is a private markup language. Every design request extends it -- a badge, a trailing shortcut, a two-line layout, a nested group -- and every extension is a breaking change to a type that every call site constructs. `renderOption` exists to escape the type, but it renders outside the component's context, so a custom option cannot reach selection state without it being passed back through the callback. `groupBy` reimplements nesting as a string. `emptyMessage` reimplements conditional rendering as a prop.

### After: Items as Children

```tsx
<Select.Root value={framework} onValueChange={setFramework}>
  <Select.Trigger>
    <Select.Value placeholder="Pick a framework" />
  </Select.Trigger>
  <Select.Portal>
    <Select.Positioner>
      <Select.Popup>
        <Select.Group>
          <Select.GroupLabel>Stable</Select.GroupLabel>
          <Select.Item value="react">
            <ReactMark />
            <Select.ItemText>React</Select.ItemText>
            <Badge tone="neutral">18k</Badge>
          </Select.Item>
        </Select.Group>
        {results.length === 0 && <p role="status">Nothing matches</p>}
      </Select.Popup>
    </Select.Positioner>
  </Select.Portal>
</Select.Root>
```

**Why good:** The badge, the icon, the empty state and the grouping are all ordinary JSX. `Select.ItemText` marks which text is the item's label for typeahead and for the trigger's value display, which is the one piece of structure the component genuinely needs -- so it asks for exactly that, and nothing else. Selection, keyboard navigation and `aria-activedescendant` stay with the `Root`.

---

## The Descendant Registry

Children-as-composition costs the component its free knowledge of item order. It has to build the collection itself, and it has to sort by DOM position rather than mount order.

```tsx
interface Descendant {
  readonly id: string;
  readonly element: HTMLElement;
  readonly value: string;
  readonly disabled: boolean;
}

interface CollectionContextValue {
  readonly register: (descendant: Descendant) => () => void;
  readonly getOrderedItems: () => readonly Descendant[];
}

function useCollection(): CollectionContextValue {
  const itemsRef = useRef(new Map<string, Descendant>());

  const register = useCallback((descendant: Descendant) => {
    itemsRef.current.set(descendant.id, descendant);
    return () => {
      itemsRef.current.delete(descendant.id);
    };
  }, []);

  const getOrderedItems = useCallback(() => {
    return [...itemsRef.current.values()].sort(byDocumentPosition);
  }, []);

  return useMemo(
    () => ({ register, getOrderedItems }),
    [register, getOrderedItems],
  );
}

function byDocumentPosition(a: Descendant, b: Descendant): number {
  const relation = a.element.compareDocumentPosition(b.element);
  if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}
```

Each item registers itself once its node exists, and unregisters on unmount:

```tsx
const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
  function SelectItem({ value, disabled = false, ...props }, forwardedRef) {
    const { register } = useSelectContext("Item");
    const id = useId();
    const localRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
      const element = localRef.current;
      if (element === null) return;
      return register({ id, element, value, disabled });
    }, [register, id, value, disabled]);

    return (
      <div
        role="option"
        {...props}
        ref={composeRefs(forwardedRef, localRef)}
        id={id}
        data-value={value}
        {...(disabled ? { "data-disabled": "" } : null)}
      />
    );
  },
);
```

**Why good:** Order is read from the DOM at the moment it is needed, so conditional items, portals, Suspense boundaries and reordered lists all resolve correctly. Registration returns its own cleanup, so there is no separate unregister call to forget. The item's own ref still reaches the consumer through `composeRefs`.

**Why mount-order registration is bad:**

```tsx
// BAD: index assigned at mount time
const index = itemsRef.current.length;
itemsRef.current.push({ value, index });
```

The first conditional item breaks it. Mount order equals DOM order only until something renders late -- a lazily loaded group, an item behind a Suspense boundary, or an item that re-mounts after a filter. Arrow keys then move to a position that does not match what the user sees, and nothing throws.

---

## Context Scoping and Out-of-Root Errors

### The Guard

```tsx
const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext(part: string): SelectContextValue {
  const context = useContext(SelectContext);
  if (context === null) {
    throw new Error(
      `<Select.${part}> must be rendered inside <Select.Root>. ` +
        `Wrap the tree containing <Select.${part}> in <Select.Root>.`,
    );
  }
  return context;
}
```

**Why good:** `null` is the only default that cannot be mistaken for a working component. The message names the offending part -- not just "Select" -- so the fix is obvious in a tree with a dozen parts, and it says what to do rather than only what went wrong.

### The Anti-Pattern

```tsx
// BAD: a default that silently no-ops
const SelectContext = createContext<SelectContextValue>({
  value: "",
  setValue: () => {},
  register: () => () => {},
});
```

**Why bad:** An orphaned `Select.Item` renders, styles correctly, responds to hover, and does nothing when clicked. There is no error and no warning. The bug reaches production because the component _looks_ right in every screenshot and every snapshot test.

### Memoizing the Value

```tsx
// BAD: new object identity every render -- every part re-renders
return (
  <SelectContext.Provider value={{ value, setValue, register }}>
    {children}
  </SelectContext.Provider>
);

// GOOD: identity changes only when the state does
const context = useMemo(
  () => ({ value, setValue, register }),
  [value, setValue, register],
);
return (
  <SelectContext.Provider value={context}>{children}</SelectContext.Provider>
);
```

For this to be worth doing, the functions in the value must themselves be stable -- `useCallback` with a stable dependency list, or a `useRef`-held mutable box for handlers that change every render. An unstable `setValue` makes the `useMemo` decorative.

### Splitting Hot and Cold Context

When one value changes on every keystroke and another never changes, one context makes the stable consumers re-render with the volatile ones.

```tsx
// Cold: identities and callbacks -- effectively never changes
const SelectActionsContext = createContext<SelectActions | null>(null);
// Hot: the highlighted item -- changes on every arrow key
const SelectHighlightContext = createContext<string | null>(null);
```

**Why good:** `Select.Trigger` and `Select.Group` read only the cold context and stop re-rendering during keyboard navigation. Only the items subscribed to the hot context update. Do this when a profile shows the cost -- two contexts are two things to keep in sync, and a component with five items does not need it.

### Nesting Resolves Itself

A `Root` inside another `Root` needs no special handling: React context shadowing already gives the inner parts the inner provider. The problem worth designing for is the opposite one -- a part of primitive A rendered inside primitive B, where both want to own the Escape key or the focus. Solve that with explicit ownership (an inner-most-wins dismissal stack), not by making the contexts aware of each other.
