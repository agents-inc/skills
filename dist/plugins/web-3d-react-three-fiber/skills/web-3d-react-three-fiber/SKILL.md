---
name: web-3d-react-three-fiber
description: React Three Fiber (R3F) 3D rendering — Canvas, meshes, materials, lights, cameras, animations, events, physics, post-processing, performance
---

# React Three Fiber Patterns

> **Quick Guide:** R3F is a React renderer for Three.js. Every Three.js class maps to a JSX element (`<mesh>`, `<boxGeometry>`, `<meshStandardMaterial>`). Use `<Canvas>` for scene setup, `useFrame` for per-frame logic (never setState inside it), `useRef` for direct mutations, and `useLoader`/`useGLTF` for assets. Animate via refs in `useFrame`, not React state. Events work like DOM events with raycasting built in. Wrap exiting 3D components in `<Suspense>` for async asset loading.

> **Import:** `import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber"`

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST never call setState inside useFrame -- mutate refs directly for per-frame updates)**

**(You MUST wrap `<Canvas>` children that load assets in `<Suspense>` boundaries)**

**(You MUST reuse geometries and materials across meshes -- creating new instances per mesh wastes GPU memory)**

**(You MUST call `event.stopPropagation()` on pointer events to prevent hits passing through to occluded objects)**

**(You MUST use named constants for all numeric values -- positions, sizes, speeds, colors -- NO magic numbers)**

</critical_requirements>

---

**Auto-detection:** React Three Fiber, R3F, @react-three/fiber, @react-three/drei, @react-three/rapier, @react-three/postprocessing, Canvas, useFrame, useThree, useLoader, useGLTF, mesh, boxGeometry, meshStandardMaterial, OrbitControls, drei, three.js, 3D scene, WebGL, instancedMesh

**When to use:**

- Building 3D scenes, visualizations, or experiences in React
- Loading and displaying 3D models (GLTF, OBJ, FBX)
- Adding physics simulation to 3D objects
- Handling pointer/click interactions on 3D meshes
- Animating objects per-frame (rotation, position, scale)
- Applying post-processing effects (bloom, depth of field, SSAO)

**When NOT to use:**

- 2D-only UIs (standard React components)
- Static images of 3D content (pre-render instead)
- Performance-critical scenarios where raw Three.js without React overhead is needed

**Key patterns covered:**

- Canvas setup with camera, shadows, and renderer config
- Declarative meshes, geometries, materials, and lights
- Per-frame animation with `useFrame` and refs
- Pointer events, raycasting, and event propagation
- Asset loading with `useLoader`, `useGLTF`, and Suspense
- Drei helpers (OrbitControls, Environment, Text, Html, Detailed)
- Physics with `@react-three/rapier` (RigidBody, colliders, collision events)
- Post-processing with `@react-three/postprocessing`
- Performance: instancing, LOD, on-demand rendering, geometry reuse, disposal

---

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Canvas, meshes, materials, lights, camera, useFrame, asset loading, drei helpers
- [examples/interaction.md](examples/interaction.md) - Events, raycasting, hover/click, drag, pointer capture
- [examples/performance.md](examples/performance.md) - Instancing, LOD, disposal, frame loop control, on-demand rendering
- [reference.md](reference.md) - Decision frameworks, Canvas props, hook signatures, anti-patterns

---

<philosophy>

## Philosophy

React Three Fiber is a React reconciler for Three.js -- every Three.js object becomes a declarative JSX element. The React tree IS the scene graph. Components mount/unmount meshes, lights, and cameras just like DOM elements. This means React features (Suspense, context, refs, state) all work naturally in 3D.

**Core principles:**

1. **Declarative scene graph** -- describe WHAT the scene looks like, not HOW to build it imperatively
2. **Refs for mutations, state for structure** -- per-frame updates go through `useRef` in `useFrame`, structural changes (adding/removing objects) go through React state
3. **Reuse everything** -- geometries, materials, and textures are GPU resources; share them across meshes
4. **Suspense for async** -- wrap asset-loading components in `<Suspense>` for automatic loading states
5. **Events are raycasted** -- pointer events automatically raycast into the scene; `stopPropagation` prevents hits on occluded objects

