# Core Expo Patterns

> Essential configuration, environment, and asset patterns. See [SKILL.md](../SKILL.md) for decisions and philosophy.

---

## Dynamic Configuration (app.config.ts)

Use `app.config.ts` for environment-aware builds with TypeScript support. Use named constants for SDK versions and build numbers -- never hardcode them.

```typescript
// app.config.ts
import type { ExpoConfig, ConfigContext } from "expo/config";

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

**Why good:** Named constants, environment-specific bundle identifiers prevent app store conflicts, `usesNonExemptEncryption: false` avoids iOS compliance review delay, `runtimeVersion` policy enables safe OTA updates

---

## Config Plugins

Config plugins modify native code declaratively. Changes survive `expo prebuild --clean`.

### Camera and Permissions

```typescript
// app.config.ts plugins array
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
// const { EXPO_PUBLIC_API_URL } = process.env;  // BAD - undefined
// process.env['EXPO_PUBLIC_API_URL'];           // BAD - undefined
// Object.keys(process.env).filter(...)          // BAD - won't include EXPO_PUBLIC_*

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

### Basic Font Loading with Splash Screen

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

### Config Plugin Font Loading (Recommended for Production)

Pre-bundle fonts at build time to avoid runtime loading delay:

```json
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
```

**Why good:** Blur hash placeholder prevents layout shift, `memory-disk` caching avoids re-downloads, transition provides smooth loading UX

### Local Images

```typescript
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
