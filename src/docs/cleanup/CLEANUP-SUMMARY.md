# CLI Cleanup Analysis Summary

**Date:** 2026-01-23
**Scope:** Post-plugin architecture transition cleanup
**Status:** ✅ CLEANUP COMPLETED

---

## Cleanup Execution Status

| Phase                          | Status      | Notes                                                                                       |
| ------------------------------ | ----------- | ------------------------------------------------------------------------------------------- |
| Phase 1: Dead Code Removal     | ✅ COMPLETE | 5 functions removed from source-fetcher.ts and source-loader.ts                             |
| Phase 2: Documentation Cleanup | ✅ COMPLETE | Old `bunx compile -s` references updated, CLI-DATA-DRIVEN-ARCHITECTURE.md moved to research |
| Phase 3: Test Coverage         | ✅ COMPLETE | stack-plugin-compiler.test.ts created with 28 tests                                         |
| Phase 4: Verification          | ✅ COMPLETE | All 289 tests pass, build succeeds                                                          |

**Completion Date:** 2026-01-23

---

## Executive Summary

After comprehensive analysis by 5 specialized research agents, the codebase is **remarkably clean**. The plugin architecture transition was well-executed with minimal dead code. Key findings:

| Category            | Items Found | Severity     |
| ------------------- | ----------- | ------------ |
| Dead Code           | 5 functions | MEDIUM       |
| Obsolete Commands   | 0           | N/A          |
| Unused Dependencies | 0           | N/A          |
| Missing Tests       | 10 files    | CRITICAL-LOW |
| Stale Documentation | 5 documents | HIGH-LOW     |

**Estimated Removable Lines:** ~80 lines of dead code
**Recommended Actions:** 15 items across all categories

---

## 1. Dead Code Findings

### Summary

- **Total dead functions:** 5
- **Estimated lines removable:** ~80
- **Risk level:** LOW (all are secondary utility exports, not core functionality)

### Dead Functions

| Function               | File                        | Lines | Severity |
| ---------------------- | --------------------------- | ----- | -------- |
| `copyFetchedContent()` | `source-fetcher.ts:192-209` | 18    | MEDIUM   |
| `clearCache()`         | `source-fetcher.ts:214-228` | 14    | MEDIUM   |
| `getCacheInfo()`       | `source-fetcher.ts:233-239` | 7     | MEDIUM   |
| `getSkillsDir()`       | `source-loader.ts:168-170`  | 3     | MEDIUM   |
| `resolveSkillPath()`   | `source-loader.ts:175-182`  | 8     | MEDIUM   |

**Why Removable:** These are convenience exports that were likely intended for future extensibility but are never imported by production code. They only appear in test files.

**Removal Risk:** LOW - Only tests import these functions. Remove tests alongside functions.

### Files Previously Flagged (Now Cleared)

The following files were investigated and confirmed **NOT dead code**:

- `skill-copier.ts` - Used by `add.ts`, `update.ts`, `init.ts`, `stack-creator.ts`
- `stack-creator.ts` - Used by `add.ts`, `update.ts`, `init.ts`
- `versioning.ts` - Used by `compile.ts` with `--version-skills` flag
- `source-fetcher.ts` - Core function `fetchFromSource()` is actively used
- `source-loader.ts` - Core function `loadSkillsMatrixFromSource()` is actively used

---

## 2. CLI Command Audit

### Summary

- **Total commands:** 12
- **Commands to remove:** 0
- **Commands to consolidate:** 0
- **Commands to update:** 1 (validate - documentation only)

### All Commands Status: KEEP

| Command                | Purpose                   | Status | Notes               |
| ---------------------- | ------------------------- | ------ | ------------------- |
| `init`                 | Initialize project        | KEEP   | Primary entry point |
| `add`                  | Add additional stacks     | KEEP   | Multi-stack support |
| `update`               | Update existing stack     | KEEP   | Stack evolution     |
| `compile`              | Compile active stack      | KEEP   | Core workflow       |
| `compile-plugins`      | Compile skill plugins     | KEEP   | Plugin distribution |
| `compile-stack`        | Compile stack to plugin   | KEEP   | Plugin distribution |
| `generate-marketplace` | Generate marketplace.json | KEEP   | Plugin marketplace  |
| `validate`             | Validate schemas/plugins  | KEEP   | Quality assurance   |
| `version`              | Manage plugin versions    | KEEP   | Version management  |
| `switch`               | Switch active stack       | KEEP   | Stack selection     |
| `list`                 | List available stacks     | KEEP   | Stack discovery     |
| `config`               | Manage configuration      | KEEP   | Settings management |

