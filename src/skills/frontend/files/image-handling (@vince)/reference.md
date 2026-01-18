# Image Handling Reference

> Decision frameworks, constants reference, and anti-patterns for image handling.

---

## Decision Framework

### Preview Method Selection

```
Need to display image preview?
├─ Need URL string only (for <img src>)?
│   └─ YES → URL.createObjectURL() - fastest, most memory efficient
└─ Need Base64 data URL?
    └─ YES → FileReader.readAsDataURL() - slower, creates large string
```

### Resize Strategy Selection

```
Need to resize image?
├─ Reduction > 50% of original size?
│   ├─ YES → Step-down scaling (2+ passes)
│   └─ NO → Single-pass resize
├─ Need specific file size target?
│   └─ YES → Binary search quality targeting
└─ Need thumbnails?
    └─ YES → Generate smallest size first, or all in parallel
```

### Format Selection

```
Choosing output format?
├─ Has transparency?
│   ├─ YES → PNG (lossless) or WebP (lossy with alpha)
│   └─ NO → Is photo content?
│       ├─ YES → JPEG (best compression for photos)
│       └─ NO → WebP (best overall) if supported, else JPEG
├─ Need animation?
│   └─ YES → GIF (limited colors) or WebP (better quality)
└─ Need best quality?
    └─ YES → PNG (lossless, large file)
```

### Processing Strategy

```
Need to process image?
├─ Image > 5MB or processing multiple images?
│   └─ YES → Consider Web Worker (prevents UI freeze)
├─ User waiting for result?
│   └─ YES → Show progress indicator
└─ Processing in background?
    └─ YES → Queue operations, process sequentially
```

---

## Constants Reference

### Browser Limits

```typescript
// Canvas dimension limits vary by browser/device
const CANVAS_LIMITS = {
  MAX_CANVAS_AREA: 268435456,      // 16384 x 16384 or equivalent
  SAFE_MAX_DIMENSION: 4096,        // Works on all modern browsers
  MOBILE_SAFE_DIMENSION: 2048,     // Conservative mobile limit
  IOS_SAFARI_MAX: 4096,            // iOS Safari specific
};
```

### Quality Defaults

```typescript
const QUALITY_DEFAULTS = {
  JPEG_HIGH: 0.92,      // Near-lossless
  JPEG_GOOD: 0.85,      // Good balance
  JPEG_LOW: 0.70,       // Smaller files
  WEBP_HIGH: 0.90,      // WebP is more efficient
  WEBP_GOOD: 0.82,
  WEBP_LOW: 0.65,
  PNG: 1,               // PNG is lossless - quality ignored
};
```

### Size Thresholds

```typescript
const SIZE_THRESHOLDS = {
  STEP_DOWN_THRESHOLD: 0.5,     // Use step-down below 50% reduction
  SKIP_RESIZE_TOLERANCE: 1.1,   // Skip if within 10% of target
  THUMBNAIL_SMALL: 100,         // Small thumbnail
  THUMBNAIL_MEDIUM: 200,        // Medium thumbnail
  THUMBNAIL_LARGE: 400,         // Large thumbnail
  PREVIEW_MAX: 1920,            // Max preview dimension
};
```

### File Size Limits

```typescript
const FILE_SIZE_LIMITS = {
  RECOMMENDED_UPLOAD_MAX: 10 * 1024 * 1024,  // 10MB
  AVATAR_MAX: 2 * 1024 * 1024,               // 2MB
  THUMBNAIL_TARGET: 50 * 1024,               // 50KB
  PREVIEW_TARGET: 200 * 1024,                // 200KB
};
```

---

## Method Comparison

### Preview Methods

| Method | Speed | Memory | Output | Use Case |
|--------|-------|--------|--------|----------|
| `URL.createObjectURL(file)` | Instant | Low | URL string | Display only |
| `FileReader.readAsDataURL()` | Slow | High | Base64 string | Need data in JS |
| `createImageBitmap(file)` | Fast | Medium | ImageBitmap | Canvas operations |

