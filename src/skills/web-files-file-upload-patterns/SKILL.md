---
name: web-files-file-upload-patterns
description: File upload patterns - drag-drop dropzones, chunked/resumable uploads, S3 presigned URLs, file validation (MIME type, magic bytes), progress tracking, image preview, accessibility (ARIA)
---

# File Upload Patterns

> **Quick Guide:** Use drag-and-drop dropzones with fallback file inputs for uploads. Validate files client-side (MIME + magic bytes) AND server-side. For files >5MB use chunked uploads with progress tracking. Upload directly to S3 using presigned URLs to avoid server bottlenecks. Always implement proper accessibility with keyboard support and ARIA announcements. Use XHR (not fetch) for upload progress events.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST validate files BOTH client-side AND server-side - client validation is UX only, not security)**

**(You MUST use magic bytes detection for security-critical uploads - MIME types and extensions can be spoofed)**

**(You MUST cleanup object URLs with `URL.revokeObjectURL()` to prevent memory leaks)**

**(You MUST provide keyboard support for dropzones - Enter/Space to open file dialog)**

**(You MUST use presigned URLs for cloud storage uploads - never proxy large files through your server)**

</critical_requirements>

---

**Auto-detection:** file upload, dropzone, drag-drop, drag and drop upload, useDropzone, TUS protocol, presigned URL, multipart upload, file validation, magic bytes, MIME type, progress indicator, upload progress, XHR upload, S3 upload, file input, aria-label upload, chunked upload, resumable upload

**When to use:**

- Building file upload interfaces (single or multi-file)
- Implementing drag-and-drop upload areas
- Uploading to cloud storage directly from browser
- Validating file types before upload
- Showing upload progress with speed/ETA
- Handling large file uploads with chunking/resumable support
- Creating accessible file upload components

**When NOT to use:**

- Server-side file processing (use backend skills)
- File storage architecture (use infrastructure skills)
- Video/audio streaming (use media handling skills)

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Dropzone, file list, combined upload component
- [examples/validation.md](examples/validation.md) - MIME type, magic bytes, dimension validation
- [examples/progress.md](examples/progress.md) - Progress tracking, speed, abort, multi-file
- [examples/preview.md](examples/preview.md) - Image preview, thumbnails, EXIF orientation
- [examples/s3-upload.md](examples/s3-upload.md) - Presigned URLs, multipart uploads
- [examples/resumable.md](examples/resumable.md) - Chunked uploads, TUS protocol
- [examples/accessibility.md](examples/accessibility.md) - ARIA patterns, keyboard, announcements
- [reference.md](reference.md) - Decision frameworks, anti-patterns, checklists

---

<philosophy>

## Philosophy

File uploads are deceptively complex. A simple file input works for basic cases, but production apps need validation, progress feedback, error handling, and accessibility. The key insight is that **client-side validation is for UX, not security** - always validate on the server too.

**Core Principles:**

1. **Defense in depth** - Validate extension + MIME type + magic bytes + server-side
2. **Progressive enhancement** - Drag-drop enhances but doesn't replace click-to-browse
3. **Direct uploads** - Use presigned URLs to upload to cloud storage directly, not through your server
4. **Chunked for reliability** - Large files need chunking for resumability and progress
5. **Accessibility first** - Keyboard navigation and screen reader support from day one

**File Size Strategy:**

| File Size | Upload Method       | Progress UI            | Storage Pattern      |
| --------- | ------------------- | ---------------------- | -------------------- |
| < 5MB     | Single request      | Spinner or bar         | Direct presigned PUT |
| 5-50MB    | Single request      | Progress bar           | Presigned PUT        |
| 50MB-5GB  | Chunked             | Progress + ETA         | Multipart presigned  |
| > 5GB     | Chunked + resumable | Progress + ETA + pause | Multipart required   |

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Drag-and-Drop Dropzone

Build a dropzone with drag-and-drop and fallback file input. Key elements:

