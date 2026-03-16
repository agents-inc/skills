---
name: web-files-image-handling
description: Client-side image handling - preview generation, Canvas API resizing, compression, EXIF orientation, format conversion, memory management with object URL cleanup
---

# Image Handling Patterns

> **Quick Guide:** Use `URL.createObjectURL()` for image previews (most efficient). Resize/compress with Canvas API before upload. Always cleanup object URLs with `URL.revokeObjectURL()` to prevent memory leaks. Handle EXIF orientation for mobile photos only when processing for upload (modern browsers auto-rotate for display). Use step-down scaling for quality preservation on large reductions.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST cleanup object URLs with `URL.revokeObjectURL()` in useEffect cleanup or when replacing URLs)**

**(You MUST check browser context before applying EXIF orientation - modern browsers auto-rotate, manual handling causes double rotation)**

**(You MUST use step-down scaling when reducing images by more than 50% - single-pass resize loses quality)**

**(You MUST limit canvas dimensions to browser maximums (typically 4096px) - larger canvases crash browsers)**

</critical_requirements>

---

**Auto-detection:** image preview, URL.createObjectURL, revokeObjectURL, canvas resize, image compression, EXIF orientation, toBlob, toDataURL, FileReader image, image thumbnail, client-side resize, image crop, canvas drawImage, createImageBitmap, image quality

**When to use:**

- Creating image previews before upload
- Resizing or compressing images client-side
- Handling EXIF orientation from mobile photos
- Converting between image formats (JPEG/PNG/WebP)
- Generating thumbnails from user-selected images
- Implementing image cropping interfaces

**When NOT to use:**

- Server-side image processing (not client-side scope)
- Image CDN/optimization services (infrastructure concern)
- Complex image editing (consider dedicated libraries like Fabric.js or Konva)

---

<philosophy>

## Philosophy

Client-side image handling improves UX by providing instant previews and reducing upload sizes before they hit your server. The key insight is that **preview and processing have different optimal approaches** - `URL.createObjectURL()` for previews (fast, memory-efficient), Canvas API for processing (resize, compress, convert).

**Core Principles:**

1. **Object URLs for preview** - No file reading, instant display, must cleanup
2. **Canvas for processing** - Resize, compress, convert formats
3. **Memory management is critical** - Leaked object URLs accumulate indefinitely
4. **EXIF awareness** - Modern browsers auto-rotate for display; manual handling only for upload processing
5. **Progressive quality** - Step-down scaling preserves sharpness on large reductions

**Preview Method Comparison:**

| Method                       | Speed   | Memory             | Use Case             |
| ---------------------------- | ------- | ------------------ | -------------------- |
| `URL.createObjectURL()`      | Instant | Low (reference)    | Display previews     |
| `FileReader.readAsDataURL()` | Slow    | High (full Base64) | Need data URL string |
| Canvas `toDataURL()`         | Medium  | Medium             | After processing     |

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Object URL Preview with Cleanup

Use `URL.createObjectURL()` for instant image previews. **Always cleanup** to prevent memory leaks. The critical pattern is revoking the previous URL before creating a new one, and revoking in the useEffect cleanup.

```typescript
// The essential cleanup pattern
useEffect(() => {
  const url = URL.createObjectURL(file);
  setPreviewUrl(url);
  return () => URL.revokeObjectURL(url); // MUST cleanup
}, [file]);
```

**Why good:** Instant preview without reading file into memory, cleanup prevents memory leaks

```typescript
// BAD: No cleanup - memory leak
const [preview] = useState(() => URL.createObjectURL(file));
// URL never revoked - memory accumulates indefinitely!
```

**Why bad:** Object URL never revoked, browser holds blob reference indefinitely, compounds with each file selection

See [examples/core.md](examples/core.md) Pattern 1-2 for complete hook and component implementations.

---

### Pattern 2: Canvas Resize with Quality Preservation

Resize images using Canvas API. Key concerns: clamp dimensions to browser limits (4096px safe max), enable `imageSmoothingQuality: "high"`, fill white background for JPEG (transparency becomes black otherwise).

```typescript
const MAX_CANVAS_DIMENSION = 4096;

// Clamp to browser limits, maintain aspect ratio
const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
const width = Math.round(img.width * Math.min(ratio, 1));
const height = Math.round(img.height * Math.min(ratio, 1));

ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";
if (mimeType === "image/jpeg") {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height); // White bg for JPEG
}
ctx.drawImage(img, 0, 0, width, height);
```

See [examples/core.md](examples/core.md) Pattern 3 for dimension validation, [examples/canvas.md](examples/canvas.md) for complete resize pipeline.

---

### Pattern 3: Step-Down Scaling

For reductions >50%, scale in multiple passes to preserve sharpness. A 4000px to 100px single-pass resize produces blurry results; two intermediate steps maintain quality.

