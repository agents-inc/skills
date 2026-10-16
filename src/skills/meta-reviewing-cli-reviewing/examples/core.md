# CLI Review - Core Examples

> Full code for the patterns in [SKILL.md](../SKILL.md); checklists and conventions are in [reference.md](../reference.md). The snippets are portable shapes: `askForName`, `isCancelled`, `isPromptCancellation`, `startProgress`, `registerCommand` and `dispatch` stand for your libraries' calls, and Node's `process`, `fs` and `child_process` APIs are named as themselves.

---

## Pattern 1: Exit Codes on Every Path

### Bad Example - A Failure That Exits 0

```typescript
async function deploy(target: string): Promise<void> {
  try {
    await upload(target);
  } catch (error) {
    console.error(`Upload failed: ${describe(error)}`);
  }
}
```

**Why bad:** the failure is logged and the function returns normally, so the process exits 0 and `tool deploy && notify-team` announces a deploy that did not happen.

### Good Example - Named Codes, Set Rather Than Forced

```typescript
export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  INVALID_ARGS: 2,
  UPLOAD_FAILED: 3,
  CANCELLED: 130,
  TERMINATED: 143,
} as const;

async function deploy(target: string): Promise<void> {
  try {
    await upload(target);
  } catch (error) {
    console.error(`Upload failed for ${target}: ${describe(error)}`);
    process.exitCode = EXIT_CODES.UPLOAD_FAILED;
  }
}
```

**Why good:** a script can tell an upload failure (3) from a usage error (2) and branch on it, and the process still ends through the event loop, so everything already written reaches the reader. `describe` is defined under Pattern 6.

### Bad Example - `process.exit()` After Output

```typescript
process.stdout.write(JSON.stringify(report));
process.exit(EXIT_CODES.SUCCESS);
```

**Why bad:** writes to a pipe are asynchronous on POSIX, and `process.exit()` does not wait for them. In a terminal the output looks complete, because writes to a TTY are synchronous on POSIX — while `tool report --json | jq` receives the first 64 KiB and a parse error.

**Fix:** write, then return; the process exits 0 once the write has drained. Where the run needs a code other than 0, set `process.exitCode`.

---

## Pattern 2: Prompt Cancellation

### Bad Example - The Answer Used Unchecked

```typescript
const name = await askForName();
await scaffold(name);
```

**Why bad:** what Ctrl+C produces depends on the library. One that returns a cancel value hands it to `scaffold` as the project name; one that rejects throws past every handler and prints a stack trace; one that returns the answers so far leaves `name` undefined.

### Good Example - A Library That Returns a Cancel Value

```typescript
async function runInit(): Promise<void> {
  const name = await askForName();
  if (isCancelled(name)) {
    reportCancelled("Setup cancelled; nothing was written.");
    process.exitCode = EXIT_CODES.CANCELLED;
    return;
  }
  await scaffold(name);
}
```

### Good Example - A Library That Rejects

```typescript
async function runInit(): Promise<void> {
  try {
    const name = await askForName();
    await scaffold(name);
  } catch (error) {
    if (!isPromptCancellation(error)) throw error;
    reportCancelled("Setup cancelled; nothing was written.");
    process.exitCode = EXIT_CODES.CANCELLED;
  }
}
```

**Why good:** the cancel path ends the flow before the answer is used, says what state it left, and exits with the cancellation code, so `tool init && cd my-app` stops at the first command. Every other error still reaches the top-level handler.

Where a flow asks many questions, look for one wrapper that turns the library's cancel shape into a single path; reviewing the wrapper once replaces checking every call site.

---

## Pattern 3: Signal Handlers

### Bad Example - A Listener That Returns

```typescript
process.on("SIGINT", () => {
  console.error("Cleaning up...");
  removePartialOutput();
});
```

**Why bad:** installing the listener removed Node's default exit, so after cleanup the process carries on — the first Ctrl+C deletes the output the running work is still writing, and Ctrl+C no longer stops the process at all.

### Good Example - Say It, Clean Up, Exit

