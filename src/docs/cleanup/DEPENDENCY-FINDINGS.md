# Dependency Analysis Findings

**Analyzed by:** Dependency Analyzer Agent
**Date:** 2026-01-23

---

## Summary

| Metric                | Value         |
| --------------------- | ------------- |
| Total dependencies    | 10 production |
| Total devDependencies | 6             |
| Unused dependencies   | 0             |
| Potentially removable | 0             |
| Estimated total size  | ~12.5 MB      |

---

## Production Dependencies

All production dependencies are actively used and required.

### @clack/prompts (528K)

- **Type:** dependency
- **Usage:** Interactive CLI prompts
- **Files using:** 14 files
- **Used in:** init, add, config, compile, switch, wizard
- **Safe to remove:** NO
- **Reason:** Core UX component for all interactive commands

### commander (232K)

- **Type:** dependency
- **Usage:** CLI framework, command routing
- **Files using:** 13 files (all commands)
- **Used in:** index.ts, all command files
- **Safe to remove:** NO
- **Reason:** Foundation of entire CLI

### ajv (2.5M)

- **Type:** dependency
- **Usage:** JSON Schema validation
- **Files using:** schema-validator.ts, plugin-validator.ts
- **Used in:** Manifest validation, skill/agent frontmatter validation
- **Safe to remove:** NO
- **Reason:** Required for thorough plugin validation

### ajv-formats (100K)

- **Type:** dependency
- **Usage:** Additional format validators for ajv
- **Files using:** schema-validator.ts
- **Used in:** URL, email, date-time validation
- **Safe to remove:** NO
- **Reason:** Paired with ajv for complete validation

### fast-glob (300K)

- **Type:** dependency
- **Usage:** File pattern matching
- **Files using:** 4 files
- **Used in:** skill discovery, file searching
- **Safe to remove:** NO
- **Alternative:** Native Node 18+ glob (but API differs)

### fs-extra (200K)

- **Type:** dependency
- **Usage:** Enhanced file system operations
- **Files using:** Wrapped in `src/cli/utils/fs.ts`
- **Used in:** All file operations via abstraction layer
- **Safe to remove:** NO
- **Alternative:** Could be replaced with fs/promises + custom utils (~30 lines)
- **Note:** Tests use native fs/promises directly

### giget (96K)

- **Type:** dependency
- **Usage:** Template downloading from GitHub/GitLab
- **Files using:** source-fetcher.ts
- **Used in:** Fetching skills from remote repositories
- **Safe to remove:** NO
- **Reason:** Core functionality for remote skill sources

### liquidjs (2.6M)

- **Type:** dependency
- **Usage:** Liquid template rendering
- **Files using:** compiler.ts, stack-plugin-compiler.ts
- **Used in:** Agent compilation, template rendering
- **Safe to remove:** NO
- **Note:** Heavy package but provides full Liquid template support

### picocolors (32K)

- **Type:** dependency
- **Usage:** Terminal colors
- **Files using:** 16 files
- **Used in:** Logger, all colored output
- **Safe to remove:** NO
- **Reason:** Smallest color library available

### yaml (1.4M)

- **Type:** dependency
- **Usage:** YAML parsing and stringifying
- **Files using:** 11 files
- **Used in:** Config loading, frontmatter extraction, stack configs
- **Safe to remove:** NO
- **Reason:** Core format for all configuration

---

## Dev Dependencies

### @types/fs-extra

- **Purpose:** TypeScript definitions for fs-extra
- **Status:** REQUIRED (paired with fs-extra)

### @types/node

- **Purpose:** Node.js type definitions
- **Status:** REQUIRED

### typescript

- **Purpose:** TypeScript compiler
- **Status:** REQUIRED

### vitest

- **Purpose:** Test framework
- **Files using:** 14 test files
- **Status:** REQUIRED

### @vitest/coverage-v8

- **Purpose:** Coverage reporting
- **Status:** REQUIRED for coverage

### Build/Lint Tools

- tsup, prettier, husky, lint-staged
- **Status:** REQUIRED for build pipeline

---

## Optimization Analysis

### Potential Replacements (NOT Recommended)

| Package   | Alternative        | Savings | Risk   | Recommendation            |
| --------- | ------------------ | ------- | ------ | ------------------------- |
| fs-extra  | Native fs/promises | 200K    | Medium | KEEP - stable abstraction |
| fast-glob | Native glob        | 300K    | Medium | KEEP - API compatibility  |

**Why not replace:**

1. **fs-extra:** The abstraction layer works well. Replacing would require writing ~30 lines of utility code and testing edge cases.
2. **fast-glob:** Native glob has different API. Would require refactoring multiple files.

### Heavy Dependencies Analysis

| Package  | Size | Usage Frequency | Justification                                                |
| -------- | ---- | --------------- | ------------------------------------------------------------ |
| liquidjs | 2.6M | 2 files         | Full Liquid template support needed for agent compilation    |
| yaml     | 1.4M | 11 files        | Core format, no lighter alternative with frontmatter support |
| ajv      | 2.5M | 2 files         | JSON Schema validation required for plugin ecosystem         |

**Note:** These heavy packages are justified by their feature requirements. There are no significantly lighter alternatives that provide the same functionality.

---

## Duplicate Functionality Check

No duplicate functionality found between packages:

| Function      | Single Provider   |
| ------------- | ----------------- |
| CLI framework | commander         |
| Prompts       | @clack/prompts    |
| Colors        | picocolors        |
| YAML          | yaml              |
| Validation    | ajv + ajv-formats |
| Templates     | liquidjs          |
| File ops      | fs-extra          |
| Glob          | fast-glob         |
| Git download  | giget             |

---

## File System Pattern Analysis

### Production Code

- Uses `fs-extra` via abstraction in `src/cli/utils/fs.ts`
- Consistent API throughout codebase

### Test Code

- Uses native `fs/promises` directly
- Pattern: `import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises"`
- Found in: config.test.ts, source-fetcher.test.ts, marketplace-generator.test.ts, etc.

**Note:** This is a minor inconsistency but not a problem. Tests use native APIs to avoid abstraction layer complications.

---

## Unused Import Check

No packages in package.json are completely unused. All imports verified:

```bash
# Verification commands run
grep -r "import.*@clack/prompts" src/cli  # Found
grep -r "import.*commander" src/cli       # Found
grep -r "import.*ajv" src/cli            # Found
grep -r "import.*fast-glob" src/cli      # Found (as 'glob')
grep -r "import.*fs-extra" src/cli       # Found
grep -r "import.*giget" src/cli          # Found
grep -r "import.*liquidjs" src/cli       # Found
grep -r "import.*picocolors" src/cli     # Found
grep -r "import.*yaml" src/cli           # Found
```

---

## Recommendations

### No Removals

All dependencies are actively integrated and serving specific functions.

### Monitoring

Consider monitoring these for lighter alternatives in future:

- **liquidjs:** If only basic templating needed, consider lighter options
- **ajv:** If validation requirements simplify, consider JSON Schema validators

### Version Updates

Regularly update all dependencies for security patches:

```bash
npm outdated
npm update
```

---

## Conclusion

The dependency tree is lean and well-justified. Every package serves a specific purpose with no redundancy or unused packages. The total production dependency footprint (~12.5 MB) is reasonable for a CLI tool with this feature set.
