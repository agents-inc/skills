# File Upload Core Examples

> Core code examples for file upload patterns. Reference from [SKILL.md](../SKILL.md).

**Extended examples:**

- [validation.md](validation.md) - MIME type, magic bytes, dimension validation
- [progress.md](progress.md) - Progress tracking, speed, abort handling
- [preview.md](preview.md) - Image preview, thumbnails, EXIF orientation
- [s3-upload.md](s3-upload.md) - Presigned URLs, multipart uploads
- [resumable.md](resumable.md) - Chunked uploads, TUS protocol
- [accessibility.md](accessibility.md) - ARIA patterns, keyboard support

---

## Pattern 1: Simple File Input with Styling

### Hidden Input with Custom Button

```typescript
// simple-file-input.tsx
import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import styles from './simple-file-input.module.scss';

interface SimpleFileInputProps {
  onFileSelected: (file: File) => void;
  accept?: string;
  label?: string;
  disabled?: boolean;
}

export function SimpleFileInput({
  onFileSelected,
  accept,
  label = 'Choose file',
  disabled = false,
}: SimpleFileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
    // Reset to allow re-selecting same file
    event.target.value = '';
  };

  return (
    <div className={styles.container}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        className={styles.hiddenInput}
        id="file-input"
      />
      <label htmlFor="file-input" className={styles.button} data-disabled={disabled || undefined}>
        {label}
      </label>
    </div>
  );
}
```

```scss
// simple-file-input.module.scss
.container {
  display: inline-block;
}

.hiddenInput {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.button {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-2) var(--spacing-4);
  background: var(--color-primary);
  color: var(--color-white);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-weight: 500;

  &:hover:not([data-disabled]) {
    background: var(--color-primary-dark);
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  &[data-disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
```

**Why good:** Input is hidden but accessible, label triggers file dialog, proper focus styles, disabled state handling, resets input for re-selection

---

## Pattern 2: Basic Dropzone

### Full Dropzone Implementation

