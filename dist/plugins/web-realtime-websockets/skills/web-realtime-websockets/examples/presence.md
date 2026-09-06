# WebSocket - Presence Detection

> Track online users and their activity status. See [core.md](core.md) for basic patterns.

---

## Pattern 14: Presence Detection

Track online users and their activity status.

```typescript
// hooks/use-presence.ts
import { useCallback, useEffect, useRef, useState } from "react";

const ACTIVITY_TIMEOUT_MS = 30000; // 30 seconds
const PRESENCE_UPDATE_INTERVAL_MS = 10000; // 10 seconds

type UserStatus = "online" | "away" | "offline";

interface UserPresence {
  id: string;
  username: string;
  status: UserStatus;
  lastSeen: number;
}

interface UsePresenceOptions {
  socket: WebSocket;
  userId: string;
  username: string;
}

type PresenceMessage =
  | {
      type: "presence_update";
      userId: string;
      username: string;
      status: UserStatus;
    }
  | { type: "user_disconnected"; userId: string }
  | { type: "presence_list"; users: UserPresence[] };

function parsePresenceMessage(data: unknown): PresenceMessage | null {
  // Binary frames arrive on this listener too once any are in play
  if (typeof data !== "string") return null;

  try {
    return JSON.parse(data) as PresenceMessage;
  } catch {
    return null;
  }
}

export function usePresence({ socket, userId, username }: UsePresenceOptions) {
  const [users, setUsers] = useState<Map<string, UserPresence>>(new Map());
  const [myStatus, setMyStatus] = useState<UserStatus>("online");
  const lastActivityRef = useRef(Date.now());
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Send presence update to server
  const sendPresenceUpdate = useCallback(
    (status: UserStatus) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "presence_update",
            userId,
            username,
            status,
          }),
        );
      }
    },
    [socket, userId, username],
  );

  // Track user activity
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (myStatus !== "online") {
      setMyStatus("online");
      sendPresenceUpdate("online");
    }
  }, [myStatus, sendPresenceUpdate]);

  // Listen for activity events
  useEffect(() => {
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((event) => {
      document.addEventListener(event, updateActivity);
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, [updateActivity]);

  // Check for inactivity
  useEffect(() => {
    const checkActivity = () => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      if (timeSinceActivity > ACTIVITY_TIMEOUT_MS && myStatus === "online") {
        setMyStatus("away");
        sendPresenceUpdate("away");
      }
    };

    updateIntervalRef.current = setInterval(
      checkActivity,
      PRESENCE_UPDATE_INTERVAL_MS,
    );

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [myStatus, sendPresenceUpdate]);

  // Handle presence messages from server
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = parsePresenceMessage(event.data);
      if (!message) return;

      switch (message.type) {
        case "presence_update":
          return setUsers((prev) => {
            const next = new Map(prev);
            next.set(message.userId, {
              id: message.userId,
              username: message.username,
              status: message.status,
              lastSeen: Date.now(),
            });
            return next;
          });

        case "user_disconnected":
          return setUsers((prev) => {
            const next = new Map(prev);
            next.delete(message.userId);
            return next;
          });

        case "presence_list":
          // Initial presence list from server
          return setUsers(new Map(message.users.map((u) => [u.id, u])));

        default: {
          const exhaustive: never = message;
          return exhaustive;
        }
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket]);

  // Send offline on unmount
  useEffect(() => {
    return () => {
      sendPresenceUpdate("offline");
    };
  }, [sendPresenceUpdate]);

  return {
    users: Array.from(users.values()),
    myStatus,
    onlineCount: Array.from(users.values()).filter((u) => u.status === "online")
      .length,
  };
}
```

**Why good:** Away status comes from real activity rather than a timer alone, "offline" is sent on unmount, listeners are removed with the effect that added them, and the inbound messages are a discriminated union — so a new server message type is a compile error rather than a silently ignored frame.
