---
name: frontend/ui-shadcn-ui (@vince)
description: shadcn/ui component library patterns, CLI usage, theming, customization
---

# shadcn/ui Component Patterns

> **Quick Guide:** shadcn/ui is a collection of copy-paste components you own. Use CLI to add components (`npx shadcn@latest add`), customize via CSS variables, compose with Radix primitives. Components go in `components/ui/`. Theme via `:root` and `.dark` CSS custom properties.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST use the CLI to add components - `npx shadcn@latest add [component]` - not manual copy)**

**(You MUST customize components through CSS variables and the cn() utility - not direct style overrides)**

**(You MUST keep components in the `components/ui/` directory - this is the shadcn convention)**

**(You MUST use the `cn()` utility from `lib/utils` for conditional class merging)**

**(You MUST set up `components.json` before adding components - run `npx shadcn@latest init`)**

</critical_requirements>

---

**Auto-detection:** shadcn/ui, shadcn, @shadcn, components.json, npx shadcn, cn() utility, ui components, Radix-based components

**When to use:**

- Building React applications with consistent, accessible UI components
- Setting up a component library with full ownership and customization
- Implementing dark mode theming with CSS variables
- Creating forms with accessible, composable field components
- Building data display interfaces (tables, cards, dialogs)

**Key patterns covered:**

- CLI installation and component management
- CSS variable theming system
- Component customization and extension
- Composition patterns with compound components
- Dark mode implementation
- Directory structure and organization

**When NOT to use:**

- Simple prototypes without design system needs
- Projects requiring Material Design or other opinionated design systems
- Applications where you cannot control the component source

**Detailed Resources:**
- For code examples, see [examples/](examples/) folder
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

---

<philosophy>

## Philosophy

shadcn/ui operates on a fundamental premise: **it's not a traditional component library, but how you build your component library.** Instead of installing an NPM package with hidden code, you copy components into your codebase and own them completely.

**Five Core Principles:**

1. **Open Code** - Component source is visible and modifiable. No hidden abstractions.
2. **Composition** - Components share a consistent, composable interface.
3. **Distribution** - CLI and flat-file schema enable easy component distribution.
4. **Beautiful Defaults** - Carefully curated styling that works out of the box.
5. **AI-Ready** - Open source architecture allows tools to read and improve components.

**Headless Architecture:**

Components follow a headless pattern where core functionality (accessibility, keyboard nav) comes from Radix primitives, while styling is fully customizable. Updates to primitives come via dependency upgrades; design layer remains yours.

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Project Setup and Initialization

Initialize shadcn/ui in your project before adding any components.

#### Installation Steps

```bash
# Step 1: Initialize shadcn/ui (creates components.json)
npx shadcn@latest init

# Step 2: Answer prompts or use defaults
# - Style: Default or New York
# - Base color: Slate, Gray, Zinc, Neutral, Stone
# - CSS variables: Yes (recommended)
# - Tailwind config path
# - Components directory
```

#### components.json Configuration

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

**Why good:** centralized configuration ensures consistent component installation, CSS variables enable theming without modifying components, aliases simplify imports across the codebase

---

### Pattern 2: Adding and Managing Components

Use the CLI to add components to your project. Components are copied to your codebase, not installed as dependencies.

#### Adding Components

```bash
# Add a single component
npx shadcn@latest add button

# Add multiple components
npx shadcn@latest add button card dialog

# Add all form-related components
npx shadcn@latest add form input label textarea select

# List available components
npx shadcn@latest add
```

#### Directory Structure

```
src/
├── components/
│   └── ui/           # shadcn/ui components live here
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       └── ...
├── lib/
│   └── utils.ts      # cn() utility function
└── app/
    └── globals.css   # CSS variables and base styles
```

**Why good:** components become part of your codebase (full ownership), updates are opt-in (you control when to update), customization is straightforward (just edit the files)

---

### Pattern 3: The cn() Utility for Class Merging

The `cn()` utility combines `clsx` and `tailwind-merge` for conditional and conflict-free class merging.

#### Basic Usage

```typescript
// lib/utils.ts - created by shadcn init
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

#### Usage in Components

```tsx
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline";
}

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium",
        variant === "destructive" && "bg-destructive text-destructive-foreground",
        variant === "outline" && "border border-input bg-background",
        className // Custom classes always come last
      )}
      {...props}
    />
  );
}
```

**Why good:** `cn()` merges classes intelligently (last wins for conflicts), conditional classes are clean and readable, consumer's `className` prop can override defaults

---

### Pattern 4: CSS Variable Theming System

shadcn/ui uses CSS custom properties for theming, enabling global style changes without touching components.

#### Theme Structure

```css
/* globals.css - base theme */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    /* ... other dark mode overrides */
  }
}
```

#### Color Convention

shadcn uses a background/foreground convention:
- `--primary` is the background color
- `--primary-foreground` is the text color for that background

**Why good:** single source of truth for colors, dark mode is automatic via `.dark` class, consistent naming makes colors predictable

---

### Pattern 5: Dark Mode Implementation

Dark mode is implemented by toggling a `.dark` class on the root element.

#### Provider Setup

```tsx
// components/theme-provider.tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

