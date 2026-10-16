# CLI Planning - Section Templates and a Worked Example

> A fill-in template for each pattern in [SKILL.md](../SKILL.md), under the pattern's name, then a worked specification that uses the ones its feature touches. Include a section only when the spec touches the contract it governs; an unused section is left out, not filled with placeholders.

---

## Pattern 1: Command Surface

Use when the spec adds or changes a command, argument or flag.

```markdown
<command_surface>

## Command Surface

### `[command] [subcommand] <required-arg> [optional-arg]`

**Summary:** [One line, as help shows it]
**Aliases:** [Alias list and the canonical name | none]
**Interactive:** [Yes — prompts for missing values at a TTY | No]

**Arguments:**

| Name   | Required | Type   | Default              | Description  |
| ------ | -------- | ------ | -------------------- | ------------ |
| [name] | [yes/no] | [type] | [value or "derived"] | [what it is] |

**Flags:**

| Long       | Short | Type            | Default | Env Var | Conflicts | Description    |
| ---------- | ----- | --------------- | ------- | ------- | --------- | -------------- |
| `--[name]` | [-x]  | [type and unit] | [false] | [VAR]   | [--other] | [what it does] |

**Per flag, where it applies:** [Required — a missing value is a usage error; the flags it implies; hidden from help; repeatable — accumulates or last wins]
**Prefix matching:** [Unambiguous long-flag prefixes accepted | rejected]

**Validation:**

| Rule                         | Failure Behaviour                  |
| ---------------------------- | ---------------------------------- |
| [Accepted values for a flag] | [Exit code + exact stderr message] |

**Backward Compatibility:** [None needed — new command | For each renamed or removed flag: what old invocations do now, the deprecation warning text, the release that removes the alias, and whether the exit code changes]

</command_surface>
```

---

## Pattern 2: Interactive Flow

Use when the spec adds or changes prompts or wizard steps.

```markdown
<interactive_flow>

## Interactive Flow

**Entry condition:** [When the flow runs — missing values at a TTY with prompting on, or always]
**Prompts drawn on:** [stderr | stdout, and why]
**Prompting off:** [The switch that disables prompts at a TTY | none, and why]
**Non-interactive path:** [The twin for every prompted value; the exit code and exact message when there is no TTY and a twin is missing]

### Step [N]: [Name]

| Element       | Specification                                              |
| ------------- | ---------------------------------------------------------- |
| Reached when  | [What makes this step run]                                 |
| Prompt type   | [text / select / multi-select / confirm / path / password] |
| Message       | `[exact string shown]`                                     |
| Initial value | [Default, and where it comes from]                         |
| Options       | [Options, labels, hints and ordering rule, for selects]    |
| Validation    | [Rule, when it fires, exact error text]                    |
| Empty state   | [What renders when there is nothing to choose]             |
| Keybindings   | [Keys beyond the defaults; live or inert while typing]     |
| Revisitable   | [No, or yes and what is preserved on return]               |
| On cancel     | [Message, exit code, what is left on disk]                 |
| Twin          | [`--flag`, config key, or stdin / a file for a secret]     |

**Terminal constraints:** [Minimum usable width; what degrades first, and for a grid or table the order its columns drop in; redraw-on-resize behaviour]

**Resumability:** [Nothing persisted | What is persisted, where, and what a re-run does with it]

</interactive_flow>
```

---

## Pattern 3: Configuration Precedence

Use when the spec adds or changes config keys. One table per key; drop the rows for layers the key does not use.

```markdown
<config_precedence>

## Configuration Precedence

**Discovery:** [Config filenames, where the search starts, how far up it walks, the tie-break when two match]

### Key: `[key.name]`

| Precedence  | Source               | Identifier   |
| ----------- | -------------------- | ------------ |
| 1 (highest) | Flag                 | `--[flag]`   |
| 2           | Environment variable | `[ENV_VAR]`  |
| 3           | Project config       | `[key.name]` |
| 4           | User config          | `[key.name]` |
| 5 (lowest)  | Built-in default     | `[value]`    |

**Type:** [type]
**Merge semantics:** [Scalar — the highest layer that sets it wins | Array — replace or concatenate | Object — shallow or deep merge]
**Empty value:** [Treated as unset | Overrides lower layers]
**Validation:** [On load or on use; exit code and exact message on failure]

**Write-back:** [None | Which file and layer is written, whether comments and key order survive, whether the write is atomic]

</config_precedence>
```

