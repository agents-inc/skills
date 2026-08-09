---
name: meta-planning-cli-planning
description: CLI specification planning frameworks. Use when a spec touches a command surface, an interactive flow, config precedence, exit codes, or output modes. Covers flag contracts, prompt flow design, precedence tables, exit-code taxonomy, TTY/piped/JSON output, error text, signals, and cross-platform concerns.
---

# CLI Planning Frameworks

> **Quick Guide:** Specify each contract the feature actually touches — the full flag table for a new surface, the per-step prompt table for an interactive flow, a precedence table per config key, an exit code for every terminating path, and output behaviour per context (TTY, piped, `--json`, quiet, verbose). Apply a framework only when the spec touches its artifact class; a config-only change needs no prompt-flow section.

---

<critical_requirements>

## CRITICAL: Before Specifying CLI Contracts

> **All specifications must be grounded in the codebase's real commands, prompts, resolvers, and constants** — reference specific files with line numbers

**(You MUST give every prompted value a non-interactive twin — a flag or config key — and state what happens with no TTY and no flag)**

**(You MUST give every terminating path an exit code named as a constant, with cancellation distinct from failure)**

**(You MUST specify output per context — TTY, piped, `--json`, quiet, verbose — and state which stream carries payload versus diagnostics)**

**(You MUST state config precedence per key as a table with merge semantics — "merged" without a rule is not a rule)**

**(You MUST apply each framework only when the spec touches its artifact class — an unused section is omitted, never filled with placeholders)**

</critical_requirements>

---

**Auto-detection:** CLI spec, command surface design, flag contract, subcommand, interactive wizard spec, prompt flow, config precedence, exit codes, JSON output mode, help text spec, signal handling spec

**When to use:**

- Specifying a new command or subcommand surface (arguments, flags, aliases)
- Specifying an interactive flow (prompt sequence, keybindings, cancellation)
- Specifying configuration keys and their resolution order
- Specifying output contracts (TTY, piped, `--json`, quiet, verbose)
- Specifying exit codes, error messages, help text, or signal handling
- Changing an existing surface (backward compatibility, deprecation path)

**When NOT to use:**

- When implementing CLI code (use the relevant CLI implementation skill)
- For backend API or frontend UI specifications (use the api/web planning skills)
- For the planning PROCESS itself — research, scope fencing, success criteria — which the PM agent carries

**Key patterns covered:**

- Command surface design (argument vs flag vs subcommand vs prompt)
- Per-flag contract fields and naming rules
- Interactive flow design (when to prompt, per-step specification)
- Configuration precedence tables and merge semantics
- Exit-code contract rules
- Output contract per context, stream split, `--json` shape
- Error-message anatomy and help-text requirements
- Signal handling and cancellation invariants
- Cross-platform concerns
- Common CLI spec failures

**Detailed Resources:**

- [examples/core.md](examples/core.md) - Per-artifact spec section templates and a worked example specification

---

<philosophy>

## Philosophy

**A CLI's public API is bigger than its code.** Flags, exit codes, output streams, and config keys are contracts that humans, scripts, and CI all branch on. A spec that leaves one of them implicit forces the developer to invent it — and an invented contract is one nobody documented.

**When specifying CLI work:**

- Read the closest existing command first; its flag names, exit constants, and output helpers are the vocabulary the spec must reuse
- Specify for all three callers at once: a human at a TTY, a script piping output, and CI with no TTY at all
- Write user-facing text verbatim — approximate wording produces an inconsistent CLI
- State cancellation and cleanup as invariants a tester can assert ("after SIGINT during upload, no `.tmp` files remain and exit code is 130")

**When NOT to specify:**

- Don't fill a framework section the feature never touches — a flag-only change needs no interactive-flow table
- Don't propose a new exit code when an existing failure class fits
- Don't design a subcommand when a flag on an existing command achieves the goal
- Don't specify implementation (handler bodies, parser wiring) — contracts, not code

