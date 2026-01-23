# Dead Code Findings

**Analyzed by:** Dead Code Hunter Agent
**Date:** 2026-01-23

---

## Summary

| Metric                    | Value |
| ------------------------- | ----- |
| Total dead files          | 0     |
| Total dead functions      | 5     |
| Estimated lines removable | ~50   |
| Risk level                | LOW   |

---

## MEDIUM Severity

### source-fetcher.ts - Unused Utility Exports

**Location:** `/home/vince/dev/claude-subagents/src/cli/lib/source-fetcher.ts`

#### `copyFetchedContent()` (lines 192-209)

```typescript
export async function copyFetchedContent(
  fetchResult: FetchResult,
  destDir: string,
  subPath?: string,
): Promise<void>;
```

- **Lines:** 18
- **What:** Copies fetched content to a destination directory
- **Why removable:** Never imported by any production code. Only imported by `source-fetcher.test.ts`
- **Dependencies:** Test file imports it
- **Evidence:**
  ```bash
  grep -r "copyFetchedContent" src/cli --include="*.ts" | grep -v test
  # Returns only the function definition itself
  ```

#### `clearCache()` (lines 214-228)

```typescript
export async function clearCache(source?: string): Promise<void>;
```

- **Lines:** 14
- **What:** Clears cache for specific source or all sources
- **Why removable:** Never called in production. Only tested in `source-fetcher.test.ts`
- **Dependencies:** Test file imports it
- **Note:** giget handles caching internally per TODO.md decision

#### `getCacheInfo()` (lines 233-239)

```typescript
export async function getCacheInfo(
  source: string,
): Promise<{ exists: boolean; path: string }>;
```

- **Lines:** 7
- **What:** Returns cache existence and path for a source
- **Why removable:** Never called anywhere except tests
- **Dependencies:** Test file imports it

---

### source-loader.ts - Unused Helper Exports

**Location:** `/home/vince/dev/claude-subagents/src/cli/lib/source-loader.ts`

#### `getSkillsDir()` (lines 168-170)

```typescript
export function getSkillsDir(sourceResult: SourceLoadResult): string;
```

- **Lines:** 3
- **What:** Returns skills directory path for a loaded source
- **Why removable:** Exported but never imported anywhere
- **Dependencies:** None - completely unused

#### `resolveSkillPath()` (lines 175-182)

```typescript
export function resolveSkillPath(
  sourceResult: SourceLoadResult,
  skillRelativePath: string,
): string;
```

- **Lines:** 8
- **What:** Resolves a skill path relative to the source
- **Why removable:** Exported but never imported anywhere
- **Dependencies:** None - completely unused

---

## Files Cleared (NOT Dead Code)

The following files were investigated and confirmed to be actively used:

### skill-copier.ts - ACTIVE

- **Imports found in:** `add.ts`, `update.ts`, `init.ts`, `stack-creator.ts`
- **Functions used:** `copySkill()`, `copySkillsToStack()`, `copySkillFromSource()`, `copySkillsToStackFromSource()`

### stack-creator.ts - ACTIVE

- **Imports found in:** `add.ts`, `update.ts`, `init.ts`
- **Functions used:** `createStack()`, `createStackFromSource()`, `promptStackName()`, `displayStackSummary()`

### versioning.ts - ACTIVE

- **Imports found in:** `compile.ts`
- **Functions used:** `versionAllSkills()`, `printVersionResults()`
- **Usage:** When `--version-skills` flag is passed to compile command

### source-fetcher.ts - PARTIALLY ACTIVE

- **Active function:** `fetchFromSource()` - used by `source-loader.ts`
- **Dead functions:** `copyFetchedContent()`, `clearCache()`, `getCacheInfo()`

### source-loader.ts - PARTIALLY ACTIVE

- **Active function:** `loadSkillsMatrixFromSource()` - core workflow function
- **Dead functions:** `getSkillsDir()`, `resolveSkillPath()`

---

## Removal Plan

### Step 1: Remove Dead Functions

1. Remove from `source-fetcher.ts`:
   - Lines 189-239 (`copyFetchedContent`, `clearCache`, `getCacheInfo`)

2. Remove from `source-loader.ts`:
   - Lines 165-183 (`getSkillsDir`, `resolveSkillPath`)

### Step 2: Update Tests

1. Update `source-fetcher.test.ts`:
   - Remove tests for `clearCache` and `getCacheInfo`
   - Remove import of these functions

### Step 3: Verify

```bash
# Run all tests
bun test

# Verify no broken imports
bun tsc --noEmit
```

---

## Type Definitions

No unused type definitions found in `src/types.ts`. All interfaces and types are actively used.

---

## Unreachable Code

No unreachable code paths found. All conditionals have reachable branches.

---

## Conclusion

The codebase is remarkably clean. The only dead code consists of **5 secondary utility functions** that were designed for potential future extensibility but never integrated into actual CLI workflows. These can be safely removed with their corresponding tests.