---

## Pattern 4: Exit-Code Contract

Use whenever the spec adds a terminating path.

```markdown
<exit_codes>

## Exit-Code Contract

| Code | Constant     | Condition                                    | Message Stream |
| ---- | ------------ | -------------------------------------------- | -------------- |
| 0    | `[CONSTANT]` | [Success condition]                          | stdout         |
| 2    | `[CONSTANT]` | [Usage error condition]                      | stderr         |
| [N]  | `[CONSTANT]` | [Domain failure condition, N within 3–125]   | stderr         |
| 130  | `[CONSTANT]` | [Cancelled: Ctrl+C at a prompt, or declined] | stderr         |

**Signals:** [Re-raised after cleanup, so the caller sees the process killed by the signal | Exit with code N]
**New constants needed:** [None — all exist in the codebase's exit-code module | Name, value and meaning of each addition]
**Partial success:** [Whole run fails | Succeeds with a warning and code N]

</exit_codes>
```

---

## Pattern 5: Output Contract

Use when the spec adds a command or changes what one emits.

```markdown
<output_contract>

## Output Contract

**Stream split:** stdout = [what data]; stderr = [progress, warnings, diagnostics, prompts]

| Context         | Progress          | Colour / Symbols | Payload                    |
| --------------- | ----------------- | ---------------- | -------------------------- |
| TTY, default    | [spinner text]    | [Yes]            | [Human-readable summary]   |
| Piped (non-TTY) | [plain lines]     | [No ANSI]        | [Same payload, plain]      |
| `--json`        | [None]            | [None]           | [One JSON document]        |
| `--quiet`       | [None]            | [Suppressed]     | [Payload only]             |
| `--verbose`     | [Per-step detail] | [Yes on TTY]     | [Payload plus diagnostics] |

**`--json` success shape:** [Exact field names and types]
**`--json` error shape:** [The document emitted on failure — still valid JSON, still the only thing on stdout]
**Colour:** [Detection across TTY, `TERM=dumb`, `--no-color`, `NO_COLOR` and `FORCE_COLOR`, and which wins when two disagree]
**Quiet and verbose:** [What each suppresses or adds; how each combines with `--json`]
**Nothing-to-do output:** [Exact message when the command is a no-op, or explicit silence]
**Closed pipe:** [What happens when the reader exits early, and the exit code]

</output_contract>
```

---

## Pattern 6: Error Messages and Help Text

Use when the spec adds or changes user-facing text. All text verbatim.

```markdown
<messages>

## Error Messages and Help Text

**Errors (exact text, all to stderr):**

| Condition   | Message                                             | Remediation Line          | Exit |
| ----------- | --------------------------------------------------- | ------------------------- | ---- |
| [Condition] | `Error: [what failed and why, in user vocabulary].` | `[concrete next command]` | [N]  |

**Stack traces:** [Hidden by default; the flag or env var that reveals them]

**Warnings (stderr, non-fatal):**

| Condition   | Message  |
| ----------- | -------- |
| [Condition] | `[text]` |

**Help text:**

- **Summary line:** `[one line]`
- **Usage line:** `[usage string with argument arity]`
- **Examples:** [At least two real invocations, each with a one-line explanation]
- **Related commands:** [list | none]
- **Reachable as:** [`--help`, `-h`, `help <command>`]

**Unknown input:** [Suggestion behaviour on an unknown command or flag, and the matching rule]

</messages>
```

---

## Pattern 7: Signal Handling and Cancellation

Use for every command that runs longer than an instant, or writes anything.

