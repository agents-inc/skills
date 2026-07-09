# Detox Quick Reference

> Decision frameworks, matcher/action/expectation tables, and checklists. See [SKILL.md](SKILL.md) for patterns and red flags.

---

## Matcher Reference

| Matcher               | Matches By                                                | React Native Prop     | Notes                                                                   |
| --------------------- | --------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------- |
| `by.id(id)`           | Accessibility identifier                                  | `testID`              | **Preferred.** Supports regex.                                          |
| `by.text(text)`       | Displayed text content                                    | Text children         | Supports regex. Fragile across locales.                                 |
| `by.label(label)`     | Accessibility label (iOS) / content description (Android) | `accessibilityLabel`  | Supports regex.                                                         |
| `by.type(className)`  | Native class name                                         | N/A                   | Platform-specific (`RCTImageView` vs `android.widget.ImageView`).       |
| `by.traits([traits])` | Accessibility traits                                      | `accessibilityTraits` | **iOS only.** Values: `"button"`, `"link"`, `"header"`, `"image"`, etc. |

### Compound Matchers

| Method                     | Purpose                    | Example                                          |
| -------------------------- | -------------------------- | ------------------------------------------------ |
| `.and(matcher)`            | Combine matchers           | `by.id("x").and(by.text("y"))`                   |
| `.withAncestor(matcher)`   | Match with parent          | `by.id("child").withAncestor(by.id("parent"))`   |
| `.withDescendant(matcher)` | Match with child           | `by.id("parent").withDescendant(by.id("child"))` |
| `.atIndex(n)`              | Select nth match (0-based) | `by.text("Item").atIndex(2)`                     |

### Regex Support

`by.id()`, `by.text()`, and `by.label()` accept regex:

```typescript
element(by.id(/^item-\d+$/));
element(by.text(/welcome/i)); // case-insensitive
```

---

## Action Reference

| Action                   | Signature                                              | Notes                                                   |
| ------------------------ | ------------------------------------------------------ | ------------------------------------------------------- |
| `tap`                    | `.tap(point?)`                                         | `point`: `{x, y}` optional                              |
| `multiTap`               | `.multiTap(times)`                                     | Single gesture with N taps                              |
| `longPress`              | `.longPress(point?, duration?)`                        | Duration in ms                                          |
| `typeText`               | `.typeText(text)`                                      | Uses system keyboard. Element must be focused.          |
| `replaceText`            | `.replaceText(text)`                                   | Direct replacement, no keyboard simulation              |
| `clearText`              | `.clearText()`                                         | Clears all text                                         |
| `tapReturnKey`           | `.tapReturnKey()`                                      | Tap keyboard return/enter                               |
| `tapBackspaceKey`        | `.tapBackspaceKey()`                                   | Tap keyboard backspace                                  |
| `scroll`                 | `.scroll(offset, direction, startX?, startY?)`         | Direction: `"up"/"down"/"left"/"right"`                 |
| `scrollTo`               | `.scrollTo(edge, startX?, startY?)`                    | Edge: `"top"/"bottom"/"left"/"right"`                   |
| `swipe`                  | `.swipe(direction, speed?, offset?, startX?, startY?)` | Speed: `"fast"/"slow"`                                  |
| `pinch`                  | `.pinch(scale, speed?, angle?)`                        | **iOS only.** Scale > 1 = zoom in                       |
| `setDatePickerDate`      | `.setDatePickerDate(dateStr, format)`                  | Format: `"ISO8601"` or custom                           |
| `adjustSliderToPosition` | `.adjustSliderToPosition(pos)`                         | `pos`: 0.0 to 1.0                                       |
| `getAttributes`          | `.getAttributes()`                                     | Returns element properties (text, label, enabled, etc.) |
| `takeScreenshot`         | `.takeScreenshot(name)`                                | Captures element screenshot                             |

---

## Expectation Reference

| Expectation            | Signature                                | Notes                              |
| ---------------------- | ---------------------------------------- | ---------------------------------- |
| `toBeVisible`          | `.toBeVisible(pct?)`                     | Default: 75% visible. `pct`: 1-100 |
| `toExist`              | `.toExist()`                             | In hierarchy, may not be visible   |
| `toBeFocused`          | `.toBeFocused()`                         | Element has input focus            |
| `toHaveText`           | `.toHaveText(text)`                      | Exact text match                   |
| `toHaveLabel`          | `.toHaveLabel(label)`                    | Accessibility label match          |
| `toHaveId`             | `.toHaveId(id)`                          | Accessibility identifier match     |
| `toHaveValue`          | `.toHaveValue(value)`                    | Accessibility value match          |
| `toHaveSliderPosition` | `.toHaveSliderPosition(pos, tolerance?)` | `pos`: 0.0 to 1.0                  |
| `toHaveToggleValue`    | `.toHaveToggleValue(bool)`               | Switch/checkbox state              |

