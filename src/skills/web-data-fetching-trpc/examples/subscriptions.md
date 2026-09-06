# tRPC — Subscription Examples

> Async generator subscriptions over server-sent events (v11). See [core.md](core.md) for setup.

**Prerequisites**: Pattern 1 (initialization and context) from core.

---

## The procedure

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
```

Three things carry the weight. `signal` is passed into `on()`, so a disconnected client tears the
listener down instead of leaking it. The `userId` check happens before the yield, so one emitter
serves every subscriber without leaking another user's events. And `tracked()` attaches the event
id that `lastEventId` resumes from, which is why that field is in the input schema.

---

## The component

```typescript
// apps/client/components/notification-listener.tsx
import { useTRPC } from "../lib/trpc";
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

  return null; // renders nothing; it exists to hold the subscription
}
```

## Bad example — the v10 observable

```typescript
import { observable } from "@trpc/server/observable";

onNotification: protectedProcedure.subscription(({ ctx }) => {
  return observable<NotificationEvent>((emit) => {
    const handler = (data: NotificationEvent) => emit.next(data);
    ee.on("notification", handler);
    return () => ee.off("notification", handler);
  });
});
```

The generator form replaced this in v11. It also gets two things this shape cannot: cleanup driven
by the abort signal rather than by a returned teardown function, and `tracked()` event ids for
resuming after a dropped connection.