```markdown
<signals_and_cleanup>

## Signal Handling and Cleanup

| Concern              | Requirement                                                |
| -------------------- | ---------------------------------------------------------- |
| SIGINT (Ctrl+C)      | [Message, responsiveness, exit code or re-raised signal]   |
| SIGTERM              | [Same as SIGINT, or the distinct behaviour]                |
| In-flight work       | [Finish current step / abandon / roll back]                |
| Partial writes       | [Which files, and how a re-run recovers]                   |
| Terminal restoration | [Cursor, raw mode, alternate screen, colour reset]         |
| Cleanup              | [Temp files, lock files, child processes, open handles]    |
| Second Ctrl+C        | [Forces immediate exit, or is ignored during cleanup]      |
| Prompt cancellation  | [Message and exit code — raw mode makes Ctrl+C a keypress] |

**Invariant:** [The cleanup guarantee, stated so a tester can assert it]

</signals_and_cleanup>
```

---

## Pattern 8: Cross-Platform Concerns

Use when the spec touches paths, files or terminal capabilities.

```markdown
<cross_platform>

## Cross-Platform Requirements

| Concern          | Requirement                                           |
| ---------------- | ----------------------------------------------------- |
| Path handling    | [Join rule; what user-supplied paths resolve against] |
| Home directory   | [Resolution API; per-platform config location]        |
| Case sensitivity | [Collision behaviour]                                 |
| Line endings     | [What is written; whether input endings survive]      |
| Shell quoting    | [Shells the help examples must be valid in]           |
| Executable bits  | [Files that must be executable, or none]              |
| Windows names    | [Long paths; reserved names in generated files]       |
| Unicode          | [Fallback glyphs and detection rule]                  |

**Explicitly out of scope:** [Platforms or concerns deliberately not handled]

</cross_platform>
```

---

## Worked example — deploy command

The CLI sections of one specification, using only the templates its feature touches. The goal, scope fence and wider success criteria around them belong to the spec's author; the criteria here are the CLI rows only.

````markdown
# Deploy Command

**Goal:** `app deploy [environment]` ships the current build to a named environment from a terminal or from CI, replacing the upload, migrate and activate scripts run by hand in order.

**Current State:**

- Command pattern: `src/commands/build.ts:1-64` — command declaration, flag parsing, `handleError` usage
- Prompt pattern: `src/prompts/select-environment.ts:22-58` — select prompt and its cancel handling
- Config resolver: `src/config/resolve.ts:12-70` — flag > env > project > user > default
- Exit codes: `src/lib/exit-codes.ts:1-20` — `SUCCESS`, `ERROR`, `USAGE`, `CONFIG`, `CANCELLED`

## Command Surface

### `app deploy [environment]`

**Summary:** Deploy the current build to an environment
**Aliases:** none
**Interactive:** Yes — prompts for a missing environment, and for confirmation, at a TTY

**Arguments:**

| Name        | Required | Type   | Default                          | Description        |
| ----------- | -------- | ------ | -------------------------------- | ------------------ |
| environment | no       | string | `defaultEnvironment` from config | Target environment |

**Flags:**

| Long        | Short | Type    | Default | Env Var       | Conflicts | Description                      |
| ----------- | ----- | ------- | ------- | ------------- | --------- | -------------------------------- |
| `--dry-run` | -n    | boolean | false   | —             | —         | Print the plan without deploying |
| `--yes`     | -y    | boolean | false   | `APP_YES`     | —         | Skip the confirmation prompt     |
| `--json`    | —     | boolean | false   | —             | `--quiet` | Emit one JSON document on stdout |
| `--timeout` | —     | number  | 300     | `APP_TIMEOUT` | —         | Per-phase timeout in seconds     |

**Global flags reused:** `--quiet`, `--verbose` and `--no-color`, declared once and shared as `build` shares them.
**Prefix matching:** rejected — `--dry` is an unknown-flag error.

**Validation:**

| Rule                               | Failure Behaviour                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| environment ∈ {dev, staging, prod} | Exit 2, stderr: `Error: unknown environment 'x'. Expected: dev, staging, prod.` |
| `--timeout` > 0                    | Exit 2, stderr: `Error: --timeout must be a positive number of seconds.`        |

**Backward Compatibility:** None needed — new command. The three underlying scripts stay callable.

## Interactive Flow

