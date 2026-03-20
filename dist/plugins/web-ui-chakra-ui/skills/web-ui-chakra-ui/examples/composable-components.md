# Chakra UI v3 - Composable Component Examples

> Dialog, Menu, Popover, Drawer, and controlled state patterns. See [core.md](core.md) for basic components and [theming.md](theming.md) for recipes.

**Prerequisites**: Understand composable component pattern from SKILL.md Pattern 4.

---

## Dialog (Modal)

### Basic Dialog

```tsx
import { Dialog, Button } from "@chakra-ui/react";

function BasicDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="outline">Edit Profile</Button>
      </Dialog.Trigger>
      <Dialog.Backdrop />
      <Dialog.Content>
        <Dialog.Header>Edit Profile</Dialog.Header>
        <Dialog.Body>
          <p>Update your profile information below.</p>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.CloseTrigger asChild>
            <Button variant="outline">Cancel</Button>
          </Dialog.CloseTrigger>
          <Button colorPalette="blue">Save</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
```

### Controlled Dialog

```tsx
import { Dialog, Button } from "@chakra-ui/react";
import { useState } from "react";

function ControlledDialog() {
  const [open, setOpen] = useState(false);

  const handleSave = async () => {
    await saveData();
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(details) => setOpen(details.open)}>
      <Dialog.Trigger asChild>
        <Button>Open</Button>
      </Dialog.Trigger>
      <Dialog.Backdrop />
      <Dialog.Content>
        <Dialog.Header>Confirm</Dialog.Header>
        <Dialog.Body>Are you sure you want to proceed?</Dialog.Body>
        <Dialog.Footer>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button colorPalette="red" onClick={handleSave}>
            Confirm
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
```

### Alert Dialog

```tsx
import { Dialog, Button } from "@chakra-ui/react";

function DeleteConfirmation({ onDelete }: { onDelete: () => void }) {
  return (
    <Dialog.Root role="alertdialog">
      <Dialog.Trigger asChild>
        <Button colorPalette="red" variant="outline">
          Delete
        </Button>
      </Dialog.Trigger>
      <Dialog.Backdrop />
      <Dialog.Content>
        <Dialog.Header>Delete Item</Dialog.Header>
        <Dialog.Body>
          This action cannot be undone. This will permanently delete the item.
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.CloseTrigger asChild>
            <Button variant="outline">Cancel</Button>
          </Dialog.CloseTrigger>
          <Button colorPalette="red" onClick={onDelete}>
            Delete
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
```

### Dialog with Lazy Mount

```tsx
// Content only mounts when opened, unmounts when closed
<Dialog.Root lazyMount unmountOnExit>
  <Dialog.Trigger asChild>
    <Button>Open Heavy Content</Button>
  </Dialog.Trigger>
  <Dialog.Backdrop />
  <Dialog.Content>
    <Dialog.Body>
      {/* Heavy content only renders when dialog opens */}
    </Dialog.Body>
  </Dialog.Content>
</Dialog.Root>
```

**Why good:** `lazyMount` defers rendering, `unmountOnExit` frees memory, `role="alertdialog"` for destructive actions

---

## Menu (Dropdown)

### Basic Menu

```tsx
import { Menu, Button } from "@chakra-ui/react";

function ActionMenu() {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant="outline" size="sm">
          Actions
        </Button>
      </Menu.Trigger>
      <Menu.Content>
        <Menu.Item value="edit">Edit</Menu.Item>
        <Menu.Item value="duplicate">Duplicate</Menu.Item>
        <Menu.Separator />
        <Menu.Item value="delete" color="fg.error">
          Delete
        </Menu.Item>
      </Menu.Content>
    </Menu.Root>
  );
}
```

### Menu with Selection

```tsx
import { Menu, Button } from "@chakra-ui/react";

function SortMenu() {
  const [sortBy, setSortBy] = useState("name");

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant="outline">Sort by: {sortBy}</Button>
      </Menu.Trigger>
      <Menu.Content>
        <Menu.RadioItemGroup
          value={sortBy}
          onValueChange={(details) => setSortBy(details.value)}
        >
          <Menu.RadioItem value="name">Name</Menu.RadioItem>
          <Menu.RadioItem value="date">Date</Menu.RadioItem>
          <Menu.RadioItem value="size">Size</Menu.RadioItem>
        </Menu.RadioItemGroup>
      </Menu.Content>
    </Menu.Root>
  );
}
```

**Why good:** composable parts, built-in radio/checkbox groups, keyboard navigation, accessible by default

---

## Popover

