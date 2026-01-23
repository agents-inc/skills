# Skills Roadmap for Production-Ready Applications

> **Purpose:** Prioritized list of skills to create for the monorepo. Each skill should be 100% compliant with PROMPT_BIBLE.md and CLAUDE_ARCHITECTURE_BIBLE.md.

---

## Current Skills Inventory

### Frontend (`stacks/home/skills/frontend/`)

- [x] `react.md` - Component patterns, hooks, state
- [x] `styling.md` - SCSS Modules, design tokens
- [x] `api.md` - Data fetching, React Query
- [x] `client-state.md` - Zustand, local state
- [x] `accessibility.md` - a11y patterns
- [x] `performance.md` - Optimization, lazy loading
- [x] `testing.md` - React Testing Library, Vitest
- [x] `mocking.md` - MSW, test mocks

### Backend (`stacks/home/skills/backend/`)

- [x] `api.md` - Hono + OpenAPI
- [x] `database.md` - Drizzle ORM patterns
- [x] `testing.md` - Backend testing
- [x] `performance.md` - Backend optimization
- [x] `ci-cd.md` - GitHub Actions, deployment
- [x] `authentication.md` - Better Auth (NEW)

### Setup (`stacks/home/skills/setup/`)

- [x] `monorepo.md` - Turborepo patterns
- [x] `package.md` - Package configuration
- [x] `env.md` - Environment variables
- [x] `tooling.md` - ESLint, Prettier, TypeScript

### Security (`stacks/home/skills/security/`)

- [x] `security.md` - Secrets, XSS, CSRF, Dependabot

### Shared (`stacks/home/skills/shared/`)

- [x] `reviewing.md` - Code review patterns

---

## Phase 1: Production Essentials

> **Goal:** "Can I run this in production and know when things break?"

### 1.1 Observability (TWO SKILLS)

**Priority:** CRITICAL
**Effort:** Large
**Dependencies:** None
**Status:** ✅ DECIDED

**Tech Stack (DECIDED):**
| Component | Choice | Why |
|-----------|--------|-----|
| Logging Library | **Pino** | Fast, structured JSON, industry standard |
| Logs/Traces/Metrics Backend | **Axiom** | 1TB free, best Vercel/Next.js integration, $41M Series B |
| Errors | **Sentry** | Best DX, source maps, generous free tier |

**Decision rationale:**

- **Axiom over Datadog**: 10-20x cheaper ($0.09-0.12/GB vs $0.21-0.36/GB), official Vercel partner
- **Axiom over BetterStack**: Better pricing model (no tier cliffs), more mature tracing
- **Axiom over self-hosted Grafana**: No maintenance overhead, "set and forget"
- **Sentry kept separate**: Best-in-class error tracking DX, complementary to Axiom

**Estimated cost (10 apps):** ~$50-100/mo (Sentry $26-80 + Axiom $0-20)

---

#### 1.1a Setup Skill (`setup/observability.md`)

**Purpose:** One-time project setup (referenced once per new app)
**Effort:** Medium

**Covers:**

- Installing dependencies (Pino, `@sentry/nextjs`, `next-axiom`)
- Environment variables (API keys, DSNs, dataset names)
- Axiom dataset creation and Vercel integration
- Sentry project setup and DSN configuration
- Source maps upload in CI/CD (GitHub Actions)
- `next-axiom` configuration in `next.config.js`
- Initial Axiom dashboard import
- Sentry release tracking setup
- Health check endpoint setup

---

#### 1.1b Backend Skill (`backend/observability.md`)

**Purpose:** Ongoing usage patterns (referenced during feature development)
**Effort:** Medium

**Covers:**

- Log levels and when to use each (debug, info, warn, error)
- Structured logging patterns (what fields to include)
- Correlation IDs for request tracing
- Adding custom traces/spans with Axiom
- Error boundaries in React (Sentry)
- Attaching user context to errors
- Creating alerts and monitors
- Performance monitoring patterns
- Filtering noise (expected vs unexpected errors)
- Debugging with traces

---

### 1.2 Email (TWO SKILLS)

**Priority:** CRITICAL
**Effort:** Medium
**Dependencies:** authentication.md (uses email for verification/reset)
**Status:** ✅ DECIDED

