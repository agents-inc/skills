# Maestro - Flow Control and JavaScript

> Subflows, loops, retries, conditions, hooks, and JavaScript expressions. See [SKILL.md](../SKILL.md) for decision guidance. See [core.md](core.md) for basic commands and selectors.

---

## Pattern 1: Reusable Subflows with runFlow

### External Subflow File

```yaml
# flows/checkout-test.yaml
appId: com.example.app
---
- runFlow:
    file: subflows/login.yaml
    env:
      USERNAME: "buyer@example.com"
      PASSWORD: "buyer_pass"
    label: "Log in as buyer"

- tapOn:
    id: "add_to_cart"
- tapOn:
    id: "checkout_button"

- runFlow:
    file: subflows/enter-payment.yaml
    label: "Enter payment details"

- assertVisible:
    id: "order_confirmation"
```

```yaml
# subflows/login.yaml
appId: com.example.app
---
- tapOn:
    id: "email_input"
- inputText: ${USERNAME}
- tapOn:
    id: "password_input"
- inputText: ${PASSWORD}
- tapOn:
    id: "login_button"
- assertVisible:
    id: "home_screen"
```

**Why good:** login defined once, reused everywhere with different credentials via env, label makes test reports readable

### Inline Subflow (No Separate File)

Use for small, flow-specific sequences that are not reused.

```yaml
- runFlow:
    label: "Sort products by price"
    commands:
      - tapOn:
          id: "sort_icon"
      - tapOn: "Price: Low to High"
```

**Why good:** keeps small sequences inline without creating a separate file, label documents the intent

---

## Pattern 2: Conditions with when

### Platform Conditions

```yaml
# Handle different permission dialogs per platform
- runFlow:
    when:
      platform: Android
    commands:
      - tapOn: "While using the app"

- runFlow:
    when:
      platform: iOS
    commands:
      - tapOn: "Allow While Using App"
```

### Visibility Conditions

```yaml
# Dismiss popup only if visible
- runFlow:
    when:
      visible: "Rate this app"
    commands:
      - tapOn: "Not now"

# Skip onboarding if already completed
- runFlow:
    when:
      notVisible:
        id: "home_screen"
    file: subflows/complete-onboarding.yaml
```

### JavaScript Conditions

```yaml
# Conditional based on environment variable
- runFlow:
    when:
      true: ${FEATURE_FLAG === "true"}
    file: subflows/new-feature-test.yaml

# Combined: platform AND visibility
- runFlow:
    when:
      platform: Android
      visible: "Allow Notifications"
    commands:
      - tapOn: "Allow"
```

**Why good:** platform conditions handle iOS/Android differences in one file, visibility conditions handle non-deterministic UI, JavaScript conditions enable feature-flag-driven testing

---

## Pattern 3: Repeat and Retry

### repeat - Fixed Count

```yaml
# Add 3 items to cart
- repeat:
    times: 3
    commands:
      - tapOn:
          id: "add_item"
      - tapOn:
          id: "confirm_add"
```

### repeat - While Condition

```yaml
# Scroll until counter reaches target
- repeat:
    while:
      notVisible:
        id: "end_of_list"
    commands:
      - scroll
```

### retry - Flaky Step Recovery

```yaml
# Retry a flaky network-dependent step (max 3 retries)
- retry:
    maxRetries: 3
    commands:
      - tapOn:
          id: "refresh_button"
      - assertVisible:
          id: "data_loaded"
```

**Why good:** repeat with times for known iteration counts, repeat with while for condition-based loops, retry handles intermittent failures (max 3)

**Gotcha:** `retry` maxRetries is capped at 3. For more complex retry logic, use `runScript` with a loop.

---

## Pattern 4: Hooks - onFlowStart and onFlowComplete

Define in the configuration block. `onFlowStart` runs before each flow, `onFlowComplete` runs after (even on failure).

### Flow-Level Hooks

```yaml
appId: com.example.app
onFlowStart:
  - clearState
  - runFlow:
      file: subflows/login.yaml
      env:
        USERNAME: "test_user@example.com"
        PASSWORD: "test_pass"
onFlowComplete:
  - runFlow: subflows/logout.yaml
  - runScript: scripts/cleanup-test-data.js
---
- tapOn:
    id: "profile_icon"
- assertVisible:
    id: "profile_screen"
```

### Hooks with Dynamic Environment

```yaml
onFlowStart:
  - runFlow:
      file: subflows/login.yaml
      env:
        USERNAME: ${TEST_USER || "default@example.com"}
        ROLE: "admin"
```

**Why good:** clearState ensures clean app state, login runs automatically before every flow, cleanup always runs even on failure

