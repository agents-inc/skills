---
name: mobile-animation-skia
description: React Native Skia GPU-accelerated 2D graphics - Canvas, declarative drawing, shaders, image filters, Paragraph text, Atlas batch rendering, Reanimated animations
---

# React Native Skia Patterns

> **Quick Guide:** Use `@shopify/react-native-skia` for GPU-accelerated 2D drawing in React Native. The Canvas component hosts a separate React renderer. Drawing primitives (Circle, Rect, Path, Image) compose declaratively. Paint attributes cascade through Groups. Animations use Reanimated shared values passed directly as props -- no `createAnimatedComponent` needed. Use `interpolateColors` from Skia for color animations (not Reanimated's `interpolateColor`). Use Atlas for batch rendering thousands of sprites. Use Paragraph for rich text layout. Group transforms default to top-left origin, not center.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST pass Reanimated shared values directly as Skia component props -- do NOT use createAnimatedComponent or useAnimatedProps)**

**(You MUST use `interpolateColors` from `@shopify/react-native-skia` for color animations -- Reanimated's `interpolateColor` uses a different internal color format and produces wrong results)**

**(You MUST use the `layer` property to apply paint effects to Paragraph, Picture, and ImageSVG components -- they do not follow standard paint inheritance rules)**

**(You MUST remember that Group transform origin defaults to top-left, not center -- set `origin` prop explicitly for center-based rotations)**

</critical_requirements>

---

**Auto-detection:** react-native-skia, @shopify/react-native-skia, Canvas, Skia.Path, Skia.Paint, Circle, Rect, Path, Group, Paint, ImageSVG, BackdropBlur, BackdropFilter, RuntimeShader, Atlas, Paragraph, ParagraphBuilder, usePathInterpolation, useClock, useRSXformBuffer, SkSL, image filter, shader, offscreen, Picture, FitBox

**When to use:**

- Drawing custom 2D graphics (charts, diagrams, custom shapes)
- Applying GPU-accelerated blur, shadow, or color filter effects
- Animating paths, shapes, or shader uniforms at 60 FPS
- Rendering rich text with mixed fonts using Paragraph API
- Batch rendering sprites/tiles with Atlas
- Creating custom image filters with SkSL shaders
- Generating images offscreen (thumbnails, exports)

**When NOT to use:**

- Standard UI layouts (use regular React Native views)
- Simple static images (use `<Image>` from React Native)
- 3D graphics (Skia is 2D only -- use a 3D solution)
- Text-only screens (use React Native `<Text>`)

**Key patterns covered:**

- Canvas setup and threading model
- Declarative drawing with shapes, paths, and images
- Paint inheritance and composition through Groups
- Reanimated integration (shared values as props, color interpolation)
- Image filters (Blur, Shadow, RuntimeShader) and backdrop filters
- Paragraph text layout with custom fonts
- Atlas batch rendering for sprites and tiles
- SkSL custom shaders with uniforms
- Picture recording for dynamic drawing operations
- SVG rendering with limitations

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Canvas, shapes, paths, paint, groups, images
- [examples/animations.md](examples/animations.md) - Reanimated integration, path interpolation, color animation, Atlas animation
- [examples/effects.md](examples/effects.md) - Image filters, backdrop blur, shaders, RuntimeShader
- [examples/text-and-media.md](examples/text-and-media.md) - Paragraph API, SVG rendering, Picture recording, offscreen rendering
- [reference.md](reference.md) - Decision frameworks, paint property reference, SkSL types

---

<philosophy>

## Philosophy

React Native Skia brings Skia (the graphics engine behind Chrome, Android, and Flutter) to React Native. It provides a **separate React renderer** inside the Canvas component -- you write JSX, but it renders to a GPU-accelerated Skia surface, not native views.

**Core mental model:**

1. **Canvas is the boundary** -- everything inside `<Canvas>` uses Skia's renderer, everything outside is regular React Native
2. **Declarative by default** -- compose shapes, paints, and effects as JSX children; use imperative API (`Skia.Path()`, `Skia.Paint()`) only when you need dynamic construction
3. **Paint cascades through Groups** -- a Group's color, opacity, shader, or filter applies to all children unless overridden (exception: Paragraph, Picture, and ImageSVG need the `layer` property)
4. **Animations run on UI thread** -- pass Reanimated shared values directly as props; Skia reads them on the UI thread with zero bridge cost
5. **Hybrid architecture** -- use Skia canvases only where custom visuals are needed; standard views handle layout and navigation

**When to reach for Skia:**

- Custom graphics that native views cannot express (gradients on paths, blur effects, charts)
- Performance-critical animations that must run on the GPU
- Batch rendering (Atlas for thousands of sprites)
- Rich text layout needing mixed fonts or decorations (Paragraph)
- Custom image processing (RuntimeShader with SkSL)

**When NOT to reach for Skia:**

- Standard UI (buttons, lists, forms) -- native views are simpler and more accessible
- Simple images -- React Native's `<Image>` is sufficient
- Accessibility-critical content -- Skia canvas elements are not accessible to screen readers; overlay native views for accessibility

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Canvas and Basic Shapes

Canvas is the root Skia drawing surface. It behaves like a regular React Native view (accepts `style`), but hosts its own React renderer internally.

```tsx
import {
  Canvas,
  Circle,
  Rect,
  RoundedRect,
  Line,
} from "@shopify/react-native-skia";

const CANVAS_SIZE = 256;
const CIRCLE_RADIUS = 50;

<Canvas style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
  <Circle cx={128} cy={128} r={CIRCLE_RADIUS} color="cyan" />
  <Rect x={10} y={10} width={100} height={80} color="red" />
  <RoundedRect x={10} y={120} width={100} height={80} r={16} color="blue" />
  <Line
    p1={{ x: 0, y: 0 }}
    p2={{ x: 256, y: 256 }}
    color="green"
    strokeWidth={2}
    style="stroke"
  />
</Canvas>;
```

**Why good:** declarative JSX, paint properties (color, style, strokeWidth) applied directly as props

See [examples/core.md](examples/core.md) for Canvas props (`onSize`, `androidWarmup`, snapshots) and all shape primitives.

---

### Pattern 2: Paint Inheritance and Groups

Groups apply paint attributes (color, opacity, shaders, filters) to all children. Groups also provide transforms, clipping, and z-ordering.

```tsx
import { Canvas, Group, Circle, Rect } from "@shopify/react-native-skia";

<Canvas style={{ width: 256, height: 256 }}>
  <Group color="blue" opacity={0.5}>
    <Circle cx={80} cy={128} r={40} />
    <Rect x={140} y={88} width={80} height={80} />
  </Group>
</Canvas>;
```

**Why good:** color and opacity cascade to both children without repetition, Group provides single point for transforms and clipping

**Gotcha:** Paragraph, Picture, and ImageSVG do not follow standard paint inheritance. Apply effects via the `layer` property instead.

See [examples/core.md](examples/core.md) for transforms, clipping, and the layer escape hatch.

---

### Pattern 3: Paths (Declarative and Imperative)

Use the declarative `<Path>` component with SVG path strings for static paths. Use `Skia.Path()` imperatively for dynamic path construction.

```tsx
import { Canvas, Path, Skia } from "@shopify/react-native-skia";

// Declarative: SVG path string
<Path
  path="M 10 80 Q 95 10 180 80"
  color="purple"
  style="stroke"
  strokeWidth={3}
/>;

// Imperative: dynamic construction
const path = Skia.Path.Make();
path.moveTo(10, 80);
path.quadTo(95, 10, 180, 80);
path.close();
```

**When to use imperative:** dynamic shapes computed at runtime (e.g., chart data), paths that change based on user input, paths needed outside JSX (worklets, offscreen)

See [examples/core.md](examples/core.md) for path operations (dash effects, trim, boolean ops).

---

### Pattern 4: Reanimated Integration

Pass Reanimated shared values directly as Skia component props. No `createAnimatedComponent` or `useAnimatedProps` needed -- Skia reads shared values on the UI thread automatically.

```tsx
import { Canvas, Circle } from "@shopify/react-native-skia";
import {
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

const DURATION = 2000;
const MIN_RADIUS = 20;
const MAX_RADIUS = 100;

export function PulsingCircle() {
  const r = useSharedValue(MIN_RADIUS);

  useEffect(() => {
    r.value = withRepeat(
      withTiming(MAX_RADIUS, { duration: DURATION }),
      -1,
      true,
    );
  }, []);

  return (
    <Canvas style={{ flex: 1 }}>
      <Circle cx={128} cy={128} r={r} color="cyan" />
    </Canvas>
  );
}
```

**Why good:** shared value `r` passed directly as prop, animation runs entirely on UI thread, zero bridge communication, 60 FPS

**Critical:** Use `interpolateColors` from `@shopify/react-native-skia` for color animations -- Reanimated's `interpolateColor` produces wrong results with Skia's internal color format.

See [examples/animations.md](examples/animations.md) for path interpolation, color animation, derived values, and Atlas animation.

---

### Pattern 5: Image Filters and Backdrop Blur

Image filters (Blur, Shadow, ColorMatrix) apply as children to shapes or Groups. BackdropBlur applies blur to content behind a clipping mask (like CSS `backdrop-filter`).

```tsx
import {
  Canvas,
  Image,
  Blur,
  BackdropBlur,
  Fill,
  useImage,
} from "@shopify/react-native-skia";

const BLUR_RADIUS = 10;
const BACKDROP_BLUR = 4;

export function BlurExample() {
  const image = useImage(require("./photo.png"));
  if (!image) return null;

  return (
    <Canvas style={{ width: 256, height: 256 }}>
      <Image image={image} fit="cover" x={0} y={0} width={256} height={256}>
        <Blur blur={BLUR_RADIUS} mode="clamp" />
      </Image>
      <BackdropBlur
        blur={BACKDROP_BLUR}
        clip={{ x: 0, y: 128, width: 256, height: 128 }}
      >
        <Fill color="rgba(0, 0, 0, 0.3)" />
      </BackdropBlur>
    </Canvas>
  );
}
```

**Why good:** Blur as child applies to image only, BackdropBlur applies to content behind the clipping region, composable

See [examples/effects.md](examples/effects.md) for Shadow, ColorMatrix, RuntimeShader, and composed filter chains.

---

### Pattern 6: Custom Shaders (SkSL)

Write GPU shaders in SkSL (Skia's GLSL-like language). Use `Skia.RuntimeEffect.Make()` to compile shaders. Pass uniforms as a plain object.

```tsx
import { Canvas, Shader, Fill, Skia } from "@shopify/react-native-skia";

const SHADER_SOURCE = `
  uniform float2 iResolution;
  uniform float iTime;

  vec4 main(vec2 pos) {
    vec2 uv = pos / iResolution;
    float wave = sin(uv.x * 10.0 + iTime * 2.0) * 0.5 + 0.5;
    return vec4(uv.x, wave, uv.y, 1.0);
  }
`;

const effect = Skia.RuntimeEffect.Make(SHADER_SOURCE)!;

// In component: pass animated shared values as uniforms
<Canvas style={{ flex: 1 }}>
  <Fill>
    <Shader
      source={effect}
      uniforms={{ iResolution: [256, 256], iTime: time }}
    />
  </Fill>
</Canvas>;
```

**Key SkSL differences from GLSL:** use `.eval(xy)` instead of `sample()` for child shaders, `uniform shader` for child shader declarations, supported uniform types: `float`, `float2`-`float4`, `int`, `int2`-`int4`, matrices, and arrays.

See [examples/effects.md](examples/effects.md) for RuntimeShader as image filter, child shaders, and pixel density considerations.

---

### Pattern 7: Paragraph Text Layout

The Paragraph API handles rich text with mixed fonts, line breaking, and alignment. Requires building text with `ParagraphBuilder`. Paragraph does not follow standard paint inheritance -- use `layer` for effects.

```tsx
import {
  Canvas,
  Paragraph,
  Skia,
  useFonts,
  TextAlign,
} from "@shopify/react-native-skia";

const PARAGRAPH_WIDTH = 300;

export function RichText() {
  const fonts = useFonts({ Roboto: [require("./Roboto-Regular.ttf")] });
  if (!fonts) return null;

  const para = Skia.ParagraphBuilder.Make(
    { textAlign: TextAlign.Center },
    fonts,
  )
    .pushStyle({
      fontSize: 24,
      fontFamilies: ["Roboto"],
      color: Skia.Color("black"),
    })
    .addText("Hello ")
    .pushStyle({
      fontSize: 24,
      fontFamilies: ["Roboto"],
      fontStyle: { weight: 700 },
    })
    .addText("Skia")
    .pop()
    .build();

  para.layout(PARAGRAPH_WIDTH);

  return (
    <Canvas style={{ width: PARAGRAPH_WIDTH, height: para.getHeight() }}>
      <Paragraph paragraph={para} x={0} y={0} width={PARAGRAPH_WIDTH} />
    </Canvas>
  );
}
```

**Why good:** mixed font weights in a single text block, automatic line breaking, measurable dimensions with `getHeight()` and `getLongestLine()`

See [examples/text-and-media.md](examples/text-and-media.md) for font loading, text styles, and effects on paragraphs.

---

### Pattern 8: Atlas Batch Rendering

Atlas draws thousands of sprites in a single draw call using one texture. Each sprite gets an individual RSXform (rotation + scale + translation). Ideal for tile maps, particle systems, and sprite animations.

```tsx
import {
  Canvas,
  Atlas,
  useImage,
  Skia,
  rect,
} from "@shopify/react-native-skia";

const SPRITE_SIZE = 32;
const GRID_COLS = 10;
const GRID_ROWS = 10;

export function TileMap() {
  const texture = useImage(require("./spritesheet.png"));
  if (!texture) return null;

  const sprites = Array.from({ length: GRID_COLS * GRID_ROWS }, () =>
    rect(0, 0, SPRITE_SIZE, SPRITE_SIZE),
  );

  const transforms = Array.from({ length: GRID_COLS * GRID_ROWS }, (_, i) => {
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    return Skia.RSXform(1, 0, col * SPRITE_SIZE, row * SPRITE_SIZE);
  });

  return (
    <Canvas
      style={{
        width: GRID_COLS * SPRITE_SIZE,
        height: GRID_ROWS * SPRITE_SIZE,
      }}
    >
      <Atlas image={texture} sprites={sprites} transforms={transforms} />
    </Canvas>
  );
}
```

**Why good:** single draw call for 100 sprites, RSXform encodes scale+rotation+translation efficiently, transforms can be animated via `useRSXformBuffer` worklets at near-zero cost

See [examples/animations.md](examples/animations.md) for animated Atlas with `useRSXformBuffer`.

</patterns>

---

<decision_framework>

## Decision Framework

### When to Use Skia vs Native Views

```
Does the feature need custom drawing (paths, gradients, blur, shaders)?
├─ YES → Skia Canvas
└─ NO → Does it need high-performance batch rendering (100+ similar elements)?
    ├─ YES → Skia Atlas
    └─ NO → Does it need rich text with mixed fonts/decorations?
        ├─ YES → Skia Paragraph (or native Text if simple)
        └─ NO → Standard React Native views
```

### Declarative vs Imperative API

```
Is the shape/path static or defined at build time?
├─ YES → Declarative JSX (<Circle />, <Path path="..." />)
└─ NO → Is the shape computed dynamically per frame?
    ├─ YES → Imperative (Skia.Path.Make()) inside worklets or useDerivedValue
    └─ NO → Is the shape created once based on data?
        ├─ YES → Imperative, created outside render, passed as prop
        └─ NO → Declarative with animated shared value props
```

### Choosing the Right Text API

```
Need simple single-style text?
├─ YES → Skia <Text> component (single font, single style)
└─ NO → Need mixed fonts, weights, or line breaking?
    ├─ YES → Paragraph API (ParagraphBuilder)
    └─ NO → Need text on a path?
        ├─ YES → <TextPath> component
        └─ NO → <Text> with Glyphs for advanced positioning
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Using `createAnimatedComponent` or `useAnimatedProps` with Skia components -- unnecessary; pass shared values directly as props
- Using Reanimated's `interpolateColor` for Skia color animations -- produces wrong colors; use `interpolateColors` from `@shopify/react-native-skia`
- Applying paint children (Shader, Blur) directly to Paragraph, Picture, or ImageSVG -- they ignore standard paint inheritance; use the `layer` property
- Using ScrollView with map() to render many Skia shapes -- use Atlas for batch rendering, or Picture for dynamic draw counts
- Performing heavy computations in Canvas children on JS thread -- offload to worklets or `useDerivedValue` to keep animations on UI thread

**Medium Priority Issues:**

- Not setting `origin` on Group transforms and expecting center-based rotation -- default is top-left
- RuntimeShader ignoring pixel density -- content appears blurry on high-DPI screens; wrap in a scale layer (scale by `PixelRatio.get()`, then scale back by `1/pd`)
- Creating new Path objects every render -- memoize or use `usePathValue` to avoid garbage collection pressure
- Hardcoding Canvas dimensions instead of using `onSize` shared value or `useCanvasSize` -- breaks on different screen sizes
- Missing `androidWarmup={true}` for opaque canvases -- first frame renders white on Android

**Gotchas & Edge Cases:**

- Canvas uses its own React renderer -- React context from outside the Canvas is NOT available inside it
- `useCanvasSize` returns `{ width: 0, height: 0 }` on first render -- guard against zero dimensions
- ImageSVG does not render `<text>` elements, CSS styles, or `<animate>` -- preprocess SVGs with SVGO
- `Skia.RuntimeEffect.Make()` returns null if the shader has syntax errors -- always handle the null case
- Atlas transforms are RSXform (rotation-scale-translation), not standard Transform2d -- use `Skia.RSXform()` or `Skia.RSXformFromRadians()`
- Path interpolation requires paths with the same number and types of commands -- mismatched paths crash
- `useImage` returns null while loading -- always guard rendering on image availability
- Bundle size impact: +6MB iOS, +4MB Android, +2.9MB web (CanvasKit WASM)
- React Native >= 0.79 and React >= 19 required for current versions (v1.12.4 for RN <= 0.78)
- Canvas snapshot: use `makeImageSnapshotAsync()` for images with textures, `makeImageSnapshot()` only for texture-free drawings
- `useFonts` returns null while fonts load -- guard Paragraph rendering until fonts are ready

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST pass Reanimated shared values directly as Skia component props -- do NOT use createAnimatedComponent or useAnimatedProps)**

**(You MUST use `interpolateColors` from `@shopify/react-native-skia` for color animations -- Reanimated's `interpolateColor` uses a different internal color format and produces wrong results)**

**(You MUST use the `layer` property to apply paint effects to Paragraph, Picture, and ImageSVG components -- they do not follow standard paint inheritance rules)**

**(You MUST remember that Group transform origin defaults to top-left, not center -- set `origin` prop explicitly for center-based rotations)**

**Failure to follow these rules will produce broken color animations, invisible paint effects, and incorrectly positioned rotations.**

</critical_reminders>
