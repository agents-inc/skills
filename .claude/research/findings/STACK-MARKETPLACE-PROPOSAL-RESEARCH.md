# Stack Marketplace Proposal Research

> **Purpose**: Deep analysis of the "Stack Marketplace" vision - pre-configured, community-driven stacks with smart filtering

---

## The Proposal

**Core Vision**: A marketplace where users select pre-configured "stacks" (curated combinations of skills) rather than individual skills.

**Key Concepts**:

1. **Named Stacks**: e.g., "YOLO Modern React Stack" (React + Tailwind + Zustand + React Query)
2. **Conservative Redux Stack**: (React + CSS Modules/SCSS + Redux Toolkit + RTK Query)
3. **Community-Created Stacks**: Anyone can create and share stacks
4. **Quality via Upvotes**: Best stacks rise to top, no tiered curation (Official/Verified)
5. **Smart Filtering**: Choosing React shows React-compatible options; choosing Vite suggests Vitest
6. **Custom Stack Builder**: Users can always build their own from compatible pieces
7. **Build Everything Upfront**: No evolution roadmap - full system before launch

**Philosophy**:
- Stacks are "philosophically consistent" combinations
- Dependencies are implicit through filtering, not explicit rules
- Framework choice (React/Vue/Angular) filters available styling/state/testing options
- Nudge users toward compatible choices without complex terminology

---

## Research Questions

1. **Has this been done before?** Similar stack/boilerplate marketplaces?
2. **How to design smart filtering?** Framework → Styling → State → Testing cascade
3. **How to unify with previous findings?** Skill slots, agent bundling, CLI onboarding
4. **Viability assessment**: Can this drive viral adoption through community contributions?
5. **UI/UX design**: How would users browse and select stacks?

---

## Active Research Agents

| Agent | Focus Area | Status | Started |
|-------|------------|--------|---------|
| Agent 1 | Prior Art - Has This Been Done? | **Complete** | 2026-01-08 |
| Agent 2 | Smart Filtering System Design | **Complete** | 2026-01-08 |
| Agent 3 | Unification with Previous Findings | **Complete** | 2026-01-08 |
| Agent 4 | Viral Adoption & Community Dynamics | **Complete** | 2026-01-08 |
| Agent 5 | Stack Definition Schema & UX | **Complete** | 2026-01-08 |

---

## Agent 1: Prior Art Research

**Focus**: Has a "stack marketplace" concept been done before? What can we learn?

**Status**: **Complete**

**Completed**: 2026-01-08

---

### Executive Summary

After extensive web research, the "Stack Marketplace" concept has **partial precedents but no direct equivalent**. Existing solutions fall into distinct categories: opinionated stack generators (create-t3-app), technology comparison platforms (StackShare), one-click deploy marketplaces (Vercel/Netlify templates), and scaffolding tool ecosystems (Yeoman, Cookiecutter). **None combine community-created stacks with upvoting and smart framework-based filtering** for AI assistant configuration (skills/agents).

The proposal fills a unique gap: applying the "curated combination" concept to Claude Code skills rather than code boilerplates.

---

### 1. Prior Art Analysis

#### 1.1 Opinionated Stack Generators

##### create-t3-app (T3 Stack)

**What It Is**: A CLI that scaffolds a full-stack TypeScript app with Next.js, tRPC, Prisma, and Tailwind.

**Key Stats**: 28,400+ GitHub stars, updated December 2025.

**What Works**:
- **Modularity within opinionation**: Each piece is optional - template is generated based on specific needs
- **Type safety focus**: "Bleed responsibly" philosophy uses proven tech (SQL) but bets on modern patterns (tRPC)
- **Strong community**: Active Discord, community contributions, used by Cal.com and YC startups
- **Single-command setup**: `npm create t3-app@latest` gets users coding immediately

**What Failed/Limitations**:
- **Fixed technology choices**: Only Next.js + specific libraries, no Vue/Svelte/Angular variants
- **No community-created variants**: Cannot create a "T3 with MobX" variant and share it
- **No upvoting/quality system**: Just one official stack, take it or leave it

**Lessons for This Proposal**:
- Type safety and DX are key success factors
- Modularity within an opinionated frame works well
- Community Discord drives adoption and contributions