### Canvas Output Methods

| Method | Async | Output | Quality Param | Use Case |
|--------|-------|--------|---------------|----------|
| `toBlob()` | Yes | Blob | Yes | Upload, further processing |
| `toDataURL()` | No | Base64 string | Yes | Inline in HTML/CSS |
| `transferToImageBitmap()` | No | ImageBitmap | No | OffscreenCanvas |

### Smoothing Quality

| Setting | Performance | Quality | Use Case |
|---------|-------------|---------|----------|
| `imageSmoothingEnabled: false` | Fastest | Pixelated | Pixel art, icons |
| `imageSmoothingQuality: 'low'` | Fast | Acceptable | Thumbnails |
| `imageSmoothingQuality: 'medium'` | Medium | Good | General use |
| `imageSmoothingQuality: 'high'` | Slow | Best | Final output |

---

## EXIF Orientation Reference

### Orientation Values

| Value | Description | Transform Needed |
|-------|-------------|------------------|
| 1 | Normal | None |
| 2 | Horizontal flip | Mirror X |
| 3 | 180 rotate | Rotate 180 |
| 4 | Vertical flip | Mirror Y |
| 5 | 90 CW + horizontal flip | Rotate 90 CW + Mirror X |
| 6 | 90 CW | Rotate 90 CW |
| 7 | 90 CCW + horizontal flip | Rotate 90 CCW + Mirror X |
| 8 | 90 CCW | Rotate 90 CCW |

### Common Sources

| Device/Source | Typical Orientations |
|---------------|---------------------|
| iPhone portrait | 6 (rotated 90 CW) |
| iPhone landscape left | 3 (rotated 180) |
| iPhone landscape right | 1 (normal) |
| Android varies | 1, 3, 6, 8 |
| DSLR landscape | 1 (normal) |
| DSLR portrait | 6 or 8 |
| Scanner | 1 (normal) |

---

## Anti-Patterns

### Memory Leaks

```typescript
// BAD: Object URL never revoked
function BadPreview({ file }: { file: File }) {
  const url = URL.createObjectURL(file);
  return <img src={url} />;
  // Memory leak - URL accumulates on each render
}

// GOOD: Cleanup in effect
function GoodPreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url ? <img src={url} /> : null;
}
```

### Canvas Size Overflow

```typescript
// BAD: May exceed browser limits
async function badResize(file: File) {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.width * 2;  // Could be 10000+ pixels
  canvas.height = img.height * 2;
  // May crash or silently fail
}

// GOOD: Clamp to safe limits
const MAX_DIMENSION = 4096;

async function goodResize(file: File) {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(img.width * 2, MAX_DIMENSION);
  canvas.height = Math.min(img.height * 2, MAX_DIMENSION);
}
```

### Single-Pass Large Reduction

```typescript
// BAD: Single pass loses quality
async function badThumbnail(file: File) {
  const img = await loadImage(file);  // 4000x3000
  const canvas = document.createElement('canvas');
  canvas.width = 100;  // 97.5% reduction in one pass!
  canvas.height = 75;
  ctx.drawImage(img, 0, 0, 100, 75);
  // Result: blurry, aliased
}

// GOOD: Step-down scaling
async function goodThumbnail(file: File) {
  const img = await loadImage(file);  // 4000x3000

  // Step 1: 4000 -> 400
  let canvas = createCanvas(400, 300);
  canvas.ctx.drawImage(img, 0, 0, 400, 300);

  // Step 2: 400 -> 100
  const final = createCanvas(100, 75);
  final.ctx.drawImage(canvas, 0, 0, 100, 75);
  // Result: sharp, properly sampled
}
```

### EXIF Orientation (Modern Browsers Auto-Handle)

