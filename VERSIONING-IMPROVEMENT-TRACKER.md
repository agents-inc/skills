# Versioning Improvement Tracker

> **Created**: 2026-01-25
> **Updated**: 2026-01-25
> **Status**: UPDATED TO OFFICIAL FORMAT
> **Goal**: Follow official Claude Code plugin format with semver strings

---

## Current Approach (v2)

1. **Semver versioning** - versions are "1.0.0", "2.0.0", "3.0.0"...
2. **Hash-based change detection** - content hash determines if anything changed (stored internally)
3. **Automatic bump** - when hash changes, major version increments (1.0.0 -> 2.0.0)
4. **Single source of truth** - version lives in `plugin.json` as semver string
5. **Official format compliance** - matches official Claude Code plugin format
6. **Internal hash tracking** - content hash stored in `.content-hash` file, NOT in plugin.json

---

## Key Changes (2026-01-25 Update)

### Why the Change?

Official Claude Code plugins use semver strings like "1.0.0", NOT integers. We updated to follow the official format for marketplace compatibility.

### What Changed

| Component                             | Previous (Integer)                  | Current (Semver)                     |
| ------------------------------------- | ----------------------------------- | ------------------------------------ |
| `plugin.schema.json` version          | `type: "integer"`                   | `type: "string"` with semver pattern |
| `plugin.schema.json` content_hash     | Included                            | REMOVED                              |
| `plugin.schema.json` updated          | Included                            | REMOVED                              |
| `src/types.ts` PluginManifest.version | `number`                            | `string`                             |
| `src/types.ts` PluginManifest         | content_hash, updated fields        | REMOVED                              |
| `plugin-manifest.ts` DEFAULT_VERSION  | `1`                                 | `"1.0.0"`                            |
| `skill-plugin-compiler.ts`            | Outputs content_hash to plugin.json | Stores in `.content-hash` file       |
| `stack-plugin-compiler.ts`            | Outputs content_hash to plugin.json | Stores in `.content-hash` file       |

### Internal vs External

- **External (plugin.json)**: Only official fields - name, version (semver), description, author, etc.
- **Internal (.content-hash)**: Content hash for change detection between compiles

---

## Implementation Checklist (v2)

- [x] Update `src/schemas/plugin.schema.json` - change version to semver string, REMOVE content_hash and updated
- [x] Update `src/types.ts` - change PluginManifest.version to string, REMOVE content_hash/updated fields
- [x] Update `src/cli/lib/plugin-manifest.ts` - change DEFAULT_VERSION to "1.0.0", remove contentHash/updated options
- [x] Update `src/cli/lib/skill-plugin-compiler.ts` - output semver, store hash in .content-hash file
- [x] Update `src/cli/lib/stack-plugin-compiler.ts` - output semver, store hash in .content-hash file
- [x] Update tests for semver versioning
- [x] Run all tests and verify passing (352 tests pass)
- [x] Update this tracker

---

## Test Results (v2)

**Date**: 2026-01-25
**Total Tests**: 352
**Passing**: 352
**Failing**: 0

```
 352 pass
 0 fail
 1251 expect() calls
Ran 352 tests across 17 files. [6.58s]
```

### Key Test Changes (v2)

1. **plugin-validator.test.ts**
   - Updated to test semver version validation
   - Changed integer version tests to semver string tests
   - Added test for invalid semver format failure

2. **plugin-manifest.test.ts**
   - Updated default version expectation from 1 to "1.0.0"
   - Removed tests for content_hash and updated fields

3. **skill-plugin-compiler.test.ts**
   - Updated version expectations to semver strings ("1.0.0", "2.0.0")
   - Updated hash-based versioning test to expect semver output
   - Removed content_hash expectation from plugin.json

4. **stack-plugin-compiler.test.ts**
   - Updated manifest version expectations to semver strings
   - Removed content_hash and updated field expectations from plugin.json

---

## Historical Context

### v1 (Integer Versioning)

- Used integer versions: 1, 2, 3...
- Stored content_hash and updated in plugin.json
- Did not match official Claude Code plugin format

### v2 (Semver - Current)

- Uses semver strings: "1.0.0", "2.0.0"...
- content_hash stored internally in .content-hash file
- Matches official Claude Code plugin format

---

## Decisions Made

| Decision               | Rationale                                             |
| ---------------------- | ----------------------------------------------------- |
| Semver versioning      | Matches official Claude Code plugin format            |
| Bump major on change   | 1.0.0 -> 2.0.0 keeps versioning simple                |
| Internal hash tracking | Hash is implementation detail, not part of plugin API |
| .content-hash file     | Separate file keeps plugin.json clean for marketplace |

---

## Notes

- Content hash is still used internally to detect changes
- Only difference is it's no longer written to plugin.json
- Version bumping still works the same way, just outputs semver format
- This ensures compatibility with official Claude Code marketplace
