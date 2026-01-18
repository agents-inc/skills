# Performance Optimization Patterns

FlashList/FlatList optimization, memoization, image handling, and profiling.

---

## FlashList (Recommended for New Architecture)

FlashList v2 provides superior performance through cell recycling instead of virtualization. **FlashList v2 is New Architecture only.** Key improvements: no more estimatedItemSize required, up to 50% reduced blank area, built-in masonry layout support, and automatic item resizing.

```typescript
import { FlashList } from "@shopify/flash-list";
import { memo, useCallback } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

// Constants
const ITEM_HEIGHT = 80;

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface ProductItemProps {
  item: Product;
  onPress: (id: string) => void;
}

// Memoized item component - CRITICAL: Do NOT add key prop (breaks recycling)
const ProductItem = memo(function ProductItem({ item, onPress }: ProductItemProps) {
  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [item.id, onPress]);

  return (
    <Pressable onPress={handlePress} style={styles.item}>
      <View style={styles.details}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.price}>${item.price.toFixed(2)}</Text>
      </View>
    </Pressable>
  );
});

// Main list component with FlashList
interface ProductListProps {
  products: Product[];
  onProductPress: (id: string) => void;
  onEndReached?: () => void;
}

export function ProductListFlash({
  products,
  onProductPress,
  onEndReached,
}: ProductListProps) {
  // Stable renderItem with useCallback
  const renderItem = useCallback(
    ({ item }: { item: Product }) => (
      <ProductItem item={item} onPress={onProductPress} />
    ),
    [onProductPress]
  );

  // Use getItemType for different item types (improves recycling)
  const getItemType = useCallback((item: Product) => {
    return item.category; // Items of same category share recycling pool
  }, []);

  return (
    <FlashList
      data={products}
      renderItem={renderItem}
      // FlashList v2: estimatedItemSize is OPTIONAL (auto-calculates from actual measurements)
      // FlashList v1: estimatedItemSize is REQUIRED for performance
      // Providing it in v2 can still help with initial render
      estimatedItemSize={ITEM_HEIGHT}
      // Use getItemType for heterogeneous lists
      getItemType={getItemType}
      // Performance optimizations
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  item: {
    height: ITEM_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },
  details: {
    flex: 1,
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

**Why FlashList v2 is better:**
- Cell recycling instead of virtualization (reuses component instances)
- Up to 50% less blank area while scrolling (v2 on New Architecture)
- Maintains 60 FPS even with complex items
- Automatic item sizing in v2 (no estimatedItemSize required - measures real items)
- Built-in masonry layout support via `overrideItemLayout` prop
- `maintainVisibleContentPosition` enabled by default (no layout jumps)
- Items can be dynamically resized without issues

---

## Optimized FlatList

```typescript
import { memo, useCallback, useMemo } from "react";
import {
  FlatList,
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Platform,
  type ListRenderItem,
} from "react-native";

// Constants
const ITEM_HEIGHT = 80;
const SEPARATOR_HEIGHT = 1;
const WINDOW_SIZE = 5;
const MAX_TO_RENDER_PER_BATCH = 10;
const INITIAL_NUM_TO_RENDER = 10;
const ON_END_REACHED_THRESHOLD = 0.5;

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

