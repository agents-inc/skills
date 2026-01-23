# Claude Collective

A plugin distribution system for Claude Code. Compile skills into distributable plugins with the CLI, or install from the marketplace.

## Quick Start

### Install from Marketplace

```bash
# Add marketplace (one time)
/plugin marketplace add claude-collective/skills

# Install individual skills
/plugin install skill-react@claude-collective
/plugin install skill-zustand@claude-collective

# Or install a pre-built stack
/plugin install stack-fullstack-react@claude-collective
```

### Build Custom Stack

```bash
# Interactive wizard
npx @claude-collective/cli init --name my-stack --plugin

# Select skills through the wizard, outputs to ~/.claude/plugins/my-stack
```

---

## What's Included

- **83 skill plugins** covering frontend, backend, testing, mobile, and more
- **Pre-built stacks** with agents and curated skill combinations
- **CLI** for building custom stacks and managing plugins

### Skill Categories

| Category | Skills | Examples                                |
| -------- | ------ | --------------------------------------- |
| Frontend | 33     | React, Vue, Angular, Next.js, Remix     |
| Backend  | 12     | Hono, Express, Fastify, Drizzle, Prisma |
| Testing  | 8      | Vitest, Playwright, Cypress, RTL        |
| API      | 12     | React Query, tRPC, GraphQL, WebSocket   |
| Mobile   | 3      | React Native, Expo                      |
| Tooling  | 6      | ESLint, Prettier, Vite, Turborepo       |

See [marketplace README](./.claude-plugin/README.md) for the full list.

---

## Plugin System

### Architecture

Each skill compiles into its own plugin:

```
skill-react/
  .claude-plugin/
    plugin.json         # Plugin manifest
  skills/
    react/
      SKILL.md          # Skill content
  README.md
```

Stacks bundle multiple skills with pre-configured agents:

```
stack-fullstack-react/
  .claude-plugin/
    plugin.json
  agents/
    frontend-developer.md
    backend-developer.md
  skills/
    react/
    zustand/
    hono/
    drizzle/
  CLAUDE.md
```

### CLI Commands

```bash
# Compile all skills to plugins
cc compile-plugins

# Compile a stack
cc compile-stack -s fullstack-react

# Generate marketplace.json
cc generate-marketplace

# Validate plugins
cc validate ./dist/plugins --all

# Bump version
cc version patch
```

See [CLI Reference](./src/docs/plugins/CLI-REFERENCE.md) for complete documentation.

---

## Development

### Project Structure

```
claude-collective/
  src/
    skills/           # Source skills organized by category
    stacks/           # Stack configurations
    agents/           # Agent templates and definitions
    cli/              # CLI implementation
    docs/             # Documentation
    schemas/          # JSON schemas for validation
  dist/
    plugins/          # Compiled skill plugins (83 plugins)
    stacks/           # Compiled stack plugins
  .claude-plugin/
    marketplace.json  # Marketplace definition
    README.md         # Marketplace documentation
```

### Build Commands

```bash
# Install dependencies
bun install

# Compile all plugins
bun run cc compile-plugins

# Compile stacks
bun run cc compile-stack

# Generate marketplace
bun run cc generate-marketplace

# Validate all plugins
bun run cc validate dist/plugins --all
```

### Adding a New Skill

1. Create skill directory: `src/skills/<category>/<name> (@author)/`
2. Add `SKILL.md` with frontmatter and content
3. Add `metadata.yaml` with version and description
4. Run `cc compile-plugins --skill <category>/<name>`
5. Run `cc generate-marketplace`

See [Plugin Development Guide](./src/docs/plugins/PLUGIN-DEVELOPMENT.md) for details.

---

## Documentation

| Document                                                                      | Description                        |
| ----------------------------------------------------------------------------- | ---------------------------------- |
| [CLI Reference](./src/docs/plugins/CLI-REFERENCE.md)                          | Complete CLI command documentation |
| [Plugin Development](./src/docs/plugins/PLUGIN-DEVELOPMENT.md)                | How to create and publish plugins  |
| [Plugin Architecture](./src/docs/plugins/PLUGIN-DISTRIBUTION-ARCHITECTURE.md) | Technical architecture details     |
| [Marketplace README](./.claude-plugin/README.md)                              | Available skills and installation  |

---

## License

MIT
