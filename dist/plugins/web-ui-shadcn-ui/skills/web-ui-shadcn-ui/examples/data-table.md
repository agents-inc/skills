# shadcn/ui - Data Table Examples

> Sortable tables with row actions and dropdown menus.

---

## Sortable Table with Row Actions

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// Use your configured icon library (lucide-react is the shadcn default)

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}

interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

export function UserTable({ users, onEdit, onDelete }: UserTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[200px]">
            <Button variant="ghost" className="p-0 hover:bg-transparent">
              Name
              {/* Sort icon from your icon library */}
              <span className="ml-2 h-4 w-4" aria-hidden="true">
                ↕
              </span>
            </Button>
          </TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.name}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">
                {user.role}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    {/* More icon from your icon library */}
                    <span className="h-4 w-4" aria-hidden="true">
                      ...
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(user)}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(user)}
                    className="text-destructive"
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**Why good:** the row actions collapse into one menu, so the column width does not grow with the
number of actions and the destructive one is never adjacent to a stray click. `sr-only` names the
glyph-only trigger, which is otherwise announced as "button". `TableHead` wrapping a ghost `Button`
makes the sort control a real button — focusable and operable by keyboard — rather than a click
handler on a `th`.

This file covers the presentational table components. Sorting, filtering and pagination _logic_ is a
separate concern from the markup these render.
