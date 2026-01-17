# React Native Best Practices for Atomic Skills (2025)

## Table of Contents
1. [Component Patterns](#1-component-patterns)
2. [Navigation Patterns](#2-navigation-patterns)
3. [State Management Patterns](#3-state-management-patterns)
4. [Styling Patterns](#4-styling-patterns)
5. [Platform-Specific Code Patterns](#5-platform-specific-code-patterns)
6. [Native Module Integration](#6-native-module-integration)
7. [Performance Optimization](#7-performance-optimization)
8. [Gesture Handling](#8-gesture-handling)
9. [Testing Patterns](#9-testing-patterns)
10. [Expo vs Bare Workflow](#10-expo-vs-bare-workflow)

---

## 1. Component Patterns

### Core Patterns

#### Functional Components with TypeScript (Standard)
```typescript
import { forwardRef, useCallback, useMemo, type ReactNode } from 'react';
import { View, Text, Pressable, type ViewStyle } from 'react-native';

// Props interface with explicit types
interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onPress: () => void;
  style?: ViewStyle;
  testID?: string;
}

// Functional component with forwardRef for ref forwarding
export const Button = forwardRef<View, ButtonProps>(
  ({ children, variant = 'primary', size = 'md', disabled = false, onPress, style, testID }, ref) => {
    // Memoize computed styles
    const buttonStyle = useMemo(
      () => [styles.base, styles[variant], styles[size], disabled && styles.disabled, style],
      [variant, size, disabled, style]
    );

    // Memoize callback to prevent child re-renders
    const handlePress = useCallback(() => {
      if (!disabled) {
        onPress();
      }
    }, [disabled, onPress]);

    return (
      <Pressable
        ref={ref}
        style={buttonStyle}
        onPress={handlePress}
        disabled={disabled}
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
      >
        <Text style={styles.text}>{children}</Text>
      </Pressable>
    );
  }
);

Button.displayName = 'Button';
```

#### Custom Hooks Pattern (Separation of Concerns)
```typescript
import { useState, useCallback, useEffect } from 'react';

// Types
interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface UseFetchReturn<T> extends FetchState<T> {
  refetch: () => Promise<void>;
}

// Custom hook for data fetching
export function useFetch<T>(url: string): UseFetchReturn<T> {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data = await response.json();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}

// Usage in component
function UserProfile({ userId }: { userId: string }) {
  const { data: user, loading, error, refetch } = useFetch<User>(`/api/users/${userId}`);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error.message} onRetry={refetch} />;
  if (!user) return null;

  return <ProfileCard user={user} />;
}
```

#### Compound Component Pattern
```typescript
import { createContext, useContext, useState, type ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';

// Context for compound component
interface AccordionContextValue {
  expandedId: string | null;
  toggle: (id: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordionContext() {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error('Accordion components must be used within Accordion.Root');
  }
  return context;
}

// Root component
function AccordionRoot({ children }: { children: ReactNode }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <AccordionContext.Provider value={{ expandedId, toggle }}>
      <View>{children}</View>
    </AccordionContext.Provider>
  );
}

// Item component
function AccordionItem({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const { expandedId, toggle } = useAccordionContext();
  const isExpanded = expandedId === id;

  return (
    <View>
      <Pressable onPress={() => toggle(id)} accessibilityRole="button">
        <Text>{title}</Text>
      </Pressable>
      {isExpanded && <View>{children}</View>}
    </View>
  );
}

// Export as compound component
export const Accordion = {
  Root: AccordionRoot,
  Item: AccordionItem,
};
```

### Anti-Patterns to Avoid

```typescript
// BAD: God component with too many responsibilities
function BadUserDashboard() {
  // 300+ lines mixing data fetching, state, UI, business logic
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({});
  const [sortOrder, setSortOrder] = useState('asc');
  // ... 20 more useState calls

  // BAD: Inline function in render causes re-renders
  return (
    <FlatList
      data={users}
      renderItem={({ item }) => <UserCard user={item} />} // Creates new function every render
      keyExtractor={(item, index) => index.toString()} // BAD: Using index as key
    />
  );
}

// BAD: Direct state mutation
function BadCounter() {
  const [state, setState] = useState({ count: 0 });

  const increment = () => {
    state.count++; // BAD: Direct mutation
    setState(state); // React won't detect change
  };
}

// BAD: Declaring state as variable
function BadComponent() {
  let count = 0; // BAD: Will reset on every render

  return <Text>{count}</Text>;
}

// BAD: Overusing useEffect
function BadDataFetcher({ id }: { id: string }) {
  const [data, setData] = useState(null);

  // BAD: Running on every render
  useEffect(() => {
    fetch(`/api/item/${id}`).then(res => res.json()).then(setData);
  }); // Missing dependency array
}
```

### When to Use

| Pattern | Use When | Avoid When |
|---------|----------|------------|
| Functional Components | Always (2025 standard) | Never - class components are legacy |
| Custom Hooks | Logic is reused across components | Logic is component-specific |
| forwardRef | Component wraps native element needing ref access | React 19+ (use ref prop directly) |
| Compound Components | Component has related subcomponents | Simple, self-contained component |
| React.memo | Component re-renders with same props frequently | Props change on every render |
| useMemo/useCallback | Computation is expensive (>5ms) or prevents re-renders | Simple operations |

---

## 2. Navigation Patterns

### Core Patterns

#### Static API Configuration (React Navigation 7+)
```typescript
import { createStaticNavigation, StaticParamList } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Define screens with static configuration (new v7 pattern)
const RootStack = createNativeStackNavigator({
  screens: {
    Home: {
      screen: HomeScreen,
      options: {
        title: 'Home',
      },
    },
    Profile: {
      screen: ProfileScreen,
      options: ({ route }) => ({
        title: route.params.name,
      }),
    },
    Settings: {
      screen: SettingsScreen,
      options: {
        presentation: 'modal',
      },
    },
  },
});

// Type-safe param list (auto-generated from static config)
type RootStackParamList = StaticParamList<typeof RootStack>;

// Create navigation component
const Navigation = createStaticNavigation(RootStack);

// App entry point
export function App() {
  return <Navigation />;
}
```

#### Type-Safe Navigation Hook
```typescript
import { useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Define param list for all screens
type RootStackParamList = {
  Home: undefined;
  Profile: { userId: string; name: string };
  Settings: { section?: 'account' | 'notifications' };
  ProductDetail: { productId: string };
};

// Typed navigation hook
function useAppNavigation() {
  return useNavigation<NativeStackNavigationProp<RootStackParamList>>();
}

// Typed route hook
function useAppRoute<T extends keyof RootStackParamList>() {
  return useRoute<RouteProp<RootStackParamList, T>>();
}

// Usage in component
function ProductCard({ product }: { product: Product }) {
  const navigation = useAppNavigation();

  const handlePress = useCallback(() => {
    // Type-safe navigation with params
    navigation.navigate('ProductDetail', { productId: product.id });
  }, [navigation, product.id]);

  return (
    <Pressable onPress={handlePress}>
      <Text>{product.name}</Text>
    </Pressable>
  );
}

function ProfileScreen() {
  const route = useAppRoute<'Profile'>();
  const { userId, name } = route.params; // Type-safe params

  return <Text>Welcome, {name}</Text>;
}
```

#### Authentication Flow Pattern
```typescript
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from './hooks/use-auth';

// Separate navigators for auth and main app
const AuthStack = createNativeStackNavigator({
  screens: {
    Login: LoginScreen,
    Register: RegisterScreen,
    ForgotPassword: ForgotPasswordScreen,
  },
});

const MainStack = createNativeStackNavigator({
  screens: {
    Home: HomeScreen,
    Profile: ProfileScreen,
    Settings: SettingsScreen,
  },
});

// Root navigator that switches based on auth state
function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  return isAuthenticated ? <MainStack.Navigator /> : <AuthStack.Navigator />;
}
```

#### Screen Preloading Pattern
```typescript
import { useNavigation } from '@react-navigation/native';

function ProductList() {
  const navigation = useNavigation();

  // Preload next likely screen for better perceived performance
  const handleProductHover = useCallback((productId: string) => {
    navigation.preload('ProductDetail', { productId });
  }, [navigation]);

  return (
    <FlatList
      data={products}
      renderItem={({ item }) => (
        <ProductCard
          product={item}
          onHoverIn={() => handleProductHover(item.id)}
        />
      )}
    />
  );
}
```

#### Focus Effect for Resource Cleanup
```typescript
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

function ChatScreen({ roomId }: { roomId: string }) {
  useFocusEffect(
    useCallback(() => {
      // Setup: Connect to WebSocket when screen is focused
      const ws = new WebSocket(`wss://chat.example.com/rooms/${roomId}`);

      ws.onmessage = (event) => {
        // Handle incoming messages
      };

      // Cleanup: Disconnect when screen loses focus
      return () => {
        ws.close();
      };
    }, [roomId])
  );

  return <ChatUI />;
}
```

### Anti-Patterns to Avoid

```typescript
// BAD: Navigating to nested screen without proper path
navigation.navigate('NestedScreen'); // Won't work if navigator not mounted

// GOOD: Use proper nested navigation syntax
navigation.navigate('ParentScreen', { screen: 'NestedScreen', params: { id: '123' } });

// BAD: Not typing navigation/route
function BadScreen() {
  const navigation = useNavigation(); // No type safety
  navigation.navigate('Profie'); // Typo won't be caught
}

// BAD: Complex conditional rendering instead of separate navigators
function BadApp() {
  const { user } = useAuth();

  return (
    <Stack.Navigator>
      {user ? (
        <>
          <Stack.Screen name="Home" component={Home} />
          <Stack.Screen name="Profile" component={Profile} />
        </>
      ) : (
        <Stack.Screen name="Login" component={Login} />
      )}
    </Stack.Navigator>
  );
}

// BAD: Not cleaning up subscriptions
function BadChatScreen() {
  useEffect(() => {
    const ws = new WebSocket('wss://...');
    // No cleanup - WebSocket stays open when navigating away
  }, []);
}
```

### When to Use

| Pattern | Use When | Avoid When |
|---------|----------|------------|
| Static API (v7) | New projects, better TypeScript support | Legacy projects on v6 |
| Dynamic API | Need runtime navigator configuration | Can use static config |
| Stack Navigator | Linear flows (auth, onboarding) | Tab-based main navigation |
| Tab Navigator | Main app sections | Deep nested flows |
| Drawer Navigator | Settings, secondary navigation | Primary navigation on small screens |
| Screen Preloading | Heavy screens user likely navigates to | All screens (wastes resources) |
| useFocusEffect | Resource setup/cleanup (WebSocket, intervals) | One-time initialization |

---

## 3. State Management Patterns

### Core Patterns

#### Zustand Store (Recommended for Most Apps)
```typescript
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

type AuthStore = AuthState & AuthActions;

// Create store with middleware
export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        token: null,
        isAuthenticated: false,

        // Actions
        login: (user, token) => {
          set({ user, token, isAuthenticated: true }, false, 'auth/login');
        },

        logout: () => {
          set({ user: null, token: null, isAuthenticated: false }, false, 'auth/logout');
        },

        updateUser: (updates) => {
          const currentUser = get().user;
          if (currentUser) {
            set({ user: { ...currentUser, ...updates } }, false, 'auth/updateUser');
          }
        },
      }),
      {
        name: 'auth-storage',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({ user: state.user, token: state.token }), // Only persist these
      }
    ),
    { name: 'AuthStore' }
  )
);

// Selectors for performance (prevent unnecessary re-renders)
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthActions = () => useAuthStore((state) => ({
  login: state.login,
  logout: state.logout
}));
```

#### Zustand Slice Pattern (Large Apps)
```typescript
import { create, StateCreator } from 'zustand';

// Auth slice
interface AuthSlice {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

const createAuthSlice: StateCreator<AuthSlice & CartSlice, [], [], AuthSlice> = (set) => ({
  user: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
});

// Cart slice
interface CartSlice {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
}

const createCartSlice: StateCreator<AuthSlice & CartSlice, [], [], CartSlice> = (set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
  clearCart: () => set({ items: [] }),
});

// Combined store
export const useStore = create<AuthSlice & CartSlice>()((...args) => ({
  ...createAuthSlice(...args),
  ...createCartSlice(...args),
}));
```

#### Redux Toolkit Pattern (Enterprise Apps)
```typescript
import { configureStore, createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

// Async thunk for API calls
export const fetchUser = createAsyncThunk(
  'user/fetch',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch');
      return await response.json();
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

// Slice
interface UserState {
  data: User | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: UserState = {
  data: null,
  status: 'idle',
  error: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearUser: (state) => {
      state.data = null;
      state.status = 'idle';
      state.error = null;
    },
    updateUserName: (state, action: PayloadAction<string>) => {
      if (state.data) {
        state.data.name = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      });
  },
});

// Store configuration
export const store = configureStore({
  reducer: {
    user: userSlice.reducer,
    // other slices...
  },
});

// Typed hooks
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

#### MobX Pattern (Reactive Apps)
```typescript
import { makeAutoObservable, runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';

// Store class
class UserStore {
  user: User | null = null;
  isLoading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  // Computed value
  get isAuthenticated() {
    return this.user !== null;
  }

  // Action
  async fetchUser(userId: string) {
    this.isLoading = true;
    this.error = null;

    try {
      const response = await fetch(`/api/users/${userId}`);
      const data = await response.json();

      runInAction(() => {
        this.user = data;
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.error = (error as Error).message;
        this.isLoading = false;
      });
    }
  }

  logout() {
    this.user = null;
  }
}

// Create singleton
export const userStore = new UserStore();

// Observer component
const UserProfile = observer(() => {
  const { user, isLoading, isAuthenticated } = userStore;

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <LoginPrompt />;

  return <Text>{user?.name}</Text>;
});
```

### Decision Tree

```
Is it server data (from API)?
├─ YES → React Query / TanStack Query
└─ NO → Is it needed across multiple unrelated components?
    ├─ YES → Is app enterprise-scale with complex state?
    │   ├─ YES → Redux Toolkit
    │   └─ NO → Zustand
    └─ NO → Is it form data?
        ├─ YES → React Hook Form
        └─ NO → Is it frequently changing reactive data?
            ├─ YES → MobX
            └─ NO → useState/useReducer
```

### Anti-Patterns to Avoid

```typescript
// BAD: Prop drilling through many levels
function App() {
  const [user, setUser] = useState<User | null>(null);
  return <Layout user={user} setUser={setUser} />; // Passed through 5+ components
}

// BAD: Storing server data in global state
const useStore = create((set) => ({
  users: [], // BAD: This should be in React Query
  fetchUsers: async () => {
    const users = await api.getUsers();
    set({ users });
  },
}));

// BAD: Not using selectors (causes unnecessary re-renders)
function BadComponent() {
  const store = useStore(); // Re-renders on ANY state change
  return <Text>{store.user.name}</Text>;
}

// GOOD: Use selectors
function GoodComponent() {
  const userName = useStore((state) => state.user.name); // Only re-renders when name changes
  return <Text>{userName}</Text>;
}

// BAD: Mutating state directly
const store = useStore.getState();
store.items.push(newItem); // Direct mutation won't trigger re-render

// GOOD: Use actions
useStore.getState().addItem(newItem);
```

### When to Use

| Library | Best For | Bundle Size | Learning Curve |
|---------|----------|-------------|----------------|
| Zustand | Small-to-medium apps, simple API | ~1KB | Easy |
| Redux Toolkit | Enterprise apps, complex state, team standardization | Larger | Moderate |
| MobX | Reactive data, frequent updates, less boilerplate | Medium | Easy |
| Context API | Theme, locale, truly global static config | Built-in | Easy |
| React Query | Server state (API data) | Medium | Moderate |

---

## 4. Styling Patterns

### Core Patterns

#### StyleSheet (Foundation)
```typescript
import { StyleSheet, View, Text, type ViewStyle, type TextStyle } from 'react-native';

// Design tokens as constants
const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

const COLORS = {
  primary: '#007AFF',
  secondary: '#5856D6',
  background: '#FFFFFF',
  text: '#000000',
  textSecondary: '#8E8E93',
  border: '#C6C6C8',
  error: '#FF3B30',
  success: '#34C759',
} as const;

const FONT_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

// Typed styles
interface Styles {
  container: ViewStyle;
  card: ViewStyle;
  title: TextStyle;
  subtitle: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
  },
  card: {
    padding: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // Android shadow
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
});
```

#### NativeWind (Tailwind for React Native)
```typescript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#007AFF',
        secondary: '#5856D6',
      },
      spacing: {
        '4.5': '18px',
      },
    },
  },
};

// Component with NativeWind
import { View, Text, Pressable } from 'react-native';

interface CardProps {
  title: string;
  description: string;
  onPress: () => void;
  variant?: 'default' | 'highlighted';
}

export function Card({ title, description, onPress, variant = 'default' }: CardProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`
        p-4 rounded-xl bg-white shadow-md
        ${variant === 'highlighted' ? 'border-2 border-primary' : 'border border-gray-200'}
        active:opacity-80
      `}
    >
      <Text className="text-xl font-bold text-gray-900 mb-2">{title}</Text>
      <Text className="text-base text-gray-600">{description}</Text>
    </Pressable>
  );
}

// Dynamic styling with NativeWind
function DynamicButton({ isActive }: { isActive: boolean }) {
  return (
    <Pressable
      className={`
        px-6 py-3 rounded-full
        ${isActive ? 'bg-primary' : 'bg-gray-200'}
      `}
    >
      <Text className={isActive ? 'text-white' : 'text-gray-800'}>
        {isActive ? 'Active' : 'Inactive'}
      </Text>
    </Pressable>
  );
}
```

#### CVA Pattern (Class Variance Authority)
```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import { Pressable, Text } from 'react-native';

// Define variants with cva
const buttonVariants = cva(
  'flex-row items-center justify-center rounded-lg font-semibold', // Base styles
  {
    variants: {
      variant: {
        primary: 'bg-primary',
        secondary: 'bg-secondary',
        outline: 'bg-transparent border-2 border-primary',
        ghost: 'bg-transparent',
      },
      size: {
        sm: 'px-3 py-2',
        md: 'px-4 py-3',
        lg: 'px-6 py-4',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

const buttonTextVariants = cva('font-semibold', {
  variants: {
    variant: {
      primary: 'text-white',
      secondary: 'text-white',
      outline: 'text-primary',
      ghost: 'text-primary',
    },
    size: {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

// Props type from variants
interface ButtonProps extends VariantProps<typeof buttonVariants> {
  children: string;
  onPress: () => void;
  disabled?: boolean;
}

export function Button({ children, variant, size, onPress, disabled }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={buttonVariants({ variant, size })}
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <Text className={buttonTextVariants({ variant, size })}>{children}</Text>
    </Pressable>
  );
}

// Usage
<Button variant="primary" size="lg" onPress={handleSubmit}>Submit</Button>
<Button variant="outline" onPress={handleCancel}>Cancel</Button>
```

#### Hybrid Approach (StyleSheet + Dynamic)
```typescript
import { StyleSheet, View, Text, type ViewStyle } from 'react-native';

interface ThemedCardProps {
  children: React.ReactNode;
  backgroundColor?: string; // Dynamic runtime value
  elevation?: 'low' | 'medium' | 'high'; // Static variant
}

export function ThemedCard({ children, backgroundColor, elevation = 'medium' }: ThemedCardProps) {
  // Combine static styles with dynamic values
  const cardStyle: ViewStyle[] = [
    styles.card,
    styles[`elevation${elevation.charAt(0).toUpperCase() + elevation.slice(1)}`],
    backgroundColor ? { backgroundColor } : undefined,
  ].filter(Boolean) as ViewStyle[];

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  elevationLow: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  elevationMedium: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  elevationHigh: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
});
```

### Anti-Patterns to Avoid

```typescript
// BAD: Inline styles (creates new object every render)
function BadComponent() {
  return (
    <View style={{ padding: 16, margin: 8 }}> {/* New object every render */}
      <Text style={{ fontSize: 16, color: 'blue' }}>Hello</Text>
    </View>
  );
}

// BAD: Magic numbers without design tokens
const badStyles = StyleSheet.create({
  container: {
    padding: 17, // What's 17? Why not 16?
    marginTop: 23, // Inconsistent with design system
    fontSize: 15.5, // Odd font size
  },
});

// BAD: Hardcoded colors
const badStyles2 = StyleSheet.create({
  text: {
    color: '#333333', // Should be from color tokens
  },
});

// BAD: Platform-specific styles mixed without Platform.select
const badStyles3 = StyleSheet.create({
  shadow: {
    shadowColor: '#000', // iOS only
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // Android only
    // Works but unclear what applies where
  },
});

// GOOD: Clear platform separation
const goodStyles = StyleSheet.create({
  shadow: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      elevation: 3,
    },
  }),
});
```

### When to Use

| Approach | Use When | Avoid When |
|----------|----------|------------|
| StyleSheet | Foundation for all apps, performance-critical | Need rapid prototyping |
| NativeWind | Team familiar with Tailwind, rapid development | Heavy customization of third-party components |
| CVA | Components with multiple variants | Simple components without variants |
| Inline styles | Truly dynamic runtime values | Static styles (use StyleSheet) |
| styled-components | Team prefers CSS-in-JS, complex theming | Performance-critical lists |

---

## 5. Platform-Specific Code Patterns

### Core Patterns

#### Platform.select API
```typescript
import { Platform, StyleSheet } from 'react-native';

// Style selection
const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      default: {
        // Web or other platforms
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  text: {
    fontFamily: Platform.select({
      ios: 'San Francisco',
      android: 'Roboto',
      default: 'System',
    }),
    fontWeight: Platform.select({
      ios: '600',
      android: '700', // Android only supports 'normal' and 'bold' reliably
    }),
  },
});

// Component selection
const HapticFeedback = Platform.select({
  ios: () => require('./haptic-feedback.ios').HapticFeedback,
  android: () => require('./haptic-feedback.android').HapticFeedback,
  default: () => () => null, // No haptics on web
})();
```

#### Platform-Specific File Extensions
```
components/
├── button/
│   ├── button.tsx           # Shared logic
│   ├── button.ios.tsx       # iOS-specific implementation
│   ├── button.android.tsx   # Android-specific implementation
│   └── button.native.tsx    # Shared between iOS/Android (not web)
```

```typescript
// button.ios.tsx
import { Pressable, Text } from 'react-native';
import * as Haptics from 'expo-haptics';

export function Button({ onPress, children }: ButtonProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable onPress={handlePress} style={styles.button}>
      <Text style={styles.text}>{children}</Text>
    </Pressable>
  );
}

// button.android.tsx
import { Pressable, Text } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

export function Button({ onPress, children }: ButtonProps) {
  const handlePress = () => {
    ReactNativeHapticFeedback.trigger('impactMedium');
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
      style={styles.button}
    >
      <Text style={styles.text}>{children}</Text>
    </Pressable>
  );
}
```

#### Safe Area Handling
```typescript
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, StatusBar, View } from 'react-native';

// Using SafeAreaView wrapper
function ScreenWithSafeArea() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <YourContent />
    </SafeAreaView>
  );
}

// Using insets hook for custom layouts
function CustomHeader() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingHorizontal: 16,
        backgroundColor: '#007AFF',
      }}
    >
      <Text style={styles.headerTitle}>My App</Text>
    </View>
  );
}

// Status bar handling
function App() {
  return (
    <>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
        backgroundColor={Platform.OS === 'android' ? '#007AFF' : undefined}
        translucent={Platform.OS === 'android'}
      />
      <MainNavigator />
    </>
  );
}
```

#### Keyboard Behavior
```typescript
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

function FormScreen() {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.select({
        ios: 64, // Header height
        android: 0,
      })}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <FormContent />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

#### Platform Version Checks
```typescript
import { Platform } from 'react-native';

// Check platform version
if (Platform.OS === 'android' && Platform.Version >= 33) {
  // Android 13+ specific code (e.g., notification permissions)
}

if (Platform.OS === 'ios') {
  const majorVersion = parseInt(Platform.Version as string, 10);
  if (majorVersion >= 16) {
    // iOS 16+ specific code
  }
}

// Feature detection pattern
const supportsBlurView = Platform.OS === 'ios' || Platform.Version >= 31; // Android 12+
```

### Anti-Patterns to Avoid

```typescript
// BAD: Assuming same behavior across platforms
function BadComponent() {
  return (
    <Text style={{ fontWeight: '600' }}> {/* 600 won't work on Android */}
      Hello
    </Text>
  );
}

// BAD: Not handling safe areas
function BadScreen() {
  return (
    <View style={{ flex: 1 }}>
      {/* Content will be hidden behind notch/Dynamic Island */}
      <Header />
    </View>
  );
}

// BAD: Waiting until end of project to test both platforms
// Test on BOTH platforms from day one

// BAD: Hardcoded dimensions that don't account for different screen sizes
const styles = StyleSheet.create({
  container: {
    height: 812, // iPhone X height - won't work on other devices
  },
});

// BAD: Not considering platform UX conventions
function BadButton() {
  // iOS users expect subtle feedback
  // Android users expect ripple effect
  return <TouchableOpacity onPress={handlePress}>...</TouchableOpacity>;
}
```

### When to Use

| Pattern | Use When | Avoid When |
|---------|----------|------------|
| Platform.select | Small style/value differences | Large implementation differences |
| Platform-specific files | Significantly different implementations | Minor differences |
| .native.tsx | Code shared between iOS/Android but not web | All platforms need same code |
| Version checks | Using APIs available only in newer OS versions | General platform differences |

---

## 6. Native Module Integration

### Core Patterns

#### TurboModule Specification (New Architecture)
```typescript
// src/specs/NativeCalculator.ts
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// Interface MUST be named 'Spec'
export interface Spec extends TurboModule {
  // Synchronous method
  add(a: number, b: number): number;

  // Asynchronous method
  multiply(a: number, b: number): Promise<number>;

  // Method with callback
  divide(
    a: number,
    b: number,
    onSuccess: (result: number) => void,
    onError: (error: string) => void
  ): void;

  // Constants
  getConstants(): {
    PI: number;
    E: number;
  };
}

// Export with proper naming
export default TurboModuleRegistry.getEnforcing<Spec>('NativeCalculator');
```

#### Using TurboModule in Component
```typescript
import NativeCalculator from './specs/NativeCalculator';

function CalculatorScreen() {
  const [result, setResult] = useState<number | null>(null);

  const handleCalculate = async () => {
    try {
      // Synchronous call (executes on UI thread via JSI)
      const sum = NativeCalculator.add(5, 3);

      // Asynchronous call
      const product = await NativeCalculator.multiply(4, 7);

      setResult(sum + product);
    } catch (error) {
      console.error('Calculation failed:', error);
    }
  };

  // Access constants
  const constants = NativeCalculator.getConstants();

  return (
    <View>
      <Text>PI: {constants.PI}</Text>
      <Button onPress={handleCalculate} title="Calculate" />
      {result !== null && <Text>Result: {result}</Text>}
    </View>
  );
}
```

#### Lazy Loading Pattern
```typescript
// Lazy load TurboModule only when needed
let _heavyModule: typeof import('./specs/NativeHeavyModule').default | null = null;

function getHeavyModule() {
  if (!_heavyModule) {
    _heavyModule = require('./specs/NativeHeavyModule').default;
  }
  return _heavyModule;
}

function FeatureScreen() {
  const handleUseFeature = () => {
    const module = getHeavyModule();
    module.performHeavyOperation();
  };

  return <Button onPress={handleUseFeature} title="Use Feature" />;
}
```

#### Native Module with Events
```typescript
// NativeEventModule.ts
import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';

const { NativeEventModule } = NativeModules;
const eventEmitter = new NativeEventEmitter(NativeEventModule);

interface LocationEvent {
  latitude: number;
  longitude: number;
  accuracy: number;
}

// Custom hook for native events
export function useLocationUpdates(onLocation: (location: LocationEvent) => void) {
  useEffect(() => {
    const subscription: EmitterSubscription = eventEmitter.addListener(
      'onLocationUpdate',
      onLocation
    );

    // Start updates
    NativeEventModule.startLocationUpdates();

    return () => {
      subscription.remove();
      NativeEventModule.stopLocationUpdates();
    };
  }, [onLocation]);
}

// Usage
function LocationTracker() {
  const [location, setLocation] = useState<LocationEvent | null>(null);

  useLocationUpdates(useCallback((newLocation) => {
    setLocation(newLocation);
  }, []));

  return location ? (
    <Text>Lat: {location.latitude}, Lng: {location.longitude}</Text>
  ) : (
    <Text>Waiting for location...</Text>
  );
}
```

#### Expo Modules API (Expo Projects)
```typescript
// modules/my-module/src/MyModule.ts
import { NativeModule, requireNativeModule } from 'expo-modules-core';

interface MyModuleEvents {
  onDataReceived: (data: { value: string }) => void;
}

declare class MyModuleType extends NativeModule<MyModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

export default requireNativeModule<MyModuleType>('MyModule');

// Usage in component
import MyModule from './modules/my-module';

function MyComponent() {
  const [value, setValue] = useState('');

  useEffect(() => {
    const subscription = MyModule.addListener('onDataReceived', (event) => {
      setValue(event.value);
    });

    return () => subscription.remove();
  }, []);

  return <Text>{MyModule.hello()} - PI is {MyModule.PI}</Text>;
}
```

### Anti-Patterns to Avoid

```typescript
// BAD: Sending large data through JSI
NativeModule.processLargeArray(hugeArray); // Can block UI thread

// GOOD: Process on native side, return minimal result
const summary = await NativeModule.processAndSummarize(dataId);

// BAD: Not checking if module exists
NativeModule.someMethod(); // Crashes if module not registered

// GOOD: Safe access pattern
const module = TurboModuleRegistry.get<Spec>('MyModule');
if (module) {
  module.someMethod();
} else {
  console.warn('MyModule not available');
}

// BAD: Blocking UI with synchronous calls in render
function BadComponent() {
  // Don't do synchronous native calls during render
  const value = NativeModule.expensiveSync();
  return <Text>{value}</Text>;
}

// GOOD: Use effect or async
function GoodComponent() {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    const result = NativeModule.expensiveSync();
    setValue(result);
  }, []);

  return <Text>{value}</Text>;
}

