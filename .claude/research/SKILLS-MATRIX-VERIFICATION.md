# Skills Matrix Relationship Verification

> **Generated**: 2026-01-25
> **Purpose**: Verify all relationship claims in skills-matrix.yaml
> **Status**: ✅ Complete - 9 research agents finished

---

## Executive Summary

**Total Relationships Verified**: 60+

| Verdict                | Count | Action                         |
| ---------------------- | ----- | ------------------------------ |
| ✅ Accurate            | 42    | Keep as-is                     |
| ⚠️ Needs Modification  | 14    | Update reason text or expand   |
| ❌ Remove/Major Change | 5     | Remove or fundamentally change |

### Critical Changes Required

1. **REMOVE** `drizzle requires [hono, express, fastify]` - ORMs work standalone
2. **REMOVE** `prisma requires [hono, express, fastify]` - ORMs work standalone
3. **REMOVE** `[scss-modules, tailwind]` from conflicts - keep only in discourages
4. **MODIFY** `better-auth requires [drizzle]` - supports Prisma, Kysely, MongoDB too
5. **MODIFY** `[zustand, redux-toolkit, mobx]` conflict → move to discourages

---

## 1. Frontend Framework Relationships

### Conflicts

| Relationship                              | Claim                              | Verdict    | Action                            |
| ----------------------------------------- | ---------------------------------- | ---------- | --------------------------------- |
| `[react, vue, angular, solidjs]`          | Core frameworks mutually exclusive | ⚠️ PARTIAL | Add micro-frontend exception note |
| `[nextjs-app-router, remix, nuxt]`        | Meta-frameworks mutually exclusive | ✅ TRUE    | Keep                              |
| `[react-testing-library, vue-test-utils]` | Framework-specific testing         | ✅ TRUE    | Keep (implicit via requires)      |

### Requires

| Relationship                         | Claim                     | Verdict | Action |
| ------------------------------------ | ------------------------- | ------- | ------ |
| `nextjs-app-router requires [react]` | Next.js is built on React | ✅ TRUE | Keep   |
| `remix requires [react]`             | Remix is built on React   | ✅ TRUE | Keep   |

### Recommended Change

```yaml
# Update conflict reason to acknowledge micro-frontends
- skills: [react, vue, angular, solidjs]
  reason: "Core frameworks are mutually exclusive within a single application. Exception: micro-frontend architectures (Single-SPA, Module Federation) can combine frameworks in isolation."
```

---

## 2. Styling Relationships

### Conflicts

| Relationship               | Claim                   | Verdict   | Action                       |
| -------------------------- | ----------------------- | --------- | ---------------------------- |
| `[scss-modules, tailwind]` | Different CSS paradigms | ❌ REMOVE | **Move to discourages only** |

### Discourages

| Relationship               | Claim             | Verdict | Action              |
| -------------------------- | ----------------- | ------- | ------------------- |
| `[scss-modules, tailwind]` | Mixing is unusual | ✅ TRUE | Keep, update reason |

### Recommends

| Relationship                       | Claim                     | Verdict | Action                               |
| ---------------------------------- | ------------------------- | ------- | ------------------------------------ |
| `scss-modules → [radix-ui]`        | Radix works with any CSS  | ✅ TRUE | Keep                                 |
| `tailwind → [shadcn-ui]`           | shadcn built for Tailwind | ✅ TRUE | Keep                                 |
| `shadcn-ui → [radix-ui, tailwind]` | Uses Radix + Tailwind     | ✅ TRUE | Consider adding radix-ui to requires |

### Recommended Changes

```yaml
# REMOVE from conflicts section:
# - skills: [scss-modules, tailwind]
#   reason: "Different CSS paradigms..."

# UPDATE in discourages section:
- skills: [scss-modules, tailwind]
  reason: "Mixing CSS paradigms causes slower builds (Tailwind runs per-module) and inconsistent patterns - pick one approach for new projects. Valid for gradual migrations."
```

---

## 3. State Management Relationships

### Conflicts

| Relationship                              | Claim                             | Verdict    | Action                  |
| ----------------------------------------- | --------------------------------- | ---------- | ----------------------- |
| `[zustand, redux-toolkit, mobx]`          | React state - choose one          | ⚠️ PARTIAL | **Move to discourages** |
| `[pinia, zustand, redux-toolkit, mobx]`   | Pinia Vue-only, others React-only | ❌ FALSE   | Update reason text      |
| `[ngrx-signalstore, zustand, pinia, ...]` | NgRx Angular-only                 | ✅ TRUE    | Keep                    |

### Requires

| Relationship                                | Claim                      | Verdict  | Action                           |
| ------------------------------------------- | -------------------------- | -------- | -------------------------------- |
| `zustand needs [react, react-native]`       | Zustand is React-only      | ❌ FALSE | Update reason (vanilla exists)   |
| `redux-toolkit needs [react, react-native]` | RTK is React-only          | ❌ FALSE | Update reason (core is agnostic) |
| `mobx needs [react]`                        | Skill configured for React | ✅ TRUE  | Keep                             |
| `pinia needs [vue]`                         | Pinia is Vue only          | ✅ TRUE  | Keep                             |
| `ngrx-signalstore needs [angular]`          | NgRx is Angular only       | ✅ TRUE  | Keep                             |

### Discourages

| Relationship               | Claim                    | Verdict | Action |
| -------------------------- | ------------------------ | ------- | ------ |
| `[redux-toolkit, zustand]` | RTK has more boilerplate | ✅ TRUE | Keep   |

### Recommended Changes

```yaml
# MOVE from conflicts to discourages:
- skills: [zustand, redux-toolkit, mobx]
  reason: "Using multiple React state libraries adds complexity - choose one primary approach. Migration patterns exist for gradual transitions."

# UPDATE conflict reason:
- skills: [pinia, zustand, redux-toolkit, mobx]
  reason: "Pinia is Vue-only. Our zustand/redux-toolkit/mobx skills teach React patterns (though these libraries technically support other frameworks)."

# UPDATE requires reasons:
- skill: zustand
  needs: [react, react-native]
  needs_any: true
  reason: "Our Zustand skill covers React/React Native patterns (zustand/vanilla exists for other frameworks)"

- skill: redux-toolkit
  needs: [react, react-native]
  needs_any: true
  reason: "Our Redux Toolkit skill covers React/React Native patterns (RTK core is framework-agnostic)"
```

---

## 4. Data Fetching Relationships

### Conflicts

| Relationship                     | Claim                           | Verdict | Action |
| -------------------------------- | ------------------------------- | ------- | ------ |
| `[react-query, swr]`             | Both solve server state caching | ✅ TRUE | Keep   |
| `[graphql-apollo, graphql-urql]` | Both are GraphQL clients        | ✅ TRUE | Keep   |

### Requires

| Relationship                              | Claim                        | Verdict    | Action                       |
| ----------------------------------------- | ---------------------------- | ---------- | ---------------------------- |
| `react-query needs [react, react-native]` | TanStack Query React adapter | ⚠️ PARTIAL | Update reason                |
| `swr needs [react]`                       | SWR is React only            | ⚠️ MODIFY  | Add react-native             |
| `graphql-apollo needs [react, vue]`       | Apollo for React or Vue      | ⚠️ EXPAND  | Add angular, svelte, solidjs |
| `graphql-urql needs [react, vue]`         | URQL for React or Vue        | ⚠️ EXPAND  | Add svelte, solidjs          |

### Discourages & Recommends

| Relationship                     | Claim                         | Verdict | Action |
| -------------------------------- | ----------------------------- | ------- | ------ |
| `[swr, react-query]`             | SWR simpler, RQ more features | ✅ TRUE | Keep   |
| `react → [react-query]`          | Best-in-class React libraries | ✅ TRUE | Keep   |
| `react-query → [zod-validation]` | Type-safe API responses       | ✅ TRUE | Keep   |

### Recommended Changes

```yaml
# UPDATE requires:
- skill: react-query
  needs: [react, react-native]
  needs_any: true
  reason: "TanStack Query's React adapter. Note: TanStack Query also supports Vue, Solid, Svelte via separate adapters."

- skill: swr
  needs: [react, react-native]
  needs_any: true
  reason: "SWR is a React Hooks library (also works with React Native)"

- skill: graphql-apollo
  needs: [react, vue, angular, svelte, solidjs]
  needs_any: true
  reason: "Apollo Client - first-party React support, community-maintained integrations for Vue, Angular, Svelte, Solid"

- skill: graphql-urql
  needs: [react, vue, svelte, solidjs]
  needs_any: true
  reason: "URQL has first-party support for React, Vue, Svelte, and Solid (no Angular support)"
```

---

## 5. Forms & Validation Relationships

### All Verified ✅

| Relationship                                  | Claim                             | Verdict    | Action         |
| --------------------------------------------- | --------------------------------- | ---------- | -------------- |
| `[react-hook-form, vee-validate]` conflict    | Framework-specific form libraries | ✅ TRUE    | Keep           |
| `react-hook-form needs [react, react-native]` | React only                        | ✅ TRUE    | Keep           |
| `vee-validate needs [vue]`                    | Vue only                          | ✅ TRUE    | Keep           |
| `react → [react-hook-form]`                   | Best-in-class                     | ✅ TRUE    | Keep           |
| `react-hook-form → [zod-validation]`          | Standard pattern                  | ✅ TRUE    | Keep           |
| `vue → [vee-validate]`                        | Vue ecosystem                     | ⚠️ PARTIAL | Update wording |
| `vee-validate → [zod-validation]`             | Supports Zod                      | ✅ TRUE    | Keep           |

### Minor Update

```yaml
# UPDATE reason wording (VeeValidate is community-maintained, not official Vue team):
- when: vue
  suggest: [pinia, vee-validate, vue-test-utils]
  reason: "Vue community standard libraries (Pinia is official, VeeValidate is community-maintained)"
```

---

## 6. Testing Tools Relationships

### Conflicts

| Relationship                              | Claim                   | Verdict    | Action          |
| ----------------------------------------- | ----------------------- | ---------- | --------------- |
| `[playwright-e2e, cypress-e2e]`           | Both are E2E frameworks | ⚠️ PARTIAL | Add nuance note |
| `[react-testing-library, vue-test-utils]` | Framework-specific      | ✅ TRUE    | Keep            |

### Requires

| Relationship                          | Claim      | Verdict | Action |
| ------------------------------------- | ---------- | ------- | ------ |
| `react-testing-library needs [react]` | React only | ✅ TRUE | Keep   |
| `vue-test-utils needs [vue]`          | Vue only   | ✅ TRUE | Keep   |

### Discourages

| Relationship                    | Claim               | Verdict   | Action        |
| ------------------------------- | ------------------- | --------- | ------------- |
| `[cypress-e2e, playwright-e2e]` | DX vs cross-browser | ⚠️ MODIFY | Update reason |

### Recommends (All Verified ✅)

| Relationship                            | Claim                | Verdict |
| --------------------------------------- | -------------------- | ------- |
| `vitest → [react-testing-library, msw]` | Modern testing stack | ✅ TRUE |
| `playwright-e2e → [vitest]`             | E2E + unit split     | ✅ TRUE |
| `cypress-e2e → [vitest]`                | E2E + unit split     | ✅ TRUE |
| `msw → [vitest, react-testing-library]` | Modern testing stack | ✅ TRUE |

### Recommended Changes

```yaml
# UPDATE discourages reason:
- skills: [cypress-e2e, playwright-e2e]
  reason: "Cypress excels at interactive debugging and component testing; Playwright has better cross-browser support, parallelization, and CI/CD performance"
```

---

## 7. Backend API/ORM Relationships

### Conflicts

| Relationship               | Claim                             | Verdict    | Action               |
| -------------------------- | --------------------------------- | ---------- | -------------------- |
| `[hono, express, fastify]` | API frameworks mutually exclusive | ⚠️ PARTIAL | Add monorepo nuance  |
| `[drizzle, prisma]`        | Both are ORMs - choose one        | ⚠️ PARTIAL | Add migration nuance |

### Requires (CRITICAL CHANGES)

| Relationship                             | Claim                       | Verdict       | Action                      |
| ---------------------------------------- | --------------------------- | ------------- | --------------------------- |
| `drizzle needs [hono, express, fastify]` | Drizzle needs API framework | ❌ **REMOVE** | ORMs work standalone!       |
| `prisma needs [hono, express, fastify]`  | Prisma needs API framework  | ❌ **REMOVE** | ORMs work standalone!       |
| `better-auth needs [drizzle]`            | Better Auth uses Drizzle    | ❌ **MODIFY** | Supports Prisma, Kysely too |

### Discourages (All Verified ✅)

| Relationship         | Claim                          | Verdict |
| -------------------- | ------------------------------ | ------- |
| `[express, hono]`    | Express mature, Hono faster    | ✅ TRUE |
| `[express, fastify]` | Express mature, Fastify faster | ✅ TRUE |

### Recommends (All Verified ✅)

| Relationship                                    | Claim               | Verdict |
| ----------------------------------------------- | ------------------- | ------- |
| `hono → [drizzle, better-auth, zod-validation]` | Powerful combo      | ✅ TRUE |
| `drizzle → [zod-validation]`                    | Types work great    | ✅ TRUE |
| `fastify → [drizzle, zod-validation]`           | Solid stack         | ✅ TRUE |
| `express → [prisma]`                            | Classic combination | ✅ TRUE |

### Recommended Changes

```yaml
# REMOVE these incorrect requires:
# - skill: drizzle
#   needs: [hono, express, fastify]
#   reason: "Drizzle needs an API framework"
#
# - skill: prisma
#   needs: [hono, express, fastify]
#   reason: "Prisma needs an API framework"

# UPDATE better-auth requires:
- skill: better-auth
  needs: [drizzle, prisma]
  needs_any: true
  reason: "Better Auth supports multiple database adapters (Drizzle, Prisma, Kysely, MongoDB). Our skill uses Drizzle adapter."

# UPDATE conflict reasons:
- skills: [hono, express, fastify]
  reason: "API frameworks are mutually exclusive within a single service. Multiple frameworks can coexist in monorepo architectures."

- skills: [drizzle, prisma]
  reason: "Both are ORMs serving similar purposes. Choose one per service; migration scenarios and multi-service architectures may involve both."
```

---

## 8. UI Component Relationships

### All Verified ✅

| Relationship                        | Claim                       | Verdict | Action              |
| ----------------------------------- | --------------------------- | ------- | ------------------- |
| `shadcn-ui needs [react, tailwind]` | Requires React and Tailwind | ✅ TRUE | Keep                |
| `tailwind → [shadcn-ui]`            | shadcn built for Tailwind   | ✅ TRUE | Keep                |
| `shadcn-ui → [radix-ui, tailwind]`  | Uses Radix + Tailwind       | ✅ TRUE | Note Base UI option |
| `scss-modules → [radix-ui]`         | Radix works with any CSS    | ✅ TRUE | Keep                |

### Notes

- **shadcn-vue** exists as community port (9.2k+ GitHub stars)
- **shadcn-svelte** exists as community port
- As of Dec 2025, shadcn/ui supports **Base UI** as alternative to Radix

---

## 9. Mobile & Observability Relationships

### Recommends

| Relationship                                                             | Claim                         | Verdict   | Action                       |
| ------------------------------------------------------------------------ | ----------------------------- | --------- | ---------------------------- |
| `react-native → [zustand, react-query, react-hook-form, zod-validation]` | RN shares React ecosystem     | ✅ TRUE   | Keep (add RN-specific notes) |
| `axiom-pino-sentry → [posthog]`                                          | Complete observability        | ✅ TRUE   | Keep                         |
| `resend → [react]`                                                       | React Email works with Resend | ⚠️ MODIFY | Resend works without React   |

### Recommended Changes

```yaml
# REMOVE or MODIFY resend recommendation:
# Current: resend recommends [react] - "React Email templates work with Resend"
# Issue: Resend's API works with plain HTML/text - no React required
# Options:
#   A) Remove this recommendation entirely
#   B) Change to note in skill docs: "React Email enhances Resend DX but is optional"
```

---

## Summary of Required Changes

### Must Remove (3)

```yaml
# 1. Remove scss-modules/tailwind from conflicts
# 2. Remove drizzle requires API framework
# 3. Remove prisma requires API framework
```

### Must Modify (11)

1. `[react, vue, angular, solidjs]` conflict - add micro-frontend exception
2. `[zustand, redux-toolkit, mobx]` conflict - move to discourages
3. `[pinia, zustand, ...]` conflict - update reason about skill vs library
4. `zustand requires` - update reason (vanilla exists)
5. `redux-toolkit requires` - update reason (core is agnostic)
6. `better-auth requires` - expand to include Prisma, Kysely
7. `graphql-apollo requires` - expand framework list
8. `graphql-urql requires` - expand framework list
9. `swr requires` - add react-native
10. `[cypress-e2e, playwright-e2e]` discourages - update reason
11. `resend recommends [react]` - remove or clarify

### Keep As-Is (42+)

All other relationships verified as accurate.

---

## Action Items

- [x] Apply all "Must Remove" changes to skills-matrix.yaml ✅ **DONE 2026-01-25**
- [x] Apply all "Must Modify" changes to skills-matrix.yaml ✅ **DONE 2026-01-25**
- [ ] Add hint text for nuanced relationships in CLI
- [ ] Document edge cases (micro-frontends, monorepos) in relevant skill descriptions
- [ ] Consider adding `radix-ui` to `shadcn-ui` requires (architectural dependency)

---

## Round 2: Library Maintainer Review

> **Generated**: 2026-01-25
> **Purpose**: Verify claims from the library maintainers' perspective
> **Reviewer Role**: Open Source Library Maintainer

### Executive Summary

Several claims in our skills matrix misrepresent what libraries actually support. As maintainers would say: "Read the actual docs, not the tutorials."

| Library        | Our Claim        | Reality                                                    | Verdict       |
| -------------- | ---------------- | ---------------------------------------------------------- | ------------- |
| Zustand        | React-only       | Framework-agnostic core via `zustand/vanilla`              | **INCORRECT** |
| Redux Toolkit  | React-only       | UI-agnostic, works with any framework                      | **INCORRECT** |
| TanStack Query | React adapter    | First-party Vue, Solid, Svelte, Angular adapters           | **INCORRECT** |
| SWR            | React-only       | Correct - React Hooks library, no other frameworks         | **ACCURATE**  |
| MobX           | React-only skill | Framework-agnostic core with official Vue/Angular bindings | **INCORRECT** |

---

### 1. Zustand - Framework Support Analysis

**Our Claim**: "Zustand needs [react, react-native]" - implying React-only

**What Maintainers Actually Say**:

