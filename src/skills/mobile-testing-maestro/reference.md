# Maestro Quick Reference

> Command reference, CLI commands, workspace config, and decision frameworks. See [SKILL.md](SKILL.md) for red flags and anti-patterns.

---

## Command Reference

### Interaction Commands

| Command              | Purpose                    | Example                     |
| -------------------- | -------------------------- | --------------------------- |
| `tapOn`              | Tap element or coordinates | `- tapOn: id: "btn"`        |
| `doubleTapOn`        | Double-tap element         | `- doubleTapOn: id: "like"` |
| `longPressOn`        | Long press (context menu)  | `- longPressOn: id: "msg"`  |
| `inputText`          | Type into focused field    | `- inputText: "hello"`      |
| `eraseText`          | Delete text (count or all) | `- eraseText: 5`            |
| `pressKey`           | Hardware key press         | `- pressKey: Enter`         |
| `hideKeyboard`       | Dismiss on-screen keyboard | `- hideKeyboard`            |
| `swipe`              | Swipe gesture              | `- swipe: direction: LEFT`  |
| `scroll`             | Scroll in direction        | `- scroll`                  |
| `scrollUntilVisible` | Scroll until element found | See examples                |
| `back`               | System back button         | `- back`                    |
| `pasteText`          | Paste clipboard content    | `- pasteText`               |

### Assertion Commands

| Command                 | Purpose                       | Auto-Retry |
| ----------------------- | ----------------------------- | ---------- |
| `assertVisible`         | Element is on screen          | 7 seconds  |
| `assertNotVisible`      | Element is NOT on screen      | 7 seconds  |
| `assertTrue`            | JavaScript expression is true | No         |
| `assertScreenshot`      | Visual regression match       | No         |
| `assertWithAI`          | AI validates UI state         | No         |
| `assertNoDefectsWithAI` | AI checks for visual defects  | No         |

### Data Commands

| Command             | Purpose                   |
| ------------------- | ------------------------- |
| `inputRandomName`   | Generate random name      |
| `inputRandomEmail`  | Generate random email     |
| `inputRandomNumber` | Generate random number    |
| `inputRandomText`   | Generate random text      |
| `copyTextFrom`      | Extract text from element |
| `setClipboard`      | Set device clipboard      |

### App Lifecycle Commands

| Command         | Purpose                                    |
| --------------- | ------------------------------------------ |
| `launchApp`     | Start app (with permissions/state options) |
| `stopApp`       | Stop app (preserve state)                  |
| `killApp`       | Force stop (optional clearState)           |
| `clearState`    | Reset app to clean install                 |
| `clearKeychain` | Clear iOS keychain data                    |

### Device Commands

| Command              | Purpose                      |
| -------------------- | ---------------------------- |
| `setLocation`        | Set GPS coordinates          |
| `setOrientation`     | Portrait or landscape        |
| `setAirplaneMode`    | Enable/disable airplane mode |
| `toggleAirplaneMode` | Toggle airplane mode         |
| `setPermissions`     | Grant/revoke permissions     |
| `openLink`           | Open URL or deep link        |
| `addMedia`           | Add image/video to gallery   |
| `travel`             | Simulate time passage        |

### Flow Control Commands

| Command                 | Purpose                            |
| ----------------------- | ---------------------------------- |
| `runFlow`               | Execute subflow (file or inline)   |
| `repeat`                | Loop commands (count or condition) |
| `retry`                 | Retry on failure (max 3)           |
| `evalScript`            | Inline JavaScript execution        |
| `runScript`             | External JavaScript file           |
| `waitForAnimationToEnd` | Pause until animations complete    |
| `extendedWaitUntil`     | Custom timeout wait                |

### Recording Commands

| Command          | Purpose             |
| ---------------- | ------------------- |
| `startRecording` | Begin video capture |
| `stopRecording`  | End video capture   |
| `takeScreenshot` | Capture screenshot  |

---

## Selector Priority

| Priority | Selector            | Stability   | Notes                                          |
| -------- | ------------------- | ----------- | ---------------------------------------------- |
| 1        | `id`                | High        | Accessibility identifier, language-independent |
| 2        | `text` + relational | Medium-High | Text with `below`/`childOf` for disambiguation |
| 3        | `text`              | Medium      | Breaks with i18n, copy changes                 |
| 4        | `index`             | Medium      | Position-dependent, breaks if list changes     |
| 5        | `point`             | Low         | Coordinate-based, breaks on different screens  |

