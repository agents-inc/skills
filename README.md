<!-- TODO: Add centered logo with dark/light mode support (same logo as the CLI repo)
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-dark.svg">
    <img alt="Agents Inc Skills" src="./assets/logo-light.svg" width="300">
  </picture>
</p>
-->

# Agents Inc Skills

The official skills marketplace for [Agents Inc](https://github.com/agents-inc/cli).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Skills: 87+](https://img.shields.io/badge/Skills-87%2B-green.svg)](./src/skills)

Curated skills and pre-built stacks that you can install and customize via the [Agents Inc CLI](https://github.com/agents-inc/cli). This repo is structured content, not code: YAML + markdown files with metadata, used to give subagents domain-specific knowledge. All of the logic (installation, compilation, validation) lives in the [CLI](https://github.com/agents-inc/cli).

## Quick start

```bash
npx @agents-inc/cli init
```

The wizard walks you through selecting a stack or individual skills, then compiles subagents and generates a config file. See the [CLI repo](https://github.com/agents-inc/cli) for the full setup guide.

## How skills become subagents

Skills on their own are structured content, not code. The CLI compiles them into specialized subagents by combining skills with agent definitions and Liquid templates:

```
marketplace skills + agent definitions + Liquid templates
  → CLI compile
    → compiled subagents (.claude/agents/)
```

A `web-developer` subagent might get React, Tailwind, and Vitest skills. A `web-tester` gets Vitest, Playwright, and React Testing Library. Each subagent knows its domain deeply instead of knowing everything shallowly.

## Skill categories

87+ skills organized by domain:

**Web**<br>
`React` `Vue` `Angular` `SolidJS` `Next.js` `Remix` `Nuxt` `SCSS Modules` `CVA` `Zustand` `Pinia` `NgRx SignalStore` `Jotai` `React Query` `SWR` `tRPC` `GraphQL` `React Hook Form` `Zod` `shadcn/ui` `Radix UI` `TanStack Table` `Vitest` `Playwright` `Cypress` `MSW` `Framer Motion` `Storybook` `Accessibility`

**API**<br>
`Hono` `Express` `Fastify` `Drizzle` `Prisma` `Better Auth` `PostHog` `Resend` `Axiom + Pino + Sentry` `GitHub Actions`

**Mobile**<br>
`React Native` `Expo`

**CLI**<br>
`Commander` `oclif + Ink`

**Infra**<br>
`Turborepo` `Tooling` `Env config`

**Security**<br>
`Auth patterns` `XSS prevention` `Secrets management`

**Meta**<br>
`Code reviewing` `Research methodology` `Investigation requirements` `Anti-over-engineering` `Context management`

Each skill covers patterns, conventions, anti-patterns, edge cases, and real code examples for a single technology. Not surface-level docs, but the kind of knowledge you'd normally have to explain to Claude repeatedly.

## Stacks

Stacks bundle related skills with pre-configured agents. Instead of picking skills individually, grab a stack that matches your setup:

- **nextjs-fullstack**: Next.js App Router + Hono + Drizzle + PostHog + Zustand + React Query
- **angular-stack**: Angular 19 + Signals + NgRx SignalStore + Hono + Drizzle
- **vue-stack**: Vue 3 Composition API + Pinia + Hono + Drizzle
- **nuxt-stack**: Nuxt 3 + Vue 3 full-stack + Pinia + Hono + Drizzle
- **remix-stack**: Remix + React + Hono + Drizzle
- **solidjs-stack**: SolidJS + Hono + Drizzle
- **react-native-stack**: React Native + Expo + Zustand + React Query
- **meta-stack**: Agents for creating agents, skills, docs, and extracting patterns

Each stack includes agents like `web-developer`, `api-developer`, `web-reviewer`, `web-tester`, `web-researcher`, `pattern-scout`, and `documentor`.

## Repository structure

```
src/
  skills/       # Source skills organized by category
  stacks/       # Stack configurations (skill bundles)
  agents/       # Agent definitions
  schemas/      # JSON schemas for validation
  docs/         # Documentation
```

## Contributing

### Adding a skill

1. Create a directory under `src/skills/<category>/<name>/`
2. Add `SKILL.md` with the skill content
3. Add `reference.md` for API reference
4. Add an `examples/` directory with real code examples
5. Run the CLI to compile and verify

Each skill is a structured package. The naming convention is `<domain>/<subcategory>/<technology>` (e.g., `web/framework/react`). All YAML files are validated against public JSON schemas (in `src/schemas/`) generated from Zod types in the CLI, so malformed metadata or invalid references are caught immediately.

### Skill structure

```
src/skills/<category>/<name>/
├── SKILL.md           # Main skill content
├── metadata.yaml      # Version, compatibility, tags
├── reference.md       # API reference
└── examples/
    ├── core.md        # Core usage examples
    └── {topic}.md     # Topic-specific examples
```

### Stack config format

Stacks are defined in `src/stacks/<name>/config.yaml`:

```yaml
name: 'Stack Name'
description: 'What this stack covers'
author: '@handle'
version: '1.0.0'

skills:
  - id: web/framework/react
  - id: api/framework/hono
```

## Development

```bash
# Install dependencies (for prettier hooks)
bun install

# Format files
bun run format
```

## Links

- [Agents Inc CLI](https://github.com/agents-inc/cli): the framework that compiles skills into subagents
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code): the tool this extends
<!-- TODO: Add community links (Discord, Twitter/X) when they exist -->

## License

MIT
