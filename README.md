<!-- TODO: Add centered logo with dark/light mode support (same logo as the CLI repo)
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-dark.svg">
    <img alt="Agents Inc Skills" src="./assets/logo-light.svg" width="300">
  </picture>
</p>
-->

# Agents Inc Skills: 150+ expert-level atomic skills for Claude Code

The official skills marketplace for [Agents Inc](https://github.com/agents-inc/cli).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Skills: 150+](https://img.shields.io/badge/Skills-150%2B-green.svg)](./src/skills)

Curated skills that you can install and customize via the [Agents Inc CLI](https://github.com/agents-inc/cli). This repo is structured content, not code: YAML + markdown files with metadata, used to give subagents domain-specific knowledge. All of the logic (installation, compilation, validation) lives in the [CLI](https://github.com/agents-inc/cli).

## Quick start

```bash
npx @agents-inc/cli init
```

The wizard walks you through selecting skills, then compiles subagents and generates a config file. See the [CLI repo](https://github.com/agents-inc/cli) for the full setup guide.

## Skill categories

150+ skills organized by domain:

### Web

**Frameworks**<br>
`React` `Vue Composition API` `Angular Standalone` `SolidJS` `Svelte`

**Meta Frameworks**<br>
`Next.js` `Nuxt` `Remix` `Astro` `SvelteKit` `Qwik`

**State Management**<br>
`Zustand` `Pinia` `NgRx SignalStore` `Jotai` `MobX` `Redux Toolkit`

**Data Fetching**<br>
`React Query` `SWR` `tRPC` `GraphQL + Apollo` `GraphQL + urql`

**Server State**<br>
`React Query`

**Routing**<br>
`React Router` `TanStack Router`

**Forms & Validation**<br>
`React Hook Form` `Vee Validate` `Zod`

**UI Libraries**<br>
`shadcn/ui` `Radix UI` `TanStack Table` `MUI` `Chakra UI` `Ant Design` `Mantine` `Headless UI`

**Styling**<br>
`Tailwind` `SCSS Modules` `CVA`

**Testing**<br>
`Vitest` `Playwright` `Cypress` `React Testing Library` `Vue Test Utils` `MSW`

**Animation**<br>
`Framer Motion` `CSS Animations` `View Transitions`

**Tooling**<br>
`Storybook` `Vite`

**i18n**<br>
`next-intl` `react-intl` `vue-i18n`

**Realtime**<br>
`WebSockets` `Socket.IO` `SSE`

**PWA**<br>
`Offline First` `Service Workers`

**Error Handling**<br>
`Error Boundaries` `Result Types`

**Files**<br>
`File Upload Patterns` `Image Handling`

**Performance & Accessibility**<br>
`Web Performance` `Accessibility`

**Utilities**<br>
`date-fns` `Native JS` `RxJS` `VueUse`

### API

**Frameworks**<br>
`Hono` `Express` `Fastify` `NestJS` `Elysia`

**Databases & ORMs**<br>
`Drizzle` `Prisma` `TypeORM` `Sequelize` `Knex` `Mongoose` `MongoDB` `PostgreSQL` `MySQL` `Redis` <br> `CockroachDB` `EdgeDB` `SurrealDB`

**BaaS & Managed**<br>
`Supabase` `Firebase` `Appwrite` `Neon` `PlanetScale` `Turso` `Upstash` `Vercel KV` `Vercel Postgres`

**Auth**<br>
`Better Auth + Drizzle + Hono` `Clerk` `NextAuth`

**AI & ML**<br>
`Anthropic SDK` `OpenAI SDK` `Vercel AI SDK` `LangChain` `LlamaIndex` `Google Gemini SDK` <br> `Mistral SDK` `Cohere SDK` `Together AI` `Replicate` `Modal` `Ollama` `HuggingFace Inference` <br> `ElevenLabs` `OpenAI Whisper` `LiteLLM` `Langfuse` `Promptfoo` `Claude Vision` `Tool Use Patterns`

**CMS**<br>
`Payload` `Sanity` `Strapi`

**Commerce**<br>
`Stripe`

**Email**<br>
`Resend + React Email` `Resend Setup`

**Search**<br>
`Elasticsearch` `Meilisearch`

**Vector DBs**<br>
`Pinecone` `Qdrant` `Chroma` `Weaviate`

**Analytics**<br>
`PostHog Analytics` `PostHog Setup`

**Feature Flags**<br>
`PostHog Flags`

**Observability**<br>
`Axiom + Pino + Sentry` `Axiom + Pino + Sentry Setup`

**Performance**<br>
`API Performance`

### Mobile/CLI

**Mobile**<br>
`React Native` `Expo`

**CLI**<br>
`Commander` `oclif + Ink`

### Shared

**CI/CD**<br>
`GitHub Actions` `Docker` `Cloudflare Workers`

**Monorepos**<br>
`Turborepo` `Nx` `pnpm Workspaces`

**Tooling**<br>
`Biome` `ESLint + Prettier` `Git Hooks` `TypeScript Config`

**Infra**<br>
`Env Config`

**Security**<br>
`Auth Security`

**Meta**<br>
`Code Reviewing` `CLI Reviewing` `Research Methodology`

Each skill covers patterns, conventions, anti-patterns, edge cases, and real code examples for a single technology. Not surface-level docs, but the kind of knowledge you'd normally have to explain to Claude repeatedly.

## Contributing

### Adding a skill

1. Create a directory under `src/skills/<domain>-<subcategory>-<name>/`
2. Add `SKILL.md` with the skill content
3. Add `reference.md` for API reference
4. Add an `examples/` directory with real code examples
5. Run the CLI to compile and verify

Each skill is a structured package. The naming convention is `<domain>-<subcategory>-<name>` (e.g., `web-framework-react`). All YAML files are validated against JSON schemas in the [CLI repository](https://github.com/agents-inc/cli), so malformed metadata or invalid references are caught immediately.

### Skill structure

```
src/skills/<domain>-<subcategory>-<name>/
├── SKILL.md           # Main skill content
├── metadata.yaml      # Version, compatibility, tags
├── reference.md       # API reference
└── examples/
    ├── core.md        # Core usage examples
    └── {topic}.md     # Topic-specific examples
```

## Development

```bash
# Install dependencies (for prettier hooks)
bun install

# Format files
bun run format
```

## Links

- [Agents Inc CLI](https://github.com/agents-inc/cli): an agent composition framework that builds stacks and compiles specialized subagents for Claude Code

## License

MIT
