# MUI -- DataGrid Examples

> DataGrid from @mui/x-data-grid: columns, sorting, filtering, pagination, custom rendering. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [layout.md](layout.md) -- Grid, Container for page layout
- [feedback.md](feedback.md) -- Dialog for row editing, Snackbar for notifications

---

## User Management Table

```typescript
import { useState, useCallback } from "react";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef, GridPaginationModel } from "@mui/x-data-grid";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  status: "active" | "inactive";
  createdAt: string;
}

const ROLE_COLORS = {
  admin: "error",
  editor: "primary",
  viewer: "default",
} as const;

const STATUS_COLORS = {
  active: "success",
  inactive: "default",
} as const;

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

// Define columns outside component for referential stability
const columns: GridColDef<User>[] = [
  { field: "id", headerName: "ID", width: 70 },
  { field: "name", headerName: "Name", flex: 1, minWidth: 150 },
  { field: "email", headerName: "Email", flex: 1, minWidth: 200 },
  {
    field: "role",
    headerName: "Role",
    width: 120,
    renderCell: (params) => (
      <Chip
        label={params.value}
        color={ROLE_COLORS[params.value as User["role"]]}
        size="small"
        variant="outlined"
      />
    ),
  },
  {
    field: "status",
    headerName: "Status",
    width: 120,
    renderCell: (params) => (
      <Chip
        label={params.value}
        color={STATUS_COLORS[params.value as User["status"]]}
        size="small"
      />
    ),
  },
  {
    field: "createdAt",
    headerName: "Created",
    width: 120,
    valueFormatter: (value: string) =>
      new Date(value).toLocaleDateString(),
  },
  {
    field: "actions",
    headerName: "Actions",
    width: 100,
    sortable: false,
    filterable: false,
    renderCell: (params) => (
      <Box>
        <IconButton size="small" aria-label={`edit ${params.row.name}`}>
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" aria-label={`delete ${params.row.name}`}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
    ),
  },
];

function UserTable({ users }: { users: User[] }) {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const handlePaginationChange = useCallback(
    (model: GridPaginationModel) => {
      setPaginationModel(model);
    },
    [],
  );

  return (
    <Box sx={{ height: 500, width: "100%" }}>
      <DataGrid
        rows={users}
        columns={columns}
        paginationModel={paginationModel}
        onPaginationModelChange={handlePaginationChange}
        pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
        checkboxSelection
        disableRowSelectionOnClick
        sx={{
          "& .MuiDataGrid-cell:focus": {
            outline: "none",
          },
          "& .MuiDataGrid-columnHeader": {
            backgroundColor: "action.hover",
          },
        }}
      />
    </Box>
  );
}

export { UserTable };
export type { User };
```

**Key practices shown:**

- Columns defined as a constant outside the component (referential stability, prevents re-renders)
- Typed `GridColDef<User>` for row-type safety
- Custom `renderCell` for Chip-based status/role display
- `valueFormatter` for date formatting
- Named constants for page sizes and color maps
- `aria-label` on action buttons for accessibility
