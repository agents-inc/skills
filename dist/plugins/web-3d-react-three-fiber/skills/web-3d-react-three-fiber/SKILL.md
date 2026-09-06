---
name: web-3d-react-three-fiber
description: React Three Fiber (R3F) 3D rendering — Canvas, meshes, materials, lights, cameras, animations, events, physics, post-processing, performance
---

# React Three Fiber Patterns

> **Quick Guide:** R3F is a React reconciler for Three.js, so the React tree is the scene graph and every Three.js class is a camelCase JSX element — `<mesh>`, `<boxGeometry>`, `<meshStandardMaterial>`. `<Canvas>` creates the renderer, scene and camera, and every R3F hook must be called inside it. Per-frame work goes through `useFrame` mutating refs, never through state; structural changes go through state as usual. Assets load through `useLoader`/`useGLTF`, which suspend, so their components need a `<Suspense>` boundary. Pointer events raycast into the scene and reach occluded objects unless `stopPropagation()` is called.

> **Import:** `import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber"`

**Detailed Resources:**

- [examples/core.md](examples/core.md) — Canvas setup, lighting rigs, `useFrame` animation, asset loading, drei helpers, physics
- [examples/interaction.md](examples/interaction.md) — the event object, propagation, hover, click-versus-drag, pointer capture, the full event list
- [examples/performance.md](examples/performance.md) — instancing, LOD, on-demand rendering, resource sharing, disposal, adaptive quality
- [reference.md](reference.md) — Canvas props, hook signatures, the event type, ecosystem packages, Three.js-to-JSX mapping, collider types

---

<critical_requirements>

## Before writing React Three Fiber code

**Do per-frame work by mutating refs inside `useFrame`, and allocate the objects it needs outside it.** State in the frame loop re-renders React sixty times a second, and `new THREE.Vector3()` inside it allocates sixty objects a second for the garbage collector to reclaim.

**Multiply per-frame motion by `delta`.** The callback's second argument is seconds since the last frame, which is what makes a rotation the same speed on a 60Hz and a 144Hz display.

**Put a `<Suspense>` boundary above anything calling `useLoader` or `useGLTF`.** Those hooks suspend while the asset downloads, and a suspending component with no boundary above it takes the tree down.

**Share geometries and materials across meshes that use the same ones.** They are GPU allocations, and R3F does not deduplicate declarative children — twenty-five `<sphereGeometry>` elements are twenty-five uploads.

**Call `event.stopPropagation()` in pointer handlers.** A raycast returns every intersection along the ray, so without it a click reaches the objects behind the one that was clicked.

</critical_requirements>

---

**Auto-detection:** @react-three/fiber, @react-three/drei, @react-three/rapier, @react-three/postprocessing, R3F, Canvas, useFrame, useThree, useLoader, useGLTF, useGraph, invalidate, frameloop, instancedMesh, boxGeometry, meshStandardMaterial, OrbitControls, Environment, Detailed, RigidBody, CuboidCollider, EffectComposer, onPointerMissed, three

**Applies to:**

- 3D scenes, product viewers, visualizations and interactive experiences in React
- Loading and displaying models (GLTF, Draco-compressed GLTF, textures)
- Per-frame animation, and interaction-driven state changes
- Pointer events, raycasting and drag on 3D objects
- Physics simulation, colliders, and collision or trigger events
- Post-processing effect chains
- Scaling a scene: instancing, level of detail, on-demand rendering, adaptive quality

**Handled elsewhere:**

- 2D interface work — HTML overlays anchored to a 3D position are this skill's `Html` helper, but the markup inside them is ordinary UI
- Pre-rendering a 3D scene to a static image at build time
- Which colours, fonts and materials a product uses — every one of these components takes them as props
- Accessibility conformance targets — a canvas is one element to assistive technology, so a scene's controls need an accessible equivalent, and what that must satisfy is settled elsewhere

---

<philosophy>

**The React tree is the scene graph.** Mounting a component adds a mesh; unmounting removes and disposes it. Suspense, context and refs all work in 3D exactly as they do in the DOM, because there is one reconciler doing both.

The split that matters is **refs for mutation, state for structure**. Position, rotation and scale change every frame and belong to refs, where React never sees them. Which objects exist, and whether one is selected, are structure and belong to state. Getting this backwards — animating through state — is the single most common way an R3F scene becomes slow, and it looks correct until the frame counter is opened.

</philosophy>

---

<decision_framework>

## How to animate

