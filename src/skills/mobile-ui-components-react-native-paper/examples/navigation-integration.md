# React Native Paper - Navigation Integration

> BottomNavigation.Bar with React Navigation, adaptNavigationTheme, Drawer integration. See [SKILL.md](../SKILL.md) for decision guidance. See [core.md](core.md) for theme bridging setup.

---

## Pattern 1: BottomNavigation.Bar with React Navigation v7

The old `createMaterialBottomTabNavigator` is deprecated since v5.14. Use `@react-navigation/bottom-tabs` with `BottomNavigation.Bar` as a custom `tabBar`.

```typescript
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import { BottomNavigation } from "react-native-paper";
import Icon from "@react-native-vector-icons/material-design-icons";

const ICON_SIZE = 24;

const Tab = createBottomTabNavigator();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={({ navigation, state, descriptors, insets }) => (
        <BottomNavigation.Bar
          navigationState={state}
          safeAreaInsets={insets}
          onTabPress={({ route, preventDefault }) => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (event.defaultPrevented) {
              preventDefault();
            } else {
              navigation.dispatch({
                ...CommonActions.navigate(route.name, route.params),
                target: state.key,
              });
            }
          }}
          renderIcon={({ route, focused, color }) => {
            const { options } = descriptors[route.key];
            if (options.tabBarIcon) {
              return options.tabBarIcon({ focused, color, size: ICON_SIZE });
            }
            return null;
          }}
          getLabelText={({ route }) => {
            const { options } = descriptors[route.key];
            const label =
              typeof options.tabBarLabel === "string"
                ? options.tabBarLabel
                : options.title ?? route.name;
            return label;
          }}
        />
      )}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ color }) => (
            <Icon name="home" color={color} size={ICON_SIZE} />
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarLabel: "Search",
          tabBarIcon: ({ color }) => (
            <Icon name="magnify" color={color} size={ICON_SIZE} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color }) => (
            <Icon name="account" color={color} size={ICON_SIZE} />
          ),
          tabBarBadge: 3, // Shows badge with number
        }}
      />
    </Tab.Navigator>
  );
}
```

**Why good:** Uses React Navigation's native bottom-tabs API (latest, maintained) with Paper's MD3-styled bar. `CommonActions.navigate` ensures the correct tab reset behavior. `canPreventDefault` allows listeners to intercept tab presses (e.g., unsaved changes confirmation). Badge support via `tabBarBadge` in screen options.

---

## Pattern 2: Drawer Content with Paper Components

Use Paper's `Drawer.Item`, `Drawer.Section`, and `Drawer.CollapsedItem` inside React Navigation's drawer for MD3-styled drawer content.

```typescript
import { View, StyleSheet } from "react-native";
import {
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { Drawer, Avatar, Text, Switch, useTheme } from "react-native-paper";
import { useState } from "react";

const AVATAR_SIZE = 48;
const DRAWER_PADDING = 16;

export function CustomDrawerContent(props: DrawerContentComponentProps) {
  const theme = useTheme();
  const [isDarkMode, setIsDarkMode] = useState(false);

  return (
    <DrawerContentScrollView {...props}>
      {/* User info header */}
      <View style={styles.header}>
        <Avatar.Image size={AVATAR_SIZE} source={{ uri: user.avatarUrl }} />
        <Text variant="titleMedium" style={styles.userName}>
          {user.name}
        </Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {user.email}
        </Text>
      </View>

      {/* Main navigation */}
      <Drawer.Section title="Navigation">
        <Drawer.Item
          label="Home"
          icon="home"
          active={props.state.index === 0}
          onPress={() => props.navigation.navigate("Home")}
        />
        <Drawer.Item
          label="Settings"
          icon="cog"
          active={props.state.index === 1}
          onPress={() => props.navigation.navigate("Settings")}
        />
      </Drawer.Section>

      {/* Preferences section */}
      <Drawer.Section title="Preferences">
        <View style={styles.preference}>
          <Text variant="bodyLarge">Dark Mode</Text>
          <Switch value={isDarkMode} onValueChange={setIsDarkMode} />
        </View>
      </Drawer.Section>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: DRAWER_PADDING,
    paddingVertical: DRAWER_PADDING,
  },
  userName: {
    marginTop: 8,
  },
  preference: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: DRAWER_PADDING,
    paddingVertical: 12,
  },
});
```

**Why good:** `DrawerContentScrollView` handles safe area insets. `Drawer.Section` with `title` groups items with an MD3 divider. `Drawer.Item` with `active` prop shows the MD3 active indicator. Paper's `Switch` and `Avatar` integrate seamlessly.

---

## Pattern 3: Appbar.Header as Navigation Header

Replace React Navigation's default header with Paper's Appbar.Header for MD3 styling.

```typescript
import { Appbar } from "react-native-paper";
import type { NativeStackHeaderProps } from "@react-navigation/native-stack";

export function CustomNavigationBar({
  navigation,
  route,
  options,
  back,
}: NativeStackHeaderProps) {
  const title = options.headerTitle ?? options.title ?? route.name;

  return (
    <Appbar.Header elevated>
      {back ? <Appbar.BackAction onPress={navigation.goBack} /> : null}
      <Appbar.Content title={typeof title === "string" ? title : route.name} />
      {options.headerRight
        ? options.headerRight({ canGoBack: !!back })
        : null}
    </Appbar.Header>
  );
}

// Usage in navigator:
// <Stack.Navigator screenOptions={{ header: (props) => <CustomNavigationBar {...props} /> }}>
```

**Why good:** Replaces React Navigation's default header with MD3-styled Appbar. `elevated` adds the MD3 surface tint. Respects `headerTitle`, `title`, and `headerRight` from screen options. `Appbar.BackAction` uses the correct platform back icon.
