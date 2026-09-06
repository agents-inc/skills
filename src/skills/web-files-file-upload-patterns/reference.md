# File Upload Reference

> Selection guides, expiry and CORS notes, and a review checklist. Concepts and red flags are in
> [SKILL.md](SKILL.md); code is in [examples/](examples/).

---

## Selection guides

### Upload method

```
How big is the file?
├─ Under 5MB          → One request; a spinner is enough feedback
├─ 5MB to 100MB       → One request via XHR, with a real progress bar
└─ Over 100MB         → Chunked
    ├─ Must survive a reload or a dropped connection?
    │   ├─ YES → tus, or your own chunking with persisted progress
    │   └─ NO  → Plain chunked upload
    └─ Show progress, speed and remaining time
```

| Size      | Method             | Chunk size | Concurrency |
| --------- | ------------------ | ---------- | ----------- |
| < 5MB     | Single request     | —          | 1           |
| 5–50MB    | Single request     | —          | 1           |
| 50–100MB  | Chunked            | 5MB        | 3           |
| 100MB–1GB | Chunked, resumable | 10MB       | 3–5         |
| > 1GB     | Multipart          | 100MB      | 3–5         |

### How much validation

```
What does a bad file cost here?
├─ Little — an avatar, an attachment on a comment
│   └─ Extension, MIME type, size
├─ Something — a document others will open
│   └─ The above plus magic bytes
└─ A great deal — anything executed, or shared widely
    └─ The above plus server-side inspection and a malware scan
```

### Direct or proxied

```
Is the destination object storage?
├─ YES → Presigned URL, uploaded to directly
│         (no request body through your application, no double bandwidth)
└─ NO  → Under 10MB?
    ├─ YES → Straight to your endpoint
    └─ NO  → Chunk it, or put storage in front
```

### Progress feedback

| Expected duration | Show                                              |
| ----------------- | ------------------------------------------------- |
| Under 2s          | A spinner                                         |
| 2–10s             | A progress bar                                    |
| 10–60s            | Progress bar with a percentage                    |
| Over 60s          | Percentage, speed, remaining time, cancel, resume |

---

## Presigned URL expiry

| Use                  | Lifetime                        |
| -------------------- | ------------------------------- |
| Upload               | 15–60 minutes                   |
| Streaming download   | 1–4 hours                       |
| Shared download link | 24 hours at most                |
| Image preview        | 15 minutes, refreshed on demand |
| Background job       | The job's own timeout           |

A presigned URL is a bearer token: whoever holds it can perform that operation until it expires, so
it is as sensitive as the thing it grants. Providers commonly permit lifetimes measured in days;
that ceiling is not a recommendation.

---

## Validation order

Cheapest first, so an obviously wrong file is rejected without reading anything:

1. **Size** — a property already in memory
2. **Extension** — a string comparison
3. **MIME type** — what the browser reports, still just metadata
4. **Magic bytes** — the first read of the file, and only 12 bytes of it
5. **Server-side, all of the above again** — the only step that is a control
6. **Deep inspection** — scanning or parsing, where the content warrants it

Code: [examples/validation.md](examples/validation.md).

---

## CORS for direct-to-storage uploads

A browser upload to a different origin needs the bucket to permit it:

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

`ExposeHeaders: ["ETag"]` is what makes a multipart upload possible at all — without it the browser
hides the header, `getResponseHeader("ETag")` reads `null`, and the completion call has nothing to
send. `AllowedOrigins` should name your origins rather than `*`, since the rule is what stops
another site posting to your bucket with a leaked URL.

Not every object store accepts browser POST form uploads; some support presigned PUT only, and some
refuse presigned URLs on custom domains. Confirm both before designing a flow around them.

---

## Review checklist

- [ ] The server validates everything the client validated
- [ ] Type checks read magic bytes, not just the extension and MIME type
- [ ] Every object URL has a matching revoke
- [ ] The dropzone works from the keyboard, and the click path works on mobile
- [ ] Selection, progress and failure are announced, not only drawn
- [ ] Anything over two seconds shows real progress
- [ ] Every upload can be cancelled
- [ ] Presigned URLs are issued server-side, scoped to a key prefix, and short-lived
- [ ] The file input's value is cleared after each selection
- [ ] Incomplete multipart uploads expire on a lifecycle rule

Formatters for the progress figures: [examples/progress.md](examples/progress.md).
