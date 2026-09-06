---
name: web-i18n-next-intl
description: Type-safe i18n for the App Router — locale routing, message rendering, formatting and static generation. Load when a project imports next-intl.
---

# next-intl Internationalization Patterns

> **Quick Guide:** `useTranslations` renders messages, `useFormatter` renders dates, numbers and
> lists, and `createMiddleware` detects the locale. `setRequestLocale(locale)` at the top of a
> page or layout is what keeps it statically renderable. v4.0+ registers types through the
> `AppConfig` interface and sets the locale cookie only when the user switches away from their
> Accept-Language preference. Every pattern here is App Router — the Pages Router integration is a
> separate API and none of this transfers to it.

**Detailed Resources:**

- [examples/core.md](examples/core.md) — setup, provider, `useTranslations`, plurals, formatting, static rendering, locale switching, types
- [examples/formatting.md](examples/formatting.md) — relative time with auto-update, list formatting, combined format patterns
- [examples/pluralization.md](examples/pluralization.md) — ordinals, plural nested in select, zero-case handling
- [examples/markup.md](examples/markup.md) — `t.markup()` for HTML strings: email bodies, feeds, sanitisation
- [reference.md](reference.md) — decision trees, anti-pattern code, ICU syntax tables, setup checklists

---

## Which path applies

- **Rendering inside a component** — `useTranslations` and `useFormatter`, with
  `NextIntlClientProvider` above any Client Component that calls them. Follow
  [examples/core.md](examples/core.md).
- **Rendering outside the component tree** — metadata, Server Actions and other async contexts take
  `getTranslations({ locale, namespace })`, which needs the locale passed explicitly. Also in
  [examples/core.md](examples/core.md).
- **Producing an HTML string rather than elements** — `t.markup()` instead of `t.rich()`, and the
  sanitisation that goes with it. Follow [examples/markup.md](examples/markup.md).

---

<critical_requirements>

## Before writing next-intl code

**Call `setRequestLocale(locale)` at the top of every page and layout, before any hook.** It is what
lets next-intl resolve the locale without a request, which is what keeps the route statically
renderable.

**Validate the locale with `hasLocale(routing.locales, locale)` before using it.** An unvalidated
segment reaches the message loader and fails there, well away from the route that produced it.

**Wrap the tree in `NextIntlClientProvider`.** Client Components read their messages from that
context and render nothing without it.

</critical_requirements>

---

**Auto-detection:** next-intl, useTranslations, useFormatter, useLocale, getTranslations,
setRequestLocale, NextIntlClientProvider, defineRouting, createNavigation, hasLocale, ICU message
format

**Applies to:**

- Locale-segment routing, locale detection and the locale-aware navigation APIs
- Rendering messages with interpolation, pluralization and embedded markup
- Formatting dates, numbers, relative time and lists per locale
- Generating every locale variant of a route at build time
- Typing message keys and formats so a missing key fails at compile time

**Handled elsewhere:**

- Framework routing and rendering beyond the locale segment — this skill settles what next-intl adds
  to a route, not how routes are defined
- Translation file authoring and sync with a translation vendor — messages arrive as JSON and where
  they came from is not this skill's concern
- Client state other than the locale — the locale is read with `useLocale()` and never mirrored
- Date arithmetic — formatting a `Date` is this skill's job; producing one is not

---

<philosophy>

Translations are namespaced JSON, resolved per request on the server and handed to the client
through context. Two decisions follow from that. Locale-aware rendering is a server concern by
default, so the client tree carries only what interactivity needs. And because a request is what
normally supplies the locale, static rendering needs it supplied another way — which is what
`setRequestLocale` is for, and why it has to run before anything reads the locale.

</philosophy>

---

<patterns>

## Core patterns

### Pattern 1: Project setup

Four modules and a proxy: `routing.ts` declares the locales, `request.ts` resolves one per request,
`navigation.ts` produces locale-aware navigation APIs, and the proxy detects the locale from URL,
cookie and `Accept-Language`.

```typescript
// i18n/routing.ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "de", "fr"],
  defaultLocale: "en",
});

export type Locale = (typeof routing.locales)[number];
```

The proxy file is `proxy.ts` from Next.js 16 onwards and `middleware.ts` before it; the export is
`createMiddleware(routing)` either way.

Full code: [examples/core.md](examples/core.md)

### Pattern 2: Root layout with provider

Validate the locale, set it, load the messages, and wrap the tree.

```typescript
if (!hasLocale(routing.locales, locale)) notFound();
setRequestLocale(locale);

return (
  <html lang={locale}>
    <body>
      <NextIntlClientProvider messages={await getMessages()}>{children}</NextIntlClientProvider>
    </body>
  </html>
);
```

