# VisionCamera Reference

> Decision frameworks, device/format selection, and performance checklist. See [SKILL.md](SKILL.md) for red flags and anti-patterns.

---

## Device Selection Framework

```
Which camera position?
|
+-> Back camera (default) → useCameraDevice("back")
+-> Front camera (selfie) → useCameraDevice("front")
+-> Multi-lens back camera → useCameraDevice("back", {
|     physicalDevices: ["ultra-wide-angle-camera", "wide-angle-camera", "telephoto-camera"]
|   })
+-> External USB camera → useCameraDevices() + filter for position === "external"
```

**Physical device zoom levels:**

| Device                    | Zoom  | Use Case                    |
| ------------------------- | ----- | --------------------------- |
| `ultra-wide-angle-camera` | ~0.5x | Landscapes, group photos    |
| `wide-angle-camera`       | 1x    | General photography         |
| `telephoto-camera`        | ~3x   | Portraits, distant subjects |

---

## Format Selection Framework

Filters are **ordered by descending priority** -- first filter has highest priority.

```
What matters most?
|
+-> Video quality → [{ videoResolution: { width: 3840, height: 2160 } }, { fps: 30 }]
+-> Photo quality → [{ photoResolution: "max" }]
+-> Performance → [{ videoResolution: { width: 1280, height: 720 } }, { fps: 30 }]
+-> HDR → [{ videoHdr: true }, { videoResolution: { width: 1920, height: 1080 } }]
+-> High FPS → [{ fps: 60 }, { videoResolution: { width: 1920, height: 1080 } }]
```

**Format properties:**

| Property                   | Type     | Description              |
| -------------------------- | -------- | ------------------------ |
| `photoWidth`/`photoHeight` | number   | Photo capture resolution |
| `videoWidth`/`videoHeight` | number   | Video/preview resolution |
| `minFps`/`maxFps`          | number   | FPS range                |
| `supportsVideoHdr`         | boolean  | 10-bit HDR video         |
| `supportsPhotoHdr`         | boolean  | Multi-exposure HDR photo |
| `supportsDepthCapture`     | boolean  | Depth data available     |
| `videoStabilizationModes`  | string[] | Stabilization options    |

---

## Zoom Implementation

Zoom is **logarithmic** -- linear gesture input must be mapped to logarithmic zoom values.

```typescript
// Animated zoom with Reanimated + Gesture Handler
import Animated, {
  useSharedValue,
  useAnimatedProps,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const ReanimatedCamera = Animated.createAnimatedComponent(Camera);
Animated.addWhitelistedNativeProps({ zoom: true });

const zoom = useSharedValue(device.neutralZoom);

const MAX_ZOOM = 16; // Clamp to reasonable max

const pinchGesture = Gesture.Pinch().onUpdate((event) => {
  zoom.value = interpolate(
    event.scale,
    [1, 10],
    [device.minZoom, Math.min(device.maxZoom, MAX_ZOOM)],
    Extrapolation.CLAMP,
  );
});

const animatedProps = useAnimatedProps(() => ({
  zoom: zoom.value,
}));

<GestureDetector gesture={pinchGesture}>
  <ReanimatedCamera animatedProps={animatedProps} {...props} />
</GestureDetector>
```

**Simpler alternative:** Use `enableZoomGesture={true}` for built-in pinch-to-zoom without custom gesture code.

---

## Camera Props Quick Reference

| Prop                      | Type                               | Default     | Notes                                  |
| ------------------------- | ---------------------------------- | ----------- | -------------------------------------- |
| `device`                  | CameraDevice                       | required    | From `useCameraDevice()`               |
| `isActive`                | boolean                            | required    | Toggle, don't unmount                  |
| `photo`                   | boolean                            | false       | Enable photo capture pipeline          |
| `video`                   | boolean                            | false       | Enable video recording pipeline        |
| `audio`                   | boolean                            | false       | Enable audio (requires mic permission) |
| `format`                  | CameraDeviceFormat                 | auto        | From `useCameraFormat()`               |
| `fps`                     | number \| [min, max]               | auto        | Fixed or variable FPS                  |
| `photoQualityBalance`     | "speed" \| "balanced" \| "quality" | "balanced"  | Photo capture speed vs quality         |
| `zoom`                    | number                             | neutralZoom | Logarithmic scale                      |
| `exposure`                | number                             | neutral     | Offset from auto-exposure              |
| `videoHdr`                | boolean                            | false       | Requires format support                |
| `photoHdr`                | boolean                            | false       | Requires format support                |
| `enableLocation`          | boolean                            | false       | GPS metadata in captures               |
| `enableZoomGesture`       | boolean                            | false       | Built-in pinch-to-zoom                 |
| `enableBufferCompression` | boolean                            | false       | Lossy compression for less memory      |
| `videoStabilizationMode`  | string                             | "off"       | Check format support                   |
| `codeScanner`             | CodeScanner                        | -           | From `useCodeScanner()`                |
| `frameProcessor`          | FrameProcessor                     | -           | From `useFrameProcessor()`             |

