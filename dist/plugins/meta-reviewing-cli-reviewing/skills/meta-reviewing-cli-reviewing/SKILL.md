---
name: meta-reviewing-cli-reviewing
description: CLI code review — exit codes, cancellation and signals, non-TTY behaviour, the stdout/stderr split, error text, config precedence, subprocess safety and test adequacy. Load when reviewing a command-line tool's commands, entry point, prompts, output or tests, whichever parser or prompt library it uses.
---

# CLI Review Patterns

> **Quick Guide:** A CLI's contract is its exit code, its two output streams and what it does without a terminal — scripts and CI branch on those and never read the wording. Review every terminating path for the code it produces, every prompt for its cancel path and its non-interactive twin, and every write for the stream it lands on. Three Node facts decide verdicts: `process.exit()` abandons writes still pending to a pipe, so piped output arrives truncated; installing a `SIGINT` listener removes Node's default exit with 130; and while a prompt holds the terminal in raw mode, Ctrl+C is a keypress rather than a signal.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — before-and-after code for each pattern, a spawned contract test, and a worked review
- [reference.md](reference.md) — review checklists by area, exit-code conventions, the shapes a prompt cancel takes

---

<critical_requirements>

## Before reviewing CLI code

**Trace every terminating path to the exit code it produces.** Scripts and CI branch on the number, not the message, so a failure that exits 0 — a catch block that only logs, a cancelled prompt that returns — reports success to every `&&` chained after it.

**Find out what the prompt library does on Ctrl+C, then check that path at every prompt.** A prompt holds the terminal in raw mode, where Ctrl+C is a keypress rather than `SIGINT`, so no signal handler sees it; the library returns a cancel value, rejects, or drops the field, and an unchecked call carries that into the next line as data.

**Check that every prompted value has a flag or config twin, and that a prompt reached without a TTY fails with a usage error naming it.** CI has no terminal on stdin, so an unguarded prompt waits for input that never arrives, or a component that needs raw mode throws.

**Check which stream every write lands on.** stdout is the payload a pipe consumer parses; progress, warnings and errors belong on stderr, and spinners and colour only where their stream is a TTY — one spinner frame on stdout corrupts the consumer's input.

**Check that every spinner is stopped before anything else is written to the terminal, on the error path as well as on success.** A spinner redraws its line on a timer, so a log line or error written while it animates can be overwritten or split by its frames, and the message the user needed arrives garbled.

**Check that the entry point awaits async command handlers inside one top-level handler that turns any failure into a message and an exit code.** A handler the parser does not await rejects outside that path, so Node prints a raw stack trace and exits 1 whatever the failure was.

</critical_requirements>

---

**Auto-detection:** review CLI, CLI PR review, command-line tool review, exit code, process.exitCode, process.exit, SIGINT, SIGTERM, Ctrl+C handling, process.stdin.isTTY, process.stdout.isTTY, setRawMode, NO_COLOR, stdout vs stderr, --json output, --no-input, --dry-run, child_process, execFile, shell injection, config precedence, CLI tests

**Applies to:**

- Reviewing a command, the entry point, or how commands are dispatched
- Reviewing prompts, confirmations and key-driven terminal UI
- Reviewing output for piped, CI and `--json` callers
- Reviewing config resolution, error text and help
- Reviewing code that spawns processes or handles credentials
- Judging whether a CLI's tests reach its contracts

**Handled elsewhere:**

- Severity definitions, feedback style and the approve-or-request-changes decision — the general review process owns those; this skill says only where CLI defects land
- Choosing the contract — which flags, exit codes and output modes a feature should have is decided when it is specified, and review checks the code against that decision
- A given parser's, prompt library's or terminal renderer's API — this skill names the behaviour to check, and the library's own documentation names the call that provides it

---

<philosophy>

## Philosophy

A CLI has three callers. A person at a terminal sees colour, spinners and prompts. A script piping the output sees stdout and the exit code, and nothing else. CI has no terminal at all: no prompt can be answered and no keypress arrives. Code that works when its author runs it by hand fails the other two silently, which is why these checks are about codes, streams and TTYs before wording.

Weigh findings by caller. A defect a script or CI can observe blocks, and so does output garbled on the terminal; one that otherwise costs only a person at a terminal is a Should Fix that travels with the approval; help wording and colour choices that match the existing commands are not findings. Don't require a spinner for an operation under 500 ms, or a verbose mode in a CLI simple enough to need none.

</philosophy>

---

<decision_framework>

## Which checks a diff needs

- **The entry point or dispatch** — Patterns 1 and 6
- **A command's action** — Patterns 1, 5 and 7
- **Prompts, confirmations or key-driven UI** — Patterns 2 and 4
- **Long-running work, or anything that writes files or spawns children** — Patterns 3 and 9
- **Logging, progress or a `--json` mode** — Pattern 5
- **Config loading** — Pattern 8
- **Tests** — Pattern 10, against the contracts the other patterns name

