# Radix UI Reference

> Anti-patterns with code, checklists and API lookup. See [SKILL.md](SKILL.md) for the decisions and
> [examples/](examples/) for full implementations. Current major: v1.4.x.

---

## Decision Frameworks

### Controlled or uncontrolled

| You need                                       | Use                     |
| ---------------------------------------------- | ----------------------- |
| Close after an async operation resolves        | `open` + `onOpenChange` |
| Open from something other than the Trigger     | `open` + `onOpenChange` |
| Mirror open state into the URL or a store      | `open` + `onOpenChange` |
| React to opening or closing, without owning it | `onOpenChange` alone    |
| Nothing outside the component cares            | `defaultOpen`           |

### Animation approach

| Animation                   | Approach                                                                        |
| --------------------------- | ------------------------------------------------------------------------------- |
| Fade, slide, scale          | CSS `@keyframes` on `[data-state]`                                              |
| Height or width of a region | CSS `@keyframes` reading `--radix-*-content-height/-width`                      |
| Orchestrated, interruptible | `forceMount` on Portal, Overlay and Content, driven by a presence-aware runtime |
| None                        | Nothing — Radix mounts and unmounts on its own                                  |

---

## Anti-Patterns

### A custom `asChild` child that cannot receive a ref

Radix attaches a ref to position floating content and to return focus on close.

```tsx
// WRONG — no ref reaches the DOM node
const CustomButton = ({ children, onClick }) => (
  <button onClick={onClick}>{children}</button>
);

// CORRECT (React 19) — ref is an ordinary prop
function CustomButton({ ref, ...props }: ButtonProps) {
  return <button ref={ref} {...props} />;
}

// CORRECT (React 18 and below)
const CustomButton = forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => <button ref={ref} {...props} />,
);
CustomButton.displayName = "CustomButton";
```

### Props destructured but not spread

Everything Radix passes down — `onClick`, `aria-expanded`, `data-state` — arrives in the rest
object. Naming a few props and dropping the rest silently disconnects the trigger.

```tsx
// WRONG — Radix's handlers and ARIA attributes never reach the element
function CustomButton({ ref, className, children }: Props) {
  return (
    <button ref={ref} className={className}>
      {children}
    </button>
  );
}

// CORRECT
function CustomButton({ ref, className, children, ...props }: Props) {
  return (
    <button ref={ref} className={className} {...props}>
      {children}
    </button>
  );
}
```

### `transition` for an exit animation

Unmount is suspended on `animationend`. A transition fires no such event, so the element is removed
immediately and the exit is never seen.

```css
/* WRONG */
.dialog-content {
  transition: opacity 150ms ease;
}
.dialog-content[data-state="closed"] {
  opacity: 0;
}

/* CORRECT */
.dialog-content[data-state="closed"] {
  animation: fadeOut 150ms ease-in;
}
@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
```

### Overlay content outside `Portal`

```tsx
// WRONG — clipped by any ancestor with overflow: hidden
<Dialog.Root>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Overlay />
  <Dialog.Content>Content</Dialog.Content>
</Dialog.Root>

// CORRECT
<Dialog.Root>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content>Content</Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

### Dialog where AlertDialog is meant

Dialog dismisses on click-outside and Escape. A destructive action wants neither.

```tsx
// WRONG — one stray click away from deleting the account
<Dialog.Root>
  <Dialog.Trigger>Delete account</Dialog.Trigger>
  <Dialog.Content>
    <button>Delete</button>
  </Dialog.Content>
</Dialog.Root>

// CORRECT — Cancel or Action, nothing else
<AlertDialog.Root>
  <AlertDialog.Trigger>Delete account</AlertDialog.Trigger>
  <AlertDialog.Content>
    <AlertDialog.Title>Delete account?</AlertDialog.Title>
    <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
    <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
    <AlertDialog.Action>Delete</AlertDialog.Action>
  </AlertDialog.Content>
</AlertDialog.Root>
```

### Hand-managed `z-index` on portalled content

Radix orders layered primitives against each other. A fixed `z-index` opts one of them out of that
ordering, and it then wins or loses against every other overlay by accident. Where a portalled layer
must sit above surrounding page chrome, put `isolation: isolate` on the container rather than a
number on the content.

---

## Checklists

### A custom component used with `asChild`

- [ ] Receives `ref` — as a prop under React 19, through `forwardRef` below it
- [ ] Spreads its remaining props onto the DOM element
- [ ] Renders exactly one element (Slot merges onto a single child)

### Dialog and AlertDialog

- [ ] `Portal` wraps `Overlay` and `Content`
- [ ] `Title` present, visually hidden where the design has no heading
- [ ] `Description` present, or `aria-describedby={undefined}` on `Content`
- [ ] AlertDialog, not Dialog, for anything destructive
- [ ] Destructive dialogs open focused on Cancel via `onOpenAutoFocus`
- [ ] A glyph-only `Close` carries an `aria-label` — otherwise it is announced as an empty button

### Animation

- [ ] `@keyframes`, not `transition`
- [ ] Both `[data-state="open"]` and `[data-state="closed"]` defined
- [ ] `forceMount` on Portal, Overlay and Content when a JavaScript runtime owns the exit
- [ ] `--radix-*-content-height` read only inside a keyframe

---

## API Lookup

### Overlay part structure

```
Root                    # state and context
├── Trigger             # opens it
└── Portal              # renders outside the layout
    ├── Overlay         # backdrop (dialogs)
    └── Content         # container
        ├── Title       # accessible name (required on dialogs)
        ├── Description # accessible description
        └── Close       # dismisses it
