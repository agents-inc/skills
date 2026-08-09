# React Three Fiber - Interaction Examples

> Pointer events, raycasting, hover/click, drag, and pointer capture. See [SKILL.md](../SKILL.md) for concepts and [reference.md](../reference.md) for decision frameworks.

**Related examples:**

- [core.md](core.md) - Canvas, meshes, materials, lights, camera, useFrame
- [performance.md](performance.md) - Instancing, LOD, disposal, frame loop control

---

## Pattern 1: Event Object Properties

R3F pointer events contain both DOM event data and Three.js intersection data.

```tsx
function DebugMesh() {
  return (
    <mesh
      onClick={(e) => {
        e.stopPropagation();
        // Three.js intersection data
        console.log(e.point); // Vector3 - world-space hit point
        console.log(e.distance); // number - distance from camera
        console.log(e.face); // Face - hit triangle (normal, vertices)
        console.log(e.object); // Object3D - the actual mesh hit
        console.log(e.eventObject); // Object3D - the mesh with the event handler
        console.log(e.ray); // Ray - the raycaster ray
        console.log(e.camera); // Camera - active camera
        console.log(e.delta); // number - mousedown-to-mouseup distance (px)
        console.log(e.intersections); // Intersection[] - all hits (nearest first)
        console.log(e.unprojectedPoint); // Vector3 - camera-unprojected point
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="teal" />
    </mesh>
  );
}
```

### event.object vs event.eventObject

- `event.object` -- the actual Three.js mesh that was hit by the raycast (may be a deep child)
- `event.eventObject` -- the mesh/group where the event handler is attached (may be a parent)

```tsx
// eventObject = group, object = the specific child mesh hit
<group
  onClick={(e) => {
    e.stopPropagation();
    console.log(e.eventObject); // the <group>
    console.log(e.object); // the child <mesh> that was actually hit
  }}
>
  <mesh>
    <boxGeometry />
    <meshBasicMaterial />
  </mesh>
  <mesh position={[2, 0, 0]}>
    <boxGeometry />
    <meshBasicMaterial />
  </mesh>
</group>
```

---

## Pattern 2: Event Propagation and stopPropagation

Events hit the nearest mesh first, then propagate to ancestors, then to farther (occluded) objects. `stopPropagation()` prevents both bubbling AND delivery to occluded objects.

### Good Example - Preventing Click-Through

```tsx
const INNER_SCALE = 0.5;

function LayeredBoxes() {
  return (
    <>
      {/* Front box - captures click, prevents pass-through */}
      <mesh
        position={[0, 0, 1]}
        scale={INNER_SCALE}
        onClick={(e) => {
          e.stopPropagation();
          console.log("Front box clicked");
        }}
      >
        <boxGeometry />
        <meshStandardMaterial color="red" transparent opacity={0.8} />
      </mesh>

      {/* Back box - only receives click if front doesn't stop propagation */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          console.log("Back box clicked");
        }}
      >
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="blue" />
      </mesh>
    </>
  );
}
```

**Why good:** stopPropagation on front box prevents the click from reaching the back box; without it, both handlers fire

### Bad Example - Missing stopPropagation

```tsx
// BAD: both boxes fire onClick when clicking the front one
<mesh onClick={() => console.log("front")}><boxGeometry /></mesh>
<mesh onClick={() => console.log("back")}><boxGeometry args={[2, 2, 2]} /></mesh>
```

**Why bad:** Without stopPropagation, the raycast hits both meshes and fires both handlers

---

## Pattern 3: Hover Effects with Cursor Change

```tsx
import { useState, useCallback } from "react";

const HOVER_COLOR = "hotpink";
const DEFAULT_COLOR = "orange";

export function HoverableMesh() {
  const [hovered, setHovered] = useState(false);

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  }, []);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = "auto";
  }, []);

  return (
    <mesh onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial color={hovered ? HOVER_COLOR : DEFAULT_COLOR} />
    </mesh>
  );
}
```

**Why good:** Cursor change provides visual affordance, stopPropagation prevents hover from leaking to objects behind, cleanup on pointer out

---

## Pattern 4: Click vs Drag Distinction

Use the `delta` property (mousedown-to-mouseup pixel distance) to distinguish clicks from drags.

```tsx
const CLICK_THRESHOLD_PX = 5;

function ClickOnlyMesh() {
  return (
    <mesh
      onClick={(e) => {
        // Only treat as click if mouse barely moved
        if (e.delta > CLICK_THRESHOLD_PX) return;
        e.stopPropagation();
        console.log("Clicked at", e.point);
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="mediumseagreen" />
    </mesh>
  );
}
```

**Why good:** prevents accidental clicks when user is orbiting with OrbitControls (orbit = drag = high delta)

---

## Pattern 5: onPointerMissed (Deselection)

`onPointerMissed` fires on the Canvas when a click hits no mesh -- useful for deselecting.

```tsx
import { Canvas } from "@react-three/fiber";

export function SelectableScene() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Canvas onPointerMissed={() => setSelected(null)}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          setSelected("box");
        }}
      >
        <boxGeometry />
        <meshStandardMaterial color={selected === "box" ? "gold" : "gray"} />
      </mesh>
    </Canvas>
  );
}
```

---

## Pattern 6: Pointer Capture

Pointer capture ensures events continue to be delivered to a specific object even when the pointer moves off it -- useful for drag operations.

```tsx
import { useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import type { Mesh, Vector3 } from "three";

export function DraggableMesh() {
  const meshRef = useRef<Mesh>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <mesh
      ref={meshRef}
      onPointerDown={(e) => {
        e.stopPropagation();
        // Capture pointer to this mesh
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setDragging(true);
      }}
      onPointerUp={(e) => {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        setDragging(false);
      }}
      onPointerMove={(e) => {
        if (!dragging || !meshRef.current) return;
        e.stopPropagation();
        // Move mesh to intersection point (projected onto a plane)
        meshRef.current.position.copy(e.point);
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={dragging ? "tomato" : "steelblue"} />
    </mesh>
  );
}
```

**Gotcha:** Pointer capture uses `e.target` (the DOM element), not the Three.js object. The captured object is ADDED to the hit test, not replacing other hits.

---

## Pattern 7: Supported Events Reference

```tsx
<mesh
  onClick={(e) => {}} // Left click
  onContextMenu={(e) => {}} // Right click
  onDoubleClick={(e) => {}} // Double click
  onWheel={(e) => {}} // Mouse wheel
  onPointerDown={(e) => {}} // Pointer press
  onPointerUp={(e) => {}} // Pointer release
  onPointerOver={(e) => {}} // Pointer enters (bubbles)
  onPointerOut={(e) => {}} // Pointer exits (bubbles)
  onPointerEnter={(e) => {}} // Pointer enters (no bubble)
  onPointerLeave={(e) => {}} // Pointer exits (no bubble)
  onPointerMove={(e) => {}} // Pointer moves over
  onPointerMissed={(e) => {}} // Click missed this object
  onUpdate={(self) => {}} // Object received new props
/>
```

**Key distinction:** `onPointerOver`/`onPointerOut` bubble to parents; `onPointerEnter`/`onPointerLeave` do not.
