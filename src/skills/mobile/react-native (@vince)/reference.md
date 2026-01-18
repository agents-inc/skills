# React Native Reference

> Decision frameworks, anti-patterns, and red flags. Reference from [SKILL.md](SKILL.md).

---

## Decision Framework

### New Architecture (React Native 0.76+)

```
Is your app on React Native 0.76+?
├─ YES → New Architecture is ENABLED by default
│   └─ Check library compatibility (90%+ of popular libs support it)
└─ NO → Consider upgrading (legacy architecture is deprecated with warnings)

Need to opt out temporarily?
├─ Add to app.json (Expo): newArchEnabled: false
├─ Add to gradle.properties (bare): newArchEnabled=false
└─ WARNING: App will crash in 0.78+ if legacy architecture is forced

Are you using Reanimated?
├─ Reanimated 4.x → New Architecture ONLY (requires react-native-worklets)
└─ Reanimated 3.x → Supports both architectures (still maintained)
```

### Expo vs Bare Workflow

```
Starting a new React Native project?
├─ Need custom native modules (not in Expo SDK)?
│   ├─ YES → Bare workflow or Expo with development builds
│   └─ NO → Continue...
├─ App size critical (<15MB)?
│   ├─ YES → Bare workflow (Expo adds overhead)
│   └─ NO → Continue...
├─ Team has native (iOS/Android) expertise?
│   ├─ YES → Either (lean bare if complex native work)
│   └─ NO → Expo (handles native complexity)
├─ Need OTA updates?
│   ├─ YES → Expo (EAS Update)
│   └─ NO → Either
└─ Default → Expo (95% of cases)
```

### State Management Choice

```
Is it server data (from API)?
├─ YES → React Query / TanStack Query
└─ NO → Is it needed across multiple unrelated components?
    ├─ YES → Is app enterprise-scale with complex state?
    │   ├─ YES → Redux Toolkit
    │   └─ NO → Zustand
    └─ NO → Is it form data?
        ├─ YES → React Hook Form
        └─ NO → useState/useReducer in component
```

### Styling Approach

```
Does component have variants (primary/secondary, sm/md/lg)?
├─ YES → CVA (class-variance-authority) + NativeWind
│   OR → StyleSheet with computed styles
└─ NO → StyleSheet.create for static styles

Are values dynamic (runtime values like theme colors)?
├─ YES → Inline styles or style arrays
└─ NO → StyleSheet.create (better performance)

Is the team familiar with Tailwind?
├─ YES → NativeWind
└─ NO → StyleSheet.create
```

### List Component Choice

```
How many items in the list?
├─ < 10 items → ScrollView + map() is fine
├─ 10-50 items → FlashList or FlatList recommended
├─ 50+ items → FlashList STRONGLY recommended (or FlatList REQUIRED)
└─ 1000+ items → FlashList v2 (best performance)

Are you on New Architecture (0.76+)?
├─ YES → FlashList v2 (auto-sizes items, 50% less blank area)
│   └─ No estimatedItemSize needed (measures real items)
└─ NO → FlashList v1 or FlatList
    └─ estimatedItemSize REQUIRED for FlashList v1

Do items have variable heights?
├─ FlashList v2 → Handles automatically, items can resize dynamically
├─ FlashList v1 → Provide estimatedItemSize or overrideItemLayout
└─ FlatList → Cannot use getItemLayout (performance hit)

Need sections with headers?
├─ YES → SectionList (or FlashList with getItemType)
└─ NO → FlashList or FlatList

FlashList v2 vs FlatList Decision:
├─ Complex items, low-end Android → FlashList v2 (cell recycling)
├─ Simple items, high-end devices → Either works
├─ Need masonry layout → FlashList v2 (built-in support)
├─ Need maintainVisibleContentPosition → FlashList v2 (enabled by default)
└─ Default recommendation → FlashList v2 (better performance)
```

### Navigation Pattern

