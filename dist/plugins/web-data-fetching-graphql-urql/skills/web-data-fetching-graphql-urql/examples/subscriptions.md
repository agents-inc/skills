# URQL — Subscription Examples

> Real-time data over a websocket. See [SKILL.md](../SKILL.md) for the decisions.

---

## Pattern 1: The subscription exchange

```typescript
// lib/urql-client.ts
import {
  Client,
  cacheExchange,
  fetchExchange,
  subscriptionExchange,
} from "urql";
import { createClient as createWSClient } from "graphql-ws";

const GRAPHQL_HTTP_URL = process.env.GRAPHQL_URL || "";
const GRAPHQL_WS_URL = process.env.GRAPHQL_WS_URL || "";
const TOKEN_STORAGE_KEY = "auth_token";
const WS_RETRY_ATTEMPTS = 5;

// WebSocket client for subscriptions
const wsClient = createWSClient({
  url: GRAPHQL_WS_URL,
  connectionParams: () => ({
    // Add auth token to WebSocket connection
    authToken: localStorage.getItem(TOKEN_STORAGE_KEY),
  }),
  // Reconnection configuration
  retryAttempts: WS_RETRY_ATTEMPTS,
  shouldRetry: () => true,
});

const client = new Client({
  url: GRAPHQL_HTTP_URL,
  exchanges: [
    cacheExchange,
    fetchExchange,
    // Subscription exchange for WebSocket operations
    subscriptionExchange({
      forwardSubscription(request) {
        const input = { ...request, query: request.query || "" };
        return {
          subscribe(sink) {
            const unsubscribe = wsClient.subscribe(input, sink);
            return { unsubscribe };
          },
        };
      },
    }),
  ],
});

export { client };
```

`connectionParams` is a function, so the token is read when the socket connects and again on every
reconnection — a value read at module load would be the one from before the last login.

---

## Pattern 2: Reading the latest event

```typescript
// components/live-notifications.tsx
import { useSubscription, gql } from "urql";

const NOTIFICATION_SUBSCRIPTION = gql`
  subscription OnNotification($userId: ID!) {
    notificationReceived(userId: $userId) {
      id
      type
      message
      createdAt
    }
  }
`;

interface Notification {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

interface NotificationData {
  notificationReceived: Notification;
}

interface LiveNotificationsProps {
  userId: string;
}

function LiveNotifications({ userId }: LiveNotificationsProps) {
  const [result] = useSubscription<NotificationData>({
    query: NOTIFICATION_SUBSCRIPTION,
    variables: { userId },
    // Pause subscription when no userId
    pause: !userId,
  });

  const { data, error } = result;

  if (error) {
    return <div className="error">Subscription error: {error.message}</div>;
  }

  if (!data?.notificationReceived) {
    return <div className="listening">Listening for notifications...</div>;
  }

  return (
    <div className="notification">
      <strong>{data.notificationReceived.type}:</strong>
      <p>{data.notificationReceived.message}</p>
    </div>
  );
}

export { LiveNotifications };
```

`data` holds the most recent event only — each one replaces the last. This shape suits a status or a
ticker; a feed needs Pattern 3.

---

## Pattern 3: Accumulating events

The second argument to `useSubscription` receives the previous value and each new event, and its
return becomes the next `data`.

```typescript
// components/live-chat.tsx
import { useSubscription, gql } from "urql";
import { useMemo, useReducer } from "react";

const NEW_MESSAGE_SUBSCRIPTION = gql`
  subscription OnNewMessage($roomId: ID!) {
    newMessage(roomId: $roomId) {
      id
      content
      author {
        id
        name
      }
      sentAt
    }
  }
