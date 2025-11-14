# 07. Accessibility

> **Quick Guide:** Keyboard navigation? See §7.1. ARIA patterns? See §7.2. Color contrast? See §7.3 (WCAG AA minimum). Testing? See §7.4.

## 7.1 Keyboard Navigation Standards

- Tab order (logical flow)
- Keyboard shortcuts
- Focus management
- Skip links
- Focus trapping in modals

## 7.2 ARIA Patterns

- Required ARIA per component type
- Accessible name calculation
- State communication (aria-pressed, aria-expanded, aria-checked)
- Live regions (aria-live)
- Roles and landmarks

## 7.3 Color Contrast Requirements

- WCAG level (AA minimum, AAA preferred)
- Contrast ratios:
  - Text: 4.5:1 (AA), 7:1 (AAA)
  - Large text: 3:1 (AA), 4.5:1 (AAA)
  - UI components: 3:1
- Testing tools (axe, Stark)

## 7.4 Testing Approach

- Automated testing (axe-core, jest-axe)
- Manual testing checklist
- Screen reader testing (NVDA, VoiceOver, TalkBack)
- Keyboard-only navigation testing

## 7.5 Touch Target Sizes

- Minimum sizes (44×44px per WCAG)
- Spacing between targets
- Mobile considerations
