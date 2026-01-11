# TODO

See `.claude/research/findings/FINAL-DECISION.md` for full architectural decisions.

---

## Phase 0A: Co-located Config ✅ COMPLETE

- [x] Created agent.yaml in each of the 16 agent folders
- [x] Deleted registry.yaml
- [x] compile.ts scans directories for agents and skills

---

## Phase 0B: SKILL.md as Source of Truth ✅ COMPLETE

SKILL.md frontmatter is the single source of truth for skill identity. No `id` field - `name` IS the identifier.

### Completed Tasks

- [x] Add frontmatter parser to compile.ts (parse `---` blocks from markdown)
- [x] Update loadAllSkills() to read from SKILL.md frontmatter instead of skill.yaml
- [x] Rename all skill.yaml → metadata.yaml (32 files)
- [x] Remove `id`, `name`, `description` from metadata.yaml files
- [x] Keep in metadata.yaml: category, category_exclusive, author, version, tags, requires, compatible_with, conflicts_with
- [x] Create metadata.schema.json for metadata.yaml validation
- [x] Update types.ts with new interfaces (SkillFrontmatter, SkillMetadataConfig)
- [x] Fixed skill ID mismatches in work profile (react-mobx → react, react-query-mobx → react-query)

### SKILL.md Frontmatter (Final)

```yaml
---
name: frontend/react (@vince) # This IS the identifier
description: Component architecture, hooks, patterns
model: opus # Optional
---
```

### metadata.yaml (Final)

```yaml
category: framework
category_exclusive: true
author: '@vince'
version: '1.0.0'
compatible_with: [...]
conflicts_with: [...]
requires: [...]
tags: [...]
```

---

## Phase 0D: Stack Architecture ✅ COMPLETE

Stacks converted from single YAML files to directories.

### Completed Tasks

- [x] Create stack directory structure: `src/stacks/{stack-id}/`
- [x] Move modern-react.yaml → modern-react/config.yaml
- [x] Move minimal-react.yaml → minimal-react/config.yaml
- [x] Move photoroom-webapp.yaml → photoroom-webapp/config.yaml
- [x] Create CLAUDE.md for each stack (from profiles)
- [x] Update stack config.yaml format (skills as array, not object)
- [x] Update compile.ts to load stacks from directories
- [x] Add template cascade: resolveTemplate(profile, stack)
- [x] Add CLAUDE.md cascade: resolveClaudeMd(profile, stack)
- [x] Update types.ts StackConfig (skills: string[] instead of Record)
- [x] Delete old stack .yaml files

### Stack Directory (Final)

```
src/stacks/{stack-id}/
├── config.yaml           # Stack configuration
├── CLAUDE.md             # Stack conventions
└── agent.liquid          # Optional: stack-specific template
```

---

## Phase 0D.1: Stack Compilation ✅ COMPLETE

Add `--stack` flag to compile.ts for direct stack compilation.

### Completed Tasks

- [x] Add `--stack=<stack-id>` option to compile.ts
- [x] Stack compilation outputs to same `.claude/` directory as profile compilation
- [x] Create `home-stack` - exact 1:1 mapping of current home profile
- [x] Create `work-stack` - exact 1:1 mapping of current work profile
- [x] Simplified home profile (removed explicit skills, standardized prompts)
- [x] Simplified work profile (removed explicit skills, standardized prompts)

### Verification Results

```bash
# Home profile vs home-stack: IDENTICAL ✅
bun src/compile.ts --profile=home && cp -r .claude .claude-profile-home
bun src/compile.ts --stack=home-stack && cp -r .claude .claude-stack-home
diff -rq .claude-profile-home .claude-stack-home  # Empty - no differences

# Work profile vs work-stack: IDENTICAL ✅
bun src/compile.ts --profile=work && cp -r .claude .claude-profile-work
bun src/compile.ts --stack=work-stack && cp -r .claude .claude-stack-work
diff -rq .claude-profile-work .claude-stack-work  # Empty - no differences
```

**Verification complete. Proceeding to Phase 0E.**

---

## Phase 0E: Profile Simplification ✅ MOSTLY COMPLETE

Convert profiles to thin overlays pointing to stacks.

### Completed Tasks

- [x] Simplify home/config.yaml - uses home-stack, no explicit skills
- [x] Simplify work/config.yaml - uses work-stack, no explicit skills
- [x] Keep CLAUDE.md in profiles (optional override) - working
- [x] Remove explicit skill definitions from profile configs
- [x] Update compile.ts to use stack for all skill/agent resolution

### Remaining Tasks (Optional)

- [ ] Support optional agent.liquid in profiles (optional override)
- [ ] Further simplify profile config.yaml (remove agent definitions entirely, use stack defaults)

### Current Profile config.yaml

```yaml
# Profiles still define agents with prompts, but no skills
name: home
stack: home-stack
agents:
  frontend-developer:
    core_prompts: [...]
    ending_prompts: [...]
```

### Future Profile config.yaml (After full simplification)

```yaml
name: home
stack: home-stack
# That's it - all agent/prompt config comes from stack
```

---

## Phase 0C: Skills Truly Atomic ⏳ LAST

Skills reference other domains they shouldn't own. 12 skills need cleanup.

### HIGH Priority (6 skills)

- [x] React - remove SCSS Modules, React Query, Zustand references
- [x] Performance (frontend) - remove React Query, SCSS, Vitest references
- [x] React Query - remove Zustand, MSW references
- [ ] Observability - remove Hono, Drizzle, React references
- [ ] Better Auth - remove Hono, Drizzle references
- [ ] PostHog Analytics - remove Better Auth, Email references

### MEDIUM Priority (6 skills)

- [x] SCSS Modules - remove lucide-react reference
- [x] Zustand - remove React Query reference
- [x] Vitest - remove MSW from description
- [x] MSW - remove React Testing Library references
- [x] Accessibility - remove testing/tooling references
- [ ] Resend Email - use generic "authentication flow" language
- [ ] GitHub Actions - remove React Query, Zustand references

---

## Phase 3: CLI Commands ⏸️ BLOCKED

Blocked until 0B-0E complete.

- [ ] Research CLI framework (commander, oclif, etc.)
- [ ] claude-stacks list
- [ ] claude-stacks use <id>
- [ ] claude-stacks build (wizard)
- [ ] claude-stacks export

---

## Deferred (Future)

- [ ] Copy skills into stacks for independent versioning (after skills stabilize)
- [ ] Stack Arena (side-by-side comparison)
- [ ] Web catalog
- [ ] Community features (upvotes, submissions)

---

## Later

- [ ] Try https://github.com/anthropics/claude-plugins-official/blob/main/plugins/code-simplifier/agents/code-simplifier.md
