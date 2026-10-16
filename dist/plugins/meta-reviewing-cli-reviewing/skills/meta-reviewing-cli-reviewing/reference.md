# CLI Review - Reference

> Lookup only. Decisions and red flags are in [SKILL.md](SKILL.md); full code is in [examples/core.md](examples/core.md).

---

## Exit-code conventions

- **0** — success
- **1** — general failure; also what Node exits with on an uncaught exception, an unawaited rejection included
- **2** — usage error: unknown flag, missing argument (the convention Bash keeps for its builtins)
- **3–125** — domain failures a caller acts on differently, each a documented constant
- **126, 127** — command found but not executable, command not found; the shell reports these, so a CLI never emits them
- **128 + n** — ended by signal n: 130 for `SIGINT`, 143 for `SIGTERM`; Node's default signal exit, and what a shell reports for a process killed by the signal

---

## How a prompt library reports Ctrl+C

While a prompt holds the terminal in raw mode, Ctrl+C is input the library handles, and it reports the cancel in one of three shapes:

- **It returns a cancel value**, typically a symbol — unchecked, the value flows on as the answer. Look for a guard on the result before its first use.
- **It rejects the prompt's promise** with a cancellation error — unchecked, the rejection surfaces as a stack trace and exit 1. Look for a catch that recognises the cancellation error and rethrows everything else.
- **It returns the answers so far**, with the cancelled field absent — unchecked, the field arrives as `undefined`. Look for a check on the field, or a cancel callback that ends the flow.

A full-screen renderer that reads keys usually handles Ctrl+C itself while it holds raw mode. Find out how its exit reaches the code that started it, and check the command awaits that and sets an exit code from it.

---

## Review checklists by area

### Entry point and dispatch

- The parser's asynchronous entry point is awaited, inside one top-level handler
- The handler maps known error classes to a message and a code, and anything else to one line, with the stack behind a debug flag or variable
- `--help` and `--version` work, and exit 0
- A usage error prints what was wrong and points at `--help`
- Global options (`--verbose`, `--dry-run`, `--json`, `--no-color`) are declared once and reach every subcommand
- A CLI with more than trivial behaviour has a `--verbose` or debug mode, so a user can see what it did without reading its source; a simple CLI needs none

### Exit codes

- Every code is a named constant in one module, with its meaning documented
- No numeric literal in `process.exit()` or `process.exitCode`
- Every failure path exits non-zero — read each catch block that logs
- Cancellation has its own code, distinct from failure
- `--dry-run` exits 0 when the plan is valid, and with the real run's code when it is not
- After output has been written, the code is set with `process.exitCode`, not `process.exit()`

### Prompts and cancellation

- Every prompt call handles the library's cancel shape
- The cancel message says what state was left — nothing written, or what was partly written
- Every prompted value has a flag or config twin
- No prompt is reached when stdin is not a TTY, or when `--no-input` is passed
- Each prompt validates its answer, and re-asks or names the accepted set when it fails — an unvalidated answer travels on and fails later, far from the question that produced it
- A destructive action asks for confirmation, `--yes` supplies it, and with no TTY and no `--yes` the command refuses
- A destructive operation supports `--dry-run`, so its effect can be seen before it is committed to

### Signals and cleanup

- A `SIGINT` or `SIGTERM` listener exists only where there is something to clean up — temp files, lock files, child processes, terminal state
- Every listener ends the process, with 130 for `SIGINT` and 143 for `SIGTERM`
- Cleanup in a listener is synchronous, or awaited before the exit
- A second Ctrl+C during long cleanup exits at once
- Terminal state is restored on exit — cursor visible, raw mode off

### Output

- The payload goes to stdout, and progress, warnings and errors to stderr
- Spinners, progress bars and colour appear only where their stream is a TTY
- `NO_COLOR` (present and non-empty), `TERM=dumb` and `--no-color` turn colour off
- Colour carries one meaning across the CLI — errors in one colour, warnings in another, the same in every command — and errors and warnings are written through one helper, so a user scanning output can trust the colour
- Every spinner is stopped before anything else is written to the terminal — text written while it animates is overwritten or split by its frames
- Every spinner ends with a final state on the failure path as well as on success
- `--json` writes one document to stdout, failures included, and nothing else
- A re-run with nothing to do says so
- An operation likely to exceed 500 ms shows progress on stderr, because silent work that long reads as a hang; under 500 ms no spinner is needed

### Error messages

- Each says what failed, why, how to fix it, and where — the path, key or flag involved
- A validation error names the offending value and the accepted set
- An expected failure shows no stack trace
- An error from a wrapped tool quotes that tool's stderr rather than paraphrasing it

### Configuration

- Precedence per key: flag, then environment, then project config, then user config, then default
- Absent versus empty is decided per key (`??` versus `||`), and the same way for every key
- A missing config file is not an error unless the command needs one
- A malformed config file is reported with its path and the parse error
- `--verbose` shows which layer each value came from

### Help text

- Each command has a one-line description, which `tool --help` lists beside its name
- Every option has a description, with its default
- Required options and arguments are marked as required, and optional ones as optional
- Positional arguments have names that say what they hold — `<source>`, not `<arg1>`
- At least two real invocations as examples
- The examples cover the options that are hard to get right, not only the simplest invocation
- Long flags are `--kebab-case`
- A frequently used option has a short flag (`-f` for `--force`); short flags are kept for frequent options, with no collisions across sibling commands

### Command structure

These apply to the commands the diff adds or changes.

- Each command lives in its own file, so one command can be read, tested and changed without touching its siblings
- No god commands: an action past 200 lines is split into parsing, prompting, work and output, each testable on its own
- Helpers more than one command uses are extracted to a shared module rather than copied, so a fix lands in every command at once
- An option with the same meaning has the same name in every command
- Arguments are validated before any prompt or work starts
- Related operations are subcommands (`config get`, `config set`) rather than flags that select one

### Input, subprocesses and secrets

- A user-supplied file path is resolved and checked to stay inside the directory the command may touch before anything reads or writes it — otherwise `../` reaches anywhere the user's account can
- A user-supplied URL is validated before it is fetched — its scheme and host against what the command expects — so the CLI does not request whatever it is handed
- No user input in an `exec` string, or under `shell: true`; `execFile` or `spawn` take an argument array
- On Windows, a `.cmd` or `.bat` target runs through a shell only with arguments the CLI controls
- A child's stderr reaches the user, and its exit code is mapped rather than swallowed
- No secret is accepted as a flag value — a file path or stdin instead
- No secret is printed, under `--verbose` included, nor echoed in help or error text
- A config file that holds secrets is written readable by its owner alone, or the CLI warns when others can read it

### Tests

- Each command: success, invalid arguments, `--help`
- Each prompt flow: completion, cancellation in the library's shape, validation rejection, the non-TTY path
- Each branch a select prompt leads to has its own test
- Config: each layer, the precedence between them, a missing file, a malformed file
- Exit codes: success, each failure class, cancellation
- In-process tests use the parser's exit override, so `--help` and usage errors do not end the test run
- At least one test per contract spawns the built CLI with piped stdio and asserts the exit status and what each stream carried
- The filesystem is isolated per test, in a temp directory or an in-memory one
- File writes are asserted — what was written and where — not only isolated
