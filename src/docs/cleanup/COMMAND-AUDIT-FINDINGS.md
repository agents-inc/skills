# CLI Command Audit Findings

**Analyzed by:** Command Auditor Agent
**Date:** 2026-01-23

---

## Summary

| Metric                  | Value         |
| ----------------------- | ------------- |
| Total commands          | 12            |
| Commands to remove      | 0             |
| Commands to consolidate | 0             |
| Commands to update      | 1 (docs only) |

---

## Command Analysis

### Core Workflow Commands (CRITICAL)

#### `init`

- **File:** `src/cli/commands/init.ts`
- **Purpose:** Initialize Claude Collective in a project
- **Status:** KEEP
- **Severity:** CRITICAL
- **Reasoning:** Primary entry point; supports both classic and plugin modes
- **Dependencies:** Wizard, skill matrix loader, stack creator
- **Migration:** None needed; forward-compatible

#### `add`

- **File:** `src/cli/commands/add.ts`
- **Purpose:** Add additional stacks after initialization
- **Status:** KEEP
- **Severity:** CRITICAL
- **Reasoning:** Enables multi-stack projects; complements init
- **Dependencies:** Same as init
- **Migration:** None needed

#### `update`

- **File:** `src/cli/commands/update.ts`
- **Purpose:** Modify skill selection in existing stack
- **Status:** KEEP
- **Severity:** CRITICAL
- **Reasoning:** Allows evolution of stacks without re-initialization
- **Dependencies:** Stack config reader/writer, skill copier
- **Migration:** None needed

#### `compile`

- **File:** `src/cli/commands/compile.ts`
- **Purpose:** Generate `.claude/` output from active stack
- **Status:** KEEP
- **Severity:** CRITICAL
- **Reasoning:** Central compilation pipeline; used daily by end users
- **Dependencies:** Agent compiler, skill compiler, resolver
- **Migration:** None needed

---

### Plugin Distribution Commands (HIGH)

#### `compile-plugins`

- **File:** `src/cli/commands/compile-plugins.ts`
- **Purpose:** Convert all skills to standalone Claude Code plugins
- **Status:** KEEP
- **Severity:** HIGH
- **Reasoning:** Enables individual skill versioning and distribution
- **Dependencies:** Skill plugin compiler
- **Migration:** New command; no conflicts

#### `compile-stack`

- **File:** `src/cli/commands/compile-stack.ts`
- **Purpose:** Convert stack configuration to installable plugin
- **Status:** KEEP
- **Severity:** HIGH
- **Reasoning:** Enables pre-built stack distribution
- **Dependencies:** Stack plugin compiler
- **Migration:** New command; complements compile

#### `generate-marketplace`

- **File:** `src/cli/commands/generate-marketplace.ts`
- **Purpose:** Create marketplace definition from compiled plugins
- **Status:** KEEP
- **Severity:** MEDIUM
- **Reasoning:** Required for plugin distribution
- **Dependencies:** Marketplace generator
- **Migration:** New command; specific to plugin distribution

---

### Validation & Version Commands (MEDIUM)

#### `validate`

- **File:** `src/cli/commands/validate.ts`
- **Purpose:** Verify YAML schemas OR plugin structure
- **Status:** KEEP (UPDATE docs)
- **Severity:** HIGH
- **Reasoning:** Quality assurance; catches config errors early
- **Dependencies:** Schema validator, plugin validator
- **Issue:** Dual-mode behavior could be clearer in documentation
- **Modes:**
  - `cc validate` = Schema validation
  - `cc validate ./path` = Plugin validation
  - `cc validate --plugins` = Plugin validation

#### `version`

- **File:** `src/cli/commands/version.ts`
- **Purpose:** Bump semantic version in plugin.json
- **Status:** KEEP
- **Severity:** MEDIUM
- **Reasoning:** Required for plugin distribution workflow
- **Dependencies:** Plugin manifest reader/writer
- **Migration:** New command; no conflicts

---

### Stack Management Commands (HIGH)

#### `switch`