```
Continuous per-frame motion (spin, bob, orbit)
  -> useFrame mutating a ref; multiply by delta
Discrete change from an interaction (hover colour, selected scale)
  -> React state; it happens once, not per frame
One-time entrance
  -> useFrame with a progress ref clamped at 1, or a spring-based
     animation approach driving the same refs
```

## Which collider

```
Box            -> "cuboid"   fastest
Sphere         -> "ball"     fast
Convex shape   -> "hull"     good balance
Concave shape  -> "trimesh"  expensive; use sparingly
```

## How to scale a scene

```
Many identical objects        -> instancedMesh, or drei's <Instances>
Many different static meshes  -> merge their geometries into one mesh
Objects seen at varying range -> LOD via <Detailed>
Mostly static scene           -> frameloop="demand" plus invalidate()
Frame rate varies by device   -> PerformanceMonitor driving dpr
Otherwise                     -> count draw calls; each <mesh> is one
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Canvas and scene setup

`<Canvas>` builds the renderer, scene and camera, and establishes the context every R3F hook reads.

```tsx
<Canvas
  camera={{ fov: CAMERA_FOV, position: CAMERA_POSITION, near: 0.1, far: 100 }}
  shadows
  dpr={[1, 2]} // clamped: an unbounded ratio renders 3x the pixels on a HiDPI screen
>
  <ambientLight intensity={0.5} />
  <directionalLight position={[5, 5, 5]} castShadow />
  <mesh castShadow receiveShadow>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color="orange" />
  </mesh>
</Canvas>
```

Shadows are opt-in twice: on the Canvas, and per mesh via `castShadow`/`receiveShadow`.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 2: Per-frame animation with useFrame

The callback runs before every render. Write to the ref; do not touch state.

```tsx
const meshRef = useRef<Mesh>(null);

useFrame((state, delta) => {
  if (!meshRef.current) return;
  meshRef.current.rotation.y += ROTATION_SPEED * delta; // frame-rate independent
  meshRef.current.position.y =
    Math.sin(state.clock.elapsedTime) * BOB_AMPLITUDE;
});

return (
  <mesh ref={meshRef}>
    <boxGeometry args={[1, 1, 1]} />
    <meshStandardMaterial color="royalblue" />
  </mesh>
);
```

`delta` drives motion that accumulates; `state.clock.elapsedTime` drives motion that is a function of absolute time, such as a sine wave.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 3: Asset loading with Suspense

`useGLTF` returns the parsed `nodes` and `materials`, and suspends until the file has loaded.

```tsx
function Model({ url }: { url: string }) {
  const { nodes, materials } = useGLTF(url);
  return <mesh geometry={nodes.body.geometry} material={materials.paint} />;
}

useGLTF.preload("/model.glb"); // starts the fetch before the component mounts

<Canvas>
  <Suspense fallback={null}>
    <Model url="/model.glb" />
  </Suspense>