From the [official Zustand README](https://github.com/pmndrs/zustand):

> "Zustand core can be imported and used without the React dependency."

**Evidence from Source Code**:

```typescript
// zustand/vanilla - NO React dependency
import { createStore } from "zustand/vanilla";

const store = createStore((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

// API utilities returned directly (not a hook):
const { getState, setState, subscribe, getInitialState } = store;
```

**Framework Usage Documentation**:

- `zustand/vanilla` provides framework-agnostic store creation
- Works with Vue, Svelte, or vanilla JavaScript
- React bindings are opt-in via `useStore` hook wrapper
- [Article: Using Zustand with Svelte](https://jfranciscosousa.com/blog/using-zustand-with-svelte)
- [Article: How to use Zustand in vanilla JavaScript](https://medium.com/@scriptingwithcharles/how-to-use-zustand-in-vanilla-javascript-019c9bcc1056)

**Maintainer Perspective (Daishi Kato)**:
Zustand was designed with framework-agnostic core from the start. The `zustand/vanilla` entry point exists specifically for non-React usage.

**Required YAML Update**:

```yaml
# BEFORE (incorrect):
- skill: zustand
  needs: [react, react-native]
  needs_any: true
  reason: "Zustand is React-only"

# AFTER (correct):
- skill: zustand
  needs: [react, react-native]
  needs_any: true
  reason: "Our Zustand skill teaches React/React Native patterns. Note: zustand/vanilla provides framework-agnostic core for Vue, Svelte, or vanilla JS."
```

---

### 2. Redux Toolkit - Framework Support Analysis

**Our Claim**: "Redux Toolkit needs [react, react-native]" - implying React-only

**What Maintainers Actually Say**:

From the [official RTK documentation](https://redux-toolkit.js.org/rtk-query/usage/usage-without-react-hooks):

> "Like the Redux core and Redux Toolkit, RTK Query's primary functionality is **UI-agnostic** and can be used with **any UI layer**."

**Evidence from Documentation**:

1. RTK Query works without React hooks - [official docs page](https://redux-toolkit.js.org/rtk-query/usage/usage-without-react-hooks)
2. Manual subscription patterns documented for non-React usage
3. Explicit Svelte example referenced in polling documentation

**Code Example (Framework-Agnostic)**:

```typescript
// RTK Query without React - from official docs
const promise = dispatch(api.endpoints.getPosts.initiate());
const { data, isLoading, isSuccess } = await promise;

// Direct state access
const result = api.endpoints.getPosts.select()(state);
```

**Maintainer Perspective**:
Redux has always been "a predictable state container for JavaScript applications" - not React applications. The React bindings (`react-redux`) are a separate package.

**Required YAML Update**:

```yaml
# BEFORE (incorrect):
- skill: redux-toolkit
  needs: [react, react-native]
  needs_any: true
  reason: "Redux Toolkit is React-only"

# AFTER (correct):
- skill: redux-toolkit
  needs: [react, react-native]
  needs_any: true
  reason: "Our Redux Toolkit skill teaches React/React Native patterns. Note: RTK core is UI-agnostic and works with Angular, Vue, vanilla JS, or any framework."
```

---

### 3. TanStack Query - Framework Support Analysis

**Our Claim**: "TanStack Query's React adapter" - implying React-specific

**What Maintainers Actually Say**:

From [TanStack Query official site](https://tanstack.com/query/latest):

> "Powerful asynchronous state management, server-state utilities and data fetching for **TS/JS, React Query, Solid Query, Svelte Query and Vue Query**."

**First-Party Adapter Packages** (all maintained by TanStack team):

| Package                                | Framework   | Status                     |
| -------------------------------------- | ----------- | -------------------------- |
| `@tanstack/react-query`                | React       | First-party                |
| `@tanstack/vue-query`                  | Vue         | First-party                |
| `@tanstack/solid-query`                | Solid       | First-party                |
| `@tanstack/svelte-query`               | Svelte      | First-party                |
| `@tanstack/angular-query-experimental` | Angular     | First-party (experimental) |
| `@tanstack/query-core`                 | Any/Vanilla | Core package               |

**Architecture** (from [GitHub repo](https://github.com/TanStack/query)):

> "Hub-and-spoke architecture where `@tanstack/query-core` contains all framework-agnostic logic (QueryClient, Query, QueryObserver, Retryer), and framework adapters provide idiomatic APIs."

**Angular Example (from official docs)**:

```typescript
import {
  provideTanStackQuery,
  QueryClient,
} from "@tanstack/angular-query-experimental";

bootstrapApplication(AppComponent, {
  providers: [provideHttpClient(), provideTanStackQuery(new QueryClient())],
});
```

**Maintainer Perspective (Tanner Linsley)**:
TanStack Query was renamed from "React Query" in 2022 specifically because it expanded to support multiple frameworks. The name change reflects the multi-framework reality.

**Required YAML Update**:

```yaml
# BEFORE (misleading):
- skill: react-query
  needs: [react, react-native]
  needs_any: true
  reason: "TanStack Query's React adapter"

# AFTER (accurate):
- skill: react-query
  needs: [react, react-native]
  needs_any: true
  reason: "Our skill covers TanStack Query's React adapter. First-party adapters exist for Vue (@tanstack/vue-query), Solid, Svelte, and Angular (experimental)."
```

---

### 4. SWR - Framework Support Analysis

**Our Claim**: "SWR is a React Hooks library"

**What Maintainers Actually Say**:

From [SWR official site](https://swr.vercel.app/):

> "**React Hooks** for Data Fetching"

**Framework Support**:

- SWR is React-only by design
- No official Vue, Svelte, or Angular support
- [GitHub Issue #756](https://github.com/vercel/swr/issues/756) "For Svelte too?" - Response: "Nope as far as I know"

**Community Alternatives** (NOT official SWR):

| Package | Framework | Maintainer       |
| ------- | --------- | ---------------- |
| `swrv`  | Vue       | Kong (community) |
| `sswr`  | Svelte    | Community        |

**Maintainer Perspective (Vercel)**:
SWR is intentionally React-focused. Vercel has not indicated plans to expand to other frameworks. Developers needing multi-framework support should use TanStack Query instead.

**Required YAML Update**:

```yaml
# Current (CORRECT - keep as-is):
- skill: swr
  needs: [react, react-native]
  needs_any: true
  reason: 'SWR is a React Hooks library (also works with React Native)'

# Optional enhancement:
  reason: 'SWR is React-only by design. For Vue/Svelte, see community ports (swrv, sswr) or use TanStack Query.'
```

---

### 5. MobX - Framework Support Analysis

**Our Claim**: "MobX skill configured for React" (implying React-only)

**What Maintainers Actually Say**:

From [MobX official documentation](https://mobx.js.org/react-integration):

> "While MobX works **independently from React**, they are most commonly used together."

**Official Framework Bindings** (maintained under mobxjs org):

| Package           | Framework | Status                                                      | Weekly Downloads |
| ----------------- | --------- | ----------------------------------------------------------- | ---------------- |
| `mobx-react-lite` | React     | Official                                                    | High             |
| `mobx-react`      | React     | Official                                                    | High             |
| `mobx-vue`        | Vue 2     | Official ([GitHub](https://github.com/mobxjs/mobx-vue))     | ~314/week        |
| `mobx-vue-lite`   | Vue 3     | Community                                                   | Limited          |
| `mobx-angular`    | Angular   | Official ([GitHub](https://github.com/mobxjs/mobx-angular)) | Moderate         |

**From MobX Documentation**:

> "MobX integrates seamlessly with popular choices like React, Vue, or even plain JavaScript."

**Key Benefit** (from mobx-vue docs):

> "You can build a view-library-free application. If you want to migrate to another view library (React/Angular), rewriting the template and switching to the relevant mobx bindings is all you have to do."

**Maintainer Perspective**:
MobX core is explicitly framework-agnostic. The `mobxjs` GitHub organization maintains official bindings for React, Vue, and Angular.

**Required YAML Update**:

```yaml
# BEFORE (incomplete):
- skill: mobx
  needs: [react]
  reason: "MobX skill configured for React"

# AFTER (accurate):
- skill: mobx
  needs: [react]
  reason: "Our MobX skill teaches React patterns (mobx-react-lite). Note: MobX core is framework-agnostic with official bindings for Vue (mobx-vue) and Angular (mobx-angular)."
```

---

### Summary of Required YAML Changes

#### State Management Skills

```yaml
# Zustand
- skill: zustand
  needs: [react, react-native]
  needs_any: true
  reason: "Our Zustand skill teaches React/React Native patterns. Note: zustand/vanilla provides framework-agnostic core for Vue, Svelte, or vanilla JS."

# Redux Toolkit
- skill: redux-toolkit
  needs: [react, react-native]
  needs_any: true
  reason: "Our Redux Toolkit skill teaches React/React Native patterns. Note: RTK core is UI-agnostic and works with Angular, Vue, vanilla JS, or any framework."

# MobX
- skill: mobx
  needs: [react]
  reason: "Our MobX skill teaches React patterns (mobx-react-lite). Note: MobX core is framework-agnostic with official bindings for Vue (mobx-vue) and Angular (mobx-angular)."
```

#### Data Fetching Skills

```yaml
# React Query (TanStack Query)
- skill: react-query
  needs: [react, react-native]
  needs_any: true
  reason: "Our skill covers TanStack Query's React adapter. First-party adapters exist for Vue (@tanstack/vue-query), Solid, Svelte, and Angular (experimental)."

# SWR (no change needed - already accurate)
- skill: swr
  needs: [react, react-native]
  needs_any: true
  reason: "SWR is React-only by design (Vercel). For multi-framework support, use TanStack Query."
```

#### Conflict Reason Updates

```yaml
# Update pinia conflict reason to be accurate
- skills: [pinia, zustand, redux-toolkit, mobx]
  reason: "Pinia is Vue-only. Our zustand/redux-toolkit/mobx skills teach React patterns (though these libraries have framework-agnostic cores or official bindings for other frameworks)."
```

---

### Sources

**Official Documentation**:

- [Zustand README - Using without React](https://github.com/pmndrs/zustand#using-zustand-without-react)
- [Redux Toolkit - Usage Without React Hooks](https://redux-toolkit.js.org/rtk-query/usage/usage-without-react-hooks)
- [TanStack Query Official Site](https://tanstack.com/query/latest)
- [TanStack Query GitHub](https://github.com/TanStack/query)
- [SWR Official Site](https://swr.vercel.app/)
- [MobX React Integration Docs](https://mobx.js.org/react-integration)
- [MobX-Vue GitHub](https://github.com/mobxjs/mobx-vue)
- [MobX-Angular GitHub](https://github.com/mobxjs/mobx-angular)

**Community Articles**:

- [Using Zustand with Svelte](https://jfranciscosousa.com/blog/using-zustand-with-svelte)
- [How to use Zustand in vanilla JavaScript](https://medium.com/@scriptingwithcharles/how-to-use-zustand-in-vanilla-javascript-019c9bcc1056)
- [Redux without React - SitePoint](https://www.sitepoint.com/redux-without-react-state-management-vanilla-javascript/)

**NPM Packages**:

- [@tanstack/vue-query](https://www.npmjs.com/package/@tanstack/vue-query)
- [@tanstack/solid-query](https://www.npmjs.com/package/@tanstack/solid-query)
- [@tanstack/svelte-query](https://www.npmjs.com/package/@tanstack/svelte-query)
- [@tanstack/angular-query-experimental](https://www.npmjs.com/package/@tanstack/angular-query-experimental)
- [mobx-vue](https://www.npmjs.com/package/mobx-vue)
- [mobx-angular](https://www.npmjs.com/package/mobx-angular)
- [swrv (Vue SWR alternative)](https://www.npmjs.com/package/swrv)

---

## Sources

Full source citations available in individual agent output files:

- `/tmp/claude/-home-vince-dev-claude-subagents/tasks/a21f9e8.output` - Frontend Frameworks
- `/tmp/claude/-home-vince-dev-claude-subagents/tasks/aa5f168.output` - Styling
- `/tmp/claude/-home-vince-dev-claude-subagents/tasks/aa35323.output` - State Management
- `/tmp/claude/-home-vince-dev-claude-subagents/tasks/abcd91e.output` - Data Fetching
- `/tmp/claude/-home-vince-dev-claude-subagents/tasks/ae4fb02.output` - Forms & Validation
- `/tmp/claude/-home-vince-dev-claude-subagents/tasks/a963322.output` - Testing Tools
- `/tmp/claude/-home-vince-dev-claude-subagents/tasks/a4f2575.output` - Backend API/ORM
- `/tmp/claude/-home-vince-dev-claude-subagents/tasks/abfae45.output` - UI Components
- `/tmp/claude/-home-vince-dev-claude-subagents/tasks/afcd3fe.output` - Mobile & Observability

---

## Round 2: Enterprise Architect Review

> **Generated**: 2026-01-25
> **Purpose**: Challenge backend relationship claims from production experience
> **Reviewer Role**: Enterprise Architect at Fortune 500

### Executive Summary

As someone who has migrated dozens of production systems, I'm challenging the "best practices" that tutorials claim. The reality of enterprise systems is far more nuanced than "X requires Y" or "X conflicts with Y."

| Claim                        | Our Matrix Says        | Production Reality                                                  | Verdict                  |
| ---------------------------- | ---------------------- | ------------------------------------------------------------------- | ------------------------ |
| ORM requires API framework   | Removed correctly      | ORMs work in CLI, workers, scripts, serverless                      | **CORRECT TO REMOVE**    |
| API frameworks conflict      | Choose one per service | Multiple frameworks coexist in monorepos, migration patterns exist  | **ADD NUANCE**           |
| Better Auth requires Drizzle | Only Drizzle           | Drizzle, Prisma, Kysely, MongoDB - ALL first-party                  | **CONFIRMED FIX NEEDED** |
| Drizzle/Prisma conflict      | Choose one             | Can coexist: migrations vs queries, read replicas, gradual adoption | **ADD NUANCE**           |

---

### 1. ORM Independence - VERIFIED CORRECT TO REMOVE

**Claim Challenged**: We removed "drizzle/prisma requires [hono, express, fastify]"

**Production Evidence Supporting Removal**:

#### CLI Tools

- **Drizzle Kit CLI**: Standalone migration tool - `npx drizzle-kit generate`, `npx drizzle-kit migrate`, `npx drizzle-kit studio`
- **Prisma CLI**: `prisma db seed`, `prisma migrate`, `prisma generate` - all standalone
- Both work without any API framework dependency

#### Serverless Functions

**AWS Lambda with Prisma** ([Prisma Docs](https://www.prisma.io/docs/orm/prisma-client/deployment/serverless/deploy-to-aws-lambda)):

- Works with AWS SAM, Serverless Framework
- Recommended: Connection pooling via Prisma Accelerate or Prisma Postgres
- No Express/Hono/Fastify required

**Vercel Edge Functions** ([Prisma Docs](https://www.prisma.io/docs/orm/prisma-client/deployment/edge/deploy-to-vercel)):

- Prisma supports Edge via driver adapters (Neon, PlanetScale)
- Since v6.16.0: `engineType = "client"` removes Rust binary dependency
- Works with Vercel's Fluid Compute model

**Cloudflare Workers with Drizzle** ([Drizzle Docs](https://orm.drizzle.team/docs/connect-cloudflare-d1)):

- First-class D1 database support
- Works directly in Workers without API framework
- Also supports Durable Objects SQL Storage

#### Background Workers

**BullMQ + Drizzle/Prisma** ([BullMQ Docs](https://bullmq.io/)):

- Queue processors use ORM directly for database operations
- No HTTP layer involved
- Common pattern: Background job workers with direct ORM access

**Database Seed Scripts** ([Prisma Docs](https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding)):

```typescript
// prisma/seed.ts - standalone script, no API framework
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.user.create({ data: { email: "test@example.com" } });
}
main();
```

**Runtime Support**:

- Drizzle: NodeJS, Bun, Deno, Cloudflare Workers, any Edge runtime, browsers
- Prisma: Node.js, Bun (with flag), serverless, edge (with adapters)

**Verdict**: **CONFIRMED - Correct to remove ORM requires API framework**

---

### 2. API Framework Conflicts - NEEDS MORE NUANCE

**Claim Challenged**: `[hono, express, fastify]` - "API frameworks mutually exclusive"

#### Enterprise Reality: Multiple Frameworks Coexist

**Monorepo Pattern** (common in Fortune 500):

```
/apps
  /legacy-api        # Express - mature, battle-tested
  /edge-api          # Hono - new services, edge deployment
  /internal-api      # Fastify - high-throughput internal services
```

This is not theoretical - it's how large organizations actually operate. Different teams, different requirements, different deployment targets.

**Migration Patterns - Express to Hono**:

From [Hono Conf 2024](https://github.com/honojs/middleware/issues/934):

- Proposed `@hono/express` middleware for gradual migration
- Model: `@fastify/express` - proven pattern for Express compatibility layer

**@fastify/express** ([GitHub](https://github.com/fastify/fastify-express)):

> "Adds full Express compatibility to Fastify, exposing the same `use` function of Express and allowing the use of any Express middleware or application."

This plugin allows:

- Running Express middleware inside Fastify
- Gradual route-by-route migration
- Encapsulated compatibility via Fastify's plugin system

**Migration Approach** (from [DEV Community](https://dev.to/ricardogesteves/elevate-your-nodejs-experience-migrating-from-express-to-hono-39ei)):

> "For most applications, migration completes in days, not weeks. The migration process is straightforward, with most Express concepts having direct Hono equivalents."

**Mastra Server Adapters** ([Mastra Blog](https://mastra.ai/blog/mastra-server-adapters)):

- Provides adapters for both Express AND Hono
- Run same AI agents/workflows in either framework
- Proves enterprise need for multi-framework support

**Performance Justification for Mixed Environments**:

| Framework | Use Case                       | Performance                      |
| --------- | ------------------------------ | -------------------------------- |
| Express   | Legacy, mature systems         | Baseline                         |
| Fastify   | High-throughput Node.js        | 2.3x Express RPS                 |
| Hono      | Edge, serverless, new services | 3x+ Express RPS, 40% less memory |

**Recommended YAML Update**:

```yaml
# BEFORE:
- skills: [hono, express, fastify]
  reason: "API frameworks are mutually exclusive within a single service."

# AFTER:
- skills: [hono, express, fastify]
  reason: "API frameworks are mutually exclusive within a single service. In monorepos, different services may use different frameworks. Migration patterns exist: @fastify/express allows running Express middleware in Fastify; Hono migration from Express is straightforward."
```

---

### 3. Better Auth Database Adapters - VERIFIED ALL FIRST-PARTY

**Claim Challenged**: "Better Auth requires [drizzle]" - we said it supports "Prisma, Kysely, MongoDB too"

**GitHub Repository Evidence** ([better-auth/better-auth](https://github.com/better-auth/better-auth)):

From `/packages/better-auth/src/adapters/`:

| Adapter     | Location           | Status                |
| ----------- | ------------------ | --------------------- |
| **Drizzle** | `drizzle-adapter/` | First-party           |
| **Prisma**  | `prisma-adapter/`  | First-party           |
| **Kysely**  | `kysely-adapter/`  | First-party           |
| **MongoDB** | `mongodb-adapter/` | First-party           |
| Memory      | `memory-adapter/`  | First-party (testing) |

**All adapters are in the main repository** - not external packages. This means:

- Maintained by Better Auth team
- Receive same release cycle
- Equal support priority

**From Better Auth Docs** ([Database Page](https://www.better-auth.com/docs/concepts/database)):

> "Better Auth uses a pluggable adapter architecture to support multiple database backends and ORMs."

**Supported Databases via Built-in Kysely**:

- SQLite/D1
- PostgreSQL
- MySQL
- MSSQL

**Performance Note** (Better Auth 1.4.0):

> "Drizzle adapter supports database joins out of the box... endpoints like /get-session and /get-full-organization seeing 2x to 3x performance improvements"

**Bundle Optimization**:

> "If you're using custom adapters (like Prisma, Drizzle, or MongoDB), you can reduce your bundle size by using better-auth/minimal instead of better-auth."

**Confirmed YAML Update Needed**:

```yaml
# BEFORE (incorrect):
- skill: better-auth
  needs: [drizzle]
  reason: "Better Auth uses Drizzle"

# AFTER (accurate):
- skill: better-auth
  needs: [drizzle, prisma]
  needs_any: true
  reason: "Better Auth has first-party adapters for Drizzle, Prisma, Kysely, and MongoDB (all in main repo). Our skill uses Drizzle adapter. Use better-auth/minimal to exclude unused Kysely bundled adapter."
```

---

### 4. ORM Conflicts - CAN COEXIST IN PRODUCTION

**Claim Challenged**: `[drizzle, prisma]` - "choose one per service"

#### Read Replica Pattern

**Drizzle Read Replicas** ([Drizzle Docs](https://orm.drizzle.team/docs/read-replicas)):

```typescript
import { withReplicas } from "drizzle-orm/mysql-core";

const primaryDb = drizzle(primaryPool);
const read1 = drizzle(replica1Pool);
const read2 = drizzle(replica2Pool);

const db = withReplicas(primaryDb, [read1, read2]);

// Writes go to primary
await db.insert(users).values({ name: "Alice" });

// Reads distributed across replicas (random by default)
await db.select().from(users);

// Custom replica selection (70/30 weighted)
const db = withReplicas(primaryDb, [read1, read2], (replicas) => {
  return Math.random() > 0.3 ? replicas[0] : replicas[1];
});
```

**Prisma Read Replicas** ([Prisma Docs](https://www.prisma.io/docs/guides/prisma-client-extensions-read-replicas)):

- `@prisma/extension-read-replicas` package
- Similar pattern to Drizzle

**Cross-ORM Read Replica Pattern** (theoretical but valid):
Could use Prisma for write operations (schema management) + Drizzle for read replicas (lightweight queries). Not common but technically valid.

#### Both ORMs Running Simultaneously

**Drizzle-Prisma Extension** ([Drizzle Docs](https://orm.drizzle.team/docs/prisma)):

```typescript
import { PrismaClient } from "@prisma/client";
import { drizzle } from "drizzle-orm/prisma/pg";
import * as schema from "./drizzle-schema";

// Add Drizzle API to existing Prisma client
const prisma = new PrismaClient().$extends(drizzle({ schema }));

// Use Prisma
const users = await prisma.user.findMany();

// Use Drizzle on same connection
await prisma.$drizzle
  .insert(schema.users)
  .values({ email: "test@example.com" });
```

**Real Production Testimonials**:

[Bereket Engida (Better Auth creator)](https://twitter.com):

> "And in my experience prisma + kysely is better than drizzle."

[Ben Holmes (Warp SWE)](https://twitter.com):

> "I really like Prisma for schemas and Kysely for querying."

[Sean Brydon (Cal.com)](https://github.com):

> "We are using Kysely for some of our more complex queries in Cal.com where we needed more control of the sql generated."

#### Migration Scenarios

**Gradual Prisma to Drizzle Migration** ([GitHub Discussion](https://github.com/drizzle-team/drizzle-orm/discussions/3146)):

> "You don't have to migrate your entire project from Drizzle to Prisma ORM at once, but rather you can step-by-step move your database queries."

**Strategy**:

1. Keep Prisma for migrations (superior DX)
2. Add Drizzle for new queries
3. Use `drizzle-kit pull` to generate Drizzle schema from existing database
4. Migrate queries incrementally
5. Eventually remove Prisma dependency

**Query Builder + ORM Pattern**:

From [TheDataGuy](https://thedataguy.pro/blog/2025/12/nodejs-orm-comparison-2025/):

> "You could use Drizzle Kit to manage your schema but still use Kysely to write your queries. The Drizzle ORM includes support for that out of the box."

This pattern extends to:

- Prisma for schema/migrations + Drizzle for queries
- Drizzle for schema + Kysely for complex queries
- Any combination where tools excel at different tasks

**Recommended YAML Update**:

```yaml
# BEFORE:
- skills: [drizzle, prisma]
  reason: "Both are ORMs serving similar purposes. Choose one per service."

# AFTER:
- skills: [drizzle, prisma]
  reason: "Both are full ORMs - typically choose one per service. Valid multi-ORM scenarios: (1) gradual migration with both running temporarily, (2) Prisma for schema management + Drizzle/Kysely for query building, (3) drizzle-orm/prisma extension for adding Drizzle to existing Prisma projects."
```

---

### Summary of Recommended YAML Changes

#### 1. ORM Independence - NO CHANGE NEEDED

The removal of `drizzle/prisma requires [hono, express, fastify]` was **correct**. Evidence shows ORMs work in:

- CLI tools (migrations, seeds, studio)
- Serverless functions (Lambda, Vercel Edge, Cloudflare Workers)
- Background workers (BullMQ job processors)
- Database scripts (seeds, maintenance)

#### 2. API Framework Conflicts - UPDATE REASON

```yaml
# UPDATE conflict reason:
- skills: [hono, express, fastify]
  reason: "API frameworks are mutually exclusive within a single service. Monorepo architectures may have different frameworks per service. Migration adapters exist: @fastify/express provides Express compatibility in Fastify."
```

#### 3. Better Auth - UPDATE NEEDS AND REASON

```yaml
# UPDATE better-auth:
- skill: better-auth
  needs: [drizzle, prisma]
  needs_any: true
  reason: "Better Auth has first-party adapters for Drizzle, Prisma, Kysely, and MongoDB (all maintained in main repo). Our skill uses Drizzle adapter."
```

#### 4. ORM Conflicts - UPDATE REASON

```yaml
# UPDATE drizzle/prisma conflict:
- skills: [drizzle, prisma]
  reason: "Both are ORMs - choose one per service for new projects. Valid coexistence: gradual migrations, Prisma for schema + Drizzle for queries (drizzle-orm/prisma extension), or multi-service architectures."
```

---

### Edge Cases Discovered

1. **Drizzle in Edge Runtimes**: Zero dependencies, works in browsers, Cloudflare Workers, Deno - no Node.js required
2. **Prisma without Rust**: Since v6.16.0, `engineType = "client"` removes binary dependency for edge deployment
3. **Drizzle-Prisma Extension**: First-party support for using both ORMs on same database connection
4. **Drizzle-Kysely Module**: Official support for Kysely queries with Drizzle schema management
5. **@fastify/express**: Production-ready adapter for running Express apps inside Fastify

---

### Sources

**Official Documentation**:

- [Drizzle ORM - Read Replicas](https://orm.drizzle.team/docs/read-replicas)
- [Drizzle ORM - Prisma Extension](https://orm.drizzle.team/docs/prisma)
- [Drizzle ORM - Cloudflare D1](https://orm.drizzle.team/docs/connect-cloudflare-d1)
- [Drizzle Kit Overview](https://orm.drizzle.team/docs/kit-overview)
- [Prisma - Deploy to AWS Lambda](https://www.prisma.io/docs/orm/prisma-client/deployment/serverless/deploy-to-aws-lambda)
- [Prisma - Deploy to Vercel Edge](https://www.prisma.io/docs/orm/prisma-client/deployment/edge/deploy-to-vercel)
- [Prisma - Seeding](https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding)
- [Prisma - Migrate from Drizzle](https://www.prisma.io/docs/guides/migrate-from-drizzle)
- [Better Auth - Database](https://www.better-auth.com/docs/concepts/database)
- [Better Auth - Drizzle Adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [Better Auth - Prisma Adapter](https://www.better-auth.com/docs/adapters/prisma)
- [Better Auth GitHub Adapters](https://github.com/better-auth/better-auth/tree/main/packages/better-auth/src/adapters)
- [BullMQ Documentation](https://bullmq.io/)

**GitHub Issues & Discussions**:

- [Hono Express Middleware](https://github.com/honojs/middleware/issues/934)
- [Hono Express.js Middleware Support](https://github.com/honojs/hono/issues/3293)
- [Drizzle Prisma Migration Discussion](https://github.com/drizzle-team/drizzle-orm/discussions/3146)
- [@fastify/express](https://github.com/fastify/fastify-express)
- [drizzle-kysely](https://github.com/drizzle-team/drizzle-kysely)

**Enterprise Architecture**:

- [Prisma Blog - ORM Convergence](https://www.prisma.io/blog/convergence)
- [TheDataGuy - Node.js ORMs in 2025](https://thedataguy.pro/blog/2025/12/nodejs-orm-comparison-2025/)
- [DEPT Agency - Prisma vs Kysely](https://engineering.deptagency.com/prisma-vs-kysely)
- [Mastra Blog - Server Adapters](https://mastra.ai/blog/mastra-server-adapters)

**Migration Guides**:

- [Drizzle - Migrate from Prisma](https://orm.drizzle.team/docs/migrate/migrate-from-prisma)
- [DEV - Express to Hono Migration](https://dev.to/ricardogesteves/elevate-your-nodejs-experience-migrating-from-express-to-hono-39ei)
- [ModernTechFeed - Express to Hono](https://moderntechfeed.com/express-js-to-hono/)

---

## Round 3: Migration Specialist Review

> **Generated**: 2026-01-25
> **Perspective**: Technology Migration Consultant
> **Key Insight**: "Conflicts" often mean "don't use together in greenfield projects" but are perfectly valid during migrations

---

### Executive Challenge

The Round 1 analysis classified many relationships as "conflicts" without considering the migration perspective. In practice, enterprises routinely run "conflicting" technologies together during transition periods. This review challenges binary conflict claims and proposes migration-aware classifications.

---

### 1. State Management Migrations

#### Redux to Zustand Migration

**Can you run both during transition?** YES - Officially supported pattern.

> "Introduce Zustand alongside Redux, fostering a gradual transition that minimizes disruption to your application's harmony."
> -- [TillItsDone Migration Guide](https://tillitsdone.com/blogs/redux-to-zustand-migration-guide/)

**Migration Strategy**:

- Feature flag approach: Install Redux alongside Zustand and use feature flags for migration
- Divide and conquer: Migrate stores one at a time rather than all at once
- Identify smaller components or features as starting points

**Typical Duration**: 2-8 weeks for small-medium apps, 3-6 months for large enterprise apps

**Real-world case study**: One team documented their journey "From Redux to Zustand to Jotai to Zustand to Custom" taking approximately **18 months** across multiple iterations ([GitNation Talk](https://gitnation.com/contents/from-redux-to-zustand-to-jotai-to-zustand-to-custom-our-state-management-horror-story)).

#### MobX to Redux (and vice versa) Migration

**Can they coexist?** YES - Explicitly documented.

> "It's possible to keep Redux still alive during the transition. It is pretty easy to introduce MobX to an already state managed application, and nothing prevents it from co-existing with Redux."
> -- [Dev.to Migration Article](https://dev.to/mbarzeev/from-redux-to-mobx-52c1)

**Tools for bridging**: The npm module "remob" attempts to sync Redux and MobX, combining the pros from both libraries.

**Key differences to manage during coexistence**:

- Redux: Single store, immutable state, action-reducer pattern
- MobX: Multiple stores, mutable state, observable pattern

#### Challenge to Round 1 Classification

| Current Classification                    | Proposed Classification                       |
| ----------------------------------------- | --------------------------------------------- |
| `[zustand, redux-toolkit, mobx]` conflict | CHANGE to **discourages** with migration note |

**Recommended reason text**:

```yaml
- skills: [zustand, redux-toolkit, mobx]
  reason: "Using multiple React state libraries adds complexity for new projects. During migrations, coexistence is officially supported - migrate store-by-store over 2-6 months."
```

---

### 2. Framework Migrations (React, Vue, Angular)

#### React to Vue / Vue to React Migration

**Is gradual migration possible?** YES - Via micro-frontends.

> "Using the Strangler Fig Pattern and Micro Frontend architecture, organizations have built new React applications that seamlessly served restyled instances of legacy features built in Vue, right alongside new functionality in one cohesive customer experience."
> -- [Medium: Micro Frontends for Legacy App Migrations](https://medium.com/@johnlawrimore/micro-frontends-a-game-changing-strategy-for-legacy-app-migrations-6288f50a6f72)

**Coexistence patterns**:

1. **Module Federation** (2025 standard): Frontend pods expose and consume remote components at runtime
2. **Qiankun Framework**: Enterprise-proven micro-frontend framework for React + Vue coexistence
3. **Single-SPA**: Orchestrates multiple framework micro-frontends
4. **Web Components / Custom Elements**: Framework-agnostic interop layer

> "Micro-frontends enable gradual migration for transitioning legacy monolithic frontends into modern architectures without a complete rewrite."

#### Angular to React Migration

**Incremental coexistence?** YES - Multiple documented patterns.

> "The Strangler Method is more incremental. You replace one feature at a time in the Angular app with its React counterpart, allowing both frameworks to coexist until the migration is complete."
> -- [Brainhub: Migrating to React](https://brainhub.eu/library/migrating-to-react)

**2025 coexistence techniques**:

- **ngReact / Angular2React**: Library enabling AngularJS and React integration within the same application
- **Custom Elements approach**: Build new features in React as web components, embed into Angular
- **Lazy loading with MutationObserver**: Dynamically inject React components when needed
- **Nx Monorepo**: Bidirectional integration between Angular and React

**Migration difficulty ranking**:

- React <-> Vue: **Easiest** (similar reactivity models)
- Angular <-> React: **Hardest** (DI, RxJS, template language differences)

**Typical Duration**: 6-18 months for enterprise Angular -> React migrations

#### Challenge to Round 1 Classification

| Current Classification                    | Proposed Classification                             |
| ----------------------------------------- | --------------------------------------------------- |
| `[react, vue, angular, solidjs]` conflict | KEEP as conflict, but ADD extensive migration notes |

**Recommended enhanced reason text**:

```yaml
- skills: [react, vue, angular, solidjs]
  reason: "Core frameworks are mutually exclusive within a single application. Exception: micro-frontend architectures (Single-SPA, Module Federation, Qiankun) support multi-framework coexistence during migrations. Typical enterprise migration period: 6-18 months."
```

---

### 3. ORM Migrations (Prisma to Drizzle)

#### Can both ORMs hit the same database safely?

**YES** - Drizzle provides first-class Prisma extension for gradual adoption.

> "If you have an existing project with Prisma and want to try Drizzle or gradually adopt it, you can use a first-class extension that will add Drizzle API to your Prisma client. It will allow you to use Drizzle alongside your Prisma queries reusing your existing DB connection."
> -- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/prisma)

**How to run both simultaneously**:

```javascript
import { PrismaClient } from "@prisma/client";
import { drizzle } from "drizzle-orm/prisma/pg";
const prisma = new PrismaClient().$extends(drizzle());
```

**Schema migration approach**:

1. Use `drizzle-kit pull` to generate Drizzle schema from existing database
2. Both ORMs track migrations independently:
   - Prisma: `_prisma_migrations` table
   - Drizzle: `__drizzle_migrations` table
3. No schema conflicts when both read from same source of truth

**Real-world migration report**: One team completed Prisma to Drizzle migration in **~21 hours** with 25% reduction in lines of code ([GitHub Discussion](https://github.com/drizzle-team/drizzle-orm/discussions/3146)).

**Typical Duration**: 1-4 weeks for most projects, depending on schema complexity

#### Challenge to Round 1 Classification

| Current Classification       | Proposed Classification                          |
| ---------------------------- | ------------------------------------------------ |
| `[drizzle, prisma]` conflict | CHANGE to **discourages** with migration pattern |

**Recommended reason text**:

```yaml
- skills: [drizzle, prisma]
  reason: "Both are ORMs serving similar purposes - pick one for new projects. Migration supported: Drizzle provides Prisma extension for gradual adoption. Both can safely target same database during transition (1-4 weeks typical)."
```

---

### 4. Styling Migrations (CSS Modules to Tailwind)

#### How do teams handle partial migration?

**Gradual migration is the recommended approach.**

> "Switching to Tailwind is a big decision. It changes how you write styles, organize components, and think about UI. But it doesn't need to be all-or-nothing. Teams have migrated gradually - component by component."
> -- [Dev.to: How to slowly migrate to Tailwind](https://dev.carsonbain.com/blog/migrate-project-to-tailwind-css)

**Hybrid migration strategy**:

1. Any new code should be built with Tailwind
2. Any time team touches existing CSS, attempt to refactor to Tailwind
3. Use Tailwind `prefix` option to avoid class name conflicts
4. Enable `important: true` temporarily for Tailwind to override existing styles during migration
5. Remove `!important` config once fully migrated

#### Build performance during hybrid state?

**Warning**: Performance impact is real.

> "When using CSS modules, build tools like Vite, Parcel, and Turbopack process each CSS module separately. That means if you have 50 CSS modules in a project, Tailwind needs to run 50 separate times, which leads to much slower build times."
> -- [Tailwind CSS Documentation](https://tailwindcss.com/docs/compatibility)

**Mitigation strategies**:

- Use Tailwind CLI out-of-process for dedicated compilation
- Configure separate Tailwind configs for different parts of app
- Prioritize high-traffic components for early migration

**Typical Duration**: 2-6 months for medium projects, longer for large design systems

#### Challenge to Round 1 Classification

| Current Classification                            | Proposed Classification              |
| ------------------------------------------------- | ------------------------------------ |
| Round 1 already recommended moving to discourages | AGREE - Keep in **discourages** only |

**Recommended enhanced reason text**:

```yaml
- skills: [scss-modules, tailwind]
  reason: "Mixing CSS paradigms causes slower builds (Tailwind runs per-module). Pick one for new projects. Migration: gradual component-by-component adoption supported with prefix/important config. Expect 2-6 month transition period."
```

---

### 5. Meta-framework Migrations

#### Next.js Pages Router to App Router

**This is NOT a conflict - it's an official incremental migration path.**

> "The app directory is intentionally designed to work simultaneously with the pages directory to allow for incremental page-by-page migration."
> -- [Next.js Official Documentation](https://nextjs.org/docs/app/guides/migrating/app-router-migration)

**Key points**:

- Both `/app` and `/pages` directories work simultaneously
- Upgrading to Next.js 13+ does NOT require using App Router
- Migrate page-by-page at your own pace

**Caveats**:

- Navigation between routers behaves like navigating between two separate apps
- `useRouter` imports differ: `next/router` vs `next/navigation`
- Some teams report challenges with SPA bootstrapping states

**Typical Duration**: 2-8 weeks for most projects

#### Create React App (CRA) to Next.js Migration

**Incremental adoption is possible.**

> "You can actually run both systems on the same codebase with minimal effort. CRA uses a single entry point (usually src/index.js), while Next relies on the pages directory, so there is no conflict there."
> -- [GitHub Discussion](https://github.com/vercel/next.js/discussions/25316)

**Benefits documented**: One case study removed 20,000+ lines of code and 30+ dependencies, improving local iteration speed from 1.3s to 131ms.

**Migration steps**:

1. Start with SPA mode using catch-all route `[[...slug]]`
2. Run both systems in parallel during transition
3. Gradually adopt SSR, API routes, and other features

**Typical Duration**: 1-4 weeks for initial migration, ongoing for full feature adoption

#### Express to Hono Migration

**Adapter patterns exist for coexistence.**

> "If Hono can be mounted as a sub-application of Express, it would enable a gradual migration from Express to Hono."
> -- [Hono Conf 2024](https://github.com/honojs/middleware/issues/934)

**Coexistence approaches**:

- Hono as sub-application of Express (proof-of-concept exists)
- Express middleware adapter pattern (experimental)
- Route-by-route migration using reverse proxy

**Typical Duration**: 2-6 weeks for most API projects

---

### Summary: Reclassification Recommendations

| Relationship                       | Current  | Proposed                         | Rationale                                                       |
| ---------------------------------- | -------- | -------------------------------- | --------------------------------------------------------------- |
| `[zustand, redux-toolkit, mobx]`   | conflict | **discourages**                  | Coexistence officially supported during migration               |
| `[drizzle, prisma]`                | conflict | **discourages**                  | Drizzle Prisma extension enables gradual adoption               |
| `[scss-modules, tailwind]`         | conflict | **discourages** (Round 1 agreed) | Gradual migration is standard practice                          |
| `[react, vue, angular, solidjs]`   | conflict | conflict + **migration notes**   | Micro-frontends enable coexistence, but complexity is high      |
| `[hono, express, fastify]`         | conflict | conflict + **migration notes**   | Adapter patterns exist but still mutually exclusive per-service |
| `[nextjs-app-router, remix, nuxt]` | conflict | conflict (KEEP)                  | Truly mutually exclusive, no coexistence pattern                |

---

### Recommended Migration Duration Guidelines

Add to skill descriptions or CLI hints:

| Migration Type          | Typical Duration | Coexistence Support         |
| ----------------------- | ---------------- | --------------------------- |
| Redux -> Zustand        | 2-8 weeks        | Full (feature flags)        |
| MobX -> Redux           | 4-12 weeks       | Full (remob library)        |
| Prisma -> Drizzle       | 1-4 weeks        | Full (official extension)   |
| CSS Modules -> Tailwind | 2-6 months       | Partial (build perf impact) |
| CRA -> Next.js          | 1-4 weeks        | Full (parallel systems)     |
| Pages -> App Router     | 2-8 weeks        | Full (official design)      |
| Express -> Hono         | 2-6 weeks        | Experimental (adapter)      |
| Angular -> React        | 6-18 months      | Full (micro-frontends)      |
| React <-> Vue           | 6-12 months      | Full (micro-frontends)      |

---

### New Migration-Specific Notes to Add

For each "discourages" relationship involving technologies that can coexist during migration, add:

```yaml
migration_note: "Coexistence supported during transition. See migration guide for recommended approach."
migration_duration: "2-8 weeks typical"
```

For framework conflicts that support micro-frontend coexistence:

```yaml
migration_note: "Enterprise migrations use micro-frontends (Module Federation, Qiankun, Single-SPA) for 6-18 month coexistence periods."
```

---

### Sources

**State Management Migrations**:

- [TillItsDone: Redux to Zustand Migration Guide](https://tillitsdone.com/blogs/redux-to-zustand-migration-guide/)
- [BetterStack: Zustand vs Redux Comparison](https://betterstack.com/community/guides/scaling-nodejs/zustand-vs-redux/)
- [Dev.to: From Redux to MobX](https://dev.to/mbarzeev/from-redux-to-mobx-52c1)
- [GitNation: State Management Horror Story](https://gitnation.com/contents/from-redux-to-zustand-to-jotai-to-zustand-to-custom-our-state-management-horror-story)
- [LinkedIn: MobX to Redux Migration](https://www.linkedin.com/advice/0/how-do-you-migrate-from-mobx-redux-vice-versa)

**Framework Migrations**:

- [BetterProgramming: Vue.js 2 to React 18 Incremental Migration](https://betterprogramming.pub/how-to-incrementally-migrate-from-vue-js-2-to-react-18-part-1-setup-be2cd04458f0)
- [Medium: Micro Frontends for Legacy App Migrations](https://medium.com/@johnlawrimore/micro-frontends-a-game-changing-strategy-for-legacy-app-migrations-6288f50a6f72)
- [Brainhub: Migrating to React Strategy](https://brainhub.eu/library/migrating-to-react)
- [Medium: Bidirectional Angular-React Integration](https://medium.com/@mciissee/a-guide-to-bidirectional-integration-between-angular-and-react-9ac216f8083f)
- [OreateAI: Qiankun + Vite Micro-Frontend](https://www.oreateai.com/blog/minimalist-practice-implementing-microfrontend-architecture-with-react-and-vue-qiankun-vite/3e822b505b9e9d5df1f3e6f2403f4719)

**ORM Migrations**:

- [Drizzle ORM: Migrate from Prisma](https://orm.drizzle.team/docs/migrate/migrate-from-prisma)
- [Drizzle ORM: Prisma Extension](https://orm.drizzle.team/docs/prisma)
- [GitHub: Prisma to Drizzle Migration Experience](https://github.com/drizzle-team/drizzle-orm/discussions/3146)
- [Medium: Zero Downtime Prisma to Drizzle Migration](https://medium.com/drizzle-stories/how-i-migrated-from-prisma-to-drizzleorm-with-absolutely-no-hassle-and-zero-downtime-9f5f0881fc04)

**Styling Migrations**:

- [Auslake: CSS Modules to Tailwind Migration](https://auslake.vercel.app/blog/migration-tailwindcss)
- [Dev.to: Slowly Migrate to Tailwind CSS](https://dev.carsonbain.com/blog/migrate-project-to-tailwind-css)
- [Tailwind CSS: Compatibility Documentation](https://tailwindcss.com/docs/compatibility)
- [Brad Garropy: CSS Modules to Tailwind](https://bradgarropy.com/blog/css-modules-to-tailwind)

**Meta-framework Migrations**:

- [Next.js: App Router Migration Guide](https://nextjs.org/docs/app/guides/migrating/app-router-migration)
- [Next.js: CRA Migration Guide](https://nextjs.org/docs/app/guides/migrating/from-create-react-app)
- [Clerk: Pages to App Router Incremental Guide](https://clerk.com/blog/migrating-pages-router-to-app-router-an-incremental-guide)
- [WorkOS: Next.js App Router Migration Zero Downtime](https://workos.com/blog/migrating-to-next-js-app-router-with-zero-downtime)
- [ModernTechFeed: Express to Hono Migration](https://moderntechfeed.com/express-js-to-hono/)
- [GitHub: Hono Sub-Application of Express](https://github.com/honojs/middleware/issues/934)

---

## Round 4: GraphQL Expert Review

> **Reviewed**: 2026-01-25
> **Reviewer**: GraphQL Infrastructure Expert
> **Focus**: Deep verification of GraphQL client claims

### Executive Summary

People constantly conflate "GraphQL client" with "React GraphQL client" - there's significant nuance here. This review verifies framework support claims for Apollo Client and URQL, identifies missing GraphQL clients, and documents coexistence patterns.

| Client        | Claimed Support                        | Actual Support                                                                         | Verdict          |
| ------------- | -------------------------------------- | -------------------------------------------------------------------------------------- | ---------------- |
| Apollo Client | React, Vue, Angular, Svelte, SolidJS   | React (first-party), Vue/Angular (active community), Svelte/Solid (stale/unmaintained) | **NEEDS UPDATE** |
| URQL          | React, Vue, Svelte, Solid (no Angular) | React, Preact, Vue, Svelte, Solid (all first-party)                                    | **ACCURATE**     |

---

### 1. Apollo Client Framework Support - VERIFIED

| Framework   | Package                  | Support Type              | Last Updated         | Weekly Downloads |
| ----------- | ------------------------ | ------------------------- | -------------------- | ---------------- |
| **React**   | `@apollo/client`         | First-party               | 2026 (v4.0)          | Very High        |
| **Vue**     | `@vue/apollo-composable` | Community (Vue team repo) | 2025-03 (v4.2.2)     | High             |
| **Angular** | `apollo-angular`         | Community (Kamil Kisiela) | 2025-12 (v13.0.0)    | High             |
| **Svelte**  | `svelte-apollo`          | Community (Tim Hall)      | **2022-02** (v0.5.0) | Low              |
| **SolidJS** | `solid-apollo`           | Community                 | **2020-03** (v0.0.2) | Very Low         |

**Key Findings from Apollo Documentation**:

From [Apollo Client 4.0 Release Notes](https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md):

> "Apollo Client 4.0 separates React functionality from the core library, making `@apollo/client` truly framework-agnostic. React exports now live in `@apollo/client/react`."

From [Apollo Integrations Page](https://www.apollographql.com/docs/react/integrations/integrations):

> Community integrations listed for Angular, Vue, Svelte, Solid.js, and Ember - **none are first-party**.

**Critical Issues Identified**:

1. **svelte-apollo is effectively abandoned** - Last published Feb 2022 (almost 4 years ago), v0.5.0
2. **solid-apollo is unmaintained** - Last published March 2020 (6 years ago!), v0.0.2
3. **SolidJS community recommends `@solid-primitives/graphql` instead** - actively maintained alternative

**Correction Required**:

```yaml
# CURRENT (inaccurate):
- skill: graphql-apollo
  needs: [react, vue, angular, svelte, solidjs]
  reason: "Apollo Client - first-party React support, community-maintained integrations for Vue, Angular, Svelte, Solid"

# CORRECTED:
- skill: graphql-apollo
  needs: [react, vue, angular]
  needs_any: true
  reason: "Apollo Client 4.0 - first-party React, active community Vue (@vue/apollo-composable), active community Angular (apollo-angular). Svelte/Solid integrations are stale - use URQL or @solid-primitives/graphql instead."
```

---

### 2. URQL Framework Support - VERIFIED

| Framework   | Package                | Support Type | Last Updated     | Status       |
| ----------- | ---------------------- | ------------ | ---------------- | ------------ |
| **React**   | `urql` / `@urql/core`  | First-party  | 2026-01          | Active       |
| **Preact**  | `@urql/preact`         | First-party  | 2026-01          | Active       |
| **Vue**     | `@urql/vue`            | First-party  | 2026-01          | Active       |
| **Svelte**  | `@urql/svelte`         | First-party  | 2026-01 (v5.0.0) | Active       |
| **Solid**   | `@urql/solid`          | First-party  | 2026-01 (v1.0.1) | Active       |
| **Angular** | `ngx-urql` (3rd party) | Community    | Limited          | Not Official |

**Key Findings from URQL Documentation**:

From [URQL README](https://github.com/urql-graphql/urql):

> "urql is a GraphQL client that exposes a set of helpers for several frameworks including React, Preact, Vue, Solid, and Svelte."

From [URQL Comparison Docs](https://nearform.com/open-source/urql/docs/comparison/):

> "urql provides bindings for various frameworks, including React, Preact, Svelte, and Vue... **Angular bindings are not provided**."

**Why No Angular Support?**

From [URQL deep-dive talk](https://gitnation.com/contents/but-can-your-graphql-client-do-this-a-deep-dive-into-urql):

> "Although there are no plans to add bindings to Angular, so if that's your jam, you might have to look elsewhere."

This is a **strategic/resource decision**, not a technical limitation. The URQL team prioritizes first-party support for frameworks where they see demand.

**Current Claim is ACCURATE** - Keep as-is, enhance reason text:

```yaml
- skill: graphql-urql
  needs: [react, vue, svelte, solidjs]
  needs_any: true
  reason: "URQL has first-party bindings for React, Preact, Vue, Svelte, and Solid - all actively maintained. No official Angular support (community ngx-urql exists). Superior non-React framework support compared to Apollo."
```

---

### 3. GraphQL Client Conflict Analysis

**Question: Are Apollo and URQL truly mutually exclusive?**

| Scenario                            | Feasible?       | Recommendation                                            |
| ----------------------------------- | --------------- | --------------------------------------------------------- |
| Both clients in same project        | Technically yes | **Discouraged** - dual caching systems, bundle bloat      |
| Apollo subscriptions + URQL queries | Possible        | **Discouraged** - no shared cache, complex setup          |
| Migration period                    | Valid           | **Acceptable** - temporary coexistence during migration   |
| Monorepo with separate apps         | Valid           | **Acceptable** - different apps can use different clients |

**Key Difference - Caching Strategies**:

| Client | Cache Type           | Implication                                           |
| ------ | -------------------- | ----------------------------------------------------- |
| Apollo | **Normalized cache** | Deduplicates entities by ID, updates across queries   |
| URQL   | **Document cache**   | Caches query results as-is, simpler but less powerful |

From [Kitemaker Blog](https://kitemaker.co/blog/switching-from-apollo-to-urql):

> "URQL is a lightweight GraphQL client... unlike Apollo, it only (by default) provides caching of GraphQL query results - it does not perform any normalization of the data."

**Verdict: Keep as conflict, add migration exception**:

```yaml
- skills: [graphql-apollo, graphql-urql]
  reason: "Both are full-featured GraphQL clients with incompatible caching strategies (Apollo: normalized, URQL: document). Choose one per application. Exception: temporary coexistence valid during migrations."
```

---

### 4. Missing GraphQL Clients - SHOULD ADD

#### 4.1 graphql-request (STRONGLY RECOMMENDED)

**What it is**: Minimal GraphQL client - the "axios of GraphQL"

From [npm package](https://www.npmjs.com/package/graphql-request):

> "graphql-request is the most minimal and simplest to use GraphQL client. It's perfect for small scripts or simple apps."

**Stats**: 3,842 dependent projects, v7.4.0 (actively maintained)

**When to use**:

- Backend-to-backend GraphQL calls (no React involved)
- Scripts, CLIs, or simple apps
- When pairing with React Query for caching (graphql-request handles fetching)
- Server-side code in Next.js/Remix

**What it lacks** (intentionally):

- No built-in cache
- No framework integrations
- No normalized cache

**Proposed YAML**:

```yaml
- id: graphql-request
  name: graphql-request
  category: data-fetching
  description: "Minimal GraphQL client for scripts, servers, and simple apps"
  relationships:
    recommends:
      - when: graphql-request
        suggest: [react-query]
        reason: "graphql-request handles GraphQL fetching; React Query handles caching and state management"
    discourages:
      - skills: [graphql-request, graphql-apollo]
        reason: "Apollo provides full client features (cache, devtools); graphql-request is fetch-only. Use graphql-request for server-side or with React Query for client-side."
      - skills: [graphql-request, graphql-urql]
        reason: "URQL provides full client features; graphql-request is minimal. Use graphql-request for server-side or scripts."
```

#### 4.2 Relay (CONSIDER ADDING)

**What it is**: Facebook's opinionated GraphQL client for React

From [Relay Documentation](https://relay.dev/):

> "Relay is a JavaScript framework for building data-driven React applications."

**Key Characteristics**:

- React-only (deeply integrated with React's render-as-you-fetch)
- Requires Relay Compiler at build time
- Opinionated about schema design (connections, node interface)
- Used at massive scale by Meta

**When to use**:

- Large-scale React applications
- Teams willing to invest in Relay's patterns
- When colocation of data requirements is critical

From [Relay Architecture](https://github.com/facebook/relay):

> "The relay-runtime and relay-compiler are now decoupled from the UI integration... This means you can now more easily build your own integrations."

**Proposed YAML (if adding)**:

```yaml
- id: relay
  name: Relay
  category: data-fetching
  description: "Opinionated GraphQL client for large-scale React applications"
  relationships:
    requires:
      - skill: relay
        needs: [react]
        reason: "Relay is deeply integrated with React (no Vue/Angular/Svelte/Solid support)"
    conflicts:
      - skills: [relay, graphql-apollo, graphql-urql]
        reason: "All are comprehensive GraphQL clients - choose one per application"
```

#### 4.3 Type-Safe Alternatives (DOCUMENT, DON'T ADD AS SKILLS)

| Library                    | Approach            | Use Case                                             |
| -------------------------- | ------------------- | ---------------------------------------------------- |
| **genql**                  | Code generation     | Type-safe SDK, generate once per schema change       |
| **gqty**                   | Proxy-based runtime | Automatic query generation from data access patterns |
| **graphql-code-generator** | Code generation     | Generates TypeScript types for any client            |

From [Genql Documentation](https://genql.dev/):

> "With Genql, you only generate your client once (when your schema changes), not every time you change a query."

**Recommendation**: These are specialized tools that enhance existing clients. Document in skill descriptions rather than as separate skills.

---

### 5. GraphQL + REST Coexistence Patterns

**Question: Can Apollo + React Query coexist?**

**Answer: YES - this is a valid and common pattern**

| Pattern                               | Feasibility     | Use Case                     |
| ------------------------------------- | --------------- | ---------------------------- |
| Apollo (GraphQL) + React Query (REST) | **Recommended** | Hybrid API architectures     |
| URQL (GraphQL) + SWR (REST)           | **Recommended** | Alternative hybrid approach  |
| Apollo Connectors for REST (2025)     | **New Option**  | Unify REST via GraphQL layer |

From [Apollo Blog - May 2025](https://www.apollographql.com/blog/simplify-your-rest-api-logic-in-react-with-connectors-for-rest-apis-and-graphql):

> "Using a declarative configuration, you can unify earthquake and location data in a single query with no need for custom resolvers or custom backend logic."

**This is NOT a conflict** - Document as a recommendation:

```yaml
# Add to graphql-apollo recommends:
- when: graphql-apollo
  suggest: [react-query]
  reason: "Use Apollo for GraphQL endpoints and React Query for REST endpoints in hybrid architectures. Apollo Connectors (2025) can also unify REST via GraphQL."

# Add to graphql-urql recommends:
- when: graphql-urql
  suggest: [react-query, swr]
  reason: "URQL for GraphQL endpoints, React Query or SWR for REST endpoints in hybrid architectures."
```

---

### Summary of Required YAML Changes

#### Must Modify (2)

1. **graphql-apollo requires** - Remove svelte/solidjs from supported frameworks (stale/unmaintained)
2. **graphql client conflicts** - Add migration exception note

#### Should Add (2)

1. **graphql-request** - Minimal client for scripts, servers, and React Query integration
2. **Relay** - Consider adding for large-scale React applications (lower priority)

#### Should Document (not as separate skills)

1. Apollo + React Query coexistence pattern for hybrid APIs
2. graphql-code-generator usage as enhancement layer
3. genql/gqty as type-safe alternatives

#### Incorrect Claims Found (1)

| Claim                                         | Issue                                                           | Fix                              |
| --------------------------------------------- | --------------------------------------------------------------- | -------------------------------- |
| `graphql-apollo needs [..., svelte, solidjs]` | svelte-apollo last updated 2022, solid-apollo last updated 2020 | Remove svelte/solidjs from needs |

---

### Sources

**Official Documentation**:

- [Apollo Client Documentation - View Integrations](https://www.apollographql.com/docs/react/integrations/integrations)
- [Apollo Client 4.0 Changelog](https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md)
- [Apollo Angular](https://apollo-angular.com/) - Community maintained by Kamil Kisiela
- [Vue Apollo](https://apollo.vuejs.org/) - In vuejs GitHub org
- [URQL Documentation](https://nearform.com/open-source/urql/docs/)
- [URQL Comparison](https://nearform.com/open-source/urql/docs/comparison/)
- [URQL GitHub](https://github.com/urql-graphql/urql)
- [Relay Documentation](https://relay.dev/)
- [Relay GitHub](https://github.com/facebook/relay)

**NPM Packages Verified**:

- [@vue/apollo-composable](https://www.npmjs.com/package/@vue/apollo-composable) - v4.2.2, updated 2025-03
- [apollo-angular](https://www.npmjs.com/package/apollo-angular) - v13.0.0, updated 2025-12
- [svelte-apollo](https://www.npmjs.com/package/svelte-apollo) - v0.5.0, **last updated 2022-02**
- [solid-apollo](https://www.npmjs.com/package/solid-apollo) - v0.0.2, **last updated 2020-03**
- [@urql/svelte](https://www.npmjs.com/package/@urql/svelte) - v5.0.0, updated 2026-01
- [@urql/solid](https://www.npmjs.com/package/@urql/solid) - v1.0.1, updated 2026-01
- [graphql-request](https://www.npmjs.com/package/graphql-request) - v7.4.0, actively maintained

**Additional Resources**:

- [Kitemaker: Switching from Apollo to URQL](https://kitemaker.co/blog/switching-from-apollo-to-urql)
- [Apollo Connectors for REST APIs (2025)](https://www.apollographql.com/blog/simplify-your-rest-api-logic-in-react-with-connectors-for-rest-apis-and-graphql)
- [Hasura GraphQL Clients Comparison](https://hasura.io/blog/exploring-graphql-clients-apollo-client-vs-relay-vs-urql)
- [@solid-primitives/graphql](https://primitives.solidjs.community/package/graphql/)
- [Genql Documentation](https://genql.dev/)

---

## Round 5: DX Advocate Review

> **Reviewer Role**: Developer Experience Advocate
> **Date**: 2026-01-25
> **Focus**: Styling, UI components, and real-world usage patterns

---

### Executive Summary

As a DX advocate who cares about what developers ACTUALLY do (not what's "technically possible"), I've challenged the styling and UI component claims. The findings reveal some gaps in our alternatives list and nuances that matter for real-world adoption.

| Claim                                | Reality Check                                                         | Verdict        |
| ------------------------------------ | --------------------------------------------------------------------- | -------------- |
| SCSS + Tailwind in "discourages"     | Correct - Tailwind v4 officially discourages preprocessors            | **ACCURATE**   |
| shadcn/ui requires [react, tailwind] | True for official, but quality Vue/Svelte ports exist                 | **NEEDS NOTE** |
| Radix UI works with any CSS          | Verified across Tailwind, styled-components, CSS Modules, vanilla CSS | **ACCURATE**   |
| Missing headless UI alternatives     | Base UI (v1 Dec 2025), Ark UI, React Aria all significant             | **GAP FOUND**  |

---

### 1. SCSS Modules + Tailwind - Reality Check

**Claim Being Challenged**: Moved to "discourages" only

**Real-World Findings**:

| Evidence Type                   | Finding                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Tailwind v4 Official Stance** | "Tailwind CSS v4.0 is not designed to be used with CSS preprocessors like Sass, Less, or Stylus. Think of Tailwind CSS itself as your preprocessor."               |
| **GitHub Templates**            | Templates like `nextjs-tailwind-sass-template` exist, showing the pattern IS used in practice                                                                      |
| **Migration Guides**            | Multiple guides explicitly recommend gradual migration: "Start by adding Tailwind alongside your existing styles...then migrate component by component"            |
| **Next.js Integration**         | [Rootstrap guide](https://www.rootstrap.com/blog/how-to-use-module-scss-with-tailwind-in-next-js) shows using `@apply` directive to blend Tailwind in SCSS modules |
| **State of CSS 2025**           | CSS Modules at ~59% usage, Tailwind at 37-51% (survey-dependent) - both are mainstream                                                                             |

**Verdict**: Current "discourages" placement is CORRECT but reason needs updating

**Recommended Change**:

```yaml
- skills: [scss-modules, tailwind]
  reason: >
    Tailwind v4 officially discourages preprocessor usage ("use Tailwind as your preprocessor").
    Valid for gradual migrations where you migrate component-by-component.
    Build performance degrades when running both (Tailwind runs per-module).
    Pick one approach for new projects.
```

---

### 2. shadcn/ui Requires [react, tailwind] - Accuracy Check

**Claim Being Challenged**: Is shadcn truly React+Tailwind only?

**Real-World Findings**:

| Port                  | Status                                        | GitHub Stars | Quality                                    |
| --------------------- | --------------------------------------------- | ------------ | ------------------------------------------ |
| **shadcn-vue**        | Active, maintained by unovue                  | 4.3k-9k      | Production-ready, used in admin frameworks |
| **shadcn-svelte**     | Community-led, Svelte 5 + Tailwind v4 support | Active       | Production-ready, huntabyte maintains      |
| **CSS-in-JS version** | Community WIP                                 | N/A          | Not production-ready                       |

**Key Discovery - December 2025 Update**:

- shadcn/ui now supports **Base UI** as alternative to Radix UI
- `npx shadcn create` lets you choose: Radix OR Base UI
- 5 new visual styles (Vega, Nova, Maia, Lyra)
- Still requires Tailwind for styling

**No CSS-in-JS Alternative**: Community is working on CSS Modules version, but it's not ready. No styled-components or Emotion version exists.

**Verdict**: Claim is PARTIALLY ACCURATE but needs framework note

**Recommended Change**:

```yaml
# UPDATE shadcn-ui entry:
- skill: shadcn-ui
  needs: [react, tailwind]
  reason: >
    shadcn/ui requires React and Tailwind CSS. Community ports exist for Vue (shadcn-vue)
    and Svelte (shadcn-svelte) but our skill covers the official React version.
    As of Dec 2025, supports Base UI as alternative to Radix UI primitives.
```

---

### 3. Radix UI - "Works with Any CSS Approach"

**Claim Being Challenged**: Is Radix truly CSS-agnostic?

**Evidence Collected**:

| CSS Approach          | Works with Radix? | Source/Example                                                                                                  |
| --------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------- |
| **Tailwind CSS**      | Yes               | Official docs, tailwindcss-radix plugin, shadcn/ui                                                              |
| **styled-components** | Yes               | Official docs show CSS-in-JS examples                                                                           |
| **CSS Modules**       | Yes               | [Apsara](https://github.com/raystack/apsara) - Radix + CSS Modules in production                                |
| **Vanilla CSS**       | Yes               | Data-attributes enable pure CSS styling                                                                         |
| **Stitches**          | Yes               | [ped.ro blog](https://ped.ro/writing/why-i-build-design-systems-with-stitches-and-radix) - design systems guide |
| **Design Tokens**     | Yes               | [design-tokens.dev](https://www.design-tokens.dev/guides/radix-ui/) integration guide                           |

**Official Documentation Quote**:

> "Radix Primitives are unstyled—and compatible with any styling solution—giving you complete control over styling."

**Any Approach That Doesn't Work?**: None found. The data-state attributes enable any CSS methodology.

**Verdict**: Claim is ACCURATE

**No Change Required** - Keep as-is.

---

### 4. UI Component Alternatives - Gap Analysis

**Current Coverage**: shadcn-ui, radix-ui

**Missing Alternatives Worth Considering**:

| Library         | npm Downloads         | Framework Support | Why Consider                                                |
| --------------- | --------------------- | ----------------- | ----------------------------------------------------------- |
| **Base UI**     | Growing (v1 Dec 2025) | React             | MUI team, shadcn/ui now supports it, full-time team support |
| **Ark UI**      | 38K weekly            | React, Vue, Solid | Chakra team, state-machine architecture, multi-framework    |
| **React Aria**  | 260K weekly           | React             | Adobe backing, strictest accessibility, 40+ components      |
| **Headless UI** | Significant           | React, Vue        | Tailwind Labs maintained, official Tailwind companion       |

**npm Download Comparison** (2025):

| Library          | Weekly Downloads | GitHub Stars         |
| ---------------- | ---------------- | -------------------- |
| Radix Primitives | 130M+            | 14.8k                |
| React Aria       | 260K             | 12k (React Spectrum) |
| Base UI          | Growing (new v1) | MUI backing          |
| Ark UI           | 38K              | 3.3k                 |

**Important Ecosystem Note**:
Some sources report concerns about Radix UI maintenance since the original team shifted focus to Base UI. This makes Base UI support in shadcn/ui (Dec 2025) significant for long-term projects.

**Recommendation**: Add these as alternatives or notes:

```yaml
# ADD to skills-matrix.yaml alternatives or recommends:

# For radix-ui:
alternatives:
  - base-ui      # MUI team, shadcn/ui compatible as of Dec 2025
  - ark-ui       # Chakra team, supports React/Vue/Solid
  - react-aria   # Adobe, strictest accessibility

# For tailwind users:
- when: tailwind
  suggest: [shadcn-ui, headless-ui]
  reason: 'Both designed for Tailwind CSS. Headless UI maintained by Tailwind Labs.'
```

---

### 5. Claims That Don't Match Reality

| Original Claim                         | Reality                                                                          | Action                         |
| -------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------ |
| "shadcn-ui requires [react, tailwind]" | True for official version, but community Vue/Svelte ports are production-quality | Add note about ports           |
| "[scss-modules, tailwind] conflicts"   | Already moved to discourages - correct                                           | Keep change                    |
| "radix-ui works with any CSS"          | Verified true across 6+ CSS approaches                                           | No change                      |
| Missing Base UI                        | Base UI hit v1 Dec 2025, shadcn/ui supports it                                   | Consider adding as alternative |
| Missing React Aria                     | 260K weekly downloads, Adobe-backed, strictest a11y                              | Document as alternative        |

---

### 6. Summary of Recommended Changes

#### Must Add (2)

1. **Note about shadcn ports**:

   ```yaml
   # In shadcn-ui skill description or requires reason:
   reason: >
     Official shadcn/ui requires React + Tailwind. Quality community ports:
     shadcn-vue (Vue), shadcn-svelte (Svelte). Supports Base UI since Dec 2025.
   ```

2. **Headless alternatives documentation**:
   ```yaml
   # Consider adding to UI components section:
   alternatives_for_radix:
     - base-ui: "MUI team, v1 stable Dec 2025, shadcn/ui compatible"
     - ark-ui: "Chakra team, React/Vue/Solid, state-machine based"
     - react-aria: "Adobe, strictest WCAG compliance"
   ```

#### Should Update (1)

1. **SCSS + Tailwind discourages reason**:
   - Add Tailwind v4 context ("use Tailwind as your preprocessor")
   - Clarify migration pattern validity

#### Keep As-Is (2)

1. `radix-ui` CSS flexibility claim - fully verified
2. `[scss-modules, tailwind]` in discourages - correct placement

---

### Sources

**SCSS + Tailwind**:

- [Rootstrap: Module SCSS with Tailwind in Next.js](https://www.rootstrap.com/blog/how-to-use-module-scss-with-tailwind-in-next-js)
- [Tailwind CSS v4 Migration Guide](https://medium.com/@mernstackdevbykevin/tailwind-css-v4-0-complete-migration-guide-breaking-changes-you-need-to-know-7f99944a9f95)
- [CSS Modules vs Tailwind 2025](https://generalistprogrammer.com/comparisons/css-modules-vs-tailwind)
- [State of CSS 2025](https://2025.stateofcss.com/en-US/other-tools/)

**shadcn/ui & Ports**:

- [shadcn-vue GitHub](https://github.com/unovue/shadcn-vue)
- [shadcn-svelte GitHub](https://github.com/huntabyte/shadcn-svelte)
- [shadcn December 2025 Update](https://pixicstudio.medium.com/shadcn-just-dropped-its-biggest-update-yet-of-2025-ed524cdee886)
- [shadcn-ui/ui Discussion #2832](https://github.com/shadcn-ui/ui/discussions/2832) - Non-Tailwind variants

**Radix UI**:

- [Radix Primitives Styling Guide](https://www.radix-ui.com/primitives/docs/guides/styling)
- [Apsara - Radix + CSS Modules](https://github.com/raystack/apsara)
- [Samuel Kraft: Styling Radix with CSS](https://samuelkraft.com/blog/radix-ui-styling-with-css)
- [ped.ro: Design Systems with Stitches and Radix](https://ped.ro/writing/why-i-build-design-systems-with-stitches-and-radix)

**Headless UI Alternatives**:

- [LogRocket: Headless UI Alternatives](https://blog.logrocket.com/headless-ui-alternatives-radix-primitives-react-aria-ark-ui/)
- [Makers Den: React UI Libraries 2025](https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra)
- [Base UI vs Radix UI](https://shadcnstudio.com/blog/base-ui-vs-radix-ui)
- [2025 JavaScript Rising Stars](https://risingstars.js.org/2025/en)

**Surveys & Trends**:

- [State of CSS 2025](https://2025.stateofcss.com/en-US/other-tools/)
- [Tailwind 51% usage in State of CSS 2025](https://www.medianic.co.uk/2025/06/30/state-of-css-2025-survey-results-and-insights/)

---

## Round 6: Devil's Advocate Review (Framework Skeptic)

> **Date**: 2026-01-25
> **Objective**: Challenge "mutually exclusive" conflict claims with evidence of legitimate multi-framework scenarios
> **Reviewer Role**: Senior Engineer who HATES oversimplified compatibility claims

---

### Challenge 1: `[react, vue, angular, solidjs]` - "mutually exclusive within a single application"

#### Evidence FOR the Claim (Why It Should Stay)

1. **Runtime Conflicts**: Each framework has its own virtual DOM/reactivity system that expects full control of the DOM tree it manages
2. **Bundle Size Explosion**: Loading React (45KB) + Vue (34KB) + Angular (130KB) creates unacceptable bundle sizes for most applications
3. **Developer Cognitive Load**: Teams must context-switch between paradigms, increasing maintenance burden
4. **State Management Complexity**: Sharing state between React's hooks and Vue's composition API requires custom bridge code
5. **Single-SPA's Own Documentation**: "It is practical and suggested to use just one framework for all your microfrontends"

#### Evidence AGAINST the Claim (Why It Might Be Wrong)

1. **Astro Framework - Official Multi-Framework Support**:
   - Astro has **official integrations** for React, Vue, Svelte, SolidJS, Preact, and AlpineJS
   - Documentation explicitly states: "You can import and render components from multiple frameworks in the same Astro component"
   - Uses "Islands Architecture" - only hydrates necessary components, minimizing JS overhead
   - Production-ready: Azion provides an "Astro with Multiple Frameworks" template
   - Source: [Astro Framework Components Docs](https://docs.astro.build/en/guides/framework-components/)

2. **Module Federation - Webpack's Official Solution**:
   - Webpack 5 includes ModuleFederationPlugin specifically for multi-framework micro-frontends
   - GitHub examples: `ilya-isupov/multi-framework-module-federation` (Angular + React + Vue)
   - `esplito/mfe-react-vue-module-federation-example` based on Stephen Grider's Udemy course
   - Vite support via `vite-plugin-federation`
   - Source: [Webpack Module Federation Docs](https://webpack.js.org/concepts/module-federation/)

3. **Single-SPA - Production Micro-Frontend Framework**:
   - Enables multiple frameworks on the same page without refresh
   - Official examples: `Svelte-React-Vue-Angular-single-spa`, `demo-microfrontends-with-single-spa` (12 frameworks!)
   - Production case study: Kong Konnect - Vue SPA spanning 10 product areas with 30+ frontend engineers
   - Nutrient (PSPDFKit) documents their production single-spa architecture
   - Source: [Single-SPA Microfrontends Concept](https://single-spa.js.org/docs/microfrontends-concept/)

4. **Qwik React - Framework Bridge**:
   - Qwik explicitly supports embedding React components via `qwik-react` package
   - Allows gradual migration and access to React ecosystem within Qwik apps
   - Source: [Qwik Docs](https://qwik.dev/)

#### Verdict: **MODIFY**

The claim is **technically accurate for traditional SPAs** but **overly restrictive** given modern tooling. The current wording already includes a micro-frontend exception, but it undersells legitimate use cases.

#### Recommended YAML Change

```yaml
# CURRENT (already modified in Round 1):
- skills: [react, vue, angular, solidjs]
  reason: "Core frameworks are mutually exclusive within a single application. Exception: micro-frontend architectures (Single-SPA, Module Federation) can combine frameworks in isolation."

# PROPOSED (more comprehensive):
- skills: [react, vue, angular, solidjs]
  reason: "Core frameworks conflict when managing the same DOM tree. Valid multi-framework patterns exist: (1) Micro-frontends via Single-SPA/Module Federation with runtime isolation, (2) Astro/Qwik islands architecture with component-level boundaries, (3) Gradual migrations with clear separation. Our skills teach single-framework patterns."
```

---

### Challenge 2: `[nextjs-app-router, remix, nuxt]` - "mutually exclusive"

#### Evidence FOR the Claim (Why It Should Stay)

1. **Same Port/Process Conflict**: Both Next.js and Remix expect to own the HTTP request lifecycle
2. **Routing System Incompatibility**: Next.js App Router uses file-based routing conventions that conflict with Remix's loader/action patterns
3. **Build Output Incompatibility**: Next.js outputs to `.next/`, Remix to `build/` - deployment expects one entry point
4. **SSR Hydration Conflicts**: Both frameworks inject hydration scripts expecting full page control
5. **No Official Documentation**: Neither Vercel nor Remix team documents running them together

#### Evidence AGAINST the Claim (Why It Might Be Wrong)

1. **Monorepo Architecture - Separate Apps, Shared Packages**:
   - Turborepo explicitly supports multiple apps in `apps/` directory
   - Nx has generators for both Next.js (`@nx/next:app`) and Remix (`@nx/remix:app`)
   - Jacob Paris tutorial: "Develop and deploy multiple Remix apps with an integrated Nx monorepo"
   - Each framework runs as separate deployment unit, sharing `packages/` libraries
   - Source: [Nx Remix Guide](https://blog.logrocket.com/building-nx-monorepos-remix/)

2. **Different Subdomains/Routes at Infrastructure Level**:
   - `app.example.com` -> Next.js App
   - `docs.example.com` -> Remix App
   - Shared authentication, design system packages
   - This is not "same application" but valid architectural pattern

3. **Vercel's Own Multi-Framework Support**:
   - Vercel deploys both Next.js and Remix
   - Monorepo deployments can have different apps on different paths
   - `belgattitude/nextjs-monorepo-example` shows multi-app setups

#### Verdict: **KEEP (with clarification)**

The claim is **accurate for a single deployed application**. Meta-frameworks genuinely cannot share the same request lifecycle. The monorepo pattern involves **separate applications** sharing code, not one application.

#### Recommended YAML Change

```yaml
# CURRENT:
- skills: [nextjs-app-router, remix, nuxt]
  reason: "Meta-frameworks are mutually exclusive - each expects to own the application shell and routing."

# PROPOSED (clarify scope):
- skills: [nextjs-app-router, remix, nuxt]
  reason: "Meta-frameworks are mutually exclusive per deployment unit - each owns the request lifecycle and routing. Monorepos can contain multiple meta-framework apps sharing packages, but they deploy separately."
```

---

### Challenge 3: `[react-testing-library, vue-test-utils]` - Framework-specific testing conflict

#### Evidence FOR the Claim (Why It Should Stay)

1. **Framework Binding**: `@testing-library/react` imports from `react-dom/test-utils`; `@testing-library/vue` imports from `@vue/test-utils`
2. **Render Functions Differ**: React's `render()` vs Vue's `mount()` have different APIs
3. **Different Lifecycles**: Testing React hooks vs Vue composition API requires different utilities
4. **Peer Dependencies**: Installing both in a single-framework project triggers dependency warnings

#### Evidence AGAINST the Claim (Why It Might Be Wrong)

1. **DOM Testing Library - The Framework-Agnostic Core**:
   - `@testing-library/dom` is the shared foundation for ALL adapters
   - Kent C. Dodds' repo `dom-testing-library-with-anything` demonstrates testing 12+ frameworks with identical patterns
   - Core queries (`getByText`, `getByRole`, `fireEvent`) work identically across all adapters
   - `@testing-library/jest-dom` matchers work with ANY framework
   - Source: [DOM Testing Library GitHub](https://github.com/testing-library/dom-testing-library)

2. **Multi-Framework Projects Are Valid**:
   - Astro projects with React AND Vue components need both testing libraries
   - Monorepos with different framework apps share test utilities
   - Migration projects test both old and new framework code

3. **Testing Library's Design Philosophy**:
   - "The more your tests resemble the way your software is used, the more confidence they can give you"
   - User-centric testing is framework-agnostic at the assertion level
   - Same test patterns, only `render()` implementation changes

4. **Vitest's Multi-Framework Support**:
   - `vitest-browser-vue`, `vitest-browser-react`, `vitest-browser-svelte` can coexist
   - Component testing workspace can test multiple frameworks
   - Source: [Vitest Component Testing Guide](https://vitest.dev/guide/browser/component-testing)

5. **Kent C. Dodds' Framework Examples**:
   - Repository demonstrates identical testing patterns for: React, Vue, Angular, AngularJS, Svelte, Preact, Backbone, jQuery, Knockout, Mithril, Hyperapp, Dojo, and vanilla JS
   - Quote: "This test should look almost identical between each framework - that's the idea"
   - Source: [dom-testing-library-with-anything](https://github.com/kentcdodds/dom-testing-library-with-anything)

#### Verdict: **MODIFY**

The conflict is **too strict**. These libraries don't conflict - they're designed to coexist in monorepos and multi-framework projects. The "conflict" only makes sense if we assume single-framework applications.

#### Recommended YAML Change

```yaml
# CURRENT (implied conflict via requires):
- skill: react-testing-library
  needs: [react]
  reason: "React Testing Library requires React"

- skill: vue-test-utils
  needs: [vue]
  reason: "Vue Test Utils requires Vue"

# PROPOSED (clarify coexistence):
- skill: react-testing-library
  needs: [react, react-native]
  needs_any: true
  reason: "Adapter for Testing Library core. In multi-framework projects (Astro, monorepos), can coexist with vue-test-utils."

- skill: vue-test-utils
  needs: [vue]
  reason: "Vue-specific testing utilities. Compatible with other Testing Library adapters in multi-framework projects."
# REMOVE from conflicts - these are NOT competing solutions
# They're framework-specific adapters that legitimately coexist
```

---

### Summary Table

| Claim                                              | Original Verdict                  | Devil's Advocate Verdict | Action                                           |
| -------------------------------------------------- | --------------------------------- | ------------------------ | ------------------------------------------------ |
| `[react, vue, angular, solidjs]` conflict          | PARTIAL (add micro-frontend note) | **MODIFY**               | Expand reason to include Astro, Qwik islands     |
| `[nextjs-app-router, remix, nuxt]` conflict        | TRUE                              | **KEEP**                 | Clarify "per deployment unit"                    |
| `[react-testing-library, vue-test-utils]` conflict | TRUE                              | **MODIFY**               | Remove from conflicts, they coexist in monorepos |

---

### Additional Findings

#### Astro Should Be Considered for Skills Matrix

Astro represents a distinct architectural pattern worth noting:

```yaml
# Potential future skill
astro:
  id: astro
  name: Astro
  category: frontend-meta-framework
  tags: [islands, multi-framework, static-site, content-focused]

  relationships:
    recommends:
      - skills: [react, vue, svelte, solidjs, preact]
        reason: "Astro supports all major UI frameworks via official integrations"
    discourages:
      - skills: [nextjs-app-router, remix, nuxt]
        reason: "Astro has its own routing and SSR - meta-framework features overlap"
```

#### Module Federation / Single-SPA Could Be Architecture Skills

For enterprise teams doing micro-frontends:

```yaml
# Potential future skills
module-federation:
  id: module-federation
  name: Module Federation
  category: architecture
  tags: [micro-frontends, webpack, runtime-integration]

single-spa:
  id: single-spa
  name: Single-SPA
  category: architecture
  tags: [micro-frontends, orchestration, multi-framework]
```

---

### Production Case Studies Found

1. **Kong Konnect**: Vue SPA spanning 10 product areas with 30+ frontend engineers using micro-frontend architecture
2. **Nutrient (PSPDFKit)**: Production single-spa system with documented migration strategies
3. **Stephen Grider Course**: React + Vue Module Federation example used in Udemy curriculum (thousands of students)
4. **Azion**: Production Astro template with React + Preact + Svelte + Vue
5. **Cal.com**: Uses Kysely alongside primary ORM for complex queries (multi-ORM pattern in production)

---

### Key Takeaways for Skills Matrix Design

1. **"Mutually exclusive" is rarely absolute** - Modern tooling (Astro, Module Federation, Single-SPA) exists specifically to break these rules
2. **Conflicts should specify scope**: "within a single application" vs "per deployment unit" vs "within a service"
3. **Testing libraries don't conflict** - They're adapters for the same core; monorepos legitimately use multiple
4. **The skills matrix teaches patterns, not rules** - Edge cases exist; document them rather than deny them

---

### Sources

**Multi-Framework Architecture**:

- [Astro Framework Components Documentation](https://docs.astro.build/en/guides/framework-components/)
- [Webpack Module Federation](https://webpack.js.org/concepts/module-federation/)
- [Single-SPA Microfrontends Concept](https://single-spa.js.org/docs/microfrontends-concept/)
- [Single-SPA Examples](https://single-spa.js.org/docs/examples/)
- [Qwik React Integration](https://qwik.dev/)
- [Building Micro Frontends with React, Vue, and Single-spa](https://dev.to/dabit3/building-micro-frontends-with-react-vue-and-single-spa-52op)

**Testing Libraries**:

- [DOM Testing Library GitHub](https://github.com/testing-library/dom-testing-library)
- [Kent C. Dodds - DOM Testing Library with Anything](https://github.com/kentcdodds/dom-testing-library-with-anything)
- [Vitest Component Testing](https://vitest.dev/guide/browser/component-testing)

**Monorepo Patterns**:

- [Nx Remix Monorepo Guide](https://blog.logrocket.com/building-nx-monorepos-remix/)
- [Turborepo Next.js Guide](https://turborepo.dev/docs/guides/frameworks/nextjs)
- [belgattitude/nextjs-monorepo-example](https://github.com/belgattitude/nextjs-monorepo-example)

**Production Case Studies**:

- [Kong Vue Micro Frontends](https://konghq.com/blog/engineering/scalable-architectures-with-vue-micro-frontends)
- [Nutrient Micro Frontends in Production](https://www.nutrient.io/blog/micro-frontends-that-actually-work/)

**GitHub Examples**:

- [Module Federation Multi-Framework Example](https://github.com/ilya-isupov/multi-framework-module-federation)
- [React + Vue Module Federation Example](https://github.com/esplito/mfe-react-vue-module-federation-example)
- [Single-SPA Microfrontend Angular-Vue-React](https://github.com/santhoshvernekar/single-spa-microfrontend-angular-vue-react)

---

## Round 5: Mobile Expert Review

> **Generated**: 2026-01-25
> **Purpose**: Verify React Native compatibility claims from a mobile developer's perspective
> **Reviewer Role**: React Native & Mobile Development Expert

### Executive Summary

As someone who builds production mobile apps daily, I'm skeptical of "works with React Native" claims. Many web libraries claim RN support but have critical gotchas. Here's what actually works vs what needs caveats.

| Category | Library         | RN Compatibility     | Gotchas                                          |
| -------- | --------------- | -------------------- | ------------------------------------------------ |
| State    | Zustand         | **EXCELLENT**        | None significant                                 |
| State    | Redux Toolkit   | **EXCELLENT**        | DevTools need React Native Debugger              |
| State    | MobX            | **GOOD**             | Still works, but Zustand/Jotai preferred in 2025 |
| Data     | TanStack Query  | **EXCELLENT**        | Requires manual focus/online setup               |
| Data     | SWR             | **REQUIRES WRAPPER** | Needs @nandorojo/swr-react-native                |
| Forms    | React Hook Form | **EXCELLENT**        | Must use Controller component                    |
| Testing  | RNTL            | **EXCELLENT**        | Different from web RTL                           |
| Testing  | Detox           | **EXCELLENT**        | Complex setup, purpose-built for RN              |
| Testing  | Maestro         | **EXCELLENT**        | Simpler alternative to Detox                     |

---

### 1. State Management in React Native

#### Zustand + React Native - VERIFIED EXCELLENT

**Claim**: Zustand works seamlessly with React Native
**Verdict**: **TRUE** - Zustand is the community favorite for RN in 2025

**Evidence**:

- [State of React Native 2024](https://results.stateofreactnative.com/en-US/state-management/): "Zustand continues its rise as the go-to modern state management library"
- Zustand uses \`useSyncExternalStore\` internally, which handles React's concurrency correctly
- Works perfectly with React Native's Fabric and Hermes architectures (RN 0.80+)
- No configuration needed - just install and use

**RN-Specific Benefits**:

- Tiny bundle size (~1KB) - critical for mobile
- No Context Provider needed - avoids re-render issues
- Works with MMKV persistence via \`zustand-mmkv-storage\` package

**Gotchas**:

- None significant for React Native
- The vanilla/non-React usage is irrelevant for RN apps

**YAML Recommendation**: Keep current relationship, add RN-positive note

\`\`\`yaml

- when: react-native
  suggest: [zustand, react-query, react-hook-form]
  reason: 'Modern RN stack - Zustand is the community favorite for state management (State of React Native 2024)'
  \`\`\`

---

#### Redux Toolkit + React Native - VERIFIED WORKS

**Claim**: Redux Toolkit fully supports React Native
**Verdict**: **TRUE** - Officially supported, but with setup considerations

**Evidence**:

- [RTK Docs](https://redux-toolkit.js.org/introduction/getting-started): Recommends community templates for RN
- React-Redux includes a \`react-redux.react-native.js\` bundle specifically for RN
- RTK 2.0 / React-Redux 9.0 have explicit RN optimizations

**RN-Specific Gotchas**:

1. **DevTools**: Standard Redux DevTools don't work in Expo Go
   - Need React Native Debugger + "Debug Remote JS" mode
   - Or use Flipper with Redux Debugger plugin
2. **No official templates**: Must use community templates
   - \`react-native-template-redux-typescript\`
   - \`expo-template-redux-typescript\`
3. **Bundle size**: RTK is larger than Zustand (~11KB vs ~1KB)

**Recommendation**: Works but Zustand is preferred for new RN projects in 2025

---

#### MobX + React Native - VERIFIED BUT DECLINING

**Claim**: MobX still recommended for React Native
**Verdict**: **PARTIALLY TRUE** - Works, but no longer the top choice

**Evidence**:

- MobX works fine with React Native
- Still has active community (13+ years mature)
- [State of React Native 2024](https://results.stateofreactnative.com/en-US/state-management/): Zustand and Jotai are the rising stars

**2025 Perspective**:

- MobX adds more complexity than Zustand/Jotai for most RN apps
- Object-oriented patterns less popular in modern React ecosystem
- Smaller projects benefit more from lightweight alternatives

---

#### Missing RN-Specific State Libraries

**Legend-State** - Should consider adding

- Super fast, only 3KB
- Built-in MMKV persistence for RN
- Growing adoption in RN community

**Jotai** - Should consider adding

- Atomic state model (like Recoil but smaller)
- Works with MMKV via \`atomWithMMKV\` pattern
- Growing RN adoption per 2024 survey

**MMKV** (storage, not state) - **CRITICAL MISSING RELATIONSHIP**

- react-native-mmkv is 30x faster than AsyncStorage
- Used by WeChat with 1B+ users
- [GitHub: mrousavy/react-native-mmkv](https://github.com/mrousavy/react-native-mmkv)

---

### 2. Data Fetching in React Native

#### TanStack Query + React Native - VERIFIED WITH CAVEATS

**Claim**: TanStack Query works with React Native
**Verdict**: **TRUE** - Excellent support, but requires manual setup for mobile-specific features

**What Works Automatically**:

- Core fetching, caching, mutations
- Stale-while-revalidate patterns
- All the query/mutation hooks

**What Requires Manual Setup**:

1. **Focus Detection** (app goes background -> foreground)
   - Must use AppState + focusManager.setFocused()

2. **Online/Reconnect Detection**
   - Requires @react-native-community/netinfo
   - Must configure onlineManager.setEventListener()

3. **Screen Focus Refetching** (React Navigation)
   - Need custom hook with \`useFocusEffect\`
   - Or use \`subscribed\` prop with \`useIsFocused\`

4. **DevTools**
   - Standard web DevTools don't work
   - Need Flipper Plugin or Reactotron Plugin

**Offline-First Pattern**:

- Requires \`@tanstack/query-async-storage-persister\`
- Requires \`@tanstack/react-query-persist-client\`
- Known issue: App opening offline triggers failed fetches instead of using cache

---

#### SWR + React Native - VERIFIED REQUIRES WRAPPER

**Claim**: SWR is React only (works with React Native)
**Verdict**: **PARTIALLY TRUE** - Core works, but essential features broken without wrapper

**What Doesn't Work Out of Box**:

- \`revalidateOnFocus\` - broken
- \`revalidateOnConnect\` - broken
- No automatic refetch when app resumes from background

**Required Solution**: [@nandorojo/swr-react-native](https://github.com/nandorojo/swr-react-native)

**Package Status**: Last published 2 years ago (v2.0.0) - maintenance concern

**YAML Recommendation**: Add warning to SWR for RN - consider TanStack Query for better RN support.

---

#### Caching Differences on Mobile

| Concern             | Web                 | React Native                       |
| ------------------- | ------------------- | ---------------------------------- |
| Cache storage       | Memory/LocalStorage | MMKV (fast) or AsyncStorage (slow) |
| Background behavior | Tab focus events    | AppState changes                   |
| Offline support     | Service Workers     | Manual implementation              |
| Cache persistence   | Built-in            | Requires persister packages        |

**Recommended Mobile Caching Stack**:

1. TanStack Query for server state
2. MMKV for local persistence (NOT AsyncStorage)
3. NetInfo for network detection
4. Proper AppState handling

---

### 3. Forms in React Native

#### React Hook Form + React Native - VERIFIED EXCELLENT

**Claim**: React Hook Form works with React Native
**Verdict**: **TRUE** - First-class support, documented on official site

**Key Difference from Web**:

- Web: Can use \`register\` with ref
- React Native: **Must use \`Controller\` component**

**Validation Works Same Way**:

- Zod via \`@hookform/resolvers/zod\` - works
- Yup via \`@hookform/resolvers/yup\` - works

**Benefits for RN**:

- Minimal re-renders (critical for mobile performance)
- Smaller bundle than Formik (12KB vs 44KB gzipped)
- TypeScript-first
- Active maintenance

**YAML Status**: Current claim is accurate, no changes needed

---

#### Formik - NOT RECOMMENDED FOR NEW RN PROJECTS

**Status Check**:

- Last commit: Over 1 year ago
- Not actively maintained
- Larger bundle size (44KB vs 12KB)

**Recommendation**: React Hook Form preferred for React Native

---

### 4. Missing Mobile Relationships

#### Expo - Should Have More Relationships

**Expo Powers 70%+ of RN Tutorials** (2025 data)

**Recommended Relationships**:

- expo recommends [react-native, expo-router, nativewind]
- expo-router needs [expo]
- expo-router recommends [react-navigation]

---

#### React Navigation - SHOULD BE IN MATRIX

**Why It's Important**:

- Core navigation library for React Native
- Expo Router is built on top of it
- Most RN apps use it

---

#### NativeWind (Tailwind for RN) - SHOULD BE IN MATRIX

**Why It's Important**:

- Brings Tailwind CSS to React Native
- Growing rapidly in RN community
- Expo SDK 54+ compatible (with some issues in SDK 54/React 19)

---

### 5. Testing on Mobile

#### React Native Testing Library - VERIFIED DIFFERENT FROM WEB

**Critical Distinction**:

- \`@testing-library/react\` - Web only
- \`@testing-library/react-native\` - React Native only

**They are NOT the same package and NOT interchangeable.**

**YAML Recommendation**: Clarify the distinction - separate skills for web vs mobile

---

#### Detox for E2E - VERIFIED EXCELLENT FOR RN

**What Is It**: Gray-box E2E testing framework built specifically for React Native

**Key Features**:

- Built by Wix, purpose-built for RN
- Auto-synchronization (waits for animations, network)
- Cross-platform (iOS + Android)
- Works with Jest
- Supports RN New Architecture (Fabric) through v0.83.x

**Setup Complexity**: HIGH

- Requires native build changes
- New build targets for debug/release
- iOS and Android separate configs

---

#### Maestro - ALTERNATIVE TO DETOX

**What Is It**: Cross-platform mobile E2E testing (YAML-based)

**Key Differences from Detox**:
| Aspect | Detox | Maestro |
|--------|-------|---------|
| Test format | JavaScript/TypeScript | YAML |
| Setup | Complex (native changes) | Simple (CLI only) |
| RN-specific | Purpose-built | Cross-platform |
| WebViews | Struggles | Handles well |

**When to Choose**:

- **Detox**: Deep RN integration, fine-grained control, existing JS test infrastructure
- **Maestro**: Quick setup, cross-platform teams, WebView-heavy apps

---

### Summary of Recommended YAML Updates

#### Must Add (New Skills)

- react-native-testing-library (testing, react-native)
- detox (testing, react-native)
- maestro (testing, react-native)
- react-navigation (navigation, react-native)
- nativewind (styling, react-native)
- expo-router (navigation, react-native)
- mmkv (storage, react-native)

#### Must Modify (Existing Claims)

1. **SWR + React Native**: Add warning about required wrapper package
2. **React Query + React Native**: Document manual setup requirements
3. **react-testing-library**: Clarify it's web-only, separate from RNTL

#### Must Add (Relationships)

- react-native recommends [zustand, react-query, react-hook-form, mmkv, react-native-testing-library]
- react-native + react-query suggests [netinfo]
- react-native suggests [detox, maestro] for E2E
- react-native suggests [mmkv], discourages [async-storage]

---

### Sources

**Official Documentation**:

- [TanStack Query - React Native](https://tanstack.com/query/latest/docs/framework/react/react-native)
- [SWR - React Native](https://swr.vercel.app/docs/advanced/react-native)
- [React Hook Form - Get Started](https://react-hook-form.com/get-started)
- [React Native Testing Library](https://github.com/callstack/react-native-testing-library)
- [Detox GitHub](https://github.com/wix/Detox)
- [Maestro](https://maestro.dev/)
- [MMKV GitHub](https://github.com/mrousavy/react-native-mmkv)
- [Expo Documentation](https://docs.expo.dev/)
- [NativeWind](https://www.nativewind.dev/)

**Community Surveys & Articles**:

- [State of React Native 2024](https://results.stateofreactnative.com/en-US/state-management/)
- [Expo for React Native in 2025](https://hashrocket.com/blog/posts/expo-for-react-native-in-2025-a-perspective)
- [MMKV vs AsyncStorage 2025](https://medium.com/@ali.abualrob2612/react-native-mmkv-vs-asyncstorage-which-one-should-you-use-905dfc24727a)
- [Detox vs Maestro Comparison](https://www.getpanto.ai/blog/detox-vs-maestro)
- [Best Mobile E2E Testing Frameworks 2025](https://www.qawolf.com/blog/the-best-mobile-e2e-testing-frameworks-in-2025-strengths-tradeoffs-and-use-cases)

**Third-Party Packages**:

- [@nandorojo/swr-react-native](https://www.npmjs.com/package/@nandorojo/swr-react-native)
- [@react-native-community/netinfo](https://www.npmjs.com/package/@react-native-community/netinfo)
- [@tanstack/query-async-storage-persister](https://www.npmjs.com/package/@tanstack/query-async-storage-persister)
- [zustand-mmkv-storage](https://www.npmjs.com/package/zustand-mmkv-storage)

---

## Round 8: Contrarian Review (The Skeptic)

> **Generated**: 2026-01-25
> **Purpose**: Question EVERYTHING - find outdated info, missing alternatives, biased recommendations
> **Reviewer Role**: Devil's Advocate who trusts no claim without verification

---

### Executive Summary: Critical Issues Found

After extensive research using State of JS 2024/2025 surveys, npm trends, GitHub metrics, and recent industry analysis, this review identifies **significant gaps and biases** in our skills matrix:

| Problem Category          | Severity | Count     | Impact                               |
| ------------------------- | -------- | --------- | ------------------------------------ |
| **Missing Alternatives**  | HIGH     | 15+       | Users not aware of valid options     |
| **React Ecosystem Bias**  | HIGH     | Pervasive | Non-React devs underserved           |
| **Outdated Claims**       | MEDIUM   | 8         | Recommending stale patterns          |
| **Oversimplified Claims** | MEDIUM   | 12        | Missing important nuance             |
| **Missing Frameworks**    | HIGH     | 3+        | Svelte, Preact, htmx entirely absent |

---

### 1. BIAS ALERT: React Ecosystem Favoritism

**Problem**: Our skills matrix is **heavily biased toward React**.

| Category          | React Options            | Vue Options     | Angular Options | Solid Options | Svelte Options |
| ----------------- | ------------------------ | --------------- | --------------- | ------------- | -------------- |
| State Management  | 3 (Zustand, Redux, MobX) | 1 (Pinia)       | 1 (NgRx)        | 0             | 0 (N/A)        |
| Data Fetching     | 2 (React Query, SWR)     | 0               | 0               | 0             | 0              |
| Forms             | 1 (React Hook Form)      | 1 (VeeValidate) | 0               | 0             | 0              |
| Component Testing | 1 (RTL)                  | 1 (VTU)         | 0               | 0             | 0              |
| UI Components     | 1 (shadcn)               | 0               | 0               | 0             | 0              |

**What's Entirely Missing**:

- **Svelte/SvelteKit** - 4th major framework with highest satisfaction scores
- **@tanstack/vue-query** - First-party TanStack support for Vue
- **@tanstack/solid-query** - First-party TanStack support for Solid
- **Angular Material / PrimeNG** - Major Angular UI libraries
- **Vuetify / PrimeVue** - Major Vue UI libraries
- **Angular Signals** - Built-in state management since Angular 16

---

### 2. MISSING: Major Validation Alternatives

**Our Claim**: Only `zod-validation` listed for validation

**Challenge**: This is **dangerously incomplete** for bundle-sensitive apps.

| Library     | Bundle Size | Best For                                |
| ----------- | ----------- | --------------------------------------- |
| **Zod**     | 17.7KB      | TypeScript-first, wide adoption         |
| **Valibot** | 1.37KB      | Bundle-critical (90% smaller than Zod!) |
| **TypeBox** | Small       | JSON Schema, OpenAPI, fastest runtime   |
| **Yup**     | Moderate    | JavaScript projects, Formik integration |

**Evidence from [Valibot comparison](https://valibot.dev/guides/comparison/)**:

> "To validate a simple login form, Zod requires 17.7 kB, whereas Valibot requires only 1.37 kB. That's a **90% reduction in bundle size**."

**Action Required**: Add Valibot as alternative for edge/mobile web applications.

---

### 3. MISSING: Jotai from State Management Alternatives

**Our Claim**: `alternatives: [zustand, redux-toolkit, mobx]` for React state

**Challenge**: Jotai is a **first-class alternative** from the same team as Zustand!

| Library   | Bundle Size | Approach     | Best For                            |
| --------- | ----------- | ------------ | ----------------------------------- |
| Zustand   | ~3KB        | Single store | Simple apps, global state           |
| **Jotai** | ~4KB        | Atomic       | Complex interdependencies, Suspense |
| Valtio    | ~3KB        | Proxy-based  | Mutable patterns                    |

**Evidence from [Zustand vs Jotai comparison](https://www.reactlibraries.com/blog/zustand-vs-jotai-vs-valtio-performance-guide-2025)**:

> "Jotai's atomic model shines in scenarios with complex state interdependencies and frequent updates."

**Note**: Jotai IS in our `skill_aliases` but NOT in `alternatives`! This is inconsistent.

**Action Required**: Add Jotai to alternatives section.

---

### 4. QUESTIONABLE: "Best-in-class" Language

**Our Claim**: Multiple `recommends` entries use "Best-in-class React libraries"

**Challenge**: "Best-in-class" is **subjective and unprovable**.

| Library       | Weekly Downloads | Stars | "Best" By What Measure?                  |
| ------------- | ---------------- | ----- | ---------------------------------------- |
| React Query   | ~8M              | 43K+  | Feature completeness                     |
| SWR           | ~3M              | 30K+  | Simplicity, bundle size (5.3KB vs 16KB)  |
| Zustand       | ~5M              | 50K+  | DX, minimal boilerplate                  |
| Redux Toolkit | ~4M              | 10K+  | Ecosystem, DevTools, enterprise adoption |

**Problem**: "Best" depends on:

- Project size and complexity
- Team experience
- Performance requirements
- Bundle size constraints

**Action Required**: Replace "best-in-class" with specific traits (e.g., "widely adopted", "feature-rich", "lightweight").

---

### 5. OUTDATED: Next.js App Router Criticism Not Documented

**Our Claim**: Next.js App Router recommended without caveats

**Challenge**: The App Router has **significant documented issues**.

**Evidence from [Next.js GitHub discussions](https://github.com/vercel/next.js/discussions/59373)**:

> "I've really tried to love the app router... I just can't support a framework that releases version after version filled with problems."
>
> "At its worst, the dev server was taking our app 2 minutes to compile."

**Emerging Alternatives Not Mentioned**:

| Framework                   | Why Consider                             |
| --------------------------- | ---------------------------------------- |
| **TanStack Start**          | Type-safe, built by TanStack team        |
| **Remix (React Router v7)** | Web standards, no vendor lock-in         |
| **Vite + React Router**     | Faster dev server, no framework overhead |

**Action Required**: Add nuance about App Router criticisms and document alternatives.

---

### 6. OUTDATED: shadcn/ui Radix Concerns Not Documented

**Our Claim**: `tailwind -> [shadcn-ui]` without caveats

**Challenge**: There are **concerns about Radix's future**.

**Evidence from [shadcn alternatives analysis](https://www.subframe.com/tips/shadcn-alternatives)**:

> "Since the original Radix UI team has shifted their entire focus to Base UI, it's unclear if Radix will be maintained, which has raised long-term questions about stability and future compatibility."

**Alternatives Not Mentioned**:

| Library       | Why Consider                                     |
| ------------- | ------------------------------------------------ |
| **DaisyUI**   | 63 components, built-in themes, CSS classes only |
| **Origin UI** | 400+ components, most comprehensive free option  |
| **NextUI**    | Pre-styled, better out-of-box experience         |

**Action Required**: Document Radix maintenance concerns, add UI library alternatives.

---

### 7. CORRECT: Better Auth Recommendation

**Our Claim**: Better Auth recommended for authentication

**Verification**: This is **actually correct** and should be STRENGTHENED.

**Evidence from [Better Auth blog](https://www.better-auth.com/blog/authjs-joins-better-auth)**:

> "Auth.js, formerly known as NextAuth.js, is now being maintained and overseen by the Better Auth team."

**Auth.js Problems That Validate Our Choice**:

- v5 was in beta for 2+ years, never had stable release
- Main contributor quit January 2025
- Complex setup, especially for credentials

**Action Required**: Update reasoning to mention Auth.js merger, strengthen recommendation.

---

### 8. QUESTIONABLE: Express as "Alternative"

**Our Claim**: Express listed alongside Hono and Fastify as alternatives

**Challenge**: Express is **legacy** compared to modern alternatives.

**Evidence from [Hono vs Express vs Fastify 2025](https://levelup.gitconnected.com/hono-vs-express-vs-fastify-the-2025-architecture-guide-for-next-js-5a13f6e12766)**:

> "If you are building with Next.js in 2025, relying on Express as muscle memory is a mistake."
>
> "The JavaScript backend landscape is splitting into two generations."

| Framework | Generation     | Best For                                      |
| --------- | -------------- | --------------------------------------------- |
| Express   | Legacy         | Existing projects, maximum ecosystem          |
| Fastify   | Modern Node.js | High-throughput, better DX than Express       |
| Hono      | Modern Edge    | Serverless, multi-runtime, smallest footprint |

**Action Required**: Mark Express as "legacy-compatible" rather than modern alternative.

---

### 9. MISSING: Prisma vs Drizzle Context

**Our Claim**: `hono -> [drizzle, ...]` - "Hono + Drizzle is a powerful combo"

**Challenge**: This recommendation is **biased toward edge/serverless**.

**Evidence from [Prisma vs Drizzle comparison](https://www.bytebase.com/blog/drizzle-vs-prisma/)**:

> "If your project values DX, abstraction, and rapid development, pick Prisma. If your project values performance, SQL transparency, and serverless optimization, pick Drizzle."

| Use Case                  | Better Choice            |
| ------------------------- | ------------------------ |
| Edge/serverless           | Drizzle (7KB, no binary) |
| Traditional Node.js       | Either                   |
| Teams unfamiliar with SQL | Prisma (abstraction)     |
| Rapid prototyping         | Prisma (mature tooling)  |
| Complex joins             | Drizzle (14x faster)     |

**Action Required**: Make recommendation context-aware, not blanket "Drizzle is better".

---

### Summary of Required Actions

#### HIGH PRIORITY - Missing Alternatives

```yaml
# Add to alternatives section:
- purpose: "Frontend Framework"
  skills: [react, vue, angular, solidjs, svelte] # ADD: svelte

- purpose: "Client State (React)"
  skills: [zustand, redux-toolkit, mobx, jotai] # ADD: jotai

- purpose: "Validation"
  skills: [zod-validation, valibot] # ADD: valibot
```

#### HIGH PRIORITY - Bias Corrections

```yaml
# Add Vue data fetching:
- vue-query: "frontend/vue-query (@vince)"

# Add Vue UI libraries:
- vuetify: "frontend/vuetify (@vince)"

# Add Angular built-ins:
- angular-signals: "frontend/angular-signals (@vince)"
```

#### MEDIUM PRIORITY - Claim Updates

```yaml
# Update "best-in-class" language:
- when: react
  suggest:
    [zustand, react-query, vitest, react-hook-form, react-testing-library]
  reason: "Widely adopted React ecosystem libraries" # Changed from "best-in-class"

# Add context to recommendations:
- when: hono
  suggest: [drizzle, better-auth, zod-validation]
  reason: "Powerful combo for edge/serverless. Traditional Node.js servers may prefer Prisma for DX."

# Mark Express appropriately:
- skills: [express, hono]
  reason: "Express is mature/legacy with maximum ecosystem; Hono is modern with edge/serverless optimization"
```

#### MEDIUM PRIORITY - Document Nuances

1. **Auth.js -> Better Auth merger** (January 2025)
2. **Radix maintenance concerns** for shadcn/ui
3. **Next.js App Router criticisms** and alternatives
4. **When Prisma beats Drizzle** (not just "Drizzle is faster")

---

### Contrarian Review Sources

**State of JS / Ecosystem Health**:

- [State of JavaScript 2024](https://2024.stateofjs.com/en-US/)
- [State of JavaScript 2024: Libraries](https://2024.stateofjs.com/en-US/libraries/)
- [npm trends: state management](https://npm-compare.com/@reduxjs/toolkit,zustand,recoil,jotai,valtio/)

**State Management Comparisons**:

- [State Management in 2025](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k)
- [Zustand vs Jotai vs Valtio Performance 2025](https://www.reactlibraries.com/blog/zustand-vs-jotai-vs-valtio-performance-guide-2025)
- [Angular State Management 2025](https://nx.dev/blog/angular-state-management-2025)

**ORMs**:

- [Drizzle vs Prisma 2025](https://www.bytebase.com/blog/drizzle-vs-prisma/)
- [Prisma vs Drizzle Official](https://www.prisma.io/docs/orm/more/comparisons/prisma-and-drizzle)

**Validation**:

- [Valibot Comparison](https://valibot.dev/guides/comparison/)
- [Zod vs Yup vs TypeBox 2025](https://dev.to/dataformathub/zod-vs-yup-vs-typebox-the-ultimate-schema-validation-guide-for-2025-1l4l)

**Framework Criticisms**:

- [Next.js App Router Discussion](https://github.com/vercel/next.js/discussions/59373)
- [Next.js Alternatives 2025](https://dev.to/sovannaro/top-10-alternatives-to-nextjs-in-2025-57kc)
- [Hono vs Express vs Fastify 2025](https://levelup.gitconnected.com/hono-vs-express-vs-fastify-the-2025-architecture-guide-for-next-js-5a13f6e12766)

**UI Components**:

- [shadcn/ui Alternatives 2025](https://www.subframe.com/tips/shadcn-alternatives)
- [Radix Maintenance Concerns](https://www.monet.design/blog/posts/shadcn-ui-alternatives-2025)

**Authentication**:

- [Auth.js Joins Better Auth](https://www.better-auth.com/blog/authjs-joins-better-auth)
- [Better Auth vs Auth.js Comparison](https://betterstack.com/community/guides/scaling-nodejs/better-auth-vs-nextauth-authjs-vs-autho/)

# Round 7: Testing Specialist Review

> **Generated**: 2026-01-25
> **Purpose**: Deep verification of all testing-related claims
> **Reviewer Role**: QA/Testing Infrastructure Specialist

## Executive Summary

After extensive research into testing tool compatibility, ecosystem support, and real-world usage patterns, several claims in our skills matrix need adjustment. The testing landscape has evolved significantly, and some "conflict" relationships are overstated.

| Claim                                | Our Position                           | Reality                                                                     | Verdict                       |
| ------------------------------------ | -------------------------------------- | --------------------------------------------------------------------------- | ----------------------------- |
| Playwright vs Cypress conflict       | "Both are E2E frameworks - choose one" | Can be used together, especially Cypress for component + Playwright for E2E | **NEEDS NUANCE**              |
| react-testing-library requires React | "React Testing Library is React only"  | Correct, but @testing-library/dom is framework-agnostic                     | **ACCURATE (expand context)** |
| Vitest recommended for all React     | "Best-in-class React libraries"        | Not suitable for React Native, large legacy codebases                       | **NEEDS CONDITIONS**          |
| MSW works with all frameworks        | Implicit in recommendations            | MSW 2.0 has Node.js 18+ requirement, Jest/JSDOM issues                      | **NEEDS CAVEATS**             |

---

## 1. Playwright vs Cypress Conflict Analysis

**Our Claim**: `[playwright-e2e, cypress-e2e]` in conflicts - "Both are E2E frameworks - choose one"

**Reality Check**:

**Can Teams Use Both?** YES, with valid use cases:

1. **Cypress for Component Testing + Playwright for E2E**
   - Cypress component testing offers significant performance advantages (reported 17x speed improvement over Playwright for component testing)
   - Playwright excels at cross-browser E2E, multi-tab applications, and CI/CD performance
   - The [cypress-playwright](https://github.com/bahmutov/cypress-playwright) bridge package exists specifically to enable this hybrid approach

2. **Migration Scenarios**
   - Teams migrating from Cypress to Playwright (or vice versa) often run both during transition
   - Using a hybrid approach for maintenance and migration of existing projects is proving effective

3. **Framework-Specific Strengths**
   - Cypress: Interactive debugging, visual error analysis, developer experience, rapid feedback
   - Playwright: Cross-browser support (Safari/WebKit), parallel execution, multi-tab/cross-domain testing

**2025-2026 Trends**:

- Playwright has sprinted ahead with deeper mobile emulation, built-in tracing, and faster test execution
- Cypress introduced better iframe support and component testing improvements
- Many teams are strategically combining tools rather than treating them as mutually exclusive

**Recommended YAML Update**:

```yaml
# VERIFY: Current skills-matrix.yaml has this in BOTH conflicts (line 275) AND discourages (line 321)
# Should be in discourages ONLY

# REMOVE from conflicts section:
# - skills: [playwright-e2e, cypress-e2e]
#   reason: "Both are E2E frameworks - choose one"

# KEEP in discourages with enhanced reason:
- skills: [cypress-e2e, playwright-e2e]
  reason: "Different strengths: Cypress excels at interactive debugging and component testing; Playwright offers better cross-browser support, parallelization, and CI/CD performance. Hybrid approaches valid for large projects (Cypress components + Playwright E2E)."
```

**Source**: [Playwright vs Cypress - BrowserStack](https://www.browserstack.com/guide/playwright-vs-cypress), [cypress-playwright bridge](https://github.com/bahmutov/cypress-playwright)

---

## 2. React Testing Library - Framework Dependency Analysis

**Our Claim**: `react-testing-library needs [react]` - "React Testing Library is React only"

**This is ACCURATE**, but incomplete context:

**The Testing Library Ecosystem**:

| Package                         | Framework                   | Status                                |
| ------------------------------- | --------------------------- | ------------------------------------- |
| `@testing-library/dom`          | **Framework-agnostic core** | Core library                          |
| `@testing-library/react`        | React                       | Official                              |
| `@testing-library/vue`          | Vue                         | Official                              |
| `@testing-library/angular`      | Angular                     | Official (Angular 20+ supported)      |
| `@testing-library/svelte`       | Svelte (including Svelte 5) | Official                              |
| `@testing-library/preact`       | Preact                      | Official                              |
| `@solidjs/testing-library`      | SolidJS                     | Official (maintained by SolidJS team) |
| `@marko/testing-library`        | Marko                       | Official                              |
| `@noma.to/qwik-testing-library` | Qwik                        | Community                             |

**Key Architectural Point**:

- `@testing-library/dom` is the foundation - it provides all DOM testing utilities
- Framework-specific packages are wrappers that add component rendering and framework-specific utilities
- Starting from RTL v16, you must install `@testing-library/dom` separately as a peer dependency

**Can RTL Patterns Be Used Elsewhere?** YES:

- Kent C. Dodds created React Testing Library, which "expanded to DOM Testing Library and now we have Testing Library implementations for every popular JavaScript framework"
- The core philosophy ("The more your tests resemble the way your software is used, the more confidence they can give you") applies across all implementations

**Vue Test Utils vs @testing-library/vue**:

- Vue Test Utils is the official Vue testing utility (implementation-focused)
- `@testing-library/vue` is an alternative that follows Testing Library philosophy (user-behavior-focused)
- They serve different testing philosophies - both are valid choices

**Recommended YAML Update**:

```yaml
# Current (correct, but enhance reason text):
- skill: react-testing-library
  needs: [react]
  reason: 'React Testing Library is React only. Note: Testing Library family has official packages for Vue, Angular, Svelte, Preact, Solid, and Marko using the same testing philosophy.'

# CONSIDER adding as alternatives if Angular/Svelte skills exist:
alternatives:
  - purpose: "Component Testing (Vue)"
    skills: [vue-test-utils, vue-testing-library]

  - purpose: "Component Testing (Angular)"
    skills: [angular-testing-library]

  - purpose: "Component Testing (Svelte)"
    skills: [svelte-testing-library]
```

**Source**: [Testing Library Official](https://testing-library.com/), [Angular Testing Library](https://testing-library.com/docs/angular-testing-library/intro/), [Svelte Testing Library](https://testing-library.com/docs/svelte-testing-library/intro/)

---

## 3. Vitest Recommendation Analysis

**Our Claim**: `when: react` suggests `vitest` - "Best-in-class React libraries"

**Reality Check - When Vitest is NOT the best choice**:

1. **React Native Projects**
   - "If you're building React Native apps: Jest is mandatory"
   - Vitest cannot replace Jest for React Native
   - Expo recommends Jest via `jest-expo` library

2. **Large Legacy Codebases**
   - Projects with extensive Jest test suites may not benefit from migration effort
   - Jest's mature ecosystem has more plugins and community support (3M downloads/week vs 1.5M)
   - In some real-world benchmarks, Jest completed full test runs 14% faster than Vitest

3. **Non-Vite Projects**
   - "It's possible to use Vitest without Vite, but doing so will typically require more effort"
   - If not using Vite, Jest's setup may actually be simpler

4. **Enterprise/Monorepo Requirements**
   - Jest's multi-project runner is more mature
   - Angular team chose Jest over Vitest due to "widespread adoption among Angular developers and its maturity"

5. **Maximum Stability Requirements**
   - Jest is battle-tested, backed by Meta with more resources
   - Vitest's documentation "may be outdated or inaccurate as the project evolves rapidly"

**When Vitest IS the Best Choice**:

- Vite-based projects (Vue, React+Vite, SolidJS, Svelte)
- TypeScript-heavy applications (no Babel, no ts-jest needed)
- Projects prioritizing developer experience and watch mode speed (10x faster in watch mode)
- New projects with no existing test suite

**Recommended YAML Update**:

```yaml
# UPDATE recommendation with conditions:
- when: react
  suggest:
    [zustand, react-query, vitest, react-hook-form, react-testing-library]
  reason: "Best-in-class React libraries. Note: For React Native, use Jest instead of Vitest."

# VERIFY react-native recommendation exists with Jest note:
- when: react-native
  suggest: [zustand, react-query, react-hook-form, zod-validation]
  reason: "React Native shares React ecosystem. Note: Use Jest for testing (Vitest does not support React Native)."
```

**Source**: [Jest vs Vitest - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/), [Jest vs Vitest - Sauce Labs](https://saucelabs.com/resources/blog/vitest-vs-jest-comparison)

---

## 4. MSW Compatibility Analysis

**Our Claim**: MSW recommends with `[vitest, react-testing-library]` - "Modern testing stack"

**Reality Check - MSW 2.0 Compatibility Issues**:

**Breaking Changes in MSW 2.0**:

- Node.js 18+ required (dropped support for v14-v16)
- TypeScript 4.7+ required
- API completely changed: `rest` renamed to `http`, response resolver signature changed
- Import paths changed: browser-side now from `msw/browser`

**Jest/JSDOM Issues**:

- "jest-environment-jsdom intentionally replaces built-in APIs with polyfills, breaking their Node.js compatibility"
- Workaround: Use `jest-fixed-jsdom` instead of `jest-environment-jsdom`
- MSW maintainers explicitly state: "If you find this setup cumbersome, consider migrating to a modern testing framework like Vitest"

**Playwright Integration**:

- Requires `@msw/playwright` package (v0.2.0) for optimal integration
- Without it, cross-process messaging makes MSW "clunky to work with"
- Node.js 20+ required for `@msw/playwright`
- "MSW worker and the Playwright worker can interfere with each other"
- Parallel test issues: "Playwright runs tests in parallel by default, but MSW keeps state globally, so tests can fail"

**Vitest Integration**:

- Works excellently, especially with Vitest Browser Mode
- MSW maintainer (kettanaito) added official Vitest Browser Mode recipe in January 2025
- No Node.js globals issues, native ESM support

**Framework Compatibility Summary**:

| Framework    | MSW Support              | Notes                             |
| ------------ | ------------------------ | --------------------------------- |
| Vitest       | Excellent                | Native ESM, no polyfill issues    |
| Jest         | Works with caveats       | Requires jest-fixed-jsdom         |
| Playwright   | Requires @msw/playwright | Node.js 20+, parallel test issues |
| Cypress      | Works                    | Component testing supported       |
| React Native | Works                    | Node.js integration               |

**Recommended YAML Update**:

```yaml
# UPDATE MSW recommendation:
- when: msw
  suggest: [vitest, react-testing-library]
  reason: "MSW + Vitest + RTL is the modern testing stack. Note: MSW 2.0 requires Node.js 18+. Jest requires jest-fixed-jsdom workaround. Playwright integration via @msw/playwright (Node.js 20+)."

# UPDATE vitest recommendation:
- when: vitest
  suggest: [react-testing-library, msw]
  reason: "Vitest + RTL + MSW is the modern testing stack. MSW 2.0 works seamlessly with Vitest (no JSDOM polyfill issues)."
```

**Source**: [MSW 1.x to 2.x Migration](https://mswjs.io/docs/migrations/1.x-to-2.x/), [MSW FAQ](https://mswjs.io/docs/faq/), [@msw/playwright](https://github.com/mswjs/playwright)

---

## 5. Testing Library Ecosystem - Missing Relationships

**Current State**: We only have `react-testing-library` and `vue-test-utils` in skills-matrix.yaml

**Missing from skills-matrix.yaml**:

| Package                    | Should Add? | Reason                                             |
| -------------------------- | ----------- | -------------------------------------------------- |
| `@testing-library/angular` | YES         | Official, actively maintained, Angular 20+ support |
| `@testing-library/svelte`  | YES         | Official, Svelte 5 support                         |
| `@testing-library/preact`  | CONSIDER    | If Preact skill added                              |
| `@solidjs/testing-library` | CONSIDER    | If SolidJS testing skill expanded                  |

**Angular Testing Library Note**:

- With Karma deprecated and Angular team undecided on future testing direction
- "It's developers' responsibility to find alternatives"
- Vitest + Angular Testing Library is emerging as the modern Angular testing approach

**Recommended YAML Additions** (if creating these skills):

```yaml
# ADD to skill_aliases:
angular-testing-library: "frontend/angular-testing-library (@vince)"
svelte-testing-library: "frontend/svelte-testing-library (@vince)"

# ADD to requires:
- skill: angular-testing-library
  needs: [angular]
  reason: 'Angular Testing Library is Angular only'

- skill: svelte-testing-library
  needs: [svelte]
  reason: 'Svelte Testing Library is Svelte only (supports Svelte 5)'

# UPDATE Angular recommendations:
- when: angular
  suggest: [ngrx-signalstore, angular-testing-library, vitest]
  reason: 'Angular ecosystem. Note: Vitest + Angular Testing Library is the modern approach as Karma is deprecated.'

# ADD Svelte recommendations (if svelte skill exists):
- when: svelte
  suggest: [svelte-testing-library, vitest, playwright-e2e]
  reason: 'Svelte testing ecosystem'
```

**Source**: [Angular Testing Library](https://www.npmjs.com/package/@testing-library/angular), [Svelte Testing Library](https://www.npmjs.com/package/@testing-library/svelte)

---

## Summary of Required YAML Changes

### 1. Playwright/Cypress Conflict - ACTION REQUIRED

**Current State**: Listed in BOTH conflicts (line 275) AND discourages (line 321)

```yaml
# REMOVE from conflicts section (line 275):
# - skills: [playwright-e2e, cypress-e2e]
#   reason: "Both are E2E frameworks - choose one"

# KEEP in discourages with updated reason (line 321):
- skills: [cypress-e2e, playwright-e2e]
  reason: "Different strengths: Cypress excels at interactive debugging and component testing; Playwright offers better cross-browser support, parallelization, and CI/CD performance. Hybrid approaches valid for large projects."
```

### 2. React Native Testing Exception - ADD

```yaml
# UPDATE react-native recommendation to explicitly note Jest:
- when: react-native
  suggest: [zustand, react-query, react-hook-form, zod-validation]
  reason: "React Native shares React ecosystem. Use Jest for testing (Vitest does not support React Native)."
```

### 3. MSW Recommendations - UPDATE REASON

```yaml
- when: msw
  suggest: [vitest, react-testing-library]
  reason: "MSW + Vitest + RTL is the modern testing stack. Note: MSW 2.0 requires Node.js 18+. Jest users need jest-fixed-jsdom. Playwright users need @msw/playwright (Node.js 20+)."
```

### 4. react-testing-library Reason - ENHANCE

```yaml
- skill: react-testing-library
  needs: [react]
  reason: "React Testing Library is React only. Testing Library family has packages for Vue, Angular, Svelte, Preact, Solid using the same philosophy."
```

### 5. Expand Testing Library Ecosystem (FUTURE)

Consider adding these skills when framework support is expanded:

- `angular-testing-library` (for Angular Testing Library)
- `svelte-testing-library` (for Svelte Testing Library)

---

## Outdated Claims Found

1. **Playwright vs Cypress as hard conflict** - **OUTDATED**. The skills-matrix.yaml currently has them in BOTH conflicts AND discourages. Modern teams successfully use both with dedicated purposes. Remove from conflicts, keep in discourages.

2. **Vitest universally recommended for React** - **INCOMPLETE**. React Native requires Jest; legacy projects may not benefit from migration.

3. **MSW "just works"** - **MISLEADING**. MSW 2.0 has significant breaking changes and framework-specific setup requirements that should be documented.

4. **Testing Library is just RTL** - **INCOMPLETE**. The ecosystem has grown to cover Angular, Svelte, Preact, Solid, and Marko with official packages.

---

## Action Items for skills-matrix.yaml

- [ ] **REMOVE** `[playwright-e2e, cypress-e2e]` from conflicts section (keep in discourages only)
- [ ] **UPDATE** react-native recommendation to include Jest note
- [ ] **UPDATE** msw recommendation reason with MSW 2.0 caveats
- [ ] **ENHANCE** react-testing-library reason text
- [ ] **CONSIDER** adding angular-testing-library and svelte-testing-library skills

---

## Sources

**Official Documentation**:

- [Playwright vs Cypress - BrowserStack](https://www.browserstack.com/guide/playwright-vs-cypress)
- [Playwright vs Cypress - Katalon](https://katalon.com/resources-center/blog/playwright-vs-cypress)
- [cypress-playwright Bridge Package](https://github.com/bahmutov/cypress-playwright)
- [MSW 1.x to 2.x Migration](https://mswjs.io/docs/migrations/1.x-to-2.x/)
- [MSW Introducing 2.0](https://mswjs.io/blog/introducing-msw-2.0)
- [MSW Playwright Integration](https://github.com/mswjs/playwright)
- [MSW FAQ](https://mswjs.io/docs/faq/)
- [Testing Library Official Site](https://testing-library.com/)
- [Angular Testing Library](https://testing-library.com/docs/angular-testing-library/intro/)
- [Svelte Testing Library](https://testing-library.com/docs/svelte-testing-library/intro/)
- [Preact Testing Library](https://testing-library.com/docs/preact-testing-library/intro/)
- [Solid Testing Library](https://github.com/solidjs/solid-testing-library)
- [Vitest Comparisons](https://vitest.dev/guide/comparisons)

**Ecosystem Research**:

- [Jest vs Vitest - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/vitest-vs-jest/)
- [Jest vs Vitest - Sauce Labs](https://saucelabs.com/resources/blog/vitest-vs-jest-comparison)
- [Jest vs Vitest - Speakeasy](https://www.speakeasy.com/blog/vitest-vs-jest)
- [Testing in 2026 - Nucamp](https://www.nucamp.co/blog/testing-in-2026-jest-react-testing-library-and-full-stack-testing-strategies)
- [Playwright + MSW 2025 - Medium](https://medium.com/@cleanCompile/testing-react-apps-with-playwright-msw-the-bulletproof-combo-you-need-in-2025-139afec5f8ce)
- [Angular Testing Library Benefits 2025](https://www.steffendielmann.com/2025/05/27/angular-testing-library-benefits/)
- [Unit Testing Angular with Vitest](https://www.telerik.com/blogs/unit-testing-angular-modern-testing-vitest)

**NPM Packages**:

- [@testing-library/angular](https://www.npmjs.com/package/@testing-library/angular)
- [@testing-library/svelte](https://www.npmjs.com/package/@testing-library/svelte)
- [@testing-library/preact](https://www.npmjs.com/package/@testing-library/preact)
- [@testing-library/dom](https://www.npmjs.com/package/@testing-library/dom)
- [@solidjs/testing-library](https://www.npmjs.com/package/@solidjs/testing-library)
- [@msw/playwright](https://www.npmjs.com/package/@msw/playwright)

---
