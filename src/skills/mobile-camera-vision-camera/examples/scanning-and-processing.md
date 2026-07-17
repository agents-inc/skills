# VisionCamera - Scanning and Frame Processing

> Code scanning and real-time frame processor patterns. See [core.md](core.md) for camera setup and capture. See [SKILL.md](../SKILL.md) for red flags.

---

## Pattern 1: QR/Barcode Scanning with Debounce

The code scanner fires many times per second. Guard against processing the same code repeatedly.

```typescript
import { useCallback, useRef } from "react";
import { Alert, StyleSheet } from "react-native";
import { Camera, useCameraDevice, useCodeScanner } from "react-native-vision-camera";

const SCAN_COOLDOWN_MS = 2000;

export function ScannerScreen() {
  const device = useCameraDevice("back");
  const lastScannedRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef(0);

  const codeScanner = useCodeScanner({
    codeTypes: ["qr", "ean-13", "code-128"],
    onCodeScanned: (codes) => {
      const code = codes[0];
      if (!code?.value) return;

      const now = Date.now();
      // Debounce: skip if same code scanned within cooldown
      if (
        code.value === lastScannedRef.current &&
        now - lastScannedTimeRef.current < SCAN_COOLDOWN_MS
      ) {
        return;
      }

      lastScannedRef.current = code.value;
      lastScannedTimeRef.current = now;
      Alert.alert("Scanned", code.value);
    },
  });

  if (device == null) return null;

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={true}
      codeScanner={codeScanner}
    />
  );
}
```

**Why good:** ref-based debounce avoids re-renders, cooldown prevents duplicate processing, only needed code types listed (not all), named constant for cooldown

```typescript
// Bad: no debounce, setState on every scan
const codeScanner = useCodeScanner({
  codeTypes: ["qr"],
  onCodeScanned: (codes) => {
    setScannedCode(codes[0]?.value); // Fires 30+ times per second
  },
});
```

**Why bad:** setState called on every frame with a visible code, causes excessive re-renders and may trigger navigation/alerts repeatedly

### Supported Code Types

| Code Type     | Platform      | Notes                                       |
| ------------- | ------------- | ------------------------------------------- |
| `qr`          | iOS + Android | QR codes                                    |
| `ean-13`      | iOS + Android | European article numbers                    |
| `ean-8`       | iOS + Android | Short EAN                                   |
| `code-128`    | iOS + Android | High-density barcode                        |
| `code-39`     | iOS + Android | Alphanumeric barcode                        |
| `code-93`     | iOS + Android |                                             |
| `upc-e`       | iOS + Android | US product codes                            |
| `pdf-417`     | iOS + Android | 2D barcode (IDs, tickets)                   |
| `aztec`       | iOS + Android | 2D barcode                                  |
| `data-matrix` | iOS + Android | 2D matrix code                              |
| `itf`         | iOS + Android | Interleaved 2 of 5 (min 6 chars on Android) |
| `codabar`     | iOS + Android |                                             |

**Platform notes:**

- UPC-A codes report as EAN-13 on iOS (EAN-13 is a superset of UPC-A)
- ITF-14 (14-character restriction) is iOS-only
- Android requires MLKit: set `VisionCamera_enableCodeScanner=true` in `gradle.properties`

---

## Pattern 2: Basic Frame Processor

Frame processors run as worklets on a parallel JS thread. The `'worklet'` directive is mandatory.

```typescript
import { useFrameProcessor, Camera, useCameraDevice } from "react-native-vision-camera";
import { StyleSheet } from "react-native";

export function FrameProcessorScreen() {
  const device = useCameraDevice("back");

  const frameProcessor = useFrameProcessor((frame) => {
    "worklet";
    // Access frame properties
    console.log(`Frame: ${frame.width}x${frame.height} (${frame.pixelFormat})`);

    // Call native frame processor plugins
    // const results = detectFaces(frame);
  }, []);

  if (device == null) return null;

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={true}
      frameProcessor={frameProcessor}
    />
  );
}
```

**Why good:** worklet directive present as first statement, dependency array provided, frame properties accessed synchronously

```typescript
// Bad: missing worklet directive
const frameProcessor = useFrameProcessor((frame) => {
  console.log(frame.width); // Will crash or run on wrong thread
}, []);
```

