---
name: web-accessibility-web-accessibility
description: WCAG, ARIA, keyboard navigation
---

# Accessibility

> **Quick Guide:** Most of accessibility is settled by choosing the right element: a `<button>` arrives with focus, keyboard activation and a role that a `<div>` needs a dozen lines to fake. What the element cannot give you is the rest — a name for every control, a visible focus indicator, 4.5:1 contrast on text, an announcement when content changes, and information never carried by colour alone. Target WCAG 2.2 Level AA. Automated checks find roughly half the failures, so a keyboard pass is not optional.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — skip links, landmarks, semantic structure, button versus link
- [examples/forms.md](examples/forms.md) — labels, error handling, required fields, the listbox contract
- [examples/focus.md](examples/focus.md) — dialogs, focus trapping and restoration, focus indicators
- [examples/color.md](examples/color.md) — contrast, colour-independent status, link styling
- [examples/tables.md](examples/tables.md) — headers, captions, sortable columns
- [examples/touch-targets.md](examples/touch-targets.md) — target size and spacing
- [examples/screen-reader.md](examples/screen-reader.md) — visually hidden text, decorative content
- [examples/testing.md](examples/testing.md) — automated auditing, role-based queries, the manual pass
- [reference.md](reference.md) — WCAG 2.2 criteria, accessible-name rules, audit rule IDs, screen readers

---

<critical_requirements>

## Before writing UI code

**Reach for the semantic element before the ARIA attribute.** `<button>`, `<a href>`, `<nav>` and `<table>` arrive with a role, keyboard behaviour and focus already correct — every one of which has to be rebuilt by hand on a `<div>`, and the rebuild is where the failures are.

**Make every interactive element reachable and visibly focused.** Keyboard users navigate by what the focus ring tells them, so `outline: none` without a replacement leaves them moving blind through the page.

**Give every control a name a screen reader can announce.** An icon-only button reads as "button" without one, which tells the listener there is something there and nothing about what it does.

**Hold text to 4.5:1 against its background, and UI boundaries and focus indicators to 3:1.** Below that the text is unreadable in bright light, on a cheap panel, or to anyone with reduced contrast sensitivity — which is most people eventually.

**Pair every colour signal with a shape, an icon or a word.** Red-for-error carries nothing to a red-green colour-blind reader, and nothing at all through a screen reader.

**Announce content that appears without a page change.** A validation error, a saved confirmation and a loaded result are all silent unless they arrive in a live region.

</critical_requirements>

---

**Auto-detection:** accessibility, a11y, WCAG, ARIA, aria-label, aria-labelledby, aria-describedby, aria-live, aria-expanded, aria-invalid, role attribute, keyboard navigation, focus management, focus trap, focus-visible, skip link, landmark, screen reader, sr-only, colour contrast, prefers-reduced-motion, tabindex, axe

**Applies to:**

- Keyboard reachability, tab order, focus movement and focus indicators
- ARIA roles, states and properties, and when the element makes them unnecessary
- Contrast ratios and colour-independent information
- Accessible names, live regions and announcement timing
- Target size, motion preferences, and the WCAG 2.2 criteria that added them

**Handled elsewhere:**

- Component internals for complex widgets — a tested primitive library implements the ARIA contract below; this skill states the contract so you can check whichever one you use.
- Visual design tokens — the palette is designed elsewhere, and this skill supplies the ratio it has to clear.
- Test runner mechanics — running an audit is your test tooling's job, and what to assert is here.
- Content authoring — reading level, plain language and caption text are writing decisions rather than markup ones.

---

<philosophy>

## Philosophy

An accessible interface is not a variant of the interface. It is the same one, built out of elements
that already carry meaning, with the parts a browser cannot infer stated explicitly.

That reframes most of the work as subtraction. Semantic HTML is the accessible baseline; every
`<div>` that replaces a real element is a debt paid back in ARIA attributes, key handlers and focus
management, and paid back badly. The attributes below exist for the cases where no element carries
the meaning — not as a layer applied over markup that could have carried it.

Build for the keyboard first. Everything a pointer can do, a keyboard has to do too, and a design
that works without a mouse works with one.

</philosophy>

---

<decision_framework>

## Which mechanism the case needs

```
What is being built?
├─ Something that acts when activated → <button>
│   └─ Icon only → add an accessible name
├─ Something that navigates → <a href>
│   └─ Current destination → aria-current="page"
├─ A structural region → <nav>, <main>, <header>, <aside>, <footer>
│   └─ More than one of a kind → label each with aria-label
├─ A complex widget — dialog, listbox, tabs, combobox, tree
│   └─ Take a tested primitive. The ARIA contract is large,
│      and a partial implementation reads as broken rather than absent.
└─ Content that appears without navigation
    ├─ An error or something urgent → role="alert"
    └─ Progress or confirmation → role="status"
```

**ARIA or not:** the first rule of ARIA is not to use ARIA. `role="button"` on a `<div>` gives a
screen reader the right word and gives the keyboard nothing, so the handlers, `tabindex` and focus
styling are all still owed. Reach for ARIA when no element expresses the thing — a live region, a
disclosure's `aria-expanded`, a sort direction on a column header.

**AA or AAA:** AA is the compliance target and what regulation generally references. Individual AAA
criteria are often cheap — 7:1 contrast, 44×44 targets — and worth taking where the design allows,
without committing the whole product to AAA.

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Skip link

The first focusable element on the page, hidden until it takes focus, jumping past the navigation
every page repeats.

```typescript
<a href="#main-content" className="skip-link">Skip to main content</a>
…
<main id="main-content" tabIndex={-1}>{children}</main>
```