**The R3F ecosystem:**

| Package                       | Purpose                                                         |
| ----------------------------- | --------------------------------------------------------------- |
| `@react-three/fiber`          | Core renderer -- Canvas, hooks, reconciler                      |
| `@react-three/drei`           | Helpers -- controls, loaders, abstractions, text, HTML overlays |
| `@react-three/rapier`         | Physics -- rigid bodies, colliders, collision events            |
| `@react-three/postprocessing` | Effects -- bloom, DOF, SSAO, vignette                           |

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Canvas and Scene Setup

`<Canvas>` creates a WebGL context with scene, camera, and renderer. All R3F hooks must be used inside Canvas.

```tsx
import { Canvas } from "@react-three/fiber";

const CAMERA_FOV = 50;
const CAMERA_POSITION: [number, number, number] = [0, 2, 5];

export function Scene() {
  return (
    <Canvas
      camera={{
        fov: CAMERA_FOV,
        position: CAMERA_POSITION,
        near: 0.1,
        far: 100,
      }}
      shadows
      dpr={[1, 2]}
      frameloop="always"
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} castShadow />
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="orange" />
      </mesh>
    </Canvas>
  );
}
```

**Why good:** named position constant, shadows enabled on canvas + individual meshes, dpr clamped to prevent excessive resolution on HiDPI displays

See [examples/core.md](examples/core.md) Pattern 1 for full Canvas config, lighting setups, and camera types.

---

### Pattern 2: Per-Frame Animation with useFrame

`useFrame` runs every frame before render. Mutate refs directly -- never call setState.

```tsx
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

const ROTATION_SPEED = 1;

export function SpinningBox() {
  const meshRef = useRef<Mesh>(null);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += ROTATION_SPEED * delta;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="royalblue" />
    </mesh>
  );
}
```

**Why good:** delta-time multiplication makes animation frame-rate independent, ref mutation avoids re-renders, guard clause prevents null access

```tsx
// BAD: triggers re-render every frame -- destroys performance
function BadSpinningBox() {
  const [rotation, setRotation] = useState(0);
  useFrame((_, delta) => {
    setRotation((r) => r + delta); // setState in useFrame!
  });
  return <mesh rotation-y={rotation} />;
}
```

**Why bad:** setState in useFrame causes a React re-render every frame (~60/s), defeating the purpose of direct GPU mutations

See [examples/core.md](examples/core.md) Pattern 2 for animation with useFrame, clock-based motion, and conditional animation.

---

### Pattern 3: Asset Loading with Suspense

Use `useLoader` or drei's `useGLTF` to load models, textures, and other assets. Always wrap in `<Suspense>`.

```tsx
import { Suspense } from "react";
import { useGLTF } from "@react-three/drei";

function Model({ url }: { url: string }) {
  const { nodes, materials } = useGLTF(url);
  return (
    <mesh
      geometry={(nodes.myMesh as THREE.Mesh).geometry}
      material={materials.myMaterial}
    />
  );
}

// Preload for faster initial render
useGLTF.preload("/model.glb");

export function SceneWithModel() {
  return (
    <Canvas>
      <Suspense fallback={null}>
        <Model url="/model.glb" />
      </Suspense>
    </Canvas>
  );
}
```

**Why good:** Suspense handles loading states automatically, preload avoids waterfall, useGLTF extracts named nodes/materials

See [examples/core.md](examples/core.md) Pattern 3 for texture loading, Draco compression, and progressive loading.

---

### Pattern 4: Pointer Events and Raycasting

R3F meshes support DOM-like pointer events. Events are raycasted -- the nearest hit object receives the event first.

```tsx
const HOVER_COLOR = "hotpink";
const DEFAULT_COLOR = "orange";
const ACTIVE_SCALE = 1.2;
const DEFAULT_SCALE = 1;

export function InteractiveBox() {
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);

  return (
    <mesh
      scale={active ? ACTIVE_SCALE : DEFAULT_SCALE}
      onClick={(e) => {
        e.stopPropagation();
        setActive((a) => !a);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={hovered ? HOVER_COLOR : DEFAULT_COLOR} />
    </mesh>
  );
}
```

