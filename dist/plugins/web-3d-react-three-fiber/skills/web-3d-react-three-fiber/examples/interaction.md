# React Three Fiber — Interaction Examples

> The event object, propagation, hover, click-versus-drag, pointer capture, the full event list. See [SKILL.md](../SKILL.md) for decisions, [reference.md](../reference.md) for the event type, [core.md](core.md) for scene setup, [performance.md](performance.md) for scaling.

---

## Pattern 1: Event Object Properties

An R3F pointer event is the DOM event plus the raycast intersection.

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

`event.object` is the mesh the ray actually hit, which may be a deep descendant. `event.eventObject` is where the handler is attached. They differ whenever a handler sits on a group — which is the usual way to treat an imported model as one clickable thing while still knowing which part was hit.

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

Events reach the nearest mesh first, then its ancestors, then objects further along the same ray. `stopPropagation()` stops both — the bubbling and the delivery to occluded objects. That second half has no DOM equivalent and is what surprises people.

### Good — preventing click-through

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

**Why good:** the front box's `stopPropagation()` is what makes it opaque to clicks. Note that it is opaque visually only at 80% — visual transparency and event transparency are unrelated, and a fully transparent mesh still intercepts every ray unless its handlers are removed.

### Bad — missing stopPropagation

```tsx
<mesh onClick={() => console.log("front")}><boxGeometry /></mesh>
<mesh onClick={() => console.log("back")}><boxGeometry args={[2, 2, 2]} /></mesh>
```

**Why bad:** one click logs both. The raycast returns every intersection along the ray, and R3F delivers to all of them in near-to-far order until something stops it.

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

**Why good:** the canvas is one element, so the cursor cannot be set per mesh in CSS — writing `document.body.style.cursor` is how a 3D object signals that it is clickable. Resetting it in `onPointerOut` is what stops the pointer cursor sticking after the mesh moves or unmounts under the cursor.

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

**Why good:** an orbit drag ends in a `click` on whatever mesh is under the pointer, so without the threshold every camera move that finishes over an object also selects it. `delta` is the pixel distance travelled between press and release, which separates the two.

---

## Pattern 5: onPointerMissed — deselection

`onPointerMissed` fires on the Canvas for a click that hit no mesh — the 3D equivalent of clicking the background.

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

Capture keeps events flowing to one object after the pointer has left it — without it a drag stops the moment the cursor outruns the mesh.

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

**Gotcha:** capture is taken on `e.target`, the DOM canvas element, not on the Three.js object — and the captured object is _added_ to the hit test rather than replacing it, so other objects still receive events during the drag unless propagation is stopped.

---

## Pattern 7: The full event list

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
