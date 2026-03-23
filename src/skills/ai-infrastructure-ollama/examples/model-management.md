# Ollama -- Model Management Examples

> Pull, list, show, delete, copy, create, and monitor running models. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, chat, streaming
- [tools.md](tools.md) -- Tool/function calling
- [structured-output.md](structured-output.md) -- Structured output with Zod
- [embeddings-vision.md](embeddings-vision.md) -- Embeddings, vision

---

## Pull a Model with Progress

```typescript
import ollama from "ollama";

async function pullModel(modelName: string): Promise<void> {
  console.log(`Pulling ${modelName}...`);

  const stream = await ollama.pull({ model: modelName, stream: true });

  for await (const progress of stream) {
    const completed = progress.completed ?? 0;
    const total = progress.total ?? 0;
    const percent = total > 0 ? ((completed / total) * 100).toFixed(1) : "0.0";
    process.stdout.write(`\r${progress.status}: ${percent}%`);
  }

  console.log(`\n${modelName} pulled successfully.`);
}

await pullModel("llama3.1");
```

---

## List Available Models

```typescript
import ollama from "ollama";

const MB_DIVISOR = 1024 * 1024;
const GB_DIVISOR = 1024 * 1024 * 1024;

const list = await ollama.list();

for (const model of list.models) {
  const sizeGB = (model.size / GB_DIVISOR).toFixed(1);
  console.log(
    `${model.name} -- ${sizeGB} GB -- ${model.details.parameter_size}`,
  );
  console.log(`  Family: ${model.details.family}`);
  console.log(`  Quantization: ${model.details.quantization_level}`);
  console.log(`  Modified: ${model.modified_at}`);
}
```

---

## Show Model Details

```typescript
import ollama from "ollama";

const info = await ollama.show({ model: "llama3.1" });

console.log("Model info:");
console.log(`  Format: ${info.details.format}`);
console.log(`  Family: ${info.details.family}`);
console.log(`  Parameters: ${info.details.parameter_size}`);
console.log(`  Quantization: ${info.details.quantization_level}`);

// System prompt (if set in Modelfile)
if (info.system) {
  console.log(`  System: ${info.system}`);
}

// Template format
if (info.template) {
  console.log(`  Template: ${info.template.slice(0, 100)}...`);
}
```

---

## Delete a Model

```typescript
import ollama from "ollama";

async function deleteModel(modelName: string): Promise<void> {
  try {
    await ollama.delete({ model: modelName });
    console.log(`Deleted ${modelName}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      console.log(`Model ${modelName} not found -- nothing to delete`);
    } else {
      throw error;
    }
  }
}

await deleteModel("old-model");
```

---

## Copy a Model

```typescript
import ollama from "ollama";

// Create a named copy (useful for versioning or aliasing)
await ollama.copy({
  source: "llama3.1",
  destination: "my-llama-v1",
});

console.log("Model copied: llama3.1 -> my-llama-v1");
```

---

## List Running Models

```typescript
import ollama from "ollama";

const running = await ollama.ps();

if (running.models.length === 0) {
  console.log("No models currently loaded.");
} else {
  for (const model of running.models) {
    console.log(`${model.name} -- loaded, expires: ${model.expires_at}`);
  }
}
```

---

## Create a Custom Model

```typescript
import ollama from "ollama";

// Create a custom model from a base model with a system prompt
const stream = await ollama.create({
  model: "my-assistant",
  from: "llama3.1",
  system: "You are a helpful coding assistant specializing in TypeScript.",
  stream: true,
});

for await (const progress of stream) {
  console.log(progress.status);
}

console.log("Custom model 'my-assistant' created.");

// Use the custom model
const response = await ollama.chat({
  model: "my-assistant",
  messages: [{ role: "user", content: "Explain generics." }],
});

console.log(response.message.content);
```

---

## Ensure Model is Available

```typescript
import ollama from "ollama";

async function ensureModel(modelName: string): Promise<void> {
  const list = await ollama.list();
  const isAvailable = list.models.some((m) => m.name.startsWith(modelName));

  if (!isAvailable) {
    console.log(`Model ${modelName} not found locally. Pulling...`);
    await ollama.pull({ model: modelName });
    console.log(`${modelName} pulled successfully.`);
  } else {
    console.log(`Model ${modelName} is available.`);
  }
}

await ensureModel("llama3.1");
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
