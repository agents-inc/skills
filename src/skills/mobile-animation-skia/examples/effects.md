# React Native Skia - Effects Patterns

> Image filters, backdrop blur, shaders, and RuntimeShader. See [SKILL.md](../SKILL.md) for decision guidance.

**Related:** [core.md](core.md) for shapes and paint, [animations.md](animations.md) for animating shader uniforms.

---

## Pattern 1: Image Filters (Blur, Shadow, ColorMatrix)

Image filters compose as children of shapes or Groups. Multiple filters can be nested.

```tsx
import {
  Canvas,
  Image,
  Rect,
  Blur,
  Shadow,
  ColorMatrix,
  useImage,
} from "@shopify/react-native-skia";

const BLUR_SIGMA = 8;
const SHADOW_DX = 4;
const SHADOW_DY = 4;
const SHADOW_BLUR = 6;

// Blur filter
export function BlurredImage() {
  const image = useImage(require("./photo.png"));
  if (!image) return null;

  return (
    <Canvas style={{ width: 256, height: 256 }}>
      <Image image={image} fit="cover" x={0} y={0} width={256} height={256}>
        <Blur blur={BLUR_SIGMA} mode="clamp" />
      </Image>
    </Canvas>
  );
}

// Shadow filter
export function ShadowedRect() {
  return (
    <Canvas style={{ width: 256, height: 256 }}>
      <Rect x={40} y={40} width={160} height={160} color="white">
        <Shadow
          dx={SHADOW_DX}
          dy={SHADOW_DY}
          blur={SHADOW_BLUR}
          color="rgba(0,0,0,0.4)"
        />
      </Rect>
    </Canvas>
  );
}

// Composed: Blur + ColorMatrix (grayscale)
const GRAYSCALE_MATRIX = [
  0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152,
  0.0722, 0, 0, 0, 0, 0, 1, 0,
];

export function GrayscaleBlurredImage() {
  const image = useImage(require("./photo.png"));
  if (!image) return null;

  return (
    <Canvas style={{ width: 256, height: 256 }}>
      <Image image={image} fit="cover" x={0} y={0} width={256} height={256}>
        <Blur blur={4} mode="clamp">
          <ColorMatrix matrix={GRAYSCALE_MATRIX} />
        </Blur>
      </Image>
    </Canvas>
  );
}
```

**Why good:** filters compose by nesting (inner applied first), Blur `mode` controls edge behavior ("clamp", "repeat", "mirror", "decal")

---

## Pattern 2: Backdrop Blur and Backdrop Filter

Apply effects to content behind a clipping region (like CSS `backdrop-filter`). BackdropBlur is a convenience wrapper; BackdropFilter accepts any image filter child.

```tsx
import {
  Canvas,
  Image,
  BackdropBlur,
  BackdropFilter,
  Fill,
  ColorMatrix,
  useImage,
} from "@shopify/react-native-skia";

const BACKDROP_BLUR_RADIUS = 10;

export function GlassMorphism() {
  const image = useImage(require("./background.png"));
  if (!image) return null;

  return (
    <Canvas style={{ width: 300, height: 400 }}>
      {/* Background image */}
      <Image image={image} fit="cover" x={0} y={0} width={300} height={400} />

      {/* Frosted glass panel in bottom half */}
      <BackdropBlur
        blur={BACKDROP_BLUR_RADIUS}
        clip={{ x: 20, y: 200, width: 260, height: 180 }}
      >
        <Fill color="rgba(255, 255, 255, 0.2)" />
      </BackdropBlur>
    </Canvas>
  );
}

// BackdropFilter with custom ColorMatrix
const SEPIA_MATRIX = [
  0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0,
  0, 0, 0, 0, 1, 0,
];

export function SepiaBackdrop() {
  return (
    <Canvas style={{ width: 256, height: 256 }}>
      {/* Content behind the filter */}
      <Fill color="cyan" />

      {/* Apply sepia to bottom half */}
      <BackdropFilter clip={{ x: 0, y: 128, width: 256, height: 128 }}>
        <ColorMatrix matrix={SEPIA_MATRIX} />
      </BackdropFilter>
    </Canvas>
  );
}
```

**Why good:** BackdropBlur/BackdropFilter apply to content already drawn on canvas (behind the clip), not to their own children

---

## Pattern 3: Custom SkSL Shader

Write GPU shaders with `Skia.RuntimeEffect.Make()`. Uniforms are passed as a plain object. Animate uniforms with shared values.

