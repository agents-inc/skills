# 06. Design System

> **Quick Guide:** Setting up tokens? See §6.1 (three-tier system). Colors? See §6.2. Spacing? See §6.3. Theme switching? See §6.5.

## 6.1 Token Architecture

- **Three-tier system:**
  - Base tokens (primitives: `--base-color-blue-500`)
  - Semantic tokens (purpose: `--color-primary`, `--color-success`)
  - Component tokens (specific: `--button-primary-bg`)
- Token naming conventions
- Token organization (separate files or monolithic)

## 6.2 Color System

- Color token structure
- Scale (50, 100, 200...900)
- Semantic color naming
- Component-specific colors
- Accessibility (contrast ratios)

## 6.3 Spacing System

- Base unit (4px, 8px, rem-based)
- Scale (1, 2, 4, 8, 12, 16, 24, 32, 48, 64...)
- Margin/padding conventions
- Gap usage in layouts

## 6.4 Typography

- Font size scale
- Font weight conventions
- Line height system (1.2, 1.5, 1.75, 2)
- Font family tokens
- Responsive typography

## 6.5 Theme Implementation

- Light/dark mode approach
- Theme switching mechanism
- CSS variable usage
- Component theming
- Persistent theme preference
