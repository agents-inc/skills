# ElevenLabs -- WebSocket Input Streaming & Conversational AI Examples

> WebSocket-based real-time text-to-speech streaming and conversational AI agents. See [core.md](core.md) for client setup and standard TTS patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, TTS, streaming, voice settings
- [voices.md](voices.md) -- Voice search, cloning, speech-to-speech

---

## WebSocket Input Streaming: Basic Setup

Use WebSocket input streaming when text is generated incrementally (e.g., from an LLM) and you want audio generation to start before all text is available.

```typescript
import WebSocket from "ws";

const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const MODEL_ID = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "mp3_44100_128";
const API_KEY = process.env.ELEVENLABS_API_KEY;

const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream-input?model_id=${MODEL_ID}&output_format=${OUTPUT_FORMAT}`;

const ws = new WebSocket(wsUrl, {
  headers: { "xi-api-key": API_KEY },
});

ws.on("open", () => {
  // 1. Initialize with voice settings (first message)
  ws.send(
    JSON.stringify({
      text: " ",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
      generation_config: {
        chunk_length_schedule: [120, 160, 250, 290],
      },
    }),
  );

  // 2. Send text chunks (each must end with a space)
  ws.send(JSON.stringify({ text: "Hello, this is " }));
  ws.send(JSON.stringify({ text: "a streamed sentence. " }));
  ws.send(JSON.stringify({ text: "Each chunk ends with a space. " }));

  // 3. Close the stream (empty text signals completion)
  ws.send(JSON.stringify({ text: "" }));
});

ws.on("message", (data: WebSocket.Data) => {
  const response = JSON.parse(data.toString());

  if (response.audio) {
    // Base64-encoded audio chunk
    const audioChunk = Buffer.from(response.audio, "base64");
    process.stdout.write(audioChunk);
  }

  if (response.isFinal) {
    console.log("Stream complete");
    ws.close();
  }
});

ws.on("error", (error) => {
  console.error("WebSocket error:", error);
});
```

**Why good:** Proper initialization sequence, text ends with spaces, clean close signal, handles audio chunks and completion

---

## WebSocket: Streaming from LLM Output

Pipe LLM text generation directly to ElevenLabs for real-time voice synthesis.

```typescript
import WebSocket from "ws";

const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const MODEL_ID = "eleven_flash_v2_5";
const API_KEY = process.env.ELEVENLABS_API_KEY;
const INACTIVITY_TIMEOUT = 30;

const wsUrl = [
  `wss://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream-input`,
  `?model_id=${MODEL_ID}`,
  `&output_format=pcm_16000`,
  `&inactivity_timeout=${INACTIVITY_TIMEOUT}`,
].join("");

function createTtsWebSocket(): WebSocket {
  const ws = new WebSocket(wsUrl, {
    headers: { "xi-api-key": API_KEY },
  });

  ws.on("open", () => {
    // Initialize with voice settings
    ws.send(
      JSON.stringify({
        text: " ",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        generation_config: { chunk_length_schedule: [50, 120, 200, 260] },
      }),
    );
  });

  return ws;
}

// Usage with an LLM stream (pseudo-code)
async function streamLlmToSpeech(
  llmStream: AsyncIterable<string>,
  onAudioChunk: (chunk: Buffer) => void,
): Promise<void> {
  const ws = createTtsWebSocket();

  await new Promise<void>((resolve) => ws.on("open", resolve));

  ws.on("message", (data: WebSocket.Data) => {
    const response = JSON.parse(data.toString());
    if (response.audio) {
      onAudioChunk(Buffer.from(response.audio, "base64"));
    }
    if (response.isFinal) {
      ws.close();
    }
  });

  // Stream each LLM token to the TTS WebSocket
  for await (const token of llmStream) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ text: token }));
    }
  }

  // Signal end of input
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ text: "" }));
  }
}
```

**Why good:** Lower `chunk_length_schedule` for faster first audio, proper readyState checks, clean close signal

---

## WebSocket: With SSML Parsing

Enable SSML for pronunciation control over the WebSocket connection.

```typescript
const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const MODEL_ID = "eleven_multilingual_v2";

// SSML parsing is enabled via query parameter, not in the message
const wsUrl = [
  `wss://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream-input`,
  `?model_id=${MODEL_ID}`,
  `&enable_ssml_parsing=true`,
  `&output_format=mp3_44100_128`,
].join("");

