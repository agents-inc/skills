# Skill Forking Research: "Automatic Forking" for Stack Marketplace

> **Purpose**: Deep analysis of the "automatic forking" approach where selecting a skill clones it into your stack folder, completely disconnected from the original.

---

## Executive Summary

After researching vendoring patterns (Go, Cargo), forking workflows (GitHub, WordPress), template generators (Cookiecutter, Yeoman, create-t3-app), and eject patterns (Create React App), the **automatic forking approach is valid but requires careful design**.

**Recommendation**: Implement automatic forking with **provenance metadata** - a simpler model than reference + lockfile, better suited for "hyper-focused stacks that deviate from originals."

### Key Findings

1. **Automatic forking IS a recognized pattern** - called "vendoring" in Go/Cargo, "ejecting" in CRA, and "templating" in Cookiecutter/Yeoman
2. **Divergence is a feature, not a bug** - when the use case is customization over updates
3. **Provenance metadata is essential** - track what the fork was based on, even if disconnected
4. **Versioning shifts to the stack level** - forked skills don't need independent versions
5. **Comparison tooling is a differentiator** - this is where you can add unique value

---

## The Proposed Model Analyzed

### User's Description

```
When you create a stack and select a skill:
1. Skill gets cloned/forked into your stack folder
2. The fork is completely disconnected from the original
3. No notifications when the original is updated
4. You can modify your forked copy however you want
5. Original and fork evolve independently
```

### Classification

This is a **"vendor-and-forget"** or **"template instantiation"** pattern. It's well-established in:

| Pattern               | Example                                     | Similarity                             |
| --------------------- | ------------------------------------------- | -------------------------------------- |
| **Go vendoring**      | `go mod vendor` copies dependencies         | High - copies code, loses updates      |
| **CRA ejecting**      | `npm run eject` copies webpack config       | High - one-way, full ownership         |
| **GitHub templates**  | "Use this template" creates new repo        | High - disconnected from source        |
| **Cookiecutter**      | `cookiecutter <template>` scaffolds project | Exact match - template instantiation   |
| **WordPress forking** | Copy theme, customize completely            | High - when child themes won't suffice |

---

## Research Question 1: Is This a Good Pattern?

### Successful Examples of "Fork and Forget"

#### 1. Cookiecutter / Yeoman Templates

**How it works**: User selects a template, answers prompts, gets generated project. No connection to original template.

**Why it works**:

- Clear ownership: "this is YOUR project now"
- No upstream surprises
- Full customization freedom
- Simple mental model

**Adoption**: Cookiecutter has 22,000+ GitHub stars, Yeoman 9,600+ stars

