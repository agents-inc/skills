# Skill Versioning and Stability Research

> **Purpose**: Research how to handle skill versioning in a "Stack Marketplace" system where stacks reference skills that may change over time.

---

## Executive Summary

After researching versioning patterns across npm, Go modules, Cargo, Helm, Homebrew, and Git-based content systems, the **recommended approach** is a **hybrid reference + vendoring model** with these characteristics:

1. **Stacks reference skills by ID + version** (e.g., `frontend/react@1.2.0`)
2. **A stack.lock file** captures exact resolved versions
3. **Optional vendoring** for offline/stable scenarios via `claude stack vendor`
4. **Simple CLI upgrade workflow** to update locked versions

This approach balances simplicity (1-2 day implementation), stability (lockfile protection), and flexibility (upgrade when ready).

---

## The Problem Restated

```
Stack "YOLO Modern React" references:
  - frontend/react
  - frontend/styling
  - frontend/client-state

If frontend/react SKILL.md is modified:
  - Stack may break (instructions changed)
  - User has no control over when changes apply
  - No way to "pin" to a known-working version
```

---

## Research Findings

### 1. How Other Ecosystems Handle This

| Ecosystem          | Approach                               | Key Mechanism                                       | Trade-offs                              |
| ------------------ | -------------------------------------- | --------------------------------------------------- | --------------------------------------- |
| **npm**            | Reference + Lockfile                   | `package-lock.json` captures exact versions         | ✅ Reproducible builds, ❌ Lock drift   |
| **Go**             | Reference + Checksum + Optional Vendor | `go.sum` for integrity, `go mod vendor` for offline | ✅ Flexible, ❌ Two modes to understand |
| **Cargo**          | Reference + Lockfile + Vendor          | `Cargo.lock` + `cargo vendor --versioned-dirs`      | ✅ Best of both worlds                  |
| **Helm**           | Reference + Chart.lock                 | Digest hash detects drift                           | ✅ CI-friendly, ❌ Chart.lock conflicts |
| **Homebrew**       | Extract to personal tap                | `brew extract --version` copies formula             | ✅ Full control, ❌ Manual maintenance  |
| **Git submodules** | Reference by commit                    | Points to exact commit SHA                          | ✅ Immutable, ❌ Complex workflows      |

### 2. Vendoring (Copy-Paste) Analysis

**What "Vendoring" Means:**

- Copy the entire skill content into your stack's directory
- Your stack has its own frozen copy
- Source skill updates don't affect you

**Pros of Vendoring:**

- Complete isolation from upstream changes
- Works offline (no registry lookup needed)
- Simple mental model ("it's all in my folder")
- No version resolution complexity

**Cons of Vendoring:**

