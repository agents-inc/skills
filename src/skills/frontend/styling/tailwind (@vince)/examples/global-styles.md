# SCSS Usage (Global Styles Only)

> Code examples for SCSS in a Tailwind-first codebase. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 5: SCSS Usage (Minimal - Global Styles Only)

### File Locations

- `src/index.scss` - Global font definitions and base styles
- Component-specific SCSS is rare and discouraged

### Good Example - Custom Font Definition

```scss
// src/index.scss
@font-face {
  font-family: "TT Photoroom";
  src: url("https://font-cdn.photoroom.com/fonts/tt-photoroom/TT_Photoroom_Regular.woff2") format("woff2");
  font-weight: 400;
  font-display: swap;
}

@font-face {
  font-family: "TT Photoroom";
  src: url("https://font-cdn.photoroom.com/fonts/tt-photoroom/TT_Photoroom_Medium.woff2") format("woff2");
  font-weight: 500;
  font-display: swap;
}

@font-face {
  font-family: "TT Photoroom";
  src: url("https://font-cdn.photoroom.com/fonts/tt-photoroom/TT_Photoroom_Bold.woff2") format("woff2");
  font-weight: 700;
  font-display: swap;
}
```

**Why good:** CDN-hosted fonts for performance, font-display swap for better LCP, custom brand font with system fallbacks

### Bad Example - Component-level SCSS

```scss
// src/components/Button/Button.module.scss
.button {
  padding: 8px 16px;
  border-radius: 4px;
}
```

**Why bad:** Creates parallel styling system, loses Tailwind benefits, harder to maintain consistency
