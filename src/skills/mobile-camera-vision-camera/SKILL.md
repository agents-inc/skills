---
name: mobile-camera-vision-camera
description: VisionCamera v4+ - photo/video capture, QR/barcode scanning, real-time frame processors, zoom/focus/exposure, HDR, location metadata, format selection
---

# VisionCamera Patterns

> **Quick Guide:** Use VisionCamera for high-performance camera features in React Native. Control the camera lifecycle with `isActive` (never unmount/remount). Use `useCameraDevice` to select back/front cameras, `useCameraPermission` for permissions. Capture photos with `takePhoto()`, record video with `startRecording()`/`stopRecording()`, scan codes with `useCodeScanner`, and process frames in real time with `useFrameProcessor` worklets. Frame processors run on a parallel JS thread via JSI -- keep them fast or use `runAsync`/`runAtTargetFps` to avoid blocking the pipeline.

---

<critical_requirements>

## CRITICAL: Before Using This Skill

> **All code must follow project conventions in CLAUDE.md** (kebab-case, named exports, import ordering, `import type`, named constants)

**(You MUST set `isActive` based on screen focus AND app state -- camera must pause when backgrounded or navigated away)**

**(You MUST request permissions before rendering the Camera -- `useCameraPermission` returns `hasPermission` and `requestPermission`)**

**(You MUST include the `'worklet'` directive as the first line of every frame processor function body)**

**(You MUST enable only the pipelines you need (`photo`, `video`, `codeScanner`, `frameProcessor`) -- unused pipelines waste resources)**

**(You MUST use `useSharedValue` (not `useState`) for data shared between frame processors and the React thread)**

</critical_requirements>

---

**Auto-detection:** VisionCamera, react-native-vision-camera, useCameraDevice, useCameraDevices, useCameraPermission, useMicrophonePermission, useCodeScanner, useFrameProcessor, useSkiaFrameProcessor, useCameraFormat, takePhoto, takeSnapshot, startRecording, stopRecording, Camera component, frame processor, worklet, codeScanner, photoQualityBalance, enableLocation, videoHdr, photoHdr

**When to use:**

- Capturing photos or recording video in a React Native app
- Scanning QR codes or barcodes (EAN-13, Code-128, etc.)
- Real-time frame processing for ML, object detection, or image analysis
- Implementing zoom, focus, exposure, or HDR controls
- Embedding GPS location metadata in captured media
- Selecting specific camera devices (ultra-wide, telephoto, front/back)

**When NOT to use:**

- Picking images from the device gallery (use an image picker)
- Simple static image display (use standard Image component)
- Web-only camera access (use browser MediaDevices API)

**Key patterns covered:**

- Camera lifecycle management with `isActive` and screen/app state
- Permission handling with hooks (`useCameraPermission`, `useMicrophonePermission`)
- Photo capture (`takePhoto`, `takeSnapshot`) and video recording
- QR/barcode scanning with `useCodeScanner`
- Frame processors with worklets, `runAsync`, and `runAtTargetFps`
- Device selection, format selection, zoom, focus, exposure, HDR
- Location metadata embedding
- Performance optimization (pipeline selection, buffer compression, pixel format)

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Camera setup, permissions, lifecycle, photo capture, video recording
- [examples/scanning-and-processing.md](examples/scanning-and-processing.md) - Code scanning, frame processors, worklet patterns
- [reference.md](reference.md) - Decision frameworks, device/format selection, performance checklist

---

<philosophy>

## Philosophy

VisionCamera provides direct, high-performance camera access in React Native via JSI (JavaScript Interface). It bypasses the legacy bridge entirely, giving synchronous control over native camera hardware from JavaScript.

**Core principles:**

1. **Lifecycle-driven** -- the `isActive` prop controls the camera session. Toggle it instead of mounting/unmounting. Resuming is much faster than re-mounting.
2. **Pipeline-based** -- enable only what you need (`photo`, `video`, `codeScanner`, frame processor). Each pipeline allocates resources.
3. **Worklet-powered** -- frame processors run on a parallel JS thread via `react-native-worklets-core`. They execute synchronously in the video pipeline, so they must be fast.
4. **Device/format-aware** -- different physical cameras and formats have different capabilities. Always check device and format properties before enabling features like HDR or high FPS.

