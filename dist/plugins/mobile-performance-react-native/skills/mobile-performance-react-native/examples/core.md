# React Native Performance - Core Optimization Patterns

> Re-render prevention, list optimization, deferred work, and image performance. See [profiling.md](profiling.md) for profiling tools and memory analysis. See [SKILL.md](../SKILL.md) for decision frameworks and red flags.

**Prerequisites**: Understand React rendering model (when components re-render) and React Native's threading model (JS thread vs UI thread).

---

## Pattern 1: Deferred Work with InteractionManager

Defer heavy computation until after animations/transitions finish. This keeps navigation smooth at 60 FPS.

```typescript
import { useEffect, useState } from "react";
import {
  InteractionManager,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from "react-native";

interface DeferredScreenProps {
  userId: string;
}

// Defer data processing until transition completes
export function DeferredScreen({ userId }: DeferredScreenProps) {
  const [data, setData] = useState<ProcessedData | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // runAfterInteractions waits for all animations to complete
    const task = InteractionManager.runAfterInteractions(async () => {
      const raw = await fetchUserData(userId);
      const processed = processData(raw); // Heavy computation
      setData(processed);
      setIsReady(true);
    });

    // CRITICAL: Cancel if component unmounts during transition
    return () => task.cancel();
  }, [userId]);

  if (!isReady) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{data?.title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
  },
});
```

**Why good:** Navigation transition runs at 60 FPS because heavy work is deferred. Cleanup prevents memory leaks if user navigates away before work completes.

---

### Touch Response Optimization with requestAnimationFrame

When `onPress` handlers do heavy work, the touch feedback (opacity change, ripple) is delayed. Wrap expensive work in `requestAnimationFrame` to let the visual feedback render first.

```typescript
import { useCallback } from "react";
import { Pressable, Text } from "react-native";

interface ActionButtonProps {
  onAction: () => void;
  label: string;
}

export function ActionButton({ onAction, label }: ActionButtonProps) {
  const handlePress = useCallback(() => {
    // Let the press animation render first, then do heavy work
    requestAnimationFrame(() => {
      onAction();
    });
  }, [onAction]);

  return (
    <Pressable onPress={handlePress}>
      <Text>{label}</Text>
    </Pressable>
  );
}
```

**Why good:** Touch feedback appears immediately because `requestAnimationFrame` defers the heavy work to the next frame after the UI update.

---

## Pattern 2: Re-Render Optimization

### Memoized List Items

The most impactful optimization: prevent list items from re-rendering when the parent re-renders.

```typescript
import { memo, useCallback, type ReactNode } from "react";
import { View, Text, Pressable, Image, StyleSheet } from "react-native";

const IMAGE_SIZE = 60;

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
}

interface ProductItemProps {
  item: Product;
  onPress: (id: string) => void;
}

// React.memo prevents re-render when props haven't changed
const ProductItem = memo(function ProductItem({
  item,
  onPress,
}: ProductItemProps) {
  // useCallback gives stable reference -- critical for memo to work
  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [item.id, onPress]);

  return (
    <Pressable onPress={handlePress} style={styles.item}>
      <Image
        source={{ uri: item.imageUrl }}
        style={styles.image}
        resizeMode="cover"
      />
      <View style={styles.details}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.price}>${item.price.toFixed(2)}</Text>
      </View>
    </Pressable>
  );
});

export { ProductItem };

const styles = StyleSheet.create({
  item: {
    height: 80,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 8,
    backgroundColor: "#F2F2F7",
  },
  details: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  price: {
    fontSize: 14,
    color: "#007AFF",
    marginTop: 4,
  },
});
```

**Why good:** memo prevents re-rendering when parent state changes but item props are identical. useCallback ensures the onPress reference is stable between parent renders.

---

### Custom Comparison Function

For complex props where shallow comparison is too expensive or too broad:

```typescript
interface ExpensiveItemProps {
  data: ComplexData;
  config: RenderConfig;
  onSelect: (id: string) => void;
}

const ExpensiveItem = memo(
  function ExpensiveItem({ data, config, onSelect }: ExpensiveItemProps) {
    return (
      <View>
        <Text>{data.title}</Text>
      </View>
    );
  },
  // Custom comparator: only re-render when meaningful fields change
  (prevProps, nextProps) => {
    return (
      prevProps.data.id === nextProps.data.id &&
      prevProps.data.updatedAt === nextProps.data.updatedAt &&
      prevProps.config.mode === nextProps.config.mode
    );
  },
);

export { ExpensiveItem };
```

**Why good:** Custom comparator avoids expensive deep comparison while still catching meaningful changes. Only checks fields that affect rendering.

**When to use:** When the default shallow comparison is too broad (re-renders on irrelevant prop changes) or the data object is deeply nested.

---

### Expensive Computation with useMemo

