# Core Patterns

> Matchers, actions, expectations, waitFor, device API, and testID strategy. See also: [synchronization.md](synchronization.md), [ci-artifacts.md](ci-artifacts.md).

---

## Pattern 1: Element Matchers

### by.id -- Preferred Matcher

```typescript
// Match by testID (always preferred)
await element(by.id("login-btn")).tap();
await element(by.id("email-input")).typeText("user@example.com");

// Regex matching
await element(by.id(/^product-item-\d+$/)).tap();
```

### by.text and by.label -- Fallbacks

```typescript
// Match by visible text (fragile -- locale-dependent)
await element(by.text("Sign In")).tap();

// Match by accessibility label
await element(by.label("Close")).tap();

// Case-insensitive regex
await element(by.text(/welcome/i)).tap();
```

### Compound Matchers

```typescript
// AND: must match both
await element(by.id("item").and(by.text("Widget"))).tap();

// Ancestor: find child within specific parent
await element(by.id("price").withAncestor(by.id("product-card"))).tap();

// Descendant: find parent containing specific child
await element(by.id("card").withDescendant(by.id("sale-badge"))).tap();

// Index: when multiple elements match, select by position
await element(by.text("Add")).atIndex(0).tap();
```

### Good vs Bad Matcher Usage

```typescript
// Good: stable, locale-agnostic
await element(by.id("checkout-btn")).tap();
```

**Why good:** testID does not change with locale, text updates, or styling changes. Survives refactors.

```typescript
// Bad: breaks on locale change or text update
await element(by.text("Proceed to Checkout")).tap();
```

**Why bad:** if the button text changes to "Go to Checkout" or the app adds Spanish support, the test breaks.

---

## Pattern 2: Actions

### Tap and Press

```typescript
// Simple tap
await element(by.id("submit-btn")).tap();

// Tap at specific coordinates within element
await element(by.id("map-view")).tap({ x: 150, y: 200 });

// Double tap
await element(by.id("image")).multiTap(2);

const LONG_PRESS_MS = 1500;

// Long press with duration
await element(by.id("item")).longPress({ x: 50, y: 50 }, LONG_PRESS_MS);
```

### Text Input

```typescript
// Type with keyboard simulation (triggers onChangeText)
await element(by.id("email-input")).tap(); // Focus first if needed
await element(by.id("email-input")).typeText("test@example.com");

// Replace text directly (faster, no keyboard events)
await element(by.id("search-input")).replaceText("new search term");

// Clear text
await element(by.id("name-input")).clearText();

// Keyboard actions
await element(by.id("password-input")).tapReturnKey();
await element(by.id("text-field")).tapBackspaceKey();
```

### Scroll and Swipe

```typescript
const SCROLL_DISTANCE = 300;
const SMALL_SCROLL = 100;

// Scroll down by pixels
await element(by.id("scroll-view")).scroll(SCROLL_DISTANCE, "down");

// Scroll to edge
await element(by.id("scroll-view")).scrollTo("bottom");

// Scroll until element found (with waitFor)
await waitFor(element(by.id("footer-item")))
  .toBeVisible()
  .whileElement(by.id("scroll-view"))
  .scroll(SMALL_SCROLL, "down");

// Swipe gestures
await element(by.id("carousel")).swipe("left", "fast");
await element(by.id("dismissible-card")).swipe("right", "slow", 0.75);
```

### Date Picker and Slider

```typescript
// Set date picker value
await element(by.id("date-picker")).setDatePickerDate("2025-06-15", "ISO8601");

// Adjust slider to 75%
const SLIDER_POSITION = 0.75;
await element(by.id("volume-slider")).adjustSliderToPosition(SLIDER_POSITION);
```

### Getting Element Attributes

```typescript
// Read element properties
const attrs = await element(by.id("counter-text")).getAttributes();
// attrs.text -> current text value
// attrs.enabled -> whether element is enabled
// attrs.visible -> whether element is visible
```

---

## Pattern 3: Expectations

### Visibility and Existence

