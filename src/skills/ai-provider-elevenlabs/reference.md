# ElevenLabs Quick Reference

> Client configuration, model IDs, API methods, voice settings, output formats, and error types. See [SKILL.md](SKILL.md) for core concepts and [examples/](examples/) for code examples.

---

## Package Installation

```bash
# Server-side TTS SDK (always required)
npm install @elevenlabs/elevenlabs-js

# Conversational AI agents (browser-side, optional)
npm install @elevenlabs/client

# React hooks for conversational AI (optional)
npm install @elevenlabs/react
```

---

## Client Configuration

```typescript
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY, // Auto-reads from env if not set
  timeoutInSeconds: 60, // Default: 240
  maxRetries: 3, // Retry on 408/409/429/5xx (default: 2)
});
```

### Environment Variables

| Variable             | Purpose                 |
| -------------------- | ----------------------- |
| `ELEVENLABS_API_KEY` | API key (auto-detected) |

---

## Model IDs

### Text-to-Speech Models

| Model ID                 | Quality | Latency  | Languages | Char Limit | Use Case                                |
| ------------------------ | ------- | -------- | --------- | ---------- | --------------------------------------- |
| `eleven_v3`              | Highest | Standard | 70+       | 5,000      | Best quality, emotional range, dialogue |
| `eleven_multilingual_v2` | High    | Higher   | 29        | 10,000     | Long-form stability, audiobooks         |
| `eleven_flash_v2_5`      | Good    | ~75ms    | 32        | 40,000     | Real-time, lowest latency, 50% cheaper  |
| `eleven_flash_v2`        | Good    | ~75ms    | English   | 30,000     | English-only low latency                |
| `eleven_ttv_v3`          | High    | Standard | 70+       | 5,000      | Voice design from text prompts          |

### Speech-to-Speech Models

| Model ID                     | Languages | Use Case                   |
| ---------------------------- | --------- | -------------------------- |
| `eleven_multilingual_sts_v2` | 29        | Voice conversion (multi)   |
| `eleven_english_sts_v2`      | English   | Voice conversion (English) |

### Speech-to-Text Models

| Model ID             | Languages | Latency | Features                |
| -------------------- | --------- | ------- | ----------------------- |
| `scribe_v2`          | 90+       | Batch   | Timestamps, diarization |
| `scribe_v2_realtime` | 90+       | ~150ms  | VAD, streaming          |

### Deprecated Models (Migrate Away)

| Deprecated               | Replacement              |
| ------------------------ | ------------------------ |
| `eleven_turbo_v2_5`      | `eleven_flash_v2_5`      |
| `eleven_turbo_v2`        | `eleven_flash_v2`        |
| `eleven_monolingual_v1`  | `eleven_multilingual_v2` |
| `eleven_multilingual_v1` | `eleven_multilingual_v2` |

---

## API Methods Reference

### Text-to-Speech

```typescript
// Full audio generation -- returns ReadableStream<Uint8Array>
const audio = await client.textToSpeech.convert(voiceId, {
  text: string,                    // Required
  modelId?: string,                // Default: voice's configured model
  outputFormat?: string,           // Default: mp3_44100_128
  voiceSettings?: VoiceSettings,   // Override voice defaults
  languageCode?: string,           // ISO 639-1 code
  seed?: number,                   // 0-4294967295 for deterministic output
  previousText?: string,           // Context for continuity
  nextText?: string,               // Context for continuity
  previousRequestIds?: string[],   // Up to 3, for multi-part consistency
  nextRequestIds?: string[],       // Up to 3
  pronunciationDictionaryLocators?: PronunciationLocator[], // Up to 3
  applyTextNormalization?: "auto" | "on" | "off",
});

// Streaming -- same params, lower time-to-first-byte
const stream = await client.textToSpeech.stream(voiceId, {
  ...sameParamsAsConvert,
  optimizeStreamingLatency?: 0 | 1 | 2 | 3 | 4,  // 0=none, 4=max
});

// Full audio with character-level timestamps
const { audioBase64, alignment } = await client.textToSpeech.convertWithTimestamps(voiceId, {
  ...sameParamsAsConvert,
});

// Streaming with character-level timestamps (SSE)
const timestampStream = await client.textToSpeech.streamWithTimestamps(voiceId, {
  ...sameParamsAsConvert,
});
```

### Voices

```typescript
// Search all voices
const { voices } = await client.voices.search();

// Get specific voice
const voice = await client.voices.get(voiceId);

// Instant voice clone
const voice = await client.voices.ivc.create({
  name: string,               // Voice display name
  files: ReadStream[],         // 1-25 audio samples
  removeBackgroundNoise?: boolean,
  description?: string,
  labels?: Record<string, string>,
});

// Delete voice
await client.voices.delete(voiceId);
```

### Speech-to-Speech

