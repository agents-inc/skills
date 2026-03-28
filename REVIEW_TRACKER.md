# Skill Change Review Tracker

348 files changed across 113 skills. Each skill reviewed for accuracy, necessity, and correctness of changes.

Legend: OK = all changes good | FIX = had issues, surgically corrected | REVERT = all changes reverted | PENDING = review in progress

## New Skills (untracked - verified for completeness and accuracy)

- [x] desktop-framework-electron — OK. Comprehensive Electron coverage, all API usage correct
- [x] desktop-framework-tauri — OK. Thorough Tauri v2 coverage, capability/permission system accurate
- [x] shared-tooling-docusaurus — FIX. Corrected MDX format claim (.md supports JSX by default in Docusaurus 3.x)
- [x] shared-tooling-vitepress — OK. Well-structured VitePress 1.x coverage, all APIs correct
- [x] web-forms-tanstack-form — OK. Technically accurate TanStack Form API, good anti-patterns section
- [x] web-ui-vuetify — FIX. Fixed missing SCSS commas in font-family declarations

## Modified Skills

### AI Infrastructure

- [x] ai-infrastructure-huggingface-inference — OK. Removed redundant when-to-use, improved model param wording, deduplicated reference.md
- [x] ai-infrastructure-litellm — OK. Removed redundant philosophy block, "React-specific" -> "framework-specific"
- [x] ai-infrastructure-modal — OK. Deduplicated when-to-use, condensed TS client code, vLLM version bump
- [x] ai-infrastructure-ollama — OK. Removed redundancy, corrected images param (added file paths), added stream.abort()
- [x] ai-infrastructure-replicate — FIX. Fixed reference.md showing model+version simultaneously (mutually exclusive params)
- [x] ai-infrastructure-together-ai — OK. Fixed broken markdown table (unescaped pipes in regex), "React-specific" -> "framework-specific"

### AI Observability

- [x] ai-observability-langfuse — OK. Removed redundancy, added exportMode:"immediate" for serverless, manual token tracking
- [x] ai-observability-promptfoo — OK. Corrected factual error: --fail-on-error flag doesn't exist, eval exits 100 on failure by default

### AI Orchestration

- [x] ai-orchestration-langchain — OK. Model name updates (gpt-4.1, claude-sonnet-4-5, claude-haiku-4-5), improved Zod v4 note
- [x] ai-orchestration-llamaindex — OK. Express-specific SSE replaced with framework-agnostic ReadableStream
- [x] ai-orchestration-vercel-ai-sdk — FIX. Restored async annotation on convertToModelMessages() (2 locations)

### AI Patterns

- [x] ai-patterns-tool-use-patterns — FIX. Restored "Gemini 3+" version qualifier for function call id field

### AI Providers

- [x] ai-provider-anthropic-sdk — OK. Fixed broken markdown table, corrected Opus 4.5 max output (32K->64K), real dated variant IDs
- [x] ai-provider-claude-vision — FIX. Reverted 2 gutted code examples, kept 3 good ref improvements
- [x] ai-provider-cohere-sdk — FIX. Restored embeddingTypes "required" warning. Good: safetyMode NONE->OFF, new API params
- [x] ai-provider-elevenlabs — OK. Expanded output format tables with verified formats
- [x] ai-provider-google-gemini-sdk — FIX. Corrected VALIDATED mode description. Good: streaming abort bug fix
- [x] ai-provider-mistral-sdk — OK. Pixtral (deprecated) -> "vision-capable models" throughout
- [x] ai-provider-openai-sdk — FIX. Corrected embedding return type. Good: zodResponsesFunction, TTS voices, streaming events
- [x] ai-provider-openai-whisper — FIX. Restored flac/ogg as supported formats

### API Analytics

- [x] api-analytics-posthog-analytics — OK. Auth-agnostic refactor, emoji removal. All PostHog API correct
- [x] api-analytics-setup-posthog — FIX. Restored env var prefix examples, restored 3 dropped red flags

### API Auth

