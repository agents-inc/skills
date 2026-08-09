# Unistyles Variants Patterns

> Related: [core.md](core.md) for StyleSheet basics, [theming.md](theming.md) for themes

---

## Pattern 1: Basic Variants

Define named groups of style options inside `variants`. Select the active combination with `styles.useVariants()`.

```typescript
import { StyleSheet } from "react-native-unistyles";

const styles = StyleSheet.create((theme) => ({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    variants: {
      status: {
        success: { backgroundColor: theme.colors.accents.success },
        warning: { backgroundColor: theme.colors.accents.warning },
        error: { backgroundColor: theme.colors.accents.danger },
      },
      size: {
        sm: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
        md: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
        lg: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
      },
    },
  },
}));

// In component
styles.useVariants({ status: "success", size: "md" });

<View style={styles.badge}>
  <Text>Active</Text>
</View>
```

**Why good:** eliminates conditional style objects, TypeScript infers valid status/size combinations, all variant logic lives in the stylesheet

---

## Pattern 2: Boolean Variants

Use `"true"` and `"false"` as string keys for toggle-style variants. These are distinct from a `default` variant.

```typescript
const styles = StyleSheet.create((theme) => ({
  input: {
    borderWidth: 1,
    borderColor: theme.colors.dimmed,
    padding: 12,
    borderRadius: 8,
    variants: {
      isDisabled: {
        true: {
          opacity: 0.5,
          backgroundColor: theme.colors.dimmed,
        },
        false: {
          opacity: 1,
          backgroundColor: theme.colors.surface,
        },
      },
      hasError: {
        true: {
          borderColor: theme.colors.error,
          borderWidth: 2,
        },
        // "false" variant is optional -- base styles apply when not "true"
      },
    },
  },
}));

// In component
styles.useVariants({
  isDisabled: false,
  hasError: hasValidationError,
});
```

**Gotcha:** Boolean variant keys are strings `"true"` and `"false"`, but you pass actual booleans to `useVariants`. You don't need to define both `"true"` and `"false"` -- omitting one means the base styles apply for that value.

---

## Pattern 3: Default Variants

Define a `default` key that applies when no variant is selected (undefined) or when `useVariants({})` is called.

```typescript
const styles = StyleSheet.create((theme) => ({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    variants: {
      color: {
        default: { backgroundColor: theme.colors.surface },
        primary: { backgroundColor: theme.colors.primary },
        danger: { backgroundColor: theme.colors.error },
      },
    },
  },
}));

// All of these use the "default" variant:
styles.useVariants({});
styles.useVariants(undefined);
styles.useVariants({ color: undefined });
```

---

## Pattern 4: Compound Variants

Apply additional styles when multiple variant conditions are met simultaneously. Compound variant styles override regular variant styles.

```typescript
const styles = StyleSheet.create((theme) => ({
  text: {
    fontSize: 14,
    variants: {
      weight: {
        normal: { fontWeight: "400" },
        bold: { fontWeight: "700" },
      },
      color: {
        default: { color: theme.colors.typography },
        primary: { color: theme.colors.primary },
        link: { color: theme.colors.link },
      },
    },
    compoundVariants: [
      // When bold AND link, add underline
      {
        weight: "bold",
        color: "link",
        styles: {
          textDecorationLine: "underline",
        },
      },
      // When bold AND primary, increase size
      {
        weight: "bold",
        color: "primary",
        styles: {
          fontSize: 16,
        },
      },
    ],
  },
}));
```

**Precedence order (lowest to highest):**

1. Base styles (outside `variants`)
2. Regular variant styles
3. Compound variant styles (always win over regular variants)

---

## Pattern 5: Component Props Pattern

Wire variant selections to component props using the `UnistylesVariants` utility type. This provides full type safety from StyleSheet to JSX.

```typescript
import { StyleSheet } from "react-native-unistyles";
import type { UnistylesVariants } from "react-native-unistyles";
import { View, Text, Pressable } from "react-native";

const styles = StyleSheet.create((theme) => ({
  button: {
    borderRadius: 8,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    variants: {
      variant: {
        filled: { backgroundColor: theme.colors.primary },
        outlined: {
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: theme.colors.primary,
        },
        ghost: { backgroundColor: "transparent" },
      },
      size: {
        sm: { paddingHorizontal: 12, paddingVertical: 6 },
        md: { paddingHorizontal: 16, paddingVertical: 10 },
        lg: { paddingHorizontal: 24, paddingVertical: 14 },
      },
    },
  },
}));

// Derive props type from the stylesheet
type ButtonVariants = UnistylesVariants<typeof styles>;

interface ButtonProps extends ButtonVariants {
  title: string;
  onPress: () => void;
}

export function Button({ title, onPress, variant = "filled", size = "md" }: ButtonProps) {
  // useVariants binds the component to the selected variants
  styles.useVariants({ variant, size });

  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text>{title}</Text>
    </Pressable>
  );
}

// Usage -- TypeScript enforces valid variant combinations
<Button title="Save" onPress={handleSave} variant="filled" size="lg" />
<Button title="Cancel" onPress={handleCancel} variant="ghost" size="sm" />
```

**Why good:** `UnistylesVariants` derives the exact variant options from the stylesheet -- adding a new variant in StyleSheet automatically adds it to the component's type

---

## Pattern 6: Multi-Style Variants

When multiple style keys in the same StyleSheet need the same variant groups, define identical variant keys in each. This is common for components with separate container and text styles.

```typescript
const styles = StyleSheet.create((theme) => ({
  container: {
    padding: 16,
    borderRadius: 8,
    variants: {
      intent: {
        info: { backgroundColor: theme.colors.accents.success },
        warning: { backgroundColor: theme.colors.accents.warning },
        error: { backgroundColor: theme.colors.accents.danger },
      },
    },
  },
  label: {
    fontWeight: "600",
    variants: {
      intent: {
        info: { color: "#1a472a" },
        warning: { color: "#7c4a03" },
        error: { color: "#7f1d1d" },
      },
    },
  },
}));

// Single useVariants call controls all style keys
styles.useVariants({ intent: "warning" });

<View style={styles.container}>
  <Text style={styles.label}>Warning message</Text>
</View>
```

**Important:** All variant options must appear in each style key that uses that variant group. If `container` has `info/warning/error`, then `label` must also define all three. Missing options cause TypeScript errors.