// Memoized item component - CRITICAL for performance
const ProductItem = memo(function ProductItem({ item, onPress }: ProductItemProps) {
  // Memoize press handler to maintain stable reference
  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [item.id, onPress]);

  return (
    <Pressable onPress={handlePress} style={styles.item}>
      <Image
        source={{ uri: item.imageUrl }}
        style={styles.image}
        // Use resize mode for better memory
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

// Separator component
const ItemSeparator = memo(function ItemSeparator() {
  return <View style={styles.separator} />;
});

// Main list component
interface ProductListProps {
  products: Product[];
  onProductPress: (id: string) => void;
  onEndReached?: () => void;
  isLoadingMore?: boolean;
}

export function ProductList({
  products,
  onProductPress,
  onEndReached,
  isLoadingMore = false,
}: ProductListProps) {
  // Stable renderItem with useCallback
  const renderItem: ListRenderItem<Product> = useCallback(
    ({ item }) => <ProductItem item={item} onPress={onProductPress} />,
    [onProductPress]
  );

  // Stable keyExtractor
  const keyExtractor = useCallback((item: Product) => item.id, []);

  // getItemLayout for fixed-height items (MAJOR performance win)
  const getItemLayout = useCallback(
    (_data: Product[] | null | undefined, index: number) => ({
      length: ITEM_HEIGHT + SEPARATOR_HEIGHT,
      offset: (ITEM_HEIGHT + SEPARATOR_HEIGHT) * index,
      index,
    }),
    []
  );

  // Footer component for loading indicator
  const ListFooter = useMemo(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  }, [isLoadingMore]);

  return (
    <FlatList
      data={products}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      ItemSeparatorComponent={ItemSeparator}
      ListFooterComponent={ListFooter}
      // Performance optimizations
      windowSize={WINDOW_SIZE}
      maxToRenderPerBatch={MAX_TO_RENDER_PER_BATCH}
      initialNumToRender={INITIAL_NUM_TO_RENDER}
      removeClippedSubviews={Platform.OS === "android"} // Memory optimization on Android
      // Scroll behavior
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={ON_END_REACHED_THRESHOLD}
      // Prevent re-renders from extraData
      // Only pass extraData if you need list to update on external state change
    />
  );
}

const styles = StyleSheet.create({
  item: {
    height: ITEM_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },
  image: {
    width: 60,
    height: 60,
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
  separator: {
    height: SEPARATOR_HEIGHT,
    backgroundColor: "#E5E5EA",
    marginLeft: 88, // Align with text
  },
  footer: {
    paddingVertical: 20,
    alignItems: "center",
  },
});
```

---

## Memoization Patterns

```typescript
import { memo, useMemo, useCallback, useRef } from "react";

// 1. React.memo for components
interface UserCardProps {
  user: User;
  onPress: (id: string) => void;
}

// Only re-renders when user or onPress changes
const UserCard = memo(function UserCard({ user, onPress }: UserCardProps) {
  const handlePress = useCallback(() => {
    onPress(user.id);
  }, [user.id, onPress]);

  return (
    <Pressable onPress={handlePress}>
      <Text>{user.name}</Text>
    </Pressable>
  );
});

// 2. Custom comparison function for complex props
const ExpensiveComponent = memo(
  function ExpensiveComponent({ data, config }: Props) {
    return <View>{/* ... */}</View>;
  },
  (prevProps, nextProps) => {
    // Custom comparison - return true if props are equal
    return (
      prevProps.data.id === nextProps.data.id &&
      prevProps.config.mode === nextProps.config.mode
    );
  }
);

// 3. useMemo for expensive computations
function DataProcessor({ items, filters }: { items: Item[]; filters: Filters }) {
  // Only recalculates when items or filters change
  const processedData = useMemo(() => {
    console.log("Processing data..."); // Should not log on unrelated re-renders

    return items
      .filter((item) => {
        if (filters.category && item.category !== filters.category) return false;
        if (filters.minPrice && item.price < filters.minPrice) return false;
        if (filters.maxPrice && item.price > filters.maxPrice) return false;
        return true;
      })
      .sort((a, b) => {
        switch (filters.sortBy) {
          case "price-asc":
            return a.price - b.price;
          case "price-desc":
            return b.price - a.price;
          case "name":
            return a.name.localeCompare(b.name);
          default:
            return 0;
        }
      });
  }, [items, filters]);

  return <ItemList data={processedData} />;
}

// 4. useCallback for stable function references
function ParentWithStableCallbacks() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Stable reference - MemoizedChild won't re-render when parent re-renders
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // Stable reference with dependency
  const handleAction = useCallback(
    (action: string) => {
      if (selectedId) {
        performAction(selectedId, action);
      }
    },
    [selectedId] // Only changes when selectedId changes
  );

  return (
    <>
      <MemoizedList onSelect={handleSelect} />
      <MemoizedActions onAction={handleAction} />
    </>
  );
}

// 5. useRef for values that shouldn't trigger re-renders
function ComponentWithRef() {
  const renderCount = useRef(0);
  const previousValue = useRef<string | null>(null);

  // Track renders without causing re-renders
  renderCount.current += 1;

  useEffect(() => {
    if (__DEV__ && renderCount.current > 20) {
      console.warn("Excessive renders detected!");
    }
  });

  return <View />;
}
```

---

## Image Optimization with FastImage

```typescript
import FastImage from "react-native-fast-image";
import { memo, useMemo } from "react";

// Image size constants
const IMAGE_SIZES = {
  thumbnail: { width: 80, height: 80 },
  small: { width: 150, height: 150 },
  medium: { width: 300, height: 300 },
  large: { width: 600, height: 600 },
} as const;

interface OptimizedImageProps {
  uri: string;
  size: keyof typeof IMAGE_SIZES;
  priority?: "low" | "normal" | "high";
  style?: StyleProp<ImageStyle>;
}

// Memoized optimized image component
export const OptimizedImage = memo(function OptimizedImage({
  uri,
  size,
  priority = "normal",
  style,
}: OptimizedImageProps) {
  const dimensions = IMAGE_SIZES[size];

  // Build optimized URL (assuming CDN supports query params)
  const optimizedUri = useMemo(() => {
    const params = new URLSearchParams({
      w: dimensions.width.toString(),
      h: dimensions.height.toString(),
      format: "webp",
      quality: "80",
    });
    return `${uri}?${params.toString()}`;
  }, [uri, dimensions]);

  return (
    <FastImage
      style={[dimensions, style]}
      source={{
        uri: optimizedUri,
        priority: FastImage.priority[priority],
        cache: FastImage.cacheControl.immutable,
      }}
      resizeMode={FastImage.resizeMode.cover}
    />
  );
});

// Preload critical images
export function preloadImages(uris: string[]) {
  FastImage.preload(
    uris.map((uri) => ({
      uri,
      priority: FastImage.priority.high,
    }))
  );
}

// Usage in component
function ProductGrid({ products }: { products: Product[] }) {
  // Preload first batch of images
  useEffect(() => {
    const imageUris = products.slice(0, 10).map((p) => p.imageUrl);
    preloadImages(imageUris);
  }, [products]);

  return (
    <FlatList
      data={products}
      renderItem={({ item }) => (
        <View style={styles.gridItem}>
          <OptimizedImage
            uri={item.imageUrl}
            size="medium"
            priority={index < 5 ? "high" : "normal"}
          />
          <Text>{item.name}</Text>
        </View>
      )}
    />
  );
}
```

---

## Lazy Loading Screens

```typescript
import { lazy, Suspense } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";

// Lazy load heavy screens
const HeavyDashboard = lazy(() => import("./screens/heavy-dashboard"));
const AnalyticsScreen = lazy(() => import("./screens/analytics"));
const ReportsScreen = lazy(() => import("./screens/reports"));

// Loading fallback component
function ScreenLoader() {
  return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

// Wrapper for lazy screens
function LazyScreen({ component: Component, ...props }: { component: React.LazyExoticComponent<any> }) {
  return (
    <Suspense fallback={<ScreenLoader />}>
      <Component {...props} />
    </Suspense>
  );
}

// In navigator
function MainNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Dashboard">
        {(props) => <LazyScreen component={HeavyDashboard} {...props} />}
      </Stack.Screen>
      <Stack.Screen name="Analytics">
        {(props) => <LazyScreen component={AnalyticsScreen} {...props} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

// Inline require for conditional modules
function FeatureScreen() {
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);

  const handleEnableAdvanced = () => {
    // Only load when needed
    const AdvancedFeatures = require("./advanced-features").default;
    AdvancedFeatures.initialize();
    setIsAdvancedMode(true);
  };

  return (
    <View>
      {isAdvancedMode ? (
        <AdvancedView />
      ) : (
        <Button onPress={handleEnableAdvanced}>Enable Advanced Mode</Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
```

---

## Performance Monitoring Hook

```typescript
import { useEffect, useRef } from "react";

const RENDER_THRESHOLD = 10;
const TIME_THRESHOLD_MS = 16; // 60fps = 16ms per frame

export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;

    if (__DEV__) {
      // Warn on excessive renders
      if (renderCount.current > RENDER_THRESHOLD) {
        console.warn(
          `[Performance] ${componentName} has rendered ${renderCount.current} times`
        );
      }

      // Warn on slow renders
      if (timeSinceLastRender < TIME_THRESHOLD_MS && renderCount.current > 1) {
        console.warn(
          `[Performance] ${componentName} rendered twice within ${timeSinceLastRender}ms`
        );
      }
    }
  });

  // Reset on unmount
  useEffect(() => {
    return () => {
      if (__DEV__ && renderCount.current > RENDER_THRESHOLD) {
        console.log(
          `[Performance] ${componentName} total renders: ${renderCount.current}`
        );
      }
    };
  }, [componentName]);
}

// Usage
function ExpensiveComponent() {
  usePerformanceMonitor("ExpensiveComponent");

  return <View>{/* ... */}</View>;
}
```

---

## Avoiding Common Performance Issues

```typescript
// BAD: Inline style objects create new reference every render
function BadComponent() {
  return (
    <View style={{ padding: 16, margin: 8 }}>
      <Text style={{ fontSize: 16, color: "#000" }}>Hello</Text>
    </View>
  );
}

// GOOD: Use StyleSheet.create
const styles = StyleSheet.create({
  container: { padding: 16, margin: 8 },
  text: { fontSize: 16, color: "#000" },
});

function GoodComponent() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hello</Text>
    </View>
  );
}

// BAD: Inline function in FlatList
<FlatList
  data={items}
  renderItem={({ item }) => <ItemCard item={item} onPress={() => handlePress(item.id)} />}
/>

// GOOD: Stable callbacks
function GoodList({ items }: { items: Item[] }) {
  const handlePress = useCallback((id: string) => {
    // handle press
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Item }) => <MemoizedItemCard item={item} onPress={handlePress} />,
    [handlePress]
  );

  return <FlatList data={items} renderItem={renderItem} />;
}

