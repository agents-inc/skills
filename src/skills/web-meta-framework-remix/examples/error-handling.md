# Remix - Error Handling Examples

> Patterns for error boundaries with multi-status handling.

---

## Basic Error Boundary

```typescript
// app/routes/orders.$orderId.tsx
import {
  isRouteErrorResponse,
  useRouteError,
  Link,
} from "@remix-run/react";

export function ErrorBoundary() {
  const error = useRouteError();

  // Handle thrown Response objects (from loaders/actions)
  if (isRouteErrorResponse(error)) {
    return (
      <div role="alert">
        <h1>Error {error.status}</h1>
        <p>{error.statusText || error.data?.message || "An error occurred"}</p>
        <Link to="/">Go home</Link>
      </div>
    );
  }

  // Handle unexpected JavaScript errors
  if (error instanceof Error) {
    return (
      <div role="alert">
        <h1>Unexpected Error</h1>
        <p>Something went wrong. Please try again.</p>
        {process.env.NODE_ENV === "development" && (
          <pre>{error.message}</pre>
        )}
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  // Unknown error type
  return (
    <div role="alert">
      <h1>Error</h1>
      <p>Something went wrong.</p>
    </div>
  );
}
```

**Why good:** Distinguishes between Response errors and JS errors, accessible with role="alert", dev-only error details, provides recovery actions

---

## Multi-Status Error Handling

```typescript
// app/routes/orders.$orderId.tsx
import {
  isRouteErrorResponse,
  useRouteError,
  Link,
} from "@remix-run/react";

const HTTP_NOT_FOUND = 404;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_SERVER_ERROR = 500;

export function ErrorBoundary() {
  const error = useRouteError();

  // Handle thrown Response objects
  if (isRouteErrorResponse(error)) {
    return (
      <div role="alert" aria-live="assertive">
        {error.status === HTTP_NOT_FOUND && (
          <>
            <h1>Order Not Found</h1>
            <p>The order you're looking for doesn't exist or has been removed.</p>
            <Link to="/orders">View all orders</Link>
          </>
        )}

        {error.status === HTTP_UNAUTHORIZED && (
          <>
            <h1>Authentication Required</h1>
            <p>Please log in to view this order.</p>
            <Link to="/login">Log in</Link>
          </>
        )}

        {error.status === HTTP_FORBIDDEN && (
          <>
            <h1>Access Denied</h1>
            <p>You don't have permission to view this order.</p>
            <Link to="/orders">View your orders</Link>
          </>
        )}

        {error.status >= HTTP_SERVER_ERROR && (
          <>
            <h1>Server Error</h1>
            <p>Something went wrong on our end. Please try again later.</p>
            <button onClick={() => window.location.reload()}>Retry</button>
          </>
        )}

        {/* Fallback for other status codes */}
        {![HTTP_NOT_FOUND, HTTP_UNAUTHORIZED, HTTP_FORBIDDEN].includes(error.status) &&
          error.status < HTTP_SERVER_ERROR && (
          <>
            <h1>Error {error.status}</h1>
            <p>{error.statusText || "An error occurred"}</p>
          </>
        )}
      </div>
    );
  }

  // Handle unexpected JavaScript errors
  if (error instanceof Error) {
    return (
      <div role="alert" aria-live="assertive">
        <h1>Unexpected Error</h1>
        <p>An unexpected error occurred. Our team has been notified.</p>
        {process.env.NODE_ENV === "development" && (
          <pre>{`${error.message}\n${error.stack}`}</pre>
        )}
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  // Unknown error type
  return (
    <div role="alert" aria-live="assertive">
      <h1>Unknown Error</h1>
      <p>Something went wrong. Please try again.</p>
      <button onClick={() => window.location.reload()}>Retry</button>
    </div>
  );
}
```

**Why good:** Different UI for different error types, helpful actions (links, retry buttons), accessible with role="alert", dev-only stack trace, named constants for status codes
