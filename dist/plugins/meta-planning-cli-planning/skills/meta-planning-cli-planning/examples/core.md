# CLI Planning - Per-Artifact Spec Sections

> Section templates for CLI specifications, one per artifact class. Include a section only when the spec touches that artifact class — an unused section is omitted, never filled with placeholders. See [../SKILL.md](../SKILL.md) for the frameworks behind each.

---

## Command Surface section

Use when the spec adds or changes a command, argument, or flag.

```markdown
<command_surface>

## Command Surface

### `[command] [subcommand] <required-arg> [optional-arg]`

**Summary:** [One line, as it appears in help]
**Aliases:** [alias list | none]
**Interactive:** [Yes — prompts when values are missing at a TTY | No]

**Arguments:**

| Name   | Required | Type   | Default              | Description  |
| ------ | -------- | ------ | -------------------- | ------------ |
| [name] | [yes/no] | [type] | [value or "derived"] | [what it is] |

**Flags:**

| Long       | Short | Type      | Default | Env Var | Conflicts | Description    |
| ---------- | ----- | --------- | ------- | ------- | --------- | -------------- |
| `--[name]` | [-x]  | [boolean] | [false] | [VAR]   | [--other] | [what it does] |

**Validation:**

| Rule                         | Failure Behaviour                  |
| ---------------------------- | ---------------------------------- |
| [Accepted values for a flag] | [Exit code + exact stderr message] |

**Backward Compatibility:** [None needed — new command | Existing invocations that must keep working, and any deprecation warning text and removal release]

</command_surface>
```

---

## Interactive Flow section

Use when the spec adds or changes prompts or wizard steps.

```markdown
<interactive_flow>

## Interactive Flow

**Entry condition:** [When the flow runs — missing values plus a TTY, or always]
**Non-interactive path:** [Which flags supply every prompted value; what happens with no TTY and missing flags]

### Step [N]: [Name]

| Element       | Specification                                       |
| ------------- | --------------------------------------------------- |
| Prompt type   | [text / select / multi-select / confirm / path]     |
| Message       | `[exact string shown]`                              |
| Initial value | [default and where it comes from]                   |
| Options       | [option list and ordering rule, for selects]        |
| Validation    | [rule, when it fires, exact error text]             |
| Empty state   | [what renders when there is nothing to choose]      |
| Keybindings   | [any key beyond framework defaults, and its effect] |
| Revisitable   | [No, or yes and what is preserved on return]        |
| On cancel     | [message, exit code, what is left on disk]          |
| Flag twin     | `--[flag]`                                          |

**Terminal constraints:** [Minimum usable width; what degrades first; redraw-on-resize behaviour]

**Resumability:** [Nothing persisted | What is persisted, where, and what a re-run does with it]

</interactive_flow>
```

---

## Configuration Resolution section

Use when the spec adds or changes config keys. One table per key.

```markdown
<config_resolution>

## Configuration Resolution

**Discovery:** [Config filenames, search start, how far up the tree, tie-break when two match]

### Key: `[key.name]`

| Precedence  | Source               | Identifier   |
| ----------- | -------------------- | ------------ |
| 1 (highest) | Flag                 | `--[flag]`   |
| 2           | Environment variable | `[ENV_VAR]`  |
| 3           | Project config       | `[key.name]` |
| 4           | User config          | `[key.name]` |
| 5 (lowest)  | Built-in default     | `[value]`    |

**Type:** [type]
**Merge semantics:** [Scalar — first non-undefined wins | Array — replace or concatenate | Object — shallow or deep merge]
**Empty value:** [Treated as unset | Overrides lower layers]
**Validation:** [Rule, when it runs, exit code and message on failure]

**Write-back:** [None | Which file and layer is written, whether comments and key order are preserved, whether the write is atomic]

</config_resolution>
```

---

## Output Contract section

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

**`--json` success shape:** [exact field names and types]
**`--json` error shape:** [error object emitted on failure — must remain valid JSON]

