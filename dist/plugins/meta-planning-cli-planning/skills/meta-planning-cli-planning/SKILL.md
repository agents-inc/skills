---
name: meta-planning-cli-planning
description: CLI specification frameworks — flag contracts, prompt flows, config precedence, exit codes, output per context (TTY, piped, JSON), error and help text, signals and cross-platform behaviour. Use when a spec adds or changes a command surface, an interactive flow, a config key, an exit path or what a command prints.
---

# CLI Planning Patterns

> **Quick Guide:** A command's flags, exit codes, output streams and config keys are contracts that humans, scripts and CI all branch on, so the spec states each one the feature touches — user-facing text verbatim — and leaves out the sections it does not touch. Four facts change the answer more often than taste does: a secret never takes a flag value; Ctrl+C at a key-reading prompt is a keypress, not a signal; exiting 130 is not the same as dying by SIGINT; and prompts render on stdout unless the spec moves them.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — a fill-in template for each section below, and a worked specification for a deploy command that uses them

---

## Which sections the spec needs

Each section governs one kind of contract. Include it only when the spec touches that contract — a section filled with placeholders reads as a decision nobody made.

- **Adds or changes a command, argument or flag** — Command Surface, Exit-Code Contract and Output Contract (Patterns 1, 4 and 5).
- **Adds or changes a prompt or a wizard step** — Interactive Flow (Pattern 2).
- **Adds or changes a config key** — Configuration Precedence (Pattern 3), one table per key.
- **Changes only messages, help or diagnostics** — Error Messages and Help Text (Pattern 6).
- **Runs longer than an instant, or writes anything** — Signal Handling and Cancellation (Pattern 7), on top of whatever else applies.
- **Touches paths, files or terminal capabilities** — Cross-Platform Concerns (Pattern 8).

When none of these holds, the feature has no CLI contract and the spec carries no CLI section.

---

<critical_requirements>

## Before specifying a CLI change

**Read the closest existing command first, and reuse its flag names, prompt helpers, config resolver, exit-code constants and output helpers.** They are the vocabulary the spec has to speak; a spec that invents its own ships a CLI with two conventions, and leaves the developer to pick which one is wrong.

**Give every prompted value a non-interactive twin, and state what happens with no TTY and no twin.** A value only a prompt can supply makes the command unusable in CI, and nobody finds out until a pipeline hangs.

**Give every terminating path an exit code, named by its constant, with cancellation kept apart from failure.** Scripts branch on the code, so a path the spec leaves open exits with a number the developer chose and nobody documented.

**Specify output for every context — TTY, piped, `--json`, quiet, verbose — and which stream carries the payload.** stdout is what a pipe captures, so anything else written there corrupts the consumer's input.

**State config precedence per key as a table, with the merge rule for arrays and objects.** "Merged" without a rule gets implemented as replace in one place and concatenate in another.

</critical_requirements>

---

**Auto-detection:** CLI spec, command surface, subcommand design, flag contract, `--json` output, `--dry-run`, `--yes`, `--no-input`, non-interactive mode, prompt flow, wizard step, exit codes, exit status 130, SIGINT, SIGTERM, `NO_COLOR`, `FORCE_COLOR`, config precedence, help text, flag deprecation

**Applies to:**

- Specifying a new command or subcommand — arguments, flags, aliases, help
- Specifying an interactive flow — prompt order, keys, cancellation, the non-interactive path
- Config keys and the order they resolve in
- Exit codes, output per context, error text and signal behaviour
- Changing an existing surface without breaking the scripts that call it

**Handled elsewhere:**

- Implementing the command — parser declarations, prompt code and rendering belong to the implementation; this skill fixes the contract they implement.
- The spec's general sections — goal, scope fence, file references and success criteria — belong to whoever writes the spec; this skill supplies the CLI sections that sit inside it.
- Contracts for an HTTP API or a UI — status codes, request shapes and UI states are planned with frameworks of their own.

---

<philosophy>

## Philosophy

A CLI's public API is bigger than its code. Flags, exit codes, output streams and config keys are what humans, scripts and CI branch on, and a contract the spec leaves implicit is one the developer invents and nobody documents.

So the spec answers three callers at once: a human at a TTY, a script piping the output, and CI with no TTY at all. User-facing text is written verbatim, because approximate wording produces a CLI that words one failure five ways. Cancellation and cleanup are stated as invariants a tester can assert, not as intentions.

