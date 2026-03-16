# URQL GraphQL Client - Subscription Examples

> Real-time data with WebSocket subscriptions. See [SKILL.md](../SKILL.md) for concepts.

---

## Pattern 1: Subscription Client Setup

Configure the client with subscriptionExchange for WebSocket support.

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

**Why good:** Separate HTTP and WS URLs for different endpoints, auth token passed via connectionParams, retry configuration for resilient connections, named constants for configuration

---

## Pattern 2: Basic useSubscription

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

**Why good:** Pause prevents subscription when userId is missing, typed interfaces for subscription data, handles error and initial states

---

## Pattern 3: Subscription with Data Accumulation

Subscriptions emit single events. Use a reducer to accumulate messages over time.

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

**Why good:** useReducer for accumulating subscription events, handler callback processes each emission, memoized handler prevents unnecessary re-subscriptions

---

## Pattern 4: Subscription with Unsubscribe Control

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

**Why good:** pause prop controls subscription lifecycle, toggle button for user control, proper conditional styling for price changes

---

## Pattern 5: Subscription with Cache Updates

Update the cache when subscription events arrive (requires Graphcache).

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

**Why good:** Subscription updates are configured in Graphcache updates, duplicate check prevents the same message appearing twice, cache stays in sync with real-time events

---

## Pattern 6: Presence System

Track online users with subscriptions.

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

**Why good:** Map-based state for efficient lookup, typed reducer actions, limits displayed avatars with overflow count, handles online/offline events

---

## Subscription Quick Reference

### useSubscription Return Value

```typescript
const [result] = useSubscription({ query, variables, pause });

// result contains:
interface SubscriptionResult<T> {
  data?: T; // Latest subscription data
  error?: CombinedError; // Any errors
  fetching: boolean; // Currently active
  stale: boolean; // Data is stale
}
```

### Subscription Handler Callback

```typescript
// Handler receives previous result and new data
const handler = (prevResult: T | undefined, data: SubscriptionData) => {
  // Process data, accumulate, etc.
  return newResult; // Returned value becomes next prevResult
};

const [result] = useSubscription({ query, variables }, handler);
```

### Pause vs Unsubscribe

```typescript
// Pause - subscription is paused but can resume
const [result] = useSubscription({
  query: SUBSCRIPTION,
  pause: !isActive, // Toggle with state
});

// Component unmount - automatically unsubscribes
// No manual cleanup needed
```

---

## Common Subscription Pitfalls

```typescript
// BAD: Missing pause for optional variables
const [result] = useSubscription({
  query: SUBSCRIPTION,
  variables: { roomId }, // What if roomId is undefined?
});

// GOOD: Pause when variables are invalid
const [result] = useSubscription({
  query: SUBSCRIPTION,
  variables: { roomId },
  pause: !roomId,
});

// BAD: Handler creates new reference every render
function BadComponent() {
  const [result] = useSubscription(
    { query: SUBSCRIPTION },
    // This handler is recreated every render!
    (prev, data) => [...(prev || []), data],
  );
}

// GOOD: Memoize handler
function GoodComponent() {
  const [items, dispatch] = useReducer(reducer, []);
  const handler = useMemo(
    () => (prev, data) => {
      dispatch({ type: "ADD", item: data });
      return items;
    },
    [items],
  );
  const [result] = useSubscription({ query: SUBSCRIPTION }, handler);
}
```
