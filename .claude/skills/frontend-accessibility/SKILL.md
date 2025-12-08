# Accessibility Patterns - Photoroom Webapp

> **Quick Guide:** All interactive elements need accessible names. Use `useTranslation()` for ALL accessibility labels. Icon buttons require `title` + `aria-label`. Error states use `role="alert"`. Focus management required for modals/dialogs. Extend HTML attributes to preserve `aria-*` prop passthrough.

---

<critical_requirements>

## ⚠️ CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (PascalCase components, named exports, import ordering, `import type`, named constants)

**(You MUST use `useTranslation()` for ALL accessibility labels - translate every aria-label, title, and accessible name)**

**(You MUST add `title` AND `aria-label` to icon-only buttons for both tooltip and screen reader support)**

**(You MUST extend HTML attributes on components to preserve `aria-*` prop passthrough)**

**(You MUST use `role="alert"` or `aria-live` for dynamic error messages and status updates)**

**(You MUST manage focus when opening/closing modals and dialogs)**

</critical_requirements>

---

**Auto-detection:** accessibility, a11y, aria-label, aria-live, role="alert", screen reader, keyboard navigation, focus management, title attribute, icon button, semantic HTML

**When to use:**

- Adding accessible names to interactive elements
- Creating icon-only buttons with proper labels
- Implementing error announcements for screen readers
- Managing focus in modals and dialogs
- Building keyboard-navigable components
- Adding loading state communication

**Key patterns covered:**

- Translated accessibility labels via useTranslation
- Icon button accessibility (title + aria-label)
- Semantic HTML elements
- Error announcements (role="alert", aria-live)
- Focus management for modals/dialogs
- Keyboard navigation patterns
- Props extending HTML attributes for aria-* passthrough

**When NOT to use:**

- Refer to React skill for component structure
- Refer to Styling skill for visual focus states
- Refer to i18n patterns for translation setup

---

<philosophy>

## Philosophy

Accessibility in the Photoroom webapp ensures all users, including those using screen readers or keyboard navigation, can use the application effectively. All user-facing text, including accessibility labels, must be translated using `useTranslation()`.

**Core Principles:**

- **Translated labels:** All `aria-label`, `title`, and accessible names use translation keys
- **Semantic HTML:** Use appropriate HTML elements (`<button>`, `<nav>`, `<main>`) before ARIA
- **Keyboard accessible:** All interactive elements reachable and operable via keyboard
- **Screen reader friendly:** Dynamic content announces appropriately with ARIA live regions
- **Focus management:** Modal/dialog focus trapped and returned appropriately

**When to use ARIA:**

- Adding accessible names when visible text is insufficient (icon buttons)
- Creating live regions for dynamic content updates
- Describing relationships between elements
- Indicating expanded/collapsed states

**When to avoid ARIA:**

- When semantic HTML already provides the accessibility (use `<button>` instead of `<div role="button">`)
- When visible text already serves as the accessible name
- When duplicating information already conveyed by the element

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Translated Accessibility Labels

All accessibility labels must use translation keys via `useTranslation()`.

#### Implementation

```typescript
// ✅ Good Example - Translated aria-label
import { useTranslation } from "react-i18next";

import { observer } from "mobx-react-lite";

export const CloseButton = observer(() => {
  const { t } = useTranslation();

  return (
    <button
      aria-label={t("common.close")}
      onClick={onClose}
    >
      <CloseIcon className="h-4 w-4" />
    </button>
  );
});

CloseButton.displayName = "CloseButton";
```

**Why good:** Accessibility label will be translated for international users, follows i18next pattern, screen readers announce in user's language

```typescript
// ❌ Bad Example - Hardcoded accessibility label
export const CloseButton = () => {
  return (
    <button aria-label="Close">
      <CloseIcon className="h-4 w-4" />
    </button>
  );
};
```

**Why bad:** Hardcoded label won't be translated, screen reader users in other languages get English text, ESLint `i18next/no-literal-string` will warn

---

### Pattern 2: Icon Button Accessibility

Icon-only buttons require BOTH `title` (tooltip) AND `aria-label` (screen reader).

#### Import

```typescript
import { SaveIcon, TrashIcon } from "@photoroom/icons/lib/monochromes";
```

#### Implementation

```typescript
// ✅ Good Example - Icon button with title and aria-label
import { useTranslation } from "react-i18next";

import { SaveIcon } from "@photoroom/icons/lib/monochromes";
import { observer } from "mobx-react-lite";

export const SaveButton = observer(() => {
  const { t } = useTranslation();

  const saveLabel = t("common.save");

  return (
    <button
      title={saveLabel}
      aria-label={saveLabel}
      onClick={handleSave}
    >
      <SaveIcon className="h-4 w-4" />
    </button>
  );
});

SaveButton.displayName = "SaveButton";
```