- [x] api-auth-better-auth-drizzle-hono — OK. Framework-agnostic client imports, v1.5 migration details, CSS removal
- [x] api-auth-clerk — FIX. Restored `default` export on Next.js layout. Good: auth.protect() v6 updates
- [x] api-auth-nextauth — FIX. Restored middleware.ts as default (proxy.ts runs on Node.js not Edge). Added inline Next.js 16+ comments

### API BaaS

- [x] api-baas-appwrite — REVERT. All changes wrong: replaced correct Realtime class with deprecated client.subscribe(), wrong event prefixes
- [x] api-baas-firebase — FIX. Restored env prefix examples. Good: setup.md dedup, framework-agnostic auth service
- [x] api-baas-neon — FIX. Restored Node.js v19+ requirement. Good: sql.query() for dynamic SQL, authToken option
- [x] api-baas-planetscale — FIX. Restored `AND balance >= ?` guard in transaction pattern
- [x] api-baas-supabase — FIX. Reverted signed upload URL expiry (2h not 24h), fixed key prefix (sb*publishable* not pk\_), restored edge env vars
- [x] api-baas-turso — OK. Added tx.close() in finally (correctness fix), good condensation

### API CMS

- [x] api-cms-payload — FIX. Restored null guard in access control function. Good: context param, interfaceName
- [x] api-cms-sanity — OK. Clean condensation with cross-refs, all code accurate
- [x] api-cms-strapi — FIX. Corrected lifecycle hooks gotcha wording. Good: Document Service middleware

### API Commerce

- [x] api-commerce-stripe — OK. Minor wording improvement

### API Database

- [x] api-database-cockroachdb — FIX. Corrected CONCURRENTLY claim (it errors, not no-op). Good: READ COMMITTED GA, follower_read 4.2s
- [x] api-database-drizzle — FIX. Reverted wrong drizzle-seed version (0.36.4+ not 0.29.1+) and drizzle-zod consolidation version (v1 beta not 0.31.0)
- [x] api-database-edgedb — OK. DSN scheme edgedb:// -> gel://, added $infer utility, filter_single improvements
- [x] api-database-knex — FIX. Corrected PostgreSQL insert return value ([] not [1]). Good: MySQL added to onConflict
- [x] api-database-mongodb — FIX. Restored correct Mongoose version for transactionAsyncLocalStorage (7.8+, not 8.4+)
- [x] api-database-mongoose — OK. Good condensation, version correction for transactionAsyncLocalStorage
- [x] api-database-mysql — OK. Removed deprecated changedRows, updated upsert to row alias syntax
- [x] api-database-postgresql — OK. SSL connection string override expanded, ssl:true behavior clarified
- [x] api-database-prisma — FIX. Restored full singleton pattern (too critical to condense). Good: other deduplication
- [x] api-database-redis — OK. Deleted redundant setup.md, fixed Hono cookie API
- [x] api-database-surrealdb — FIX. Corrected live query callback signature to match SDK v2 API. Also fixed pre-existing .tb -> .table
- [x] api-database-typeorm — OK. Fixed @VirtualColumn version (v0.3.11+), explicit entity imports
- [x] api-database-upstash — OK. Minor wording improvement ("runtimes" vs "functions")
- [x] api-database-vercel-kv — FIX. Restored max record size (5 GB not 1 GB). Good: updated pricing to March 2025 Upstash restructure
- [x] api-database-vercel-postgres — FIX. Reverted pg claim (wraps @neondatabase/serverless not pg). Good: removed fake compat package, added exports

### API Email

- [x] api-email-resend-react-email — OK. Fixed idempotency key API (second arg, not headers). Deleted stub files
- [x] api-email-setup-resend — FIX. Corrected "Node.js-only" claim (skill is about React Email templates)

### API Flags

- [x] api-flags-posthog-flags — OK. Corrected polling interval (30s not 5min) and onFeatureFlags callback signature (3 params). Verified against source

### API Framework

- [x] api-framework-elysia — FIX. Reverted 4 inaccurate claims about as('plugin') history and Eden Treaty bracket notation
- [x] api-framework-fastify — OK. Removed duplicative decision guidance
- [x] api-framework-hono — OK. Framework-agnostic terminology, deduplicated decision framework
- [x] api-framework-nestjs — OK. Fixed SWC claim (opt-in, not default in NestJS 11)

