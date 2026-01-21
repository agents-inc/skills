# Versioning Proposals

## Approach Comparison

| Approach | Complexity | Author Friction | Change Tracking | Automatable |
|----------|------------|-----------------|-----------------|-------------|
| npm/semver | Medium | High | Excellent | Partial |
| Simple incrementing | Low | Low | Poor | Yes |
| Date-based | Low | Low | Moderate | Yes |
| Content-hash | Low | None | Poor (diff needed) | Yes |
| Git-tag based | Medium | None | Excellent | Yes |

---

### 1. npm/semver (Major.Minor.Patch)

**How it works:** Authors bump version based on change type (breaking/feature/fix).

**Pros:**
- Industry standard, universally understood
- Communicates intent ("1.x to 2.x = breaking")
- Enables version ranges in dependencies

**Cons:**
- Requires author judgment on every change
- Skills are single-file markdown - "breaking change" is ambiguous
- Overkill for content that rarely has API contracts

**Verdict:** Too much friction for markdown-based skills with no programmatic API.

---

### 2. Simple Incrementing (v1, v2, v3)

**How it works:** Bump number on any change.

**Pros:**
- Zero cognitive load
- Easy to implement

**Cons:**
- "v47 vs v48" tells you nothing about change magnitude
- No semantic meaning
- Still requires manual bump

**Verdict:** Simple but not useful. If we're going to require manual action, semver is better.

---

### 3. Date-based (2025.01.20)

**How it works:** Version = modification date.

**Pros:**
- Zero author effort (auto-generated)
- "When was this updated?" answered instantly
- Natural sorting

**Cons:**
- Two changes same day = same version
- Doesn't indicate change magnitude

**Verdict:** Good for freshness indication, poor for change tracking.

---

### 4. Content-hash Based (SHA of content)

**How it works:** Hash the skill file(s) to generate version.

**Pros:**
- Completely automatic
- Perfect deduplication
- Enables caching and integrity verification
- Same content = same hash (deterministic)

**Cons:**
- `abc123` vs `def456` tells you nothing about what changed
- Requires storing hash-to-content mapping for comparison
- Long hashes are unwieldy (can truncate to 7 chars like git)

**Verdict:** Excellent for automation and integrity, requires companion tooling for "what changed?"

---

### 5. Git-tag Based (derived from commits)

**How it works:** Use git history to derive version (tags, commit count, or hash).

**Pros:**
- Zero author effort
- Full change history via `git log`
- Can auto-generate changelogs
- Works with existing git workflows

**Cons:**
- Requires git (not all distribution methods use git)
- Version tied to repo, not content
- Complexity if skills distributed outside git

**Verdict:** Best for git-native workflows, problematic for standalone distribution.

---

## Recommendation: Hybrid Approach

For a Claude Code skill/stack system, use **content-hash as primary identifier** with **date as human-readable metadata**.

### Proposed Schema

```yaml
---
name: frontend/state-zustand (@vince)
description: Zustand stores, client state patterns
# Auto-generated, never manually edited:
content_hash: a1b2c3d  # truncated SHA-256 of SKILL.md content
updated: 2025-01-20    # file modification date
---
```

### Why This Works

1. **Zero author friction:** Both fields auto-generated on save/compile
2. **Caching:** Hash enables "skip if unchanged" logic
3. **Freshness:** Date answers "is this recent?"
4. **Diffing:** Compare hashes to detect changes, then diff content for details
5. **No false promises:** We don't pretend skills have "breaking changes"

### Implementation

```bash
# Generate hash (truncate to 7 chars like git)
sha256sum SKILL.md | cut -c1-7

# Get modification date
date -r SKILL.md +%Y-%m-%d
```

### Migration Path

1. Add `content_hash` and `updated` to schema (optional initially)
2. Compiler auto-populates on build
3. CLI displays hash + date in listings
4. Future: diff tool shows changes between hashes

---

## Decision

**Use content-hash + date hybrid.** It optimizes for author experience (zero manual versioning) while enabling the technical features we need (caching, change detection, freshness). Semantic versioning adds friction without benefit for markdown-based skills.

---

## Changelog Patterns

Research on lightweight changelog patterns for skills and stacks. The user preference is: **"every change just bumps the version and every change will get a small description of what the reason was"**.

---

### Pattern 1: Inline Changelog (Frontmatter)

**Storage location:** Inside the skill file itself, in YAML frontmatter

**Update mechanism:** Manual - author adds entry when making changes

**Format example:**

```yaml
---
name: frontend/react (@vince)
version: 1.3.0
description: Component architecture, hooks, patterns
changelog:
  - version: 1.3.0
    date: 2026-01-20
    reason: Add React 19 useActionState examples
  - version: 1.2.0
    date: 2026-01-15
    reason: Update ref handling for React 19 (forwardRef deprecated)
  - version: 1.1.0
    date: 2026-01-10
    reason: Add lucide-react icon patterns
  - version: 1.0.0
    date: 2026-01-01
    reason: Initial skill creation
---

# React Components
...
```

**Pros:**
- Single file contains all context - no need to look elsewhere
- Version and changelog co-located with the content being versioned
- Easy to parse programmatically from YAML
- Minimal friction for authors (edit one file)
- Works well with user preference (version bump + reason)

**Cons:**
- Frontmatter grows over time (mitigated by keeping only recent N entries)
- Mixes metadata with content
- May need periodic pruning of old entries

**Recommendation:** Best fit for user preference. Keep last 5-10 entries inline, archive older to separate file if needed.

---

### Pattern 2: Separate CHANGELOG.md (Per-Skill)

**Storage location:** `CHANGELOG.md` file alongside `SKILL.md` in the skill directory

