# Error Boundaries - TypeScript Patterns

> TypeScript-specific patterns for error boundaries. See [core.md](core.md) for basic patterns.

**Prerequisites**: Understand the basic ErrorBoundary component and react-error-boundary library usage from core examples first.

---

## Pattern 7: TypeScript Type Definitions

### Good Example - Typed Error Boundary Props

```typescript
// src/types/error-boundary.ts
import type { ErrorInfo, ReactNode } from "react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  fallbackRender?: (props: FallbackRenderProps) => ReactNode;
  onError?: ErrorHandler;
  onReset?: ResetHandler;
  resetKeys?: unknown[];
}

export interface FallbackRenderProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export type ErrorHandler = (error: Error, errorInfo: ErrorInfo) => void;
export type ResetHandler = () => void;

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}
```

**Why good:** Reusable types for consistent error boundary implementations, exported for use in custom boundaries and tests

---

## Generic Error Boundary HOC

### Good Example - Type-Safe Higher-Order Component

> **Note:** This pattern builds on the basic ErrorBoundary from [core.md](core.md#pattern-1-class-based-error-boundary).

```typescript
// src/components/error-boundary/with-error-boundary.tsx
import { ErrorBoundary } from "react-error-boundary";
import type { ComponentType, ComponentProps } from "react";
import type { FallbackProps } from "react-error-boundary";

interface WithErrorBoundaryOptions {
  FallbackComponent?: ComponentType<FallbackProps>;
  onError?: (error: Error, info: { componentStack?: string | null }) => void;
}

export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithErrorBoundaryOptions = {}
) {
  const { FallbackComponent = DefaultFallback, onError } = options;

  function WithErrorBoundaryComponent(props: ComponentProps<ComponentType<P>>) {
    return (
      <ErrorBoundary FallbackComponent={FallbackComponent} onError={onError}>
        <WrappedComponent {...(props as P)} />
      </ErrorBoundary>
    );
  }

  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component";
  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${displayName})`;

  return WithErrorBoundaryComponent;
}

function DefaultFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div role="alert">
      <p>Something went wrong</p>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

// Usage
const SafeChart = withErrorBoundary(Chart, {
  FallbackComponent: ChartFallback,
  onError: (error) => console.error("Chart error:", error),
});
```

**Why good:** HOC pattern for wrapping components, preserves displayName for debugging, typed options object

---

### Good Example - Extended Fallback Props Type

```typescript
// src/components/fallbacks/types.ts
import type { FallbackProps } from "react-error-boundary";

/**
 * Extended fallback props with additional context
 */
export interface ContextualFallbackProps extends FallbackProps {
  /** Display name for the failed component */
  componentName?: string;
  /** Additional context for error reporting */
  context?: Record<string, unknown>;
}

/**
 * Create typed fallback component factory
 */
export function createTypedFallback<TProps extends FallbackProps>(
  FallbackComponent: React.ComponentType<TProps>
) {
  return FallbackComponent;
}
```

**Why good:** Enables extending FallbackProps with custom context, factory function ensures type safety

---

### Good Example - Typed Error Classification

```typescript
// src/types/classified-error.ts

/** Error categories for different handling strategies */
export type ErrorCategory = "network" | "auth" | "validation" | "unknown";

/** Extended error interface with classification metadata */
export interface ClassifiedError extends Error {
  category: ErrorCategory;
  retryable: boolean;
  statusCode?: number;
  originalError?: Error;
}

/** Type guard for classified errors */
export function isClassifiedError(error: Error): error is ClassifiedError {
  return "category" in error && "retryable" in error;
}

/** Create a classified error from a regular error */
export function createClassifiedError(
  error: Error,
  category: ErrorCategory,
  retryable: boolean
): ClassifiedError {
  const classified = error as ClassifiedError;
  classified.category = category;
  classified.retryable = retryable;
  return classified;
}
```

**Why good:** Type-safe error classification, type guard for safe narrowing, factory function for consistent creation

---