// BAD: Computing on every render
function BadFilter({ items }: { items: Item[] }) {
  // Runs on EVERY render, even if items hasn't changed
  const filtered = items.filter((i) => i.isActive).sort((a, b) => a.name.localeCompare(b.name));
  return <List data={filtered} />;
}

// GOOD: Memoized computation
function GoodFilter({ items }: { items: Item[] }) {
  const filtered = useMemo(
    () => items.filter((i) => i.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );
  return <List data={filtered} />;
}

// BAD: New array reference
<FlatList
  data={items}
  extraData={[selectedId, sortOrder]} // New array every render
/>

// GOOD: Memoized extraData
function GoodListWithExtraData({ items, selectedId, sortOrder }: Props) {
  const extraData = useMemo(() => ({ selectedId, sortOrder }), [selectedId, sortOrder]);

  return <FlatList data={items} extraData={extraData} />;
}
```

---

## SectionList Optimization

```typescript
import { memo, useCallback, useMemo } from "react";
import { SectionList, Text, View, StyleSheet } from "react-native";

const SECTION_HEADER_HEIGHT = 40;
const ITEM_HEIGHT = 60;

interface Section {
  title: string;
  data: Item[];
}

interface OptimizedSectionListProps {
  sections: Section[];
  onItemPress: (id: string) => void;
}

const SectionHeader = memo(function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
});

