---
name: web-files-image-handling
description: Client-side image handling - preview generation, Canvas API resizing, compression, EXIF orientation, format conversion, memory management with object URL cleanup
---

# Image Handling Patterns

> **Quick Guide:** Two different jobs with two different tools. Displaying an image means
> `URL.createObjectURL()` and revoking it afterwards — the browser already applies EXIF rotation, so
> rotating manually rotates twice. Processing an image means Canvas: clamp to 4096px, scale in
> multiple passes for reductions past 50%, fill white before writing JPEG, and prefer the async
> `toBlob()` over `toDataURL()`.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — the shared `loadImage` helper, preview hook and component, dimension extraction and validation, EXIF parsing, gallery state
- [examples/preview.md](examples/preview.md) — parallel thumbnail sets, gallery grid
- [examples/canvas.md](examples/canvas.md) — the resize pipeline, target-size compression, cropping, watermarks, filters
- [reference.md](reference.md) — format and strategy selection, constants, method comparison, EXIF values, browser support

---

## Which path applies

The two paths disagree about EXIF, which is where most of the bugs are.

- **Displaying to the user** — object URL straight into `<img>`, revoked when it is replaced or
  unmounted. The browser rotates for you; do nothing about orientation. Start at
  [examples/core.md](examples/core.md).
- **Processing before sending elsewhere** — Canvas resize, compress, convert or crop. Nothing here
  rotates for you, so normalise orientation explicitly and never display the result without
  suppressing the browser's own rotation. Start at [examples/canvas.md](examples/canvas.md).

---

<critical_requirements>

## Before writing image-handling code

**Revoke every object URL — on unmount, and before creating the replacement.** Each
`createObjectURL` pins its blob in memory until revoked, so a picker the user changes their mind in
leaks a full image per attempt.

**Decide which path you are on before touching orientation.** Browsers have defaulted to
`image-orientation: from-image` since 2020, so normalising for display rotates the image twice;
normalise only for bytes that leave the browser.

**Clamp canvas dimensions to 4096px.** Past that the canvas fails silently or takes the tab down,
and the limit is lower again on mobile.

**Scale in multiple passes when reducing by more than half.** One-pass downsampling undersamples
and produces a soft, aliased result; two intermediate steps keep it sharp.

</critical_requirements>

---

**Auto-detection:** URL.createObjectURL, URL.revokeObjectURL, createImageBitmap, OffscreenCanvas,
canvas.toBlob, canvas.toDataURL, convertToBlob, ctx.drawImage, imageSmoothingQuality,
image-orientation, EXIF orientation, 0x0112, FileReader.readAsDataURL, naturalWidth, image/webp,
step-down scaling, thumbnail generation, client-side resize, image crop

**Applies to:**

- Showing a preview of an image the user has chosen
- Resizing, compressing or converting an image in the browser
- Reading and normalising EXIF orientation
- Generating thumbnails, cropping, watermarking, applying filters
- Validating dimensions and aspect ratio before doing anything else

**Handled elsewhere:**

- Choosing files and transferring them — this skill starts from a `File` or `Blob` you already hold
- Resizing or transcoding on a server, and URL-based transformation services
- An interactive editing surface with layers, selections and undo, which wants a canvas library
  rather than raw Canvas calls

---

<philosophy>

## Philosophy

Preview and processing pull in opposite directions, and conflating them is the source of most image
bugs.

A preview should cost nothing: `URL.createObjectURL()` hands `<img>` a reference to bytes that are
already in memory, with no decode into JavaScript and no copy. The price is manual lifetime
management — the reference outlives the component unless revoked.

Processing is the opposite: the pixels have to be decoded into a canvas, transformed, and encoded
back out. Everything expensive lives here, which is why the canvas work is worth doing once, at the
size you actually need, rather than repeatedly at full resolution.

The browser's own EXIF handling sits across the seam. It rotates for display and not for canvas, so
the same file has two orientations depending on which path read it.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Object URL preview with cleanup

Revoke the previous URL before creating the next one, and revoke on unmount. Creating a URL during
render leaks one per render.