// BAD: Not cleaning up event subscriptions
useEffect(() => {
  eventEmitter.addListener('event', handler);
  // Missing cleanup!
}, []);
```

### When to Use

| Pattern | Use When | Avoid When |
|---------|----------|------------|
| TurboModules | New Architecture apps, performance-critical native code | Legacy bridge-based projects |
| Expo Modules | Expo managed/bare projects | Non-Expo projects |
| Native Events | Continuous data streams (location, sensors) | One-time operations |
| Lazy Loading | Rarely-used heavy modules | Frequently-used modules |
| Synchronous calls | Need immediate result, fast operation | Expensive operations |

---

## 7. Performance Optimization

### Core Patterns

#### Hermes Configuration
```javascript
// android/app/build.gradle
project.ext.react = [
    enableHermes: true, // Enable Hermes engine
    hermesCommand: "../../node_modules/react-native/sdks/hermesc/%OS-BIN%/hermesc",
]

// ios/Podfile
:hermes_enabled => true
```

#### FlatList Optimization
```typescript
import { FlatList, type ListRenderItem } from 'react-native';

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
}

// Constants for list configuration
const ITEM_HEIGHT = 80;
const WINDOW_SIZE = 5;
const MAX_TO_RENDER_PER_BATCH = 10;
const INITIAL_NUM_TO_RENDER = 10;