#### Theme Toggle Component

```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
```

**Why good:** system preference detection works automatically, theme persists across sessions, no flash of unstyled content with `suppressHydrationWarning`

---

### Pattern 6: Component Composition

shadcn/ui components are designed for composition. Build complex UIs by combining primitive components.

#### Compound Component Pattern

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function FeatureCard({ title, description, onAction }: FeatureCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Your content here */}
      </CardContent>
      <CardFooter>
        <Button onClick={onAction}>Learn more</Button>
      </CardFooter>
    </Card>
  );
}
```

#### Dialog with Form Composition

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EditProfileDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Edit Profile</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" defaultValue="Pedro Duarte" className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Why good:** composition creates flexibility without complexity, each part can be styled independently, consistent interface across all compound components

---

### Pattern 7: Form Components Integration

shadcn/ui provides form components that integrate with form libraries. The Form component wraps form fields with accessibility and validation display.

#### Form Field Structure

```tsx
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

// Inside your form component
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl>
        <Input placeholder="name@example.com" {...field} />
      </FormControl>
      <FormDescription>
        We will never share your email.
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

#### Component Hierarchy

- `FormField` - Connects to form state
- `FormItem` - Wrapper with spacing
- `FormLabel` - Accessible label with error states
- `FormControl` - Wraps the actual input
- `FormDescription` - Helper text
- `FormMessage` - Validation error display

**Why good:** consistent structure across all form fields, accessibility attributes applied automatically, error states handled uniformly

**Note:** For form handling logic and validation, defer to your form library skill (react-hook-form, zod).

---

### Pattern 8: Data Display Components

shadcn/ui provides components for displaying structured data.

#### Table Component

```tsx
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function UserTable({ users }: { users: User[] }) {
  return (
    <Table>
      <TableCaption>A list of users in your organization.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">ID</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead className="text-right">Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.id}</TableCell>
            <TableCell>{user.name}</TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell className="text-right">{user.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**Why good:** semantic HTML table structure, accessible by default, consistent styling across all tables

---

### Pattern 9: Feedback Components

Components for user feedback: alerts, toasts, and dialogs.

#### Alert Component

```tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function SuccessAlert({ title, message }: AlertProps) {
  return (
    <Alert>
      <CheckCircle2 className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function ErrorAlert({ title, message }: AlertProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
```

#### Toast System (Sonner)

```tsx
// Add toast component
// npx shadcn@latest add sonner

// In your layout
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

// Usage in any component
import { toast } from "sonner";

function SaveButton() {
  const handleSave = async () => {
    try {
      await saveData();
      toast.success("Changes saved successfully");
    } catch (error) {
      toast.error("Failed to save changes");
    }
  };

  return <Button onClick={handleSave}>Save</Button>;
}
```

**Why good:** consistent feedback patterns, toast system handles stacking and dismissal automatically, destructive variant for error states

---

### Pattern 10: Navigation Components

Components for navigation: tabs, navigation menus, and command palettes.

#### Tabs Component

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SettingsTabs() {
  return (
    <Tabs defaultValue="account" className="w-[400px]">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <AccountSettings />
      </TabsContent>
      <TabsContent value="password">
        <PasswordSettings />
      </TabsContent>
      <TabsContent value="notifications">
        <NotificationSettings />
      </TabsContent>
    </Tabs>
  );
}
```

#### Command Palette (cmdk)

```tsx
import { useState, useEffect } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export function CommandMenu() {
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

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem>Calendar</CommandItem>
          <CommandItem>Search</CommandItem>
          <CommandItem>Settings</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

**Why good:** keyboard navigation built-in, accessible by default, consistent interaction patterns

</patterns>

---

<integration>

## Integration Guide

shadcn/ui integrates with the React ecosystem through its component architecture.

**Works with:**

- **Radix UI** - Provides accessible primitives (Dialog, Dropdown, etc.)
- **Class Variance Authority (cva)** - Used for variant styling in components
- **Tailwind CSS** - Utility classes for styling (defer to tailwind skill for details)
- **Form libraries** - Form component designed for integration (defer to form skill)
- **Validation libraries** - Works with any schema validation (defer to validation skill)

**Styling boundary:**

- shadcn/ui handles: component structure, CSS variables, cn() utility, composition patterns
- Your styling skill handles: Tailwind configuration, utility class usage, custom CSS

**Form boundary:**

- shadcn/ui handles: FormField, FormItem, FormLabel, FormControl, FormMessage components
- Your form skill handles: useForm hook, validation schemas, submission logic

</integration>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use the CLI to add components - `npx shadcn@latest add [component]` - not manual copy)**

**(You MUST customize components through CSS variables and the cn() utility - not direct style overrides)**

**(You MUST keep components in the `components/ui/` directory - this is the shadcn convention)**

**(You MUST use the `cn()` utility from `lib/utils` for conditional class merging)**

**(You MUST set up `components.json` before adding components - run `npx shadcn@latest init`)**

**Failure to follow these rules will break component updates, cause styling conflicts, and violate shadcn/ui conventions.**

</critical_reminders>
