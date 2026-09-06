# Image Handling — Canvas Examples

> The processing pipeline. Prerequisites are Patterns 2–3 in [SKILL.md](../SKILL.md) and the
> `loadImage` helper in [core.md](core.md).

---

## Pattern 8: Resize pipeline

Picks single-pass or step-down from the reduction ratio, and reports the compression achieved so a
caller can decide whether the result was worth using.

```typescript
// resize-pipeline.ts
import { loadImage } from "./load-image";

const MAX_CANVAS_DIMENSION = 4096;
const DEFAULT_QUALITY = 0.85;
const STEP_DOWN_THRESHOLD = 0.5;
const DEFAULT_STEPS = 2;

interface ResizeResult {
  blob: Blob;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  compressionRatio: number;
}

interface ResizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  useStepDown?: boolean;
  maintainAspectRatio?: boolean;
}

export async function resizeImagePipeline(
  file: File,
  options: ResizeOptions = {},
): Promise<ResizeResult> {
  const {
    maxWidth = MAX_CANVAS_DIMENSION,
    maxHeight = MAX_CANVAS_DIMENSION,
    quality = DEFAULT_QUALITY,
    mimeType = "image/jpeg",
    useStepDown = true,
    maintainAspectRatio = true,
  } = options;

  const img = await loadImage(file);
  const { width: originalWidth, height: originalHeight } = img;

  const target = calculateTargetDimensions(
    originalWidth,
    originalHeight,
    maxWidth,
    maxHeight,
    maintainAspectRatio,
  );

  const reductionRatio = Math.min(
    target.width / originalWidth,
    target.height / originalHeight,
  );

  const resize =
    useStepDown && reductionRatio < STEP_DOWN_THRESHOLD
      ? stepDownResize
      : singlePassResize;

  const blob = await resize(
    img,
    target.width,
    target.height,
    mimeType,
    quality,
  );

  return {
    blob,
    width: target.width,
    height: target.height,
    originalWidth,
    originalHeight,
    compressionRatio: blob.size / file.size,
  };
}

function calculateTargetDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number,
  maintainAspectRatio: boolean,
): { width: number; height: number } {
  // the caller's maximum never overrides the browser's
  const safeMaxWidth = Math.min(maxWidth, MAX_CANVAS_DIMENSION);
  const safeMaxHeight = Math.min(maxHeight, MAX_CANVAS_DIMENSION);

  if (!maintainAspectRatio) {
    return {
      width: Math.min(originalWidth, safeMaxWidth),
      height: Math.min(originalHeight, safeMaxHeight),
    };
  }

  if (originalWidth <= safeMaxWidth && originalHeight <= safeMaxHeight) {
    return { width: originalWidth, height: originalHeight };
  }

  const ratio = Math.min(
    safeMaxWidth / originalWidth,
    safeMaxHeight / originalHeight,
  );
  return {
    width: Math.round(originalWidth * ratio),
    height: Math.round(originalHeight * ratio),
  };
}

function singlePassResize(
  img: CanvasImageSource,
  width: number,
  height: number,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (mimeType === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Blob creation failed")),
      mimeType,
      quality,
    );
  });
}

async function stepDownResize(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  let currentWidth = img.width;
  let currentHeight = img.height;
  let source: HTMLImageElement | HTMLCanvasElement = img;

  const steps = DEFAULT_STEPS;
  const widthFactor = Math.pow(targetWidth / currentWidth, 1 / steps);
  const heightFactor = Math.pow(targetHeight / currentHeight, 1 / steps);

  for (let i = 0; i < steps; i++) {
    const isLastStep = i === steps - 1;

    // the last step lands exactly on the target, absorbing rounding drift
    currentWidth = isLastStep
      ? targetWidth
      : Math.round(currentWidth * widthFactor);
    currentHeight = isLastStep
      ? targetHeight
      : Math.round(currentHeight * heightFactor);

    const canvas = document.createElement("canvas");
    canvas.width = currentWidth;
    canvas.height = currentHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // intermediate canvases stay transparent; only the output gets a background
    if (isLastStep && mimeType === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, currentWidth, currentHeight);
    }

    ctx.drawImage(source, 0, 0, currentWidth, currentHeight);
    source = canvas;
  }

  const finalCanvas = source as HTMLCanvasElement;

  return new Promise((resolve, reject) => {
    finalCanvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Blob creation failed")),
      mimeType,
      quality,
    );
  });
}
```

---

## Pattern 9: Hitting a byte budget

Quality and file size have no fixed relationship — it depends entirely on the image — so search for
the quality that fits rather than guessing one. Binary search converges in seven or eight encodes.

