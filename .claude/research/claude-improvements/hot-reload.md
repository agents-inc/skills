# Skills Hot Reload

> **Feature**: Skills activate immediately without restarting Claude Code
> **Introduced**: Claude Code v2.1.0 (January 2026)
> **Priority**: LOW (already built-in)
> **Status**: Research Complete

---

## What It Is

Skills in `~/.claude/skills` or `.claude/skills` now activate immediately when created or modified. No need to restart Claude Code sessions.

## Why It Matters For Us

**Previous Behavior:**

- Create/modify a skill
- Restart Claude Code session
- Test the skill
- Repeat

**Current Behavior:**

- Create/modify a skill
- Skill is immediately available
- Test in same session
- Iterate faster

## How It Works

Claude Code watches the skills directories:

- `~/.claude/skills/` (user-level)
- `./.claude/skills/` (project-level)

When files change:

1. Claude Code detects the modification
2. Skill is reloaded into memory
3. Available immediately for next invocation

## Directories Watched

| Directory                | Scope               | Hot Reload |
| ------------------------ | ------------------- | ---------- |
| `~/.claude/skills/`      | User (all projects) | Yes        |
| `./.claude/skills/`      | Project             | Yes        |
| Nested `.claude/skills/` | Package (monorepo)  | Yes        |

### Nested Skills Discovery (v2.1.0)

For monorepos, Claude Code also discovers skills in nested directories:

```
my-monorepo/
├── .claude/skills/          # Root skills
├── packages/
│   ├── frontend/
│   │   └── .claude/skills/  # Package-specific skills
│   └── backend/
│       └── .claude/skills/  # Package-specific skills
```

When working in `packages/frontend/`, skills from both root and `packages/frontend/.claude/skills/` are available.

## Development Workflow

### Before Hot Reload

```
1. Edit skill in editor
2. Ctrl+C to stop Claude Code
3. Restart Claude Code
4. Test skill
5. Find bug
6. Repeat from step 1
```

### With Hot Reload

```
1. Edit skill in editor
2. Save file
3. Test skill immediately
4. Find bug
5. Edit and save
6. Test again (no restart)
```

## Implications for Our System

### Plugin Development

When developing plugins locally:

```bash
# Compile plugin to local .claude/skills/
bun src/cli/index.ts compile-plugins --output .claude/skills/

# Skills immediately available - test in active session
```

### Skill Iteration

For skill authors:

1. Work directly in `.claude/skills/` during development
2. Skills update immediately on save
3. Move to `src/skills/` when finalized

### Stack Development

When testing stack compilation:

```bash
# Compile stack
bun src/cli/index.ts compile-stack -s work-stack

# If output goes to .claude/, skills hot reload
# Agents still need session restart
```

**Note:** Hot reload applies to skills. Agents may still require session restart.

## Best Practices

### 1. Develop in Skills Directory

For rapid iteration, edit directly in `.claude/skills/`:

```bash
# Create skill directly
mkdir -p .claude/skills/my-new-skill
touch .claude/skills/my-new-skill/SKILL.md
# Edit and test immediately
```

### 2. Use Local Project Skills

For project-specific testing:

```
my-project/
└── .claude/
    └── skills/
        └── test-skill/
            └── SKILL.md  # Hot reloads on save
```

### 3. Symlink for Shared Development

```bash
# Symlink source skill to .claude for hot reload
ln -s $(pwd)/src/skills/frontend/react\ \(@vince\)/ .claude/skills/react
```

## Limitations

1. **Skills only** - Agents don't hot reload (require session restart)
2. **Syntax errors** - Invalid YAML/markdown may break loading
3. **Cache** - Some caching may delay updates slightly
4. **MCP tools** - Not available in background contexts

## Verifying Hot Reload

1. Create a test skill:

```bash
mkdir -p .claude/skills/test-hot-reload
echo "---
name: Test Hot Reload
description: Testing hot reload
---

# Test Skill

Say 'Hot reload works!' when invoked.
" > .claude/skills/test-hot-reload/SKILL.md
```

2. In active Claude Code session, invoke the skill
3. Modify the skill content
4. Invoke again - should reflect changes

## Related Features

- **Nested Skills Discovery**: Monorepo support
- **Commands Merged into Skills**: Same hot reload applies
- **Context Forking**: Hot-reloaded skills work with forking

## References

- [Claude Code Skills Docs](https://code.claude.com/docs/en/skills)
- [Claude Code v2.1.0 Release Notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.0)
