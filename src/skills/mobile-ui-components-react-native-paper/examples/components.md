# React Native Paper - Component Patterns

> Key component usage patterns. See [SKILL.md](../SKILL.md) for component selection guidance and red flags. See [core.md](core.md) for theming setup.

---

## Pattern 1: Card with Sub-Components

Card supports three modes: `elevated` (default, with shadow), `outlined` (border, no shadow), `contained` (flat, no border or shadow).

```typescript
import { Card, Text, Button, Avatar } from "react-native-paper";

const COVER_HEIGHT = 200;

function ArticleCard({ article, onRead }: ArticleCardProps) {
  return (
    <Card mode="elevated" onPress={() => onRead(article.id)}>
      <Card.Title
        title={article.title}
        subtitle={article.author}
        left={(props) => <Avatar.Icon {...props} icon="account" />}
      />
      <Card.Cover
        source={{ uri: article.imageUrl }}
        style={{ height: COVER_HEIGHT }}
      />
      <Card.Content style={{ paddingTop: 12 }}>
        <Text variant="bodyMedium">{article.summary}</Text>
      </Card.Content>
      <Card.Actions>
        <Button onPress={() => onRead(article.id)}>Read More</Button>
      </Card.Actions>
    </Card>
  );
}
```

**Why good:** Sub-components (Title, Cover, Content, Actions) handle spacing and layout automatically. Avatar in `left` prop renders correctly sized. `mode="elevated"` adds MD3 elevation shadow.

---

## Pattern 2: TextInput with Error State and Adornments

```typescript
import { useState } from "react";
import { TextInput, HelperText } from "react-native-paper";

const MIN_PASSWORD_LENGTH = 8;

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);

  const emailError = email.length > 0 && !email.includes("@");
  const passwordError = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  return (
    <>
      <TextInput
        mode="outlined"
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        keyboardType="email-address"
        autoCapitalize="none"
        left={<TextInput.Icon icon="email" />}
      />
      <HelperText type="error" visible={emailError}>
        Please enter a valid email address
      </HelperText>

      <TextInput
        mode="outlined"
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={passwordError}
        secureTextEntry={!passwordVisible}
        right={
          <TextInput.Icon
            icon={passwordVisible ? "eye-off" : "eye"}
            onPress={() => setPasswordVisible((v) => !v)}
          />
        }
      />
      <HelperText type="error" visible={passwordError}>
        {`Password must be at least ${MIN_PASSWORD_LENGTH} characters`}
      </HelperText>
    </>
  );
}
```

**Why good:** `error` prop applies MD3 error color to outline and label automatically. `HelperText` with `type="error"` renders in error color and animates visibility. `TextInput.Icon` in `right` prop positions the toggle correctly inside the input.

---

## Pattern 3: FAB Variants and FAB.Group

FAB supports sizes (`small`, `medium`, `large`) and variants (`primary`, `secondary`, `tertiary`, `surface`).

```typescript
import { useState } from "react";
import { StyleSheet } from "react-native";
import { FAB, Portal } from "react-native-paper";

const FAB_BOTTOM_OFFSET = 16;
const FAB_RIGHT_OFFSET = 16;

// Simple FAB
function CreateButton({ onPress }: { onPress: () => void }) {
  return (
    <FAB
      icon="plus"
      onPress={onPress}
      style={styles.fab}
    />
  );
}

// Extended FAB with label
function ComposeButton({ onPress }: { onPress: () => void }) {
  return (
    <FAB
      icon="pencil"
      label="Compose"
      onPress={onPress}
      style={styles.fab}
    />
  );
}

// FAB.Group - expandable speed dial
function ActionMenu() {
  const [open, setOpen] = useState(false);

  return (
    <Portal>
      <FAB.Group
        open={open}
        visible
        icon={open ? "close" : "plus"}
        actions={[
          { icon: "camera", label: "Photo", onPress: () => {} },
          { icon: "file-document", label: "Document", onPress: () => {} },
          { icon: "map-marker", label: "Location", onPress: () => {} },
        ]}
        onStateChange={({ open }) => setOpen(open)}
      />
    </Portal>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: FAB_BOTTOM_OFFSET,
    right: FAB_RIGHT_OFFSET,
  },
});
```

**Why good:** FAB.Group wrapped in Portal renders the speed dial above all content. `visible` controls show/hide animation. `onStateChange` manages open state. Extended FAB with `label` provides context for the action.

---

## Pattern 4: Appbar.Header Modes

