# Qwik Reference

> Project layout, import cheat sheet and the serializable-type table. See [SKILL.md](SKILL.md) for the
> decisions, patterns and red flags, and [examples/](examples/) for full code.

---

## Project Structure

```
src/
├── components/      # Reusable components
├── routes/          # File-based routing (Qwik City)
│   ├── index.tsx    # Home page (/)
│   ├── layout.tsx   # Root layout
│   ├── about/
│   │   └── index.tsx      # /about
│   ├── blog/
│   │   ├── index.tsx      # /blog
│   │   └── [id]/
│   │       └── index.tsx  # /blog/:id
│   └── api/
│       └── search/
│           └── index.ts   # API endpoint
├── entry.ssr.tsx    # SSR entry
└── root.tsx         # Root component
```

---

## Import Cheat Sheet

Taking an export from the wrong package is the most frequent import error in a Qwik codebase.

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
  Resource,
  Slot,
  noSerialize,
  $,
  type QRL,
  type Signal,
  type NoSerialize,
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
  type RequestHandler,
} from "@builder.io/qwik-city";
```

---

## Serializable Types

What may cross a `$` boundary, and what to do about the rest.

| Value type                                            | Serializable | How to handle                             |
| ----------------------------------------------------- | ------------ | ----------------------------------------- |
| Primitives (string, number, boolean, null, undefined) | Yes          | Use directly                              |
| Plain objects, arrays                                 | Yes          | Contents must also be serializable        |
| Date, RegExp, Map, Set, BigInt                        | Yes          | Built-in support                          |
| Promise                                               | Yes          | Pending state is serialized               |
| Signal, Store                                         | Yes          | Framework-managed                         |
| Error, JSX nodes                                      | Yes          |                                           |
| Top-level module references                           | Yes\*        | Referenced by path, not serialized        |
| Class instances                                       | **No**       | Use a plain object, or `noSerialize()`    |
| Functions and closures                                | **No**       | Wrap in `$()` to make a QRL               |
| DOM elements                                          | **No**       | Reach them via a ref in `useVisibleTask$` |
| Symbol                                                | **No**       |                                           |

\* A top-level export is reachable inside a `$` closure even when the value itself is non-serializable,
because the optimizer records the module path rather than the value. This is the main escape hatch.
