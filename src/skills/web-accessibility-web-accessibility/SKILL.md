---
name: web-accessibility-web-accessibility
description: WCAG, ARIA, keyboard navigation
---

# Accessibility

> **Quick Guide:** All interactive elements keyboard accessible. Use headless component libraries for ARIA patterns. WCAG AA minimum (4.5:1 text contrast). Proper form labels and error handling. Combine automated axe-core checks with manual keyboard and screen reader testing.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST ensure all interactive elements are keyboard accessible with visible focus indicators)**

**(You MUST use headless component libraries for complex ARIA patterns instead of manual implementation)**

**(You MUST maintain WCAG AA minimum contrast ratios - 4.5:1 for text, 3:1 for UI components)**

**(You MUST never use color alone to convey information - always add icons, text, or patterns)**

</critical_requirements>

---

**Auto-detection:** Accessibility (a11y), WCAG compliance, ARIA patterns, keyboard navigation, screen reader support, focus management, aria-label, aria-live, role attribute, skip link

**When to use:**

- Implementing keyboard navigation and focus management
- Ensuring WCAG AA color contrast (4.5:1 text, 3:1 UI components)
- Building interactive components (buttons, forms, modals, tables) with proper ARIA
- Adding dynamic content updates (live regions, status messages)
- Implementing skip links, landmarks, and semantic HTML structure
- Handling motion preferences with `prefers-reduced-motion`

**When NOT to use:**

- Working on backend/API code with no UI
- Writing build scripts or configuration files
- Creating documentation or non-rendered content
- Working with CLI tools (different accessibility considerations)

**Target:** WCAG 2.2 Level AA compliance (minimum), AAA where feasible

---

<philosophy>

## Philosophy

Accessibility ensures digital products are usable by everyone, including users with disabilities. **Accessibility is a requirement, not a feature** - it should be built in from the start, not retrofitted.

Key philosophy:

- **Semantic HTML first** - Use native elements for built-in accessibility
- **Headless components for complex patterns** - Leverage tested, accessible component primitives from your component library
- **Progressive enhancement** - Start with keyboard, add mouse interactions on top
- **WCAG as baseline** - Meet AA minimum, aim for AAA where feasible

</philosophy>

---

<patterns>

## Core Patterns

### Keyboard Navigation Standards

**CRITICAL: All interactive elements must be keyboard accessible**

#### Tab Order

- **Logical flow** - Tab order must follow visual reading order (left-to-right, top-to-bottom)
- **No keyboard traps** - Users can always tab away from any element
- **Skip repetitive content** - Provide skip links to main content
- **tabindex rules:**
  - `tabindex="0"` - Adds element to natural tab order (use sparingly)
  - `tabindex="-1"` - Programmatic focus only (modal content, headings)
  - Never use `tabindex > 0` (creates unpredictable tab order)

#### Focus Management

- **Visible focus indicators** - Always show clear focus state (never `outline: none` without replacement)
- **Focus on open** - When opening modals/dialogs, move focus to first interactive element or close button
- **Focus on close** - Restore focus to trigger element when closing modals/dialogs
- **Focus trapping** - Trap focus inside modals using your headless component library or manual implementation
- **Programmatic focus** - Use `element.focus()` for dynamic content (search results, error messages)

#### Keyboard Shortcuts

- **Standard patterns:**
  - `Escape` - Close modals, cancel actions, clear selections
  - `Enter/Space` - Activate buttons and links
  - `Arrow keys` - Navigate lists, tabs, menus, sliders
  - `Home/End` - Jump to first/last item
  - `Tab/Shift+Tab` - Navigate between interactive elements

#### Skip Links

**MANDATORY for pages with navigation** - place as first focusable element, visually hidden until focused.

```typescript
// components/skip-link.tsx
export function SkipLink({ className }: { className?: string }) {
  return (
    <a href="#main-content" className={className}>
      Skip to main content
    </a>
  );
}
```

See [examples/core.md](examples/core.md) for full skip link implementation with styling.

---

### ARIA Patterns

**Use headless component libraries** (Radix UI, Headless UI, React Aria, Ariakit) - they handle ARIA automatically for complex patterns like dialogs, selects, tabs, tooltips, and popovers.

#### Component-Specific ARIA

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

#### Live Regions

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

---

### Color Contrast & Visual Design

**Text contrast (AA):**

- Normal text (< 18px): 4.5:1 minimum
- Large text (>= 18px or >= 14px bold): 3:1 minimum
- AAA (recommended): 7:1 for normal, 4.5:1 for large

