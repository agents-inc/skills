# NativeWind - Core Patterns

> className usage, custom components, variants, and conditional styling. See [SKILL.md](../SKILL.md) for decision guidance.

**Prerequisites**: Familiarity with React Native components and Tailwind CSS utility class syntax.

---

## Pattern 1: Basic className Usage

```tsx
import { View, Text, Pressable, Image, ScrollView } from "react-native";

export function ProfileCard({
  name,
  bio,
  avatarUrl,
  onMessage,
}: {
  name: string;
  bio: string;
  avatarUrl: string;
  onMessage: () => void;
}) {
  return (
    <View className="mx-4 rounded-xl bg-white p-4 shadow-md dark:bg-gray-800">
      <View className="flex-row items-center gap-3">
        <Image source={{ uri: avatarUrl }} className="h-12 w-12 rounded-full" />
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900 dark:text-white">
            {name}
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {bio}
          </Text>
        </View>
      </View>
      <Pressable
        className="mt-4 rounded-lg bg-blue-500 px-4 py-3 active:bg-blue-600"
        onPress={onMessage}
      >
        <Text className="text-center font-semibold text-white">Message</Text>
      </Pressable>
    </View>
  );
}
```

**Why good:** Both light and dark variants declared on every text/background, `active:` for press feedback, `gap-3` for spacing (compiles to native columnGap/rowGap), no style objects needed

---

## Pattern 2: Custom Component with className Prop

Custom components should accept and merge a `className` prop. Never use `cssInterop` or `remapProps` on your own components.

```tsx
import { View, Text, type ViewStyle } from "react-native";

interface SectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Section({ title, children, className }: SectionProps) {
  return (
    <View className={`mb-6 ${className ?? ""}`}>
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </Text>
      {children}
    </View>
  );
}

// Usage
<Section title="Account" className="px-4">
  <Text className="text-gray-900 dark:text-white">Settings content</Text>
</Section>;
```

**Why good:** className prop enables external customization, default styles set on the component, caller can override layout/spacing

---

## Pattern 3: Multiple className Props

Complex components can expose multiple className props for different internal elements.

```tsx
interface ListItemProps {
  title: string;
  subtitle?: string;
  onPress: () => void;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}

export function ListItem({
  title,
  subtitle,
  onPress,
  className,
  titleClassName,
  subtitleClassName,
}: ListItemProps) {
  return (
    <Pressable
      className={`flex-row items-center px-4 py-3 active:bg-gray-100 dark:active:bg-gray-800 ${className ?? ""}`}
      onPress={onPress}
    >
      <View className="flex-1">
        <Text
          className={`text-base text-gray-900 dark:text-white ${titleClassName ?? ""}`}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            className={`mt-0.5 text-sm text-gray-500 dark:text-gray-400 ${subtitleClassName ?? ""}`}
          >
            {subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
```

**Why good:** Each internal element is independently customizable, defaults cover light and dark, no cssInterop needed

---

## Pattern 4: Variants with a Class Merging Library

For components with multiple variant dimensions, use a class merging library to handle conditional classes and resolve conflicts.

### With clsx

```tsx
import clsx from "clsx";
import { Pressable, Text } from "react-native";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onPress: () => void;
  className?: string;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-blue-500 active:bg-blue-600",
  secondary:
    "bg-gray-200 active:bg-gray-300 dark:bg-gray-700 dark:active:bg-gray-600",
  ghost: "bg-transparent active:bg-gray-100 dark:active:bg-gray-800",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5",
  md: "px-4 py-2.5",
  lg: "px-6 py-3.5",
};

const TEXT_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "text-white",
  secondary: "text-gray-900 dark:text-white",
  ghost: "text-blue-500 dark:text-blue-400",
};

const TEXT_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

export function Button({
  label,
  variant = "primary",
  size = "md",
  disabled = false,
  onPress,
  className,
}: ButtonProps) {
  return (
    <Pressable
      className={clsx(
        "items-center rounded-lg",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        disabled && "opacity-50",
        className,
      )}
      disabled={disabled}
      onPress={onPress}
    >
      <Text
        className={clsx(
          "font-semibold",
          TEXT_VARIANT_CLASSES[variant],
          TEXT_SIZE_CLASSES[size],
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
```