</Canvas>;
```

Full code: [examples/core.md](examples/core.md)

---

### Pattern 4: Pointer events and raycasting

Meshes take DOM-shaped pointer handlers. The event carries the intersection — hit point, distance, face and the full list of hits.

```tsx
<mesh
  scale={active ? ACTIVE_SCALE : DEFAULT_SCALE}
  onClick={(e) => {
    e.stopPropagation(); // otherwise objects behind this one are also clicked
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
```

Hover and selection are discrete, so React state is right here — this is not per-frame work.

Full code: [examples/interaction.md](examples/interaction.md)

---

### Pattern 5: Drei helpers

`@react-three/drei` supplies the abstractions almost every scene needs.

```tsx
<OrbitControls enableDamping dampingFactor={0.1} maxPolarAngle={Math.PI / 2} />
<Environment preset="sunset" background />
<Text fontSize={0.5} position={[0, 2, 0]} anchorX="center">Hello</Text>
<Html position={[1, 1, 0]} distanceFactor={10}>
  <div className="tooltip">Click me</div>
</Html>
```

`<Environment>` replaces a hand-built lighting rig with an HDRI, which is usually the faster route to plausible lighting.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 6: Physics with @react-three/rapier

`<Physics>` runs the simulation; `<RigidBody>` hands it the meshes it wraps.

```tsx
<Physics gravity={GRAVITY}>
  <RigidBody colliders="cuboid" restitution={0.5}>
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="tomato" />
    </mesh>
  </RigidBody>

  <RigidBody type="fixed">
    <mesh>
      <boxGeometry args={FLOOR_SIZE} />
      <meshStandardMaterial color="gray" />
    </mesh>
  </RigidBody>
</Physics>
```

`type="fixed"` is what keeps the floor from falling. Rapier loads its WASM asynchronously, so `<Physics>` also needs a Suspense boundary.

Full code: [examples/core.md](examples/core.md)

---

### Pattern 7: Post-processing effects

`EffectComposer` merges compatible effects into one pass rather than chaining a pass per effect.

```tsx
<EffectComposer>
  <Bloom intensity={BLOOM_INTENSITY} luminanceThreshold={BLOOM_THRESHOLD} />
  <Vignette darkness={VIGNETTE_DARKNESS} />
</EffectComposer>
```

Full code: [reference.md](reference.md)

---

### Pattern 8: Instancing for many objects

One `<instancedMesh>` draws thousands of copies of one geometry in a single call. Positions are written as matrices.

```tsx
const dummy = useMemo(() => new THREE.Object3D(), []); // allocated once

useEffect(() => {
  for (let i = 0; i < INSTANCE_COUNT; i++) {
    dummy.position.set(x, y, z);
    dummy.updateMatrix();
    meshRef.current.setMatrixAt(i, dummy.matrix);
  }
  meshRef.current.instanceMatrix.needsUpdate = true; // without this, nothing moves
}, [dummy]);

<instancedMesh ref={meshRef} args={[undefined, undefined, INSTANCE_COUNT]}>
  <sphereGeometry args={[0.05, 8, 8]} />
  <meshBasicMaterial color="white" />
</instancedMesh>;
```

Full code: [examples/performance.md](examples/performance.md)

---

### Pattern 9: Sharing geometries and materials

Build the resource once and hand the same instance to every mesh that needs it.

```tsx
const sharedGeo = useMemo(() => new THREE.SphereGeometry(0.5, 32, 32), []);
const sharedMat = useMemo(
  () => new THREE.MeshStandardMaterial({ color: "coral" }),
  [],
);

<>
  <mesh geometry={sharedGeo} material={sharedMat} position={[-2, 0, 0]} />
  <mesh geometry={sharedGeo} material={sharedMat} position={[0, 0, 0]} />
  <mesh geometry={sharedGeo} material={sharedMat} position={[2, 0, 0]} />
</>;
```

One geometry and one material on the GPU whatever the mesh count. Objects built with `new` this way are also outside R3F's automatic disposal, so they need disposing on unmount.

Full code: [examples/performance.md](examples/performance.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `new THREE.Vector3()`, `Matrix4` or `Object3D` inside `useFrame` — an allocation per frame, and the GC pauses show up as stutter
- `<Physics>` with no `<Suspense>` above it — Rapier's WASM loads asynchronously
- An R3F hook called outside `<Canvas>` — `useFrame`, `useThree` and `useLoader` all read the fiber context the Canvas provides
- A manually constructed Three.js object never disposed — R3F auto-disposes what it created declaratively and nothing else
- `setMatrixAt` without setting `instanceMatrix.needsUpdate = true` — the buffer is never re-uploaded and the instances do not move
- Unbounded `dpr` on a HiDPI display — three times the pixels for no visible gain; clamp with `dpr={[1, 2]}`

**Surprising behaviour:**

- `useThree` selectors over Three.js internals such as `camera.zoom` are not reactive, because mutating a Three.js object does not notify React — call `invalidate()` after an imperative change
- A `useFrame` callback with `renderPriority >= 1` takes over the render loop, and must then call `gl.render()` itself
- `event.object` is the mesh the ray hit; `event.eventObject` is the one carrying the handler, which may be an ancestor
- `event.delta` is the mousedown-to-mouseup distance in pixels, which is how a click is told from the end of an orbit drag
- `onPointerOver`/`onPointerOut` bubble to ancestors; `onPointerEnter`/`onPointerLeave` do not
- `onPointerMissed` fires on the Canvas for a click that hit nothing, which is the deselection hook
- `<instancedMesh args={[undefined, undefined, count]}>` — the first two constructor arguments are left undefined when geometry and material are supplied as children
- Three.js is Y-up, so the vertical axis is the middle number in `position={[x, y, z]}`
- `frameloop="always"` renders continuously even when nothing has changed, which drains battery on a static scene
- Animating the Canvas container's width or height — the Canvas measures its container and resizes the renderer on every change, so a size transition rebuilds the drawing buffer each frame; give the container a settled size and animate a transform instead

</red_flags>
