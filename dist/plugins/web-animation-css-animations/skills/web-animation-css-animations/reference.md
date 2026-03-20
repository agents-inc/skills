# CSS Animations Reference

> Quick reference tables for CSS animation development. See [SKILL.md](SKILL.md) for decision frameworks and red flags, [examples/](examples/) for code examples.

---

## Easing Functions Reference

```css
/* Standard easings */
--ease-in: cubic-bezier(0.4, 0, 1, 1); /* Exit animations */
--ease-out: cubic-bezier(0, 0, 0.2, 1); /* Enter animations */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1); /* Symmetric motion */

/* Material Design easings */
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1); /* General purpose */
--ease-decelerate: cubic-bezier(0, 0, 0.2, 1); /* Enter */
--ease-accelerate: cubic-bezier(0.4, 0, 1, 1); /* Exit */

/* Bounce/spring easings */
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Playful overshoot */
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55); /* Heavier overshoot */

/* Smooth easings (Apple-style) */
--ease-smooth: cubic-bezier(0.45, 0, 0.55, 1);
```

---

## Properties by Performance Impact

### Safe (Composite Only - GPU)

- `opacity`
- `transform` (translate, scale, rotate, skew)
- `filter` (on some browsers)

### Caution (Paint Only)

- `color`, `background-color`, `border-color`
- `visibility`, `text-decoration`

### Avoid (Trigger Layout)

- `width`, `height`
- `top`, `right`, `bottom`, `left`
- `margin`, `padding`
- `border-width`, `font-size`, `line-height`

---

## Browser Support

| Feature                    | Chrome | Edge | Firefox | Safari |
| -------------------------- | ------ | ---- | ------- | ------ |
| CSS Transitions            | Full   | Full | Full    | Full   |
| CSS Animations             | Full   | Full | Full    | Full   |
| @property                  | 85+    | 85+  | 128+    | 16.4+  |
| scroll-timeline            | 115+   | 115+ | Flag    | 26+    |
| animation-timeline: view() | 115+   | 115+ | Flag    | 26+    |
| linear() easing            | 113+   | 113+ | 112+    | 17.4+  |

---

## Accessibility Checklist

- [ ] Uses `@media (prefers-reduced-motion)` for all animations
- [ ] Provides safe alternatives (opacity fade) for motion-sensitive effects
- [ ] Auto-playing animations can be paused or have user control
- [ ] Decorative animations don't interfere with content comprehension
- [ ] Focus indicators remain visible during animations
- [ ] Animation duration doesn't block interaction
- [ ] Flashing content is under 3 flashes per second (WCAG 2.3.1)
- [ ] Essential information isn't conveyed by animation alone

---

## Performance Testing

1. Open DevTools Performance panel
2. Enable "Paint flashing" in Rendering tab
3. Record during animation
4. Check for:
   - Green flashes (repaints) -- minimize these
   - Layout events in flame chart -- eliminate if possible
   - Frame rate drops below 60fps
