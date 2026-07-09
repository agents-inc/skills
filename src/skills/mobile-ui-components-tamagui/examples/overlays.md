# Tamagui - Sheet, Dialog, and Adapt

> Overlay components and responsive adaptation. See [SKILL.md](../SKILL.md) for decision guidance.

---

## Pattern 1: Controlled Sheet with Snap Points

Sheet slides up from the bottom. Use snap points to define positions, and `dismissOnSnapToBottom` for swipe-to-close.

```tsx
import { useState } from "react";
import { Button, Sheet, YStack, SizableText } from "tamagui";

const SNAP_POINTS = [85, 50, 25] as const;
const INITIAL_POSITION = 0;

function BottomSheet() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(INITIAL_POSITION);

  return (
    <>
      <Button onPress={() => setOpen(true)}>Open Sheet</Button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        snapPoints={SNAP_POINTS}
        snapPointsMode="percent"
        position={position}
        onPositionChange={setPosition}
        dismissOnSnapToBottom
        modal
      >
        <Sheet.Overlay />
        <Sheet.Handle />
        <Sheet.Frame padding="$4">
          <YStack gap="$3">
            <SizableText size="$6">Sheet Title</SizableText>
            <SizableText size="$3" color="$gray10">
              Swipe down to dismiss or snap to different positions.
            </SizableText>
          </YStack>
        </Sheet.Frame>
      </Sheet>
    </>
  );
}
```

**Key points:** `snapPoints` array values go from most visible (85%) to least visible (25%), `snapPointsMode="percent"` interprets values as screen percentage, `dismissOnSnapToBottom` closes when swiped past last snap point, `modal` adds overlay and prevents background interaction.

---

## Pattern 2: Sheet with Scrollable Content

Use `Sheet.ScrollView` instead of a regular ScrollView inside Sheet for proper gesture coordination.

```tsx
function ScrollableSheet({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      snapPoints={[80]}
      dismissOnSnapToBottom
      modal
    >
      <Sheet.Overlay />
      <Sheet.Handle />
      <Sheet.Frame>
        <YStack padding="$4" paddingBottom="$0">
          <SizableText size="$5">Scrollable Content</SizableText>
        </YStack>
        {/* Sheet.ScrollView coordinates gestures with sheet drag */}
        <Sheet.ScrollView padding="$4">
          <YStack gap="$2">
            {items.map((item) => (
              <YStack
                key={item}
                padding="$3"
                backgroundColor="$background"
                borderRadius="$2"
              >
                <SizableText>{item}</SizableText>
              </YStack>
            ))}
          </YStack>
        </Sheet.ScrollView>
      </Sheet.Frame>
    </Sheet>
  );
}
```

**Why `Sheet.ScrollView`:** a regular ScrollView captures all vertical gestures, preventing the sheet from being dragged down. `Sheet.ScrollView` coordinates scroll and drag gestures so the sheet dismisses when scrolled to top.

---

## Pattern 3: Dialog with Portal

Dialog renders content in a portal above the rest of the app. Use sub-components for semantic structure.

```tsx
import { Button, Dialog, YStack, SizableText, XStack } from "tamagui";

function ConfirmDialog() {
  return (
    <Dialog modal>
      <Dialog.Trigger asChild>
        <Button>Delete Item</Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          transition="quick"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          opacity={0.5}
        />
        <Dialog.Content
          key="content"
          transition="quick"
          enterStyle={{ opacity: 0, scale: 0.95, y: -10 }}
          exitStyle={{ opacity: 0, scale: 0.95, y: -10 }}
          bordered
          elevate
          padding="$4"
          gap="$3"
        >
          <Dialog.Title>Confirm Deletion</Dialog.Title>
          <Dialog.Description>
            This action cannot be undone. Are you sure?
          </Dialog.Description>

          <XStack gap="$3" justifyContent="flex-end">
            <Dialog.Close asChild>
              <Button>Cancel</Button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <Button theme="red">Delete</Button>
            </Dialog.Close>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
```

**Key points:** `asChild` on Trigger/Close makes the child element the actual interactive element, `key` props on Overlay and Content enable AnimatePresence exit animations, `bordered elevate` adds border and shadow from theme.

---

## Pattern 4: Dialog with Adapt (Sheet on Mobile)

The primary pattern for responsive overlays. `Adapt` renders Dialog.Content as a Sheet at smaller breakpoints on touch devices.

```tsx
import {
  Adapt,
  Button,
  Dialog,
  Sheet,
  YStack,
  SizableText,
  XStack,
  Input,
} from "tamagui";

function AdaptiveFormDialog() {
  return (
    <Dialog modal>
      <Dialog.Trigger asChild>
        <Button>Edit Profile</Button>
      </Dialog.Trigger>

      {/* On small touch screens, render as bottom sheet */}
      <Adapt when="sm" platform="touch">
        <Sheet modal dismissOnSnapToBottom snapPoints={[85]}>
          <Sheet.Frame padding="$4" gap="$4">
            {/* Adapt.Contents inserts Dialog.Content children here */}
            <Adapt.Contents />
          </Sheet.Frame>
          <Sheet.Overlay />
        </Sheet>
      </Adapt>

      {/* On larger screens / non-touch, render as centered dialog */}
      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          transition="quick"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          opacity={0.5}
        />
        <Dialog.Content
          key="content"
          bordered
          elevate
          transition="quick"
          enterStyle={{ opacity: 0, scale: 0.95 }}
          exitStyle={{ opacity: 0, scale: 0.95 }}
          padding="$4"
          gap="$4"
          width={400}
        >
          <Dialog.Title>Edit Profile</Dialog.Title>
          <Dialog.Description>
            Update your display name and bio.
          </Dialog.Description>

          <YStack gap="$3">
            <Input placeholder="Display name" />
            <Input placeholder="Bio" />
          </YStack>

          <XStack gap="$3" justifyContent="flex-end">
            <Dialog.Close asChild>
              <Button>Cancel</Button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <Button theme="active">Save</Button>
            </Dialog.Close>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
```

**Why good:** single component tree handles both desktop dialog and mobile sheet, `Adapt.Contents` injects the Dialog.Content children into Sheet.Frame, breakpoint-driven (`when="sm"`) responds to viewport changes (not just initial platform).

**Gotcha:** `Dialog.Sheet` does NOT preserve state when transitioning between Sheet and Portal modes. If your form has input state, lift it above the Dialog component to avoid state loss during adaptation transitions.

---

## Pattern 5: Controlled Dialog with External State

For dialogs that need external open/close control (e.g., from a parent component or store).

```tsx
function ControlledDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          transition="quick"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          opacity={0.5}
        />
        <Dialog.Content
          key="content"
          transition="medium"
          enterStyle={{ opacity: 0, y: -20 }}
          exitStyle={{ opacity: 0, y: -20 }}
          padding="$4"
          gap="$4"
          bordered
          elevate
        >
          <Dialog.Title>Controlled Dialog</Dialog.Title>
          <Dialog.Description>Open state managed by parent.</Dialog.Description>
          <Dialog.Close asChild>
            <Button>Close</Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}

// Usage: parent manages state
function Parent() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button onPress={() => setDialogOpen(true)}>Open</Button>
      <ControlledDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
```

**Performance tip:** If Dialog is inside a frequently re-rendering list, place only `Dialog.Trigger` inside the list item and lift the Dialog itself to a parent component. Dialog has significant sub-component overhead that should not be multiplied per list item.
