# Maestro - Device Interactions

> Swipe, scroll, location, links, permissions, recording, and media. See [SKILL.md](../SKILL.md) for decision guidance. See [core.md](core.md) for basic commands and selectors.

---

## Pattern 1: Swipe Gestures

### Directional Swipe

```yaml
# Swipe left (e.g., dismiss or navigate)
- swipe:
    direction: LEFT

# Swipe up (e.g., refresh or reveal content)
- swipe:
    direction: UP
```

### Coordinate-Based Swipe (Percentages)

Use percentages for cross-device compatibility.

```yaml
# Swipe from right to left (carousel navigation)
- swipe:
    start: "90%,50%"
    end: "10%,50%"
```

### Element-Relative Swipe

```yaml
# Swipe up on a specific element (e.g., dismiss a card)
- swipe:
    from:
      id: "product_card"
    direction: LEFT
```

### Custom Duration

```yaml
# Slow swipe (for drag-and-drop or deliberate gestures)
- swipe:
    direction: LEFT
    duration: 2000

# Fast swipe
- swipe:
    direction: UP
    duration: 200
```

**Why good:** percentage-based coordinates work across screen sizes, element-relative swipe targets specific UI components, duration controls gesture speed for different interaction types

---

## Pattern 2: Scrolling

### Basic Scroll

```yaml
# Scroll down (default)
- scroll

# Scroll in specific direction
- scroll:
    direction: UP
```

### scrollUntilVisible

Automatically scrolls until a target element appears. More reliable than fixed scroll counts.

```yaml
# Scroll down until element appears
- scrollUntilVisible:
    element: "Add to Cart"
    direction: DOWN

# Scroll with id selector
- scrollUntilVisible:
    element:
      id: "footer_section"
    direction: DOWN

# Custom timeout and speed
- scrollUntilVisible:
    element:
      id: "item_50"
    direction: DOWN
    timeout: 30000 # Max 30 seconds
    speed: 60 # 0-100, higher = faster

# Center element in viewport after finding it
- scrollUntilVisible:
    centerElement: true
    element:
      text: "Target Item"
```

**Why good:** scrollUntilVisible is declarative (describe what to find, not how many times to scroll), timeout prevents infinite scrolling, centerElement ensures element is fully visible and interactable

**Gotcha:** `scrollUntilVisible` swipes from center toward the edge. If the element is already above the visible area and direction is DOWN, it will never find it. Match direction to where the element is expected to be.

---

## Pattern 3: Wait for Animations

Use `waitForAnimationToEnd` before assertions on screens with animations, transitions, or loading indicators.

```yaml
# Wait for animation to complete before interacting
- tapOn:
    id: "navigate_to_details"
- waitForAnimationToEnd

# Then assert on the new screen
- assertVisible:
    id: "details_screen"
```

```yaml
# Wait with custom timeout (default varies by platform)
- waitForAnimationToEnd:
    timeout: 5000
```

**Why good:** prevents assertions on partially-rendered screens, handles CSS/native animations, loading indicators, and screen transitions

**When to use:** After navigation transitions, after modal open/close animations, after skeleton screen loading, after pull-to-refresh.

**When NOT to use:** Before simple `assertVisible` calls -- Maestro's built-in 7-second retry handles most timing issues without explicit waits.

---

## Pattern 4: Location and Device Settings

### Set GPS Location

```yaml
# Set device location (latitude, longitude)
- setLocation:
    latitude: "37.7749"
    longitude: "-122.4194"
```

### Orientation

```yaml
# Switch to landscape
- setOrientation: LANDSCAPE

# Switch back to portrait
- setOrientation: PORTRAIT
```

### Airplane Mode

```yaml
# Enable airplane mode (test offline behavior)
- setAirplaneMode:
    enabled: true

# Disable airplane mode
- setAirplaneMode:
    enabled: false

# Toggle (switch current state)
- toggleAirplaneMode
```

### Permissions

```yaml
# Set permissions before launch
- launchApp:
    permissions:
      notifications: allow
      location: allow
      camera: deny
      photos: allow

# Set permissions at runtime
- setPermissions:
    notifications: deny
```

---

## Pattern 5: Deep Links and URLs

```yaml
# Open a deep link
- openLink: "myapp://products/123"

# Open a universal link / app link
- openLink: "https://example.com/products/123"

# Test deep link with dynamic data
- openLink: "myapp://user/${output.userId}/profile"
```

**Why good:** deep links test navigation without manual UI traversal, useful for testing specific screens directly

---

## Pattern 6: Screen Recording

Pair `startRecording` with `stopRecording` to capture video evidence of test execution.

```yaml
appId: com.example.app
---
- launchApp
- startRecording: recordings/checkout-flow

# Test steps...
- tapOn:
    id: "add_to_cart"
- tapOn:
    id: "checkout"
- assertVisible:
    id: "payment_form"

- stopRecording
```

### With Full Options

```yaml
- startRecording:
    path: "recordings/onboarding"
    label: "Capture full onboarding sequence"
    optional: true # Don't fail test if recording engine has issues
# ... test steps ...
- stopRecording
```

**Why good:** video evidence for debugging failures, shareable with non-technical stakeholders, optional flag prevents recording issues from breaking tests

**Warning:** Every `startRecording` MUST have a matching `stopRecording`. Missing the stop command produces corrupted or zero-byte video files.

---

## Pattern 7: Screenshots

```yaml
# Take screenshot with filename
- takeScreenshot: screenshots/login-screen

# Take screenshot as visual regression baseline
- assertScreenshot: screenshots/dashboard-baseline
```

**Why good:** `takeScreenshot` captures state for documentation, `assertScreenshot` enables visual regression testing against saved baselines

---

## Pattern 8: Clipboard and Text Extraction

```yaml
# Set clipboard text
- setClipboard: "paste-this-text"

# Paste from clipboard
- tapOn:
    id: "input_field"
- pasteText

# Copy text FROM an element
- copyTextFrom:
    id: "confirmation_code"
- evalScript: ${output.code = maestro.copiedText}
# Use the copied text elsewhere
- inputText: ${output.code}
```

---

## Pattern 9: App Lifecycle

```yaml
# Kill app (force stop)
- killApp

# Kill and clear data
- killApp:
    clearState: true

# Stop app without clearing data
- stopApp

# Relaunch after kill
- launchApp

# Clear app data without killing
- clearState

# Clear iOS keychain
- clearKeychain

# Add media to device gallery
- addMedia: test-data/profile-photo.jpg
```

**Why good:** `killApp` + `launchApp` tests cold start behavior, `clearState` ensures clean test environment, `addMedia` enables testing image/video pickers with known files

---

## Pattern 10: Time Travel

```yaml
# Simulate 24 hours passing (test expiration, reminders)
- travel:
    forward: "24h"

# Travel forward by specific duration
- travel:
    forward: "30m"
```

**Why good:** tests time-dependent features (token expiry, scheduled notifications, date-based UI) without waiting real time
