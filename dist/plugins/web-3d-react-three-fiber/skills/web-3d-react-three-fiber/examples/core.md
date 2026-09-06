# React Three Fiber — Core Examples

> Canvas setup, lighting rigs, `useFrame` animation, asset loading, drei helpers, physics. See [SKILL.md](../SKILL.md) for decisions, [reference.md](../reference.md) for props and signatures, [interaction.md](interaction.md) for events, [performance.md](performance.md) for scaling.

---

## Pattern 1: Canvas and Scene Setup

### Good — scene with a lighting rig and shadows

```tsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { Suspense } from "react";

const CAMERA_FOV = 50;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 100;
const CAMERA_POSITION: [number, number, number] = [3, 3, 3];
const AMBIENT_INTENSITY = 0.4;
const DIR_LIGHT_POSITION: [number, number, number] = [5, 10, 5];
const SHADOW_MAP_SIZE = 2048;

export function Scene() {
  return (
    <Canvas
      camera={{
        fov: CAMERA_FOV,
        near: CAMERA_NEAR,
        far: CAMERA_FAR,
        position: CAMERA_POSITION,
      }}
      shadows
      dpr={[1, 2]}
    >
      <ambientLight intensity={AMBIENT_INTENSITY} />
      <directionalLight
        position={DIR_LIGHT_POSITION}
        castShadow
        shadow-mapSize-width={SHADOW_MAP_SIZE}
        shadow-mapSize-height={SHADOW_MAP_SIZE}
      />
      <Suspense fallback={null}>
        <Environment preset="studio" />
        <SceneContent />
      </Suspense>
      <OrbitControls enableDamping />
    </Canvas>
  );
}

function SceneContent() {
  return (
    <>
      <mesh castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="orange" roughness={0.4} metalness={0.1} />
      </mesh>
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#e0e0e0" />
      </mesh>
    </>
  );
}
```

**Why good:** shadows are enabled in all three places they have to be — on the Canvas, on the caster, and on the receiver — with the shadow map sized explicitly, since the default 512 gives visibly blocky edges. `<Environment>` suspends, so it sits inside the boundary.

### Bad — flat lighting, no boundary

```tsx
function BadScene() {
  return (
    <Canvas camera={{ position: [3, 3, 3] }}>
      <ambientLight intensity={0.5} />
      <Environment preset="studio" />
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="orange" />
      </mesh>
    </Canvas>
  );
}
```

**Why bad:** `<Environment>` fetches an HDRI and suspends, and with no `<Suspense>` above it the tree unmounts. Ambient light alone also lights every face equally, so a cube renders as a flat orange hexagon with no edges — depth needs a directional source.

### Orthographic camera

```tsx
const ORTHO_ZOOM = 50;

<Canvas orthographic camera={{ zoom: ORTHO_ZOOM, position: [0, 10, 0] }}>
  {/* Isometric / 2D-style scenes */}
</Canvas>;
```

---

## Pattern 2: Per-Frame Animation with useFrame

### Good — delta-based rotation, clock-based bobbing

```tsx
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

const ROTATION_SPEED = 0.5;
const BOB_AMPLITUDE = 0.2;
const BOB_FREQUENCY = 2;

export function AnimatedBox() {
  const meshRef = useRef<Mesh>(null);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    // Frame-rate independent rotation
    meshRef.current.rotation.y += ROTATION_SPEED * delta;
    // Clock-based bobbing (sine wave)
    meshRef.current.position.y =
      Math.sin(state.clock.elapsedTime * BOB_FREQUENCY) * BOB_AMPLITUDE;
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="royalblue" />
    </mesh>
  );
}
```

**Why good:** the two kinds of motion use the two different inputs — rotation accumulates and so scales by `delta`, while the bob is a function of absolute time and so reads `clock.elapsedTime`. Deriving the bob from an accumulator instead would drift out of phase as frame times varied.

### Bad — setState in useFrame

```tsx
function BadAnimatedBox() {
  const [rotY, setRotY] = useState(0);
  useFrame((_, delta) => {
    setRotY((r) => r + 0.5 * delta);
  });
  return (
    <mesh rotation-y={rotY}>
      <boxGeometry />
      <meshBasicMaterial />
    </mesh>
  );
}
```

**Why bad:** every frame schedules a React render, so a spinning cube costs a full reconciliation pass sixty times a second — for a value React never needed to know. Writing `meshRef.current.rotation.y` skips all of it.

### Pausing and resuming

```tsx
export function PausableSpinner({ paused }: { paused: boolean }) {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (!meshRef.current || paused) return;
    meshRef.current.rotation.y += delta;
  });

  return (
    <mesh ref={meshRef}>
      <torusGeometry args={[1, 0.3, 16, 32]} />
      <meshStandardMaterial color="coral" />
    </mesh>
  );
}
```

Returning early leaves the ref untouched, which freezes the object in place rather than resetting it.

### Reusing objects across frames

