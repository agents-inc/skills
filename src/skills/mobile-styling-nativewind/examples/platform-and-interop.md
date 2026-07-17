# NativeWind - Platform Prefixes and Third-Party Interop

> Platform-specific styling, cssInterop vs remapProps, and third-party component integration. See [core.md](core.md) for basic className patterns.

**Prerequisites**: Understand [Pattern 5: Platform Prefixes](../SKILL.md) and [Pattern 6: Third-Party Integration](../SKILL.md) from SKILL.md.

---

## Pattern 1: Platform-Specific Styling

Use `ios:`, `android:`, `web:`, and `native:` prefixes to handle platform differences declaratively.

```tsx
import { View, Text, Pressable } from "react-native";

export function PlatformCard({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <View
      className={`
        m-4 rounded-xl bg-white p-4 dark:bg-gray-800
        ios:shadow-lg
        android:elevation-4
      `}
    >
      <Text
        className={`
          text-lg text-gray-900 dark:text-white
          ios:font-semibold
          android:font-bold
        `}
      >
        {title}
      </Text>

      {/* Haptic-style feedback differs by platform */}
      <Pressable
        className={`
          mt-3 rounded-lg bg-blue-500 px-4 py-3
          active:bg-blue-600
          android:active:bg-blue-700
        `}
        onPress={onPress}
      >
        <Text className="text-center font-medium text-white">Action</Text>
      </Pressable>
    </View>
  );
}
```

**Why good:** Shadows handled correctly per platform (iOS uses shadow-_, Android uses elevation-_), font weights adjusted for platform rendering, no Platform.select boilerplate

---

## Pattern 2: Native-Only and Web-Only Styles

The `native:` prefix targets iOS + Android + all other native platforms (not web). Useful for cross-platform apps.

```tsx
<View className="p-4 native:pt-12 web:pt-4">
  {/* Extra top padding on native for status bar area */}
  <Text className="text-xl font-bold text-gray-900 dark:text-white native:text-lg web:text-2xl">
    Responsive Heading
  </Text>

  {/* Hover only works on web (pointer devices) */}
  <Pressable className="rounded-lg bg-gray-100 p-3 active:bg-gray-200 web:hover:bg-gray-150">
    <Text className="text-gray-900 dark:text-white">Interactive Item</Text>
  </Pressable>
</View>
```

**Why good:** `native:` avoids repeating `ios: android:` for shared native behavior, `web:hover:` applies only where pointer events exist

---

## Pattern 3: remapProps for Multi-Style Components

Use `remapProps` to map className props to style props on third-party components. This is lightweight -- no style resolution overhead.

```tsx
import { FlatList, ScrollView, SectionList } from "react-native";
import { remapProps } from "nativewind";

// FlatList: maps className to multiple style props
remapProps(FlatList, {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
  columnWrapperClassName: "columnWrapperStyle",
  ListHeaderComponentClassName: "ListHeaderComponentStyle",
  ListFooterComponentClassName: "ListFooterComponentStyle",
});

// ScrollView: contentContainerStyle is common
remapProps(ScrollView, {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
  indicatorClassName: "indicatorStyle",
});

// SectionList: similar to FlatList
remapProps(SectionList, {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
});
```

```tsx
// Usage -- className props map to the corresponding style props
<FlatList
  className="flex-1 bg-gray-50 dark:bg-gray-900"
  contentContainerClassName="p-4 gap-3"
  data={items}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
/>

<ScrollView
  className="flex-1"
  contentContainerClassName="p-4 pb-20"
>
  {children}
</ScrollView>
```

**Why good:** Zero style resolution overhead, maps className strings to the component's existing style props, type-safe with declaration merging

---

## Pattern 4: cssInterop for Style-to-Prop Extraction

Use `cssInterop` when a component needs style properties extracted as individual props. This has runtime cost -- use only when necessary.

```tsx
import { TextInput, StatusBar } from "react-native";
import { cssInterop } from "nativewind";

// TextInput: extract textAlign from style, map placeholder color
cssInterop(TextInput, {
  className: {
    target: "style",
    nativeStyleToProp: {
      textAlign: true, // Extracts textAlign from style to a prop
    },
  },
  placeholderClassName: {
    target: false, // Don't merge into any style prop
    nativeStyleToProp: {
      color: "placeholderTextColor", // Extract color -> placeholderTextColor prop
    },
  },
});
```

```tsx
// Usage -- className drives both style and extracted props
<TextInput
  className="rounded-lg border border-gray-300 p-3 text-base text-gray-900 text-center dark:border-gray-600 dark:text-white"
  placeholderClassName="text-gray-400 dark:text-gray-500"
  placeholder="Search..."
/>
```

**Why good:** `textAlign` extracted from style to its own prop (required by TextInput), `placeholderTextColor` derived from className instead of hardcoded color string

---

## Pattern 5: TypeScript Declarations for Third-Party Props

After calling `remapProps` or `cssInterop`, add TypeScript declarations so the new props are type-safe.

```typescript
// nativewind-env.d.ts or a dedicated declarations file
/// <reference types="nativewind/types" />

import type {
  FlatListProps,
  ScrollViewProps,
  TextInputProps,
} from "react-native";

declare module "react-native" {
  interface FlatListProps<ItemT> {
    contentContainerClassName?: string;
    columnWrapperClassName?: string;
    ListHeaderComponentClassName?: string;
    ListFooterComponentClassName?: string;
  }

  interface ScrollViewProps {
    contentContainerClassName?: string;
    indicatorClassName?: string;
  }

  // TextInput already handled by nativewind/types, but for custom mappings:
  interface TextInputProps {
    placeholderClassName?: string;
  }
}
```

**Why good:** TypeScript knows about the new className props, autocomplete works, type errors caught at compile time

---

## Pattern 6: Integrating SVG Components

SVG libraries (react-native-svg) often need `cssInterop` because they use non-standard style props.

```tsx
import Svg, { Circle, Path } from "react-native-svg";
import { cssInterop } from "nativewind";

// Map className to SVG-specific props
cssInterop(Svg, {
  className: {
    target: "style",
    nativeStyleToProp: {
      width: true,
      height: true,
    },
  },
});

cssInterop(Circle, {
  className: {
    target: "style",
    nativeStyleToProp: {
      width: true,
      height: true,
      fill: "fill",
      stroke: "stroke",
      strokeWidth: "strokeWidth",
    },
  },
});
```

```tsx
// Usage
<Svg className="h-6 w-6">
  <Circle className="fill-blue-500 stroke-blue-700" cx="12" cy="12" r="10" />
</Svg>
```

**Why good:** SVG dimensions and colors driven by Tailwind classes, nativeStyleToProp extracts the right attributes to SVG-specific props

**When to use:** Only for SVG or similar components where style attributes must become element-specific props. For components with standard style props, prefer `remapProps`.

---

## Anti-Pattern: Using cssInterop/remapProps on Custom Components

```tsx
// BAD -- never use cssInterop/remapProps on your own components
import { cssInterop } from "nativewind";

function MyCard({ style, children }) {
  return <View style={style}>{children}</View>;
}
cssInterop(MyCard, { className: "style" }); // WRONG

// GOOD -- accept and merge className directly
function MyCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <View
      className={`rounded-xl bg-white p-4 dark:bg-gray-800 ${className ?? ""}`}
    >
      {children}
    </View>
  );
}
```

**Why bad:** cssInterop adds runtime overhead (style resolution, event handlers, context injection) that is completely unnecessary for your own components. Your own components can accept className directly because the JSX transform handles it.
