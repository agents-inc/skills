# React Native Skia - Text and Media Patterns

> Paragraph API, SVG rendering, Picture recording, and offscreen rendering. See [SKILL.md](../SKILL.md) for decision guidance.

**Related:** [core.md](core.md) for basic shapes, [effects.md](effects.md) for applying effects to Paragraphs via `layer`.

---

## Pattern 1: Paragraph with Mixed Styles

The Paragraph API handles rich text with multiple fonts, weights, and alignment. Build paragraphs with `ParagraphBuilder`.

```tsx
import {
  Canvas,
  Paragraph,
  Skia,
  useFonts,
  TextAlign,
  FontStyle,
} from "@shopify/react-native-skia";

const PARAGRAPH_WIDTH = 280;
const TITLE_SIZE = 28;
const BODY_SIZE = 16;
const LINE_HEIGHT_MULTIPLIER = 1.5;

export function RichTextParagraph() {
  const fonts = useFonts({
    Roboto: [
      require("./fonts/Roboto-Regular.ttf"),
      require("./fonts/Roboto-Bold.ttf"),
      require("./fonts/Roboto-Italic.ttf"),
    ],
  });

  if (!fonts) return null; // Fonts loading -- always guard

  const paraStyle = {
    textAlign: TextAlign.Left,
    maxLines: 10,
    ellipsis: "...",
  };

  const para = Skia.ParagraphBuilder.Make(paraStyle, fonts)
    .pushStyle({
      fontSize: TITLE_SIZE,
      fontFamilies: ["Roboto"],
      fontStyle: FontStyle.Bold,
      color: Skia.Color("black"),
    })
    .addText("Welcome to Skia\n")
    .pop()
    .pushStyle({
      fontSize: BODY_SIZE,
      fontFamilies: ["Roboto"],
      color: Skia.Color("#444"),
      heightMultiplier: LINE_HEIGHT_MULTIPLIER,
    })
    .addText("React Native Skia provides a ")
    .pushStyle({
      fontSize: BODY_SIZE,
      fontFamilies: ["Roboto"],
      fontStyle: FontStyle.Italic,
      color: Skia.Color("#444"),
    })
    .addText("powerful")
    .pop()
    .addText(
      " Paragraph API for rich text layout with automatic line breaking.",
    )
    .pop()
    .build();

  para.layout(PARAGRAPH_WIDTH);

  return (
    <Canvas style={{ width: PARAGRAPH_WIDTH, height: para.getHeight() + 20 }}>
      <Paragraph paragraph={para} x={0} y={10} width={PARAGRAPH_WIDTH} />
    </Canvas>
  );
}
```

**Why good:** mixed bold/italic/regular in one text block, automatic line breaking, measurable height for dynamic canvas sizing

**Key methods after `build()`:**

- `para.layout(width)` -- compute layout for given width (must call before rendering)
- `para.getHeight()` -- total paragraph height after layout
- `para.getLongestLine()` -- width of the longest line (useful for centering)

---

## Pattern 2: SVG Rendering

Render SVG files or strings with the `ImageSVG` component. SVGs use Skia's SVG module and have specific limitations.

```tsx
import { Canvas, ImageSVG, useSVG, Skia } from "@shopify/react-native-skia";

// From file
export function SVGFromFile() {
  const svg = useSVG(require("./icon.svg"));
  if (!svg) return null; // Loading -- always guard

  return (
    <Canvas style={{ width: 200, height: 200 }}>
      <ImageSVG svg={svg} x={0} y={0} width={200} height={200} />
    </Canvas>
  );
}

// From string
export function SVGFromString() {
  const svg = Skia.SVG.MakeFromString(`
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="40" fill="coral" />
      <rect x="30" y="30" width="40" height="40" fill="white" opacity="0.5" />
    </svg>
  `);

  if (!svg) return null;

  return (
    <Canvas style={{ width: 200, height: 200 }}>
      <ImageSVG svg={svg} x={0} y={0} width={200} height={200} />
    </Canvas>
  );
}
```

**SVG limitations (not supported):**

- `<text>` elements
- CSS styles (preprocess with SVGO to convert to attributes)
- RGBA color syntax (use `rgb()` + `fill-opacity`/`stroke-opacity`)
- `<animate>`, `<foreignObject>`, `<script>`, `<view>`
- Gradient `xlink:href` (deprecated)

