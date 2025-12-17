## Example Research Output

Here's what a complete, high-quality research output looks like:

---

### Example: Component Research for Button Variants

```markdown
## Research Findings: Button Component Variants

**Research Type:** Design System Research
**Files Examined:** 8
**Verified:** All paths confirmed

---

### Component Inventory

| Component | Location | Purpose | Key Props |
|-----------|----------|---------|-----------|
| Button | `/packages/ui/src/button/button.tsx` | Primary button component | variant, size, disabled, loading |
| IconButton | `/packages/ui/src/icon-button/icon-button.tsx` | Button with icon only | icon, label (aria), size |
| ButtonGroup | `/packages/ui/src/button-group/button-group.tsx` | Groups buttons together | orientation, spacing |

---

### Existing Pattern: Button with Variants

**File:** `/packages/ui/src/button/button.tsx:15-45`

**Pattern:** Uses `cva` (class-variance-authority) for variant styling

```typescript
// Lines 15-32
const buttonVariants = cva(
  styles.base,
  {
    variants: {
      variant: {
        primary: styles.primary,
        secondary: styles.secondary,
        ghost: styles.ghost,
      },
      size: {
        sm: styles.sm,
        md: styles.md,
        lg: styles.lg,
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);
```

**Why this pattern:** cva provides type-safe variants with automatic className merging.

---

### Styling Approach

**Token system:** Three-tier architecture
- Base tokens: `/packages/ui/src/styles/tokens/base.css`
- Semantic tokens: `/packages/ui/src/styles/tokens/semantic.css`
- Component tokens: `/packages/ui/src/button/button.module.scss:1-20`

**SCSS Modules:** All components use `.module.scss` co-located with component

**Example token usage:**
```scss
// button.module.scss:5-12
.primary {
  background-color: var(--button-primary-bgColor);
  color: var(--button-primary-fgColor);

  &:hover {
    background-color: var(--button-primary-bgColor-hover);
  }
}
```

---

### Props Interface

**File:** `/packages/ui/src/button/button.tsx:8-14`

```typescript
export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
  };
```

**Key patterns:**
- Extends native button props
- Uses VariantProps from cva for type-safe variants
- Named export (no default export)

---

### Files to Reference for Similar Implementation

1. `/packages/ui/src/button/button.tsx` - Best reference for variant pattern
2. `/packages/ui/src/button/button.module.scss` - Token-based styling
3. `/packages/ui/src/input/input.tsx` - Similar variant pattern for form elements

---

### Recommended Implementation Approach

Based on patterns in Button and Input:

1. **Create component file** with `.tsx` and `.module.scss`
2. **Use cva** for variants (import from 'class-variance-authority')
3. **Follow three-tier tokens** - define component tokens in SCSS
4. **Export named** - `export const ComponentName = ...`
5. **Extend native props** - `React.ComponentProps<'element'>`
6. **Use forwardRef** for interactive elements

---

### Research Verification

| Finding | Verification Method | Status |
|---------|---------------------|--------|
| Button uses cva | Read `/packages/ui/src/button/button.tsx` | Verified line 15 |
| Three-tier tokens | Read token files | Verified |
| SCSS Modules pattern | Glob for *.module.scss | 23 files found |
| Named exports | Grep for 'export const' | 100% components |
```

---

### Example: Pattern Discovery for Form Handling

```markdown
## Research Findings: Form Handling Patterns

**Research Type:** Pattern Discovery
**Files Examined:** 12
**Verified:** All paths confirmed

---

### Form Library Used

**Library:** React Hook Form
**Version:** v7.x (from package.json)
**Usage Count:** 15 forms found

---

### Pattern Location

**Primary example:** `/apps/client-next/src/features/settings/settings-form.tsx`
**Secondary examples:**
- `/apps/client-next/src/features/auth/login-form.tsx`
- `/apps/client-next/src/features/auth/signup-form.tsx`

---

### Form Pattern Structure

**File:** `/apps/client-next/src/features/settings/settings-form.tsx:12-45`

```typescript
// Lines 12-20 - Schema definition
const settingsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  bio: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

// Lines 22-35 - Form setup
export const SettingsForm = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
  });

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => toast.success('Settings saved'),
  });

  return (
    <form onSubmit={handleSubmit(data => mutation.mutate(data))}>
      {/* Form fields */}
    </form>
  );
};
```

---

### Key Conventions

| Convention | Example Location | Description |
|------------|------------------|-------------|
| Zod schemas | settings-form.tsx:12-18 | All forms use Zod for validation |
| zodResolver | settings-form.tsx:24 | Connects Zod to React Hook Form |
| useMutation for submit | settings-form.tsx:28-31 | React Query handles submission |
| Toast on success | settings-form.tsx:30 | Success feedback via toast |

---

### Validation Pattern

**Error display:** Inline beneath fields
**File:** `/apps/client-next/src/features/settings/settings-form.tsx:48-55`

```tsx
<Input
  {...register('email')}
  error={errors.email?.message}
/>
```

**Input component with error prop:** `/packages/ui/src/input/input.tsx:25-30`

---

### Files to Reference

1. `/apps/client-next/src/features/settings/settings-form.tsx` - Best complete example
2. `/packages/ui/src/input/input.tsx` - Input with error handling
3. `/apps/client-next/src/lib/zod-schemas.ts` - Shared schema patterns

---

### Recommended Approach for New Forms

1. **Define Zod schema** at top of file or in shared schemas
2. **Infer TypeScript type** from schema: `z.infer<typeof schema>`
3. **Use zodResolver** to connect validation
4. **Use useMutation** for form submission
5. **Pass error message** to Input component's error prop
6. **Toast on success** for user feedback
```
