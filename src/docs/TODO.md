# Consolidated Outstanding Tasks

> **Generated**: 2026-01-21
> **Purpose**: Single source of truth for all outstanding work
> **Replaces**: `CLI-IMPLEMENTATION-TRACKER.md`, `OUTSTANDING-TASKS.md` (safe to delete)

---

## Related Files (Do Not Delete)

These files contain detailed research referenced by this document:

| File                                  | Purpose                                         | Location                        |
| ------------------------------------- | ----------------------------------------------- | ------------------------------- |
| `CONFIGURABLE-SOURCE-EDGE-CASES.md`   | Private repo support research, giget limits     | `.claude/research/`             |
| `SKILLS-RESEARCH-TRACKING.md`         | New skills backlog (42 skills identified)       | `.claude/research/`             |
| `VERSIONING-PROPOSALS.md`             | Versioning decision rationale                   | `.claude/research/`             |
| `CLI-TEST-PROGRESS.md`                | Wizard testing results, stack validation        | Root                            |
| `CLI-DATA-DRIVEN-ARCHITECTURE.md`     | Matrix schema, data flow, repository separation | `src/docs/`                     |
| `CLI-FRAMEWORK-RESEARCH.md`           | @clack vs Ink vs Inquirer comparison            | `src/docs/`                     |
| `CLI-SIMPLIFIED-ARCHITECTURE.md`      | While-loop wizard design                        | `.claude/research/findings/v2/` |
| `SKILLS-MATRIX-STRUCTURE-RESEARCH.md` | Why relationship-centric beats skill-centric    | `.claude/research/findings/v2/` |

---

## Summary by Category

### 1. CLI Implementation

| Priority | Task                         | Description                                                  | Status                     |
| -------- | ---------------------------- | ------------------------------------------------------------ | -------------------------- |
| Critical | Phase 4: Versioning          | Integer version + content hash on compile                    | Not Started                |
| Critical | Phase 5: Validation          | Comprehensive metadata.yaml validation                       | Done (`cc validate`)       |
| Critical | Phase 6: Schema Distribution | GitHub raw URLs, SchemaStore PR                              | Not Started                |
| Critical | Phase 7: Private Repos       | Configurable source, auth, pre-flight checks                 | Not Started                |
| Critical | Phase 8: Multi-Source        | Community + private skills composition                       | Not Started                |
| Critical | Phase 9: Skill Reorg         | Separate PhotoRoom from community skills                     | Not Started                |
| High     | `cc cache`                   | Cache management commands                                    | Not Started                |
| High     | `cc validate`                | Validate selections against matrix                           | Done (metadata validation) |
| High     | `cc create skill`            | Scaffold new skill + output prompt for Claude Code           | Not Started                |
| High     | `cc create agent`            | Scaffold new agent + output prompt for Claude Code           | Not Started                |
| High     | `cc doctor`                  | Diagnose connectivity/auth issues                            | Not Started                |
| Medium   | SIGINT handler               | Graceful Ctrl+C                                              | Not Started                |
| Medium   | `--dry-run` flag             | Preview without executing                                    | Not Started                |
| Medium   | Exit codes                   | Define 4 codes (currently only 0/1)                          | Not Started                |
| Medium   | Pre-populate wizard          | `cc update` shows current selections                         | Not Started                |
| Medium   | Test all flows               | Manual testing (Phase 3 checklist)                           | Not Started                |
| Medium   | Parity verification          | Old compile.ts vs new CLI                                    | Done                       |
| Medium   | Config redundancy            | `frontend/react` appears 9x (CLI-generated, not user-facing) | Won't Fix                  |
| Medium   | Template issues              | Whitespace, monolithic (95 lines)                            | Not Started                |
| Medium   | Configuration system         | Global + project config files                                | Not Started                |
| Low      | Marketplace foundation       | Stack Marketplace Phase 1-2                                  | Deferred                   |
| Low      | Community submission         | `cc submit` flow                                             | Deferred                   |

---

### 2. Testing & CI/CD