**Entry condition:** stdin is a TTY, and the environment or the confirmation is outstanding
**Prompts drawn on:** stderr, so `app deploy staging > summary.txt` still shows them
**Prompting off:** no separate switch — the positional argument and `--yes` answer every prompt
**Non-interactive path:** the positional `environment` or `defaultEnvironment` answers step 1, and `--yes` answers step 2. With no TTY, a missing environment exits 2 with `Error: no environment given and no TTY to prompt. Pass an environment or set defaultEnvironment.`, and a missing `--yes` exits 2 with `Error: no TTY to confirm the deploy. Pass --yes.`

### Step 1: Select environment

| Element       | Specification                                                       |
| ------------- | ------------------------------------------------------------------- |
| Reached when  | No environment from the argument or config                          |
| Prompt type   | select                                                              |
| Message       | `Deploy to which environment?`                                      |
| Initial value | `dev`                                                               |
| Options       | dev, staging, prod — declaration order, `prod` hinted `(protected)` |
| On cancel     | stderr `Cancelled.`, exit `CANCELLED` (130), nothing written        |
| Twin          | positional `environment`, or `defaultEnvironment`                   |

### Step 2: Confirm

| Element       | Specification                                                            |
| ------------- | ------------------------------------------------------------------------ |
| Reached when  | Every run without `--yes`                                                |
| Prompt type   | confirm                                                                  |
| Message       | `Deploy build {build} to {environment}? This replaces the live release.` |
| Initial value | No for `prod`, yes otherwise                                             |
| On decline    | stderr `Aborted.`, exit `CANCELLED` (130), nothing written               |
| Twin          | `--yes`                                                                  |

**Terminal constraints:** usable at 60 columns; the option hint column drops first. No redraw on resize.

**Resumability:** Nothing persisted. A re-run starts from step 1.

## Configuration Precedence

**Discovery:** `app.config.ts`, searched from the cwd upward to the repository root; the nearest match wins.

### Key: `defaultEnvironment`

| Precedence  | Source           | Identifier            |
| ----------- | ---------------- | --------------------- |
| 1 (highest) | Argument         | `environment`         |
| 2           | Env var          | `APP_ENVIRONMENT`     |
| 3           | Project config   | `defaultEnvironment`  |
| 4           | User config      | `defaultEnvironment`  |
| 5 (lowest)  | Built-in default | none — step 1 prompts |

**Type:** string, one of dev, staging, prod
**Merge semantics:** scalar — the highest layer that sets it wins
**Empty value:** an empty string is a usage error, not "unset"
**Validation:** on load; an invalid value exits 2 with the unknown-environment message

**Write-back:** none.

## Exit-Code Contract

| Code | Constant               | Condition                                                  | Stream |
| ---- | ---------------------- | ---------------------------------------------------------- | ------ |
| 0    | `EXIT_CODES.SUCCESS`   | Deployed, already live, or `--dry-run` plan valid          | stdout |
| 1    | `EXIT_CODES.ERROR`     | Migration failed                                           | stderr |
| 2    | `EXIT_CODES.USAGE`     | Unknown environment, bad flag, no TTY to prompt or confirm | stderr |
| 4    | `EXIT_CODES.CONFIG`    | No config found                                            | stderr |
| 5    | `EXIT_CODES.NETWORK`   | Upload or activate failed after retries                    | stderr |
| 130  | `EXIT_CODES.CANCELLED` | Ctrl+C at a prompt, or confirmation declined               | stderr |

**Signals:** SIGINT and SIGTERM during a phase are re-raised after cleanup, so the caller sees the process killed by the signal (status 130 or 143).

**New constants needed:** `NETWORK = 5` — no existing class covers a retried transport failure.

**Partial success:** the whole run fails. A failed phase halts the sequence, earlier phases are not rolled back, and the error names the last completed phase.

## Output Contract

**Stream split:** stdout = the deploy summary; stderr = phase progress, warnings, prompts.

