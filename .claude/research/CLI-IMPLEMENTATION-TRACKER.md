# CLI Implementation Tracker

> **Purpose**: Track implementation of CLI commands and versioning system
> **Created**: 2026-01-21
> **Status**: Phase 1-3 Complete, Phase 4-9 Not Started

---

## Current State

| Component    | Status          | Notes                                       |
| ------------ | --------------- | ------------------------------------------- |
| `cc init`    | **Complete**    | Creates .claude/, lock file, copies skills  |
| `cc compile` | Working         | Compiles agents with skills                 |
| `cc add`     | **Complete**    | Add additional stacks after init            |
| `cc update`  | **Complete**    | Update existing stack's skill selection     |
| Versioning   | Decided         | Integer version + content hash + date       |
| Lock file    | **Complete**    | .cc-lock.yaml + stack.lock.yaml implemented |
| Private Repo | Planned         | Phase 7: Configurable source support        |
| Multi-Source | Planned         | Phase 8: Community + private skills         |
| Skill Reorg  | Planned         | Phase 9: PhotoRoom → private, general skills|

---

## Commands to Implement

### 1. `cc init` - Finalize [COMPLETE]

**Current**: ~~Runs wizard, shows selections, does nothing (MVP TEST MODE)~~ **IMPLEMENTED**

**Target behavior**:

- [x] Creates `.claude/` directory
- [x] Creates `.claude/.cc-lock.yaml` marker file
- [x] Runs wizard for stack selection
- [x] Copies selected skills to `.claude/stacks/{stack-name}/skills/`
- [x] Generates `config.yaml` and `stack.lock.yaml`

**Detection logic**:

- [x] If `.claude/.cc-lock.yaml` exists → warn "Already initialized. Use `cc add` or `cc update`"

**Files modified**:

- [x] `src/cli/commands/init.ts` - remove MVP mode, add file generation

---

### 2. `cc add` - New Command [COMPLETE]

**Purpose**: Add another stack after initial setup

**Behavior**:

- [x] Errors if `.claude/` doesn't exist → "Run `cc init` first"
- [x] Prompts for stack name (validates kebab-case, checks uniqueness)
- [x] Runs same wizard as init
- [x] Copies skills to `.claude/stacks/{stack-name}/skills/`
- [x] Generates `config.yaml` and `stack.lock.yaml`

**Files created**:

- [x] `src/cli/commands/add.ts`

**Code reuse**: Shared logic extracted to `src/cli/lib/stack-creator.ts`

---

### 3. `cc update` - New Command [COMPLETE]

**Purpose**: Modify an existing stack's skill selection

**Behavior**:

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
│  (Pre-population TODO)      │
│  [Modify and confirm]       │
└─────────────────────────────┘
```

**Files created**:

- [x] `src/cli/commands/update.ts`

**Implemented features**:

- [x] Stack picker UI (list existing stacks)
- [ ] Pre-populate wizard with current selections (TODO - marked in code)
- [x] Replace skills on confirm

---

## Shared Infrastructure [COMPLETE]

### Lock File (`.claude/.cc-lock.yaml`) [COMPLETE]

**Purpose**: Track initialized state and stacks

```yaml
initialized_at: '2026-01-21T10:30:00Z'
cli_version: '0.1.0'
stacks:
  - name: home-stack
    added_at: '2026-01-21T10:30:00Z'
    skill_count: 25
  - name: work-stack
    added_at: '2026-01-21T11:00:00Z'
    skill_count: 18
```

**Files created**:

- [x] `src/cli/lib/lock-file.ts` - read/write lock file

---

### Stack Lock File (`stack.lock.yaml`) [COMPLETE]

**Purpose**: Track skill versions for a specific stack

**Location**: `.claude/stacks/{stack-name}/stack.lock.yaml`

```yaml
lockfile_version: 1
generated: 2026-01-21T12:00:00Z
stack_id: home-stack
digest: abc123def456

resolved:
  frontend/react (@vince):
    version: 4
    content_hash: a1b2c3d
    updated: 2026-01-21
