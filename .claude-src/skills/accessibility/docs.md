# Accessibility

> **Quick Guide:** All interactive elements keyboard accessible. Use Radix UI for ARIA patterns. WCAG AA minimum (4.5:1 text contrast). Proper form labels and error handling. Test with axe DevTools and screen readers.

**Target:** WCAG 2.1 Level AA compliance (minimum), AAA where feasible

---

## Keyboard Navigation Standards

**CRITICAL: All interactive elements must be keyboard accessible**

### Tab Order

- **Logical flow** - Tab order must follow visual reading order (left-to-right, top-to-bottom)
- **No keyboard traps** - Users can always tab away from any element
- **Skip repetitive content** - Provide skip links to main content
- **tabindex rules:**
  - `tabindex="0"` - Adds element to natural tab order (use sparingly)
  - `tabindex="-1"` - Programmatic focus only (modal content, headings)
  - Never use `tabindex > 0` (creates unpredictable tab order)

### Focus Management

- **Visible focus indicators** - Always show clear focus state (never `outline: none` without replacement)
- **Focus on open** - When opening modals/dialogs, move focus to first interactive element or close button
- **Focus on close** - Restore focus to trigger element when closing modals/dialogs
- **Focus trapping** - Trap focus inside modals using Radix UI or manual implementation
- **Programmatic focus** - Use `element.focus()` for dynamic content (search results, error messages)

### Keyboard Shortcuts

- **Standard patterns:**
  - `Escape` - Close modals, cancel actions, clear selections
  - `Enter/Space` - Activate buttons and links
  - `Arrow keys` - Navigate lists, tabs, menus, sliders
  - `Home/End` - Jump to first/last item
  - `Tab/Shift+Tab` - Navigate between interactive elements

### Skip Links

**MANDATORY for pages with navigation**

- Place skip link as first focusable element
- Visually hidden until focused
- Allow users to skip navigation and jump to main content
- Multiple skip links for complex layouts (skip to navigation, skip to sidebar, etc.)

---

## ARIA Patterns

**BEST PRACTICE: Use Radix UI components for built-in accessibility**

### Component-Specific ARIA

**Buttons:**

- `aria-label` - For icon-only buttons
- `aria-pressed` - For toggle buttons
- `aria-expanded` - For expandable sections
- `aria-disabled` - Use with `disabled` attribute

**Forms:**

- `aria-required` - Required fields (use with `required`)
- `aria-invalid` - Invalid fields
- `aria-describedby` - Link to error messages, helper text
- `aria-errormessage` - Explicit error message reference

**Navigation:**

- `aria-current="page"` - Current page in navigation
- `aria-label` - Describe navigation purpose ("Main navigation", "Footer navigation")

**Modals/Dialogs:**

- `role="dialog"` or `role="alertdialog"`
- `aria-modal="true"`
- `aria-labelledby` - Points to dialog title
- `aria-describedby` - Points to dialog description

**Tables:**

- `scope="col"` and `scope="row"` for headers
- `<caption>` for table description
- `aria-sort` for sortable columns

### Live Regions

**Use for dynamic content updates:**

- `aria-live="polite"` - Announce when user is idle (status messages, non-critical updates)
- `aria-live="assertive"` - Announce immediately (errors, critical alerts)
- `aria-atomic="true"` - Announce entire region content
- `role="status"` - For status messages (implies `aria-live="polite"`)
- `role="alert"` - For error messages (implies `aria-live="assertive"`)

**Best practices:**

- Keep messages concise and meaningful
- Clear old messages before new ones
- Don't spam with rapid updates (debounce)

### Landmarks

**Use semantic HTML5 elements (implicit ARIA roles):**

```html
<header>
  <!-- role="banner" -->
  <nav>
    <!-- role="navigation" -->
    <main>
      <!-- role="main" -->
      <aside>
        <!-- role="complementary" -->
        <footer>
          <!-- role="contentinfo" -->
          <section><!-- role="region" with aria-label --></section>
        </footer>
      </aside>
    </main>
  </nav>
</header>
```

**Multiple landmarks of same type need labels:**

```html
<nav aria-label="Main navigation">
  <nav aria-label="Footer navigation"></nav>
</nav>
```

### Accessible Names

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

## Color Contrast Requirements

**TARGET: WCAG AA minimum (4.5:1 for text, 3:1 for UI components)**

### Contrast Ratios

**Text contrast (AA):**

- Normal text (< 18px): 4.5:1 minimum
- Large text (≥ 18px or ≥ 14px bold): 3:1 minimum
- AAA (recommended): 7:1 for normal, 4.5:1 for large

**Non-text contrast:**

- UI components (buttons, form inputs): 3:1 minimum
- Focus indicators: 3:1 against background
- Icons (functional): 3:1 minimum

### Testing Tools

**Automated:**

- **axe DevTools** (browser extension) - Free, comprehensive
- **WAVE** (browser extension) - Free, visual feedback
- **Lighthouse** (Chrome DevTools) - Built-in, automated audits

**Manual:**

- **WebAIM Contrast Checker** - Quick ratio checking
- **Stark** (Figma/browser plugin) - Design-integrated testing
- **ColorOracle** - Color blindness simulation

### Color Independence

**CRITICAL: Never use color alone to convey information**

- Add icons to color-coded states (✓ success, ✕ error)
- Use text labels with status colors
- Provide patterns/textures in charts
- Underline links in body text

---

## Semantic HTML

**ACTUAL IMPLEMENTATION: Semantic elements used consistently**

**Always use semantic HTML:**

