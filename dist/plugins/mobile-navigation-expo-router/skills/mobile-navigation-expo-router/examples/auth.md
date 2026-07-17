# Authentication Patterns

> Route protection and auth flows. See [SKILL.md](../SKILL.md) for decisions, [core.md](core.md) for navigation basics.

---

## Stack.Protected Pattern (SDK 53+ -- Recommended)

### Session Provider

```typescript
// ctx.tsx -- Authentication context
import { use, createContext, type PropsWithChildren } from "react";
import { useStorageState } from "./use-storage-state";

interface AuthContextValue {
  signIn: (token: string) => void;
  signOut: () => void;
  session: string | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useSession(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) {
    throw new Error("useSession must be wrapped in a <SessionProvider />");
  }
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [[isLoading, session], setSession] = useStorageState("session");

  return (
    <AuthContext
      value={{
        signIn: (token: string) => setSession(token),
        signOut: () => setSession(null),
        session,
        isLoading,
      }}
    >
      {children}
    </AuthContext>
  );
}
```

### Root Layout with Stack.Protected

```typescript
// app/_layout.tsx
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SessionProvider, useSession } from "../ctx";

SplashScreen.preventAutoHideAsync();

export default function Root() {
  return (
    <SessionProvider>
      <SplashScreenController />
      <RootNavigator />
    </SessionProvider>
  );
}

function SplashScreenController() {
  const { isLoading } = useSession();
  if (!isLoading) {
    SplashScreen.hide();
  }
  return null;
}

function RootNavigator() {
  const { session } = useSession();

  return (
    <Stack>
      {/* Protected routes -- only accessible when session exists */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>

      {/* Public routes -- only accessible when no session */}
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
```

### Directory Structure

```
app/
├── _layout.tsx          # Root with Stack.Protected
├── sign-in.tsx          # Public sign-in screen
└── (app)/               # Protected group
    ├── _layout.tsx      # App layout (tabs, etc.)
    ├── index.tsx         # Home screen
    └── profile.tsx       # Profile screen
```

### Sign-In Screen

```typescript
// app/sign-in.tsx
import { router } from "expo-router";
import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
import { useState } from "react";
import { useSession } from "../ctx";

export default function SignIn() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");

  const handleSignIn = async () => {
    // Your auth logic here (API call, etc.)
    const token = await authenticateUser(email);
    signIn(token);
    router.replace("/"); // Navigate to protected home
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <Pressable style={styles.button} onPress={handleSignIn}>
        <Text style={styles.buttonText}>Sign In</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 24, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 8, marginBottom: 16 },
  button: { backgroundColor: "#007AFF", padding: 16, borderRadius: 8, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
```

---

## How Stack.Protected Guard Works

```
User authenticated (session exists):
  guard={!!session} -> true  -> (app) screens accessible
  guard={!session}  -> false -> sign-in screen hidden

User not authenticated (no session):
  guard={!!session} -> false -> (app) screens hidden
  guard={!session}  -> true  -> sign-in screen accessible

User navigates to protected route while unauthenticated:
  -> Automatically redirected to first available unprotected screen (sign-in)

User signs out while on protected screen:
  -> guard flips to false -> redirected to sign-in automatically
```

---

## Modal Sign-In Pattern (Alternative)

For apps where you want the main content visible behind a sign-in overlay:

```typescript
// app/_layout.tsx
import { Stack } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(root)",
};

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="(root)" options={{ headerShown: false }} />
      <Stack.Screen
        name="sign-in"
        options={{
          presentation: "modal",
          // Prevent dismissing the modal without signing in
          gestureEnabled: false,
          headerShown: false,
        }}
      />
    </Stack>
  );
}
```

**Trade-off:** Modal sign-in preserves deep links better (the target route is already loaded behind the modal), but requires more careful handling of the unauthenticated state since routes render in the background.

---

## Legacy Redirect Pattern (SDK 52 and Earlier)

For projects not yet on SDK 53, use the `Redirect` component in a layout:

```typescript
// app/(app)/_layout.tsx
import { Redirect, Stack } from "expo-router";
import { Text } from "react-native";
import { useSession } from "../../ctx";

export default function AppLayout() {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  return <Stack />;
}
```

**Why Stack.Protected is better:** The Redirect approach renders the protected layout momentarily before redirecting. Stack.Protected prevents the screen from rendering at all when guard is false.