**When to use VisionCamera:**

- You need camera preview with capture, scanning, or real-time processing
- You need fine-grained control over device, format, zoom, focus, exposure
- You need frame-level access for ML inference or custom image processing

**When NOT to use:**

- Gallery/file picking (different concern entirely)
- Screenshot or screen recording (not camera-related)

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Camera Lifecycle and Permissions

The camera must be activated only when the screen is focused AND the app is in the foreground. Always check permissions before rendering.

```typescript
import { useCameraDevice, useCameraPermission, Camera } from "react-native-vision-camera";
import { StyleSheet } from "react-native";

export function CameraScreen() {
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();

  // Request permission on mount if not granted
  // Render permission UI or Camera based on hasPermission

  if (!hasPermission) return <PermissionRequest onRequest={requestPermission} />;
  if (device == null) return <NoCameraDeviceError />;

  return <Camera style={StyleSheet.absoluteFill} device={device} isActive={isActive} />;
}
```

**Why good:** permission checked before render, device null-checked, isActive controls lifecycle without unmounting

The `isActive` prop should combine screen focus and app state:

```typescript
const isFocused = useIsFocused(); // from navigation
const appState = useAppState(); // from community hooks
const isActive = isFocused && appState === "active";
```

See [examples/core.md](examples/core.md) for the complete lifecycle pattern with permissions, device selection, and app state handling.

---

### Pattern 2: Photo Capture

Use a Camera ref to call `takePhoto()`. Enable the `photo` pipeline on the Camera component. Use `takeSnapshot()` for fast preview-quality captures.

```typescript
const camera = useRef<Camera>(null);

const handleCapture = async () => {
  const photo = await camera.current?.takePhoto({
    flash: "auto",
    enableShutterSound: true,
  });
  // photo.path contains the temporary file path
};

<Camera ref={camera} device={device} isActive={isActive} photo={true} />
```

**Why good:** photo pipeline explicitly enabled, ref used for imperative capture, options typed

- `takePhoto()` -- full-quality capture with AE/AF/AWB, supports flash
- `takeSnapshot()` -- ~16ms capture from preview buffer, requires `video` enabled on iOS
- `photoQualityBalance` prop: `"speed"` | `"balanced"` | `"quality"`

See [examples/core.md](examples/core.md) for full photo capture with error handling and format selection.

---

### Pattern 3: Video Recording

Use `startRecording()` with callbacks for completion and errors. `stopRecording()` triggers `onRecordingFinished`.

```typescript
camera.current?.startRecording({
  onRecordingFinished: (video) => {
    // video.path contains the temporary file path
    // video.duration contains the duration in seconds
  },
  onRecordingError: (error) => console.error(error),
});

// Later:
await camera.current?.stopRecording();
```

**Why good:** callback-based API handles async completion, error callback prevents silent failures

- Enable `video={true}` and `audio={true}` on the Camera component
- `pauseRecording()` / `resumeRecording()` for pause support
- `cancelRecording()` deletes the temp file and fires `onRecordingError`
- `videoBitRate`: `"low"` | `"normal"` | `"high"` or custom Mbps number
- `videoCodec`: `"h264"` (default, wider compatibility) or `"h265"` (better compression)

See [examples/core.md](examples/core.md) for complete video recording with pause/resume.

---

### Pattern 4: QR/Barcode Scanning

Use the `useCodeScanner` hook. Runs on the native thread for instant scanning without UI freezing.

```typescript
const codeScanner = useCodeScanner({
  codeTypes: ["qr", "ean-13"],
  onCodeScanned: (codes) => {
    // codes[0].value contains the decoded string
    // Fires many times per second -- debounce if updating state
  },
});

<Camera device={device} isActive={isActive} codeScanner={codeScanner} />
```

**Why good:** native-thread scanning, specific code types listed (not all), callback provides decoded values

**Android setup:** Requires MLKit. Enable via `VisionCamera_enableCodeScanner=true` in `gradle.properties` (or Expo plugin config).