```typescript
useEffect(() => {
  const url = URL.createObjectURL(file);
  setPreviewUrl(url);
  return () => URL.revokeObjectURL(url);
}, [file]);
```

Full code: [examples/core.md](examples/core.md)

### Pattern 2: Canvas resize

Clamp to the browser limit, keep the aspect ratio, ask for high-quality smoothing, and fill white
before drawing when the output is JPEG — JPEG has no alpha channel, so transparency encodes as
black.

```typescript
const MAX_CANVAS_DIMENSION = 4096;

const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
const width = Math.round(img.width * Math.min(ratio, 1)); // never upscale
const height = Math.round(img.height * Math.min(ratio, 1));

ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";
if (mimeType === "image/jpeg") {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
}
ctx.drawImage(img, 0, 0, width, height);
```

Full code: [examples/canvas.md](examples/canvas.md)

### Pattern 3: Step-down scaling

`drawImage` samples a fixed neighbourhood, so a large reduction in one pass throws away most of the
source. Halving repeatedly keeps every pixel contributing.

```typescript
const STEP_DOWN_THRESHOLD = 0.5;

if (targetWidth / img.width < STEP_DOWN_THRESHOLD) {
  // 4000 → 400 → 100 rather than 4000 → 100
  const factor = Math.pow(targetWidth / img.width, 1 / steps);
  for (let i = 0; i < steps; i++) {
    /* draw into a canvas scaled by factor, then use it as the next source */
  }
}
```

Full code: [examples/canvas.md](examples/canvas.md)

### Pattern 4: EXIF orientation

```typescript
// Display: the browser has already rotated it
<img src={URL.createObjectURL(file)} />

// Outbound bytes: normalise, because the next consumer may not rotate
const orientation = await getExifOrientation(file);
const normalized = orientation === 1 ? file : await normalizeOrientation(file);

// Displaying an already-normalised image: suppress the second rotation
<img src={url} style={{ imageOrientation: "none" }} />
```

Full code: [examples/core.md](examples/core.md)

### Pattern 5: Format conversion

Quality means something different per format, and PNG ignores the parameter entirely.

```typescript
const FORMAT_QUALITY_DEFAULTS: Record<string, number> = {
  "image/jpeg": 0.85,
  "image/webp": 0.82,
  "image/png": 1, // lossless — the quality argument is ignored
};
```

WebP encodes everywhere modern, including Safari 14 and later. To hit a byte budget rather than a
quality setting, binary-search the quality parameter.

Full code: [examples/canvas.md](examples/canvas.md)

### Pattern 6: Cropping

`drawImage` with nine arguments takes a source rectangle and a destination rectangle, so a crop and
a resize are one call. Clamp the source rectangle to the image first — an out-of-bounds region
draws nothing rather than erroring.

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

Full code: [examples/canvas.md](examples/canvas.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- No `URL.revokeObjectURL()` — every selection pins another image in memory for the life of the
  page — revoke in the effect cleanup and before replacing the URL
- `URL.createObjectURL()` called during render — a new URL per render, none of them revoked — move
  it into an effect
- A canvas dimension above 4096px — the tab crashes, or the canvas silently produces nothing —
  clamp before assigning `canvas.width`
- Normalising orientation and then rendering the result in `<img>` — the browser rotates it a
  second time — set `image-orientation: none` on that element, or do not normalise for display
- Converting a transparent PNG to JPEG without a background fill — the transparent areas come out
  black — `fillRect` white first

**Surprising behaviour:**

- A single-pass reduction past 50% looks soft and aliased where a two-pass reduction looks sharp
- `toBlob()` is asynchronous and `toDataURL()` is not, and the synchronous one is the expensive one
- A data URL is roughly a third larger than the file it encodes, so a 10MB image becomes a 13MB
  string on the main thread
- Node has no `image-orientation`, so server-side canvas work still needs manual EXIF handling
- `createImageBitmap` skips layout and decode, and its result holds memory until `close()`
- An image can be within the per-dimension limit and still exceed the total canvas area limit
- AVIF encoding from `toBlob()` is not available across browsers; decoding it is
- Re-encoding an already-optimised image usually makes it larger, not smaller

</red_flags>
