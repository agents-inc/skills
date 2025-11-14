# 03. Code Conventions - Examples

## 3.1 Component Architecture

### ✅ GOOD: Design System Component with Ref Forwarding

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant */
  variant?: 'primary' | 'secondary';
  /** Size of the button */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(styles[variant], styles[size], className)}
        {...props}
      />
    );
  }
);
```

## 3.2 File and Directory Naming

_Examples coming soon_

## 3.3 Import/Export Patterns

_Examples coming soon_

## 3.4 Type Definitions

_Examples coming soon_

## 3.5 Constants and Magic Numbers

### ❌ BAD: Magic Numbers

```typescript
setTimeout(callback, 3000);
<div style={{ padding: '16px', zIndex: 999 }} />
if (items.length > 50) { /* ... */ }
```

### ✅ GOOD: Named Constants

```typescript
const TOAST_DURATION_MS = 3000;
const SPACING_MD = '16px';
const Z_INDEX_MODAL = 1000;
const MAX_ITEMS_PER_PAGE = 50;

setTimeout(callback, TOAST_DURATION_MS);
<div style={{ padding: SPACING_MD, zIndex: Z_INDEX_MODAL }} />
if (items.length > MAX_ITEMS_PER_PAGE) { /* ... */ }
```

### ✅ BEST: Design System Tokens

```typescript
<div style={{
  padding: 'var(--space-4)',
  zIndex: 'var(--z-modal)'
}} />
```

## 3.6 TypeScript Strictness

### Required tsconfig.json Settings

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
}
```

## 3.7 Error Handling Patterns

### Custom Error Types and Consistent Handling

```typescript
// Custom error types
class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

// Consistent error handling
try {
  const data = await apiClient.getUser(userId);
  return data;
} catch (error) {
  if (error instanceof APIError) {
    // Handle API errors
    logger.error("API Error", { endpoint: error.endpoint, status: error.statusCode });
    toast.error(getFriendlyErrorMessage(error));
  } else {
    // Handle unknown errors
    logger.error("Unexpected error", error);
    toast.error("Something went wrong. Please try again.");
  }
  throw error;
}
```

## 3.8 Form Patterns and Validation

_Examples coming soon_

## 3.9 Performance Optimization

_Examples coming soon_
