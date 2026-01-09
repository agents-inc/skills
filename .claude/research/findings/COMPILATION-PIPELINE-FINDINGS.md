# Compilation Pipeline Analysis (Agent #7)

**File analyzed:** `src/compile.ts` (579 lines)

## Overall Assessment

The compilation pipeline is **well-structured and functional** but has several areas for improvement in error handling, performance, and developer experience.

## Strengths

1. **Clear organization** - Code is divided into logical sections with `// ===` separators (Configuration, Utilities, Resolution, Validation, Compilation, Main)
2. **TypeScript types** - Clean separation in `types.ts` with well-documented interfaces
3. **Comprehensive validation** - The `validate()` function (lines 168-265) checks:
   - Required files (intro.md, workflow.md)
   - Optional files with warnings
   - Skill path existence
   - Core prompt file existence
   - Dynamic skill usage properties
4. **Good error context** - Errors include agent/skill names and file paths
5. **Verbose mode** - `--verbose` flag for debugging (line 40)

## Critical Issues (Bugs)

### Issue 7.1: Directory existence check is broken (line 437)

```typescript
const dirExists = await Bun.file(`${commandsDir}`).exists()
```

`Bun.file().exists()` does not work correctly for directories - it only works for files. This causes the commands directory check to fail silently.

**Fix:** Use filesystem stat or try scanning directly:

```typescript
try {
  const glob = new Bun.Glob('*.md')
  const files = await Array.fromAsync(glob.scan({ cwd: commandsDir }))
  // ... proceed with files
} catch {
  console.log('  - No commands directory found, skipping...')
  return
}
```

### Issue 7.2: Incomplete path sanitization (line 399)

```typescript
const id = skill.id.replace('/', '-')
```

Only replaces the first `/`. Skills with multiple slashes (e.g., `frontend/react/hooks`) would produce `frontend-react/hooks`.

**Fix:** Use global replacement:

```typescript
const id = skill.id.replace(/\//g, '-')
```

### Issue 7.3: Fragile CLAUDE.md output path (line 424)

```typescript
await Bun.write(`${OUT}/../CLAUDE.md`, content)
```

Assumes `OUT` is always exactly one level deep. Should use absolute path resolution.

## Missing Error Handling

### Issue 7.4: Template rendering has no try/catch (line 363)

```typescript
return engine.renderFile('agent', data)
```

A LiquidJS syntax error or missing template would crash compilation with an unhelpful stack trace.

**Fix:** Wrap in try/catch with context:

```typescript
try {
  return engine.renderFile('agent', data)
} catch (error) {
  throw new Error(`Template rendering failed for agent "${name}": ${error.message}`)
}
```

### Issue 7.5: YAML parsing errors lack detail (lines 487-494)

When YAML parsing fails, the error doesn't indicate which line failed or what was expected.

**Fix:** Use yaml library's error details or add schema validation.

## Performance Improvements

### Issue 7.6: Sequential async operations (multiple locations)

All file reading is sequential when it could be parallelized:

| Function                | Lines   | Current               | Could be        |
| ----------------------- | ------- | --------------------- | --------------- |
| `readCorePrompts`       | 271-278 | Sequential `for` loop | `Promise.all()` |
| `readSkillsWithContent` | 280-291 | Sequential `for` loop | `Promise.all()` |
| `compileAllAgents`      | 366-382 | Sequential `for` loop | `Promise.all()` |
| `compileAllSkills`      | 388-414 | Sequential `for` loop | `Promise.all()` |

**Estimated improvement:** 3-5x faster for profiles with many agents/skills.

**Example fix for readCorePrompts:**

```typescript
async function readCorePrompts(promptNames: string[]): Promise<string> {
  const contents = await Promise.all(promptNames.map(name => readFile(`${ROOT}/core-prompts/${name}.md`)))
  return contents.join('\n\n---\n\n')
}
```

## Missing CLI Features

### Issue 7.7: Missing useful CLI flags

| Flag              | Purpose                                      | Priority |
| ----------------- | -------------------------------------------- | -------- |
| `--dry-run`       | Preview output without writing files         | High     |
| `--validate-only` | Run validation without compilation           | High     |
| `--agent=NAME`    | Compile single agent only (faster iteration) | Medium   |
| `--list-profiles` | Show available profiles                      | Medium   |
| `--list-agents`   | Show agents for current profile              | Medium   |
| `--help`          | Show usage information                       | Medium   |
| `--quiet`         | Suppress non-error output                    | Low      |
| `--timing`        | Show compilation performance stats           | Low      |
| `--no-clean`      | Don't clear output directory first           | Low      |

