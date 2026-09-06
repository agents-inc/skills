# Radix UI - Menu Examples

> Dropdown menus with submenus, checkable items, and radio groups.

---

## Pattern 1: Dropdown Menu with Submenus

### Good Example - Navigation Menu with Submenus

```typescript
import { DropdownMenu } from "radix-ui";

const OFFSET_PX = 5;
const SUBMENU_OFFSET_PX = 2;

export function NavigationMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="menu-trigger">
        Menu
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-content" sideOffset={OFFSET_PX}>
          <DropdownMenu.Item className="menu-item">
            Profile
          </DropdownMenu.Item>
          <DropdownMenu.Item className="menu-item">
            Settings
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="menu-separator" />

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="menu-item menu-subtrigger">
              More Options
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className="menu-content"
                sideOffset={SUBMENU_OFFSET_PX}
              >
                <DropdownMenu.Item className="menu-item">
                  Advanced Settings
                </DropdownMenu.Item>
                <DropdownMenu.Item className="menu-item">
                  Keyboard Shortcuts
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <DropdownMenu.Separator className="menu-separator" />

          <DropdownMenu.Item className="menu-item menu-item-danger">
            Sign Out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

**Why good:** `Sub` wires the submenu's own roving focus, hover intent and arrow-key entry — Right
opens, Left returns. The inner `Portal` is separate from the outer one, so the submenu escapes the
parent menu's clipping as well as the page's. `Separator` is announced as a group boundary rather
than being a decorative rule.

---

## Pattern 2: Menu with Checkable Items

### Good Example - View Options Menu

```typescript
import { useState } from "react";
import { DropdownMenu } from "radix-ui";

const OFFSET_PX = 5;

export function ViewOptionsMenu() {
  const [showHidden, setShowHidden] = useState(false);
  const [sortOrder, setSortOrder] = useState<"name" | "date" | "size">("name");

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="menu-trigger">
        View Options
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-content" sideOffset={OFFSET_PX}>
          <DropdownMenu.Label className="menu-label">
            Display
          </DropdownMenu.Label>

          <DropdownMenu.CheckboxItem
            className="menu-checkbox-item"
            checked={showHidden}
            onCheckedChange={setShowHidden}
          >
            <DropdownMenu.ItemIndicator className="menu-indicator">
              <span aria-hidden="true">&#10003;</span>
            </DropdownMenu.ItemIndicator>
            Show Hidden Files
          </DropdownMenu.CheckboxItem>

          <DropdownMenu.Separator className="menu-separator" />

          <DropdownMenu.Label className="menu-label">
            Sort By
          </DropdownMenu.Label>

          <DropdownMenu.RadioGroup value={sortOrder} onValueChange={setSortOrder}>
            <DropdownMenu.RadioItem className="menu-radio-item" value="name">
              <DropdownMenu.ItemIndicator className="menu-indicator">
                <span aria-hidden="true">&#8226;</span>
              </DropdownMenu.ItemIndicator>
              Name
            </DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem className="menu-radio-item" value="date">
              <DropdownMenu.ItemIndicator className="menu-indicator">
                <span aria-hidden="true">&#8226;</span>
              </DropdownMenu.ItemIndicator>
              Date Modified
            </DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem className="menu-radio-item" value="size">
              <DropdownMenu.ItemIndicator className="menu-indicator">
                <span aria-hidden="true">&#8226;</span>
              </DropdownMenu.ItemIndicator>
              Size
            </DropdownMenu.RadioItem>
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

**Why good:** `CheckboxItem` and `RadioItem` carry `role="menuitemcheckbox"` and
`role="menuitemradio"`, so the checked state is announced rather than merely drawn. `ItemIndicator`
renders only when its item is selected, which is why the checkmark needs no conditional of its own.
`Label` is skipped by keyboard navigation.