**Gotcha:** `onCodeScanned` fires many times per second. Debounce or guard with a ref to avoid processing the same code repeatedly.

See [examples/scanning-and-processing.md](examples/scanning-and-processing.md) for debounced scanning and supported code types.

---

### Pattern 5: Frame Processors

Frame processors run JavaScript worklets on a parallel camera thread for real-time frame analysis. Requires `react-native-worklets-core`.

```typescript
const frameProcessor = useFrameProcessor((frame) => {
  "worklet";
  // frame.width, frame.height, frame.pixelFormat
  // frame.toArrayBuffer() for raw pixel data
  const results = detectObjects(frame); // native plugin call
}, []);

<Camera device={device} isActive={isActive} frameProcessor={frameProcessor} />
```

**Why good:** worklet directive present, runs on parallel thread, native plugin for heavy work

- Synchronous by default -- must complete before next frame (~33ms at 30 FPS)
- `runAsync(() => { ... })` -- offload heavy processing without blocking
- `runAtTargetFps(5, () => { ... })` -- process at lower FPS to save resources
- `useSharedValue` -- share data between frame processor and React thread
- `createRunOnJS(fn)` -- call React functions from within a worklet

See [examples/scanning-and-processing.md](examples/scanning-and-processing.md) for async processing, shared values, and performance patterns.

---

### Pattern 6: Device and Format Selection

Choose camera devices by position and physical lenses. Select formats for resolution, FPS, and HDR support.

```typescript
// Basic device selection
const device = useCameraDevice("back");

// Multi-camera with specific lenses
const device = useCameraDevice("back", {
  physicalDevices: [
    "ultra-wide-angle-camera",
    "wide-angle-camera",
    "telephoto-camera",
  ],
});

// Format selection (filters ordered by descending priority)
const format = useCameraFormat(device, [
  { videoAspectRatio: 16 / 9 },
  { videoResolution: { width: 1920, height: 1080 } },
  { fps: 30 },
]);
```

**Why good:** multi-camera support with fallback, format priorities explicitly ordered, resolution matched to actual need

See [reference.md](reference.md) for the device and format decision framework.

---

### Pattern 7: Zoom, Focus, and Exposure

Control camera optics via props and ref methods.

```typescript
// Zoom: use device.minZoom, device.maxZoom, device.neutralZoom
<Camera zoom={device.neutralZoom} />

// Focus: tap-to-focus via ref
await camera.current?.focus({ x: tapX, y: tapY });

// Exposure: offset from auto-exposure (-2 to +2 typical range)
<Camera exposure={exposureOffset} />
```

- Zoom operates on a **logarithmic scale** -- use `interpolate()` for linear gesture mapping
- Built-in pinch-to-zoom: `enableZoomGesture={true}` (no custom gesture needed)
- Focus adjusts both AF and AE at the tap point
- Check `device.supportsFocus` before calling `focus()`
- Exposure range: `device.minExposure` to `device.maxExposure`

See [reference.md](reference.md) for animated zoom with Reanimated.

---

### Pattern 8: HDR and Location Metadata

Enable HDR for enhanced dynamic range. Enable location for GPS EXIF/MP4 tags.

```typescript
const format = useCameraFormat(device, [
  { videoHdr: true },
  { photoHdr: true },
]);

<Camera
  format={format}
  videoHdr={format?.supportsVideoHdr}
  photoHdr={format?.supportsPhotoHdr}
  enableLocation={true}
/>
```

- Video HDR uses 10-bit pixel format (adds processing overhead)
- Photo HDR combines multiple exposures into one image
- Location requires `useLocationPermission` and platform-specific manifest entries
- Disable location APIs entirely with build flag if not needed (avoids App Store rejection)

See [examples/core.md](examples/core.md) for HDR format selection and location permission flow.

</patterns>

---

<decision_framework>

## Decision Framework

### Capture Method

