# Accessibility — Colour

> Contrast, colour-independent status and link styling. Ratios are in [reference.md](../reference.md).

---

## Contrast in practice

```css
/* Passes */
.button-primary {
  background: #0066cc;
  color: #ffffff; /* 5.6:1 — clears AA, short of AAA's 7:1 */
}

.text-body {
  color: #333333;
  background: #ffffff; /* 12.6:1 */
}

/* Fails */
.button-warning {
  background: #ffeb3b;
  color: #ffffff; /* 1.2:1 — a bright background is not a light one */
}

.text-muted {
  color: #999999;
  background: #ffffff; /* 2.85:1 — needs 4.5:1 at body size */
}
```

**Why the second pair fails:** contrast is a luminance ratio, not a perceived difference in hue.
Yellow is bright, so white text on it has almost no ratio at all, however different the two colours
look side by side. Grey placeholder text at `#999` is the single commonest failure in real designs.

The ratio is against what is actually behind the text — a semi-transparent overlay, a gradient or a
photograph all change it, and the worst point in the gradient is the one that has to pass.

---

## Pattern 9: Status without colour

```typescript
type Status = "success" | "error" | "warning";

const STATUS_CONFIG: Record<Status, { symbol: string; label: string; className: string }> = {
  success: { symbol: "✓", label: "Success", className: "status-success" },
  error: { symbol: "×", label: "Error", className: "status-error" },
  warning: { symbol: "!", label: "Warning", className: "status-warning" },
};

export function StatusBadge({ status }: { status: Status }) {
  const { symbol, label, className } = STATUS_CONFIG[status];

  return (
    <span className={className}>
      <span aria-hidden="true">{symbol}</span>
      <span>{label}</span>
    </span>
  );
}
```

**Why good:** three signals — shape, word and colour — and removing any one leaves the meaning
intact. The symbol is hidden from assistive technology because the adjacent word already carries it;
announcing both gives "times error".

```typescript
// Bad
function BadStatusBadge({ isSuccess }: { isSuccess: boolean }) {
  return <div style={{ backgroundColor: isSuccess ? "green" : "red", width: 20, height: 20 }} />;
}
```

**Why bad:** red and green are the pair most colour-blind readers cannot separate, and there is no
text at all, so a screen reader announces nothing whatsoever.

The same applies to charts: a legend keyed only by colour is unreadable, so lines need shapes or
patterns and direct labels beat a legend either way.

---

## Links in prose

```css
.content a {
  color: var(--color-link);
  text-decoration: underline;
}

.content a:hover {
  text-decoration-thickness: 2px;
}

.content a:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

**Why good:** the underline is what identifies the link; the colour is decoration. Removing it means
a reader who cannot separate the link colour from the body colour cannot find the links at all —
which is why WCAG treats colour-only links as a contrast failure between the link and the text
around it.

Navigation and buttons are different: position and shape already identify them, so an underline is
not owed there.

---

## Tokens that carry their ratio

```css
:root {
  /* Ratios measured against --color-surface-base */
  --color-text-default: #1a1a1a; /* 17.4:1 */
  --color-text-muted: #4a4a4a; /* 8.9:1 */
  --color-text-subtle: #6b6b6b; /* 5.3:1 — lowest that still clears AA at body size */

  --color-surface-base: #ffffff;
  --color-surface-subtle: #f5f5f5;
}
```

**Why good:** recording the ratio beside the value makes the constraint visible at the point someone
would otherwise lighten it by one step. Naming the surface each ratio was measured against matters
too — the same text token on `--color-surface-subtle` is a different ratio, and a token that passes
on white can fail on the grey it was never checked against.