**Non-text contrast:**

- UI components (buttons, form inputs): 3:1 minimum
- Focus indicators: 3:1 against background
- Icons (functional): 3:1 minimum

**Color Independence:**

- Add icons to color-coded states (check for success, X for error)
- Use text labels with status colors
- Provide patterns/textures in charts
- Underline links in body text

See [examples/color.md](examples/color.md) for contrast examples and design tokens.

---

### Semantic HTML

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

- Use `<div>` or `<span>` for interactive elements
- Use click handlers on non-interactive elements without proper role
- Use tables for layout
- Use placeholder as label replacement

---

### Form Accessibility

**Label Associations:**

- Always use proper `<label>` with `htmlFor` attribute
- Or wrap input inside label element

**Error Handling:**

- `aria-invalid="true"` on invalid fields
- `aria-describedby` linking to error message
- `role="alert"` on error messages for screen reader announcement
- Visual error indicators (icons, border color)
- Error summary at top of form for multiple errors

See [examples/forms.md](examples/forms.md) for complete form validation and error handling patterns.

---

### Focus Indicators

**Minimum requirements:**

- 3:1 contrast ratio against background
- 2px minimum thickness
- Clear visual difference from unfocused state
- Consistent across all interactive elements

**Use `:focus-visible` for better UX:**