- Track drag state with a counter ref (not boolean) to handle nested element events
- `role="button"` + `tabIndex={0}` + Enter/Space key handlers for keyboard access
- Hidden `<input type="file">` triggered by click/keyboard
- Type validation via `accept` attribute plus runtime checking
- Reset `event.target.value = ''` after selection to allow re-selecting same file

```typescript
// Key structure - full implementation in examples/core.md
export function FileDropzone({ onFilesSelected, accept, multiple, disabled }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0); // Handles nested element drag events

  return (
    <div
      onDrop={handleDrop}
      onDragEnter={() => { dragCounterRef.current++; setState('drag-over'); }}
      onDragLeave={() => { dragCounterRef.current--; if (dragCounterRef.current === 0) setState('idle'); }}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="File upload area. Click or drag files to upload."
    >
      <input ref={inputRef} type="file" hidden aria-hidden="true" tabIndex={-1} />
    </div>
  );
}
```

See [examples/core.md](examples/core.md) for full implementation.

---

### Pattern 2: File List Management Hook

Track multiple files with status, progress, and preview URLs:

```typescript
// use-file-list.ts - full implementation in examples/core.md
interface FileWithId {
  id: string;
  file: File;
  preview?: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

export function useFileList(options: UseFileListOptions = {}) {
  const [files, setFiles] = useState<FileWithId[]>([]);

  // addFiles returns { added, rejected } with rejection reasons
  // removeFile cleans up object URLs via URL.revokeObjectURL()
  // clearFiles revokes all object URLs before clearing

  return {
    files,
    addFiles,
    removeFile,
    updateFile,
    clearFiles,
    hasFiles,
    canAddMore,
  };
}
```

Key: Always `URL.revokeObjectURL()` on remove and clear. Return rejected files with reasons for user feedback.

See [examples/core.md](examples/core.md) for full hook.

---

### Pattern 3: Upload Progress with XHR

The Fetch API does not support upload progress events. Use XHR:

```typescript
// use-upload-progress.ts - full implementation in examples/progress.md
const xhr = new XMLHttpRequest();
xhr.upload.addEventListener("progress", (event) => {
  if (event.lengthComputable) {
    const speed = calculateRollingAverageSpeed(event.loaded, performance.now());
    const remaining = (event.total - event.loaded) / speed;
    setProgress({
      loaded: event.loaded,
      total: event.total,
      percentage,
      speed,
      remainingTime: remaining,
    });
  }
});
```

Key: Use a rolling average (5 samples) for smooth speed display. Always provide abort capability via `xhr.abort()`.