```typescript
// Element is visible on screen (default: 75% visible)
await expect(element(by.id("welcome-banner"))).toBeVisible();

// Custom visibility threshold (at least 50% visible)
const HALF_VISIBLE = 50;
await expect(element(by.id("partial-view"))).toBeVisible(HALF_VISIBLE);

// Element exists in hierarchy but may be offscreen
await expect(element(by.id("hidden-data"))).toExist();

// Element does NOT exist
await expect(element(by.id("deleted-row"))).not.toExist();

// Element is not visible (hidden or offscreen)
await expect(element(by.id("loading-spinner"))).not.toBeVisible();
```

### Text and Value Assertions

```typescript
// Exact text match
await expect(element(by.id("greeting"))).toHaveText("Hello, World");

// Accessibility label
await expect(element(by.id("icon"))).toHaveLabel("Settings");

// Accessibility value
await expect(element(by.id("progress-bar"))).toHaveValue("75%");

// Toggle/switch state
await expect(element(by.id("dark-mode-toggle"))).toHaveToggleValue(true);

// Slider position
const EXPECTED_VOLUME = 0.5;
const SLIDER_TOLERANCE = 0.05;
await expect(element(by.id("volume"))).toHaveSliderPosition(
  EXPECTED_VOLUME,
  SLIDER_TOLERANCE,
);

// Focus state
await expect(element(by.id("search-input"))).toBeFocused();
```

### Good vs Bad Expectation Usage

```typescript
// Good: specific assertion after specific action
await element(by.id("save-btn")).tap();
await expect(element(by.id("success-toast"))).toBeVisible();
await expect(element(by.id("form"))).not.toBeVisible();
```

**Why good:** verifies the expected result of the action (toast appears, form hides).

```typescript
// Bad: vague assertion, no connection to user action
await expect(element(by.id("screen"))).toExist();
```

**Why bad:** `toExist()` passes even if the element is hidden behind another view. Use `toBeVisible()` to verify what the user sees.

---

## Pattern 4: waitFor with Polling

### Basic waitFor

```typescript
const LOAD_TIMEOUT_MS = 10000;

// Wait for element to appear after async operation
await waitFor(element(by.id("dashboard-header")))
  .toBeVisible()
  .withTimeout(LOAD_TIMEOUT_MS);

// Wait for element to disappear
await waitFor(element(by.id("loading-overlay")))
  .not.toBeVisible()
  .withTimeout(LOAD_TIMEOUT_MS);
```

### waitFor with Scroll

```typescript
const SCROLL_STEP = 100;

// Scroll list until element is found
await waitFor(element(by.id("item-99")))
  .toBeVisible()
  .whileElement(by.id("product-list"))
  .scroll(SCROLL_STEP, "down");
```

### Good vs Bad waitFor Usage

```typescript
// Good: waitFor only when auto-sync cannot help
const ANIMATION_TIMEOUT_MS = 3000;

await waitFor(element(by.id("animated-result")))
  .toBeVisible()
  .withTimeout(ANIMATION_TIMEOUT_MS);
```

**Why good:** named timeout constant, used because a custom animation blocks auto-sync.

```typescript
// Bad: using waitFor everywhere "just in case"
await waitFor(element(by.id("static-label")))
  .toBeVisible()
  .withTimeout(5000);
```

**Why bad:** static elements should be visible immediately with auto-sync. Adding waitFor masks real issues and slows tests.

---

## Pattern 5: Device API

### App Lifecycle in Tests

```typescript
describe("Login flow", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it("should log in with valid credentials", async () => {
    await element(by.id("email-input")).typeText("user@example.com");
    await element(by.id("password-input")).typeText("password123");
    await element(by.id("login-btn")).tap();
    await expect(element(by.id("home-screen"))).toBeVisible();
  });
});
```

### Deep Links and Notifications

```typescript
// Launch with deep link
await device.launchApp({
  newInstance: true,
  url: "myapp://product/42",
});
await expect(element(by.id("product-detail"))).toBeVisible();

// Open URL while app is running
await device.openURL({ url: "myapp://settings" });
await expect(element(by.id("settings-screen"))).toBeVisible();
```

### Permissions and Biometrics (iOS)

```typescript
// Launch with pre-granted permissions
await device.launchApp({
  newInstance: true,
  permissions: {
    notifications: "YES",
    camera: "YES",
    location: "inuse",
  },
});

// Biometric authentication
await device.setBiometricEnrollment(true);
await element(by.id("biometric-login-btn")).tap();
await device.matchFace(); // Simulate successful Face ID
await expect(element(by.id("home-screen"))).toBeVisible();

// Failed biometric
await element(by.id("biometric-login-btn")).tap();
await device.unmatchFace();
await expect(element(by.id("biometric-error"))).toBeVisible();
```

