# React Native Skia - Core Patterns

> Canvas setup, shapes, paths, paint, groups, and images. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

**Prerequisites:** Familiarity with React Native and basic 2D graphics concepts.

---

## Pattern 1: Canvas with Reactive Sizing

```tsx
import { Canvas, Circle, useCanvasSize } from "@shopify/react-native-skia";
import { useSharedValue } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

// onSize: UI thread reactive dimensions (preferred for animations)
export function ReactiveCanvas() {
  const size = useSharedValue({ width: 0, height: 0 });

  return (
    <Canvas style={{ flex: 1 }} onSize={size}>
      <CenteredCircle size={size} />
    </Canvas>
  );
}

// useCanvasSize: JS thread dimensions (for layout calculations)
function CenteredCircle({
  size,
}: {
  size: SharedValue<{ width: number; height: number }>;
}) {
  // Derive center from shared value for UI thread animation
  return <Circle cx={128} cy={128} r={40} color="cyan" />;
}
```

**Why good:** `onSize` updates on UI thread without JS bridge, `useCanvasSize` available for JS-thread calculations

---

## Pattern 2: All Shape Primitives

```tsx
import {
  Canvas,
  Circle,
  Rect,
  RoundedRect,
  Line,
  Oval,
  Points,
  DiffRect,
  rrect,
  rect,
} from "@shopify/react-native-skia";

const CANVAS_SIZE = 300;
const CORNER_RADIUS = 12;
const STROKE_WIDTH = 2;

export function ShapeShowcase() {
  return (
    <Canvas style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
      {/* Filled shapes */}
      <Circle cx={50} cy={50} r={30} color="cyan" />
      <Rect x={100} y={20} width={60} height={60} color="red" />
      <RoundedRect
        x={180}
        y={20}
        width={60}
        height={60}
        r={CORNER_RADIUS}
        color="blue"
      />
      <Oval x={20} y={100} width={80} height={50} color="green" />

      {/* Stroked shapes */}
      <Circle
        cx={180}
        cy={130}
        r={30}
        color="purple"
        style="stroke"
        strokeWidth={STROKE_WIDTH}
      />
      <Line
        p1={{ x: 0, y: 200 }}
        p2={{ x: 300, y: 200 }}
        color="gray"
        strokeWidth={1}
      />

      {/* Points */}
      <Points
        points={[
          { x: 50, y: 250 },
          { x: 100, y: 230 },
          { x: 150, y: 260 },
        ]}
        mode="polygon"
        color="orange"
        style="stroke"
        strokeWidth={STROKE_WIDTH}
      />

      {/* DiffRect: outer rect minus inner rect (ring/frame shape) */}
      <DiffRect
        outer={rrect(rect(180, 200, 80, 80), CORNER_RADIUS, CORNER_RADIUS)}
        inner={rrect(rect(195, 215, 50, 50), 8, 8)}
        color="pink"
      />
    </Canvas>
  );
}
```

---

## Pattern 3: Path Operations

```tsx
import { Canvas, Path, DashPathEffect, Skia } from "@shopify/react-native-skia";

const STROKE_WIDTH = 3;

// Declarative: SVG path string
export function DeclarativePath() {
  return (
    <Canvas style={{ width: 256, height: 256 }}>
      <Path
        path="M 10 80 Q 95 10 180 80 T 350 80"
        color="purple"
        style="stroke"
        strokeWidth={STROKE_WIDTH}
        strokeCap="round"
      />
    </Canvas>
  );
}

// Imperative: dynamic construction
export function ImperativePath() {
  const path = Skia.Path.Make();
  path.moveTo(10, 80);
  path.quadTo(95, 10, 180, 80);
  path.cubicTo(200, 120, 250, 50, 300, 80);
  path.close();

  return (
    <Canvas style={{ width: 320, height: 160 }}>
      <Path path={path} color="teal" />
    </Canvas>
  );
}

// Path with dash effect
export function DashedPath() {
  return (
    <Canvas style={{ width: 256, height: 256 }}>
      <Path
        path="M 10 128 L 246 128"
        color="black"
        style="stroke"
        strokeWidth={2}
      >
        {/* DashPathEffect: [dashLength, gapLength] */}
        <DashPathEffect intervals={[10, 5]} />
      </Path>
    </Canvas>
  );
}
```

**Why good:** declarative SVG strings for static paths, imperative API for data-driven shapes, path effects compose as children

---

## Pattern 4: Paint Composition (Multiple Fills/Strokes)

