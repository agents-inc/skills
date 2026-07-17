# Advanced Patterns

> Related: [core.md](core.md) for basic prompts, cancellation, spinner, group, validation

---

## Pattern 1: Custom Prompts with @clack/core

Use `@clack/core` when you need a prompt UI that `@clack/prompts` doesn't provide. Each core prompt has a `render()` function that returns the terminal output string.

### Custom text prompt

```typescript
import { TextPrompt, isCancel } from "@clack/core";

const p = new TextPrompt({
  render() {
    const title = "What is your project name?";
    const value = this.userInputWithCursor;

    switch (this.state) {
      case "initial":
      case "active":
        return `${title}\n> ${value}`;
      case "error":
        return `${title}\n> ${value}\n  Error: ${this.error}`;
      case "submit":
        return `${title}\n  ${this.value}`;
      case "cancel":
        return `${title}\n  (cancelled)`;
    }
  },
  validate(value) {
    if (!value) return "Name is required";
  },
});

const result = await p.prompt();

if (isCancel(result)) {
  process.exit(0);
}
```

### Custom select prompt

```typescript
import { SelectPrompt, isCancel } from "@clack/core";

interface Option {
  value: string;
  label: string;
}

const options: Option[] = [
  { value: "small", label: "Small (1 CPU, 1GB RAM)" },
  { value: "medium", label: "Medium (2 CPU, 4GB RAM)" },
  { value: "large", label: "Large (4 CPU, 8GB RAM)" },
];

const p = new SelectPrompt({
  options,
  render() {
    const title = "Select instance size";

    return `${title}\n${this.options
      .map((opt, i) => {
        const cursor = i === this.cursor ? ">" : " ";
        const selected = i === this.cursor ? "[*]" : "[ ]";
        return `  ${cursor} ${selected} ${opt.label}`;
      })
      .join("\n")}`;
  },
});

const result = await p.prompt();

if (isCancel(result)) {
  process.exit(0);
}
```

### Prompt state lifecycle

The `this.state` property in the render function cycles through these values:

| State       | When                                | Typical Display              |
| ----------- | ----------------------------------- | ---------------------------- |
| `"initial"` | First render, before user input     | Show prompt with placeholder |
| `"active"`  | User is typing or navigating        | Show current input/selection |
| `"error"`   | Validation failed                   | Show error message           |
| `"submit"`  | User pressed Enter with valid input | Show confirmed value         |
| `"cancel"`  | User pressed Ctrl+C                 | Show cancellation notice     |

---

## Pattern 2: AbortSignal for Programmatic Cancellation

All prompts accept `signal: AbortSignal` for timeout-based or programmatic cancellation.

### Timeout

```typescript
import * as p from "@clack/prompts";

const PROMPT_TIMEOUT_MS = 30_000;

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), PROMPT_TIMEOUT_MS);

const name = await p.text({
  message: "Project name?",
  signal: controller.signal,
});

clearTimeout(timeout);

if (p.isCancel(name)) {
  p.cancel("Timed out waiting for input.");
  process.exit(1);
}
```

### Cancellation from external event

```typescript
import * as p from "@clack/prompts";

const controller = new AbortController();

// Cancel prompt if parent process sends signal
process.on("SIGTERM", () => controller.abort());

const result = await p.select({
  message: "Choose environment",
  options: [
    { value: "dev", label: "Development" },
    { value: "prod", label: "Production" },
  ],
  signal: controller.signal,
});
```

---

## Pattern 3: Spinner Cancellation

```typescript
import * as p from "@clack/prompts";

const s = p.spinner({
  onCancel: () => {
    // Cleanup resources when user cancels during spinner
    cleanupTempFiles();
  },
  cancelMessage: "Build cancelled by user",
});

s.start("Building project...");

try {
  await build();
  s.stop("Build complete");
} catch (error) {
  s.error("Build failed");
  throw error;
}
```

---

## Pattern 4: Stream Output

Stream content character-by-character or line-by-line for real-time output.

```typescript
import * as p from "@clack/prompts";
import { createReadStream } from "node:fs";

// Stream from a file
await p.stream.info(createReadStream("./build-log.txt", { encoding: "utf-8" }));

// Stream from an async generator
async function* generateOutput(): AsyncGenerator<string> {
  yield "Step 1: Preparing...\n";
  await delay(500);
  yield "Step 2: Processing...\n";
  await delay(500);
  yield "Step 3: Complete!\n";
}

await p.stream.success(generateOutput());
```

---

## Pattern 5: Internationalization (i18n)

```typescript
import * as p from "@clack/prompts";

// Set global messages for non-English CLIs
p.updateSettings({
  messages: {
    cancel: "Operacion cancelada",
    error: "Se produjo un error",
  },
});

// Now all prompts use translated cancel/error messages
const name = await p.text({ message: "Nombre del proyecto?" });
```

---

## Pattern 6: Date and Path Prompts

### Date prompt

```typescript
import * as p from "@clack/prompts";

const deadline = await p.date({
  message: "Project deadline?",
  format: "YMD", // Also: "MDY", "DMY"
});

if (p.isCancel(deadline)) {
  p.cancel("Cancelled.");
  process.exit(0);
}

// deadline is a Date object
```

### Path prompt

```typescript
import * as p from "@clack/prompts";

const configPath = await p.path({
  message: "Path to config file?",
  root: process.cwd(),
});

if (p.isCancel(configPath)) {
  p.cancel("Cancelled.");
  process.exit(0);
}

// configPath is a string (absolute or relative path)
```

### Directory-only path

```typescript
import * as p from "@clack/prompts";

const outputDir = await p.path({
  message: "Output directory?",
  root: process.cwd(),
  directory: true, // Only show directories
});
```

---

## Pattern 7: Autocomplete Prompts

### Single autocomplete

```typescript
import * as p from "@clack/prompts";

const country = await p.autocomplete({
  message: "Select your country",
  options: [
    { value: "us", label: "United States" },
    { value: "uk", label: "United Kingdom" },
    { value: "de", label: "Germany" },
    { value: "fr", label: "France" },
    // ... many more options
  ],
  placeholder: "Type to search...",
  maxItems: 5,
});

if (p.isCancel(country)) {
  p.cancel("Cancelled.");
  process.exit(0);
}
```

### Multi autocomplete

```typescript
import * as p from "@clack/prompts";

const packages = await p.autocompleteMultiselect({
  message: "Select packages to install",
  options: [
    { value: "react", label: "react" },
    { value: "vue", label: "vue" },
    { value: "svelte", label: "svelte" },
    { value: "solid", label: "solid-js" },
    { value: "preact", label: "preact" },
  ],
  placeholder: "Type to filter...",
});

if (p.isCancel(packages)) {
  p.cancel("Cancelled.");
  process.exit(0);
}
```

---

## Pattern 8: Testing Clack Prompts

Clack prompts accept custom `input` and `output` streams, making them testable without TTY.

```typescript
import * as p from "@clack/prompts";
import { Readable, Writable } from "node:stream";

// Create mock streams
function createMockInput(responses: string[]): Readable {
  const input = new Readable({ read() {} });
  for (const response of responses) {
    // Simulate user typing + Enter
    input.push(response);
    input.push("\r");
  }
  input.push(null);
  return input;
}

const output = new Writable({
  write(chunk, encoding, callback) {
    callback();
  },
});

// Use in tests
const result = await p.text({
  message: "Name?",
  input: createMockInput(["my-project"]),
  output,
});
```

**Note:** For most testing scenarios, consider mocking the `@clack/prompts` module entirely rather than simulating streams, as stream-based testing can be fragile with timing-sensitive prompts.
