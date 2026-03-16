# React Native - Core Patterns

> Core component architecture and platform patterns. See [SKILL.md](../SKILL.md) for decision guidance.

**Prerequisites**: Familiarity with React component patterns and TypeScript.

---

## Pattern 1: Component with Variants, Accessibility, and Loading

```typescript
import { forwardRef, useCallback, useMemo, type ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from "react-native";

// Design tokens as constants
const COLORS = {
  primary: "#007AFF",
  secondary: "#5856D6",
  ghost: "transparent",
  text: "#FFFFFF",
  textGhost: "#007AFF",
  disabled: "rgba(0,0,0,0.3)",
} as const;

const SIZES = {
  sm: { paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 },
  md: { paddingVertical: 12, paddingHorizontal: 16, fontSize: 16 },
  lg: { paddingVertical: 16, paddingHorizontal: 24, fontSize: 18 },
} as const;

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export const Button = forwardRef<View, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      disabled = false,
      loading = false,
      onPress,
      style,
      textStyle,
      testID,
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const buttonStyle = useMemo(
      () => [
        styles.base,
        {
          backgroundColor: variant === "ghost" ? COLORS.ghost : COLORS[variant],
          paddingVertical: SIZES[size].paddingVertical,
          paddingHorizontal: SIZES[size].paddingHorizontal,
        },
        variant === "ghost" && styles.ghostBorder,
        isDisabled && styles.disabled,
        style,
      ],
      [variant, size, isDisabled, style]
    );

    const labelStyle = useMemo(
      () => [
        styles.text,
        { fontSize: SIZES[size].fontSize },
        variant === "ghost" && styles.ghostText,
        textStyle,
      ],
      [variant, size, textStyle]
    );

    const handlePress = useCallback(() => {
      if (!isDisabled) {
        onPress();
      }
    }, [isDisabled, onPress]);

    return (
      <Pressable
        ref={ref}
        style={buttonStyle}
        onPress={handlePress}
        disabled={isDisabled}
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        accessibilityLabel={typeof children === "string" ? children : undefined}
      >
        {loading ? (
          <ActivityIndicator color={variant === "ghost" ? COLORS.primary : COLORS.text} />
        ) : (
          <Text style={labelStyle}>{children}</Text>
        )}
      </Pressable>
    );
  }
);

Button.displayName = "Button";

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  text: {
    color: COLORS.text,
    fontWeight: "600",
  },
  ghostBorder: {
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  ghostText: {
    color: COLORS.textGhost,
  },
  disabled: {
    opacity: 0.5,
  },
});
```

**Why good:** forwardRef for parent ref access, accessibilityRole/State for screen readers, useMemo prevents style object recreation, testID for E2E testing, named constants, loading state built-in

---

## Pattern 2: Compound Component with Reanimated

```typescript
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

// Types
interface AccordionContextValue {
  expandedId: string | null;
  toggle: (id: string) => void;
}

interface AccordionItemContextValue {
  id: string;
  isExpanded: boolean;
}

// Contexts
const AccordionContext = createContext<AccordionContextValue | null>(null);
const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

// Hooks
function useAccordion() {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error("Accordion components must be used within Accordion.Root");
  }
  return context;
}

function useAccordionItem() {
  const context = useContext(AccordionItemContext);
  if (!context) {
    throw new Error("AccordionItem components must be used within Accordion.Item");
  }
  return context;
}

// Root Component
function AccordionRoot({ children, defaultExpanded }: { children: ReactNode; defaultExpanded?: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(defaultExpanded ?? null);

  const toggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const value = useMemo(() => ({ expandedId, toggle }), [expandedId, toggle]);

  return (
    <AccordionContext.Provider value={value}>
      <View style={styles.root}>{children}</View>
    </AccordionContext.Provider>
  );
}

// Trigger Component with animated icon
function AccordionTrigger({ children }: { children: ReactNode }) {
  const { toggle } = useAccordion();
  const { id, isExpanded } = useAccordionItem();

  const handlePress = useCallback(() => toggle(id), [toggle, id]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(isExpanded ? "180deg" : "0deg") }],
  }));

  return (
    <Pressable
      onPress={handlePress}
      style={styles.trigger}
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}
    >
      <Text style={styles.triggerText}>{children}</Text>
      <Animated.Text style={[styles.icon, iconStyle]}>▼</Animated.Text>
    </Pressable>
  );
}

// Item and Content components follow same pattern
function AccordionItem({ id, children }: { id: string; children: ReactNode }) {
  const { expandedId } = useAccordion();
  const isExpanded = expandedId === id;
  const value = useMemo(() => ({ id, isExpanded }), [id, isExpanded]);

  return (
    <AccordionItemContext.Provider value={value}>
      <View style={styles.item}>{children}</View>
    </AccordionItemContext.Provider>
  );
}

function AccordionContent({ children }: { children: ReactNode }) {
  const { isExpanded } = useAccordionItem();
  if (!isExpanded) return null;

  return <View style={styles.content}>{children}</View>;
}

// Export as compound component
export const Accordion = {
  Root: AccordionRoot,
  Item: AccordionItem,
  Trigger: AccordionTrigger,
  Content: AccordionContent,
};

const styles = StyleSheet.create({
  root: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  item: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#FAFAFA",
  },
  triggerText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  icon: {
    fontSize: 12,
    color: "#666",
  },
  content: {
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
});

// Usage
function FAQScreen() {
  return (
    <Accordion.Root defaultExpanded="q1">
      <Accordion.Item id="q1">
        <Accordion.Trigger>What is React Native?</Accordion.Trigger>
        <Accordion.Content>
          <Text>React Native is a framework for building native mobile apps...</Text>
        </Accordion.Content>
      </Accordion.Item>
      <Accordion.Item id="q2">
        <Accordion.Trigger>How does it work?</Accordion.Trigger>
        <Accordion.Content>
          <Text>React Native renders to native components...</Text>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}
```

**Why good:** Context-based compound component with Reanimated animations, accessibilityState tracks expanded state, throw on missing provider catches misuse early

---

## Pattern 3: Platform-Specific File Splitting

When platform differences are significant (different haptic APIs, different UI feedback), use platform-specific file extensions.

```
components/
├── button/
│   ├── button.tsx           # Shared types/logic
│   ├── button.ios.tsx       # iOS-specific implementation
│   ├── button.android.tsx   # Android-specific implementation
│   └── index.ts             # Re-exports platform file
```

```typescript
// button.ios.tsx
import { Pressable, Text } from "react-native";
import * as Haptics from "expo-haptics";

export function Button({ onPress, children }: ButtonProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable onPress={handlePress} style={styles.button}>
      <Text style={styles.text}>{children}</Text>
    </Pressable>
  );
}

// button.android.tsx
import { Pressable, Text } from "react-native";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";

export function Button({ onPress, children }: ButtonProps) {
  const handlePress = () => {
    ReactNativeHapticFeedback.trigger("impactMedium");
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      android_ripple={{ color: "rgba(0,0,0,0.1)" }}
      style={styles.button}
    >
      <Text style={styles.text}>{children}</Text>
    </Pressable>
  );
}
```

**Why good:** Each platform uses native haptic API, Android gets ripple effect, Metro bundler auto-selects correct file based on platform
