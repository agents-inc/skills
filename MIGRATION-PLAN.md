# CLI Migration Plan

## Repository Split

- **claude-collective/cli**: CLI tool, installed via npm
- **claude-collective/skills**: Skills content, fetched via giget

## Schema Distribution

### CLI Repository (output schemas)

| Schema                      | Reason                                              |
| --------------------------- | --------------------------------------------------- |
| `agent.schema.json`         | CLI compiles agents - producer owns output contract |
| `stack.schema.json`         | CLI creates/manages stacks                          |
| `skills-matrix.schema.json` | CLI loads and validates matrix                      |

### Skills Repository (input schemas)

| Schema                          | Reason                               |
| ------------------------------- | ------------------------------------ |
| `metadata.schema.json`          | Validates contributor skill metadata |
| `skill-frontmatter.schema.json` | Validates contributor SKILL.md files |

## Configuration System (Done)

- Source resolution: `--source` flag > `CC_SOURCE` env > project config > global config > default
- Default source: `github:claude-collective/skills`
- Local dev mode auto-detected when running from skills repo
- Remote fetching via giget with caching

**Commands:**

- `cc config show` - Show effective config with precedence
- `cc config set/unset` - Global config (`~/.claude-collective/config.yaml`)
- `cc config set-project/unset-project` - Project config (`.claude-collective/config.yaml`)
- `cc config get/path` - Query config values and paths

## Cache Strategy

No explicit cache management. giget handles caching internally. Users can:

- Use `--refresh` flag to force fresh fetch
- Delete `~/.cache/claude-collective/` manually if needed

## Remaining Tasks

- [ ] Update `schema-validator.ts` to load schemas from source path
- [ ] Test CLI with remote source (not just local dev mode)
- [ ] Set up npm package `@claude-collective/cli`
- [ ] Create GitHub releases workflow
- [ ] Update documentation for standalone CLI usage