**Update mechanism:** Manual - author updates changelog file when making changes

**Format example:**

```
skills/
  frontend-react (@vince)/
    SKILL.md
    CHANGELOG.md
    reference.md
    examples/
```

CHANGELOG.md contents:
```markdown
# Changelog - frontend/react

## [1.3.0] - 2026-01-20
- Add React 19 useActionState examples

## [1.2.0] - 2026-01-15
- Update ref handling for React 19 (forwardRef deprecated)

## [1.1.0] - 2026-01-10
- Add lucide-react icon patterns

## [1.0.0] - 2026-01-01
- Initial skill creation
```

**Pros:**
- Follows industry convention (Keep a Changelog format)
- Unlimited history without bloating the main file
- Familiar to developers
- Works with standard tooling

**Cons:**
- Extra file to maintain per skill
- Authors must remember to update it (easy to forget)
- Requires switching between files when editing
- More overhead for simple skills

**Recommendation:** Overkill for individual skills. Better suited for entire stack packages.

---

### Pattern 3: Git-Derived Changelog

**Storage location:** Generated from git history, optionally cached in `.changelog-cache/`

**Update mechanism:** Automatic - derived from commits touching the skill file

**Format example (generated output):**

```markdown
# Changelog - frontend/react (auto-generated from git)

## Recent Changes

- **2026-01-20** (e0c012a): feat(skills/react): add React 19 useActionState examples
- **2026-01-15** (a806fc4): docs(skills/react): update ref handling for React 19
- **2026-01-10** (c581acb): docs(skills/react): add lucide-react icon patterns
```

**Generation command:**
```bash
git log --oneline --follow -- ".claude/skills/frontend-react*/SKILL.md" | head -10
```

**Pros:**
- Zero manual effort - always up to date
- Accurate history from source of truth (git)
- No extra files to maintain
- Works with existing workflows

**Cons:**
- Requires consistent commit messages (garbage in, garbage out)
- Commit messages often technical, not user-friendly descriptions
- Multiple commits per logical change create noise
- Not portable (requires git history)
- Harder to curate what's meaningful vs trivial

**Recommendation:** Good for auditing, but commit messages rarely match the user preference of "small description of what the reason was."

---

### Pattern 4: AI-Generated Changelog

**Storage location:** Generated on-demand or cached in `.changelog-cache/skill-name.md`

**Update mechanism:** Automatic - Claude summarizes diffs when changes detected

**Format example (prompt + output):**

Prompt (on pre-commit hook or CI):
```
Summarize the following diff for the skill changelog.
Write ONE sentence explaining why this change was made (not what changed).
Format: "- [version]: [reason]"

<diff>
[git diff output]
</diff>
```

Output:
```markdown
- 1.3.0: Add form submission patterns using React 19's new useActionState hook
- 1.2.0: Update component examples to use ref as a regular prop following React 19 deprecation of forwardRef
```

**Pros:**
- Generates human-readable "reason" descriptions (matches user preference)
- Can distill multiple commits into single logical entry
- Consistent quality and format
- No manual writing required

**Cons:**
- Requires AI API call (cost, latency)
- May misinterpret intent without context
- Needs review before commit (human in loop)
- Complex setup (hooks, API keys, etc.)

**Recommendation:** Interesting but over-engineered for this use case. Better as a one-time migration tool than ongoing workflow.

---

### Pattern 5: Conventional Commits (Auto-Categorization)

**Storage location:** Extracted from git history using conventional commit format

**Update mechanism:** Automatic - parses commit messages following convention

**Commit message format:**
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types relevant to skills:**
- `feat(skills/react)`: New pattern added
- `fix(skills/react)`: Corrected error or anti-pattern
- `docs(skills/react)`: Improved documentation/examples
- `refactor(skills/react)`: Restructured without changing behavior
- `deprecate(skills/react)`: Marked pattern as deprecated

**Generated changelog:**

```markdown
# Changelog - frontend/react

## [1.3.0] - 2026-01-20

### Features
- Add React 19 useActionState examples

## [1.2.0] - 2026-01-15

### Documentation
- Update ref handling for React 19

## [1.1.0] - 2026-01-10

### Features
- Add lucide-react icon patterns
```

**Pros:**
- Industry standard with tooling support (conventional-changelog, release-it)
- Automatic categorization (features vs fixes vs docs)
- Enforced via commitlint
- Works with semantic versioning

**Cons:**
- Requires discipline from all contributors
- Commit messages are still technical, not "reason" focused
- Tools generate verbose changelogs (too much detail)
- Scope must match skill naming exactly

**Recommendation:** Good for automated releases, but generates too much detail. User wants simple "version + reason", not categorized lists.

---

## Changelog Patterns: Recommendation

Based on user preference ("every change bumps version + small reason description"), the **Inline Changelog** pattern is the best fit, with modifications to align with the existing content-hash + date hybrid recommendation above.

### Proposed Format (Merging Both Recommendations)

```yaml
---
name: frontend/react (@vince)
description: Component architecture, hooks, patterns
# Auto-generated:
content_hash: a1b2c3d
updated: 2026-01-20
# Author-maintained:
history:
  - v: 1.3.0
    why: Add React 19 useActionState form patterns
  - v: 1.2.0
    why: Update ref handling (forwardRef deprecated in React 19)
  - v: 1.1.0
    why: Add lucide-react icon examples
---
```

### Key Design Decisions

1. **`history` not `changelog`** - Shorter, skill-focused term
2. **`v` and `why`** - Minimal keys matching user language
3. **Keep last 5 entries** - Prevent bloat, archive rarely needed
4. **Dates handled by `updated` field** - No need to repeat in history entries
5. **Reason-first** - Write "why" not "what" (matches user preference)
6. **Hybrid approach** - Auto-generated hash/date + manual history