**Why good:** stopPropagation prevents clicks passing through to objects behind, hover state uses React state (not per-frame), named color constants

See [examples/interaction.md](examples/interaction.md) for event object properties, pointer capture, drag, and onPointerMissed.

---

### Pattern 5: Drei Helpers

`@react-three/drei` provides ready-made abstractions for common tasks.

```tsx
import { OrbitControls, Environment, Text, Html } from "@react-three/drei";

// Camera controls
<OrbitControls enableDamping dampingFactor={0.1} />

// Environment lighting from HDRI preset
<Environment preset="sunset" background />

// 3D text rendered as mesh geometry
<Text fontSize={0.5} position={[0, 2, 0]} color="white">
  Hello 3D World
</Text>

// HTML overlaid on 3D position
<Html position={[1, 1, 0]} distanceFactor={10}>
  <div className="tooltip">Click me</div>
</Html>
```

See [examples/core.md](examples/core.md) Pattern 5 for full drei helper examples including Detailed (LOD), ContactShadows, and Float.

---

### Pattern 6: Physics with @react-three/rapier

Wrap the scene in `<Physics>` and objects in `<RigidBody>` for physics simulation.

```tsx
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";

const GRAVITY: [number, number, number] = [0, -9.81, 0];
const FLOOR_SIZE: [number, number, number] = [10, 0.1, 10];

export function PhysicsScene() {
  return (
    <Physics gravity={GRAVITY}>
      {/* Dynamic falling box */}
      <RigidBody colliders="cuboid" restitution={0.5}>
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="tomato" />
        </mesh>
      </RigidBody>

      {/* Static floor */}
      <RigidBody type="fixed">
        <mesh>
          <boxGeometry args={FLOOR_SIZE} />
          <meshStandardMaterial color="gray" />
        </mesh>
      </RigidBody>
    </Physics>
  );
}
```

**Why good:** gravity as named constant, explicit collider type, fixed body for static geometry

See [examples/core.md](examples/core.md) Pattern 6 for collision events, sensors, and InstancedRigidBodies.

---

### Pattern 7: Post-Processing Effects

`@react-three/postprocessing` merges effects into efficient render passes.

```tsx
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";

const BLOOM_INTENSITY = 0.5;
const BLOOM_LUMINANCE_THRESHOLD = 0.9;
const VIGNETTE_DARKNESS = 0.5;

<EffectComposer>
  <Bloom
    intensity={BLOOM_INTENSITY}
    luminanceThreshold={BLOOM_LUMINANCE_THRESHOLD}
  />
  <Vignette darkness={VIGNETTE_DARKNESS} />
</EffectComposer>;
```

See [reference.md](reference.md) for common effect combinations and performance considerations.

---

### Pattern 8: Instancing for Many Objects

Use `<instancedMesh>` to render thousands of identical objects in a single draw call.

```tsx
import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const INSTANCE_COUNT = 1000;

export function Particles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < INSTANCE_COUNT; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
      );
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, INSTANCE_COUNT]}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshBasicMaterial color="white" />
    </instancedMesh>
  );
}
```

**Why good:** single draw call for 1000 objects, useMemo prevents recreating dummy each render, named count constant

See [examples/performance.md](examples/performance.md) for animated instances, LOD with Detailed, and on-demand rendering.

---

### Pattern 9: Geometry and Material Reuse

Create shared resources and reference them across meshes to reduce GPU overhead.

```tsx
import * as THREE from "three";
import { useMemo } from "react";

export function SharedGeometryScene() {
  const sharedGeo = useMemo(() => new THREE.SphereGeometry(0.5, 32, 32), []);
  const sharedMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "coral" }),
    [],
  );

  return (
    <>
      <mesh geometry={sharedGeo} material={sharedMat} position={[-2, 0, 0]} />
      <mesh geometry={sharedGeo} material={sharedMat} position={[0, 0, 0]} />
      <mesh geometry={sharedGeo} material={sharedMat} position={[2, 0, 0]} />
    </>
  );
}
```

**Why good:** one geometry + one material in GPU memory regardless of mesh count, useMemo prevents recreation on re-render

