# React Three Fiber Quick Reference

> Decision frameworks, Canvas props, hook signatures, ecosystem packages, and anti-patterns. See [SKILL.md](SKILL.md) for concepts and [examples/](examples/) for full code examples.

---

## Canvas Props Reference

| Prop              | Type                                                         | Default                                                  | Purpose                  |
| ----------------- | ------------------------------------------------------------ | -------------------------------------------------------- | ------------------------ |
| `camera`          | `CameraProps \| THREE.Camera`                                | `{ fov: 75, near: 0.1, far: 1000, position: [0, 0, 5] }` | Camera configuration     |
| `gl`              | `RendererProps \| (canvas) => Renderer`                      | `{}`                                                     | WebGL renderer config    |
| `shadows`         | `boolean \| "basic" \| "percentage" \| "soft" \| "variance"` | `false`                                                  | Shadow map type          |
| `frameloop`       | `"always" \| "demand" \| "never"`                            | `"always"`                                               | Render loop mode         |
| `dpr`             | `number \| [min, max]`                                       | `[1, 2]`                                                 | Device pixel ratio       |
| `orthographic`    | `boolean`                                                    | `false`                                                  | Use orthographic camera  |
| `flat`            | `boolean`                                                    | `false`                                                  | Disable tone mapping     |
| `linear`          | `boolean`                                                    | `false`                                                  | Disable sRGB color space |
| `scene`           | `SceneProps \| THREE.Scene`                                  | `{}`                                                     | Scene configuration      |
| `raycaster`       | `RaycasterProps`                                             | `{}`                                                     | Raycaster configuration  |
| `onCreated`       | `(state) => void`                                            | -                                                        | Fires when Canvas mounts |
| `onPointerMissed` | `(event) => void`                                            | -                                                        | Click missed all meshes  |

---

## Hook Signatures

### useFrame

```typescript
useFrame(
  callback: (state: RootState, delta: number, xrFrame?: XRFrame) => void,
  renderPriority?: number
): void
```

- `state` -- Full fiber state (scene, camera, gl, clock, pointer, size, viewport)
- `delta` -- Time since last frame in seconds
- `renderPriority` -- Execution order; >= 1 takes over rendering (must call `gl.render()`)

### useThree

```typescript
// Full state (re-renders on any state change)
const state = useThree(): RootState

// Selector (re-renders only when selected value changes)
const camera = useThree((state) => state.camera): THREE.Camera

// Non-reactive getter
const get = useThree((state) => state.get): () => RootState
```

**Key state properties:** `gl`, `scene`, `camera`, `pointer`, `size`, `viewport`, `clock`, `invalidate`, `setSize`

**Gotcha:** Selecting Three.js internals like `state.camera.zoom` is NOT reactive -- Three.js mutations don't trigger React updates.

### useLoader

```typescript
const result = useLoader(
  Loader: new () => THREE.Loader,
  url: string | string[],
  extensions?: (loader: THREE.Loader) => void,
  onProgress?: (event: ProgressEvent) => void
): LoaderResult | LoaderResult[]
```

Automatically caches by URL. Suspends the component until loaded.

### useGraph

```typescript
const { nodes, materials } = useGraph(object: THREE.Object3D): {
  nodes: Record<string, THREE.Object3D>,
  materials: Record<string, THREE.Material>
}
```

---

## Event Object Type

```typescript
interface ThreeEvent<T extends Event> extends T {
  // Three.js intersection data
  object: THREE.Object3D; // Actually hit mesh
  eventObject: THREE.Object3D; // Mesh with the handler
  point: THREE.Vector3; // World-space hit point
  distance: number; // Distance from camera
  face: THREE.Face | null; // Hit triangle
  ray: THREE.Ray; // Raycaster ray
  camera: THREE.Camera; // Active camera
  unprojectedPoint: THREE.Vector3; // Camera-unprojected point
  intersections: THREE.Intersection[]; // All hits (nearest first)
  delta: number; // mousedown-to-mouseup px distance

  // Methods
  stopPropagation(): void; // Stop bubble + occluded delivery
}
```

---

## Ecosystem Packages