The spec's size follows the surface it changes. A flag-only change needs no prompt-flow table, a new exit code is proposed only when no existing class fits, and a new subcommand only when a flag on an existing command cannot do the job. Handler bodies and parser wiring stay out — the spec fixes contracts, not code.

</philosophy>

---

<decision_framework>

## Argument, flag, subcommand or prompt

Decided by the value's role, not by preference:

```
Is the value the thing the command acts on, and supplied in almost every call?
├─ YES → positional argument (app deploy <environment>)
└─ NO  → Does it change how the command behaves?
    ├─ YES → flag (--dry-run, --force, --concurrency=4)
    └─ NO  → Does it select a different operation altogether?
        ├─ YES → subcommand (app config get | app config set)
        └─ NO  → Can only the human at the terminal supply it?
            ├─ YES → prompt, with a twin that supplies the same value
            └─ NO  → derive it from config or the filesystem; do not ask
```

## Prompt, derive or refuse

```
Can the value come from a flag, config or the filesystem?
├─ YES → derive it; do not prompt
└─ NO  → Is stdin a TTY, with prompting not switched off?
    ├─ NO  → usage error naming the twin that supplies the value
    └─ YES → Is the action destructive or expensive?
        ├─ YES → confirm, skippable with --yes
        └─ NO  → prompt, pre-filled with the best default
```

</decision_framework>

---

<patterns>

## Core patterns

### Pattern 1: Command Surface

Each flag is a row carrying what its parser declaration needs: long and short name, type and unit, default, env var, and conflicts — the combinations that are a usage error rather than a silent winner. Whether it is required, which flags it implies and whether help hides it go with it where they apply.

```markdown
| Long        | Short | Type    | Default | Env Var       | Conflicts | Description                    |
| ----------- | ----- | ------- | ------- | ------------- | --------- | ------------------------------ |
| `--dry-run` | -n    | boolean | false   | —             | —         | Print the plan, change nothing |
| `--timeout` | —     | seconds | 300     | `APP_TIMEOUT` | —         | Per-phase timeout              |
```

The spec also states:

- **Short flags** only for flags used constantly, checked against every sibling command — a one-letter collision is found by a user, not a reviewer.
- **Booleans** default to false; `--no-<flag>` exists only where the default is true.
- **Repetition** — whether `--tag a --tag b` accumulates or the last one wins.
- **Aliases**, with the canonical name help shows.
- **Prefix matching** — whether the parser accepts an unambiguous prefix of a long flag.
- **Names and depth** — commands lowercase, in the codebase's existing verb or noun-verb form; long flags spelled out in kebab-case; subcommands at most two levels deep (noun, then verb) unless the existing commands already go deeper.
- **Compatibility**, for every renamed or removed flag: what old invocations do now, the deprecation warning on stderr, the release that drops the alias, and whether the exit code changes.

