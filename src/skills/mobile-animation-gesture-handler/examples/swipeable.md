# Gesture Handler - Swipeable Patterns

> ReanimatedSwipeable for list row interactions. See [core.md](core.md) for gesture fundamentals.

**Related:** [SKILL.md](../SKILL.md) for red flags, [reference.md](../reference.md) for ReanimatedSwipeable props.

---

## Pattern 1: Swipeable List Row with Delete Action

```typescript
import { useCallback, useRef } from "react";
import { Text, View, StyleSheet, Pressable } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

const SWIPE_THRESHOLD = 40;
const OVERSHOOT_FRICTION = 8;
const DELETE_ACTION_WIDTH = 80;

function RightActions(
  progress: SharedValue<number>,
  translation: SharedValue<number>,
) {
  const animatedStyle = useAnimatedStyle(() => ({
    // Slide in from the right, anchored to the swipe translation
    transform: [{ translateX: translation.value + DELETE_ACTION_WIDTH }],
  }));

  return (
    <Animated.View style={[styles.rightAction, animatedStyle]}>
      <Text style={styles.actionText}>Delete</Text>
    </Animated.View>
  );
}

interface SwipeableRowProps {
  item: { id: string; title: string };
  onDelete: (id: string) => void;
}

function SwipeableRow({ item, onDelete }: SwipeableRowProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);

  const handleSwipeOpen = useCallback(() => {
    onDelete(item.id);
    swipeableRef.current?.close();
  }, [item.id, onDelete]);

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={SWIPE_THRESHOLD}
      overshootFriction={OVERSHOOT_FRICTION}
      renderRightActions={RightActions}
      onSwipeableOpen={handleSwipeOpen}
    >
      <View style={styles.row}>
        <Text style={styles.rowText}>{item.title}</Text>
      </View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  rowText: {
    fontSize: 16,
    color: "#1A1A1A",
  },
  rightAction: {
    width: DELETE_ACTION_WIDTH,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
});
```

**Why good:** `ReanimatedSwipeable` runs animations on native thread (not JS), `overshootFriction: 8` gives native-feeling resistance, ref for programmatic control, `onSwipeableOpen` fires when the user completes the swipe

---

## Pattern 2: Swipeable with Left + Right Actions

```typescript
const ARCHIVE_ACTION_WIDTH = 80;
const DELETE_ACTION_WIDTH = 80;

function LeftActions(
  progress: SharedValue<number>,
  translation: SharedValue<number>,
) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translation.value - ARCHIVE_ACTION_WIDTH }],
  }));

  return (
    <Animated.View style={[styles.archiveAction, animatedStyle]}>
      <Text style={styles.actionText}>Archive</Text>
    </Animated.View>
  );
}

function RightActions(
  progress: SharedValue<number>,
  translation: SharedValue<number>,
) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translation.value + DELETE_ACTION_WIDTH }],
  }));

  return (
    <Animated.View style={[styles.deleteAction, animatedStyle]}>
      <Text style={styles.actionText}>Delete</Text>
    </Animated.View>
  );
}

function EmailRow({ email, onArchive, onDelete }: EmailRowProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);

  const handleOpen = useCallback(
    (direction: "left" | "right") => {
      if (direction === "left") {
        onArchive(email.id);
      } else {
        onDelete(email.id);
      }
      swipeableRef.current?.close();
    },
    [email.id, onArchive, onDelete],
  );

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={ARCHIVE_ACTION_WIDTH}
      rightThreshold={DELETE_ACTION_WIDTH}
      overshootFriction={OVERSHOOT_FRICTION}
      renderLeftActions={LeftActions}
      renderRightActions={RightActions}
      onSwipeableOpen={handleOpen}
    >
      <View style={styles.emailRow}>
        <Text style={styles.subject}>{email.subject}</Text>
        <Text style={styles.preview}>{email.preview}</Text>
      </View>
    </ReanimatedSwipeable>
  );
}
```

**Why good:** `onSwipeableOpen` receives the direction string, actions slide in from their respective sides using translation offset

---

## Pattern 3: Swipeable in FlatList (Close Others on Open)

```typescript
import { useCallback, useRef } from "react";
import { FlatList } from "react-native";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

function SwipeableList({ items, onDelete }: SwipeableListProps) {
  // Track which swipeable is currently open
  const openSwipeableRef = useRef<SwipeableMethods | null>(null);

  const handleSwipeableOpen = useCallback((ref: SwipeableMethods) => {
    // Close the previously open row before opening the new one
    if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
      openSwipeableRef.current.close();
    }
    openSwipeableRef.current = ref;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => (
      <SwipeableRow
        item={item}
        onDelete={onDelete}
        onSwipeableOpen={handleSwipeableOpen}
      />
    ),
    [onDelete, handleSwipeableOpen],
  );

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
    />
  );
}

// SwipeableRow passes its ref up when opened
function SwipeableRow({
  item,
  onDelete,
  onSwipeableOpen,
}: SwipeableRowWithCallbackProps) {
  const swipeableRef = useRef<SwipeableMethods>(null);

  const handleOpen = useCallback(() => {
    if (swipeableRef.current) {
      onSwipeableOpen(swipeableRef.current);
    }
  }, [onSwipeableOpen]);

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      renderRightActions={RightActions}
      onSwipeableWillOpen={handleOpen}
    >
      <RowContent item={item} />
    </ReanimatedSwipeable>
  );
}
```

**Why good:** `onSwipeableWillOpen` fires before animation completes (faster UX), only one row open at a time prevents visual clutter, ref-based approach avoids state re-renders