**Why good:** `title` provides tooltip on hover for sighted users, `aria-label` provides accessible name for screen readers, shared variable ensures consistency between both attributes, uses @photoroom/icons

```typescript
// ❌ Bad Example - Icon button missing accessible name
import { SaveIcon } from "@photoroom/icons/lib/monochromes";

export const SaveButton = () => {
  return (
    <button onClick={handleSave}>
      <SaveIcon className="h-4 w-4" />
    </button>
  );
};
```

**Why bad:** No accessible name means screen reader announces "button" with no context, no tooltip means sighted users may not understand icon meaning

#### Button with Text (No aria-label needed)

```typescript
// ✅ Good Example - Button with visible text
import { useTranslation } from "react-i18next";

import { SaveIcon } from "@photoroom/icons/lib/monochromes";
import { observer } from "mobx-react-lite";

export const SaveButton = observer(() => {
  const { t } = useTranslation();

  return (
    <button onClick={handleSave}>
      <SaveIcon className="h-4 w-4" />
      <span>{t("common.save")}</span>
    </button>
  );
});

SaveButton.displayName = "SaveButton";
```

**Why good:** Visible text serves as accessible name automatically, no need for redundant aria-label, icon is decorative

---

### Pattern 3: Semantic HTML Elements

Use appropriate semantic HTML before reaching for ARIA roles.

#### Semantic Element Usage

```typescript
// ✅ Good Example - Semantic HTML elements
export const PageLayout = ({ children }: PageLayoutProps) => {
  return (
    <>
      <header>
        <nav aria-label={t("navigation.main")}>
          {/* Navigation links */}
        </nav>
      </header>
      <main>
        {children}
      </main>
      <footer>
        {/* Footer content */}
      </footer>
    </>
  );
};
```

**Why good:** Semantic elements provide inherent accessibility, landmarks help screen reader navigation, clear document structure

```typescript
// ❌ Bad Example - Divs with ARIA roles
export const PageLayout = ({ children }: PageLayoutProps) => {
  return (
    <>
      <div role="banner">
        <div role="navigation">
          {/* Navigation links */}
        </div>
      </div>
      <div role="main">
        {children}
      </div>
      <div role="contentinfo">
        {/* Footer content */}
      </div>
    </>
  );
};
```

**Why bad:** ARIA roles on divs when semantic HTML exists is redundant, harder to maintain, misses browser-native behaviors

#### Interactive Elements

```typescript
// ✅ Good Example - Semantic interactive elements
<button onClick={handleAction}>{t("common.submit")}</button>
<a href="/settings">{t("navigation.settings")}</a>
```

**Why good:** Native elements have built-in keyboard handling and focus management

```typescript
// ❌ Bad Example - Divs as interactive elements
<div role="button" tabIndex={0} onClick={handleAction}>
  {t("common.submit")}
</div>
```

**Why bad:** Requires manual keyboard handling (Enter/Space), missing native button behaviors, more code to maintain

---

### Pattern 4: Error Announcements with ARIA Live

Use `role="alert"` or `aria-live` for dynamic error messages that screen readers should announce.

#### Error Alert Pattern

```typescript
// ✅ Good Example - Error with role="alert"
import { useTranslation } from "react-i18next";

import { observer } from "mobx-react-lite";

export type FormErrorProps = {
  message: string | null;
};

export const FormError = observer(({ message }: FormErrorProps) => {
  const { t } = useTranslation();

  if (!message) return null;

  return (
    <div
      role="alert"
      className="text-red-600 text-sm mt-2"
    >
      {message}
    </div>
  );
});

FormError.displayName = "FormError";
```

**Why good:** `role="alert"` causes screen reader to immediately announce content when it appears, error is communicated without user needing to navigate to it

#### Status Updates with aria-live

```typescript
// ✅ Good Example - Non-critical status with aria-live="polite"
import { useTranslation } from "react-i18next";

import { observer } from "mobx-react-lite";

export type SaveStatusProps = {
  isSaving: boolean;
  isSaved: boolean;
};

export const SaveStatus = observer(({ isSaving, isSaved }: SaveStatusProps) => {
  const { t } = useTranslation();

  return (
    <div aria-live="polite" aria-atomic="true">
      {isSaving && t("status.saving")}
      {isSaved && t("status.saved")}
    </div>
  );
});

SaveStatus.displayName = "SaveStatus";
```

