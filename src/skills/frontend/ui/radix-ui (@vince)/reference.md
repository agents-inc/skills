# Radix UI Reference

> Decision frameworks, anti-patterns, and red flags for Radix UI primitives. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples. **Current: v1.4.x (May 2025)** - Full React 19 and RSC compatibility with new preview primitives.

---

## Decision Framework

### When to Use Portal

```
Does component overlay other content?
├─ YES → Is it a dialog, popover, dropdown, or tooltip?
│   ├─ YES → Use Portal (escape stacking context)
│   └─ NO → Consider if parent overflow:hidden would clip content
│       ├─ YES → Use Portal
│       └─ NO → Portal optional
└─ NO → Skip Portal (content inline with React tree)
```

### Controlled vs Uncontrolled State

```
Do you need programmatic control?
├─ YES → Need to close after async?
│   ├─ YES → Controlled (open + onOpenChange)
│   └─ NO → Need to open from external trigger?
│       ├─ YES → Controlled (open + onOpenChange)
│       └─ NO → Uncontrolled usually sufficient
└─ NO → Do you need to react to state changes?
    ├─ YES → Semi-controlled (onOpenChange only)
    └─ NO → Uncontrolled (defaultOpen)
```

### When to Use asChild

```
Is the default element appropriate?
├─ YES → Skip asChild (use Radix default)
└─ NO → Are you changing element type?
    ├─ YES → Use asChild with correct element
    │   ├─ Link instead of button → <a> with asChild
    │   ├─ Custom component → forwardRef + spread props
    │   └─ Next.js Link → <Link> with asChild
    └─ NO → Skip asChild
```

### Animation Approach

```
How complex are your animations?
├─ Simple fade/slide → CSS keyframes + data-state
├─ Height animation → CSS + --radix-*-content-height variables
├─ Complex orchestrated → JavaScript library (Framer Motion, React Spring)
│   └─ Use forceMount on Portal, Overlay, Content
└─ No animation → Skip (Radix handles mount/unmount)
```

### Component Selection

```
What interaction pattern do you need?

Modal blocking interaction?
├─ Destructive confirmation → AlertDialog (requires explicit action)
├─ Form or content → Dialog (modal: true, default)
└─ Non-blocking information → Dialog (modal: false) or Popover

Floating non-modal content?
├─ Triggered by click → Popover
├─ Triggered by hover/focus → Tooltip
└─ Menu with actions → DropdownMenu

Selection from options?
├─ Form input (single select) → Select
├─ Form input (multiple select) → Custom with Popover + Checkbox
└─ Navigation or actions → DropdownMenu

Expandable sections?
├─ One open at a time → Accordion (type="single")
├─ Multiple open → Accordion (type="multiple")
└─ Tabbed view → Tabs
```

---

## RED FLAGS

### High Priority Issues

- **Missing forwardRef on asChild components** - Radix cannot attach refs for positioning and focus management
- **Not spreading props on asChild components** - ARIA attributes and event handlers are lost
- **Missing Portal for overlays** - Content clipped by parent overflow:hidden or z-index issues
- **Missing Title/Description on dialogs** - Screen readers have no context for the interaction
- **Using Dialog for destructive confirmations** - AlertDialog prevents accidental dismissal

### Medium Priority Issues

- **CSS transitions instead of animations** - Radix detects animation end, not transition end, for unmount timing
- **Manually managing z-index on portals** - Radix manages stacking order; manual z-index causes conflicts
- **Forgetting forceMount with JavaScript animation libraries** - Content unmounts before exit animation completes
- **Not using onOpenAutoFocus for destructive dialogs** - Users should focus safe action (Cancel) by default
- **Missing aria-label on icon-only close buttons** - Screen readers announce empty button

### Common Mistakes

- Using asChild without forwardRef (breaks ref forwarding)
- Using CSS transitions expecting unmount delay (use CSS animations instead)
- Setting explicit z-index on portal content (conflicts with Radix stacking)
- Forgetting to provide accessible labels (Title is required, Description recommended)
- Using Dialog when AlertDialog is appropriate for destructive actions

### Gotchas & Edge Cases