**Why good:** `useSVG` handles async loading, `Skia.SVG.MakeFromString` for inline SVGs

---

## Pattern 3: Picture Recording

Pictures record drawing operations and replay them. Useful for dynamic draw counts (e.g., trails, particle effects) and sharing drawings between canvases.

```tsx
import {
  Canvas,
  Picture,
  Skia,
  Group,
  Paint,
  Blur,
} from "@shopify/react-native-skia";

const TRAIL_LENGTH = 20;
const TRAIL_RADIUS = 5;

// Record dynamic number of drawing operations
export function TrailEffect({
  points,
}: {
  points: Array<{ x: number; y: number }>;
}) {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording({
    x: 0,
    y: 0,
    width: 256,
    height: 256,
  });

  // Draw variable number of circles (can't do this with JSX without changing component count)
  const visiblePoints = points.slice(-TRAIL_LENGTH);
  visiblePoints.forEach((point, i) => {
    const opacity = (i + 1) / visiblePoints.length;
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(`rgba(0, 200, 255, ${opacity})`));
    canvas.drawCircle(point.x, point.y, TRAIL_RADIUS, paint);
  });

  const picture = recorder.finishRecordingAsPicture();

  return (
    <Canvas style={{ width: 256, height: 256 }}>
      {/* Apply effects via layer since Picture doesn't inherit paint */}
      <Group
        layer={
          <Paint>
            <Blur blur={2} />
          </Paint>
        }
      >
        <Picture picture={picture} />
      </Group>
    </Canvas>
  );
}
```

**When to use Picture:**

- Variable number of draw operations per frame (trails, particles)
- Reusing the same drawing in multiple locations
- Immediate-mode drawing with imperative Skia API
- Serializing drawings for debugging (`picture.serialize()`)

**Why good:** Picture operates in immediate mode (variable draw count), immutable after recording (safe to share), can be serialized for debugging

---

## Pattern 4: Canvas Snapshots

Capture canvas content as an image for sharing, saving, or processing.

```tsx
import {
  Canvas,
  Circle,
  Rect,
  type SkiaView,
} from "@shopify/react-native-skia";
import { useRef, useCallback } from "react";

export function SnapshotExample() {
  const canvasRef = useRef<SkiaView>(null);

  const captureSnapshot = useCallback(async () => {
    if (!canvasRef.current) return;

    // Use async version for drawings that include images/textures
    const image = await canvasRef.current.makeImageSnapshotAsync();
    if (!image) return;

    // Convert to base64 for sharing
    const data = image.encodeToBase64();
    // Use data as needed (save, share, upload)
  }, []);

  return (
    <Canvas ref={canvasRef} style={{ width: 256, height: 256 }}>
      <Rect x={0} y={0} width={256} height={256} color="white" />
      <Circle cx={128} cy={128} r={60} color="blue" />
    </Canvas>
  );
}
```

**Key distinction:**

- `makeImageSnapshotAsync()` -- use when canvas has images, shaders, or textures (promise-based)
- `makeImageSnapshot(rect?)` -- use for texture-free drawings (synchronous, optional crop rect)

---

## Pattern 5: Offscreen Rendering (Headless)

Generate images without displaying a Canvas. Useful for thumbnails, export, or server-side rendering.

```tsx
import {
  LoadSkiaWeb,
  makeOffscreenSurface,
  drawOffscreen,
} from "@shopify/react-native-skia/lib/commonjs/headless";
import { Circle, Fill } from "@shopify/react-native-skia";

const SURFACE_WIDTH = 512;
const SURFACE_HEIGHT = 512;

export async function generateThumbnail(): Promise<string> {
  // 1. Initialize CanvasKit (required for headless)
  await LoadSkiaWeb();

  // 2. Create offscreen surface
  const surface = makeOffscreenSurface(SURFACE_WIDTH, SURFACE_HEIGHT);

  // 3. Draw using React Native Skia components
  const image = drawOffscreen(
    surface,
    <>
      <Fill color="white" />
      <Circle cx={256} cy={256} r={120} color="blue" />
    </>,
  );

  // 4. Encode to base64
  return image.encodeToBase64();
}
```

**When to use offscreen rendering:**

- Generating thumbnails or previews without a visible Canvas
- Server-side image generation (Node.js with CanvasKit)
- Pre-rendering complex scenes for later display

**Import path:** headless mode requires CommonJS imports: `@shopify/react-native-skia/lib/commonjs/headless`
