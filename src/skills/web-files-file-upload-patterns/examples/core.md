# File Upload — Core Examples

> Selecting files and holding them in state. Decisions are in [SKILL.md](../SKILL.md).

**Extended examples:**

- [validation.md](validation.md) — MIME type, magic bytes, dimensions
- [progress.md](progress.md) — progress, speed, abort, concurrency
- [preview.md](preview.md) — a thumbnail for a selected file
- [presigned-upload.md](presigned-upload.md) — direct-to-storage uploads
- [resumable.md](resumable.md) — chunked and resumable uploads
- [accessibility.md](accessibility.md) — announcements and focus

---

## Pattern 1: File input

A `<label htmlFor>` over a hidden input gives a fully styleable trigger with no ARIA and no key
handling — the browser already treats a label as an activator for its input.

```typescript
// simple-file-input.tsx
import { useRef } from 'react';
import type { ChangeEvent } from 'react';

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
    if (file) onFileSelected(file);
    // clearing the value is what allows the same file to be chosen again
    event.target.value = '';
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        hidden
        id="file-input"
      />
      <label htmlFor="file-input" data-disabled={disabled || undefined}>
        {label}
      </label>
    </div>
  );
}
```

---

## Pattern 2: Dropzone

Drag is the enhancement; click and Enter/Space are the paths that always work. Every visual state is
a data attribute, so any styling approach can hang off it.

```typescript
// file-dropzone.tsx
import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent, ReactNode } from 'react';

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

  const take = useCallback(
    (files: File[]) => {
      const valid = files.filter(isValidType);
      return multiple ? valid.slice(0, maxFiles) : valid.slice(0, 1);
    },
    [isValidType, multiple, maxFiles]
  );

  // dragenter and dragleave fire for every nested element, so count them
  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounterRef.current++;
      if (!disabled) setState('drag-over');
    },
    [disabled]
  );

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setState('idle');
  }, []);

  // without preventDefault here, drop never fires at all
  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounterRef.current = 0;
      setState('idle');

      if (disabled) return;

      const files = take(Array.from(event.dataTransfer.files));
      if (files.length > 0) onFilesSelected(files);
    },
    [disabled, take, onFilesSelected]
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        onFilesSelected(take(Array.from(files)));
      }
      event.target.value = '';
    },
    [take, onFilesSelected]
  );

  const openFileDialog = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openFileDialog();
      }
    },
    [openFileDialog]
  );

  const acceptDescription =
    accept.length > 0 ? `Accepts ${accept.join(', ')}.` : '';

  return (
    <div
      className={className}
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
      aria-label={`File upload area. ${acceptDescription} Click or drag files to upload.`}
      aria-disabled={disabled}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(',')}
        multiple={multiple}
        onChange={handleInputChange}
        disabled={disabled}
        hidden
        aria-hidden="true"
        tabIndex={-1}
      />
      {children ?? (
        <div>
          <p>Drag and drop files here, or click to browse</p>
          {accept.length > 0 && <p>Accepted: {accept.join(', ')}</p>}
        </div>
      )}
    </div>
  );
}
```

The input is `aria-hidden` with `tabIndex={-1}`: the wrapper already announces itself as a button,
so exposing both puts two controls in the tab order for one action.

---

## Pattern 3: File list state

Holds one entry per file with its own status, generates the IDs the UI keys on, and owns the object
URLs so nothing else has to remember to revoke them.

```typescript
// use-file-list.ts
import { useCallback, useEffect, useRef, useState } from "react";

interface FileWithId {
  id: string;
  file: File;
  preview?: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

interface UseFileListOptions {
  maxFiles?: number;
  maxSizeBytes?: number;
  generatePreview?: boolean;
}

interface Rejection {
  file: File;
  reason: string;
}

const DEFAULT_MAX_FILES = 10;
const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export function useFileList(options: UseFileListOptions = {}) {
  const {
    maxFiles = DEFAULT_MAX_FILES,
    maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
    generatePreview = true,
  } = options;

  const [files, setFiles] = useState<FileWithId[]>([]);
  const previewUrlsRef = useRef(new Set<string>());

  const revoke = useCallback((url: string | undefined) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    previewUrlsRef.current.delete(url);
  }, []);

  // the ref, not the state, so unmount cleanup sees the current set
  useEffect(
    () => () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    },
    [],
  );

  const addFiles = useCallback(
    (incoming: File[]): { added: FileWithId[]; rejected: Rejection[] } => {
      const added: FileWithId[] = [];
      const rejected: Rejection[] = [];

      for (const file of incoming) {
        if (files.length + added.length >= maxFiles) {
          rejected.push({ file, reason: `Maximum ${maxFiles} files` });
          continue;
        }
        if (file.size > maxSizeBytes) {
          const maxMB = maxSizeBytes / 1024 / 1024;
          rejected.push({ file, reason: `Exceeds ${maxMB}MB` });
          continue;
        }

        const preview =
          generatePreview && file.type.startsWith("image/")
            ? URL.createObjectURL(file)
            : undefined;
        if (preview) previewUrlsRef.current.add(preview);

        added.push({
          id: crypto.randomUUID(),
          file,
          preview,
          status: "pending",
          progress: 0,
        });
      }

      if (added.length > 0) setFiles((current) => [...current, ...added]);

      return { added, rejected };
    },
    [files.length, maxFiles, maxSizeBytes, generatePreview],
  );

  const updateFile = useCallback(
    (id: string, changes: Partial<Omit<FileWithId, "id" | "file">>) => {
      setFiles((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, ...changes } : entry,
        ),
      );
    },
    [],
  );

  const removeFile = useCallback(
    (id: string) => {
      revoke(files.find((entry) => entry.id === id)?.preview);
      setFiles((current) => current.filter((entry) => entry.id !== id));
    },
    [files, revoke],
  );

  const clearFiles = useCallback(() => {
    files.forEach((entry) => revoke(entry.preview));
    setFiles([]);
  }, [files, revoke]);

  return {
    files,
    addFiles,
    updateFile,
    removeFile,
    clearFiles,
    hasFiles: files.length > 0,
    canAddMore: files.length < maxFiles,
  };
}

export type { FileWithId, Rejection };
```