```typescript
import { rmSync } from "node:fs";

function removePartialOutput(): void {
  rmSync(PARTIAL_OUTPUT_DIR, { recursive: true, force: true });
}

process.on("SIGINT", () => {
  console.error("Interrupted; removing partial output.");
  removePartialOutput();
  process.exit(EXIT_CODES.CANCELLED);
});

process.on("SIGTERM", () => {
  removePartialOutput();
  process.exit(EXIT_CODES.TERMINATED);
});
```

**Why good:** the message comes first, so the user knows the keypress landed; cleanup is synchronous, so `process.exit()` cannot cut it off; and the codes match what a shell reports for an unhandled signal, so a wrapper script sees the same number either way. `process.exit()` is right here, unlike after ordinary output, because abandoning in-flight work is the point.

### Good Example - Async Cleanup, and a Second Ctrl+C

```typescript
let interrupted = false;

process.on("SIGINT", () => {
  if (interrupted) process.exit(EXIT_CODES.CANCELLED);
  interrupted = true;
  console.error("Interrupted; cleaning up (Ctrl+C again to skip).");
  void cleanUp().finally(() => process.exit(EXIT_CODES.CANCELLED));
});
```

**Why good:** the exit waits for the async cleanup instead of cutting it off, and a second Ctrl+C skips a cleanup that is taking too long rather than being ignored.

No listener at all is correct when there is nothing to clean up: Node's default already restores the terminal and exits with 130 or 143.

---

## Pattern 4: A Non-Interactive Twin for Every Prompt

### Bad Example - A Prompt CI Cannot Answer

```typescript
const region = flags.region ?? (await askForRegion());
```

**Why bad:** in CI stdin is not a terminal. The prompt waits for input that never arrives and the job times out, or a component that needs raw mode throws because a pipe cannot enter it.

### Good Example - Flag First, Prompt Only on a TTY

```typescript
async function resolveRegion(flags: DeployFlags): Promise<string> {
  if (flags.region !== undefined) return flags.region;
  if (!process.stdin.isTTY) {
    throw new UsageError(
      "--region is required when stdin is not a terminal (CI, pipes)",
    );
  }
  return askForRegion();
}
```

**Why good:** a script supplies `--region` and never meets the prompt; without it, the run fails at once with a usage error naming the flag instead of hanging. Where the CLI has a `--no-input` flag, it joins the TTY check, so a person at a terminal can opt out of prompting too.

Confirmations for destructive actions follow the same rule: `--yes` supplies the answer, and with no TTY and no `--yes` the command refuses rather than assuming consent.

---

## Pattern 5: Stream Split and Decoration

### Bad Example - Progress in the Payload

```typescript
console.log("Fetching records...");
const records = await fetchRecords();
console.log(JSON.stringify(records));
```

**Why bad:** `console.log` writes to stdout, so `tool list --json | jq` receives a progress line ahead of the JSON and fails to parse.

### Good Example - Payload on stdout, Everything Else on stderr

```typescript
const decorate =
  process.stderr.isTTY && !process.env.NO_COLOR && process.env.TERM !== "dumb";

const progress = startProgress("Fetching records", { animate: decorate });
try {
  const records = await fetchRecords();
  progress.succeed(`Fetched ${records.length} records`);
  process.stdout.write(`${JSON.stringify(records)}\n`);
} catch (error) {
  progress.fail("Fetch failed");
  throw error;
}
```

**Why good:** the payload is the only thing on stdout, the indicator animates only on a terminal, and it ends on the failure path too — one left running keeps animating beside the error message. Check which stream the indicator writes to: most spinner libraries default to stderr, and one pointed at stdout is part of the payload.

Colour follows the same test as animation: `NO_COLOR` present and non-empty, `TERM=dumb`, a `--no-color` flag, or a stream that is not a TTY each turn it off. Check per stream, since stdout can be piped while stderr is still a terminal.

### Good Example - `--json` on Failure

```typescript
const failure = { ok: false, error: { code: "NOT_FOUND", message } };
process.stdout.write(`${JSON.stringify(failure)}\n`);
process.exitCode = EXIT_CODES.ERROR;
```

**Why good:** a consumer parses the same stream on success and failure, and the exit code still says which one it was.

---

## Pattern 6: Awaited Dispatch and One Error Handler

### Bad Example - A Dispatch Nobody Awaits