// Memoized item component
const ProductItem = memo(function ProductItem({
  item,
  onPress
}: {
  item: Product;
  onPress: (id: string) => void;
}) {
  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [item.id, onPress]);

  return (
    <Pressable onPress={handlePress} style={styles.item}>
      <Image source={{ uri: item.imageUrl }} style={styles.image} />
      <View style={styles.details}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.price}>${item.price}</Text>
      </View>
    </Pressable>
  );
});

function ProductList({ products }: { products: Product[] }) {
  const handleProductPress = useCallback((id: string) => {
    // Navigate to product detail
  }, []);

  // Stable renderItem with useCallback
  const renderItem: ListRenderItem<Product> = useCallback(
    ({ item }) => <ProductItem item={item} onPress={handleProductPress} />,
    [handleProductPress]
  );

  // Stable keyExtractor
  const keyExtractor = useCallback((item: Product) => item.id, []);

  // getItemLayout for fixed-height items (major performance win)
  const getItemLayout = useCallback(
    (_data: Product[] | null | undefined, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  return (
    <FlatList
      data={products}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      // Performance props
      windowSize={WINDOW_SIZE}
      maxToRenderPerBatch={MAX_TO_RENDER_PER_BATCH}
      initialNumToRender={INITIAL_NUM_TO_RENDER}
      removeClippedSubviews={Platform.OS === 'android'} // Android memory optimization
      // Prevent scroll indicator re-renders
      showsVerticalScrollIndicator={false}
    />
  );
}
```

#### Memoization Patterns
```typescript
import { memo, useMemo, useCallback } from 'react';

// Memoized component
const ExpensiveComponent = memo(function ExpensiveComponent({
  data,
  onUpdate
}: {
  data: DataType;
  onUpdate: () => void;
}) {
  // Only re-renders when data or onUpdate reference changes
  return <View>...</View>;
});

// useMemo for expensive computations
function DataProcessor({ items }: { items: Item[] }) {
  const processedData = useMemo(() => {
    // Only recalculates when items change
    return items
      .filter((item) => item.isActive)
      .map((item) => ({ ...item, computed: heavyCalculation(item) }))
      .sort((a, b) => a.computed - b.computed);
  }, [items]);

  return <ItemList data={processedData} />;
}

// useCallback for stable function references
function ParentComponent() {
  const [count, setCount] = useState(0);

  // Stable reference - child won't re-render when count changes
  const handlePress = useCallback(() => {
    console.log('Pressed');
  }, []);

  return (
    <>
      <Text>{count}</Text>
      <MemoizedChild onPress={handlePress} />
    </>
  );
}
```

#### Image Optimization
```typescript
import FastImage from 'react-native-fast-image';

// Use FastImage for better caching
function OptimizedImage({ uri }: { uri: string }) {
  return (
    <FastImage
      style={styles.image}
      source={{
        uri,
        priority: FastImage.priority.normal,
        cache: FastImage.cacheControl.immutable,
      }}
      resizeMode={FastImage.resizeMode.cover}
    />
  );
}

// Preload images
FastImage.preload([
  { uri: 'https://example.com/image1.jpg' },
  { uri: 'https://example.com/image2.jpg' },
]);

// Use proper image sizes
const IMAGE_SIZE = {
  thumbnail: { width: 100, height: 100 },
  medium: { width: 300, height: 300 },
  large: { width: 600, height: 600 },
};

function ResponsiveImage({ baseUri, size }: { baseUri: string; size: keyof typeof IMAGE_SIZE }) {
  const dimensions = IMAGE_SIZE[size];
  // Request appropriately sized image from CDN
  const uri = `${baseUri}?w=${dimensions.width}&h=${dimensions.height}&format=webp`;

  return <FastImage source={{ uri }} style={dimensions} />;
}
```

#### Lazy Loading Screens
```typescript
import { lazy, Suspense } from 'react';

// Lazy load heavy screens
const HeavyDashboard = lazy(() => import('./screens/heavy-dashboard'));
const AnalyticsScreen = lazy(() => import('./screens/analytics'));

function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Navigator>
        <Screen name="Dashboard" component={HeavyDashboard} />
        <Screen name="Analytics" component={AnalyticsScreen} />
      </Navigator>
    </Suspense>
  );
}