```typescript
// target-size-compression.ts
import { loadImage } from "./load-image";

const MAX_ITERATIONS = 10;
const SIZE_TOLERANCE = 0.05;
const MIN_QUALITY = 0.1;
const MAX_QUALITY = 1.0;

interface CompressionResult {
  blob: Blob;
  quality: number;
  iterations: number;
  targetHit: boolean;
}

export async function compressToTargetSize(
  file: File,
  targetSizeKB: number,
  mimeType: "image/jpeg" | "image/webp" = "image/jpeg",
): Promise<CompressionResult> {
  const img = await loadImage(file);

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  if (mimeType === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0);

  const targetBytes = targetSizeKB * 1024;
  let minQuality = MIN_QUALITY;
  let maxQuality = MAX_QUALITY;
  let bestBlob: Blob | null = null;
  let bestQuality = MAX_QUALITY;
  let iterations = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    iterations++;
    const quality = (minQuality + maxQuality) / 2;
    const blob = await canvasToBlob(canvas, mimeType, quality);

    if (blob.size <= targetBytes) {
      bestBlob = blob;
      bestQuality = quality;
      minQuality = quality; // it fits — try for better quality
    } else {
      maxQuality = quality;
    }

    if (Math.abs(blob.size - targetBytes) / targetBytes < SIZE_TOLERANCE) {
      return { blob, quality, iterations, targetHit: true };
    }
  }

  // every attempt overshot: return the smallest achievable, flagged as a miss
  if (!bestBlob) {
    bestBlob = await canvasToBlob(canvas, mimeType, MIN_QUALITY);
    bestQuality = MIN_QUALITY;
  }

  return {
    blob: bestBlob,
    quality: bestQuality,
    iterations,
    targetHit: bestBlob.size <= targetBytes,
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Blob creation failed")),
      mimeType,
      quality,
    );
  });
}
```

Where the target is unreachable at any quality, reduce the dimensions first — resolution buys more
than quality below about 0.6.

---

## Pattern 10: Crop

The source rectangle is clamped to the image, because a region extending past the edge draws
nothing at all rather than throwing.

```typescript
// canvas-crop.ts
import { loadImage } from "./load-image";

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropOptions {
  quality?: number;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  outputWidth?: number;
  outputHeight?: number;
}

const DEFAULT_CROP_QUALITY = 0.92;

export async function cropImage(
  file: File,
  region: CropRegion,
  options: CropOptions = {},
): Promise<Blob> {
  const {
    quality = DEFAULT_CROP_QUALITY,
    mimeType = "image/jpeg",
    outputWidth,
    outputHeight,
  } = options;

  const img = await loadImage(file);

  const safeRegion = {
    x: Math.max(0, Math.min(region.x, img.width)),
    y: Math.max(0, Math.min(region.y, img.height)),
    width: Math.min(region.width, img.width - region.x),
    height: Math.min(region.height, img.height - region.y),
  };

  // omitting the output size crops at 1:1; supplying it crops and scales at once
  const finalWidth = outputWidth ?? safeRegion.width;
  const finalHeight = outputHeight ?? safeRegion.height;

  const canvas = document.createElement("canvas");
  canvas.width = finalWidth;
  canvas.height = finalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (mimeType === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, finalWidth, finalHeight);
  }

  ctx.drawImage(
    img,
    safeRegion.x,
    safeRegion.y,
    safeRegion.width,
    safeRegion.height,
    0,
    0,
    finalWidth,
    finalHeight,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))),
      mimeType,
      quality,
    );
  });
}

/** Centre-crop to a ratio — the common case behind an avatar or a card image. */
export async function cropToAspectRatio(
  file: File,
  aspectRatio: number,
  options: CropOptions = {},
): Promise<Blob> {
  const img = await loadImage(file);
  const currentRatio = img.width / img.height;

  const cropHeight =
    currentRatio > aspectRatio ? img.height : img.width / aspectRatio;
  const cropWidth =
    currentRatio > aspectRatio ? img.height * aspectRatio : img.width;

  return cropImage(
    file,
    {
      x: (img.width - cropWidth) / 2,
      y: (img.height - cropHeight) / 2,
      width: cropWidth,
      height: cropHeight,
    },
    options,
  );
}
```

---

## Pattern 11: Watermark

Text and image overlays share their positioning, so it lives in one helper. `globalAlpha` is reset
afterwards — it is context state, and leaving it set fades everything drawn next.

