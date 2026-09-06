# React Three Fiber — Performance Examples

> Instancing, LOD, on-demand rendering, resource sharing, disposal, adaptive quality. See [SKILL.md](../SKILL.md) for decisions, [reference.md](../reference.md) for Canvas props, [core.md](core.md) for scene setup, [interaction.md](interaction.md) for events.

---

## Pattern 1: Instanced Mesh with Animation

### Good — animated particles via instancedMesh

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

**Why good:** one draw call for 2000 objects. The `dummy` is a scratch `Object3D` used only to compose a matrix — allocated once, rewritten 2000 times a frame. The random positions live in a memo so they are stable across frames rather than re-rolled on each one, and `needsUpdate` is set once after the whole batch, not per instance.

### Bad — one mesh per object

```tsx
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

**Why bad:** 2000 draw calls against 1, plus 2000 geometry and 2000 material uploads, plus 2000 components for React to reconcile. And `Math.random()` in the render body re-rolls every position on every render.

### Drei's Instances helper

Same single draw call, written declaratively — worth it when the instances are static or driven by props rather than by a per-frame loop.

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

**Why good:** children are matched to `distances` by position, so the order is the contract — highest detail first. A sphere at 32 segments is roughly sixteen times the triangles of one at 8, and past 30 units that difference is invisible.

---

## Pattern 3: On-Demand Rendering

### Good — demand mode with invalidation

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

**Why good:** a static scene under `"always"` re-renders an identical frame sixty times a second forever. Under `"demand"` it draws once and then only when something asks. Drei's controls call `invalidate` themselves; anything else that mutates the scene imperatively has to.

### frameloop options

| Value      | Renders                                        |
| ---------- | ---------------------------------------------- |
| `"always"` | Every frame — the default, right for animation |
| `"demand"` | Only when `invalidate()` is called             |
| `"never"`  | Only when driven manually                      |

---

## Pattern 4: Geometry and Material Sharing

### Good — one geometry and one material across many meshes

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

**Why good:** one geometry and one material on the GPU serving 25 meshes. Passing them as props rather than as children is what makes the sharing possible — a `<sphereGeometry>` child is constructed per parent.

### Bad — a fresh geometry and material per mesh

```tsx
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

**Why bad:** 25 identical geometries and 25 identical materials uploaded instead of one of each. R3F does not deduplicate declarative children — identical JSX produces distinct GPU allocations.

---

## Pattern 5: Resource Disposal

R3F disposes what it created declaratively when the component unmounts. Anything built with `new` is outside that, and needs disposing explicitly.

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

## Pattern 6: PerformanceMonitor — adaptive quality

Drei's `PerformanceMonitor` watches the frame rate and calls back when there is room to raise quality, or a need to lower it.

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

**How it works:** the frame rate is sampled over a window rather than per frame, so a single slow frame does not trigger a change. `dpr` is the usual dial because it scales the pixel count quadratically — dropping 2 to 1 quarters the work.

---

## Pattern 7: Movement Regression

Drop quality only while the user is moving the camera, and restore it when they stop.

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

`regress()` only raises a flag; something has to act on it. `AdaptiveDpr` is the piece that does:

```tsx
import { AdaptiveDpr } from "@react-three/drei";

<Canvas>
  <AdaptiveDpr pixelated />
  {/* lowers dpr while regressed, restores it once motion stops */}
</Canvas>;
```

This differs from `PerformanceMonitor` in what it reacts to: the monitor responds to measured frame rate over time, regression responds to interaction immediately. A scene that stutters only while orbiting wants regression; one that is slow on weaker hardware wants the monitor.
