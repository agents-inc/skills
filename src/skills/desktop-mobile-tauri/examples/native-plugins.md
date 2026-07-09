# Tauri Mobile - Native Plugin Development

> Writing custom mobile plugins in Swift (iOS) and Kotlin (Android), handling arguments, calling Rust from mobile, and plugin lifecycle. See [core.md](core.md) for plugin registration. See [SKILL.md](../SKILL.md) for decision frameworks.

---

## Plugin Project Structure

A Tauri plugin with mobile support has this structure:

```
tauri-plugin-example/
├── src/
│   ├── lib.rs          # Plugin entry point, shared logic
│   ├── desktop.rs      # Desktop implementation (Rust)
│   ├── mobile.rs       # Mobile implementation (delegates to native)
│   └── commands.rs     # Tauri command definitions
├── android/
│   └── src/main/java/com/plugin/example/
│       └── ExamplePlugin.kt    # Kotlin implementation
├── ios/
│   └── Sources/
│       └── ExamplePlugin.swift # Swift implementation
├── guest-js/
│   └── index.ts        # JavaScript/TypeScript bindings
├── Cargo.toml
└── package.json
```

Initialize mobile support for an existing plugin:

```sh
# Add Android native code scaffold
npx tauri plugin android init

# Add iOS native code scaffold
npx tauri plugin ios init
```

---

## iOS Plugin (Swift)

### Basic Plugin Class

```swift
import Tauri
import UIKit
import WebKit

class ExamplePlugin: Plugin {
    // Called when plugin is loaded
    @objc public override func load(webview: WKWebView) {
        // Plugin initialization -- access config, setup resources
    }

    @objc public func getDeviceInfo(_ invoke: Invoke) throws {
        let device = UIDevice.current
        invoke.resolve([
            "name": device.name,
            "model": device.model,
            "systemVersion": device.systemVersion,
        ])
    }

    @objc public func showNativeAlert(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(AlertArgs.self)

        DispatchQueue.main.async {
            let alert = UIAlertController(
                title: args.title,
                message: args.message,
                preferredStyle: .alert
            )
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
                invoke.resolve(["dismissed": true])
            })

            // Present from the root view controller
            if let rootVC = UIApplication.shared.keyWindow?.rootViewController {
                rootVC.present(alert, animated: true)
            }
        }
    }
}
```

### Argument Classes (Decodable)

```swift
class AlertArgs: Decodable {
    let title: String       // Required -- must be present in invoke payload
    let message: String     // Required
    var timeout: Int?       // Optional -- nullable type
}

// Nested arguments
class UploadArgs: Decodable {
    let filePath: String
    var options: UploadOptions?
}

class UploadOptions: Decodable {
    var compress: Bool?
    var quality: Int?
}
```

**Key point:** Required fields use `let`, optional fields use `var` with nullable type (`?`). Inner objects must also conform to `Decodable`. Field names must match the camelCase keys from the JavaScript invoke payload.

### iOS Permission Handling

```swift
import Photos

class ExamplePlugin: Plugin {
    @objc override func checkPermissions(_ invoke: Invoke) {
        let status = PHPhotoLibrary.authorizationStatus()
        let permission: String
        switch status {
        case .authorized, .limited: permission = "granted"
        case .denied, .restricted: permission = "denied"
        case .notDetermined: permission = "prompt"
        @unknown default: permission = "prompt"
        }
        invoke.resolve(["photos": permission])
    }

    @objc public override func requestPermissions(_ invoke: Invoke) {
        PHPhotoLibrary.requestAuthorization { status in
            let permission = status == .authorized ? "granted" : "denied"
            invoke.resolve(["photos": permission])
        }
    }
}
```

**Key point:** Override `checkPermissions` and `requestPermissions` to integrate with Tauri's permission system. These are auto-generated as plugin commands that JavaScript can call.

### Emitting Events from iOS

```swift
class ExamplePlugin: Plugin {
    @objc public func startMonitoring(_ invoke: Invoke) throws {
        // Emit events to JavaScript at any time
        trigger("status-changed", data: [
            "status": "active",
            "timestamp": Date().timeIntervalSince1970,
        ])
        invoke.resolve()
    }
}
```