- `onOpenChange` in controlled mode fires on close, not open (you set open yourself)
- CSS animations must use `@keyframes`, not `transition`, for unmount detection
- `--radix-accordion-content-height` and similar CSS variables are only available during animation
- Portal content renders in document.body by default, may need custom container for micro-frontends
- Slot merges event handlers with child handler taking precedence
- `data-state` changes to "closed" before unmount animation starts (use animation, not transition)
- AlertDialog requires Cancel or Action to close (no click-outside dismiss by design)
- **v1.4.3+**: Dialog logs console **errors** for missing Title and **warnings** for missing Description
- **v1.4.3+**: Components with `hideWhenDetached` prevent interactions when content is hidden
- **v1.4.3+**: Progress supports `value={undefined}` for indeterminate state representation
- **v1.4.3+**: Select and Scroll Area support `nonce` prop for Content Security Policy compliance
- **React 19**: `forwardRef` wrapper no longer needed - `ref` can be passed as a regular prop
- **Import Patterns**: Prefer unified `radix-ui` package over individual `@radix-ui/*` packages to prevent version conflicts

---

## Anti-Patterns

### Missing forwardRef on Custom Components

Custom components used with `asChild` MUST use forwardRef. Without it, Radix cannot attach refs for positioning, focus management, and animations.

```typescript
// WRONG - Radix can't attach ref
const CustomButton = ({ children, onClick }) => {
  return <button onClick={onClick}>{children}</button>;
};

// CORRECT - forwardRef allows Radix to attach ref
const CustomButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, ...props }, ref) => {
    return <button ref={ref} {...props}>{children}</button>;
  }
);
CustomButton.displayName = "CustomButton";
```

### Not Spreading Props on Custom Components

All props must be spread onto the underlying DOM element. Without spreading, Radix event handlers and ARIA attributes are lost.

```typescript
// WRONG - Props not spread, Radix handlers lost
const CustomButton = forwardRef<HTMLButtonElement, Props>(
  ({ className, children }, ref) => {
    return <button ref={ref} className={className}>{children}</button>;
  }
);

// CORRECT - All props spread to element
const CustomButton = forwardRef<HTMLButtonElement, Props>(
  ({ className, children, ...props }, ref) => {
    return <button ref={ref} className={className} {...props}>{children}</button>;
  }
);
```

### Using CSS Transitions for Mount/Unmount Animations

Radix detects CSS animation end events, not transition end events. Using transitions means content unmounts immediately without exit animation.

```css
/* WRONG - Transition won't delay unmount */
.dialog-content {
  transition: opacity 150ms ease;
}
.dialog-content[data-state="closed"] {
  opacity: 0;
}

/* CORRECT - Animation delays unmount until complete */
.dialog-content[data-state="closed"] {
  animation: fadeOut 150ms ease-in;
}
@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
```

### Missing Portal for Overlay Components

Portal is required for overlays to escape CSS stacking contexts and overflow constraints.

```typescript
// WRONG - Content can be clipped by parent overflow:hidden
<Dialog.Root>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Overlay />
  <Dialog.Content>Content</Dialog.Content>
</Dialog.Root>

// CORRECT - Portal renders outside React tree
<Dialog.Root>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content>Content</Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

### Missing Accessible Labels

Dialog and AlertDialog require Title for screen reader announcements. Description provides additional context.

```typescript
// WRONG - Screen readers have no context
<Dialog.Content>
  <p>Are you sure?</p>
</Dialog.Content>

// CORRECT - Title is announced when dialog opens
<Dialog.Content>
  <Dialog.Title>Confirm Action</Dialog.Title>
  <Dialog.Description>This action cannot be undone.</Dialog.Description>
  <p>Are you sure?</p>
</Dialog.Content>
```

### Using Dialog for Destructive Confirmations

Dialog can be dismissed by clicking outside or pressing Escape. AlertDialog requires explicit action.

```typescript
// WRONG - User can accidentally dismiss destructive action
<Dialog.Root>
  <Dialog.Trigger>Delete Account</Dialog.Trigger>
  <Dialog.Content>
    <p>Delete your account?</p>
    <button>Delete</button>
  </Dialog.Content>
</Dialog.Root>

// CORRECT - AlertDialog requires explicit Cancel or Action
<AlertDialog.Root>
  <AlertDialog.Trigger>Delete Account</AlertDialog.Trigger>
  <AlertDialog.Content>
    <AlertDialog.Title>Delete Account?</AlertDialog.Title>
    <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
    <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
    <AlertDialog.Action>Delete</AlertDialog.Action>
  </AlertDialog.Content>
</AlertDialog.Root>
```

### Manual z-index Management

Radix manages portal stacking order automatically. Manual z-index values cause conflicts with other Radix components.

```css
/* WRONG - Conflicts with Radix stacking */
.my-dialog {
  z-index: 9999;
}

