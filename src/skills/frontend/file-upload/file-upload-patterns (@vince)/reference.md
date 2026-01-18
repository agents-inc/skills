# File Upload Patterns Reference

> Decision frameworks, anti-patterns, and red flags for file upload implementations. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Decision Framework

### When to Use Which Upload Method

```
What is the file size?
├─ < 5MB → Single request upload
│   └─ Show: Spinner or progress bar
└─ 5MB - 100MB → Single request with XHR progress
    └─ Show: Progress bar with percentage
└─ 100MB+ → Chunked upload
    ├─ Need resumability?
    │   ├─ YES → TUS protocol or custom with localStorage
    │   └─ NO → Simple chunked upload
    └─ Show: Progress bar + speed + ETA
```

### When to Use Which Validation

```
What is the security level?
├─ Low (user avatars, comments)
│   └─ Extension + MIME type + size limit
├─ Medium (document uploads)
│   └─ Extension + MIME type + magic bytes + size limit
└─ High (code uploads, sensitive data)
    └─ All above + deep server-side inspection + virus scan
```

### When to Use Direct Upload vs Server Proxy

```
Is the file going to cloud storage (S3/GCS/Azure)?
├─ YES → Use presigned URLs for direct upload
│   └─ Why: Avoid bandwidth costs, reduce server load
└─ NO → Is the file small (< 10MB)?
    ├─ YES → Server proxy is acceptable
    └─ NO → Consider chunked upload with direct storage
```

### Choosing Progress Feedback

```
What is the expected upload duration?
├─ < 2 seconds → Spinner only
├─ 2-10 seconds → Progress bar
├─ 10-60 seconds → Progress bar + percentage
└─ > 60 seconds → Progress bar + percentage + speed + ETA + pause/cancel
```

---

## File Size Recommendations

| File Size | Upload Method | Chunk Size | Concurrency |
|-----------|---------------|------------|-------------|
| < 5MB | Single request | N/A | 1 |
| 5-50MB | Single request | N/A | 1 |
| 50-100MB | Chunked | 5MB | 3 |
| 100MB-1GB | Chunked + resumable | 10MB | 3-5 |
| > 1GB | Multipart S3 | 100MB | 3-5 |

---

## Presigned URL Expiration Guidelines

| Use Case | Recommended Expiration |
|----------|------------------------|
| Upload URL | 15-60 minutes |
| Download (streaming video) | 1-4 hours |
| Download (share link) | 24 hours max |
| Image preview | 15 minutes with auto-refresh |
| Background job | Match job timeout |

**Security Note:** Treat presigned URLs as bearer tokens. Anyone with the URL can perform the specified operation until it expires. Share only with intended recipients and prefer shorter expiration times when possible. AWS allows up to 7 days, but shorter is more secure.

---

## Anti-Patterns

### Anti-Pattern 1: Trusting File Extension Only

```typescript
// ANTI-PATTERN: Extension can be spoofed
const isValidImage = (file: File) => {
  return file.name.match(/\.(jpg|png|gif)$/i);
};
// malware.exe renamed to photo.jpg passes this check!
```

**Why it's wrong:** Users can rename any file to have any extension. A malicious executable renamed to `.jpg` will pass this check.

**What to do instead:**

```typescript
// CORRECT: Use magic bytes detection
const isValidImage = async (file: File) => {
  const buffer = await file.slice(0, 8).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Check for JPEG magic bytes
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return true;
  }
  // Check for PNG magic bytes
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    return true;
  }
  return false;
};
```

---

### Anti-Pattern 2: Not Cleaning Up Object URLs

```typescript
// ANTI-PATTERN: Memory leak
function ImagePreview({ file }: { file: File }) {
  // New URL created on every render, never revoked!
  const url = URL.createObjectURL(file);
  return <img src={url} />;
}
```

**Why it's wrong:** Each `createObjectURL` allocates memory. Without cleanup, memory grows unbounded, eventually crashing the browser.

**What to do instead:**

```typescript
// CORRECT: Cleanup on unmount
function ImagePreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  if (!url) return null;
  return <img src={url} alt="Preview" />;
}
```

---

### Anti-Pattern 3: Fake Progress Bars

```typescript
// ANTI-PATTERN: Fake progress
const [progress, setProgress] = useState(0);
useEffect(() => {
  const interval = setInterval(() => {
    setProgress((p) => Math.min(90, p + 10)); // Fake!
  }, 500);
  return () => clearInterval(interval);
}, []);
```

**Why it's wrong:** Deceives users about actual upload state. Bar stops at 90% and user has no idea what's happening.

**What to do instead:**

```typescript
// CORRECT: Real progress with XHR
const xhr = new XMLHttpRequest();
xhr.upload.addEventListener('progress', (e) => {
  if (e.lengthComputable) {
    setProgress(Math.round((e.loaded / e.total) * 100));
  }
});
```