**Core principles:**

- **Every prompt has a flag twin**: a value only a prompt can supply makes the command unusable in CI
- **One code per actionable failure class**: two failures a script handles identically need one code
- **stdout is payload, stderr is everything else**: progress must survive piping without polluting the pipe
- **Proportionality**: the spec's size follows the surface it changes, not the framework list

</philosophy>

---

<patterns>

## Core Patterns

### Pattern 1: Command Surface Design

Argument, flag, subcommand, or prompt — decided by role, not preference.

```
Is the value the thing the command acts ON, and required in almost every call?
├─ YES -> positional argument (app deploy <environment>)
└─ NO  -> Does it modify HOW the command behaves?
    ├─ YES -> flag (--dry-run, --force, --concurrency=4)
    └─ NO  -> Does it select a fundamentally different operation?
        ├─ YES -> subcommand (app config get | app config set)
        └─ NO  -> Is it only knowable by asking the human?
            ├─ YES -> prompt, with a flag that supplies the same value non-interactively
            └─ NO  -> derive it from config or the filesystem; do not ask
```

**Naming rules to specify:**

| Rule             | Specify as                                                             |
| ---------------- | ---------------------------------------------------------------------- |
| Command names    | Lowercase verb or noun-verb, matching the vocabulary already in use    |
| Subcommand depth | Two levels maximum unless the codebase already goes deeper             |
| Long flags       | `--kebab-case`, spelled out, no abbreviations                          |
| Short flags      | Only for flags used constantly; never invent a new one-letter conflict |
| Boolean flags    | Default false; provide `--no-<flag>` only when the default is true     |
| Value flags      | Name the type and unit (`--timeout <seconds>`, not `--timeout`)        |
| Repeatable flags | State explicitly that repetition accumulates (`--tag a --tag b`)       |
| Aliases          | List them, and state which name is canonical in help output            |

**Per-flag contract the spec must carry:**

| Field      | Why the developer needs it                                       |
| ---------- | ---------------------------------------------------------------- |
| Long name  | The parser declaration                                           |
| Short name | Conflict checking against sibling commands                       |
| Type       | Parser coercion and validation                                   |
| Default    | Whether the value is optional downstream                         |
| Required   | Whether a missing value is a usage error                         |
| Env var    | Which layer of precedence it participates in                     |
| Conflicts  | Which combinations are a usage error rather than a silent winner |
| Requires   | Which flags imply other flags                                    |
| Hidden     | Whether it appears in help                                       |

**Backward compatibility.** When changing an existing surface, state for every removed or renamed flag: what old invocations do now, whether a deprecation warning is emitted on stderr, which release removes the alias, and whether the exit code changes. A silently changed flag breaks scripts that nobody will report.

**Why this matters:** an undefined flag contract makes the developer invent a parser declaration, and every invention is a convention the CLI does not have.

---

### Pattern 2: Interactive Flow Design

Prompt only what cannot be derived, and give every step a complete contract.

```
Can the value be derived from config, a flag, or the filesystem?
├─ YES -> derive it; do not prompt
└─ NO  -> Is stdin a TTY?
    ├─ NO  -> fail with a usage error naming the flag that supplies it
    └─ YES -> Is the action destructive or expensive?
        ├─ YES -> prompt for confirmation, skippable with --yes
        └─ NO  -> prompt for the value, pre-filled with the best default
```

**Per-step specification:**

| Element              | Specify                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| Step name and order  | Where it sits in the sequence and what makes it reachable                      |
| Prompt type          | Text, select, multi-select, confirm, path, password                            |
| Message text         | The exact string shown                                                         |
| Initial value        | Default, and where the default comes from                                      |
| Options              | For selects: the option list, labels, hints, and ordering rule                 |
| Validation           | The rule, when it fires (per keystroke or on submit), and the exact error text |
| Empty state          | What renders when there is nothing to choose                                   |
| Keybindings          | Any key beyond the framework defaults, and what it does                        |
| Back and forward     | Whether the step is revisitable and what is preserved on return                |
| Cancellation         | What Ctrl+C at this step leaves behind on disk                                 |
| Non-interactive twin | The flag or config key that supplies the same value                            |