`;

interface Message {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
  };
  sentAt: string;
}

interface SubscriptionData {
  newMessage: Message;
}

interface LiveChatProps {
  roomId: string;
}

function LiveChat({ roomId }: LiveChatProps) {
  // Accumulate messages using reducer
  const [messages, addMessage] = useReducer(
    (state: Message[], newMessage: Message) => [...state, newMessage],
    []
  );

  // Handler processes each subscription result
  const handleSubscription = useMemo(
    () => (_prev: Message[] | undefined, response: SubscriptionData) => {
      if (response.newMessage) {
        addMessage(response.newMessage);
      }
      return messages;
    },
    [messages]
  );

  const [result] = useSubscription<SubscriptionData>(
    {
      query: NEW_MESSAGE_SUBSCRIPTION,
      variables: { roomId },
      pause: !roomId,
    },
    handleSubscription
  );

  if (result.error) {
    return <div className="error">Connection error: {result.error.message}</div>;
  }

  return (
    <div className="chat">
      <div className="messages">
        {messages.length === 0 && (
          <p className="no-messages">No messages yet. Start chatting!</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="message">
            <strong>{msg.author.name}:</strong>
            <span>{msg.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { LiveChat };
```

The handler is memoized because an unmemoized one is a new reference on every render, and a new
handler reference resubscribes — reopening the stream and losing everything accumulated.

---

## Pattern 4: Pausing and resuming

```typescript
// components/live-stock-ticker.tsx
import { useState, useCallback } from "react";
import { useSubscription, gql } from "urql";

const STOCK_PRICE_SUBSCRIPTION = gql`
  subscription OnStockPrice($symbol: String!) {
    stockPrice(symbol: $symbol) {
      symbol
      price
      change
      changePercent
      updatedAt
    }
  }
`;

interface StockPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  updatedAt: string;
}

interface StockPriceData {
  stockPrice: StockPrice;
}

interface LiveStockTickerProps {
  symbol: string;
}

function LiveStockTicker({ symbol }: LiveStockTickerProps) {
  const [isActive, setIsActive] = useState(true);

  const [result] = useSubscription<StockPriceData>({
    query: STOCK_PRICE_SUBSCRIPTION,
    variables: { symbol },
    // Control subscription with pause
    pause: !isActive || !symbol,
  });

  const toggleSubscription = useCallback(() => {
    setIsActive((prev) => !prev);
  }, []);

  const { data, error } = result;

  return (
    <div className="stock-ticker">
      <div className="controls">
        <button onClick={toggleSubscription}>
          {isActive ? "Pause Updates" : "Resume Updates"}
        </button>
      </div>

      {error && <div className="error">Error: {error.message}</div>}

      {!isActive && <div className="paused">Updates paused</div>}

      {data?.stockPrice && (
        <div className="price">
          <span className="symbol">{data.stockPrice.symbol}</span>
          <span className="value">${data.stockPrice.price.toFixed(2)}</span>
          <span className={data.stockPrice.change >= 0 ? "positive" : "negative"}>
            {data.stockPrice.change >= 0 ? "+" : ""}
            {data.stockPrice.changePercent.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
}

export { LiveStockTicker };
```

`pause` closes the stream and reopens it, so a paused ticker stops receiving rather than buffering —
the first value after resuming is the current one, not the backlog.

---

## Pattern 5: Writing subscription events into the cache

Graphcache's `updates` accepts a `Subscription` key alongside `Mutation`, so an event can edit a
query's cached result and every component reading that query re-renders.

```typescript
// lib/urql-client-with-subscriptions.ts
import { Client, fetchExchange, subscriptionExchange } from "urql";
import { cacheExchange } from "@urql/exchange-graphcache";
import { createClient as createWSClient } from "graphql-ws";

const GRAPHQL_HTTP_URL = process.env.GRAPHQL_URL || "";
const GRAPHQL_WS_URL = process.env.GRAPHQL_WS_URL || "";

const MESSAGES_QUERY = `
  query GetMessages($roomId: ID!) {
    messages(roomId: $roomId) {
      id
      content
      author { id name }
    }
  }
