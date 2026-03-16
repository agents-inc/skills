# MUI -- Feedback Component Examples

> Dialog, Snackbar, Alert, CircularProgress, Skeleton patterns. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [form-inputs.md](form-inputs.md) -- TextField inside Dialog forms
- [navigation.md](navigation.md) -- Menu, contextual actions
- [data-grid.md](data-grid.md) -- Action dialogs for table rows

---

## Confirmation Dialog with Loading State

```typescript
import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  destructive?: boolean;
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={destructive ? "error" : "primary"}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { ConfirmDialog };
export type { ConfirmDialogProps };
```

---

## Edit Dialog with Form

```typescript
import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";

function EditDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");

  const handleSave = () => {
    onSave(name);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Profile</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { EditDialog };
```

---

## Snackbar with Alert

```typescript
import { useState } from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

const AUTO_HIDE_DURATION_MS = 4000;

function Notification() {
  const [open, setOpen] = useState(false);

  return (
    <Snackbar
      open={open}
      autoHideDuration={AUTO_HIDE_DURATION_MS}
      onClose={() => setOpen(false)}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    >
      <Alert
        onClose={() => setOpen(false)}
        severity="success"
        variant="filled"
        sx={{ width: "100%" }}
      >
        Changes saved successfully
      </Alert>
    </Snackbar>
  );
}

export { Notification };
```

---

## Skeleton Loading State

```typescript
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

function CardSkeleton() {
  return (
    <Stack spacing={1}>
      <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1 }} />
      <Skeleton variant="text" sx={{ fontSize: "1.5rem" }} />
      <Skeleton variant="text" width="60%" />
      <Skeleton variant="rounded" width={100} height={36} />
    </Stack>
  );
}

export { CardSkeleton };
```