const ws = new WebSocket(wsUrl, {
  headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
});

ws.on("open", () => {
  ws.send(JSON.stringify({ text: " " }));

  // Send SSML-formatted text
  ws.send(
    JSON.stringify({
      text: '<speak><phoneme alphabet="ipa" ph="ˈniːʃ">niche</phoneme> is pronounced correctly. </speak>',
    }),
  );

  ws.send(JSON.stringify({ text: "" }));
});
```

**Why good:** `enable_ssml_parsing` set as query parameter (not in message), SSML tags in text content

---

## WebSocket: With Character Alignment

Get character-level timing data for synchronized text highlighting.

```typescript
const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

// Enable alignment via query parameter
const wsUrl = [
  `wss://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream-input`,
  `?model_id=eleven_flash_v2_5`,
  `&sync_alignment=true`,
  `&output_format=mp3_44100_128`,
].join("");

const ws = new WebSocket(wsUrl, {
  headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
});

ws.on("message", (data: WebSocket.Data) => {
  const response = JSON.parse(data.toString());

  if (response.audio && response.alignment) {
    const audioChunk = Buffer.from(response.audio, "base64");
    const { chars, charStartTimesMs, charDurationsMs } = response.alignment;

    // Synchronize text highlighting with audio playback
    for (let i = 0; i < chars.length; i++) {
      console.log(`"${chars[i]}" at ${charStartTimesMs[i]}ms`);
    }
  }
});
```

---

## Conversational AI: Basic Agent (Browser-Side)

Use `@elevenlabs/client` for real-time conversational AI agents. This runs in the browser.

```typescript
import { Conversation } from "@elevenlabs/client";

const AGENT_ID = "agent_abc123";

// Start a conversation session
const conversation = await Conversation.startSession({
  agentId: AGENT_ID,
  connectionType: "websocket", // or "webrtc" for lower latency

  onConnect: () => {
    console.log("Connected to agent");
  },

  onDisconnect: () => {
    console.log("Disconnected from agent");
  },

  onMessage: (message) => {
    console.log("Agent message:", message);
  },

  onError: (error) => {
    console.error("Conversation error:", error);
  },

  onStatusChange: (status) => {
    console.log("Status:", status);
  },

  onModeChange: (mode) => {
    console.log("Mode:", mode); // "speaking" | "listening"
  },
});

// End the conversation
await conversation.endSession();
```

**Why good:** Event-driven architecture, clear lifecycle hooks, clean session management

---

## Conversational AI: With Client Tools

Define client-side tools that the agent can invoke during conversation.

```typescript
import { Conversation } from "@elevenlabs/client";

const AGENT_ID = "agent_abc123";

const conversation = await Conversation.startSession({
  agentId: AGENT_ID,
  connectionType: "websocket",

  clientTools: {
    // Tool names must match your ElevenLabs agent configuration
    displayNotification: async (parameters: {
      title: string;
      body: string;
    }) => {
      showNotification(parameters.title, parameters.body);
      return "Notification displayed";
    },

    navigateTo: async (parameters: { url: string }) => {
      window.location.href = parameters.url;
      return "Navigated";
    },
  },

  onMessage: (message) => {
    console.log("Agent:", message);
  },
});
```

**Why good:** Client tools enable agent-driven UI actions, return values confirm execution

---

## Conversational AI: Authenticated Agent

For private agents, obtain a signed URL from your server.

```typescript
// Server-side: generate signed URL
async function getSignedUrl(agentId: string): Promise<string> {
  const API_KEY = process.env.ELEVENLABS_API_KEY;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
    {
      method: "GET",
      headers: { "xi-api-key": API_KEY },
    },
  );

  const { signed_url } = (await response.json()) as { signed_url: string };
  return signed_url;
}

// Client-side: use signed URL instead of agent ID
import { Conversation } from "@elevenlabs/client";

const signedUrl = await fetch("/api/signed-url").then((r) => r.text());

const conversation = await Conversation.startSession({
  signedUrl,
  onConnect: () => console.log("Connected"),
  onMessage: (msg) => console.log("Agent:", msg),
});
```

**Why good:** API key stays server-side, signed URL is short-lived, clean separation of concerns

---

_For client setup and TTS examples, see [core.md](core.md). For voice management, see [voices.md](voices.md). For API reference tables, see [reference.md](../reference.md)._