---

## CLI Commands

### Test Execution

```bash
# Run single flow
maestro test flow.yaml

# Run all flows in directory
maestro test .maestro/

# Continuous mode (auto-rerun on file save)
maestro test -c flow.yaml

# With environment variables
maestro test -e USER=admin -e PASS=secret flow.yaml

# Filter by tags
maestro test --include-tags=smoke .maestro/
maestro test --exclude-tags=wip,flaky .maestro/

# Sharded execution (parallel)
maestro test --shards 4 .maestro/

# Generate JUnit report
maestro test --format junit --output report.xml .maestro/

# Generate HTML report
maestro test --format html --output report.html .maestro/
```

### Maestro Studio

```bash
# Launch Studio (visual flow editor)
maestro studio
```

### Maestro Cloud

```bash
# Upload and run on Maestro Cloud
maestro cloud --app-file app.apk --flows .maestro/ --project-id PROJECT_ID

# Async execution (returns immediately)
maestro cloud --app-file app.apk --flows .maestro/ --async

# With environment variables
maestro cloud --app-file app.apk --flows .maestro/ -e API_KEY=sk-test
```

### Device Management

```bash
# Start emulator/simulator
maestro start-device --platform android
maestro start-device --platform ios --os-version 17

# Print view hierarchy (debug selectors)
maestro hierarchy
```

### Recording

```bash
# Record flow execution as video
maestro record flow.yaml output.mp4
```

---

## Workspace Configuration (config.yaml)

```yaml
# Root-level workspace configuration
appId: com.example.app

# Test discovery
flows:
  - "*" # Root only (default)
  - "auth/*" # Specific subdirectory
  - "tests/**" # Recursive

# Tag filtering
includeTags:
  - production_ready
excludeTags:
  - wip
  - flaky

# Execution order
executionOrder:
  continueOnFailure: true # Continue suite after flow failure
  flowsOrder: # Explicit execution order
    - setup-flow.yaml
    - login-test.yaml
    - checkout-test.yaml

# Output directory
testOutputDir: ./test-results

# Global hooks
onFlowStart:
  - clearState
onFlowComplete:
  - runScript: scripts/cleanup.js

# Platform-specific (Maestro Cloud)
ios:
  disableAnimations: true
android:
  disableAnimations: true

# Maestro Cloud notifications
notifications:
  slack:
    endpoint: "https://hooks.slack.com/services/..."
  email:
    enabled: true
    recipients:
      - team@example.com
```

---

## Flow File Template

```yaml
appId: com.example.app
tags:
  - smoke
env:
  DEFAULT_USER: "test@example.com"
onFlowStart:
  - clearState
onFlowComplete:
  - runScript: scripts/cleanup.js
---
- launchApp
# Test steps here
```

---

## Decision Framework: Flow Organization

```
Starting a new test suite?
|
+-> How many flows?
|   |-- < 10 -> Single directory (.maestro/)
|   +-- 10+  -> Subdirectories by feature (.maestro/auth/, .maestro/checkout/)
|              Update config.yaml flows: ["**"] for recursive discovery
|
+-> Need different test subsets?
|   |-- YES -> Use tags (smoke, regression, wip) + --include-tags/--exclude-tags
|   +-- NO  -> Run all flows: maestro test .maestro/
|
+-> Need setup/teardown?
|   |-- Same for ALL flows -> onFlowStart/onFlowComplete in config.yaml
|   +-- Different per flow -> runFlow in individual flow files
|
+-> Running in CI?
    |-- Local emulator -> maestro test with --format junit for reports
    +-- Maestro Cloud -> maestro cloud with --project-id and --app-file
```

---

## GitHub Actions Integration

```yaml
# .github/workflows/maestro.yml
name: Maestro E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: mobile-dev-inc/action-maestro-cloud@v1
        with:
          api-key: ${{ secrets.MAESTRO_API_KEY }}
          project-id: ${{ secrets.MAESTRO_PROJECT_ID }}
          app-file: app/build/outputs/apk/debug/app-debug.apk
          env: |
            API_URL=${{ secrets.STAGING_API_URL }}
            TEST_USER=${{ secrets.TEST_USER }}
```
