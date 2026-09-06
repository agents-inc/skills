# CSS Animations Reference

> Lookup tables for CSS animation work. See [SKILL.md](SKILL.md) for the decisions and the red flags,
> [examples/](examples/) for full code.

---

## Easing Catalogue

```css
/* Standard */
--ease-in: cubic-bezier(0.4, 0, 1, 1); /* exit */
--ease-out: cubic-bezier(0, 0, 0.2, 1); /* enter */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1); /* symmetric */

/* Material Design */
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
--ease-decelerate: cubic-bezier(0, 0, 0.2, 1);
--ease-accelerate: cubic-bezier(0.4, 0, 1, 1);

/* Overshoot */
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55); /* heavier */

/* Smooth, symmetric, no overshoot */
--ease-smooth: cubic-bezier(0.45, 0, 0.55, 1);
```

---

## Property Cost

At 60fps a frame has 16.67ms. A layout-triggering property spends most of that budget before
painting starts.

| Cost               | Properties                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Composite (GPU)    | `opacity`, `transform` (translate, scale, rotate, skew), `filter` in most engines                                    |
| Paint              | `color`, `background-color`, `border-color`, `visibility`, `text-decoration`                                         |
| Layout, then paint | `width`, `height`, `top`, `right`, `bottom`, `left`, `margin`, `padding`, `border-width`, `font-size`, `line-height` |

### Transform substitutions

| Instead of          | Use                                       |
| ------------------- | ----------------------------------------- |
| `top`, `left`       | `translate(x, y)`                         |
| `width`, `height`   | `scale()`                                 |
| `box-shadow`        | pseudo-element whose `opacity` animates   |
| `margin`, `padding` | `translate()`, leaving the layout box put |

---

## Duration Guidance

| Motion             | Duration   | Why                                    |
| ------------------ | ---------- | -------------------------------------- |
| Micro-interactions | 100–150ms  | Reads as instant feedback              |
| UI transitions     | 200–300ms  | Perceived as motion without waiting    |
| Page transitions   | 300–500ms  | A major context change earns the time  |
| Complex sequences  | 500–1000ms | Only where the sequence is the content |

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

- [ ] Every animation has a `prefers-reduced-motion` branch
- [ ] Motion-sensitive effects degrade to an opacity fade rather than to nothing
- [ ] Auto-playing motion can be paused or is short enough not to need it
- [ ] Focus indicators stay visible while an animation runs
- [ ] No animation blocks interaction with what it is animating
- [ ] Flashing stays under three flashes per second (WCAG 2.3.1)
- [ ] No information is carried by motion alone

---

## Measuring a Frame Budget

Record in the DevTools Performance panel with "Paint flashing" enabled in the Rendering tab, then
read three things off the trace: green repaint flashes, Layout events in the flame chart, and any
frame over 16.67ms.
