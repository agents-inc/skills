# Accessibility — Core Examples

> Skip links, landmarks, semantic structure and button versus link. See [SKILL.md](../SKILL.md) for the decisions.

---

## Pattern 1: Skip link

```typescript
export function SkipLink({ className }: { className?: string }) {
  return (
    <a href="#main-content" className={className}>
      Skip to main content
    </a>
  );
}
```

```css
.skip-link {
  position: absolute;
  top: -100px;
  left: 0;
  z-index: 9999;
  padding: 1rem;
  background: var(--color-surface);
  color: var(--color-text);
}

.skip-link:focus {
  top: 0;
}
```

```typescript
function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink className="skip-link" />
      <Header />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </>
  );
}
```

**Why good:** it is the first thing Tab reaches and invisible until it is, so it costs sighted mouse
users nothing. `tabIndex={-1}` on `<main>` is what lets focus land there — a fragment link alone
scrolls the viewport and leaves focus at the top, so the next Tab returns to the navigation the
reader just skipped.

Moving it off-screen with `top: -100px` rather than `display: none` matters: a hidden element is not
focusable at all, so the link would never appear.

Complex layouts can carry more than one — "skip to main content", "skip to search" — in the order
someone would want them.

---

## Pattern 2: Landmarks

```html
<body>
  <header><!-- banner --></header>
  <nav aria-label="Main"><!-- navigation --></nav>
  <main>
    <!-- main -->
    <section aria-labelledby="features-heading">
      <h2 id="features-heading">Features</h2>
    </section>
  </main>
  <aside aria-label="Related articles"><!-- complementary --></aside>
  <footer><!-- contentinfo --></footer>
</body>
```

**Why good:** each element carries its landmark role implicitly, so no `role` attribute is needed;
screen readers offer a list of these regions as the primary way to move around a page.

```html
<nav aria-label="Main">…</nav>
<nav aria-label="Footer">…</nav>
```

**Why good:** two unlabelled `<nav>` elements are announced identically, so the label is what makes
the list of landmarks usable.

A `<section>` only counts as a region when it has an accessible name — hence
`aria-labelledby` pointing at its own heading, which reuses text already on the page rather than
duplicating it in an `aria-label`.

---

## Pattern 3: Button versus link

```typescript
// Acts on the page
<button onClick={handleSubmit}>Submit form</button>

// Goes somewhere
<a href="/dashboard">Go to dashboard</a>
```

```typescript
// Bad — a button that navigates
<button onClick={() => navigate("/dashboard")}>Go to dashboard</button>
```

**Why bad:** no URL in the status bar, no middle-click, no "open in new tab", and it is announced as
a button when it behaves as a link.

```typescript
// Bad — a div that acts
<div onClick={handleSubmit}>Submit form</div>
```

**Why bad:** Tab passes it by, Enter and Space do nothing, and a screen reader announces the text
with no indication that it does anything at all. The `role`, `tabIndex` and key handlers needed to
fix it are the behaviour `<button>` already had.

---

## Semantic structure

```typescript
interface FeatureProps {
  id: string;
  title: string;
  description: string;
  isComplete: boolean;
}

export function Feature({ id, title, description, isComplete }: FeatureProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsId = `${id}-details`;

  return (
    <li>
      <h3>{title}</h3>
      <input type="checkbox" role="switch" id={`${id}-switch`} checked={isComplete} readOnly />
      <label htmlFor={`${id}-switch`}>Complete</label>

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={detailsId}
      >
        <span aria-hidden="true">{isExpanded ? "−" : "+"}</span>
        <span className="sr-only">{isExpanded ? "Collapse" : "Expand"} details</span>
      </button>

      {isExpanded && <p id={detailsId}>{description}</p>}
    </li>
  );
}
```

**Why good:** the `<li>` is what makes a screen reader announce "list, 5 items" and offer list
navigation — a `<div>` in a `<ul>` breaks both. `aria-expanded` announces the disclosure's state and
`aria-controls` names what it controls, which is the pair a toggle owes; the visible `+` is hidden
from assistive technology because the adjacent text already says what the button does.

```typescript
// Usage
<ul>
  {features.map((feature) => (
    <Feature key={feature.id} {...feature} />
  ))}
</ul>
```

---

## Headings

Headings are the outline, not the type scale. Level follows structure and CSS handles size.

```html
<h1>Page title</h1>
<h2>Section</h2>
<h3>Subsection</h3>
<h2>Another section</h2>
```

**Why good:** screen reader users navigate by heading level, so skipping from `<h2>` to `<h4>` reads
as a missing section rather than as a smaller font. One `<h1>` per page, and never a heading chosen
for how large it renders.
