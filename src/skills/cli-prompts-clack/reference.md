# Clack CLI Prompts Quick Reference

## Prompt Type Comparison

| Prompt                      | Import           | Returns             | Use When                           |
| --------------------------- | ---------------- | ------------------- | ---------------------------------- |
| `text()`                    | `@clack/prompts` | `string \| symbol`  | Free-form text input               |
| `password()`                | `@clack/prompts` | `string \| symbol`  | Sensitive input (masked)           |
| `select()`                  | `@clack/prompts` | `Value \| symbol`   | Pick one from a list               |
| `selectKey()`               | `@clack/prompts` | `Value \| symbol`   | Pick one via keyboard shortcut     |
| `multiselect()`             | `@clack/prompts` | `Value[] \| symbol` | Pick multiple from a list          |
| `groupMultiselect()`        | `@clack/prompts` | `Value[] \| symbol` | Pick multiple, grouped by category |
| `confirm()`                 | `@clack/prompts` | `boolean \| symbol` | Yes/No question                    |
| `autocomplete()`            | `@clack/prompts` | `Value \| symbol`   | Searchable single select           |
| `autocompleteMultiselect()` | `@clack/prompts` | `Value[] \| symbol` | Searchable multi select            |
| `date()`                    | `@clack/prompts` | `Date \| symbol`    | Date input with format             |
| `path()`                    | `@clack/prompts` | `string \| symbol`  | File/directory path selection      |

## Output Functions (Synchronous)

| Function                      | Purpose                           |
| ----------------------------- | --------------------------------- |
| `intro(title?)`               | Start a prompt session            |
| `outro(message?)`             | End a prompt session (success)    |
| `cancel(message?)`            | End a prompt session (cancelled)  |
| `note(message, title?)`       | Display a boxed note              |
| `box(message, title?, opts?)` | Styled box with alignment options |
| `log.info(message)`           | Neutral status message            |
| `log.success(message)`        | Success status message            |
| `log.warn(message)`           | Warning status message            |
| `log.error(message)`          | Error status message              |
| `log.step(message)`           | Completed step message            |
| `log.message(message)`        | Plain message without symbol      |

## Progress Functions

| Function          | Purpose                              |
| ----------------- | ------------------------------------ |
| `spinner(opts?)`  | Indeterminate progress indicator     |
| `progress(opts?)` | Determinate progress bar             |
| `tasks(taskList)` | Sequential task runner with spinners |
| `taskLog(opts)`   | Detailed log output per task         |

## Stream Functions (Async)

| Function                   | Purpose                |
| -------------------------- | ---------------------- |
| `stream.info(iterable)`    | Stream neutral content |
| `stream.success(iterable)` | Stream success content |
| `stream.warn(iterable)`    | Stream warning content |
| `stream.error(iterable)`   | Stream error content   |
| `stream.step(iterable)`    | Stream step content    |
| `stream.message(iterable)` | Stream plain content   |

## Common Options (All Prompts)

```typescript
interface CommonOptions {
  signal?: AbortSignal; // Programmatic cancellation
  input?: Readable; // Custom input stream (testing)
  output?: Writable; // Custom output stream (testing)
  withGuide?: boolean; // Show border guide lines
}
```

## Spinner API

```typescript
const s = spinner({ indicator?: "dots" | "timer", onCancel?: () => void, cancelMessage?: string, errorMessage?: string });
s.start(message?: string);    // Begin animation
s.message(message?: string);  // Update message mid-spin
s.stop(message?: string);     // Complete successfully
s.error(message?: string);    // Complete with error
s.cancel(message?: string);   // Complete as cancelled
s.isCancelled;                // boolean -- check if cancelled
```

## Progress API

```typescript
const prog = progress({ max?: number, style?: "light" | "heavy" | "block", size?: number });
prog.start(message?: string);
prog.advance(step?: number, message?: string);  // step defaults to 1
prog.message(message?: string);
prog.stop(message?: string);
prog.error(message?: string);
prog.cancel(message?: string);
prog.clear();
```

## Global Settings

```typescript
import { updateSettings } from "@clack/prompts";

updateSettings({
  withGuide: false, // Disable guide lines globally
  messages: {
    cancel: "Operacion cancelada", // i18n for cancel text
    error: "Error", // i18n for error text
  },
});
```

## Anti-Pattern Quick Reference

| Anti-Pattern                            | Fix                                                |
| --------------------------------------- | -------------------------------------------------- |
| No `isCancel()` check                   | Always check after every prompt call               |
| No `process.exit()` after `cancel()`    | Add `process.exit(0)` after `cancel()`             |
| Output while spinner is active          | Call `spinner.stop()` before any other output      |
| `require("@clack/prompts")`             | Use ESM `import` -- package is ESM-only since v1.0 |
| `multiselect` without `required: false` | Add it when zero selections should be valid        |
| Inline `isCancel` checks in long flows  | Use `group()` with `onCancel` instead              |
