# MUI -- Styling Examples

> styled() API, sx prop patterns, custom styled components. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Theme config, component overrides, dark mode
- [layout.md](layout.md) -- sx prop for responsive layout
- [form-inputs.md](form-inputs.md) -- slotProps for input customization

---

## Reusable Styled Components

```typescript
import { styled } from "@mui/material/styles";
import Card from "@mui/material/Card";
import Button from "@mui/material/Button";

const HOVER_ELEVATION = 8;
const HOVER_TRANSLATE_PX = -4;

// Feature card with hover effect
const FeatureCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius * 2,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: "none",
  transition: theme.transitions.create(
    ["box-shadow", "transform", "border-color"],
    {
      duration: theme.transitions.duration.short,
    },
  ),
  "&:hover": {
    boxShadow: theme.shadows[HOVER_ELEVATION],
    transform: `translateY(${HOVER_TRANSLATE_PX}px)`,
    borderColor: theme.palette.primary.main,
  },
  ...theme.applyStyles("dark", {
    backgroundColor: theme.palette.grey[900],
    borderColor: theme.palette.grey[800],
  }),
}));

// Gradient button
const GradientButton = styled(Button)(({ theme }) => ({
  background: `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
  color: theme.palette.common.white,
  boxShadow: `0 3px 5px 2px ${theme.palette.primary.main}33`,
  "&:hover": {
    background: `linear-gradient(45deg, ${theme.palette.primary.dark} 30%, ${theme.palette.secondary.dark} 90%)`,
  },
}));

export { FeatureCard, GradientButton };
```

---

## Styled with Custom Props

```typescript
import { styled } from "@mui/material/styles";
import Chip from "@mui/material/Chip";

interface StatusChipProps {
  status: "active" | "inactive" | "pending";
}

const STATUS_COLORS = {
  active: "success",
  inactive: "error",
  pending: "warning",
} as const;

const StatusChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== "status",
})<StatusChipProps>(({ theme, status }) => ({
  fontWeight: 600,
  backgroundColor: theme.palette[STATUS_COLORS[status]].light,
  color: theme.palette[STATUS_COLORS[status]].dark,
}));

export { StatusChip };
```

---

## sx Prop: Theme-Aware Values

```typescript
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

function ProfileCard() {
  return (
    <Box
      sx={{
        p: 3,                              // padding: theme.spacing(3) = 24px
        m: 2,                              // margin: theme.spacing(2) = 16px
        bgcolor: "background.paper",       // theme.palette.background.paper
        color: "text.primary",             // theme.palette.text.primary
        borderRadius: 1,                   // theme.shape.borderRadius * 1
        boxShadow: 3,                      // theme.shadows[3]
        "&:hover": {
          boxShadow: 6,
          transform: "translateY(-2px)",
        },
      }}
    >
      <Typography variant="h6" sx={{ mb: 1 }}>
        Profile
      </Typography>
    </Box>
  );
}

export { ProfileCard };
```

---

## sx Prop: Responsive Values

```typescript
import Box from "@mui/material/Box";

// Object syntax: breakpoint keys map to values
<Box
  sx={{
    width: { xs: "100%", sm: "50%", md: "33.33%" },
    display: { xs: "block", md: "flex" },
    p: { xs: 1, sm: 2, md: 3 },
    fontSize: { xs: "0.875rem", md: "1rem" },
  }}
/>

// Array syntax (mobile-first): [xs, sm, md, lg, xl]
<Box sx={{ width: ["100%", "50%", "33.33%"] }} />
```

---

## sx Prop: Callback Syntax for Complex Theme Access

```typescript
import Box from "@mui/material/Box";

<Box
  sx={(theme) => ({
    ...theme.typography.body2,
    color: theme.palette.primary.main,
    border: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.up("md")]: {
      padding: theme.spacing(4),
    },
  })}
/>
```

---

## Correct Dark Mode Conditional Styling

```typescript
import { styled } from "@mui/material/styles";
import Box from "@mui/material/Box";

// CORRECT: Use theme.applyStyles for dark mode
const StyledBox = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  ...theme.applyStyles("dark", {
    backgroundColor: "#1a1a2e",
    borderColor: "#16213e",
  }),
}));

export { StyledBox };
```
