# React Native Reference

> Decision frameworks, checklists, and quick reference. See [SKILL.md](SKILL.md) for red flags and anti-patterns.

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

### Styling Approach

```
Does component have variants (primary/secondary, sm/md/lg)?
├─ YES → StyleSheet with computed styles or style arrays
│   OR → Use your variant styling solution
└─ NO → StyleSheet.create for static styles

Are values dynamic (runtime values like theme colors)?
├─ YES → Inline styles or style arrays
└─ NO → StyleSheet.create (better performance)
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
└─ File-based routing → Use your managed workflow's router (built on React Navigation)

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
├── app/                    # File-based routes (if using managed workflow)
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
├── stores/                 # State management stores
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

- [ ] Using an optimized image library for heavy image usage
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
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
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
type RenderItem<T> = ({
  item,
  index,
}: {
  item: T;
  index: number;
}) => React.ReactElement;
```

### CLI Commands

```bash
# React Native CLI (bare workflow)
npx react-native start            # Start Metro bundler
npx react-native run-ios          # Run on iOS simulator
npx react-native run-android      # Run on Android emulator
cd ios && pod install             # Install iOS dependencies
```

> For managed workflow CLI commands (start, build, update), see your managed workflow's skill documentation.