```
What type of navigation flow?
├─ Linear flow (onboarding, checkout) → Stack Navigator
├─ Main app sections → Tab Navigator (bottom tabs)
├─ Settings/menu → Drawer Navigator
├─ Modals → Stack with presentation: 'modal'
└─ Deep linking required → Configure linking config

React Navigation 7+ API Choice:
├─ Simple app, TypeScript-first → Static API (less boilerplate)
├─ Complex dynamic navigation → Dynamic API (more flexible)
├─ Mix of both → Use static for top-level, dynamic for nested
└─ Expo Router → Built on React Navigation, file-based routing

Auth flow pattern?
├─ Switch between auth/main navigators based on auth state
└─ Don't conditionally render screens in same navigator
```

### Memoization Decision

```
Should I memoize this?
├─ Is it a FlatList renderItem callback?
│   └─ YES → Always useCallback
├─ Is it a component receiving stable props?
│   └─ YES → Consider React.memo
├─ Is computation expensive (>5ms)?
│   └─ YES → useMemo
├─ Is it a callback passed to memoized child?
│   └─ YES → useCallback
└─ Default → Don't memoize (premature optimization)
```

---

## File Organization Reference

### Recommended Directory Structure

```
src/
├── app/                    # Expo Router routes (if using)
├── screens/                # Screen components
│   ├── home/
│   │   ├── home-screen.tsx
│   │   └── components/     # Screen-specific components
│   └── auth/
│       ├── login-screen.tsx
│       └── register-screen.tsx
├── components/             # Shared components
│   ├── ui/                 # Base UI components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── card.tsx
│   └── features/           # Feature-specific components
├── navigation/             # Navigation configuration
│   ├── root-navigator.tsx
│   ├── auth-navigator.tsx
│   └── types.ts            # Navigation type definitions
├── hooks/                  # Custom hooks
├── stores/                 # Zustand stores
├── services/               # API services
├── utils/                  # Utility functions
├── constants/              # App constants, design tokens
└── types/                  # Shared TypeScript types
```

### File Naming Conventions

```
Components:       kebab-case.tsx        (e.g., user-profile.tsx)
Screens:          kebab-case-screen.tsx (e.g., home-screen.tsx)
Hooks:            use-kebab-case.ts     (e.g., use-auth.ts)
Stores:           kebab-case-store.ts   (e.g., auth-store.ts)
Utils:            kebab-case.ts         (e.g., format-date.ts)
Types:            types.ts or kebab-case.types.ts
Platform files:   name.ios.tsx, name.android.tsx
```

---

## RED FLAGS

### High Priority Issues

- **Using ScrollView + map() for lists with 50+ items** - causes severe performance issues, use FlashList or FlatList
- **Not using keyExtractor with stable keys** - using index as key causes incorrect recycling and visual bugs
- **Adding key prop to FlashList items** - BREAKS cell recycling, eliminates FlashList's main benefit
- **Using React Native's built-in SafeAreaView** - deprecated in 0.81+ and will be removed, use react-native-safe-area-context
- **Missing safe area handling** - content hidden behind notch/Dynamic Island on iOS, broken UX
- **Not testing on both platforms** - iOS/Android differences compound; test daily on both
- **Inline functions in FlatList/FlashList renderItem** - creates new function every render, breaks memoization
- **Using Reanimated 4 with old architecture** - Reanimated 4.x is New Architecture ONLY

### Medium Priority Issues

- **Hardcoded colors/spacing instead of constants** - breaks consistency, makes theming impossible
- **Not using Platform.select for shadows** - iOS shadow props don't work on Android (use elevation)
- **Missing keyboard handling on forms** - keyboard covers inputs without KeyboardAvoidingView
- **Not memoizing FlatList item components** - unnecessary re-renders on scroll
- **Using TouchableOpacity everywhere** - Pressable is more flexible and supports android_ripple

### Common Mistakes

- **Forgetting displayName on forwardRef components** - debugging becomes harder in React DevTools
- **Missing accessibilityRole on interactive elements** - screen readers can't identify buttons/links
- **Using inline styles for static values** - creates new object every render
- **Not handling loading/error states** - users see nothing or broken UI during network requests
- **Hardcoding dimensions instead of using Dimensions API** - breaks on different screen sizes

