# Electron Type-Safe IPC - electron-trpc

> End-to-end type-safe IPC using tRPC over Electron's IPC channels. See [core.md](core.md) for the manual typed channel map approach. See [SKILL.md](../SKILL.md) for when to choose electron-trpc vs manual typing.

---

## Setup Overview

electron-trpc consists of three parts:

1. **Main process:** `createIPCHandler` -- routes IPC messages through a tRPC router
2. **Preload script:** `exposeElectronTRPC` -- exposes IPC transport via contextBridge
3. **Renderer:** `ipcLink` -- tRPC link that sends requests over Electron IPC instead of HTTP

---

## Preload Script

The preload script must expose electron-trpc's IPC transport. This is a one-liner.

```typescript
// preload.ts
import { exposeElectronTRPC } from "electron-trpc/main";

// Must run after the preload context is loaded
process.once("loaded", () => {
  exposeElectronTRPC();
});
```

**Gotcha:** The import path is `electron-trpc/main` even though this runs in the preload script -- the module handles the contextBridge exposure internally.

---

## Router Definition (Main Process)

Define your IPC API as a tRPC router with Zod-validated inputs.

```typescript
// main/router.ts
import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { app, dialog } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

const t = initTRPC.create({ isServer: true });

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const appRouter = t.router({
  // Query: read-only operations
  getVersion: t.procedure.query(() => app.getVersion()),

  readFile: t.procedure
    .input(z.object({ filePath: z.string().min(1) }))
    .query(async ({ input }) => {
      const resolved = path.resolve(app.getPath("userData"), input.filePath);
      if (!resolved.startsWith(app.getPath("userData"))) {
        throw new Error("Access denied");
      }
      const content = await fs.readFile(resolved, "utf-8");
      return { content };
    }),

  // Mutation: write operations
  writeFile: t.procedure
    .input(
      z.object({
        filePath: z.string().min(1),
        content: z.string().max(MAX_FILE_SIZE),
      }),
    )
    .mutation(async ({ input }) => {
      const resolved = path.resolve(app.getPath("userData"), input.filePath);
      if (!resolved.startsWith(app.getPath("userData"))) {
        throw new Error("Access denied");
      }
      await fs.writeFile(resolved, input.content, "utf-8");
      return { success: true };
    }),

  openFileDialog: t.procedure
    .input(
      z
        .object({
          filters: z
            .array(
              z.object({ name: z.string(), extensions: z.array(z.string()) }),
            )
            .optional(),
          multiSelect: z.boolean().optional(),
        })
        .optional(),
    )
    .mutation(async ({ input }) => {
      const result = await dialog.showOpenDialog({
        properties: input?.multiSelect
          ? ["openFile", "multiSelections"]
          : ["openFile"],
        filters: input?.filters ?? [],
      });
      return result.canceled ? null : result.filePaths;
    }),
});

// Export the router type for use in the renderer
export type AppRouter = typeof appRouter;
```

**Why good:** Zod validates input at runtime (protects against compromised renderers), TypeScript validates at compile time (autocompletion in renderer). Adding a new procedure automatically surfaces in the typed client.

---

## IPC Handler Registration (Main Process)

Wire the router to Electron's IPC in the main process after `app.whenReady()`.

```typescript
// main/index.ts
import { app, BrowserWindow } from "electron";
import { createIPCHandler } from "electron-trpc/main";
import { appRouter } from "./router";
import path from "node:path";

let mainWindow: BrowserWindow | null = null;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      // contextIsolation: true (default)
      // sandbox: true (default)
    },
  });

  // Attach the tRPC IPC handler to this window
  createIPCHandler({
    router: appRouter,
    windows: [mainWindow],
  });

  mainWindow.loadFile("index.html");
});
```

**Key point:** `createIPCHandler` must receive the window(s) it should listen on. For multi-window apps, pass all windows that need IPC access.

---

## Renderer Client

Create a typed tRPC client using `ipcLink` instead of an HTTP link.

```typescript
// renderer/trpc-client.ts
import { createTRPCProxyClient } from "@trpc/client";
import { ipcLink } from "electron-trpc/renderer";
import type { AppRouter } from "../main/router";

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()],
});
```

**Usage:**