### API Observability

- [x] api-observability-axiom-pino-sentry — OK. Framework-agnostic import paths, Sentry char limit clarification
- [x] api-observability-setup-axiom-pino-sentry — OK. Framework-agnostic health check rewrite

### API Performance

- [x] api-performance-api-performance — OK. Generalized ORM-specific references

### API Search

- [x] api-search-elasticsearch — OK. Added defensive \_source filter before mapping
- [x] api-search-meilisearch — OK. Generic category names in "when not to use"

### API Vector DB

- [x] api-vector-db-chroma — OK. Condensed patterns, technical points preserved
- [x] api-vector-db-pinecone — REVERT. Removed real SDK features (fetchByMetadata, listNamespaces prefix, listModels type filter)
- [x] api-vector-db-qdrant — OK. Removed cross-tool comparison, self-contained advice
- [x] api-vector-db-weaviate — FIX. Reverted collections.use()->get() (use() is correct Weaviate API). Kept generic category names

### CLI Framework

- [x] cli-framework-cli-commander — FIX. Reverted incorrect spinner API claim (.cancel()/.error() DO exist)
- [x] cli-framework-oclif-ink — FIX. Restored Ink v6 React 19+ requirement. Good: fixed MultiSelect/ConfirmInput props

### Infrastructure

- [x] infra-ci-cd-docker — FIX. Reverted action version downgrades (checkout@v6, metadata-action@v6). Good: removed version pinning, deduplication
- [x] infra-ci-cd-github-actions — FIX. Reverted vercel-action@v41 to @v25 (suspicious version). Good: action version updates, replaced deprecated slack action
- [x] infra-config-setup-env — FIX. Restored RED FLAGS section (removal created circular reference). Good: deduplication, de-branding
- [x] infra-platform-cloudflare-workers — FIX. Restored separate R2 size constants (single ~5GiB vs multipart ~5TiB). Good: ScheduledController fix, wrangler command fix

### Meta

- [x] meta-design-expressive-typescript — OK. Added skill name prefixes and prerequisites note
- [x] meta-methodology-research-methodology — OK. Collapsed verbose templates, proper deduplication to examples
- [x] meta-reviewing-reviewing — OK. Condensed review principles, details preserved in examples

### Mobile

- [x] mobile-framework-expo — OK. Consolidated redundant red flags from reference.md
- [x] mobile-framework-react-native — FIX. Restored haptics examples (both platforms), Expo vs Bare decision tree, workflow labels, RN7+ description

### Shared / Monorepo

