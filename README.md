<!-- TODO: Add centered logo with dark/light mode support (same logo as the CLI repo)
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-dark.svg">
    <img alt="Agents Inc Skills" src="./assets/logo-light.svg" width="300">
  </picture>
</p>
-->

# Agents Inc Skills: 230+ expert-level atomic skills for Claude Code

The official skills marketplace for [Agents Inc](https://github.com/agents-inc/cli).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Skills: 230+](https://img.shields.io/badge/Skills-230%2B-green.svg)](./src/skills)

230+ skills covering everything from React and Prisma to Redis, ElevenLabs, and infrastructure tooling. Pick the skills that match your stack and install them via Claude Code. Need more control? The `agents-inc` CLI lets you choose between plugin or eject mode, scoped to a single project or your entire machine.

## Install

**Via Claude Code:**

```bash
/plugin marketplace add agents-inc/skills
/plugin install <skill-name>@agents-inc
```

**Via the Agents Inc CLI:**

```bash
npx agents-inc init
```

See the [Agents Inc CLI](https://github.com/agents-inc/cli).

## Web

Frameworks<br>
`React` `Vue Composition API` `Angular Standalone` `SolidJS` `Svelte`

Meta Frameworks<br>
`Next.js` `Nuxt` `Remix` `Astro` `SvelteKit` `Qwik` `Docusaurus` `VitePress`

State Management<br>
`Zustand` `Pinia` `NgRx SignalStore` `Jotai` `MobX` `Redux Toolkit`

Data Fetching<br>
`SWR` `tRPC` `GraphQL + Apollo` `GraphQL + urql`

Server State<br>
`React Query`

Routing<br>
`React Router` `TanStack Router`

Forms & Validation<br>
`React Hook Form` `TanStack Form` `Vee Validate` `Zod`

UI Libraries<br>
`shadcn/ui` `Radix UI` `TanStack Table` `MUI` `Chakra UI` `Ant Design` `Mantine` `Headless UI` `Vuetify` `Base UI`

Styling<br>
`Tailwind` `SCSS Modules` `CVA` `Runtime Theming` `Design Tokens`

Testing<br>
`Vitest` `Playwright` `Cypress` `React Testing Library` `Vue Test Utils` `Visual Regression`

Mocks<br>
`MSW`

Animation<br>
`Framer Motion` `CSS Animations` `View Transitions`

Tooling<br>
`Storybook` `Vite` `Component Library Packaging`

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

Editors<br>
`Lexical` `TipTap`

Maps<br>
`Leaflet` `Mapbox GL JS`

Data Visualization<br>
`D3.js` `Recharts`

3D<br>
`React Three Fiber`

Drag and Drop<br>
`dnd-kit`

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
`Elasticsearch` `Meilisearch` `Xquik`

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

GraphQL<br>
`Apollo Server` `GraphQL Yoga` `Mercurius`

Queues<br>
`BullMQ`

Messaging<br>
`Webhooks`

API Specs<br>
`OpenAPI`

Caching<br>
`Caching`

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
`GitHub Actions` `Docker` `Turborepo CI`

Platform<br>
`Cloudflare Workers` `AWS SDK` `Vercel` `Netlify`

Config<br>
`Env Config`

Infrastructure as Code<br>
`Terraform` `Pulumi` `SST`

Containers<br>
`Kubernetes`

## Shared

Monorepos<br>
`Turborepo` `Nx` `pnpm Workspaces`

Security<br>
`Auth Security`

Tooling<br>
`Biome` `ESLint + Prettier` `Git Hooks` `TypeScript Config` `Changesets` `Stack Detection`

## Desktop

Frameworks<br>
`Electron` `Tauri`

IPC<br>
`Electron Type-Safe IPC`

Backend<br>
`Tauri Rust Backend`

UI<br>
`Electron Desktop UI`

Multi-Window<br>
`Electron Multi-Window` `Tauri Multi-Window & Events`

Storage<br>
`Electron Storage & Credentials`

Security<br>
`Electron Security & Fuses` `Tauri Capabilities & ACL`

Plugins<br>
`Tauri Plugins`

Packaging<br>
`Electron Forge` `Tauri Bundling & Distribution`

Updates<br>
`Electron Auto-Updates`

Testing<br>
`Electron Testing`

Mobile<br>
`Tauri Mobile`

## Mobile

Frameworks<br>
`React Native` `Expo`

Navigation<br>
`React Navigation` `Expo Router`

Styling<br>
`NativeWind` `Unistyles`

UI Libraries<br>
`React Native Paper` `Tamagui`

Animation<br>
`Reanimated` `Gesture Handler` `Skia`

Storage<br>
`MMKV` `SQLite + PowerSync` `WatermelonDB`

Testing<br>
`Detox` `Maestro`

Deployment<br>
`EAS`

Notifications<br>
`Push Notifications`

Deep Linking<br>
`Deep Linking & App Links`

Camera<br>
`VisionCamera`

Hardware<br>
`BLE & NFC`

Background<br>
`Background Tasks`

Performance<br>
`React Native Performance`

Security<br>
`React Native Security`

## CLI

Frameworks<br>
`CLI Commander` `oclif + Ink`

Prompts<br>
`Clack`

## Meta

Design<br>
`Expressive TypeScript` `Composable Components`

Reviewing<br>
`Code Reviewing` `CLI Reviewing` `Web Reviewing` `API Reviewing` `AI Reviewing` `Infra Reviewing`

Methodology<br>
`Research Methodology`

Planning<br>
`Web Planning` `API Planning` `CLI Planning` `AI Planning`

Each skill covers patterns, conventions, anti-patterns, edge cases, and real code examples for a single technology. Not surface-level docs, but the kind of knowledge you'd normally have to explain to Claude repeatedly.

## Skill structure

```
src/skills/<domain>-<subcategory>-<name>/
├── SKILL.md           # Main skill content
├── metadata.yaml      # Category, slug, author, display name, and usage guidance
├── reference.md       # API reference
└── examples/
    ├── core.md        # Core usage examples
    └── {topic}.md     # Topic-specific examples
```

## Contributing a skill

Use the [skill-summoner agent](./docs/contributing/skill-summoner.md) to create or improve a skill — it researches current best practices, matches this repo's conventions, and writes a fully-structured skill package to `src/skills/`. Drop the file into your `.claude/agents/` directory and invoke it; no `agents-inc` install required.

In the `metadata.yaml` it generates, set `author` to your own handle (e.g. `"@your-github-username"`), not a placeholder or someone else's.
