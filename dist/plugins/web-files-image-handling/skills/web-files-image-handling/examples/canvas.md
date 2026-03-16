# Image Handling - Canvas API Examples

> Canvas manipulation patterns for image processing. See [core.md](core.md) for shared `loadImage` utility.

**Prerequisites:** Understand Pattern 2-3 from [SKILL.md](../SKILL.md) (resize and step-down concepts).

---

## Pattern 1: Complete Resize Pipeline

### With Automatic Step-Down Detection

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
  const originalWidth = img.width;
  const originalHeight = img.height;

  const targetDims = calculateTargetDimensions(
    originalWidth,
    originalHeight,
    maxWidth,
    maxHeight,
    maintainAspectRatio,
  );

  const reductionRatio = Math.min(
    targetDims.width / originalWidth,
    targetDims.height / originalHeight,
  );

  let blob: Blob;

  if (useStepDown && reductionRatio < STEP_DOWN_THRESHOLD) {
    blob = await stepDownResize(
      img,
      targetDims.width,
      targetDims.height,
      mimeType,
      quality,
    );
  } else {
    blob = await singlePassResize(
      img,
      targetDims.width,
      targetDims.height,
      mimeType,
      quality,
    );
  }

  return {
    blob,
    width: targetDims.width,
    height: targetDims.height,
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
  const safeMaxWidth = Math.min(maxWidth, MAX_CANVAS_DIMENSION);
  const safeMaxHeight = Math.min(maxHeight, MAX_CANVAS_DIMENSION);

  if (!maintainAspectRatio) {
    return {
      width: Math.min(originalWidth, safeMaxWidth),
      height: Math.min(originalHeight, safeMaxHeight),
    };
  }

  let width = originalWidth;
  let height = originalHeight;

  if (width > safeMaxWidth || height > safeMaxHeight) {
    const ratio = Math.min(safeMaxWidth / width, safeMaxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  return { width, height };
}

function singlePassResize(
  img: HTMLImageElement,
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

**Why good:** Automatic step-down detection, returns compression stats, handles aspect ratio preservation, proper JPEG background handling on final step

---

## Pattern 2: Binary Search Quality Targeting

### Hit Specific File Size

```typescript
// target-size-compression.ts
import { loadImage } from "./load-image";

const MAX_ITERATIONS = 10;
const SIZE_TOLERANCE = 0.05; // 5%
const MIN_QUALITY = 0.1;
const MAX_QUALITY = 1.0;

interface CompressionResult {
  blob: Blob;
  quality: number;
  iterations: number;
  targetHit: boolean;
}

/**
 * Compress image to hit a target file size using binary search on quality.
 * Converges in ~7-8 iterations (log2 of quality range).
 */
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
      minQuality = quality; // Try higher quality
    } else {
      maxQuality = quality; // Try lower quality
    }

    // Close enough
    const sizeDiff = Math.abs(blob.size - targetBytes) / targetBytes;
    if (sizeDiff < SIZE_TOLERANCE) {
      return { blob, quality, iterations, targetHit: true };
    }
  }

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

**Why good:** Binary search converges quickly (log n), reports whether target was achievable, includes iteration count for debugging

---

## Pattern 3: Canvas Crop

### Region Extraction with Aspect Ratio Helper

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

  // Clamp crop region to image bounds
  const safeRegion = {
    x: Math.max(0, Math.min(region.x, img.width)),
    y: Math.max(0, Math.min(region.y, img.height)),
    width: Math.min(region.width, img.width - region.x),
    height: Math.min(region.height, img.height - region.y),
  };

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

  // Draw cropped region scaled to output size
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

/** Crop to specific aspect ratio from center of image */
export async function cropToAspectRatio(
  file: File,
  aspectRatio: number,
  options: CropOptions = {},
): Promise<Blob> {
  const img = await loadImage(file);

  const currentRatio = img.width / img.height;
  let cropWidth: number;
  let cropHeight: number;

  if (currentRatio > aspectRatio) {
    cropHeight = img.height;
    cropWidth = cropHeight * aspectRatio;
  } else {
    cropWidth = img.width;
    cropHeight = cropWidth / aspectRatio;
  }

  const x = (img.width - cropWidth) / 2;
  const y = (img.height - cropHeight) / 2;

  return cropImage(
    file,
    { x, y, width: cropWidth, height: cropHeight },
    options,
  );
}
```

**Why good:** Validates crop region is in bounds, supports resize during crop, center-crop helper for common aspect ratio use case

---

## Pattern 4: Image Watermark

### Text and Image Overlay

```typescript
// watermark.ts
import { loadImage } from "./load-image";

interface TextWatermarkOptions {
  text: string;
  position:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "center";
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  opacity?: number;
  padding?: number;
}

interface ImageWatermarkOptions {
  watermarkFile: File;
  position:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "center";
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

  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontSize;

  const { x, y } = calculateWatermarkPosition(
    canvas.width,
    canvas.height,
    textWidth,
    textHeight,
    position,
    padding,
  );

  // Shadow improves readability on varied backgrounds
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  ctx.fillText(text, x, y + textHeight); // +textHeight: fillText uses baseline
  ctx.globalAlpha = 1;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Watermark failed"))),
      "image/jpeg",
      WATERMARK_QUALITY,
    );
  });
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

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Watermark failed"))),
      "image/jpeg",
      WATERMARK_QUALITY,
    );
  });
}

function calculateWatermarkPosition(
  canvasWidth: number,
  canvasHeight: number,
  elementWidth: number,
  elementHeight: number,
  position: string,
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
    default:
      return { x: padding, y: padding };
  }
}
```

**Why good:** Supports both text and image watermarks, configurable position/opacity/scale, text shadow for readability, parallel loading of source and watermark images

---

## Pattern 5: Canvas Filters

### CSS-Like Visual Effects

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
  value: number; // 0-100 for most, 0-20 for blur (px)
}

const DEFAULT_FILTER_QUALITY = 0.92;

/** Apply single or multiple CSS-like filters using canvas filter property */
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

  const filterStrings = filterList.map((f) =>
    buildFilterString(f.type, f.value),
  );
  ctx.filter = filterStrings.join(" ");

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
  switch (type) {
    case "grayscale":
      return `grayscale(${value}%)`;
    case "sepia":
      return `sepia(${value}%)`;
    case "brightness":
      return `brightness(${value}%)`;
    case "contrast":
      return `contrast(${value}%)`;
    case "blur":
      return `blur(${value}px)`;
    case "saturate":
      return `saturate(${value}%)`;
    case "invert":
      return `invert(${value}%)`;
    default:
      return "";
  }
}
```

**Why good:** Uses native canvas filter property (hardware accelerated), supports single or combined filters, simple value-based API

---

_Extended examples: [core.md](core.md) | [preview.md](preview.md)_
