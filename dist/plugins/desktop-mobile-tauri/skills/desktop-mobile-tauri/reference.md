# Tauri Mobile Reference

> Quick-lookup tables, CLI commands, prerequisites checklist, and mobile plugin registry. See [SKILL.md](SKILL.md) for decision frameworks and red flags. See [examples/core.md](examples/core.md) for full code examples.

---

## Mobile CLI Commands

| Command                         | Purpose                                          |
| ------------------------------- | ------------------------------------------------ |
| `npx tauri android init`        | Initialize Android project (creates gen/android) |
| `npx tauri ios init`            | Initialize iOS project (creates gen/apple)       |
| `npx tauri android dev`         | Run on Android emulator/device                   |
| `npx tauri ios dev`             | Run on iOS simulator/device                      |
| `npx tauri android dev --open`  | Open Android Studio for native debugging         |
| `npx tauri ios dev --open`      | Open Xcode for native debugging                  |
| `npx tauri ios dev 'iPhone 16'` | Target specific simulator/device                 |
| `npx tauri android build`       | Build release APK/AAB                            |
| `npx tauri ios build`           | Build release IPA                                |
| `npx tauri plugin android init` | Add Android support to a plugin                  |
| `npx tauri plugin ios init`     | Add iOS support to a plugin                      |

---

## Prerequisites Checklist

### iOS (macOS only)

- [ ] Xcode installed (full app, not just Command Line Tools)
- [ ] CocoaPods installed (`brew install cocoapods`)
- [ ] Rust targets added:
  - `rustup target add aarch64-apple-ios`
  - `rustup target add x86_64-apple-ios`
  - `rustup target add aarch64-apple-ios-sim`
- [ ] `npx tauri ios init` run in project

### Android

- [ ] Android Studio installed
- [ ] SDK Platform, Platform-Tools, NDK, Build-Tools installed via SDK Manager
- [ ] `JAVA_HOME` set to Android Studio bundled JDK
- [ ] `ANDROID_HOME` set to Android SDK path
- [ ] `NDK_HOME` set to NDK path within SDK
- [ ] Rust targets added:
  - `rustup target add aarch64-linux-android`
  - `rustup target add armv7-linux-androideabi`
  - `rustup target add i686-linux-android`
  - `rustup target add x86_64-linux-android`
- [ ] `npx tauri android init` run in project

---

## Mobile-Specific Plugin Registry

| Plugin          | Cargo Crate                    | NPM Package                          | Platform    |
| --------------- | ------------------------------ | ------------------------------------ | ----------- |
| Biometric       | `tauri-plugin-biometric`       | `@tauri-apps/plugin-biometric`       | iOS/Android |
| Barcode Scanner | `tauri-plugin-barcode-scanner` | `@tauri-apps/plugin-barcode-scanner` | iOS/Android |
| NFC             | `tauri-plugin-nfc`             | `@tauri-apps/plugin-nfc`             | iOS/Android |
| Haptics         | `tauri-plugin-haptics`         | `@tauri-apps/plugin-haptics`         | iOS/Android |
| Geolocation     | `tauri-plugin-geolocation`     | `@tauri-apps/plugin-geolocation`     | iOS/Android |

### Cross-Platform Plugins (also work on mobile)

| Plugin       | Cargo Crate                 | Mobile Notes                                       |
| ------------ | --------------------------- | -------------------------------------------------- |
| File System  | `tauri-plugin-fs`           | Needs AndroidManifest storage permissions          |
| Dialog       | `tauri-plugin-dialog`       | File selection on both; folder picker desktop-only |
| Store        | `tauri-plugin-store`        | Works unchanged on mobile                          |
| Notification | `tauri-plugin-notification` | Needs runtime permission on iOS                    |
| HTTP         | `tauri-plugin-http`         | Works unchanged, bypasses CORS                     |
| Log          | `tauri-plugin-log`          | Outputs to logcat (Android) / os_log (iOS)         |
| Process      | `tauri-plugin-process`      | Works unchanged on mobile                          |
| OS           | `tauri-plugin-os`           | Returns mobile platform info                       |

