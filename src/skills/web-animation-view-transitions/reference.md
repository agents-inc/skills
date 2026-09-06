# View Transitions Reference

> Naming rules, the pseudo-element tree, API tables and support. See [SKILL.md](SKILL.md) for the
> decisions and the red flags, [examples/](examples/) for full code.

---

## view-transition-name Values

| Value            | Meaning                                                             |
| ---------------- | ------------------------------------------------------------------- |
| `none`           | Element does not participate — the default                          |
| `<custom-ident>` | Identifier for this element, unique among visible elements          |
| `match-element`  | Browser derives an identity per element (Chrome 137+, Safari 18.4+) |
| `root`           | Reserved for the document root, applied automatically               |

```css
/* valid */
view-transition-name: hero-image;
view-transition-name: product-123;
view-transition-name: my_element;
view-transition-name: card--expanded;

/* invalid */
view-transition-name: auto; /* CSS-wide keyword */
view-transition-name: inherit; /* CSS-wide keyword */
view-transition-name: 123-product; /* identifiers cannot start with a digit */
view-transition-name: item/detail; /* slash is not an identifier character */
```

---

## Pseudo-Element Tree

```
::view-transition                          root overlay
├── ::view-transition-group(root)
│   └── ::view-transition-image-pair(root)
│       ├── ::view-transition-old(root)    screenshot of the old state
│       └── ::view-transition-new(root)    live new state
└── ::view-transition-group(hero)          one per named element
    └── ::view-transition-image-pair(hero)
        ├── ::view-transition-old(hero)
        └── ::view-transition-new(hero)
```

| Pseudo-element                    | Carries                        | Default animation        |
| --------------------------------- | ------------------------------ | ------------------------ |
| `::view-transition`               | Overlay above the page         | none                     |
| `::view-transition-group(*)`      | Position and size of the pair  | width, height, transform |
| `::view-transition-image-pair(*)` | The two snapshots, stacked     | none                     |
| `::view-transition-old(*)`        | Screenshot of the old state    | `opacity: 1 -> 0`        |
| `::view-transition-new(*)`        | Live representation of the new | `opacity: 0 -> 1`        |

### Grouped styling with view-transition-class

```css
.card {
  view-transition-class: card;
}

::view-transition-group(.card) {
  animation-duration: var(--card-duration);
}
```

One rule reaches every element carrying the class, which is what keeps a list of individually-named
items from needing an individually-written rule each.

---

## Performance

| Metric | Effect                                                                             |
| ------ | ---------------------------------------------------------------------------------- |
| LCP    | Roughly 70ms added on repeat mobile pageviews                                      |
| INP    | The page is inert for the animation's duration, so it lands in interaction latency |
| CPU    | The penalty grows on slower devices, where the snapshot itself costs more          |

Keep page transitions to 200–300ms, animate `transform`, `opacity` and `clip-path`, and name only the
elements a reader would follow. Prerendering the destination through speculation rules removes the
navigation cost the transition would otherwise sit on top of.

### Opting out on constrained connections

```typescript
function shouldEnableTransitions(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }

  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;

  if (connection?.saveData || connection?.effectiveType === "slow-2g") {
    return false;
  }

  return "startViewTransition" in document;
}
```

---

## Browser Support

| Feature                        | Chrome | Safari | Firefox | Edge |
| ------------------------------ | ------ | ------ | ------- | ---- |
| Same-document transitions      | 111+   | 18+    | 144+    | 111+ |
| Cross-document transitions     | 126+   | 18.2+  | No      | 126+ |
| view-transition-class          | 125+   | 18+    | 144+    | 125+ |
| match-element                  | 137+   | 18.4+  | No      | 137+ |
| :active-view-transition-type() | 126+   | 18.2+  | No      | 126+ |

---

## API

| API                                               | Purpose                                        |
| ------------------------------------------------- | ---------------------------------------------- |
| `document.startViewTransition(callback)`          | Start a same-document transition               |
| `document.startViewTransition({ update, types })` | Start one classified by type                   |
| `@view-transition { navigation: auto }`           | Opt a document into cross-document transitions |
| `view-transition-name: <name>`                    | Lift an element into its own snapshot pair     |
| `view-transition-class: <class>`                  | Group elements for shared styling              |
| `transition.updateCallbackDone`                   | Promise: the DOM update finished               |
| `transition.ready`                                | Promise: pseudo-elements exist                 |
| `transition.finished`                             | Promise: animation over                        |
| `transition.types`                                | Mutable set of types for CSS selection         |
| `transition.skipTransition()`                     | Jump to the final state immediately            |

### Cross-document events

| Event        | Fires                                     | Used for                           |
| ------------ | ----------------------------------------- | ---------------------------------- |
| `pageswap`   | Before the last frame of the old document | Naming elements on the source      |
| `pagereveal` | After the new document's DOM is ready     | Naming elements on the destination |

---

## Accessibility Checklist

- [ ] Feature detection keeps the DOM update working where the API is absent
- [ ] `prefers-reduced-motion` handled in CSS, and in script where the transition is skipped outright
- [ ] Animations stay under 300ms, so the inert window is short
- [ ] No transition loops or runs indefinitely
- [ ] Content is reachable during and after the transition
- [ ] Removing every transition leaves the application fully usable
