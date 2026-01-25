# Versioning Improvement Tracker

> **Created**: 2026-01-25
> **Status**: Research Complete - Ready for Implementation
> **Goal**: Refactor versioning to use `plugin.json` instead of `metadata.yaml`

---

## Proposed Approach

1. **Integer versioning** (not semver) - versions are just 1, 2, 3, 4...
2. **Hash-based change detection** - content hash determines if anything changed
3. **Automatic bump** - when hash changes, version increments by 1
4. **Single source of truth** - version lives in `plugin.json`, not `metadata.yaml`
5. **No backwards compatibility** - clean break from old system

---

## Research Findings

### Agent 1: Existing Code Analysis

- [x] Complete

**Summary:** YES - The proposed approach can proceed. The existing `versioning.ts` already has nearly all the functionality needed. The main change required is redirecting output from `metadata.yaml` to `plugin.json`.

**Key Discovery:** `versioning.ts` is currently UNUSED - no usages of `versionSkill` or `versionAllSkills` in any command files. This means no breaking change risk.

**Files to Modify:**

- `src/cli/lib/versioning.ts` - redirect output from metadata.yaml to plugin.json
- `src/cli/lib/skill-plugin-compiler.ts` - integrate versioning into compile workflow
- `src/cli/lib/stack-plugin-compiler.ts` - integrate versioning into compile workflow

---

### Agent 2: Plugin Schema Verification

- [x] Complete

**Summary:** The current plugin schema does NOT fully support the proposed versioning approach. Changes needed:

| Component                     | Current                              | Required Change                                 |
| ----------------------------- | ------------------------------------ | ----------------------------------------------- |
| `plugin.schema.json` version  | `type: "string"` with semver pattern | `type: "integer"`, remove pattern               |
| `plugin.schema.json`          | No content_hash                      | Add `content_hash` field (string, 7-char hex)   |
| `plugin.schema.json`          | No updated field                     | Add `updated` field (date format)               |
| `src/types.ts` PluginManifest | `version?: string`                   | `version?: number`                              |
| `plugin-manifest.ts`          | DEFAULT_VERSION = "1.0.0"            | DEFAULT_VERSION = 1                             |
| `skill-plugin-compiler.ts`    | Calls normalizeVersion()             | Remove normalizeVersion(), use integer directly |

---

### Agent 3: Test Coverage Analysis

- [x] Complete

**Test Files to Update:**

| Test File                       | What to Change                                 |
| ------------------------------- | ---------------------------------------------- |
| `versioning.test.ts`            | Add tests for new plugin.json-based versioning |
| `plugin-validator.test.ts`      | Change from semver to integer validation       |
| `skill-plugin-compiler.test.ts` | Update version normalization to use integers   |
| `plugin-manifest.test.ts`       | Update default from "1.0.0" to 1 (integer)     |

**New Tests Required:**

- `hashSkillFolder()` - hash skill directory content
- `versionSkill()` - hash-based version bumping
- `versionAllSkills()` - batch versioning
- Integration test for auto-bump on content change

**Effort Estimate:** ~33-35 tests to add/modify

---

## Implementation Checklist

- [ ] Update `src/schemas/plugin.schema.json` - change version to integer, add content_hash
- [ ] Update `src/types.ts` - change PluginManifest.version to number
- [ ] Update `src/cli/lib/plugin-manifest.ts` - change DEFAULT_VERSION to 1
- [ ] Update `src/cli/lib/skill-plugin-compiler.ts` - remove normalizeVersion(), integrate versioning
- [ ] Update `src/cli/lib/stack-plugin-compiler.ts` - integrate versioning
- [ ] Refactor `src/cli/lib/versioning.ts` - output to plugin.json instead of metadata.yaml
- [ ] Update tests for new versioning behavior
- [ ] Run all tests and verify passing
- [ ] Update `src/docs/TODO.md` to mark tasks complete
- [ ] Update documentation to describe new versioning system

---

## Decisions Made

| Decision                          | Rationale                                                         |
| --------------------------------- | ----------------------------------------------------------------- |
| Integer versioning                | Semver is overkill for markdown skills - no API contract to break |
| Hash-based detection              | Only bump when content actually changes                           |
| No backwards compatibility        | Clean break simplifies implementation                             |
| Store content_hash in plugin.json | Enables hash comparison on future compiles                        |

---

## Test Results

_Pending implementation_

---

## Notes

- The existing `versioning.ts` already has working hash logic (`hashSkillFolder()`) that can be reused
- The `metadata.schema.json` already supports integer version and content_hash (can use as reference)
- Main work is moving the version/hash fields from metadata.yaml output to plugin.json output
