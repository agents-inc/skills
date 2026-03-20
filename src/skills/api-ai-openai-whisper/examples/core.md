# OpenAI Whisper -- Core Examples

> Core transcription, translation, timestamps, streaming, chunking, and diarization patterns. See [SKILL.md](../SKILL.md) for decision frameworks and model selection guidance.

---

## Basic Transcription

```typescript
// transcribe.ts
import OpenAI from "openai";
import { createReadStream } from "node:fs";

const client = new OpenAI();

async function transcribe(audioPath: string): Promise<string> {
  const transcription = await client.audio.transcriptions.create({
    model: "gpt-4o-transcribe",
    file: createReadStream(audioPath),
  });

  return transcription.text;
}

const result = await transcribe("./meeting-recording.mp3");
console.log(result);

export { transcribe };
```

---

## Transcription with Language Hint

Specify the language when you know it -- improves accuracy for short or noisy audio.

```typescript
import OpenAI from "openai";
import { createReadStream } from "node:fs";

const client = new OpenAI();

// ISO 639-1 language codes: en, fr, de, ja, zh, es, etc.
async function transcribeWithLanguage(
  audioPath: string,
  language: string,
): Promise<string> {
  const transcription = await client.audio.transcriptions.create({
    model: "gpt-4o-transcribe",
    file: createReadStream(audioPath),
    language,
  });

  return transcription.text;
}

export { transcribeWithLanguage };
```

---

## Prompting for Vocabulary

Guide the model to correctly spell domain-specific terms, acronyms, and proper nouns.

```typescript
import OpenAI from "openai";
import { createReadStream } from "node:fs";

const client = new OpenAI();

// Prompt provides vocabulary context, not instructions
const TECH_VOCABULARY =
  "Kubernetes, kubectl, etcd, NGINX, gRPC, PostgreSQL, Redis, Terraform, Ansible";

const MEDICAL_VOCABULARY =
  "acetaminophen, ibuprofen, amoxicillin, metformin, lisinopril, CBC, MRI, CT scan";

async function transcribeWithVocabulary(
  audioPath: string,
  vocabulary: string,
): Promise<string> {
  const transcription = await client.audio.transcriptions.create({
    model: "gpt-4o-transcribe",
    file: createReadStream(audioPath),
    prompt: vocabulary,
  });

  return transcription.text;
}

export { transcribeWithVocabulary, TECH_VOCABULARY, MEDICAL_VOCABULARY };
```

**Why good:** Named constants for vocabularies, prompt used for context not instructions

---

## Timestamps (Word-Level and Segment-Level)

Timestamps require `whisper-1` with `response_format: "verbose_json"`.

```typescript
// timestamps.ts
import OpenAI from "openai";
import { createReadStream } from "node:fs";

const client = new OpenAI();

interface TimestampedWord {
  word: string;
  start: number;
  end: number;
}

async function transcribeWithWordTimestamps(
  audioPath: string,
): Promise<TimestampedWord[]> {
  const transcription = await client.audio.transcriptions.create({
    model: "whisper-1",
    file: createReadStream(audioPath),
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
  });

  return (
    transcription.words?.map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    })) ?? []
  );
}

async function transcribeWithSegmentTimestamps(audioPath: string) {
  const transcription = await client.audio.transcriptions.create({
    model: "whisper-1",
    file: createReadStream(audioPath),
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  return (
    transcription.segments?.map((s) => ({
      id: s.id,
      text: s.text,
      start: s.start,
      end: s.end,
    })) ?? []
  );
}

export { transcribeWithWordTimestamps, transcribeWithSegmentTimestamps };
```

---

## Subtitle Generation (SRT / VTT)

Generate subtitle files directly. Only `whisper-1` supports SRT and VTT formats.

```typescript
// subtitles.ts
import OpenAI from "openai";
import { createReadStream, writeFileSync } from "node:fs";

const client = new OpenAI();

async function generateSubtitles(
  audioPath: string,
  format: "srt" | "vtt",
  outputPath: string,
): Promise<void> {
  const transcription = await client.audio.transcriptions.create({
    model: "whisper-1",
    file: createReadStream(audioPath),
    response_format: format,
  });

  // SRT and VTT formats return the subtitle text directly as a string
  writeFileSync(outputPath, transcription as unknown as string);
}

await generateSubtitles("./video.mp4", "srt", "./video.srt");
await generateSubtitles("./video.mp4", "vtt", "./video.vtt");

export { generateSubtitles };
```

---

## Streaming Transcription

Progressive output as the model processes audio. Only `gpt-4o-transcribe` and `gpt-4o-mini-transcribe` support streaming.

```typescript
// stream-transcribe.ts
import OpenAI from "openai";
import { createReadStream } from "node:fs";

const client = new OpenAI();

async function streamTranscription(audioPath: string): Promise<string> {
  const stream = await client.audio.transcriptions.create({
    model: "gpt-4o-transcribe",
    file: createReadStream(audioPath),
    stream: true,
  });

  let fullText = "";

  for await (const event of stream) {
    if (event.type === "transcript.text.delta") {
      process.stdout.write(event.delta);
      fullText += event.delta;
    }

    if (event.type === "transcript.text.done") {
      console.log("\n--- Transcription complete ---");
    }
  }

  return fullText;
}

export { streamTranscription };
```