**Keyboard interactions to specify explicitly** when a step adds any beyond the defaults: arrow keys, Space, Enter, Tab, Escape, Ctrl+C, and any single-letter accelerator. State whether accelerators are case sensitive, and whether they are inert when a filter or text input has focus. An accelerator that swallows a keystroke a text field needed is the classic wizard bug.

**Terminal-size constraints:** state the minimum usable width and what degrades first (truncate labels, drop hint column, stack instead of columns). State whether the flow redraws on resize. If the flow renders a grid or table, give the column priority order for narrow terminals.

**Resumability:** state whether partial progress is persisted, where, and what a re-run does with it — resume silently, prompt to resume, or discard. If nothing is persisted, say so; that is a decision, not an omission.

---

### Pattern 3: Configuration Precedence

Specify config as a table per key, never as prose. The resolution order is the contract:

| Layer       | Source               | Example                     |
| ----------- | -------------------- | --------------------------- |
| 1 (highest) | Command-line flag    | `--region eu-west-1`        |
| 2           | Environment variable | `APP_REGION=eu-west-1`      |
| 3           | Project config file  | `./app.config.ts`           |
| 4           | User config file     | `~/.config/app/config.json` |
| 5 (lowest)  | Built-in default     | `us-east-1`                 |

**Rules the spec must state:**

- **Per-key layer participation.** Not every key exists at every layer. Name the layers each key participates in, and the exact key or flag name at each.
- **Merge semantics.** Scalars: first non-undefined wins. Arrays and objects: state replace or merge explicitly, per key. "Merge" without a rule is the most common source of config bugs.
- **Absent versus empty.** State whether an explicitly empty value (`--tag ""`, `tags: []`) overrides a lower layer or is treated as unset.
- **Discovery.** For project config: which filenames, searched from where, walking up how far, and what happens when two match.
- **Validation timing.** Whether the config is validated on load or on use, and which exit code an invalid config produces.
- **Write-back.** If the command writes config, state which file and layer it writes, whether it preserves comments and key order, and whether it writes atomically.

---

### Pattern 4: Exit-Code Contract

Every terminating path gets a code, and every code gets a documented meaning. Scripts branch on these; they are as much a public API as the flags.

| Code    | Conventional meaning                            |
| ------- | ----------------------------------------------- |
| 0       | Success                                         |
| 1       | Generic runtime failure                         |
| 2       | Usage error (bad flag, missing argument)        |
| 130     | Terminated by SIGINT (Ctrl+C)                   |
| 143     | Terminated by SIGTERM                           |
| Project | Domain-specific classes defined by the codebase |

**Rules the spec must state:**

- Read the codebase's existing exit-code constants first and reuse them. Propose a new code only when no existing class fits, and say what it means.
- One code per failure class the caller can act on differently. Two failures a script would handle identically do not need two codes.
- Cancellation is not an error. Ctrl+C and a declined confirmation get their own codes, distinct from failure.
- Partial success needs an explicit decision: fail the whole run, or succeed with a warning and a code that says "some items failed".
- `--dry-run` exits 0 when the plan is valid, and the same failure code as a real run when it is not.
- Name the constant, not the number, when the codebase has constants.

---

### Pattern 5: Output Contract

**Stream split:** stdout carries the data the caller asked for. stderr carries everything else — progress, warnings, diagnostics, prompts. A command whose output is piped must still show its progress, and must not pollute the pipe with it.

**Mode matrix to fill in per command:**