```css
/* Shows only for keyboard navigation, not mouse clicks */
button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

See [examples/focus.md](examples/focus.md) for full focus indicator patterns.

---

### Touch Target Sizes

**WCAG 2.2 Target Size Requirements:**

- **Level AA (2.5.8):** 24x24 CSS pixels minimum, or adequate spacing (24px between targets)
- **Level AAA (2.5.5):** 44x44 CSS pixels (recommended for best UX)
- Exceptions: inline text links, user agent controls, essential designs

See [examples/touch-targets.md](examples/touch-targets.md) for sizing and spacing examples.

---

### Screen Reader Support

- Use `.sr-only` class for screen reader only text
- Use `aria-label` for icon-only buttons
- Use empty `alt=""` for decorative images
- Use `aria-hidden="true"` for decorative content (but never on focusable elements)

See [examples/screen-reader.md](examples/screen-reader.md) for sr-only and hiding patterns.

---

### Motion and Animation Accessibility

**WCAG 2.3.3 Animation from Interactions (AAA):**

Motion can cause nausea, dizziness, or vestibular disorders (affects 70+ million people). Use `prefers-reduced-motion` to respect user preferences:

```css
/* Only animate when user has no motion preference */
@media (prefers-reduced-motion: no-preference) {
  .animated-element {
    animation: slide-in 300ms ease-out;
  }
}
```

**Key principles:**

- `reduce` means minimize, not eliminate all motion - essential animations can remain
- Replace motion effects (scale, rotate, slide) with non-motion effects (fade, dissolve, color change)
- Provide pause/stop controls for auto-playing content longer than 5 seconds
- Avoid parallax scrolling effects or provide alternatives

---

### WCAG 2.2 New Success Criteria

**WCAG 2.2** (W3C Recommendation October 2023, ISO/IEC 40500:2025 as of October 2025) added 9 new success criteria. Key ones for developers:

**Level A:**

- **3.2.6 Consistent Help** - Help mechanisms (contact, chat) must appear in same relative order across pages
- **3.3.7 Redundant Entry** - Previously entered info must be auto-populated or available for selection

**Level AA:**

- **2.4.11 Focus Not Obscured (Minimum)** - Focused element must not be entirely hidden by other content (sticky headers, modals)
- **2.5.7 Dragging Movements** - Provide single-pointer alternative to drag operations
- **2.5.8 Target Size (Minimum)** - 24x24px minimum or adequate spacing
- **3.3.8 Accessible Authentication** - No cognitive function tests (CAPTCHAs) unless alternatives exist

**Level AAA:**

- **2.4.12 Focus Not Obscured (Enhanced)** - No part of focus indicator hidden
- **2.4.13 Focus Appearance** - Focus indicator 2px perimeter, 3:1 contrast
- **3.3.9 Accessible Authentication (Enhanced)** - Stricter CAPTCHA requirements

**Removed from WCAG 2.2:**

- **4.1.1 Parsing** - Obsolete due to modern browser error correction

</patterns>

---

## Testing Accessibility

**Multi-layered approach required** - automated tools catch ~57% of WCAG issues. Always combine with manual testing.

**Automated:** Use axe-core based tools in your test runner for automated WCAG checks. See [examples/testing.md](examples/testing.md) for axe integration patterns.

**Manual keyboard checklist:**

- [ ] Tab through all interactive elements in logical order
- [ ] Activate buttons with Enter/Space
- [ ] Close modals with Escape
- [ ] Navigate dropdowns with arrows
- [ ] No keyboard traps
- [ ] Focus indicators visible on all elements

**Manual screen reader checklist:**

- [ ] All images have alt text (or alt="" if decorative)
- [ ] Form inputs have labels
- [ ] Error messages are announced
- [ ] Headings create logical outline
- [ ] Landmarks are labeled
- [ ] Live regions announce updates

**Manual visual checklist:**

- [ ] Color contrast meets WCAG AA (4.5:1 text, 3:1 UI)
- [ ] Information not conveyed by color alone
- [ ] Text resizable to 200% without horizontal scroll
- [ ] Touch targets meet 24x24px minimum (AA)
- [ ] Focus indicators have 3:1 contrast
- [ ] Animations respect prefers-reduced-motion

**Screen readers to test with:** NVDA (Windows, free), JAWS (Windows, paid), VoiceOver (macOS/iOS, built-in), TalkBack (Android, built-in)

---

**Key patterns covered:**

- Keyboard navigation standards (tab order, focus management, skip links, Escape to close)
- ARIA patterns with headless component libraries (built-in accessibility)
- WCAG 2.2 AA compliance minimum (contrast ratios, semantic HTML, touch targets 24x24px minimum)
- Screen reader support (role-based queries, hidden content, live regions)

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Skip links, semantic HTML, landmarks, button vs link
- [examples/forms.md](examples/forms.md) - Form validation, error handling, accessible select
- [examples/focus.md](examples/focus.md) - Modal dialogs, focus indicators
- [examples/color.md](examples/color.md) - Contrast, color-independent indicators, tokens
- [examples/tables.md](examples/tables.md) - Sortable data tables
- [examples/touch-targets.md](examples/touch-targets.md) - Touch target sizing
- [examples/screen-reader.md](examples/screen-reader.md) - sr-only, hiding decorative content
- [examples/testing.md](examples/testing.md) - Accessibility testing with axe-core
- [reference.md](reference.md) - Decision frameworks, anti-patterns, WCAG quick reference

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Removing focus outlines without replacement - keyboard users can't navigate, violates WCAG 2.4.7
- Using `div` or `span` for buttons/links - no semantic meaning, no keyboard support
- Click handlers on non-interactive elements without role/keyboard support - violates WCAG 2.1.1
- Form inputs without labels - screen readers can't announce purpose, violates WCAG 1.3.1

**Medium Priority Issues:**

- Color-only error indicators - color-blind users can't distinguish
- Placeholder text as label replacement - disappears on input
- Auto-playing audio/video without controls - violates WCAG 1.4.2

**Gotchas & Edge Cases:**

- `:focus` vs `:focus-visible` - use `:focus-visible` to avoid focus rings on mouse clicks
- Empty `alt=""` is correct for decorative images - don't skip the alt attribute entirely
- `aria-hidden="true"` also hides from keyboard - don't use on focusable elements
- `role="button"` on `<div>` doesn't add keyboard support - still need Enter/Space handlers
- `prefers-reduced-motion: reduce` means minimize, not eliminate - essential animations can remain
- Live regions announce ALL content - keep messages concise to avoid spam

See [reference.md](reference.md) for full anti-patterns with code examples.

</red_flags>

---

## Resources

**Official guidelines:**

- WCAG 2.2 Guidelines: https://www.w3.org/WAI/WCAG22/quickref/
- What's New in WCAG 2.2: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- WAI-ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/

**Tools:**

- axe DevTools: https://www.deque.com/axe/devtools/
- WAVE: https://wave.webaim.org/
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST ensure all interactive elements are keyboard accessible with visible focus indicators)**

**(You MUST use headless component libraries for complex ARIA patterns instead of manual implementation)**

**(You MUST maintain WCAG AA minimum contrast ratios - 4.5:1 for text, 3:1 for UI components)**

**(You MUST never use color alone to convey information - always add icons, text, or patterns)**

**Failure to follow these rules will make the site unusable for keyboard users, screen reader users, and color-blind users - violating WCAG 2.2 Level AA compliance.**

</critical_reminders>
