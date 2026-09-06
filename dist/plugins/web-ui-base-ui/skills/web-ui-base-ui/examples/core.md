# Base UI - Core Examples

> Anatomy, Portal and Positioner mechanics, and popup positioning. See [composition.md](composition.md) for `render`, [styling.md](styling.md) for state styling, [state.md](state.md) for controlled state, [forms.md](forms.md) for fields.

---

## Pattern 1: Part Anatomy

### Good Example - A Complete Popover

```tsx
import { Popover } from "@base-ui/react/popover";

export function HelpPopover({ children }: { children: React.ReactNode }) {
  return (
    <Popover.Root>
      <Popover.Trigger className="trigger">Help</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={16}
        >
          <Popover.Popup className="popup">
            <Popover.Arrow className="arrow" />
            <Popover.Viewport>
              <Popover.Title className="title">
                Keyboard shortcuts
              </Popover.Title>
              <Popover.Description className="description">
                Press <kbd>?</kbd> anywhere to reopen this panel.
              </Popover.Description>
              {children}
              <Popover.Close className="close" aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </Popover.Close>
            </Popover.Viewport>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

**Why good:** every part carries its own class so each can be styled independently, positioning props sit on `Positioner` where the transform is applied, `Popup` stays free for your own transforms and animations, `Viewport` keeps content from jumping while the popup resizes, `Title` and `Description` produce the ARIA relationships automatically

### Bad Example - Positioning Props on the Wrong Part

```tsx
// Positioning props are not part of Popup's API
<Popover.Portal>
  <Popover.Popup side="top" sideOffset={8} className="popup">
    Content
  </Popover.Popup>
</Popover.Portal>
```

**Why bad:** `Positioner` is missing so nothing computes a position or handles collisions, `side` and `sideOffset` fall through to the DOM node as unknown attributes and React warns about them, the popup renders at the portal container's natural position instead of near its anchor

---

## Pattern 1a: Portal Container and keepMounted

### Good Example - Rendering Into a Specific Subtree

```tsx
import { useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";

export function ScopedDialog() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  return (
    <>
      {/* Portal target inside a shadow-root, iframe or micro-frontend boundary */}
      <div ref={setContainer} />

      <Dialog.Root>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Portal container={container}>
          <Dialog.Backdrop className="backdrop" />
          <Dialog.Popup className="popup">
            <Dialog.Title>Scoped</Dialog.Title>
            <Dialog.Close>Done</Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
```

**Why good:** a state setter as the ref callback re-renders once the node exists, so `container` is never `null` on the render that matters, the portal target is opt-in rather than assumed to be `document.body`

### Bad Example - Reading a Ref Object During Render

```tsx
const containerRef = useRef<HTMLDivElement>(null);

<Dialog.Portal container={containerRef.current}>  {/* null on first render */}
```

**Why bad:** `containerRef.current` is `null` during the first render and reading it does not schedule a re-render, so the portal silently falls back to the default container and never moves

**On `keepMounted`:** it defaults to `false` and should stay that way unless an external animation library owns the unmount. Leaving hidden popup markup in the DOM keeps it in the accessibility tree and in every `querySelectorAll` your app runs.

---

## Pattern 2: Menus and Nested Parts

### Good Example - Menu with Groups, Submenu and Checkbox Items

```tsx
import { Menu } from "@base-ui/react/menu";

export function ViewMenu({
  showGrid,
  onShowGridChange,
}: {
  showGrid: boolean;
  onShowGridChange: (next: boolean) => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger className="trigger">View</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="start">
          <Menu.Popup className="popup">
            <Menu.Arrow className="arrow" />

            <Menu.Group>
              <Menu.GroupLabel className="group-label">Layout</Menu.GroupLabel>
              <Menu.CheckboxItem
                className="item"
                checked={showGrid}
                onCheckedChange={onShowGridChange}
                closeOnClick={false}
              >
                <Menu.CheckboxItemIndicator>
                  <span aria-hidden="true">&#10003;</span>
                </Menu.CheckboxItemIndicator>
                Show grid
              </Menu.CheckboxItem>
            </Menu.Group>

            <Menu.Separator className="separator" />

            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger className="item">Zoom</Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup className="popup">
                    <Menu.Item className="item">Zoom in</Menu.Item>
                    <Menu.Item className="item">Zoom out</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>

            <Menu.LinkItem className="item" href="/docs/view">
              Documentation
            </Menu.LinkItem>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
```

**Why good:** `closeOnClick={false}` keeps a toggle menu open so the user can flip several switches, `LinkItem` produces a real anchor with menu keyboard behaviour instead of an item wrapping an anchor, submenus repeat the full `Portal > Positioner > Popup` skeleton so they collide independently of the parent

### Bad Example - Wrapping an Anchor in an Item

```tsx
<Menu.Item>
  <a href="/docs/view">Documentation</a>
</Menu.Item>
```

**Why bad:** the item and the anchor are two focusable-ish elements with conflicting roles, keyboard activation fires the item's handler without following the link, and screen readers announce a menu item that contains a link rather than a link that is a menu item — use `Menu.LinkItem`, or `render={<a href="…" />}` on the item

---

## Pattern 3: Positioning and Collision Handling

### Good Example - Collision-Aware Popup CSS

```css
.popup {
  /* Never taller than the space the positioner found */
  max-height: var(--available-height);
  overflow-y: auto;
}

/* Grow out of the edge the popup is actually attached to */
.popup[data-side="top"] {
  transform-origin: bottom center;
}
.popup[data-side="bottom"] {
  transform-origin: top center;
}
.popup[data-side="inline-start"] {
  transform-origin: right center;
}
.popup[data-side="inline-end"] {
  transform-origin: left center;
}

/* Align-aware corners so the popup visually hangs off the correct end */
.popup[data-align="start"] {
  border-start-start-radius: 0;
}
.popup[data-align="end"] {
  border-start-end-radius: 0;
}

/* Collision handling pushed the popup; the arrow no longer points at the anchor */
.arrow[data-uncentered] {
  visibility: hidden;
}
```

**Why good:** `--available-height` scales with the real viewport rather than a guessed pixel value, `data-side` reflects the side the popup actually landed on after flipping, `data-uncentered` is handled instead of leaving an arrow pointing at empty space

### Good Example - Matching the Trigger's Width

```css
.select-popup {
  min-width: var(--anchor-width);
  max-height: var(--available-height);
}
```

**Why good:** `--anchor-width` tracks the trigger through resizes and content changes; a JavaScript measurement would need a `ResizeObserver` to stay correct

### Good Example - Anchoring Somewhere Other Than the Trigger

```tsx
import { useState } from "react";
import { Popover } from "@base-ui/react/popover";

export function SelectionPopover({ anchor }: { anchor: HTMLElement | null }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Portal>
        {/* Positions against an arbitrary element instead of a trigger */}
        <Popover.Positioner anchor={anchor} side="top" positionMethod="fixed">
          <Popover.Popup className="popup">Formatting</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

**Why good:** `anchor` decouples the popup from any trigger, which is how selection toolbars and cursor-following popups are built, `positionMethod="fixed"` survives a transformed or `contain`-ed ancestor that would otherwise break absolute positioning

### Bad Example - Transforming the Positioner

```css
/* The positioner carries the computed placement transform */
.positioner {
  transform: translateY(-4px) scale(0.96);
}
```

**Why bad:** the placement transform is overwritten, so the popup jumps to the top-left of its containing block and every collision recalculation fights the override — put your own transforms on `.popup`, or express the gap as `sideOffset`