**Tech Stack (DECIDED):**
| Component | Choice | Why |
|-----------|--------|-----|
| Email API | **Resend** | Modern DX, React Email native, $18M Series A (Feb 2025) |
| Templates | **React Email** | 17k+ GitHub stars, write emails as React components |
| Pricing Model | **Usage-based** | Single account, shared quota across all apps |
| Free Tier | **3,000 emails/mo** | Sufficient for development and early MVP |

**Decision rationale:**

- **Resend over SendGrid**: Modern API, React Email integration, no legacy cruft, better DX
- **Resend over Postmark**: React Email native support, dynamic IP scaling, modern stack alignment
- **Resend over AWS SES**: No infrastructure overhead, built-in analytics, 10x faster setup
- **React Email**: Write templates as React components with Tailwind, same mental model as app code

**Estimated cost (10 apps combined):**
| Volume | Monthly Cost |
|--------|--------------|
| <3k emails/mo | **$0** |
| 50k emails/mo | $20 (Pro) |
| 100k emails/mo | $90 (Scale) |
| 500k emails/mo | ~$450 |

**Key advantages for monorepo:**

- Single Resend account, pooled quota across all 10 apps
- Scale plan includes 1,000 custom domains (enough for all apps)
- No per-app fees, usage-based only
- No surprise billing (notifies before charging overages)

---

#### 1.2a Setup Skill (`setup/resend.md`)

**Purpose:** One-time project setup (referenced once per new app)
**Effort:** Small-Medium

**Covers:**

- Installing `resend` and `@react-email/components`
- Environment variables (API key)
- Domain verification and DNS setup (SPF, DKIM, DMARC)
- React Email project structure (`emails/` directory)
- Next.js integration patterns
- Local development with React Email preview
- CI/CD considerations (no secrets in templates)
- Initial email template scaffolding

---

#### 1.2b Backend Skill (`backend/email.md`)

**Purpose:** Ongoing email patterns (referenced during feature development)
**Effort:** Medium

**Covers:**