## Severity for CLI findings

```text
Does it expose the user — input reaching a shell, a secret in ps output, history or logs?
├─ YES → MUST FIX
└─ NO → Can a script or CI observe it — wrong exit code, polluted or truncated stdout, a hang?
    ├─ YES → MUST FIX
    │   ├─ A failure or cancel that exits 0, or an exit code written as a literal
    │   ├─ A prompt whose cancel path is unchecked, or that runs without a TTY guard
    │   ├─ Diagnostics or animation on stdout
    │   ├─ process.exit() after writing output
    │   ├─ An async handler the dispatch does not await
    │   ├─ A SIGINT or SIGTERM listener that does not end the process
    │   ├─ Ctrl+C leaving partial files that break the next run
    │   └─ Config precedence out of order, so a flag the caller passed is ignored
    └─ NO → Does it garble what the terminal shows?
        ├─ YES → MUST FIX
        │   └─ A spinner still running while a log line or error is written
        └─ NO → Does a person at the terminal lose something?
            ├─ YES → SHOULD FIX
            │   ├─ An error that names the failure but not the fix
            │   ├─ A raw stack trace on an expected failure
            │   ├─ A destructive command with no --dry-run
            │   ├─ A destructive command with no confirmation
            │   ├─ An operation likely to exceed 500 ms with no progress on stderr
            │   ├─ A prompt that accepts any answer without validating it
            │   └─ No --verbose or debug mode in a CLI with more than trivial behaviour
            └─ NO → NICE TO HAVE, or leave it out
                ├─ More help examples, richer --verbose output, --json for a command nobody scripts yet → NICE TO HAVE
                └─ Help wording, colour choices matching existing commands → DON'T MENTION
```

A defect found at every call site is one finding about the missing mechanism — no exit-code module, no top-level handler, no prompt wrapper — rather than one finding per site. The fix is the mechanism.

</decision_framework>

---

<patterns>

## Core patterns

> The snippets are portable shapes. `askForName`, `isCancelled`, `reportCancelled`, `dispatch`, `reportFailure` and `UsageError` stand for your prompt library's, parser's and project's own names; Node's `process` and `child_process` APIs are named as themselves.

### Pattern 1: Exit Codes on Every Path

Every code is a named constant, cancellation has its own, and once output has been written the code is set with `process.exitCode` rather than `process.exit()`, so pending writes to a pipe still drain.

```typescript
export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  INVALID_ARGS: 2,
  CANCELLED: 130, // 128 + SIGINT, what a shell reports for Ctrl+C
} as const;

process.exitCode = EXIT_CODES.INVALID_ARGS;
```