A single shape can have multiple paint layers by adding `<Paint>` children. This creates effects like fill + stroke, or fill + inner shadow.

```tsx
import { Canvas, Circle, Paint } from "@shopify/react-native-skia";

const OUTER_STROKE = 3;

export function MultiPaintCircle() {
  return (
    <Canvas style={{ width: 200, height: 200 }}>
      <Circle cx={100} cy={100} r={60}>
        {/* First paint: blue fill */}
        <Paint color="blue" />
        {/* Second paint: white stroke on top */}
        <Paint color="white" style="stroke" strokeWidth={OUTER_STROKE} />
      </Circle>
    </Canvas>
  );
}
```

**Why good:** multiple paints on one shape without duplicating the shape, paints render in order (fill first, then stroke)

---

## Pattern 5: Group Transforms and Clipping

```tsx
import { Canvas, Group, Rect, Circle, Skia } from "@shopify/react-native-skia";

const ROTATION_DEGREES = 45;
const ROTATION_RADIANS = (ROTATION_DEGREES * Math.PI) / 180;

// Transform with explicit origin (default is top-left, NOT center)
export function RotatedGroup() {
  return (
    <Canvas style={{ width: 256, height: 256 }}>
      <Group
        transform={[{ rotate: ROTATION_RADIANS }]}
        origin={{ x: 128, y: 128 }}
      >
        <Rect x={88} y={88} width={80} height={80} color="red" />
      </Group>
    </Canvas>
  );
}

// Clipping with a path
export function ClippedGroup() {
  const clipPath = Skia.Path.Make();
  clipPath.addCircle(128, 128, 80);

  return (
    <Canvas style={{ width: 256, height: 256 }}>
      <Group clip={clipPath}>
        <Rect x={0} y={0} width={256} height={256} color="blue" />
        {/* Only the portion inside the circle clip is visible */}
      </Group>
    </Canvas>
  );
}

// Inverted clip: show everything OUTSIDE the clip region
export function InvertedClip() {
  return (
    <Canvas style={{ width: 256, height: 256 }}>
      <Group clip={{ x: 80, y: 80, width: 96, height: 96 }} invertClip>
        <Rect x={0} y={0} width={256} height={256} color="green" />
      </Group>
    </Canvas>
  );
}
```

**Why good:** explicit origin prevents rotation surprise (default top-left), clip accepts rect/rrect/path, invertClip for masking effects

---

## Pattern 6: Images and FitBox

```tsx
import {
  Canvas,
  Image,
  useImage,
  FitBox,
  Circle,
  rect,
} from "@shopify/react-native-skia";

export function ImageExample() {
  const image = useImage(require("./photo.png"));
  if (!image) return null; // Always guard: useImage returns null while loading

  return (
    <Canvas style={{ width: 256, height: 256 }}>
      {/* fit modes: contain, cover, fill, fitWidth, fitHeight, none */}
      <Image image={image} x={0} y={0} width={256} height={256} fit="cover" />
    </Canvas>
  );
}

// FitBox: auto-scale content to fit a destination rectangle
export function FitBoxExample() {
  const SRC = rect(0, 0, 100, 100); // Original coordinate space
  const DST = rect(0, 0, 256, 256); // Target display size

  return (
    <Canvas style={{ width: 256, height: 256 }}>
      <FitBox src={SRC} dst={DST} fit="contain">
        {/* These coordinates are in the 100x100 source space */}
        <Circle cx={50} cy={50} r={40} color="cyan" />
      </FitBox>
    </Canvas>
  );
}
```

**Why good:** FitBox auto-scales children from source to destination coordinates, image `fit` modes match React Native Image behavior

---

## Pattern 7: Layer Property for Non-Standard Components

Paragraph, Picture, and ImageSVG do not inherit paint from parent Groups. Use the `layer` property to apply effects.

```tsx
import { Canvas, Group, Paragraph, Paint, Blur } from "@shopify/react-native-skia";

// BAD: Blur on Group does NOT apply to Paragraph
<Group>
  <Blur blur={4} />
  <Paragraph paragraph={para} x={0} y={0} width={300} />
</Group>

// GOOD: Use layer property
<Group layer={<Paint><Blur blur={4} /></Paint>}>
  <Paragraph paragraph={para} x={0} y={0} width={300} />
</Group>
```

**Why bad:** Paragraph ignores paint children on parent Group, blur silently has no effect

**Why good:** `layer` creates a bitmap rendering layer, effects apply to the entire group output including Paragraph
