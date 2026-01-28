# Claude Collective Marketplace

This marketplace contains 83 skill plugins for Claude Code, covering frontend, backend, testing, mobile, and more.

## Installation

### 1. Add the Marketplace

```bash
/plugin marketplace add claude-collective/skills
```

### 2. Install Skills

Install individual skills as needed:

```bash
/plugin install skill-react@claude-collective
/plugin install skill-zustand@claude-collective
/plugin install skill-hono@claude-collective
```

Or install a pre-built stack:

```bash
/plugin install stack-fullstack-react@claude-collective
```

### 3. Use Skills

Once installed, skills are available via:

```bash
# Invoke skill directly
/skill-react

# Or let Claude auto-detect based on context
```

---

## Available Skills by Category

### Frontend (33 skills)

| Skill                         | Description                                           |
| ----------------------------- | ----------------------------------------------------- |
| `skill-react`                 | React 19 component architecture, hooks, patterns      |
| `skill-zustand`               | Zustand state management for client state             |
| `skill-jotai`                 | Atomic state management with auto-dependency tracking |
| `skill-redux-toolkit`         | Redux Toolkit patterns for complex client state       |
| `skill-mobx`                  | MobX stores, RootStore pattern                        |
| `skill-nextjs-app-router`     | Next.js 15 App Router patterns                        |
| `skill-nextjs-server-actions` | Server Actions for mutations and forms                |
| `skill-remix`                 | Remix file-based routing, loaders, actions            |
| `skill-nuxt`                  | Nuxt 3 patterns with Nitro                            |
| `skill-vue-composition-api`   | Vue 3 Composition API and composables                 |
| `skill-angular-standalone`    | Angular 17-19 standalone components, signals          |
| `skill-solidjs`               | SolidJS fine-grained reactivity                       |
| `skill-react-hook-form`       | React Hook Form patterns                              |
| `skill-vee-validate`          | VeeValidate v4 for Vue forms                          |
| `skill-react-intl`            | ICU message format internationalization               |
| `skill-next-intl`             | Type-safe i18n for Next.js                            |
| `skill-vue-i18n`              | Vue i18n patterns                                     |
| `skill-tailwind`              | Tailwind CSS v4 patterns                              |
| `skill-scss-modules`          | SCSS Modules, cva, design tokens                      |
| `skill-cva`                   | Class Variance Authority for variants                 |
| `skill-radix-ui`              | Radix UI accessible primitives                        |
| `skill-shadcn-ui`             | shadcn/ui component patterns                          |
| `skill-storybook`             | Storybook 8 component development                     |
| `skill-framer-motion`         | Motion animation patterns                             |
| `skill-css-animations`        | CSS transitions, keyframes, scroll-driven             |
| `skill-view-transitions`      | View Transitions API patterns                         |
| `skill-frontend-performance`  | Bundle optimization, render performance               |
| `skill-accessibility`         | WCAG, ARIA, keyboard navigation                       |
| `skill-pinia`                 | Pinia stores for Vue 3                                |
| `skill-ngrx-signalstore`      | NgRx SignalStore for Angular                          |
| `skill-react-mobx`            | MobX with React patterns                              |
| `skill-performance-mobx`      | MobX computed, observer optimization                  |
| `skill-react-query-axios-zod` | React Query with Axios and Zod                        |

### Backend (12 skills)

| Skill                             | Description                            |
| --------------------------------- | -------------------------------------- |
| `skill-hono`                      | Hono routes, OpenAPI, Zod validation   |
| `skill-express`                   | Express.js routes and middleware       |
| `skill-fastify`                   | Fastify routes, JSON Schema validation |
| `skill-drizzle`                   | Drizzle ORM, queries, migrations       |
| `skill-prisma`                    | Prisma ORM, type-safe queries          |
| `skill-better-auth-drizzle-hono`  | Better Auth patterns with Drizzle      |
| `skill-backend-performance`       | Query optimization, caching, indexing  |
| `skill-backend-axiom-pino-sentry` | Pino logging, Sentry, Axiom            |
| `skill-setup-axiom-pino-sentry`   | One-time setup for observability       |
| `skill-github-actions`            | GitHub Actions CI/CD pipelines         |
| `skill-posthog-analytics`         | PostHog event tracking                 |
| `skill-posthog-flags`             | PostHog feature flags, A/B testing     |