**Architecture Assessment:** No command overlaps or redundancies found. Clear separation of concerns between classic workflow (`init`, `add`, `update`, `compile`) and plugin workflow (`compile-plugins`, `compile-stack`, `generate-marketplace`).

---

## 3. Dependency Analysis

### Summary

- **Total dependencies:** 10 production + 6 dev
- **Unused dependencies:** 0
- **Potentially replaceable:** 2 (not recommended)

### All Dependencies: ACTIVE

| Package          | Size | Usage Count        | Status   |
| ---------------- | ---- | ------------------ | -------- |
| `@clack/prompts` | 528K | 14 files           | REQUIRED |
| `commander`      | 232K | 13 files           | REQUIRED |
| `ajv`            | 2.5M | Schema validation  | REQUIRED |
| `ajv-formats`    | 100K | Schema formats     | REQUIRED |
| `fast-glob`      | 300K | 4 files            | REQUIRED |
| `fs-extra`       | 200K | Wrapped in fs.ts   | REQUIRED |
| `giget`          | 96K  | source-fetcher.ts  | REQUIRED |
| `liquidjs`       | 2.6M | Template rendering | REQUIRED |
| `picocolors`     | 32K  | 16 files           | REQUIRED |
| `yaml`           | 1.4M | 11 files           | REQUIRED |

### Optimization Opportunities (Not Recommended)

| Package     | Alternative            | Savings | Risk               |
| ----------- | ---------------------- | ------- | ------------------ |
| `fs-extra`  | Native fs/promises     | 200K    | Refactoring effort |
| `fast-glob` | Native glob (Node 18+) | 300K    | API differences    |

**Recommendation:** No changes. All dependencies serve specific purposes and replacement would introduce risk without significant benefit.

---

## 4. Test Coverage Audit

### Summary

- **Total source files:** 34
- **Files with tests:** 10 (29%)
- **Files without tests:** 24 (71%)
- **Orphaned tests:** 0

### Critical Gaps

| File                           | Severity     | Notes                        |
| ------------------------------ | ------------ | ---------------------------- |
| ~~`stack-plugin-compiler.ts`~~ | ~~CRITICAL~~ | ✅ RESOLVED - 28 tests added |

### High Priority Gaps

| File                       | Severity | Notes                                    |
| -------------------------- | -------- | ---------------------------------------- |
| `compiler.ts`              | HIGH     | Core orchestration, no tests             |
| `schema-validator.ts`      | HIGH     | Used by plugin-validator                 |
| `skill-plugin-compiler.ts` | HIGH     | Missing `compileAllSkillPlugins()` tests |

### Medium Priority Gaps (6 files)

- `matrix-loader.ts`
- `stack-creator.ts`
- `stack-config.ts`
- `output-validator.ts`
- `validator.ts`
- `wizard.ts`

### Well-Tested Plugin Code

| File                            | Status    | Lines | Test Cases |
| ------------------------------- | --------- | ----- | ---------- |
| `plugin-validator.test.ts`      | EXCELLENT | 656   | 41         |
| `plugin-manifest.test.ts`       | EXCELLENT | 345   | 38         |
| `marketplace-generator.test.ts` | GOOD      | 474   | 26         |
| `skill-plugin-compiler.test.ts` | PARTIAL   | 376   | 28         |
| `stack-plugin-compiler.test.ts` | NEW       | 1,109 | 28         |

---

## 5. Documentation Audit

### Summary

- **Documents analyzed:** 60+
- **Stale/inaccurate:** 5
- **Documented but unimplemented features:** 4 commands

### Documented But NOT Implemented

| Command           | Documented In                               | Status              |
| ----------------- | ------------------------------------------- | ------------------- |
| `cc eject`        | CLI-DATA-DRIVEN-ARCHITECTURE.md             | "Not Started"       |
| `cc create skill` | cli/CLI-AGENT-INVOCATION-RESEARCH.md        | "Not Started"       |
| `cc create agent` | cli/CLI-AGENT-INVOCATION-RESEARCH.md        | "Not Started"       |
| `cc doctor`       | TODO.md                                     | "Not Started"       |
| `cc migrate`      | plugins/PLUGIN-DISTRIBUTION-ARCHITECTURE.md | "to be implemented" |

### Stale Documentation