---

## Camera Ref Methods

| Method                    | Returns              | Notes                                        |
| ------------------------- | -------------------- | -------------------------------------------- |
| `takePhoto(options?)`     | `Promise<PhotoFile>` | Full quality, AE/AF/AWB                      |
| `takeSnapshot(options?)`  | `Promise<PhotoFile>` | ~16ms, preview quality, needs `video` on iOS |
| `startRecording(options)` | void                 | Callback-based (onRecordingFinished)         |
| `stopRecording()`         | `Promise<void>`      | Triggers onRecordingFinished                 |
| `pauseRecording()`        | `Promise<void>`      |                                              |
| `resumeRecording()`       | `Promise<void>`      |                                              |
| `cancelRecording()`       | `Promise<void>`      | Deletes file, fires onRecordingError         |
| `focus(point)`            | `Promise<void>`      | { x, y } relative to view                    |

---

## Hooks Quick Reference

| Hook                                    | Returns                                | Purpose                        |
| --------------------------------------- | -------------------------------------- | ------------------------------ |
| `useCameraDevice(position, options?)`   | `CameraDevice \| undefined`            | Best device for position       |
| `useCameraDevices()`                    | `CameraDevice[]`                       | All available devices          |
| `useCameraFormat(device, filters)`      | `CameraDeviceFormat \| undefined`      | Best format matching filters   |
| `useCameraPermission()`                 | `{ hasPermission, requestPermission }` | Camera permission state        |
| `useMicrophonePermission()`             | `{ hasPermission, requestPermission }` | Mic permission state           |
| `useLocationPermission()`               | `{ hasPermission, requestPermission }` | Location permission state      |
| `useCodeScanner(options)`               | `CodeScanner`                          | QR/barcode scanner config      |
| `useFrameProcessor(callback, deps)`     | `FrameProcessor`                       | Worklet-based frame processing |
| `useSkiaFrameProcessor(callback, deps)` | `FrameProcessor`                       | Skia canvas on frames          |

---

## Camera Lifecycle Events

Events fire in this order:

1. `onInitialized` -- session ready, all Camera methods available
2. `onStarted` / `onStopped` -- session streaming started/stopped
3. `onPreviewStarted` / `onPreviewStopped` -- preview frames flowing/stopped
4. `onError` -- runtime error occurred

**Key:** Do NOT call `takePhoto()` or `startRecording()` before `onInitialized` fires.

---

## Performance Checklist

### Pipeline Optimization

- [ ] Only enabling pipelines actually in use (`photo`, `video`, `codeScanner`, frame processor)
- [ ] Using `enableBufferCompression={true}` when memory is a concern
- [ ] Disabling `videoHdr` when 10-bit processing overhead is unnecessary
- [ ] Disabling `videoStabilizationMode` if startup speed matters more

### Resolution and FPS

- [ ] Format resolution matches actual need (not 4K when 1080p suffices)
- [ ] FPS set to actual need (not 60 when 30 is fine)
- [ ] Using variable FPS `fps={[minFps, maxFps]}` for adaptive low-light

### Frame Processor Performance

- [ ] `'worklet'` directive present as first line of every frame processor
- [ ] Using `runAsync` for processing > 33ms (at 30 FPS)
- [ ] Using `runAtTargetFps` when per-frame processing is unnecessary
- [ ] Using `useSharedValue` (not `useState`) for cross-thread data
- [ ] Using native plugins over pure JS for heavy operations
- [ ] Preferring YUV pixel format over RGB (less memory overhead)
- [ ] Using `enableFpsGraph={true}` during development to profile performance

### Device Selection

- [ ] Using simpler devices (fewer physical cameras) when multi-lens is unnecessary (faster init)
- [ ] Starting zoom at `device.neutralZoom` (not hardcoded 1.0)

### Lifecycle

- [ ] Camera mounted once, toggling `isActive` instead of unmounting
- [ ] `isActive` combines screen focus AND app state
- [ ] Not calling Camera methods before `onInitialized`

---

## Permission States

| Status           | Meaning                  | Action                               |
| ---------------- | ------------------------ | ------------------------------------ |
| `granted`        | User approved            | Render Camera                        |
| `not-determined` | Never asked              | Call `requestPermission()`           |
| `denied`         | User rejected            | Show rationale, link to Settings     |
| `restricted`     | Device policy (parental) | Show explanation, no action possible |