`;

const wsClient = createWSClient({
  url: GRAPHQL_WS_URL,
});

const client = new Client({
  url: GRAPHQL_HTTP_URL,
  exchanges: [
    cacheExchange({
      updates: {
        Subscription: {
          // Update cache when new message arrives via subscription
          newMessage: (result, args, cache) => {
            const roomId = args.roomId as string;
            cache.updateQuery(
              { query: MESSAGES_QUERY, variables: { roomId } },
              (data) => {
                if (!data || !result.newMessage) return data;
                // Check if message already exists (prevent duplicates)
                const exists = data.messages.some(
                  (m: { id: string }) => m.id === result.newMessage.id,
                );
                if (exists) return data;
                return {
                  ...data,
                  messages: [...data.messages, result.newMessage],
                };
              },
            );
          },
        },
      },
    }),
    fetchExchange,
    subscriptionExchange({
      forwardSubscription(request) {
        const input = { ...request, query: request.query || "" };
        return {
          subscribe(sink) {
            const unsubscribe = wsClient.subscribe(input, sink);
            return { unsubscribe };
          },
        };
      },
    }),
  ],
});

export { client };
```

The duplicate check is not optional: a message the client just posted arrives once as the mutation's
result and once over the subscription, and without the check it renders twice.

---

## Pattern 6: Presence

A reducer over a `Map`, where events are joins and leaves rather than items to append.

```typescript
// components/presence-indicator.tsx
import { useSubscription, gql } from "urql";
import { useReducer, useMemo } from "react";

const PRESENCE_SUBSCRIPTION = gql`
  subscription OnPresenceChange($roomId: ID!) {
    presenceChange(roomId: $roomId) {
      userId
      status
      user {
        id
        name
        avatar
      }
    }
  }
`;

interface PresenceEvent {
  userId: string;
  status: "online" | "offline";
  user: {
    id: string;
    name: string;
    avatar: string;
  };
}

interface PresenceData {
  presenceChange: PresenceEvent;
}

type PresenceState = Map<string, { name: string; avatar: string }>;

type PresenceAction =
  | { type: "USER_ONLINE"; userId: string; name: string; avatar: string }
  | { type: "USER_OFFLINE"; userId: string };

function presenceReducer(state: PresenceState, action: PresenceAction): PresenceState {
  const newState = new Map(state);

  switch (action.type) {
    case "USER_ONLINE":
      newState.set(action.userId, { name: action.name, avatar: action.avatar });
      return newState;
    case "USER_OFFLINE":
      newState.delete(action.userId);
      return newState;
    default:
      return state;
  }
}

interface PresenceIndicatorProps {
  roomId: string;
}

function PresenceIndicator({ roomId }: PresenceIndicatorProps) {
  const [onlineUsers, dispatch] = useReducer(presenceReducer, new Map());

  const handlePresence = useMemo(
    () => (_prev: unknown, data: PresenceData) => {
      const { presenceChange } = data;
      if (presenceChange.status === "online") {
        dispatch({
          type: "USER_ONLINE",
          userId: presenceChange.userId,
          name: presenceChange.user.name,
          avatar: presenceChange.user.avatar,
        });
      } else {
        dispatch({
          type: "USER_OFFLINE",
          userId: presenceChange.userId,
        });
      }
      return onlineUsers;
    },
    [onlineUsers]
  );

  const [result] = useSubscription<PresenceData>(
    {
      query: PRESENCE_SUBSCRIPTION,
      variables: { roomId },
      pause: !roomId,
    },
    handlePresence
  );

  if (result.error) {
    return <span className="presence-error">Connection lost</span>;
  }

  const users = Array.from(onlineUsers.values());

  return (
    <div className="presence-indicator">
      <span className="count">{users.length} online</span>
      <div className="avatars">
        {users.slice(0, 5).map((user, index) => (
          <img
            key={index}
            src={user.avatar}
            alt={user.name}
            title={user.name}
            className="avatar"
          />
        ))}
        {users.length > 5 && (
          <span className="more">+{users.length - 5}</span>
        )}
      </div>
    </div>
  );
}

export { PresenceIndicator };
```

A `Map` keyed by user id makes a leave event an O(1) delete, where an array would need a filter per
event and could hold the same user twice after a reconnection.

---

## The result shape

```typescript
const [{ data, error, fetching, stale }] = useSubscription({
  query,
  variables,
  pause,
});
```

`fetching` means the subscription is active rather than that something is in flight, and unmounting
unsubscribes with no cleanup of your own.
