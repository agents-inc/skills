# File Upload — Accessibility Examples

> The parts of an upload a screen reader cannot infer. Decisions are in [SKILL.md](../SKILL.md); the
> dropzone and file list in [core.md](core.md) already carry their roles, labels and key handling.

An upload has three moments that happen without a visible page change — a file is chosen, progress
advances, an upload fails — and all three need announcing.

---

## Pattern 25: Labelled file input with hint and error

`useId` ties the label, the hint and the error message together. `aria-describedby` carries both,
and `aria-invalid` is what makes the error more than red text.

```typescript
// accessible-file-input.tsx
import { useId, useImperativeHandle, useRef } from 'react';
import type { ChangeEvent, KeyboardEvent, Ref } from 'react';

export interface AccessibleFileInputHandle {
  focus: () => void;
  click: () => void;
}

interface AccessibleFileInputProps {
  label: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  hint?: string;
  onFilesSelected: (files: File[]) => void;
  className?: string;
  ref?: Ref<AccessibleFileInputHandle>;
}

export function AccessibleFileInput({
  label,
  accept,
  multiple = false,
  disabled = false,
  required = false,
  error,
  hint,
  onFilesSelected,
  className,
  ref,
}: AccessibleFileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    click: () => inputRef.current?.click(),
  }));

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) onFilesSelected(Array.from(files));
    event.target.value = '';
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className={className}>
      <label htmlFor={id}>
        {label}
        {/* the asterisk is decorative; aria-required carries the meaning */}
        {required && <span aria-hidden="true"> *</span>}
      </label>

      {hint && <p id={hintId}>{hint}</p>}

      <div
        data-disabled={disabled || undefined}
        data-error={error ? true : undefined}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onClick={() => inputRef.current?.click()}
        aria-label={`${label}. ${multiple ? 'Multiple files allowed.' : ''} Press Enter or Space to browse.`}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleChange}
          hidden
          tabIndex={-1}
        />
        <span>Choose {multiple ? 'files' : 'file'}</span>
      </div>

      {error && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

---

## Pattern 26: Announcer

One live region for the whole flow, created outside React's tree so any component can reach it.
Clearing the text before setting it is what makes an identical message announce twice, and the
debounce keeps a burst of updates from queueing.

```typescript
// use-announcer.ts
import { useCallback, useEffect, useRef } from "react";

type AriaLive = "polite" | "assertive";

const DEFAULT_DEBOUNCE_MS = 100;

const VISUALLY_HIDDEN = `
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

export function useAnnouncer(options: { debounceMs?: number } = {}) {
  const { debounceMs = DEFAULT_DEBOUNCE_MS } = options;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number>();

  useEffect(() => {
    const container = document.createElement("div");
    container.setAttribute("role", "status");
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-atomic", "true");
    container.style.cssText = VISUALLY_HIDDEN;
    document.body.appendChild(container);
    containerRef.current = container;

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      container.remove();
    };
  }, []);

  const announce = useCallback(
    (message: string, priority: AriaLive = "polite") => {
      const container = containerRef.current;
      if (!container) return;

      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

      container.setAttribute("aria-live", priority);
      container.textContent = "";

      timeoutRef.current = window.setTimeout(() => {
        container.textContent = message;
      }, debounceMs);
    },
    [debounceMs],
  );

  return {
    announce,
    announcePolite: useCallback(
      (message: string) => announce(message, "polite"),
      [announce],
    ),
    announceAssertive: useCallback(
      (message: string) => announce(message, "assertive"),
      [announce],
    ),
  };
}
```

What to announce, and at what priority:

```typescript
const { announcePolite, announceAssertive } = useAnnouncer();

// selection: the user just acted, and needs to know what was taken
announcePolite(
  files.length === 1
    ? `File selected: ${files[0].name}`
    : `${files.length} files selected`,
);

// progress: milestones only — announcing every event makes the page unusable
if (percent % 25 === 0) announcePolite(`${fileName}: ${percent}% uploaded`);

// completion, politely; failure, assertively, because it needs an answer
announcePolite(`${fileName} uploaded successfully`);
announceAssertive(`Upload failed for ${fileName}: ${error}`);
```

---

## Pattern 27: Focus after the file dialog

The file dialog takes focus away and does not always give it back. Recording the trigger and
restoring focus in both `change` and `cancel` keeps keyboard users where they were.

```typescript
// use-file-dialog.ts
import { useCallback, useRef } from "react";

interface UseFileDialogOptions {
  accept?: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
}

export function useFileDialog({
  accept,
  multiple = false,
  onFilesSelected,
}: UseFileDialogOptions) {
  const triggerRef = useRef<HTMLElement | null>(null);

  const openDialog = useCallback(
    (triggerElement?: HTMLElement) => {
      triggerRef.current =
        triggerElement ?? (document.activeElement as HTMLElement);

      const input = document.createElement("input");
      input.type = "file";
      if (accept) input.accept = accept;
      input.multiple = multiple;

      input.onchange = () => {
        if (input.files && input.files.length > 0) {
          onFilesSelected(Array.from(input.files));
        }
        triggerRef.current?.focus();
      };

      // fires when the dialog is dismissed without a selection
      input.oncancel = () => triggerRef.current?.focus();

      input.click();
    },
    [accept, multiple, onFilesSelected],
  );

  return { openDialog };
}
```

Pass `e.currentTarget` from the button's own handler rather than relying on `document.activeElement`
— a pointer click may leave the button unfocused.

---

## Review checklist

Beyond what [core.md](core.md)'s components already do:

- [ ] Every status is conveyed by text or shape, never by colour alone
- [ ] A visible focus indicator survives whatever styling is applied
- [ ] Removal buttons name their file: "Remove report.pdf", not "Remove"
- [ ] Progress announcements are throttled to milestones
- [ ] Failures are `assertive`; everything else is `polite`
- [ ] A file that disappears from the list after uploading says so before it goes
