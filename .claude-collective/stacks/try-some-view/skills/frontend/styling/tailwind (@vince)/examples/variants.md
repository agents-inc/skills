# Variant Objects with Tailwind

> Code examples for variant patterns with Tailwind CSS. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 6: Variant Objects with Tailwind

### Good Example - Variant mapping object

```tsx
const severityVariants = {
  warning: {
    outerClassNames: "bg-yellow-50 border-yellow-200",
    icon: ExclamationTriangleIcon,
  },
  error: {
    outerClassNames: "bg-red-50 border-red-200",
    icon: XCircleIcon,
  },
  success: {
    outerClassNames: "bg-green-50 border-green-200",
    icon: CheckCircleIcon,
  },
  info: {
    outerClassNames: "bg-blue-50 border-blue-200",
    icon: InformationCircleIcon,
  },
} as const;

export type AlertSeverity = keyof typeof severityVariants;

export type AlertProps = {
  severity?: AlertSeverity;
  children: React.ReactNode;
};

export const Alert = ({ severity = "warning", children }: AlertProps) => {
  const { outerClassNames, icon: Icon } = severityVariants[severity];

  return (
    <div className={clsx("flex w-full items-center gap-2", outerClassNames)}>
      <Icon className="h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
};
```

**Why good:** Type-safe variants derived from object keys, centralized variant definitions, easy to add new variants, icon and styles co-located

### Bad Example - Inline conditionals for many variants

```tsx
<div className={clsx(
  "flex items-center",
  severity === "warning" && "bg-yellow-50",
  severity === "error" && "bg-red-50",
  severity === "success" && "bg-green-50",
  severity === "info" && "bg-blue-50",
  // ... more conditions
)}>
```

**Why bad:** Repetitive and verbose, harder to maintain, variant-specific logic scattered throughout
