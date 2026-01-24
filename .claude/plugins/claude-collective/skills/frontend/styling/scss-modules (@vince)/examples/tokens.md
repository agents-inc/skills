# SCSS Modules Token Examples

> Spacing and typography token patterns for SCSS Modules. See [SKILL.md](../SKILL.md) for core concepts and [core.md](core.md) for foundational patterns.

---

## Pattern 6: Spacing System with Semantic Tokens

### Base Unit and Scale

**Location:** `packages/ui/src/styles/variables.scss`

**Base unit:** `--core-space-unit: 0.2rem` (2px at default font size)

**Core scale:**

- `--core-space-2`: 4px
- `--core-space-4`: 8px
- `--core-space-6`: 12px
- `--core-space-8`: 16px
- `--core-space-10`: 20px
- `--core-space-12`: 24px
- `--core-space-16`: 32px

**Semantic spacing tokens:**

- `--space-sm`: 4px
- `--space-md`: 8px
- `--space-lg`: 12px
- `--space-xlg`: 20px
- `--space-xxlg`: 24px
- `--space-xxxlg`: 32px

### Implementation

```scss
// Good Example - Consistent spacing

.button {
  padding: var(--space-md); // 8px
}

.container {
  gap: var(--space-lg); // 12px
}

.compact-list {
  gap: var(--space-sm); // 4px
}

.section {
  margin-bottom: var(--space-xlg); // 20px
}

.card {
  padding: var(--space-lg); // 12px all sides
  margin-bottom: var(--space-xxlg); // 24px bottom
}
```

**Why good:** Consistent spacing scale creates visual rhythm, semantic names clarify usage intent, design token changes update all components automatically

```scss
// Bad Example

.button {
  // BAD: Hardcoded values
  padding: 8px;
  margin: 12px;

  // BAD: Using core tokens directly
  gap: var(--core-space-4);
}
```

**Why bad:** Hardcoded values break design system consistency and can't be themed, using core tokens bypasses semantic layer and makes purpose unclear

---

## Pattern 7: Typography System with REM-Based Sizing

### Core and Semantic Sizes

**Location:** `packages/ui/src/styles/variables.scss`

**Core font sizes:**

- `--core-text-size-1`: 1.6rem (16px)
- `--core-text-size-2`: 1.8rem (18px)
- `--core-text-size-3`: 2rem (20px)

**Semantic typography tokens:**

- `--text-size-icon`: 16px
- `--text-size-body`: 16px
- `--text-size-body2`: 18px
- `--text-size-heading`: 20px

### Implementation

```scss
// Good Example

.button {
  font-size: var(--text-size-body); // 16px
}

h1,
h2,
h3 {
  font-size: var(--text-size-heading); // 20px
}

.text {
  font-size: var(--text-size-body); // 16px
}

.intro {
  font-size: var(--text-size-body2); // 18px
}

.icon {
  font-size: var(--text-size-icon); // 16px
  width: var(--text-size-icon);
  height: var(--text-size-icon);
}
```

**Why good:** REM-based sizing respects user browser preferences for accessibility, semantic names clarify usage (body vs heading vs icon), consistent scale across UI

```scss
// Bad Example

.button {
  // BAD: Hardcoded px values
  font-size: 16px;
}

.heading {
  // BAD: Using core tokens directly
  font-size: var(--core-text-size-3);
}
```

**Why bad:** Hardcoded px values ignore user preferences and break accessibility, using core tokens bypasses semantic layer and obscures purpose
