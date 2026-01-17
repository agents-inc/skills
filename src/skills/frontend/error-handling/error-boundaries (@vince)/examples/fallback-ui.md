# Error Boundaries - Fallback UI Patterns

> Advanced fallback UI patterns for better user experience. See [core.md](core.md) for basic patterns.

**Prerequisites**: Understand the basic ErrorBoundary component and minimal accessible fallback from core examples first.

---

## Pattern 9: Environment-Aware Fallbacks

### Good Example - Development vs Production Fallback

```typescript
// src/components/fallbacks/smart-fallback.tsx
import type { FallbackProps } from "react-error-boundary";

export function SmartFallback({ error, resetErrorBoundary }: FallbackProps) {
  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <div role="alert">
      <h2>Something went wrong</h2>

      {isDevelopment ? (
        // Detailed info for developers
        <details open>
          <summary>Error Details</summary>
          <pre style={{ whiteSpace: "pre-wrap", overflow: "auto" }}>
            <strong>Message:</strong> {error.message}
            {"\n\n"}
            <strong>Stack:</strong> {error.stack}
          </pre>
        </details>
      ) : (
        // Friendly message for users
        <p>We apologize for the inconvenience. Please try again.</p>
      )}

      <div style={{ marginTop: "1rem" }}>
        <button onClick={resetErrorBoundary}>Try again</button>
        <button onClick={() => window.location.reload()}>Refresh page</button>
      </div>
    </div>
  );
}
```

**Why good:** Shows detailed error info in development for debugging, shows user-friendly message in production, multiple recovery options

---

## Feature-Contextual Fallbacks

### Good Example - Chart-Specific Fallback

```typescript
// src/components/fallbacks/chart-fallback.tsx
import type { FallbackProps } from "react-error-boundary";

interface ChartFallbackProps extends FallbackProps {
  chartTitle: string;
}

export function ChartFallback({
  error,
  resetErrorBoundary,
  chartTitle,
}: ChartFallbackProps) {
  return (
    <div
      role="alert"
      style={{
        border: "1px dashed #ccc",
        padding: "2rem",
        textAlign: "center",
        background: "#fafafa",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: "2rem" }}>
        📊
      </span>
      <h3>{chartTitle}</h3>
      <p>Chart could not be displayed</p>
      {process.env.NODE_ENV === "development" && (
        <p style={{ color: "#666", fontSize: "0.875rem" }}>{error.message}</p>
      )}
      <button onClick={resetErrorBoundary}>Reload chart</button>
    </div>
  );
}

// Usage
function RevenueSection() {
  const CHART_TITLE = "Revenue Overview";

  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <ChartFallback
          error={error}
          resetErrorBoundary={resetErrorBoundary}
          chartTitle={CHART_TITLE}
        />
      )}
    >
      <RevenueChart title={CHART_TITLE} />
    </ErrorBoundary>
  );
}
```

**Why good:** Fallback matches visual style of chart placeholder, context-specific messaging, visual indicator of what's missing

---

### Good Example - Skeleton Placeholder Fallback

```typescript
// src/components/fallbacks/skeleton-fallback.tsx
import type { FallbackProps } from "react-error-boundary";
import styles from "./skeleton-fallback.module.scss";

interface SkeletonFallbackProps extends FallbackProps {
  /** Type of skeleton to show */
  variant: "card" | "table" | "list";
  /** Optional message override */
  message?: string;
}

export function SkeletonFallback({
  error,
  resetErrorBoundary,
  variant,
  message = "Failed to load",
}: SkeletonFallbackProps) {
  return (
    <div role="alert" className={styles.fallback} data-variant={variant}>
      <div className={styles.skeleton} aria-hidden="true" />
      <div className={styles.overlay}>
        <p>{message}</p>
        {process.env.NODE_ENV === "development" && (
          <p className={styles.errorDetail}>{error.message}</p>
        )}
        <button onClick={resetErrorBoundary}>Retry</button>
      </div>
    </div>
  );
}
```

**Why good:** Maintains layout with skeleton, reduces visual jarring when error occurs, variant-based styling for different content types

---

### Good Example - Form Error Fallback

```typescript
// src/components/fallbacks/form-fallback.tsx
import type { FallbackProps } from "react-error-boundary";

interface FormFallbackProps extends FallbackProps {
  formName: string;
  onCancel?: () => void;
}

export function FormFallback({
  error,
  resetErrorBoundary,
  formName,
  onCancel,
}: FormFallbackProps) {
  return (
    <div role="alert" className="form-error">
      <h3>Form Error</h3>
      <p>Unable to load the {formName} form.</p>

      {process.env.NODE_ENV === "development" && (
        <details>
          <summary>Technical Details</summary>
          <pre>{error.message}</pre>
        </details>
      )}

      <div className="form-error-actions">
        <button onClick={resetErrorBoundary}>Try Again</button>
        {onCancel && (
          <button onClick={onCancel} type="button">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
```

**Why good:** Form-specific context, cancel option for user to abandon action, maintains form UX patterns

---

### Good Example - Image/Media Fallback

```typescript
// src/components/fallbacks/media-fallback.tsx
import type { FallbackProps } from "react-error-boundary";

interface MediaFallbackProps extends FallbackProps {
  mediaType: "image" | "video" | "audio";
  altText?: string;
  width?: number;
  height?: number;
}

export function MediaFallback({
  resetErrorBoundary,
  mediaType,
  altText = "Media content",
  width,
  height,
}: MediaFallbackProps) {
  const ICON_MAP = {
    image: "🖼️",
    video: "🎬",
    audio: "🔊",
  } as const;

  return (
    <div
      role="alert"
      className="media-fallback"
      style={{
        width: width ? `${width}px` : "100%",
        height: height ? `${height}px` : "auto",
        minHeight: "100px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f5",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: "2rem" }}>
        {ICON_MAP[mediaType]}
      </span>
      <p style={{ margin: "0.5rem 0" }}>
        {altText} failed to load
      </p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  );
}
```

**Why good:** Maintains aspect ratio/dimensions of failed media, appropriate icon per media type, preserves layout

---

### Good Example - Navigation-Aware Fallback

```typescript
// src/components/fallbacks/navigation-fallback.tsx
import { useNavigate, useLocation } from "react-router-dom";
import type { FallbackProps } from "react-error-boundary";

export function NavigationFallback({ error, resetErrorBoundary }: FallbackProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleGoHome = () => {
    navigate("/");
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div role="alert" className="navigation-fallback">
      <h2>Page Error</h2>
      <p>
        Failed to load <code>{location.pathname}</code>
      </p>

      {process.env.NODE_ENV === "development" && (
        <pre className="error-details">{error.message}</pre>
      )}

      <div className="fallback-actions">
        <button onClick={resetErrorBoundary}>Try Again</button>
        <button onClick={handleGoBack}>Go Back</button>
        <button onClick={handleGoHome}>Go to Home</button>
      </div>
    </div>
  );
}
```

**Why good:** Shows which route failed, multiple navigation options, integrates with router for proper navigation

---