See [examples/performance.md](examples/performance.md) for disposal patterns and PerformanceMonitor.

</patterns>

---

<decision_framework>

## Decision Framework

### Choosing an Animation Approach

```
Is it a per-frame continuous animation (rotation, bob, orbit)?
├─ YES → useFrame + useRef (mutate directly, never setState)
└─ NO → Is it triggered by user interaction (hover, click)?
    ├─ YES → React state for discrete changes (scale, color)
    │        or spring-based animation libraries for smooth transitions
    └─ NO → Is it a one-time entrance animation?
        └─ YES → useFrame with a progress ref that clamps at 1.0
```

### Choosing a Collider Type

```
Is the shape a box?
├─ YES → "cuboid" (fastest)
└─ NO → Is it a sphere?
    ├─ YES → "ball" (fast)
    └─ NO → Is it convex (no holes/concavities)?
        ├─ YES → "hull" (good balance)
        └─ NO → "trimesh" (expensive, use sparingly)
```

### Performance Scaling

```
Are there 10+ identical objects?
├─ YES → instancedMesh (single draw call)
└─ NO → Are objects at varying distances?
    ├─ YES → LOD with drei's Detailed component
    └─ NO → Is the scene mostly static?
        ├─ YES → frameloop="demand" + invalidate()
        └─ NO → Check draw calls (target < 200)
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Calling `setState` inside `useFrame` -- causes 60 re-renders/second, destroys performance
- Creating new `Vector3`/`Matrix4`/`Object3D` instances inside `useFrame` -- allocates memory every frame, triggers GC pauses
- Missing `<Suspense>` around components using `useLoader`/`useGLTF` -- causes uncaught promise errors
- Duplicate geometries/materials across identical meshes -- wastes GPU memory; share via `useMemo` or module-level instances
- Missing `event.stopPropagation()` on pointer events -- clicks pass through to occluded objects unexpectedly

**Medium Priority Issues:**

- Using `frameloop="always"` for mostly-static scenes -- drains battery; use `"demand"` with `invalidate()`
- More than ~1000 draw calls (each `<mesh>` is a draw call) -- use instancing or merge geometries
- Not disposing of geometries/materials on unmount -- GPU memory leak (R3F auto-disposes on unmount by default, but manual Three.js objects need explicit cleanup)
- Animating layout-triggering CSS on the Canvas container -- causes reflow; use fixed dimensions

**Gotchas & Edge Cases:**

- All R3F hooks (`useFrame`, `useThree`, `useLoader`) must be called inside `<Canvas>` -- they depend on fiber context
- `useFrame` callbacks with `renderPriority >= 1` take over the render loop -- you must call `gl.render()` manually
- `useThree` selectors for Three.js internal properties (like `camera.zoom`) are NOT reactive -- use `invalidate()` after imperative changes
- Three.js uses a Y-up coordinate system -- `position={[x, y, z]}` where Y is vertical
- `<instancedMesh args={[null, null, count]}>` -- the first two args (geometry, material) should be `undefined` when using child elements
- `onPointerMissed` fires on the Canvas element for clicks that hit no mesh -- useful for deselection
- R3F automatically disposes Three.js resources on unmount, but only for objects it created declaratively -- manual `new THREE.*()` calls need manual `.dispose()`
- `<Physics>` from rapier must be wrapped in `<Suspense>` because it loads WASM asynchronously
- Event `delta` property is mouse-down-to-mouse-up distance in pixels -- useful for distinguishing clicks from drags

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST never call setState inside useFrame -- mutate refs directly for per-frame updates)**

**(You MUST wrap `<Canvas>` children that load assets in `<Suspense>` boundaries)**

**(You MUST reuse geometries and materials across meshes -- creating new instances per mesh wastes GPU memory)**

**(You MUST call `event.stopPropagation()` on pointer events to prevent hits passing through to occluded objects)**

**(You MUST use named constants for all numeric values -- positions, sizes, speeds, colors -- NO magic numbers)**

**Failure to follow these rules will cause frame drops, memory leaks, broken interactions, and poor 3D performance.**

</critical_reminders>