From v4.0 the provider inherits messages from the server config, so the `messages` prop is optional.

Full code: [examples/core.md](examples/core.md)

### Pattern 3: useTranslations

A namespace scopes the keys, and values are named placeholders.

```typescript
const t = useTranslations("Profile");

t("greeting", { name: user.name }); // "Hello, Jane!"
t("unreadCount", { count: messages.length });
```

Full code: [examples/core.md](examples/core.md)

### Pattern 4: Pluralization with ICU syntax

The plural form is chosen by the locale's own CLDR rules, and `#` renders the formatted count. `=0`
matches exactly zero, which is distinct from the `zero` CLDR category.

```json
{
  "itemCount": "{count, plural, =0 {No items} one {# item} other {# items}}"
}
```

Ordinals use `selectordinal`; enum-valued messages use `select`.

Full code: [examples/core.md](examples/core.md), ordinals and nesting in
[examples/pluralization.md](examples/pluralization.md)

### Pattern 5: Rich text with t.rich()

Tags in the message are developer-defined and map to components, so the sentence stays whole for the
translator.

```typescript
t.rich("terms", {
  link: (chunks) => <a href="/terms">{chunks}</a>,
  bold: (chunks) => <strong>{chunks}</strong>,
});
```

Full code: [examples/core.md](examples/core.md)

### Pattern 6: useFormatter

One hook covers dates, numbers, lists and relative time, each backed by the matching `Intl`
formatter.

```typescript
const format = useFormatter();

format.dateTime(date, { year: "numeric", month: "long", day: "numeric" });
format.number(amount, { style: "currency", currency });
format.relativeTime(date, useNow({ updateInterval: 60_000 }));
```

Full code: [examples/core.md](examples/core.md), auto-updating relative time and lists in
[examples/formatting.md](examples/formatting.md)

### Pattern 7: Static rendering

`generateStaticParams` enumerates the locale variants, and `setRequestLocale` makes each one
renderable without a request.

```typescript
export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    slugs.map((slug) => ({ locale, slug })),
  );
}
```

Full code: [examples/core.md](examples/core.md)

### Pattern 8: Locale switching

The navigation APIs from `createNavigation` swap the locale while preserving the current path.

```typescript
const router = useRouter();
const pathname = usePathname();

router.replace(pathname, { locale: newLocale });
```

Full code: [examples/core.md](examples/core.md)

### Pattern 9: Type-safe keys

Register the message shape on the `AppConfig` interface (v4.0+) and a wrong key becomes a compile
error.

```typescript
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof en;
    Formats: typeof formats;
  }
}
```

Set `allowArbitraryExtensions: true` in `tsconfig.json` to import the JSON. For inferred argument
types, the plugin's `experimental.createMessagesDeclaration` generates them.

Full code: [examples/core.md](examples/core.md)

### Pattern 10: Async contexts

`getTranslations` works where hooks cannot. Metadata runs outside the component tree, so the locale
is passed rather than inferred.

```typescript
const t = await getTranslations({ locale, namespace: "Metadata" });

return { title: t("title"), description: t("description") };
```

Full code: [examples/core.md](examples/core.md)

</patterns>

---

<red_flags>

## Red flags

**Breaks at runtime:**

- Reading `params` without awaiting it — it is a Promise from Next.js 15 onwards
- Calling `setRequestLocale` after a hook has already read the locale — the hook fails, and the
  error names the hook rather than the ordering
- Client Components rendered outside `NextIntlClientProvider` — no messages reach them
- Using an unvalidated locale segment — the message import fails on a path the route never declared
- A proxy still named `middleware.ts` on Next.js 16 — it is not picked up, so no locale is detected
- `t()` on a message containing markup — it returns the tags as literal text
- `useTranslations` inside `generateMetadata` or a Server Action — it is a hook, and both run outside
  the component tree; `getTranslations({ locale, namespace })` is what works there

**Surprising behaviour:**

- Omitting `setRequestLocale` costs static rendering silently: the route still works, dynamically.
  `generateStaticParams` is the other half, and a route missing either one is rendered per request
- `t.rich()` tag functions receive `chunks` as an array, not a single element
- `useNow()` only ticks on the client, so SSR shows the initial value until hydration
- Omitting the namespace in `useTranslations` puts every key in one global space, where names collide
- From v4.0 the locale cookie is a session cookie and is written only when the user switches away
  from their `Accept-Language` preference — `localeCookie` in the routing config changes both
- On Next.js 16 the proxy runs on the Node runtime rather than the Edge runtime

Anti-patterns with the code that fixes them: [reference.md](reference.md).

</red_flags>