| Context         | Progress            | Colour and symbols | Payload                        |
| --------------- | ------------------- | ------------------ | ------------------------------ |
| TTY, default    | Spinner or progress | Yes                | Human-readable summary, stdout |
| Piped (non-TTY) | Plain lines, stderr | No ANSI            | Same payload, no decoration    |
| `--json`        | None                | None               | One JSON document, stdout      |
| `--quiet`       | None                | Suppressed         | Payload only, errors only      |
| `--verbose`     | Per-step detail     | Yes on TTY         | Payload plus diagnostics       |

**Rules the spec must state:**

- **`--json` schema.** Give the exact object shape, including the error shape. `--json` must emit valid JSON on failure too, and must never interleave log lines into stdout.
- **Colour detection.** Honour `NO_COLOR` and `FORCE_COLOR` and the TTY check. State the fallback glyphs when Unicode is unavailable.
- **Quiet and verbose ladder.** State exactly which messages each level suppresses or adds. Whether they combine with `--json` and which wins.
- **Progress thresholds.** Which operations warrant a spinner (typically anything over ~500ms), and what the spinner says at each phase.
- **Idempotent re-runs.** State what the output says when there is nothing to do — silence is a decision, "Already up to date." is usually better.

---

### Pattern 6: Error Messages and Help Text

**Message anatomy** — specify all four parts, verbatim:

1. **What failed** — the operation, named the way the user named it
2. **Why** — the underlying cause, in the user's vocabulary, not the exception's
3. **How to fix** — a concrete next command or edit
4. **Where to look** — the file path, config key, or doc reference when one exists

```
BAD:  Error: ENOENT
GOOD: Error: config file not found at ./app.config.ts.
      Run 'app init' to create one, or pass --config <path>.
```

**Rules the spec must state:**

- Errors go to stderr; never to stdout.
- Never print a raw stack trace by default. State which flag or env var reveals it.
- Unknown command or flag: state whether a "did you mean" suggestion is offered and the matching rule.
- Validation errors name the offending value and the accepted set.
- Errors caused by another tool quote that tool's message rather than paraphrasing it.

**Help text to specify per command:** one-line summary, usage line with argument arity, argument descriptions, flags grouped and ordered, at least two worked examples of real invocations, and any related commands. State whether the command's help is reachable as `--help`, `-h`, and `help <command>`.

---

### Pattern 7: Signal Handling and Cancellation

Specify for every command that runs longer than an instant, or writes anything:

| Concern              | Specify                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| SIGINT (Ctrl+C)      | The message shown, the exit code, and how quickly it returns                      |
| SIGTERM              | Whether it is handled distinctly from SIGINT                                      |
| In-flight work       | Whether the current step finishes, is abandoned, or is rolled back                |
| Partial writes       | Which files may be half-written and how a re-run recovers (atomic write, or lock) |
| Terminal restoration | Cursor visibility, raw mode, alternate screen, and colour reset on exit           |
| Cleanup              | Temp files, lock files, child processes, and open handles                         |
| Second Ctrl+C        | Whether it forces an immediate exit while cleanup is running                      |
| Prompt cancellation  | What a cancelled prompt does — same path as SIGINT, or a distinct message         |

State cleanup as an invariant the tester can assert: "after SIGINT during upload, no `.tmp` files remain under the target directory and exit code is 130."

---

### Pattern 8: Cross-Platform Concerns

Include the ones that apply; state explicitly when a concern is out of scope:

- **Paths:** join with the platform separator, never string concatenation. State whether user-supplied paths are resolved relative to CWD or the config file.
- **Home directory:** resolve via the platform API, not `$HOME`. State the config location per platform when they differ.
- **Case sensitivity:** whether a name collision that is distinct on Linux and identical on macOS is an error.
- **Line endings:** what the command writes, and whether it preserves what it reads.
- **Shell quoting:** any example in help text must be valid in the shells the project supports.
- **Executable permissions:** any file the command creates that must be executable.
- **Long paths and reserved names:** relevant on Windows for generated file names.
- **Colour and Unicode support:** the fallback for terminals that lack them.

