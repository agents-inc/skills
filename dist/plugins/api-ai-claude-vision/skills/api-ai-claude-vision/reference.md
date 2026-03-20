# Claude Vision Quick Reference

> Supported formats, content block types, size limits, token costs, and API structure. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Supported Image Formats

| Format | Media Type   | Notes                       |
| ------ | ------------ | --------------------------- |
| JPEG   | `image/jpeg` | Most common, lossy          |
| PNG    | `image/png`  | Lossless, supports alpha    |
| GIF    | `image/gif`  | Animated GIFs: first frame  |
| WebP   | `image/webp` | Modern format, good quality |

---

## Supported Document Formats

| Format | Media Type        | Content Block Type |
| ------ | ----------------- | ------------------ |
| PDF    | `application/pdf` | `document`         |

---

## Content Block Types

### Image Block (for JPEG, PNG, GIF, WebP)

```typescript
// Base64 source
{
  type: "image",
  source: {
    type: "base64",
    media_type: "image/jpeg", // or image/png, image/gif, image/webp
    data: "base64-encoded-string"
  }
}

// URL source
{
  type: "image",
  source: {
    type: "url",
    url: "https://example.com/photo.jpg"
  }
}

// Files API source (beta)
{
  type: "image",
  source: {
    type: "file",
    file_id: "file_abc123"
  }
}
```

### Document Block (for PDFs)

```typescript
// Base64 source
{
  type: "document",
  source: {
    type: "base64",
    media_type: "application/pdf",
    data: "base64-encoded-string"
  }
}

// URL source
{
  type: "document",
  source: {
    type: "url",
    url: "https://example.com/report.pdf"
  }
}

// Files API source (beta)
{
  type: "document",
  source: {
    type: "file",
    file_id: "file_abc123"
  }
}

// With prompt caching
{
  type: "document",
  source: {
    type: "base64",
    media_type: "application/pdf",
    data: "base64-encoded-string"
  },
  cache_control: { type: "ephemeral" }
}
```

---

## Size Limits

### Images

| Constraint                 | Limit                   |
| -------------------------- | ----------------------- |
| Max image dimensions       | 8000x8000 px            |
| Max with 20+ images        | 2000x2000 px per image  |
| Max file size (API)        | 5 MB per image          |
| Max file size (claude.ai)  | 10 MB per image         |
| Max images per request     | 600 (100 for 200K ctx)  |
| Long edge auto-resize      | 1568 px                 |
| Max megapixels (no resize) | ~1.15 MP                |
| Min recommended dimensions | 200 px on shortest edge |

### PDFs

| Constraint            | Limit                   |
| --------------------- | ----------------------- |
| Max request size      | 32 MB                   |
| Max pages per request | 600 (100 for 200K ctx)  |
| Format requirement    | Standard (no passwords) |

---

## Image Token Calculation

### Formula

```
tokens = (width_px * height_px) / 750
```

If the image's long edge exceeds 1568px or exceeds ~1.15 megapixels, Claude auto-resizes it (preserving aspect ratio) before applying the formula.

### Token/Cost Table (Claude Sonnet 4.6 at $3/M input tokens)

| Image Size                      | Tokens | Cost/Image | Cost/1K Images |
| ------------------------------- | ------ | ---------- | -------------- |
| 200x200 px (0.04 MP)            | ~54    | ~$0.00016  | ~$0.16         |
| 1000x1000 px (1 MP)             | ~1,334 | ~$0.004    | ~$4.00         |
| 1092x1092 px (1.19 MP, max 1:1) | ~1,590 | ~$0.0048   | ~$4.80         |

### Max Sizes Without Auto-Resize (Common Aspect Ratios)

| Aspect Ratio | Max Size  | Tokens |
| ------------ | --------- | ------ |
| 1:1          | 1092x1092 | ~1,590 |
| 3:4          | 951x1268  | ~1,608 |
| 2:3          | 896x1344  | ~1,605 |
| 9:16         | 819x1456  | ~1,590 |
| 1:2          | 784x1568  | ~1,641 |

### PDF Token Costs

| Component       | Tokens per Page        |
| --------------- | ---------------------- |
| Text extraction | ~1,500-3,000           |
| Page image      | Same formula as images |
| Total           | Text + image tokens    |

---

## Image Source Types Summary

| Source Type | When to Use                         | Payload Impact       |
| ----------- | ----------------------------------- | -------------------- |
| `base64`    | Local files, generated images       | Large (full data)    |
| `url`       | Publicly hosted images              | Small (URL only)     |
| `file`      | Repeated use across requests (beta) | Small (file_id only) |

---

## Vision Limitations

| Limitation             | Details                                            |
| ---------------------- | -------------------------------------------------- |
| People identification  | Claude refuses to name specific people             |
| Spatial reasoning      | Approximate -- struggles with precise localization |
| Object counting        | Approximate, especially with many small objects    |
| Image generation       | Not supported -- understanding only                |
| Image editing          | Not supported -- understanding only                |
| Metadata/EXIF          | Not parsed or accessible                           |
| AI-generated detection | Cannot reliably detect synthetic images            |
| Medical imaging        | Not designed for diagnostic scans (CTs, MRIs)      |
| Rotated/blurry images  | May produce inaccurate results                     |
