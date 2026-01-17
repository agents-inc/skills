# Core Expo Patterns

Essential project setup, configuration, and development patterns.

---

## Project Initialization

```bash
# Create new Expo project with TypeScript
npx create-expo-app my-app --template blank-typescript

# Create with Expo Router template
npx create-expo-app my-app --template tabs

# Generate native directories (when needed)
npx expo prebuild

# Clean regeneration (resets native directories)
npx expo prebuild --clean
```

---

## App Configuration

### Static Configuration (app.json)

```json
{
  "expo": {
    "name": "MyApp",
    "slug": "my-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.example.myapp"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.example.myapp"
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

---

### Dynamic Configuration (app.config.ts)

```typescript
// app.config.ts
import type { ExpoConfig, ConfigContext } from "expo/config";

// Named constants for all configuration values
const APP_NAME = "MyApp";
const APP_SLUG = "my-app";
const APP_VERSION = "1.0.0";
const BUILD_NUMBER = 1;

const IOS_DEPLOYMENT_TARGET = "15.1";
const ANDROID_COMPILE_SDK = 35;
const ANDROID_TARGET_SDK = 35;
const ANDROID_MIN_SDK = 24;

const IS_PRODUCTION = process.env.APP_ENV === "production";
const IS_PREVIEW = process.env.APP_ENV === "preview";

function getAppName(): string {
  if (IS_PRODUCTION) return APP_NAME;
  if (IS_PREVIEW) return `${APP_NAME} (Preview)`;
  return `${APP_NAME} (Dev)`;
}

function getBundleIdentifier(): string {
  const base = "com.example.myapp";
  if (IS_PRODUCTION) return base;
  if (IS_PREVIEW) return `${base}.preview`;
  return `${base}.dev`;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getAppName(),
  slug: APP_SLUG,
  version: APP_VERSION,
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: getBundleIdentifier(),
    buildNumber: String(BUILD_NUMBER),
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: getBundleIdentifier(),
    versionCode: BUILD_NUMBER,
  },
  plugins: [
    "expo-router",
    [
      "expo-build-properties",
      {
        android: {
          compileSdkVersion: ANDROID_COMPILE_SDK,
          targetSdkVersion: ANDROID_TARGET_SDK,
          minSdkVersion: ANDROID_MIN_SDK,
        },
        ios: {
          deploymentTarget: IOS_DEPLOYMENT_TARGET,
        },
      },
    ],
  ],
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
    environment: process.env.APP_ENV || "development",
  },
  updates: {
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}`,
  },
  runtimeVersion: {
    policy: "appVersion",
  },
});
```

---

## Config Plugins

### Camera and Permissions

```typescript
// app.config.ts - Camera plugin configuration
plugins: [
  [
    "expo-camera",
    {
      cameraPermission: "Allow $(PRODUCT_NAME) to access your camera.",
      microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      recordAudioAndroid: true,
    },
  ],
];
```

### Location Services

```typescript
// app.config.ts - Location plugin configuration
plugins: [
  [
    "expo-location",
    {
      locationAlwaysAndWhenInUsePermission:
        "Allow $(PRODUCT_NAME) to use your location for navigation.",
      locationAlwaysPermission:
        "Allow $(PRODUCT_NAME) to use your location in the background.",
      locationWhenInUsePermission:
        "Allow $(PRODUCT_NAME) to use your location while using the app.",
      isAndroidBackgroundLocationEnabled: true,
      isAndroidForegroundServiceEnabled: true,
    },
  ],
];
```

### Notifications

```typescript
// app.config.ts - Notifications plugin configuration
plugins: [
  [
    "expo-notifications",
    {
      icon: "./assets/notification-icon.png",
      color: "#ffffff",
      sounds: ["./assets/sounds/notification.wav"],
      mode: "production",
    },
  ],
];
```

### Build Properties

```typescript
// app.config.ts - Build properties for SDK versions
const IOS_DEPLOYMENT_TARGET = "15.1";
const ANDROID_COMPILE_SDK = 35;
const ANDROID_TARGET_SDK = 35;
const ANDROID_MIN_SDK = 24;
const KOTLIN_VERSION = "1.9.24";

plugins: [
  [
    "expo-build-properties",
    {
      android: {
        compileSdkVersion: ANDROID_COMPILE_SDK,
        targetSdkVersion: ANDROID_TARGET_SDK,
        minSdkVersion: ANDROID_MIN_SDK,
        kotlinVersion: KOTLIN_VERSION,
        enableProguardInReleaseBuilds: true,
      },
      ios: {
        deploymentTarget: IOS_DEPLOYMENT_TARGET,
        useFrameworks: "static",
      },
    },
  ],
];
```

---

## Environment Variables

### Setup

```bash
# .env (committed - default values)
EXPO_PUBLIC_API_URL=https://api.example.com
EXPO_PUBLIC_APP_ENV=development

# .env.local (gitignored - local overrides)
EXPO_PUBLIC_API_URL=http://localhost:3000

# .env.production (committed - production values)
EXPO_PUBLIC_API_URL=https://api.example.com
EXPO_PUBLIC_APP_ENV=production
```

### Type-Safe Access

