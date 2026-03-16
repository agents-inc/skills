# React Native - Performance Patterns

> FlashList/FlatList optimization, memoization, lazy loading, and profiling. See [core.md](core.md) for component patterns.

**Prerequisites**: Understand list virtualization concepts and React.memo basics.

---

## Pattern 1: FlashList (Recommended for New Architecture)

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

## Pattern 2: Optimized FlatList

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
  const renderItem: ListRenderItem<Product> = useCallback(
    ({ item }) => <ProductItem item={item} onPress={onProductPress} />,
    [onProductPress]
  );

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
      windowSize={WINDOW_SIZE}
      maxToRenderPerBatch={MAX_TO_RENDER_PER_BATCH}
      initialNumToRender={INITIAL_NUM_TO_RENDER}
      removeClippedSubviews={Platform.OS === "android"}
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={ON_END_REACHED_THRESHOLD}
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
    marginLeft: 88,
  },
  footer: {
    paddingVertical: 20,
    alignItems: "center",
  },
});
```

---

## Pattern 3: Memoization Patterns

```typescript
import { memo, useMemo, useCallback, useRef } from "react";

// 1. React.memo for list items
interface UserCardProps {
  user: User;
  onPress: (id: string) => void;
}

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
    return (
      prevProps.data.id === nextProps.data.id &&
      prevProps.config.mode === nextProps.config.mode
    );
  }
);

// 3. useMemo for expensive computations
function DataProcessor({ items, filters }: { items: Item[]; filters: Filters }) {
  const processedData = useMemo(() => {
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

// 4. Stable callbacks for memoized children
function ParentWithStableCallbacks() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleAction = useCallback(
    (action: string) => {
      if (selectedId) {
        performAction(selectedId, action);
      }
    },
    [selectedId]
  );

  return (
    <>
      <MemoizedList onSelect={handleSelect} />
      <MemoizedActions onAction={handleAction} />
    </>
  );
}
```

---

## Pattern 4: Avoiding Common Performance Issues

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

// BAD: New array reference for extraData
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

## Pattern 5: SectionList Optimization

```typescript
import { memo, useCallback } from "react";
import { SectionList, Text, View, StyleSheet } from "react-native";

const SECTION_HEADER_HEIGHT = 40;
const ITEM_HEIGHT = 60;

interface Section {
  title: string;
  data: Item[];
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

export function OptimizedSectionList({ sections, onItemPress }: {
  sections: Section[];
  onItemPress: (id: string) => void;
}) {
  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => <SectionHeader title={section.title} />,
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: Item }) => <SectionItem item={item} onPress={onItemPress} />,
    [onItemPress]
  );

  const keyExtractor = useCallback((item: Item) => item.id, []);

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

---

## Pattern 6: Lazy Loading Screens

```typescript
import { lazy, Suspense } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";

// Lazy load heavy screens
const HeavyDashboard = lazy(() => import("./screens/heavy-dashboard"));
const AnalyticsScreen = lazy(() => import("./screens/analytics"));

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

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
```

---

## Pattern 7: Performance Monitoring Hook

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
      if (renderCount.current > RENDER_THRESHOLD) {
        console.warn(
          `[Performance] ${componentName} has rendered ${renderCount.current} times`
        );
      }

      if (timeSinceLastRender < TIME_THRESHOLD_MS && renderCount.current > 1) {
        console.warn(
          `[Performance] ${componentName} rendered twice within ${timeSinceLastRender}ms`
        );
      }
    }
  });

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
