# tRPC Subscriptions with Server-Sent Events

> Real-time updates using async generator subscriptions (v11). See [core.md](core.md) for setup patterns.

**Prerequisites**: Understand Pattern 1 (Router Setup) from core examples first.

---

## Server-Side Subscription (v11 Async Generator)

```typescript
// packages/api/src/routers/notification.ts
import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { tracked } from "@trpc/server";
import { EventEmitter, on } from "events";

// Create typed event emitter
const ee = new EventEmitter();

interface NotificationEvent {
  id: string;
  userId: string;
  message: string;
  type: "info" | "warning" | "error";
  timestamp: Date;
}

export const notificationRouter = router({
  // v11: async generator subscription with tracked() for reconnection
  onNotification: protectedProcedure
    .input(
      z
        .object({
          // lastEventId enables automatic reconnection resumption
          lastEventId: z.string().nullish(),
        })
        .optional(),
    )
    .subscription(async function* ({ ctx, input, signal }) {
      // Listen for events, respecting abort signal for cleanup
      for await (const [data] of on(ee, "notification", { signal })) {
        const notification = data as NotificationEvent;

        // Only emit to the subscribed user
        if (notification.userId === ctx.user.id) {
          // tracked() sends event ID -- client auto-resumes from here on reconnect
          yield tracked(notification.id, notification);
        }
      }
    }),

  // Trigger notification (for testing/internal use)
  send: protectedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        message: z.string(),
        type: z.enum(["info", "warning", "error"]),
      }),
    )
    .mutation(({ input }) => {
      ee.emit("notification", {
        id: crypto.randomUUID(),
        ...input,
        timestamp: new Date(),
      } satisfies NotificationEvent);
      return { sent: true };
    }),
});

// Named export
export { notificationRouter };
```

---

## Client-Side Subscription

```typescript
// apps/client/components/notification-listener.tsx
import { useTRPC } from "@/lib/trpc";
import { useSubscription } from "@trpc/tanstack-react-query";

export function NotificationListener() {
  const trpc = useTRPC();

  // Subscribe to real-time notifications via SSE
  useSubscription(
    trpc.notification.onNotification.subscriptionOptions(undefined, {
      onData: (notification) => {
        toast[notification.type](notification.message);
      },
      onError: (err) => {
        console.error("Subscription error:", err);
      },
    }),
  );

  return null; // Renderless component
}

// Named export
export { NotificationListener };
```

---

## Bad Example - Using observable() (v10 Pattern)

```typescript
// BAD: v10 observable pattern -- deprecated in v11
import { observable } from "@trpc/server/observable";

onNotification: protectedProcedure.subscription(({ ctx }) => {
  return observable<NotificationEvent>((emit) => {
    const handler = (data: NotificationEvent) => emit.next(data);
    ee.on("notification", handler);
    return () => ee.off("notification", handler);
  });
});
```

**Why bad:** `observable()` is the v10 pattern; v11 uses async generators with `signal` for cleanup and `tracked()` for automatic reconnection -- provides better resilience and type safety

---