Appbar supports four modes: `small` (default, 64px), `medium` (112px), `large` (152px), `center-aligned` (64px, centered title).

```typescript
import { Appbar } from "react-native-paper";

// Standard top bar
function ScreenHeader({ navigation, title }: HeaderProps) {
  return (
    <Appbar.Header mode="small">
      <Appbar.BackAction onPress={() => navigation.goBack()} />
      <Appbar.Content title={title} />
      <Appbar.Action icon="magnify" onPress={onSearch} />
      <Appbar.Action icon="dots-vertical" onPress={onMenu} />
    </Appbar.Header>
  );
}

// Large header for home/landing screens
function HomeHeader() {
  return (
    <Appbar.Header mode="large" elevated>
      <Appbar.Content title="Inbox" />
      <Appbar.Action icon="magnify" onPress={onSearch} />
    </Appbar.Header>
  );
}
```

**Why good:** `mode="large"` provides the MD3 large top app bar with animated collapsing behavior. `elevated` adds subtle background tint. `Appbar.BackAction` uses the platform-appropriate back icon.

---

## Pattern 5: Dialog with Portal (Complete Pattern)

```typescript
import { useState } from "react";
import { Portal, Dialog, Button, Text, RadioButton } from "react-native-paper";

function SortDialog({ visible, onDismiss, onSelect, currentSort }: SortDialogProps) {
  const [selected, setSelected] = useState(currentSort);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Icon icon="sort" />
        <Dialog.Title style={{ textAlign: "center" }}>Sort By</Dialog.Title>
        <Dialog.Content>
          <RadioButton.Group
            value={selected}
            onValueChange={(value) => setSelected(value)}
          >
            <RadioButton.Item label="Date (newest)" value="date-desc" />
            <RadioButton.Item label="Date (oldest)" value="date-asc" />
            <RadioButton.Item label="Name (A-Z)" value="name-asc" />
          </RadioButton.Group>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={() => onSelect(selected)}>Apply</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
```

**Why good:** `Dialog.Icon` renders above the title (MD3 pattern). `Dialog.ScrollArea` would replace `Dialog.Content` for long scrollable content. Portal ensures the dialog floats above everything.

---

## Pattern 6: Snackbar with Action and Portal

```typescript
import { useState } from "react";
import { Portal, Snackbar } from "react-native-paper";

const SNACKBAR_DURATION = 4000;

function ItemList() {
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [deletedItem, setDeletedItem] = useState<Item | null>(null);

  const handleDelete = (item: Item) => {
    setDeletedItem(item);
    deleteItem(item.id);
    setSnackbarVisible(true);
  };

  const handleUndo = () => {
    if (deletedItem) {
      restoreItem(deletedItem);
    }
    setSnackbarVisible(false);
  };

  return (
    <>
      {/* List content here */}
      <Portal>
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={SNACKBAR_DURATION}
          action={{ label: "Undo", onPress: handleUndo }}
        >
          Item deleted
        </Snackbar>
      </Portal>
    </>
  );
}
```

**Why good:** Portal wrapping ensures Snackbar renders above bottom tabs and other content. `action` with undo follows MD3 pattern. Named `SNACKBAR_DURATION` constant avoids magic number. `onDismiss` is required and must update the `visible` state.

---

## Pattern 7: SegmentedButtons (Single and Multi-Select)

```typescript
import { useState } from "react";
import { SegmentedButtons } from "react-native-paper";

// Single select (value is a string)
function ViewModeSelector() {
  const [viewMode, setViewMode] = useState("list");

  return (
    <SegmentedButtons
      value={viewMode}
      onValueChange={setViewMode}
      buttons={[
        { value: "list", icon: "view-list", label: "List" },
        { value: "grid", icon: "view-grid", label: "Grid" },
        { value: "compact", icon: "view-compact", label: "Compact" },
      ]}
    />
  );
}

// Multi-select (value is an array of strings)
function FilterSelector() {
  const [filters, setFilters] = useState<string[]>([]);

  return (
    <SegmentedButtons
      multiSelect
      value={filters}
      onValueChange={setFilters}
      buttons={[
        { value: "photos", icon: "image", label: "Photos" },
        { value: "videos", icon: "video", label: "Videos" },
        { value: "audio", icon: "music-note", label: "Audio" },
      ]}
    />
  );
}
```

**Why good:** `multiSelect` toggles between string (single) and string[] (multi) value types. `density` prop (`"regular"` | `"small"` | `"medium"` | `"high"`) controls vertical size for space-constrained UIs.