```typescript
// Voice conversion -- returns ReadableStream<Uint8Array>
const audio = await client.speechToSpeech.convert(voiceId, {
  audio: ReadStream | File,    // Source audio
  modelId?: string,            // eleven_multilingual_sts_v2 or eleven_english_sts_v2
  voiceSettings?: VoiceSettings,
  outputFormat?: string,
});

// Streaming voice conversion
const stream = await client.speechToSpeech.stream(voiceId, {
  ...sameParamsAsConvert,
});
```

### Speech-to-Text

```typescript
// Batch transcription
const transcript = await client.speechToText.convert({
  audio: ReadStream | File,
  modelId: "scribe_v2",
  languageCode?: string,
});
```

---

## Voice Settings

| Setting           | Range    | Default | Effect                             |
| ----------------- | -------- | ------- | ---------------------------------- |
| `stability`       | 0.0-1.0  | ~0.5    | Lower = more expressive/variable   |
| `similarityBoost` | 0.0-1.0  | ~0.75   | Higher = closer to original voice  |
| `style`           | 0.0-1.0  | 0       | Higher = more style exaggeration   |
| `useSpeakerBoost` | boolean  | true    | Enhanced similarity (adds latency) |
| `speed`           | ~0.7-1.3 | 1.0     | Speech rate multiplier             |

### Recommended Starting Values

| Use Case       | stability | similarityBoost | style |
| -------------- | --------- | --------------- | ----- |
| Narration      | 0.5       | 0.75            | 0.0   |
| Conversational | 0.4       | 0.7             | 0.3   |
| Expressive     | 0.3       | 0.8             | 0.5   |
| Stable/formal  | 0.7       | 0.8             | 0.0   |

---

## Output Formats

### MP3

| Format          | Sample Rate | Bitrate  | Notes                       |
| --------------- | ----------- | -------- | --------------------------- |
| `mp3_22050_32`  | 22.05 kHz   | 32 kbps  | Smallest file size          |
| `mp3_44100_64`  | 44.1 kHz    | 64 kbps  | Low bandwidth               |
| `mp3_44100_128` | 44.1 kHz    | 128 kbps | **Default** -- good balance |
| `mp3_44100_192` | 44.1 kHz    | 192 kbps | Creator+ tier               |

### PCM (Raw Audio)

| Format      | Sample Rate |
| ----------- | ----------- |
| `pcm_8000`  | 8 kHz       |
| `pcm_16000` | 16 kHz      |
| `pcm_22050` | 22.05 kHz   |
| `pcm_24000` | 24 kHz      |
| `pcm_44100` | 44.1 kHz    |

### Other

| Format           | Use Case           |
| ---------------- | ------------------ |
| `opus_48000_128` | Low-bandwidth web  |
| `wav_44100`      | Uncompressed audio |
| `ulaw_8000`      | Telephony          |
| `alaw_8000`      | Telephony          |

---

## Error Types

| Error Class                | Trigger                            | Auto-Retried? |
| -------------------------- | ---------------------------------- | ------------- |
| `ElevenLabsError`          | General API errors (various codes) | 429/5xx: Yes  |
| `ElevenLabsTimeoutError`   | Request exceeds timeout            | No            |
| `UnprocessableEntityError` | 422 validation failure             | No            |

The SDK auto-retries on HTTP 408, 409, 429, and 5xx responses (2 retries by default).

### Error Properties

- `.message` -- Error description
- `.statusCode` -- HTTP status code
- `.body` -- Response body (JSON)

---

## Per-Request Overrides

```typescript
const audio = await client.textToSpeech.convert(
  voiceId,
  { text: "Hello", modelId: "eleven_v3" },
  {
    timeoutInSeconds: 120,
    maxRetries: 5,
    abortSignal: abortController.signal,
    headers: { "X-Custom-Header": "value" },
  },
);
```

---

## WebSocket Input Streaming

### Connection URL

```
wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input?model_id={model}&output_format={format}
```

### Query Parameters

| Parameter             | Type    | Default       | Description               |
| --------------------- | ------- | ------------- | ------------------------- |
| `model_id`            | string  | --            | Model identifier          |
| `output_format`       | string  | mp3_44100_128 | Audio codec               |
| `enable_ssml_parsing` | boolean | false         | Process SSML markup       |
| `inactivity_timeout`  | integer | 20            | Seconds before disconnect |
| `sync_alignment`      | boolean | false         | Include character timing  |
| `auto_mode`           | boolean | false         | Automatic generation mode |

### Message Protocol

```json
// 1. Initialize (first message)
{ "text": " ", "voice_settings": { "stability": 0.5, "similarity_boost": 0.75 },
  "generation_config": { "chunk_length_schedule": [120, 160, 250, 290] } }

// 2. Send text (must end with space)
{ "text": "Your text content ", "try_trigger_generation": false }

// 3. Close connection
{ "text": "" }
```

### Server Responses

```json
// Audio chunk
{ "audio": "base64_encoded_data", "alignment": { "chars": ["H","e","l"], "charStartTimesMs": [0,3,8], "charDurationsMs": [3,5,12] } }

// Completion
{ "isFinal": true }
```