- **File:** `src/cli/commands/switch.ts`
- **Purpose:** Change active stack for compilation
- **Status:** KEEP
- **Severity:** CRITICAL
- **Reasoning:** Multi-stack support requires active stack tracking
- **Dependencies:** Active stack reader/writer
- **Migration:** None needed

#### `list`

- **File:** `src/cli/commands/list.ts`
- **Purpose:** Display available stacks with skill counts
- **Status:** KEEP (ENHANCE possible)
- **Severity:** HIGH
- **Reasoning:** Essential for discovery; complements switch
- **Dependencies:** Active stack lister
- **Enhancement:** Could add `--verbose` for more details

---

### Configuration Command (HIGH)

#### `config`

- **File:** `src/cli/commands/config.ts`
- **Purpose:** Configure skills source, author, settings
- **Status:** KEEP
- **Severity:** HIGH
- **Reasoning:** Enables multi-source support, auth configuration
- **Subcommands:**
  - `show` - Display effective config
  - `set <key> <value>` - Set global config
  - `get <key>` - Get resolved value
  - `unset <key>` - Remove global config
  - `set-project <key> <value>` - Set project config
  - `unset-project <key>` - Remove project config
  - `path` - Show config file paths

---

## Redundancy Analysis

### No Overlaps Found

| Command A         | Command B         | Overlap? | Reasoning                                              |
| ----------------- | ----------------- | -------- | ------------------------------------------------------ |
| `init`            | `add`             | No       | Init creates first stack; add creates additional       |
| `add`             | `update`          | No       | Add creates new; update modifies existing              |
| `compile`         | `compile-plugins` | No       | Different outputs (agents in .claude vs skill plugins) |
| `compile`         | `compile-stack`   | No       | Different purposes (active stack vs specific stack)    |
| `compile-plugins` | `compile-stack`   | No       | Plugins are skills; stacks are agents + skills         |
| `switch`          | `list`            | No       | List shows options; switch changes selection           |

---

## Registration Status

All 12 commands properly registered in `src/cli/index.ts`:

```typescript
program.addCommand(initCommand);
program.addCommand(addCommand);
program.addCommand(updateCommand);
program.addCommand(compileCommand);
program.addCommand(compilePluginsCommand);
program.addCommand(compileStackCommand);
program.addCommand(generateMarketplaceCommand);
program.addCommand(validateCommand);
program.addCommand(switchCommand);
program.addCommand(listCommand);
program.addCommand(configCommand);
program.addCommand(versionCommand);
```

---

## Not Implemented Commands (Per TODO.md)

These commands are documented in research/design docs but NOT implemented:

| Command           | Status      | Source                                      |
| ----------------- | ----------- | ------------------------------------------- |
| `cc eject`        | Not Started | CLI-DATA-DRIVEN-ARCHITECTURE.md             |
| `cc create skill` | Not Started | cli/CLI-AGENT-INVOCATION-RESEARCH.md        |
| `cc create agent` | Not Started | cli/CLI-AGENT-INVOCATION-RESEARCH.md        |
| `cc doctor`       | Not Started | TODO.md                                     |
| `cc migrate`      | Not Started | plugins/PLUGIN-DISTRIBUTION-ARCHITECTURE.md |

**Recommendation:** These should NOT be added to the codebase until explicitly planned. Keep them in research docs.

---

## Recommendations

### No Changes Needed

All 12 implemented commands serve distinct purposes with clear separation of concerns.

### Documentation Update

1. **validate command:** Clarify dual-mode behavior in plugins/CLI-REFERENCE.md
   - Add examples for both schema and plugin validation modes

### Potential Enhancements (Future)

1. **list command:** Add `--verbose` flag for additional stack details
   - Source repository
   - Last modified date
   - Stack version
   - Skill list

---

## Conclusion

The CLI command architecture is clean and well-organized. No commands should be removed or consolidated. The separation between classic workflow (`init`, `add`, `update`, `compile`) and plugin workflow (`compile-plugins`, `compile-stack`, `generate-marketplace`) is clear and intentional.
