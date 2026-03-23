# Mistral SDK -- Codestral FIM Examples

> Fill-in-middle code completion and code generation with Codestral. See [SKILL.md](../SKILL.md) for core patterns.

**Related examples:**

- [core.md](core.md) -- Client setup, error handling
- [chat.md](chat.md) -- Chat completions and streaming
- [structured-output.md](structured-output.md) -- Structured outputs with Zod
- [function-calling.md](function-calling.md) -- Tool/function calling
- [embeddings-vision.md](embeddings-vision.md) -- Embeddings and vision

---

## Basic Fill-in-Middle (FIM)

```typescript
// fim-completion.ts
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({ apiKey: process.env["MISTRAL_API_KEY"] ?? "" });

// FIM: provide code before (prompt) and after (suffix) the cursor
const result = await client.fim.complete({
  model: "codestral-latest",
  prompt: "function fibonacci(n: number): number {\n  if (n <= 1) return n;\n",
  suffix: "}\n\nconsole.log(fibonacci(10));",
  temperature: 0,
});

const completion = result.choices?.[0]?.message?.content;
console.log("Generated code:", completion);
// The model fills in the gap: "  return fibonacci(n - 1) + fibonacci(n - 2);\n"
```

**Why good:** Uses dedicated `fim.complete()` endpoint (not chat), separate `prompt` + `suffix`, deterministic with `temperature: 0`

---

## FIM with Stop Sequences

```typescript
const result = await client.fim.complete({
  model: "codestral-latest",
  prompt: "class UserService {\n  private users: User[] = [];\n\n  ",
  suffix: "\n\n  getUsers(): User[] {\n    return this.users;\n  }\n}",
  temperature: 0,
  stop: ["\n\n"], // Stop at double newline to prevent over-generation
});

const code = result.choices?.[0]?.message?.content;
console.log(code);
```

---

## FIM vs Chat for Code Generation

Use FIM when you have surrounding code context. Use chat when you need full function generation from a description.

```typescript
// FIM: filling a gap in existing code
const fimResult = await client.fim.complete({
  model: "codestral-latest",
  prompt: "const sorted = array.",
  suffix: ";\nconsole.log(sorted);",
  temperature: 0,
});
// Model completes: "sort((a, b) => a - b)"

// Chat: generating from a description
const chatResult = await client.chat.complete({
  model: "codestral-latest",
  messages: [
    {
      role: "system",
      content:
        "You are a TypeScript code generator. Return only code, no explanations.",
    },
    {
      role: "user",
      content:
        "Write a function that sorts an array of numbers in ascending order.",
    },
  ],
  temperature: 0,
});
```

**When to use FIM:** IDE autocomplete, code insertion at cursor position, completing partial code
**When to use Chat:** Generating entire functions, explaining code, code review

---

## Code Completion with Max Tokens

```typescript
const MAX_COMPLETION_TOKENS = 200;

const result = await client.fim.complete({
  model: "codestral-latest",
  prompt: "async function fetchUsers(): Promise<User[]> {\n  ",
  suffix: "\n}",
  temperature: 0,
  maxTokens: MAX_COMPLETION_TOKENS,
});

const finishReason = result.choices?.[0]?.finishReason;
if (finishReason === "length") {
  console.warn("Code completion was truncated -- increase maxTokens");
}
```

---

## Code Embeddings with Codestral Embed

For code-specific semantic search, use `codestral-embed-latest` instead of `mistral-embed`.

```typescript
const CODE_EMBEDDING_MODEL = "codestral-embed-latest";

const result = await client.embeddings.create({
  model: CODE_EMBEDDING_MODEL,
  inputs: [
    "function add(a: number, b: number): number { return a + b; }",
    "const sum = (x: number, y: number): number => x + y;",
    "class Calculator { add(a: number, b: number) { return a + b; } }",
  ],
});

// Use for code search, duplicate detection, or semantic code navigation
const vectors = result.data?.map((item) => item.embedding) ?? [];
console.log(`Generated ${vectors.length} code embeddings`);
```

---

_For core concepts, see [SKILL.md](../SKILL.md). For API reference tables, see [reference.md](../reference.md)._
