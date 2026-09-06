# Islands Architecture

> Code examples for Astro's islands architecture - client directives, server islands, and multi-framework usage. See [SKILL.md](../SKILL.md) for core concepts.

---

## Pattern 1: Client Directive Selection

### Good Example - Strategic Hydration

```astro
---
// src/pages/index.astro
import Header from "../components/Header.astro";
import HeroSection from "../components/HeroSection.astro";
import SearchBar from "../components/SearchBar"; // React
import FeaturedPosts from "../components/FeaturedPosts.astro";
import Newsletter from "../components/Newsletter"; // React
import ImageCarousel from "../components/ImageCarousel"; // React
import CookieBanner from "../components/CookieBanner"; // React
import Footer from "../components/Footer.astro";
---

<!-- Static components - zero JavaScript -->
<Header />
<HeroSection />

<!-- Immediately interactive - user expects to type right away -->
<SearchBar client:load placeholder="Search articles..." />

<!-- Static content list - no interactivity needed -->
<FeaturedPosts />

<!-- Below the fold - hydrate only when scrolled into view -->
<ImageCarousel client:visible images={carouselImages} />

<!-- Low priority - hydrate when browser is idle -->
<Newsletter client:idle />

<!-- Only on mobile - hydrate based on media query -->
<CookieBanner client:media="(max-width: 768px)" />

<Footer />
```

**Why good:** Only 4 of 8 components ship JavaScript, each hydrates at the optimal time, static components are pure HTML

### Bad Example - Over-Hydrating

```astro
<!-- BAD: Every component hydrated immediately -->
<Header client:load />
<HeroSection client:load />
<SearchBar client:load />
<FeaturedPosts client:load />
<ImageCarousel client:load />
<Newsletter client:load />
<CookieBanner client:load />
<Footer client:load />
```

**Why bad:** Defeats islands architecture, ships JavaScript for components that don't need it, slows page load with unnecessary hydration

---

## Pattern 2: client:only for Browser-Only Components

### Good Example - Components That Can't SSR

```astro
---
// src/pages/map.astro
// Leaflet requires window/document - cannot server-render
---

<!-- Skip SSR entirely, render only on client -->
<!-- Must specify the framework: "react", "vue", "svelte", "solid" -->
<MapComponent
  client:only="react"
  center={[51.505, -0.09]}
  zoom={13}
/>
```

**Why good:** Avoids SSR errors for browser-dependent libraries, still renders as an island, explicitly declares framework

### Bad Example - Using client:only When client:load Works

```astro
<!-- BAD: Skipping SSR unnecessarily -->
<UserProfile client:only="react" user={user} />

<!-- CORRECT: SSR provides HTML, then hydrate -->
<UserProfile client:load user={user} />
```

**Why bad:** `client:only` skips server-rendering so no HTML is sent initially (bad for SEO and perceived performance), use `client:load` when SSR is possible

---

## Pattern 3: Multi-Framework Islands

### Good Example - Mixing Frameworks on One Page

```astro
---
// src/pages/dashboard.astro
// Each framework component is an independent island
import ReactChart from "../components/ReactChart"; // React
import VueDataTable from "../components/VueDataTable.vue"; // Vue
import SvelteNotifications from "../components/SvelteNotifications.svelte"; // Svelte
import StatsHeader from "../components/StatsHeader.astro"; // Astro (static)
---

<!-- Static Astro component - zero JS -->
<StatsHeader title="Dashboard" />

<!-- React island for charts (heavy library already in React) -->
<ReactChart client:load data={chartData} />

<!-- Vue island for data table (team prefers Vue for tables) -->
<VueDataTable client:visible rows={tableData} />

<!-- Svelte island for lightweight notifications -->
<SvelteNotifications client:idle />
```

**Why good:** Each team/component uses the best framework for the job, islands are independent, no framework conflicts, static parts remain zero-JS

---

## Pattern 4: Server Islands

### Good Example - Deferred Dynamic Content

```astro
---
// src/components/PersonalizedBanner.astro
// This component runs on the server per-request
const user = await getUserFromCookie(Astro.cookies);
const recommendations = await getRecommendations(user?.id);
---

<section class="banner">
  {user ? (
    <h2>Welcome back, {user.name}!</h2>
    <ul>
      {recommendations.map((item) => (
        <li><a href={item.url}>{item.title}</a></li>
      ))}
    </ul>
  ) : (
    <h2>Welcome! Sign in for personalized content.</h2>
  )}
</section>
```

```astro
---
// src/pages/index.astro - Static page with server island
import ProductGrid from "../components/ProductGrid.astro";
import PersonalizedBanner from "../components/PersonalizedBanner.astro";
---

<!-- Static product grid - cached -->
<ProductGrid />

<!-- Server island - rendered per-request -->
<PersonalizedBanner server:defer>
  <div slot="fallback" class="loading-placeholder">
    <p>Loading personalized content...</p>
  </div>
</PersonalizedBanner>
```

**Why good:** Static page shell serves instantly from cache, personalized content renders per-request without blocking, fallback prevents layout shift

---

## Pattern 5: Sharing State Between Islands

Islands are separate component trees, so nothing passes between them by props or context. They share a module instead: a plain module-scoped value with a subscribe API, imported by every island that needs it. Any framework-agnostic reactive store gives you this shape ready-made — what matters is that the store lives outside all the frameworks, so each island can subscribe with whatever binding its own framework provides.

### Good Example - A Store Outside Every Framework

```typescript
// src/stores/cart-store.ts — plain module, no framework imports
export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

let items: CartItem[] = [];
const listeners = new Set<(items: CartItem[]) => void>();

export function getCart() {
  return items;
}

export function subscribeToCart(listener: (items: CartItem[]) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addToCart(item: Omit<CartItem, "quantity">) {
  const existing = items.find((i) => i.id === item.id);
  items = existing
    ? items.map((i) =>
        i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i,
      )
    : [...items, { ...item, quantity: 1 }];
  listeners.forEach((listener) => listener(items));
}
```

```tsx
// src/components/CartCount.tsx — one island reading the store
// Each UI framework has its own primitive for subscribing to an external store;
// this one is React's. Vue, Svelte and Solid each have an equivalent.
import { useSyncExternalStore } from "react";
import { getCart, subscribeToCart } from "../stores/cart-store";

export function CartCount() {
  const items = useSyncExternalStore(subscribeToCart, getCart, getCart);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  return <span class="cart-badge">{count}</span>;
}
```

```tsx
// src/components/AddToCartButton.tsx — a second island writing to it
import { addToCart, type CartItem } from "../stores/cart-store";

export function AddToCartButton(product: Omit<CartItem, "quantity">) {
  return <button onClick={() => addToCart(product)}>Add to cart</button>;
}
```

```astro
---
// src/pages/products/[id].astro — two islands, one store
import { AddToCartButton } from "../../components/AddToCartButton";
import { CartCount } from "../../components/CartCount";
---

<nav>Cart: <CartCount client:load /></nav>

<h1>{product.name}</h1>
<AddToCartButton client:load id={product.id} name={product.name} price={product.price} />
```

**Why good:** The store is a module rather than a component, so islands share it without sharing a tree, and islands written in different frameworks can subscribe to the same one. Keeping it free of framework imports is what makes that true. Replacing `items` rather than mutating it also matters: a subscription binding that compares snapshots by identity never re-renders for an array mutated in place.

---

_See [routing.md](routing.md) for routing patterns and [content.md](content.md) for content collection examples._