```typescript
// JavaScript listener
import { addPluginListener } from "@tauri-apps/api/core";

const unlisten = await addPluginListener(
  "plugin:example",
  "status-changed",
  (event) => {
    console.log("Status:", event.status);
  },
);
```

---

## Android Plugin (Kotlin)

### Basic Plugin Class

```kotlin
import android.app.Activity
import android.webkit.WebView
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@TauriPlugin
class ExamplePlugin(private val activity: Activity) : Plugin(activity) {

    override fun load(webView: WebView) {
        // Plugin initialization
    }

    @Command
    fun getDeviceInfo(invoke: Invoke) {
        val ret = JSObject()
        ret.put("manufacturer", android.os.Build.MANUFACTURER)
        ret.put("model", android.os.Build.MODEL)
        ret.put("version", android.os.Build.VERSION.SDK_INT)
        invoke.resolve(ret)
    }

    @Command
    fun showNativeToast(invoke: Invoke) {
        val args = invoke.parseArgs(ToastArgs::class.java)
        activity.runOnUiThread {
            android.widget.Toast.makeText(activity, args.message, android.widget.Toast.LENGTH_SHORT).show()
        }
        invoke.resolve()
    }
}
```

### Argument Classes (@InvokeArg)

```kotlin
import app.tauri.annotation.InvokeArg

@InvokeArg
internal class ToastArgs {
    lateinit var message: String    // Required -- lateinit crashes if missing
    var duration: Int = 0           // Optional with default
}

// Nested arguments
@InvokeArg
internal class UploadArgs {
    lateinit var filePath: String
    var options: UploadOptions? = null
}

@InvokeArg
internal class UploadOptions {
    var compress: Boolean = false
    var quality: Int = 100
}
```

**Key point:** `lateinit var` for required fields (throws if missing). Regular `var` with default for optional fields. Inner classes also need `@InvokeArg`. Field names must match camelCase keys from the JavaScript invoke payload.

### Async Commands (Background Thread)

```kotlin
import kotlinx.coroutines.*

@TauriPlugin
class ExamplePlugin(private val activity: Activity) : Plugin(activity) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    @Command
    fun fetchData(invoke: Invoke) {
        // IMPORTANT: Long-running operations must NOT run on main thread
        scope.launch {
            try {
                val result = performNetworkRequest()
                val ret = JSObject()
                ret.put("data", result)
                invoke.resolve(ret)
            } catch (e: Exception) {
                invoke.reject(e.message ?: "Unknown error")
            }
        }
    }

    override fun onDestroy() {
        scope.cancel() // Clean up coroutines
    }
}
```

**Key point:** Android `@Command` methods run on the main thread by default. Network calls, file I/O, and heavy computation MUST be dispatched to a background thread or coroutine scope. Blocking the main thread causes an ANR (Application Not Responding) dialog.

### Android Permission Handling

```kotlin
import android.Manifest
import app.tauri.annotation.Permission
import app.tauri.annotation.TauriPlugin

@TauriPlugin(
    permissions = [
        Permission(
            strings = [Manifest.permission.CAMERA],
            alias = "camera"
        ),
        Permission(
            strings = [
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            ],
            alias = "location"
        )
    ]
)
class ExamplePlugin(private val activity: Activity) : Plugin(activity) {
    // checkPermissions and requestPermissions are auto-generated
}
```

**Key point:** Declare permissions in the `@TauriPlugin` annotation with string aliases. Tauri auto-generates `checkPermissions` and `requestPermissions` commands. The aliases are used in the JavaScript permission API.

### Android Lifecycle Events

```kotlin
@TauriPlugin
class ExamplePlugin(private val activity: Activity) : Plugin(activity) {

    override fun load(webView: WebView) {
        // Called when plugin initializes
    }

    override fun onNewIntent(intent: android.content.Intent) {
        // Called when activity is re-launched (deep links, notifications)
        val data = intent.data?.toString()
        if (data != null) {
            trigger("deep-link", JSObject().put("url", data))
        }
    }

    override fun onResume() {
        // Activity resumed (returned from background)
    }

    override fun onPause() {
        // Activity going to background
    }

    override fun onDestroy() {
        // Clean up resources
    }
}
```

### Emitting Events from Android

