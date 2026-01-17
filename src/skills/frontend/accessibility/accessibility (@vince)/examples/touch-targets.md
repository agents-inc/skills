# Touch Target Accessibility Patterns

> Touch target sizing and spacing for mobile accessibility.

---

## Touch Target Sizing

### Example: Meeting 44x44px Minimum

```scss
// GOOD: Meets 44x44px minimum
.button {
  min-width: 44px;
  min-height: 44px;
  padding: var(--space-md) var(--space-lg);
}

.icon-button {
  width: 44px;
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

// BAD: Too small for touch
.bad-button {
  width: 24px; // Too small!
  height: 24px;
  padding: 0;
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
