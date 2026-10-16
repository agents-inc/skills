# Composable Components — Core Examples

> Full code for Patterns 1–3 in [SKILL.md](../SKILL.md). Patterns 4–5 are in [state-contract.md](state-contract.md), 6–7 in [polymorphism.md](polymorphism.md), 8 in [accessibility-structure.md](accessibility-structure.md); lookup tables are in [reference.md](../reference.md).

**Helpers defined elsewhere:** `useControllableState`, `ChangeEventDetails` and `createChangeEventDetails` in [state-contract.md](state-contract.md); `composeEventHandlers` and `composeRefs` in [polymorphism.md](polymorphism.md); `useRegisteredId` in [accessibility-structure.md](accessibility-structure.md). Parts take `ref` as a prop and render `<Context value>`, both React 19; under React 18 see [ref forwarding across versions](polymorphism.md#ref-forwarding-across-react-versions).

---

## Pattern 1: Compound Parts Over Configuration Props

### Before: the configuration monolith

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

// The render makes every layout decision itself
<div className={`dialog dialog--${size}`} role="dialog" aria-modal="true">
  <header className="dialog__header">
    <h2 className="dialog__title">{title}</h2>
    {showCloseButton && (
      <button aria-label={closeButtonLabel} onClick={onClose}>
        x
      </button>
    )}
  </header>
  <div className="dialog__body">{children}</div>
  {renderFooter && (
    <footer className="dialog__footer">{renderFooter(onClose)}</footer>
  )}
</div>;
```

**Why bad:** Nine props, and none covers the next request. The heading is locked to `h2`; the close button to the header, its markup and its position. `renderFooter` is `children` with a callback bolted on because the footer needs `onClose` — a hole punched through the API where context was not used. Every class is a visual decision the consumer has to out-specify. There is no `defaultOpen`, so a self-managing dialog is impossible, and focus is never moved or restored.

### After: parts sharing context

```tsx
import { createContext, useId, useMemo, useState } from "react";

type DialogChangeReason =
  | "trigger-press"
  | "close-press"
  | "outside-press"
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
// The guarded read, useDialogContext(part), is Pattern 3.

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

  return <DialogContext value={context}>{children}</DialogContext>;
}
```

Each part reads the context, wires its own element, and forwards everything else.

```tsx
function DialogTrigger({ ref, ...props }: React.ComponentProps<"button">) {
  const { open, setOpen, triggerId } = useDialogContext("Trigger");

  return (
    <button
      type="button"
      {...props}
      ref={ref}
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
}

function DialogPopup({ ref, ...props }: React.ComponentProps<"div">) {
  const { open, titleId } = useDialogContext("Popup");
  if (!open) return null;

  return (
    <div
      {...props}
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={props["aria-labelledby"] ?? titleId}
      data-state="open"
    />
  );
}

function DialogTitle({ ref, ...props }: React.ComponentProps<"h2">) {
  const { registerTitleId } = useDialogContext("Title");
  const id = useRegisteredId(registerTitleId, props.id);

  return <h2 {...props} ref={ref} id={id} />;
}

function DialogClose({ ref, ...props }: React.ComponentProps<"button">) {
  const { setOpen } = useDialogContext("Close");

  return (
    <button
      type="button"
      {...props}
      ref={ref}
      onClick={composeEventHandlers(props.onClick, (event) =>
        setOpen(
          false,
          createChangeEventDetails("close-press", event.nativeEvent),
        ),
      )}
    />
  );
}

// DialogPortal and DialogBackdrop follow the same shape: read the context,
// render one element, forward everything else.

export const Dialog = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Portal: DialogPortal,
  Backdrop: DialogBackdrop,
  Popup: DialogPopup,
  Title: DialogTitle,
  Close: DialogClose,
};
export type { DialogChangeDetails, DialogChangeReason, DialogRootProps };
```

**Why good:** Every prop that disappeared came back as a rearrangement. `showCloseButton` is "render a `Dialog.Close` or don't"; `closeButtonLabel` is the consumer's `aria-label` on their own button; `hideBackdrop` is "render a `Dialog.Backdrop` or don't"; `size` is the consumer's class on `Dialog.Popup`. `renderFooter` is children — and a `Dialog.Close` inside that footer gets `setOpen` from context, so the callback hole is gone. The `Root` still owns open state, the id relationship between `Title` and `Popup` ([Pattern 8](accessibility-structure.md#id-wiring-through-context)) and the `aria-*` wiring.

### Usage: two layouts, no API change

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

// Controlled, opened from elsewhere, with a form wrapping the content
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

The second layout — a `<form>` between the popup and its content, with the close button in a footer the component never knew about — is the shape that forces a monolith to grow a prop.

---

## Pattern 2: Children as Composition

### Before: the items array

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

**Why bad:** `SelectOption` is a private markup language. Every design request extends it — a badge, a trailing shortcut, a two-line layout, a nested group — and every extension changes a type each call site constructs. `renderOption` escapes the type but renders outside the component's context, so a custom option cannot reach selection state unless it is passed back through the callback. `groupBy` reimplements nesting as a string; `emptyMessage` reimplements conditional rendering as a prop.

### After: items as children

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

**Why good:** The badge, the icon, the empty state and the grouping are ordinary JSX. `Select.ItemText` marks which text is the item's label for typeahead and for the trigger's value display — the one piece of structure the component genuinely needs, so it asks for exactly that. Selection, keyboard navigation and `aria-activedescendant` stay with the `Root`.

### The descendant registry

Children cost the component its free knowledge of item order: it builds the collection itself, sorted by DOM position rather than mount order.

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

  const getOrderedItems = useCallback(
    () => [...itemsRef.current.values()].sort(byDocumentPosition),
    [],
  );

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

Each item registers once its node exists, and the returned cleanup unregisters it:

```tsx
function SelectItem({
  ref,
  value,
  disabled = false,
  ...props
}: SelectItemProps) {
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
      ref={composeRefs(ref, localRef)}
      id={id}
      data-value={value}
      data-disabled={disabled ? "" : undefined}
    />
  );
}
```

**Why good:** Order is read from the DOM when it is needed, so conditional items, lazily loaded groups, Suspense boundaries and reordered lists all resolve correctly. Registration returns its own cleanup, so there is no separate unregister call to forget, and the consumer's ref still reaches the node through `composeRefs`.

**Why mount-order registration is bad:**

```tsx
// BAD: index assigned at mount time
const index = itemsRef.current.length;
itemsRef.current.push({ value, index });
```

Mount order equals DOM order only until something renders late — a lazily loaded group, an item behind a Suspense boundary, an item re-mounted after a filter. Arrow keys then move to a position that does not match what the user sees, and nothing throws.

---

## Pattern 3: Context Scoping

### The guard

```tsx
function useDialogContext(part: string): DialogContextValue {
  const context = useContext(DialogContext);
  if (context === null) {
    throw new Error(
      `<Dialog.${part}> must be rendered inside <Dialog.Root>. ` +
        `Wrap the tree containing <Dialog.${part}> in <Dialog.Root>.`,
    );
  }
  return context;
}
```

**Why good:** `null` is the only default that cannot be mistaken for a working component. The message names the offending part, so the fix is obvious in a tree with a dozen parts, and says what to do rather than only what went wrong.

### A default that no-ops

```tsx
// BAD: an orphaned part renders and does nothing
const DialogContext = createContext<DialogContextValue>({
  open: false,
  setOpen: () => {},
  triggerId: "",
  titleId: undefined,
  registerTitleId: () => {},
});
```

**Why bad:** An orphaned `Dialog.Close` renders, styles correctly, responds to hover, and does nothing when clicked. No error, no warning — it looks right in every screenshot and snapshot, so the bug reaches production.

### Memoizing the value

`DialogRoot` in Pattern 1 memoizes its value on the state the value contains. Without that, the object is new on every render and every part re-renders with it:

```tsx
// BAD: new identity every render
<DialogContext value={{ open: isOpen, setOpen: setIsOpen, triggerId, titleId, registerTitleId }}>
```

The functions inside must themselves be stable — a `useState` setter, a `useCallback` with a stable dependency list, or a ref-held handler — or the memo is decorative. Where the React Compiler runs over the component's source it memoizes this for you; a published library gets that by running the compiler in its own build.

### Splitting hot and cold context

When one value changes on every keystroke and another never does, one context re-renders the stable consumers with the volatile ones.

```tsx
// Cold: identities and callbacks — effectively never changes
const SelectActionsContext = createContext<SelectActions | null>(null);
// Hot: the highlighted item — changes on every arrow key
const SelectHighlightContext = createContext<string | null>(null);
```

**Why good:** `Select.Trigger` and `Select.Group` read only the cold context and stop re-rendering during keyboard navigation; only the items update. Do it when a profile shows the cost — two contexts are two things to keep in sync, and a five-item component does not need it.

### Nesting resolves itself

A `Root` inside another `Root` needs no special handling: context shadowing already gives the inner parts the inner provider. The problem worth designing for is a part of primitive A rendered inside primitive B where both want the Escape key or focus — solve it with explicit ownership (an innermost-wins dismissal stack, [Pattern 8](accessibility-structure.md#escape-and-dismissal-ownership)), not by making the contexts aware of each other.
