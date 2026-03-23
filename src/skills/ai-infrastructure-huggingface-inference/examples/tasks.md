# Hugging Face Inference -- Task Examples (Embeddings, Vision, Audio, NLP)

> Task-specific examples: feature extraction, image generation, speech recognition, translation, summarization, classification, and more. See [SKILL.md](../SKILL.md) for core patterns.

**Prerequisites**: Understand client setup and chat completion from [core.md](core.md) first.

**Related examples:**

- [core.md](core.md) -- Client setup, chat completion, text generation, streaming

---

## Feature Extraction (Embeddings)

```typescript
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);

// Single input -- returns number[]
const embedding = await client.featureExtraction({
  model: "sentence-transformers/all-MiniLM-L6-v2",
  inputs: "That is a happy person",
});
```

---

## Batch Embeddings with Cosine Similarity

```typescript
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const texts = [
  "TypeScript adds static types to JavaScript",
  "JavaScript is a dynamic programming language",
  "The weather is nice today",
];

// featureExtraction accepts a single string input
// For batch, call individually or use a model that supports array inputs
const embeddings = await Promise.all(
  texts.map((text) =>
    client.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: text,
    }),
  ),
);

// Compare first text to all others
const SIMILARITY_THRESHOLD = 0.5;
for (let i = 1; i < texts.length; i++) {
  const similarity = cosineSimilarity(
    embeddings[0] as number[],
    embeddings[i] as number[],
  );
  const isRelated = similarity > SIMILARITY_THRESHOLD;
  console.log(
    `"${texts[0]}" vs "${texts[i]}": ${similarity.toFixed(4)} (${isRelated ? "related" : "unrelated"})`,
  );
}
```

---

## Text-to-Image

```typescript
import { InferenceClient } from "@huggingface/inference";
import { writeFileSync } from "node:fs";

const client = new InferenceClient(process.env.HF_TOKEN);

// Default output is Blob
const imageBlob = await client.textToImage({
  model: "black-forest-labs/FLUX.1-dev",
  inputs: "a serene mountain landscape at sunset, oil painting style",
  provider: "replicate",
});

// Write Blob to file
const buffer = Buffer.from(await imageBlob.arrayBuffer());
writeFileSync("output/landscape.png", buffer);
```

---

## Text-to-Image with Output Options

```typescript
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);

// Get as URL string
const imageUrl = await client.textToImage(
  {
    model: "black-forest-labs/FLUX.1-dev",
    inputs: "a cat wearing a hat",
  },
  { outputType: "url" },
);
console.log("Image URL:", imageUrl);

// Get as data URL (base64 embedded)
const dataUrl = await client.textToImage(
  {
    model: "black-forest-labs/FLUX.1-dev",
    inputs: "a cat wearing a hat",
  },
  { outputType: "dataUrl" },
);
// Use dataUrl directly in <img src="...">
```

---

## Image Classification

```typescript
import { InferenceClient } from "@huggingface/inference";
import { readFileSync } from "node:fs";

const client = new InferenceClient(process.env.HF_TOKEN);

const results = await client.imageClassification({
  model: "google/vit-base-patch16-224",
  data: readFileSync("images/photo.png"),
});

// Results: Array<{ label: string, score: number }>
for (const result of results) {
  console.log(`${result.label}: ${(result.score * 100).toFixed(1)}%`);
}
```

---

## Image to Text (Captioning)

```typescript
import { InferenceClient } from "@huggingface/inference";
import { readFileSync } from "node:fs";

const client = new InferenceClient(process.env.HF_TOKEN);

const result = await client.imageToText({
  model: "nlpconnect/vit-gpt2-image-captioning",
  data: readFileSync("images/photo.png"),
});

console.log("Caption:", result.generated_text);
```

---

## Object Detection

```typescript
import { InferenceClient } from "@huggingface/inference";
import { readFileSync } from "node:fs";

const client = new InferenceClient(process.env.HF_TOKEN);

const detections = await client.objectDetection({
  model: "facebook/detr-resnet-50",
  data: readFileSync("images/street.png"),
});

// Results: Array<{ label: string, score: number, box: { xmin, ymin, xmax, ymax } }>
for (const detection of detections) {
  console.log(
    `${detection.label} (${(detection.score * 100).toFixed(1)}%) at [${detection.box.xmin}, ${detection.box.ymin}]`,
  );
}
```

---

## Automatic Speech Recognition (Transcription)

```typescript
import { InferenceClient } from "@huggingface/inference";
import { readFileSync } from "node:fs";

const client = new InferenceClient(process.env.HF_TOKEN);

const result = await client.automaticSpeechRecognition({
  model: "facebook/wav2vec2-large-960h-lv60-self",
  data: readFileSync("audio/recording.flac"),
});

console.log("Transcript:", result.text);
```

---

## Audio Classification