### Basic Popover

```tsx
import { Popover, Button, Text, Stack } from "@chakra-ui/react";

function InfoPopover() {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="outline" size="sm">
          Info
        </Button>
      </Popover.Trigger>
      <Popover.Content>
        <Popover.Arrow />
        <Popover.Header>Details</Popover.Header>
        <Popover.Body>
          <Stack gap="2">
            <Text fontSize="sm">Created: Jan 15, 2026</Text>
            <Text fontSize="sm">Status: Active</Text>
          </Stack>
        </Popover.Body>
      </Popover.Content>
    </Popover.Root>
  );
}
```

### Controlled Popover

```tsx
import { Popover, Button } from "@chakra-ui/react";
import { useState } from "react";

function ControlledPopover() {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={(details) => setOpen(details.open)}>
      <Popover.Trigger asChild>
        <Button>Toggle</Button>
      </Popover.Trigger>
      <Popover.Content>
        <Popover.Arrow />
        <Popover.Body>
          <Text>Controlled content</Text>
          <Button size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </Popover.Body>
      </Popover.Content>
    </Popover.Root>
  );
}
```

**Why good:** Arrow component for visual anchor, built-in focus trap, consistent controlled API

---

## Drawer (Side Panel)

### Basic Drawer

```tsx
import { Drawer, Button } from "@chakra-ui/react";

function SideDrawer() {
  return (
    <Drawer.Root>
      <Drawer.Trigger asChild>
        <Button variant="outline">Open Drawer</Button>
      </Drawer.Trigger>
      <Drawer.Backdrop />
      <Drawer.Content>
        <Drawer.Header>Navigation</Drawer.Header>
        <Drawer.Body>
          <Stack gap="2">
            <Button variant="ghost" justifyContent="flex-start">
              Home
            </Button>
            <Button variant="ghost" justifyContent="flex-start">
              Profile
            </Button>
            <Button variant="ghost" justifyContent="flex-start">
              Settings
            </Button>
          </Stack>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.CloseTrigger asChild>
            <Button variant="outline" w="full">
              Close
            </Button>
          </Drawer.CloseTrigger>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer.Root>
  );
}
```

### Drawer with Placement

```tsx
import { Drawer, Button } from "@chakra-ui/react";

// Placement options: "start" (left), "end" (right), "top", "bottom"
function RightDrawer() {
  return (
    <Drawer.Root placement="end">
      <Drawer.Trigger asChild>
        <Button>Details</Button>
      </Drawer.Trigger>
      <Drawer.Backdrop />
      <Drawer.Content>
        <Drawer.Header>Item Details</Drawer.Header>
        <Drawer.Body>{/* Detail content */}</Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  );
}
```

**Why good:** same composable pattern as Dialog, placement prop for direction, built-in backdrop and animations

---

## Tabs

### Basic Tabs

```tsx
import { Tabs } from "@chakra-ui/react";

function ContentTabs() {
  return (
    <Tabs.Root defaultValue="overview">
      <Tabs.List>
        <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
        <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
        <Tabs.Trigger value="billing">Billing</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="overview">
        <p>Overview content</p>
      </Tabs.Content>
      <Tabs.Content value="settings">
        <p>Settings content</p>
      </Tabs.Content>
      <Tabs.Content value="billing">
        <p>Billing content</p>
      </Tabs.Content>
    </Tabs.Root>
  );
}
```

### Controlled Tabs

```tsx
import { Tabs } from "@chakra-ui/react";
import { useState } from "react";

function ControlledTabs() {
  const [tab, setTab] = useState("overview");

  return (
    <Tabs.Root value={tab} onValueChange={(details) => setTab(details.value)}>
      <Tabs.List>
        <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
        <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="overview">Overview</Tabs.Content>
      <Tabs.Content value="settings">Settings</Tabs.Content>
    </Tabs.Root>
  );
}
```

**Why good:** value-based tab identification, consistent controlled API, keyboard navigation built-in

---

## Controlled State Pattern

All composable components follow the same controlled API:

```tsx
// The universal pattern for controlled Chakra v3 components:
const [open, setOpen] = useState(false);

<Component.Root open={open} onOpenChange={(details) => setOpen(details.open)}>
  {/* ... */}
</Component.Root>;
```

**Key points:**

- `open` replaces v2's `isOpen`
- `onOpenChange` replaces v2's `onClose`/`onOpen`
- Callback receives a `details` object: `{ open: boolean }`
- Same pattern for Dialog, Drawer, Popover, Menu, Select, Tabs (uses `value`/`onValueChange`)
