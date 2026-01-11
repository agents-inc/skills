# Accessibility Reference

> Decision frameworks, anti-patterns, and red flags for the Accessibility skill. For core patterns, see [SKILL.md](SKILL.md). For code examples, see [examples.md](examples.md).

---

<decision_framework>

## Decision Framework

### When to Use aria-label

```
Is there visible text that describes the element?
|-- YES --> aria-label not needed (visible text is the accessible name)
|-- NO --> Is it an icon-only button?
    |-- YES --> Use BOTH title AND aria-label with translated text
    |-- NO --> Is element purpose unclear from context?
        |-- YES --> Add aria-label with translated text
        |-- NO --> No aria-label needed
```

### When to Use role="alert" vs aria-live

```
Is this a critical error that requires immediate attention?
|-- YES --> Use role="alert" (or aria-live="assertive")
|-- NO --> Is this a status update (saved, loading, etc.)?
    |-- YES --> Use aria-live="polite"
    |-- NO --> Is content dynamically changing?
        |-- YES --> Consider aria-live="polite"
        |-- NO --> No live region needed
```

### When to Use Semantic HTML vs ARIA

```
Does a native HTML element exist for this purpose?
|-- YES (button, nav, main, header, etc.) --> Use semantic HTML
|-- NO --> Is this a custom widget (tabs, combobox, tree)?
    |-- YES --> Use appropriate ARIA roles and attributes
    |-- NO --> Standard div/span is fine
```

### Focus Management Decision

```
Is this a modal or dialog?
|-- YES --> Trap focus, return focus on close
|-- NO --> Is this showing/hiding content?
    |-- YES --> Consider moving focus to new content
    |-- NO --> Is this a form with errors?
        |-- YES --> Move focus to first error field
        |-- NO --> Let browser handle focus naturally
```

</decision_framework>

---

<anti_patterns>

## Anti-Patterns

Avoid these common accessibility mistakes. Each shows the pattern to avoid and the correct alternative.

### Hardcoded Accessibility Labels

Hardcoding text in aria-labels breaks internationalization and excludes non-English screen reader users.

```typescript
// ❌ Avoid - Hardcoded strings
<button aria-label="Delete item">
  <TrashIcon />
</button>

// ✅ Correct - Use translations
const { t } = useTranslation();
<button aria-label={t("actions.deleteItem")}>
  <TrashIcon />
</button>
```

---

### Div-Based Interactive Elements

Using divs with click handlers instead of semantic elements removes built-in accessibility.

```typescript
// ❌ Avoid - Clickable div
<div onClick={handleSubmit} className="button-style">
  Submit
</div>

// ✅ Correct - Use button element
<button onClick={handleSubmit}>
  Submit
</button>
```

**Why it matters:** Native buttons handle Enter/Space keys, focus management, and form submission automatically.

---

### Missing Icon Button Labels

Icon-only buttons without accessible names are announced as just "button" to screen readers.

```typescript
// ❌ Avoid - Unlabeled icon button
<button onClick={onClose}>
  <CloseIcon />
</button>

// ✅ Correct - Add both title and aria-label
const closeLabel = t("common.close");
<button title={closeLabel} aria-label={closeLabel} onClick={onClose}>
  <CloseIcon />
</button>
```

---

### Closed Props Types

Props that don't extend HTML attributes block aria-* prop passthrough.

```typescript
// ❌ Avoid - Closed props
type ButtonProps = {
  label: string;
  onClick: () => void;
};

// ✅ Correct - Extend HTML attributes
type ButtonProps = {
  label: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;
```

---

### Silent Dynamic Errors

Dynamic error messages that appear without live regions go unnoticed by screen reader users.

```typescript
// ❌ Avoid - Silent error
{error && <span className="error">{error}</span>}

// ✅ Correct - Announce with role="alert"
{error && <span role="alert" className="error">{error}</span>}
```

---

### Unmanaged Modal Focus

Modals that open without moving focus leave keyboard users stranded on hidden content.