**Sources**: [create-t3-app GitHub](https://github.com/t3-oss/create-t3-app), [create.t3.gg](https://create.t3.gg/)

---

##### JHipster

**What It Is**: A development platform to generate, develop, and deploy modern web apps and microservices.

**Key Stats**: 22,000+ GitHub stars, 1,000+ contributors, 122,000 monthly downloads (November 2025).

**What Works**:
- **True marketplace**: Has an official [Marketplace](https://www.jhipster.tech/modules/marketplace/) of modules and blueprints
- **Multi-framework support**: Angular, React, Vue on frontend; Spring Boot, Micronaut, Quarkus, Node.js on backend
- **Blueprints system**: Community can create alternative backends (Quarkus Blueprint 3.0.0 in March 2024)
- **Two-team structure**: JHipster Classic (JS) and JHipster Lite (Java) allow experimentation

**What Failed/Limitations**:
- **Very Java-centric**: Despite multi-framework support, primarily used in Java/Spring ecosystem
- **Complex contribution process**: Must publish to npm with specific keywords, blacklist for bad modules
- **No voting/quality tiers**: Just listed or not listed, no upvotes
- **Declining relevance**: Less popular than modern alternatives for non-Java projects

**Lessons for This Proposal**:
- Marketplace with blueprints/modules is viable but needs clear contribution guidelines
- Two-team structure (classic vs lite) can allow experimentation
- Being too tied to one ecosystem limits appeal

**Sources**: [JHipster.tech](https://www.jhipster.tech/), [JHipster Marketplace](https://www.jhipster.tech/modules/marketplace/)

---

##### Yeoman Generators

**What It Is**: The original web scaffolding tool (2012), modular generator ecosystem.

**Key Stats**: 5,600+ community generators, in 2025 "maintenance reboot" mode.

**What Works**:
- **Massive ecosystem**: Anyone can create a generator for any template
- **Modular by design**: Sub-generators for scaffolding parts of projects
- **Inquirer.js prompts**: Rich interactive CLI experience

**What Failed/Limitations**:
- **Declining popularity**: "No longer at the cutting edge of web tooling"
- **Outdated tech**: Many generators unmaintained
- **Discovery problem**: Hard to find quality generators among 5,600+
- **No quality signals**: No votes, ratings, or verification

**Lessons for This Proposal**:
- Open ecosystems can grow huge but suffer quality variance
- Discoverability becomes critical at scale
- Need quality signals (votes, verification) to surface good content
- Maintenance reboot shows that even popular tools need ongoing attention

**Sources**: [Yeoman.io](https://yeoman.io/), [Yeoman Maintenance Reboot](https://yeoman.io/blog/maintenance-reboot)

---

#### 1.2 Technology Stack Platforms

##### StackShare

**What It Is**: A tech stack intelligence platform where developers share what tools they use.

**Key Stats**: 1 million+ engineers, CTOs, and VPEs use StackShare.

**What Works**:
- **Social proof**: See what real companies use (Netflix, Airbnb, Uber)
- **Stack profiles with reviews**: Community-driven insights
- **Awesome Stacks**: Curated [list of tech stacks](https://github.com/stackshareio/awesome-stacks) for different use cases
- **techstack.yml**: Auto-generated file format for repos

**What Failed/Limitations**:
- **Passive discovery, not active generation**: Shows what exists, doesn't scaffold it
- **Company-focused, not project-starter focused**: Optimized for "see Uber's stack" not "start my stack"
- **No smart filtering**: Can't say "I chose React, show me compatible state management"
- **No voting for combinations**: Individual tools rated, not combinations

**Lessons for This Proposal**:
- Social proof (company usage) drives trust
- The "Awesome Stacks" concept proves curated combinations have value
- Gap exists between "discover stacks" and "generate projects with stacks"

**Sources**: [StackShare.io](https://stackshare.io/), [Awesome Stacks GitHub](https://github.com/stackshareio/awesome-stacks)

---

##### AI-Powered Stack Recommenders

**Examples**: [BoilerplateHub Tech Stack Recommender](https://boilerplatehub.com/free-tools/tech-stack-recommender), [Inoxoft AIGenie](https://inoxoft.com/ai-powered-free-technology-stack-recommender/)

**What Works**:
- **Questionnaire-based recommendations**: Answer questions about scale, performance, preferences
- **Personalized output**: Tailored suggestions for programming languages, frameworks, databases
- **Free/no registration**: Low barrier to use

**What Failed/Limitations**:
- **One-time use**: Get a report, not an ongoing relationship
- **No community**: Just AI recommendations, no peer validation
- **No generation**: Recommend technologies but don't scaffold projects

**Lessons for This Proposal**:
- Questionnaire/wizard UX is validated pattern for stack selection
- AI can help but community validation adds trust
- Gap between "recommendation" and "generation" should be bridged

---

#### 1.3 One-Click Deploy Template Marketplaces

##### Vercel Templates

**What It Is**: Starter templates with one-click deploy to Vercel.

**Key Stats**: Community contributions, Fall 2025 cohort announced.

**What Works**:
- **One-click deploy**: Instant project creation with working deployment
- **Community contributions**: Claude Code Templates, Sparka, Animate UI showcased
- **Vercel integration**: Templates optimized for Vercel's platform
- **Open Source Program**: Supports and highlights community projects

**What Failed/Limitations**:
- **Platform lock-in**: Optimized for Vercel deployment
- **No smart filtering**: Browse by category, not cascading compatibility
- **No upvoting**: Featured by Vercel, not community-ranked
- **Code templates, not AI config**: About deployable apps, not AI assistant setup

**Sources**: [Vercel Templates](https://vercel.com/templates), [Vercel Open Source Program](https://vercel.com/blog/vercel-open-source-program-fall-2025-cohort)

---

##### Netlify Templates

**What It Is**: JAMstack templates with "Deploy to Netlify" button.

**What Works**:
- **Deploy to Netlify button**: Embed in README, one-click deployment
- **Git integration**: Auto-populate code into user's Git repo
- **Framework variety**: Next.js, Astro, Hugo, Angular starters

**What Failed/Limitations**:
- Same as Vercel: platform-specific, no smart filtering, no voting

**Sources**: [Netlify Templates](https://www.netlify.com/integrations/templates/), [Deploy from Template Docs](https://docs.netlify.com/start/quickstarts/deploy-from-template/)

---

##### CodeSandbox Template Universe

**What It Is**: Browser-based development environment with template marketplace.

**Key Stats**: Templates for React, Vue, Angular, Python, Rust, and more.

**What Works**:
- **Template Universe**: Public templates shared and discoverable by community
- **Search and filter by keywords and dependencies**: Find templates by what they include
- **Bookmark and organize**: Personal template collections
- **Official + community**: Framework maintainers can add official templates

**What Failed/Limitations**:
- **Browser IDE focus**: About starting in CodeSandbox, not local development
- **No voting/ratings**: Discovery by search, not quality ranking
- **No cascading filters**: Can filter by dependencies but not "if React then show X"

**Sources**: [CodeSandbox Templates](https://codesandbox.io/new), [Template Universe Announcement](https://codesandbox.io/blog/hello-template-universe-goodbye-project-setup)

---

#### 1.4 Template Generation Tools

##### Cookiecutter (Python)

**What It Is**: Cross-platform project template generator using Jinja2 templating.

**Key Stats**: Go-to solution for Python projects, 12/18 analyzed Python templates use it.

**What Works**:
- **Cross-platform**: Windows, Mac, Linux
- **Pre/post-generate hooks**: Complex logic possible
- **Community templates**: Vibrant ecosystem (e.g., Cookiecutter Data Science - 7.6k stars)
- **Standard in Python**: Twelve out of 18 templates analyzed are Cookiecutter-based

**What Failed/Limitations**:
- **Python-centric**: Despite cross-language support, mainly Python ecosystem
- **One-time generation**: No updates after scaffolding
- **No marketplace/voting**: Templates scattered across GitHub
- **Copier emerging as successor**: "Natural evolution" for projects that evolve over time

**Sources**: [Cookiecutter Docs](https://cookiecutter.readthedocs.io/), [Cookiecutter GitHub](https://github.com/cookiecutter/cookiecutter)

---

##### GitHub Template Repositories

**What It Is**: Native GitHub feature - mark repo as template, others use "Use this template" button.

**Key Stats**: 14,284+ repos tagged "boilerplate" on GitHub.

**What Works**:
- **Native integration**: No extra tooling needed
- **Clean history**: New repo without original commit history
- **Discovery via Topics**: Can browse by topic tags

**What Failed/Limitations**:
- **No marketplace**: Discovery relies on GitHub search/topics
- **No quality signals**: Stars help but no ratings/reviews for templates specifically
- **No smart filtering**: Search by keyword, not compatibility cascade
- **Just templates, not combinations**: Individual repos, not curated stacks

**Sources**: [GitHub Template Repos Intro](https://hub.packtpub.com/github-introduces-template-repository-for-easy-boilerplate-code-management-and-distribution/)

---

##### Awesome Lists (Curated Collections)

**What It Is**: Community-curated markdown lists of resources by topic.

**Key Stats**: Main awesome list includes "Stacks - Tech stacks for building different apps and features."

**What Works**:
- **Crowd-sourced curation**: Easy to contribute (edit README)
- **Rapid growth**: Thousands of awesome lists covering every topic
- **sindresorhus/awesome**: Central index with quality standards

**What Failed/Limitations**:
- **Static lists**: No interactive selection or filtering
- **Manual curation**: Quality depends on maintainers
- **No generation**: Links to resources, doesn't scaffold projects
- **No voting within lists**: Items listed equally

**Sources**: [sindresorhus/awesome](https://github.com/sindresorhus/awesome), [Awesome Stacks](https://github.com/stackshareio/awesome-stacks)

---

#### 1.5 Boilerplate Aggregators/Catalogs

##### BoilerplateList

**What It Is**: Catalog of 195+ SaaS boilerplates and starter templates.

**What Works**:
- **Comprehensive catalog**: One place to browse many options
- **Filtering by technology**: React, Next.js, Python, etc.
- **Includes paid options**: Not just free/open-source

**What Failed/Limitations**:
- **Static catalog**: Not an active generation tool
- **No community creation**: Curated by site owners
- **No smart compatibility**: Filter by tag, not cascading logic

**Sources**: [BoilerplateList](https://boilerplatelist.com/)

---

### 2. What Made Successful Projects Viral

Based on research into GitHub star growth patterns and adoption factors:

| Factor | Evidence | Relevance |
|--------|----------|-----------|
| **Social media promotion** | 72.7% of viral growth from social sharing | Discord, Twitter, HN posts critical |
| **Solving genuine pain points** | React simplified UI dev, Kubernetes solved orchestration | Must address real developer friction |
| **Clear documentation** | Top projects invest heavily in getting-started guides | First-time experience must be excellent |
| **Trending technologies** | 19% linked growth to trending tech (AI in 2023-2025) | Timing matters |
| **Active maintenance** | CRA declined due to infrequent updates | Continuous updates signal reliability |
| **Speed/performance** | Vite succeeded over CRA due to instant startup | DX improvements drive adoption |
| **Modularity** | T3 Stack "each piece is optional" | Users want control within guidance |

**Sources**: [ToolJet Star Analysis](https://blog.tooljet.com/complete-guide-to-evaluate-github-stars-with-tooljets-36-k-stars/), [Growth Hacking GitHub](https://www.timlrx.com/blog/growth-hacking-github-how-to-get-github-stars)

---

### 3. Why Create React App Failed and Vite Succeeded

This case study is instructive for understanding what makes boilerplate tools succeed or fail:

| Factor | CRA (Declining) | Vite (Rising) |
|--------|-----------------|---------------|
| **Speed** | 20-30+ seconds to start dev server | Instant (390ms) |
| **Maintenance** | No longer actively maintained by React team | Actively maintained, monthly updates |
| **Modern features** | Slow to adopt React 18 features | Native ESM, modern tooling |
| **Flexibility** | Requires "ejecting" to customize | Plugin ecosystem, easy config |
| **Framework support** | React only | Vue, Svelte, Preact, Qwik, React |
| **Hot reload** | Rebuilds entire app on change | Processes only changed files |

**Key Insight**: Speed and active maintenance trump first-mover advantage. CRA was the default for years but lost to a better tool.

**Sources**: [TatvaSoft Comparison](https://www.tatvasoft.com/outsourcing/2024/07/vite-vs-create-react-app.html), [Dev.to - Stop Using CRA](https://dev.to/simplr_sh/why-you-should-stop-using-create-react-app-and-start-using-vite-react-in-2025-4d21)

---

### 4. Gap Analysis: What This Proposal Does Differently

| Capability | Existing Tools | This Proposal |
|------------|---------------|---------------|
| **Community-created stacks** | No (T3 is one stack) | Yes - anyone can create and share |
| **Upvoting/quality ranking** | No (just stars/downloads) | Yes - best stacks rise to top |
| **Smart cascading filters** | No (filter by tag only) | Yes - React shows React-compatible options |
| **AI assistant configuration** | No (code templates only) | Yes - skills/agents, not just code |
| **Philosophically consistent combos** | Partial (T3 has philosophy) | Yes - stacks express design philosophy |
| **Custom stack builder** | Partial (some have optional pieces) | Yes - build from compatible pieces |
| **Named stacks with identity** | No | Yes - "YOLO Modern React Stack" branding |

---

### 5. Unique Differentiators of This Proposal

1. **Applied to AI Assistant Configuration**
   - All existing tools generate code boilerplates
   - This generates Claude Code skill/agent combinations
   - No direct competition in this space

2. **Community Upvoting for Combinations**
   - StackShare has reviews for individual tools
   - No platform has voting for technology combinations
   - Quality emerges from community, not maintainer curation

3. **Smart Filtering Based on Framework Choice**
   - CodeSandbox filters by dependencies (what's included)
   - This filters by compatibility (what's possible given choices)
   - Cascading: React → Zustand/MobX → React Query/RTK Query

4. **Named Stacks with Philosophy**
   - T3 has one philosophy ("bleed responsibly")
   - This allows multiple competing philosophies
   - "YOLO Modern" vs "Conservative Redux" - names signal intent

5. **Build Everything Upfront**
   - Most projects launch minimal and evolve
   - Proposal: full system before launch (smart filtering, upvotes, custom builder)
   - Higher barrier but more complete initial experience

---

### 6. Lessons to Apply from Prior Art

#### Do This (Proven Patterns)

| Pattern | Source | Application |
|---------|--------|-------------|
| **Modularity within opinionation** | T3 Stack | Stacks are opinionated but pieces are optional |
| **One-command setup** | T3, Vite | `npx claude-stacks create` or similar |
| **Active Discord community** | T3, Oh My Zsh | Central hub for questions, sharing |
| **Show "why" on disabled options** | UI/UX research | Explain why Zustand unavailable if Vue selected |
| **Wizard UI for selection** | Inoxoft, create-next-app | Step-by-step progressive disclosure |
| **Deploy to X button** | Vercel, Netlify | One-click to use a stack |

#### Avoid This (Failed Patterns)

| Anti-Pattern | Source | Avoidance Strategy |
|--------------|--------|---------------------|
| **Open ecosystem without quality signals** | Yeoman | Upvoting from day one |
| **Platform lock-in** | Vercel/Netlify | Framework-agnostic, works anywhere |
| **Stale/unmaintained** | CRA, old Yeoman generators | Active maintenance commitment |
| **Discovery nightmare at scale** | 5,600 Yeoman generators | Smart filtering, trending, top-voted |
| **No community creation** | T3 (single stack) | Anyone can create stacks |

---

### 7. Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Cold start problem** (no stacks to browse) | High | Pre-seed with 5-10 quality stacks before launch |
| **Quality variance** | Medium | Upvoting surfaces good content; downvoting hides bad |
| **Naming conflicts** | Medium | Scoped names: @user/stack-name |
| **Outdated stacks** | Medium | Show "last updated" date; flag stale stacks |
| **Overwhelming complexity** | Low | Progressive disclosure wizard; start simple |
| **No adoption** | Medium | Strong launch on social media, community building |

---

### 8. Conclusion

**Has this been done before?** Partially, but not the full vision:

- **Boilerplate generators** (T3, Yeoman) scaffold code but don't have community stacks with voting
- **Stack platforms** (StackShare) show what companies use but don't generate projects
- **Template marketplaces** (Vercel, Netlify) deploy apps but lack smart filtering
- **AI recommenders** (BoilerplateHub) suggest tech but don't generate or have community

**The unique value proposition**: A marketplace of community-created, upvote-ranked skill/agent stacks for Claude Code, with smart cascading filters that nudge toward compatible choices.

**Viability**: High, if launched with:
1. Pre-seeded quality stacks (avoid cold start)
2. Excellent wizard UX (avoid complexity overwhelm)
3. Active community building (Discord, social media)
4. Clear "why" explanations for filtering decisions

---

### Sources Consulted

**Stack Generators**:
- [create-t3-app GitHub](https://github.com/t3-oss/create-t3-app)
- [create.t3.gg](https://create.t3.gg/)
- [JHipster.tech](https://www.jhipster.tech/)
- [JHipster Marketplace](https://www.jhipster.tech/modules/marketplace/)
- [Yeoman.io](https://yeoman.io/)

**Template Marketplaces**:
- [Vercel Templates](https://vercel.com/templates)
- [Netlify Templates](https://www.netlify.com/integrations/templates/)
- [CodeSandbox Template Universe](https://codesandbox.io/blog/hello-template-universe-goodbye-project-setup)

**Stack Platforms**:
- [StackShare.io](https://stackshare.io/)
- [Awesome Stacks GitHub](https://github.com/stackshareio/awesome-stacks)
- [BoilerplateList](https://boilerplatelist.com/)

**Scaffolding Tools**:
- [Cookiecutter Docs](https://cookiecutter.readthedocs.io/)
- [GitHub Template Repositories](https://hub.packtpub.com/github-introduces-template-repository-for-easy-boilerplate-code-management-and-distribution/)

**Adoption Research**:
- [ToolJet Star Analysis](https://blog.tooljet.com/complete-guide-to-evaluate-github-stars-with-tooljets-36-k-stars/)
- [Growth Hacking GitHub](https://www.timlrx.com/blog/growth-hacking-github-how-to-get-github-stars)
- [GitHub Octoverse 2023](https://github.blog/news-insights/research/the-state-of-open-source-and-ai/)

**CRA vs Vite**:
- [TatvaSoft Comparison](https://www.tatvasoft.com/outsourcing/2024/07/vite-vs-create-react-app.html)
- [Dev.to - Stop Using CRA](https://dev.to/simplr_sh/why-you-should-stop-using-create-react-app-and-start-using-vite-react-in-2025-4d21)

---

## Agent 2: Smart Filtering System Design

**Focus**: How to implement the cascading filter system (Framework → Styling → State → Testing)

**Status**: **Complete**

**Completed**: 2026-01-08

---

### Executive Summary

The Smart Filtering System uses a **weighted graph model** with cascading category constraints. Rather than simple "yes/no" compatibility, the system uses three relationship types: **requires**, **suggests**, and **conflicts**. The key innovation is treating filtering as a **progressive disclosure wizard** where each choice narrows subsequent options while showing users *why* options are filtered.

---

### 1. Filter Dimensions

The marketplace needs **10 primary filter dimensions** organized into three tiers based on their architectural impact:

#### Tier 1: Foundation Choices (Lock In Major Architecture)

| Dimension | Options | Impact |
|-----------|---------|--------|
| **Language** | TypeScript, JavaScript | Affects all tooling, type definitions, skill content |
| **Frontend Framework** | React, Vue, Svelte, Angular, Solid, None | Determines component patterns, state management options, styling integration |
| **Meta-Framework** | Next.js, Remix, Nuxt, SvelteKit, Astro, None | Determines routing, SSR/SSG patterns, deployment |

#### Tier 2: Paradigm Choices (Shape Development Patterns)

| Dimension | Options | Impact |
|-----------|---------|--------|
| **Styling Approach** | SCSS Modules, Tailwind, Styled Components, CSS-in-JS (Emotion), Vanilla Extract, CSS Modules, None | Component styling patterns, design token usage |
| **State Management** | Zustand, MobX, Redux Toolkit, Jotai, Recoil, Pinia (Vue), Signals, Context only | Data flow patterns, store architecture |
| **Data Fetching** | React Query, SWR, RTK Query, Apollo Client, URQL, tRPC, Fetch only | Server state patterns, caching strategy |

#### Tier 3: Tooling Choices (Lower Impact, More Flexibility)

| Dimension | Options | Impact |
|-----------|---------|--------|
| **Bundler** | Vite, Webpack, Turbopack, esbuild, Parcel | Build config, plugin ecosystem |
| **Testing** | Vitest, Jest, Karma, Mocha, Playwright (E2E) | Test runner config, assertion style |
| **Backend Framework** | Hono, Express, Fastify, NestJS, Elysia, None | API patterns, middleware |
| **ORM** | Drizzle, Prisma, TypeORM, Kysely, None | Database patterns, query style |

#### Cross-Cutting (Framework-Agnostic)

These work with any combination:
- **TypeScript** (language, not a filter dimension)
- **ESLint/Prettier** (universal)
- **Git/GitHub** (universal)
- **CI/CD tooling** (mostly universal)

---

### 2. Cascade Model: How Choices Flow

The cascade follows a **directed acyclic graph (DAG)** where earlier choices constrain later ones:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DECISION FLOW                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   [Language] ──────────────────────────────────────────────────────────>│
│       │                                                                 │
│       v                                                                 │
│   [Framework] ────────────────┬──────────────────┬─────────────────────>│
│       │                       │                  │                      │
│       │                       v                  v                      │
│       │              [Meta-Framework]      [Styling]                    │
│       │                       │                  │                      │
│       v                       v                  │                      │
│   [State Mgmt] <──────────────┘                  │                      │
│       │                                          │                      │
│       v                                          v                      │
│   [Data Fetching] ────────────────────> [Bundler] ───> [Testing]        │
│                                              │                          │
│                                              v                          │
│                                    [Backend] ───> [ORM]                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Cascade Rules

**Rule 1: Framework Determines State Management Options**
```
React → [Zustand, MobX, Redux, Jotai, Recoil, Context]
Vue → [Pinia, Vuex, Composables]
Svelte → [Svelte stores, nanostores]
Angular → [NgRx, Akita, Services, Signals]
Solid → [Solid stores, createSignal]
```

**Rule 2: Framework Determines Data Fetching Options**
```
React → [React Query, SWR, RTK Query, Apollo, tRPC]
Vue → [Vue Query, Apollo, tRPC]
Svelte → [Svelte Query, tRPC]
Angular → [HttpClient, Apollo, RTK Query]
```

**Rule 3: Meta-Framework Influences Bundler**
```
Next.js → Webpack (default) or Turbopack (suggested)
Remix → Vite (required)
Nuxt → Vite (required)
SvelteKit → Vite (required)
Astro → Vite (required)
None → [Vite (suggested), Webpack, esbuild, Parcel]
```

**Rule 4: Bundler Suggests Testing Framework**
```
Vite → Vitest (strongly suggested, shared config)
Webpack → Jest (traditional pairing)
Any → Playwright (E2E, independent)
```

**Rule 5: Styling Works Across Frameworks (Mostly)**
```
SCSS Modules → All frameworks
Tailwind → All frameworks
CSS Modules → All frameworks
Styled Components → React, Solid (not Vue/Svelte/Angular)
Emotion → React, Solid
Vanilla Extract → All frameworks
Vue SFC styles → Vue only
Svelte scoped → Svelte only
```

---

### 3. Compatibility Schema Design

Building on Agent B's dependency system research, the filtering schema uses four relationship types:

#### 3.1 Relationship Types

```typescript
type RelationshipType =
  | 'requires'      // MUST have (hard dependency)
  | 'suggests'      // SHOULD have (strong recommendation)
  | 'enhances'      // Nice to have together (soft suggestion)
  | 'conflicts';    // CANNOT have together (mutual exclusion)
```

#### 3.2 Full Schema Definition

```yaml
# filtering-schema.yaml

# =============================================================================
# Category Definitions
# =============================================================================
categories:
  language:
    type: required          # Must select exactly one
    cardinality: single     # Only one allowed
    tier: foundation
    display_order: 1

  frontend-framework:
    type: required
    cardinality: single
    tier: foundation
    display_order: 2

  meta-framework:
    type: optional          # Can skip
    cardinality: single
    tier: foundation
    display_order: 3

  styling:
    type: required
    cardinality: single     # Primary styling approach
    tier: paradigm
    display_order: 4

  state-management:
    type: optional
    cardinality: single
    tier: paradigm
    display_order: 5

  data-fetching:
    type: optional
    cardinality: single
    tier: paradigm
    display_order: 6

  bundler:
    type: inferred          # Often determined by meta-framework
    cardinality: single
    tier: tooling
    display_order: 7

  testing:
    type: optional
    cardinality: multiple   # Can have unit + E2E
    tier: tooling
    display_order: 8

  backend-framework:
    type: optional
    cardinality: single
    tier: tooling
    display_order: 9

  orm:
    type: optional
    cardinality: single
    tier: tooling
    display_order: 10

# =============================================================================
# Technology Definitions with Relationships
# =============================================================================
technologies:
  # ---------------------------------------------------------------------------
  # Frontend Frameworks
  # ---------------------------------------------------------------------------
  react:
    category: frontend-framework
    display_name: React
    description: Component-based UI library with hooks
    logo: react.svg
    popularity: 5        # 1-5 scale for sorting
    relationships:
      suggests:
        - id: typescript
          reason: React + TypeScript is the dominant combination
        - id: react-query
          reason: Best-in-class server state management for React
        - id: zustand
          reason: Lightweight, hooks-based state management
      enhances:
        - id: vite
          reason: Fast HMR and modern DX
      enables:  # Technologies that become available
        - zustand
        - mobx
        - redux-toolkit
        - jotai
        - recoil
        - react-query
        - swr
        - rtk-query
        - styled-components
        - emotion

  vue:
    category: frontend-framework
    display_name: Vue
    description: Progressive framework with composition API
    logo: vue.svg
    popularity: 4
    relationships:
      suggests:
        - id: typescript
          reason: Vue 3 has excellent TypeScript support
        - id: pinia
          reason: Official Vue state management
        - id: nuxt
          reason: Full-stack Vue framework
      enables:
        - pinia
        - vuex
        - vue-query
        - nuxt

  svelte:
    category: frontend-framework
    display_name: Svelte
    description: Compile-time reactive framework
    logo: svelte.svg
    popularity: 3
    relationships:
      suggests:
        - id: sveltekit
          reason: Official full-stack Svelte framework
      enables:
        - svelte-stores
        - svelte-query
        - sveltekit
      conflicts:
        - id: styled-components
          reason: Svelte uses built-in scoped styles

  # ---------------------------------------------------------------------------
  # State Management
  # ---------------------------------------------------------------------------
  zustand:
    category: state-management
    display_name: Zustand
    description: Small, fast, scalable state management
    logo: zustand.svg
    popularity: 5
    relationships:
      requires:
        - id: react
          reason: Zustand is built on React hooks
      enhances:
        - id: react-query
          reason: Zustand for client state, React Query for server state
        - id: immer
          reason: Immutable updates made easy

  mobx:
    category: state-management
    display_name: MobX
    description: Simple, scalable state with observables
    logo: mobx.svg
    popularity: 3
    relationships:
      requires:
        - id: react
          reason: MobX-React bindings needed
      conflicts:
        - id: zustand
          reason: Both are global state solutions

  redux-toolkit:
    category: state-management
    display_name: Redux Toolkit
    description: Official Redux with modern patterns
    logo: redux.svg
    popularity: 4
    relationships:
      requires:
        - id: react
          reason: Redux requires React-Redux bindings
      suggests:
        - id: rtk-query
          reason: Integrated data fetching with Redux

  pinia:
    category: state-management
    display_name: Pinia
    description: Vue's official state management
    logo: pinia.svg
    popularity: 5
    relationships:
      requires:
        - id: vue
          reason: Pinia is Vue-specific

  # ---------------------------------------------------------------------------
  # Styling
  # ---------------------------------------------------------------------------
  scss-modules:
    category: styling
    display_name: SCSS Modules
    description: Scoped SCSS with CSS Modules
    logo: scss.svg
    popularity: 4
    relationships:
      suggests:
        - id: cva
          reason: Class variance authority for component variants
      enhances:
        - id: design-tokens
          reason: SCSS variables work great with tokens

  tailwind:
    category: styling
    display_name: Tailwind CSS
    description: Utility-first CSS framework
    logo: tailwind.svg
    popularity: 5
    relationships:
      suggests:
        - id: tailwind-merge
          reason: Merge conflicting Tailwind classes
        - id: clsx
          reason: Conditional class composition
      # NOTE: Tailwind does NOT conflict with SCSS/CSS Modules
      # They can be used together: Tailwind for utilities, Modules for components

  styled-components:
    category: styling
    display_name: Styled Components
    description: CSS-in-JS with template literals
    logo: styled-components.svg
    popularity: 3
    relationships:
      requires:
        - id: react
          reason: Styled Components is React-specific
      conflicts:
        - id: emotion
          reason: Both are CSS-in-JS solutions

  # ---------------------------------------------------------------------------
  # Data Fetching
  # ---------------------------------------------------------------------------
  react-query:
    category: data-fetching
    display_name: React Query (TanStack Query)
    description: Powerful server state management
    logo: react-query.svg
    popularity: 5
    relationships:
      requires:
        - id: react
          reason: React Query uses React hooks
      enhances:
        - id: zustand
          reason: Zustand for client state, RQ for server state

  swr:
    category: data-fetching
    display_name: SWR
    description: Stale-while-revalidate data fetching
    logo: swr.svg
    popularity: 3
    relationships:
      requires:
        - id: react
          reason: SWR is React-specific
      conflicts:
        - id: react-query
          reason: Both solve the same problem

  rtk-query:
    category: data-fetching
    display_name: RTK Query
    description: Data fetching built into Redux Toolkit
    logo: redux.svg
    popularity: 3
    relationships:
      requires:
        - id: redux-toolkit
          reason: RTK Query is part of Redux Toolkit
      conflicts:
        - id: react-query
          reason: Both handle server state

  # ---------------------------------------------------------------------------
  # Meta-Frameworks
  # ---------------------------------------------------------------------------
  nextjs:
    category: meta-framework
    display_name: Next.js
    description: Full-stack React framework
    logo: nextjs.svg
    popularity: 5
    relationships:
      requires:
        - id: react
          reason: Next.js is built on React
      suggests:
        - id: turbopack
          reason: Next.js native bundler (faster than Webpack)
      conflicts:
        - id: remix
          reason: Both are React meta-frameworks

  remix:
    category: meta-framework
    display_name: Remix
    description: Full-stack React with nested routing
    logo: remix.svg
    popularity: 4
    relationships:
      requires:
        - id: react
          reason: Remix is built on React
        - id: vite
          reason: Remix uses Vite as bundler
      conflicts:
        - id: nextjs
          reason: Both are React meta-frameworks

  nuxt:
    category: meta-framework
    display_name: Nuxt
    description: Full-stack Vue framework
    logo: nuxt.svg
    popularity: 4
    relationships:
      requires:
        - id: vue
          reason: Nuxt is built on Vue
        - id: vite
          reason: Nuxt uses Vite

  # ---------------------------------------------------------------------------
  # Bundlers
  # ---------------------------------------------------------------------------
  vite:
    category: bundler
    display_name: Vite
    description: Next-generation frontend tooling
    logo: vite.svg
    popularity: 5
    relationships:
      suggests:
        - id: vitest
          reason: Vitest shares Vite config, seamless integration

  webpack:
    category: bundler
    display_name: Webpack
    description: Powerful, configurable bundler
    logo: webpack.svg
    popularity: 3
    relationships:
      suggests:
        - id: jest
          reason: Traditional Jest + Webpack pairing

  # ---------------------------------------------------------------------------
  # Testing
  # ---------------------------------------------------------------------------
  vitest:
    category: testing
    subcategory: unit
    display_name: Vitest
    description: Fast Vite-native unit testing
    logo: vitest.svg
    popularity: 5
    relationships:
      suggests:
        - id: vite
          reason: Shares Vite config, instant HMR for tests
      conflicts:
        - id: jest
          reason: Both are unit test runners

  jest:
    category: testing
    subcategory: unit
    display_name: Jest
    description: Delightful JavaScript testing
    logo: jest.svg
    popularity: 4
    relationships:
      conflicts:
        - id: vitest
          reason: Both are unit test runners

  playwright:
    category: testing
    subcategory: e2e
    display_name: Playwright
    description: Cross-browser E2E testing
    logo: playwright.svg
    popularity: 5
    # No conflicts - E2E is independent of unit testing

  # ---------------------------------------------------------------------------
  # Backend
  # ---------------------------------------------------------------------------
  hono:
    category: backend-framework
    display_name: Hono
    description: Lightweight web framework for the edge
    logo: hono.svg
    popularity: 4
    relationships:
      suggests:
        - id: zod
          reason: Zod for request/response validation

  # ---------------------------------------------------------------------------
  # ORM
  # ---------------------------------------------------------------------------
  drizzle:
    category: orm
    display_name: Drizzle
    description: TypeScript ORM with SQL-like syntax
    logo: drizzle.svg
    popularity: 5
    relationships:
      requires:
        - id: typescript
          reason: Drizzle requires TypeScript for type safety
      conflicts:
        - id: prisma
          reason: Both are TypeScript ORMs
```

#### 3.3 TypeScript Type Definitions

```typescript
// types/filtering.ts

export type CategoryType = 'required' | 'optional' | 'inferred';
export type Cardinality = 'single' | 'multiple';
export type Tier = 'foundation' | 'paradigm' | 'tooling';

export interface CategoryDefinition {
  type: CategoryType;
  cardinality: Cardinality;
  tier: Tier;
  display_order: number;
}

export interface RelationshipEntry {
  id: string;
  reason: string;
}

export interface TechnologyRelationships {
  requires?: RelationshipEntry[];    // Hard dependencies
  suggests?: RelationshipEntry[];    // Strong recommendations
  enhances?: RelationshipEntry[];    // Nice-to-have pairings
  conflicts?: RelationshipEntry[];   // Mutual exclusions
  enables?: string[];                // Technologies unlocked by this choice
}

export interface TechnologyDefinition {
  category: string;
  subcategory?: string;
  display_name: string;
  description: string;
  logo?: string;
  popularity: number;
  relationships?: TechnologyRelationships;
}

export interface FilterState {
  selected: Map<string, string | string[]>;  // category -> tech(s)
  available: Map<string, string[]>;          // category -> available techs
  suggested: Map<string, string[]>;          // category -> suggested techs
  disabled: Map<string, DisabledReason[]>;   // tech -> reasons
}

export interface DisabledReason {
  type: 'requires' | 'conflicts' | 'not_enabled';
  blocking_tech: string;
  message: string;
}

export interface FilterResult {
  valid: boolean;
  warnings: string[];
  suggestions: SuggestionEntry[];
  resolved: ResolvedStack;
}

export interface SuggestionEntry {
  tech_id: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ResolvedStack {
  technologies: string[];
  skills: string[];
  agents: string[];
}
```

---

### 4. Filtering Algorithm

```typescript
// lib/filter-engine.ts

class FilterEngine {
  private schema: FilterSchema;
  private state: FilterState;

  constructor(schema: FilterSchema) {
    this.schema = schema;
    this.state = this.initializeState();
  }

  /**
   * When user selects a technology, cascade effects through the graph
   */
  select(techId: string): FilterResult {
    const tech = this.schema.technologies[techId];

    // 1. Add to selected
    this.state.selected.set(tech.category, techId);

    // 2. Process "enables" - unlock dependent technologies
    for (const enabledId of tech.relationships?.enables || []) {
      this.addToAvailable(enabledId);
    }

    // 3. Process "requires" - auto-select dependencies
    for (const req of tech.relationships?.requires || []) {
      if (!this.isSelected(req.id)) {
        // Auto-select required dependency
        this.select(req.id);
      }
    }

    // 4. Process "conflicts" - disable incompatible options
    for (const conflict of tech.relationships?.conflicts || []) {
      this.disableTech(conflict.id, {
        type: 'conflicts',
        blocking_tech: techId,
        message: `Cannot use ${conflict.id} with ${techId}: ${conflict.reason}`
      });
    }

    // 5. Process "suggests" - highlight recommended options
    for (const suggestion of tech.relationships?.suggests || []) {
      this.addSuggestion(suggestion.id, suggestion.reason, 'high');
    }

    // 6. Update available options for all categories
    this.recalculateAvailable();

    return this.validate();
  }

  /**
   * Calculate which technologies are available given current selections
   */
  private recalculateAvailable(): void {
    for (const [categoryId, category] of Object.entries(this.schema.categories)) {
      const techs = this.getTechsInCategory(categoryId);
      const available: string[] = [];

      for (const techId of techs) {
        const reasons = this.getDisabledReasons(techId);
        if (reasons.length === 0) {
          available.push(techId);
        } else {
          this.state.disabled.set(techId, reasons);
        }
      }

      this.state.available.set(categoryId, available);
    }
  }

  /**
   * Check why a technology might be disabled
   */
  private getDisabledReasons(techId: string): DisabledReason[] {
    const tech = this.schema.technologies[techId];
    const reasons: DisabledReason[] = [];

    // Check if any selected tech conflicts with this one
    for (const [_, selectedId] of this.state.selected) {
      const selected = this.schema.technologies[selectedId];
      const conflicts = selected.relationships?.conflicts || [];

      for (const conflict of conflicts) {
        if (conflict.id === techId) {
          reasons.push({
            type: 'conflicts',
            blocking_tech: selectedId,
            message: conflict.reason
          });
        }
      }
    }

    // Check if required dependencies are missing
    for (const req of tech.relationships?.requires || []) {
      if (!this.isSelected(req.id) && !this.isAvailable(req.id)) {
        reasons.push({
          type: 'requires',
          blocking_tech: req.id,
          message: `Requires ${req.id}: ${req.reason}`
        });
      }
    }

    // Check if this tech needs to be "enabled" by another selection
    const enabledBy = this.getEnablingTechs(techId);
    if (enabledBy.length > 0 && !enabledBy.some(e => this.isSelected(e))) {
      reasons.push({
        type: 'not_enabled',
        blocking_tech: enabledBy[0],
        message: `Select ${enabledBy.join(' or ')} first`
      });
    }

    return reasons;
  }
}
```

---

### 5. Edge Case Handling

#### Edge Case 1: Monorepo with Multiple Frameworks

**Scenario**: User wants React for web app, Vue for admin dashboard, both in same monorepo.

**Solution**: Support **per-workspace filtering**:

```yaml
# Stack selection is per-workspace, not global
workspaces:
  web-app:
    framework: react
    styling: tailwind
    state: zustand
  admin-dashboard:
    framework: vue
    styling: tailwind  # Can share some choices
    state: pinia       # Framework-specific
  shared-ui:
    framework: none    # Framework-agnostic utilities
    styling: tailwind
```

**UX Implication**: Add "Add Workspace" button that creates independent filter instance.

---

#### Edge Case 2: Framework-Agnostic Tools

**Scenario**: User wants TypeScript, ESLint, Prettier regardless of framework choice.

**Solution**: Mark tools as **universal** - they skip framework filtering:

```yaml
typescript:
  category: language
  universal: true  # Always available

eslint:
  category: tooling
  universal: true
  subcategory: linting

prettier:
  category: tooling
  universal: true
  subcategory: formatting
```

**UX Implication**: Show universal tools in a separate "Always Included" section.

---

#### Edge Case 3: Tailwind + SCSS Together

**Scenario**: User wants Tailwind for utilities but SCSS Modules for component-specific styles.

**Solution**: This is VALID! The schema does NOT mark them as conflicting:

```yaml
tailwind:
  category: styling
  # Note: NO conflict with scss-modules
  # These can coexist:
  # - Tailwind for utility classes (@apply, @screen)
  # - SCSS Modules for component-specific isolation

scss-modules:
  category: styling
  # Can coexist with Tailwind
```

**UX Implication**: Show a "Hybrid Styling" option or allow multi-select in styling category with a tooltip explaining the combination.

**Alternative**: Create an explicit hybrid option:

```yaml
tailwind-scss-hybrid:
  category: styling
  display_name: Tailwind + SCSS Modules
  description: Tailwind utilities with SCSS Modules for component styles
  relationships:
    requires:
      - tailwind
      - scss-modules
```

---

#### Edge Case 4: Redux Toolkit + RTK Query Auto-Selection

**Scenario**: User selects RTK Query, which requires Redux Toolkit.

**Solution**: Auto-select dependencies with notification:

```typescript
// When selecting rtk-query
const rtk_query = select('rtk-query');

// Engine auto-selects redux-toolkit
// UI shows: "Redux Toolkit was auto-selected (required by RTK Query)"
```

**UX Implication**: Show a toast/banner: "Added Redux Toolkit (required by RTK Query)"

---

#### Edge Case 5: Changing Framework After Selections Made

**Scenario**: User selects React → Zustand → React Query, then changes framework to Vue.

**Solution**: **Cascade removal** with confirmation:

```
⚠️ Changing to Vue will remove incompatible selections:
  - Zustand (React-only) → Will use Pinia instead
  - React Query (React-only) → Will use Vue Query instead

[Keep React] [Switch to Vue with replacements] [Switch and clear]
```

**UX Implication**: Show what will be lost/replaced before confirming destructive changes.

---

#### Edge Case 6: No Framework (Vanilla JS/TS)

**Scenario**: User building a vanilla TypeScript library, no framework.

**Solution**: Support "None" as valid framework choice:

```yaml
none-framework:
  category: frontend-framework
  display_name: No Framework (Vanilla)
  description: Pure TypeScript/JavaScript, no framework
  relationships:
    # Disables framework-specific options
    conflicts:
      - id: zustand
        reason: Zustand requires React
      - id: react-query
        reason: React Query requires React
```

**UX Implication**: Show "Vanilla JS/TS" as first option with note about limited state/data options.

---

#### Edge Case 7: Conflicting Suggestions

**Scenario**: React suggests both Zustand AND Redux Toolkit.

**Solution**: Suggestions are not exclusive - user chooses:

```yaml
react:
  suggests:
    - id: zustand
      reason: Lightweight, hooks-based
      priority: high
    - id: redux-toolkit
      reason: Powerful, enterprise-ready
      priority: medium
```

**UX Implication**: Show suggestions with priority indicators but let user pick one.

---

### 6. UX Flow Recommendation

#### 6.1 Progressive Disclosure Wizard

**Recommended Approach**: Step-by-step wizard that reveals options progressively:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1 of 5: Foundation                                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                         │
│  What's your frontend framework?                                        │
│                                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │  React  │  │   Vue   │  │ Svelte  │  │ Angular │  │  None   │       │
│  │  ★★★★★  │  │  ★★★★☆  │  │  ★★★☆☆  │  │  ★★★★☆  │  │  ★★☆☆☆  │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                 ↑ selected                                              │
│                                                                         │
│  💡 Vue is great for gradual adoption and has excellent TypeScript      │
│     support. We suggest Nuxt for full-stack capabilities.               │
│                                                                         │
│                                              [Back] [Continue →]        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2 of 5: Styling                                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                         │
│  How do you want to style components?                                   │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│  │  Tailwind   │  │ SCSS Modules│  │ CSS Modules │                     │
│  │  ★★★★★      │  │  ★★★★☆      │  │  ★★★☆☆      │                     │
│  │ ⚡ suggested │  │             │  │             │                     │
│  └─────────────┘  └─────────────┘  └─────────────┘                     │
│                                                                         │
│  ╭──────────────────────────────────────────────────────────────────╮  │
│  │ ⚠️ Styled Components unavailable with Vue (React-only)           │  │
│  │ ⚠️ Emotion unavailable with Vue (React-only)                     │  │
│  ╰──────────────────────────────────────────────────────────────────╯  │
│                                                                         │
│                                              [Back] [Continue →]        │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 6.2 Why Tooltips

Every disabled option shows WHY on hover:

```
┌──────────────┐
│ Zustand      │ ← Disabled, grayed out
│ ★★★★★        │
│ 🚫           │
└──────────────┘
       │
       v
┌──────────────────────────────────────┐
│ Not available                        │
│                                      │
│ Zustand requires React.              │
│ You selected Vue, which uses Pinia.  │
│                                      │
│ [Switch to React] [Learn about Pinia]│
└──────────────────────────────────────┘
```

#### 6.3 Summary Panel (Always Visible)

```
┌─────────────────────────────────────┐
│  YOUR STACK                         │
│  ───────────────────────────────── │
│  Framework:  Vue                    │
│  Meta:       Nuxt ⚡ suggested       │
│  Styling:    Tailwind               │
│  State:      Pinia ⚡ auto-added     │
│  Data:       (not selected)         │
│  Bundler:    Vite ⚡ required        │
│  Testing:    (not selected)         │
│  ───────────────────────────────── │
│  Skills to be generated: 6          │
│  Estimated setup time: 5 min        │
│                                     │
│  [📋 Export as YAML] [🚀 Generate]  │
└─────────────────────────────────────┘
```

#### 6.4 Advanced Mode Toggle

For power users who want all options at once:

```
[✓] Advanced Mode - Show all categories simultaneously

When enabled:
- All 10 categories shown on one page
- Real-time filtering as selections change
- Keyboard navigation between categories
- Bulk operations (clear all, apply preset)
```

#### 6.5 Mobile Experience

On mobile, use **accordion categories**:

```
┌─────────────────────────────────┐
│  🏗️ Foundation                  │
│  React, TypeScript              │
│                          [▼]    │
├─────────────────────────────────┤
│  🎨 Styling                     │
│  (tap to select)                │
│                          [▶]    │
├─────────────────────────────────┤
│  📦 State Management            │
│  (tap to select)                │
│                          [▶]    │
└─────────────────────────────────┘
```

---

### 7. Integration with Agent B's Dependency System

The filtering schema aligns with Agent B's dependency system from the Community Registry research:

| Agent B Concept | Filtering System Equivalent |
|-----------------|----------------------------|
| `requires` | `requires` - auto-select dependencies |
| `conflicts` | `conflicts` - disable incompatible |
| `enhancedBy` | `enhances` - suggest pairings |
| `replaces` | Not needed for filtering (used for migrations) |
| Category exclusivity | `cardinality: single` + filtering |

The filtering system is the **user-facing layer** on top of the dependency validation system.

---

### 8. Summary: Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Cascade direction** | Foundation → Tooling | Framework choice has highest impact |
| **Relationship types** | 4 types (requires, suggests, enhances, conflicts) | Covers all real-world cases |
| **Cardinality** | Single (most) or Multiple (testing) | Reflects real usage patterns |
| **Disabled handling** | Show reason, not just gray out | Users understand why, not just what |
| **Auto-selection** | Yes for `requires`, No for `suggests` | Balance convenience with control |
| **UX model** | Progressive wizard with advanced toggle | Works for beginners and experts |
| **Monorepo support** | Per-workspace filtering | Real teams need multiple stacks |
| **Hybrid styling** | Allow Tailwind + SCSS together | Real pattern, should not prevent |

---

### 9. Implementation Priority

**Phase 1 (MVP)**:
1. [ ] Define schema for top 20 technologies
2. [ ] Implement basic cascade algorithm
3. [ ] Build wizard UI with 5 steps
4. [ ] Show disabled reasons on hover

**Phase 2 (Polish)**:
5. [ ] Add "suggested" highlights
6. [ ] Implement advanced mode
7. [ ] Add preset stacks ("Quick Start")
8. [ ] Mobile-responsive accordion

**Phase 3 (Scale)**:
9. [ ] Per-workspace filtering
10. [ ] Community-contributed technologies
11. [ ] Popularity-based sorting updates
12. [ ] Analytics on common combinations

---

### 10. Files Analyzed

- `/home/vince/dev/claude-subagents/src/registry.yaml` - Current skill/agent structure
- `/home/vince/dev/claude-subagents/.claude/research/findings/COMMUNITY-REGISTRY-PROPOSAL-RESEARCH.md` - Agent B dependency system

---

---

## Agent 3: Unification with Previous Findings

**Focus**: How does this integrate with skill slots, agent bundling, CLI patterns from previous research?

**Status**: Complete

**Completed**: 2026-01-08

---

### Executive Summary

The Stack Marketplace proposal is **evolutionary, not revolutionary**. It builds on previous findings rather than replacing them. The key insight: **stacks are a UI/UX layer on top of the existing skill slot architecture**. Previous research provides the foundation (skill slots, dependency rules, compilation pipeline); the new proposal provides the user experience (stack-first selection, smart filtering, community voting).

---

### 1. What Carries Forward from Previous Research

#### From Round 1 (Open Source Strategy):

| Finding | Carries Forward? | How It Applies |
|---------|-----------------|----------------|
| **Dev Kit positioning** (fork + customize) | YES | Stacks are templates users fork and customize |
| **`_templates/` + `local/` structure** | YES, enhanced | `_templates/` becomes `stacks/`, `local/` remains for user customization |
| **CLI onboarding with role-based selection** | YES, enhanced | Stack selection BEFORE role selection |
| **Additive framing** ("what do you do?") | YES | "Choose a stack" is additive framing |
| **Separation: core/ vs examples/** | YES | Core = framework, Stacks = examples |

#### From Round 2 (Community Registry):

| Finding | Carries Forward? | How It Applies |
|---------|-----------------|----------------|
| **Skill Slots with Defaults (Agent D)** | YES, critical | Stacks fill slots. The slot system IS the implementation mechanism |
| **Tiered skills: core-integration-variant (Agent A)** | YES | Skills still have tiers; stacks bundle them appropriately |
| **Homebrew-style dependencies (Agent B)** | YES, enhanced | Powers smart filtering. `requires`, `conflicts` drive the UI |
| **Tiered registry (Agent C)** | MODIFIED | Simplified to: Curated + Community + Upvotes |
| **80/20 rule: lightweight community repo (Agent E)** | YES | Start with curated stacks, add community later |
| **Bounded skill isolation (Agent A)** | YES | Skills remain ~85% domain-specific, ~15% integration |

---

### 2. Resolving Contradictions

#### Contradiction 1: "Defer registry to v2" vs "Build full marketplace upfront"

**Resolution: Phased Acceleration**

| Phase | Timeline | Content |
|-------|----------|---------|
| **Phase 1 (Launch)** | Week 0 | 4-6 curated stacks. Smart filtering for custom builds. No community submissions yet. |
| **Phase 2 (Growth)** | Month 1-2 | Community stack submissions via PR. Basic upvote system. |
| **Phase 3 (Scale)** | Month 3-6 | Verified badges for reviewed stacks. Stack browsing UI. Full marketplace. |

#### Contradiction 2: "Tiered quality control" vs "Just upvotes"

**Resolution: Hybrid Quality Signals**

```yaml
stacks:
  yolo-modern-react:
    meta:
      upvotes: 1234         # Popularity signal (from new proposal)
      verified: true        # Quality signal (from previous research)
      maintained: true      # Freshness signal (new addition)
```

#### Contradiction 3: "Explicit dependencies" vs "Smart filtering"

**Resolution: Filtering IS the UI for Dependencies**

Smart filtering is the UI/UX layer. Dependency rules (`requires`, `conflicts`) are the data layer that powers filtering. The user never sees "dependency" terminology - they just see compatible options.

---

### 3. Unified Architecture

**Key Layers:**

1. **Stack Marketplace (UI)** - Users browse/select curated stacks or build custom
2. **Stack Definition (Data)** - YAML files define slot mappings, agents, extras
3. **Skill Slot System (From Agent D)** - Agents declare required/optional slots, stacks fill them
4. **Skill Layer (From Agent A)** - Tiered skills: core, integration, variant
5. **Dependency System (From Agent B)** - Powers smart filtering via `requires`/`conflicts`
6. **User Profile (Customization)** - `stack` field + `slot_overrides` + additional skills/agents
7. **Compilation Pipeline** - Resolves stack -> slots -> skills -> agents

---

### 4. Unified Data Model

**Extended Registry Schema:**

```yaml
categories:
  framework: { type: exclusive, skills: [...] }
  styling: { type: exclusive, skills: [...] }
  state-management: { type: exclusive, skills: [...] }

skills:
  frontend/react:
    tier: core
    category: framework
    fills_slots: [framework]
    relationships:
      requires: []
      conflicts: [frontend/vue, frontend/svelte]

stacks:
  yolo-modern-react:
    meta: { name, author, upvotes, verified, maintained }
    slots: { framework: react, styling: tailwind, state: zustand }
    agents: [frontend-developer, tester]
    extras: [react-zustand-patterns]

agents:
  frontend-developer:
    skill_slots:
      required: { framework, styling }
      optional: { state, testing, accessibility }
```

**Profile Config:**

```yaml
stack: yolo-modern-react
slot_overrides:
  testing: frontend/vitest-custom
additional_skills: [backend/hono]
additional_agents: [backend-developer]
```

---

### 5. What is Salvageable from Current System

| Component | Status | Migration |
|-----------|--------|-----------|
| registry.yaml | EXTEND | Add categories, stacks, skill relationships, agent skill_slots |
| Skill content | KEEP | Add tier/relationships metadata |
| Agent content | KEEP | Add skill_slots to registry |
| Profile config | EXTEND | Add stack field, keep slot_overrides |
| Compilation pipeline | EXTEND | Add stack resolution step |
| _templates/ | RENAME | Becomes stacks/ |
| local/ | KEEP | User profiles remain gitignored |

---

### 6. Migration Path

**Phase 1:** Schema extensions (all optional, backwards compatible)
**Phase 2:** Stack definitions added to registry
**Phase 3:** Profiles can simplify with `stack:` field
**Phase 4:** Community stack submissions enabled

---

### 7. Summary: What Changed and What Stayed

| Aspect | Previous | New Proposal | Unified |
|--------|----------|--------------|---------|
| Primary selection | Skills | Stacks | **Stacks fill skill slots** |
| Quality control | Tiered badges | Upvotes only | **Upvotes + Verified** |
| Dependencies | Explicit rules | Implicit filtering | **Rules power filtering** |
| Timeline | Phased v1/v2 | Build upfront | **Compressed phases** |
| CLI onboarding | Role-based | Stack-based | **Stack-first, then roles** |
| Skill architecture | Bounded isolation | Not addressed | **Tiered skills** |

---

### 8. Recommendations

1. **Keep previous decisions:** Bounded isolation, skill slots, Homebrew dependencies
2. **Adopt new UX:** Stack-first selection, named stacks, smart filtering
3. **Add what both missed:** "Maintained" indicator, hybrid quality signals
4. **Implementation order:** Schema extensions -> Curated stacks -> Smart filtering CLI -> Community

---

### Files Analyzed

- OPEN-SOURCE-RESEARCH-TRACKER.md (Round 1)
- COMMUNITY-REGISTRY-PROPOSAL-RESEARCH.md (Round 2)
- registry.yaml (Current schema)

---

## Agent 4: Viral Adoption & Community Dynamics

**Focus**: Can this drive contributions? What makes stack/boilerplate ecosystems succeed or fail?

**Status**: **Complete**

**Completed**: 2026-01-08

---

### Executive Summary

**Is the viral adoption hypothesis realistic?** **Conditionally yes**, but it requires deliberate design for network effects. The proposal has strong fundamentals (low friction contribution, visible attribution, community value proposition), but faces the classic **chicken-and-egg problem** of two-sided marketplaces. Success depends on starting with a narrow niche, providing "single-user utility" before network effects kick in, and designing for contributor recognition and ego satisfaction.

The most critical insight: **The first 50 stacks matter more than the next 500.** Quality seeding with curated, high-value stacks will determine whether the marketplace achieves escape velocity or becomes a graveyard of abandoned configs.

---

### 1. What Drives Open Source Contributions?

Based on extensive research including longitudinal studies of Apache projects and large-scale developer surveys:

#### Primary Motivations (Ranked by Frequency)

| Motivation | Percentage | Type | Implication for Stack Marketplace |
|------------|------------|------|-----------------------------------|
| **Fun/Enjoyment** | 91% | Intrinsic | Creating and naming stacks should feel creative and fun |
| **Helping Others** | 85% | Altruistic | Frame contribution as "help others set up their projects faster" |
| **Community Relationships** | 80% | Social | Build community features: comments, discussions, follow creators |
| **Learning** | 75%+ | Intrinsic | Educational value of seeing how others structure their stacks |
| **Recognition/Reputation** | 48% | Ego | Download counts, featured stacks, creator profiles |
| **Career Advancement** | 40-50% (novices) | Extrinsic | Allow linking stacks to GitHub profile, portfolio |
| **Financial** | <30% | Extrinsic | Not a primary driver - don't over-optimize for monetary incentives |

**Key Insight from Research**: [Motivations evolve over time](https://opensource.com/article/21/4/motivates-open-source-contributors). New contributors join for career and learning reasons but stay for altruism and community. Design for the onramp (career/learning) but build for retention (community/recognition).

#### The "Ego-Boo" Factor

Eric Raymond's term ["ego-boo"](https://www.researchgate.net/publication/222836738_Motivation_of_Software_Developers_in_Open_Source_Projects_An_Internet-Based_Survey_of_Contributors_to_the_Linux_Kernel) describes the psychological reward of peer recognition. Research shows that 48% of contributors are highly motivated by recognition, and meritocratic systems (like Apache) where "status, responsibility, and benefits are commensurate with contribution" drive sustained engagement.

**Implication**: The Stack Marketplace should prominently display:
- Creator attribution on every stack
- Download/usage counts
- "Featured Stack" highlights
- Creator leaderboards (top contributors)
- Achievement badges ("100 downloads", "Top 10 React stack")

---

### 2. Network Effects & Critical Mass

#### The Two-Sided Marketplace Challenge

[The Stack Marketplace is a two-sided marketplace](https://www.nfx.com/post/19-marketplace-tactics-for-overcoming-the-chicken-or-egg-problem): it needs **creators** (people who make stacks) and **users** (people who consume stacks). Without stacks, users won't come. Without users, creators won't contribute.

According to [NFX research](https://www.nfx.com/post/network-effects-bible), "network effects have been responsible for 70% of all the value created in technology since 1994." But reaching critical mass is notoriously difficult.

#### Strategies for Achieving Critical Mass

Based on research from [NFX](https://www.nfx.com/post/19-marketplace-tactics-for-overcoming-the-chicken-or-egg-problem) and [Sharetribe](https://www.sharetribe.com/marketplace-glossary/chicken-and-egg-problem/):

| Strategy | Application to Stack Marketplace | Priority |
|----------|----------------------------------|----------|
| **Start with the harder side first** | Creators are harder to get than users. Seed with 20-50 high-quality official stacks first. | Critical |
| **Start narrow, then expand** | Focus on React ecosystem first (largest market share). Vue, Svelte, etc. come later. | Critical |
| **Single-user utility ("come for the tool, stay for the network")** | The CLI wizard provides value even with zero community stacks. Official templates work standalone. | Critical |
| **Target users who can be both** | Developers who use stacks are also likely to create them. Design for this dual role. | High |
| **Aggregate existing data** | Import popular boilerplate repos as "community stacks" to bootstrap supply | Medium |
| **Referral incentives** | "Share your stack" social features, but keep organic | Low |

**Most Important Insight**: [OpenTable, Honeybook, and StyleSeat](https://www.nfx.com/post/19-marketplace-tactics-for-overcoming-the-chicken-or-egg-problem) succeeded by first building SaaS tools that provided standalone value, then layering on marketplace features. The Stack Marketplace's CLI wizard is this tool - it must work excellently even if no one else ever contributes a stack.

---

### 3. Success Case Studies

#### Oh My Zsh: The Gold Standard (2,400+ contributors, 300+ plugins)

**Why It Succeeded**:
1. **One-line installation**: Zero friction to get started
2. **Immediate gratification**: Beautiful terminal after install
3. **Plugin architecture**: Easy to add, doesn't break core
4. **Custom directory (`$ZSH_CUSTOM`)**: User additions never conflict with core
5. **External plugins wiki**: Scales infinitely without quality gatekeeping
6. **Charismatic founder**: Robby Russell actively promoted and evangelized

**Lessons for Stack Marketplace**:
- Make "create a stack" as easy as possible (single YAML file)
- Separate official stacks from community stacks (quality tiers)
- Provide immediate value (working Claude config after selection)
- Community wiki/catalog for overflow content

#### Awesome Lists: Viral Curation (9,000+ repos, 200K+ stars)

[The awesome lists phenomenon](https://dev.to/zevireinitz/the-untold-history-of-github-awesome-lists-73d) started in 2014 with Sindre Sorhus's single repo and exploded virally:

**Growth Inflection Point**: Summer 2014 saw awesome-python, awesome-ruby, awesome-go launch within 8 days of each other. Social media amplification on HN/Reddit created a cascade.

**Why It Succeeded**:
1. **Low barrier**: Just a markdown file with links
2. **Clear value**: Curated > random Google search
3. **Social proof**: Stars = quality signal
4. **Naming convention**: `awesome-*` became a meme
5. **No gatekeeping**: Anyone can create an awesome list

**Lessons for Stack Marketplace**:
- Create a recognizable naming convention for stacks
- Make "starring" or upvoting prominent
- Curated lists are inherently viral - "10 Best React Stacks" blog posts drive traffic

#### VS Code Extensions: Quality at Scale (30,000-40,000+ extensions)

[VS Code's extension marketplace](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace) achieved massive scale with quality control:

**Why It Succeeded**:
1. **Verified Publisher badges**: Trust signal without gatekeeping
2. **Download counts + star ratings**: Community-driven quality signals
3. **Rich browsing**: Categories, trending, recommended
4. **One-click install**: Zero friction for users
5. **Malware scanning**: Trust through security

**Lessons for Stack Marketplace**:
- Implement "Verified Creator" badges for trusted contributors
- Show download counts and ratings prominently
- Create category taxonomy for browsing
- Make consuming a stack one-click

#### shadcn/ui: Modern Viral Pattern

shadcn/ui became one of the fastest-growing React component libraries through a unique model:

**Why It Succeeded**:
1. **Copy, don't install**: Users own the code, full customization
2. **Beautiful defaults**: Great design out of the box
3. **CLI tool**: `npx shadcn-ui add button` is frictionless
4. **Modern stack**: Built on Tailwind + Radix (trending technologies)
5. **Vercel ecosystem**: Backed by influential company and community

**Lessons for Stack Marketplace**:
- "Copy, don't install" model aligns with the Dev Kit approach (fork and own)
- CLI experience must be excellent
- Align with trendy technologies (Vite, Tailwind, React Query)

---

### 4. Failure Case Studies

#### Yeoman Generators: The Cautionary Tale

Yeoman once dominated project scaffolding but stagnated:

**Why It Failed**:
1. **Framework CLIs took over**: create-react-app, Vue CLI, Angular CLI made Yeoman redundant
2. **Maintenance burden**: Generators quickly became outdated
3. **Complexity**: Extra abstraction layer that most projects didn't need
4. **No network effects**: Each generator was siloed, no community flywheel

**Lessons for Stack Marketplace**:
- Must provide value BEYOND what framework CLIs offer (Claude agent configs, not just project scaffolding)
- Make updating stacks easy (version tracking, notifications)
- Build network effects (comments, forks, "based on" lineage)

#### Create React App: Disrupted by Vite

CRA went from dominant to deprecated because [it failed to evolve](https://dev.to/simplr_sh/why-you-should-stop-using-create-react-app-and-start-using-vite-react-in-2025-4d21):

**Why It Failed**:
1. **Slow startup**: 20-30 seconds vs Vite's <1 second
2. **Maintenance stagnated**: Issues addressed slowly (volunteer maintainers)
3. **No modern features**: SSR, code splitting required "ejecting"
4. **Disrupted by better tools**: Vite offered 10-100x faster builds

**Lessons for Stack Marketplace**:
- Performance matters even for config tools
- Active maintenance is essential
- Don't assume market leadership persists

#### Abandoned Boilerplate Repos: The Default State

Most GitHub boilerplate repositories follow a pattern: initial burst of activity, then abandonment.

**Why Most Fail**:
1. **No community**: Single maintainer burns out
2. **Dependencies rot**: npm packages become outdated
3. **No discovery**: Hard to find among millions of repos
4. **No incentive to maintain**: No recognition, no users

**Lessons for Stack Marketplace**:
- Community stacks need "adoption" mechanism (new maintainer)
- Surface "freshness" metrics (last updated, dependency age)
- Recognition system keeps maintainers engaged

---

### 5. Critical Success Factors

Based on all research, here are the **non-negotiable** requirements for viral adoption:

#### Factor 1: Near-Zero Contribution Friction

| Metric | Target | Rationale |
|--------|--------|-----------|
| Time to create first stack | <10 minutes | Faster = more contributors |
| Files required | 1 (single YAML) | Simpler = more contributors |
| Approval process | None for community tier | Gatekeeping kills momentum |
| Technical knowledge required | Minimal | Stack = choosing options, not coding |

**Implementation**: "Fork a stack" button, auto-generated YAML from CLI wizard, no PR review for community stacks.

#### Factor 2: High-Visibility Attribution

| Feature | Purpose |
|---------|---------|
| Creator name on every stack | Ego satisfaction |
| Creator profile page | Portfolio building |
| Download/usage counts | Social proof |
| "Created by" in generated Claude config | Attribution in the artifact |
| Top creators leaderboard | Competition/gamification |

**Implementation**: Every generated CLAUDE.md should include `# Stack: React Zustand Modern by @username` at the top.

#### Factor 3: Quality Differentiation

| Tier | Criteria | Badge |
|------|----------|-------|
| Official | Maintained by project team | Gold badge |
| Verified | 30+ days, 10+ downloads, no reports | Blue checkmark |
| Community | Basic validation only | None |

**Implementation**: Avoid Yeoman's undifferentiated quality problem. Official stacks must be excellent.

#### Factor 4: Single-User Utility

The marketplace must provide value even with zero community contributions:
- CLI wizard generates useful stacks from scratch
- Official stacks cover 80% of use cases
- No "empty state" that feels broken

#### Factor 5: Social Proof Loops

| Loop | Mechanism |
|------|-----------|
| Popular = more popular | Sort by downloads |
| Featured = discovered | Editorial picks |
| Social sharing | "Share your stack" generates nice social cards |
| Blog-worthy | Easily embeddable stack summaries |

---

### 6. Design for Virality: Specific Recommendations

#### 6.1 The Contribution Funnel

```
+-------------------------------------------------------------------------+
|  AWARENESS -> INTEREST -> FIRST USE -> FIRST CONTRIBUTION -> EVANGELIST |
+-------------------------------------------------------------------------+
|                                                                         |
|  Blog posts,     "This would    Use official   "I'll make    "Everyone |
|  HN, Twitter     be useful      stack          my own!"      should     |
|                  for my setup"                               use this"  |
|                                                                         |
|  Target: 1000    Target: 100    Target: 50     Target: 10   Target: 5  |
|                                                                         |
|  Conversion: 10%               50%             20%           50%        |
+-------------------------------------------------------------------------+
```

**Each stage needs design attention**:
- **Awareness**: Excellent README, demo video, HN launch
- **Interest**: Clear value proposition ("Claude knows YOUR stack")
- **First Use**: One-command setup, immediate gratification
- **First Contribution**: "Create Your Own" CTA in CLI, pre-filled template
- **Evangelist**: Social sharing features, badges, "built with" badges

#### 6.2 FOMO & Social Proof Tactics

| Tactic | Implementation |
|--------|---------------|
| **Trending stacks** | "React Query + Zustand is trending this week" |
| **Download velocity** | "50 developers added this stack today" |
| **Star counts** | GitHub-style stars visible on all stacks |
| **Creator spotlights** | Monthly "Stack Creator of the Month" |
| **Usage in the wild** | "Used by 200+ projects" badge |

#### 6.3 The "1-9-90" Rule

In any community:
- 1% create content (stack creators)
- 9% interact (star, comment, fork)
- 90% lurk (use stacks silently)

**Design for all three**:
- 1%: Make creation rewarding (attribution, badges)
- 9%: Make interaction easy (one-click star, copy)
- 90%: Make discovery excellent (search, categories, recommendations)

---

### 7. Risk Assessment

#### High Risk: Quality Decay

**Risk**: As community grows, low-quality stacks proliferate, making it hard to find good ones.

**Mitigation**:
- Tiered quality system (Official > Verified > Community)
- "Report" mechanism with quick removal for bad stacks
- Algorithmic quality signals (engagement, freshness, completeness)

#### Medium Risk: Abandonment

**Risk**: Stack creators disappear, leaving outdated configs.

**Mitigation**:
- "Adopt this stack" feature for abandoned stacks
- Freshness indicators (last updated, dependencies checked)
- Automated "needs update" flags

#### Medium Risk: Chicken-and-Egg Failure

**Risk**: Not enough stacks to attract users, not enough users to attract creators.

**Mitigation**:
- Seed with 30-50 high-quality official stacks covering common combinations
- Single-user utility from CLI wizard (works without community)
- Import/promote existing popular boilerplates

#### Low Risk: Fragmentation

**Risk**: Too many similar stacks with minor variations.

**Mitigation**:
- "Similar stacks" deduplication in browse UI
- "Based on" lineage tracking
- Merge/redirect feature for consolidation

---

### 8. Honest Assessment: Is This Realistic?

#### The Optimistic Case

**Yes, it can work** if:
1. The CLI wizard provides excellent standalone value (Day 1 utility)
2. Official stacks are genuinely useful and high-quality (seeding)
3. Attribution and recognition are prominent (ego satisfaction)
4. The contribution friction is near-zero (single YAML file)
5. The project gains initial momentum (HN/Twitter launch)

Comparable successes: Oh My Zsh, Awesome lists, VS Code extensions, Homebrew taps

#### The Realistic Case

**It will be harder than expected** because:
1. The Stack Marketplace is niche (Claude Code users + specific tech stack)
2. Network effects require critical mass that may take months/years
3. Quality control is genuinely hard with prompt content
4. Maintenance burden will fall on a small team
5. Disruption risk from Anthropic building official stack system

#### The Pessimistic Case

**It could fail** if:
1. The core product (Claude + skills) doesn't gain traction first
2. No one understands what a "stack" is without extensive education
3. Official stacks are so good that no one needs to contribute
4. Contribution friction is underestimated (config format complexity)
5. Quality variance makes the marketplace feel unreliable

---

### 9. Recommendations Summary

| Category | Recommendation | Priority |
|----------|---------------|----------|
| **Chicken-Egg** | Seed with 30-50 official stacks before launch | Critical |
| **Single-User Utility** | CLI wizard must work perfectly without community | Critical |
| **Contribution Friction** | Stack = single YAML file, <10 min to create | Critical |
| **Attribution** | Creator name, download counts, profiles | High |
| **Quality Tiers** | Official > Verified > Community | High |
| **Social Proof** | Stars, trending, "X developers use this" | High |
| **Discovery** | Search, categories, recommendations | High |
| **Freshness** | Last updated indicators, dependency checks | Medium |
| **Adoption** | "Adopt this stack" for abandoned stacks | Medium |
| **Community** | Comments, forks, "based on" lineage | Medium |

---

### 10. Key Takeaways

1. **The hypothesis is conditionally realistic** - but requires deliberate design for network effects
2. **Start narrow** - React ecosystem first, expand after traction
3. **Seed before launch** - 30-50 official stacks covering common use cases
4. **Attribution is essential** - ego satisfaction drives contributions
5. **Single-user utility first** - CLI must work without community
6. **Quality tiers prevent decay** - Official > Verified > Community
7. **The first 50 stacks matter more than the next 500** - quality seeding determines success

---

### Sources Consulted

- [What Motivates Open Source Contributors - Opensource.com](https://opensource.com/article/21/4/motivates-open-source-contributors)
- [The Shifting Sands of Motivation - IEEE/arXiv](https://arxiv.org/pdf/2101.10291)
- [Network Effects Bible - NFX](https://www.nfx.com/post/network-effects-bible)
- [19 Tactics for Chicken-and-Egg Problem - NFX](https://www.nfx.com/post/19-marketplace-tactics-for-overcoming-the-chicken-or-egg-problem)
- [Chicken-and-Egg Problem - Sharetribe](https://www.sharetribe.com/marketplace-glossary/chicken-and-egg-problem/)
- [Critical Mass and Network Effects - a16z](https://a16z.com/two-powerful-mental-models-network-effects-and-critical-mass/)
- [The Untold History of Awesome Lists - DEV Community](https://dev.to/zevireinitz/the-untold-history-of-github-awesome-lists-73d)
- [VS Code Extension Marketplace - Microsoft](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace)
- [Why Developers Switched from CRA to Vite - DEV Community](https://dev.to/simplr_sh/why-you-should-stop-using-create-react-app-and-start-using-vite-react-in-2025-4d21)
- [Homebrew Taps Documentation](https://docs.brew.sh/Taps)
- [npm Ecosystem Analysis - Springer](https://link.springer.com/article/10.1007/s10664-020-09904-w)
- [Motivation of Linux Kernel Developers - ResearchGate](https://www.researchgate.net/publication/222836738_Motivation_of_Software_Developers_in_Open_Source_Projects_An_Internet-Based_Survey_of_Contributors_to_the_Linux_Kernel)

---

## Agent 5: Stack Definition Schema & UX

**Focus**: How to define stacks in YAML/config? What would the selection UI look like?

**Status**: **Complete**

**Completed**: 2026-01-08

---

### Executive Summary

This design provides a comprehensive Stack Marketplace system that enables users to browse, select, customize, and contribute pre-configured skill combinations ("stacks"). The design prioritizes **CLI-first experience** with a **reference-by-ID compilation model**.

Key design decisions:
1. **Stacks reference skills by ID** (not embedded content) - DRY and automatic updates
2. **Slot-based composition** - Aligns with Agent D's Skill Slots model from Community Registry research
3. **CLI-first with optional web catalog** - Target audience prefers CLI
4. **Pull Request contribution model** for v1 - Familiar workflow
5. **Upvote-only voting** - No downvotes to reduce drama

---

### 1. Stack Schema Design

#### Complete Stack Schema (YAML)

```yaml
# yaml-language-server: $schema=../../schemas/stack.schema.json
# stacks/community/yolo-modern-react.yaml

# Identity & Metadata
id: yolo-modern-react                    # Unique slug, kebab-case
name: "YOLO Modern React Stack"          # Human-readable display name
description: >
  Modern React with Tailwind, Zustand, and React Query.
  Move fast without breaking things.
author: "@vincentbollaert"               # GitHub username
version: "1.0.0"                         # Semantic versioning
license: MIT
created: "2026-01-01"
updated: "2026-01-08"

# Composition (The Core of a Stack)
framework: react                         # Primary framework (required)

# Skill slots - each maps to a skill ID in the registry
slots:
  styling: frontend/tailwind
  state-management: frontend/zustand
  data-fetching: frontend/react-query
  testing: frontend/vitest
  mocking: frontend/msw
  accessibility: frontend/accessibility

# Agents to include
agents:
  - frontend-developer
  - frontend-reviewer
  - tester
  - pm

# Philosophy & Guidance
philosophy: "Ship fast, iterate faster"
principles:
  - Prefer composition over inheritance
  - Use hooks for everything, avoid classes
  - Tailwind utilities first, extract components when repeated 3x
  - Zustand for client state, React Query for server state

# Discoverability
tags: [react, typescript, tailwind, zustand, modern, startup]
categories: [frontend, web-development]
badges: [beginner-friendly, well-documented]

# Trust Signals (Managed by System)
metrics:
  upvotes: 2401
  downloads: 12450
verification:
  verified: true
  tier: official              # official | verified | community
```

#### Minimal Stack (Required Fields Only)

```yaml
id: minimal-react
name: "Minimal React Stack"
description: "React with just the essentials"
author: "@minimalist"
version: "1.0.0"
framework: react
slots:
  styling: frontend/css-modules
agents:
  - frontend-developer
```

---

### 2. Compilation Model

#### Reference-by-ID (Recommended)

Stacks reference skills by registry ID, not embedded content:

| Benefit | Explanation |
|---------|-------------|
| **DRY** | Skill content exists once, referenced many times |
| **Automatic updates** | Skill improvements apply to all stacks |
| **Smaller definitions** | Stacks are ~50 lines, not thousands |
| **Validation** | Verify references exist at compile time |

#### Compilation Pipeline

```
User selects stack -> Load stack YAML -> Resolve skill IDs -> Generate profile
-> Compile agents -> Output .claude/agents/*.md
```

---

### 3. Browse UX Design

#### CLI Browse Experience

```bash
$ claude-stacks list

+-----------------------------------------------------------------------------+
|  STACK MARKETPLACE                                     Showing 1-10 of 47   |
+-----------------------------------------------------------------------------+
|  1. YOLO Modern React Stack                                     * Official |
|     @vincentbollaert - React + Tailwind + Zustand + React Query            |
|     ^ 2.4k  # 12k downloads                                                |
|                                                                             |
|  2. Conservative Redux Stack                                    * Verified |
|     @enterprise - React + SCSS + Redux Toolkit + RTK Query                 |
|     ^ 1.8k  # 8k downloads                                                 |
|                                                                             |
|  Use: claude-stacks preview <id> for details                               |
+-----------------------------------------------------------------------------+

# Commands
$ claude-stacks list --framework react     # Filter by framework
$ claude-stacks list --tag tailwind        # Filter by tag
$ claude-stacks list --sort popular        # Sort: popular, recent, downloads
$ claude-stacks search "tailwind zustand"  # Full-text search
$ claude-stacks preview yolo-modern-react  # Detailed preview
```

---

### 4. Custom Builder UX

#### Step-by-Step Wizard (Integrates with Agent 2's Filtering)

```bash
$ claude-stacks build

+-----------------------------------------------------------------------------+
|  CUSTOM STACK BUILDER                                       Step 1 of 6     |
+-----------------------------------------------------------------------------+
|  Framework   Styling   State   Data    Testing   Review                     |
|                                                                             |
|  Choose your framework:                                                     |
|    > React           Most popular - 15k stacks                             |
|      Vue             Growing fast - 8k stacks                              |
|      Svelte          Lightweight - 3k stacks                               |
|      Angular         Enterprise - 2k stacks                                |
|                                                                             |
|  Use arrows to navigate, Enter to select                                   |
+-----------------------------------------------------------------------------+
```

After framework selection, styling options are filtered (per Agent 2's schema):

- React selected -> Shows: Tailwind, SCSS Modules, styled-components, CSS Modules
- Hides: Vuetify (Vue-only), Svelte scoped (Svelte-only)

---

### 5. Contribution Workflow

#### Method 1: CLI Export & Submit

```bash
# Export current profile as stack
$ claude-stacks export my-awesome-stack
Stack definition written to: stacks/my-awesome-stack.yaml

# Validate
$ claude-stacks validate stacks/my-awesome-stack.yaml
* Schema valid
* All skill references exist
* All agent references exist

# Submit (creates PR)
$ claude-stacks submit stacks/my-awesome-stack.yaml
* Forked repository
* Created branch: stack/my-awesome-stack
* Opened PR #142
```

#### Voting System (Upvote Only)

```bash
$ claude-stacks upvote yolo-modern-react
* Upvoted "YOLO Modern React Stack" (now 2,401 upvotes)
```

**Why no downvotes:** Reduces drama; low-quality stacks just don't get upvoted.

---

### 6. CLI vs Web Recommendation

**Recommendation: CLI-First**

| Phase | CLI Features | Web Features |
|-------|--------------|--------------|
| **v1.0** | list, preview, use, build, export, submit, upvote | None |
| **v1.5** | Same | Read-only static catalog |
| **v2.0** | Same | Full browsing, search |

**Why CLI-First:** Infrastructure exists, target audience prefers CLI, simpler to build/maintain.

---

### 7. Directory Structure

```
src/
+-- stacks/
|   +-- official/           # Maintainer-curated
|   +-- verified/           # Verified community
|   +-- community/          # All community stacks
+-- schemas/
    +-- stack.schema.json   # NEW
```

---

### 8. Integration with Other Agents

| Agent | Integration |
|-------|-------------|
| **Agent 1** | Stack marketplace fills gap Agent 1 identified: no existing tool combines community stacks + upvoting + smart filtering |
| **Agent 2** | Custom builder wizard uses Agent 2's FilterEngine for cascading compatibility |
| **Agent 3** | Aligns with Agent 3's unified model (Skill Slots from Agent D) |
| **Agent 4** | Design incorporates Agent 4's viral adoption insights: creator attribution, single-user utility, quality seeding |

---

### 9. Example Official Stacks

**YOLO Modern React:**
```yaml
id: yolo-modern-react
slots: {styling: frontend/tailwind, state-management: frontend/zustand, data-fetching: frontend/react-query}
agents: [frontend-developer, frontend-reviewer, tester, pm]
philosophy: "Ship fast, iterate faster"
```

**Conservative Redux:**
```yaml
id: conservative-redux
slots: {styling: frontend/scss-modules, state-management: frontend/redux-toolkit, data-fetching: frontend/rtk-query}
agents: [frontend-developer, frontend-reviewer, tester, pm]
philosophy: "Predictability over cleverness"
```

**Minimal React:**
```yaml
id: minimal-react
slots: {styling: frontend/css-modules, state-management: null}
agents: [frontend-developer, tester]
philosophy: "Less is more"
```

---

### 10. Summary & Recommendations

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| **Schema** | Full YAML with JSON Schema | IDE support, validation |
| **Skill relationship** | Reference by ID | DRY, auto-updates |
| **Browse UX** | CLI-first | Target audience preference |
| **Builder UX** | Wizard + Agent 2 filtering | Prevents incompatible combos |
| **Contribution** | PR-based with CLI helpers | Familiar workflow |
| **Voting** | Upvote-only | Reduces drama |
| **Tiers** | Official / Verified / Community | Quality balance |

#### Implementation Priority

**Phase 1:** Create stack.schema.json, 3-5 official stacks, `claude-stacks list/preview/use`
**Phase 2:** `build` wizard with Agent 2's filtering, `export/submit`, CI validation
**Phase 3:** Static web catalog, upvoting, search

---

### Files Analyzed

- `/home/vince/dev/claude-subagents/src/registry.yaml`
- `/home/vince/dev/claude-subagents/src/profiles/home/config.yaml`
- `/home/vince/dev/claude-subagents/src/schemas/registry.schema.json`
- `/home/vince/dev/claude-subagents/src/schemas/profile-config.schema.json`
- `/home/vince/dev/claude-subagents/.claude/research/findings/COMMUNITY-REGISTRY-PROPOSAL-RESEARCH.md`

---

## Synthesis

### Unified Recommendation

Based on findings from all 5 agents:

1. **Ship CLI-first Stack Marketplace for v1** - Agent 1 confirmed no existing tool fills this gap
2. **Integrate Agent 2's Smart Filtering into custom builder** - Prevents incompatible combinations with clear "why" explanations
3. **Unify with Skill Slots model** - Agent 3 confirmed stack slots map to Agent D's architecture
4. **Design for viral adoption per Agent 4** - Creator attribution, single-user utility, quality seeding
5. **Use reference-by-ID compilation** - Agent 5's schema design enables DRY stack definitions

### Implementation Approach

```
+---------------------------------------------------------------------+
|                    STACK MARKETPLACE ARCHITECTURE                    |
+---------------------------------------------------------------------+
|  +------------+    +------------+    +------------+                  |
|  |  REGISTRY  |    |   STACKS   |    |  PROFILES  |                  |
|  | - agents   |<---|  - slots   |--->| - agents   |                  |
|  | - skills   |    |  - agents  |    | - skills   |                  |
|  +------------+    +------------+    +------------+                  |
|         |                |                 |                         |
|         +----------------+-----------------+                         |
|                          v                                           |
|                   +------------+                                     |
|                   |  COMPILER  |                                     |
|                   +------------+                                     |
|                          v                                           |
|                   +------------+                                     |
|                   |  .claude/  |                                     |
|                   +------------+                                     |
+---------------------------------------------------------------------+
```

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Low initial adoption | Medium | Medium | Pre-seed with quality official stacks (Agent 4) |
| Cold start problem | High | High | Single-user utility - CLI works without community (Agent 4) |
| Quality variance | High | Low | Tiered system isolates community from official |
| Schema evolution | Medium | Medium | Version field allows breaking changes |
| Stale stacks | Medium | Medium | Last-updated display + deprecation policy |

---

_Last updated: 2026-01-08 (All 5 agents complete: Prior Art, Smart Filtering, Unification, Viral Adoption, Stack Schema & UX)_
