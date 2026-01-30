# Claude Collective Skills

this is the skills marketplace for Claude Code. it contains curated skills and pre-built stacks that you can customise and install via the CLI.

## what's here

```
.claude/
  skills/       # compiled skills (what Claude loads)
  agents/       # agent definitions
src/
  skills/       # source skills organized by category
  stacks/       # stack configurations (skill bundles)
  schemas/      # JSON schemas for validation
  docs/         # documentation
```

**counts:** 84 skills, 16 agents, 7 stacks

## skill categories

| category | examples                                                                         |
| -------- | -------------------------------------------------------------------------------- |
| web      | react, next.js, remix, vue, angular, solidjs, scss-modules, zustand, react-query |
| api      | hono, drizzle, better-auth, posthog, resend, axiom+pino+sentry                   |
| mobile   | react-native, expo                                                               |
| cli      | commander.js, clack prompts                                                      |
| infra    | turborepo, github-actions, env config                                            |
| security | auth patterns, xss prevention, secrets management                                |
| meta     | reviewing, research-methodology                                                  |

## stacks

stacks bundle related skills with pre-configured agents. available stacks:

- **nextjs-fullstack** - Next.js App Router + Hono + Drizzle + PostHog
- **react-native-stack** - React Native with Expo
- **vue-stack** - Vue 3 + Nuxt
- **angular-stack** - Angular 17+ standalone components
- **remix-stack** - Remix with loaders/actions
- **solidjs-stack** - SolidJS fine-grained reactivity
- **nuxt-stack** - Nuxt 3 with Nitro

## CLI

the CLI lives in a separate repo. use it to install skills and compile stacks:

```bash
# initialize a plugin with selected skills
cc init

# edit your skill selection
cc edit

# recompile after changes
cc compile
```

see the [CLI repo](https://github.com/claude-collective/cli) for installation.

## development

```bash
# install deps (for prettier hooks)
bun install

# format files
bun run format
```

### adding a skill

1. create `src/skills/<category>/<name> (@author)/SKILL.md`
2. add examples in `examples/` subdirectory
3. add `reference.md` for API docs
4. run the CLI to compile

### stack config format

stacks are defined in `src/stacks/<name>/config.yaml`:

```yaml
name: "Stack Name"
description: "what this stack does"
author: "@handle"
version: "1.0.0"

skills:
  - id: web/framework/react (@vince)
  - id: api/framework/hono (@vince)
```

## license

MIT