```typescript
import { InferenceClient } from "@huggingface/inference";
import { readFileSync } from "node:fs";

const client = new InferenceClient(process.env.HF_TOKEN);

const results = await client.audioClassification({
  model: "superb/hubert-large-superb-er",
  data: readFileSync("audio/sample.flac"),
});

// Results: Array<{ label: string, score: number }>
for (const result of results) {
  console.log(`${result.label}: ${(result.score * 100).toFixed(1)}%`);
}
```

---

## Text to Speech

```typescript
import { InferenceClient } from "@huggingface/inference";
import { writeFileSync } from "node:fs";

const client = new InferenceClient(process.env.HF_TOKEN);

const audioBlob = await client.textToSpeech({
  model: "espnet/kan-bayashi_ljspeech_vits",
  inputs: "Hello, welcome to the application!",
});

const buffer = Buffer.from(await audioBlob.arrayBuffer());
writeFileSync("output/speech.wav", buffer);
```

---

## Translation

```typescript
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);

// Simple translation (model determines source/target)
const result = await client.translation({
  model: "t5-base",
  inputs: "My name is Wolfgang and I live in Berlin",
});

console.log("Translation:", result.translation_text);
```

```typescript
// Many-to-many model with explicit language codes
const result = await client.translation({
  model: "facebook/mbart-large-50-many-to-many-mmt",
  inputs: "My name is Wolfgang and I live in Berlin",
  parameters: {
    src_lang: "en_XX",
    tgt_lang: "fr_XX",
  },
});

console.log("French:", result.translation_text);
```

---

## Summarization

```typescript
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);
const MAX_LENGTH = 100;

const result = await client.summarization({
  model: "facebook/bart-large-cnn",
  inputs:
    "The tower is 324 metres (1,063 ft) tall, about the same height as an 81-storey building, " +
    "and the tallest structure in Paris. Its base is square, measuring 125 metres (410 ft) on " +
    "each side. During its construction, the Eiffel Tower surpassed the Washington Monument to " +
    "become the tallest man-made structure in the world, a title it held for 41 years until the " +
    "Chrysler Building in New York City was finished in 1930.",
  parameters: { max_length: MAX_LENGTH },
});

console.log("Summary:", result.summary_text);
```

---

## Text Classification (Sentiment Analysis)

```typescript
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);

const results = await client.textClassification({
  model: "distilbert-base-uncased-finetuned-sst-2-english",
  inputs: "I love this product! It works perfectly.",
});

// Results: Array<{ label: string, score: number }>
for (const result of results) {
  console.log(`${result.label}: ${(result.score * 100).toFixed(1)}%`);
}
```

---

## Token Classification (Named Entity Recognition)

```typescript
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);

const entities = await client.tokenClassification({
  model: "dbmdz/bert-large-cased-finetuned-conll03-english",
  inputs: "My name is Sarah Jessica Parker but you can call me Jessica",
});

// Results: Array<{ entity_group: string, word: string, score: number, start: number, end: number }>
for (const entity of entities) {
  console.log(
    `${entity.word} -> ${entity.entity_group} (${(entity.score * 100).toFixed(1)}%)`,
  );
}
```

---

## Zero-Shot Classification

```typescript
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);

const result = await client.zeroShotClassification({
  model: "facebook/bart-large-mnli",
  inputs: [
    "Hi, I recently bought a device from your company but it is not working as advertised and I would like to get reimbursed!",
  ],
  parameters: { candidate_labels: ["refund", "legal", "faq"] },
});

// Result includes labels sorted by score
console.log(result);
```

---

## Question Answering (Extractive)

```typescript
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);

const result = await client.questionAnswering({
  model: "deepset/roberta-base-squad2",
  inputs: {
    question: "What is the capital of France?",
    context:
      "The capital of France is Paris. It is located in the north of the country.",
  },
});

console.log(`Answer: ${result.answer} (score: ${result.score.toFixed(4)})`);
```

---

## Sentence Similarity

```typescript
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);

const result = await client.sentenceSimilarity({
  model: "sentence-transformers/paraphrase-xlm-r-multilingual-v1",
  inputs: {
    source_sentence: "That is a happy person",
    sentences: [
      "That is a happy dog",
      "That is a very happy person",
      "Today is a sunny day",
    ],
  },
});

// Returns: number[] (similarity scores for each sentence)
console.log("Similarity scores:", result);
```

---

## Visual Question Answering

```typescript
import { InferenceClient } from "@huggingface/inference";

const client = new InferenceClient(process.env.HF_TOKEN);

const result = await client.visualQuestionAnswering({
  model: "dandelin/vilt-b32-finetuned-vqa",
  inputs: {
    question: "How many cats are in the image?",
    image: await (await fetch("https://example.com/cats.jpg")).blob(),
  },
});

console.log(`Answer: ${result.answer} (score: ${result.score.toFixed(4)})`);
```

---

_For client setup and chat patterns, see [core.md](core.md). For API reference tables, see [reference.md](../reference.md)._