Template: [examples/core.md](examples/core.md#pattern-1-command-surface)

### Pattern 2: Interactive Flow

Prompt only for what cannot be derived, and give each step a table that ends in its non-interactive twin.

```markdown
| Element      | Specification                                     |
| ------------ | ------------------------------------------------- |
| Reached when | No environment from the argument or config        |
| Prompt type  | select                                            |
| Message      | `Deploy to which environment?`                    |
| On cancel    | stderr `Cancelled.`, exit 130, nothing written    |
| Twin         | positional `environment`, or `defaultEnvironment` |
```

The spec also states:

- **A secret's twin** — stdin or a file (`--password-file`), never a flag value. Whether an environment variable is accepted as well is a decision to write down: CI tooling expects one, and every child process can read it.
- **The switch that turns prompting off** even at a TTY — `--no-input`, or the codebase's existing equivalent.
- **Accelerator keys** — whether they are case sensitive, and whether they go inert while a text input or filter has focus; a live accelerator swallows the characters the field needed.
- **Keys** — when a step adds any beyond the defaults, what arrows, Space, Enter, Tab, Escape, Ctrl+C and any single-letter accelerator do there; a key the spec leaves out does whatever the prompt code happens to do.
- **Terminal size** — the minimum usable width, what degrades first — for a grid or table, the order its columns drop in — and whether the flow redraws on resize.
- **Back and forward** — which steps are revisitable, and what survives the return.
- **Resumability** — whether partial progress persists, where, and what a re-run does with it. "Nothing persisted" is a decision; leaving the line out is not.

Template: [examples/core.md](examples/core.md#pattern-2-interactive-flow)

### Pattern 3: Configuration Precedence

Config is a table per key, because the resolution order is the contract and prose leaves it to be inferred.

```markdown
| Precedence  | Source               | Identifier                              |
| ----------- | -------------------- | --------------------------------------- |
| 1 (highest) | Flag                 | `--region`                              |
| 2           | Environment variable | `APP_REGION`                            |
| 3           | Project config       | `region` in `./app.config.ts`           |
| 4           | User config          | `region` in `~/.config/app/config.json` |
| 5 (lowest)  | Built-in default     | `us-east-1`                             |
```

The spec also states, per key:

- **The layers it participates in** — not every key exists at every layer.
- **Merge semantics** — scalars take the highest layer that sets them; arrays and objects say replace, concatenate, or shallow or deep merge.
- **Absent versus empty** — whether `--tag ""` or `tags: []` overrides a lower layer or counts as unset.
- **Discovery** — which filenames, searched from where, how far up, and the tie-break when two match.
- **Validation** — on load or on use, and the exit code an invalid value produces.
- **Write-back** — which file and layer a write lands in, whether comments and key order survive, and whether the write is atomic.

Template: [examples/core.md](examples/core.md#pattern-3-configuration-precedence)

### Pattern 4: Exit-Code Contract

Every terminating path gets a code and every code a documented meaning; scripts branch on them as they do on flags.

```markdown
| Code     | Meaning                                                              |
| -------- | -------------------------------------------------------------------- |
| 0        | Success                                                              |
| 1        | Generic runtime failure                                              |
| 2        | Usage error — bad flag, missing argument                             |
| 3–125    | Domain classes the codebase defines                                  |
| 126, 127 | Set by the shell: found but not executable, not found                |
| 128+N    | Set by the shell: killed by signal N — 130 is SIGINT, 143 is SIGTERM |
```

Domain codes stay inside 3–125: a status is truncated to its low 8 bits, and the shell already gives 126 and above a meaning of its own.

The spec also states:

- **Existing constants reused** — a new code only where no class fits, named by its constant rather than its number.
- **One code per failure class a caller acts on differently** — two failures a script handles alike share a code.
- **Cancellation apart from failure** — Ctrl+C and a declined confirmation exit with a code no failure uses.
- **Partial success** — fail the run, or succeed with a code that says some items failed; either way, decided.
- **`--dry-run`** exits 0 on a valid plan and with the real run's failure code otherwise, or CI cannot trust a passing dry run.

Template: [examples/core.md](examples/core.md#pattern-4-exit-code-contract)

### Pattern 5: Output Contract

stdout carries the data the caller asked for; stderr carries everything else — progress, warnings, diagnostics and prompts — so progress survives piping without corrupting the pipe.

```markdown
| Context         | Progress            | Colour  | Payload                          |
| --------------- | ------------------- | ------- | -------------------------------- |
| TTY, default    | Spinner or progress | Yes     | Human-readable summary, stdout   |
| Piped (non-TTY) | Plain lines, stderr | No ANSI | Same payload, no decoration      |
| `--json`        | None                | None    | One JSON document, stdout        |
| `--quiet`       | None                | None    | Payload only; errors still shown |
| `--verbose`     | Per-step detail     | On TTY  | Payload plus diagnostics         |
```

The spec also states:

- **The `--json` shape**, the error shape included — valid JSON on failure too, and nothing else on stdout.
- **Colour** — off when the stream is not a TTY, `TERM` is `dumb`, `--no-color` is passed, or `NO_COLOR` is set to a non-empty value; a flag or user config overrides `NO_COLOR`. `FORCE_COLOR` is a convention rather than a standard — Node, for one, lets it override `NO_COLOR` — so the spec says which wins when both are set.
- **The quiet and verbose ladder** — what each level suppresses or adds, whether each combines with `--json`, and which wins when they do not.
- **Progress** — which operations show it and what each phase says: a spinner for waits of a few seconds, a count or percentage for longer ones.
- **No-op output** — the exact message when a re-run has nothing to do, or silence written down as the decision. A short message such as `Already up to date.` is usually the better default, because silence leaves the user unsure whether anything ran.
- **A closed pipe** — what the command does when the reader exits early (`app list | head -1`), and with which code.

Template: [examples/core.md](examples/core.md#pattern-5-output-contract)

### Pattern 6: Error Messages and Help Text

Each error has four parts, written verbatim: what failed, named as the user named it; why, in the user's vocabulary; how to fix it, as a concrete command or edit; and where to look, when a file, config key or doc page is involved.

```
BAD:  Error: ENOENT
GOOD: Error: config file not found at ./app.config.ts.
      Run 'app init' to create one, or pass --config <path>.
```

The spec also states:

- **Errors on stderr**, with no stack trace by default — and the flag or env var that reveals one.
- **Unknown commands and flags** — whether a "did you mean" suggestion appears, and its matching rule. It suggests; it never runs the guess.
- **Validation errors** naming the offending value and the accepted set.
- **Another tool's failure** quoted as that tool reported it, not paraphrased.
- **Help per command** — summary, usage line with argument arity, arguments, grouped flags, at least two real invocations and related commands, reachable as `--help`, `-h` and `help <command>`.

Template: [examples/core.md](examples/core.md#pattern-6-error-messages-and-help-text)

### Pattern 7: Signal Handling and Cancellation

For a command that runs longer than an instant or writes anything, cleanup is an invariant a tester can assert:

```markdown
After SIGINT during upload, no `.staging/` prefix remains under the target,
and the caller sees the process killed by SIGINT (status 130).
```

The spec settles each of:

- **SIGINT** — the message, how fast it returns, and the exit status: a code, or the signal re-raised after cleanup.
- **SIGTERM** — the same path as SIGINT, or a distinct one.
- **In-flight work** — finished, abandoned or rolled back.
- **Partial writes** — which files can be left half-written, and how a re-run recovers (atomic rename, lock file).
- **Terminal restoration** — cursor, raw mode, alternate screen, colour reset.
- **Cleanup** — temp files, lock files, child processes, open handles.
- **A second Ctrl+C** — skips cleanup and exits now, or is ignored; the first one says which.
- **Prompt cancellation** — what a cancelled prompt does: the same message and exit as SIGINT, or its own. A prompt that reads single keys has to be routed there explicitly, because raw mode turns Ctrl+C into a keypress the SIGINT handler never sees.

Template: [examples/core.md](examples/core.md#pattern-7-signal-handling-and-cancellation)

### Pattern 8: Cross-Platform Concerns

Include the ones that apply, and name the ones deliberately out of scope.

- **Paths** joined with the platform separator; user-supplied paths resolved against the cwd or against the config file, stated.
- **Home and config directories** from the platform API, which reads `USERPROFILE` on Windows and `HOME` elsewhere; the config location per platform where they differ.
- **Case** — whether two names differing only by case collide: distinct on Linux, one file by default on macOS and Windows.
- **Line endings** written, and whether input endings survive.
- **Shell quoting** in help examples, valid in every shell the project supports.
- **Executable bits** on any file the command creates that has to run.
- **Long paths and reserved names** for generated file names on Windows.
- **Unicode** — the fallback glyphs where the terminal lacks it.

Template: [examples/core.md](examples/core.md#pattern-8-cross-platform-concerns)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- A secret accepted as a flag value — it lands in `ps` output and shell history. Read it from stdin or a file.
- Prompts left on their default stream — prompt libraries and line-input builtins commonly render on stdout, so `app init > plan.txt` writes the questions into the file and leaves the user at a blank wait. Name stderr in the spec.
- Prompt cancellation specified as "handled by the SIGINT handler" — a prompt that reads single keys puts the terminal in raw mode, where Ctrl+C arrives as a byte and no signal fires. Give the prompt's cancel its own path.
- Exiting 130 after catching SIGINT, in a command that scripts call — a normal exit with 130 is not a death by SIGINT, so the calling shell script runs its next command. Specify re-raising the signal after cleanup.
- A domain exit code above 125 — 126, 127 and 128+N already mean something to the shell, and the status is truncated to 8 bits, so 256 reads as success. Keep domain codes within 3–125.
- A closed pipe left unspecified — the next write fails with EPIPE, a runtime that ignores SIGPIPE raises it as an error, and `app list | head` prints a stack trace. State the quiet exit.
- A `--json` mode with no error shape — the consumer's parser fails on exactly the run it most needs to read.
- A flag renamed or removed with no deprecation path — the scripts that used it break, and nobody reports it.
- A writing command with no cancellation invariant — Ctrl+C leaves half-written files and a hidden cursor.
- "Follows existing patterns" with no file reference — nothing verified the pattern exists, so the developer invents one and the CLI gains a second convention.

**Surprising behaviour:**

- `NO_COLOR` set to an empty string leaves colour on; only a non-empty value disables it.
- A parser that accepts unambiguous long-flag prefixes makes each new flag a potential break: `--verb` resolves to `--verbose` until `--verbatim` ships, and then it is an ambiguity error in every script that used it.

</red_flags>
