# Touch Target Accessibility Patterns

> Touch target sizing and spacing for WCAG 2.2 compliance.

---

## Touch Target Sizing (WCAG 2.2)

### WCAG 2.2 Requirements

**2.5.8 Target Size (Minimum) - Level AA:**

- Minimum: 24x24 CSS pixels
- OR: Adequate spacing (24px between closest points of adjacent targets)
- Exceptions: inline text, user agent controls, essential designs

**2.5.5 Target Size (Enhanced) - Level AAA:**

- Minimum: 44x44 CSS pixels (recommended for best UX)

### Example: Meeting WCAG 2.2 AA (24x24px Minimum)

```scss
// GOOD: Meets WCAG 2.2 AA minimum (24x24px)
.button {
  min-width: 24px;
  min-height: 24px;
  padding: var(--space-sm) var(--space-md);
}

// BETTER: Meets WCAG 2.2 AAA (44x44px) - recommended
.button-accessible {
  min-width: 44px;
  min-height: 44px;
  padding: var(--space-md) var(--space-lg);
}

.icon-button {
  width: 44px; // AAA target
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 24px; // Visual size smaller than touch target
    height: 24px;
  }
}

// GOOD: Link with sufficient touch target using negative margins
.inline-link {
  padding: var(--space-sm) var(--space-md);
  margin: calc(var(--space-sm) * -1) calc(var(--space-md) * -1);
  // Negative margin expands clickable area without affecting layout
}

// ALTERNATIVE: Small target with adequate spacing (WCAG 2.2 compliant)
.small-icon-button {
  width: 20px;
  height: 20px;
  // Compliant IF there's 24px spacing to nearest target
}

// BAD: Too small AND no spacing compensation
.bad-button {
  width: 16px; // Below 24px minimum!
  height: 16px;
  padding: 0;
  margin: 4px; // Not enough spacing!
}
```

---

## Spacing Between Touch Targets

### Example: Adequate Spacing

```scss
// GOOD: Adequate spacing
.button-group {
  display: flex;
  gap: var(--space-md); // 8px minimum between buttons
}

.mobile-nav {
  display: flex;
  gap: var(--space-lg); // 12px spacing on mobile
}

// BAD: No spacing
.bad-button-group {
  display: flex;
  gap: 0; // Buttons are touching - hard to tap accurately
}
```
