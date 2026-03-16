# MUI -- Layout Examples

> Grid, Stack, Box, Container layout patterns. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [navigation.md](navigation.md) -- AppBar, Drawer, Tabs (app-level layout)
- [form-inputs.md](form-inputs.md) -- Form layout with Stack
- [styling.md](styling.md) -- sx prop, responsive values

---

## Responsive Product Card Grid

```typescript
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import CardMedia from "@mui/material/CardMedia";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
}

const GRID_COLUMNS = { xs: 12, sm: 6, md: 4, lg: 3 } as const;

function ProductGrid({ products }: { products: Product[] }) {
  return (
    <Grid container spacing={3}>
      {products.map((product) => (
        <Grid key={product.id} size={GRID_COLUMNS}>
          <Card
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              transition: "transform 0.2s, box-shadow 0.2s",
              "&:hover": {
                transform: "translateY(-4px)",
                boxShadow: 8,
              },
            }}
          >
            <CardMedia
              component="img"
              height={200}
              image={product.image}
              alt={product.name}
            />
            <CardContent sx={{ flexGrow: 1 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Typography variant="h6" component="h2">
                  {product.name}
                </Typography>
                <Chip label={product.category} size="small" />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {product.description}
              </Typography>
              <Typography
                variant="h6"
                color="primary"
                sx={{ mt: 2, fontWeight: 700 }}
              >
                ${product.price.toFixed(2)}
              </Typography>
            </CardContent>
            <CardActions sx={{ p: 2, pt: 0 }}>
              <Button variant="contained" fullWidth>
                Add to Cart
              </Button>
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export { ProductGrid };
export type { Product };
```

---

## Dashboard Layout: Sidebar + Main Content

```typescript
import Grid from "@mui/material/Grid";
import Container from "@mui/material/Container";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

const SIDEBAR_COLUMNS = 4;
const MAIN_COLUMNS = 8;
const FULL_WIDTH = 12;

function DashboardContent() {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Grid container spacing={3}>
        {/* Sidebar */}
        <Grid size={{ xs: FULL_WIDTH, md: SIDEBAR_COLUMNS }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Filters</Typography>
            {/* Filter controls */}
          </Paper>
        </Grid>

        {/* Main content */}
        <Grid size={{ xs: FULL_WIDTH, md: MAIN_COLUMNS }}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Content</Typography>
            {/* Main content */}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export { DashboardContent };
```

---

## Stack: Button Group and Form Row

```typescript
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";

// Responsive button group with dividers
function ActionBar() {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={2}
      divider={<Divider orientation="vertical" flexItem />}
      sx={{ alignItems: "center" }}
    >
      <Button variant="contained">Save</Button>
      <Button variant="outlined">Cancel</Button>
      <Button color="error">Delete</Button>
    </Stack>
  );
}

export { ActionBar };
```

---

## Box: Flex Container with sx

```typescript
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

function ProfileCard() {
  return (
    <Box
      component="section"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        p: 3,
        bgcolor: "background.paper",
        borderRadius: 1,
        boxShadow: 3,
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