## Validation Gaps

### Issue 7.8: No schema validation for YAML files

YAML files are parsed and cast directly to TypeScript interfaces without runtime validation. Typos in keys (e.g., `title` vs `tittle`) silently result in `undefined` values.

**Fix:** Add Zod or similar runtime validation:

```typescript
import { z } from 'zod'

const AgentDefinitionSchema = z.object({
  title: z.string(),
  description: z.string(),
  model: z.enum(['opus', 'sonnet', 'haiku']).optional(),
  tools: z.array(z.string()),
  output_format: z.string(),
})
```

### Issue 7.9: No validation of model or tool values

- `model` accepts any string, should validate against known values ("opus", "sonnet", "haiku")
- `tools` accepts any strings, should validate against valid Claude tools (Read, Write, Edit, Grep, Glob, Bash, etc.)

## Code Quality Issues

### Issue 7.10: Magic strings scattered throughout

Required file names are hardcoded in multiple places:

- Lines 196-201: `["intro.md", "workflow.md"]`
- Lines 204-208: `["examples.md", "critical-requirements.md", "critical-reminders.md"]`
- Lines 302-315: Same files read again

**Fix:** Extract to constants:

```typescript
const REQUIRED_AGENT_FILES = ['intro.md', 'workflow.md'] as const
const OPTIONAL_AGENT_FILES = ['examples.md', 'critical-requirements.md', 'critical-reminders.md'] as const
```

### Issue 7.11: Hardcoded fallback content (lines 306-307)

```typescript
const examples = await readFileOptional(`${agentDir}/examples.md`, '## Examples\n\n_No examples defined._')
```

Default content should be configurable or moved to template.

## Developer Experience Issues

### Issue 7.12: Emojis in output may not render

Lines 481, 536, 560, etc. use emojis that may not display correctly in all terminals.

### Issue 7.13: No summary statistics

After compilation, would be helpful to show:

- Total agents compiled
- Total skills compiled
- Compilation time
- Output directory size

## Recommendations Summary

| Priority | Issue                       | Effort | Impact                    |
| -------- | --------------------------- | ------ | ------------------------- |
| Critical | 7.1 Directory check bug     | Low    | Prevents silent failures  |
| Critical | 7.4 Template error handling | Low    | Better error messages     |
| High     | 7.2 Path sanitization       | Low    | Prevents malformed output |
| High     | 7.6 Parallel async          | Medium | 3-5x faster compilation   |
| High     | 7.7 --dry-run flag          | Medium | Better CI/CD support      |
| High     | 7.8 Schema validation       | Medium | Catches config typos      |
| Medium   | 7.7 Other CLI flags         | Medium | Better DX                 |
| Medium   | 7.10 Magic strings          | Low    | Better maintainability    |
| Low      | 7.12 Emoji handling         | Low    | Better terminal compat    |
| Low      | 7.13 Summary stats          | Low    | Better feedback           |

## Files Analyzed

| File                                 | Purpose          | Lines |
| ------------------------------------ | ---------------- | ----- |
| `src/compile.ts`             | Main compiler    | 579   |
| `src/types.ts`               | TypeScript types | 155   |
| `src/templates/agent.liquid` | Agent template   | 95    |
| `package.json`                       | NPM scripts      | 28    |

## Critical Findings for Summary

Add to "Summary of Improvements" section:

### Critical (Must Fix)

- [ ] **7.1 Directory check bug** - `Bun.file().exists()` doesn't work for directories; commands compilation may silently fail
- [ ] **7.4 Template error handling missing** - LiquidJS errors crash with unhelpful stack traces

### High Priority

- [ ] **7.2 Path sanitization incomplete** - Only replaces first `/` in skill IDs; malformed output possible
- [ ] **7.6 Sequential compilation** - All file reads/compilations are sequential; 3-5x slower than necessary
- [ ] **7.7 Missing --dry-run flag** - Cannot preview compilation output for CI/CD validation
- [ ] **7.8 No schema validation** - YAML typos silently produce undefined values

### Medium Priority

- [ ] **7.10 Magic strings** - File names hardcoded in multiple places; DRY violation
- [ ] **7.11 Hardcoded fallback content** - Default messages should be in template