**Nothing-to-do output:** [Exact message when the command is a no-op, or explicit silence]

</output_contract>
```

---

## Exit-Code Contract section

Use whenever the spec adds a terminating path.

```markdown
<exit_codes>

## Exit-Code Contract

| Code | Constant             | Condition                  | Message Stream |
| ---- | -------------------- | -------------------------- | -------------- |
| 0    | `EXIT_CODES.SUCCESS` | [Success condition]        | stdout         |
| 2    | `[CONSTANT]`         | [Usage error condition]    | stderr         |
| [N]  | `[CONSTANT]`         | [Domain failure condition] | stderr         |
| 130  | `[CONSTANT]`         | Terminated by SIGINT       | stderr         |

**New constants needed:** [None — all exist at /path/to/exit-codes.ts | Name, value, and meaning of each addition]

**Partial success:** [Whole run fails | Succeeds with warning and code N — state which]

</exit_codes>
```

---

## Error Messages and Help Text section

Use when the spec adds or changes user-facing text. All text verbatim.

```markdown
<messages>

## Error Messages and Help Text

**Errors (exact text, all to stderr):**

| Condition   | Message                                             | Remediation Line          | Exit |
| ----------- | --------------------------------------------------- | ------------------------- | ---- |
| [Condition] | `Error: [what failed and why, in user vocabulary].` | `[concrete next command]` | [N]  |

**Warnings (stderr, non-fatal):**

| Condition   | Message  |
| ----------- | -------- |
| [Condition] | `[text]` |

**Help text:**

- **Summary line:** `[one line]`
- **Usage line:** `[usage string with argument arity]`
- **Examples:** [At least two real invocations with a one-line explanation each]
- **Related commands:** [list | none]
- **Reachable as:** [`--help`, `-h`, `help <command>`]

**Unknown input:** [Suggestion behaviour on unknown command or flag, and the matching rule]

</messages>
```

---

## Signal Handling section

Use for every command that runs longer than an instant, or writes anything.

```markdown
<signals_and_cleanup>

## Signal Handling and Cleanup

| Concern              | Requirement                                             |
| -------------------- | ------------------------------------------------------- |
| SIGINT (Ctrl+C)      | [Message, exit code, responsiveness]                    |
| SIGTERM              | [Same as SIGINT, or the distinct behaviour]             |
| In-flight work       | [Finish current step / abandon / roll back]             |
| Partial writes       | [Which files, and how a re-run recovers]                |
| Terminal restoration | [Cursor, raw mode, alternate screen, colour reset]      |
| Cleanup              | [Temp files, lock files, child processes, open handles] |
| Second Ctrl+C        | [Forces immediate exit, or is ignored during cleanup]   |
| Prompt cancellation  | [Message and exit code]                                 |

</signals_and_cleanup>
```

---

## Cross-Platform section

Use when the spec touches paths, files, or terminal capabilities.

```markdown
<cross_platform>

## Cross-Platform Requirements

| Concern          | Requirement                                           |
| ---------------- | ----------------------------------------------------- |
| Path handling    | [Join rule; what user-supplied paths resolve against] |
| Home directory   | [Resolution API; per-platform config location]        |
| Case sensitivity | [Collision behaviour]                                 |
| Line endings     | [What is written; whether input endings survive]      |
| Executable bits  | [Files that must be executable, or none]              |
| Colour / Unicode | [Fallback glyphs and detection rule]                  |

**Explicitly out of scope:** [Platforms or concerns deliberately not handled]