**Hook failure behavior:**

| Scenario               | Result                                                             |
| ---------------------- | ------------------------------------------------------------------ |
| `onFlowStart` fails    | Flow marked FAILED, main body skipped, `onFlowComplete` still runs |
| `onFlowComplete` fails | Flow marked FAILED even if main test passed                        |

**Warning:** Avoid slow operations in hooks -- they run before/after EVERY flow in the suite, multiplying total execution time.

---

## Pattern 5: JavaScript Expressions

### Inline Expressions ($\{\})

Everything inside `${}` is evaluated as JavaScript. Use for simple dynamic values.

```yaml
# Dynamic username with timestamp
- inputText: user_${Date.now()}@test.com

# Platform check
- inputText: ${platform === 'ios' ? 'iOS User' : 'Android User'}
```

### evalScript - Set Variables

Use for logic-only steps that don't interact with UI.

```yaml
# Store a computed value
- evalScript: ${output.sessionId = 'session_' + Date.now()}

# Use the stored value later
- inputText: ${output.sessionId}

# Arithmetic
- evalScript: ${output.total = output.price * output.quantity}
```

**Gotcha:** Template literals (backticks) do not work inside `evalScript` because the command is already wrapped in `${}`. Use string concatenation instead.

### runScript - External JavaScript Files

Use for complex logic: HTTP requests, data generation, multi-step computation.

```yaml
# Run external script
- runScript: scripts/generate-test-data.js

# Run with environment variables
- runScript:
    file: scripts/setup-api.js
    env:
      API_URL: "https://staging.example.com/api"

# Use output from script
- inputText: ${output.generatedEmail}
- inputText: ${output.generatedPassword}
```

```javascript
// scripts/generate-test-data.js
const timestamp = Date.now();
output.generatedEmail = `test_${timestamp}@example.com`;
output.generatedPassword = `Pass_${timestamp}!`;
output.uniqueId = `user_${Math.random().toString(36).substring(2, 10)}`;
```

### HTTP Requests in Scripts

```javascript
// scripts/setup-api.js
const response = http.get(`${API_URL}/health`);

if (response.ok) {
  output.apiStatus = "healthy";
} else {
  output.apiStatus = "unhealthy";
}

// POST request to create test data
const createResponse = http.post(`${API_URL}/users`, {
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: `test_${Date.now()}@example.com`,
    role: "tester",
  }),
});
output.userId = json(createResponse.body).id;
```

**Why good:** scripts handle complex logic outside YAML, HTTP requests enable API setup/teardown within flows, output object passes data between scripts and YAML commands

### The output Object

All scripts and evalScript commands share a single global `output` object. Use namespacing to prevent collisions.

```yaml
- evalScript: ${output.login = {}}
- evalScript: ${output.login.username = 'admin@test.com'}
- evalScript: ${output.login.token = ''}

- runScript: scripts/authenticate.js
# Script sets output.login.token

- inputText: ${output.login.token}
```

---

## Pattern 6: Environment Variables

### Flow-Level Constants (env block)

```yaml
appId: com.example.app
env:
  BASE_URL: "https://staging.example.com"
  DEFAULT_USER: "qa@example.com"
  MAX_RETRIES: "3"
---
- launchApp
- inputText: ${DEFAULT_USER}
```

### CLI Parameters (-e flag)

```bash
maestro test -e USERNAME=admin@test.com -e ENV=production flow.yaml
```

### Shell Variables (MAESTRO\_ prefix)

```bash
export MAESTRO_API_KEY="sk-test-12345"
maestro test flow.yaml
# Access in flow: ${MAESTRO_API_KEY}
```

**Note:** `MAESTRO_` prefixed variables only work via CLI, not in Maestro Studio.

### Default Values with Fallbacks

```yaml
- inputText: ${USERNAME || "guest@example.com"}
- evalScript: ${output.retries = parseInt(MAX_RETRIES || "1")}
```

### Built-in Variables

| Variable              | Description                 |
| --------------------- | --------------------------- |
| `MAESTRO_FILENAME`    | Current flow filename       |
| `MAESTRO_DEVICE_UDID` | Connected device identifier |
| `MAESTRO_SHARD_ID`    | Shard ID (starts at 1)      |
| `MAESTRO_SHARD_INDEX` | Shard index (starts at 0)   |

### Subflow Variable Passing

Variables defined in `env` on `runFlow` are scoped to the subflow. Subflow constants override parent parameters with the same name.

```yaml
- runFlow:
    file: subflows/create-user.yaml
    env:
      ROLE: "admin"
      DEPARTMENT: "engineering"
```