```typescript
registerCommand("sync", async () => {
  await syncAll();
});

dispatch(process.argv.slice(2));
```

**Why bad:** the handler's promise is never awaited, so a failure in `syncAll` rejects outside every handler the CLI wrote. Node raises the unhandled rejection as an uncaught exception: a raw stack trace and exit 1, whatever kind of failure it was. A parser's synchronous entry point does the same to async handlers, even where the call itself looks fine.

### Good Example - One Handler Owns Every Failure

```typescript
export class UsageError extends Error {}

export class ToolError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function reportFailure(error: unknown): number {
  if (error instanceof UsageError) {
    console.error(`${error.message}\nRun 'tool --help' for usage.`);
    return EXIT_CODES.INVALID_ARGS;
  }
  if (error instanceof ToolError) {
    console.error(error.message);
    return error.exitCode;
  }
  console.error(`Unexpected error: ${describe(error)}`);
  if (process.env.DEBUG) console.error(error);
  return EXIT_CODES.ERROR;
}

try {
  await dispatch(process.argv.slice(2));
} catch (error) {
  process.exitCode = reportFailure(error);
}
```

**Why good:** an expected failure prints a sentence and its own code, a usage error points at `--help`, and an unexpected one prints one line with the stack behind `DEBUG`. Where commands are async methods the framework awaits itself, the same check moves to the call that starts the framework.

---

## Pattern 7: Actionable Error Text

```text
BAD:   Error: ENOENT
WEAK:  Config file not found: ./tool.config.json
GOOD:  Config file not found at ./tool.config.json.
       Run 'tool init' to create one, or pass --config <path>.

BAD:   Invalid region
GOOD:  Unknown region "eu-west-9". Expected one of: eu-west-1, eu-west-2, us-east-1.
```

**Why good:** each says what failed, why, and the next command or edit that fixes it; the validation error names the value it rejected and the set it accepts. An error from a tool the CLI wraps quotes that tool's stderr rather than paraphrasing it, because the original wording is what the user will search for.

---

## Pattern 8: Config Precedence

### Bad Example - The Environment Overrides the Flag

```typescript
const region = process.env.TOOL_REGION ?? flags.region ?? DEFAULT_REGION;
```

**Why bad:** `TOOL_REGION=eu-west-1 tool deploy --region us-east-1` deploys to eu-west-1 — the value typed on this command line loses to one exported in a shell profile weeks ago.

### Good Example - Most Specific First

```typescript
const region =
  flags.region ??
  process.env.TOOL_REGION ??
  projectConfig.region ??
  userConfig.region ??
  DEFAULT_REGION;
```

**Why good:** this invocation beats this shell, which beats this project, which beats this user. `??` treats an explicit empty string as a value, so `--region ""` wins and then fails validation; `||` would skip it and fall through. Either can be right; the review question is whether the choice was made on purpose and is the same for every key.

### Good Example - Loading a Config File

```typescript
import { existsSync, readFileSync } from "node:fs";

function loadConfig(path: string): ProjectConfig | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return parseConfig(readFileSync(path, "utf8"));
  } catch (error) {
    throw new UsageError(`Invalid config at ${path}: ${describe(error)}`);
  }
}
```

**Why good:** a missing file means "use the next layer"; a malformed one is the user's to fix, so it surfaces with its path as a usage error rather than as a stack trace.

---

## Pattern 9: Subprocesses Without a Shell

### Bad Example - User Input in a Shell String

```typescript
import { exec } from "node:child_process";

exec(`git checkout ${branch}`, onDone);
```

**Why bad:** `exec` runs its string through a shell, so a branch argument of `main; rm -rf ~` runs both commands.

### Bad Example - An Array That Still Reaches a Shell

```typescript
spawn("git", ["checkout", branch], { shell: true });
```

**Why bad:** with a shell, the array is joined with spaces rather than escaped. Node deprecates passing arguments this way (DEP0190, a runtime warning since Node 24) because it is the same injection behind a safer-looking call.

### Good Example - Arguments as an Array, No Shell

```typescript
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

await execFileAsync("git", ["checkout", branch]);
```

