# Performance — Core Web Vitals

> LCP, INP and CLS patterns, and measuring them in the field. Thresholds are in [reference.md](../reference.md).

---

## LCP: the largest element

```html
<link rel="preload" as="image" href="/hero.avif" type="image/avif" />

<img
  src="/hero.avif"
  alt="Hero"
  width="1200"
  height="600"
  fetchpriority="high"
  decoding="async"
/>
```

**Why good:** the preload starts the fetch before the parser reaches the `<img>`, `fetchpriority`
puts it ahead of the other images competing for bandwidth, and the explicit dimensions reserve its
space so improving LCP does not cost CLS.

```html
<!-- Bad -->
<img src="/hero-4k.jpg" alt="Hero" />
```

**Why bad:** a multi-megabyte original at full resolution, discovered late, with no reserved space —
it sets LCP and damages CLS in the same element.

Find the LCP element before optimising: it is whatever the browser judged largest in the viewport,
which is often a heading or a background rather than the image you expected.

---

## INP: keeping the main thread free

### Moving work off the thread

```typescript
// workers/process-data.ts
self.onmessage = (event: MessageEvent<{ data: RawRow[] }>) => {
  self.postMessage({ result: processLargeDataset(event.data.data) });
};
```

```typescript
import { useEffect, useState } from "react";

export function DataProcessor({ data }: Props) {
  const [result, setResult] = useState<ProcessedRow[] | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./workers/process-data.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event) => setResult(event.data.result);
    worker.postMessage({ data });

    return () => worker.terminate();
  }, [data]);

  return result ? <Results rows={result} /> : <Spinner />;
}
```

**Why good:** the computation runs on its own thread, so clicks and keystrokes are handled while it
works. Terminating in the cleanup stops an orphaned worker surviving the component and posting into
nothing.

### Yielding inside a long loop

```typescript
const LONG_TASK_THRESHOLD_MS = 50;

async function processItems(items: Item[]) {
  for (const item of items) {
    processItem(item);

    if ("scheduler" in globalThis && "yield" in globalThis.scheduler) {
      await globalThis.scheduler.yield();
    } else {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}
```

**Why good:** a task over 50 ms blocks every interaction that arrives during it. Yielding lets the
browser handle input between items; `scheduler.yield()` resumes at the front of the queue where
`setTimeout(0)` goes to the back, which is why the fallback is slower rather than equivalent.

```typescript
// Bad — seconds of work between paints
export function DataProcessor({ data }: Props) {
  const result = processLargeDataset(data);
  return <Results rows={result} />;
}
```

**Why bad:** it runs during render, so nothing paints and no input is handled until it finishes.

---

## CLS: reserving space

```html
<img
  src="/product.avif"
  alt="Product"
  width="800"
  height="400"
  loading="lazy"
  decoding="async"
/>
```

**Why good:** width and height give the browser an aspect ratio to reserve before a byte of the image
arrives, so nothing below it moves when it lands.

```html
<!-- Bad -->
<img src="/product.jpg" alt="Product" />
```

**Why bad:** the image occupies nothing until it loads, then pushes everything below it down —
usually just as someone is reaching for a link.

### Fonts

```css
@font-face {
  font-family: "CustomFont";
  src: url("/fonts/custom-font.woff2") format("woff2");
  font-display: swap;
  size-adjust: 95%;
}

body {
  font-family: "CustomFont", Arial, sans-serif;
}
```

**Why good:** `font-display: swap` shows the fallback immediately rather than leaving invisible text,
and `size-adjust` scales the fallback so the swap changes glyphs without changing line breaks — which
is the layout shift the swap would otherwise cause.

Without `font-display`, the default is a block period during which the text is invisible entirely.

---

## Measuring real sessions

```typescript
// lib/web-vitals.ts
import { onCLS, onINP, onFCP, onLCP, onTTFB } from "web-vitals";
import type { Metric } from "web-vitals";

const ANALYTICS_ENDPOINT = "/api/analytics";

function send(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    id: metric.id,
    rating: metric.rating, // "good" | "needs-improvement" | "poor"
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(ANALYTICS_ENDPOINT, body);
    return;
  }

  fetch(ANALYTICS_ENDPOINT, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => {});
}

/** Call once, at startup */
export function initWebVitals() {
  onCLS(send);
  onINP(send);
  onFCP(send);
  onLCP(send);
  onTTFB(send);
}
```

**Why good:** `sendBeacon` survives the page unload, which is when CLS and INP reach their final
values — a plain `fetch` at that moment is cancelled. Reporting `delta` as well as `value` lets the
receiver aggregate without double-counting, and `rating` gives a pass/fail without the consumer
knowing the thresholds.

**Call each function once per page load.** Each registers a `PerformanceObserver` that lives for the
page's lifetime, so a second registration reports every metric twice.

Aggregate at the 75th percentile, split by device class. A mean hides the slow tail, which is the
part these metrics exist to expose.