| Priority | Task                          | Description                                                           | Status           |
| -------- | ----------------------------- | --------------------------------------------------------------------- | ---------------- |
| Critical | Test suite                    | Zero `*.test.ts` files exist                                          | Not Started      |
| Critical | CI/CD pipeline                | No `.github/workflows/`                                               | Not Started      |
| High     | Directory check bug           | `Bun.file().exists()` fails for directories                           | Not Started      |
| High     | Path sanitization             | Only replaces first `/`                                               | Not Started      |
| High     | Schema paths in copied skills | `skill-copier.ts:61` copies without updating paths (~35 broken files) | Not Started      |
| High     | Sequential compilation        | 3-5x slower than necessary                                            | Not Started      |
| High     | Verification scripts          | `verify-agent.sh` documented but not implemented                      | Not Started      |
| High     | Pre-commit hooks              | Bad code can be committed                                             | Not Started      |
| High     | Compiled output validation    | XML tags, final lines not verified                                    | Not Started      |
| High     | Content linting               | Skills can omit sections                                              | Not Started      |
| High     | Skill structure validation    | Missing required sections undetected                                  | Not Started      |
| Medium   | Schema validation             | IDE-only, no runtime Zod                                              | Done (AJV added) |
| Medium   | Private repo blockers         | Bitbucket, Azure DevOps unsupported                                   | Document         |

---

### 3. Skills & Content

| Priority | Task                           | Description                                             | Status      |
| -------- | ------------------------------ | ------------------------------------------------------- | ----------- |
| High     | `backend/observability`        | Has Hono, Drizzle, React references                     | Not Started |
| High     | `backend/auth/better-auth`     | Has Hono, Drizzle references                            | Not Started |
| High     | `backend/analytics/posthog`    | Has Better Auth, Email references                       | Not Started |
| High     | `backend/email/resend`         | Needs generic "authentication flow"                     | Not Started |
| High     | `backend/ci-cd/github-actions` | Has React Query, Zustand references                     | Not Started |
| Medium   | Skill ID inconsistency         | `frontend/react` vs `frontend-react`                    | Deferred    |
| Medium   | Skill bundles                  | Issue #7 - not implemented                              | Deferred    |
| Low      | New skills (Critical)          | nx, docker, kubernetes, vite, svelte, supabase, AI SDKs | Backlog     |
| Low      | New skills (High)              | astro, firebase, clerk, cloudflare, terraform, etc.     | Backlog     |
| Low      | Roadmap Phase 3-5              | background-jobs, caching, i18n, payments, etc.          | Backlog     |

---

### 4. Versioning

| Priority | Task                            | Description                              | Status                          |
| -------- | ------------------------------- | ---------------------------------------- | ------------------------------- |
| High     | Update schema                   | `metadata.yaml` integer version          | Not Started                     |
| High     | Compiler auto-increment         | Version bump on hash change              | Not Started                     |
| High     | Display version                 | Show in CLI listings                     | Not Started                     |
| High     | Pre-flight checks               | Token validation before download         | Not Started                     |
| Medium   | `skill-frontmatter.schema.json` | Validate SKILL.md frontmatter            | Done                            |
| Medium   | `agent.schema.json`             | Validate compiled agent frontmatter      | Done (EXISTS at `src/schemas/`) |
| Low      | Archive outdated schemas        | skills.schema.json, registry.schema.json | Not Started                     |

---

### 5. Documentation

| Priority | Task                      | Description                                 | Status      |
| -------- | ------------------------- | ------------------------------------------- | ----------- |
| Medium   | GitHub raw URLs           | Update `yaml-language-server` references    | Not Started |
| Medium   | SchemaStore PR            | Automatic IDE detection                     | Not Started |
| Medium   | Platform support docs     | GitHub, GitLab, GitHub Enterprise           | Not Started |
| Medium   | Unsupported platforms     | Bitbucket private, Azure DevOps, CodeCommit | Not Started |
| Low      | Generalize MobX skill     | Remove PhotoRoom-specific patterns          | Not Started |
| Low      | Generalize Tailwind skill | Remove PhotoRoom-specific patterns          | Not Started |
| Low      | Contribution guidelines   | For community skills                        | Not Started |
| Low      | Private skill guidelines  | For company-specific skills                 | Not Started |
| Low      | Voting system             | GitHub Discussions integration              | Deferred    |

---

## Totals by Priority