```kotlin
@TauriPlugin
class ExamplePlugin(private val activity: Activity) : Plugin(activity) {

    @Command
    fun startMonitoring(invoke: Invoke) {
        val payload = JSObject()
        payload.put("status", "active")
        trigger("status-changed", payload)
        invoke.resolve()
    }
}
```

---

## Calling Rust from Mobile (Advanced)

### From Android (JNI)

Load the compiled Rust library and call functions via JNI:

```kotlin
@TauriPlugin
class ExamplePlugin(private val activity: Activity) : Plugin(activity) {
    companion object {
        init {
            System.loadLibrary("app_lib")
        }
    }

    // Declare external Rust function
    private external fun processData(input: String): String?

    @Command
    fun process(invoke: Invoke) {
        val args = invoke.parseArgs(ProcessArgs::class.java)
        val result = processData(args.input) ?: "error"
        val ret = JSObject()
        ret.put("result", result)
        invoke.resolve(ret)
    }
}
```

```rust
// src-tauri/src/lib.rs (or separate module)
use jni::JNIEnv;
use jni::objects::{JClass, JString};
use jni::sys::jstring;

#[no_mangle]
pub extern "system" fn Java_com_plugin_example_ExamplePlugin_processData(
    mut env: JNIEnv,
    _class: JClass,
    input: JString,
) -> jstring {
    let input: String = env.get_string(&input).unwrap().into();
    let result = format!("Processed: {input}");
    env.new_string(result).unwrap().into_raw()
}
```

```toml
# Cargo.toml -- JNI dependency only on Android
[target.'cfg(target_os = "android")'.dependencies]
jni = "0.21"
```

**Key point:** JNI function names follow the pattern `Java_{package}_{class}_{method}` with dots replaced by underscores. The function must be `#[no_mangle]` and `extern "system"`. This is advanced usage -- most plugins work fine with the standard invoke/resolve pattern.

### From iOS (FFI)

Call Rust functions from Swift using C-compatible FFI:

```swift
class ExamplePlugin: Plugin {
    // Declare the Rust function
    @_silgen_name("process_data_ffi")
    private static func processDataFFI(_ input: UnsafePointer<CChar>) -> UnsafeMutablePointer<CChar>?

    @objc public func process(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(ProcessArgs.self)
        let resultPtr = args.input.withCString { ExamplePlugin.processDataFFI($0) }
        guard let ptr = resultPtr else {
            invoke.reject("Processing failed")
            return
        }
        let result = String(cString: ptr)
        // Free the Rust-allocated string
        free_rust_string(ptr)
        invoke.resolve(["result": result])
    }
}
```

```rust
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

#[no_mangle]
pub unsafe extern "C" fn process_data_ffi(input: *const c_char) -> *mut c_char {
    let input = CStr::from_ptr(input).to_str().unwrap();
    let result = format!("Processed: {input}");
    CString::new(result).unwrap().into_raw()
}

#[no_mangle]
pub unsafe extern "C" fn free_rust_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        drop(CString::from_raw(ptr));
    }
}
```

**Key point:** Unlike JNI, iOS FFI uses standard C calling conventions. You must manually manage memory -- provide a `free_rust_string` function for strings allocated by Rust. `@_silgen_name` maps the Swift function to the Rust symbol name.

---

## Invoking Mobile Commands from Rust

The `PluginHandle::run_mobile_plugin` API calls Swift/Kotlin code from Rust:

```rust
use serde::{Deserialize, Serialize};
use tauri::Runtime;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraRequest {
    quality: usize,
    allow_edit: bool,
}

#[derive(Deserialize)]
pub struct Photo {
    path: String,
}

pub struct ExamplePlugin<R: Runtime>(tauri::plugin::PluginHandle<R>);

impl<R: Runtime> ExamplePlugin<R> {
    pub fn open_camera(&self, payload: CameraRequest) -> crate::Result<Photo> {
        self.0
            .run_mobile_plugin("openCamera", payload)
            .map_err(Into::into)
    }
}
```

**Key point:** `run_mobile_plugin` serializes the payload to JSON, passes it to the native mobile function, and deserializes the response. The command name (`"openCamera"`) must match the method name in Swift (`func openCamera`) or Kotlin (`fun openCamera`).

---

See [core.md](core.md) for project setup and [plugins.md](plugins.md) for official mobile plugin usage.
