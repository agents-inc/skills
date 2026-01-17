# Accessibility Examples

> Accessible file upload components with ARIA, keyboard navigation, and screen reader support. Reference from [SKILL.md](../SKILL.md).

---

## Pattern 1: Accessible File Input

### Keyboard-Navigable File Input with Proper Labels

```typescript
// accessible-file-input.tsx
import { useId, useRef, forwardRef, useImperativeHandle } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import styles from './accessible-file-input.module.scss';

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
}

export interface AccessibleFileInputHandle {
  focus: () => void;
  click: () => void;
}

export const AccessibleFileInput = forwardRef<
  AccessibleFileInputHandle,
  AccessibleFileInputProps
>(function AccessibleFileInput(
  {
    label,
    accept,
    multiple = false,
    disabled = false,
    required = false,
    error,
    hint,
    onFilesSelected,
    className,
  },
  ref
) {
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
    if (files && files.length > 0) {
      onFilesSelected(Array.from(files));
    }
    // Reset to allow selecting same file
    event.target.value = '';
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>

      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}

      <div
        className={styles.inputWrapper}
        data-disabled={disabled || undefined}
        data-error={error ? true : undefined}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onClick={() => inputRef.current?.click()}
        aria-label={`${label}. ${multiple ? 'Multiple files allowed.' : ''} Press Enter or Space to browse.`}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          required={required}
          onChange={handleChange}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={styles.hiddenInput}
          tabIndex={-1}
        />
        <span className={styles.buttonText}>
          Choose {multiple ? 'files' : 'file'}
        </span>
      </div>

      {error && (
        <p id={errorId} className={styles.error} role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
});
```

```scss
// accessible-file-input.module.scss
.label {
  display: block;
  font-weight: 500;
  margin-bottom: var(--spacing-xs);
}

.hint {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-xs);
}

.inputWrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:hover:not([data-disabled]) {
    border-color: var(--color-primary);
  }

  &:focus-visible {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-alpha);
  }

  &[data-disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &[data-error] {
    border-color: var(--color-error);
  }
}

.hiddenInput {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.buttonText {
  font-weight: 500;
}

.error {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  margin-top: var(--spacing-xs);
}
```

**Why good:** Proper label association, keyboard activation with Enter/Space, focus-visible styling, aria-describedby for hints/errors, role="alert" for error announcements, ref forwarding for external control

---

## Pattern 2: Accessible Dropzone

### Dropzone with Live Region Announcements

```typescript
// accessible-dropzone.tsx
import { useState, useRef, useCallback, useId } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import styles from './accessible-dropzone.module.scss';

interface AccessibleDropzoneProps {
  label: string;
  description?: string;
  accept?: string[];
  multiple?: boolean;
  disabled?: boolean;
  maxFiles?: number;
  onFilesSelected: (files: File[]) => void;
  children?: React.ReactNode;
}

type DropzoneState = 'idle' | 'drag-over' | 'drag-reject';

const DEFAULT_MAX_FILES = 10;

export function AccessibleDropzone({
  label,
  description,
  accept = [],
  multiple = true,
  disabled = false,
  maxFiles = DEFAULT_MAX_FILES,
  onFilesSelected,
  children,
}: AccessibleDropzoneProps) {
  const [state, setState] = useState<DropzoneState>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const descriptionId = `${id}-description`;
  const announceRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string) => {
    if (announceRef.current) {
      announceRef.current.textContent = message;
    }
  }, []);

  const isValidType = useCallback(
    (file: File): boolean => {
      if (accept.length === 0) return true;
      return accept.some((type) => {
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type.toLowerCase());
        }
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.replace('/*', '/'));
        }
        return file.type === type;
      });
    },
    [accept]
  );

  const handleFiles = useCallback(
    (files: File[]) => {
      const validFiles = files.filter(isValidType);
      const filesToProcess = multiple
        ? validFiles.slice(0, maxFiles)
        : validFiles.slice(0, 1);

      if (filesToProcess.length > 0) {
        onFilesSelected(filesToProcess);
        announce(
          `${filesToProcess.length} ${filesToProcess.length === 1 ? 'file' : 'files'} selected: ${filesToProcess.map((f) => f.name).join(', ')}`
        );
      } else if (files.length > 0) {
        announce('No valid files selected. Please check file type requirements.');
      }
    },
    [isValidType, multiple, maxFiles, onFilesSelected, announce]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setState('idle');

      if (disabled) return;

      const files = Array.from(event.dataTransfer.files);
      handleFiles(files);
    },
    [disabled, handleFiles]
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!disabled) {
        setState('drag-over');
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setState('idle');
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        inputRef.current?.click();
      }
    },
    [disabled]
  );

  const acceptString = accept.join(',');
  const acceptDescription =
    accept.length > 0
      ? `Accepted file types: ${accept.join(', ')}`
      : 'All file types accepted';

  return (
    <>
      {/* Live region for announcements */}
      <div
        ref={announceRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={styles.srOnly}
      />

      <div
        className={styles.dropzone}
        data-state={state}
        data-disabled={disabled || undefined}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        aria-label={`${label}. ${acceptDescription}. ${multiple ? `Up to ${maxFiles} files allowed.` : 'Single file only.'} Click or press Enter to browse files, or drag and drop files here.`}
        aria-describedby={description ? descriptionId : undefined}
        aria-disabled={disabled}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptString}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files) {
              handleFiles(Array.from(e.target.files));
              e.target.value = '';
            }
          }}
          className={styles.hiddenInput}
          tabIndex={-1}
          aria-hidden="true"
        />

        {children ?? (
          <div className={styles.content}>
            <p className={styles.label}>{label}</p>
            {description && (
              <p id={descriptionId} className={styles.description}>
                {description}
              </p>
            )}
            <p className={styles.hint}>Drag and drop or click to browse</p>
          </div>
        )}
      </div>
    </>
  );
}
```