```typescript
// renderer/app.ts
import { trpc } from "./trpc-client";

// Fully typed -- autocompletion on procedure names, input shapes, return types
const version = await trpc.getVersion.query();
//    ^-- typed as string

const { content } = await trpc.readFile.query({ filePath: "config.json" });
//     ^-- typed as { content: string }

await trpc.writeFile.mutate({ filePath: "config.json", content: "{}" });

const files = await trpc.openFileDialog.mutate({ multiSelect: true });
//    ^-- typed as string[] | null
```

**Why good:** Zero boilerplate for typed IPC calls. The renderer never sees channel names, IPC arguments, or `window.electronAPI`. The tRPC client provides the same DX as calling a typed API.

---

## Subscriptions (Real-Time Updates)

electron-trpc supports tRPC subscriptions for pushing data from main to renderer.

```typescript
// main/router.ts (add to existing router)
import { observable } from "@trpc/server/observable";
import { EventEmitter } from "node:events";

const ee = new EventEmitter();

export const appRouter = t.router({
  // ... other procedures ...

  onFileChanged: t.procedure
    .input(z.object({ watchPath: z.string() }))
    .subscription(({ input }) => {
      return observable<{ path: string; event: string }>((emit) => {
        const watcher = fs.watch(input.watchPath, (eventType, filename) => {
          emit.next({ path: filename ?? input.watchPath, event: eventType });
        });

        // Cleanup when subscription ends
        return () => {
          watcher.close();
        };
      });
    }),

  onSettingsChanged: t.procedure.subscription(() => {
    return observable<{ key: string; value: unknown }>((emit) => {
      const handler = (data: { key: string; value: unknown }) => {
        emit.next(data);
      };
      ee.on("settings-changed", handler);
      return () => {
        ee.off("settings-changed", handler);
      };
    });
  }),
});
```

```typescript
// renderer/app.ts
const unsubscribe = trpc.onFileChanged.subscribe(
  { watchPath: "/some/dir" },
  {
    onData: (change) => {
      console.log(`File ${change.path} had event: ${change.event}`);
    },
    onError: (err) => {
      console.error("Subscription error:", err);
    },
  },
);

// Clean up when no longer needed
unsubscribe();
```

**Key points:**

- Subscriptions auto-cancel when the window navigates or closes
- The `observable` return function is the cleanup callback
- If the renderer is a SPA, subscriptions persist until explicitly unsubscribed
- Error handling is per-subscription via `onError`

---

## Context for Authentication / Session

Pass per-request context (e.g., window ID, session data) via `createContext`.

```typescript
// main/index.ts
import { createIPCHandler } from "electron-trpc/main";
import { appRouter } from "./router";

createIPCHandler({
  router: appRouter,
  windows: [mainWindow],
  createContext: ({ event }) => {
    // event.sender is the WebContents that sent the request
    return {
      windowId: event.sender.id,
      isMainWindow: event.sender === mainWindow?.webContents,
    };
  },
});
```

```typescript
// main/router.ts
import { initTRPC } from "@trpc/server";

interface Context {
  windowId: number;
  isMainWindow: boolean;
}

const t = initTRPC.context<Context>().create({ isServer: true });

export const appRouter = t.router({
  getWindowInfo: t.procedure.query(({ ctx }) => {
    return {
      windowId: ctx.windowId,
      isMainWindow: ctx.isMainWindow,
    };
  }),
});
```

---

## SuperJSON for Complex Types

Standard IPC serialization loses `Date`, `Map`, `Set`, and other non-JSON types. Use SuperJSON as a transformer.

```typescript
// shared/transformer.ts
import superjson from "superjson";
export { superjson };
```

```typescript
// main/router.ts
import { initTRPC } from "@trpc/server";
import { superjson } from "../shared/transformer";

const t = initTRPC.create({
  isServer: true,
  transformer: superjson,
});
```

```typescript
// renderer/trpc-client.ts
import { createTRPCProxyClient } from "@trpc/client";
import { ipcLink } from "electron-trpc/renderer";
import { superjson } from "../shared/transformer";
import type { AppRouter } from "../main/router";

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [ipcLink()],
  transformer: superjson,
});
```

**When needed:** procedures that return `Date` objects, `Map`, `Set`, `BigInt`, `RegExp`, or `undefined` values. Without SuperJSON, these are silently converted to strings or lost during serialization.