/* CORRECT - Let Radix manage stacking, or use isolation */
.my-dialog {
  /* Radix handles z-index automatically */
  /* Use isolation: isolate on container if needed */
}
```

---

## Quick Reference

### Required Props for Custom asChild Components

- [ ] Uses `forwardRef` to allow ref attachment
- [ ] Spreads all `props` onto the underlying DOM element
- [ ] Sets `displayName` for React DevTools

### Dialog/AlertDialog Checklist

- [ ] Uses Portal to wrap Overlay and Content
- [ ] Has Title component for screen reader announcement
- [ ] Has Description (or VisuallyHidden Description) for context
- [ ] Uses AlertDialog (not Dialog) for destructive actions
- [ ] Focuses safe action (Cancel) for destructive dialogs via `onOpenAutoFocus`

### Animation Checklist

- [ ] Uses CSS `@keyframes`, not `transition`, for unmount animation
- [ ] Defines both `[data-state="open"]` and `[data-state="closed"]` animations
- [ ] Uses `forceMount` on Portal, Overlay, Content for JavaScript animation libraries
- [ ] Uses `--radix-*-content-height` variables for height animations

### Accessibility Checklist

- [ ] Title provided for all dialogs
- [ ] Description provided or VisuallyHidden
- [ ] Icon-only buttons have `aria-label`
- [ ] Destructive actions use AlertDialog
- [ ] Focus management verified (Tab, Shift+Tab, Escape)

### Component Structure

```
Root                    # State and context provider
├── Trigger             # Opens the component
└── Portal              # Renders outside React tree (optional)
    ├── Overlay         # Visual backdrop (dialogs)
    └── Content         # Main content container
        ├── Title       # Accessible heading
        ├── Description # Accessible description
        ├── [content]   # Your content
        └── Close       # Closes the component
```

### CSS Variables Reference

| Component | Variable | Purpose |
|-----------|----------|---------|
| Accordion | `--radix-accordion-content-height` | Content height during animation |
| Accordion | `--radix-accordion-content-width` | Content width during animation |
| Collapsible | `--radix-collapsible-content-height` | Content height during animation |
| Collapsible | `--radix-collapsible-content-width` | Content width during animation |
| Select | `--radix-select-trigger-width` | Trigger element width |
| Select | `--radix-select-trigger-height` | Trigger element height |
| Select | `--radix-select-content-available-width` | Available space width |
| Select | `--radix-select-content-available-height` | Available space height |
| Select | `--radix-select-content-transform-origin` | Transform origin for animations |
| Popover | `--radix-popover-content-transform-origin` | Transform origin for animations |
| Tooltip | `--radix-tooltip-content-transform-origin` | Transform origin for animations |
| DropdownMenu | `--radix-dropdown-menu-content-transform-origin` | Transform origin for animations |

### v1.4.x Important Changes (May 2025)

| Feature | Description |
|---------|-------------|
| React 19 Support | Full compatibility, `forwardRef` optional |
| RSC Compatibility | Works with React Server Components |
| Escape Key Capture | Components capture Escape key events |
| Dialog Console Warnings | Logs errors for missing Title, warnings for missing Description |
| hideWhenDetached | Prevents interactions with hidden content |
| Progress Indeterminate | `value={undefined}` explicitly supported |
| CSP nonce | Select and Scroll Area support `nonce` prop |
| OneTimePasswordField | New preview primitive for OTP inputs (Apr 2025) |
| PasswordToggleField | New preview primitive for password visibility (May 2025) |
| Form Bubble Inputs | Form controls use Radix Primitive component by default |
| Tooltip Performance | Improved rendering performance for Tooltip provider |
| Avatar crossOrigin | Added `crossOrigin` support in Avatar images |

### Preview Components (Unstable)

| Component | Import | Version | Use Case |
|-----------|--------|---------|----------|
| OneTimePasswordField | `unstable_OneTimePasswordField` | 0.1.8 | OTP input with keyboard navigation, paste, autofill |
| PasswordToggleField | `unstable_PasswordToggleField` | 0.1.3 | Password visibility toggle with focus management |
| Form | `unstable_Form` | 0.1.8 | Form validation with constraint API |

**Key Preview Features:**
- **OneTimePasswordField**: autoSubmit, validationType (numeric/alphanumeric), sanitizeValue, HiddenInput for forms
- **PasswordToggleField**: Icon component with visible/hidden props, Slot for custom rendering, onVisibilityChange
- **Form**: Field, Label, Control, Message (with match prop), ValidityState, Submit components

**Note:** Preview components have unstable APIs and may change before stable release.