```tsx
import { useMemo } from "react";
import * as THREE from "three";

export function OrbitingLight() {
  const lightRef = useRef<THREE.PointLight>(null);
  // Allocate ONCE, reuse every frame
  const tempVec = useMemo(() => new THREE.Vector3(), []);

  const ORBIT_RADIUS = 3;
  const ORBIT_SPEED = 1;
  const ORBIT_HEIGHT = 2;

  useFrame((state) => {
    if (!lightRef.current) return;
    const t = state.clock.elapsedTime * ORBIT_SPEED;
    tempVec.set(
      Math.cos(t) * ORBIT_RADIUS,
      ORBIT_HEIGHT,
      Math.sin(t) * ORBIT_RADIUS,
    );
    lightRef.current.position.copy(tempVec);
  });

  return <pointLight ref={lightRef} intensity={1} />;
}
```

**Why good:** one `Vector3` for the component's lifetime, rewritten in place each frame with `.set()`. Constructing it inside the callback would allocate sixty short-lived objects a second, and the resulting GC pauses read as stutter rather than as slowness.

---

## Pattern 3: Asset Loading

### GLTF model with useGLTF

```tsx
import { useGLTF } from "@react-three/drei";
import type { GLTF } from "three-stdlib";
import type { Mesh, MeshStandardMaterial } from "three";

type GLTFResult = GLTF & {
  nodes: { body: Mesh; wheels: Mesh };
  materials: { paint: MeshStandardMaterial; rubber: MeshStandardMaterial };
};

export function Car(props: JSX.IntrinsicElements["group"]) {
  const { nodes, materials } = useGLTF("/car.glb") as GLTFResult;
  return (
    <group {...props}>
      <mesh
        geometry={nodes.body.geometry}
        material={materials.paint}
        castShadow
      />
      <mesh geometry={nodes.wheels.geometry} material={materials.rubber} />
    </group>
  );
}

// Preload to avoid loading waterfall
useGLTF.preload("/car.glb");
```

**Why good:** the `GLTFResult` type names the nodes and materials the file actually contains, so a renamed mesh in the exported model becomes a type error rather than an undefined at runtime. `preload` starts the fetch at module evaluation instead of at mount, which removes one round trip from the waterfall.

### Texture loading

```tsx
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";

export function TexturedPlane() {
  const [colorMap, normalMap] = useLoader(TextureLoader, [
    "/textures/color.jpg",
    "/textures/normal.jpg",
  ]);

  return (
    <mesh>
      <planeGeometry args={[4, 4]} />
      <meshStandardMaterial map={colorMap} normalMap={normalMap} />
    </mesh>
  );
}
```

Passing an array of urls returns an array of textures and issues one suspend for the batch, rather than one per call.

### Draco-compressed GLTF

```tsx
import { useGLTF } from "@react-three/drei";

export function CompressedModel() {
  const { scene } = useGLTF("/model.glb", "/draco/");
  // Second arg is Draco decoder path
  return <primitive object={scene} />;
}
```

---

## Pattern 4: Lighting Rigs

### Three-point lighting

```tsx
const KEY_LIGHT_POS: [number, number, number] = [5, 5, 5];
const FILL_LIGHT_POS: [number, number, number] = [-3, 2, -2];
const BACK_LIGHT_POS: [number, number, number] = [0, 5, -5];
const KEY_INTENSITY = 1;
const FILL_INTENSITY = 0.3;
const BACK_INTENSITY = 0.5;

export function ThreePointLighting() {
  return (
    <>
      <directionalLight
        position={KEY_LIGHT_POS}
        intensity={KEY_INTENSITY}
        castShadow
      />
      <directionalLight position={FILL_LIGHT_POS} intensity={FILL_INTENSITY} />
      <pointLight position={BACK_LIGHT_POS} intensity={BACK_INTENSITY} />
    </>
  );
}
```

The key light does the work and casts the shadow; the fill lifts the shadow side without casting its own, and the back light separates the subject from the background. Only the key needs `castShadow` — three shadow-casting lights means three shadow map renders per frame.

### Environment-based lighting

```tsx
import { Environment } from "@react-three/drei";

// Preset HDRI environments (no manual light setup needed)
<Environment preset="sunset" background />;
// Presets: "apartment", "city", "dawn", "forest", "lobby", "night",
//          "park", "studio", "sunset", "warehouse"
```

---

## Pattern 5: Drei Helpers

### OrbitControls with limits

```tsx
import { OrbitControls } from "@react-three/drei";

const MIN_DISTANCE = 2;
const MAX_DISTANCE = 20;
const MAX_POLAR_ANGLE = Math.PI / 2; // Prevent going below ground

<OrbitControls
  enableDamping
  dampingFactor={0.1}
  minDistance={MIN_DISTANCE}
  maxDistance={MAX_DISTANCE}
  maxPolarAngle={MAX_POLAR_ANGLE}
/>;
```

`maxPolarAngle` at `Math.PI / 2` stops the camera passing under the ground plane, which is the usual way an orbit-controlled scene looks broken.

### Html overlay anchored to a 3D position

