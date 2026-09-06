# Image Handling Reference

> Selection guides, constants, API comparison and browser support. Concepts and red flags are in
> [SKILL.md](SKILL.md); code is in [examples/](examples/).

---

## Selection guides

### Output format

```
Choosing an output format?
├─ Needs transparency?
│   ├─ YES → PNG (lossless) or WebP (lossy with alpha)
│   └─ NO  → Photographic content?
│       ├─ YES → JPEG, or WebP for smaller files at the same quality
│       └─ NO  → WebP; PNG where the result must be exact
├─ Animated?
│   └─ GIF (256 colours) or WebP (full colour, smaller)
└─ Must survive re-editing?
    └─ PNG — every lossy re-encode compounds
```

### Resize strategy

```
Resizing?
├─ Reducing by more than half?          → Step down in 2+ passes
├─ Aiming at a byte budget?             → Binary-search the quality parameter
├─ Producing several sizes at once?     → Decode once, draw at each size in parallel
└─ Anything else                        → One pass
```

### Where to run it

```
Processing cost?
├─ One image under ~5MB                 → Main thread is fine
├─ A batch, or anything large           → Web Worker with OffscreenCanvas
└─ User is waiting either way           → Show progress; a frozen tab reads as a crash
```

---

## Constants

```typescript
const CANVAS_LIMITS = {
  MAX_CANVAS_AREA: 268_435_456, // 16384 × 16384, or any equivalent product
  SAFE_MAX_DIMENSION: 4096, // holds across modern browsers
  MOBILE_SAFE_DIMENSION: 2048, // conservative for low-memory devices
};

const QUALITY_DEFAULTS = {
  JPEG_HIGH: 0.92,
  JPEG_GOOD: 0.85,
  JPEG_LOW: 0.7,
  WEBP_HIGH: 0.9, // WebP holds quality lower down the scale than JPEG
  WEBP_GOOD: 0.82,
  WEBP_LOW: 0.65,
  PNG: 1, // ignored
};

const SIZE_THRESHOLDS = {
  STEP_DOWN_THRESHOLD: 0.5,
  SKIP_RESIZE_TOLERANCE: 1.1, // already within 10% of target — leave it alone
  THUMBNAIL_SMALL: 100,
  THUMBNAIL_MEDIUM: 200,
  THUMBNAIL_LARGE: 400,
  PREVIEW_MAX: 1920,
};

const FILE_SIZE_LIMITS = {
  RECOMMENDED_UPLOAD_MAX: 10 * 1024 * 1024,
  AVATAR_MAX: 2 * 1024 * 1024,
  THUMBNAIL_TARGET: 50 * 1024,
  PREVIEW_TARGET: 200 * 1024,
};
```

---

## Method comparison

### Getting pixels from a `File`

| Method                       | Speed   | Memory | Produces      | Use for                        |
| ---------------------------- | ------- | ------ | ------------- | ------------------------------ |
| `URL.createObjectURL(file)`  | Instant | Low    | A URL string  | Display; needs revoking        |
| `createImageBitmap(file)`    | Fast    | Medium | `ImageBitmap` | Canvas work; needs `close()`   |
| `FileReader.readAsDataURL()` | Slow    | High   | Base64 string | Only when a string is required |

### Getting pixels out of a canvas

| Method                    | Async | Produces      | Quality arg | Use for                    |
| ------------------------- | ----- | ------------- | ----------- | -------------------------- |
| `toBlob()`                | Yes   | `Blob`        | Yes         | Anything you send or store |
| `toDataURL()`             | No    | Base64 string | Yes         | Small inline images        |
| `convertToBlob()`         | Yes   | `Blob`        | Yes         | `OffscreenCanvas`          |
| `transferToImageBitmap()` | No    | `ImageBitmap` | No          | Handing pixels to a worker |

### Smoothing quality

| Setting                           | Cost     | Result     | Use for            |
| --------------------------------- | -------- | ---------- | ------------------ |
| `imageSmoothingEnabled: false`    | Cheapest | Pixelated  | Pixel art, icons   |
| `imageSmoothingQuality: 'low'`    | Cheap    | Acceptable | Thumbnails         |
| `imageSmoothingQuality: 'medium'` | Medium   | Good       | Intermediate steps |
| `imageSmoothingQuality: 'high'`   | Slowest  | Best       | Final output       |

---

## EXIF orientation

| Value | Meaning                   | Transform                |
| ----- | ------------------------- | ------------------------ |
| 1     | Normal                    | None                     |
| 2     | Horizontal flip           | Mirror X                 |
| 3     | 180° rotation             | Rotate 180               |
| 4     | Vertical flip             | Mirror Y                 |
| 5     | 90° CW + horizontal flip  | Rotate 90 CW + Mirror X  |
| 6     | 90° CW                    | Rotate 90 CW             |
| 7     | 90° CCW + horizontal flip | Rotate 90 CCW + Mirror X |
| 8     | 90° CCW                   | Rotate 90 CCW            |

Values 5–8 swap width and height, so the canvas has to be sized transposed before drawing.

| Source                 | Typical values               |
| ---------------------- | ---------------------------- |
| Phone, portrait        | 6                            |
| Phone, landscape       | 1 or 3                       |
| Camera, portrait       | 6 or 8                       |
| Camera, landscape      | 1                            |
| Scanned or re-exported | 1 — EXIF is usually stripped |

---

## Browser support

**Everywhere modern**

- `URL.createObjectURL()` / `revokeObjectURL()`, `FileReader`
- Canvas 2D context, `toBlob()`, `toDataURL()`
- `image-orientation: from-image` as the default — baseline since April 2020
- WebP encoding via `toBlob()`, including Safari 14+

**Widely available, worth feature-detecting**

- `createImageBitmap()`, canvas `filter`, `imageSmoothingQuality`
- `OffscreenCanvas` — baseline since March 2023

**Not available**

- AVIF encoding from a canvas. Decoding works; encoding needs a WebAssembly encoder.

```typescript
const supportsImageBitmap = "createImageBitmap" in window;
const supportsOffscreenCanvas = "OffscreenCanvas" in window;

async function supportsWebPEncoding(): Promise<boolean> {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}
```

Cache the result of a runtime encoding check — it costs a canvas allocation each time.
