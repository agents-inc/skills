# Anthropic SDK -- Streaming Examples

> Streaming patterns: `.stream()` event-based helper, `stream: true` raw SSE, streaming with extended thinking, abort. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [tool-use.md](tool-use.md) -- Tool/function calling
- [vision-documents.md](vision-documents.md) -- Images and PDFs
- [extended-thinking.md](extended-thinking.md) -- Extended thinking

---

## Event-Based Streaming with `.stream()` Helper

The `.stream()` helper provides named events and automatic message accumulation. This is the recommended approach.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MAX_TOKENS = 1024;

const stream = client.messages.stream({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [{ role: "user", content: "Explain async/await in TypeScript." }],
});

// Listen for text deltas
stream.on("text", (textDelta, textSnapshot) => {
  process.stdout.write(textDelta);
  // textSnapshot contains the full text accumulated so far
});

// Get the complete message when done
const finalMessage = await stream.finalMessage();
console.log("\n\nStop reason:", finalMessage.stop_reason);
console.log("Usage:", finalMessage.usage);
```

---

## Chained Event Handlers

The `.on()` method returns the stream, so handlers can be chained.

```typescript
const MAX_TOKENS = 1024;

await client.messages
  .stream({
    model: "claude-sonnet-4-6",
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: "Hello" }],
  })
  .on("text", (text) => {
    process.stdout.write(text);
  })
  .on("error", (error) => {
    console.error("Stream error:", error);
  })
  .on("end", () => {
    console.log("\nStream complete");
  });
```

---

## Raw SSE Streaming with `stream: true`

Lower-level approach returning an async iterable of raw SSE events. Uses less memory than `.stream()` since it does not accumulate a snapshot.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MAX_TOKENS = 1024;

const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [{ role: "user", content: "Tell me about TypeScript generics." }],
  stream: true,
});

for await (const event of response) {
  if (event.type === "content_block_delta") {
    if (event.delta.type === "text_delta") {
      process.stdout.write(event.delta.text);
    }
  }
  if (event.type === "message_delta") {
    console.log("\nStop reason:", event.delta.stop_reason);
    console.log("Output tokens:", event.usage.output_tokens);
  }
}
```

---

## Stream with Complete Event Handling

```typescript
const MAX_TOKENS = 2048;

const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [{ role: "user", content: "Write a short story." }],
  stream: true,
});

for await (const event of response) {
  switch (event.type) {
    case "message_start":
      console.log("Model:", event.message.model);
      console.log("Input tokens:", event.message.usage.input_tokens);
      break;

    case "content_block_start":
      console.log(`\nBlock ${event.index} (${event.content_block.type}):`);
      break;

    case "content_block_delta":
      if (event.delta.type === "text_delta") {
        process.stdout.write(event.delta.text);
      } else if (event.delta.type === "input_json_delta") {
        // Tool input being streamed
        process.stdout.write(event.delta.partial_json);
      } else if (event.delta.type === "thinking_delta") {
        // Extended thinking being streamed
        process.stdout.write(event.delta.thinking);
      }
      break;

    case "content_block_stop":
      console.log(`\n(Block ${event.index} complete)`);
      break;

    case "message_delta":
      console.log("\nStop reason:", event.delta.stop_reason);
      console.log("Output tokens:", event.usage.output_tokens);
      break;

    case "message_stop":
      console.log("Stream complete");
      break;
  }
}
```

---

## Get Final Message Without Handling Events

When you do not need to process text as it arrives but want to avoid HTTP timeouts on large responses. The SDK streams under the hood and returns the complete `Message` object.

```typescript
const MAX_TOKENS = 128_000;

const stream = client.messages.stream({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [{ role: "user", content: "Write a detailed analysis..." }],
});

// Stream happens under the hood, returns complete message
const message = await stream.finalMessage();
const textBlock = message.content.find((block) => block.type === "text");
if (textBlock?.type === "text") {
  console.log(textBlock.text);
}
```

**When to use:** For requests with large `max_tokens` values where the SDK requires streaming to avoid HTTP timeouts, but you do not need progressive output.

---

## Stream Abort

```typescript
const MAX_TOKENS = 4096;

const stream = client.messages.stream({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [{ role: "user", content: "Tell me a very long story." }],
});

// Abort after collecting some text
let collected = "";
const MAX_CHARS = 500;

stream.on("text", (delta) => {
  collected += delta;
  if (collected.length > MAX_CHARS) {
    stream.abort();
  }
});

try {
  await stream.done();
} catch (error) {
  // abort() causes the stream to reject
  console.log("Stream aborted after", collected.length, "chars");
}
```

---

## Stream Error Handling

```typescript
const MAX_TOKENS = 1024;

const stream = client.messages.stream({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  messages: [{ role: "user", content: "Hello" }],
});

stream.on("error", (error) => {
  if (error instanceof Anthropic.APIError) {
    console.error(`Stream API error [${error.status}]: ${error.message}`);
  } else {
    console.error("Stream connection error:", error);
  }
});

stream.on("text", (delta) => {
  process.stdout.write(delta);
});

const message = await stream.finalMessage();
```

---

## Streaming Content Blocks (Tool Use + Text Mixed)

When Claude uses tools during streaming, you receive `contentBlock` events for complete blocks:

```typescript
const MAX_TOKENS = 2048;

const stream = client.messages.stream({
  model: "claude-sonnet-4-6",
  max_tokens: MAX_TOKENS,
  tools: [
    {
      name: "get_weather",
      description: "Get weather for a location",
      input_schema: {
        type: "object" as const,
        properties: { location: { type: "string" } },
        required: ["location"],
      },
    },
  ],
  messages: [{ role: "user", content: "Weather in Tokyo?" }],
});

stream.on("contentBlock", (block) => {
  if (block.type === "tool_use") {
    console.log(`Tool call: ${block.name}(${JSON.stringify(block.input)})`);
  } else if (block.type === "text") {
    console.log("Text:", block.text);
  }
});

const message = await stream.finalMessage();
console.log("Stop reason:", message.stop_reason);
// If stop_reason === "tool_use", execute tools and continue
```

---

## Stream Methods Reference

```typescript
const stream = client.messages.stream({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello" }],
});

// Promise-based accessors
await stream.finalMessage(); // Promise<Message> -- complete message
await stream.finalText(); // Promise<string> -- final text content
await stream.done(); // Promise<void> -- resolves when stream completes

// State
stream.currentMessage; // Current accumulated Message or undefined
stream.messages; // Mutable array of all messages in conversation

// Control
stream.abort(); // Cancel stream and network request
stream.controller; // Underlying AbortController
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