| Priority     | Count  | Examples                                                         |
| ------------ | ------ | ---------------------------------------------------------------- |
| **Critical** | 8      | Test suite, CI/CD, CLI Phases 4-9                                |
| **High**     | 23     | CLI commands, atomicity fixes, compilation bugs, schema path fix |
| **Medium**   | 18     | CLI polish, schema validation, documentation                     |
| **Low**      | 12     | New skills, marketplace, voting                                  |
| **Total**    | **61** |                                                                  |

---

## Completed Recently

### CLI Implementation (Phase 1-3)

- [x] `cc init` - Creates .claude/, copies skills
- [x] `cc compile` - Compiles agents with skills
- [x] `cc add` - Add additional stacks after init
- [x] `cc update` - Update existing stack's skill selection
- [x] `src/cli/lib/hash.ts` - content hashing utility
- [x] `src/cli/lib/skill-copier.ts` - copy skills to local stack
- [x] `src/cli/lib/stack-config.ts` - stack config handling
- [x] `src/cli/lib/stack-creator.ts` - shared stack creation logic

### Versioning & Provenance (2026-01-22)

- [x] `forked_from` provenance tracking - Added to metadata.schema.json
- [x] `skill-copier.ts` - Injects forked_from when copying skills
- [x] All 35 existing stack skills updated with forked_from metadata

### Skills Research

- [x] All 76 skills researched and aliases verified
- [x] Matrix loader connected - uses full skill extraction
- [x] 11 pre-built stacks validate correctly
- [x] 99.5% of automated tests pass

### Architecture Decisions

- [x] Versioning: Content-hash + date hybrid (decided)
- [x] Skills-matrix structure: Keep relationship-centric (decided)
- [x] CLI architecture: While-loop wizard beats action/reducer (decided)

---

## Files to Commit

### New Files (Staged)

```
A  .claude/research/CLI-IMPLEMENTATION-TRACKER.md
A  .claude/research/CONFIGURABLE-SOURCE-EDGE-CASES.md
A  .claude/research/OUTSTANDING-TASKS.md
A  .claude/research/SKILLS-RESEARCH-TRACKING.md
A  .claude/research/VERSIONING-PROPOSALS.md
A  .claude/research/findings/v2/CLI-MVP-ARCHITECTURE-PROPOSAL.md
A  .claude/research/findings/v2/CLI-SIMPLIFIED-ARCHITECTURE.md
A  .claude/research/findings/v2/SKILLS-MATRIX-STRUCTURE-RESEARCH.md
A  CLI-TEST-PROGRESS.md
A  src/docs/CLI-DATA-DRIVEN-ARCHITECTURE.md
A  src/docs/CLI-FRAMEWORK-RESEARCH.md
A  src/docs/INDEX.md
```

### Modified Files

```
M  src/docs/TODO.md
M  src/schemas/metadata.schema.json
```

### Deleted Files

```
D  src/schemas/skill-marketplace.schema.json
```

---

## Implementation Order Recommendation

### Week 1: Foundation

1. Add basic test infrastructure (Vitest setup)
2. Add SIGINT handler
3. Define 4 exit codes
4. Add `--dry-run` flag

### Week 2: Versioning

1. Update metadata.yaml schema (integer version)
2. Implement compiler version auto-increment
3. Create missing schemas

### Week 3: CLI Polish

1. `cc cache` commands
2. `cc validate` command
3. Pre-populate wizard for `cc update`

### Week 4+: Phase 7 (Private Repos)

1. Configuration system
2. Pre-flight auth checks
3. Custom error wrapper
4. Documentation

---

## Decision Log

| Date       | Decision                         | Rationale                                                   |
| ---------- | -------------------------------- | ----------------------------------------------------------- |
| 2026-01-21 | Keep relationship-centric matrix | Authoring is easier; skill-centric view computed at runtime |
| 2026-01-21 | While-loop wizard                | Simpler than action/reducer; better for MVP                 |
| 2026-01-21 | Integer versioning               | Zero friction; semver overkill for markdown skills          |
| 2026-01-21 | Document giget limitations       | Bitbucket private, Azure DevOps unsupported                 |

---

## Quick Reference

### Run CLI

```bash
bun src/cli/index.ts init
bun src/cli/index.ts add
bun src/cli/index.ts update
```

