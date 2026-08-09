# VisionCamera - Core Patterns

> Camera setup, permissions, lifecycle, photo capture, and video recording. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

**Prerequisites**: react-native-vision-camera v4+, react-native-worklets-core (for frame processors).

---

## Pattern 1: Camera Lifecycle with Permissions

The camera should only be active when the screen is focused and the app is in the foreground. Always handle permissions before rendering the Camera.

```typescript
import { useCallback, useRef, useState } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  type PhotoFile,
} from "react-native-vision-camera";
import { useIsFocused } from "@react-navigation/native";
import { useAppState } from "@react-native-community/hooks";

export function CameraScreen() {
  const camera = useRef<Camera>(null);
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();

  // Camera active ONLY when screen focused AND app foregrounded
  const isFocused = useIsFocused();
  const appState = useAppState();
  const isActive = isFocused && appState === "active";

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text>Camera permission is required</Text>
        <Pressable onPress={requestPermission}>
          <Text>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text>No camera device found</Text>
      </View>
    );
  }

  return (
    <Camera
      ref={camera}
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={isActive}
      photo={true}
      onInitialized={() => console.log("Camera ready")}
      onError={(error) => console.error("Camera error:", error)}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
```

**Why good:** permission checked before Camera renders, device null-checked, isActive combines focus + app state, camera not unmounted when inactive (toggle isActive instead), only `photo` pipeline enabled

```typescript
// Bad: unmounting camera when navigating away
{isFocused && <Camera device={device} isActive={true} />}
```

**Why bad:** unmounting and remounting is much slower than toggling isActive, loses camera session warmth

---

## Pattern 2: Photo Capture with Options

```typescript
import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  type PhotoFile,
} from "react-native-vision-camera";

const PHOTO_WIDTH = 1920;
const PHOTO_HEIGHT = 1080;

export function PhotoCaptureScreen() {
  const camera = useRef<Camera>(null);
  const device = useCameraDevice("back");
  const [isReady, setIsReady] = useState(false);
  const [lastPhoto, setLastPhoto] = useState<PhotoFile | null>(null);

  // Select format matching desired resolution
  const format = useCameraFormat(device, [
    { photoResolution: { width: PHOTO_WIDTH, height: PHOTO_HEIGHT } },
  ]);

  const handleTakePhoto = useCallback(async () => {
    if (!camera.current || !isReady) return;

    try {
      const photo = await camera.current.takePhoto({
        flash: "auto",
        enableShutterSound: true,
        enableAutoRedEyeReduction: true,
      });
      setLastPhoto(photo);
      // photo.path is the temporary file path
      // photo.width, photo.height for dimensions
    } catch (error) {
      Alert.alert("Capture failed", String(error));
    }
  }, [isReady]);

  // Fast snapshot alternative (~16ms, lower quality)
  const handleTakeSnapshot = useCallback(async () => {
    if (!camera.current || !isReady) return;

    const SNAPSHOT_QUALITY = 85;
    try {
      const snapshot = await camera.current.takeSnapshot({
        quality: SNAPSHOT_QUALITY,
      });
      setLastPhoto(snapshot);
    } catch (error) {
      Alert.alert("Snapshot failed", String(error));
    }
  }, [isReady]);

  if (device == null) return null;

  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
        format={format}
        photoQualityBalance="balanced"
        onInitialized={() => setIsReady(true)}
      />
      <Pressable onPress={handleTakePhoto} disabled={!isReady}>
        <Text>Take Photo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
```

**Why good:** format selected for target resolution, onInitialized guards against calling takePhoto before camera ready, error handled with try/catch, snapshot offered as fast alternative, named constant for snapshot quality

**Key distinctions:**

| Method           | Speed              | Quality             | Requires              |
| ---------------- | ------------------ | ------------------- | --------------------- |
| `takePhoto()`    | Slower (AE/AF/AWB) | Full sensor quality | `photo={true}`        |
| `takeSnapshot()` | ~16ms              | Preview quality     | `video={true}` on iOS |

---

## Pattern 3: Video Recording with Pause/Resume