`tabIndex={-1}` on the target is what lets focus actually land there; without it the fragment moves
the viewport and leaves focus at the top of the document.

Full code: [examples/core.md](examples/core.md)

### Pattern 2: Landmarks

Landmark elements are how a screen reader user jumps between regions rather than reading linearly.

```html
<header>…</header>
<nav aria-label="Main">…</nav>
<main>…</main>
<aside aria-label="Related">…</aside>
<footer>…</footer>
```

One `<main>` per page. Where two landmarks share a type, each needs a distinguishing label — two
unlabelled `<nav>`s are announced identically.

Full code: [examples/core.md](examples/core.md)

### Pattern 3: Button versus link

Activation is a button; navigation is a link. The distinction decides the keyboard behaviour, the
announcement, and whether the browser's own affordances work.

```typescript
<button onClick={handleSubmit}>Submit form</button>
<a href="/dashboard">Go to dashboard</a>
```

A `<button>` that navigates costs the reader "open in new tab", the status-bar URL and the middle
click. A `<div onClick>` costs them the whole interaction.

Full code: [examples/core.md](examples/core.md)

### Pattern 4: Accessible names

Every control needs a name, and the icon-only case is where it goes missing.

```typescript
<button aria-label="Delete item">
  <TrashIcon aria-hidden="true" />
</button>

<button>
  <TrashIcon aria-hidden="true" />
  <span className="sr-only">Delete item</span>
</button>
```

Both announce "Delete item, button". The second survives translation tooling and shows up in a
text search of the DOM, so prefer it where either matters.

Resolution order is in [reference.md](reference.md); full code in
[examples/screen-reader.md](examples/screen-reader.md).

### Pattern 5: Form fields and errors

A label associated with the input, the invalid state on the input, and the message reachable from it.

```typescript
<label htmlFor="email">Email</label>
<input
  id="email"
  type="email"
  aria-required="true"
  aria-invalid={Boolean(error)}
  aria-describedby={error ? "email-error" : undefined}
/>
{error && <span id="email-error" role="alert">{error}</span>}
```

A placeholder is not a label: it disappears the moment typing starts, and it fails contrast in most
designs.

Full code: [examples/forms.md](examples/forms.md)

### Pattern 6: Focus indicators

`:focus-visible` shows the ring for keyboard interaction and withholds it from a mouse click, which
removes the reason people delete focus styles in the first place.

```css
.button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

At least 2px, and at least 3:1 against whatever sits behind it.

Full code: [examples/focus.md](examples/focus.md)

### Pattern 7: Dialogs and focus movement

The contract a modal owes, whoever implements it: focus moves in on open, cannot leave while it is
open, Escape closes it, and focus returns to the element that opened it.

```typescript
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">{title}</h2>
  …
</div>
```

Focus returning to the trigger is the half most often missed — without it a keyboard user is dropped
back at the top of the document with no idea where they were.

Full code: [examples/focus.md](examples/focus.md)

### Pattern 8: Live regions

Content that arrives without a navigation is silent unless a live region announces it.

```typescript
<div role="status">{savedMessage}</div>
<div role="alert">{errorMessage}</div>
```

`role="status"` waits for a pause; `role="alert"` interrupts. The region must be in the DOM before
the message arrives — inserting the region and its content together often announces nothing.

### Pattern 9: Colour-independent status

Colour is an accent on the signal, never the signal.

```typescript
<span className={statusClass}>
  <span aria-hidden="true">{status === "error" ? "×" : "✓"}</span>
  <span>{status === "error" ? "Failed" : "Complete"}</span>
</span>
```

The icon carries it visually and the text carries it to a screen reader; remove the colour and both
still work.

Full code: [examples/color.md](examples/color.md)

### Pattern 10: Motion preferences

Animate by opting in, so a reader who has asked for less motion gets it by default.

```css
@media (prefers-reduced-motion: no-preference) {
  .card {
    animation: slide-in 300ms ease-out;
  }
}
```

`reduce` means minimise rather than eliminate — a fade in place of a slide keeps the feedback and
drops the vestibular trigger.

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `outline: none` with no replacement — keyboard users lose their position entirely; scope the ring to `:focus-visible` instead of removing it.
- A `<div>` or `<span>` with an `onClick` — not focusable, not activated by Enter or Space, announced as nothing; use a `<button>`.
- `role="button"` on a `<div>` — supplies the word and none of the behaviour, so Tab, Enter and Space are all still owed.
- `aria-hidden="true"` on anything focusable — focus lands on an element the screen reader insists is not there.
- `tabindex` above zero — hoists the element ahead of the whole document order, and one such value disorders the entire page.
- An input with no associated label — announced by its type alone, so a form reads as "edit text, edit text, edit text".

**Surprising behaviour:**

- `alt=""` is the correct value for a decorative image; omitting `alt` entirely makes a screen reader read the filename.
- A live region added to the DOM at the same moment as its message usually announces nothing — render the container first.
- A live region announces only the part that changed, so "3 of 10 results" updating in place can be read as "5" with no context; `aria-atomic="true"` makes it re-read the whole region.
- `role="alert"` interrupts whatever is being read, so a per-keystroke validation message in one is unusable.
- A placeholder is not a label, and disappears exactly when the reader needs it most.
- Disabled buttons are skipped by focus, so a submit button disabled until the form is valid gives no route to the reason.
- A `<label>` wrapping the input and a `for`/`htmlFor` both work; two labels on one input do not, and only one is announced.
- `prefers-reduced-motion: reduce` asks for less, not none — removing essential feedback overshoots.
- Automated audits find roughly half of WCAG failures. Everything about order, wording and whether the announcement made sense needs a person.

</red_flags>
