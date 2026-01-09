# Claude Code Skill Conventions Research

## Research Summary

This document captures findings on official Claude Code skill structure conventions, folder organization patterns, and recommendations for this project.

---

## 1. Official Claude Code Skill Structure

### Required Files

- **`SKILL.md`** (case-sensitive, required)
  - Must be at the root of each skill folder
  - Contains YAML frontmatter + markdown instructions
  - The **only** required file

### Recommended Directory Structure (Official)

```
my-skill/
├── SKILL.md              # Required: metadata + instructions
├── reference.md          # Optional: detailed API docs (loaded on-demand)
├── examples.md           # Optional: usage examples (loaded on-demand)
├── FORMS.md              # Optional: domain-specific docs
└── scripts/
    ├── helper.py         # Optional: utility scripts (executed, not loaded)
    ├── validate.py
    └── analyze.py
```

### Alternative Advanced Structure

```
my-skill/
├── SKILL.md              # Core prompt and metadata
├── scripts/              # Executable Python/Bash scripts
├── references/           # Documentation loaded into context
└── assets/               # Templates and binary files (referenced, not loaded)
```

### Key Directories Recognized by Claude Code

| Directory                     | Purpose                 | How Loaded                                         |
| ----------------------------- | ----------------------- | -------------------------------------------------- |
| `scripts/`                    | Executable code         | **Executed via Bash**, output only consumes tokens |
| `references/` or `reference/` | Detailed documentation  | **Read into context** when needed                  |
| `assets/`                     | Templates, binary files | **Referenced by path**, not loaded into context    |
| `examples.md` (file)          | Usage examples          | Read on-demand                                     |

---

## 2. Why `SKILL.md` Naming?

### Benefits of the `SKILL.md` Convention

1. **Automatic Discovery**: Claude Code scans for `SKILL.md` files to build the available skills list
2. **Standardized Metadata**: YAML frontmatter is parsed to populate skill name/description
3. **Case-Sensitive**: Must be exactly `SKILL.md` (not `skill.md` or `Skill.md`)
4. **Clear Intent**: Distinguishes skill definition from other markdown files

### Frontmatter Requirements

```yaml
---
name: my-skill-name # Required: lowercase, alphanumeric, hyphens (max 64 chars)
description: What this skill does # Required: used for skill discovery (max 1024 chars)
allowed-tools: Read, Bash, Grep # Optional: comma-separated or YAML list
model: claude-sonnet-4-20250514 # Optional: specific model
context: fork # Optional: "fork" for isolated context
user-invocable: true # Optional: show in slash menu (default: true)
---
```

---

## 3. Progressive Disclosure Architecture

### Three-Tier Loading Model

1. **Tier 1 - Metadata (~100 tokens)**: Only `name` and `description` from frontmatter are pre-loaded
2. **Tier 2 - Full SKILL.md (<5k tokens)**: Loaded when skill is triggered
3. **Tier 3 - Supporting Resources**: Files loaded only when referenced/needed

### Best Practices

- Keep `SKILL.md` under **500 lines** for optimal performance
- Keep references **one level deep** (SKILL.md -> reference files, NOT reference -> reference)
- Use explicit links: `See [FORMS.md](FORMS.md) for form-filling guide`
- For files > 100 lines, include a table of contents at the top

### Anti-Pattern: Deep Nesting

```markdown
# BAD - Too deeply nested

SKILL.md -> advanced.md -> details.md -> actual-info.md

# GOOD - One level deep

SKILL.md -> reference.md
SKILL.md -> examples.md
SKILL.md -> advanced.md
```

---

## 4. Current Project Structure Analysis

### Source Structure (`src/profiles/home/skills/`)

```
skills/
├── frontend/
│   ├── react.md
│   ├── styling.md
│   └── testing.md
├── backend/
│   ├── api.md
│   └── database.md
└── setup/
    └── monorepo.md
```

### Compiled Output (`.claude/skills/`)