### Location Mocking

```typescript
const NYC_LAT = 40.7128;
const NYC_LON = -74.006;

await device.setLocation(NYC_LAT, NYC_LON);
await element(by.id("find-nearby-btn")).tap();
await expect(element(by.id("nyc-results"))).toBeVisible();
```

---

## Pattern 6: testID Strategy

### Naming Convention

Use a consistent, hierarchical naming pattern:

```tsx
// Screen-level prefix with dot-separated hierarchy
<View testID="login-screen">
  <TextInput testID="login-screen.email-input" />
  <TextInput testID="login-screen.password-input" />
  <Pressable testID="login-screen.submit-btn">
    <Text>Log In</Text>
  </Pressable>
  <Pressable testID="login-screen.forgot-password-link">
    <Text>Forgot Password?</Text>
  </Pressable>
</View>
```

### Custom Component Forwarding

```tsx
// MUST forward testID to a native component
interface ListItemProps {
  testID?: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function ListItem({ testID, title, subtitle, onPress }: ListItemProps) {
  return (
    <Pressable testID={testID} onPress={onPress}>
      <Text testID={testID ? `${testID}.title` : undefined}>{title}</Text>
      <Text testID={testID ? `${testID}.subtitle` : undefined}>{subtitle}</Text>
    </Pressable>
  );
}
```

### List Items with Unique IDs

```tsx
// Generate unique testIDs for list items
function ProductList({ products }: { products: Product[] }) {
  const renderItem = useCallback(
    ({ item, index }: { item: Product; index: number }) => (
      <ListItem
        testID={`product-list.item-${index}`}
        title={item.name}
        subtitle={item.price}
        onPress={() => handlePress(item.id)}
      />
    ),
    [handlePress],
  );

  return (
    <FlatList
      testID="product-list"
      data={products}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
    />
  );
}

// In tests:
await element(by.id("product-list.item-0.title")).tap();
await element(by.id("product-list.item-2")).swipe("left");
```

### Good vs Bad testID Patterns

```tsx
// Good: stable, descriptive, hierarchical
<Pressable testID="cart-screen.checkout-btn" onPress={checkout}>
  <Text>Proceed to Checkout</Text>
</Pressable>
```

**Why good:** stable name, describes screen context and element role, survives text changes.

```tsx
// Bad: based on display text, will break on text change
<Pressable testID="proceed-to-checkout" onPress={checkout}>
  <Text>Proceed to Checkout</Text>
</Pressable>
```

**Why bad:** if button text changes to "Go to Payment", the testID becomes misleading and you will likely update it too, breaking tests.

---

## Pattern 7: Complete Test Example

```typescript
const LOGIN_TIMEOUT_MS = 5000;

describe("Authentication", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe("Login", () => {
    it("should show error for invalid credentials", async () => {
      await element(by.id("login-screen.email-input")).typeText(
        "bad@email.com",
      );
      await element(by.id("login-screen.password-input")).typeText("wrong");
      await element(by.id("login-screen.submit-btn")).tap();

      await waitFor(element(by.id("login-screen.error-message")))
        .toBeVisible()
        .withTimeout(LOGIN_TIMEOUT_MS);

      await expect(element(by.id("login-screen.error-message"))).toHaveText(
        "Invalid credentials",
      );
    });

    it("should navigate to home on valid login", async () => {
      await element(by.id("login-screen.email-input")).typeText(
        "user@example.com",
      );
      await element(by.id("login-screen.password-input")).typeText(
        "valid-password",
      );
      await element(by.id("login-screen.submit-btn")).tap();

      await waitFor(element(by.id("home-screen")))
        .toBeVisible()
        .withTimeout(LOGIN_TIMEOUT_MS);

      await expect(element(by.id("home-screen.welcome-text"))).toBeVisible();
    });
  });

  describe("Logout", () => {
    it("should return to login screen", async () => {
      // Assume already logged in via beforeEach or helper
      await element(by.id("settings-tab")).tap();
      await element(by.id("settings-screen.logout-btn")).tap();

      await expect(element(by.id("login-screen"))).toBeVisible();
    });
  });
});
```