Full code: [examples/core.md](examples/core.md#pattern-1-exit-codes-on-every-path)

### Pattern 2: Prompt Cancellation

Ctrl+C during a prompt is a keypress the library reports in its own shape — a cancel value, a rejection, or a missing field. Each call handles it before the answer is used, and the run ends with the cancellation code.

```typescript
const name = await askForName();
if (isCancelled(name)) {
  reportCancelled("Setup cancelled; nothing was written.");
  process.exitCode = EXIT_CODES.CANCELLED;
  return;
}
```

Full code: [examples/core.md](examples/core.md#pattern-2-prompt-cancellation)

### Pattern 3: Signal Handlers

Without a listener, Node answers `SIGINT` and `SIGTERM` by restoring the terminal and exiting with 128 plus the signal number. A listener removes that default, so it earns its place only where there is something to clean up, and it ends the process itself.

```typescript
process.on("SIGINT", () => {
  console.error("Interrupted; removing partial output.");
  removePartialOutput();
  process.exit(EXIT_CODES.CANCELLED);
});
```

Full code: [examples/core.md](examples/core.md#pattern-3-signal-handlers)

### Pattern 4: A Non-Interactive Twin for Every Prompt

A flag or config key supplies every value a prompt asks for, and the prompt runs only when stdin is a TTY.

```typescript
if (flags.region === undefined && !process.stdin.isTTY) {
  throw new UsageError("--region is required when stdin is not a terminal");
}
```

Full code: [examples/core.md](examples/core.md#pattern-4-a-non-interactive-twin-for-every-prompt)

### Pattern 5: Stream Split and Decoration

stdout carries the payload and nothing else; progress, warnings and errors go to stderr. Animation and colour depend on their stream being a TTY and on `NO_COLOR` being unset or empty.

```typescript
const decorate =
  process.stderr.isTTY && !process.env.NO_COLOR && process.env.TERM !== "dumb";

process.stderr.write("Fetching records\n");
process.stdout.write(`${JSON.stringify(records)}\n`);
```

Full code: [examples/core.md](examples/core.md#pattern-5-stream-split-and-decoration)

### Pattern 6: Awaited Dispatch and One Error Handler

The entry point awaits the parser's asynchronous dispatch inside one handler that turns any failure into a message and a code. Where a parser offers both a synchronous and an asynchronous entry point, async handlers need the asynchronous one.

```typescript
try {
  await dispatch(process.argv.slice(2));
} catch (error) {
  process.exitCode = reportFailure(error);
}
```

Full code: [examples/core.md](examples/core.md#pattern-6-awaited-dispatch-and-one-error-handler)

### Pattern 7: Actionable Error Text

What failed, why, how to fix it, and where to look — on stderr, with the stack trace behind a debug flag.

```text
BAD:  Error: ENOENT
GOOD: Config file not found at ./tool.config.json.
      Run 'tool init' to create one, or pass --config <path>.
```

Full code: [examples/core.md](examples/core.md#pattern-7-actionable-error-text)

### Pattern 8: Config Precedence

Flag, then environment, then project config, then user config, then default — per key. `??` lets an explicit empty value win and `||` skips it; either can be right, and the choice is part of the contract.

```typescript
const region =
  flags.region ??
  process.env.TOOL_REGION ??
  projectConfig.region ??
  userConfig.region ??
  DEFAULT_REGION;
```

Full code: [examples/core.md](examples/core.md#pattern-8-config-precedence)

### Pattern 9: Subprocesses Without a Shell

User input reaches a child process as one element of an argument array, with no shell in between. An array passed with `shell: true` is joined with spaces, not escaped.

```typescript
import { execFile } from "node:child_process";

execFile("git", ["checkout", branch], onDone);
```

Full code: [examples/core.md](examples/core.md#pattern-9-subprocesses-without-a-shell)

### Pattern 10: Tests That Reach the Contract

In-process tests cover logic. The exit code, the stream split and the non-TTY path are properties of a real process, so at least one test per contract spawns the built CLI with piped stdio.

```typescript
const run = spawnSync(process.execPath, [CLI_ENTRY, "deploy"], {
  encoding: "utf8",
});

equal(run.status, EXIT_CODES.INVALID_ARGS);
equal(run.stdout, "");
match(run.stderr, /--region is required/);
```

Full code: [examples/core.md](examples/core.md#pattern-10-tests-that-reach-the-contract)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- `process.exit()` straight after writing output — writes to a pipe are asynchronous on POSIX and the exit abandons them, so `tool --json | jq` receives a stream cut short, typically at the 64 KiB pipe buffer. Set `process.exitCode` and return.
- A catch block that logs and returns — the process exits 0, and everything chained with `&&` runs as though the command succeeded.
- A prompt answer used without its cancel check — a cancel value flows on as input, a rejection escapes as a stack trace, a dropped field arrives as `undefined`.
- A `SIGINT` or `SIGTERM` listener that cleans up and returns — it replaced Node's default exit, so the process keeps running, and a supervisor that sent `SIGTERM` waits out its grace period and kills it.
- Async cleanup started in a signal listener and not awaited before `process.exit()` — the exit cuts it off half done.
- An async command handler the dispatch does not await — the rejection skips the CLI's error handler, and Node prints the raw stack and exits 1.
- A prompt with no TTY guard — in CI it waits forever, or a component that needs raw mode throws.
- A log line or error written before the spinner is stopped — the spinner's next frame overwrites or splits it, so the output is garbled. Stop the spinner first, on every path.
- A log line or spinner frame on stdout in a `--json` command — every consumer's parse fails. Where a framework suppresses its own logger under `--json`, a direct `console.log` is not suppressed.
- User input in an `exec` string, or in an argument array passed with `shell: true` — both reach a shell unescaped. Use `execFile` or `spawn` with an array and no shell.
- A config file parsed without a catch — a typo in the user's config surfaces as a stack trace instead of the path and what is wrong with it.

**Surprising behaviour:**

- A `SIGINT` listener never fires while a prompt or key-reading component is open — raw mode turns Ctrl+C into input the library handles.
- Synchronous work under a spinner or key-reading component delays Ctrl+C until it finishes, because the library re-handles the keypress on the event loop.
- `process.stdin.isTTY` is defined only on a terminal stream — test it for truthiness; `=== false` never matches a pipe.
- Many parsers store a multi-word flag under a camelCase key — `--dry-run` arrives as `dryRun` — so reading it under the kebab-case key returns `undefined` with no error. Check each option is read under the key the parser actually produces.
- `NO_COLOR` set to an empty string leaves colour on — the convention keys on present and non-empty, and an explicit flag or user config overrides it.
- Argument parsers exit the process themselves on `--help`, `--version` and usage errors, so an in-process test without the parser's exit override ends the test run.
- On Windows, spawning a `.cmd` or `.bat` file — package-manager shims among them — without a shell throws `EINVAL`, and the usual workaround, `shell: true`, routes every argument through `cmd.exe`.
- A process ended by a signal it does not handle exits with 128 plus the signal number — 130 for `SIGINT`, 143 for `SIGTERM` — and that is the code a wrapper script sees.
- A secret passed as a flag value is readable in `ps` output and shell history even when the CLI never prints it — take a file path or stdin instead.

</red_flags>