- React Email template patterns (components, layouts, styling)
- Sending transactional emails (API patterns)
- Email types (verification, password reset, welcome, notifications)
- Integration with Better Auth (verification/reset flows)
- Async email sending (don't block requests)
- Error handling and retry patterns
- Testing email templates locally
- Tracking opens/clicks (when appropriate)
- Unsubscribe handling and preferences
- Batch sending for notifications

---

### 1.3 Error Tracking (`backend/error-tracking.md`)

**Priority:** CRITICAL
**Effort:** Small
**Dependencies:** Could be part of observability.md
**Status:** ✅ MERGED into observability.md

**Note:** Error tracking will be covered in `observability.md` using Sentry. No separate skill needed.

**Covers (in observability.md):**

- Sentry SDK setup (client + server)
- Error boundaries in React
- Source maps upload
- Release tracking
- User context attachment
- Filtering noise (expected errors)
- Alert rules

**Tech Stack:** Sentry (de facto standard, has free tier)

---

## Phase 2: Understanding Users

> **Goal:** "Can I measure and improve the user experience?"

### 2.1 Analytics + Feature Flags (THREE SKILLS)

**Priority:** HIGH
**Effort:** Medium
**Dependencies:** authentication.md (user identification)
**Status:** ✅ DECIDED

**Tech Stack (DECIDED):**
| Component | Choice | Why |
|-----------|--------|-----|
| Analytics + Feature Flags | **PostHog** | All-in-one, 29k+ GitHub stars, 65% of YC batches |
| Pricing Model | **Usage-based** | Pooled across all apps, not per-project |
| Free Tier | **1M events + 1M flag requests** | Sufficient for MVP phase |

**Decision rationale:**

- **PostHog over Mixpanel**: Open-source, usage-based (not per-project), includes feature flags
- **PostHog over Amplitude**: Simpler pricing, developer-first DX, no steep learning curve
- **PostHog over LaunchDarkly**: LaunchDarkly is $10/seat + per-MAU, PostHog is usage-based only
- **PostHog over Statsig**: Statsig acquired by OpenAI (Sept 2025), uncertain future for external customers
- **Single tool for both**: Analytics + feature flags in one platform = unified data, simpler stack

**Estimated cost (10 apps combined):**
| Traffic Level | Monthly Cost |
|---------------|--------------|
| <1M events/mo | **$0** |
| 2-5M events/mo | ~$50-200 |
| 10M events/mo | ~$450-1,500 |

**Key advantages for monorepo:**

- Single organization, pooled billing across all apps
- 6 projects included (enough for prod + staging if needed)
- No per-seat fees (add teammates freely)
- Volume discounts as usage grows

---

#### 2.1a Setup Skill (`setup/posthog.md`)

**Purpose:** One-time project setup (referenced once per new app)
**Effort:** Small-Medium

**Covers:**

- Installing `posthog-js` and `posthog-node`
- Environment variables (API key, host)
- PostHog project creation (single org for monorepo)
- Next.js App Router integration (`PostHogProvider`)
- Server-side client setup for API routes
- Local development configuration (separate project or same)
- Vercel integration (automatic)
- Initial dashboard setup

---

#### 2.1b Analytics Skill (`backend/analytics.md`)

**Purpose:** Ongoing analytics patterns (referenced during feature development)
**Effort:** Medium

**Covers:**

- Event tracking patterns (what to track, naming conventions)
- User identification (after auth with Better Auth)
- Page view tracking (automatic vs manual)
- Custom events with properties
- Group analytics (for B2B apps)
- Funnel analysis setup
- Cohort creation
- Privacy considerations (GDPR, opt-out)
- Server-side vs client-side tracking decisions

---

#### 2.1c Feature Flags Skill (`backend/feature-flags.md`)

**Purpose:** Ongoing feature flag patterns (referenced during feature development)
**Effort:** Medium

**Covers:**

- Flag evaluation patterns (client + server)
- Boolean vs multivariate flags
- Gradual rollouts (percentage-based)
- User targeting (by property, cohort)
- A/B testing with experiments
- Default values and fallbacks
- Local development overrides
- Flag cleanup practices (removing old flags)
- React hooks (`useFeatureFlagEnabled`, `useFeatureFlagPayload`)

---

## Phase 3: Scaling Infrastructure

> **Goal:** "Can I handle growth and async workloads?"

### 3.1 Background Jobs (`backend/background-jobs.md`)

**Priority:** HIGH
**Effort:** Large
**Dependencies:** email.md (emails should be async), observability.md (job monitoring)

**Covers:**

- Job queue setup
- Retry strategies
- Dead letter queues
- Scheduled jobs (cron)
- Job monitoring/UI
- Webhook processing
- Long-running tasks
- Idempotency patterns

**Tech Stack Options:**
| Provider | Pros | Cons |
|----------|------|------|
| Inngest | Serverless, great DX, built-in UI | Newer, vendor |
| BullMQ | Mature, Redis-based, self-hosted | Requires Redis |
| Quirrel | Vercel-friendly | Less features |
| AWS SQS + Lambda | Cheapest at scale | More setup |

**Decision needed:** Inngest (recommended for DX) vs BullMQ (self-hosted)?

---

### 3.2 File Storage (`backend/file-storage.md`)

**Priority:** HIGH
**Effort:** Medium
**Dependencies:** authentication.md (user uploads)

**Covers:**

- S3/R2 bucket setup
- Presigned URLs (upload/download)
- Image optimization pipeline
- File type validation
- Size limits
- CDN integration
- Cleanup strategies (orphaned files)

**Tech Stack Options:**
| Provider | Pros | Cons |
|----------|------|------|
| Cloudflare R2 | No egress fees, fast | Newer |
| AWS S3 | Most mature, features | Egress costs |
| Vercel Blob | Simple, integrated | Limited features |
| UploadThing | Great DX, handles everything | Vendor lock-in |

**Decision needed:** Cloudflare R2 (recommended) vs AWS S3?

---

### 3.3 Caching (`backend/caching.md`)

**Priority:** MEDIUM
**Effort:** Medium
**Dependencies:** database.md

**Covers:**

- Redis patterns (cache-aside, write-through)
- HTTP caching headers
- CDN caching strategies
- Cache invalidation patterns
- Session caching
- Query result caching
- Stale-while-revalidate

**Tech Stack Options:**
| Provider | Pros | Cons |
|----------|------|------|
| Upstash Redis | Serverless, simple | Cost at scale |
| Redis (self-hosted) | Full control, cheap | Management overhead |
| Vercel KV | Integrated | Limited |

**Decision needed:** Upstash (recommended for serverless) vs self-hosted Redis?

---

### 3.4 Rate Limiting (`backend/rate-limiting.md`)

**Priority:** MEDIUM
**Effort:** Small
**Dependencies:** caching.md (often uses Redis)

**Covers:**

- API rate limiting middleware
- Per-user vs per-IP limits
- Sliding window algorithm
- Rate limit headers
- Graceful degradation
- DDoS considerations
- Cost-based limits (AI endpoints)

**Tech Stack Options:**
| Provider | Pros | Cons |
|----------|------|------|
| Upstash Ratelimit | Serverless, simple SDK | Cost |
| Redis + custom | Full control | Implementation effort |
| Cloudflare | Edge-level protection | Separate from app logic |

---

## Phase 4: Enhanced Features

> **Goal:** "Can I build more complex applications?"

### 4.1 Real-time (`backend/realtime.md`)

**Priority:** MEDIUM
**Effort:** Large
**Dependencies:** authentication.md (user presence)

**When needed:** Chat, live updates, collaboration, notifications

**Covers:**

- WebSocket setup with Hono
- Server-Sent Events (SSE)
- Presence (who's online)
- Pub/sub patterns
- Reconnection handling
- Scaling WebSockets

**Tech Stack Options:**
| Provider | Pros | Cons |
|----------|------|------|
| Pusher | Simple, reliable | Cost at scale |
| Ably | More features | Complex pricing |
| Soketi | Open-source Pusher | Self-hosted |
| PartyKit | Cloudflare-based | Newer |
| Socket.io | Mature, self-hosted | Scaling complexity |

---

### 4.2 Search (`backend/search.md`)

**Priority:** LOW
**Effort:** Medium
**Dependencies:** database.md

**When needed:** Content-heavy apps, marketplaces, documentation

**Covers:**

- Full-text search setup
- Indexing strategies
- Faceted search
- Autocomplete
- Typo tolerance
- Relevance tuning

**Tech Stack Options:**
| Provider | Pros | Cons |
|----------|------|------|
| Meilisearch | Fast, self-hostable, great DX | Younger |
| Algolia | Most mature, instant | Expensive |
| Typesense | Open-source, fast | Less features |
| PostgreSQL FTS | No extra infra | Limited features |

---

### 4.3 Internationalization (`frontend/i18n.md`)

**Priority:** LOW
**Effort:** Medium
**Dependencies:** None

**When needed:** Multi-language apps, global audience

**Covers:**

- next-intl setup
- Translation file organization
- Pluralization
- Date/number formatting
- RTL support
- Language detection
- Translation management

**Tech Stack:** next-intl (de facto for Next.js App Router)

---

### 4.4 Payments (`backend/payments.md`)

**Priority:** LOW
**Effort:** Large
**Dependencies:** authentication.md, email.md, background-jobs.md

**When needed:** SaaS, e-commerce, subscriptions

**Covers:**

- Stripe integration
- Checkout flows
- Subscription management
- Webhook handling
- Invoice/receipt emails
- Tax handling (Stripe Tax)
- Customer portal

**Tech Stack:** Stripe (de facto standard)

---

## Phase 5: Infrastructure

> **Goal:** "Can I deploy and manage infrastructure?"

### 5.1 Deployment (`devops/deployment.md`)

**Priority:** LOW (ci-cd.md covers basics)
**Effort:** Medium
**Dependencies:** ci-cd.md

**Covers:**

- Docker patterns
- Railway/Render deployment
- Self-hosted options
- Database migrations in CI
- Blue-green deployments
- Rollback strategies

---

## Summary: Recommended Creation Order

| Order | Skill                        | Priority | Effort | Tech Decisions                      |
| ----- | ---------------------------- | -------- | ------ | ----------------------------------- |
| 1a    | `setup/observability.md`     | CRITICAL | Medium | ✅ Pino + Axiom + Sentry (setup)    |
| 1b    | `backend/observability.md`   | CRITICAL | Medium | ✅ Pino + Axiom + Sentry (patterns) |
| 2a    | `setup/resend.md`            | CRITICAL | Small  | ✅ Resend + React Email (setup)     |
| 2b    | `backend/email.md`           | CRITICAL | Medium | ✅ Resend + React Email (patterns)  |
| 3a    | `setup/posthog.md`           | HIGH     | Small  | ✅ PostHog (setup)                  |
| 3b    | `backend/analytics.md`       | HIGH     | Medium | ✅ PostHog (analytics patterns)     |
| 3c    | `backend/feature-flags.md`   | HIGH     | Medium | ✅ PostHog (feature flag patterns)  |
| 4     | `backend/background-jobs.md` | HIGH     | Large  | Inngest vs BullMQ                   |
| 5     | `backend/file-storage.md`    | HIGH     | Medium | R2 vs S3                            |
| 6     | `backend/caching.md`         | MEDIUM   | Medium | Upstash vs self-hosted              |
| 7     | `backend/rate-limiting.md`   | MEDIUM   | Small  | Upstash vs custom                   |
| 8     | `backend/realtime.md`        | MEDIUM   | Large  | Pusher vs PartyKit                  |
| 9     | `backend/search.md`          | LOW      | Medium | Meilisearch vs Algolia              |
| 10    | `frontend/i18n.md`           | LOW      | Medium | next-intl                           |
| 11    | `backend/payments.md`        | LOW      | Large  | Stripe                              |

---

## Tech Stack Recommendations (Default Choices)

For maximum DX and minimal vendor lock-in:

| Category            | Recommendation    | Why                                         |
| ------------------- | ----------------- | ------------------------------------------- |
| **Logging**         | Pino              | Fast, structured, standard                  |
| **Logs Backend**    | Axiom ✅          | 1TB free, Vercel partner, best value        |
| **Tracing**         | Axiom ✅          | Native OTel support, unified with logs      |
| **Metrics**         | Axiom ✅          | Same platform, no extra cost                |
| **Errors**          | Sentry ✅         | Best DX, generous free tier                 |
| **Email**           | Resend ✅         | Modern DX, React Email, $18M Series A       |
| **Analytics**       | PostHog ✅        | Open-source, 29k+ stars, YC favorite        |
| **Feature Flags**   | PostHog ✅        | Bundled with analytics, usage-based pricing |
| **Background Jobs** | Inngest           | Serverless-friendly, great DX               |
| **File Storage**    | Cloudflare R2     | No egress, S3-compatible                    |
| **Caching**         | Upstash Redis     | Serverless, simple                          |
| **Rate Limiting**   | Upstash Ratelimit | Same provider, simple                       |
| **Real-time**       | PartyKit          | Cloudflare edge, modern                     |
| **Search**          | Meilisearch       | Self-hostable, great DX                     |
| **Payments**        | Stripe            | De facto standard                           |

---

## Notes

- Skills marked as "CRITICAL" should block production deployment
- Skills marked "HIGH" should be added within first month of production
- Skills marked "MEDIUM/LOW" can be added as needed
- ✅ Error tracking merged into observability (Sentry + Axiom stack)
- ✅ Observability decided: Pino + Axiom + Sentry (~$50-100/mo for 10 apps)
- ✅ Observability split into TWO skills: `setup/observability.md` (one-time) + `backend/observability.md` (ongoing patterns)
- ✅ Analytics + Feature Flags decided: PostHog (~$0-200/mo for 10 apps at MVP stage)
- ✅ Analytics + Feature Flags split into THREE skills: `setup/posthog.md` (one-time) + `backend/analytics.md` (analytics patterns) + `backend/feature-flags.md` (flag patterns)
- ✅ Email decided: Resend + React Email (~$0-90/mo for 10 apps at MVP stage)
- ✅ Email split into TWO skills: `setup/resend.md` (one-time) + `backend/email.md` (ongoing patterns)
- Consider Upstash for caching + rate-limiting (same provider)
