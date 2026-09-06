---
name: web-files-file-upload-patterns
description: File upload patterns - drag-drop dropzones, chunked and resumable uploads, presigned URL flows, file validation (MIME type, magic bytes), progress tracking, accessibility (ARIA)
---

# File Upload Patterns

> **Quick Guide:** A dropzone is a keyboard-operable button wrapping a hidden file input, with drag
> as an enhancement. Validate for the user's benefit on the client — extension, MIME type, then the
> file's own magic bytes — and again on the server, because none of the client checks are security.
> Progress needs `XMLHttpRequest`; `fetch` has no upload progress event. Past roughly 100MB, chunk
> the file so a failure costs one chunk. Large files go straight to storage on a presigned URL the
> server issues, so no request body is ever proxied.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — file input, dropzone, file list state and rendering, the assembled component
- [examples/validation.md](examples/validation.md) — rule-based validator, magic-byte detection, dimension checks, a validation hook
- [examples/progress.md](examples/progress.md) — XHR progress with speed and ETA, progress bar, formatters, concurrent uploads
- [examples/preview.md](examples/preview.md) — a preview thumbnail for a selected file, with cleanup
- [examples/presigned-upload.md](examples/presigned-upload.md) — PUT and POST-policy uploads, the server contract, multipart parts, the whole flow as a hook
- [examples/resumable.md](examples/resumable.md) — chunked uploader with retry, resume across a reload, a tus client, the tus server contract
- [examples/accessibility.md](examples/accessibility.md) — announcing selection and progress, focus return after the file dialog
- [reference.md](reference.md) — method selection by size, expiry guidance, validation order, CORS, review checklist

---

## Which path applies

The destination decides almost everything else.

- **The file goes to your own endpoint** — one `POST` with `FormData`, progress from XHR, and a size
  cap the server can enforce. [examples/core.md](examples/core.md) and
  [examples/progress.md](examples/progress.md) are the whole of it.
- **The file goes to object storage** — the server issues a presigned URL and the browser uploads to
  it directly, so no bytes pass through your application.
  [examples/presigned-upload.md](examples/presigned-upload.md).
- **The file is large enough that a failure hurts** — split it, upload the parts with a concurrency
  limit, and record which parts landed so a retry resumes.
  [examples/resumable.md](examples/resumable.md).

---

<critical_requirements>

## Before writing upload code

**Validate on the server as well as in the browser.** Client validation exists to tell the user
quickly what will be rejected; anyone can skip it entirely, so it settles nothing about safety.

**Read the file's first bytes when the type matters.** Extensions and MIME types are both supplied
by whoever made the file, and a renamed executable passes every check that trusts them.

**Revoke every object URL you create.** A preview holds the whole file in memory until
`URL.revokeObjectURL()` runs, so a user who changes their mind three times leaks three files.

**Make the dropzone reachable from the keyboard.** `role="button"`, `tabIndex={0}` and an
Enter/Space handler that opens the file dialog, with drag layered on top — mobile has no drag at
all, so the click path is the real one.

**Have the server issue a short-lived presigned URL rather than proxying the body.** The upload then
costs your application nothing, and no storage credential is ever in reach of the browser.

</critical_requirements>

---

**Auto-detection:** dropzone, dataTransfer.files, dragenter, dragleave, dragover, input type="file",
event.target.files, accept attribute, xhr.upload.addEventListener, lengthComputable, presigned URL,
uploadUrl, multipart upload, UploadPart, ETag, chunked upload, file.slice, Content-Range, resumable
upload, tus, Tus-Resumable, Upload-Offset, magic bytes, file signature, FormData append file

**Applies to:**

- Selecting files by click, keyboard or drag
- Validating type, size and dimensions before anything is sent
- Reporting progress, speed and remaining time, and cancelling
- Uploading straight to storage on a URL the server signed
- Splitting a large file into chunks and resuming an interrupted upload
- Announcing selection, progress and failure to a screen reader

**Handled elsewhere:**

- Receiving, scanning and storing the bytes once they arrive
- Resizing, cropping or converting an image before it is sent — this skill sends the `File` it is
  given
- Where the stored object lives, how it is served, and what its URL looks like
- Streaming playback of media that was uploaded

---

<philosophy>

## Philosophy

An upload is three independent problems that get conflated: choosing a file, checking it, and moving
its bytes. Keeping them separate is what makes any of them replaceable.

The checking half has a rule that never bends. **Client validation is a user-experience feature, and
the server's is the only one that is a control.** Everything the browser knows about a file — its
name, its extension, its `type` — came from the file itself. Reading magic bytes raises the bar but
does not change the category: it is still a check the client can be made to skip.

The moving half scales by a different axis: not how many files, but how long a single request is
open. A short request can fail and be retried whole. A long one accumulates the probability of a
dropped connection until retrying whole is unacceptable, and that is the point at which chunking
starts paying for its complexity — not at a particular byte count.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Dropzone

Count drag events rather than tracking a boolean. `dragenter` and `dragleave` fire for every nested
element, so a boolean flickers off the moment the pointer crosses a child.

```typescript
const dragCounterRef = useRef(0);

<div
  onDragEnter={() => { dragCounterRef.current++; setState("drag-over"); }}
  onDragLeave={() => {
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setState("idle");
  }}
  onDragOver={(e) => e.preventDefault()} // without this, drop never fires
  onDrop={handleDrop}
  onClick={() => inputRef.current?.click()}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
  }}
  role="button"
  tabIndex={disabled ? -1 : 0}
  aria-label="File upload area. Click or drag files to upload."
>
  <input ref={inputRef} type="file" hidden aria-hidden="true" tabIndex={-1} />
</div>
```