```typescript
import { useMemo } from "react";

interface DataProcessorProps {
  items: Item[];
  filters: Filters;
  sortOrder: "asc" | "desc";
}

export function DataProcessor({ items, filters, sortOrder }: DataProcessorProps) {
  // Only recompute when inputs change
  const processedData = useMemo(() => {
    return items
      .filter((item) => matchesFilters(item, filters))
      .sort((a, b) => {
        const comparison = a.name.localeCompare(b.name);
        return sortOrder === "asc" ? comparison : -comparison;
      });
  }, [items, filters, sortOrder]);

  return <ItemList data={processedData} />;
}

function matchesFilters(item: Item, filters: Filters): boolean {
  if (filters.category && item.category !== filters.category) return false;
  if (filters.minPrice && item.price < filters.minPrice) return false;
  if (filters.maxPrice && item.price > filters.maxPrice) return false;
  return true;
}
```

**Why good:** useMemo prevents re-running filter+sort on every render. The computation only runs when items, filters, or sortOrder actually change.

**When to skip:** If the computation is trivial (single property access, simple boolean check), useMemo adds overhead without benefit. Profile first.

---

## Pattern 3: FlashList Optimization

FlashList v2 uses cell recycling (reuses component instances) for superior performance. Key rules: memoize renderItem, never add `key` props to items, use `getItemType` for heterogeneous lists.

```typescript
import { FlashList } from "@shopify/flash-list";
import { useCallback } from "react";

const ITEM_HEIGHT = 80;

interface ProductListProps {
  products: Product[];
  onProductPress: (id: string) => void;
  onEndReached?: () => void;
}

export function OptimizedFlashList({
  products,
  onProductPress,
  onEndReached,
}: ProductListProps) {
  // Stable renderItem reference
  const renderItem = useCallback(
    ({ item }: { item: Product }) => (
      <ProductItem item={item} onPress={onProductPress} />
    ),
    [onProductPress],
  );

  // getItemType improves recycling -- items of same type share a pool
  const getItemType = useCallback((item: Product) => {
    return item.category;
  }, []);

  return (
    <FlashList
      data={products}
      renderItem={renderItem}
      // FlashList v2: estimatedItemSize is OPTIONAL (auto-measures)
      // Providing it still helps initial render before measurements
      estimatedItemSize={ITEM_HEIGHT}
      getItemType={getItemType}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
    />
  );
}
```

**Why good:** useCallback gives stable renderItem (prevents re-creating the function), getItemType groups items by category for efficient recycling pools, estimatedItemSize helps the initial layout pass.

**Critical FlashList rules:**

- Do NOT add `key` props to rendered items -- breaks cell recycling
- DO memoize the item component with React.memo
- DO use `getItemType` when items have different layouts
- FlashList v2 requires New Architecture -- use v1 or FlatList on legacy

---

## Pattern 4: FlatList Tuning

When using FlatList, tuning props significantly impacts scrolling performance.

```typescript
import { useCallback, useMemo } from "react";
import {
  FlatList,
  Platform,
  type ListRenderItem,
} from "react-native";

// Constants for tuning -- adjust based on profiling
const ITEM_HEIGHT = 80;
const SEPARATOR_HEIGHT = 1;
const WINDOW_SIZE = 5; // Number of viewport heights to render
const MAX_TO_RENDER_PER_BATCH = 10; // Items per render batch
const INITIAL_NUM_TO_RENDER = 10; // Items on first render
const ON_END_REACHED_THRESHOLD = 0.5;

export function TunedFlatList({
  products,
  onProductPress,
  onEndReached,
  isLoadingMore = false,
}: ProductListProps & { isLoadingMore?: boolean }) {
  const renderItem: ListRenderItem<Product> = useCallback(
    ({ item }) => <ProductItem item={item} onPress={onProductPress} />,
    [onProductPress],
  );

  const keyExtractor = useCallback((item: Product) => item.id, []);

  // getItemLayout for fixed-height items -- MAJOR performance win
  // Enables instant scrollToIndex and eliminates measurement overhead
  const getItemLayout = useCallback(
    (_data: Product[] | null | undefined, index: number) => ({
      length: ITEM_HEIGHT + SEPARATOR_HEIGHT,
      offset: (ITEM_HEIGHT + SEPARATOR_HEIGHT) * index,
      index,
    }),
    [],
  );

  // Memoize extraData to prevent unnecessary re-renders
  const extraData = useMemo(
    () => ({ isLoadingMore }),
    [isLoadingMore],
  );

  return (
    <FlatList
      data={products}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      extraData={extraData}
      windowSize={WINDOW_SIZE}
      maxToRenderPerBatch={MAX_TO_RENDER_PER_BATCH}
      initialNumToRender={INITIAL_NUM_TO_RENDER}
      onEndReached={onEndReached}
      onEndReachedThreshold={ON_END_REACHED_THRESHOLD}
      // removeClippedSubviews reclaims memory on Android
      // but can cause blank areas on iOS -- platform-gate it
      removeClippedSubviews={Platform.OS === "android"}
      showsVerticalScrollIndicator={false}
    />
  );
}
```

**Key tuning props explained:**