// Inline requires for conditional modules
function FeatureScreen() {
  const handleAdvancedFeature = () => {
    // Only load when needed
    const AdvancedModule = require('./advanced-module').default;
    AdvancedModule.activate();
  };

  return <Button onPress={handleAdvancedFeature} title="Use Advanced Feature" />;
}
```

### Performance Checklist

```typescript
// Performance monitoring hook
function useRenderCount(componentName: string) {
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;
    if (__DEV__ && renderCount.current > 10) {
      console.warn(`${componentName} has rendered ${renderCount.current} times`);
    }
  });
}

// Avoid these patterns:
// 1. Inline objects in render
<Component style={{ padding: 10 }} /> // BAD - new object every render

// 2. Inline functions in render
<Component onPress={() => doSomething(id)} /> // BAD - new function every render

// 3. Inline arrays
<Component data={[1, 2, 3]} /> // BAD - new array every render

// 4. Spreading props with extra data
<Component {...props} extraData={new Date()} /> // BAD - Date changes every render
```

### Anti-Patterns to Avoid

```typescript
// BAD: Using ScrollView for long lists
function BadList({ items }: { items: Item[] }) {
  return (
    <ScrollView>
      {items.map((item) => <ItemComponent key={item.id} item={item} />)}
    </ScrollView>
  ); // Renders ALL items at once
}

