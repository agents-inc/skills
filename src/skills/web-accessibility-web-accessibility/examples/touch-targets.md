# Accessibility — Target Size

> Sizing and spacing for WCAG 2.2. The criteria and exemptions are in [reference.md](../reference.md).

---

## Meeting the minimum

```css
/* AA — 24×24 CSS px */
.button {
  min-width: 24px;
  min-height: 24px;
  padding: var(--space-sm) var(--space-md);
}

/* AAA — 44×44, and the size most touch guidance recommends anyway */
.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
}

.icon-button svg {
  width: 24px;
  height: 24px;
}
```

**Why good:** the target and the graphic are sized separately, so a 24px icon can sit inside a 44px
hit area without the layout gaining any visible weight. The measurement is of the interactive area,
not of what is drawn — padding counts, and a small icon in a large button already passes.

---

## Expanding a target without moving the layout

```css
.inline-link {
  padding: var(--space-sm) var(--space-md);
  margin: calc(var(--space-sm) * -1) calc(var(--space-md) * -1);
}
```

**Why good:** the padding grows the hit area and the equal negative margin removes it from flow, so
neighbouring text does not move. Watch for overlap — two of these side by side can end up with
targets on top of each other, and whichever is later in the DOM wins.

---

## Spacing as the alternative

```css
/* Compliant: under 24px, but with 24px of clear space around it */
.small-icon-button {
  width: 20px;
  height: 20px;
}

.toolbar {
  display: flex;
  gap: 24px;
}
```

**Why good:** 2.5.8 is satisfied either by the size or by the spacing, which is what makes dense
toolbars and inline controls achievable at all. The measurement is between the closest points of
adjacent targets.

```css
/* Bad — small and crowded */
.bad-toolbar {
  display: flex;
  gap: 4px;
}

.bad-toolbar button {
  width: 16px;
  height: 16px;
}
```

**Why bad:** neither route is taken, so every press is a gamble — and the cost falls on anyone with a
tremor, a large finger, or a moving vehicle.

---

## Where the rule does not apply

Inline links inside a sentence are exempt, because enlarging them would break the line. Browser-
supplied controls are exempt, as are cases where the size is essential to the meaning — a pin on a
map, a point on a chart. Everything else is in scope, including icon buttons, checkboxes, and the
close control on a dialog, which is the one most often under size.
