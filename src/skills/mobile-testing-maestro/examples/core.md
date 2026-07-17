# Maestro - Core Patterns

> Flow structure, selectors, assertions, input, and navigation. See [SKILL.md](../SKILL.md) for decision guidance and red flags.

**Prerequisites:** Maestro CLI installed, emulator/simulator running or physical device connected.

---

## Pattern 1: Flow Structure

Every Maestro flow file has two sections separated by `---`: the configuration block (appId, env, tags, hooks) and the commands block.

```yaml
# flows/login-smoke.yaml
appId: com.example.app
tags:
  - smoke
  - auth
env:
  DEFAULT_TIMEOUT: "10000"
---
- launchApp
- tapOn:
    id: "email_input"
- inputText: "user@example.com"
- tapOn:
    id: "password_input"
- inputText: "secure_pass"
- tapOn:
    id: "login_button"
- assertVisible:
    id: "home_screen"
```

**Why good:** appId identifies the target app, tags enable selective execution with --include-tags, env block defines flow-scoped constants, commands read top-to-bottom like user steps

```yaml
# Bad: no appId, no structure
- tapOn: Login
- inputText: user@example.com
- tapOn: Submit
```

**Why bad:** missing appId causes launch failures, bare text selectors break with copy changes, no tags makes selective execution impossible

---

## Pattern 2: clearState and launchApp

Use `clearState` to reset the app to a clean install state before tests. Use `launchApp` with options to control permissions and app arguments.

```yaml
appId: com.example.app
---
- clearState
- launchApp:
    clearKeychain: true # iOS only - clears stored credentials
    clearState: true # Clears app data (alternative to separate clearState command)
    stopApp: true # Force-stops the app before launching

# Or with permissions
- launchApp:
    permissions:
      notifications: allow
      location: allow
      camera: deny
```

**Why good:** clearState ensures no leftover data from previous runs, clearKeychain handles iOS credential caching, permissions configured declaratively

---

## Pattern 3: Selector Types

### ID Selector (Preferred)

Maps to `accessibilityIdentifier` (iOS) or `resource-id` / `content-description` (Android).

```yaml
# Exact match
- tapOn:
    id: "submit_button"

# Regex match
- tapOn:
    id: ".*submit.*"
```

### Text Selector

Matches visible text or accessibility label. Supports regex.

```yaml
# Exact text
- tapOn:
    text: "Sign In"

# Regex for dynamic text
- assertVisible:
    text: "Welcome, .*"

# Simple string shorthand (uses text matching)
- tapOn: "Sign In"
```

### Index Selector

Select nth matching element when multiple matches exist.

```yaml
# Tap the second "Delete" button on screen
- tapOn:
    text: "Delete"
    index: 1 # 0-based index
```

### Point Selector (Last Resort)

Tap absolute coordinates. Fragile -- breaks on different screen sizes.

```yaml
- tapOn:
    point: "50%,80%" # Percentage-based (more portable)

- tapOn:
    point: "200,450" # Absolute pixels (fragile)
```

### Relational Selectors

Disambiguate elements using spatial relationships.

```yaml
# Tap "Edit" that is below "Profile" section
- tapOn:
    text: "Edit"
    below: "Profile"

# Tap inside a specific parent container
- tapOn:
    text: "Save"
    childOf:
      id: "settings_form"

# Tap element above another
- tapOn:
    text: "Username"
    above:
      id: "password_input"
```

### State Selectors

Filter by element state.

```yaml
# Only tap if enabled
- tapOn:
    id: "submit_button"
    enabled: true

# Assert a checkbox is checked
- assertVisible:
    id: "terms_checkbox"
    checked: true

# Assert element has focus
- assertVisible:
    id: "search_input"
    focused: true
```

### Combined Selectors

Combine multiple selector properties for precision.

```yaml
- tapOn:
    id: "action_button"
    enabled: true
    below: "Order Summary"
```

---

## Pattern 4: Assertions

### assertVisible / assertNotVisible

Maestro auto-retries assertions for up to 7 seconds before failing. No need for explicit waits before assertions.

```yaml
# Assert element is on screen (waits up to 7s)
- assertVisible:
    id: "welcome_message"

# Assert element is NOT on screen
- assertNotVisible:
    id: "loading_spinner"

# Assert with text content
- assertVisible:
    text: "Order confirmed"

# Assert with label for reports
- assertVisible:
    id: "dashboard"
    label: "Verify user lands on dashboard after login"
```

**Why good:** built-in 7-second retry eliminates the need for explicit waits, label improves test report readability

### assertTrue (JavaScript Expressions)

```yaml
- assertTrue: ${output.itemCount > 0}
- assertTrue: ${output.userRole === "admin"}
```

### AI-Powered Assertions

```yaml
# Natural language assertion
- assertWithAI: "The login form has email and password fields"

# Defect detection
- assertNoDefectsWithAI
```

---

## Pattern 5: Text Input and Keyboard

```yaml
# Input text into focused field
- tapOn:
    id: "search_input"
- inputText: "running shoes"

# Erase text (character count)
- eraseText: 5

# Erase all text
- eraseText

# Hide keyboard after input
- hideKeyboard

# Press specific keys
- pressKey: Enter
- pressKey: Backspace
- pressKey: Tab

# Input random data (DataFaker)
- inputRandomName
- inputRandomEmail
- inputRandomNumber
- inputRandomText

# Copy text from element to variable
- copyTextFrom:
    id: "order_number"
- evalScript: ${output.orderNumber = maestro.copiedText}
```

**Why good:** `hideKeyboard` prevents keyboard from obscuring elements below, `inputRandom*` commands generate unique test data without external libraries

---

## Pattern 6: Navigation

```yaml
# System back button
- back

# Open a deep link
- openLink: "myapp://products/123"

# Open a URL (opens in browser or app if registered)
- openLink: "https://example.com/invite/abc"

# Double tap
- doubleTapOn:
    id: "like_button"

# Long press (context menus, drag triggers)
- longPressOn:
    id: "message_bubble"
```

---

## Pattern 7: Optional Actions

Use `optional: true` for elements that may or may not appear (permission dialogs, tooltips, one-time prompts).

```yaml
# Dismiss onboarding tooltip if it appears (no failure if absent)
- tapOn:
    text: "Got it"
    optional: true

# Dismiss cookie consent if shown
- tapOn:
    id: "accept_cookies"
    optional: true
    label: "Dismiss cookie banner if present"
```

**Why good:** optional prevents test failure on non-deterministic UI elements, label documents why the step is optional

**When to use:** One-time prompts, A/B test variants, permission dialogs that only appear on first launch.

**When NOT to use:** Critical assertions that must pass -- never mark assertVisible as optional for required elements.