### Gotchas and Edge Cases

- **Android fontWeight only supports 'normal' and 'bold' reliably** - 100-900 values may not work
- **iOS shadow props are completely ignored on Android** - must use elevation for Android shadows
- **StatusBar backgroundColor only works on Android** - iOS uses translucent status bar
- **FlatList onEndReached fires immediately if data fits screen** - use onEndReachedThreshold carefully
- **KeyboardAvoidingView behavior differs: 'padding' for iOS, 'height' for Android**
- **AsyncStorage is asynchronous** - can't read values synchronously on app start
- **React Native doesn't have CSS cascade** - each component must have complete styles
- **Text must be wrapped in `<Text>` component** - raw strings cause crashes
- **New Architecture enabled by default in 0.76+** - some older libraries may need updates
- **FlashList v2 is New Architecture only** - use v1 or FlatList if on old architecture
- **React Native 0.78+ uses React 19** - check for breaking changes (propTypes removed)
- **Expo SDK 53+ uses React 19** - check for breaking changes in your dependencies
- **Android 15/16 enforces edge-to-edge** - must handle safe areas properly
- **Reanimated 4 requires react-native-worklets** - Reanimated 3 will not work with it installed
- **boxShadow and filter props are New Architecture only** - not available on legacy architecture
- **forwardRef no longer required in React 19** - ref can be passed as regular prop

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: ScrollView for Long Lists

```typescript
// ANTI-PATTERN: Renders ALL items at once
function BadProductList({ products }: { products: Product[] }) {
  return (
    <ScrollView>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ScrollView>
  );
}
```

**Why it's wrong:** Renders all 1000 items immediately, causes memory issues and slow initial render, no virtualization.

**What to do instead:**

```typescript
// CORRECT: FlatList virtualizes and recycles items
function GoodProductList({ products }: { products: Product[] }) {
  const renderItem = useCallback(
    ({ item }: { item: Product }) => <ProductCard product={item} />,
    []
  );

  const keyExtractor = useCallback((item: Product) => item.id, []);

  return (
    <FlatList
      data={products}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}
```

---

### Anti-Pattern 2: Inline Functions in Lists

```typescript
// ANTI-PATTERN: Creates new function on every render
<FlatList
  data={items}
  renderItem={({ item }) => <ItemCard item={item} />}
  keyExtractor={(item, index) => index.toString()}
/>
```

**Why it's wrong:** New function reference every render breaks React.memo on children, index as key causes recycling bugs.

**What to do instead:**

```typescript
// CORRECT: Stable callbacks, proper keys
const renderItem = useCallback(
  ({ item }: { item: Item }) => <ItemCard item={item} />,
  []
);

const keyExtractor = useCallback((item: Item) => item.id, []);

<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
/>;
```

---

### Anti-Pattern 3: Not Handling Platform Differences

```typescript
// ANTI-PATTERN: Assumes same behavior across platforms
const styles = StyleSheet.create({
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    // No Android elevation - shadow won't show on Android!
  },
  text: {
    fontWeight: "600", // Won't work on Android
  },
});
```

**Why it's wrong:** iOS shadow props are completely ignored on Android, fontWeight values other than normal/bold unreliable on Android.

**What to do instead:**

```typescript
// CORRECT: Platform-specific handling
const styles = StyleSheet.create({
  card: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  text: {
    fontWeight: Platform.select({ ios: "600", android: "bold" }),
  },
});
```

---

### Anti-Pattern 4: Missing Safe Area Handling

```typescript
// ANTI-PATTERN: Content hidden behind notch
function BadScreen() {
  return (
    <View style={{ flex: 1 }}>
      <Header /> {/* Hidden behind Dynamic Island on iPhone 14+ */}
      <Content />
    </View>
  );
}
```

**Why it's wrong:** Content renders under notch/Dynamic Island on iOS, under status bar on Android.

**What to do instead:**