```typescript
const STEP_DOWN_THRESHOLD = 0.5;
const reductionRatio = targetWidth / img.width;

if (reductionRatio < STEP_DOWN_THRESHOLD) {
  // Multi-pass: 4000 -> 400 -> 100 (two steps)
  const factor = Math.pow(targetWidth / img.width, 1 / steps);
  for (let i = 0; i < steps; i++) {
    /* scale by factor each step */
  }
} else {
  // Single-pass is fine for small reductions
}
```

See [examples/canvas.md](examples/canvas.md) Pattern 1 for complete step-down implementation with automatic strategy selection.

---

### Pattern 4: EXIF Orientation

**Modern browsers (2020+) auto-rotate images for display** via CSS `image-orientation: from-image` (default). Manual EXIF handling is only needed when:

- Processing images for upload (server may strip EXIF and not rotate)
- Using Node.js canvas (no auto-rotation)
- Needing to detect orientation programmatically

```typescript
// For DISPLAY: modern browsers handle it - do nothing
<img src={URL.createObjectURL(file)} /> // Auto-rotated

// For UPLOAD PROCESSING: normalize before sending to server
const orientation = await getExifOrientation(file); // Read from JPEG header
if (orientation !== 1) {
  const normalized = await normalizeOrientation(file);
  await uploadToServer(normalized);
}

// To BYPASS auto-rotation (show raw orientation)
<img src={url} style={{ imageOrientation: 'none' }} />
```

**Gotcha:** Applying `normalizeOrientation()` then displaying via `<img>` causes double-rotation in modern browsers.

See [examples/core.md](examples/core.md) Pattern 4 for EXIF parsing implementation.

---

### Pattern 5: Format Conversion

Convert between JPEG/PNG/WebP with format-appropriate quality defaults. Key detail: JPEG cannot represent transparency, so fill white background before conversion.

```typescript
const FORMAT_QUALITY_DEFAULTS: Record<string, number> = {
  "image/jpeg": 0.85,
  "image/webp": 0.82,
  "image/png": 1, // Lossless - quality param ignored
};
```

WebP is supported in all modern browsers (including Safari 14+). For target file size, use binary search over quality parameter.

See [examples/canvas.md](examples/canvas.md) Pattern 2 for binary search quality targeting.

---

### Pattern 6: Cropping

Canvas-based cropping using `drawImage()` with source rectangle parameters. Validate crop region is within image bounds, support resize-during-crop for generating specific output dimensions.

```typescript
// drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)
ctx.drawImage(
  img,
  cropX,
  cropY,
  cropWidth,
  cropHeight,
  0,
  0,
  outputWidth,
  outputHeight,
);
```

See [examples/canvas.md](examples/canvas.md) Pattern 3 for complete crop implementation with aspect ratio helper.

</patterns>

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Preview hooks, components, dimension validation, EXIF parsing
- [examples/preview.md](examples/preview.md) - Drag-and-drop, thumbnails, gallery grid
- [examples/canvas.md](examples/canvas.md) - Resize pipeline, target-size compression, cropping, watermarks, filters
- [reference.md](reference.md) - Decision frameworks, constants reference, browser compatibility, anti-patterns

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Not calling `URL.revokeObjectURL()` - causes memory leaks that accumulate indefinitely
- Canvas dimensions exceeding 4096px - crashes browser tab or silently fails
- Double EXIF rotation - applying manual rotation in browsers that auto-rotate (all modern browsers since 2020)

**Medium Priority Issues:**

- Using `FileReader.readAsDataURL()` for preview - slow and memory-intensive vs object URLs
- Single-pass resize for large reductions (>50%) - results in blurry/aliased images
- Creating object URLs inside render functions - creates new URL every render cycle

**Gotchas & Edge Cases:**

- Object URLs persist until page unload even without cleanup (but waste memory)
- Canvas `toBlob()` is async, `toDataURL()` is sync - prefer toBlob for performance
- PNG with transparency converted to JPEG needs white background fill (otherwise black)
- Very large images may exceed WebGL limits even within canvas dimension limits
- Node.js canvas does NOT auto-rotate EXIF - still needs manual handling server-side
- Use `image-orientation: none` CSS to bypass browser auto-rotation when needed

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST cleanup object URLs with `URL.revokeObjectURL()` in useEffect cleanup or when replacing URLs)**

**(You MUST check browser context before applying EXIF orientation - modern browsers auto-rotate, manual handling causes double rotation)**

**(You MUST use step-down scaling when reducing images by more than 50% - single-pass resize loses quality)**

**(You MUST limit canvas dimensions to browser maximums (typically 4096px) - larger canvases crash browsers)**

**Failure to follow these rules will cause memory leaks, browser crashes, and poor image quality.**

</critical_reminders>