**Why good:** `aria-live="polite"` waits for user to finish current task before announcing, `aria-atomic="true"` announces entire region content, non-intrusive status updates

#### aria-live Values

- `aria-live="assertive"`: Interrupt immediately (use sparingly, for critical errors)
- `aria-live="polite"`: Announce when user is idle (preferred for status updates)
- `role="alert"`: Equivalent to `aria-live="assertive"` with `role="alert"`

```typescript
// ❌ Bad Example - Error without live region
export const FormError = ({ message }: FormErrorProps) => {
  if (!message) return null;

  return (
    <div className="text-red-600">
      {message}
    </div>
  );
};
```

**Why bad:** Screen reader users won't know error appeared unless they navigate to it, error could be missed entirely

---

### Pattern 5: Focus Management for Modals

Modals and dialogs require proper focus management for accessibility.

#### Focus Trap Pattern

```typescript
// ✅ Good Example - Modal with focus management
import { useCallback, useEffect, useRef } from "react";

import { useTranslation } from "react-i18next";

import { Dialog } from "@photoroom/ui";
import { observer } from "mobx-react-lite";

export type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmModal = observer(({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  const { t } = useTranslation();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store previous focus and focus confirm button on open
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      confirmButtonRef.current?.focus();
    }
  }, [isOpen]);

  // Return focus on close
  const handleClose = useCallback(() => {
    previousFocusRef.current?.focus();
    onCancel();
  }, [onCancel]);

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <h2 id="modal-title">{title}</h2>
      <p id="modal-description">{message}</p>
      <div>
        <button onClick={handleClose}>
          {t("common.cancel")}
        </button>
        <button
          ref={confirmButtonRef}
          onClick={onConfirm}
        >
          {t("common.confirm")}
        </button>
      </div>
    </Dialog>
  );
});

ConfirmModal.displayName = "ConfirmModal";
```

**Why good:** Focus moves to confirm button on open (primary action), previous focus stored and returned on close, aria-labelledby/describedby connect title and description, uses @photoroom/ui Dialog component

**When useEffect IS appropriate:** Focus management after modal opens is a valid use of useEffect - it's synchronizing with browser focus API, not reacting to MobX state.

#### Keyboard Handling for Modal

```typescript
// ✅ Good Example - Escape key handling
const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
  if (event.key === "Escape") {
    handleClose();
  }
}, [handleClose]);

return (
  <Dialog onKeyDown={handleKeyDown} /* ... */>
    {/* Modal content */}
  </Dialog>
);
```

**Why good:** Standard keyboard pattern for closing modals, Escape key expected by users

---

### Pattern 6: Props Extending HTML Attributes for Accessibility

Always extend HTML attributes to allow aria-* props to pass through.

#### Props Extension Pattern

```typescript
// ✅ Good Example - Props extending HTML attributes
export type CardProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

export const Card = ({
  title,
  children,
  className,
  ...rest
}: CardProps) => {
  return (
    <div className={clsx("rounded-lg p-4 bg-white", className)} {...rest}>
      <h3>{title}</h3>
      {children}
    </div>
  );
};
```

**Why good:** Spread operator passes through all HTML attributes including aria-*, consumers can add aria-label, aria-describedby, role, etc.

#### Consumer Usage

```typescript
// ✅ Good Example - Consumer adding accessibility attributes
<Card
  title={t("card.title")}
  aria-label={t("card.accessibleName")}
  aria-describedby="card-description"
>
  {children}
</Card>
```

**Why good:** Consumer can add any needed accessibility attributes without forking component

```typescript
// ❌ Bad Example - Fixed props without HTML attribute extension
export type CardProps = {
  title: string;
  children: React.ReactNode;
};

export const Card = ({ title, children }: CardProps) => {
  return (
    <div>
      <h3>{title}</h3>
      {children}
    </div>
  );
};
```

**Why bad:** Cannot pass aria-* attributes, blocks accessibility customization, consumers may need to wrap with extra divs

---

### Pattern 7: Loading State Communication

Communicate loading states to screen reader users.

#### Loading with aria-busy

```typescript
// ✅ Good Example - Loading state with aria-busy
import { useTranslation } from "react-i18next";

import { observer } from "mobx-react-lite";

import { stores } from "stores";

export const ContentList = observer(() => {
  const { t } = useTranslation();
  const { contentStore } = stores;

  return (
    <div
      aria-busy={contentStore.isLoading}
      aria-live="polite"
    >
      {contentStore.isLoading ? (
        <span>{t("common.loading")}</span>
      ) : (
        <ul>
          {contentStore.items.map((item) => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
});

ContentList.displayName = "ContentList";
```

