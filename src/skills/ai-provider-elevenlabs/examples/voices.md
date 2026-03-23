# ElevenLabs -- Voice Selection, Cloning & Speech-to-Speech Examples

> Voice management, instant voice cloning, and speech-to-speech conversion. See [core.md](core.md) for client setup and TTS patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, TTS, streaming, voice settings
- [websocket.md](websocket.md) -- WebSocket input streaming, conversational AI

---

## Search Available Voices

```typescript
import { client } from "./lib/elevenlabs.js";

const { voices } = await client.voices.search();

for (const voice of voices) {
  console.log(`${voice.name} (${voice.voiceId})`);
  console.log(`  Category: ${voice.category}`);
  console.log(`  Labels: ${JSON.stringify(voice.labels)}`);
  console.log(`  Preview: ${voice.previewUrl}`);
}
```

---

## Get Voice Details

```typescript
const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

const voice = await client.voices.get(VOICE_ID);

console.log(`Name: ${voice.name}`);
console.log(`Settings:`, voice.settings);
console.log(`Available for TTS: ${voice.category}`);

// Use the voice's default settings as a baseline
const defaults = voice.settings;
console.log(`Default stability: ${defaults?.stability}`);
console.log(`Default similarity: ${defaults?.similarityBoost}`);
```

---

## Instant Voice Clone

Create a voice clone from audio samples. Best results with 1-25 samples of 30+ seconds each.

```typescript
import { createReadStream } from "node:fs";

const voice = await client.voices.ivc.create({
  name: "My Custom Voice",
  description: "Professional narration voice",
  files: [
    createReadStream("samples/recording-1.mp3"),
    createReadStream("samples/recording-2.mp3"),
    createReadStream("samples/recording-3.mp3"),
  ],
  removeBackgroundNoise: true,
  labels: {
    accent: "american",
    gender: "male",
    useCase: "narration",
  },
});

console.log(`Created voice: ${voice.voiceId}`);
console.log(`Name: ${voice.name}`);
```

**Why good:** Multiple samples improve accuracy, `removeBackgroundNoise` cleans input, labels aid organization

```typescript
// BAD: Single short sample without noise removal
const voice = await client.voices.ivc.create({
  name: "Quick Clone",
  files: [createReadStream("short-clip.mp3")], // Too few/short samples
  // Missing removeBackgroundNoise
});
```

**Why bad:** Single short sample produces low-quality clone, background noise degrades voice model

---

## Use a Cloned Voice for TTS

```typescript
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";

const CLONED_VOICE_ID = "voice_abc123"; // From voices.ivc.create()

const audio = await client.textToSpeech.convert(CLONED_VOICE_ID, {
  text: "Speaking in the cloned voice with natural delivery.",
  modelId: "eleven_multilingual_v2",
  voiceSettings: {
    stability: 0.5,
    similarityBoost: 0.8, // Higher to match cloned voice closely
    style: 0.0,
  },
});

const readable = Readable.fromWeb(audio);
readable.pipe(createWriteStream("cloned-output.mp3"));
```

---

## Delete a Voice

```typescript
const VOICE_ID_TO_DELETE = "voice_abc123";

await client.voices.delete(VOICE_ID_TO_DELETE);
console.log("Voice deleted");
```

---

## Speech-to-Speech: Voice Conversion

Convert audio from one voice to another while preserving the emotion and cadence of the source.

```typescript
import { createReadStream, createWriteStream } from "node:fs";
import { Readable } from "node:stream";

const TARGET_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

const convertedAudio = await client.speechToSpeech.convert(TARGET_VOICE_ID, {
  audio: createReadStream("source-speech.mp3"),
  modelId: "eleven_multilingual_sts_v2",
  voiceSettings: {
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.0,
  },
});

const readable = Readable.fromWeb(convertedAudio);
readable.pipe(createWriteStream("converted-output.mp3"));
```

**Why good:** Uses STS-specific model, preserves source emotion and pacing, voice settings tuned for conversion

---

## Speech-to-Speech: Streaming

```typescript
import { createReadStream } from "node:fs";

const TARGET_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

const convertedStream = await client.speechToSpeech.stream(TARGET_VOICE_ID, {
  audio: createReadStream("source-speech.mp3"),
  modelId: "eleven_english_sts_v2",
  voiceSettings: {
    stability: 0.5,
    similarityBoost: 0.75,
  },
});

// Stream converted audio progressively
for await (const chunk of convertedStream) {
  process.stdout.write(chunk);
}
```

---

_For client setup and TTS examples, see [core.md](core.md). For WebSocket streaming, see [websocket.md](websocket.md). For API reference tables, see [reference.md](../reference.md)._