---

## Streaming with Logprobs (Confidence Scores)

Request log probabilities for each token to assess transcription confidence.

```typescript
import OpenAI from "openai";
import { createReadStream } from "node:fs";

const client = new OpenAI();
const LOW_CONFIDENCE_THRESHOLD = -1.0;

async function streamWithConfidence(audioPath: string): Promise<void> {
  const stream = await client.audio.transcriptions.create({
    model: "gpt-4o-transcribe",
    file: createReadStream(audioPath),
    stream: true,
    include: ["logprobs"],
  });

  for await (const event of stream) {
    if (event.type === "transcript.text.delta") {
      const logprobs = event.logprobs;
      if (logprobs) {
        for (const lp of logprobs) {
          if (lp.logprob < LOW_CONFIDENCE_THRESHOLD) {
            console.warn(`Low confidence: "${lp.token}" (${lp.logprob})`);
          }
        }
      }
      process.stdout.write(event.delta);
    }
  }
}

export { streamWithConfidence };
```

---

## Translation to English

Translate non-English audio to English. Only `whisper-1` is supported.

```typescript
// translate.ts
import OpenAI from "openai";
import { createReadStream } from "node:fs";

const client = new OpenAI();

async function translateToEnglish(audioPath: string): Promise<string> {
  const translation = await client.audio.translations.create({
    model: "whisper-1",
    file: createReadStream(audioPath),
  });

  return translation.text;
}

// With vocabulary prompt (in English) to guide output style
async function translateWithVocabulary(
  audioPath: string,
  vocabulary: string,
): Promise<string> {
  const translation = await client.audio.translations.create({
    model: "whisper-1",
    file: createReadStream(audioPath),
    prompt: vocabulary,
  });

  return translation.text;
}

export { translateToEnglish, translateWithVocabulary };
```

---

## Chunking Large Audio Files

Split audio exceeding 25 MB into smaller chunks and transcribe sequentially with context preservation.

```typescript
// chunk-transcribe.ts
import OpenAI from "openai";
import { createReadStream, statSync } from "node:fs";

const client = new OpenAI();
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const CONTEXT_TAIL_LENGTH = 200; // Characters of previous transcript to pass as prompt

/**
 * Transcribe pre-split audio chunks sequentially.
 * Split audio at sentence boundaries using ffmpeg or similar tool
 * before calling this function.
 *
 * Example ffmpeg split:
 *   ffmpeg -i long-recording.mp3 -f segment -segment_time 600 -c copy chunk_%03d.mp3
 */
async function transcribeChunks(
  chunkPaths: string[],
  vocabulary?: string,
): Promise<string> {
  const transcripts: string[] = [];

  for (const chunkPath of chunkPaths) {
    const fileSize = statSync(chunkPath).size;
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `Chunk ${chunkPath} exceeds 25 MB limit (${(fileSize / 1024 / 1024).toFixed(1)} MB)`,
      );
    }

    // Combine vocabulary with tail of previous transcript for context
    const previousTail = transcripts.at(-1)?.slice(-CONTEXT_TAIL_LENGTH) ?? "";
    const prompt = [vocabulary, previousTail].filter(Boolean).join(" ");

    const transcription = await client.audio.transcriptions.create({
      model: "gpt-4o-transcribe",
      file: createReadStream(chunkPath),
      prompt: prompt || undefined,
    });

    transcripts.push(transcription.text);
  }

  return transcripts.join(" ");
}

export { transcribeChunks, MAX_FILE_SIZE_BYTES };
```

**Why good:** Validates chunk size, preserves context across chunks via prompt, supports optional vocabulary, named constants

---

## Speaker Diarization

Identify speakers in multi-speaker audio. Requires `gpt-4o-transcribe-diarize` model.

```typescript
// diarize.ts
import OpenAI from "openai";
import { createReadStream } from "node:fs";

const client = new OpenAI();

async function transcribeWithSpeakers(audioPath: string) {
  const transcription = await client.audio.transcriptions.create({
    model: "gpt-4o-transcribe-diarize",
    file: createReadStream(audioPath),
    response_format: "diarized_json",
    chunking_strategy: "auto", // Required for audio > 30 seconds
  });

  return transcription;
}

// With known speaker references (up to 4 speakers)
// Provide 2-10 second audio clips as data URLs for each speaker
async function transcribeWithKnownSpeakers(
  audioPath: string,
  speakers: Array<{ name: string; referenceDataUrl: string }>,
) {
  const transcription = await client.audio.transcriptions.create({
    model: "gpt-4o-transcribe-diarize",
    file: createReadStream(audioPath),
    response_format: "diarized_json",
    chunking_strategy: "auto",
    // @ts-expect-error -- SDK types may lag behind API; these are valid API parameters
    known_speaker_names: speakers.map((s) => s.name),
    known_speaker_references: speakers.map((s) => s.referenceDataUrl),
  });

  return transcription;
}

export { transcribeWithSpeakers, transcribeWithKnownSpeakers };
```

**Why good:** Uses correct model and response format, includes `chunking_strategy: "auto"`, shows both anonymous and named speaker patterns

---

_For model selection guidance and decision frameworks, see [SKILL.md](../SKILL.md)._
