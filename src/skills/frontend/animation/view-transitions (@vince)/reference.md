# View Transitions Reference

> Decision frameworks, anti-patterns, and red flags for View Transitions API. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use View Transitions vs CSS Transitions

```
Is this a page/state change affecting large portions of the UI?
├─ YES → Is it a page navigation?
│   ├─ YES → Is it MPA (multi-page)?
│   │   ├─ YES → Use @view-transition CSS ✓
│   │   └─ NO → Use startViewTransition() ✓
│   └─ NO → Is it a significant state change (view toggle)?
│       ├─ YES → Use startViewTransition() ✓
│       └─ NO → CSS transitions may suffice
└─ NO → Is it a small component animation?
    ├─ YES → CSS transitions are simpler
    └─ NO → What type of animation?
        ├─ Hover/focus feedback → CSS transitions
        ├─ Scroll-linked → Use animation library
        └─ Complex physics → Use animation library
```

### When to Use Same-Document vs Cross-Document Transitions

```
What type of navigation is this?
├─ SPA (single-page app with client routing)
│   └─ Use document.startViewTransition() ✓
├─ MPA (traditional server-rendered pages)
│   └─ Use @view-transition { navigation: auto } ✓
├─ Hybrid (some pages SPA, some MPA)
│   ├─ SPA routes → startViewTransition()
│   └─ MPA routes → @view-transition CSS
└─ State change within same page
    └─ Use startViewTransition() ✓
```

### When to Use Shared Elements

```
Are there visually related elements before and after?
├─ YES → Do they represent the same conceptual item?
│   ├─ YES → Use same view-transition-name ✓
│   │   └─ Example: thumbnail → full image
│   └─ NO → Different transition names or none
└─ NO → Use default root transition
    └─ Customize via ::view-transition-old/new(root)
```

### When to Use Custom Animations vs Default

```
Is the default cross-fade appropriate?
├─ YES → Keep defaults, customize duration only
├─ NO → What effect do you need?
│   ├─ Slide (left/right) → Custom CSS keyframes
│   ├─ Scale/zoom → Custom CSS keyframes
│   ├─ Reveal (circle, wipe) → Web Animations API
│   └─ Direction-aware → :active-view-transition-type()
```

---

## view-transition-name Rules

### Valid Names

| Value | Description |
|-------|-------------|
| `none` | Element doesn't participate (default) |
| `<custom-ident>` | Unique identifier for the element |
| `match-element` | Auto-generate based on element identity (Chrome 137+) |
| `root` | Reserved for document root (auto-applied) |

### Naming Requirements

```css
/* VALID names */
view-transition-name: hero-image;
view-transition-name: product-123;
view-transition-name: my_element;
view-transition-name: card--expanded;

/* INVALID names */
view-transition-name: auto;        /* Reserved word */
view-transition-name: inherit;     /* Reserved word */
view-transition-name: 123-product; /* Starts with number */
view-transition-name: item/detail; /* Contains slash */
```

---

## Pseudo-Element Reference

### Pseudo-Element Hierarchy

```
::view-transition                          /* Root overlay */
├── ::view-transition-group(root)          /* Container for root */
│   └── ::view-transition-image-pair(root)
│       ├── ::view-transition-old(root)    /* Old state screenshot */
│       └── ::view-transition-new(root)    /* New state (live) */
└── ::view-transition-group(hero)          /* Named element */
    └── ::view-transition-image-pair(hero)
        ├── ::view-transition-old(hero)
        └── ::view-transition-new(hero)
```

### Pseudo-Element Purposes

| Pseudo-Element | Purpose | Default Animation |
|----------------|---------|-------------------|
| `::view-transition` | Root overlay | None |
| `::view-transition-group(*)` | Container for snapshot pair | Width/height/transform |
| `::view-transition-image-pair(*)` | Wraps old and new snapshots | None |
| `::view-transition-old(*)` | Static screenshot of old state | `opacity: 1 → 0` |
| `::view-transition-new(*)` | Live representation of new state | `opacity: 0 → 1` |

