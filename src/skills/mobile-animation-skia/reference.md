# React Native Skia Quick Reference

> Decision frameworks, paint properties, SkSL types, and checklists. See [SKILL.md](SKILL.md) for patterns, red flags, and critical rules.

---

## Paint Properties Reference

| Property      | Type                            | Default     | Description          |
| ------------- | ------------------------------- | ----------- | -------------------- |
| `color`       | `string \| Color`               | `"black"`   | Fill or stroke color |
| `style`       | `"fill" \| "stroke"`            | `"fill"`    | Drawing mode         |
| `strokeWidth` | `number`                        | `1`         | Stroke width         |
| `strokeJoin`  | `"miter" \| "round" \| "bevel"` | `"miter"`   | Stroke join style    |
| `strokeCap`   | `"butt" \| "round" \| "square"` | `"butt"`    | Stroke cap style     |
| `strokeMiter` | `number`                        | `4`         | Miter limit          |
| `opacity`     | `number`                        | `1`         | Opacity (0-1)        |
| `blendMode`   | `BlendMode`                     | `"srcOver"` | How pixels compose   |
| `antiAlias`   | `boolean`                       | `true`      | Anti-aliasing        |

**Paint children (complex effects):** Shader, ImageFilter (Blur, Shadow, Morphology, Offset, DisplacementMap, RuntimeShader), ColorFilter, MaskFilter, PathEffect

---

## Canvas Props

| Prop            | Type                | Purpose                                |
| --------------- | ------------------- | -------------------------------------- |
| `style`         | `ViewStyle`         | Standard RN view styling               |
| `ref`           | `Ref<SkiaView>`     | Access for snapshots                   |
| `onSize`        | `SharedValue<Size>` | Reactive canvas dimensions (UI thread) |
| `androidWarmup` | `boolean`           | Avoids white first frame on Android    |

**Snapshot methods:**

- `makeImageSnapshotAsync()` -- for drawings with textures (images, shaders)
- `makeImageSnapshot(rect?)` -- for texture-free drawings (shapes, paths only)

---

## SkSL Uniform Types

| Type                               | Description                                     |
| ---------------------------------- | ----------------------------------------------- |
| `float`                            | Single float                                    |
| `float2`, `float3`, `float4`       | Float vectors (aliases: `vec2`, `vec3`, `vec4`) |
| `int`, `int2`, `int3`, `int4`      | Integer types                                   |
| `float2x2`, `float3x3`, `float4x4` | Matrices                                        |
| `uniform shader`                   | Child shader (sampled via `.eval(xy)`)          |

Arrays supported: `uniform float3 colors[12]`

**Key SkSL differences from GLSL:**

- Use `.eval(xy)` instead of `sample()` / `texture()` for child shaders
- Entry point: `vec4 main(vec2 pos)` -- `pos` is in canvas coordinates
- `half4` and `vec4` both work for color output

---

## RSXform Reference

RSXform encodes scale, rotation, and translation in 4 floats:

| Factory                                                   | Parameters               | Use Case                       |
| --------------------------------------------------------- | ------------------------ | ------------------------------ |
| `Skia.RSXform(scos, ssin, tx, ty)`                        | Pre-computed cos/sin     | When you have raw trig values  |
| `Skia.RSXformFromRadians(scale, radians, tx, ty, px, py)` | Angle in radians + pivot | Rotation around a center point |

**Identity:** `Skia.RSXform(1, 0, tx, ty)` -- no rotation, no scale, just translate

---

## Image Loading Hooks

| Hook                | Input                     | Returns                          | Notes                      |
| ------------------- | ------------------------- | -------------------------------- | -------------------------- |
| `useImage(source)`  | `require()` or URL        | `SkImage \| null`                | Returns null while loading |
| `useSVG(source)`    | `require()` or URL        | `SkSVG \| null`                  | Returns null while loading |
| `useFonts(fontMap)` | `{ family: [require()] }` | `SkTypefaceFontProvider \| null` | Required for Paragraph     |

---

## Animation Hooks

| Hook                                    | Purpose                  | Key Detail                                  |
| --------------------------------------- | ------------------------ | ------------------------------------------- |
| `usePathInterpolation(progress, paths)` | Morph between paths      | Paths must have same command count/types    |
| `usePathValue(callback)`                | Efficient dynamic paths  | Callback must include `"worklet"` directive |
| `useClock()`                            | Elapsed time in ms       | Independent of shared values                |
| `useRSXformBuffer(count, callback)`     | Animate Atlas transforms | Worklet-based, near-zero cost               |
| `useRectBuffer(count, callback)`        | Animate Atlas sprites    | For sprite sheet animations                 |

---

## Version Compatibility

| @shopify/react-native-skia | React Native | React |
| -------------------------- | ------------ | ----- |
| >= 1.13 (v2.x)             | >= 0.79      | >= 19 |
| <= 1.12.4                  | <= 0.78      | <= 18 |

**Bundle size impact:** iOS +6MB, Android +4MB, Web +2.9MB (CanvasKit WASM)

---

## Components That Need `layer` for Paint Effects

These components use Skia's own rendering modules and do not inherit paint from parent Groups:

- `<Paragraph>` -- use `layer` prop with Paint for text effects
- `<Picture>` -- use `layer` prop with Paint for recorded drawing effects
- `<ImageSVG>` -- use `layer` prop with Paint for SVG effects

```tsx
// Apply blur to a Paragraph via layer
<Group
  layer={
    <Paint>
      <Blur blur={2} />
    </Paint>
  }
>
  <Paragraph paragraph={para} x={0} y={0} width={300} />
</Group>
```