**Why good:** each element reaches `git` as exactly one argument, whatever characters it contains. The rejection carries the child's stderr and exit code; check they reach the user rather than being swallowed.

On Windows, `.cmd` and `.bat` files — the shims package managers install — cannot be spawned without a shell, and since the CVE-2024-27980 fix Node throws `EINVAL` rather than trying. Adding `shell: true` makes the call work and routes every argument through `cmd.exe`, so it is acceptable only where the CLI controls every argument it passes.

---

## Pattern 10: Tests That Reach the Contract

### Good Example - A Spawned Test of the Non-TTY Path

```typescript
import { equal, match } from "node:assert/strict";
import { spawnSync } from "node:child_process";

const CLI_ENTRY = "dist/index.js";

const run = spawnSync(process.execPath, [CLI_ENTRY, "deploy"], {
  encoding: "utf8",
});

equal(run.status, EXIT_CODES.INVALID_ARGS);
equal(run.stdout, "");
match(run.stderr, /--region is required/);
```

**Why good:** `spawnSync` pipes all three streams by default, so stdin is not a TTY and the test takes the path CI takes. It asserts properties only a real process has — the code a script branches on, which stream carried what, and whether output drained before exit. The assertions are Node's own, so the shape carries into whichever test runner the project uses.

In-process tests stay the bulk of the suite. They need the parser's exit override, because its own `process.exit()` on `--help`, `--version` and usage errors otherwise ends the test run; prompts replaced at the module boundary, with one test per cancel shape the library has; and a filesystem isolated per test, in a temp directory or an in-memory one.

---

## Worked Review

The shape of a CLI review; severity follows the decision framework in [SKILL.md](../SKILL.md).

```markdown
# CLI Review: deploy command

## Summary

The command is well structured, and every prompt has a flag twin. Three paths report the wrong outcome to scripts: an upload failure exits 0, a cancelled region prompt deploys anyway, and `--json` output is truncated when piped.

## Must Fix (3)

### 1. Upload failure exits 0

**File:** src/commands/deploy.ts:58
**Issue:** the catch block logs the error and returns.
**Impact:** the process exits 0, so `tool deploy && notify-team` announces a deploy that failed.
**Fix:** set `process.exitCode = EXIT_CODES.UPLOAD_FAILED` in the catch.

### 2. The region prompt's cancel value is used as the region

**File:** src/commands/deploy.ts:41
**Issue:** the answer from the region prompt is passed on without the cancel check.
**Impact:** Ctrl+C at that prompt hands the library's cancel value to `deploy()` as the region.
**Fix:** check the answer with the library's cancel guard, report the cancellation, and set `EXIT_CODES.CANCELLED`.

### 3. `process.exit()` straight after the JSON report

**File:** src/commands/deploy.ts:72
**Issue:** `process.exit(EXIT_CODES.SUCCESS)` follows `process.stdout.write(report)`.
**Impact:** writes to a pipe are asynchronous on POSIX, so `tool deploy --json | jq` gets the first 64 KiB and a parse error.
**Fix:** drop the `process.exit()` call and let the command return.

## Should Fix (2)

### 1. The upload error does not say how to fix it

**File:** src/commands/deploy.ts:60
**Issue:** "Upload failed: 403" names the failure only.
**Fix:** add the cause in the user's terms and the next step — "Upload rejected (403): the token lacks deploy scope. Run 'tool login --scope deploy'."

### 2. Deploy has no `--dry-run`

**File:** src/commands/deploy.ts
**Issue:** deploy replaces what is live, and nothing shows what it would change first.
**Fix:** add `--dry-run` that prints the plan without uploading, exiting 0 when the plan is valid and with the real run's code when it is not.

## Nice to Have (1)

### 1. A help example for `--canary`

**Suggestion:** `tool deploy --help` shows only the plain invocation; an example with `--canary 10` would demonstrate the one option whose value is not obvious.

## What Was Done Well

- One exit-code module, imported wherever a code is set
- Diagnostics on stderr throughout, so piped stdout carries only the payload
- Every prompt has a flag twin, and the TTY check runs before the first prompt

## Verdict: REQUEST CHANGES

The three Must Fix findings change what scripts see. The Should Fix findings travel with the approval once they land.
```