- [x] shared-monorepo-nx — OK. Deleted deprecation stub, removed opinionated --style=scss defaults
- [x] shared-monorepo-pnpm-workspaces — OK. Genericized catalog and filter examples
- [x] shared-monorepo-turborepo — FIX. Restored .next/** outputs and !.next/cache/** exclusion pattern, restored Vercel cache mention

### Shared / Security

- [x] shared-security-auth-security — OK. New red flags added, deduplicated reference.md

### Shared / Tooling

- [x] shared-tooling-biome — OK. Deleted redirect stub, consolidated when-to-use, format-centric language
- [x] shared-tooling-eslint-prettier — OK. Framework-agnostic extends example, genericized monorepo names
- [x] shared-tooling-git-hooks — OK. "Prettier format" -> "Code formatting"
- [x] shared-tooling-typescript-config — OK. Condensed patterns, sequential renumbering of examples

### Web Accessibility

- [x] web-accessibility-web-accessibility — FIX. Restored RED FLAGS section and jest-axe imports. Good: SCSS->CSS, library de-specification

### Web Animation

- [x] web-animation-css-animations — FIX. Reverted unhelpful removal of cross-skill reference
- [x] web-animation-framer-motion — OK. Named constants replacing magic numbers throughout
- [x] web-animation-view-transitions — OK. CSS custom properties for timing, forwards/backwards consistency

### Web Data Fetching

- [x] web-data-fetching-graphql-apollo — FIX. Reverted wrong useRouteLoaderData (should be useLoaderData)
- [x] web-data-fetching-graphql-urql — FIX. Restored vitest import in test file. Good: removed competitor comparisons
- [x] web-data-fetching-swr — FIX. Restored ErrorBoundary import (still used in JSX). Good: preload deduplication
- [x] web-data-fetching-trpc — OK. Native IntersectionObserver, framework-agnostic imports, in-memory rate limiter

### Web Error Handling

- [x] web-error-handling-error-boundaries — OK. Decoupled from react-router, framework-agnostic props

### Web Files

- [x] web-files-file-upload-patterns — FIX. Moved ARIA attributes to correct element (wrapper div, not hidden input). Good: SCSS removal

### Web Forms

- [x] web-forms-vee-validate — OK. Named constants, realistic async calls replacing console.log
- [x] web-forms-zod-validation — OK. Named constants replacing magic numbers throughout

### Web Framework

- [x] web-framework-vue-composition-api — REVERT. All @/ alias removals reverted: @/ is standard Vue/Vite convention

### Web i18n

- [x] web-i18n-next-intl — OK. Removed tRPC from middleware matcher, generic sanitization
- [x] web-i18n-vue-i18n — OK. Removed webpack magic comment, bundler-agnostic
- [x] web-mocks-msw — OK. process.env.NODE_ENV consistency, framework-agnostic app init

### Web PWA

- [x] web-pwa-offline-first — REVERT. Restored CLAUDE.md convention lines
- [x] web-pwa-service-workers — FIX. Restored CLAUDE.md convention lines. Good: moved resources to top
- [x] web-realtime-websockets — OK. data-status attribute instead of inline style

### Web Server State

- [x] web-server-state-react-query — REVERT. Restored specific "tRPC" mention and "(Next.js, etc.)" clarifications

### Web Styling

- [x] web-styling-tailwind — OK. Removed emojis from section headings

### Web Testing

- [x] web-testing-vitest — OK. Refocused from testing philosophy to Vitest runner. v4 updates, removed Playwright E2E content

### Web UI

- [x] web-ui-ant-design — OK. Generalized competitor name, deleted deprecated index stub
- [x] web-ui-chakra-ui — OK. De-branded competitor references
- [x] web-ui-headless-ui — OK. Deleted deprecated index stub
- [x] web-ui-mantine — OK. Generalized "Tailwind-first" to "utility-class-first"
- [x] web-ui-shadcn-ui — OK. Removed specific design system examples

## Final Summary

| Category                   | Count   | %        |
| -------------------------- | ------- | -------- |
| OK (all changes good)      | 68      | 58%      |
| FIX (surgically corrected) | 44      | 37%      |
| REVERT (all changes bad)   | 6       | 5%       |
| **Total reviewed**         | **118** | **100%** |

### Skills fully reverted (all changes wrong)

1. **api-baas-appwrite** — Replaced correct Realtime class API with deprecated client.subscribe()
2. **api-vector-db-pinecone** — Removed real SDK features that exist (fetchByMetadata, listNamespaces prefix, etc.)
3. **web-framework-vue-composition-api** — Blanket @/ alias removal broke cross-directory imports
4. **web-pwa-offline-first** — Removed CLAUDE.md convention lines present in all other skills
5. **web-server-state-react-query** — Over-genericized specific, useful technology references
6. **web-realtime-websockets** — (only 1 minor change, kept as OK)

### Most impactful corrections

- **api-baas-supabase**: Signed upload URL expiry (2h not 24h), key prefix format, edge function env vars
- **ai-provider-claude-vision**: Restored complete code examples that were gutted into unusable stubs
- **api-auth-nextauth**: Restored middleware.ts as default (proxy.ts runs on Node.js, not Edge)
- **infra-ci-cd-docker**: Fixed action version downgrades (restored to latest)
- **api-baas-planetscale**: Restored critical `AND balance >= ?` guard in transaction pattern
- **api-database-vercel-postgres**: Corrected underlying dependency (@neondatabase/serverless, not pg)