// BAD: No keyExtractor or using index
<FlatList
  data={items}
  keyExtractor={(item, index) => index.toString()} // BAD: Index as key
/>

// BAD: Expensive operations in render
function BadComponent({ items }: { items: Item[] }) {
  // Runs on EVERY render
  const sortedItems = items.sort((a, b) => a.name.localeCompare(b.name));
  return <List data={sortedItems} />;
}

// BAD: Over-memoizing simple operations
const value = useMemo(() => a + b, [a, b]); // Addition is not expensive

// BAD: Missing dependencies
const handler = useCallback(() => {
  doSomething(currentId); // currentId not in deps
}, []); // Stale closure
```

### When to Optimize

| Technique | Use When | Avoid When |
|-----------|----------|------------|
| React.memo | Component re-renders with same props | Props change frequently |
| useMemo | Computation takes >5ms | Simple operations |
| useCallback | Passing callbacks to memoized children | No memoized children |
| FlatList | Lists with >50 items | Short lists (<20 items) |
| getItemLayout | Items have fixed height | Dynamic height items |
| FastImage | Many images, need caching | Few images, simple use case |
| Lazy loading | Heavy screens not immediately needed | Critical path screens |

---

## 8. Gesture Handling

### Core Patterns

#### Basic Gesture with Reanimated 3+
```typescript
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDecay,
  runOnJS,
} from 'react-native-reanimated';