**Source**: [Cookiecutter Documentation](https://cookiecutter.readthedocs.io/), [Yeoman.io](https://yeoman.io/)

#### 2. Create React App Eject

**How it works**: `npm run eject` copies all build tooling into your project. One-way operation, no going back.

**Why it works**:

- Gives full control when needed
- "Escape hatch" philosophy
- Used by serious customizers

**Notable**: CRA team explicitly says "you don't have to ever use eject" - it's for power users who need customization

**Lesson**: Fork-and-forget is best for users who WANT to customize, not everyone

#### 3. GitHub Template Repositories

**How it works**: Click "Use this template" creates a new repository with no commit history connection.

**Why GitHub added this** (vs traditional forking):

- Clean commit history (starts fresh)
- No upstream PR relationship
- No "fork network" clutter
- Template nature is explicit

**Quote from GitHub**: "A new fork includes the entire commit history of the parent repository, while a repository created from a template starts with a single commit."

**Source**: [GitHub Docs: About Forks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/about-forks)

#### 4. Go Module Vendoring

**How it works**: `go mod vendor` copies all dependencies into `vendor/` directory.

**Why developers use it**:

- Offline builds
- No external dependency at build time
- Complete control
- Used by: Kubernetes, VictoriaMetrics, Docker/Moby

**Source**: [VictoriaMetrics on Vendoring](https://victoriametrics.com/blog/vendoring-go-mod-vendor/)

### Problems Fork-and-Forget Solves

| Problem                       | How Forking Solves It            |
| ----------------------------- | -------------------------------- |
| "Upstream broke my stack"     | Impossible - you're disconnected |
| Version resolution conflicts  | None - just files in folder      |
| Network dependency            | None - everything local          |
| Lockfile merge conflicts      | No lockfiles                     |
| "I need to modify this skill" | Go ahead, it's yours             |
| Complex tooling               | Simple - just files              |

### Problems Fork-and-Forget Creates

| Problem                             | Severity | Mitigation                                 |
| ----------------------------------- | -------- | ------------------------------------------ |
| No automatic security updates       | **High** | Manual audit reminders, comparison tooling |
| No automatic bug fixes              | Medium   | Comparison tooling shows delta             |
| Repository bloat                    | Low      | Skills are markdown, small                 |
| "What was this based on?" confusion | Medium   | **Provenance metadata**                    |
| Ecosystem fragmentation             | Low      | Actually a feature for hyper-customization |

---

## Research Question 2: Versioning in a Fork-First Model

### Does Versioning Still Make Sense?

**For the ORIGINAL skills in the registry**: Yes, still version them.

```yaml
# Registry skill (original source)
---
name: React
version: 1.2.0 # Still useful for: new stack creators, comparison, changelogs
---
```

**For the FORKED skills in your stack**: No independent version needed.

```yaml
# Forked skill (in your stack)
---
name: React
forked_from:
  source: registry/frontend/react
  version: 1.2.0
  date: 2025-01-09
---
# Your modifications below...
```

### Why Forked Skills Don't Need Versions

1. **The stack itself is versioned** - `stack.yaml` has a version, not each forked skill
2. **Git provides versioning** - your stack repo's commit history tracks skill changes
3. **No consumers** - no one else depends on your forked skill
4. **Simpler** - one less concept to manage

### Provenance Metadata: The Key Insight

Even without active version tracking, you MUST know:

```yaml
---
name: React
description: Component architecture, hooks, patterns

# PROVENANCE (essential for fork-first model)
forked_from:
  skill: frontend/react # Original skill identifier
  version: 1.2.0 # Version at time of fork
  date: 2025-01-09 # When forked
  registry: marketplace # Where it came from (or "local")

# CUSTOMIZATION TRACKING (optional but helpful)
modified: true # Has user edited this?
modified_date: 2025-01-15 # Last modification
---
```

This metadata enables:

- "What was this based on?" answer
- Comparison tooling ("show diff from original 1.2.0")
- Upgrade assistance ("1.3.0 is available, here's what changed")

---

## Research Question 3: Is Divergence a Feature or Bug?

### The User's Insight

> "Stacks will become hyper-focused and deviate from originals"
> "Many slightly different skills might not be ideal"

### Analysis: It Depends on the Use Case

#### Divergence as a FEATURE (Your Case)

**When customization is the goal**:

- Users want to tailor skills to their specific philosophy
- "YOLO Modern React" has different opinions than "Conservative React"
- Skills are instructions, not code - personalization makes sense
- WordPress theme forking: when child themes can't achieve the customization

**Evidence from WordPress community**:

> "When there was no way to get what was wanted from a theme without editing the functions.php file, a lot of the CSS, and a ton of the images... forking becomes the right approach."

**Source**: [Half Elf: To Fork or Not to Fork](https://halfelf.org/2013/to-fork-or-not-to-fork/)

#### Divergence as a BUG

**When shared maintenance is the goal**:

- Security fixes need to propagate
- Bug fixes need to propagate
- Community improvements benefit everyone

**Example where forking failed**: WordPress theme forking

> "Forking themes worked well until the parent theme was rewritten with responsiveness, security, and other updates. They were not able to update the forked themes, losing the benefit of having the WordPress community improve the code for their sites."

### Verdict for Skill Marketplace

**Divergence is a FEATURE** because:

1. **Skills are markdown instructions**, not executable code with security vulnerabilities
2. **The goal is philosophical customization** - different stacks for different opinions
3. **Users explicitly want ownership** - "completely disconnected"
4. **No security implications** - skills don't execute, they instruct

**BUT** provide tools to optionally compare/update if user wants.

---

## Research Question 4: Comparison Tooling

### Why This Matters

User mentioned: "tooling to compare different skills with pros and cons"

Without active links, comparison tooling becomes your **primary value-add** for the fork-first model.

### Proposed Comparison Features

#### 1. Diff from Original

```bash
claude skill diff frontend/react

# Output:
# frontend/react in your stack vs registry v1.2.0
#
# --- registry/frontend/react@1.2.0
# +++ your-stack/frontend/react
#
# @@ -45,6 +45,10 @@
#  ## Component Patterns
#  - Prefer functional components
# +- Always use forwardRef for interactive elements
# +- Expose className prop on all components
#  - Use hooks for state and effects
```

#### 2. Available Updates

```bash
claude skill updates

# Output:
# Skill              Your Base    Latest      Changes Summary
# frontend/react     1.2.0        1.4.0       +2 patterns, -1 deprecated
# frontend/styling   1.0.0        1.0.3       Bug fixes only
# frontend/testing   2.0.0        2.0.0       Up to date
```

#### 3. Stack Comparison

```bash
claude stack compare "yolo-modern-react" "conservative-react"

# Output:
# Comparing stacks:
#
# Skill         yolo-modern-react        conservative-react
# styling       SCSS Modules + cva       CSS Modules only
# state         Zustand + React Query    Redux Toolkit
# testing       Vitest + RTL             Jest + RTL
#
# Philosophy differences:
# - yolo: "Move fast, type safe"
# - conservative: "Battle-tested patterns only"
```

#### 4. Merge Assistant

```bash
claude skill merge frontend/react --from=registry@1.4.0

# Interactive merge tool:
#
# New content in 1.4.0:
#   + Server Component patterns
#   + use() hook guidance
#
# Your customizations:
#   ~ Modified forwardRef guidance
#   + Added className prop requirement
#
# Options:
#   1. Keep yours (skip update)
#   2. Take theirs (lose customizations)
#   3. Manual merge (open in editor)
```

### Metadata for Comparison

For comparison tooling to work, both registy and forked skills need:

```yaml
# Registry skill
---
name: React
version: 1.4.0
changelog_url: https://marketplace.example/frontend/react/changelog
checksum: sha256:abc123... # Content hash for diff detection
---
# Forked skill
---
name: React
forked_from:
  skill: frontend/react
  version: 1.2.0
  checksum: sha256:def456... # Original content hash
custom_checksum: sha256:xyz789... # Current content hash
---
```

---

## Research Question 5: Benefits of Simpler Model

### Complexity Comparison

| Aspect                 | Reference + Lockfile          | Automatic Forking          |
| ---------------------- | ----------------------------- | -------------------------- |
| Files to manage        | stack.yaml + stack.lock       | stack.yaml + forked skills |
| Version resolution     | Complex (constraints, ranges) | None                       |
| Update workflow        | `claude stack update`         | Manual or opt-in merge     |
| Merge conflicts        | Lockfile conflicts in PRs     | None                       |
| Offline support        | Needs vendor step             | Built-in                   |
| Debugging              | "Why did it resolve to this?" | WYSIWYG                    |
| New user understanding | Must learn lockfiles          | Files in folder            |

### When Simpler Wins

The fork-first model wins when:

- **Customization is expected** (your case)
- **Updates are infrequent** (skills are stable documents)
- **User wants ownership** (explicitly stated)
- **Security risk is low** (skills are instructions, not code)

### When Reference + Lockfile Wins

The lockfile model wins when:

- Automatic updates are desired
- Dependencies have transitive dependencies
- Security patches must propagate
- Shared maintenance is valuable

### Verdict

**For skills (markdown instructions)**: Fork-first is simpler and sufficient.

**For executable code**: Reference + lockfile is safer.

Skills are markdown instructions - fork-first makes sense.

---

## Research Question 6: Addressing Downsides

### Bug Fixes Don't Propagate

**Mitigation**:

- Comparison tooling shows what changed
- `claude skill updates` command
- Optional: email digest of upstream changes

### Security Issues Don't Propagate

**Assessment**: Low risk for markdown instructions. Skills tell Claude what to do, they don't execute.

**Mitigation**: If skills ever contain executable code (unlikely), reconsider model.

### Repository Bloat

**Assessment**: Skills are markdown files, typically 5-50KB each. A stack with 10 skills = 500KB max.

**Comparison**: npm `node_modules` is often 500MB+. This is negligible.

### "What Was This Based On?"

**Mitigation**: Provenance metadata (see above).

```yaml
forked_from:
  skill: frontend/react
  version: 1.2.0
  date: 2025-01-09
```

---

## Recommended Implementation

### Stack Structure

```
my-stack/
├── stack.yaml              # Stack metadata
├── skills/                 # Forked skills live here
│   ├── react/
│   │   └── SKILL.md       # Forked, includes provenance
│   ├── styling/
│   │   └── SKILL.md
│   └── testing/
│       └── SKILL.md
└── agents/                 # Optional bundled agents
    └── developer.md
```

### Stack.yaml (Simplified)

```yaml
name: yolo-modern-react
version: 1.0.0
description: Modern React with Zustand and React Query
author: '@vincentbollaert'

# Skills are listed, but the files are in skills/ folder
skills:
  - react
  - styling
  - testing

# Optional: agents bundled with the stack
agents:
  - developer
```

### Forked Skill Format

```yaml
---
name: React
description: Component architecture, hooks, patterns

# PROVENANCE (auto-generated on fork)
forked_from:
  skill: frontend/react
  version: 1.2.0
  date: 2025-01-09
  registry: marketplace
  original_checksum: sha256:abc123...

# CUSTOMIZATION (auto-updated on edit)
modified: true
modified_date: 2025-01-15
current_checksum: sha256:xyz789...
---
# React

Your customized React skill content here...
```

### CLI Workflow

```bash
# Create a new stack from registry
claude stack create my-stack

# Interactive: Select skills from marketplace
# > Frontend framework: React
# > Styling approach: SCSS Modules + cva
# > State management: Zustand + React Query
# > Testing: Vitest + React Testing Library
#
# Creating stack 'my-stack'...
# Forking frontend/react@1.2.0...
# Forking frontend/styling@1.1.0...
# Forking frontend/testing@1.0.0...
# Done! Skills copied to my-stack/skills/

# Start using the stack
cd my-stack
claude --stack .

# Later: check for upstream changes
claude skill updates
# Output:
# frontend/react: 1.2.0 → 1.4.0 (minor changes)
# frontend/styling: 1.1.0 → 1.1.0 (up to date)

# Optionally merge upstream changes
claude skill merge react
# Interactive merge tool opens

# Or diff to see what changed
claude skill diff react
```

---

## Versioning Scheme Recommendation

### For Original Skills (in Registry)

**Use SemVer**: `MAJOR.MINOR.PATCH`

| Change Type     | Version Bump | Example          |
| --------------- | ------------ | ---------------- |
| Breaking change | MAJOR        | Remove a pattern |
| New feature     | MINOR        | Add new pattern  |
| Clarification   | PATCH        | Fix typo         |

### For Forked Skills (in Your Stack)

**No independent version**. Tracked by:

1. Stack version (`stack.yaml version: 1.0.0`)
2. Git commits
3. Provenance metadata (`forked_from.version`)

### For Stacks

**Use SemVer** at stack level:

```yaml
name: yolo-modern-react
version: 2.0.0 # Bumped when stack philosophy changes
```

---

## Comparison to Previous Research

### Previous Recommendation: Hybrid (Reference + Lockfile + Optional Vendor)

From SKILL-VERSIONING-RESEARCH.md:

- Default: Reference + Lockfile
- Opt-in: Vendoring for offline

### New Recommendation: Fork-First (with Provenance)

For this specific use case (Stack Marketplace with customization focus):

- Default: Fork on create (auto-vendor)
- Opt-in: Merge from upstream

### Why the Difference?

| Factor       | Previous Research      | Current Proposal    |
| ------------ | ---------------------- | ------------------- |
| Use case     | Skills as dependencies | Skills as templates |
| User intent  | Track updates          | Customize freely    |
| Relationship | Ongoing subscription   | One-time copy       |
| Philosophy   | npm-like               | Cookiecutter-like   |

Both are valid. The user's explicit desire for "completely disconnected" and "hyper-focused stacks that deviate from originals" points to fork-first.

---

## Final Recommendation

### Is automatic forking better than reference + lockfile?

**Yes, for this use case.** The user's stated goals (complete disconnection, modification freedom, independent evolution) align perfectly with fork-first.

### Simplest versioning scheme for forked skills?

**No version on forked skills.** Version only at:

1. Stack level (user controls)
2. Provenance metadata (tracks origin)

### Should there be any connection to the original?

**Yes: Provenance metadata only.** Not an active link, just a record:

- What skill it was forked from
- What version at fork time
- Content hash for comparison tooling

### How would the CLI workflow look?

```bash
# Create stack (forks skills automatically)
claude stack create my-stack

# Use stack
claude --stack my-stack

# Optional: see what's new upstream
claude skill updates

# Optional: merge upstream changes
claude skill merge <skill-name>

# Optional: compare with original
claude skill diff <skill-name>
```

---

## Summary

| Decision                | Recommendation                       |
| ----------------------- | ------------------------------------ |
| Fork vs Reference       | **Fork** (complete copy)             |
| Version forked skills?  | **No** (stack versioned, not skills) |
| Track original version? | **Yes** (provenance metadata)        |
| Active upstream link?   | **No** (disconnected by design)      |
| Comparison tooling?     | **Yes** (key value-add)              |
| Update path?            | **Optional merge** (user-initiated)  |

This model is simpler, aligns with user goals, and follows proven patterns from Cookiecutter, GitHub templates, and Go vendoring.

---

## Sources

- [Cookiecutter Documentation](https://cookiecutter.readthedocs.io/)
- [Yeoman.io](https://yeoman.io/)
- [VictoriaMetrics: What is Vendoring](https://victoriametrics.com/blog/vendoring-go-mod-vendor/)
- [GitHub Docs: About Forks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/about-forks)
- [GitHub Gist: Vendoring is a vile anti-pattern](https://gist.github.com/datagrok/8577287)
- [WordPress Child Themes](https://developer.wordpress.org/themes/advanced-topics/child-themes/)
- [Half Elf: To Fork or Not to Fork](https://halfelf.org/2013/to-fork-or-not-to-fork/)
- [Git Submodule vs Subtree](https://adam-p.ca/blog/2022/02/git-submodule-subtree/)
- [Atlassian: Git Subtree](https://www.atlassian.com/git/tutorials/git-subtree)
- [OpsLevel: Cookiecutter vs Yeoman](https://www.opslevel.com/resources/cookiecutter-vs-yeoman-choosing-the-right-scaffolder-for-your-service)
- [Google Cloud: Dependency Management](https://cloud.google.com/software-supply-chain-security/docs/dependencies)
- [Terraform Module Versioning](https://developer.hashicorp.com/terraform/language/modules/configuration)