### Testing (8 skills)

| Skill                         | Description                         |
| ----------------------------- | ----------------------------------- |
| `skill-vitest`                | Vitest unit and integration testing |
| `skill-react-testing-library` | React Testing Library patterns      |
| `skill-vue-test-utils`        | Vue Test Utils patterns             |
| `skill-playwright-e2e`        | Playwright E2E testing              |
| `skill-cypress-e2e`           | Cypress E2E testing                 |
| `skill-karma-playwright`      | Karma + Playwright for Angular      |
| `skill-testing`               | Backend API and integration tests   |
| `skill-msw`                   | MSW handlers for API mocking        |

### API & Data (12 skills)

| Skill                        | Description                  |
| ---------------------------- | ---------------------------- |
| `skill-react-query`          | TanStack Query data fetching |
| `skill-swr`                  | SWR data fetching patterns   |
| `skill-graphql-apollo`       | Apollo Client GraphQL        |
| `skill-graphql-urql`         | URQL GraphQL client          |
| `skill-trpc`                 | tRPC type-safe APIs          |
| `skill-websockets`           | Native WebSocket patterns    |
| `skill-socket-io`            | Socket.IO v4.x patterns      |
| `skill-sse`                  | Server-Sent Events streaming |
| `skill-file-upload-patterns` | File upload with drag-drop   |
| `skill-image-handling`       | Client-side image processing |
| `skill-mocks`                | Sinon sandbox, mock stores   |
| `skill-tanstack-table`       | TanStack Table v8 patterns   |

### Mobile (3 skills)

| Skill                | Description                             |
| -------------------- | --------------------------------------- |
| `skill-react-native` | React Native patterns, New Architecture |
| `skill-expo`         | Expo managed workflow                   |

### Forms & Validation (2 skills)

| Skill                  | Description               |
| ---------------------- | ------------------------- |
| `skill-zod-validation` | Zod schema validation     |
| `skill-vee-validate`   | VeeValidate for Vue forms |

### Error Handling (3 skills)

| Skill                    | Description                    |
| ------------------------ | ------------------------------ |
| `skill-error-boundaries` | React error boundaries         |
| `skill-result-types`     | TypeScript Result/Either types |
| `skill-offline-first`    | Local-first with sync queues   |

### Utilities (6 skills)

| Skill                   | Description                            |
| ----------------------- | -------------------------------------- |
| `skill-native-js`       | Modern native JavaScript (ES2022-2025) |
| `skill-date-fns`        | date-fns patterns                      |
| `skill-service-workers` | Service Worker caching strategies      |
| `skill-env`             | Environment configuration with Zod     |
| `skill-tooling`         | ESLint 9, Prettier, Vite, Husky        |
| `skill-turborepo`       | Monorepo workspaces                    |

### Observability (3 skills)

| Skill                      | Description                    |
| -------------------------- | ------------------------------ |
| `skill-posthog`            | PostHog setup                  |
| `skill-resend`             | Resend email setup             |
| `skill-resend-react-email` | Resend + React Email templates |

### Security (1 skill)

| Skill            | Description                         |
| ---------------- | ----------------------------------- |
| `skill-security` | Auth, XSS prevention, CSRF, secrets |

### Meta (2 skills)

| Skill                        | Description                              |
| ---------------------------- | ---------------------------------------- |
| `skill-reviewing`            | Code review patterns                     |
| `skill-research-methodology` | Investigation flow for codebase research |

---

## Pre-built Stacks

| Stack                   | Description                       | Skills              |
| ----------------------- | --------------------------------- | ------------------- |
| `stack-fullstack-react` | Full-stack React + Hono + Drizzle | 15 skills, 6 agents |

---

## Creating Custom Stacks

Use the Claude Collective CLI to build custom stacks:

```bash
# Install CLI
npx @claude-collective/cli init --name my-stack

# Follow the wizard to select skills
```

---

## Contributing

See [PLUGIN-DEVELOPMENT.md](../src/docs/plugins/PLUGIN-DEVELOPMENT.md) for guidelines on creating and publishing skills.

---

## Links

- [GitHub Repository](https://github.com/claude-collective/skills)
- [CLI Reference](../src/docs/plugins/CLI-REFERENCE.md)
- [Plugin Development Guide](../src/docs/plugins/PLUGIN-DEVELOPMENT.md)