```typescript
// Modern browsers (2020+): No manual handling needed for display!
// image-orientation: from-image is the default CSS

// GOOD: Modern browsers auto-rotate
function modernDisplay(file: File) {
  const url = URL.createObjectURL(file);
  return <img src={url} />;  // Browser handles EXIF rotation automatically
}

// BAD: Double rotation in modern browsers
async function doubleRotation(file: File) {
  const normalized = await normalizeOrientation(file);  // Rotates once
  const url = URL.createObjectURL(normalized);
  return <img src={url} />;  // Browser rotates again = wrong!
}

// GOOD: Manual handling ONLY for output files or Node.js
async function prepareForUpload(file: File) {
  // Normalize orientation for server that doesn't handle EXIF
  const normalized = await normalizeOrientation(file);
  await uploadToServer(normalized);
}

// GOOD: Bypass auto-rotation when needed
function rawOrientation(file: File) {
  const url = URL.createObjectURL(file);
  return (
    <img
      src={url}
      style={{ imageOrientation: 'none' }}  // Show raw without auto-rotation
    />
  );
}
```

### Main Thread Blocking

```typescript
// BAD: UI freezes during processing
async function badProcess(files: File[]) {
  for (const file of files) {
    await resizeImage(file);  // Blocks main thread
  }
}

// GOOD: Yield to main thread
async function goodProcess(files: File[]) {
  for (const file of files) {
    await resizeImage(file);
    await new Promise(resolve => setTimeout(resolve, 0));  // Yield
  }
}

// BETTER: Use Web Worker for heavy processing
// (See Web Worker patterns in advanced examples)
```

### DataURL for Large Images

```typescript
// BAD: Creates massive string in memory
async function badLargePreview(file: File) {
  const reader = new FileReader();
  return new Promise(resolve => {
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);  // 10MB file = 13MB+ string
  });
}

// GOOD: Use object URL
function goodLargePreview(file: File) {
  return URL.createObjectURL(file);  // Just a reference
}
```

---

## Browser Compatibility

### Well Supported (All Modern Browsers)

- `URL.createObjectURL()` / `revokeObjectURL()`
- `FileReader` API
- Canvas `toBlob()` / `toDataURL()`
- `canvas.getContext('2d')`
- `image-orientation: from-image` (auto EXIF rotation) - Baseline since April 2020

### Good Support (Modern Browsers, Not IE)

- `createImageBitmap()` - Chrome 50+, Firefox 42+, Safari 15+
- Canvas `filter` property - Chrome 52+, Firefox 49+, Safari 9.1+
- `imageSmoothingQuality` - Chrome 54+, Firefox 51+, Safari 10+
- Canvas auto-EXIF rotation - Chrome 81+, Firefox 78+, Safari 14+

### Good Support (2023+)

- `OffscreenCanvas` - Chrome 69+, Firefox 105+, Safari 16.4+ (widely available now)
- WebP encoding via `toBlob()` - All modern browsers including Safari 14+

### Limited Support

- AVIF encoding via `toBlob()` - Chrome 121+, Firefox 113+ (Safari not yet)

### Feature Detection

```typescript
// Check createImageBitmap support
const supportsImageBitmap = 'createImageBitmap' in window;

// Check OffscreenCanvas support
const supportsOffscreenCanvas = 'OffscreenCanvas' in window;

// Check WebP encoding support (runtime check)
async function supportsWebPEncoding(): Promise<boolean> {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
}
```

---

## Performance Guidelines

### Do

- Use `URL.createObjectURL()` for previews (fastest, lowest memory)
- Cleanup object URLs in useEffect return
- Use `createImageBitmap()` when available (better for Canvas)
- Use step-down scaling for large reductions (>50%)
- Process images in Web Workers for large files or batches
- Use `toBlob()` instead of `toDataURL()` for large images
- Set `imageSmoothingQuality: 'high'` for final output
- Cache format support detection results

### Avoid

- Creating object URLs in render function
- Forgetting to revoke object URLs
- Single-pass large reductions
- Processing large images on main thread
- Using `toDataURL()` for files >1MB
- Canvas dimensions >4096px
- Manual EXIF rotation in modern browsers (causes double-rotation)
- Re-processing already-optimized images