| Package                       | Import                                                                                                                                   | Purpose                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `@react-three/fiber`          | `Canvas, useFrame, useThree, useLoader`                                                                                                  | Core renderer            |
| `@react-three/drei`           | `OrbitControls, Environment, useGLTF, Text, Html, Float, Detailed, ContactShadows, PerformanceMonitor, Instances, Instance, AdaptiveDpr` | Helpers and abstractions |
| `@react-three/rapier`         | `Physics, RigidBody, CuboidCollider, BallCollider, MeshCollider, InstancedRigidBodies, useRapier`                                        | Rapier WASM physics      |
| `@react-three/postprocessing` | `EffectComposer, Bloom, Vignette, DepthOfField, SSAO, ChromaticAberration`                                                               | Post-processing effects  |

---

## Common Post-Processing Effects

```tsx
import {
  EffectComposer,
  Bloom,
  Vignette,
  DepthOfField,
  ChromaticAberration,
  SSAO,
  ToneMapping,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

<EffectComposer multisampling={4}>
  <Bloom intensity={0.5} luminanceThreshold={0.9} />
  <Vignette darkness={0.5} offset={0.5} />
  <DepthOfField focusDistance={0.01} focalLength={0.02} bokehScale={3} />
  <SSAO radius={0.1} intensity={30} />
  <ChromaticAberration
    offset={[0.002, 0.002]}
    blendFunction={BlendFunction.NORMAL}
  />
  <ToneMapping />
</EffectComposer>;
```

**Performance note:** EffectComposer merges compatible effects into a single render pass automatically. Adding effects has less overhead than using separate passes.

---

## Anti-Pattern Checklist

| Anti-Pattern                                               | Fix                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| `setState` inside `useFrame`                               | Mutate refs directly                                      |
| `new THREE.Vector3()` inside `useFrame`                    | `useMemo(() => new THREE.Vector3(), [])`                  |
| Missing `<Suspense>` around `useLoader`/`useGLTF`          | Wrap in `<Suspense fallback={...}>`                       |
| Individual meshes for repeated objects                     | `<instancedMesh>` or drei `<Instances>`                   |
| Missing `stopPropagation()` on click events                | Always call `e.stopPropagation()`                         |
| `frameloop="always"` for static scenes                     | `frameloop="demand"` + `invalidate()`                     |
| Unbounded `dpr` on HiDPI displays                          | `dpr={[1, 2]}` to clamp                                   |
| Using `useThree()` without selector                        | `useThree((s) => s.camera)` to avoid all-state re-renders |
| Declarative `<boxGeometry>` for repeated identical objects | Share via `useMemo(() => new THREE.BoxGeometry(...), [])` |
| `<Physics>` without `<Suspense>`                           | Rapier loads WASM async -- wrap in Suspense               |

---

## Three.js to JSX Mapping

Every Three.js class maps to a camelCase JSX element:

| Three.js                                           | JSX                                        |
| -------------------------------------------------- | ------------------------------------------ |
| `new THREE.Mesh()`                                 | `<mesh>`                                   |
| `new THREE.BoxGeometry(1, 1, 1)`                   | `<boxGeometry args={[1, 1, 1]}>`           |
| `new THREE.MeshStandardMaterial({ color: "red" })` | `<meshStandardMaterial color="red">`       |
| `new THREE.Group()`                                | `<group>`                                  |
| `new THREE.AmbientLight(0xffffff, 0.5)`            | `<ambientLight intensity={0.5}>`           |
| `new THREE.DirectionalLight()`                     | `<directionalLight>`                       |
| `new THREE.PointLight()`                           | `<pointLight>`                             |
| `new THREE.SpotLight()`                            | `<spotLight>`                              |
| `new THREE.PerspectiveCamera()`                    | `<perspectiveCamera>`                      |
| `new THREE.InstancedMesh(geo, mat, count)`         | `<instancedMesh args={[geo, mat, count]}>` |

**Constructor args:** Use the `args` prop as an array matching the constructor signature.

**Property access:** Use dash-separated notation for nested properties: `position-x={1}`, `rotation-y={Math.PI}`, `shadow-mapSize-width={2048}`.

---

## Collider Types (Rapier)

| Type        | Shape            | Performance | Use When                |
| ----------- | ---------------- | ----------- | ----------------------- |
| `"cuboid"`  | Axis-aligned box | Fastest     | Boxes, floors, walls    |
| `"ball"`    | Sphere           | Fast        | Balls, particles        |
| `"hull"`    | Convex envelope  | Medium      | Convex shapes, vehicles |
| `"trimesh"` | Triangle mesh    | Slowest     | Concave, complex shapes |
| `false`     | None (manual)    | -           | Custom collider setup   |