**Note:** The Fetch API currently lacks native upload progress support. While streams can be used, they measure bytes taken from your stream, not actual network transmission (see [Jake Archibald's analysis](https://jakearchibald.com/2025/fetch-streams-not-for-progress/)). A native fetch progress API is in development by Igalia. Until then, use XHR for upload progress.

---

### Anti-Pattern 4: Exposing AWS Credentials

```typescript
// ANTI-PATTERN: Credentials in client code
import { S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  credentials: {
    accessKeyId: 'AKIAXXXXXXXX', // NEVER IN CLIENT CODE!
    secretAccessKey: 'xxxxxxxxxxxx',
  },
});
```

**Why it's wrong:** Anyone can view client-side JavaScript and steal credentials to access your entire S3 bucket.

**What to do instead:**

```typescript
// CORRECT: Request presigned URL from server
const response = await fetch('/api/upload/presign', {
  method: 'POST',
  body: JSON.stringify({ fileName, fileType, fileSize }),
});
const { uploadUrl } = await response.json();
await fetch(uploadUrl, { method: 'PUT', body: file });
```

---

### Anti-Pattern 5: No Keyboard Support

```typescript
// ANTI-PATTERN: Mouse-only dropzone
<div
  onDrop={handleDrop}
  onDragOver={(e) => e.preventDefault()}
  className="dropzone"
>
  Drop files here
</div>
// Cannot be accessed with keyboard!
```

**Why it's wrong:** Keyboard-only users and screen reader users cannot interact with this component.

**What to do instead:**

```typescript
// CORRECT: Full keyboard support
<div
  onDrop={handleDrop}
  onDragOver={(e) => e.preventDefault()}
  onClick={() => inputRef.current?.click()}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  }}
  role="button"
  tabIndex={0}
  aria-label="Upload files. Press Enter to browse."
>
  <input ref={inputRef} type="file" hidden />
  Drop files here or click to browse
</div>
```

---

### Anti-Pattern 6: Proxying Large Files Through Server

```typescript
// ANTI-PATTERN: Server proxy for large files
app.post('/upload', async (c) => {
  const file = await c.req.blob();
  await s3Client.send(new PutObjectCommand({ Body: file }));
  return c.json({ success: true });
});
// Server becomes bottleneck, pays bandwidth twice
```

**Why it's wrong:** Server must buffer entire file, uses double bandwidth (client→server + server→S3), and becomes a bottleneck.

**What to do instead:**

```typescript
// CORRECT: Presigned URL for direct upload
app.post('/upload/presign', async (c) => {
  const { fileName } = await c.req.json();
  const key = `uploads/${fileName}`;

  const url = await getSignedUrl(s3Client, new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }), { expiresIn: 3600 });

  return c.json({ uploadUrl: url, key });
});
// Client uploads directly to S3
```

---

### Anti-Pattern 7: No Upload Abort Capability

```typescript
// ANTI-PATTERN: Cannot cancel upload
const upload = async (file: File) => {
  await fetch('/upload', {
    method: 'POST',
    body: file,
  });
  // No way to cancel this!
};
```

**Why it's wrong:** If user navigates away or wants to cancel, the upload continues in background consuming resources.

**What to do instead:**

```typescript
// CORRECT: AbortController for cancellation
const abortController = useRef<AbortController | null>(null);

const upload = async (file: File) => {
  abortController.current = new AbortController();

  await fetch('/upload', {
    method: 'POST',
    body: file,
    signal: abortController.current.signal,
  });
};

const cancel = () => {
  abortController.current?.abort();
};
```

---

## Validation Priority Order

For security-critical uploads, validate in this order:

1. **Size limit** (fastest check, reject oversized immediately)
2. **Extension** (quick check, catch obvious mismatches)
3. **MIME type** (browser-provided, better than extension)
4. **Magic bytes** (read first 8-12 bytes, detect actual type)
5. **Server-side re-validation** (never trust client)
6. **Deep inspection** (for high-security: virus scan, content analysis)

---

## CORS Configuration for S3 Direct Upload

```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["PUT", "POST", "DELETE"],
      "AllowedOrigins": ["https://yourdomain.com"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}
```

**Note:** `ExposeHeaders: ["ETag"]` is required for multipart uploads to complete successfully.

**Cloudflare R2 Note:** R2 presigned URLs work similarly to S3 but do NOT support `POST` multipart form uploads via HTML forms. Use PUT with presigned URLs instead. R2 presigned URLs also cannot be used with custom domains - only the S3 API domain.

---

## Accessibility Checklist

| Requirement | Implementation |
|-------------|----------------|
| Keyboard navigation | `tabIndex={0}`, `role="button"`, Enter/Space handlers |
| Focus visible | `:focus-visible` CSS styles |
| Labels | `<label>` for inputs, `aria-label` for custom controls |
| Error announcements | `role="alert"` with `aria-live="polite"` |
| Progress announcements | `role="progressbar"` with `aria-valuenow` |
| Status updates | `role="status"` with `aria-live="polite"` |
| Required indication | Visual indicator + `aria-required="true"` |
| Disabled state | Visual styling + `aria-disabled="true"` |
| File list | `role="list"` with `role="listitem"` children |

---

## Quick Reference: Format Helpers

```typescript
const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * 1024;
const BYTES_PER_GB = BYTES_PER_MB * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`;
  if (bytes < BYTES_PER_MB) return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  if (bytes < BYTES_PER_GB) return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
  return `${(bytes / BYTES_PER_GB).toFixed(2)} GB`;
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * 60;

export function formatRemainingTime(seconds: number): string {
  if (seconds < SECONDS_PER_MINUTE) {
    return `${Math.ceil(seconds)}s`;
  }
  if (seconds < SECONDS_PER_HOUR) {
    return `${Math.ceil(seconds / SECONDS_PER_MINUTE)}m`;
  }
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.ceil((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  return `${hours}h ${minutes}m`;
}
```

---

## Checklist

- [ ] Files validated on BOTH client and server
- [ ] Magic bytes used for type detection (not just extension/MIME)
- [ ] Object URLs cleaned up on unmount/remove
- [ ] Keyboard support for dropzone (Enter/Space activation)
- [ ] ARIA labels and live regions for accessibility
- [ ] Progress feedback for uploads > 2 seconds
- [ ] Presigned URLs used for direct-to-S3 uploads
- [ ] Abort capability for all uploads
- [ ] Error states handled and communicated
- [ ] File input reset after selection (allows re-selecting)