```scss
// accessible-dropzone.module.scss
.srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: var(--spacing-xl);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;

  &:hover:not([data-disabled]) {
    border-color: var(--color-primary);
    background: var(--color-primary-alpha);
  }

  &:focus-visible {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-alpha);
  }

  &[data-state='drag-over'] {
    border-color: var(--color-primary);
    background: var(--color-primary-alpha);
  }

  &[data-disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.hiddenInput {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}

.content {
  text-align: center;
}

.label {
  font-weight: 600;
  font-size: var(--font-size-lg);
  margin-bottom: var(--spacing-xs);
}

.description {
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-sm);
}

.hint {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}
```

**Why good:** Live region announces file selections to screen readers, keyboard navigation with Enter/Space, descriptive aria-label includes file constraints, visual and ARIA disabled states, click alternative to drag-drop

---

## Pattern 3: Accessible File List

### File List with Progress Announcements

```typescript
// accessible-file-list.tsx
import { useId } from 'react';
import styles from './accessible-file-list.module.scss';

interface FileItem {
  id: string;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
}

interface AccessibleFileListProps {
  files: FileItem[];
  onRemove: (id: string) => void;
  label?: string;
}

const BYTES_IN_KB = 1024;
const BYTES_IN_MB = 1024 * 1024;

export function AccessibleFileList({
  files,
  onRemove,
  label = 'Selected files',
}: AccessibleFileListProps) {
  const listId = useId();

  if (files.length === 0) {
    return null;
  }

  const formatSize = (bytes: number): string => {
    if (bytes < BYTES_IN_KB) return `${bytes} bytes`;
    if (bytes < BYTES_IN_MB) return `${(bytes / BYTES_IN_KB).toFixed(1)} KB`;
    return `${(bytes / BYTES_IN_MB).toFixed(1)} MB`;
  };

  const getStatusLabel = (file: FileItem): string => {
    switch (file.status) {
      case 'pending':
        return 'Waiting to upload';
      case 'uploading':
        return `Uploading: ${file.progress ?? 0}% complete`;
      case 'success':
        return 'Upload complete';
      case 'error':
        return `Upload failed: ${file.error ?? 'Unknown error'}`;
    }
  };

  return (
    <div className={styles.container}>
      <h3 id={listId} className={styles.heading}>
        {label} ({files.length})
      </h3>

      <ul className={styles.list} aria-labelledby={listId} role="list">
        {files.map((file) => (
          <li key={file.id} className={styles.item} data-status={file.status}>
            <div className={styles.info}>
              <span className={styles.name}>{file.name}</span>
              <span className={styles.size}>{formatSize(file.size)}</span>
            </div>

            <div className={styles.status} role="status" aria-live="polite">
              {file.status === 'uploading' && file.progress !== undefined && (
                <div
                  className={styles.progressBar}
                  role="progressbar"
                  aria-valuenow={file.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${file.name} upload progress`}
                >
                  <div
                    className={styles.progressFill}
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              )}
              <span className={styles.statusText}>{getStatusLabel(file)}</span>
            </div>

            <button
              type="button"
              className={styles.removeButton}
              onClick={() => onRemove(file.id)}
              aria-label={`Remove ${file.name} from upload list`}
              disabled={file.status === 'uploading'}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

