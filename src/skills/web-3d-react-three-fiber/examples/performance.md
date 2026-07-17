# React Three Fiber - Performance Examples

> Instancing, LOD, disposal, frame loop control, and performance monitoring. See [SKILL.md](../SKILL.md) for concepts and [reference.md](../reference.md) for decision frameworks.

**Related examples:**

- [core.md](core.md) - Canvas, meshes, materials, lights, camera, useFrame
- [interaction.md](interaction.md) - Events, raycasting, hover/click, drag

---

## Pattern 1: Instanced Mesh with Animation

### Good Example - Animated Particles via instancedMesh

```tsx
import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const INSTANCE_COUNT = 2000;
const SPREAD = 20;
const SPIN_SPEED = 0.3;

export function AnimatedParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const positions = useMemo(() => {
    return Array.from({ length: INSTANCE_COUNT }, () => ({
      x: (Math.random() - 0.5) * SPREAD,
      y: (Math.random() - 0.5) * SPREAD,
      z: (Math.random() - 0.5) * SPREAD,
      speed: 0.5 + Math.random() * 1.5,
    }));
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < INSTANCE_COUNT; i++) {
      const p = positions[i];
      dummy.position.set(p.x, p.y + Math.sin(t * p.speed) * 0.5, p.z);
      dummy.rotation.y = t * SPIN_SPEED * p.speed;
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, INSTANCE_COUNT]}>
      <boxGeometry args={[0.1, 0.1, 0.1]} />
      <meshBasicMaterial color="cyan" />
    </instancedMesh>
  );
}
```

**Why good:** Single draw call for 2000 objects, dummy Object3D allocated once via useMemo, positions pre-calculated, instanceMatrix.needsUpdate set after batch update

### Bad Example - Individual Meshes

```tsx
// BAD: 2000 draw calls, 2000 React components
function BadParticles() {
  return (
    <>
      {Array.from({ length: 2000 }, (_, i) => (
        <mesh
          key={i}
          position={[
            Math.random() * 20,
            Math.random() * 20,
            Math.random() * 20,
          ]}
        >
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshBasicMaterial color="cyan" />
        </mesh>
      ))}
    </>
  );
}
```

**Why bad:** Each mesh is a separate draw call (2000 total), each creates its own geometry and material instances, React reconciles 2000 components

### Drei Instances Helper

Drei provides a higher-level `<Instances>` API for common use cases.

```tsx
import { Instances, Instance } from "@react-three/drei";

const ITEM_COUNT = 500;

export function DreiBubbles() {
  return (
    <Instances limit={ITEM_COUNT}>
      <sphereGeometry args={[0.1, 16, 16]} />
      <meshStandardMaterial color="skyblue" />
      {Array.from({ length: ITEM_COUNT }, (_, i) => (
        <Instance
          key={i}
          position={[
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
          ]}
        />
      ))}
    </Instances>
  );
}
```

---

## Pattern 2: Level of Detail (LOD)

Use drei's `<Detailed>` to swap geometry based on camera distance.

```tsx
import { Detailed } from "@react-three/drei";

const LOD_DISTANCES = [0, 15, 30];
const HIGH_SEGMENTS = 32;
const MID_SEGMENTS = 16;
const LOW_SEGMENTS = 8;

export function LODSphere() {
  return (
    <Detailed distances={LOD_DISTANCES}>
      {/* Shown when distance < 15 */}
      <mesh>
        <sphereGeometry args={[1, HIGH_SEGMENTS, HIGH_SEGMENTS]} />
        <meshStandardMaterial color="gold" />
      </mesh>

      {/* Shown when 15 <= distance < 30 */}
      <mesh>
        <sphereGeometry args={[1, MID_SEGMENTS, MID_SEGMENTS]} />
        <meshStandardMaterial color="gold" />
      </mesh>

      {/* Shown when distance >= 30 */}
      <mesh>
        <sphereGeometry args={[1, LOW_SEGMENTS, LOW_SEGMENTS]} />
        <meshStandardMaterial color="gold" />
      </mesh>
    </Detailed>
  );
}
```

**Why good:** Reduces vertex count by 75%+ at distance, named constants for distance thresholds and segment counts, children ordered by increasing distance

---

## Pattern 3: On-Demand Rendering

For mostly-static scenes, render only when something changes.

### Good Example - Demand Mode with Invalidation

```tsx
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useRef } from "react";

export function StaticScene() {
  return (
    <Canvas frameloop="demand">
      <InvalidateOnControlsChange />
      <ambientLight />
      <mesh>
        <boxGeometry />
        <meshStandardMaterial color="salmon" />
      </mesh>
      <OrbitControls />
    </Canvas>
  );
}

function InvalidateOnControlsChange() {
  const { invalidate } = useThree();
  // OrbitControls from drei auto-invalidates, but custom controls need this:
  // controlsRef.current?.addEventListener("change", invalidate);
  return null;
}
```

**Why good:** Scene only re-renders when the user interacts (orbits, zooms); saves battery and GPU cycles for static content

### frameloop Options

