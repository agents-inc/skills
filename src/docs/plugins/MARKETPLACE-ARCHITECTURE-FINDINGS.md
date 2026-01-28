# Marketplace Architecture Findings

> **Date**: 2026-01-24
> **Status**: Research in progress

---

## Key Discoveries

### 1. Plugin Versioning in Claude Code

- Plugins have `version` field in plugin.json (semver)
- **No install-time version selection** - can't do `plugin@2.0.0`
- Version pinning happens at **marketplace level** via `ref`/`sha`
- Auto-update pulls latest from marketplace

### 2. Marketplace Version Pinning

```json
{
  "name": "skill-react",
  "source": {
    "repo": "owner/repo",
    "ref": "v2.0.0",
    "sha": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0"
  }
}
```

- `ref` = git branch or tag
- `sha` = exact commit for reproducibility
- Marketplace maintainer controls what versions are available

### 3. Dual Marketplace Model

```
Public Marketplace (claude-collective)
├── skills/     → latest versions
├── agents/     → latest versions
└── stacks/     → latest versions

Company/Private Marketplace
├── skills/     → pinned to tested shas
├── agents/     → pinned to tested shas
└── stacks/     → pinned to tested shas
```

**Benefits:**

- Reproducibility across machines
- Guardrails against bad updates
- Company controls approved versions
- `strictKnownMarketplaces` enforces company-only plugins

### 4. Agents as Standalone Plugins

**Old model:** Agents compiled into each stack (duplication)
**New model:** Agents as standalone plugins that reference skills

```
~/.claude/plugins/
├── collective-agents/     # All agents (one copy)
│   └── agents/
├── my-stack/              # Just skills
│   └── skills/
└── another-stack/         # Different skills
    └── skills/
```

- `cc switch my-stack` recompiles agents with that stack's skills
- No duplication of agents across stacks
- Agent updates benefit everyone

### 5. Skill-Agent Binding

- Agents don't embed skills - they reference them by name
- Skills loaded on-demand by Claude Code
- Frontmatter `skills:` preloads specific skills
- Binding happens at switch/compile time

---

## Open Questions

### To Research: Community Marketplaces

1. Do existing marketplaces use version pinning?
2. How do they handle updates?
3. Do any support private/company forks?
4. What's the common structure?

### Marketplaces to Investigate

From `.claude/research/claude-code-mcp-plugins-ecosystem.md`:

- wshobson/agents (67 plugins, 99 agents)
- ccplugins/marketplace
- kivilaid/plugin-marketplace (100+ plugins)
- claudebase/marketplace
- anthropics/claude-plugins-official

---

## Architecture Implications

### Plugin Types

| Type  | Contains                    | Versioned? |
| ----- | --------------------------- | ---------- |
| Skill | Technology knowledge        | Yes        |
| Agent | Workflow + skill references | Yes        |
| Stack | Curated skill collection    | Yes        |

### Version Independence

- No cascading bumps
- Each type versioned independently
- Compatibility managed by marketplace maintainer

### Company Workflow

1. Fork/mirror public plugins
2. Create company marketplace.json with pinned shas
3. Review and test before updating shas
4. Employees use company marketplace
5. `strictKnownMarketplaces` enforces policy

---

## Next Steps

- [x] Research community marketplaces structure → See `COMMUNITY-MARKETPLACE-RESEARCH.md`
- [ ] Validate dual-marketplace model works in practice
- [ ] Update architecture docs
- [ ] Implement new plugin structure
