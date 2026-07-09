# Reanimated - Scroll-Driven Animations

> Scroll-driven animations with useScrollOffset, collapsing headers, parallax. See [SKILL.md](../SKILL.md) for decision guidance.

**Related:** [core.md](core.md) for interpolation patterns.

---

## Pattern 1: Collapsing Header

Track scroll offset and interpolate header height, title opacity, and background.

```typescript
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedRef,
  useScrollOffset,
  useAnimatedStyle,
  interpolate,
  interpolateColor,
  Extrapolation,
} from "react-native-reanimated";

const HEADER_MAX_HEIGHT = 200;
const HEADER_MIN_HEIGHT = 60;
const SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;
const TITLE_FONT_MAX = 28;
const TITLE_FONT_MIN = 18;

export function CollapsibleHeaderScreen() {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);

  const headerStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollOffset.value,
      [0, SCROLL_DISTANCE],
      [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
      Extrapolation.CLAMP
    ),
    backgroundColor: interpolateColor(
      scrollOffset.value,
      [0, SCROLL_DISTANCE],
      ["rgba(0,0,0,0)", "rgba(0,0,0,0.9)"]
    ),
  }));

  const titleStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(
      scrollOffset.value,
      [0, SCROLL_DISTANCE],
      [TITLE_FONT_MAX, TITLE_FONT_MIN],
      Extrapolation.CLAMP
    ),
    opacity: interpolate(
      scrollOffset.value,
      [0, SCROLL_DISTANCE * 0.5, SCROLL_DISTANCE],
      [1, 0.8, 1],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, headerStyle]}>
        <Animated.Text style={[styles.title, titleStyle]}>
          Profile
        </Animated.Text>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: HEADER_MAX_HEIGHT }}
        scrollEventThrottle={16}
      >
        {/* Scroll content */}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});
```

**Why good:** `useScrollOffset` auto-detects scroll direction, `Extrapolation.CLAMP` prevents over/under-shoot, font size and opacity give depth to the collapse

**Key detail:** `scrollEventThrottle={16}` is needed on `ScrollView` for smooth 60fps tracking. Without it, scroll events fire less frequently.

---

## Pattern 2: Parallax Image

Image moves at a slower rate than content, creating depth.

```typescript
import { StyleSheet, Text, View, Dimensions } from "react-native";
import Animated, {
  useAnimatedRef,
  useScrollOffset,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

const IMAGE_HEIGHT = 300;
const PARALLAX_FACTOR = 0.5;  // image moves at half the scroll speed

export function ParallaxScreen() {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollOffset.value,
          [0, IMAGE_HEIGHT],
          [0, IMAGE_HEIGHT * PARALLAX_FACTOR],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollOffset.value,
      [0, IMAGE_HEIGHT * 0.5],
      [0, 0.7],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <Animated.ScrollView ref={scrollRef} scrollEventThrottle={16}>
      <View style={styles.imageContainer}>
        <Animated.Image
          source={{ uri: "https://example.com/hero.jpg" }}
          style={[styles.image, imageStyle]}
        />
        <Animated.View style={[styles.overlay, overlayStyle]} />
      </View>
      <View style={styles.content}>
        <Text>Content below parallax image</Text>
      </View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    height: IMAGE_HEIGHT,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: IMAGE_HEIGHT * 1.5,  // taller than container for parallax room
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
  content: {
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
});
```

**Why good:** `PARALLAX_FACTOR` controls depth effect intensity, image is taller than container for scroll room, overlay fades in as image scrolls away

---

## Pattern 3: Scroll-to-Hide Tab Bar

Tab bar slides down and fades out when scrolling down, reappears when scrolling up.

```typescript
import { StyleSheet, View, Text } from "react-native";
import Animated, {
  useAnimatedRef,
  useScrollOffset,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

const TAB_BAR_HEIGHT = 60;
const SCROLL_THRESHOLD = 10;
const ANIMATION_DURATION = 200;

export function HidingTabBar() {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);
  const prevOffset = useSharedValue(0);
  const tabBarTranslateY = useSharedValue(0);

  // Detect scroll direction and animate tab bar
  const animatedTabStyle = useAnimatedStyle(() => {
    const diff = scrollOffset.value - prevOffset.value;
    prevOffset.value = scrollOffset.value;

    if (diff > SCROLL_THRESHOLD) {
      // Scrolling down: hide
      tabBarTranslateY.value = withTiming(TAB_BAR_HEIGHT, {
        duration: ANIMATION_DURATION,
      });
    } else if (diff < -SCROLL_THRESHOLD) {
      // Scrolling up: show
      tabBarTranslateY.value = withTiming(0, {
        duration: ANIMATION_DURATION,
      });
    }

    return {
      transform: [{ translateY: tabBarTranslateY.value }],
      opacity: interpolate(
        tabBarTranslateY.value,
        [0, TAB_BAR_HEIGHT],
        [1, 0],
        Extrapolation.CLAMP
      ),
    };
  });

  return (
    <View style={styles.container}>
      <Animated.ScrollView ref={scrollRef} scrollEventThrottle={16}>
        {/* content */}
      </Animated.ScrollView>

      <Animated.View style={[styles.tabBar, animatedTabStyle]}>
        <Text>Tab 1</Text>
        <Text>Tab 2</Text>
        <Text>Tab 3</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: TAB_BAR_HEIGHT,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
});
```

**Why good:** threshold prevents jittery show/hide on small scrolls, opacity interpolated from translateY for coordinated animation, previous offset tracked to detect direction