### Modifiers

| Modifier           | Purpose                                                |
| ------------------ | ------------------------------------------------------ |
| `.not`             | Negate any expectation: `expect(el).not.toBeVisible()` |
| `.withTimeout(ms)` | Wait up to `ms` before failing (on expectations)       |

---

## Device API Reference

### App Lifecycle

| Method                           | Purpose                        | Notes                           |
| -------------------------------- | ------------------------------ | ------------------------------- |
| `device.launchApp(params)`       | Launch or relaunch app         | See params below                |
| `device.terminateApp(bundleId?)` | Stop the app                   | Uses current app if no bundleId |
| `device.reloadReactNative()`     | Reload JS bundle               | Fast; does NOT clear storage    |
| `device.installApp(path?)`       | Install app binary             |                                 |
| `device.uninstallApp(bundleId?)` | Remove app                     |                                 |
| `device.selectApp(name)`         | Switch between configured apps |                                 |

### launchApp Parameters

| Parameter           | Type    | Purpose                           |
| ------------------- | ------- | --------------------------------- |
| `newInstance`       | boolean | Terminate and relaunch            |
| `delete`            | boolean | Uninstall/reinstall (clean state) |
| `url`               | string  | Deep link launch                  |
| `launchArgs`        | object  | Custom launch arguments           |
| `permissions`       | object  | Runtime permissions (iOS)         |
| `languageAndLocale` | object  | Set language/locale (iOS)         |
| `resetAppState`     | boolean | Clear app data before launch      |

### Device Control

| Method                          | Purpose                        | Platform |
| ------------------------------- | ------------------------------ | -------- |
| `device.sendToHome()`           | Background app                 | Both     |
| `device.openURL({url})`         | Open URL in app                | Both     |
| `device.setLocation(lat, lon)`  | Mock GPS                       | Both     |
| `device.setOrientation(orient)` | Portrait/landscape             | Both     |
| `device.shake()`                | Simulate shake                 | iOS      |
| `device.pressBack()`            | Back button                    | Android  |
| `device.takeScreenshot(name?)`  | Capture screenshot             | Both     |
| `device.getPlatform()`          | Returns `"ios"` or `"android"` | Both     |

### Synchronization Control

| Method                              | Purpose                           |
| ----------------------------------- | --------------------------------- |
| `device.disableSynchronization()`   | Stop auto-sync (global)           |
| `device.enableSynchronization()`    | Resume auto-sync                  |
| `device.setURLBlacklist([regexes])` | Exclude URLs from sync monitoring |

### Biometrics (iOS)

| Method                                | Purpose                           |
| ------------------------------------- | --------------------------------- |
| `device.setBiometricEnrollment(bool)` | Enable/disable Face ID / Touch ID |
| `device.matchFace()`                  | Simulate successful Face ID       |
| `device.unmatchFace()`                | Simulate failed Face ID           |
| `device.matchFinger()`                | Simulate successful Touch ID      |
| `device.unmatchFinger()`              | Simulate failed Touch ID          |

---

## testID Naming Conventions

| Convention            | Example                      | Notes                   |
| --------------------- | ---------------------------- | ----------------------- |
| Screen prefix         | `login-screen.email-input`   | Dot-separated hierarchy |
| Action suffix         | `submit-btn`, `search-input` | Describes element role  |
| List items with index | `product-item.${index}`      | Unique per item         |
| Child elements        | `${parentTestID}.title`      | Derived from parent     |

**Rules:**

- Use kebab-case or dot-separated hierarchy consistently
- Never include display text in testID names
- Keep testIDs stable across refactors

---

## CLI Commands

```bash
# Build app for testing
detox build --configuration ios.sim.debug

# Run all tests
detox test --configuration ios.sim.debug

# Run specific test file
detox test --configuration ios.sim.debug e2e/login.test.ts

# Run with artifacts on failure
detox test --configuration ios.sim.debug \
  --record-videos failing \
  --take-screenshots failing \
  --record-logs failing

# Debug synchronization (logs every 5s what blocks idle)
detox test --configuration ios.sim.debug --debug-synchronization 5000

# Headless mode (CI)
detox test --configuration ios.sim.debug --headless
```

---

## New Test File Checklist

- [ ] Import `by`, `device`, `element`, `expect`, `waitFor` from `detox`
- [ ] `beforeAll` / `beforeEach` calls `device.launchApp()` or `device.reloadReactNative()`
- [ ] Every interactive element has a `testID` prop forwarded to a native component
- [ ] Primary matchers use `by.id()` not `by.text()`
- [ ] Timeout constants are named (e.g., `NAVIGATION_TIMEOUT_MS`)
- [ ] No `sleep()` or manual delay calls
- [ ] Every `waitFor` has a `.withTimeout()`
- [ ] `afterAll` cleans up (terminates app if needed)
