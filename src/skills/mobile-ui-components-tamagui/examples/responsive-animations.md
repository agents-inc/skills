# Tamagui - Responsive Styles and Animations

> Media queries, useMedia hook, animation drivers, and enter/exit animations. See [SKILL.md](../SKILL.md) for decision guidance.

---

## Pattern 1: Responsive Styles with Media Query Props

Media query props use `$`-prefixed breakpoint names. Base styles apply at all sizes (mobile-first), overridden progressively at larger breakpoints.

```tsx
import { XStack, YStack, SizableText } from "tamagui";

function ResponsiveLayout() {
  return (
    <XStack
      flexDirection="column"
      padding="$2"
      gap="$2"
      $gtSm={{ flexDirection: "row", padding: "$4", gap: "$4" }}
      $gtLg={{ padding: "$6", gap: "$6" }}
    >
      <YStack
        flex={1}
        backgroundColor="$background"
        padding="$3"
        borderRadius="$3"
      >
        <SizableText size="$4">Panel A</SizableText>
      </YStack>
      <YStack
        flex={1}
        backgroundColor="$background"
        padding="$3"
        borderRadius="$3"
      >
        <SizableText size="$4">Panel B</SizableText>
      </YStack>
    </XStack>
  );
}
```

**Why good:** mobile-first base styles, `$gtSm` and `$gtLg` override progressively, compiler extracts to CSS @media rules on web (zero JS runtime cost)

---

## Pattern 2: useMedia Hook for Conditional Logic

When you need media state in JavaScript logic (not just styles), use `useMedia`. The compiler extracts this to CSS when all usages are deterministic.

```tsx
import { useMedia, YStack, SizableText } from "tamagui";

function AdaptiveContent() {
  const media = useMedia();

  return (
    <YStack padding="$4">
      <SizableText size={media.sm ? "$3" : "$5"}>
        {media.sm ? "Mobile view" : "Desktop view"}
      </SizableText>

      {/* Conditional rendering based on breakpoint */}
      {!media.sm && (
        <YStack>
          <SizableText>Desktop-only sidebar content</SizableText>
        </YStack>
      )}
    </YStack>
  );
}
```

**Gotcha:** the `useMedia()` return object is a Proxy -- you cannot use `Object.keys()`, `for...in`, or the `in` operator on it. Access keys directly: `media.sm`, `media.gtMd`.

---

## Pattern 3: Animation Driver Configuration

Animation drivers are configured in `createTamagui` and swapped per platform. Component code stays identical.

### CSS Driver (Web -- Smallest Bundle)

```tsx
import { createAnimations } from "@tamagui/animations-css";

const animations = createAnimations({
  bouncy: "ease-in 200ms",
  lazy: "ease-out 600ms",
  quick: "ease-in-out 100ms",
  medium: "ease-in-out 300ms",
});
```

### Reanimated Driver (Native -- Spring Physics)

```tsx
import { createAnimations } from "@tamagui/animations-reanimated";

const BOUNCY_DAMPING = 10;
const BOUNCY_STIFFNESS = 100;
const LAZY_DAMPING = 18;
const LAZY_STIFFNESS = 50;
const QUICK_DAMPING = 20;
const QUICK_STIFFNESS = 250;

const animations = createAnimations({
  bouncy: {
    damping: BOUNCY_DAMPING,
    mass: 0.9,
    stiffness: BOUNCY_STIFFNESS,
  },
  lazy: {
    damping: LAZY_DAMPING,
    stiffness: LAZY_STIFFNESS,
  },
  quick: {
    damping: QUICK_DAMPING,
    mass: 1.2,
    stiffness: QUICK_STIFFNESS,
  },
});
```

### Platform-Specific Driver Selection

```tsx
import { createTamagui } from "tamagui";

export const config = createTamagui({
  // ... tokens, themes, media
  animations, // Use CSS on web, Reanimated on native via separate configs
});
```

**Key points:** define the same animation names across drivers for cross-platform compatibility. CSS driver uses easing strings, Reanimated uses spring physics objects. The `@tamagui/animations-moti` driver is deprecated -- use `@tamagui/animations-reanimated` instead (same API, fewer deps).

---

## Pattern 4: Transition Prop and Animation States

The `transition` prop activates animations on a component. Combine with `enterStyle`, `exitStyle`, `hoverStyle`, `pressStyle`, and `focusStyle` for declarative state-based animations.

### Mount Animation with enterStyle

```tsx
import { YStack, SizableText } from "tamagui";

function FadeInCard() {
  return (
    <YStack
      transition="bouncy"
      enterStyle={{ opacity: 0, scale: 0.95, y: -10 }}
      opacity={1}
      scale={1}
      y={0}
      backgroundColor="$background"
      padding="$4"
      borderRadius="$4"
    >
      <SizableText>Fades and scales in on mount</SizableText>
    </YStack>
  );
}
```

**Why good:** SSR-safe (renders base styles on server, animates on client), declarative mount animation without useEffect

### Interaction Animations

```tsx
function InteractiveCard() {
  return (
    <YStack
      transition="quick"
      hoverStyle={{ scale: 1.02, backgroundColor: "$backgroundHover" }}
      pressStyle={{ scale: 0.98, backgroundColor: "$backgroundPress" }}
      focusStyle={{ borderColor: "$borderColorFocus", borderWidth: 2 }}
      backgroundColor="$background"
      padding="$4"
      borderRadius="$4"
      cursor="pointer"
    >
      <SizableText>Hover and press me</SizableText>
    </YStack>
  );
}
```

### Controlling Which Properties Animate

```tsx
<YStack
  transition="bouncy"
  animateOnly={["transform"]}
  hoverStyle={{ scale: 1.05, backgroundColor: "$backgroundHover" }}
>
  {/* Only scale (transform) animates; backgroundColor changes instantly */}
</YStack>
```

---

## Pattern 5: AnimatePresence for Exit Animations

`AnimatePresence` enables exit animations when components unmount. Wrap conditional content and provide `exitStyle`.

```tsx
import { AnimatePresence } from "tamagui";

function ToastNotification({
  visible,
  message,
}: {
  visible: boolean;
  message: string;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <YStack
          key="toast"
          transition="quick"
          enterStyle={{ opacity: 0, y: -20 }}
          exitStyle={{ opacity: 0, y: -20 }}
          opacity={1}
          y={0}
          backgroundColor="$background"
          padding="$3"
          borderRadius="$3"
        >
          <SizableText>{message}</SizableText>
        </YStack>
      )}
    </AnimatePresence>
  );
}
```

**Key points:** `key` prop is required on animated children inside `AnimatePresence`, `exitStyle` defines the animation target on unmount, the animation reverses the enterStyle path by default.

---

## Pattern 6: Disabling Animations Safely

Never conditionally remove the `transition` prop from JSX. Spring-based drivers allocate expensive hooks when the prop exists in the props object.

```tsx
// GOOD: pass null to disable -- no hook teardown
<YStack transition={isAnimating ? "bouncy" : null}>
  <SizableText>Content</SizableText>
</YStack>

// BAD: conditional prop inclusion causes hook teardown/setup
<YStack {...(isAnimating && { transition: "bouncy" })}>
  <SizableText>Content</SizableText>
</YStack>
```

**Why bad:** conditionally spreading the `transition` prop causes the animation driver hooks to mount/unmount on every toggle, which is expensive and can cause visual glitches. Passing `null` keeps the hook mounted but inactive.

If you need to change the animation name after mount, update the component's `key` prop to force a clean remount.