| Prop                    | Default | Effect                                                                        |
| ----------------------- | ------- | ----------------------------------------------------------------------------- |
| `windowSize`            | 21      | Viewports to keep rendered. Lower = less memory, more blank area. Start at 5. |
| `maxToRenderPerBatch`   | 10      | Items per render cycle. Higher = fewer blanks, more JS thread work.           |
| `initialNumToRender`    | 10      | Items on first render. Match to visible items for fastest initial paint.      |
| `getItemLayout`         | None    | Eliminates measurement for fixed-height items. Massive scrollToIndex speedup. |
| `removeClippedSubviews` | false   | Reclaims memory for off-screen items. Android only -- causes issues on iOS.   |

---

## Pattern 5: Anti-Patterns to Avoid

### Inline Styles in Frequently Rendered Components

```typescript
// BAD: New style object created every render
function BadItem({ color }: { color: string }) {
  return (
    <View style={{ padding: 16, backgroundColor: color }}>
      <Text style={{ fontSize: 16, color: "#000" }}>Item</Text>
    </View>
  );
}

// GOOD: Static styles in StyleSheet, dynamic styles via useMemo or array
const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { fontSize: 16, color: "#000" },
});

function GoodItem({ color }: { color: string }) {
  return (
    <View style={[styles.container, { backgroundColor: color }]}>
      <Text style={styles.text}>Item</Text>
    </View>
  );
}
```

**Why:** StyleSheet.create optimizes styles by sending them to native once. Inline objects are re-created every render and compared by reference.

---

### Unstable extraData and Callbacks

```typescript
// BAD: New array reference every render -- triggers full list re-render
<FlatList
  data={items}
  extraData={[selectedId, sortOrder]}
  renderItem={({ item }) => <Item item={item} />}
/>

// GOOD: Memoized extraData + stable renderItem
const extraData = useMemo(
  () => ({ selectedId, sortOrder }),
  [selectedId, sortOrder],
);

const renderItem = useCallback(
  ({ item }: { item: ItemType }) => <MemoizedItem item={item} />,
  [],
);

<FlatList data={items} extraData={extraData} renderItem={renderItem} />
```

**Why:** FlatList uses referential equality to decide whether to re-render. New array/object references trigger a full re-render of all visible items.

---

## Pattern 6: Native Animation Offloading

Keep animations on the UI thread so they run at 60 FPS even when the JS thread is busy.

```typescript
import { Animated, Easing } from "react-native";

const ANIMATION_DURATION_MS = 300;

// GOOD: useNativeDriver offloads to UI thread
const fadeIn = (animatedValue: Animated.Value) => {
  Animated.timing(animatedValue, {
    toValue: 1,
    duration: ANIMATION_DURATION_MS,
    easing: Easing.inOut(Easing.ease),
    useNativeDriver: true, // Runs on UI thread
  }).start();
};

// GOOD: LayoutAnimation for simple layout transitions
import { LayoutAnimation, UIManager, Platform } from "react-native";

// Enable on Android (enabled by default on iOS)
if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

function toggleExpanded() {
  // Animate the next layout change -- fire-and-forget
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  setExpanded((prev) => !prev);
}
```

**Why good:** `useNativeDriver: true` sends the animation description to native once and the UI thread runs it independently of JS. LayoutAnimation uses Core Animation (iOS) and bypasses both JS and UI thread frame drops.

**Limitation:** `useNativeDriver` only supports non-layout properties (transform, opacity). Width, height, padding, margin animations must run on the JS thread or use LayoutAnimation.

---

## Pattern 7: Image Performance Strategies

### Right-Sizing Images

```typescript
import { Image, PixelRatio, Dimensions } from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
const PIXEL_RATIO = PixelRatio.get();

// Calculate the actual pixel dimensions needed
const THUMBNAIL_DISPLAY_SIZE = 80;
const THUMBNAIL_PIXEL_SIZE = THUMBNAIL_DISPLAY_SIZE * PIXEL_RATIO;

// Request appropriately sized images from your CDN/server
const thumbnailUrl = `${baseUrl}?w=${THUMBNAIL_PIXEL_SIZE}&h=${THUMBNAIL_PIXEL_SIZE}`;

// Full-width hero image
const HERO_PIXEL_WIDTH = SCREEN_WIDTH * PIXEL_RATIO;
const heroUrl = `${baseUrl}?w=${HERO_PIXEL_WIDTH}`;
```

**Why good:** Requesting images at the exact pixel size needed avoids downloading 4K images for 80px thumbnails. Reduces download time, memory usage, and decode time.

### Preloading Critical Images

```typescript
import { Image } from "react-native";

// Preload images that will be needed soon
export function preloadCriticalImages(imageUrls: string[]) {
  imageUrls.forEach((url) => {
    Image.prefetch(url);
  });
}

// Call before navigating to image-heavy screen
function handleNavigateToGallery() {
  preloadCriticalImages(galleryImageUrls.slice(0, 5)); // Preload first 5
  navigation.navigate("Gallery", { images: galleryImageUrls });
}
```

**Why good:** Images start downloading before they're visible, eliminating the delay when the user actually sees them.
