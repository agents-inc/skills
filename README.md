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

150+ skills covering everything from React and Prisma to Redis, ElevenLabs, and infrastructure tooling. Pick the skills that match your stack and install them via Claude Code. Need more control? The `@agents-inc/cli` lets you choose between plugin or local mode, scoped to a single project or your entire machine.

## Install

**Via Claude Code:**

```bash
/plugin marketplace add agents-inc/skills
/plugin install <skill-name>@agents-inc
```

**Via the Agents Inc CLI:**

```bash
npx @agents-inc/cli init
```

Select your skills, and the CLI generates your config. See the [CLI repo](https://github.com/agents-inc/cli) for advanced options.

## Web

Frameworks<br>
`React` `Vue Composition API` `Angular Standalone` `SolidJS` `Svelte`

Meta Frameworks<br>
`Next.js` `Nuxt` `Remix` `Astro` `SvelteKit` `Qwik`

State Management<br>
`Zustand` `Pinia` `NgRx SignalStore` `Jotai` `MobX` `Redux Toolkit`

Data Fetching<br>
`SWR` `tRPC` `GraphQL + Apollo` `GraphQL + urql`

Server State<br>
`React Query`

Routing<br>
`React Router` `TanStack Router`

Forms & Validation<br>
`React Hook Form` `Vee Validate` `Zod`

UI Libraries<br>
`shadcn/ui` `Radix UI` `TanStack Table` `MUI` `Chakra UI` `Ant Design` `Mantine` `Headless UI`

Styling<br>
`Tailwind` `SCSS Modules` `CVA`

Testing<br>
`Vitest` `Playwright` `Cypress` `React Testing Library` `Vue Test Utils`

Mocks<br>
`MSW`

Animation<br>
`Framer Motion` `CSS Animations` `View Transitions`

Tooling<br>
`Storybook` `Vite`

i18n<br>
`next-intl` `react-intl` `vue-i18n`

Realtime<br>
`WebSockets` `Socket.IO` `SSE`

PWA<br>
`Offline First` `Service Workers`

Error Handling<br>
`Error Boundaries` `Result Types`

Files<br>
`File Upload Patterns` `Image Handling`

Performance & Accessibility<br>
`Web Performance` `Accessibility`

Utilities<br>
`date-fns` `Native JS` `RxJS` `VueUse`

## API

Frameworks<br>
`Hono` `Express` `Fastify` `NestJS` `Elysia`

Databases & ORMs<br>
`Drizzle` `Prisma` `TypeORM` `Sequelize` `Knex` `Mongoose` `MongoDB` `PostgreSQL` `MySQL` `Redis` <br> `CockroachDB` `EdgeDB` `SurrealDB` `Upstash` `Vercel KV` `Vercel Postgres`

BaaS<br>
`Supabase` `Firebase` `Appwrite` `Neon` `PlanetScale` `Turso`

Auth<br>
`Better Auth + Drizzle + Hono` `Clerk` `NextAuth`

CMS<br>
`Payload` `Sanity` `Strapi`

Commerce<br>
`Stripe`

Email<br>
`Resend + React Email` `Resend Setup`

Search<br>
`Elasticsearch` `Meilisearch`

Vector DBs<br>
`Pinecone` `Qdrant` `Chroma` `Weaviate`

Analytics<br>
`PostHog Analytics` `PostHog Setup`

Feature Flags<br>
`PostHog Flags`

Observability<br>
`Axiom + Pino + Sentry` `Axiom + Pino + Sentry Setup`

Performance<br>
`API Performance`

## AI

Providers<br>
`Anthropic SDK` `OpenAI SDK` `Google Gemini SDK` `Mistral SDK` `Cohere SDK` `ElevenLabs` `OpenAI Whisper` `Claude Vision`

Orchestration<br>
`Vercel AI SDK` `LangChain` `LlamaIndex`

Infrastructure<br>
`HuggingFace Inference` `LiteLLM` `Modal` `Ollama` `Replicate` `Together AI`

Observability<br>
`Langfuse` `Promptfoo`

Patterns<br>
`Tool Use Patterns`

## Infra

CI/CD<br>
`GitHub Actions` `Docker`

Platform<br>
`Cloudflare Workers`

Config<br>
`Env Config`

## Meta

Design<br>
`Expressive TypeScript`

Reviewing<br>
`Code Reviewing` `CLI Reviewing`

Methodology<br>
`Research Methodology`

## Shared

Monorepos<br>
`Turborepo` `Nx` `pnpm Workspaces`

Security<br>
`Auth Security`

Tooling<br>
`Biome` `ESLint + Prettier` `Git Hooks` `TypeScript Config`

Each skill covers patterns, conventions, anti-patterns, edge cases, and real code examples for a single technology. Not surface-level docs, but the kind of knowledge you'd normally have to explain to Claude repeatedly.

## Skill structure

```
src/skills/<domain>-<subcategory>-<name>/
├── SKILL.md           # Main skill content
├── metadata.yaml      # Version, compatibility, tags
├── reference.md       # API reference
└── examples/
    ├── core.md        # Core usage examples
    └── {topic}.md     # Topic-specific examples
```
