# Accessibility Code Examples

> All code examples for the Accessibility skill. For core patterns and concepts, see [SKILL.md](SKILL.md). For decision frameworks and anti-patterns, see [reference.md](reference.md).

---

## Translated Accessibility Labels

All accessibility labels must use translation keys via `useTranslation()`.

### Example: Translated aria-label

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

## Icon Button Accessibility

Icon-only buttons require BOTH `title` (tooltip) AND `aria-label` (screen reader).

### Example: Icon Button with title and aria-label

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

### Example: Button with Visible Text (No aria-label needed)

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

## Semantic HTML Elements

Use appropriate semantic HTML before reaching for ARIA roles.

### Example: Semantic Page Layout

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

### Example: Semantic Interactive Elements

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

## Error Announcements with ARIA Live

Use `role="alert"` or `aria-live` for dynamic error messages that screen readers should announce.

### Example: Error Alert Pattern

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

### Example: Status Updates with aria-live

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

## Focus Management for Modals

Modals and dialogs require proper focus management for accessibility.

### Example: Modal with Focus Management

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

### Example: Escape Key Handling

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

## Props Extending HTML Attributes

Always extend HTML attributes to allow aria-* props to pass through.

### Example: Props Extension Pattern

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

### Example: Consumer Usage

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

## Loading State Communication

Communicate loading states to screen reader users.

### Example: Loading with aria-busy

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

### Example: Button Loading State

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

## Keyboard Navigation for Custom Components

Ensure custom interactive components are keyboard accessible.

### Example: Custom Dropdown Keyboard Handling

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