```

### CSS variables

| Component    | Variable                                         | Purpose                         |
| ------------ | ------------------------------------------------ | ------------------------------- |
| Accordion    | `--radix-accordion-content-height`               | Content height during animation |
| Accordion    | `--radix-accordion-content-width`                | Content width during animation  |
| Collapsible  | `--radix-collapsible-content-height`             | Content height during animation |
| Collapsible  | `--radix-collapsible-content-width`              | Content width during animation  |
| Select       | `--radix-select-trigger-width`                   | Trigger width                   |
| Select       | `--radix-select-trigger-height`                  | Trigger height                  |
| Select       | `--radix-select-content-available-width`         | Space available to the content  |
| Select       | `--radix-select-content-available-height`        | Space available to the content  |
| Select       | `--radix-select-content-transform-origin`        | Transform origin                |
| Popover      | `--radix-popover-content-transform-origin`       | Transform origin                |
| Tooltip      | `--radix-tooltip-content-transform-origin`       | Transform origin                |
| DropdownMenu | `--radix-dropdown-menu-content-transform-origin` | Transform origin                |

### v1.4.x changes

| Change                 | Effect                                                           |
| ---------------------- | ---------------------------------------------------------------- |
| React 19 support       | `ref` is an ordinary prop; `forwardRef` wrappers are optional    |
| RSC compatibility      | Primitives load under React Server Components                    |
| Escape key capture     | Escape is captured before reaching browser hotkeys               |
| Dialog console output  | Error for a missing `Title`, warning for a missing `Description` |
| `hideWhenDetached`     | Blocks interaction once the anchor has left the viewport         |
| Progress indeterminate | `value={undefined}` is explicitly supported                      |
| CSP `nonce`            | `Select` and `ScrollArea` accept a `nonce` for inline styles     |
| Form bubble inputs     | Form controls render through the shared Primitive component      |
| Avatar `crossOrigin`   | `crossOrigin` forwarded to the underlying image                  |

### Preview primitives

| Primitive            | Export                          | Use case                                            |
| -------------------- | ------------------------------- | --------------------------------------------------- |
| OneTimePasswordField | `unstable_OneTimePasswordField` | OTP entry with keyboard navigation, paste, autofill |
| PasswordToggleField  | `unstable_PasswordToggleField`  | Password visibility toggle with focus return        |
| Form                 | `unstable_Form`                 | Validation over the native constraint API           |

The `unstable_` prefix is a statement about the API rather than the implementation: these ship and
work, and their props change between minor versions. See [examples/preview.md](examples/preview.md).

Parts and props the examples do not exercise:

| Primitive            | Also carries                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| OneTimePasswordField | `sanitizeValue` to transform each entered character; `disabled`, `readOnly` and `placeholder` on `Input`         |
| PasswordToggleField  | `data-visible` on the parts, for styling the revealed state; `Slot` for rendering the toggle's contents yourself |
| Form                 | `ValidityState`, a render-prop part exposing the control's raw `ValidityState` object                            |

#### OneTimePasswordField keyboard map

| Key             | Behaviour                        |
| --------------- | -------------------------------- |
| Arrow keys      | Move between inputs              |
| Home / End      | Jump to first / last input       |
| Backspace       | Clear current, move focus left   |
| Delete          | Clear current, shift values back |
| Cmd + Backspace | Clear every input                |
| Tab / Shift+Tab | Leave the field entirely         |
| Enter           | Submit the associated form       |

#### Form `match` values

Each maps onto a flag of the browser's own `ValidityState`.

| Match             | Fires when                              |
| ----------------- | --------------------------------------- |
| `valueMissing`    | A `required` field is empty             |
| `typeMismatch`    | The value is not a valid email, url, …  |
| `tooShort`        | Below `minLength`                       |
| `tooLong`         | Above `maxLength`                       |
| `rangeUnderflow`  | Below `min`                             |
| `rangeOverflow`   | Above `max`                             |
| `stepMismatch`    | Not on a `step` boundary                |
| `patternMismatch` | Does not match `pattern`                |
| `badInput`        | The control cannot parse what was typed |

A function may be passed instead, receiving `(value, formData)` and optionally returning a promise.
