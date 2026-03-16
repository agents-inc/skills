# MUI -- Form Input Examples

> TextField, Select, Autocomplete, FormControl patterns. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [setup.md](setup.md) -- ThemeProvider, createTheme, CssBaseline
- [feedback.md](feedback.md) -- Dialog, Snackbar, Alert
- [layout.md](layout.md) -- Grid, Stack for form layout

---

## Contact Form with Validation Layout

```typescript
import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";

const SUBJECT_OPTIONS = [
  { value: "general", label: "General Inquiry" },
  { value: "support", label: "Technical Support" },
  { value: "billing", label: "Billing Question" },
  { value: "feedback", label: "Feedback" },
] as const;

const MAX_MESSAGE_LENGTH = 500;

function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    // Process form data...
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Alert severity="success" sx={{ mt: 2 }}>
        Thank you for your message. We will get back to you shortly.
      </Alert>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 600 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Contact Us
      </Typography>

      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            required
            fullWidth
            name="firstName"
            label="First Name"
            autoComplete="given-name"
          />
          <TextField
            required
            fullWidth
            name="lastName"
            label="Last Name"
            autoComplete="family-name"
          />
        </Stack>

        <TextField
          required
          fullWidth
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
        />

        <TextField
          required
          fullWidth
          name="subject"
          label="Subject"
          select
          defaultValue=""
        >
          {SUBJECT_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          required
          fullWidth
          name="message"
          label="Message"
          multiline
          rows={4}
          slotProps={{
            htmlInput: { maxLength: MAX_MESSAGE_LENGTH },
          }}
          helperText={`Maximum ${MAX_MESSAGE_LENGTH} characters`}
        />

        <Button type="submit" variant="contained" size="large">
          Send Message
        </Button>
      </Stack>
    </Box>
  );
}

export { ContactForm };
```

---

## Autocomplete: Multi-Select with Custom Rendering

```typescript
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: string;
}

function TeamMemberPicker({
  members,
  selected,
  onChange,
}: {
  members: TeamMember[];
  selected: TeamMember[];
  onChange: (value: TeamMember[]) => void;
}) {
  return (
    <Autocomplete
      multiple
      options={members}
      value={selected}
      onChange={(_, newValue) => onChange(newValue)}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Team Members"
          placeholder="Search..."
        />
      )}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        return (
          <Box
            key={key}
            component="li"
            {...rest}
            sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
          >
            <Avatar src={option.avatarUrl} sx={{ width: 32, height: 32 }}>
              {option.name[0]}
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {option.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {option.role}
              </Typography>
            </Box>
          </Box>
        );
      }}
      renderTags={(value, getTagProps) =>
        value.map((option, index) => {
          const { key, ...tagProps } = getTagProps({ index });
          return (
            <Chip
              key={key}
              label={option.name}
              avatar={<Avatar src={option.avatarUrl}>{option.name[0]}</Avatar>}
              size="small"
              {...tagProps}
            />
          );
        })
      }
    />
  );
}

export { TeamMemberPicker };
export type { TeamMember };
```

---

## Slots and SlotProps: Customizing Component Internals

```typescript
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";

function CustomAutocomplete() {
  return (
    <Autocomplete
      options={["React", "Angular", "Vue", "Svelte"]}
      slots={{
        paper: Paper, // Replace the dropdown paper component
      }}
      slotProps={{
        paper: {
          elevation: 8,
          sx: { borderRadius: 2, mt: 1 },
        },
        listbox: {
          sx: { maxHeight: 300 },
        },
        popper: {
          "data-testid": "autocomplete-popper",
        },
      }}
      renderInput={(params) => (
        <TextField {...params} label="Framework" />
      )}
    />
  );
}

export { CustomAutocomplete };
```

### Callback SlotProps for State-Based Customization

```typescript
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";

<Select
  value={value}
  onChange={handleChange}
  slotProps={{
    input: ({ open }) => ({
      sx: {
        borderColor: open ? "primary.main" : "divider",
      },
    }),
  }}
>
  <MenuItem value="one">Option One</MenuItem>
  <MenuItem value="two">Option Two</MenuItem>
</Select>
```
