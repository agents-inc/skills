# WebSocket - Presence Detection

> Track online users and their activity status. See [core.md](core.md) for basic patterns.

---

## Pattern 13: Presence Detection

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

export function usePresence({ socket, userId, username }: UsePresenceOptions) {
  const [users, setUsers] = useState<Map<string, UserPresence>>(new Map());
  const [myStatus, setMyStatus] = useState<UserStatus>("online");
  const lastActivityRef = useRef(Date.now());
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Send presence update to server
  const sendPresenceUpdate = useCallback((status: UserStatus) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "presence_update",
        userId,
        username,
        status,
      }));
    }
  }, [socket, userId, username]);

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

    updateIntervalRef.current = setInterval(checkActivity, PRESENCE_UPDATE_INTERVAL_MS);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [myStatus, sendPresenceUpdate]);

  // Handle presence messages from server
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "presence_update":
          setUsers((prev) => {
            const next = new Map(prev);
            next.set(data.userId, {
              id: data.userId,
              username: data.username,
              status: data.status,
              lastSeen: Date.now(),
            });
            return next;
          });
          break;

        case "user_disconnected":
          setUsers((prev) => {
            const next = new Map(prev);
            next.delete(data.userId);
            return next;
          });
          break;

        case "presence_list":
          // Initial presence list from server
          setUsers(new Map(
            (data.users as UserPresence[]).map((u) => [u.id, u])
          ));
          break;
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
    onlineCount: Array.from(users.values()).filter((u) => u.status === "online").length,
  };
}
```

**Why good:** Activity detection for away status, presence updates sent periodically, offline sent on unmount, clean event listener management, Map for efficient user lookups