```
"always"  -- render every frame (default, for animated scenes)
"demand"  -- render only when invalidate() is called
"never"   -- manual control only (advanced use case)
```

---

## Pattern 4: Geometry and Material Sharing

### Good Example - Shared Resources

```tsx
import * as THREE from "three";
import { useMemo } from "react";

const SPHERE_RADIUS = 0.3;
const SPHERE_SEGMENTS = 24;
const GRID_SIZE = 5;
const GRID_SPACING = 1.2;

export function SphereGrid() {
  const geometry = useMemo(
    () =>
      new THREE.SphereGeometry(SPHERE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS),
    [],
  );
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "mediumpurple" }),
    [],
  );

  const positions = useMemo(() => {
    const result: [number, number, number][] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        result.push([x * GRID_SPACING, 0, z * GRID_SPACING]);
      }
    }
    return result;
  }, []);

  return (
    <>
      {positions.map((pos, i) => (
        <mesh key={i} geometry={geometry} material={material} position={pos} />
      ))}
    </>
  );
}
```

**Why good:** One geometry + one material in GPU memory for 25 meshes; useMemo prevents re-creation on re-render

### Bad Example - Duplicate Resources

```tsx
// BAD: each mesh creates its own geometry and material
function BadGrid() {
  return (
    <>
      {Array.from({ length: 25 }, (_, i) => (
        <mesh key={i} position={[i % 5, 0, Math.floor(i / 5)]}>
          <sphereGeometry args={[0.3, 24, 24]} /> {/* New geometry each time */}
          <meshStandardMaterial color="purple" /> {/* New material each time */}
        </mesh>
      ))}
    </>
  );
}
```

**Why bad:** 25 identical geometries and materials in GPU memory instead of 1; R3F does NOT automatically deduplicate declarative children

---

## Pattern 5: Resource Disposal

R3F auto-disposes resources for declaratively created objects when they unmount. But manually created Three.js objects (`new THREE.*()`) need explicit cleanup.

```tsx
import { useEffect, useMemo } from "react";
import * as THREE from "three";

export function ManualResourceComponent() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    // ... draw on canvas ...
    return new THREE.CanvasTexture(canvas);
  }, []);

  useEffect(() => {
    return () => {
      // Manually dispose because we created it with `new`
      texture.dispose();
    };
  }, [texture]);

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}
```

**When to manually dispose:**

- `new THREE.TextureLoader().load(...)` -- not managed by R3F
- `new THREE.CanvasTexture(...)` -- created outside the scene graph
- Render targets (`new THREE.WebGLRenderTarget(...)`)
- Any Three.js object created with `new` that has a `.dispose()` method

**When R3F handles disposal automatically:**

- `<meshStandardMaterial>` -- declarative, auto-disposed on unmount
- `<boxGeometry>` -- declarative, auto-disposed on unmount
- `useLoader` / `useGLTF` results -- cached and managed by R3F

---

## Pattern 6: PerformanceMonitor (Adaptive Quality)

Drei's `PerformanceMonitor` tracks FPS and triggers quality adjustments.

```tsx
import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";

const HIGH_DPR = 2;
const LOW_DPR = 1;

export function AdaptiveScene() {
  const [dpr, setDpr] = useState(1.5);

  return (
    <Canvas dpr={dpr}>
      <PerformanceMonitor
        onIncline={() => setDpr(HIGH_DPR)}
        onDecline={() => setDpr(LOW_DPR)}
      >
        {/* Scene content */}
      </PerformanceMonitor>
    </Canvas>
  );
}
```

**How it works:** Monitors frame rate over time. `onIncline` fires when FPS is consistently high (room to increase quality). `onDecline` fires when FPS drops (reduce quality to maintain smoothness).

---

## Pattern 7: Movement Regression

Temporarily reduce quality during user interaction (camera orbit, drag) for smooth responsiveness.

```tsx
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

function RegressOnOrbit() {
  const regress = useThree((state) => state.performance.regress);
  const controlsRef = useRef(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.addEventListener("change", regress);
    return () => controls.removeEventListener("change", regress);
  }, [regress]);

  return <orbitControls ref={controlsRef} />;
}
```

Pair with `AdaptivePixelRatio` or `AdaptiveDpr` from drei to respond to regression events:

```tsx
import { AdaptiveDpr } from "@react-three/drei";

<Canvas>
  <AdaptiveDpr pixelated />
  {/* Automatically lowers DPR during regression, restores after */}
</Canvas>;
```

---

## Performance Checklist

```
[ ] Draw calls under 200 (use instancing for repeated objects)
[ ] Shared geometries/materials (useMemo or module-level)
[ ] useFrame never calls setState
[ ] No new THREE.Vector3/Matrix4 inside useFrame (allocate via useMemo)
[ ] Static scenes use frameloop="demand"
[ ] Assets preloaded (useGLTF.preload, useLoader.preload)
[ ] LOD for objects visible at multiple distances
[ ] Manual Three.js resources disposed on unmount
[ ] dpr clamped with [min, max] (not unbounded)
[ ] Suspense boundaries around async components
```