Full code: [examples/core.md](examples/core.md)

### Pattern 2: File list state

One entry per file with its own status, so a failure is per-file rather than per-batch. Rejections
come back with reasons the UI can show.

```typescript
interface FileWithId {
  id: string;
  file: File;
  preview?: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

// addFiles returns { added, rejected }, each rejection carrying its reason
// removeFile and clearFiles revoke any preview URL before dropping the entry
```

Full code: [examples/core.md](examples/core.md)

### Pattern 3: Progress with XHR

`fetch` reports download progress and not upload progress, so upload progress means
`XMLHttpRequest`. Average the last few samples or the speed reading jitters unusably.

```typescript
const xhr = new XMLHttpRequest();
xhr.upload.addEventListener("progress", (event) => {
  if (!event.lengthComputable) return; // no total: show a spinner, not a bar
  const speed = rollingAverageSpeed(event.loaded, performance.now());
  setProgress({
    loaded: event.loaded,
    total: event.total,
    percentage: Math.round((event.loaded / event.total) * 100),
    speed,
    remainingTime: (event.total - event.loaded) / speed,
  });
});
```

`xhr.abort()` is the cancel. Streaming a `fetch` body measures bytes you handed the stream rather
than bytes on the wire, which is why it is not a substitute.

Full code: [examples/progress.md](examples/progress.md)

### Pattern 4: Magic-byte detection

Read the first twelve bytes and compare against known signatures. Never read the whole file — a
large one freezes the tab.

```typescript
const FILE_SIGNATURES = [
  { mime: "image/jpeg", extension: "jpg", signature: [0xff, 0xd8, 0xff] },
  { mime: "image/png", extension: "png", signature: [0x89, 0x50, 0x4e, 0x47] },
  {
    mime: "application/pdf",
    extension: "pdf",
    signature: [0x25, 0x50, 0x44, 0x46],
  },
  {
    mime: "application/zip",
    extension: "zip",
    signature: [0x50, 0x4b, 0x03, 0x04],
  },
];

const buffer = await file.slice(0, 12).arrayBuffer();
const bytes = new Uint8Array(buffer);
```

Office documents are ZIP archives, so a ZIP match needs a second look: `word/`, `xl/` or `ppt/` in
the first kilobyte identifies which.

Full code: [examples/validation.md](examples/validation.md)

### Pattern 5: Presigned upload

Four steps, and your application never holds the bytes:

1. The client asks your server for a URL, sending name, type and size.
2. The server authorises the request, sanitises the name, builds a key, and signs a short-lived URL.
3. The client `PUT`s the file to that URL.
4. The client tells your server the key, and the server records it.

```typescript
const { uploadUrl, key } = await requestPresignedUrl(file);

const xhr = new XMLHttpRequest();
xhr.open("PUT", uploadUrl);
xhr.setRequestHeader("Content-Type", file.type);
xhr.upload.addEventListener("progress", reportProgress);
xhr.send(file);
```

A POST-policy URL instead of a PUT lets the storage service enforce size and content-type itself —
at the cost of `FormData` field order mattering, with the file appended last.

Full code: [examples/presigned-upload.md](examples/presigned-upload.md)

### Pattern 6: Chunked and resumable

Slice the file, upload the slices with a concurrency limit, and retry a failed slice with
exponential backoff rather than restarting.

```typescript
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;

const start = chunkIndex * chunkSize;
const chunk = file.slice(start, Math.min(start + chunkSize, file.size));
```

Persist the completed chunk indexes keyed on `name-size-lastModified`, so a reload resumes rather
than restarts, and expire that record after a day. For an interoperable protocol rather than your
own, tus is `POST` to create, `HEAD` to learn the offset, `PATCH` to append.

Full code: [examples/resumable.md](examples/resumable.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- No `event.preventDefault()` on `dragover` — `drop` never fires and the browser navigates to the
  file instead — prevent the default on both `dragover` and `drop`
- A boolean for drag state — it flickers as the pointer crosses child elements — count `dragenter`
  and `dragleave` in a ref
- The file input's value left set after a selection — choosing the same file twice fires no
  `change` event — assign `event.target.value = ""` after reading `files`
- `fetch` used where progress is required — there is no upload progress event and stream progress
  measures the wrong thing — use `XMLHttpRequest`
- `file.text()` or `readAsDataURL()` to inspect a type — the whole file is read into memory — slice
  the first 12 bytes
- An object URL created in a render body — a new one per render, none revoked — create it in an
  effect and revoke in the cleanup
- No CORS configuration on the storage bucket — a direct upload fails preflight — allow the origin
  and the methods, and expose `ETag` for multipart

**Surprising behaviour:**

- A presigned URL is a bearer token: whoever holds it can perform that operation until it expires
- Extension, MIME type and `File.type` all come from the client and are all forgeable
- Mobile browsers have no drag and drop, so the click path is the only path there
- `lengthComputable` is false for a request with no known length, and the percentage is meaningless
  until it is true
- A multipart upload that is neither completed nor aborted leaves parts billed and invisible; set a
  lifecycle rule to expire them
- Safari's drag events differ enough from Chromium's to be worth testing separately
- A photo carries EXIF orientation that the browser applies on display and canvas processing does
  not

</red_flags>