</cross_platform>
```

---

## Worked example — deploy command

A complete specification using the sections above (only the ones the feature touches).

````markdown
# Deploy Command

## Goal

Add `app deploy` so an operator can ship the current build to a named environment from the terminal or from CI.

**User Story:** As a developer, I need one command that deploys to a chosen environment so that I stop hand-running four scripts in order.

## Context

**Problem:** Deploying means running `build`, `upload`, `migrate`, and `activate` by hand, in order, with matching flags. CI reimplements the sequence in YAML.
**Caller Impact:** Humans deploy from a TTY; the release pipeline calls the same command non-interactively.
**Priority:** High

**Current State:**

- Command pattern: `src/commands/build.ts:1-64` — command declaration, flag parsing, `handleError` usage
- Prompt pattern: `src/prompts/select-environment.ts:22-58` — select prompt with `isCancel` handling
- Config resolver: `src/config/resolve.ts:12-70` — flag > env > project > user > default
- Exit codes: `src/lib/exit-codes.ts:1-20` — `SUCCESS`, `ERROR`, `USAGE`, `CANCELLED`

**Desired State:** `app deploy [environment]` runs the four phases with progress on stderr, a JSON summary under `--json`, and a confirmation prompt that `--yes` skips.

## Command Surface

### `app deploy [environment]`

**Summary:** Deploy the current build to an environment
**Aliases:** none
**Interactive:** Yes — prompts for environment and confirmation when missing at a TTY

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

**Validation:**

| Rule                               | Failure Behaviour                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| environment ∈ {dev, staging, prod} | Exit 2, stderr: `Error: unknown environment 'x'. Expected: dev, staging, prod.` |
| `--timeout` > 0                    | Exit 2, stderr: `Error: --timeout must be a positive number of seconds.`        |

**Backward Compatibility:** None needed — new command. The four underlying scripts stay callable.

## Interactive Flow

**Entry condition:** stdin is a TTY and either the environment argument or confirmation is outstanding
**Non-interactive path:** `environment` positional or `defaultEnvironment` config supplies step 1; `--yes` supplies step 2. With no TTY and neither available: exit 2, stderr `Error: no environment given and no TTY to prompt. Pass an environment or set defaultEnvironment.`

### Step 1: Select environment

| Element       | Specification                                                       |
| ------------- | ------------------------------------------------------------------- |
| Prompt type   | select                                                              |
| Message       | `Deploy to which environment?`                                      |
| Initial value | `defaultEnvironment` from config, else `dev`                        |
| Options       | dev, staging, prod — declaration order, `prod` hinted `(protected)` |
| On cancel     | stderr `Cancelled.`, exit 130, nothing written                      |
| Flag twin     | positional `environment`                                            |

### Step 2: Confirm

| Element       | Specification                                                  |
| ------------- | -------------------------------------------------------------- |
| Prompt type   | confirm                                                        |
| Message       | `Deploy build 4f21ac to prod? This replaces the live release.` |
| Initial value | false for `prod`, true otherwise                               |
| On decline    | stderr `Aborted.`, exit 130, nothing written                   |
| Flag twin     | `--yes`                                                        |

**Terminal constraints:** usable at 60 columns; the option hint column drops first. No redraw on resize.

**Resumability:** Nothing persisted. A re-run starts from step 1.

## Configuration Resolution

**Discovery:** `app.config.ts` searched from CWD upward to the repository root; first match wins.

### Key: `defaultEnvironment`

| Precedence  | Source           | Identifier           |
| ----------- | ---------------- | -------------------- |
| 1 (highest) | Argument         | `environment`        |
| 2           | Env var          | `APP_ENVIRONMENT`    |
| 3           | Project config   | `defaultEnvironment` |
| 4           | User config      | `defaultEnvironment` |
| 5 (lowest)  | Built-in default | `dev`                |

**Type:** string
**Merge semantics:** scalar — first non-undefined wins
**Empty value:** empty string is a usage error, not "unset"
**Validation:** on load; invalid value exits 2 with the unknown-environment message

**Write-back:** none.

## Output Contract

**Stream split:** stdout = the deploy summary; stderr = phase progress, warnings, prompts.

| Context         | Progress                    | Colour  | Payload                   |
| --------------- | --------------------------- | ------- | ------------------------- |
| TTY, default    | Spinner per phase           | Yes     | 4-line summary on stdout  |
| Piped (non-TTY) | One line per phase, stderr  | No ANSI | Same summary, plain       |
| `--json`        | None                        | None    | One JSON object on stdout |
| `--quiet`       | None                        | None    | Summary only              |
| `--verbose`     | Per-phase timings on stderr | Yes     | Summary plus timings      |

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
{ "error": { "code": "NETWORK", "message": "upload failed after 3 attempts" } }
```