### Compile Agents

```bash
bunx compile -s home-stack
bunx compile -s work-stack
```

### Test Matrix Loading

```bash
bun src/cli/index.ts init  # Loads 76 skills, 11 stacks
```

---

# Detailed Context

> The sections below contain implementation details, specifications, and architectural context from the original tracker files.

---

## Versioning System Specification

### Target Format

```yaml
# In metadata.yaml (auto-generated fields)
version: 4 # Integer, auto-incremented on content change
content_hash: a1b2c3d # 7-char SHA-256 of skill folder
updated: 2026-01-21 # File modification date

# In SKILL.md frontmatter (optional author-maintained)
history:
  - v: 4
    why: Add React 19 useActionState patterns
```

### Implementation

- Hash utility: 15 lines using Node.js `crypto` (built-in) - **DONE** (`src/cli/lib/hash.ts`)
- Hash entire skill folder (SKILL.md + reference.md + examples/)
- Compiler auto-populates `version`, `content_hash`, `updated`
- Author optionally adds `history` entries for changelog

---

## Directory Structure (User's Project)

After running `cc init` + `cc add work-stack`:

```
my-project/
├── .claude/
│   └── stacks/
│       ├── home-stack/
│       │   ├── config.yaml        # Stack config
│       │   ├── CLAUDE.md          # Project conventions
│       │   └── skills/            # Copied skills (each has metadata.yaml with version)
│       │       ├── frontend/
│       │       │   └── react (@vince)/
│       │       │       ├── SKILL.md
│       │       │       ├── metadata.yaml
│       │       │       └── examples/
│       │       └── backend/
│       └── work-stack/
│           └── ... (same structure)
├── src/
└── package.json
```

---

## Phase 7: Private Repository Support (Detailed)

### 7.1 Configuration

```yaml
# ~/.claude-collective/config.yaml (global)
source: github.com/mycompany/private-skills

# .claude/cc-config.yaml (project - overrides global)
source: github.com/team/team-skills
```

**Precedence**: CLI flag > Project config > Global config > Env var > Default

### 7.2 CLI Changes

- `--source <url>` flag on `cc init`, `cc add`, `cc update`
- `cc config set source <url>` - set source URL
- `cc config get source` - show current source
- `cc config show` - show all effective configuration

### 7.3 Authentication

| Method            | Environment Variable    | Notes                   |
| ----------------- | ----------------------- | ----------------------- |
| giget native      | `GIGET_AUTH`            | Primary method          |
| GitHub fallback   | `GITHUB_TOKEN`          | Auto-detected           |
| Corporate proxy   | `FORCE_NODE_FETCH=true` | Node 20+ bug workaround |
| Self-signed certs | `NODE_EXTRA_CA_CERTS`   | Path to CA bundle       |

### 7.4 Error Mapping

| HTTP Code | User Message                                               |
| --------- | ---------------------------------------------------------- |
| 401       | "Authentication required. Set GIGET_AUTH or GITHUB_TOKEN"  |
| 403       | "Access denied. Check token permissions (needs repo read)" |
| 404       | "Repository not found or private. Check URL and auth"      |

---

## Phase 8: Multi-Source Composition (Detailed)

### 8.1 Configuration

```yaml
# ~/.claude-collective/config.yaml
sources:
  - url: github.com/claude-collective/skills
    name: Community
  - url: github.com/company/private-skills
    name: Company
    auth_env: GITHUB_TOKEN
```

### 8.2 Matrix Merging Rules

1. Fetch `skills-matrix.yaml` from each source
2. Merge categories (private extends/overrides public)
3. Merge `skill_aliases` with source tagging
4. Merge relationships (`conflicts`, `recommends`, `requires`)
5. Handle naming conflicts (prefix with source name)

### 8.3 Wizard Visual Separation

```
┌─ Framework ────────────────────────────────────┐
│  Community                                     │
│  ○ React @vince                                │
│  ○ Vue @vince                                  │
│                                                │
│  ─────────────────────────────────────────     │
│                                                │
│  Company (Private)                             │
│  ○ React + Company Patterns @company           │
└────────────────────────────────────────────────┘
```

### 8.4 Edge Cases to Resolve