```

**Files created**:

- [x] `src/cli/lib/stack-lock.ts` - generate stack lock file

---

### Skill Copy Logic [COMPLETE]

**Purpose**: Copy skills from registry to local stack

**Behavior**:

- [x] Copy skill folder to `.claude/stacks/{stack}/skills/{skill-path}/`
- [x] Preserve directory structure
- [x] Generate stack.lock.yaml with content hashes

**Files created**:

- [x] `src/cli/lib/skill-copier.ts`

---

## Versioning System [PARTIAL]

### metadata.yaml Changes

**Current**:

```yaml
version: '1.0.0' # Semver string
```

**Target**:

```yaml
version: 4 # Integer, auto-incremented
content_hash: a1b2c3d # 7-char SHA-256
updated: 2026-01-21 # File modification date
```

**Files created**:

- [x] `src/cli/lib/hash.ts` - content hashing utility (SHA-256, 7-char prefix)

**Files to modify (Phase 4)**:

- [ ] `src/cli/lib/compiler.ts` - inject version/hash on compile
- [ ] Update metadata.yaml schema (integer version)

---

## Directory Structure (User's Project)

After running `cc init` + `cc add work-stack`:

```
my-project/
├── .claude/
│   ├── .cc-lock.yaml              # Tracks initialized state
│   └── stacks/
│       ├── home-stack/
│       │   ├── config.yaml        # Stack config
│       │   ├── stack.lock.yaml    # Skill versions
│       │   ├── CLAUDE.md          # Project conventions
│       │   └── skills/            # Copied skills
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

## Implementation Order

| Phase | Task                     | Effort  | Dependencies                        |
| ----- | ------------------------ | ------- | ----------------------------------- |
| 1     | Create `hash.ts` utility | 30 min  | None                                |
| 2     | Create `lock-file.ts`    | 1 hour  | None                                |
| 3     | Create `skill-copier.ts` | 2 hours | hash.ts                             |
| 4     | Create `stack-lock.ts`   | 1 hour  | hash.ts                             |
| 5     | Finalize `init.ts`       | 3 hours | lock-file, skill-copier, stack-lock |
| 6     | Create `add.ts`          | 2 hours | Same as init                        |
| 7     | Create `update.ts`       | 3 hours | add.ts + stack picker               |

**Total estimated effort**: ~13 hours (2 days)

---

## Checklist

### Phase 1: Infrastructure

- [x] `src/cli/lib/hash.ts` - content hashing
- [x] `src/cli/lib/lock-file.ts` - .cc-lock.yaml handling
- [x] `src/cli/lib/skill-copier.ts` - copy skills to local stack
- [x] `src/cli/lib/stack-lock.ts` - stack.lock.yaml generation
- [x] `src/cli/lib/stack-config.ts` - stack config.yaml handling (added)
- [x] `src/cli/lib/stack-creator.ts` - shared stack creation logic (added)

### Phase 2: Commands

- [x] `src/cli/commands/init.ts` - finalize (remove MVP mode)
- [x] `src/cli/commands/add.ts` - new command
- [x] `src/cli/commands/update.ts` - new command

### Phase 3: Integration

- [x] Register commands in `src/cli/index.ts`
- [x] Update help text
- [ ] Test all flows (manual testing recommended)

### Phase 4: Versioning

- [ ] Update `metadata.yaml` schema (integer version)
- [ ] Compiler auto-increments version on hash change
- [ ] Display version in CLI listings

### Phase 5: Validation (Future)

- [ ] Comprehensive metadata.yaml validation on load
- [ ] Validate all required fields (cli_name, author, category, version)
- [ ] Validate field formats (author pattern `@kebab-case`, version format)
- [ ] Validate SKILL.md frontmatter structure
- [ ] Consider JSON Schema validation at runtime
- [ ] Friendly error messages with file paths and missing fields

### Phase 6: Schema Distribution

- [ ] Update all `# yaml-language-server` references to use GitHub raw URL
  - Current: relative paths (`../../../../schemas/metadata.schema.json`)
  - Target: `https://raw.githubusercontent.com/{org}/{repo}/main/schemas/metadata.schema.json`