const SectionItem = memo(function SectionItem({
  item,
  onPress,
}: {
  item: Item;
  onPress: (id: string) => void;
}) {
  const handlePress = useCallback(() => onPress(item.id), [item.id, onPress]);

  return (
    <Pressable onPress={handlePress} style={styles.item}>
      <Text>{item.name}</Text>
    </Pressable>
  );
});

export function OptimizedSectionList({ sections, onItemPress }: OptimizedSectionListProps) {
  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => <SectionHeader title={section.title} />,
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: Item }) => <SectionItem item={item} onPress={onItemPress} />,
    [onItemPress]
  );

  const keyExtractor = useCallback((item: Item) => item.id, []);

  // getItemLayout for fixed-height items and headers
  const getItemLayout = useCallback(
    (
      data: Section[] | null,
      index: number
    ): { length: number; offset: number; index: number } => {
      // Calculate offset considering section headers
      // This is complex for SectionList - simplified version:
      return {
        length: ITEM_HEIGHT,
        offset: ITEM_HEIGHT * index,
        index,
      };
    },
    []
  );

  return (
    <SectionList
      sections={sections}
      renderSectionHeader={renderSectionHeader}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      stickySectionHeadersEnabled
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    height: SECTION_HEADER_HEIGHT,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
});
```