```typescript
// CORRECT: Safe area handling
import { SafeAreaView } from "react-native-safe-area-context";

function GoodScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <Header />
      <Content />
    </SafeAreaView>
  );
}
```

---

### Anti-Pattern 5: God Components

```typescript
// ANTI-PATTERN: 500+ lines mixing everything
function BadDashboard() {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({});
  const [sortOrder, setSortOrder] = useState("asc");
  // ... 20 more useState calls
  // ... 15 useEffect calls
  // ... API calls mixed with UI logic
  // ... 300 lines of JSX

  return <View>{/* Everything in one component */}</View>;
}
```

**Why it's wrong:** Impossible to test, maintain, or reuse; any state change re-renders entire component.

**What to do instead:**

```typescript
// CORRECT: Split into focused components + hooks
function GoodDashboard() {
  const { users, loading, error } = useUsers();
  const { filters, setFilters } = useFilters();

  return (
    <View>
      <FilterBar filters={filters} onChange={setFilters} />
      <UserList users={users} loading={loading} />
      {error && <ErrorMessage error={error} />}
    </View>
  );
}
```

---

### Anti-Pattern 6: Direct State Mutation

```typescript
// ANTI-PATTERN: Mutating state directly
function BadComponent() {
  const [items, setItems] = useState([{ id: 1, name: "Item" }]);

  const addItem = () => {
    items.push({ id: 2, name: "New" }); // Direct mutation
    setItems(items); // Same reference - React won't re-render
  };
}
```

**Why it's wrong:** React uses reference equality; same array reference means no re-render.

**What to do instead:**

```typescript
// CORRECT: Create new array
const addItem = () => {
  setItems((prev) => [...prev, { id: 2, name: "New" }]);
};
```

---

## Performance Checklist

### FlatList Optimization

- [ ] Using FlatList (not ScrollView + map) for 20+ items
- [ ] renderItem wrapped in useCallback
- [ ] keyExtractor returns stable unique ID (not index)
- [ ] getItemLayout provided if items have fixed height
- [ ] initialNumToRender, maxToRenderPerBatch, windowSize tuned
- [ ] removeClippedSubviews={true} on Android for memory
- [ ] Item components wrapped in React.memo

### Component Optimization

- [ ] No inline styles for static values (use StyleSheet)
- [ ] No inline functions passed to memoized children
- [ ] useMemo for expensive computations (>5ms)
- [ ] useCallback for callbacks passed to children
- [ ] React.memo on frequently re-rendering pure components

### Image Optimization

- [ ] Using react-native-fast-image for heavy image usage
- [ ] Images sized appropriately (not 4K images in thumbnails)
- [ ] Preloading critical images
- [ ] Using appropriate resizeMode
- [ ] Caching enabled for network images

### Navigation Optimization

- [ ] Lazy loading heavy screens
- [ ] Screen preloading for likely next screens
- [ ] useFocusEffect for resource setup/cleanup
- [ ] Avoiding inline component functions in Screen definitions

---

## Quick Reference

### Essential Imports

```typescript
// Core React Native
import {
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
} from "react-native";

// Safe Area
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// Navigation
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

// Animations
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
```

### Common TypeScript Patterns

```typescript
// Navigation types
type RootStackParamList = {
  Home: undefined;
  Profile: { userId: string };
  Settings: { section?: string };
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Component props
interface ComponentProps {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
}

// FlatList renderItem
type RenderItem<T> = ({ item, index }: { item: T; index: number }) => React.ReactElement;
```

### CLI Commands

```bash
# Expo
npx expo start                    # Start dev server
npx expo start --ios              # Start on iOS simulator
npx expo start --android          # Start on Android emulator
npx eas build --platform ios      # Build for iOS
npx eas build --platform android  # Build for Android
npx eas update                    # OTA update

# Bare React Native
npx react-native start            # Start Metro bundler
npx react-native run-ios          # Run on iOS simulator
npx react-native run-android      # Run on Android emulator
cd ios && pod install             # Install iOS dependencies
```