- [ ] Submit PR to [SchemaStore](https://github.com/SchemaStore/schemastore) for automatic IDE detection
  - `metadata.yaml` → `**/skills/**/metadata.yaml`
  - `skills-matrix.yaml` → `**/skills-matrix.yaml`
  - Other schemas as needed
- [ ] Add fallback comment instructions in documentation for offline/enterprise users

### Phase 7: Configurable Source (Private Repository Support)

**Purpose**: Allow CLI to fetch skills from private/custom repositories instead of default public repo.

**Research**: See `.claude/research/CONFIGURABLE-SOURCE-EDGE-CASES.md` for comprehensive edge case analysis.

#### 7.1 Configuration

- [ ] Create `src/cli/lib/config.ts` - read/write global and project config
- [ ] Support global config at `~/.claude-collective/config.yaml`
- [ ] Support project config at `.claude/cc-config.yaml`
- [ ] Implement precedence: Flag > Project config > Global config > Env var > Default

**Config schema:**
```yaml
# ~/.claude-collective/config.yaml
source: github.com/mycompany/private-skills
```

#### 7.2 CLI Changes

- [ ] Add `--source <url>` flag to `cc init`, `cc add`, `cc update`
- [ ] Add `cc config` command for managing configuration
  - `cc config set source <url>` - set source URL
  - `cc config get source` - show current source
  - `cc config show` - show all effective configuration
- [ ] Update fetcher to use configurable source instead of hardcoded URL

#### 7.3 Authentication

- [ ] Support `GIGET_AUTH` environment variable for token
- [ ] Support `GITHUB_TOKEN` as fallback
- [ ] Document `FORCE_NODE_FETCH=true` for corporate proxies (Node 20+ bug)
- [ ] Document `NODE_EXTRA_CA_CERTS` for self-signed certificates
- [ ] Add helpful error messages for auth failures (map 401/403/404 to guidance)

#### 7.4 Pre-flight Checks

- [ ] Validate token before attempting download
- [ ] Check repository accessibility
- [ ] Provide clear error if private repo + no token

#### 7.5 Documentation

- [ ] Document supported platforms (GitHub, GitLab, GitHub Enterprise)
- [ ] Document unsupported platforms (Bitbucket private, Azure DevOps, CodeCommit)
- [ ] Document authentication setup for each platform
- [ ] Document corporate proxy workarounds

### Phase 8: Multi-Source Composition

**Purpose**: Allow users to benefit from BOTH community skills AND private company skills.

#### 8.1 Multi-Source Configuration

- [ ] Support multiple sources in config:
```yaml
# ~/.claude-collective/config.yaml
sources:
  - url: github.com/claude-collective/skills
    name: Community
  - url: github.com/company/private-skills
    name: Company
    auth_env: GITHUB_TOKEN
```

#### 8.2 Matrix Merging

- [ ] Fetch skills-matrix.yaml from each source
- [ ] Merge categories (private extends/overrides public)
- [ ] Merge skill_aliases with source tagging
- [ ] Merge relationships (conflicts, recommends, requires)
- [ ] Handle naming conflicts (prefix with source name)

#### 8.3 Wizard Visual Separation

- [ ] Display skills grouped by source in wizard:
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
- [ ] Show source indicator on selected skills summary
- [ ] Handle skills from different sources with same name

#### 8.4 Skill Copying

- [ ] Track source in stack.lock.yaml for each skill
- [ ] Support fetching individual skills from different sources
- [ ] Handle auth differently per source

#### 8.5 Edge Cases

- [ ] What if same skill exists in both sources? (Namespace or error?)
- [ ] What if private source is unreachable? (Graceful degradation?)
- [ ] What if skills-matrix.yaml schemas differ? (Version check?)

---

### Phase 9: Skill Repository Organization

**Purpose**: Separate company-specific skills from general community skills.

#### 9.1 Move PhotoRoom Skills to Private Repository

- [ ] Identify all PhotoRoom-specific skills in current repository
- [ ] Create private repository structure (`github.com/photoroom/claude-skills` or similar)
- [ ] Move PhotoRoom-specific skills to private repo
- [ ] Update skills-matrix.yaml in private repo
- [ ] Test multi-source composition with both repos

**PhotoRoom-specific skills to migrate:**
- Skills with `@photoroom` author
- Skills containing company-specific patterns, conventions, or internal tooling
- Skills referencing internal APIs or services

#### 9.2 Create General Community Skills

Replace PhotoRoom-specific skills with generalized versions:

- [ ] **MobX** - General MobX state management patterns (not PhotoRoom-specific)
- [ ] **Tailwind** - General Tailwind CSS patterns
- [ ] **Other skills as identified** - Review remaining skills for generalization opportunities

**Criteria for community skills:**
- No company-specific conventions or patterns
- Follows official library documentation and best practices
- Useful to the broader developer community
- Author tagged as `@vince` or community contributor

#### 9.3 Documentation

- [ ] Document which skills belong in community vs private repos
- [ ] Create contribution guidelines for community skills
- [ ] Create guidelines for private skill development

---

## Notes

- Code reuse between init/add/update is ~90% (shared wizard, copier, lock file)
- Wizard already works (tested in CLI-TEST-PROGRESS.md)
- Skills-matrix.yaml integration already complete