```typescript
// file-dropzone.tsx
import { useState, useRef, useCallback } from 'react';
import type { DragEvent, ChangeEvent, ReactNode } from 'react';
import styles from './file-dropzone.module.scss';

type DropzoneState = 'idle' | 'drag-over' | 'drag-reject';

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string[];
  multiple?: boolean;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}

const DEFAULT_MAX_FILES = 10;

export function FileDropzone({
  onFilesSelected,
  accept = [],
  multiple = true,
  maxFiles = DEFAULT_MAX_FILES,
  disabled = false,
  className,
  children,
}: FileDropzoneProps) {
  const [state, setState] = useState<DropzoneState>('idle');
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const acceptString = accept.join(',');

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

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounterRef.current++;

      if (disabled) return;
      setState('drag-over');
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounterRef.current--;

      if (dragCounterRef.current === 0) {
        setState('idle');
      }
    },
    []
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
    },
    []
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounterRef.current = 0;
      setState('idle');

      if (disabled) return;

      const droppedFiles = Array.from(event.dataTransfer.files);
      const validFiles = droppedFiles.filter(isValidType);
      const filesToProcess = multiple
        ? validFiles.slice(0, maxFiles)
        : validFiles.slice(0, 1);

      if (filesToProcess.length > 0) {
        onFilesSelected(filesToProcess);
      }
    },
    [disabled, isValidType, multiple, maxFiles, onFilesSelected]
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      const filesToProcess = multiple
        ? fileArray.slice(0, maxFiles)
        : fileArray.slice(0, 1);

      onFilesSelected(filesToProcess);
      event.target.value = '';
    },
    [multiple, maxFiles, onFilesSelected]
  );

  const openFileDialog = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openFileDialog();
      }
    },
    [openFileDialog]
  );

  return (
    <div
      className={`${styles.dropzone} ${className ?? ''}`}
      data-state={state}
      data-disabled={disabled || undefined}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={openFileDialog}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`File upload area. ${accept.length > 0 ? `Accepts ${accept.join(', ')}.` : ''} Click or drag files to upload.`}
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptString}
        multiple={multiple}
        onChange={handleInputChange}
        disabled={disabled}
        className={styles.hiddenInput}
        aria-hidden="true"
        tabIndex={-1}
      />
      {children ?? (
        <div className={styles.content}>
          <div className={styles.icon} aria-hidden="true">
            📁
          </div>
          <p className={styles.text}>
            Drag and drop files here, or click to browse
          </p>
          {accept.length > 0 && (
            <p className={styles.hint}>
              Accepted: {accept.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

```scss
// file-dropzone.module.scss
.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-8);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;

  &:hover:not([data-disabled]) {
    border-color: var(--color-primary);
    background: var(--color-surface-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  &[data-state='drag-over'] {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  &[data-state='drag-reject'] {
    border-color: var(--color-error);
    background: var(--color-error-light);
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
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.content {
  text-align: center;
}

.icon {
  font-size: 3rem;
  margin-bottom: var(--spacing-4);
}

.text {
  font-size: var(--text-lg);
  color: var(--color-text);
  margin-bottom: var(--spacing-2);
}

.hint {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
```

**Why good:** Tracks drag counter to handle nested elements, keyboard accessible with role="button", visual feedback for all states, hidden input for screen readers, accepts any children for customization

---

## Pattern 3: File List with Status

### File List Component

```typescript
// file-list.tsx
import type { ReactNode } from 'react';
import styles from './file-list.module.scss';

interface FileItem {
  id: string;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
}

interface FileListProps {
  files: FileItem[];
  onRemove: (id: string) => void;
  renderActions?: (file: FileItem) => ReactNode;
}

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_MB) return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
}

export function FileList({ files, onRemove, renderActions }: FileListProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <ul className={styles.list} role="list" aria-label="Selected files">
      {files.map((file) => (
        <li key={file.id} className={styles.item} data-status={file.status}>
          <div className={styles.info}>
            <span className={styles.name} title={file.name}>
              {file.name}
            </span>
            <span className={styles.size}>{formatFileSize(file.size)}</span>
          </div>

          {file.status === 'uploading' && file.progress !== undefined && (
            <div className={styles.progressContainer}>
              <div
                className={styles.progressBar}
                role="progressbar"
                aria-valuenow={file.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Uploading ${file.name}`}
              >
                <div
                  className={styles.progressFill}
                  style={{ width: `${file.progress}%` }}
                />
              </div>
              <span className={styles.progressText}>{file.progress}%</span>
            </div>
          )}

          {file.status === 'error' && file.error && (
            <span className={styles.error} role="alert">
              {file.error}
            </span>
          )}

          {file.status === 'success' && (
            <span className={styles.success} aria-label="Upload complete">
              ✓
            </span>
          )}

          <div className={styles.actions}>
            {renderActions?.(file)}
            <button
              type="button"
              className={styles.removeButton}
              onClick={() => onRemove(file.id)}
              aria-label={`Remove ${file.name}`}
              disabled={file.status === 'uploading'}
            >
              ×
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

```scss
// file-list.module.scss
.list {
  list-style: none;
  padding: 0;
  margin: var(--spacing-4) 0;
}

.item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-2);

  &[data-status='error'] {
    border-color: var(--color-error);
    background: var(--color-error-light);
  }

  &[data-status='success'] {
    border-color: var(--color-success);
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
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.progressContainer {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  flex: 0 0 150px;
}

.progressBar {
  flex: 1;
  height: 8px;
  background: var(--color-surface);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.2s;
}

.progressText {
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  min-width: 3ch;
  text-align: right;
}

.error {
  color: var(--color-error);
  font-size: var(--text-sm);
}

.success {
  color: var(--color-success);
  font-weight: bold;
}

.actions {
  display: flex;
  gap: var(--spacing-1);
}

.removeButton {
  padding: var(--spacing-1) var(--spacing-2);
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--text-lg);

  &:hover:not(:disabled) {
    color: var(--color-error);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
```

**Why good:** Shows status per file with appropriate ARIA, progress bar is accessible, error messages use role="alert", remove button disabled during upload, ellipsis for long filenames

---

## Pattern 4: Combined Upload Component

### Full Upload Component Example

```typescript
// file-upload.tsx
import { useCallback, useState } from 'react';
import { FileDropzone } from './file-dropzone';
import { FileList } from './file-list';
import { useFileList } from './use-file-list';

interface FileUploadProps {
  onUploadComplete: (urls: string[]) => void;
  uploadUrl: string;
  accept?: string[];
  maxFiles?: number;
  maxSizeBytes?: number;
}

const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export function FileUpload({
  onUploadComplete,
  uploadUrl,
  accept = ['image/*'],
  maxFiles = 5,
  maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
}: FileUploadProps) {
  const { files, addFiles, removeFile, updateFile, clearFiles } = useFileList({
    maxFiles,
    maxSizeBytes,
  });
  const [rejected, setRejected] = useState<string[]>([]);

  const handleFilesSelected = useCallback(
    (newFiles: File[]) => {
      const { added, rejected: rejectedFiles } = addFiles(newFiles);
      setRejected(rejectedFiles.map((r) => `${r.file.name}: ${r.reason}`));

      // Start uploading added files
      added.forEach((fileItem) => {
        uploadFile(fileItem.id, fileItem.file);
      });
    },
    [addFiles]
  );

  const uploadFile = async (id: string, file: File) => {
    updateFile(id, { status: 'uploading', progress: 0 });

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100);
        updateFile(id, { progress });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        updateFile(id, { status: 'success', progress: 100 });
      } else {
        updateFile(id, {
          status: 'error',
          error: `Upload failed: ${xhr.status}`,
        });
      }
    });

    xhr.addEventListener('error', () => {
      updateFile(id, { status: 'error', error: 'Upload failed' });
    });

    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', uploadUrl);
    xhr.send(formData);
  };

  const handleComplete = useCallback(() => {
    const successfulUploads = files
      .filter((f) => f.status === 'success')
      .map((f) => f.file.name);
    onUploadComplete(successfulUploads);
    clearFiles();
  }, [files, onUploadComplete, clearFiles]);

  const allComplete = files.length > 0 && files.every(
    (f) => f.status === 'success' || f.status === 'error'
  );

  return (
    <div>
      <FileDropzone
        onFilesSelected={handleFilesSelected}
        accept={accept}
        multiple={maxFiles > 1}
        maxFiles={maxFiles}
        disabled={files.length >= maxFiles}
      />

      {rejected.length > 0 && (
        <div role="alert">
          <p>Some files were rejected:</p>
          <ul>
            {rejected.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <FileList files={files} onRemove={removeFile} />

      {allComplete && (
        <button type="button" onClick={handleComplete}>
          Done
        </button>
      )}
    </div>
  );
}
```

**Why good:** Combines dropzone with file list, shows rejected files with reasons, tracks upload progress per file, enables done button only when all complete

---

_Extended examples: [validation.md](validation.md) | [progress.md](progress.md) | [preview.md](preview.md) | [s3-upload.md](s3-upload.md) | [resumable.md](resumable.md) | [accessibility.md](accessibility.md)_