### Styling Examples

```css
/* Customize duration for all transitions */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 400ms;
}

/* Target specific named element */
::view-transition-group(hero-image) {
  animation-duration: 300ms;
  animation-timing-function: ease-out;
}

/* Use view-transition-class for grouped styling */
.card {
  view-transition-class: card;
}

::view-transition-group(.card) {
  animation-duration: 250ms;
}
```

---

## RED FLAGS

### High Priority Issues

- **Missing feature detection** - Calling `startViewTransition()` without checking support crashes in older browsers
- **Duplicate view-transition-name values** - Two visible elements with the same name breaks the transition entirely
- **Not cleaning up dynamic names** - Leftover names cause conflicts in subsequent transitions
- **Ignoring prefers-reduced-motion** - Mandatory for accessibility; always provide reduced or no animation
- **Magic numbers for timing** - All duration/delay values must be named constants

### Medium Priority Issues

- **Using obsolete meta tag syntax** - `<meta name="view-transition">` is deprecated; use `@view-transition` CSS
- **Not awaiting transition.ready for custom animations** - Web Animations API must wait for pseudo-elements to exist
- **Missing @view-transition on both MPA pages** - Cross-document transitions require opt-in on source AND destination
- **Setting view-transition-name in CSS for dynamic elements** - Causes conflicts; use JavaScript assignment

### Common Mistakes

- **Expecting instant DOM updates** - The callback runs during snapshot capture; DOM updates are batched
- **Using view-transition-name on hidden elements** - Hidden elements don't participate in transitions
- **Forgetting pagereveal must be registered early** - Put in `<head>` or use `blocking="render"`
- **Using reserved names** (auto, inherit, none, unset) - These are CSS keywords, not valid custom identifiers

### Gotchas & Edge Cases

- **Old state is a screenshot** - Videos, animations freeze in the old snapshot
- **New state is "live"** - Videos, GIFs continue playing in the new snapshot
- **Transition names are global** - Same name on different page sections will conflict
- **Navigation types require modern Chrome** - `:active-view-transition-type()` needs Chrome 126+
- **match-element is Chrome 137+** - Auto-naming not available in all browsers yet
- **Cross-document needs same-origin** - Different origins cannot share transitions
- **Animations block interaction** - User cannot interact until transition completes

---

## Anti-Patterns

### No Feature Detection

```typescript
// WRONG - crashes in unsupported browsers
document.startViewTransition(() => {
  updateDOM();
});

// CORRECT - graceful fallback
if (document.startViewTransition) {
  document.startViewTransition(() => updateDOM());
} else {
  updateDOM();
}
```

### Duplicate Transition Names

```css
/* WRONG - all cards have same name, transition breaks */
.card {
  view-transition-name: card;
}

/* CORRECT - unique names via CSS or JavaScript */
.card:nth-child(1) { view-transition-name: card-1; }
.card:nth-child(2) { view-transition-name: card-2; }

/* BETTER - use match-element for auto-naming */
.card {
  view-transition-name: match-element;
  view-transition-class: card;
}
```

### Forgetting Name Cleanup

```typescript
// WRONG - name persists, causes conflicts later
element.style.viewTransitionName = "hero";
document.startViewTransition(updateFn);
// Name never removed!

// CORRECT - clean up after transition
element.style.viewTransitionName = "hero";
const transition = document.startViewTransition(updateFn);
transition.finished.then(() => {
  element.style.viewTransitionName = "";
});
```

### Missing Reduced Motion Support

```css
/* WRONG - no reduced motion consideration */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 500ms;
}

/* CORRECT - respect user preferences */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 300ms;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 0.01ms !important;
  }
}
```

### Using Obsolete Syntax