function DraggableCard() {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  // Memoize gesture for performance
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          scale.value = withSpring(1.1);
        })
        .onUpdate((event) => {
          translateX.value = event.translationX;
          translateY.value = event.translationY;
        })
        .onEnd((event) => {
          // Decay animation based on velocity
          translateX.value = withDecay({ velocity: event.velocityX });
          translateY.value = withDecay({ velocity: event.velocityY });
          scale.value = withSpring(1);
        }),
    []
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <Text>Drag me</Text>
      </Animated.View>
    </GestureDetector>
  );
}
```

#### Swipe to Delete Pattern
```typescript
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

const SWIPE_THRESHOLD = -100;
const DELETE_THRESHOLD = -200;

interface SwipeableItemProps {
  children: React.ReactNode;
  onDelete: () => void;
}

function SwipeableItem({ children, onDelete }: SwipeableItemProps) {
  const translateX = useSharedValue(0);
  const itemHeight = useSharedValue(80);
  const opacity = useSharedValue(1);

  const handleDelete = useCallback(() => {
    onDelete();
  }, [onDelete]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .onUpdate((event) => {
          // Only allow swipe left
          translateX.value = Math.min(0, event.translationX);
        })
        .onEnd((event) => {
          if (translateX.value < DELETE_THRESHOLD) {
            // Delete animation
            translateX.value = withTiming(-500);
            itemHeight.value = withTiming(0);
            opacity.value = withTiming(0, {}, () => {
              runOnJS(handleDelete)();
            });
          } else if (translateX.value < SWIPE_THRESHOLD) {
            // Show delete button
            translateX.value = withTiming(SWIPE_THRESHOLD);
          } else {
            // Snap back
            translateX.value = withTiming(0);
          }
        }),
    [handleDelete]
  );

  const itemStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    height: itemHeight.value,
    opacity: opacity.value,
  }));

  const deleteButtonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.deleteButton, deleteButtonStyle]}>
        <Text style={styles.deleteText}>Delete</Text>
      </Animated.View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.item, itemStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}
```

#### Pinch to Zoom Pattern
```typescript
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

const MIN_SCALE = 1;
const MAX_SCALE = 5;

function ZoomableImage({ source }: { source: { uri: string } }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onUpdate((event) => {
          const newScale = savedScale.value * event.scale;
          scale.value = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
          focalX.value = event.focalX;
          focalY.value = event.focalY;
        })
        .onEnd(() => {
          savedScale.value = scale.value;
          if (scale.value < MIN_SCALE) {
            scale.value = withTiming(MIN_SCALE);
            savedScale.value = MIN_SCALE;
          }
        }),
    []
  );

  const doubleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
          if (scale.value > 1) {
            scale.value = withTiming(1);
            savedScale.value = 1;
          } else {
            scale.value = withTiming(2);
            savedScale.value = 2;
          }
        }),
    []
  );

  const composedGesture = Gesture.Simultaneous(pinchGesture, doubleTapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.Image source={source} style={[styles.image, animatedStyle]} resizeMode="contain" />
    </GestureDetector>
  );
}
```

#### Bottom Sheet Pattern
```typescript
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SNAP_POINTS = {
  collapsed: SCREEN_HEIGHT - 100,
  half: SCREEN_HEIGHT / 2,
  expanded: 100,
};

interface BottomSheetProps {
  children: React.ReactNode;
  onClose?: () => void;
}

function BottomSheet({ children, onClose }: BottomSheetProps) {
  const translateY = useSharedValue(SNAP_POINTS.collapsed);
  const context = useSharedValue({ y: 0 });

  const snapToPoint = (point: number) => {
    'worklet';
    translateY.value = withSpring(point, { damping: 50 });
  };

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
          translateY.value = Math.max(
            SNAP_POINTS.expanded,
            context.value.y + event.translationY
          );
        })
        .onEnd((event) => {
          const velocity = event.velocityY;

          if (velocity > 500) {
            // Fast swipe down - collapse
            if (translateY.value > SNAP_POINTS.half) {
              snapToPoint(SNAP_POINTS.collapsed);
              if (onClose) runOnJS(onClose)();
            } else {
              snapToPoint(SNAP_POINTS.half);
            }
          } else if (velocity < -500) {
            // Fast swipe up - expand
            snapToPoint(SNAP_POINTS.expanded);
          } else {
            // Snap to nearest point
            const distances = [
              Math.abs(translateY.value - SNAP_POINTS.expanded),
              Math.abs(translateY.value - SNAP_POINTS.half),
              Math.abs(translateY.value - SNAP_POINTS.collapsed),
            ];
            const minIndex = distances.indexOf(Math.min(...distances));
            const points = [SNAP_POINTS.expanded, SNAP_POINTS.half, SNAP_POINTS.collapsed];
            snapToPoint(points[minIndex]);
          }
        }),
    [onClose]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [SNAP_POINTS.expanded, SNAP_POINTS.collapsed],
      [0.5, 0]
    ),
  }));

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.sheet, animatedStyle]}>
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </GestureDetector>
    </>
  );
}
```

### Anti-Patterns to Avoid

```typescript
// BAD: Not memoizing gestures
function BadComponent() {
  // Creates new gesture on every render - causes reattachment
  const gesture = Gesture.Pan().onUpdate((e) => { /* ... */ });

  return <GestureDetector gesture={gesture}>...</GestureDetector>;
}

// GOOD: Memoize gestures
function GoodComponent() {
  const gesture = useMemo(
    () => Gesture.Pan().onUpdate((e) => { /* ... */ }),
    []
  );

  return <GestureDetector gesture={gesture}>...</GestureDetector>;
}

// BAD: Animating layout properties
const badStyle = useAnimatedStyle(() => ({
  width: width.value, // Layout property - causes layout recalculation
  height: height.value,
}));

// GOOD: Animate transform properties
const goodStyle = useAnimatedStyle(() => ({
  transform: [
    { scaleX: width.value / initialWidth },
    { scaleY: height.value / initialHeight },
  ],
}));

// BAD: Calling JS functions directly in worklet
const panGesture = Gesture.Pan().onUpdate((e) => {
  setPosition(e.translationX); // BAD: JS function in worklet
});

// GOOD: Use runOnJS
const panGesture = Gesture.Pan().onUpdate((e) => {
  runOnJS(setPosition)(e.translationX);
});