### Workflow

1. Author edits skill content
2. Author adds entry to `history` with `v` (version) and `why` (reason)
3. Commit with conventional message for git audit trail
4. Compiler auto-updates `content_hash` and `updated` fields on build

### Validation (Optional)

```typescript
const MAX_HISTORY_ENTRIES = 5;

function validateSkillHistory(skill: Skill): void {
  if (skill.history?.length > MAX_HISTORY_ENTRIES) {
    console.warn(`Skill ${skill.name} has ${skill.history.length} history entries, consider archiving`);
  }
}
```

---

## Changelog Comparison Matrix

| Pattern | Storage | Update | Matches User Pref | Complexity |
|---------|---------|--------|-------------------|------------|
| Inline (Frontmatter) | In skill file | Manual | Yes | Low |
| Separate CHANGELOG.md | Adjacent file | Manual | Partial | Medium |
| Git-Derived | Generated | Auto | No | Low |
| AI-Generated | Cache file | Auto | Yes | High |
| Conventional Commits | Generated | Auto | Partial | Medium |
| **Hybrid Inline (Recommended)** | In skill file | Manual | Yes | Low |

---

## Implementation Priority

1. **Phase 1:** Add `history` field to existing skill frontmatter schema (alongside existing content_hash/updated)
2. **Phase 2:** Document expected format in skill authoring guide
3. **Phase 3:** (Optional) Build CLI command to add history entry interactively
4. **Phase 4:** (Optional) Add git hook to remind authors when skill files change without history entry

---

## Recommended Approach

*Final synthesis by consolidation agent*

### Summary of Choices

| Aspect | Choice | Justification |
|--------|--------|---------------|
| Versioning Scheme | Content-hash + date | Zero friction, deterministic, enables caching |
| Auto-Versioning | Compile-time generation | No hooks, no CLI commands, idempotent |
| Changelog Pattern | Inline history (frontmatter) | Single file, matches "version + reason" preference |

---

### 1. Versioning Scheme: Content-Hash + Date

**Selected:** Truncated SHA-256 hash (7 characters) + ISO date

**Rationale:**
- Zero author friction: both fields auto-computed at compile time
- Hash provides deterministic change detection for caching and diffing
- Date provides human-readable "freshness" at a glance
- No semantic versioning overhead - markdown skills have no API contract
- Git-like familiarity (7-char hash matches git short SHA pattern)
- Aligns with user constraint: no required CLI commands to bump versions

---

### 2. Auto-Versioning Mechanism: Compile-Time Generation

**Selected:** Compiler generates `content_hash` and `updated` on every build

**Rationale:**
- Authors never touch version fields - they edit content and commit
- No commit hooks that block or slow down commits (user constraint)
- No required CLI commands (user constraint)
- Deterministic: same content always produces same hash
- Idempotent: rebuilding unchanged content yields identical output
- Simple > complex (user constraint)

---

### 3. Changelog Pattern: Inline History (Frontmatter)

**Selected:** `history` array in YAML frontmatter with `v` (version) and `why` (reason)

**Rationale:**
- Single file contains all context (no switching between files)
- Minimal keys: `v` and `why` match user language
- Matches user preference: "every change bumps version and gets a small description"
- Low complexity (user constraint: simple > complex)
- Keep last 5 entries to prevent bloat

---

### 4. Complete Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│ AUTHOR ACTIONS (manual)                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Author edits SKILL.md content                               │
│                                                                 │
│  2. Author adds history entry (optional but encouraged):        │
│     history:                                                    │
│       - v: 1.3.0                                                │
│         why: Add React 19 useActionState patterns               │
│                                                                 │
│  3. Author commits normally: git commit -m "update react skill" │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ BUILD/CI ACTIONS (automatic)                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  4. CI runs: bun run compile                                    │
│                                                                 │
│  5. Compiler processes each SKILL.md:                           │
│     ├─ Read file content                                        │
│     ├─ Compute SHA-256, truncate to 7 chars → content_hash      │
│     ├─ Read file mtime → updated (YYYY-MM-DD)                   │
│     └─ Write to compiled manifest                               │
│                                                                 │
│  6. Compiled output pushed/deployed                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ CONSUMER ACTIONS (downstream)                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  7. Consumer compares content_hash:                             │
│     ├─ Same hash → skip (cached version is current)             │
│     └─ Different hash → fetch, optionally diff for details      │
│                                                                 │
│  8. Consumer reads history for change context                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key constraint satisfaction:**
- Zero friction for authors: edit content, optionally add history, commit
- No commit hooks that block commits
- No required CLI commands to bump versions
- Simple > complex: single file, minimal fields, compile-time automation

---

### 5. Implementation Steps (Ordered)

1. **Update schema** (`src/schemas/skills-matrix.schema.json`)
   - Add `content_hash`: string, 7 characters, optional (auto-generated)
   - Add `updated`: string, ISO date, optional (auto-generated)
   - Add `history`: array of `{v: string, why: string}`, optional (author-maintained)

2. **Create hash utility** (`src/cli/lib/hash-content.ts`)
   ```typescript
   import { createHash } from 'crypto';

   export function hashContent(content: string): string {
     return createHash('sha256').update(content).digest('hex').slice(0, 7);
   }
   ```

3. **Update compiler** (existing compile command)
   - For each skill file:
     - Read content, compute hash via `hashContent()`
     - Get file mtime, format as `YYYY-MM-DD`
     - Inject `content_hash` and `updated` into compiled output
   - Preserve author-provided `history` array unchanged