**Note:** Fetch streams measure bytes taken from your stream, not actual network transmission ([Jake Archibald's analysis](https://jakearchibald.com/2025/fetch-streams-not-for-progress/)). A native fetch progress API is in development. Until then, use XHR.

See [examples/progress.md](examples/progress.md) for full hook and multi-file manager.

---

### Pattern 4: Magic Bytes File Type Detection

MIME types and extensions can be spoofed. Read actual file bytes:

```typescript
// file-type-detection.ts - full implementation in examples/validation.md
const FILE_SIGNATURES: FileSignature[] = [
  { mime: "image/jpeg", extension: "jpg", signature: [0xff, 0xd8, 0xff] },
  {
    mime: "image/png",
    extension: "png",
    signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    mime: "application/pdf",
    extension: "pdf",
    signature: [0x25, 0x50, 0x44, 0x46],
  }, // %PDF
  {
    mime: "application/zip",
    extension: "zip",
    signature: [0x50, 0x4b, 0x03, 0x04],
  },
];

export async function detectFileType(
  file: File,
): Promise<DetectionResult | null> {
  const HEADER_SIZE = 12;
  const buffer = await file.slice(0, HEADER_SIZE).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // Match against signatures, return { mime, extension, confidence }
}
```

Key: Only read first 8-12 bytes (not entire file). Office documents (.docx/.xlsx/.pptx) are ZIP files - detect by checking for `word/`/`xl/`/`ppt/` in the first 1000 bytes.

See [examples/validation.md](examples/validation.md) for full detection and validator class.

---

### Pattern 5: Direct-to-Storage Upload with Presigned URLs

Upload directly to cloud storage from the browser. The flow:

1. Client requests presigned URL from your server (with file metadata)
2. Server generates time-limited presigned URL and returns it
3. Client uploads directly to storage using the presigned URL
4. Server never touches the file bytes

```typescript
// Client-side upload - full implementation in examples/s3-upload.md
export async function uploadWithPresignedPut(
  file: File,
  presignedUrl: string,
  options: {
    onProgress?: (progress: number) => void;
    abortSignal?: AbortSignal;
  } = {},
): Promise<void> {
  const xhr = new XMLHttpRequest();
  // XHR for progress + PUT to presigned URL
  xhr.open("PUT", presignedUrl);
  xhr.setRequestHeader("Content-Type", file.type);
  xhr.send(file);
}
```

Key: For POST uploads, add presigned fields to FormData **before** the file (order matters). For large files (>100MB), use multipart upload with per-part presigned URLs. Always sanitize filenames server-side.

See [examples/s3-upload.md](examples/s3-upload.md) for POST/PUT uploads, multipart, and full flow hook.

---

### Pattern 6: Chunked and Resumable Uploads

For files >100MB, split into chunks with concurrency control:

```typescript
// chunked-upload.ts - full implementation in examples/resumable.md
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

// Upload chunks in parallel with concurrency limit
// Retry failed chunks with exponential backoff
// Save progress to localStorage for browser refresh recovery
// Support pause/resume/cancel
```

Key: Use localStorage keyed by `filename-size-lastModified` to persist completed chunks. Expire stored progress after 24 hours. For standards-based resumable uploads, implement the TUS protocol (POST to create, HEAD to check offset, PATCH to upload chunks).

See [examples/resumable.md](examples/resumable.md) for chunked uploader, localStorage persistence, and TUS client.

</patterns>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Not validating files on server - client validation can be bypassed completely
- Trusting MIME type or extension alone - both can be spoofed; use magic bytes
- Not cleaning up object URLs - causes memory leaks with `URL.createObjectURL`
- Proxying large files through server - bottlenecks server; use presigned URLs
- No keyboard support for dropzones - accessibility violation
- Exposing cloud storage credentials in client code - use presigned URLs from server

**Medium Priority Issues:**

- No progress feedback for large uploads - users don't know if it's working
- Using fetch for uploads - no upload progress events; use XHR
- Not handling upload abort - users can't cancel stuck uploads
- Long presigned URL expiration - security risk; keep under 1 hour
- Fake progress bars - show real progress or spinner, not fake animation

**Common Mistakes:**

- Not resetting file input after selection - can't select same file twice
- Using `e.stopPropagation()` without `e.preventDefault()` on drop - browser opens file
- Loading entire file into memory for validation - only read first bytes
- Creating object URLs on every render without cleanup

**Gotchas & Edge Cases:**

- Safari handles drag events differently - test cross-browser
- Mobile has no drag-drop - ensure click-to-browse works
- CORS required for direct cloud storage uploads - configure bucket policy
- Large files may cause browser tab to freeze - use chunked upload
- EXIF orientation in photos - images may appear rotated (modern browsers auto-rotate for display, but manual handling needed for Canvas processing)
- `dragenter`/`dragleave` fire for nested elements - use a counter ref, not boolean state

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST validate files BOTH client-side AND server-side - client validation is UX only, not security)**

**(You MUST use magic bytes detection for security-critical uploads - MIME types and extensions can be spoofed)**

**(You MUST cleanup object URLs with `URL.revokeObjectURL()` to prevent memory leaks)**

**(You MUST provide keyboard support for dropzones - Enter/Space to open file dialog)**

**(You MUST use presigned URLs for cloud storage uploads - never proxy large files through your server)**

**Failure to follow these rules will create security vulnerabilities, memory leaks, and accessibility issues.**

</critical_reminders>
