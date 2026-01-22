# Responsive Design with Tailwind Breakpoints

> Code examples for responsive design patterns. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 8: Responsive Design with Tailwind Breakpoints

### Breakpoint Prefixes

- `sm:` - 640px and up
- `md:` - 768px and up
- `lg:` - 1024px and up
- `xl:` - 1280px and up
- `2xl:` - 1536px and up

### Good Example - Mobile-first responsive design

```tsx
<div
  className={clsx(
    "flex flex-col gap-2", // Mobile: stack vertically
    "sm:flex-row sm:gap-4", // Small+: horizontal layout
    "lg:max-w-[800px] lg:mx-auto", // Large+: constrain width
  )}
>
  <div className="w-full sm:w-1/2 lg:w-1/3">{/* Content */}</div>
</div>
```

**Why good:** Mobile-first approach, clear progression through breakpoints, all responsive behavior visible in one place

### Bad Example - Desktop-first (harder to reason about)

```tsx
<div className="flex-row lg:flex-col">
```

**Why bad:** Desktop-first is harder to maintain, mobile becomes afterthought