```
skills/
├── frontend-react/
│   └── SKILL.md
├── frontend-styling/
│   └── SKILL.md
└── backend-api/
    └── SKILL.md
```

### Current Approach Assessment

| Aspect                 | Current                 | Official Convention                            | Gap         |
| ---------------------- | ----------------------- | ---------------------------------------------- | ----------- |
| Output structure       | Folder per skill        | Folder per skill                               | Aligned     |
| Main file name         | `SKILL.md`              | `SKILL.md`                                     | Aligned     |
| Frontmatter            | Yes (name, description) | Yes (required)                                 | Aligned     |
| Supporting files       | None                    | Optional (reference.md, examples.md, scripts/) | Opportunity |
| Progressive disclosure | All in SKILL.md         | Split across files                             | Opportunity |

---

## 5. Folder-Per-Skill Benefits

### Benefits for Stack Marketplace

1. **Forking**: Each skill is self-contained, easy to fork/customize
2. **Versioning**: Skills can be versioned independently
3. **Composition**: Mix and match skills from different sources
4. **Documentation**: Reference files can include more detail without bloating context

### Benefits for Development

1. **Separation of concerns**: Code examples in `examples.md`, API docs in `reference.md`
2. **Token efficiency**: Large reference docs don't load until needed
3. **Testing**: Scripts can be tested independently
4. **Maintenance**: Update examples without touching core instructions

### Potential Skill Folder Structure

```
frontend-react/
├── SKILL.md              # Core patterns, quick reference
├── examples.md           # Full code examples (loaded on-demand)
├── reference.md          # API reference, full documentation
└── scripts/
    └── scaffold-component.sh  # Component scaffolding script
```

---

## 6. Recommendations

### Short-Term (Keep Current)

The current flat-file approach works well because:

- Skills are already compiled to folder-per-skill structure
- `SKILL.md` naming convention is followed
- Frontmatter is properly formatted
- Content is comprehensive but manageable

### Medium-Term (Consider)

If skills grow beyond 500 lines, consider:

1. **Split large skills**: Extract detailed examples to `examples.md`
2. **Add reference files**: For API documentation or detailed patterns
3. **Update compile.ts**: To copy additional files (examples, references) into skill folders

### Long-Term (Stack Marketplace)

For the Stack Marketplace, folder-per-skill is valuable:

1. **Source structure**: Move from flat files to folders in source

   ```
   skills/frontend/react/
   ├── skill.md           # Main content
   ├── examples.md        # Code examples
   └── reference.md       # Detailed docs
   ```

2. **Compilation**: Copy entire folder structure

   ```
   .claude/skills/frontend-react/
   ├── SKILL.md           # Compiled from skill.md
   ├── examples.md        # Copied as-is
   └── reference.md       # Copied as-is
   ```

3. **Benefits**:
   - Users can fork entire skill folders
   - Add custom examples without modifying core skill
   - Include utility scripts for common operations

---

## 7. Sources

### Official Documentation

- [Agent Skills - Claude Code Docs](https://code.claude.com/docs/en/skills)
- [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Anthropic Skills Repository](https://github.com/anthropics/skills)

### Community Resources

- [Claude Agent Skills: A First Principles Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)
- [Inside Claude Code Skills](https://mikhail.io/2025/10/claude-code-skills/)
- [Awesome Claude Skills](https://github.com/travisvn/awesome-claude-skills)
- [Claude Code Showcase](https://github.com/ChrisWiles/claude-code-showcase)

---

## 8. Key Takeaways

1. **Official structure is folder-per-skill with `SKILL.md`** - Current compilation is aligned
2. **Progressive disclosure is the key pattern** - Split large content into reference files
3. **Scripts are executed, not loaded** - Include utility scripts without context cost
4. **One level deep for references** - Avoid deeply nested file references
5. **Keep SKILL.md under 500 lines** - Use separate files for detailed content
6. **Current structure works** - No immediate changes needed
7. **Folder-per-skill enables marketplace** - Good foundation for Stack Marketplace
