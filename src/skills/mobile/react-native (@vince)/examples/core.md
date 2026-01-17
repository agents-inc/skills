# Core React Native Patterns

Essential component patterns, hooks, and architecture examples.

---

## Functional Component with forwardRef

```typescript
import { forwardRef, useCallback, useMemo, type ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
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

---

## Custom Hook Pattern

```typescript
import { useState, useCallback, useEffect, useRef } from "react";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseAsyncReturn<T> extends AsyncState<T> {
  execute: () => Promise<void>;
  reset: () => void;
}

export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  immediate = true
): UseAsyncReturn<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  const mountedRef = useRef(true);

  const execute = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await asyncFunction();
      // Only update state if component is still mounted
      if (mountedRef.current) {
        setState({ data: result, loading: false, error: null });
      }
    } catch (error) {
      if (mountedRef.current) {
        setState({ data: null, loading: false, error: error as Error });
      }
    }
  }, [asyncFunction]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (immediate) {
      execute();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [execute, immediate]);

  return { ...state, execute, reset };
}

// Usage
function UserProfile({ userId }: { userId: string }) {
  const fetchUser = useCallback(
    () => api.getUser(userId),
    [userId]
  );

  const { data: user, loading, error, execute: refetch } = useAsync(fetchUser);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorView message={error.message} onRetry={refetch} />;
  if (!user) return null;

  return <ProfileCard user={user} />;
}
```

---

## Compound Component Pattern

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
  useDerivedValue,
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
interface RootProps {
  children: ReactNode;
  defaultExpanded?: string;
}

function AccordionRoot({ children, defaultExpanded }: RootProps) {
  const [expandedId, setExpandedId] = useState<string | null>(
    defaultExpanded ?? null
  );

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

// Item Component
interface ItemProps {
  id: string;
  children: ReactNode;
}

function AccordionItem({ id, children }: ItemProps) {
  const { expandedId } = useAccordion();
  const isExpanded = expandedId === id;

  const value = useMemo(() => ({ id, isExpanded }), [id, isExpanded]);

  return (
    <AccordionItemContext.Provider value={value}>
      <View style={styles.item}>{children}</View>
    </AccordionItemContext.Provider>
  );
}

// Trigger Component
interface TriggerProps {
  children: ReactNode;
}

function AccordionTrigger({ children }: TriggerProps) {
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

// Content Component
interface ContentProps {
  children: ReactNode;
}

function AccordionContent({ children }: ContentProps) {
  const { isExpanded } = useAccordionItem();

  const animatedStyle = useAnimatedStyle(() => ({
    height: withTiming(isExpanded ? "auto" : 0),
    opacity: withTiming(isExpanded ? 1 : 0),
  }));

  if (!isExpanded) return null;

  return (
    <Animated.View style={[styles.content, animatedStyle]}>
      {children}
    </Animated.View>
  );
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

---

## Error Boundary Pattern

```typescript
import { Component, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to error reporting service
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
          <Pressable style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

// Usage
function App() {
  return (
    <ErrorBoundary
      onError={(error) => {
        // Send to Sentry, Bugsnag, etc.
        reportError(error);
      }}
    >
      <MainApp />
    </ErrorBoundary>
  );
}
```

---

## Loading and Empty States

```typescript
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from "react-native";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon = "📭",
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {actionLabel && onAction && (
        <Pressable style={styles.action} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={styles.errorTitle}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry && (
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666666",
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    maxWidth: 280,
    marginBottom: 24,
  },
  action: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FF3B30",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
```

---

## Async Data Component Pattern

```typescript
import type { ReactNode } from "react";
import { LoadingState, EmptyState, ErrorState } from "./states";

interface AsyncDataProps<T> {
  data: T | null | undefined;
  loading: boolean;
  error: Error | null;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
  loadingMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  isEmpty?: (data: T) => boolean;
}

export function AsyncData<T>({
  data,
  loading,
  error,
  onRetry,
  children,
  loadingMessage,
  emptyTitle = "No data",
  emptyDescription,
  isEmpty = (d) => Array.isArray(d) && d.length === 0,
}: AsyncDataProps<T>) {
  if (loading) {
    return <LoadingState message={loadingMessage} />;
  }

  if (error) {
    return <ErrorState message={error.message} onRetry={onRetry} />;
  }

  if (!data || isEmpty(data)) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={onRetry ? "Refresh" : undefined}
        onAction={onRetry}
      />
    );
  }

  return <>{children(data)}</>;
}

// Usage
function ProductListScreen() {
  const { data, loading, error, refetch } = useProducts();

  return (
    <AsyncData
      data={data}
      loading={loading}
      error={error}
      onRetry={refetch}
      emptyTitle="No products found"
      emptyDescription="Check back later for new products"
    >
      {(products) => <ProductList products={products} />}
    </AsyncData>
  );
}
```
