# Modal -- Web Endpoints & TypeScript Client Examples

> Defining Modal web endpoints in Python and calling them from TypeScript. See [SKILL.md](../SKILL.md) for core concepts and decision frameworks.

**Related files:**

- [reference.md](../reference.md) -- CLI commands, GPU types, SDK API, limits

---

## Web Endpoint with TypeScript Client

A complete example: Modal GPU endpoint serving inference, consumed by a TypeScript app.

### Python Side

```python
# app/inference.py
import modal

app = modal.App("text-classifier")

classifier_image = (
    modal.Image.debian_slim(python_version="3.11")
    .uv_pip_install([
        "transformers==4.47.0",
        "torch==2.5.0",
        "accelerate==1.2.0",
    ])
)

MODEL_ID = "distilbert/distilbert-base-uncased-finetuned-sst-2-english"
CACHE_DIR = "/models"

vol = modal.Volume.from_name("model-cache", create_if_missing=True)


@app.cls(
    image=classifier_image,
    gpu="T4",
    secrets=[modal.Secret.from_name("huggingface-secret")],
    volumes={CACHE_DIR: vol},
    min_containers=1,
)
class Classifier:
    @modal.enter()
    def load_model(self):
        from transformers import pipeline

        self.pipe = pipeline(
            "text-classification",
            model=MODEL_ID,
            device="cuda",
            model_kwargs={"cache_dir": CACHE_DIR},
        )

    @modal.fastapi_endpoint(method="POST", requires_proxy_auth=True)
    def classify(self, payload: dict):
        text = payload["text"]
        result = self.pipe(text)
        return {"label": result[0]["label"], "score": result[0]["score"]}

    @modal.fastapi_endpoint(method="GET")
    def health(self):
        return {"status": "ok", "model": MODEL_ID}
```

**Why good:** `@modal.cls` with `@modal.enter()` loads model once per container (not per request), volume caches weights, `min_containers=1` avoids cold starts, auth on classify but not health

### TypeScript Side

```typescript
// lib/classifier-client.ts

const CLASSIFIER_URL = process.env.MODAL_CLASSIFIER_URL;
const MODAL_KEY = process.env.MODAL_PROXY_KEY;
const MODAL_SECRET = process.env.MODAL_PROXY_SECRET;
const REQUEST_TIMEOUT_MS = 30_000;

interface ClassifyRequest {
  text: string;
}

interface ClassifyResponse {
  label: string;
  score: number;
}

async function classify(input: ClassifyRequest): Promise<ClassifyResponse> {
  if (!CLASSIFIER_URL) {
    throw new Error("MODAL_CLASSIFIER_URL is not configured");
  }
  if (!MODAL_KEY || !MODAL_SECRET) {
    throw new Error("Modal proxy auth credentials not configured");
  }

  const response = await fetch(`${CLASSIFIER_URL}/classify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Modal-Key": MODAL_KEY,
      "Modal-Secret": MODAL_SECRET,
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.status === 401) {
    throw new Error("Modal proxy auth failed -- check credentials");
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Classifier error [${response.status}]: ${body}`);
  }

  return response.json() as Promise<ClassifyResponse>;
}

export { classify };
export type { ClassifyRequest, ClassifyResponse };
```

**Why good:** Environment-based URL config, auth validation before request, typed request/response, timeout for cold start resilience, named exports

---

## TypeScript SDK (Direct Function Calls)

For server-to-server calls without HTTP serialization. Requires Node 22+.

```typescript
// lib/modal-inference.ts
import { ModalClient } from "modal";

// Create client once (reads MODAL_TOKEN_ID and MODAL_TOKEN_SECRET from env)
const modal = new ModalClient();

async function classify(
  text: string,
): Promise<{ label: string; score: number }> {
  const fn = await modal.functions.fromName(
    "text-classifier",
    "Classifier.classify",
  );
  const result = await fn.remote([{ text }]);
  return result as { label: string; score: number };
}

// Fire-and-forget pattern for long-running tasks
async function startBatchJob(texts: string[]): Promise<string> {
  const fn = await modal.functions.fromName("batch-processor", "process_batch");
  const call = await fn.spawn([texts]);
  // Return call ID for later retrieval
  return call.objectId;
}

export { classify, startBatchJob };
```

**Why good:** Client created once, `spawn()` for async jobs, no HTTP overhead

---

## vLLM Model Serving

Production-grade LLM serving with OpenAI-compatible API.

### Python Side

```python
# app/vllm_server.py
import modal
import subprocess

app = modal.App("vllm-server")

MODEL_ID = "meta-llama/Llama-3.1-8B-Instruct"
CACHE_DIR = "/models"
PORT = 8000

vllm_image = (
    modal.Image.debian_slim(python_version="3.11")
    .uv_pip_install(["vllm==0.6.4"])
)

vol = modal.Volume.from_name("llm-cache", create_if_missing=True)


@app.function(
    image=vllm_image,
    gpu="A100",
    secrets=[modal.Secret.from_name("huggingface-secret")],
    volumes={CACHE_DIR: vol},
    min_containers=1,
    scaledown_window=300,
    timeout=600,
)
@modal.web_server(port=PORT)
def serve_vllm():
    subprocess.Popen([
        "python", "-m", "vllm.entrypoints.openai.api_server",
        "--model", MODEL_ID,
        "--download-dir", CACHE_DIR,
        "--host", "0.0.0.0",
        "--port", str(PORT),
    ])
```

### TypeScript Side (OpenAI-Compatible)

```typescript
// lib/llm-client.ts
const VLLM_BASE_URL = process.env.MODAL_VLLM_URL;
const REQUEST_TIMEOUT_MS = 60_000;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

async function chatCompletion(
  messages: ChatMessage[],
  model = "meta-llama/Llama-3.1-8B-Instruct",
): Promise<ChatCompletionResponse> {
  if (!VLLM_BASE_URL) {
    throw new Error("MODAL_VLLM_URL is not configured");
  }

  const response = await fetch(`${VLLM_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `vLLM error [${response.status}]: ${await response.text()}`,
    );
  }

  return response.json() as Promise<ChatCompletionResponse>;
}