`addFiles` returns the rejections rather than throwing on them: a batch where two of five files are
too large should still accept the other three and say why the two did not make it.

---

## Pattern 4: File list rendering

Status drives what is shown, and each state carries its own ARIA role — `progressbar` while
uploading, `alert` on failure.

```typescript
// file-list.tsx
import type { ReactNode } from 'react';

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
  if (files.length === 0) return null;

  return (
    <ul role="list" aria-label="Selected files">
      {files.map((file) => (
        <li key={file.id} data-status={file.status}>
          <div>
            <span title={file.name}>{file.name}</span>
            <span>{formatFileSize(file.size)}</span>
          </div>

          {file.status === 'uploading' && file.progress !== undefined && (
            <div
              role="progressbar"
              aria-valuenow={file.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Uploading ${file.name}`}
            >
              <div data-fill style={{ width: `${file.progress}%` }} />
            </div>
          )}

          {file.status === 'error' && file.error && (
            <span role="alert">{file.error}</span>
          )}

          {file.status === 'success' && (
            <span aria-label="Upload complete" aria-hidden="false">✓</span>
          )}

          <div>
            {renderActions?.(file)}
            <button
              type="button"
              onClick={() => onRemove(file.id)}
              aria-label={`Remove ${file.name}`}
              disabled={file.status === 'uploading'}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

---

## Pattern 5: Assembled component

Dropzone, list and upload wired together. Each file uploads independently, so one failure does not
take the batch with it.

```typescript
// file-upload.tsx
import { useCallback, useState } from 'react';
import { FileDropzone } from './file-dropzone';
import { FileList } from './file-list';
import { useFileList } from './use-file-list';

interface FileUploadProps {
  onUploadComplete: (names: string[]) => void;
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

  const uploadFile = useCallback(
    (id: string, file: File) => {
      updateFile(id, { status: 'uploading', progress: 0 });

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (!e.lengthComputable) return;
        updateFile(id, { progress: Math.round((e.loaded / e.total) * 100) });
      });

      xhr.addEventListener('load', () => {
        const ok = xhr.status >= 200 && xhr.status < 300;
        updateFile(
          id,
          ok
            ? { status: 'success', progress: 100 }
            : { status: 'error', error: `Upload failed: ${xhr.status}` }
        );
      });

      xhr.addEventListener('error', () => {
        updateFile(id, { status: 'error', error: 'Upload failed' });
      });

      const formData = new FormData();
      formData.append('file', file);

      xhr.open('POST', uploadUrl);
      xhr.send(formData);
    },
    [updateFile, uploadUrl]
  );

  const handleFilesSelected = useCallback(
    (newFiles: File[]) => {
      const { added, rejected: rejectedFiles } = addFiles(newFiles);
      setRejected(rejectedFiles.map((r) => `${r.file.name}: ${r.reason}`));
      added.forEach((entry) => uploadFile(entry.id, entry.file));
    },
    [addFiles, uploadFile]
  );

  const handleComplete = useCallback(() => {
    onUploadComplete(
      files.filter((f) => f.status === 'success').map((f) => f.file.name)
    );
    clearFiles();
  }, [files, onUploadComplete, clearFiles]);

  const allSettled =
    files.length > 0 &&
    files.every((f) => f.status === 'success' || f.status === 'error');

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
            {rejected.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <FileList
        files={files.map((f) => ({
          id: f.id,
          name: f.file.name,
          size: f.file.size,
          status: f.status,
          progress: f.progress,
          error: f.error,
        }))}
        onRemove={removeFile}
      />

      {allSettled && (
        <button type="button" onClick={handleComplete}>
          Done
        </button>
      )}
    </div>
  );
}
```

For more than a handful of files at once, cap concurrency — see the queue in
[progress.md](progress.md).