```typescript
// watermark.ts
import { loadImage } from "./load-image";

type WatermarkPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center";

interface TextWatermarkOptions {
  text: string;
  position: WatermarkPosition;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  opacity?: number;
  padding?: number;
}

interface ImageWatermarkOptions {
  watermarkFile: File;
  position: WatermarkPosition;
  scale?: number;
  opacity?: number;
  padding?: number;
}

const DEFAULT_FONT_SIZE = 24;
const DEFAULT_FONT_FAMILY = "Arial, sans-serif";
const DEFAULT_COLOR = "#ffffff";
const DEFAULT_OPACITY = 0.7;
const DEFAULT_PADDING = 20;
const DEFAULT_SCALE = 0.2;
const WATERMARK_QUALITY = 0.92;

export async function addTextWatermark(
  file: File,
  options: TextWatermarkOptions,
): Promise<Blob> {
  const {
    text,
    position,
    fontSize = DEFAULT_FONT_SIZE,
    fontFamily = DEFAULT_FONT_FAMILY,
    color = DEFAULT_COLOR,
    opacity = DEFAULT_OPACITY,
    padding = DEFAULT_PADDING,
  } = options;

  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  ctx.drawImage(img, 0, 0);

  ctx.globalAlpha = opacity;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;

  const textWidth = ctx.measureText(text).width;
  const textHeight = fontSize;

  const { x, y } = calculateWatermarkPosition(
    canvas.width,
    canvas.height,
    textWidth,
    textHeight,
    position,
    padding,
  );

  // a shadow keeps the mark legible over both light and dark regions
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  ctx.fillText(text, x, y + textHeight); // fillText draws from the baseline
  ctx.globalAlpha = 1;

  return canvasToJpegBlob(canvas);
}

export async function addImageWatermark(
  file: File,
  options: ImageWatermarkOptions,
): Promise<Blob> {
  const {
    watermarkFile,
    position,
    scale = DEFAULT_SCALE,
    opacity = DEFAULT_OPACITY,
    padding = DEFAULT_PADDING,
  } = options;

  const [img, watermark] = await Promise.all([
    loadImage(file),
    loadImage(watermarkFile),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  ctx.drawImage(img, 0, 0);

  // scale relative to the base image, so the mark looks the same at any size
  const wmWidth = img.width * scale;
  const wmHeight = (wmWidth / watermark.width) * watermark.height;

  const { x, y } = calculateWatermarkPosition(
    canvas.width,
    canvas.height,
    wmWidth,
    wmHeight,
    position,
    padding,
  );

  ctx.globalAlpha = opacity;
  ctx.drawImage(watermark, x, y, wmWidth, wmHeight);
  ctx.globalAlpha = 1;

  return canvasToJpegBlob(canvas);
}

function calculateWatermarkPosition(
  canvasWidth: number,
  canvasHeight: number,
  elementWidth: number,
  elementHeight: number,
  position: WatermarkPosition,
  padding: number,
): { x: number; y: number } {
  switch (position) {
    case "top-left":
      return { x: padding, y: padding };
    case "top-right":
      return { x: canvasWidth - elementWidth - padding, y: padding };
    case "bottom-left":
      return { x: padding, y: canvasHeight - elementHeight - padding };
    case "bottom-right":
      return {
        x: canvasWidth - elementWidth - padding,
        y: canvasHeight - elementHeight - padding,
      };
    case "center":
      return {
        x: (canvasWidth - elementWidth) / 2,
        y: (canvasHeight - elementHeight) / 2,
      };
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Watermark failed"))),
      "image/jpeg",
      WATERMARK_QUALITY,
    );
  });
}
```

---

## Pattern 12: Filters

The canvas `filter` property takes CSS filter syntax and is GPU-accelerated, so this is far cheaper
than walking `ImageData`. Reset it to `"none"` after drawing.

```typescript
// canvas-filters.ts
import { loadImage } from "./load-image";

type FilterType =
  | "grayscale"
  | "sepia"
  | "brightness"
  | "contrast"
  | "blur"
  | "saturate"
  | "invert";

interface FilterOptions {
  type: FilterType;
  value: number; // percent, except blur which is pixels
}

const DEFAULT_FILTER_QUALITY = 0.92;

export async function applyFilters(
  file: File,
  filters: FilterOptions | FilterOptions[],
): Promise<Blob> {
  const filterList = Array.isArray(filters) ? filters : [filters];

  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable");

  // filters compose left to right, as they do in CSS
  ctx.filter = filterList
    .map((f) => buildFilterString(f.type, f.value))
    .join(" ");

  ctx.drawImage(img, 0, 0);
  ctx.filter = "none";

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Filter failed"))),
      "image/jpeg",
      DEFAULT_FILTER_QUALITY,
    );
  });
}

function buildFilterString(type: FilterType, value: number): string {
  return type === "blur" ? `blur(${value}px)` : `${type}(${value}%)`;
}
```
