# shadcn/ui - Command Palette Examples

> Command menu with keyboard navigation and search. See [core.md](core.md) for setup basics.

---

## Command Menu with Keyboard Navigation

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

interface CommandMenuProps {
  onNavigate: (path: string) => void;
}

export function CommandMenu({ onNavigate }: CommandMenuProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() => runCommand(() => onNavigate("/calendar"))}
          >
            <span>Calendar</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => onNavigate("/search"))}>
            <span>Search</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem
            onSelect={() => runCommand(() => onNavigate("/profile"))}
          >
            <span>Profile</span>
            <CommandShortcut>Ctrl+P</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => onNavigate("/settings"))}
          >
            <span>Settings</span>
            <CommandShortcut>Ctrl+S</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

**Why good:** `runCommand` closes the dialog before running the action, so a navigation does not race
the unmount. `CommandInput` filters `CommandItem` children by their text content with no filter
prop and no state — which is why `CommandEmpty` is the only empty handling needed. The `keydown`
listener is on `document` rather than on an element, since the palette must open from anywhere, and
its cleanup is what keeps a remount from stacking handlers. `onNavigate` arrives as a prop, so the
palette is unaware of how routing works.