| File                              | Issue                                  | Severity |
| --------------------------------- | -------------------------------------- | -------- |
| `CLI-DATA-DRIVEN-ARCHITECTURE.md` | Contains unimplemented eject design    | HIGH     |
| `INDEX.md:35`                     | References old `bunx compile -s`       | MEDIUM   |
| `CLAUDE_ARCHITECTURE_BIBLE.md`    | Multiple old command references        | MEDIUM   |
| `TODO.md:140`                     | Decision log contradiction about eject | MEDIUM   |
| `TODO.md:185-186`                 | Old compile workflow references        | LOW      |

### Accurate Documentation (No Changes Needed)

- plugins/CLI-REFERENCE.md
- plugins/PLUGIN-DEVELOPMENT.md
- plugins/PLUGIN-DISTRIBUTION-ARCHITECTURE.md (Phases 0-6)
- README.md

---

## Recommended Cleanup Actions

### Priority 1: CRITICAL (Before Release)

1. ~~**Add tests for `stack-plugin-compiler.ts`**~~ ✅ DONE
   - Added 1,109 lines of test code (28 tests)
   - Impact: Production CLI command now fully tested

2. **Complete `skill-plugin-compiler.ts` tests** (REMAINING)
   - Add `compileAllSkillPlugins()` tests
   - Estimate: 75 lines

### Priority 2: HIGH ✅ COMPLETED

3. ~~**Remove 5 dead utility functions**~~ ✅ DONE
   - Removed from `source-fetcher.ts` and `source-loader.ts`
   - Updated corresponding tests

4. ~~**Move CLI-DATA-DRIVEN-ARCHITECTURE.md to research folder**~~ ✅ DONE
   - Moved to `.claude/research/findings/v2/`

5. ~~**Update INDEX.md and CLAUDE_ARCHITECTURE_BIBLE.md**~~ ✅ DONE
   - Updated all `bunx compile -s` references to `cc switch` + `cc compile`
   - Also updated TODO.md and prompt for photoroom.md

6. **Add tests for `compiler.ts` and `schema-validator.ts`**
   - Estimate: 200 lines

### Priority 3: MEDIUM

7. **Fix TODO.md decision log contradiction**
   - Clarify `cc eject` is decided but not implemented

8. **Add tests for remaining untested files**
   - matrix-loader, stack-creator, stack-config, output-validator, validator, wizard
   - Estimate: 400 lines total

9. **Reorganize test directory structure**
   - Move all tests to `__tests__/` subdirectory for consistency

### Priority 4: LOW

10. **Add documentation status markers**
    - Mark research/future docs clearly
    - Add implementation status to testing sections

---

## Risk Assessment

### Safe Removals (No Breaking Changes)

| Item               | Risk | Reason                      |
| ------------------ | ---- | --------------------------- |
| 5 dead functions   | NONE | Only test code imports them |
| Old doc references | NONE | Documentation-only changes  |

### Caution Required

| Item                                 | Risk | Reason                  |
| ------------------------------------ | ---- | ----------------------- |
| CLI-DATA-DRIVEN-ARCHITECTURE.md move | LOW  | May break doc links     |
| Test reorganization                  | LOW  | May need import updates |

### No Removals Recommended

| Item                 | Why Not Remove              |
| -------------------- | --------------------------- |
| Any CLI command      | All serve distinct purposes |
| Any npm dependency   | All actively used           |
| Any core source file | All imported somewhere      |

---

## Metrics Summary

```
Total Lines Removed:       ~130 (dead code + tests for dead code)
Test Lines Added:          ~1,109 (stack-plugin-compiler.test.ts)
Doc Updates Made:          5 documents
Commands Analyzed:         12 (0 removable)
Dependencies Analyzed:     16 (0 removable)
Source Files Analyzed:     34
Test Files:                15 (was 14, added stack-plugin-compiler.test.ts)
Total Tests:               289 (all passing)
```

---

## Conclusion

The plugin distribution architecture transition was executed cleanly. The codebase has:

1. **Minimal dead code** - Only 5 secondary utility functions unused
2. **No obsolete commands** - All 12 commands serve distinct purposes
3. **No unused dependencies** - All packages actively integrated
4. **Strong new code coverage** - Plugin system well-tested (except stack compiler)
5. **Some documentation drift** - Old workflow references and future-work docs mixed with current

**Recommended Approach:**

1. Address test coverage gaps (especially `stack-plugin-compiler.ts`)
2. Remove small amount of dead utility code
3. Update documentation to reflect current state
4. Consider documentation reorganization to separate research from current docs

The architecture is solid and requires maintenance cleanup rather than major refactoring.
