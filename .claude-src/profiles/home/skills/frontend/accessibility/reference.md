# Accessibility Reference

> Decision frameworks, anti-patterns, and red flags for the Accessibility skill. For core patterns, see [skill.md](skill.md). For code examples, see [examples.md](examples.md).

---

<decision_framework>

## Decision Framework

```
Need to make content accessible?
├─ Is it interactive (button, input, link)?
│   ├─ YES → Use semantic HTML (<button>, <a>, <input>)
│   │        Add keyboard support (Enter/Space activation)
│   │        Ensure visible focus indicator (:focus-visible)
│   │        Add ARIA if needed (aria-label for icon-only)
│   └─ NO → Is it complex (modal, dropdown, table)?
│       ├─ YES → Use Radix UI component (built-in a11y)
│       └─ NO → Is it informational (status, error)?
│           ├─ YES → Add role="alert" or role="status"
│           │        Use aria-live for dynamic updates
│           │        Never use color alone (add icon/text)
│           └─ NO → Use semantic HTML (<nav>, <main>, <header>)
│                    Add landmarks for navigation
│                    Provide skip links for complex layouts
├─ Does it use color to convey information?
│   └─ YES → Add icon, text label, or pattern (never color alone)
└─ Is contrast ratio sufficient?
    ├─ Text → 4.5:1 minimum (AA), 7:1 ideal (AAA)
    ├─ UI components → 3:1 minimum
    └─ Focus indicators → 3:1 minimum, 2px thickness
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- **Removing focus outlines without replacement** - Keyboard users can't navigate, violates WCAG 2.4.7
- **Using `div` or `span` for buttons/links** - No semantic meaning, no keyboard support, screen readers can't identify
- **Click handlers on non-interactive elements without role/keyboard support** - Keyboard inaccessible, violates WCAG 2.1.1
- **Form inputs without labels** - Screen readers can't announce purpose, violates WCAG 1.3.1

**Medium Priority Issues:**

- **Color-only error indicators** - Color-blind users can't distinguish, needs icon or text
- **Placeholder text as label replacement** - Disappears on input, not read by all screen readers
- **Disabled form submit buttons** - Show validation errors instead, don't hide submit button
- **Auto-playing audio/video without controls** - Violates WCAG 1.4.2, disrupts screen readers

**Common Mistakes:**

- Not using `aria-label` on icon-only buttons
- Missing `alt` text on images (or using redundant alt text)
- Not trapping focus in modals
- Forgetting to restore focus when closing modals
- Using `tabindex > 0` (creates unpredictable tab order)
- Not providing skip links on pages with navigation
- Missing `aria-invalid` and `aria-describedby` on form errors

**Gotchas & Edge Cases:**

- **`:focus` vs `:focus-visible`** - Use `:focus-visible` to avoid showing focus rings on mouse clicks
- **Empty `alt=""` is correct for decorative images** - Don't skip the alt attribute entirely
- **`aria-hidden="true"` also hides from keyboard** - Don't use on focusable elements
- **Radix UI handles most ARIA automatically** - Don't add redundant ARIA attributes
- **Live regions announce ALL content** - Keep messages concise to avoid spam
- **`role="button"` on `<div>` doesn't add keyboard support** - Still need to handle Enter/Space keys manually

</red_flags>

---

<anti_patterns>

## Anti-Patterns

### Removing Focus Outlines

Never remove focus outlines (`outline: none`) without providing a visible replacement. This makes the site unusable for keyboard users and violates WCAG 2.4.7.

```css
/* WRONG - Removes focus visibility */
button:focus {
  outline: none;
}

/* CORRECT - Custom focus indicator */
button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

---

### Using Divs for Buttons

Using `<div onclick>` instead of `<button>` removes semantic meaning, keyboard support, and screen reader identification.

```tsx
// WRONG - No keyboard support, no semantics
<div onClick={handleClick}>Click me</div>

// CORRECT - Native button with all a11y built-in
<button onClick={handleClick}>Click me</button>
```

---

### Color-Only Information

Never convey information using color alone. Color-blind users cannot distinguish between success/error states.

```tsx
// WRONG - Color only
<span className={isError ? "text-red" : "text-green"}>Status</span>

// CORRECT - Color + icon
<span className={isError ? "text-red" : "text-green"}>
  {isError ? <XIcon /> : <CheckIcon />} Status
</span>
```

---

### Placeholder as Label

Placeholders disappear on input and are not reliably announced by screen readers.

```tsx
// WRONG - No visible label
<input placeholder="Email" />

// CORRECT - Visible label
<label htmlFor="email">Email</label>
<input id="email" placeholder="user@example.com" />
```

---

### Manual ARIA Instead of Radix UI

Don't manually implement complex ARIA patterns when Radix UI provides tested, accessible alternatives.

```tsx
// WRONG - Manual ARIA implementation
<div role="dialog" aria-modal="true" aria-labelledby="title">...</div>

// CORRECT - Radix handles ARIA automatically
<Dialog.Root>
  <Dialog.Content>...</Dialog.Content>
</Dialog.Root>
```

</anti_patterns>

---

## Accessible Names Priority

**Priority order (first found wins):**

1. `aria-labelledby` - Reference to another element
2. `aria-label` - Direct string label
3. Element content (button text, link text)
4. `title` attribute (last resort, not well supported)

**Rules:**
- Icon-only buttons MUST have `aria-label`
- Form inputs MUST have associated `<label>` or `aria-label`
- Images MUST have descriptive `alt` text (empty `alt=""` for decorative images)

---

## WCAG Quick Reference

### Level A (Minimum)
- All non-text content has text alternatives
- Information not conveyed by color alone
- All functionality keyboard accessible
- No keyboard traps

### Level AA (Required for compliance)
- 4.5:1 contrast for normal text
- 3:1 contrast for large text and UI components
- Focus visible on all interactive elements
- Skip navigation links for repetitive content
- Error identification and suggestions

### Level AAA (Ideal)
- 7:1 contrast for normal text
- 4.5:1 contrast for large text
- Extended sign language for video
- No timing limits

---

## Browser & Assistive Technology Support

### Screen Readers
| Screen Reader | Platform | Notes |
|---------------|----------|-------|
| NVDA | Windows | Free, most popular |
| JAWS | Windows | Industry standard, paid |
| VoiceOver | macOS/iOS | Built-in |
| TalkBack | Android | Built-in |

### Browser Testing Priority
1. **Chrome** - Most users
2. **Safari** - macOS/iOS accessibility
3. **Firefox** - Strong accessibility support
4. **Edge** - Enterprise users

---

## Resources

**Official guidelines:**
- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
- WAI-ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/

**Tools:**
- axe DevTools: https://www.deque.com/axe/devtools/
- WAVE: https://wave.webaim.org/
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/

**Testing:**
- NVDA Screen Reader: https://www.nvaccess.org/
- Keyboard Navigation Guide: https://webaim.org/articles/keyboard/