```
What do you need to capture?
|
+-> Still image?
|   +-> High quality (AE/AF/AWB) → takePhoto()
|   +-> Fast preview capture (~16ms) → takeSnapshot() (requires video pipeline)
|
+-> Video?
|   +-> Continuous recording → startRecording() / stopRecording()
|   +-> Need pause/resume → pauseRecording() / resumeRecording()
|   +-> User cancelled → cancelRecording()
|
+-> QR/barcode scanning?
|   +-> useCodeScanner (native thread, no frame processor needed)
|
+-> Real-time frame analysis (ML, detection)?
    +-> useFrameProcessor with native plugins
    +-> Need Skia drawing on frames? → useSkiaFrameProcessor
```

### Frame Processor Scheduling

```
How fast must your processor run?
|
+-> Every frame (30/60 FPS)?
|   +-> Processing < 33ms? → Default synchronous processor
|   +-> Processing > 33ms? → runAsync (offload to separate thread)
|
+-> Lower rate is fine (5-10 FPS)?
    +-> runAtTargetFps(targetFps, () => { ... })
```

### Device Selection

```
Which camera?
|
+-> Simple back/front → useCameraDevice("back") or useCameraDevice("front")
+-> Multi-lens (0.5x + 1x + 3x) → useCameraDevice("back", { physicalDevices: [...] })
+-> External USB camera → Filter useCameraDevices() for position === "external"
+-> Custom logic → useCameraDevices() + useMemo with your own filter
```

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues:**

- Mounting/unmounting Camera instead of toggling `isActive` -- wastes resources, slow resume
- Missing `'worklet'` directive in frame processor function -- silently runs on wrong thread, crashes
- Using `useState` to share data from frame processors -- causes thread context switching, use `useSharedValue`
- Enabling all pipelines (`photo`, `video`, `codeScanner`, frame processor) when only one is needed -- wastes memory and battery
- Not requesting permissions before rendering Camera -- causes crash or blank preview
- Calling `camera.current.takePhoto()` before `onInitialized` fires -- method not ready, throws error

**Medium Priority Issues:**

- Capturing 4K when 1080p is sufficient -- wastes memory, slower processing
- Not debouncing `onCodeScanned` -- fires many times per second, causes excessive state updates
- Using `useSkiaFrameProcessor` when `useFrameProcessor` suffices -- Skia adds overhead
- Enabling `videoHdr` without checking `format.supportsVideoHdr` -- crashes on unsupported formats
- Not checking `device.supportsFocus` before calling `focus()` -- fails on devices without AF

**Gotchas & Edge Cases:**

- Zoom is **logarithmic** -- 1x to 2x is a much bigger visual change than 127x to 128x. Use `interpolate()` for linear gesture mapping.
- `takeSnapshot()` requires `video={true}` on iOS -- it captures from the video preview buffer
- Frame processors at 4K process ~12MB per frame -- use lower resolution if possible
- `device.neutralZoom` may not be 1.0 on ultra-wide cameras -- always use it as the starting zoom
- Android code scanner requires MLKit (`VisionCamera_enableCodeScanner=true`) -- without it, scanning silently does nothing
- UPC-A codes report as EAN-13 on iOS (EAN-13 is a superset)
- `cancelRecording()` fires `onRecordingError` with `capture/recording-canceled` -- handle this error type gracefully
- `enableLocation` requires platform manifest entries (iOS: `NSLocationWhenInUseUsageDescription`, Android: `ACCESS_FINE_LOCATION`)
- Disable location APIs entirely via build flag if unused -- prevents App Store rejection for unnecessary privacy APIs
- `exposure` prop is an offset from auto-exposure, not an absolute ISO value
- Video HDR uses 10-bit pixel format which adds processing overhead -- disable when not needed

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All code must follow project conventions in CLAUDE.md**

**(You MUST set `isActive` based on screen focus AND app state -- camera must pause when backgrounded or navigated away)**

**(You MUST request permissions before rendering the Camera -- `useCameraPermission` returns `hasPermission` and `requestPermission`)**

**(You MUST include the `'worklet'` directive as the first line of every frame processor function body)**

**(You MUST enable only the pipelines you need (`photo`, `video`, `codeScanner`, `frameProcessor`) -- unused pipelines waste resources)**

**(You MUST use `useSharedValue` (not `useState`) for data shared between frame processors and the React thread)**

**Failure to follow these rules will cause crashes, blank previews, wasted battery, and dropped frames.**

</critical_reminders>