export { chatCompletion };
export type { ChatMessage, ChatCompletionResponse };
```

**Why good:** vLLM exposes OpenAI-compatible API, TypeScript client is just standard fetch. Uses `--host 0.0.0.0` (required for `@modal.web_server`), volume for model caching.

---

## Streaming Endpoint

For real-time token streaming from GPU models.

### Python Side

```python
# app/streaming.py
import modal
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = modal.App("streaming-api")
web_app = FastAPI()


@web_app.post("/generate")
async def generate(payload: dict):
    async def stream_tokens():
        # Your model generates tokens
        for token in model.generate_stream(payload["prompt"]):
            yield f"data: {token}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream_tokens(), media_type="text/event-stream")


@app.function(
    image=modal.Image.debian_slim().uv_pip_install(["fastapi"]),
    gpu="A10G",
)
@modal.asgi_app()
def serve():
    return web_app
```

### TypeScript Side

```typescript
// lib/stream-client.ts
const STREAM_URL = process.env.MODAL_STREAM_URL;
const STREAM_TIMEOUT_MS = 120_000;

async function* streamGenerate(prompt: string): AsyncGenerator<string> {
  if (!STREAM_URL) {
    throw new Error("MODAL_STREAM_URL is not configured");
  }

  const response = await fetch(`${STREAM_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal: AbortSignal.timeout(STREAM_TIMEOUT_MS),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Stream error [${response.status}]`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n").filter((line) => line.startsWith("data: "));

    for (const line of lines) {
      const data = line.slice("data: ".length).trim();
      if (data === "[DONE]") return;
      yield data;
    }
  }
}

export { streamGenerate };
```

**Why good:** SSE streaming for real-time token output, async generator pattern for clean consumption, proper reader cleanup

---

## Scheduled Batch Processing

GPU batch jobs on a schedule, with results stored in a volume.

```python
# app/batch.py
import modal
import json

app = modal.App("batch-processor")

vol = modal.Volume.from_name("batch-results", create_if_missing=True)

RESULTS_DIR = "/results"
BATCH_SIZE = 100


@app.function(
    schedule=modal.Cron("0 3 * * *"),  # 3 AM daily
    gpu="A10G",
    volumes={RESULTS_DIR: vol},
    timeout=3600,
)
def nightly_embeddings():
    import datetime

    # Scheduled functions take no arguments -- read input from volume or DB
    texts = load_pending_texts()

    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        embeddings = compute_embeddings(batch)

        output_path = f"{RESULTS_DIR}/{datetime.date.today()}/batch_{i}.json"
        with open(output_path, "w") as f:
            json.dump(embeddings, f)

    vol.commit()  # Persist results
```

**Why good:** `modal.Cron` for exact daily timing (doesn't reset on redeploy), volume for persistent results, `vol.commit()` ensures writes are durable, batch processing with named constants