**Why bad:** without `'worklet'` directive, function runs on the wrong thread, causing crashes or silent failures

---

## Pattern 3: Async Frame Processing with runAsync

For heavy processing that exceeds the frame interval (~33ms at 30 FPS), use `runAsync` to avoid blocking the camera pipeline.

```typescript
import { useFrameProcessor } from "react-native-vision-camera";
import { runAsync } from "react-native-vision-camera";

const frameProcessor = useFrameProcessor((frame) => {
  "worklet";

  // Heavy work runs on a separate thread, non-blocking
  runAsync(frame, () => {
    "worklet";
    // This won't block the camera pipeline
    // Only one runAsync runs at a time (not parallel)
    const results = heavyMLInference(frame);
    // Process results...
  });
}, []);
```

**Why good:** heavy work offloaded to separate thread, camera pipeline not blocked, frames continue flowing

**Key:** `runAsync` runs one call at a time. If the previous async call is still running, new calls are skipped. This naturally throttles heavy work.

---

## Pattern 4: Throttled Processing with runAtTargetFps

When you don't need to process every frame (e.g., ML detection at 5 FPS is sufficient):

```typescript
import { useFrameProcessor } from "react-native-vision-camera";
import { runAtTargetFps } from "react-native-vision-camera";

const DETECTION_FPS = 5;

const frameProcessor = useFrameProcessor((frame) => {
  "worklet";

  // Process at 5 FPS instead of 30
  runAtTargetFps(DETECTION_FPS, () => {
    "worklet";
    const detections = detectObjects(frame);
    // Handle detections...
  });
}, []);
```

**Why good:** ML inference doesn't need 30 FPS, reduces battery and CPU usage significantly, named constant for target FPS

---

## Pattern 5: Sharing Data Between Frame Processor and React

Use `useSharedValue` from Reanimated for efficient cross-thread communication. Use `createRunOnJS` to call React functions from worklets.

```typescript
import { useCallback } from "react";
import { useFrameProcessor } from "react-native-vision-camera";
import { useSharedValue } from "react-native-reanimated";
import { createRunOnJS } from "react-native-vision-camera";

const DETECTION_FPS = 10;

export function DetectionScreen() {
  // Shared value for cross-thread data (no re-renders)
  const detectedObjects = useSharedValue<DetectedObject[]>([]);

  // React function to call from worklet
  const handleDetection = useCallback((objects: DetectedObject[]) => {
    // This runs on the React JS thread
    if (objects.length > 0) {
      console.log("Detected:", objects.length, "objects");
    }
  }, []);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      "worklet";

      runAtTargetFps(DETECTION_FPS, () => {
        "worklet";
        const objects = detectObjects(frame);

        // Update shared value (accessible from Reanimated/Skia)
        detectedObjects.value = objects;

        // Call React function from worklet
        const onDetection = createRunOnJS(handleDetection);
        onDetection(objects);
      });
    },
    [handleDetection],
  );

  // detectedObjects.value can be used in Reanimated animated styles
  // to overlay bounding boxes without re-rendering React components
}
```

**Why good:** useSharedValue avoids useState re-renders, createRunOnJS bridges worklet-to-React safely, throttled at target FPS

```typescript
// Bad: using useState from frame processor
const [objects, setObjects] = useState<DetectedObject[]>([]);
const frameProcessor = useFrameProcessor((frame) => {
  "worklet";
  const result = detectObjects(frame);
  setObjects(result); // BAD: causes thread context switching + re-renders every frame
}, []);
```

**Why bad:** useState causes React re-renders on every processed frame, thread context switching between worklet and React thread is expensive, UI may become unresponsive

---

## Pattern 6: Reading React State in Frame Processors

React state values are automatically copied (read-only) into frame processor worklets via closure.

```typescript
const [isDetectionEnabled, setIsDetectionEnabled] = useState(true);

const frameProcessor = useFrameProcessor(
  (frame) => {
    "worklet";
    // isDetectionEnabled is readonly-copied into the worklet
    if (!isDetectionEnabled) return;

    const results = detectObjects(frame);
    // Process results...
  },
  [isDetectionEnabled], // Re-create processor when state changes
);
```

**Why good:** React state readable in worklets via closure, dependency array ensures processor updates when state changes

**Key:** State values are read-only copies. You cannot set React state from within a worklet directly -- use `createRunOnJS` for that.