```typescript
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Camera,
  useCameraDevice,
  useMicrophonePermission,
  type VideoFile,
} from "react-native-vision-camera";

export function VideoRecordingScreen() {
  const camera = useRef<Camera>(null);
  const device = useCameraDevice("back");
  const { hasPermission: hasMicPermission, requestPermission: requestMicPermission } =
    useMicrophonePermission();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const handleStartRecording = useCallback(() => {
    if (!camera.current) return;

    setIsRecording(true);
    camera.current.startRecording({
      onRecordingFinished: (video: VideoFile) => {
        setIsRecording(false);
        setIsPaused(false);
        // video.path - temporary file path
        // video.duration - duration in seconds
        console.log("Recorded:", video.path, `${video.duration}s`);
      },
      onRecordingError: (error) => {
        setIsRecording(false);
        setIsPaused(false);
        // Handle capture/recording-canceled gracefully
        if (error.code === "capture/recording-canceled") {
          console.log("Recording was canceled");
          return;
        }
        console.error("Recording error:", error);
      },
      videoCodec: "h265",
      flash: "off",
    });
  }, []);

  const handleStopRecording = useCallback(async () => {
    await camera.current?.stopRecording();
  }, []);

  const handleTogglePause = useCallback(async () => {
    if (isPaused) {
      await camera.current?.resumeRecording();
    } else {
      await camera.current?.pauseRecording();
    }
    setIsPaused((prev) => !prev);
  }, [isPaused]);

  if (device == null) return null;
  if (!hasMicPermission) {
    return (
      <Pressable onPress={requestMicPermission}>
        <Text>Grant Microphone Permission</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        video={true}
        audio={true}
      />
      {!isRecording ? (
        <Pressable onPress={handleStartRecording}><Text>Record</Text></Pressable>
      ) : (
        <View>
          <Pressable onPress={handleTogglePause}>
            <Text>{isPaused ? "Resume" : "Pause"}</Text>
          </Pressable>
          <Pressable onPress={handleStopRecording}><Text>Stop</Text></Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
```

**Why good:** microphone permission handled separately, recording state tracked, pause/resume supported, cancelRecording error code handled gracefully, h265 codec for better compression

---

## Pattern 4: HDR Format Selection and Location Metadata

```typescript
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useLocationPermission,
} from "react-native-vision-camera";

const TARGET_FPS = 30;

export function HDRCameraScreen() {
  const device = useCameraDevice("back");
  const { hasPermission: hasLocationPermission, requestPermission: requestLocationPermission } =
    useLocationPermission();

  // Format selection with HDR priority
  const format = useCameraFormat(device, [
    { videoHdr: true },
    { photoHdr: true },
    { fps: TARGET_FPS },
  ]);

  if (device == null) return null;

  return (
    <Camera
      device={device}
      isActive={true}
      photo={true}
      video={true}
      format={format}
      videoHdr={format?.supportsVideoHdr}
      photoHdr={format?.supportsPhotoHdr}
      enableLocation={hasLocationPermission}
      fps={TARGET_FPS}
    />
  );
}
```

**Why good:** HDR enabled only when format supports it (prevents crashes), location enabled only with permission, format priorities ordered by importance, named constant for FPS

**Platform manifest requirements for location:**

- **iOS**: Add `NSLocationWhenInUseUsageDescription` to Info.plist
- **Android**: Add `ACCESS_FINE_LOCATION` to AndroidManifest.xml
- **Build flag**: Set `VCEnableLocation = false` in Podfile/Expo config if location is unused (prevents App Store rejection)

---

## Pattern 5: Multi-Camera Device Selection

```typescript
import { useCameraDevice, useCameraDevices } from "react-native-vision-camera";
import { useMemo } from "react";

// Simple: best back camera
const backDevice = useCameraDevice("back");

// Multi-lens: prefer device with ultra-wide + wide + telephoto
const multiLensDevice = useCameraDevice("back", {
  physicalDevices: [
    "ultra-wide-angle-camera",
    "wide-angle-camera",
    "telephoto-camera",
  ],
});

// Custom selection with all devices
function useExternalCamera() {
  const devices = useCameraDevices();
  return useMemo(
    () => devices.find((d) => d.position === "external") ?? null,
    [devices],
  );
}
```

**Physical device types and their zoom levels:**

| Physical Device           | Typical Zoom |
| ------------------------- | ------------ |
| `ultra-wide-angle-camera` | 0.5x         |
| `wide-angle-camera`       | 1x (default) |
| `telephoto-camera`        | 3x           |

**Key:** `device.neutralZoom` gives the recommended starting zoom level for the selected device. On ultra-wide cameras this is NOT 1.0.