- Repository bloat (duplicated content across stacks)
- No automatic security/bug fix updates
- Manual diff/merge for upgrades
- Harder to track "what version is this?"
- Anti-pattern at scale (see [GitHub Gist: "Vendoring is a vile anti-pattern"](https://gist.github.com/datagrok/8577287))

**When Vendoring Makes Sense:**

- Air-gapped environments
- Regulatory requirements for immutable artifacts
- Very slow-changing dependencies
- When you intend to modify the vendored content

### 3. Reference + Lockfile Analysis

**How It Works:**

- Stack file references `frontend/react@^1.0.0` (version constraint)
- On `claude stack install`, resolver finds latest matching version
- `stack.lock` records exact version: `frontend/react@1.2.3`
- Subsequent builds use lockfile versions (reproducible)

**Pros:**

- Lightweight (no content duplication)
- Automatic patch updates when you choose
- Clear audit trail (lockfile shows exactly what you're using)
- Industry-standard pattern (npm, Cargo, Helm)

**Cons:**

- Requires registry/index of versions
- Network dependency for initial resolution
- Must trust registry integrity

### 4. The Hybrid Approach (Recommended)

Based on Cargo's model, combine both:

```
Default: Reference + Lockfile
├── Stack references skills by version constraint
├── Lockfile captures exact resolved versions
├── Updates happen explicitly via CLI
└── Reproducible without vendoring

Optional: Vendor on demand
├── `claude stack vendor` copies skills locally
├── Offline builds work with `--vendored` flag
├── Useful for CI caching, air-gapped deployments
└── Version info preserved in vendored files
```

---

## Recommended Versioning Scheme

### For Skill Files (Markdown with Frontmatter)

Skills already have YAML frontmatter. Add a `version` field:

```yaml
---
name: React
description: Component architecture, hooks, patterns
version: 1.2.0
---
# React Components
```

**Version Format:** Simple semantic versioning (MAJOR.MINOR.PATCH)

| Change Type                                 | Example          | Version Bump |
| ------------------------------------------- | ---------------- | ------------ |
| Breaking change (instructions incompatible) | Remove a pattern | MAJOR        |
| New feature (additive)                      | Add new pattern  | MINOR        |
| Fix/clarification (no behavior change)      | Fix typo         | PATCH        |

**Why Not CalVer or Git SHA?**

- CalVer (2025.01.09) doesn't communicate breaking changes
- Git SHAs are not human-readable
- SemVer is universally understood

### For Stack Files

Stacks declare skill dependencies with version constraints:

```yaml
# stack.yaml
name: yolo-modern-react
version: 1.0.0
description: Modern React with Zustand and React Query
author: '@vincentbollaert'

skills:
  - frontend/react@^1.0.0 # Accept 1.x.x
  - frontend/styling@~1.2.0 # Accept 1.2.x
  - frontend/client-state@1.3.0 # Exact version
```

**Version Constraint Operators:**

| Operator  | Meaning                           | Example                            |
| --------- | --------------------------------- | ---------------------------------- |
| `^1.2.0`  | Compatible with 1.2.0 (any 1.x.x) | ^1.2.0 matches 1.2.0, 1.3.0, 1.9.9 |
| `~1.2.0`  | Approximately 1.2.0 (any 1.2.x)   | ~1.2.0 matches 1.2.0, 1.2.5        |
| `1.2.0`   | Exactly 1.2.0                     | Only 1.2.0                         |
| `>=1.2.0` | 1.2.0 or higher                   | 1.2.0, 2.0.0, 5.0.0                |
| `*`       | Any version                       | Latest available                   |

### For the Lockfile

```yaml
# stack.lock
# Auto-generated. Do not edit manually.
# Run `claude stack update` to regenerate.

lockfile_version: 1
generated: 2025-01-09T10:30:00Z
digest: sha256:abc123... # Hash of stack.yaml skills section

resolved:
  frontend/react:
    version: 1.2.3
    source: registry # or "local" or "git"
    integrity: sha256:def456... # Hash of skill content
    resolved_at: 2025-01-09T10:30:00Z

  frontend/styling:
    version: 1.2.1
    source: registry
    integrity: sha256:ghi789...
    resolved_at: 2025-01-09T10:30:00Z

  frontend/client-state:
    version: 1.3.0
    source: registry
    integrity: sha256:jkl012...
    resolved_at: 2025-01-09T10:30:00Z
```

---

## Upgrade Workflow Design

### CLI Commands

```bash
# Install skills for a stack (creates/uses lockfile)
claude stack install

# Check for available updates
claude stack outdated
# Output:
# frontend/react     1.2.3 → 1.3.0 (minor update available)
# frontend/styling   1.2.1 → 2.0.0 (MAJOR update available!)

# Update all skills to latest matching constraints
claude stack update

# Update specific skill
claude stack update frontend/react

# Update beyond constraints (interactive confirmation for major bumps)
claude stack update frontend/styling --latest
# ⚠️  frontend/styling 2.0.0 is a MAJOR update (breaking changes possible)
#    View changelog: https://registry.example.com/frontend/styling/changelog
#    Continue? [y/N]

# Vendor skills for offline use
claude stack vendor
# Creates: .claude/vendor/frontend/react/SKILL.md (with version metadata)

# Build with vendored skills
claude stack build --vendored
```

### Upgrade Safety

1. **Lock by default**: `claude stack install` respects lockfile
2. **Explicit updates**: Must run `claude stack update` to get new versions
3. **Major version warnings**: Prompt before applying breaking changes
4. **Changelog integration**: Link to skill changelog for review
5. **Dry-run mode**: `claude stack update --dry-run` shows what would change

---

## Implementation Plan (1-2 Days)

### Day 1: Core Schema and Local Resolution

**Morning:**

1. Add `version` field to skill frontmatter schema
2. Add version to existing skills (start at 1.0.0)
3. Create `stack.yaml` schema with skill references
4. Create `stack.lock` schema

**Afternoon:**

1. Implement version constraint parser (handle ^, ~, exact)
2. Implement local resolver (find matching versions from local skills)
3. Implement lockfile generator
4. Add `claude stack install` command

### Day 2: Update Workflow and Vendoring

**Morning:**

1. Implement `claude stack outdated` (diff lockfile vs available)
2. Implement `claude stack update` with version constraint logic
3. Add major version warning prompts

**Afternoon:**

1. Implement `claude stack vendor` (copy with metadata)
2. Implement `--vendored` flag for builds
3. Add integrity hash calculation and verification
4. Write documentation

---

## Schema Examples

### Skill Schema (Updated)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Skill Definition",
  "type": "object",
  "required": ["name", "description", "version"],
  "properties": {
    "name": {
      "type": "string",
      "description": "Display name for the skill"
    },
    "description": {
      "type": "string",
      "description": "Brief description of the skill"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Semantic version (MAJOR.MINOR.PATCH)"
    },
    "changelog": {
      "type": "string",
      "description": "URL to changelog or inline changelog text"
    },
    "deprecated": {
      "type": "boolean",
      "description": "Whether this skill version is deprecated"
    },
    "deprecated_message": {
      "type": "string",
      "description": "Migration message if deprecated"
    }
  }
}
```

### Stack Schema (New)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Stack Definition",
  "type": "object",
  "required": ["name", "version", "skills"],
  "properties": {
    "name": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "description": "Stack identifier (kebab-case)"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Stack version"
    },
    "description": {
      "type": "string",
      "description": "What this stack is for"
    },
    "author": {
      "type": "string",
      "description": "Stack author (e.g., @username)"
    },
    "skills": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[a-z-]+/[a-z-]+(@.+)?$",
        "description": "Skill reference with optional version constraint"
      },
      "minItems": 1,
      "description": "List of skill dependencies"
    },
    "agents": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Optional list of bundled agents"
    }
  }
}
```

### Complete Example: Stack with Lockfile

**`stacks/yolo-modern-react/stack.yaml`:**

```yaml
name: yolo-modern-react
version: 1.0.0
description: |
  Modern React stack with Zustand for state, React Query for server data,
  and SCSS Modules + cva for styling. Philosophy: "Move fast, type safe."
author: '@vincentbollaert'
skills:
  - frontend/react@^1.0.0
  - frontend/styling@^1.0.0
  - frontend/client-state@^1.0.0
  - frontend/api@^1.0.0
  - frontend/testing@^1.0.0

agents:
  - frontend-developer
  - frontend-reviewer
```

**`stacks/yolo-modern-react/stack.lock`:**

```yaml
lockfile_version: 1
generated: 2025-01-09T14:30:00Z
digest: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

resolved:
  frontend/react:
    version: 1.2.3
    source: local
    path: .claude/skills/frontend-react/SKILL.md
    integrity: sha256:a1b2c3d4...
    resolved_at: 2025-01-09T14:30:00Z

  frontend/styling:
    version: 1.1.0
    source: local
    path: .claude/skills/frontend-styling/SKILL.md
    integrity: sha256:e5f6g7h8...
    resolved_at: 2025-01-09T14:30:00Z

  frontend/client-state:
    version: 1.0.5
    source: local
    path: .claude/skills/frontend-client-state/SKILL.md
    integrity: sha256:i9j0k1l2...
    resolved_at: 2025-01-09T14:30:00Z

  frontend/api:
    version: 1.3.0
    source: local
    path: .claude/skills/frontend-api/SKILL.md
    integrity: sha256:m3n4o5p6...
    resolved_at: 2025-01-09T14:30:00Z

  frontend/testing:
    version: 1.0.0
    source: local
    path: .claude/skills/frontend-testing/SKILL.md
    integrity: sha256:q7r8s9t0...
    resolved_at: 2025-01-09T14:30:00Z
```

---

## Trade-off Analysis

### Option A: Full Vendoring (Copy Entire Skill)

| Aspect           | Assessment                              |
| ---------------- | --------------------------------------- |
| **Simplicity**   | ✅ Very simple - just copy files        |
| **Stability**    | ✅ Fully isolated                       |
| **Repo size**    | ❌ Bloats with duplicates               |
| **Updates**      | ❌ Manual diff/merge                    |
| **Tracking**     | ❌ Hard to know "what version is this?" |
| **Recommended?** | No (as default)                         |

### Option B: Reference + Lockfile (Recommended)

| Aspect           | Assessment                                |
| ---------------- | ----------------------------------------- |
| **Simplicity**   | ✅ Lightweight references                 |
| **Stability**    | ✅ Lockfile ensures reproducibility       |
| **Repo size**    | ✅ Minimal (just stack.yaml + stack.lock) |
| **Updates**      | ✅ CLI-driven, controlled                 |
| **Tracking**     | ✅ Clear version in lockfile              |
| **Recommended?** | Yes (as default)                          |

### Option C: Hybrid (Reference + Lockfile + Optional Vendor)

| Aspect           | Assessment                                 |
| ---------------- | ------------------------------------------ |
| **Simplicity**   | ⚠️ More concepts, but optional             |
| **Stability**    | ✅ Best of both worlds                     |
| **Repo size**    | ✅ Vendor is opt-in                        |
| **Updates**      | ✅ CLI handles both modes                  |
| **Tracking**     | ✅ Vendored files include version metadata |
| **Recommended?** | Yes (for maximum flexibility)              |

---

## Conclusion

**Recommended Approach: Hybrid (Option C)**

1. **Default behavior**: Reference + Lockfile

   - Simple `stack.yaml` with version constraints
   - `stack.lock` for reproducibility
   - `claude stack update` for controlled upgrades

2. **Opt-in vendoring**: For special cases

   - `claude stack vendor` for offline/air-gapped needs
   - Vendored files include version metadata
   - Build with `--vendored` flag

3. **Git as source of truth**:
   - Commit both `stack.yaml` and `stack.lock`
   - Lockfile ensures everyone gets same versions
   - CI can validate lockfile is up-to-date

This approach mirrors the industry-standard patterns from npm, Cargo, and Helm while remaining simple enough to implement in 1-2 days.

---

## Sources

- [Cargo: Predictable Dependency Management](https://blog.rust-lang.org/2016/05/05/cargo-pillars/)
- [cargo vendor Documentation](https://doc.rust-lang.org/cargo/commands/cargo-vendor.html)
- [Cargo.toml vs Cargo.lock](https://doc.rust-lang.org/cargo/guide/cargo-toml-vs-cargo-lock.html)
- [Helm Chart Dependencies](https://helm.sh/docs/helm/helm_dependency/)
- [GitHub Docs: Using YAML Frontmatter](https://docs.github.com/en/contributing/writing-for-github-docs/using-yaml-frontmatter)
- [GitHub Docs: Versioning Documentation](https://docs.github.com/en/contributing/writing-for-github-docs/versioning-documentation)
- [Homebrew Formula Versions](https://docs.brew.sh/Versions)
- [Git Submodules vs Vendoring](https://blog.timhutt.co.uk/against-submodules/)