4. **Update CLI display** (skill listing commands)
   - Show: `skill-name (hash:a1b2c3d, updated:2026-01-20)`
   - Optionally show latest history entry: `why: Add React 19 patterns`

5. **Document the system** (one paragraph in README or authoring guide)
   - "content_hash and updated are auto-generated at compile time. Never edit these manually."
   - "To document changes, add entries to the history array with v (version) and why (reason)."

6. **Optional: Add reminder hook** (non-blocking)
   - Post-commit hook that prints reminder if skill files changed without history entry
   - Must not block commits (user constraint)

---

### Final Schema Example

```yaml
---
name: frontend/react (@vince)
description: Component architecture, hooks, patterns
# Auto-generated by compiler (never edit manually):
content_hash: a1b2c3d
updated: 2026-01-20
# Author-maintained (optional):
history:
  - v: 1.3.0
    why: Add React 19 useActionState form patterns
  - v: 1.2.0
    why: Update ref handling (forwardRef deprecated)
  - v: 1.1.0
    why: Add lucide-react icon examples
---

# React Components

[skill content...]
```

---

### Constraints Checklist

- [x] Zero-friction for authors (edit content, commit - that's it)
- [x] No commit hooks that block commits (only optional non-blocking reminder)
- [x] No required CLI commands to bump versions (compiler handles it)
- [x] Simple > complex (single file, minimal fields, compile-time automation)

---

## Integration Points

> Analysis of WHERE versioning would integrate with the current codebase structure.

Based on analysis of the current codebase (SKILL.md frontmatter, skills-matrix.yaml, schema, types.ts, compiler.ts), here are the specific integration points:

### 1. Skill Frontmatter Integration

**Current SKILL.md frontmatter structure (from actual files in `src/skills/`):**

```yaml
---
name: frontend/react (@vince)
description: Component architecture, hooks, patterns
---
```

**Target state (combining hash-based with optional history):**

```yaml
---
name: frontend/react (@vince)
description: Component architecture, hooks, patterns
content_hash: a1b2c3d  # Auto-generated: truncated SHA-256
updated: 2025-01-20    # Auto-generated: file modification date
history:               # Author-maintained changelog
  - v: 1.0.0
    why: Initial skill creation
---
```

**Location:** Each `src/skills/**/SKILL.md` file (78+ files currently)

**Files to modify:**
- All SKILL.md files in `src/skills/` (add `content_hash`, `updated`, optionally `history`)
- Note: `content_hash` and `updated` will be injected by compiler, not manually added

---

### 2. Type System Changes

**File:** `/home/vince/dev/claude-subagents/src/types.ts`

**Current SkillFrontmatter interface (lines 246-254):**

```typescript
export interface SkillFrontmatter {
  name: string
  description: string
  model?: string
}
```

**Updated interface:**

```typescript
// New type for history entries
export interface SkillHistoryEntry {
  v: string    // Version label (e.g., "1.0.0" or just increment)
  why: string  // Reason for change
}

// Updated SkillFrontmatter interface
export interface SkillFrontmatter {
  name: string
  description: string
  model?: string
  content_hash?: string             // Auto-generated: 7-char SHA-256
  updated?: string                  // Auto-generated: YYYY-MM-DD
  history?: SkillHistoryEntry[]     // Author-maintained: change log
}
```

**Current SkillMetadataConfig interface (lines 260-268) - no changes needed:**

```typescript
export interface SkillMetadataConfig {
  category?: string
  category_exclusive?: boolean
  author?: string
  version?: string  // Keep for legacy compatibility
  tags?: string[]
  requires?: string[]
  compatible_with?: string[]
  conflicts_with?: string[]
}
```

---

### 3. Stack Definitions Integration

**File:** `/home/vince/dev/claude-subagents/src/config/skills-matrix.yaml`

**Current structure (lines 580-624):**

```yaml
suggested_stacks:
  - id: modern-react
    name: Modern React Stack
    description: Fast, modern React for startups and MVPs with SCSS Modules
    audience: [startups, mvp, personal]
    skills:
      frontend:
        framework: react
        meta-framework: nextjs-app-router
        styling: scss-modules
    philosophy: 'Ship fast, iterate faster'
```

**Proposed addition (stack version for tracking):**

```yaml
suggested_stacks:
  - id: modern-react
    name: Modern React Stack
    version: 1.0.0        # NEW: Stack's own version
    description: Fast, modern React for startups and MVPs with SCSS Modules
    audience: [startups, mvp, personal]
    skills:
      frontend:
        framework: react
        meta-framework: nextjs-app-router
        styling: scss-modules
    philosophy: 'Ship fast, iterate faster'
```

**Note:** Per the earlier decision, stacks reference skills by name (not version). The lockfile captures exact content_hash at compile time for reproducibility.

---

### 4. Schema Changes

**File:** `/home/vince/dev/claude-subagents/src/schemas/skills-matrix.schema.json`

**Add to SuggestedStack definition (after line 254):**

```json
"version": {
  "type": "string",
  "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+(-[a-z0-9.-]+)?$",
  "description": "Semantic version of the stack itself"
}
```

**New schema file needed:** `/home/vince/dev/claude-subagents/src/schemas/skill-frontmatter.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Skill Frontmatter",
  "type": "object",
  "required": ["name", "description"],
  "properties": {
    "name": {
      "type": "string",
      "description": "Skill identifier (e.g., 'frontend/react (@vince)')"
    },
    "description": {
      "type": "string",
      "description": "Brief description of what this skill teaches"
    },
    "model": {
      "type": "string",
      "description": "Optional AI model to use for this skill"
    },
    "content_hash": {
      "type": "string",
      "pattern": "^[a-f0-9]{7}$",
      "description": "Auto-generated: truncated SHA-256 of SKILL.md content"
    },
    "updated": {
      "type": "string",
      "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
      "description": "Auto-generated: file modification date (YYYY-MM-DD)"
    },
    "history": {
      "type": "array",
      "description": "Author-maintained changelog entries",
      "items": {
        "type": "object",
        "required": ["v", "why"],
        "properties": {
          "v": { "type": "string", "description": "Version label" },
          "why": { "type": "string", "description": "Reason for change" }
        }
      },
      "maxItems": 5
    }
  }
}
```

**New schema file needed:** `/home/vince/dev/claude-subagents/src/schemas/stack.lock.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Stack Lockfile",
  "type": "object",
  "required": ["lockfile_version", "generated", "resolved"],
  "properties": {
    "lockfile_version": { "type": "integer", "const": 1 },
    "generated": { "type": "string", "format": "date-time" },
    "digest": { "type": "string", "description": "Hash of resolved skills" },
    "resolved": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["content_hash", "updated", "path", "resolved_at"],
        "properties": {
          "content_hash": { "type": "string" },
          "updated": { "type": "string" },
          "path": { "type": "string" },
          "resolved_at": { "type": "string", "format": "date-time" }
        }
      }
    }
  }
}
```

---

### 5. Compiler Changes

**File:** `/home/vince/dev/claude-subagents/src/cli/lib/compiler.ts`

**Current behavior:** Compiler copies skills by path without version awareness (lines 146-204 in `compileAllSkills`).

#### 5.1 New hash utility file

**New file:** `src/cli/lib/hash.ts`

```typescript
import crypto from 'crypto';
import { readFile } from '../utils/fs';

const HASH_TRUNCATE_LENGTH = 7;

export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, HASH_TRUNCATE_LENGTH);
}

export async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return hashContent(content);
}
```

#### 5.2 Modify compileAllSkills function

**In `src/cli/lib/compiler.ts`, add version extraction after reading SKILL.md:**

```typescript
import { hashFile } from './hash';
import fs from 'fs/promises';

interface CompiledSkillMetadata {
  id: string;
  content_hash: string;
  updated: string;
  path: string;
  resolved_at: string;
}

async function extractSkillMetadata(
  skillPath: string,
  skillId: string
): Promise<CompiledSkillMetadata> {
  const skillMdPath = path.join(skillPath, 'SKILL.md');
  const stats = await fs.stat(skillMdPath);

  return {
    id: skillId,
    content_hash: await hashFile(skillMdPath),
    updated: stats.mtime.toISOString().split('T')[0],
    path: skillPath,
    resolved_at: new Date().toISOString(),
  };
}
```

#### 5.3 Add lockfile generation

```typescript
import YAML from 'yaml';

export async function generateLockfile(
  compiledSkills: CompiledSkillMetadata[],
  stackId: string,
  outputDir: string
): Promise<void> {
  const lockfile = {
    lockfile_version: 1,
    generated: new Date().toISOString(),
    digest: computeDigest(compiledSkills),
    resolved: Object.fromEntries(
      compiledSkills.map(s => [s.id, {
        content_hash: s.content_hash,
        updated: s.updated,
        path: s.path,
        resolved_at: s.resolved_at,
      }])
    ),
  };

  const lockfilePath = path.join(outputDir, `${stackId}.lock.yaml`);
  await writeFile(lockfilePath, YAML.stringify(lockfile));
  console.log(`  + ${stackId}.lock.yaml`);
}

function computeDigest(skills: CompiledSkillMetadata[]): string {
  const content = skills.map(s => `${s.id}:${s.content_hash}`).sort().join('\n');
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 12);
}
```

---

### 6. How Stacks Reference Skills (Resolution)

Per the decision to use content-hash + date hybrid:

**Stacks reference skills by name (no version constraint syntax):**

```yaml
skills:
  frontend:
    framework: react
    styling: scss-modules
```

**Compiler resolves to exact skill paths via `skill_aliases` in skills-matrix.yaml:**

```yaml
skill_aliases:
  react: 'frontend/framework/react (@vince)'
  scss-modules: 'frontend/styling/scss-modules (@vince)'
```

**Lockfile captures exact state for reproducibility:**

```yaml
resolved:
  frontend/framework/react (@vince):
    content_hash: a1b2c3d
    updated: 2025-01-20
    path: skills/frontend/framework/react (@vince)/
    resolved_at: 2025-01-20T12:00:00Z
```

**Change detection workflow:**
1. Compare previous lockfile `content_hash` to current computed hash
2. If different, skill has changed
3. Consumer can diff content for details or check `history` for author's explanation

---

### 7. Implementation Priority (Versioning Integration)

| Priority | Task | Files Affected | Effort |
|----------|------|----------------|--------|
| P0 | Create hash utility | New `src/cli/lib/hash.ts` | 1 hour |
| P0 | Add version fields to types | `src/types.ts` | 30 min |
| P0 | Create skill frontmatter schema | New `src/schemas/skill-frontmatter.schema.json` | 1 hour |
| P1 | Extract metadata in compiler | `src/cli/lib/compiler.ts` | 2 hours |
| P1 | Generate lockfile on compile | `src/cli/lib/compiler.ts` | 2 hours |
| P1 | Create lockfile schema | New `src/schemas/stack.lock.schema.json` | 1 hour |
| P1 | Add stack version to schema | `src/schemas/skills-matrix.schema.json` | 30 min |
| P2 | CLI display of hash/date | CLI commands | 2 hours |
| P2 | `claude skill outdated` command | New command file | 4 hours |
| P3 | Non-blocking reminder hook | Git post-commit hook | 2 hours |

**Total estimated effort:** ~1.5 days for P0-P1, +1 day for P2-P3

---

### 8. Complete Example Flow

**Before compile (author-edited SKILL.md):**

```yaml
---
name: frontend/react (@vince)
description: Component architecture, hooks, patterns
history:
  - v: 1.3.0
    why: Add useOptimistic hook examples
  - v: 1.2.0
    why: Update for React 19 (forwardRef deprecated)
---
```

**After compile (injected metadata in output):**

```yaml
---
name: frontend/react (@vince)
description: Component architecture, hooks, patterns
content_hash: a1b2c3d
updated: 2025-01-20
history:
  - v: 1.3.0
    why: Add useOptimistic hook examples
  - v: 1.2.0
    why: Update for React 19 (forwardRef deprecated)
---
```

**Generated lockfile (`dist/modern-react/stack.lock.yaml`):**

```yaml
lockfile_version: 1
generated: 2025-01-20T12:00:00Z
digest: abc123def456

resolved:
  frontend/react (@vince):
    content_hash: a1b2c3d
    updated: 2025-01-20
    path: skills/frontend/framework/react (@vince)/
    resolved_at: 2025-01-20T12:00:00Z

  frontend/styling/scss-modules (@vince):
    content_hash: def4567
    updated: 2025-01-15
    path: skills/frontend/styling/scss-modules (@vince)/
    resolved_at: 2025-01-20T12:00:00Z
```

---

### 9. Summary Table

| Question | Answer |
|----------|--------|
| Where does `version` field go in skill frontmatter? | `content_hash` and `updated` auto-generated in SKILL.md frontmatter. `history` array author-maintained. |
| Where does `version` field go in stack definitions? | Optional `version` field in `suggested_stacks[].version` for stack versioning. Skills referenced by name. |
| What schema changes are needed? | Add `skill-frontmatter.schema.json`, `stack.lock.schema.json`. Update `skills-matrix.schema.json` for stack version. |
| How does the compiler use version info? | Computes `content_hash` from content, extracts `updated` from mtime, generates lockfile. |
| How do stacks reference skill versions? | By name only. Lockfile captures exact `content_hash` for reproducibility and change detection. |

---

### 10. Alignment with Decisions

This integration plan aligns with the **content-hash + date hybrid** decision:

1. **`content_hash`** - 7-char truncated SHA-256, computed at compile time
2. **`updated`** - File mtime formatted as YYYY-MM-DD
3. **`history`** - Author-maintained array with `v` and `why` fields

And satisfies all constraints:
- Zero friction for authors (edit content, optionally add history, commit)
- No blocking commit hooks
- No required CLI commands to bump versions
- Simple > complex

---

## Auto-Versioning Mechanisms

**Research Date**: 2026-01-20
**Goal**: Zero-effort versioning - author edits skill, version updates automatically

This section investigates five specific mechanisms for automatic versioning that require ZERO author effort. The user's constraint is clear: commit hooks and CLI options are seen as "barriers". The ideal is: author edits skill, version updates automatically.

---

### Mechanism 1: Git Hooks (pre-commit, post-commit, pre-push)

#### Does it require ANY manual author action?
**YES** - Hooks must be installed per-developer (via `npm run prepare` / husky setup). Authors must commit changes for hooks to fire.

#### Can it generate changelogs automatically?
**YES** - Post-commit hooks can parse commit messages and update CHANGELOG files.

#### Failure Modes
- **Hook bypass**: `git commit --no-verify` skips hooks entirely
- **Non-git workflows**: Direct file edits without commits are invisible
- **Hook installation**: New contributors must run setup (husky, etc.)
- **Merge conflicts**: Auto-versioning can create conflicts when multiple authors update
- **Performance**: File scanning on every commit can slow down workflows

#### Implementation

```bash
#!/bin/bash
# .husky/pre-commit - Auto-version modified skills

CHANGED_SKILLS=$(git diff --cached --name-only | grep '^src/skills/.*\.md$')

for skill_path in $CHANGED_SKILLS; do
  # Find corresponding metadata.yaml
  skill_dir=$(dirname "$skill_path")
  metadata="$skill_dir/../metadata.yaml"

  if [ -f "$metadata" ]; then
    # Extract current version
    current=$(grep '^version:' "$metadata" | sed 's/version: //')

    # Bump patch version
    IFS='.' read -r major minor patch <<< "$current"
    new_version="$major.$minor.$((patch + 1))"

    # Update metadata
    sed -i "s/^version: .*/version: $new_version/" "$metadata"
    git add "$metadata"

    echo "Auto-bumped $skill_dir to $new_version"
  fi
done
```

#### Verdict: **NOT IDEAL**
Requires git operations and can be bypassed. Still has friction (commit workflow). Authors who bypass hooks or work outside git won't trigger versioning.

---

### Mechanism 2: GitHub Actions (CI Auto-Version on Merge)

#### Does it require ANY manual author action?
**MINIMAL** - Author creates PR, CI handles versioning on merge. No version editing required.

#### Can it generate changelogs automatically?
**YES** - Full control over changelog generation from commit history.

#### Failure Modes
- **PR-only**: Direct pushes to main bypass versioning
- **Branch protection required**: Must enforce PR workflow
- **CI delays**: Version updates happen asynchronously after merge
- **Circular commits**: Bot commits can trigger infinite loops without proper config
- **Token permissions**: Requires write access for bot

#### Implementation

```yaml
# .github/workflows/auto-version.yml
name: Auto Version Skills
on:
  push:
    branches: [main]
    paths:
      - 'src/skills/**/*.md'
      - 'src/skills/**/metadata.yaml'

jobs:
  version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Detect Changed Skills
        id: changes
        run: |
          # Get changed skill directories
          CHANGED=$(git diff --name-only HEAD~1 HEAD | grep '^src/skills/' | cut -d'/' -f1-4 | sort -u)
          echo "skills=$CHANGED" >> $GITHUB_OUTPUT

      - name: Bump Versions
        run: |
          for skill_dir in ${{ steps.changes.outputs.skills }}; do
            metadata="$skill_dir/metadata.yaml"
            if [ -f "$metadata" ]; then
              # Use yq for YAML manipulation
              current=$(yq '.version' "$metadata")
              IFS='.' read -r major minor patch <<< "$current"
              new_version="$major.$minor.$((patch + 1))"
              yq -i ".version = \"$new_version\"" "$metadata"

              # Add changelog entry
              echo "- $(date +%Y-%m-%d): Auto-version bump to $new_version" >> "$skill_dir/CHANGELOG.md"
            fi
          done

      - name: Commit Changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add -A
          git diff --staged --quiet || git commit -m "chore: auto-version skills [skip ci]"
          git push
```

#### Verdict: **GOOD OPTION**
Truly zero-effort for authors. Only drawback is version appears after merge, not during PR review. Requires branch protection to be reliable.

---

### Mechanism 3: Content Hashing (Derive Version from File Content)

#### Does it require ANY manual author action?
**NO** - Completely automatic. Version IS the content hash.

#### Can it generate changelogs automatically?
**PARTIAL** - Can track changes, but no semantic meaning (hash changes don't indicate breaking/feature/fix).

#### Failure Modes
- **No semantic versioning**: `abc123` says nothing about compatibility
- **Hash instability**: Whitespace changes create new versions
- **Cache invalidation**: Every change invalidates caches
- **Human unreadable**: Can't tell which version is "newer"

#### Implementation

```typescript
// src/cli/lib/content-versioner.ts
import { createHash } from 'crypto';
import { readFile, glob } from '../utils/fs';
import path from 'path';

interface ContentVersion {
  hash: string;      // Short SHA256 hash
  timestamp: number; // Build time
  files: string[];   // Files included in hash
}

export async function computeSkillVersion(skillDir: string): Promise<ContentVersion> {
  const files = await glob('**/*.md', skillDir);
  const contents: string[] = [];

  for (const file of files.sort()) {
    const content = await readFile(path.join(skillDir, file));
    // Normalize whitespace to prevent trivial changes
    const normalized = content.trim().replace(/\r\n/g, '\n');
    contents.push(`${file}:${normalized}`);
  }

  const fullHash = createHash('sha256')
    .update(contents.join('\n---\n'))
    .digest('hex');

  return {
    hash: fullHash.substring(0, 8), // Short hash: "a1b2c3d4"
    timestamp: Date.now(),
    files,
  };
}

// Usage in compiler
async function compileSkillWithVersion(skillDir: string) {
  const version = await computeSkillVersion(skillDir);
  // version.hash can be used as the skill "version"
  // e.g., "react@a1b2c3d4" instead of "react@2.0.0"
}
```

#### Hybrid Approach: Hash + Semver

```typescript
// metadata.yaml contains semver, but we append content hash for cache busting
interface HybridVersion {
  semver: string;  // "2.0.0" - human-managed for breaking changes
  hash: string;    // "a1b2c3d4" - auto-generated for content tracking
  full: string;    // "2.0.0+a1b2c3d4"
}

function buildHybridVersion(semver: string, hash: string): string {
  return `${semver}+${hash}`;  // "2.0.0+a1b2c3d4"
}
```

#### Verdict: **EXCELLENT FOR CACHE INVALIDATION**
Perfect for detecting changes automatically. Best combined with auto-incrementing patch version for ordering.

---

### Mechanism 4: Compiler Integration (Auto-Detect and Version at Compile Time)

#### Does it require ANY manual author action?
**NO** - Compiler handles everything during `bun run compile`.

#### Can it generate changelogs automatically?
**YES** - Compiler can track what changed since last compile.

#### Failure Modes
- **Requires compile**: Version only updates when compile runs
- **State management**: Must persist previous versions somewhere
- **Build ordering**: Must compile before pushing to see version
- **Distributed builds**: Different machines may compute different versions

#### Implementation

```typescript
// Enhanced compiler.ts with auto-versioning
import { createHash } from 'crypto';
import { readFile, writeFile } from '../utils/fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import path from 'path';

interface VersionCache {
  skills: Record<string, { hash: string; version: string; lastModified: number }>;
}

const VERSION_CACHE_FILE = '.skill-versions.json';

export async function compileAllSkillsWithVersioning(
  skills: Skill[],
  ctx: CompileContext
): Promise<void> {
  // Load version cache
  let cache: VersionCache = { skills: {} };
  try {
    cache = JSON.parse(await readFile(path.join(ctx.projectRoot, VERSION_CACHE_FILE)));
  } catch {
    // First run, no cache
  }

  for (const skill of skills) {
    const skillDir = path.join(ctx.projectRoot, 'src', skill.path);
    const metadataPath = path.join(skillDir, 'metadata.yaml');

    // Compute content hash
    const content = await readFile(path.join(skillDir, 'SKILL.md'));
    const hash = createHash('sha256').update(content.trim()).digest('hex').slice(0, 8);
    const cached = cache.skills[skill.id];

    if (!cached || cached.hash !== hash) {
      // Content changed - bump version
      const metadata = parseYaml(await readFile(metadataPath));
      const [major, minor, patch] = metadata.version.split('.').map(Number);

      // Auto-bump patch version
      metadata.version = `${major}.${minor}.${patch + 1}`;
      metadata.contentHash = hash;
      metadata.lastModified = new Date().toISOString();

      await writeFile(metadataPath, stringifyYaml(metadata));

      // Update cache
      cache.skills[skill.id] = {
        hash: hash,
        version: metadata.version,
        lastModified: Date.now(),
      };

      console.log(`  Auto-versioned ${skill.id} to ${metadata.version}`);
    }
  }

  // Save cache
  await writeFile(
    path.join(ctx.projectRoot, VERSION_CACHE_FILE),
    JSON.stringify(cache, null, 2)
  );
}
```

#### Verdict: **RECOMMENDED APPROACH**
Integrates naturally with existing workflow. Author runs `compile` (already required for publishing), versions update automatically. Zero additional steps.

---

### Mechanism 5: File Modification Detection (Track Changes and Auto-Bump)

#### Does it require ANY manual author action?
**DEPENDS** - File watching requires a daemon; git-based detection requires commits.

#### Can it generate changelogs automatically?
**YES** - Can log all file modifications with timestamps.

#### Failure Modes
- **File system events**: May miss rapid changes or fail on network drives
- **Platform differences**: fswatch/chokidar behave differently on macOS/Linux/Windows
- **Daemon required**: Must run background process for real-time
- **Battery/resource usage**: Continuous watching consumes resources

#### Implementation Options

**Option A: Git-based (post-commit hook)**
```bash
#!/bin/bash
# Track skill modifications and bump versions
git diff HEAD~1 --name-only --diff-filter=M | while read file; do
  if [[ "$file" == src/skills/*/*.md ]]; then
    skill_dir=$(dirname "$file")
    # Bump version...
  fi
done
```

**Option B: File watcher daemon**
```typescript
// scripts/watch-skills.ts
import chokidar from 'chokidar';
import { bumpSkillVersion } from './versioner';

const watcher = chokidar.watch('src/skills/**/*.md', {
  persistent: true,
  ignoreInitial: true,
});

watcher.on('change', async (filePath) => {
  console.log(`Detected change: ${filePath}`);
  await bumpSkillVersion(filePath);
});

console.log('Watching for skill changes...');
```

**Option C: Last-modified timestamp comparison**
```typescript
// Compare mtime with stored timestamp
import { stat } from 'fs/promises';

async function detectModifiedSkills(skillsDir: string, lastBuildTime: number) {
  const skills = await glob('**/SKILL.md', skillsDir);
  const modified: string[] = [];

  for (const skill of skills) {
    const stats = await stat(skill);
    if (stats.mtimeMs > lastBuildTime) {
      modified.push(skill);
    }
  }

  return modified;
}
```

#### Verdict: **USEFUL AS SUPPLEMENTARY**
Good for dev experience but not reliable as sole source of truth. Best combined with compile-time detection.

---

## Auto-Versioning: Recommended Strategy

For the **EASIEST path with ZERO author effort**, combine Mechanism 4 (Compiler Integration) with Mechanism 2 (GitHub Actions):

### Primary: Compiler Integration

```
Author edits SKILL.md
       |
       v
Author runs `bun run compile` (already required!)
       |
       v
Compiler detects content hash change
       |
       v
Compiler auto-bumps patch version in metadata.yaml
       |
       v
Version updated automatically - ZERO extra steps
```

### Secondary: GitHub Actions Fallback

For cases where author forgets to compile locally:

```
PR merged to main
       |
       v
GitHub Action detects skill changes
       |
       v
Action compares content hashes
       |
       v
Action auto-bumps any un-versioned changes
       |
       v
Bot commits version update with [skip ci]
```

### Implementation Checklist

1. **Add content hashing to compiler** (zero author effort)
   - Compute SHA256 of skill content files
   - Compare with stored hash in metadata.yaml (or cache file)
   - Auto-bump patch version if hash differs
   - Update `contentHash` and `lastModified` fields

2. **Add version cache file** (`.skill-versions.json`)
   - Track previous hashes across compiles
   - Detect changes between compiles
   - Git-ignore (ephemeral local state)

3. **Add GitHub Action fallback**
   - Run on merge to main
   - Catch any un-versioned skill changes
   - Auto-bump and commit with `[skip ci]`

4. **Optional: Add changelog generation**
   - Parse git commit messages affecting each skill
   - Generate per-skill history entries
   - Run as part of compile or CI

### Example Final Workflow

```
1. Author edits src/skills/frontend/react/SKILL.md
2. Author runs `bun run compile` (normal workflow, already required)
3. Compiler output:
   Compiling skills...
     Auto-versioned frontend-react to 2.0.1 (content hash: a1b2c3d4)
     + skills/frontend-react/SKILL.md
4. Author commits: "docs(skills): update react patterns"
5. PR merged
6. If author forgot to compile:
   GitHub Action: "chore: auto-version skills [skip ci]"
```

### Auto-Versioning Comparison Table

| Mechanism | Zero Effort | Auto Changelog | Reliability | Complexity |
|-----------|-------------|----------------|-------------|------------|
| Git Hooks | Partial | Yes | Bypassable | Low |
| GitHub Actions | Yes | Yes | High | Medium |
| Content Hashing | Yes | Partial | High | Low |
| Compiler Integration | Yes | Yes | High | Medium |
| File Watching | Partial | Yes | Low | High |
| **Compiler + CI (Recommended)** | **Yes** | **Yes** | **Very High** | **Medium** |

### Final Verdict

**Winner**: Compiler Integration + GitHub Actions Fallback

This achieves the goal: **Author edits skill, version updates automatically** with:
- No extra commands (compile is already required)
- No manual version editing
- No commit hooks to bypass
- No CLI flags to remember
- Fallback CI ensures nothing slips through