### Desktop-Only Plugins (do NOT work on mobile)

| Plugin          | Why Desktop Only                                       |
| --------------- | ------------------------------------------------------ |
| Shell           | Mobile OS sandboxing prevents spawning child processes |
| Autostart       | No concept of "launch on login" on mobile              |
| Global Shortcut | No system-wide keyboard shortcuts on mobile            |
| Window State    | Mobile apps are single-window                          |

---

## Platform Permission Reference

### iOS Info.plist Keys

| Plugin          | Key                                   | Example Value                             |
| --------------- | ------------------------------------- | ----------------------------------------- |
| Biometric       | `NSFaceIDUsageDescription`            | "Authenticate to access secure features"  |
| Barcode Scanner | `NSCameraUsageDescription`            | "Required to scan barcodes and QR codes"  |
| NFC             | `NFCReaderUsageDescription`           | "Required to read NFC tags"               |
| Geolocation     | `NSLocationWhenInUseUsageDescription` | "Required for location-based features"    |
| File System     | (PrivacyInfo.xcprivacy)               | NSPrivacyAccessedAPICategoryFileTimestamp |

### Android Manifest Permissions

| Plugin          | Permission                                  |
| --------------- | ------------------------------------------- |
| Barcode Scanner | `android.permission.CAMERA`                 |
| Geolocation     | `android.permission.ACCESS_FINE_LOCATION`   |
| Geolocation     | `android.permission.ACCESS_COARSE_LOCATION` |
| NFC             | `android.permission.NFC`                    |
| File System     | `android.permission.READ_EXTERNAL_STORAGE`  |
| File System     | `android.permission.WRITE_EXTERNAL_STORAGE` |

---

## Rust Conditional Compilation Quick Reference

| Condition                                        | Use Case                               |
| ------------------------------------------------ | -------------------------------------- |
| `#[cfg(mobile)]`                                 | Any mobile platform (iOS + Android)    |
| `#[cfg(not(mobile))]`                            | Desktop only                           |
| `#[cfg(target_os = "android")]`                  | Android only                           |
| `#[cfg(target_os = "ios")]`                      | iOS only                               |
| `#[cfg(any(target_os = "android", ...))]`        | Explicit multi-platform list           |
| `#[cfg_attr(mobile, tauri::mobile_entry_point)]` | Mobile entry point (required on run()) |

### Cargo.toml Conditional Dependencies

```toml
# Mobile-only
[target.'cfg(any(target_os = "android", target_os = "ios"))'.dependencies]
tauri-plugin-biometric = "2"

# Android-only
[target.'cfg(target_os = "android")'.dependencies]
jni = "0.21"
```

---

## Mobile Debugging Quick Reference

| Platform | Tool                 | Access Method                           |
| -------- | -------------------- | --------------------------------------- |
| iOS      | Safari Web Inspector | Safari > Develop > [device] > localhost |
| iOS      | Xcode Console        | `npx tauri ios dev --open`              |
| Android  | Chrome DevTools      | `chrome://inspect` in Chrome            |
| Android  | Logcat               | `adb logcat \| grep -i tauri`           |
| Both     | tauri-plugin-log     | Structured logging across all platforms |

### Physical Device Requirements

| Platform | Requirement                                          |
| -------- | ---------------------------------------------------- |
| iOS      | Enable Web Inspector in Settings > Safari > Advanced |
| Android  | Enable USB Debugging in Developer Options            |
| Both     | Dev server must be accessible on local network       |
| Both     | Frontend dev server must respect `TAURI_DEV_HOST`    |

---

## See Also

- [Tauri Mobile Development](https://v2.tauri.app/develop/)
- [Tauri Mobile Plugin Development](https://v2.tauri.app/develop/plugins/develop-mobile/)
- [Tauri Plugin Registry](https://v2.tauri.app/plugin/)
- [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)
