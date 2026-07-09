# React Native Skia - Animation Patterns

> Reanimated integration, path interpolation, color animation, and Atlas animation. See [SKILL.md](../SKILL.md) for decision guidance.

**Related:** [core.md](core.md) for basic shapes and canvas setup, [effects.md](effects.md) for animated shaders.

---

## Pattern 1: Shared Values as Props

Pass Reanimated shared values directly to Skia component props. No `createAnimatedComponent` needed.

```tsx
import { Canvas, Circle, RoundedRect } from "@shopify/react-native-skia";
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

const DURATION_MS = 1500;
const SIZE = 256;
const MIN_RADIUS = 10;
const MAX_RADIUS = 80;

export function AnimatedShapes() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: DURATION_MS }),
      -1,
      true,
    );
  }, []);

  // Derive values from the animated progress
  const radius = useDerivedValue(
    () => MIN_RADIUS + progress.value * (MAX_RADIUS - MIN_RADIUS),
  );
  const x = useDerivedValue(() => progress.value * (SIZE - MAX_RADIUS * 2));

  return (
    <Canvas style={{ width: SIZE, height: SIZE }}>
      <Circle cx={128} cy={80} r={radius} color="cyan" />
      <RoundedRect x={x} y={150} width={60} height={60} r={8} color="orange" />
    </Canvas>
  );
}
```

**Why good:** `radius` and `x` are derived values that update on UI thread, zero JS bridge cost, 60 FPS guaranteed

```tsx
// BAD: Using createAnimatedComponent (unnecessary with Skia)
import Animated from "react-native-reanimated";
const AnimatedCircle = Animated.createAnimatedComponent(Circle); // WRONG
```

**Why bad:** Skia components natively accept shared values -- wrapping in Animated adds overhead and complexity for no benefit

---

## Pattern 2: Color Animation with interpolateColors

Skia uses a different internal color format than Reanimated. Always use `interpolateColors` from Skia.

```tsx
import { Canvas, Circle, interpolateColors } from "@shopify/react-native-skia";
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

const CYCLE_DURATION = 3000;
const COLORS = ["cyan", "magenta", "yellow", "cyan"];
const COLOR_STOPS = [0, 0.33, 0.66, 1];

export function ColorCycleCircle() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: CYCLE_DURATION }),
      -1,
    );
  }, []);

  const color = useDerivedValue(() =>
    interpolateColors(progress.value, COLOR_STOPS, COLORS),
  );

  return (
    <Canvas style={{ width: 200, height: 200 }}>
      <Circle cx={100} cy={100} r={60} color={color} />
    </Canvas>
  );
}
```

**Why good:** `interpolateColors` from Skia handles Skia's internal color format correctly

```tsx
// BAD: Using Reanimated's interpolateColor
import { interpolateColor } from "react-native-reanimated"; // WRONG for Skia
const color = useDerivedValue(() =>
  interpolateColor(progress.value, [0, 1], ["red", "blue"]),
);
```

**Why bad:** Reanimated's `interpolateColor` uses a different internal format, produces wrong/flickering colors in Skia components

---

## Pattern 3: Path Interpolation

Morph between multiple paths smoothly. Paths must have the same number and types of commands.

```tsx
import { Canvas, Path, usePathInterpolation } from "@shopify/react-native-skia";
import {
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

const MORPH_DURATION = 2000;

// All paths must have identical command structure (same moveTo, lineTo, etc. count)
const TRIANGLE = "M 128 20 L 236 200 L 20 200 Z";
const DIAMOND = "M 128 20 L 236 128 L 128 236 Z";
const SQUARE = "M 40 40 L 216 40 L 216 216 Z";

export function MorphingShape() {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: MORPH_DURATION }),
      -1,
      true,
    );
  }, []);

  const path = usePathInterpolation(
    progress,
    [0, 0.5, 1],
    [TRIANGLE, DIAMOND, SQUARE],
  );

  return (
    <Canvas style={{ width: 256, height: 256 }}>
      <Path path={path} color="purple" />
    </Canvas>
  );
}
```

**Why good:** `usePathInterpolation` handles the interpolation on UI thread, multiple keyframes supported

**Gotcha:** paths with different command counts crash at runtime. For incompatible paths, preprocess with a library like Flubber.

---

## Pattern 4: Dynamic Paths with usePathValue

For paths that change shape every frame (e.g., waveforms, trails), use `usePathValue` with a worklet callback.

```tsx
import { Canvas, Path, usePathValue, Skia } from "@shopify/react-native-skia";
import { useClock } from "@shopify/react-native-skia";

const WAVE_POINTS = 50;
const AMPLITUDE = 30;
const CANVAS_WIDTH = 300;
const CANVAS_HEIGHT = 200;

export function AnimatedWave() {
  const clock = useClock();

  const path = usePathValue((cPath) => {
    "worklet";
    const t = clock.value / 1000;
    cPath.reset();
    cPath.moveTo(0, CANVAS_HEIGHT / 2);

    for (let i = 0; i <= WAVE_POINTS; i++) {
      const x = (i / WAVE_POINTS) * CANVAS_WIDTH;
      const y = CANVAS_HEIGHT / 2 + Math.sin(x * 0.05 + t * 3) * AMPLITUDE;
      cPath.lineTo(x, y);
    }
  });

  return (
    <Canvas style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
      <Path path={path} color="teal" style="stroke" strokeWidth={2} />
    </Canvas>
  );
}
```

**Why good:** worklet runs on UI thread, path updated every frame without JS thread involvement, `useClock` provides elapsed time

---

## Pattern 5: Animated Atlas with useRSXformBuffer

Animate thousands of sprites with worklet-based transforms at near-zero cost.

```tsx
import {
  Canvas,
  Atlas,
  useImage,
  rect,
  useRSXformBuffer,
} from "@shopify/react-native-skia";
import { useClock } from "@shopify/react-native-skia";

const SPRITE_COUNT = 100;
const SPRITE_SIZE = 16;
const CANVAS_SIZE = 256;

export function AnimatedSprites() {
  const texture = useImage(require("./particle.png"));
  const clock = useClock();

  const sprites = Array.from({ length: SPRITE_COUNT }, () =>
    rect(0, 0, SPRITE_SIZE, SPRITE_SIZE),
  );

  const transforms = useRSXformBuffer(SPRITE_COUNT, (val, i) => {
    "worklet";
    const t = clock.value / 1000;
    const angle = (i / SPRITE_COUNT) * Math.PI * 2 + t;
    const radius = 60 + Math.sin(t + i * 0.1) * 30;
    const x = CANVAS_SIZE / 2 + Math.cos(angle) * radius;
    const y = CANVAS_SIZE / 2 + Math.sin(angle) * radius;
    const scale = 0.5 + Math.sin(t * 2 + i) * 0.3;

    val.set(Math.cos(angle) * scale, Math.sin(angle) * scale, x, y);
  });

  if (!texture) return null;

  return (
    <Canvas style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
      <Atlas image={texture} sprites={sprites} transforms={transforms} />
    </Canvas>
  );
}
```

**Why good:** `useRSXformBuffer` runs worklet per sprite per frame on UI thread, single draw call for all 100 sprites, `val.set(scos, ssin, tx, ty)` is the RSXform interface