```typescript
// config/env.ts
const API_URL = process.env.EXPO_PUBLIC_API_URL;
const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV;

// IMPORTANT: Metro requires direct property access
// These patterns DON'T work:
// const { EXPO_PUBLIC_API_URL } = process.env;  // BAD
// process.env['EXPO_PUBLIC_API_URL'];           // BAD
// Object.keys(process.env).filter(...)          // BAD

if (!API_URL) {
  throw new Error("EXPO_PUBLIC_API_URL environment variable is required");
}

export const env = {
  apiUrl: API_URL,
  appEnv: APP_ENV ?? "development",
  isProduction: APP_ENV === "production",
  isDevelopment: APP_ENV === "development" || !APP_ENV,
} as const;

export type Environment = typeof env;
```

### Using Constants for Runtime Config

```typescript
// hooks/use-config.ts
import Constants from "expo-constants";

interface AppConfig {
  apiUrl: string;
  environment: string;
  projectId: string | undefined;
}

export function useConfig(): AppConfig {
  const extra = Constants.expoConfig?.extra;

  return {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://api.example.com",
    environment: extra?.environment ?? "development",
    projectId: extra?.eas?.projectId,
  };
}
```

---

## Font Loading

### Basic Font Loading

```typescript
// app/_layout.tsx
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Stack } from "expo-router";

// Prevent auto-hide before fonts load
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-Medium": require("../assets/fonts/Inter-Medium.ttf"),
    "Inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
    "Inter-Bold": require("../assets/fonts/Inter-Bold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return <Stack />;
}
```

### Google Fonts

```typescript
// Install: npx expo install @expo-google-fonts/inter
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

SplashScreen.preventAutoHideAsync();

export function useAppFonts() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  return { fontsLoaded, fontError };
}
```

### Config Plugin Font Loading (Recommended for Production)

```json
// app.json - Pre-bundle fonts at build time
{
  "expo": {
    "plugins": [
      [
        "expo-font",
        {
          "fonts": [
            "./assets/fonts/Inter-Regular.ttf",
            "./assets/fonts/Inter-Medium.ttf",
            "./assets/fonts/Inter-Bold.ttf"
          ]
        }
      ]
    ]
  }
}
```

---

## Image Handling

### Optimized Images with expo-image

```typescript
// components/optimized-image.tsx
import { Image, type ImageProps } from "expo-image";
import { StyleSheet } from "react-native";

const BLUR_HASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";
const IMAGE_TRANSITION_MS = 200;

interface OptimizedImageProps extends Omit<ImageProps, "source"> {
  uri: string;
  width: number;
  height: number;
  blurHash?: string;
}

export function OptimizedImage({
  uri,
  width,
  height,
  blurHash = BLUR_HASH,
  style,
  ...props
}: OptimizedImageProps) {
  return (
    <Image
      source={{ uri }}
      placeholder={blurHash}
      contentFit="cover"
      transition={IMAGE_TRANSITION_MS}
      cachePolicy="memory-disk"
      style={[{ width, height }, style]}
      {...props}
    />
  );
}

// Usage
<OptimizedImage
  uri="https://example.com/image.jpg"
  width={200}
  height={200}
/>
```

### Local Images

```typescript
// components/local-image.tsx
import { Image } from "expo-image";

// Static import - bundled at build time
const logoSource = require("../assets/images/logo.png");

export function Logo() {
  return (
    <Image
      source={logoSource}
      contentFit="contain"
      style={{ width: 120, height: 40 }}
    />
  );
}
```

### Asset Bundling Configuration

```json
// app.json - Configure asset bundling
{
  "expo": {
    "assetBundlePatterns": [
      "assets/images/*",
      "assets/fonts/*",
      "assets/animations/*"
    ],
    "plugins": [
      [
        "expo-asset",
        {
          "assets": [
            "./assets/data/config.json",
            "./assets/animations/loading.json"
          ]
        }
      ]
    ]
  }
}
```

---

## Development Commands

```bash
# Start development server
npx expo start

# Start with cache clear
npx expo start --clear

# Platform-specific
npx expo start --ios
npx expo start --android

# Run on device/simulator (requires prebuild or development build)
npx expo run:ios
npx expo run:android

# Generate native directories
npx expo prebuild
npx expo prebuild --clean  # Clean regeneration

# Validate dependencies
npx expo-doctor

# Install dependencies (uses correct package manager)
npx expo install react-native-reanimated

# Fix peer dependencies
npx expo install --fix
```

---

## SDK Upgrades

```bash
# Upgrade to latest SDK
npx expo install expo@latest

# Upgrade to specific SDK version
npx expo install expo@^52.0.0

# Fix all peer dependencies after upgrade
npx expo install --fix

# Validate upgrade
npx expo-doctor

# Clean prebuild after major upgrade
npx expo prebuild --clean
```

---

## Directory Structure

```
my-app/
├── app/                      # Expo Router routes
│   ├── _layout.tsx           # Root layout
│   ├── index.tsx             # Home screen (/)
│   ├── +not-found.tsx        # 404 screen
│   └── (tabs)/               # Tab navigator group
│       ├── _layout.tsx       # Tab layout
│       ├── index.tsx         # First tab
│       └── settings.tsx      # Settings tab
├── assets/
│   ├── fonts/                # Custom fonts
│   ├── images/               # Static images
│   └── animations/           # Lottie animations
├── components/               # Shared components
│   ├── ui/                   # Base UI components
│   └── features/             # Feature components
├── hooks/                    # Custom hooks
├── services/                 # API services
├── stores/                   # State management
├── constants/                # App constants
├── types/                    # TypeScript types
├── app.config.ts             # Dynamic Expo config
├── eas.json                  # EAS Build config
├── metro.config.js           # Metro bundler config
└── tsconfig.json             # TypeScript config
```