- Same skill in both sources → Namespace with source prefix or error?
- Private source unreachable → Graceful degradation or hard fail?
- Schema version mismatch → Version check before merge?

---

## Phase 9: Skill Repository Reorganization (Detailed)

### 9.1 PhotoRoom Skills to Migrate

**Criteria for private repo:**

- Skills with `@photoroom` author
- Company-specific patterns, conventions, internal tooling
- References to internal APIs or services

### 9.2 Community Skills Criteria

**Must be:**

- No company-specific conventions
- Follows official library documentation
- Useful to broader developer community
- Author tagged as `@vince` or community contributor

**Skills to generalize:**

- MobX → General patterns (remove PhotoRoom conventions)
- Tailwind → General patterns (remove PhotoRoom conventions)

---

## Architecture Clarifications

### Preloaded Skills (Already Working)

The system already implements progressive loading correctly:

| Skill Type                    | What Loads           | When                       |
| ----------------------------- | -------------------- | -------------------------- |
| Preloaded (`preloaded: true`) | Full SKILL.md        | Immediately on agent start |
| Dynamic (not preloaded)       | Only 4-line metadata | In agent prompt            |
| Invoked via Skill tool        | Full SKILL.md        | On explicit invocation     |
| Examples/reference.md         | Nothing auto-loaded  | Agent reads if needed      |

**Implementation locations:**

- `compiler.ts:82-92` - partitions preloaded vs dynamic
- `agent.liquid:6` - outputs skills in frontmatter
- `home-stack/config.yaml:71` - `preloaded: true` flag

### Forking System (Simplified)

**Approach:** Skills copied locally on `cc init`/`cc add`, no diff/merge complexity.

- Each skill's `metadata.yaml` contains version and content_hash
- `cc update` = re-run wizard, replace with latest (no diffs)
- User owns local copies - can modify freely

**NOT implementing:** `skill diff/updates/merge` - too complex, not needed for MVP.

---

## CLI Command Specifications

### `cc init`

```
cc init
    ↓
┌─────────────────────────────┐
│  Select a stack or build    │
│  > Use pre-built stack      │
│    Build custom stack       │
└─────────────────────────────┘
    ↓ (wizard)
Creates:
  .claude/stacks/{name}/config.yaml
  .claude/stacks/{name}/skills/...
```

**Detection:** If `.claude/stacks/` exists → "Already initialized. Use `cc add` or `cc update`"

### `cc add`

```
cc add
    ↓
┌─────────────────────────────┐
│  Stack name: my-new-stack   │
│  (validates kebab-case)     │
└─────────────────────────────┘
    ↓ (same wizard as init)
Creates new stack in .claude/stacks/
```

### `cc update`

```
cc update
    ↓
┌─────────────────────────────┐
│  Your Stacks                │
│  > home-stack (25 skills)   │
│    work-stack (18 skills)   │
└─────────────────────────────┘
    ↓ (select)
┌─────────────────────────────┐
│  Same wizard UI as init     │
│  (TODO: Pre-populate with   │
│   current selections)       │
└─────────────────────────────┘
```

### `cc create skill`

```
cc create skill <category>/<name>
    ↓
Creates:
  src/skills/<category>/<name> (@author)/
    ├── metadata.yaml    # Template with TODOs
    ├── SKILL.md         # Empty template with sections
    ├── reference.md     # Empty
    └── examples/
        └── .gitkeep
    ↓
Outputs prompt for Claude Code:
  "Use the skill-summoner agent to flesh out <category>/<name>"
```

**Note:** The CLI only scaffolds. AI-generated content requires Claude Code with the `skill-summoner` agent.

### `cc create agent`

```
cc create agent <name>
    ↓
Creates:
  src/agent-sources/<name>/
    └── agent.yaml       # Template with TODOs
    ↓
Outputs prompt for Claude Code:
  "Use the agent-summoner agent to design the <name> agent"
```

**Note:** The CLI only scaffolds. AI-generated content requires Claude Code with the `agent-summoner` agent.

---

## Exit Codes (To Implement)

| Code | Meaning                 |
| ---- | ----------------------- |
| 0    | Success                 |
| 1    | General error           |
| 2    | Invalid arguments       |
| 3    | Network/auth error      |
| 4    | User cancelled (Ctrl+C) |