```scss
// accessible-file-list.module.scss
.container {
  margin-top: var(--spacing-md);
}

.heading {
  font-size: var(--font-size-md);
  font-weight: 600;
  margin-bottom: var(--spacing-sm);
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-xs);

  &[data-status='success'] {
    border-color: var(--color-success);
    background: var(--color-success-alpha);
  }

  &[data-status='error'] {
    border-color: var(--color-error);
    background: var(--color-error-alpha);
  }
}

.info {
  flex: 1;
  min-width: 0;
}

.name {
  display: block;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.size {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.status {
  flex-shrink: 0;
  min-width: 120px;
}

.progressBar {
  height: 8px;
  background: var(--color-surface-alt);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: var(--spacing-xs);
}

.progressFill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.2s ease-out;
}

.statusText {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.removeButton {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: var(--font-size-lg);
  transition: background-color 0.15s, color 0.15s;

  &:hover:not(:disabled) {
    background: var(--color-error-alpha);
    color: var(--color-error);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
```

**Why good:** role="progressbar" with aria-valuenow/min/max, role="status" with aria-live for progress updates, descriptive aria-label on remove buttons, disabled state during upload prevents accidental removal

---

## Pattern 4: Screen Reader Announcer Hook

### Centralized Announcements for Complex Interactions

```typescript
// use-announcer.ts
import { useCallback, useRef, useEffect } from 'react';

type AriaLive = 'polite' | 'assertive' | 'off';

interface UseAnnouncerOptions {
  debounceMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 100;

export function useAnnouncer(options: UseAnnouncerOptions = {}) {
  const { debounceMs = DEFAULT_DEBOUNCE_MS } = options;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number>();

  // Create announcement container on mount
  useEffect(() => {
    const container = document.createElement('div');
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    container.style.cssText = `
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
    document.body.appendChild(container);
    containerRef.current = container;

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      container.remove();
    };
  }, []);

  const announce = useCallback(
    (message: string, priority: AriaLive = 'polite') => {
      const container = containerRef.current;
      if (!container) return;

      // Clear any pending announcement
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      // Update priority if needed
      container.setAttribute('aria-live', priority);

      // Clear then set (ensures announcement even if same text)
      container.textContent = '';

      timeoutRef.current = window.setTimeout(() => {
        container.textContent = message;
      }, debounceMs);
    },
    [debounceMs]
  );

  const announcePolite = useCallback(
    (message: string) => announce(message, 'polite'),
    [announce]
  );

  const announceAssertive = useCallback(
    (message: string) => announce(message, 'assertive'),
    [announce]
  );

  return { announce, announcePolite, announceAssertive };
}
```

### Usage with File Upload

```typescript
// file-uploader-with-announcer.tsx
import { useAnnouncer } from './use-announcer';

export function FileUploaderWithAnnouncer() {
  const { announcePolite, announceAssertive } = useAnnouncer();

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 1) {
      announcePolite(`File selected: ${files[0].name}`);
    } else {
      announcePolite(`${files.length} files selected`);
    }
  };

  const handleUploadStart = (fileName: string) => {
    announcePolite(`Starting upload for ${fileName}`);
  };

  const handleUploadProgress = (fileName: string, percent: number) => {
    // Only announce at milestones to avoid spam
    if (percent % 25 === 0) {
      announcePolite(`${fileName}: ${percent}% uploaded`);
    }
  };

  const handleUploadComplete = (fileName: string) => {
    announcePolite(`${fileName} uploaded successfully`);
  };

  const handleUploadError = (fileName: string, error: string) => {
    // Use assertive for errors - they're important
    announceAssertive(`Upload failed for ${fileName}: ${error}`);
  };

  // ... rest of component
}
```

**Why good:** Centralized announcement management, debounced to prevent screen reader overload, supports priority levels (polite for progress, assertive for errors), cleanup on unmount

---

## Pattern 5: Focus Management

### Return Focus After File Dialog

```typescript
// use-file-dialog.ts
import { useRef, useCallback } from 'react';

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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openDialog = useCallback((triggerElement?: HTMLElement) => {
    // Store the trigger element to return focus later
    triggerRef.current = triggerElement ?? document.activeElement as HTMLElement;

    // Create temporary input
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.multiple = multiple;

    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        onFilesSelected(Array.from(input.files));
      }
      // Return focus to trigger element
      triggerRef.current?.focus();
    };

    // Handle cancel (no files selected)
    input.oncancel = () => {
      triggerRef.current?.focus();
    };

    inputRef.current = input;
    input.click();
  }, [accept, multiple, onFilesSelected]);

  return { openDialog };
}
```

### Usage

```typescript
// upload-button.tsx
import { useFileDialog } from './use-file-dialog';