| Context         | Progress                    | Colour  | Payload                          |
| --------------- | --------------------------- | ------- | -------------------------------- |
| TTY, default    | Spinner per phase           | Yes     | 4-line summary on stdout         |
| Piped (non-TTY) | One line per phase, stderr  | No ANSI | Same summary, plain              |
| `--json`        | None                        | None    | One JSON object on stdout        |
| `--quiet`       | None                        | None    | Summary only; errors still shown |
| `--verbose`     | Per-phase timings on stderr | On TTY  | Summary plus timings             |

**`--json` success shape:**

```json
{
  "environment": "prod",
  "build": "4f21ac",
  "phases": [{ "name": "upload", "durationMs": 8123, "status": "ok" }],
  "url": "https://prod.example.com"
}
```

**`--json` error shape:**

```json
{
  "error": {
    "code": "NETWORK",
    "message": "upload failed after 3 attempts",
    "lastCompletedPhase": null
  }
}
```

**Colour:** off when the stream is not a TTY, `TERM` is `dumb`, `--no-color` is passed, or `NO_COLOR` is non-empty; `FORCE_COLOR` turns it back on, and `--no-color` beats both.

**Nothing-to-do output:** `Already deployed: build {build} is live on {environment}.` on stdout — exit 0, no phases run.

**Closed pipe:** a reader that exits early does not stop the deploy; the summary write is dropped, and the exit code is the deploy's own.

## Error Messages

| Condition        | Message                                                  | Remediation                                        | Exit |
| ---------------- | -------------------------------------------------------- | -------------------------------------------------- | ---- |
| Unknown env      | `Error: unknown environment '{environment}'.`            | `Expected: dev, staging, prod.`                    | 2    |
| No config        | `Error: no app.config.ts found in . or its parents.`     | `Run 'app init' to create one.`                    | 4    |
| Upload failed    | `Error: upload failed after 3 attempts: {status}.`       | `Retry, or check status.example.com.`              | 5    |
| Migration failed | `Error: migrate failed: {the migration tool's message}.` | `Fix the migration, then re-run the same command.` | 1    |

**Help text:** summary `Deploy the current build to an environment`; usage `app deploy [environment] [options]`; examples `app deploy staging` and `app deploy prod --yes --json`; related commands `build`, `status`; reachable as `--help`, `-h` and `app help deploy`.

## Signal Handling

| Concern              | Requirement                                                         |
| -------------------- | ------------------------------------------------------------------- |
| SIGINT               | stderr `Cancelled.`, cleanup within 2 seconds, then re-raised (130) |
| SIGTERM              | Same path as SIGINT, re-raised after cleanup (143)                  |
| In-flight work       | Current phase is abandoned; no rollback                             |
| Partial writes       | Uploads go to `.staging/`, removed by cleanup and by the next run   |
| Terminal restoration | Cursor shown, colours reset                                         |
| Second Ctrl+C        | Skips cleanup and exits at once; `.staging/` waits for the next run |
| Prompt cancellation  | A keypress, not a signal: `Cancelled.`, exit `CANCELLED` (130)      |

**Invariant:** after a single SIGINT or a SIGTERM during upload, no `.staging/` prefix remains, and the caller sees the process killed by that signal.

## Success Criteria — CLI rows

| Criterion      | Check                                        | Expected                                                       |
| -------------- | -------------------------------------------- | -------------------------------------------------------------- |
| Happy path     | `app deploy staging --yes`                   | Summary on stdout, exit 0                                      |
| Unknown env    | `app deploy nowhere`                         | Unknown-environment message on stderr, exit 2                  |
| No TTY, no env | `app deploy < /dev/null`, nothing configured | No-environment message on stderr, exit 2                       |
| JSON mode      | `app deploy staging --yes --json`            | Valid JSON on stdout, no other stdout lines                    |
| Piped output   | `app deploy staging --yes \| cat`            | No ANSI escapes on stdout                                      |
| Cancellation   | Ctrl+C during upload                         | `Cancelled.` on stderr, killed by SIGINT (130), no `.staging/` |
| Termination    | SIGTERM during upload                        | Killed by SIGTERM (143), no `.staging/`                        |
| Exit constants | Every exit path in `src/commands/deploy.ts`  | Names an `EXIT_CODES` constant, never a literal                |
````