```html
<!-- WRONG - obsolete meta tag -->
<meta name="view-transition" content="same-origin">

<!-- CORRECT - CSS at-rule -->
<style>
@view-transition {
  navigation: auto;
}
</style>
```

### Long Animation Durations

```css
/* WRONG - blocks interaction too long, hurts INP */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 2s;
}

/* CORRECT - keep under 300ms for page transitions */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 200ms;
}
```

### Custom Animation Without Waiting for Ready

```typescript
// WRONG - pseudo-elements may not exist yet
const transition = document.startViewTransition(updateFn);
document.documentElement.animate(
  { clipPath: [...] },
  { pseudoElement: "::view-transition-new(root)" }
);

// CORRECT - wait for ready promise
const transition = document.startViewTransition(updateFn);
await transition.ready;
document.documentElement.animate(
  { clipPath: [...] },
  { pseudoElement: "::view-transition-new(root)" }
);
```

---

## Performance Considerations

### Core Web Vitals Impact

- **LCP:** ~70ms added to Largest Contentful Paint for repeat mobile pageviews
- **INP:** Long animations can harm Interaction to Next Paint
- **CPU correlation:** Slower CPUs experience more pronounced negative effects

### Optimization Strategies

1. **Keep animations short** - Max 200-300ms for page transitions
2. **Use GPU-accelerated properties** - transform, opacity, clip-path
3. **Limit named elements** - Each named element creates additional pseudo-elements
4. **Use speculation rules for MPA** - Prerender makes transitions feel instant
5. **Disable on slow connections** - Check `navigator.connection.saveData`

```typescript
function shouldEnableTransitions(): boolean {
  // Check reduced motion
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }

  // Check for data saver
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }).connection;

  if (connection?.saveData || connection?.effectiveType === "slow-2g") {
    return false;
  }

  return "startViewTransition" in document;
}
```

---

## Browser Support Quick Reference

| Feature | Chrome | Safari | Firefox | Edge |
|---------|--------|--------|---------|------|
| Same-document transitions | 111+ | 18+ | 144+ | 111+ |
| Cross-document transitions | 126+ | Partial | Planned | 126+ |
| view-transition-class | 125+ | 18+ | 144+ | 125+ |
| match-element | 137+ | 18.4+ | Planned | 137+ |
| :active-view-transition-type() | 126+ | Partial | Planned | 126+ |

---

## Quick Reference

### Essential API

| API | Purpose |
|-----|---------|
| `document.startViewTransition(callback)` | Start same-document transition |
| `@view-transition { navigation: auto }` | Enable cross-document transitions |
| `view-transition-name: <name>` | Name element for individual transition |
| `view-transition-class: <class>` | Group elements for shared styling |
| `transition.ready` | Promise: pseudo-elements created |
| `transition.updateCallbackDone` | Promise: DOM update complete |
| `transition.finished` | Promise: animation complete |
| `transition.skipTransition()` | Skip to final state immediately |

### Essential Pseudo-Elements

| Pseudo-Element | Target |
|----------------|--------|
| `::view-transition` | Root overlay |
| `::view-transition-group(name)` | Container for named element |
| `::view-transition-old(name)` | Old state snapshot |
| `::view-transition-new(name)` | New state (live) |

### Essential Events (MPA)

| Event | When | Use For |
|-------|------|---------|
| `pageswap` | Before final frame on old page | Set names on source elements |
| `pagereveal` | After DOM initialized on new page | Set names on destination elements |

---

## Accessibility Checklist

- [ ] Feature detection prevents errors in unsupported browsers
- [ ] prefers-reduced-motion respected via CSS media query
- [ ] prefers-reduced-motion checked in JavaScript before starting transitions
- [ ] Animations kept under 300ms to avoid vestibular issues
- [ ] User can still interact after transition (no infinite animations)
- [ ] Content remains accessible during and after transition
- [ ] Decorative transitions can be disabled without losing functionality