// BAD: Not using worklet directive for shared value updates
const badGesture = Gesture.Pan().onUpdate((e) => {
  // Implicit worklet - can cause issues
  translateX.value = e.translationX;
});
```

### When to Use

| Technique | Use When | Avoid When |
|-----------|----------|------------|
| Reanimated | 60 FPS animations, complex gestures | Simple opacity/scale animations |
| Gesture Handler | Custom gesture interactions | Standard touch feedback |
| withSpring | Natural feeling movements | Precise timing needed |
| withDecay | Momentum-based scrolling | Specific destination needed |
| runOnJS | Need to call React setState from worklet | Pure animation logic |
| Simultaneous gestures | Pinch + pan combinations | Single gesture interactions |

---

## 9. Testing Patterns

### Core Patterns

#### Component Testing with RNTL
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { UserProfile } from './user-profile';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

describe('UserProfile', () => {
  const mockUser = {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders user information correctly', () => {
    render(<UserProfile user={mockUser} />);

    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getByText('john@example.com')).toBeTruthy();
  });

  it('navigates to edit screen on edit button press', () => {
    render(<UserProfile user={mockUser} />);

    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.press(editButton);

    expect(mockNavigate).toHaveBeenCalledWith('EditProfile', { userId: '1' });
  });

  it('shows loading state while updating', async () => {
    const mockOnUpdate = jest.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    render(<UserProfile user={mockUser} onUpdate={mockOnUpdate} />);

    const saveButton = screen.getByTestId('save-button');
    fireEvent.press(saveButton);

    expect(screen.getByTestId('loading-indicator')).toBeTruthy();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).toBeNull();
    });
  });

  it('displays error message on update failure', async () => {
    const mockOnUpdate = jest.fn().mockRejectedValue(new Error('Network error'));

    render(<UserProfile user={mockUser} onUpdate={mockOnUpdate} />);

    fireEvent.press(screen.getByTestId('save-button'));

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeTruthy();
    });
  });
});
```

#### Custom Hook Testing
```typescript
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAuth } from './use-auth';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('useAuth', () => {
  it('initializes with null user', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('logs in user successfully', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    expect(result.current.user).toEqual(
      expect.objectContaining({ email: 'test@example.com' })
    );
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('handles login error', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      try {
        await result.current.login('invalid@example.com', 'wrong');
      } catch (error) {
        // Expected error
      }
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
```

#### API Mocking with MSW
```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@testing-library/react-native';
import { ProductList } from './product-list';

// Setup MSW server
const server = setupServer(
  http.get('/api/products', () => {
    return HttpResponse.json([
      { id: '1', name: 'Product 1', price: 99.99 },
      { id: '2', name: 'Product 2', price: 149.99 },
    ]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ProductList', () => {
  it('fetches and displays products', async () => {
    render(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Product 1')).toBeTruthy();
      expect(screen.getByText('Product 2')).toBeTruthy();
    });
  });

  it('handles API error', async () => {
    server.use(
      http.get('/api/products', () => {
        return HttpResponse.json(
          { message: 'Internal server error' },
          { status: 500 }
        );
      })
    );

    render(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText(/error loading products/i)).toBeTruthy();
    });
  });

  it('shows empty state when no products', async () => {
    server.use(
      http.get('/api/products', () => {
        return HttpResponse.json([]);
      })
    );

    render(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText(/no products available/i)).toBeTruthy();
    });
  });
});
```

#### Detox E2E Test
```typescript
// e2e/login.test.ts
import { device, element, by, expect } from 'detox';

describe('Login Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should show login screen on app launch', async () => {
    await expect(element(by.id('login-screen'))).toBeVisible();
    await expect(element(by.id('email-input'))).toBeVisible();
    await expect(element(by.id('password-input'))).toBeVisible();
  });

  it('should show error for invalid credentials', async () => {
    await element(by.id('email-input')).typeText('invalid@test.com');
    await element(by.id('password-input')).typeText('wrongpassword');
    await element(by.id('login-button')).tap();

    await expect(element(by.text('Invalid credentials'))).toBeVisible();
  });

  it('should navigate to home on successful login', async () => {
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('correctpassword');
    await element(by.id('login-button')).tap();

    await expect(element(by.id('home-screen'))).toBeVisible();
    await expect(element(by.text('Welcome'))).toBeVisible();
  });

  it('should persist login state after app restart', async () => {
    // Login first
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('correctpassword');
    await element(by.id('login-button')).tap();

    await expect(element(by.id('home-screen'))).toBeVisible();

    // Restart app
    await device.terminateApp();
    await device.launchApp();

    // Should still be logged in
    await expect(element(by.id('home-screen'))).toBeVisible();
  });
});

// Handling permissions in Detox
describe('Camera Feature', () => {
  beforeAll(async () => {
    await device.launchApp({
      permissions: { camera: 'YES', photos: 'YES' },
    });
  });

  it('should open camera when permission granted', async () => {
    await element(by.id('take-photo-button')).tap();
    await expect(element(by.id('camera-view'))).toBeVisible();
  });
});
```

#### Test Utilities
```typescript
// test-utils/render.tsx
import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create providers wrapper
function AllProviders({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        {children}
      </NavigationContainer>
    </QueryClientProvider>
  );
}

// Custom render function
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything
export * from '@testing-library/react-native';
export { renderWithProviders as render };
```

### Anti-Patterns to Avoid

```typescript
// BAD: Testing implementation details
it('should set isLoading to true', () => {
  const { result } = renderHook(() => useData());
  expect(result.current.isLoading).toBe(true); // Implementation detail
});

// GOOD: Test behavior
it('should show loading indicator while fetching', () => {
  render(<DataComponent />);
  expect(screen.getByTestId('loading-spinner')).toBeTruthy();
});

// BAD: Not using async utilities properly
it('should load data', () => {
  render(<AsyncComponent />);
  expect(screen.getByText('Data loaded')).toBeTruthy(); // May fail - data not loaded yet
});

// GOOD: Use waitFor
it('should load data', async () => {
  render(<AsyncComponent />);
  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeTruthy();
  });
});

// BAD: Tests that depend on each other
it('first test', () => { /* sets up state */ });
it('second test', () => { /* depends on first test's state */ }); // Fragile

// BAD: Not cleaning up between tests
let globalVariable;
beforeAll(() => { globalVariable = setup(); });
// Missing afterEach/afterAll cleanup

// BAD: Hardcoded waits
it('should complete after action', async () => {
  fireEvent.press(button);
  await new Promise((r) => setTimeout(r, 2000)); // Flaky, slow
});

// GOOD: Use waitFor with condition
it('should complete after action', async () => {
  fireEvent.press(button);
  await waitFor(() => expect(screen.getByText('Complete')).toBeTruthy());
});
```

### Testing Strategy

| Test Type | Tool | Use For | Coverage Target |
|-----------|------|---------|-----------------|
| Unit | Jest | Pure functions, utilities | High |
| Component | RNTL | Individual components, interactions | Medium-High |
| Integration | RNTL + MSW | Component + API integration | Medium |
| E2E | Detox | Critical user flows (auth, checkout) | Low (vital paths) |
| Snapshot | Jest | UI regression detection | Selective |

---

## 10. Expo vs Bare Workflow

### Decision Matrix

```
Starting a new project?
├─ Need custom native modules (not available via Expo)?
│   ├─ YES → Bare workflow or Expo with development builds
│   └─ NO → Continue...
├─ App size critical (<15MB)?
│   ├─ YES → Bare workflow
│   └─ NO → Continue...
├─ Team has native (iOS/Android) expertise?
│   ├─ YES → Either (lean toward bare if complex native work needed)
│   └─ NO → Expo recommended
├─ Need OTA updates?
│   ├─ YES → Expo (EAS Update)
│   └─ NO → Either
└─ Default → Expo (95% of cases)
```

### Expo Managed Workflow

```typescript
// app.json - Expo configuration
{
  "expo": {
    "name": "MyApp",
    "slug": "my-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "bundleIdentifier": "com.company.myapp",
      "supportsTablet": true,
      "infoPlist": {
        "NSCameraUsageDescription": "This app uses the camera to scan QR codes"
      }
    },
    "android": {
      "package": "com.company.myapp",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FFFFFF"
      },
      "permissions": ["CAMERA"]
    },
    "plugins": [
      "expo-camera",
      "expo-location",
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow $(PRODUCT_NAME) to access your photos"
        }
      ]
    ]
  }
}
```