</patterns>

---

<decision_framework>

## Decision Framework

### Which Spec Sections Does This Feature Need?

Apply a framework only when the spec touches its artifact class. The per-artifact section templates live in [examples/core.md](examples/core.md).

```
Does the spec add or change a command, argument, or flag?
├─ YES → Command Surface section (Pattern 1) + Exit Codes (Pattern 4) + Output Contract (Pattern 5)
└─ Does it add or change prompts or a wizard step?
    ├─ YES → Interactive Flow section (Pattern 2), each prompt with its flag twin
    └─ Does it add or change config keys?
        ├─ YES → Configuration Resolution section (Pattern 3), one table per key
        └─ Does it only change messages, help, or diagnostics?
            ├─ YES → Error Messages / Help Text section (Pattern 6) with verbatim text
            └─ NO  → None of these frameworks applies; do not force one in
```

Always applicable when the command runs long or writes: Signal Handling (Pattern 7). Always worth a pass when files or paths are involved: Cross-Platform (Pattern 8).

### Common Spec Failures

| Failure                            | Consequence                                                             |
| ---------------------------------- | ----------------------------------------------------------------------- |
| Prompt with no flag twin           | Command is unusable in CI; discovered only after release                |
| Undefined exit code for a path     | The developer invents one; scripts branch on a number nobody documented |
| Output specified for TTY only      | Piped output carries ANSI escapes and spinner frames into the consumer  |
| Config precedence left as "merged" | Arrays merge in one place and replace in another                        |
| Paraphrased error text             | Every command words the same failure differently                        |
| No cancellation requirement        | Ctrl+C leaves half-written files and a hidden cursor                    |
| Flag renamed without a plan        | Existing scripts break silently                                         |
| "Follows existing patterns"        | No file reference means no pattern was verified to exist                |

</decision_framework>

---

<red_flags>

## RED FLAGS

**High Priority Issues (a spec with one of these is incomplete):**

- A prompted value with no flag or config twin
- A terminating path with no exit code, or a magic number instead of a constant
- Output described only for the TTY case
- A config key whose merge semantics are "merged"
- Error or prompt text described rather than written verbatim
- A long-running or writing command with no cancellation invariant

**Medium Priority Issues:**

- A new exit code where an existing failure class fits
- A new subcommand where a flag on an existing command would do
- A renamed or removed flag with no deprecation path
- Help text without worked examples
- A `--json` mode with no error shape

**Common Mistakes:**

- Designing flags without reading sibling commands (short-form collisions)
- Treating cancellation as an error instead of its own exit class
- Specifying spinner text but not the piped-output equivalent
- Leaving "nothing to do" output unspecified on idempotent re-runs

**Gotchas & Edge Cases:**

- An accelerator key that is live while a text input has focus swallows typed characters
- `--dry-run` must share the real run's failure codes or CI cannot trust it
- An explicitly empty value (`--tag ""`) and an absent one are different inputs; decide which wins
- Second Ctrl+C during cleanup needs its own answer

</red_flags>

---

<critical_reminders>

## CRITICAL REMINDERS

> **All specifications must be grounded in the codebase's real commands, prompts, resolvers, and constants**

**(You MUST give every prompted value a non-interactive twin — a flag or config key — and state what happens with no TTY and no flag)**

**(You MUST give every terminating path an exit code named as a constant, with cancellation distinct from failure)**

**(You MUST specify output per context — TTY, piped, `--json`, quiet, verbose — and state which stream carries payload versus diagnostics)**

**(You MUST state config precedence per key as a table with merge semantics)**

**(You MUST apply each framework only when the spec touches its artifact class — an unused section is omitted, never filled)**

**Failure to specify these contracts produces CLIs whose developers invent flags, guess exit codes, break piped and CI callers, and leave half-written files behind on Ctrl+C.**

</critical_reminders>