- `<button>` for actions (not `<div onclick>`)
- `<a>` for navigation (not `<div onclick>`)
- `<nav>` for navigation sections
- `<main>` for primary content (one per page)
- `<header>` and `<footer>` for page sections
- `<ul>/<ol>` for lists
- `<table>` for tabular data (not divs with grid CSS)
- `<form>` with proper `<label>` associations

**Never:**

- ❌ Use `<div>` or `<span>` for interactive elements
- ❌ Use click handlers on non-interactive elements without proper role
- ❌ Use tables for layout
- ❌ Use placeholder as label replacement

---

## Form Accessibility

**CRITICAL: Forms are a major accessibility barrier**

### Label Associations

**Always use proper label associations:**

```html
<!-- ✅ Explicit association (recommended) -->
<label for="email">Email</label>
<input id="email" type="email" />

<!-- ✅ Implicit association -->
<label>
  Email
  <input type="email" />
</label>
```

### Error Handling

**Required patterns:**

- `aria-invalid="true"` on invalid fields
- `aria-describedby` linking to error message
- `role="alert"` on error messages for screen reader announcement
- Visual error indicators (icons, border color)
- Error summary at top of form for multiple errors

### Required Fields

**Multiple indicators:**

- `required` attribute for browser validation
- `aria-required="true"` for screen readers
- Visual indicator (asterisk, "required" text)
- Legend/description explaining required fields

### Input Types

**Use correct input types for better mobile keyboards:**

- `type="email"` - Email keyboard
- `type="tel"` - Phone keyboard
- `type="number"` - Number keyboard
- `type="date"` - Date picker
- `type="search"` - Search keyboard

---

## Focus Indicators

**MANDATORY: Visible focus states for all interactive elements**

### Focus Styles

**Minimum requirements:**

- 3:1 contrast ratio against background
- 2px minimum thickness
- Clear visual difference from unfocused state
- Consistent across all interactive elements

**Implementation:**

```scss
// ✅ GOOD: Custom focus indicator
.button {
  outline: 2px solid transparent;
  outline-offset: 2px;

  &:focus-visible {
    outline-color: var(--color-primary);
  }
}

// ❌ NEVER do this
.button {
  outline: none; // Removes focus indicator completely
}
```

### :focus vs :focus-visible

**Use `:focus-visible` for better UX:**

- `:focus` - Shows on mouse click (annoying)
- `:focus-visible` - Shows only for keyboard navigation (better)

---

## Touch Target Sizes

**TARGET: 44×44px minimum (WCAG 2.1 Level AAA)**

### Minimum Sizes

**Interactive elements:**

- Buttons: 44×44px minimum
- Links in text: Increase padding to meet 44×44px
- Form inputs: 44px height minimum
- Icons: 24×24px minimum, 44×44px touch target

**Implementation:**

```scss
.button {
  min-width: 44px;
  min-height: 44px;
  padding: var(--space-md); // Ensures minimum size
}

.icon-button {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### Spacing

**Minimum spacing between targets:**

- 8px minimum between adjacent touch targets
- More spacing on mobile (12-16px recommended)

---

## Screen Reader Support

**ACTUAL IMPLEMENTATION: Radix UI provides built-in screen reader support**

### Hidden Content

**Visually hidden but screen-reader accessible:**

```scss
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### Hidden from Screen Readers

**Decorative content:**

```html
<img src="decorative.png" alt="" />
<!-- Empty alt for decorative images -->
<Icon aria-hidden="true" />
<!-- Hide decorative icons -->
```

---

## Testing Approach

**RECOMMENDED: Multi-layered testing strategy**

### Automated Testing

**ACTUAL IMPLEMENTATION: Use Testing Library's role-based queries**

```typescript
// ✅ Encourages accessible markup
const button = screen.getByRole('button', { name: 'Submit' });
const switch = within(feature).getByRole('switch');
```

**Additional tools:**

- **jest-axe** - Automated accessibility testing in unit tests
- **axe-core** - Runtime accessibility testing
- **eslint-plugin-jsx-a11y** - Lint-time accessibility checks

### Manual Testing Checklist

**Keyboard navigation:**

- [ ] Can reach all interactive elements via Tab
- [ ] Focus indicators visible and clear
- [ ] Can activate all buttons/links with Enter/Space
- [ ] Can close modals with Escape
- [ ] No keyboard traps

**Screen reader:**

- [ ] All images have alt text
- [ ] Form inputs have labels
- [ ] Error messages are announced
- [ ] Landmarks are properly labeled
- [ ] Live regions announce updates

**Visual:**

- [ ] Sufficient color contrast
- [ ] Information not conveyed by color alone
- [ ] Text can be resized to 200% without breaking layout
- [ ] Touch targets meet minimum size

### Screen Reader Testing

**Test with multiple screen readers:**

- **NVDA** (Windows) - Free, most popular
- **JAWS** (Windows) - Industry standard
- **VoiceOver** (macOS/iOS) - Built-in
- **TalkBack** (Android) - Built-in

### Browser Testing

**Test in multiple browsers:**

- Chrome (most users)
- Safari (macOS/iOS accessibility)
- Firefox (strong accessibility support)
- Edge (enterprise users)

---

## Common Anti-Patterns

**❌ NEVER do these:**

- Removing focus outlines without replacement
- Using `div` or `span` for buttons/links
- Click handlers on non-interactive elements without role/keyboard support
- Color-only error indicators
- Placeholder text as label replacement
- Disabled form submit buttons (show validation errors instead)
- Auto-playing audio/video without controls
- Time-limited actions without ability to extend
- Opening new windows without warning
- Form inputs without labels

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