```typescript
// ❌ Avoid - Focus not managed
const Modal = ({ isOpen, children }) => {
  if (!isOpen) return null;
  return <div className="modal">{children}</div>;
};

// ✅ Correct - Move focus on open, return on close
const Modal = ({ isOpen, children, onClose }) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      closeButtonRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;
  return (
    <div className="modal" role="dialog" aria-modal="true">
      <button ref={closeButtonRef} onClick={onClose}>Close</button>
      {children}
    </div>
  );
};
```

---

### Redundant ARIA on Semantic Elements

Adding ARIA roles to elements that already have those semantics is unnecessary and can cause issues.

```typescript
// ❌ Avoid - Redundant role
<button role="button">Submit</button>
<nav role="navigation">...</nav>

// ✅ Correct - Let semantics work
<button>Submit</button>
<nav>...</nav>
```

---

### Using tabIndex on Non-Interactive Elements

Adding tabIndex to non-interactive elements creates confusing tab order.

```typescript
// ❌ Avoid - tabIndex on static content
<div tabIndex={0}>
  <p>Some informational text</p>
</div>

// ✅ Correct - Only interactive elements in tab order
<div>
  <p>Some informational text</p>
  <button>Take action</button>
</div>
```

</anti_patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ Hardcoded aria-label text without translation - use `useTranslation()` for international users
- ❌ Icon-only buttons without accessible name - add `title` AND `aria-label`
- ❌ Using `<div>` with onClick instead of `<button>` - use semantic interactive elements
- ❌ Dynamic errors without `role="alert"` - screen reader users miss error appearance
- ❌ Modal opens without moving focus - keyboard users left on hidden content

**Medium Priority Issues:**

- Missing `aria-expanded` on expandable elements (accordions, dropdowns)
- Missing `aria-current="page"` on active navigation links
- Using `aria-live="assertive"` for non-critical updates (too intrusive)
- Missing `aria-describedby` for complex form fields with help text
- Focus not returned to trigger element when modal closes

**Common Mistakes:**

- Adding `aria-label` when visible text already provides accessible name (redundant)
- Using `role="button"` on a `<button>` element (already implicit)
- Forgetting to extend HTML attributes, blocking aria-* prop passthrough
- Using lucide-react instead of @photoroom/icons for icon buttons
- Using `tabIndex` on non-interactive elements (creates confusing tab order)

**Gotchas & Edge Cases:**

- **aria-label overrides visible text**: If you add aria-label to a button with text, screen reader only announces aria-label, not the visible text
- **role="alert" announces immediately**: Content is announced even on first render - may not be desired for static error messages
- **aria-hidden="true" hides from all assistive tech**: Use sparingly, only for decorative content
- **focus-visible vs focus**: Use `focus-visible:` for keyboard focus styles, `focus:` includes mouse clicks
- **aria-live regions must exist before content changes**: Adding aria-live and content simultaneously may not announce

</red_flags>

---

<integration>

## Integration Guide

**Works with:**

- **useTranslation**: ALL accessibility labels must use translation keys
- **@photoroom/icons**: Icon buttons require title + aria-label
- **@photoroom/ui**: Dialog component handles some focus management
- **clsx**: Combine focus-visible styles with other classes
- **React Patterns**: Extend HTMLAttributes for aria-* passthrough

**Translation Keys for Accessibility:**

```typescript
// Common accessibility translation keys
t("common.close")          // Close button aria-label
t("common.save")           // Save button aria-label
t("common.loading")        // Loading state text
t("navigation.main")       // Main navigation aria-label
t("modal.title")           // Modal title for aria-labelledby
```

**Focus Styles with Tailwind:**

```typescript
// Visible focus indicator
<button className="focus-visible:ring-2 focus-visible:ring-blue-500">
  {t("common.action")}
</button>
```

</integration>

---

## Accessible Names Priority

**Priority order (first found wins):**

1. `aria-labelledby` - Reference to another element
2. `aria-label` - Direct string label
3. Element content (button text, link text)
4. `title` attribute (last resort, not well supported)

**Rules:**
- Icon-only buttons MUST have `aria-label`
- Form inputs MUST have associated `<label>` or `aria-label`
- Images MUST have descriptive `alt` text (empty `alt=""` for decorative images)
