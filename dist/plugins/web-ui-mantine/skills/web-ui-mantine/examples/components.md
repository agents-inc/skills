# Mantine v7 - Component Examples

> Overlays, compound components, notifications and dates. See [core.md](core.md) for setup and
> styling, [SKILL.md](../SKILL.md) for which component to reach for.

**Prerequisites**: `MantineProvider` configured with `@mantine/core/styles.css` imported.

---

## Pattern 1: Modal and Drawer

Both are controlled by `opened` / `onClose`, and `useDisclosure` from `@mantine/hooks` is the
handler set they expect.

```tsx
import { Modal, Drawer, Button, Group } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

export function ConfirmModal({ onConfirm }: { onConfirm: () => void }) {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Button onClick={open}>Delete project</Button>
      <Modal opened={opened} onClose={close} title="Confirm action" centered>
        <p>This cannot be undone.</p>
        <Group mt="md" justify="flex-end">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={() => {
              onConfirm();
              close();
            }}
          >
            Delete
          </Button>
        </Group>
      </Modal>
    </>
  );
}

// Drawer takes the same props plus an edge to slide from
<Drawer opened={opened} onClose={close} title="Settings" position="right">
  {/* content */}
</Drawer>;
```

**Why good:** `useDisclosure` returns `{ open, close, toggle }` already bound, so no `useState` pair
and no inline arrow that flips a boolean. `centered` and `position` are props rather than layout you
write.

---

## Pattern 2: Menu

```tsx
import { Menu, Button } from "@mantine/core";

<Menu shadow="md" width={200}>
  <Menu.Target>
    <Button>Actions</Button>
  </Menu.Target>
  <Menu.Dropdown>
    <Menu.Label>Application</Menu.Label>
    <Menu.Item leftSection={<SettingsIcon />}>Settings</Menu.Item>
    <Menu.Divider />
    <Menu.Item color="red" leftSection={<TrashIcon />}>
      Delete
    </Menu.Item>
  </Menu.Dropdown>
</Menu>;
```

**Why good:** `Menu.Target` clones the child and attaches the trigger behaviour, so the button stays
an ordinary `Button`. `leftSection` reserves the icon slot at a consistent width across items.

---

## Pattern 3: Tabs and Accordion

Both key their panels by `value` rather than by position, so reordering the list cannot desync them.

```tsx
import { Tabs, Accordion } from "@mantine/core";

<Tabs defaultValue="general">
  <Tabs.List>
    <Tabs.Tab value="general">General</Tabs.Tab>
    <Tabs.Tab value="security">Security</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="general">General settings…</Tabs.Panel>
  <Tabs.Panel value="security">Security settings…</Tabs.Panel>
</Tabs>

<Accordion>
  <Accordion.Item value="billing">
    <Accordion.Control>How does billing work?</Accordion.Control>
    <Accordion.Panel>Monthly billing starts on the signup date.</Accordion.Panel>
  </Accordion.Item>
  <Accordion.Item value="cancel">
    <Accordion.Control>Can I cancel anytime?</Accordion.Control>
    <Accordion.Panel>Yes, from settings.</Accordion.Panel>
  </Accordion.Item>
</Accordion>;
```

**Why good:** `value` is the identity of the panel. Add `multiple` to `Accordion` for several open
at once, and `value`/`onChange` on either to control it from outside.

---

## Pattern 4: Notifications

The renderer mounts once inside `MantineProvider`; the imperative API is callable from anywhere,
including outside React.

```tsx
// Root, once
import { Notifications } from "@mantine/notifications";
import "@mantine/notifications/styles.css";

<MantineProvider theme={theme}>
  <Notifications position="top-right" />
  <App />
</MantineProvider>;
```

```tsx
import { notifications } from "@mantine/notifications";

notifications.show({
  title: "Saved",
  message: "Your changes have been saved",
  color: "green",
});

// A pending notification that resolves in place
const id = notifications.show({
  loading: true,
  title: "Uploading file",
  message: "Please wait…",
  autoClose: false,
  withCloseButton: false,
});

notifications.update({
  id,
  loading: false,
  title: "Upload complete",
  message: "File has been uploaded",
  color: "green",
  autoClose: 3000,
});

notifications.clean();
```

**Why good:** `update` keyed by the returned id turns one async operation into one notification that
changes, rather than a pending toast plus a success toast racing each other. The queue caps how many
render at once, so a burst cannot cover the screen.

---

## Pattern 5: Dates

`@mantine/dates` is a separate package built on dayjs, with its own stylesheet.

```bash
npm install @mantine/dates dayjs
```

```tsx
import "@mantine/dates/styles.css";
import { DatePickerInput, DatesProvider } from "@mantine/dates";

// Locale and week start belong on the provider, not on every picker
<DatesProvider settings={{ locale: "en", firstDayOfWeek: 0 }}>
  <App />
</DatesProvider>;

// v7 values are Date objects; v8 values are "YYYY-MM-DD" strings
const [date, setDate] = useState<Date | null>(null);
<DatePickerInput label="Pick date" value={date} onChange={setDate} />;

const [range, setRange] = useState<[Date | null, Date | null]>([null, null]);
<DatePickerInput
  type="range"
  label="Date range"
  value={range}
  onChange={setRange}
/>;
```

**Why good:** `type` (`default` / `range` / `multiple`) changes the value shape rather than the
component, so one import covers all three modes.

> **v8 note:** every `@mantine/dates` component moved from `Date` objects to `"YYYY-MM-DD"` strings,
> and `DatesProvider` dropped the `timezone` setting.
