---
name: frontend/accessibility (@photoroom)
description: i18n labels, ARIA patterns for Photoroom webapp
---

# Accessibility Patterns - Photoroom Webapp

> **Quick Guide:** All interactive elements need accessible names. Use `useTranslation()` for ALL accessibility labels. Icon buttons require `title` + `aria-label`. Error states use `role="alert"`. Focus management required for modals/dialogs. Extend HTML attributes to preserve `aria-*` prop passthrough.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (PascalCase components, named exports, import ordering, `import type`, named constants)

**(You MUST use `useTranslation()` for ALL accessibility labels - translate every aria-label, title, and accessible name)**

**(You MUST add `title` AND `aria-label` to icon-only buttons for both tooltip and screen reader support)**

**(You MUST extend HTML attributes on components to preserve `aria-*` prop passthrough)**

**(You MUST use `role="alert"` or `aria-live` for dynamic error messages and status updates)**

**(You MUST manage focus when opening/closing modals and dialogs)**

</critical_requirements>

---

**Auto-detection:** accessibility, a11y, aria-label, aria-live, role="alert", screen reader, keyboard navigation, focus management, title attribute, icon button, semantic HTML

**When to use:**

- Adding accessible names to interactive elements
- Creating icon-only buttons with proper labels
- Implementing error announcements for screen readers
- Managing focus in modals and dialogs
- Building keyboard-navigable components
- Adding loading state communication

**Key patterns covered:**

- Translated accessibility labels via useTranslation
- Icon button accessibility (title + aria-label)
- Semantic HTML elements
- Error announcements (role="alert", aria-live)
- Focus management for modals/dialogs
- Keyboard navigation patterns
- Props extending HTML attributes for aria-* passthrough

**When NOT to use:**

- Refer to React skill for component structure
- Refer to Styling skill for visual focus states
- Refer to i18n patterns for translation setup

**Detailed Resources:**
- For code examples, see [examples.md](examples.md)
- For decision frameworks and anti-patterns, see [reference.md](reference.md)

---

<philosophy>

## Philosophy

Accessibility in the Photoroom webapp ensures all users, including those using screen readers or keyboard navigation, can use the application effectively. All user-facing text, including accessibility labels, must be translated using `useTranslation()`.

**Core Principles:**

- **Translated labels:** All `aria-label`, `title`, and accessible names use translation keys
- **Semantic HTML:** Use appropriate HTML elements (`<button>`, `<nav>`, `<main>`) before ARIA
- **Keyboard accessible:** All interactive elements reachable and operable via keyboard
- **Screen reader friendly:** Dynamic content announces appropriately with ARIA live regions
- **Focus management:** Modal/dialog focus trapped and returned appropriately

**When to use ARIA:**

- Adding accessible names when visible text is insufficient (icon buttons)
- Creating live regions for dynamic content updates
- Describing relationships between elements
- Indicating expanded/collapsed states

**When to avoid ARIA:**

- When semantic HTML already provides the accessibility (use `<button>` instead of `<div role="button">`)
- When visible text already serves as the accessible name
- When duplicating information already conveyed by the element

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Translated Accessibility Labels

All accessibility labels must use translation keys via `useTranslation()`.

See [examples.md](examples.md#translated-accessibility-labels) for implementation examples.

---

### Pattern 2: Icon Button Accessibility

Icon-only buttons require BOTH `title` (tooltip) AND `aria-label` (screen reader).

See [examples.md](examples.md#icon-button-accessibility) for implementation examples.

---

### Pattern 3: Semantic HTML Elements

Use appropriate semantic HTML before reaching for ARIA roles.

See [examples.md](examples.md#semantic-html-elements) for implementation examples.

---

### Pattern 4: Error Announcements with ARIA Live

Use `role="alert"` or `aria-live` for dynamic error messages that screen readers should announce.

**aria-live Values:**
- `aria-live="assertive"`: Interrupt immediately (use sparingly, for critical errors)
- `aria-live="polite"`: Announce when user is idle (preferred for status updates)
- `role="alert"`: Equivalent to `aria-live="assertive"` with `role="alert"`

See [examples.md](examples.md#error-announcements-with-aria-live) for implementation examples.

---

### Pattern 5: Focus Management for Modals

Modals and dialogs require proper focus management for accessibility.

See [examples.md](examples.md#focus-management-for-modals) for implementation examples.

---

### Pattern 6: Props Extending HTML Attributes

Always extend HTML attributes to allow aria-* props to pass through.

See [examples.md](examples.md#props-extending-html-attributes) for implementation examples.

---

### Pattern 7: Loading State Communication

Communicate loading states to screen reader users.

See [examples.md](examples.md#loading-state-communication) for implementation examples.

---

### Pattern 8: Keyboard Navigation for Custom Components

Ensure custom interactive components are keyboard accessible.

See [examples.md](examples.md#keyboard-navigation-for-custom-components) for implementation examples.

</patterns>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use `useTranslation()` for ALL accessibility labels - translate every aria-label, title, and accessible name)**

**(You MUST add `title` AND `aria-label` to icon-only buttons for both tooltip and screen reader support)**

**(You MUST extend HTML attributes on components to preserve `aria-*` prop passthrough)**

**(You MUST use `role="alert"` or `aria-live` for dynamic error messages and status updates)**

**(You MUST manage focus when opening/closing modals and dialogs)**

**Failure to follow these rules will make the application inaccessible to screen reader users and keyboard-only users.**

</critical_reminders>