export function UploadButton({ onFilesSelected }: { onFilesSelected: (files: File[]) => void }) {
  const { openDialog } = useFileDialog({
    accept: 'image/*',
    multiple: true,
    onFilesSelected,
  });

  return (
    <button
      type="button"
      onClick={(e) => openDialog(e.currentTarget)}
      aria-haspopup="dialog"
    >
      Upload Images
    </button>
  );
}
```

**Why good:** Returns focus to trigger element after dialog closes, handles both selection and cancel, aria-haspopup indicates dialog will open

---

## Anti-Pattern Examples

### What NOT to Do

```typescript
// ANTI-PATTERN: No keyboard support
<div onClick={openFileDialog} className="dropzone">
  {/* Can't be activated with keyboard! */}
</div>

// ANTI-PATTERN: Missing labels
<input type="file" onChange={handleFile} />
{/* Screen readers can't describe this */}

// ANTI-PATTERN: Visual-only status
<div className={uploading ? 'spinner' : 'done'} />
{/* No announcement for screen readers */}

// ANTI-PATTERN: Drag-drop only
<div onDrop={handleDrop}>Drop files here</div>
{/* No alternative for keyboard/screen reader users */}

// ANTI-PATTERN: Color-only error indication
<div style={{ borderColor: error ? 'red' : 'gray' }}>
  {/* Color blind users can't see the error */}
</div>

// ANTI-PATTERN: Auto-removing files without warning
const handleUpload = async (file: File) => {
  await upload(file);
  removeFromList(file); // User doesn't know what happened
};

// ANTI-PATTERN: Progress without ARIA
<div className={styles.progress}>
  <div style={{ width: `${progress}%` }} />
</div>
// Screen readers have no idea what's happening

// ANTI-PATTERN: Non-descriptive button labels
<button onClick={() => removeFile(file.id)}>X</button>
// Screen reader: "X button" - which file?

// ANTI-PATTERN: Announcing every progress update
useEffect(() => {
  announce(`Upload progress: ${progress}%`);
}, [progress]); // Spams screen reader with updates!
```

---

## Accessibility Checklist

| Requirement | Implementation |
|-------------|----------------|
| Keyboard navigation | `tabIndex={0}`, Enter/Space activation |
| Focus visible | `:focus-visible` styles with outline |
| Labels | `<label htmlFor>` or `aria-label` |
| Error announcements | `role="alert"` + `aria-live="polite"` |
| Progress announcements | `role="progressbar"` + `aria-valuenow/min/max` |
| Status updates | `role="status"` + `aria-live` regions |
| Required indication | Visual asterisk + `aria-required="true"` |
| Disabled state | Visual styling + `aria-disabled="true"` |
| Error identification | `aria-invalid` + `aria-describedby` to error |
| Focus management | Return focus after dialogs |
| Alternative to drag-drop | Click/keyboard file selection |
| Non-color indicators | Icons, text, or patterns for status |

---

## SCSS Utilities for Accessibility

### Screen Reader Only Class

```scss
// _accessibility.scss
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

// Allow focus to show element (for skip links)
.sr-only-focusable {
  &:focus,
  &:focus-visible {
    position: static;
    width: auto;
    height: auto;
    padding: inherit;
    margin: inherit;
    overflow: visible;
    clip: auto;
    white-space: normal;
  }
}
```

### Focus Styles

```scss
// _focus.scss
@mixin focus-ring {
  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
}

@mixin focus-within-ring {
  &:focus-within {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
}
```

---

_Extended examples: [core.md](core.md) | [validation.md](validation.md) | [progress.md](progress.md) | [preview.md](preview.md) | [s3-upload.md](s3-upload.md) | [resumable.md](resumable.md)_
