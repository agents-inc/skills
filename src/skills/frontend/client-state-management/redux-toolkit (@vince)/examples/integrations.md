# Redux Toolkit - Integration Examples

Third-party integrations including Redux Persist for state persistence.

**Prerequisites:** Understand [core.md](core.md) (Store Configuration) and [rtk-query.md](rtk-query.md) first.

---

## Pattern: Redux Persist Integration

### Good Example - Persist with Blacklist

```typescript
// store/index.ts
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import { apiSlice } from "./api/api-slice";
import { authReducer } from "./slices/auth-slice";
import { todosReducer } from "./slices/todos-slice";

const PERSIST_KEY = "root";
const PERSIST_VERSION = 1;

const persistConfig = {
  key: PERSIST_KEY,
  version: PERSIST_VERSION,
  storage,
  // IMPORTANT: Blacklist RTK Query API slice to avoid stale cache
  blacklist: [apiSlice.reducerPath],
};

const rootReducer = combineReducers({
  auth: authReducer,
  todos: todosReducer,
  [apiSlice.reducerPath]: apiSlice.reducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore redux-persist actions for serializable check
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(apiSlice.middleware),
});

export const persistor = persistStore(store);
```

**Why good:** Blacklists API slice to prevent stale cache restoration, ignores persist actions in serializable check, named constants for config, named exports

---

### App Setup with PersistGate

```typescript
// app.tsx
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "./store";

export const App = () => (
  <Provider store={store}>
    <PersistGate loading={<div>Loading...</div>} persistor={persistor}>
      {/* Your app components */}
    </PersistGate>
  </Provider>
);
```

**Why good:** PersistGate delays rendering until rehydration completes, provides loading fallback, named exports used

---

### Selective Persistence with Whitelist

```typescript
// store/index.ts
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";

const PERSIST_KEY = "root";
const PERSIST_VERSION = 1;

// Only persist specific slices
const persistConfig = {
  key: PERSIST_KEY,
  version: PERSIST_VERSION,
  storage,
  whitelist: ["auth", "settings"], // Only persist these slices
};

const rootReducer = combineReducers({
  auth: authReducer,
  settings: settingsReducer,
  todos: todosReducer, // Not persisted
});

const persistedReducer = persistReducer(persistConfig, rootReducer);
```

**Why good:** Whitelist approach for selective persistence, keeps transient state fresh on reload

---

### Migration Support

```typescript
// store/persist-migrations.ts
import { createMigrate } from "redux-persist";
import type { PersistedState } from "redux-persist";

const PERSIST_VERSION = 2;

const migrations = {
  // Migration from version 1 to 2
  1: (state: PersistedState) => ({
    ...state,
    auth: {
      ...state?.auth,
      // Add new field with default value
      preferences: { theme: "light" },
    },
  }),
};

const persistConfig = {
  key: "root",
  version: PERSIST_VERSION,
  storage,
  migrate: createMigrate(migrations, { debug: false }),
};
```

**Why good:** Handles schema changes between app versions, provides upgrade path for persisted state

---
