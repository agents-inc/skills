# React Three Fiber - Core Examples

> Core patterns for R3F scenes, meshes, animation, asset loading, and drei helpers. See [SKILL.md](../SKILL.md) for concepts and [reference.md](../reference.md) for decision frameworks.

**Related examples:**

- [interaction.md](interaction.md) - Events, raycasting, hover/click, drag
- [performance.md](performance.md) - Instancing, LOD, disposal, frame loop control

---

## Pattern 1: Canvas and Scene Setup

### Good Example - Complete Scene with Lighting

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

**Why good:** Named constants for camera config, shadow map size explicit, dpr clamped, Suspense for async helpers, scene content separated into its own component

### Bad Example - Inline Numbers and Missing Shadows

```tsx
// BAD: magic numbers everywhere, no shadows, no Suspense
function BadScene() {
  return (
    <Canvas camera={{ position: [3, 3, 3] }}>
      <ambientLight intensity={0.5} />
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="orange" />
      </mesh>
    </Canvas>
  );
}
```

**Why bad:** Magic numbers for position, no shadow configuration, no Suspense boundary for future async children, no directional light for depth

### Orthographic Camera

```tsx
const ORTHO_ZOOM = 50;

<Canvas orthographic camera={{ zoom: ORTHO_ZOOM, position: [0, 10, 0] }}>
  {/* Isometric / 2D-style scenes */}
</Canvas>;
```

---

## Pattern 2: Per-Frame Animation with useFrame

### Good Example - Delta-Based Rotation

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

**Why good:** delta multiplication ensures consistent speed regardless of frame rate, clock-based sine for smooth periodic motion, null guard on ref

### Bad Example - setState in useFrame

```tsx
// BAD: React re-render every single frame
function BadAnimatedBox() {
  const [rotY, setRotY] = useState(0);
  useFrame((_, delta) => {
    setRotY((r) => r + 0.5 * delta); // setState in render loop!
  });
  return (
    <mesh rotation-y={rotY}>
      <boxGeometry />
      <meshBasicMaterial />
    </mesh>
  );
}
```

**Why bad:** setState triggers React reconciliation ~60 times/second, causing massive overhead; use ref mutation instead

### Conditional Animation (Pause/Resume)

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

### Reusing Objects in useFrame

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

**Why good:** Vector3 allocated once via useMemo, reused every frame; never allocate inside useFrame

---

## Pattern 3: Asset Loading

### GLTF Model with useGLTF

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

**Why good:** typed GLTF result for autocomplete, geometry/material reused from loaded model, preload for faster first render

### Texture Loading

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

### Draco-Compressed GLTF

```tsx
import { useGLTF } from "@react-three/drei";

export function CompressedModel() {
  const { scene } = useGLTF("/model.glb", "/draco/");
  // Second arg is Draco decoder path
  return <primitive object={scene} />;
}
```

---

## Pattern 4: Common Light Setups

### Three-Point Lighting

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

### Environment-Based Lighting

```tsx
import { Environment } from "@react-three/drei";

// Preset HDRI environments (no manual light setup needed)
<Environment preset="sunset" background />;
// Presets: "apartment", "city", "dawn", "forest", "lobby", "night",
//          "park", "studio", "sunset", "warehouse"
```

---

## Pattern 5: Drei Helpers

### OrbitControls with Limits

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

### Html Overlay at 3D Position

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

**Why good:** distanceFactor scales HTML based on 3D distance, center prop centers the HTML on the point

### Text (SDF-Based 3D Text)

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

### ContactShadows (Soft Ground Shadows)

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

### Float (Hovering Animation)

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

---

## Pattern 6: Physics with @react-three/rapier

### Collision Events

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

### Sensor Colliders (Trigger Zones)

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

### Applying Forces via Ref

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