```tsx
import { Html } from "@react-three/drei";

const LABEL_OFFSET: [number, number, number] = [0, 1.5, 0];
const DISTANCE_SCALE = 8;

export function LabeledObject() {
  return (
    <mesh>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial color="teal" />
      <Html position={LABEL_OFFSET} distanceFactor={DISTANCE_SCALE} center>
        <div
          style={{
            background: "white",
            padding: "4px 8px",
            borderRadius: "4px",
          }}
        >
          My Label
        </div>
      </Html>
    </mesh>
  );
}
```

**Why good:** the label is real DOM, so it takes ordinary markup and remains selectable and readable by assistive technology — which text drawn into the canvas is not. `distanceFactor` scales it with camera distance so it recedes like the geometry it labels.

### Text — SDF glyphs rendered as geometry

```tsx
import { Text } from "@react-three/drei";

const FONT_SIZE = 0.8;

<Text
  fontSize={FONT_SIZE}
  position={[0, 2, 0]}
  color="white"
  anchorX="center"
  anchorY="middle"
>
  Hello World
</Text>;
```

`<Text>` lives in the scene, so it is occluded by geometry and lit like it — the trade against `<Html>` is that it cannot be selected or read aloud.

### ContactShadows — soft ground shadows

```tsx
import { ContactShadows } from "@react-three/drei";

const SHADOW_OPACITY = 0.4;
const SHADOW_BLUR = 2;

<ContactShadows
  position={[0, -0.5, 0]}
  opacity={SHADOW_OPACITY}
  blur={SHADOW_BLUR}
  far={4}
/>;
```

A cheap alternative to a shadow-casting light: one blurred plane instead of a shadow map render per frame.

### Float — idle hovering motion

```tsx
import { Float } from "@react-three/drei";

const FLOAT_SPEED = 1.5;
const FLOAT_AMPLITUDE = 0.3;

<Float
  speed={FLOAT_SPEED}
  floatIntensity={FLOAT_AMPLITUDE}
  rotationIntensity={0.2}
>
  <mesh>
    <dodecahedronGeometry />
    <meshStandardMaterial color="gold" />
  </mesh>
</Float>;
```

`<Float>` drives its children's transform itself, so it replaces a `useFrame` for this — and it composes, wrapping anything.

---

## Pattern 6: Physics with @react-three/rapier

### Collision events

```tsx
import { Physics, RigidBody } from "@react-three/rapier";
import type { CollisionPayload } from "@react-three/rapier";

const GRAVITY: [number, number, number] = [0, -9.81, 0];

function FallingBall() {
  const handleCollision = (payload: CollisionPayload) => {
    // payload.other contains the other rigid body
    // payload.manifold contains contact details
  };

  return (
    <RigidBody
      colliders="ball"
      restitution={0.7}
      onCollisionEnter={handleCollision}
    >
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="crimson" />
      </mesh>
    </RigidBody>
  );
}

export function PhysicsWorld() {
  return (
    <Physics gravity={GRAVITY}>
      <FallingBall />
      <RigidBody type="fixed">
        <mesh rotation-x={-Math.PI / 2}>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#555" />
        </mesh>
      </RigidBody>
    </Physics>
  );
}
```

`type="fixed"` gives the floor infinite mass, so it takes collisions without being pushed by them. Omitting it makes the floor dynamic and the whole scene falls together.

### Sensor colliders — trigger zones

```tsx
import { RigidBody, CuboidCollider } from "@react-three/rapier";

const SENSOR_SIZE: [number, number, number] = [2, 2, 2];

function TriggerZone() {
  return (
    <RigidBody type="fixed">
      <CuboidCollider
        args={SENSOR_SIZE}
        sensor
        onIntersectionEnter={() => {
          // Object entered trigger zone
        }}
        onIntersectionExit={() => {
          // Object left trigger zone
        }}
      />
    </RigidBody>
  );
}
```

A `sensor` collider detects overlap without resolving it, so bodies pass through — and it reports through `onIntersectionEnter`/`Exit` rather than the `onCollision` pair.

### Applying forces through a ref

```tsx
import { useRef } from "react";
import { RigidBody } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";

const JUMP_IMPULSE: [number, number, number] = [0, 5, 0];

export function JumpingBox() {
  const rigidBodyRef = useRef<RapierRigidBody>(null);

  const handleClick = () => {
    rigidBodyRef.current?.applyImpulse(
      { x: JUMP_IMPULSE[0], y: JUMP_IMPULSE[1], z: JUMP_IMPULSE[2] },
      true,
    );
  };

  return (
    <RigidBody ref={rigidBodyRef} colliders="cuboid">
      <mesh onClick={handleClick}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="dodgerblue" />
      </mesh>
    </RigidBody>
  );
}
```

**Why good:** the simulation owns the body's transform, so setting `position` on the mesh would be overwritten on the next step. Impulses and forces are the way in, and the second argument wakes a body the solver has put to sleep — without it a settled object ignores the impulse entirely.