**Why good:** clsx handles conditional class concatenation cleanly, variant maps are named constants, disabled state is a simple conditional, caller can override via className

### With tailwind-variants

```tsx
import { tv } from "tailwind-variants";
import { Pressable, Text } from "react-native";

const button = tv({
  base: "items-center rounded-lg",
  variants: {
    variant: {
      primary: "bg-blue-500 active:bg-blue-600",
      secondary: "bg-gray-200 active:bg-gray-300 dark:bg-gray-700",
      ghost: "bg-transparent active:bg-gray-100",
    },
    size: {
      sm: "px-3 py-1.5",
      md: "px-4 py-2.5",
      lg: "px-6 py-3.5",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

const buttonText = tv({
  base: "font-semibold",
  variants: {
    variant: {
      primary: "text-white",
      secondary: "text-gray-900 dark:text-white",
      ghost: "text-blue-500",
    },
    size: {
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

interface ButtonProps {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  onPress: () => void;
  className?: string;
}

export function Button({
  label,
  variant,
  size,
  onPress,
  className,
}: ButtonProps) {
  return (
    <Pressable
      className={button({ variant, size, className })}
      onPress={onPress}
    >
      <Text className={buttonText({ variant, size })}>{label}</Text>
    </Pressable>
  );
}
```

**Why good:** tailwind-variants handles conflict resolution, default variants are declarative, className passthrough enables caller overrides

---

## Pattern 5: Conditional Styling

```tsx
import clsx from "clsx";
import { View, Text } from "react-native";

interface StatusIndicatorProps {
  status: "online" | "offline" | "busy";
  unreadCount: number;
}

const MAX_DISPLAY_COUNT = 99;

const STATUS_COLORS = {
  online: "bg-green-500",
  offline: "bg-gray-400",
  busy: "bg-red-500",
} as const;

export function StatusIndicator({ status, unreadCount }: StatusIndicatorProps) {
  const hasUnread = unreadCount > 0;
  const displayCount =
    unreadCount > MAX_DISPLAY_COUNT
      ? `${MAX_DISPLAY_COUNT}+`
      : String(unreadCount);

  return (
    <View className="flex-row items-center gap-2">
      <View className={clsx("h-3 w-3 rounded-full", STATUS_COLORS[status])} />
      {hasUnread && (
        <View className="min-w-[20px] items-center rounded-full bg-red-500 px-1.5 py-0.5">
          <Text className="text-xs font-bold text-white">{displayCount}</Text>
        </View>
      )}
    </View>
  );
}
```

**Why good:** Status colors are a named constant map, conditional rendering for badge, arbitrary value `min-w-[20px]` for minimum badge width, named constant for display limit

---

## Pattern 6: Inline Style Merging

Inline `style` props merge with className-based styles. Inline properties take precedence.

```tsx
import { View, Text, type ViewStyle } from "react-native";

interface ProgressBarProps {
  progress: number; // 0-1
  className?: string;
}

export function ProgressBar({ progress, className }: ProgressBarProps) {
  // Dynamic width requires inline style -- className can't do runtime percentages
  const fillStyle: ViewStyle = { width: `${progress * 100}%` };

  return (
    <View
      className={`h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 ${className ?? ""}`}
    >
      <View className="h-full rounded-full bg-blue-500" style={fillStyle} />
    </View>
  );
}
```

**Why good:** Static styles in className (background, height, border-radius), dynamic value in inline style (width percentage), inline style takes precedence over className

**When to use inline style:** Runtime-computed values (dynamic widths, calculated positions, values from gestures). For everything else, prefer className.
