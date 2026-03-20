# Qwik Framework Reference

> Decision frameworks, quick reference tables, and import cheat sheet for Qwik development. See [SKILL.md](SKILL.md) for core concepts and red flags, and [examples/](examples/) for code examples.

---

## Decision Framework

### State Management Selection

```
What kind of value are you storing?
├─ Single primitive (boolean, string, number)
│   └─ useSignal (access via .value)
├─ Object or array
│   └─ useStore (mutate properties directly, deep tracking by default)
├─ Derived value (computed from other signals/stores)
│   └─ Is it synchronous?
│       ├─ YES → useComputed$ (auto-tracks dependencies)
│       └─ NO → useResource$ (async, non-blocking, has loading/error states)
└─ Server-provided data
    └─ routeLoader$ (runs before render, SSR-integrated)
```

### Task Hook Selection

```
When does this code need to run?
├─ Before render, reactive to state changes
│   └─ useTask$ (server + client, blocks render)
│       └─ Does it need to fetch data?
│           ├─ YES, initial page load → routeLoader$ (preferred)
│           ├─ YES, reactive to state → useResource$ (non-blocking)
│           └─ NO → useTask$ is fine
├─ After render, browser-only
│   └─ useVisibleTask$ (DOM manipulation, browser APIs, animations)
│       └─ Caution: defeats resumability - use sparingly
├─ Synchronous derived value
│   └─ useComputed$ (not a task, but often confused with one)
└─ Server-only function callable from client
    └─ server$ (RPC, runs on server, callable from onClick$ etc.)
```

### Data Loading Strategy

```
Where does the data come from?
├─ Server, needed before page renders
│   └─ routeLoader$ (preferred - SSR streaming, runs before render)
├─ Server, reactive to client state changes
│   └─ useResource$ with server$ (non-blocking, re-fetches on signal change)
├─ Server, triggered by user action
│   └─ routeAction$ (form submissions, mutations)
│       └─ Need RPC without a form? → server$ called from onClick$
├─ Client-side computation
│   └─ useComputed$ (synchronous) or useResource$ (async)
└─ External API from client
    └─ useResource$ with fetch (non-blocking, handles loading/error)
```

### Event Handler Pattern

```
Does this handler need synchronous Event APIs?
├─ YES (preventDefault, stopPropagation, currentTarget)
│   ├─ preventDefault → use preventdefault:eventname attribute
│   ├─ stopPropagation → use stoppropagation:eventname attribute
│   └─ currentTarget → use second parameter (_, element)
└─ NO → Standard on{Event}$ handler
    └─ Is it reused across components?
        ├─ YES → Extract with $() wrapper, type as QRL
        └─ NO → Inline arrow in on{Event}$
```

### Styling Approach

```
What kind of styles?
├─ Component-scoped styles
│   ├─ CSS Modules → import styles from "./component.module.css"
│   └─ Scoped inline → useStylesScoped$(styles)
├─ Global styles
│   └─ Import in root layout (auto-inlined if <10KB)
└─ Slot content styling (child components)
    └─ :global() selector within scoped styles
```

**Note:** CSS-in-JS libraries that rely on runtime style injection are incompatible with Qwik's SSR streaming. Only zero-runtime CSS-in-JS solutions work. Apply your styling solution of choice.

**Note:** For red flags, anti-patterns, and gotchas, see [SKILL.md](SKILL.md).

---

## Quick Reference

### Project Structure

```
src/
├── components/      # Reusable components
├── routes/          # File-based routing (Qwik City)
│   ├── index.tsx    # Home page (/)
│   ├── layout.tsx   # Root layout
│   ├── about/
│   │   └── index.tsx  # /about
│   ├── blog/
│   │   ├── index.tsx  # /blog
│   │   └── [id]/
│   │       └── index.tsx  # /blog/:id
│   └── api/
│       └── search/
│           └── index.ts  # API endpoint
├── entry.ssr.tsx    # SSR entry
└── root.tsx         # Root component
```

### Import Cheat Sheet

```typescript
// Components, state, lifecycle
import {
  component$,
  useSignal,
  useStore,
  useComputed$,
  useTask$,
  useVisibleTask$,
  useResource$,
  Slot,
  $,
  type QRL,
  type Signal,
} from "@builder.io/qwik";

// Routing, server features
import {
  routeLoader$,
  routeAction$,
  server$,
  Form,
  Link,
  useNavigate,
  useLocation,
  zod$,
  z,
} from "@builder.io/qwik-city";
```

### Serializable Types

| Type                    | Serializable | Notes                              |
| ----------------------- | ------------ | ---------------------------------- |
| string, number, boolean | Yes          | Primitives always work             |
| null, undefined         | Yes          |                                    |
| Plain objects, arrays   | Yes          | Contents must also be serializable |
| Date, RegExp, Map, Set  | Yes          | Built-in serialization support     |
| BigInt                  | Yes          |                                    |
| Promise                 | Yes          | Qwik serializes pending promises   |
| Signal, Store           | Yes          | Framework-managed                  |
| Error                   | Yes          |                                    |
| JSX nodes               | Yes          |                                    |
| Class instances         | **No**       | Use plain objects or noSerialize() |
| Functions/closures      | **No**       | Must be QRLs (wrapped in $())      |
| DOM elements            | **No**       | Use useVisibleTask$ for DOM access |
| Symbol                  | **No**       |                                    |