```typescript
// Using Expo SDK
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

function MediaFeatures() {
  const [cameraPermission, requestCameraPermission] = Camera.useCameraPermissions();

  const takePhoto = async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) return;
    }
    // Camera is ready
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      // Handle selected image
      console.log(result.assets[0].uri);
    }
  };

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const location = await Location.getCurrentPositionAsync({});
    return location.coords;
  };

  return (
    <View>
      <Button onPress={takePhoto} title="Take Photo" />
      <Button onPress={pickImage} title="Pick Image" />
      <Button onPress={getLocation} title="Get Location" />
    </View>
  );
}
```

### Expo with Development Builds (Hybrid)

```typescript
// eas.json - EAS Build configuration
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

```bash
# Build development client
npx eas build --profile development --platform ios

# Build for internal testing
npx eas build --profile preview --platform all

# Build for production
npx eas build --profile production --platform all

# Submit to stores
npx eas submit --platform ios
npx eas submit --platform android
```

### Bare Workflow Setup

```typescript
// metro.config.js - Bare workflow
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const config = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

```typescript
// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'react-native-reanimated/plugin', // Must be last
  ],
};
```

```typescript
// Native module integration in bare workflow
// android/app/src/main/java/com/myapp/MyNativeModule.kt
package com.myapp

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class MyNativeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "MyNativeModule"

    @ReactMethod
    fun performAction(value: String, promise: Promise) {
        try {
            val result = processValue(value)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
}
```

### Config Plugins (Expo)

```typescript
// plugins/with-custom-config.js
const { withInfoPlist, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withCustomConfig(config) {
  // iOS Info.plist modifications
  config = withInfoPlist(config, (config) => {
    config.modResults.NSLocationAlwaysUsageDescription =
      'This app needs location access for navigation';
    return config;
  });

  // Android manifest modifications
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    mainApplication.$['android:usesCleartextTraffic'] = 'true';
    return config;
  });

  return config;
};

// app.json
{
  "expo": {
    "plugins": [
      "./plugins/with-custom-config"
    ]
  }
}
```

### OTA Updates with EAS Update

```typescript
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';

function useOTAUpdates() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    async function checkForUpdates() {
      if (__DEV__) return; // Skip in development

      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          setUpdateAvailable(true);
        }
      } catch (error) {
        console.log('Error checking for updates:', error);
      }
    }

    checkForUpdates();
  }, []);

  const applyUpdate = async () => {
    setIsUpdating(true);
    try {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch (error) {
      console.log('Error applying update:', error);
      setIsUpdating(false);
    }
  };

  return { updateAvailable, isUpdating, applyUpdate };
}

// Usage in app
function App() {
  const { updateAvailable, isUpdating, applyUpdate } = useOTAUpdates();

  if (updateAvailable) {
    return (
      <UpdatePrompt
        onUpdate={applyUpdate}
        isUpdating={isUpdating}
      />
    );
  }

  return <MainApp />;
}
```

### Comparison Table

| Feature | Expo Managed | Expo Dev Build | Bare RN |
|---------|--------------|----------------|---------|
| Setup Time | Minutes | ~1 hour | Hours |
| Native Code Access | No | Yes | Yes |
| OTA Updates | Yes (EAS) | Yes (EAS) | Manual |
| App Size | 25MB+ | Configurable | <15MB possible |
| Build Service | EAS Build | EAS Build | Manual/Fastlane |
| Ejecting | Possible | N/A | N/A |
| New Architecture | Supported | Supported | Supported |
| Custom Native Modules | Via config plugins | Full access | Full access |

### When to Use Each

| Workflow | Best For |
|----------|----------|
| **Expo Managed** | Prototypes, MVPs, apps using standard device features, small teams, beginners |
| **Expo Dev Builds** | Production apps needing custom native code while keeping Expo tooling |
| **Bare React Native** | Apps requiring deep native customization, performance-critical apps, teams with native expertise |

---

## Sources

### Component Patterns
- [React Design Patterns and Best Practices for 2025](https://www.telerik.com/blogs/react-design-patterns-best-practices)
- [React & TypeScript: 10 Patterns](https://blog.logrocket.com/react-typescript-10-patterns-writing-better-code/)
- [React Native Best Practices for 2025](https://www.esparkinfo.com/blog/react-native-best-practices)

### Navigation
- [React Navigation Best Practices Guide](https://viewlytics.ai/blog/react-navigation-best-practices-guide)
- [React Navigation 7.0 Official Blog](https://reactnavigation.org/blog/2024/11/06/react-navigation-7.0/)
- [Type Checking with TypeScript](https://reactnavigation.org/docs/typescript/)

### State Management
- [State Management in 2025: When to Use Context, Redux, Zustand, or Jotai](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k)
- [5 React State Management Tools in 2025](https://www.syncfusion.com/blogs/post/react-state-management-libraries)
- [Zustand Comparison](https://zustand.docs.pmnd.rs/getting-started/comparison)

### Styling
- [NativeWind Documentation](https://www.nativewind.dev/v5)
- [Modern Approaches to Styling React Native Apps](https://blog.codeminer42.com/modern-approaches-to-styling-react-native-apps/)
- [Best Practices for Styling with NativeWind](https://huyha.zone/blog/post/styling-react-native-nativewind-styled-components/)

### Platform-Specific Code
- [Platform-Specific Code - React Native Docs](https://reactnative.dev/docs/platform-specific-code)
- [Handling Platform-Specific Differences](https://medium.com/@tusharkumar27864/navigating-the-two-worlds-handling-platform-specific-differences-in-react-native-f2805d9f7fce)

### Native Modules
- [TurboModules Introduction](https://reactnative.dev/docs/turbo-native-modules-introduction)
- [React Native New Architecture 2025 Guide](https://medium.com/@baheer224/react-native-new-architecture-explained-2025-guide-cc37c8f36a96)
- [TurboModules Performance Guide](https://medium.com/@himanshunarang_50239/the-power-of-turbomodules-in-react-native-a-99-performance-leap-70cd4fbdf81d)

### Performance
- [React Native Performance Optimization Guide](https://viewlytics.ai/blog/react-native-performance-optimization-guide)
- [Optimizing FlatList Configuration](https://reactnative.dev/docs/optimizing-flatlist-configuration)
- [React Native Performance Best Practices 2025](https://baltech.in/blog/react-native-performance-optimization-best-practices/)

### Gestures & Animations
- [React Native Reanimated 3 Ultimate Guide](https://dev.to/erenelagz/react-native-reanimated-3-the-ultimate-guide-to-high-performance-animations-in-2025-4ae4)
- [Reanimated Performance Guide](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/)
- [Handling Gestures with Reanimated](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/handling-gestures/)

### Testing
- [Testing Overview - React Native Docs](https://reactnative.dev/docs/testing-overview)
- [React Native Testing Strategies](https://viewlytics.ai/blog/react-native-testing-strategies-guide)
- [Mastering React Native Testing with Jest and RTL](https://www.creolestudios.com/react-native-testing-with-jest-and-rtl/)

### Expo vs Bare
- [Expo vs Bare React Native in 2025](https://www.godeltech.com/blog/expo-vs-bare-react-native-in-2025/)
- [Expo for React Native in 2025](https://hashrocket.com/blog/posts/expo-for-react-native-in-2025-a-perspective)
- [Expo or React Native CLI in 2025](https://dev.to/wafa_bergaoui/expo-or-react-native-cli-in-2025-lets-settle-this-cl1)

### Anti-Patterns
- [15 React Anti-Patterns and Fixes](https://jsdev.space/react-anti-patterns-2025/)
- [React Native Advanced Mistakes to Avoid](https://medium.com/@Amanda10/react-native-advanced-mistakes-to-avoid-in-2025-a-developers-guide-to-building-robust-apps-94048e49930e)
- [React Anti-Patterns and Best Practices](https://www.perssondennis.com/articles/react-anti-patterns-and-best-practices-dos-and-donts)