**Nothing-to-do output:** `Already deployed: build 4f21ac is live on prod.` — exit 0, no phases run.

## Exit-Code Contract

| Code | Constant               | Condition                                | Stream |
| ---- | ---------------------- | ---------------------------------------- | ------ |
| 0    | `EXIT_CODES.SUCCESS`   | Deploy completed, or `--dry-run` plan ok | stdout |
| 2    | `EXIT_CODES.USAGE`     | Unknown environment, bad flag, no TTY    | stderr |
| 4    | `EXIT_CODES.CONFIG`    | No config found                          | stderr |
| 5    | `EXIT_CODES.NETWORK`   | Upload or activate failed after retries  | stderr |
| 130  | `EXIT_CODES.CANCELLED` | Ctrl+C or declined confirmation          | stderr |

**New constants needed:** `NETWORK = 5` — no existing class covers a retried transport failure.

**Partial success:** whole run fails. A failed phase halts the sequence; earlier phases are not rolled back and the summary names the last completed phase.

## Error Messages

| Condition     | Message                                              | Remediation                           | Exit |
| ------------- | ---------------------------------------------------- | ------------------------------------- | ---- |
| Unknown env   | `Error: unknown environment 'x'.`                    | `Expected: dev, staging, prod.`       | 2    |
| No config     | `Error: no app.config.ts found in . or its parents.` | `Run 'app init' to create one.`       | 4    |
| Upload failed | `Error: upload failed after 3 attempts: 503.`        | `Retry, or check status.example.com.` | 5    |

**Help text:** summary `Deploy the current build to an environment`; usage `app deploy [environment] [options]`; examples `app deploy staging` and `app deploy prod --yes --json`; related commands `build`, `status`.

## Signal Handling

| Concern              | Requirement                                                          |
| -------------------- | -------------------------------------------------------------------- |
| SIGINT               | stderr `Cancelled.`, exit 130, returns within 2 seconds              |
| In-flight work       | Current phase is abandoned; no rollback                              |
| Partial writes       | Uploads go to a `.staging/` prefix; SIGINT removes it before exiting |
| Terminal restoration | Cursor shown, colours reset                                          |
| Second Ctrl+C        | Exits immediately without waiting for cleanup                        |

## Requirements

**Must Have:**

1. `app deploy [environment]` runs upload, migrate, activate in order
2. Confirmation prompt before `prod`, skippable with `--yes`
3. `--dry-run` prints the plan and exits 0 without writing
4. `--json` emits one valid document on stdout in both success and failure

**Must NOT Have:**

- Rollback — separate spec
- Environment creation — separate spec
- Deploy history or audit log — separate spec

## Success Criteria

**Functional:**

| Criterion      | Invocation                        | Expected                                         |
| -------------- | --------------------------------- | ------------------------------------------------ |
| Happy path     | `app deploy staging --yes`        | Summary on stdout, exit 0                        |
| Unknown env    | `app deploy nowhere`              | Unknown-environment message on stderr, exit 2    |
| No TTY, no arg | `app deploy < /dev/null`          | No-TTY usage message on stderr, exit 2           |
| JSON mode      | `app deploy staging --yes --json` | Valid JSON on stdout, no other stdout lines      |
| Piped output   | `app deploy staging --yes \| cat` | No ANSI escapes on stdout                        |
| Cancellation   | Ctrl+C during upload              | `Cancelled.` on stderr, exit 130, no `.staging/` |

**Technical:**

1. All tests pass (`npm test deploy`)
2. `tsc --noEmit` clean
3. Every `process.exit` uses an `EXIT_CODES` constant
4. Follows the command structure in `src/commands/build.ts`
5. No changes outside `src/commands/`, `src/lib/exit-codes.ts`
````
