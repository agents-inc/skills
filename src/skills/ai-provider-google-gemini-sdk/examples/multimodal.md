# Google Gemini SDK -- Multimodal Input Examples

> Inline images (base64), file upload, video, audio, PDF input, and `createPartFromUri` helper. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [streaming.md](streaming.md) -- Streaming responses
- [tools.md](tools.md) -- Function calling
- [structured-output.md](structured-output.md) -- Structured JSON output
- [chat.md](chat.md) -- Multi-turn chat
- [advanced.md](advanced.md) -- Embeddings, caching, safety

---

## Inline Image (Base64)

For images under 20 MB, embed directly as base64:

```typescript
import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const imageBase64 = fs.readFileSync("screenshot.png", { encoding: "base64" });

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    { text: "What does this screenshot show? Identify any UI issues." },
    { inlineData: { mimeType: "image/png", data: imageBase64 } },
  ],
});

console.log(response.text);
```

---

## Multiple Images

```typescript
const image1 = fs.readFileSync("before.png", { encoding: "base64" });
const image2 = fs.readFileSync("after.png", { encoding: "base64" });

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    { text: "Compare these two UI designs. What changed?" },
    { inlineData: { mimeType: "image/png", data: image1 } },
    { inlineData: { mimeType: "image/png", data: image2 } },
  ],
});
```

---

## File Upload (Large Files)

For files over 20 MB (up to 2 GB), use `ai.files.upload()`:

```typescript
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const uploadedFile = await ai.files.upload({
  file: "presentation.pdf",
  config: { mimeType: "application/pdf" },
});

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: createUserContent([
    "Summarize the key points of this presentation.",
    createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
  ]),
});

console.log(response.text);
```

**Key point:** Uploaded files persist for 48 hours, then auto-delete. Re-upload if needed.

---

## Inline PDF (Under 50 MB)

```typescript
import * as fs from "node:fs";

const pdfBase64 = fs.readFileSync("contract.pdf", { encoding: "base64" });

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    { text: "Extract the key terms and obligations from this contract." },
    { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
  ],
});

console.log(response.text);
```

**Note:** Inline PDF limit is 50 MB (lower than the general 100 MB inline limit).

---

## Audio Input

```typescript
const audioBase64 = fs.readFileSync("meeting-recording.mp3", {
  encoding: "base64",
});

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: [
    { text: "Transcribe this audio and list the action items discussed." },
    { inlineData: { mimeType: "audio/mpeg", data: audioBase64 } },
  ],
});

console.log(response.text);
```

---

## Video Input (File Upload)

Videos are typically too large for inline data -- use file upload:

```typescript
import { createUserContent, createPartFromUri } from "@google/genai";

const video = await ai.files.upload({
  file: "demo-recording.mp4",
  config: { mimeType: "video/mp4" },
});

const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: createUserContent([
    "Describe what happens in this video. Note any UI bugs visible.",
    createPartFromUri(video.uri, video.mimeType),
  ]),
});

console.log(response.text);
```

---

## External URL (Gemini 3+ Only)

Gemini 3+ models can fetch content from HTTP URLs directly:

```typescript
import { createPartFromUri } from "@google/genai";

const response = await ai.models.generateContent({
  model: "gemini-3-flash-preview",
  contents: [
    createPartFromUri("https://example.com/report.pdf", "application/pdf"),
    "Summarize this PDF report.",
  ],
});
```

**Note:** External URL input is NOT supported for Gemini 2.x models.

---

## File Lifecycle Management

```typescript
// Upload
const file = await ai.files.upload({
  file: "document.pdf",
  config: {
    mimeType: "application/pdf",
    displayName: "Q4 Report",
  },
});

console.log(`Uploaded: ${file.name}`);
console.log(`URI: ${file.uri}`);
console.log(`Size: ${file.sizeBytes} bytes`);

// List uploaded files
const files = await ai.files.list();

// Get file info
const info = await ai.files.get({ name: file.name });

// Delete file (before 48-hour auto-expiry)
await ai.files.delete({ name: file.name });
```

---

## Supported MIME Types

| Category  | MIME Types                                                           |
| --------- | -------------------------------------------------------------------- |
| Images    | `image/jpeg`, `image/png`, `image/webp`, `image/bmp`                 |
| Video     | `video/mp4`, `video/mpeg`, `video/quicktime`, `video/webm`           |
| Audio     | `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/flac`, `audio/aac`    |
| Documents | `application/pdf`                                                    |
| Text      | `text/plain`, `text/html`, `text/css`, `text/csv`, `text/javascript` |
| Data      | `application/json`, `text/xml`                                       |

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