**Why good:** `aria-busy` indicates content is updating, `aria-live="polite"` announces when loading completes, translated loading text

#### Button Loading State

```typescript
// ✅ Good Example - Button with loading state
import { useTranslation } from "react-i18next";

import { observer } from "mobx-react-lite";

export type SubmitButtonProps = {
  isLoading: boolean;
  onClick: () => void;
};

export const SubmitButton = observer(({ isLoading, onClick }: SubmitButtonProps) => {
  const { t } = useTranslation();

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      aria-disabled={isLoading}
    >
      {isLoading ? t("common.loading") : t("common.submit")}
    </button>
  );
});

SubmitButton.displayName = "SubmitButton";
```

**Why good:** Button text changes to communicate state visually, disabled prevents interaction, aria-disabled communicates state to assistive technology

---

### Pattern 8: Keyboard Navigation for Custom Components

Ensure custom interactive components are keyboard accessible.

#### Custom Dropdown Keyboard Handling

```typescript
// ✅ Good Example - Keyboard navigable dropdown
import { useCallback, useState } from "react";

import { useTranslation } from "react-i18next";

const FIRST_ITEM_INDEX = 0;

export const Dropdown = observer(({ options, onSelect }: DropdownProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(FIRST_ITEM_INDEX);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, FIRST_ITEM_INDEX));
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (isOpen) {
          onSelect(options[focusedIndex]);
          setIsOpen(false);
        } else {
          setIsOpen(true);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  }, [isOpen, focusedIndex, options, onSelect]);

  return (
    <div
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <button
        aria-label={t("dropdown.toggle")}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedOption?.label ?? t("dropdown.placeholder")}
      </button>
      {isOpen && (
        <ul role="listbox">
          {options.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={index === focusedIndex}
              onClick={() => onSelect(option)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

Dropdown.displayName = "Dropdown";
```

**Why good:** Arrow keys navigate options, Enter/Space select, Escape closes, proper ARIA roles communicate structure, named constant for first index

</patterns>

---

<anti_patterns>

## Anti-Patterns

Avoid these common accessibility mistakes. Each shows the pattern to avoid and the correct alternative.

### ❌ Hardcoded Accessibility Labels

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

### ❌ Div-Based Interactive Elements

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

### ❌ Missing Icon Button Labels

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

### ❌ Closed Props Types

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

### ❌ Silent Dynamic Errors

Dynamic error messages that appear without live regions go unnoticed by screen reader users.

```typescript
// ❌ Avoid - Silent error
{error && <span className="error">{error}</span>}

// ✅ Correct - Announce with role="alert"
{error && <span role="alert" className="error">{error}</span>}
```

### ❌ Unmanaged Modal Focus

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

### ❌ Redundant ARIA on Semantic Elements

Adding ARIA roles to elements that already have those semantics is unnecessary and can cause issues.

```typescript
// ❌ Avoid - Redundant role
<button role="button">Submit</button>
<nav role="navigation">...</nav>

// ✅ Correct - Let semantics work
<button>Submit</button>
<nav>...</nav>
```

### ❌ Using tabIndex on Non-Interactive Elements

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

<red_flags>

## RED FLAGS

**High Priority Issues:**

- ❌ Hardcoded aria-label text without translation - use `useTranslation()` for international users
- ❌ Icon-only buttons without accessible name - add `title` AND `aria-label`
- ❌ Using `<div>` with onClick instead of `<button>` - use semantic interactive elements
- ❌ Dynamic errors without `role="alert"` - screen reader users miss error appearance
- ❌ Modal opens without moving focus - keyboard users left on hidden content

**Medium Priority Issues:**

- ⚠️ Missing `aria-expanded` on expandable elements (accordions, dropdowns)
- ⚠️ Missing `aria-current="page"` on active navigation links
- ⚠️ Using `aria-live="assertive"` for non-critical updates (too intrusive)
- ⚠️ Missing `aria-describedby` for complex form fields with help text
- ⚠️ Focus not returned to trigger element when modal closes

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

<critical_reminders>

## ⚠️ CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST use `useTranslation()` for ALL accessibility labels - translate every aria-label, title, and accessible name)**

**(You MUST add `title` AND `aria-label` to icon-only buttons for both tooltip and screen reader support)**

**(You MUST extend HTML attributes on components to preserve `aria-*` prop passthrough)**

**(You MUST use `role="alert"` or `aria-live` for dynamic error messages and status updates)**

**(You MUST manage focus when opening/closing modals and dialogs)**

**Failure to follow these rules will make the application inaccessible to screen reader users and keyboard-only users.**

</critical_reminders>