```tsx
import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

const ANIMATION_DURATION = 4000;
const CANVAS_SIZE = 256;

const GRADIENT_SHADER = `
  uniform float2 iResolution;
  uniform float iTime;

  vec4 main(vec2 pos) {
    vec2 uv = pos / iResolution;
    float r = 0.5 + 0.5 * sin(iTime + uv.x * 6.28);
    float g = 0.5 + 0.5 * sin(iTime * 1.3 + uv.y * 6.28);
    float b = 0.5 + 0.5 * sin(iTime * 0.7 + (uv.x + uv.y) * 3.14);
    return vec4(r, g, b, 1.0);
  }
`;

const effect = Skia.RuntimeEffect.Make(GRADIENT_SHADER);

export function AnimatedGradientShader() {
  const time = useSharedValue(0);

  useEffect(() => {
    time.value = withRepeat(
      withTiming(6.28, { duration: ANIMATION_DURATION }),
      -1,
    );
  }, []);

  if (!effect) return null; // Shader compilation failed

  return (
    <Canvas style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
      <Fill>
        <Shader
          source={effect}
          uniforms={{ iResolution: [CANVAS_SIZE, CANVAS_SIZE], iTime: time }}
        />
      </Fill>
    </Canvas>
  );
}
```

**Why good:** uniforms accept shared values directly for animation, `iResolution` as `float2` matches SkSL's `uniform float2`, null check handles shader compilation errors

---

## Pattern 4: RuntimeShader as Image Filter

RuntimeShader processes existing canvas content as a shader uniform. The filtered image is available as `uniform shader image` implicitly.

```tsx
import {
  Canvas,
  Image,
  RuntimeShader,
  Skia,
  useImage,
} from "@shopify/react-native-skia";

const PIXELATE_SHADER = `
  uniform shader image;
  uniform float2 resolution;
  uniform float pixelSize;

  vec4 main(vec2 pos) {
    vec2 uv = pos / resolution;
    vec2 blockUV = floor(uv * pixelSize) / pixelSize;
    return image.eval(blockUV * resolution);
  }
`;

const pixelateEffect = Skia.RuntimeEffect.Make(PIXELATE_SHADER);

const PIXEL_COUNT = 32;
const CANVAS_SIZE = 256;

export function PixelatedImage() {
  const photo = useImage(require("./photo.png"));
  if (!photo || !pixelateEffect) return null;

  return (
    <Canvas style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}>
      <Image
        image={photo}
        fit="cover"
        x={0}
        y={0}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
      >
        <RuntimeShader
          source={pixelateEffect}
          uniforms={{
            resolution: [CANVAS_SIZE, CANVAS_SIZE],
            pixelSize: PIXEL_COUNT,
          }}
        />
      </Image>
    </Canvas>
  );
}
```

**Why good:** `image.eval(xy)` samples the source image at given coordinates, uniforms control the effect parameters

**Gotcha:** RuntimeShader does not account for pixel density scaling. On high-DPI screens, content appears blurry. Fix by wrapping in a Group with `transform={[{ scale: pd }]}` and rendering into a canvas scaled by `1/pd`.

---

## Pattern 5: Shader with Child Shaders

Compose shaders by declaring `uniform shader` and sampling with `.eval(xy)`.

```tsx
import {
  Canvas,
  Fill,
  Shader,
  ImageShader,
  Skia,
  useImage,
} from "@shopify/react-native-skia";

const SWIRL_SHADER = `
  uniform shader image;
  uniform float2 center;
  uniform float radius;
  uniform float angle;

  vec4 main(vec2 pos) {
    vec2 d = pos - center;
    float dist = length(d);
    if (dist < radius) {
      float percent = (radius - dist) / radius;
      float theta = percent * percent * angle;
      float cosT = cos(theta);
      float sinT = sin(theta);
      d = vec2(d.x * cosT - d.y * sinT, d.x * sinT + d.y * cosT);
    }
    return image.eval(d + center);
  }
`;

const swirlEffect = Skia.RuntimeEffect.Make(SWIRL_SHADER);
const SWIRL_ANGLE = 3.14;
const SWIRL_RADIUS = 100;

export function SwirlImage() {
  const photo = useImage(require("./photo.png"));
  if (!photo || !swirlEffect) return null;

  return (
    <Canvas style={{ width: 256, height: 256 }}>
      <Fill>
        <Shader
          source={swirlEffect}
          uniforms={{
            center: [128, 128],
            radius: SWIRL_RADIUS,
            angle: SWIRL_ANGLE,
          }}
        >
          {/* Child shader: image texture available as `uniform shader image` */}
          <ImageShader
            image={photo}
            fit="cover"
            x={0}
            y={0}
            width={256}
            height={256}
          />
        </Shader>
      </Fill>
    </Canvas>
  );
}
```

**Why good:** child shader automatically binds to the first `uniform shader` declaration, `.eval(xy)` samples the child at computed coordinates, enables complex image distortion effects
